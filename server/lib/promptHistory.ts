import { readFile, readdir, stat } from 'fs/promises';
import { join } from 'path';
import { THREADS_DIR, isTextContent, type ThreadFile } from './threadTypes.js';
import {
  recordPrompt,
  searchPromptHistory,
  getPromptHistoryCount,
  type PromptHistoryRow,
} from './database.js';

let backfillPromise: Promise<void> | null = null;

/**
 * Backfill prompt history from thread files.
 * Skips if the prompt_history table already has data (i.e., was previously backfilled).
 * Runs at most once per server lifetime.
 */
async function backfillPromptHistory(): Promise<void> {
  try {
    // Skip if already backfilled (data persists across restarts)
    if (getPromptHistoryCount() > 0) return;

    const files = await readdir(THREADS_DIR);
    const threadFiles = files.filter((f) => f.startsWith('T-') && f.endsWith('.json'));

    // Stat all files and sort oldest-first so duplicate prompts keep the most recent timestamp
    const fileStats = (
      await Promise.all(
        threadFiles.map(async (file) => {
          try {
            const fileStat = await stat(join(THREADS_DIR, file));
            return { file, mtimeMs: fileStat.mtimeMs };
          } catch {
            return null;
          }
        }),
      )
    )
      .filter((s): s is { file: string; mtimeMs: number } => s !== null)
      .sort((a, b) => a.mtimeMs - b.mtimeMs);

    // Process in parallel batches to avoid overwhelming the filesystem
    const BATCH_SIZE = 20;
    for (let i = 0; i < fileStats.length; i += BATCH_SIZE) {
      const batch = fileStats.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async ({ file, mtimeMs }) => {
          try {
            const filePath = join(THREADS_DIR, file);
            const fileMtime = Math.floor(mtimeMs / 1000);
            const content = await readFile(filePath, 'utf-8');
            const data = JSON.parse(content) as ThreadFile;
            const threadId = file.replace('.json', '');
            const messages = data.messages || [];

            for (const msg of messages) {
              if (msg.role !== 'user') continue;

              let text = '';
              if (typeof msg.content === 'string') {
                text = msg.content;
              } else if (Array.isArray(msg.content)) {
                const textBlock = msg.content.find(isTextContent);
                text = textBlock?.text || '';
              }

              if (text.trim()) {
                // Use message sentAt if available, otherwise fall back to file mtime
                const createdAt = msg.meta?.sentAt ? Math.floor(msg.meta.sentAt / 1000) : fileMtime;
                recordPrompt(text, threadId, createdAt);
              }
            }
          } catch (err) {
            console.warn(`[prompt-history] Failed to parse ${file}:`, err);
          }
        }),
      );
    }

    console.warn(`📋 Prompt history backfill complete (scanned ${threadFiles.length} threads)`);
  } catch (err) {
    console.error('[prompt-history] Backfill failed:', err);
  }
}

/**
 * Start backfill in the background on server startup.
 * Returns immediately; the backfill runs asynchronously.
 */
export function startPromptHistoryBackfill(): void {
  if (!backfillPromise) {
    backfillPromise = backfillPromptHistory();
  }
}

export interface PromptHistoryEntry {
  id: number;
  text: string;
  threadId: string;
  createdAt: number;
}

function toEntry(row: PromptHistoryRow): PromptHistoryEntry {
  return {
    id: row.id,
    text: row.text,
    threadId: row.thread_id,
    createdAt: row.created_at,
  };
}

/**
 * Search prompt history. Waits for any in-progress backfill to complete first.
 */
export async function getPromptHistory(query: string, limit = 50): Promise<PromptHistoryEntry[]> {
  if (backfillPromise) {
    await backfillPromise;
  }
  return searchPromptHistory(query, limit).map(toEntry);
}

/**
 * Record a new prompt into history (called when user sends a message).
 */
export function addPromptToHistory(text: string, threadId: string): void {
  recordPrompt(text, threadId);
}

/**
 * Get the most recent N thread files for backfill ordering.
 * Used internally; exported for testing.
 */
export async function getRecentThreadIds(limit = 100): Promise<string[]> {
  try {
    const files = await readdir(THREADS_DIR);
    const threadFiles = files.filter((f) => f.startsWith('T-') && f.endsWith('.json'));

    const stats = await Promise.all(
      threadFiles.map(async (file) => {
        try {
          const fileStat = await stat(join(THREADS_DIR, file));
          return { file, mtime: fileStat.mtime.getTime() };
        } catch {
          return null;
        }
      }),
    );

    return stats
      .filter((s): s is { file: string; mtime: number } => s !== null)
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, limit)
      .map((s) => s.file.replace('.json', ''));
  } catch {
    return [];
  }
}
