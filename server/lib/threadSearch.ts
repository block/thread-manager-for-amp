import { readFile, readdir, stat } from 'fs/promises';
import { join } from 'path';
import type { SearchResult, SearchMatch, RelatedThread } from '../../shared/types.js';
import type { Thread } from '../../shared/types.js';
import {
  THREADS_DIR,
  isTextContent,
  type ThreadFile,
  type MessageContentBlock,
} from './threadTypes.js';
import { listAllThreads, readThreadFile } from './threadProvider.js';

/** Max server-only threads to export and search for content matches. */
const MAX_EXPORT_THREADS = 50;

/** Timeout for a single thread export (ms). */
const EXPORT_TIMEOUT_MS = 8000;

export async function searchThreads(query: string): Promise<SearchResult[]> {
  const searchLower = query.toLowerCase();

  const [fileResults, apiResults] = await Promise.all([
    searchLocalFiles(searchLower),
    searchApiListing(searchLower),
  ]);

  const seen = new Set<string>();
  const merged: SearchResult[] = [];

  for (const r of [...fileResults, ...apiResults]) {
    if (!seen.has(r.threadId)) {
      seen.add(r.threadId);
      merged.push(r);
    }
  }

  return merged;
}

/**
 * Stream search results as SSE events. Each search strategy fires its results
 * as soon as it completes, so fast sources (local files) appear immediately.
 *
 * Strategies (in order of speed):
 *   1. Local files — full message content search with snippets (~50ms)
 *   2. API listing — title/ID match across all threads (~500ms)
 *   3. Thread export — export server-only threads and search content (streamed per-thread)
 */
export function streamSearchResults(
  query: string,
  onResults: (results: SearchResult[]) => void,
  onDone: () => void,
): void {
  const searchLower = query.toLowerCase();
  const seen = new Set<string>();

  const emit = (results: SearchResult[]) => {
    const fresh = results.filter((r) => {
      if (seen.has(r.threadId)) return false;
      seen.add(r.threadId);
      return true;
    });
    if (fresh.length > 0) {
      onResults(fresh);
    }
  };

  // Track completion of all strategies
  let pending = 2; // local files + API listing (export is handled separately)
  let apiThreads: Thread[] = [];

  const checkDone = () => {
    pending--;
    if (pending === 0) onDone();
  };

  // 1. Local file search (fastest)
  searchLocalFiles(searchLower)
    .then((results) => {
      emit(results);
      checkDone();
    })
    .catch(() => checkDone());

  // 2. API listing (title/ID match) — also triggers export search for server-only threads
  listAllThreads()
    .then(async (threads) => {
      apiThreads = threads;

      // Emit title/ID matches immediately
      const titleMatches = threads
        .filter(
          (t) =>
            t.id.toLowerCase().includes(searchLower) || t.title.toLowerCase().includes(searchLower),
        )
        .slice(0, 50)
        .map((t) => ({
          threadId: t.id,
          title: t.title,
          lastUpdated: t.lastUpdatedDate || t.lastUpdated,
          matches: [] as SearchMatch[],
        }));
      emit(titleMatches);

      // 3. Export and search server-only threads for content matches
      const threadIds = new Set(apiThreads.map((t) => t.id));
      const localIds = await getLocalThreadIds();
      const serverOnlyThreads = apiThreads
        .filter((t) => !localIds.has(t.id))
        .slice(0, MAX_EXPORT_THREADS);

      if (serverOnlyThreads.length > 0) {
        // Search exports in parallel batches of 5
        const batchSize = 5;
        for (let i = 0; i < serverOnlyThreads.length; i += batchSize) {
          const batch = serverOnlyThreads.slice(i, i + batchSize);
          const batchResults = await Promise.all(
            batch.map((t) => searchExportedThread(t.id, t.title, searchLower)),
          );
          const flat = batchResults.flat();
          // Only emit results that are in the user's thread list
          const filtered = flat.filter((r) => threadIds.has(r.threadId));
          emit(filtered);
        }
      }

      checkDone();
    })
    .catch(() => checkDone());
}

/**
 * Get the set of thread IDs that have local JSON files on disk.
 */
async function getLocalThreadIds(): Promise<Set<string>> {
  try {
    const files = await readdir(THREADS_DIR);
    return new Set(
      files
        .filter((f) => f.startsWith('T-') && f.endsWith('.json'))
        .map((f) => f.replace('.json', '')),
    );
  } catch {
    return new Set();
  }
}

/**
 * Export a single thread and search its message content.
 * Returns results if the query matches, empty array otherwise.
 */
async function searchExportedThread(
  threadId: string,
  title: string,
  searchLower: string,
): Promise<SearchResult[]> {
  try {
    const data = await Promise.race([
      readThreadFile(threadId),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('export timeout')), EXPORT_TIMEOUT_MS),
      ),
    ]);

    const result = searchThreadData(threadId, title, data, searchLower);
    return result ? [result] : [];
  } catch {
    return [];
  }
}

/**
 * Search a thread's message data for content matches.
 */
function searchThreadData(
  threadId: string,
  title: string,
  data: ThreadFile,
  searchLower: string,
): SearchResult | null {
  const messages = data.messages || [];
  const matches: SearchMatch[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (!msg) continue;
    let textContent = '';

    if (typeof msg.content === 'string') {
      textContent = msg.content;
    } else if (Array.isArray(msg.content)) {
      textContent = msg.content.map((c) => extractBlockText(c)).join('\n');
    }

    if (textContent.toLowerCase().includes(searchLower)) {
      const lines = textContent.split('\n');
      for (const line of lines) {
        if (line.toLowerCase().includes(searchLower)) {
          matches.push({
            messageIndex: i,
            role: msg.role,
            snippet: line.slice(0, 200),
          });
          if (matches.length >= 3) break;
        }
      }
    }
    if (matches.length >= 3) break;
  }

  if (matches.length === 0) return null;

  return {
    threadId,
    title: title || threadId,
    lastUpdated: data.created ? new Date(data.created).toISOString() : new Date().toISOString(),
    matches,
  };
}

/**
 * Extract searchable text from any content block type — text, tool_use, tool_result, etc.
 */
function extractBlockText(block: MessageContentBlock): string {
  if (typeof block === 'string') return block;
  if (isTextContent(block)) return block.text || '';

  const b = block as Record<string, unknown>;

  // tool_use: search the tool name and serialized input (contains commands, URLs, etc.)
  if (b.type === 'tool_use') {
    const parts = [b.name as string];
    if (b.input) parts.push(JSON.stringify(b.input));
    return parts.join(' ');
  }

  // tool_result: search the result content
  if (b.type === 'tool_result') {
    if (typeof b.content === 'string') return b.content;
    if (Array.isArray(b.content)) {
      return (b.content as MessageContentBlock[]).map((c) => extractBlockText(c)).join('\n');
    }
    if (b.output && typeof b.output === 'string') return b.output;
  }

  return '';
}

/**
 * Search local thread JSON files — scans message content, titles, and IDs.
 */
async function searchLocalFiles(searchLower: string): Promise<SearchResult[]> {
  const results: (SearchResult & { mtime: number })[] = [];

  try {
    const files = await readdir(THREADS_DIR);
    const threadFiles = files.filter((f: string) => f.startsWith('T-') && f.endsWith('.json'));

    for (const file of threadFiles) {
      const filePath = join(THREADS_DIR, file);
      try {
        const fileStat = await stat(filePath);
        const content = await readFile(filePath, 'utf-8');
        const data = JSON.parse(content) as ThreadFile;
        const threadId = file.replace('.json', '');

        let title = data.title || '';
        if (!title && (data.messages || []).length > 0) {
          const firstUser = (data.messages || []).find((m) => m.role === 'user');
          if (firstUser?.content) {
            let tc = '';
            if (typeof firstUser.content === 'string') {
              tc = firstUser.content;
            } else if (Array.isArray(firstUser.content)) {
              const textBlock = firstUser.content.find(isTextContent);
              tc = textBlock?.text || '';
            }
            title = tc.slice(0, 60).replace(/\n/g, ' ').trim();
          }
        }
        if (!title) title = threadId;

        const result = searchThreadData(threadId, title, data, searchLower);
        const titleMatches = title.toLowerCase().includes(searchLower);
        const idMatches = threadId.toLowerCase().includes(searchLower);

        if (result) {
          results.push({ ...result, mtime: fileStat.mtimeMs });
        } else if (titleMatches || idMatches) {
          results.push({
            threadId,
            title,
            lastUpdated: new Date(fileStat.mtimeMs).toISOString(),
            matches: [],
            mtime: fileStat.mtimeMs,
          });
        }
      } catch {
        // Skip threads that fail to parse
      }
    }

    results.sort((a, b) => b.mtime - a.mtime);
    return results.map((r) => ({
      threadId: r.threadId,
      title: r.title,
      lastUpdated: r.lastUpdated,
      matches: r.matches,
    }));
  } catch {
    return [];
  }
}

/**
 * Search the API thread listing by title and ID.
 * Catches server-only threads that have no local JSON file.
 */
async function searchApiListing(searchLower: string): Promise<SearchResult[]> {
  try {
    const threads = await listAllThreads();

    return threads
      .filter(
        (t) =>
          t.id.toLowerCase().includes(searchLower) || t.title.toLowerCase().includes(searchLower),
      )
      .slice(0, 50)
      .map((t) => ({
        threadId: t.id,
        title: t.title,
        lastUpdated: t.lastUpdatedDate || t.lastUpdated,
        matches: [],
      }));
  } catch {
    return [];
  }
}

export async function getRelatedThreads(threadId: string): Promise<RelatedThread[]> {
  const threads = await listAllThreads();
  const targetThread = threads.find((t) => t.id === threadId);

  if (!targetThread?.touchedFiles?.length) {
    return [];
  }

  const targetFiles = new Set(targetThread.touchedFiles);
  const related: RelatedThread[] = [];

  for (const thread of threads) {
    if (thread.id === threadId) continue;
    if (!thread.touchedFiles?.length) continue;

    const commonFiles = thread.touchedFiles.filter((f) => targetFiles.has(f));
    if (commonFiles.length > 0) {
      related.push({
        id: thread.id,
        title: thread.title,
        lastUpdated: thread.lastUpdated,
        workspace: thread.workspace,
        repo: thread.repo,
        commonFiles: commonFiles.slice(0, 5),
        commonFileCount: commonFiles.length,
      });
    }
  }

  related.sort((a, b) => b.commonFileCount - a.commonFileCount);
  return related.slice(0, 10);
}
