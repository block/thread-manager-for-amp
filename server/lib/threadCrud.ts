import { readFile, writeFile, access, rm } from 'fs/promises';
import { join } from 'path';
import { AMP_HOME } from './constants.js';
import { runAmp } from './utils.js';
import { deleteThreadData } from './database.js';
import { getKnownWorkspaces as getKnownWorkspacesImpl } from './workspaces.js';
import { listAllThreads, readThreadFile } from './threadProvider.js';
import type { ThreadsResult, FileChange, FileEdit, KnownWorkspace } from '../../shared/types.js';
import {
  ARTIFACTS_DIR,
  THREADS_DIR,
  isTextContent,
  isToolUseContent,
  type ThreadFile,
} from './threadTypes.js';

interface GetThreadsOptions {
  limit?: number;
  offset?: number;
}

export async function getThreads({
  limit = 500,
  offset = 0,
}: GetThreadsOptions = {}): Promise<ThreadsResult> {
  // Fetch limit + offset threads so we can slice the requested window
  const allThreads = await listAllThreads(offset + limit);

  const sliced = allThreads.slice(offset, offset + limit);
  const lastThread = sliced[sliced.length - 1];
  // If we got back a full window, there are likely more beyond it
  const hasMore = allThreads.length >= offset + limit;

  return {
    threads: sliced,
    nextCursor: lastThread && hasMore ? lastThread.id : null,
    hasMore,
    totalCount: allThreads.length,
  };
}

interface FileChangesData {
  edits: FileEdit[];
  created: boolean;
}

export async function getThreadChanges(threadId: string): Promise<FileChange[]> {
  try {
    const data = await readThreadFile(threadId);
    const messages = data.messages || [];

    const fileChanges = new Map<string, FileChangesData>();

    for (const msg of messages) {
      if (msg.role === 'assistant' && Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (isToolUseContent(block)) {
            const { name, input } = block;

            if (name === 'create_file' && input?.path) {
              const path = input.path;
              if (!fileChanges.has(path)) {
                fileChanges.set(path, { edits: [], created: true });
              }
              const fc = fileChanges.get(path);
              if (!fc) continue;
              fc.created = true;
              if (input.content) {
                fc.edits.push({
                  type: 'create',
                  preview: input.content.slice(0, 500),
                  lines: input.content.split('\n').length,
                });
              }
            } else if (name === 'edit_file' && input?.path) {
              const path = input.path;
              if (!fileChanges.has(path)) {
                fileChanges.set(path, { edits: [], created: false });
              }
              fileChanges.get(path)?.edits.push({
                type: 'edit',
                oldStr: input.old_str || '',
                newStr: input.new_str || '',
              });
            }
          }
        }
      }
    }

    const changes: FileChange[] = [];
    for (const [path, changeData] of fileChanges) {
      const filename = path.split('/').pop() || path;
      const dir = path.split('/').slice(-3, -1).join('/');

      changes.push({
        path,
        filename,
        dir,
        created: changeData.created,
        editCount: changeData.edits.filter((e) => e.type === 'edit').length,
        edits: changeData.edits.slice(0, 10),
      });
    }

    changes.sort((a, b) => b.editCount - a.editCount);
    return changes;
  } catch (e) {
    const error = e as Error;
    console.error('[threads] Failed to get thread changes:', error.message);
    return [];
  }
}

export async function archiveThread(threadId: string): Promise<string> {
  return runAmp(['threads', 'archive', threadId]);
}

async function cleanupThreadFiles(threadId: string): Promise<void> {
  // Delete artifacts directory
  const threadArtifactsDir = join(ARTIFACTS_DIR, threadId);
  await rm(threadArtifactsDir, { recursive: true, force: true }).catch(() => {});

  // Delete SQLite records (metadata, blocks, artifacts)
  deleteThreadData(threadId);
}

interface DeleteResult {
  success: boolean;
  localOnly?: boolean;
  error?: string;
}

export async function deleteThread(threadId: string): Promise<DeleteResult> {
  try {
    await runAmp(['threads', 'delete', threadId]);
    await cleanupThreadFiles(threadId);
    console.log(`[threads] Deleted ${threadId}`);
    return { success: true };
  } catch (e) {
    const error = e as Error;
    console.error(`[threads] Delete failed for ${threadId}: ${error.message}`);
    return { success: false, error: error.message };
  }
}

interface CreateThreadResult {
  threadId: string;
  workspace: string | null;
}

export async function createThread(
  workspacePath: string | null = null,
  mode?: string,
): Promise<CreateThreadResult> {
  // Run amp threads new from the specified workspace directory
  const cwd = workspacePath || AMP_HOME;
  // --mode is a global flag that must come before the subcommand
  const args = mode ? ['--mode', mode, 'threads', 'new'] : ['threads', 'new'];
  const stdout = await runAmp(args, { cwd });
  const match = stdout.match(/T-[\w-]+/);
  if (!match) {
    throw new Error('Could not parse thread ID from output');
  }
  return { threadId: match[0], workspace: workspacePath };
}

export async function getKnownWorkspaces(): Promise<KnownWorkspace[]> {
  return getKnownWorkspacesImpl();
}

export async function renameThread(threadId: string, name: string): Promise<string> {
  return runAmp(['threads', 'rename', threadId, name]);
}

interface ShareResult {
  output: string;
}

export async function shareThread(threadId: string): Promise<ShareResult> {
  const stdout = await runAmp(['threads', 'share', threadId]);
  return { output: stdout.trim() };
}

// ── Thread mutation functions ──────────────────────────────────────────

interface TruncateResult {
  truncatedMessage: string;
  messagesRemoved: number;
}

/**
 * Truncate thread to keep only messages[0..messageIndex-1].
 * Returns the text of the removed message at messageIndex and count of removed messages.
 */
export async function truncateThreadAtMessage(
  threadId: string,
  messageIndex: number,
): Promise<TruncateResult> {
  const threadPath = join(THREADS_DIR, `${threadId}.json`);
  try {
    await access(threadPath);
  } catch {
    throw new Error(
      'Cannot edit this thread — it exists only on the server and has no local file.',
    );
  }
  const content = await readFile(threadPath, 'utf-8');
  const data = JSON.parse(content) as ThreadFile;
  const messages = data.messages || [];

  if (messageIndex < 0 || messageIndex >= messages.length) {
    throw new Error('Invalid message index');
  }

  const msg = messages[messageIndex];
  let truncatedText = '';
  if (msg) {
    if (typeof msg.content === 'string') {
      truncatedText = msg.content;
    } else if (Array.isArray(msg.content)) {
      const textBlock = msg.content.find(isTextContent);
      truncatedText = textBlock?.text || '';
    }
  }

  const removed = messages.length - messageIndex;
  data.messages = messages.slice(0, messageIndex);

  await writeFile(threadPath, JSON.stringify(data, null, 2));
  return { truncatedMessage: truncatedText, messagesRemoved: removed };
}

interface UndoResult {
  messagesRemoved: number;
}

/**
 * Remove the last user message and all subsequent messages (the last "turn").
 */
export async function undoLastTurn(threadId: string): Promise<UndoResult> {
  const threadPath = join(THREADS_DIR, `${threadId}.json`);
  try {
    await access(threadPath);
  } catch {
    throw new Error(
      'Cannot edit this thread — it exists only on the server and has no local file.',
    );
  }
  const content = await readFile(threadPath, 'utf-8');
  const data = JSON.parse(content) as ThreadFile;
  const messages = data.messages || [];

  // Find the last user message
  let lastUserIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === 'user') {
      lastUserIdx = i;
      break;
    }
  }

  if (lastUserIdx === -1) {
    throw new Error('No user message to undo');
  }

  const removed = messages.length - lastUserIdx;
  data.messages = messages.slice(0, lastUserIdx);
  await writeFile(threadPath, JSON.stringify(data, null, 2));
  return { messagesRemoved: removed };
}

/**
 * Read raw messages from a thread file for counting/inspection.
 */
export async function getThreadMessageCount(threadId: string): Promise<number> {
  const data = await readThreadFile(threadId);
  return (data.messages || []).length;
}
