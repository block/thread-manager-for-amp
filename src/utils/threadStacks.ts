import type { Thread, ThreadStack, ThreadStackTopology } from '../types';
import { buildHandoffGraph } from '../../shared/utils';

export interface ThreadListEntry {
  kind: 'thread' | 'stack';
  thread: Thread;
  stack?: ThreadStack;
}

function parseDate(dateStr: string | undefined): number {
  if (!dateStr) return 0;
  const t = Date.parse(dateStr);
  return Number.isFinite(t) ? t : 0;
}

/** DFS walk from a node's children, producing tree-ordered Thread[] (excludes the node itself). */
function dfsDescendants(
  nodeId: string,
  parentToChildrenMap: Record<string, string[]>,
  threadMap: Map<string, Thread>,
  visited: Set<string>,
): Thread[] {
  const result: Thread[] = [];
  const childIds = parentToChildrenMap[nodeId];
  if (!childIds) return result;

  // Sort children by lastUpdatedDate desc for deterministic ordering
  const sorted = [...childIds].sort((a, b) => {
    const ta = threadMap.get(a);
    const tb = threadMap.get(b);
    return parseDate(tb?.lastUpdatedDate) - parseDate(ta?.lastUpdatedDate);
  });

  for (const childId of sorted) {
    if (visited.has(childId)) continue;
    const child = threadMap.get(childId);
    if (!child) continue;
    visited.add(childId);
    result.push(child);
    result.push(...dfsDescendants(childId, parentToChildrenMap, threadMap, visited));
  }
  return result;
}

export function buildThreadStacks(threads: Thread[]): ThreadListEntry[] {
  const { threadMap, childToParent, parentToChildren } = buildHandoffGraph(threads);

  // Collect all members of each tree, using the root as head
  const inStack = new Set<string>();
  const entries: ThreadListEntry[] = [];

  for (const t of threads) {
    if (inStack.has(t.id)) continue;

    // Gather all threads in this tree (walk up to root, then BFS down all children)
    const chainMembers: Thread[] = [t];
    const visited = new Set<string>([t.id]);

    // Walk up to the root ancestor
    let currentId = t.id;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard
    while (true) {
      const parentId = childToParent.get(currentId);
      if (!parentId || visited.has(parentId)) break;
      const parent = threadMap.get(parentId);
      if (!parent) break;
      visited.add(parentId);
      chainMembers.push(parent);
      currentId = parentId;
    }

    // BFS down from all visited nodes to collect all children
    const queue = [...visited];
    for (const nodeId of queue) {
      const childIds = parentToChildren.get(nodeId);
      if (!childIds) continue;
      for (const childId of childIds) {
        if (visited.has(childId)) continue;
        const child = threadMap.get(childId);
        if (!child) continue;
        visited.add(childId);
        chainMembers.push(child);
        queue.push(childId);
      }
    }

    // Mark all as processed
    for (const member of chainMembers) {
      inStack.add(member.id);
    }

    // Find root: the member with no parent in this stack
    let root: Thread | undefined;
    for (const member of chainMembers) {
      if (!childToParent.has(member.id)) {
        root = member;
        break;
      }
    }
    if (!root) {
      root = chainMembers[0];
    }
    if (!root) continue;

    if (chainMembers.length > 1) {
      // Build topology restricted to this stack's members
      const childToParentLocal: Record<string, string> = {};
      const parentToChildrenLocal: Record<string, string[]> = {};

      for (const member of chainMembers) {
        const pid = childToParent.get(member.id);
        if (pid && visited.has(pid)) {
          childToParentLocal[member.id] = pid;
          if (!parentToChildrenLocal[pid]) {
            parentToChildrenLocal[pid] = [];
          }
          parentToChildrenLocal[pid].push(member.id);
        }
      }

      const topology: ThreadStackTopology = {
        rootId: root.id,
        childToParent: childToParentLocal,
        parentToChildren: parentToChildrenLocal,
      };

      // Compute lastActiveDate (max lastUpdatedDate across all members)
      let maxDate = 0;
      let lastActiveDateStr: string | undefined;
      for (const member of chainMembers) {
        const d = parseDate(member.lastUpdatedDate);
        if (d > maxDate) {
          maxDate = d;
          lastActiveDateStr = member.lastUpdatedDate;
        }
      }

      // Build tree-ordered descendants via DFS from root (excludes root)
      const dfsVisited = new Set<string>([root.id]);
      const descendants = dfsDescendants(root.id, parentToChildrenLocal, threadMap, dfsVisited);

      entries.push({
        kind: 'stack',
        thread: root,
        stack: {
          head: root,
          descendants,
          lastActiveDate: lastActiveDateStr,
          topology,
        },
      });
    } else {
      entries.push({
        kind: 'thread',
        thread: root,
      });
    }
  }

  // Re-sort entries by lastActiveDate desc so active stacks float to top
  entries.sort((a, b) => {
    const dateA = a.stack?.lastActiveDate ?? a.thread.lastUpdatedDate;
    const dateB = b.stack?.lastActiveDate ?? b.thread.lastUpdatedDate;
    return parseDate(dateB) - parseDate(dateA);
  });

  return entries;
}

export function flattenEntries(
  entries: ThreadListEntry[],
  expandedStackIds: Set<string>,
): Thread[] {
  const result: Thread[] = [];
  for (const entry of entries) {
    result.push(entry.thread);
    if (entry.kind === 'stack' && entry.stack && expandedStackIds.has(entry.thread.id)) {
      result.push(...entry.stack.descendants);
    }
  }
  return result;
}

export function getStackSize(entry: ThreadListEntry): number {
  if (entry.kind === 'stack' && entry.stack) {
    return 1 + entry.stack.descendants.length;
  }
  return 1;
}

/** Get the most recently updated thread in a stack (for kanban column placement, status display). */
export function getLastActiveThread(entry: ThreadListEntry): Thread {
  if (entry.kind !== 'stack' || !entry.stack) return entry.thread;
  let best = entry.thread;
  let bestDate = parseDate(best.lastUpdatedDate);
  for (const d of entry.stack.descendants) {
    const date = parseDate(d.lastUpdatedDate);
    if (date > bestDate) {
      best = d;
      bestDate = date;
    }
  }
  return best;
}
