import { isTextContent } from './threadTypes.js';
import {
  recordPrompt,
  searchPromptHistory,
  getPromptHistoryCount,
  type PromptHistoryRow,
} from './database.js';
import { listAllThreads, readThreadFile } from './threadProvider.js';

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

    const threads = await listAllThreads();

    // Sort oldest-first so duplicate prompts keep the most recent timestamp
    const sorted = [...threads].sort((a, b) => {
      const aDate = a.lastUpdatedDate ? new Date(a.lastUpdatedDate).getTime() : 0;
      const bDate = b.lastUpdatedDate ? new Date(b.lastUpdatedDate).getTime() : 0;
      return aDate - bDate;
    });

    // Process in parallel batches to avoid overwhelming the filesystem
    const BATCH_SIZE = 20;
    for (let i = 0; i < sorted.length; i += BATCH_SIZE) {
      const batch = sorted.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (thread) => {
          try {
            const data = await readThreadFile(thread.id);
            const messages = data.messages || [];
            const fileMtime = thread.lastUpdatedDate
              ? Math.floor(new Date(thread.lastUpdatedDate).getTime() / 1000)
              : Math.floor(Date.now() / 1000);

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
                // Use message sentAt if available, otherwise fall back to thread lastUpdated
                const createdAt = msg.meta?.sentAt ? Math.floor(msg.meta.sentAt / 1000) : fileMtime;
                recordPrompt(text, thread.id, createdAt);
              }
            }
          } catch (err) {
            console.warn(`[prompt-history] Failed to parse ${thread.id}:`, err);
          }
        }),
      );
    }

    console.warn(`📋 Prompt history backfill complete (scanned ${sorted.length} threads)`);
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
    const threads = await listAllThreads();
    return threads
      .sort((a, b) => {
        const aDate = a.lastUpdatedDate ? new Date(a.lastUpdatedDate).getTime() : 0;
        const bDate = b.lastUpdatedDate ? new Date(b.lastUpdatedDate).getTime() : 0;
        return bDate - aDate;
      })
      .slice(0, limit)
      .map((t) => t.id);
  } catch {
    return [];
  }
}
