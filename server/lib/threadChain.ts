import type { Thread, ThreadChain, ChainThread, ThreadChainNode } from '../../shared/types.js';
import { runAmp, stripAnsi } from './utils.js';
import { getThreads } from './threadCrud.js';

function toChainThread(t: Thread, comment?: string): ChainThread {
  return {
    id: t.id,
    title: t.title,
    lastUpdated: t.lastUpdated,
    workspace: t.workspace,
    ...(comment != null ? { comment } : {}),
  };
}

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

  // Walk up to collect ancestors (linear path to root)
  const ancestors: ChainThread[] = [];
  const visited = new Set<string>([threadId]);
  let currentId = threadId;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard
  while (true) {
    const thread = threadMap.get(currentId);
    const parentId = thread?.handoffParentId;
    if (!parentId || visited.has(parentId)) break;
    const parentThread = threadMap.get(parentId);
    if (!parentThread) break;
    visited.add(parentId);
    ancestors.unshift(toChainThread(parentThread));
    currentId = parentId;
  }

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
  const flatDescendants: ChainThread[] = [];
  const directChildIds = parentToChildren.get(threadId) || [];
  for (const childId of directChildIds) {
    if (visited.has(childId)) continue;
    visited.add(childId);
    const node = buildDescendantNode(childId);
    if (node) descendantsTree.push(node);
  }

  // BFS flatten the tree for backward-compatible flat descendants list
  function flattenTree(nodes: ThreadChainNode[]): void {
    for (const node of nodes) {
      flatDescendants.push(node.thread);
      flattenTree(node.children);
    }
  }
  flattenTree(descendantsTree);

  const currentThread = threadMap.get(threadId);
  const current: ChainThread | null = currentThread ? toChainThread(currentThread) : null;

  return { ancestors, current, descendants: flatDescendants, descendantsTree };
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
  return { threadId: match[0] };
}
