import { readFile, readdir, stat } from 'fs/promises';
import { join } from 'path';
import { THREADS_DIR, isTextContent, type ThreadFile } from './threadTypes.js';
import { recordPrompt, searchPromptHistory, type PromptHistoryRow } from './database.js';

let backfillDone = false;

/**
 * Backfill prompt history from thread files on first query.
 * Scans all thread JSON files and records user messages into the SQLite cache.
 * Runs at most once per server lifetime.
 */
async function backfillPromptHistory(): Promise<void> {
  if (backfillDone) return;
  backfillDone = true;

  try {
    const files = await readdir(THREADS_DIR);
    const threadFiles = files.filter((f) => f.startsWith('T-') && f.endsWith('.json'));

    // Process in parallel batches to avoid overwhelming the filesystem
    const BATCH_SIZE = 20;
    for (let i = 0; i < threadFiles.length; i += BATCH_SIZE) {
      const batch = threadFiles.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (file) => {
          try {
            const filePath = join(THREADS_DIR, file);
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
                recordPrompt(text, threadId);
              }
            }
          } catch {
            // Skip files that fail to parse
          }
        }),
      );
    }

    console.warn(`📋 Prompt history backfill complete (scanned ${threadFiles.length} threads)`);
  } catch (err) {
    console.error('[prompt-history] Backfill failed:', err);
    // Allow retry on next query
    backfillDone = false;
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
 * Search prompt history. On first call, backfills from thread files.
 */
export async function getPromptHistory(query: string, limit = 50): Promise<PromptHistoryEntry[]> {
  await backfillPromptHistory();
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
