import { readFile } from 'fs/promises';
import { join } from 'path';
import type { Thread, ThreadChain, ChainThread } from '../../shared/types.js';
import { runAmp, stripAnsi } from './utils.js';
import { getThreads } from './threadCrud.js';
import { THREADS_DIR, isHandoffRelationship, type ThreadFile } from './threadTypes.js';
import { callAmpInternalAPI } from './amp-api.js';
import { getThreadMetadata, updateLinkedIssue } from './database.js';

export async function getThreadChain(threadId: string): Promise<ThreadChain> {
  const { threads } = await getThreads({ limit: 1000 });
  const threadMap = new Map(threads.map((t) => [t.id, t]));

  // Build parent → children map using handoffParentId on each thread.
  const childrenMap = new Map<string, Thread[]>();
  for (const thread of threads) {
    if (thread.handoffParentId) {
      let children = childrenMap.get(thread.handoffParentId);
      if (!children) {
        children = [];
        childrenMap.set(thread.handoffParentId, children);
      }
      children.push(thread);
    }
  }

  // 1. Identify chain members by traversal
  const ancestorIds: string[] = [];
  const visited = new Set<string>([threadId]);

  let currentId: string | null | undefined = threadMap.get(threadId)?.handoffParentId;
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    if (!threadMap.has(currentId)) break;
    ancestorIds.unshift(currentId);
    currentId = threadMap.get(currentId)?.handoffParentId;
  }

  const descendantIds: string[] = [];
  function collectDescendants(id: string): void {
    const children = childrenMap.get(id) || [];
    for (const child of children) {
      if (visited.has(child.id)) continue;
      visited.add(child.id);
      descendantIds.push(child.id);
      collectDescendants(child.id);
    }
  }
  collectDescendants(threadId);

  // 2. Read handoff comments from thread files for all chain members.
  // Each thread's `role: "parent"` relationship has the comment describing
  // what was handed off to the next thread in the chain.
  const allChainIds = [...ancestorIds, threadId, ...descendantIds];
  const commentMap = new Map<string, string>();

  await Promise.all(
    allChainIds.map(async (id) => {
      try {
        const content = await readFile(join(THREADS_DIR, `${id}.json`), 'utf-8');
        const data = JSON.parse(content) as ThreadFile;
        for (const rel of data.relationships || []) {
          if (isHandoffRelationship(rel) && rel.role === 'parent' && rel.comment) {
            if (visited.has(rel.threadID)) {
              commentMap.set(id, rel.comment);
              break;
            }
          }
        }
      } catch {
        // Thread file may not exist or be unreadable
      }
    }),
  );

  // 3. Build ChainThread objects with comments
  function toChainThread(id: string): ChainThread {
    const thread = threadMap.get(id);
    if (!thread) throw new Error(`Thread ${id} not found in map`);

    return {
      id: thread.id,
      title: thread.title,
      lastUpdated: thread.lastUpdatedDate || thread.lastUpdated,
      workspace: thread.workspace,
      comment: commentMap.get(id),
    };
  }

  const ancestors = ancestorIds.map(toChainThread);
  const descendants = descendantIds.map(toChainThread);

  const currentThread = threadMap.get(threadId);
  const current: ChainThread | null = currentThread ? toChainThread(threadId) : null;

  return { ancestors, current, descendants };
}

interface HandoffResult {
  threadId: string;
}

export async function handoffThread(
  threadId: string,
  goal: string = 'Continue the previous work',
): Promise<HandoffResult> {
  const stdout = await runAmp(['threads', 'handoff', threadId, '--goal', goal, '--print']);
  const stripped = stripAnsi(stdout);
  const match = stripped.match(/T-[\w-]+/);
  if (!match) {
    throw new Error('Could not parse new thread ID');
  }

  const newThreadId = match[0];

  // Propagate metadata from source thread to new thread (best-effort)
  await propagateMetadata(threadId, newThreadId);

  return { threadId: newThreadId };
}

async function propagateMetadata(sourceId: string, targetId: string): Promise<void> {
  const results = await Promise.allSettled([
    // Copy labels
    (async () => {
      const labels = await callAmpInternalAPI<{ name: string }[]>('getThreadLabels', {
        thread: sourceId,
      });
      if (labels.length > 0) {
        await callAmpInternalAPI('setThreadLabels', {
          thread: targetId,
          labels: labels.map((l) => l.name),
        });
      }
    })(),

    // Copy linked issue URL
    Promise.resolve().then(() => {
      const metadata = getThreadMetadata(sourceId);
      if (metadata.linked_issue_url) {
        updateLinkedIssue(targetId, metadata.linked_issue_url);
      }
    }),
  ]);

  for (const result of results) {
    if (result.status === 'rejected') {
      console.warn('[handoff] Failed to propagate metadata:', result.reason);
    }
  }
}
