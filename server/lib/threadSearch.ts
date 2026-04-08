import type { SearchResult, RelatedThread } from '../../shared/types.js';
import { listAllThreads } from './threadProvider.js';
import { runAmp } from './utils.js';

interface CliSearchResult {
  id: string;
  title: string;
  updatedAt: string;
}

export async function searchThreads(query: string): Promise<SearchResult[]> {
  try {
    const stdout = await runAmp(['threads', 'search', query, '--json', '--limit', '50']);
    const results = JSON.parse(stdout) as CliSearchResult[];

    return results.map((r) => ({
      threadId: r.id,
      title: r.title,
      lastUpdated: r.updatedAt,
      matches: [],
    }));
  } catch (e) {
    console.error('[threads] Search error:', e);
    throw e;
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
