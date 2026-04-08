/**
 * Thread data provider — single abstraction for thread discovery and retrieval.
 *
 * Replaces direct filesystem access with a two-tier approach:
 *   1. listAllThreads()  — uses Amp's `listThreads` internal API for fast listing
 *   2. readThreadFile(id) — tries local file first, falls back to `amp threads export`
 */

import { readFile, readdir, access } from 'fs/promises';
import { join } from 'path';
import type { Thread, ThreadVisibility } from '../../shared/types.js';
import {
  THREADS_DIR,
  isHandoffRelationship,
  isToolUseContent,
  type ThreadFile,
  type ThreadMessage,
} from './threadTypes.js';
import { listThreads, type AmpThreadSummary } from './amp-api.js';
import { formatRelativeTime, parseFileUri, runAmp } from './utils.js';

// ── Visibility normalization ────────────────────────────────────────────

const VISIBILITY_MAP: Record<string, ThreadVisibility> = {
  private: 'Private',
  public: 'Public',
  workspace: 'Workspace',
  unlisted: 'Unlisted',
  group: 'Group',
  thread_workspace_shared: 'Workspace',
};

function normalizeVisibility(raw: string | undefined | null): ThreadVisibility {
  if (!raw) return 'Private';
  // Already PascalCase (from local files)
  if (raw[0] === raw[0]?.toUpperCase() && VISIBILITY_MAP[raw.toLowerCase()]) {
    return raw as ThreadVisibility;
  }
  return VISIBILITY_MAP[raw.toLowerCase()] || 'Private';
}

// ── Repo URL parsing ────────────────────────────────────────────────────

function parseRepoFromUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  const match = url.match(/[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
  return match?.[1] ?? url;
}

// ── List all threads via API ────────────────────────────────────────────

export async function listAllThreads(): Promise<Thread[]> {
  const summaries = await listThreads(500);
  const threads = summaries.map(toThread);

  // The listThreads API doesn't return relationship data.
  // Scan local thread files to enrich handoff parent/child links.
  await enrichRelationships(threads);

  return threads;
}

/**
 * Scan local thread files for handoff relationships and merge them into
 * the thread list. Checks two sources:
 *   1. `relationships[]` array (older Amp format)
 *   2. `handoff` tool_use/tool_result blocks in messages (newer Amp format)
 */
async function enrichRelationships(threads: Thread[]): Promise<void> {
  const threadMap = new Map(threads.map((t) => [t.id, t]));

  let files: string[];
  try {
    files = await readdir(THREADS_DIR);
  } catch {
    return;
  }

  const jsonFiles = files.filter((f) => f.startsWith('T-') && f.endsWith('.json'));

  await Promise.all(
    jsonFiles.map(async (file) => {
      const threadId = file.replace('.json', '');
      const thread = threadMap.get(threadId);
      if (!thread) return;

      try {
        const content = await readFile(join(THREADS_DIR, file), 'utf-8');
        const data = JSON.parse(content) as ThreadFile;

        // Source 1: explicit relationships array (older format)
        for (const rel of data.relationships || []) {
          if (isHandoffRelationship(rel)) {
            if (rel.role === 'child') {
              thread.handoffParentId = rel.threadID;
            } else {
              thread.handoffChildIds = thread.handoffChildIds || [];
              thread.handoffChildIds.push(rel.threadID);
            }
          }
        }

        // Source 2: handoff tool blocks in messages (newer format)
        const childIds = extractHandoffChildIds(data.messages || [], threadId);
        if (childIds.length > 0) {
          thread.handoffChildIds = thread.handoffChildIds || [];
          thread.handoffChildIds.push(...childIds);
          // Set the reverse link: mark each child's parent
          for (const childId of childIds) {
            const child = threadMap.get(childId);
            if (child && !child.handoffParentId) {
              child.handoffParentId = threadId;
            }
          }
        }

        if (thread.handoffChildIds?.length) {
          thread.handoffChildIds = [...new Set(thread.handoffChildIds)];
        }
      } catch {
        // Skip unreadable files
      }
    }),
  );
}

const THREAD_ID_RE = /T-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;

/**
 * Extract child thread IDs from handoff tool_result blocks.
 * When a thread uses the `handoff` tool, the tool_result contains the new thread ID.
 */
function extractHandoffChildIds(messages: ThreadMessage[], selfId: string): string[] {
  const handoffToolUseIds = new Set<string>();
  const childIds: string[] = [];

  for (const msg of messages) {
    if (!Array.isArray(msg.content)) continue;

    for (const block of msg.content) {
      // Collect tool_use IDs for handoff tools
      if (isToolUseContent(block) && block.name === 'handoff') {
        const id = (block as unknown as Record<string, unknown>).id as string | undefined;
        if (id) handoffToolUseIds.add(id);
      }

      // Check tool_result blocks that reference a handoff tool_use
      const b = block as Record<string, unknown>;
      if (b.type === 'tool_result' && typeof b.toolUseID === 'string') {
        if (handoffToolUseIds.has(b.toolUseID)) {
          // Extract thread IDs from the result content
          const resultText =
            typeof b.content === 'string' ? b.content : JSON.stringify(b.content ?? b.run ?? '');
          const matches = resultText.match(THREAD_ID_RE) || [];
          for (const tid of matches) {
            if (tid !== selfId) childIds.push(tid);
          }
        }
      }
    }
  }

  return [...new Set(childIds)];
}

function toThread(s: AmpThreadSummary): Thread {
  const tree = s.env?.initial?.trees?.[0];
  const repoUrl = tree?.repository?.url;

  // Extract handoff relationships
  let handoffParentId: string | null = null;
  const handoffChildIds: string[] = [];
  for (const rel of s.relationships ?? []) {
    if (rel.type === 'handoff') {
      if (rel.role === 'child') {
        handoffParentId = rel.threadID;
      } else {
        handoffChildIds.push(rel.threadID);
      }
    }
  }

  const lastInteracted = new Date(s.userLastInteractedAt);

  return {
    id: s.id,
    title: s.title || s.id,
    lastUpdated: formatRelativeTime(lastInteracted),
    lastUpdatedDate: lastInteracted.toISOString(),
    visibility: normalizeVisibility(s.meta.visibility),
    messages: s.messageCount,
    workspace: tree?.displayName || null,
    workspacePath: parseFileUri(tree?.uri) || null,
    repo: parseRepoFromUrl(repoUrl),
    handoffParentId,
    handoffChildIds: [...new Set(handoffChildIds)],
    agentMode: s.agentMode,
    archived: s.archived,
    // Fields that require full message content — not available from listing
    model: undefined,
    cost: undefined,
    contextPercent: undefined,
    maxContextTokens: undefined,
    touchedFiles: undefined,
  };
}

// ── Read a single thread file ───────────────────────────────────────────

/**
 * Read a thread's full JSON data. Tries the local file first (fast, ~5ms),
 * then falls back to `amp threads export` via CLI (~3.5s) for server-only threads.
 */
export async function readThreadFile(threadId: string): Promise<ThreadFile> {
  const localPath = join(THREADS_DIR, `${threadId}.json`);

  // Fast path: local file exists
  try {
    const content = await readFile(localPath, 'utf-8');
    return JSON.parse(content) as ThreadFile;
  } catch {
    // File doesn't exist or is unreadable — fall through to CLI
  }

  // Slow path: fetch from server via CLI
  const stdout = await runAmp(['threads', 'export', threadId]);
  const data = JSON.parse(stdout) as ThreadFile;

  // Normalize: export puts visibility in meta.visibility (lowercase)
  if (!data.visibility && data.meta?.visibility) {
    data.visibility = normalizeVisibility(data.meta.visibility);
  }

  return data;
}

/**
 * Check whether a thread has a local file on disk.
 */
export async function hasLocalFile(threadId: string): Promise<boolean> {
  try {
    await access(join(THREADS_DIR, `${threadId}.json`));
    return true;
  } catch {
    return false;
  }
}
