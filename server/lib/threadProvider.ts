/**
 * Thread data provider — single abstraction for thread discovery and retrieval.
 *
 * Replaces direct filesystem access with a two-tier approach:
 *   1. listAllThreads()  — uses Amp's `listThreads` internal API for fast listing
 *   2. readThreadFile(id) — tries local file first, falls back to `amp threads export`
 */

import { readFile, access } from 'fs/promises';
import { join } from 'path';
import type { Thread, ThreadVisibility } from '../../shared/types.js';
import { THREADS_DIR, type ThreadFile } from './threadTypes.js';
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
  return summaries.map(toThread);
}

function toThread(s: AmpThreadSummary): Thread {
  const trees = s.env.initial.trees;
  const tree = trees[0];
  const repoUrl = tree?.repository?.url;

  // Extract handoff relationships
  let handoffParentId: string | null = null;
  const handoffChildIds: string[] = [];
  for (const rel of s.relationships) {
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
