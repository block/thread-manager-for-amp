import type { Thread, ThreadStack, ThreadStackTopology } from '../types';

export interface ThreadListEntry {
  kind: 'thread' | 'stack';
  thread: Thread;
  stack?: ThreadStack;
}

export function buildThreadStacks(threads: Thread[]): ThreadListEntry[] {
  const threadMap = new Map<string, Thread>();
  for (const t of threads) {
    threadMap.set(t.id, t);
  }

  // Build bidirectional links (only for threads in our current list)
  // A parent can have multiple children (fan-out handoffs)
  const parentToChildren = new Map<string, string[]>();
  const childToParent = new Map<string, string>();

  for (const t of threads) {
    if (t.handoffParentId && threadMap.has(t.handoffParentId)) {
      childToParent.set(t.id, t.handoffParentId);
      const existing = parentToChildren.get(t.handoffParentId);
      if (existing) {
        existing.push(t.id);
      } else {
        parentToChildren.set(t.handoffParentId, [t.id]);
      }
    }
  }

  // Collect all members of each tree, picking the most recently updated as head
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

    // Pick the most recently updated thread as head
    chainMembers.sort((a, b) => {
      const dateA = new Date(a.lastUpdatedDate || 0).getTime();
      const dateB = new Date(b.lastUpdatedDate || 0).getTime();
      return dateB - dateA;
    });

    const head = chainMembers[0];
    if (!head) continue;
    const ancestors = chainMembers.slice(1);

    // Mark all as processed
    for (const member of chainMembers) {
      inStack.add(member.id);
    }

    if (ancestors.length > 0) {
      // Build topology restricted to this stack's members
      const childToParentLocal: Record<string, string> = {};
      const parentToChildrenLocal: Record<string, string[]> = {};
      let rootId = head.id;

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

      // Find root: the member with no parent in this stack
      for (const member of chainMembers) {
        if (!childToParentLocal[member.id]) {
          rootId = member.id;
          break;
        }
      }

      const topology: ThreadStackTopology = {
        rootId,
        childToParent: childToParentLocal,
        parentToChildren: parentToChildrenLocal,
      };

      entries.push({
        kind: 'stack',
        thread: head,
        stack: { head, ancestors, topology },
      });
    } else {
      entries.push({
        kind: 'thread',
        thread: head,
      });
    }
  }

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
      result.push(...entry.stack.ancestors);
    }
  }
  return result;
}

export function getStackSize(entry: ThreadListEntry): number {
  if (entry.kind === 'stack' && entry.stack) {
    return 1 + entry.stack.ancestors.length;
  }
  return 1;
}
