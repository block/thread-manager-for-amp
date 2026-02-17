import { readFile, readdir, stat, unlink, rm } from 'fs/promises';
import type { Stats } from 'fs';
import { join } from 'path';
import { DEFAULT_MAX_CONTEXT_TOKENS } from './constants.js';
import { AMP_HOME } from './constants.js';
import { calculateCost, estimateToolCosts, isHiddenCostTool } from '../../shared/cost.js';
import type { ToolCostCounts } from '../../shared/cost.js';
import { formatRelativeTime, runAmp } from './utils.js';
import { deleteThreadData } from './database.js';
import { getKnownWorkspaces as getKnownWorkspacesImpl } from './workspaces.js';
import type {
  Thread,
  ThreadsResult,
  FileChange,
  FileEdit,
  KnownWorkspace,
} from '../../shared/types.js';
import {
  ARTIFACTS_DIR,
  THREADS_DIR,
  type TextContent,
  type ToolUseContent,
  type ThreadFile,
  type FileStat,
} from './threadTypes.js';

interface GetThreadsOptions {
  limit?: number;
  cursor?: string | null;
}

export async function getThreads({ limit = 50, cursor = null }: GetThreadsOptions = {}): Promise<ThreadsResult> {
  try {
    const files = await readdir(THREADS_DIR);
    const threadFiles = files.filter((f: string) => f.startsWith('T-') && f.endsWith('.json'));
    
    // Get file stats for sorting before loading full content
    const fileStats = await Promise.all(
      threadFiles.map(async (file: string): Promise<FileStat | null> => {
        const filePath = join(THREADS_DIR, file);
        try {
          const fileStat: Stats = await stat(filePath);
          return { file, mtime: fileStat.mtime.getTime() };
        } catch {
          return null;
        }
      })
    );
    
    // Sort by mtime descending
    const sortedFiles = (fileStats.filter(Boolean) as FileStat[])
      .sort((a, b) => b.mtime - a.mtime);
    
    // Find cursor position and slice
    let startIndex = 0;
    if (cursor) {
      const cursorIndex = sortedFiles.findIndex((f) => f.file === `${cursor}.json`);
      if (cursorIndex !== -1) {
        startIndex = cursorIndex + 1;
      }
    }
    
    const slicedFiles = sortedFiles.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < sortedFiles.length;
    
    const threads = await Promise.all(
      slicedFiles.map(async ({ file }): Promise<Thread | null> => {
        const filePath = join(THREADS_DIR, file);
        try {
          const content = await readFile(filePath, 'utf-8');
          const data = JSON.parse(content) as ThreadFile;
          const fileStat: Stats = await stat(filePath);
          
          const messages = data.messages || [];
          
          // Get title from first user message or use thread ID
          let title = data.title || '';
          if (!title && messages.length > 0) {
            const firstUser = messages.find((m) => m.role === 'user');
            if (firstUser?.content) {
              let textContent = '';
              if (typeof firstUser.content === 'string') {
                textContent = firstUser.content;
              } else if (Array.isArray(firstUser.content)) {
                const textBlock = firstUser.content.find(
                  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard
                  (c): c is TextContent => typeof c === 'object' && c !== null && c.type === 'text'
                );
                textContent = textBlock?.text || '';
              }
              title = textContent.slice(0, 60).replace(/\n/g, ' ').trim();
              if (textContent.length > 60) title += '...';
            }
          }
          if (!title) title = file.replace('.json', '');
          
          // Extract model from tags
          const tags = data.env?.initial?.tags || [];
          const modelTag = tags.find((t) => t.startsWith('model:'));
          let model: string | undefined;
          let isOpus = false;
          if (modelTag) {
            const modelName = modelTag.replace('model:', '');
            if (modelName.includes('opus')) {
              model = 'opus';
              isOpus = true;
            } else if (modelName.includes('sonnet')) {
              model = 'sonnet';
            } else {
              model = modelName;
            }
          }
          
          // Calculate token usage and cost
          let freshInputTokens = 0;  // Non-cached input tokens
          let totalOutputTokens = 0;
          let cacheCreation = 0;
          let cacheRead = 0;
          let contextTokens = 0;
          let maxContextTokens = DEFAULT_MAX_CONTEXT_TOKENS;
          let turns = 0;
          const hiddenToolCounts: ToolCostCounts = {};
          const taskPromptLengths: number[] = [];
          
          for (const msg of messages) {
            if (msg.usage) {
              freshInputTokens += msg.usage.inputTokens || 0;
              totalOutputTokens += msg.usage.outputTokens || 0;
              cacheCreation += msg.usage.cacheCreationInputTokens || 0;
              cacheRead += msg.usage.cacheReadInputTokens || 0;
              contextTokens = msg.usage.totalInputTokens || contextTokens;
              maxContextTokens = msg.usage.maxInputTokens || maxContextTokens;
              turns++;
            }
            if (Array.isArray(msg.content)) {
              for (const block of msg.content) {
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard
                if (typeof block === 'object' && block !== null && block.type === 'tool_use') {
                  const toolBlock = block as ToolUseContent;
                  const name = toolBlock.name;
                  if (name && isHiddenCostTool(name)) {
                    hiddenToolCounts[name] = (hiddenToolCounts[name] || 0) + 1;
                    if (name === 'Task') {
                      const prompt = (toolBlock.input?.prompt as string) || '';
                      taskPromptLengths.push(prompt.length);
                    }
                  }
                }
              }
            }
          }
          const tokenCost = calculateCost({
            inputTokens: freshInputTokens,
            cacheCreationTokens: cacheCreation,
            cacheReadTokens: cacheRead,
            outputTokens: totalOutputTokens,
            isOpus,
            turns,
          });
          const cost = tokenCost + estimateToolCosts(hiddenToolCounts, taskPromptLengths);
          
          const contextPercent = maxContextTokens > 0 
            ? Math.round((contextTokens / maxContextTokens) * 100) 
            : 0;
          
          // Extract workspace/repo info
          const trees = data.env?.initial?.trees || [];
          const workspace = trees[0]?.displayName || null;
          const workspaceUri = trees[0]?.uri || null;
          const workspacePath = workspaceUri ? workspaceUri.replace('file://', '') : null;
          const repoUrl = trees[0]?.repository?.url || null;
          let repo: string | null = null;
          if (repoUrl) {
            const match = repoUrl.match(/[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
            repo = match?.[1] ?? repoUrl;
          }
          
          // Extract handoff relationships
          const relationships = data.relationships || [];
          let handoffParentId: string | null = null;
          let handoffChildId: string | null = null;
          for (const rel of relationships) {
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard
            if (rel.type === 'handoff') {
              /* eslint-disable @typescript-eslint/no-unnecessary-condition -- runtime guard */
              if (rel.role === 'parent') {
                handoffParentId = rel.threadID;
              } else if (rel.role === 'child') {
              /* eslint-enable @typescript-eslint/no-unnecessary-condition */
                handoffChildId = rel.threadID;
              }
            }
          }
          
          // Extract touched files from tool uses
          const touchedFiles = new Set<string>();
          for (const msg of messages) {
            if (msg.role === 'assistant' && Array.isArray(msg.content)) {
              for (const block of msg.content) {
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard
                if (typeof block === 'object' && block !== null && block.type === 'tool_use') {
                  const toolBlock = block as ToolUseContent;
                  if (toolBlock.input?.path) {
                    touchedFiles.add(toolBlock.input.path);
                  }
                }
              }
            }
          }
          return {
            id: file.replace('.json', ''),
            title,
            lastUpdated: formatRelativeTime(fileStat.mtime),
            lastUpdatedDate: fileStat.mtime.toISOString(),
            visibility: data.visibility || 'Private',
            messages: messages.length,
            model,
            contextPercent,
            maxContextTokens,
            cost: Math.round(cost * 100) / 100,
            workspace,
            workspacePath,
            repo,
            touchedFiles: [...touchedFiles],
            handoffParentId,
            handoffChildId,
          };
        } catch (e) {
          const error = e as Error;
          console.error(`[threads] Failed to parse ${file}:`, error.message);
          return null;
        }
      })
    );
    
    const validThreads = threads.filter((t): t is Thread => t !== null);
    
    const lastThread = validThreads[validThreads.length - 1];
    const nextCursor = lastThread && hasMore
      ? lastThread.id
      : null;
    
    return {
      threads: validThreads,
      nextCursor,
      hasMore,
    };
  } catch (e) {
    console.error('[threads] Error reading threads directory:', e);
    throw e;
  }
}

interface FileChangesData {
  edits: FileEdit[];
  created: boolean;
}

export async function getThreadChanges(threadId: string): Promise<FileChange[]> {
  const threadPath = join(THREADS_DIR, `${threadId}.json`);
  
  try {
    const content = await readFile(threadPath, 'utf-8');
    const data = JSON.parse(content) as ThreadFile;
    const messages = data.messages || [];
    
    const fileChanges = new Map<string, FileChangesData>();
    
    for (const msg of messages) {
      if (msg.role === 'assistant' && Array.isArray(msg.content)) {
        for (const block of msg.content) {
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard
          if (typeof block === 'object' && block !== null && block.type === 'tool_use') {
            const toolBlock = block as ToolUseContent;
            const { name, input } = toolBlock as { name?: string; input?: ToolUseContent['input'] };
            
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

interface SecretsFile {
  apiKey?: string;
  API_KEY?: string;
  amp_api_key?: string;
}

export async function deleteThread(threadId: string): Promise<DeleteResult> {
  const secretsPath = join(AMP_HOME, '.local', 'share', 'amp', 'secrets.json');
  
  try {
    const secretsContent = await readFile(secretsPath, 'utf-8');
    const secrets = JSON.parse(secretsContent) as SecretsFile;
    const apiKey = secrets.apiKey || secrets.API_KEY || secrets.amp_api_key;
    
    if (!apiKey) {
      throw new Error('No API key found');
    }
    
    // Try remote delete first (with timeout)
    const controller = new AbortController();
    const deleteTimeout = setTimeout(() => controller.abort(), 10000);
    let response: Response;
    try {
      response = await fetch(`https://ampcode.com/api/threads/${threadId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${apiKey}` },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(deleteTimeout);
    }
    
    if (!response.ok && response.status !== 404) {
      const text = await response.text();
      throw new Error(`Remote delete failed: ${text}`);
    }
    
    // Delete local file
    const threadPath = join(THREADS_DIR, `${threadId}.json`);
    await unlink(threadPath);
    
    // Cleanup all thread-related files and database records
    await cleanupThreadFiles(threadId);
    
    return { success: true };
  } catch (e) {
    const error = e as Error;
    // If remote fails, try local only
    try {
      const threadPath = join(THREADS_DIR, `${threadId}.json`);
      await unlink(threadPath);
      
      // Cleanup all thread-related files and database records
      await cleanupThreadFiles(threadId);
      
      return { success: true, localOnly: true };
    } catch {
      return { success: false, error: error.message };
    }
  }
}

interface CreateThreadResult {
  threadId: string;
  workspace: string | null;
}

export async function createThread(workspacePath: string | null = null): Promise<CreateThreadResult> {
  // Run amp threads new from the specified workspace directory
  const cwd = workspacePath || AMP_HOME;
  const stdout = await runAmp(['threads', 'new'], { cwd });
  const match = stdout.match(/T-[\w-]+/);
  if (!match) {
    throw new Error('Could not parse thread ID from output');
  }
  return { threadId: match[0], workspace: workspacePath };
}

export async function getKnownWorkspaces(): Promise<KnownWorkspace[]> {
  return getKnownWorkspacesImpl(getThreads);
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
