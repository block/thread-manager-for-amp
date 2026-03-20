import { runAmp, stripAnsi } from './utils.js';
import { updateActualCost } from './database.js';

const fetchQueue: string[] = [];
let isFetching = false;

function parseCost(output: string): number | null {
  // Output format: "$15.10\nDetails: https://..."
  const match = output.match(/\$(\d+(?:\.\d+)?)/);
  const value = match?.[1];
  return value !== undefined ? parseFloat(value) : null;
}

async function fetchOne(threadId: string): Promise<void> {
  try {
    const stdout = await runAmp(['threads', 'usage', threadId]);
    const cleaned = stripAnsi(stdout);
    const cost = parseCost(cleaned);
    if (cost !== null) {
      updateActualCost(threadId, cost);
    }
  } catch {
    // Thread may not exist remotely, skip silently
  }
}

async function processQueue(): Promise<void> {
  if (isFetching) return;
  isFetching = true;
  try {
    while (fetchQueue.length > 0) {
      const threadId = fetchQueue.shift();
      if (!threadId) break;
      await fetchOne(threadId);
    }
  } finally {
    isFetching = false;
  }
}

/**
 * Enqueue thread IDs for background actual cost fetching.
 * Deduplicates and processes serially.
 */
export function enqueueCostFetch(threadIds: string[]): void {
  const existing = new Set(fetchQueue);
  for (const id of threadIds) {
    if (!existing.has(id)) {
      fetchQueue.push(id);
      existing.add(id);
    }
  }
  void processQueue();
}

/**
 * Returns true if background fetching is in progress.
 */
export function isCostFetchInProgress(): boolean {
  return isFetching;
}
