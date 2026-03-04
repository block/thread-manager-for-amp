import { readFile } from 'fs/promises';
import { join } from 'path';
import type { Thread, ThreadChain, ChainThread, ThreadChainNode } from '../../shared/types.js';
import { runAmp, stripAnsi } from './utils.js';
import { getThreads } from './threadCrud.js';
import { THREADS_DIR, isHandoffRelationship, type ThreadFile } from './threadTypes.js';
import { callAmpInternalAPI } from './amp-api.js';
import { getThreadMetadata, updateLinkedIssue } from './database.js';

export async function getThreadChain(threadId: string): Promise<ThreadChain> {
  const { threads } = await getThreads({ limit: 1000 });
  const threadMap = new Map(threads.map((t) => [t.id, t]));

  // Build parent-to-children index from all threads' handoffParentId
  const parentToChildren = new Map<string, string[]>();
  for (const t of threads) {
    if (t.handoffParentId && threadMap.has(t.handoffParentId)) {
      const existing = parentToChildren.get(t.handoffParentId);
      if (existing) {
        existing.push(t.id);
      } else {
        parentToChildren.set(t.handoffParentId, [t.id]);
      }
    }
  }

  // Walk up to collect ancestor IDs (linear path to root)
  const ancestorIds: string[] = [];
  const visited = new Set<string>([threadId]);
  let walkId = threadId;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard
  while (true) {
    const thread = threadMap.get(walkId);
    const parentId = thread?.handoffParentId;
    if (!parentId || visited.has(parentId)) break;
    if (!threadMap.has(parentId)) break;
    visited.add(parentId);
    ancestorIds.unshift(parentId);
    walkId = parentId;
  }
  const rootId = walkId;

  // Build descendants tree (recursive, supports forks)
  function buildDescendantNode(id: string): ThreadChainNode | null {
    const t = threadMap.get(id);
    if (!t) return null;
    const childIds = parentToChildren.get(id) || [];
    const children: ThreadChainNode[] = [];
    for (const childId of childIds) {
      if (visited.has(childId)) continue;
      visited.add(childId);
      const node = buildDescendantNode(childId);
      if (node) children.push(node);
    }
    return { thread: toChainThread(t), children };
  }

  const descendantsTree: ThreadChainNode[] = [];
  const directChildIds = parentToChildren.get(threadId) || [];
  for (const childId of directChildIds) {
    if (visited.has(childId)) continue;
    visited.add(childId);
    const node = buildDescendantNode(childId);
    if (node) descendantsTree.push(node);
  }

  // Read handoff comments from thread files for all chain members.
  // Each thread's `role: "parent"` relationship has the comment describing
  // what was handed off to the next thread in the chain.
  const commentMap = new Map<string, string>();

  await Promise.all(
    [...visited].map(async (id) => {
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

  // Apply comments to descendants tree
  function applyComments(node: ThreadChainNode): void {
    const comment = commentMap.get(node.thread.id);
    if (comment) node.thread.comment = comment;
    for (const child of node.children) applyComments(child);
  }
  for (const node of descendantsTree) applyComments(node);

  const ancestors = ancestorIds
    .map((id) => {
      const t = threadMap.get(id);
      return t ? toChainThread(t, commentMap.get(id)) : null;
    })
    .filter((t): t is ChainThread => t != null);

  const currentThread = threadMap.get(threadId);
  const current: ChainThread | null = currentThread
    ? toChainThread(currentThread, commentMap.get(threadId))
    : null;

  // Build full tree from root (fresh visited set to avoid pruning siblings)
  function buildFullTree(id: string, treeVisited: Set<string>): ThreadChainNode | null {
    const t = threadMap.get(id);
    if (!t || treeVisited.has(id)) return null;
    treeVisited.add(id);
    const childIds = parentToChildren.get(id) || [];
    const children: ThreadChainNode[] = [];
    for (const childId of childIds) {
      const node = buildFullTree(childId, treeVisited);
      if (node) children.push(node);
    }
    return { thread: toChainThread(t, commentMap.get(id)), children };
  }

  const root = buildFullTree(rootId, new Set<string>());

  return { ancestors, current, descendantsTree, root, currentId: threadId };
}

function toChainThread(t: Thread, comment?: string): ChainThread {
  return {
    id: t.id,
    title: t.title,
    lastUpdated: t.lastUpdated,
    workspace: t.workspace,
    ...(comment != null ? { comment } : {}),
  };
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
