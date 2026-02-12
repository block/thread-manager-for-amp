import type { Thread, ThreadStack } from '../types';

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
  const parentToChild = new Map<string, string>();
  const childToParent = new Map<string, string>();
  
  for (const t of threads) {
    if (t.handoffParentId && threadMap.has(t.handoffParentId)) {
      childToParent.set(t.id, t.handoffParentId);
      if (!parentToChild.has(t.handoffParentId)) {
        parentToChild.set(t.handoffParentId, t.id);
      }
    }
  }

  // Collect all members of each chain, picking the most recently updated as head
  const inStack = new Set<string>();
  const entries: ThreadListEntry[] = [];

  for (const t of threads) {
    if (inStack.has(t.id)) continue;

    // Gather all threads in this chain (walk both directions)
    const chainMembers: Thread[] = [t];
    const visited = new Set<string>([t.id]);

    // Walk up to parents
    let currentId = t.id;
    while (true) {
      const parentId = childToParent.get(currentId);
      if (!parentId || visited.has(parentId)) break;
      const parent = threadMap.get(parentId);
      if (!parent) break;
      visited.add(parentId);
      chainMembers.push(parent);
      currentId = parentId;
    }

    // Walk down to children
    currentId = t.id;
    while (true) {
      const childId = parentToChild.get(currentId);
      if (!childId || visited.has(childId)) break;
      const child = threadMap.get(childId);
      if (!child) break;
      visited.add(childId);
      chainMembers.push(child);
      currentId = childId;
    }

    // Pick the most recently updated thread as head
    chainMembers.sort((a, b) => {
      const dateA = new Date(a.lastUpdatedDate || 0).getTime();
      const dateB = new Date(b.lastUpdatedDate || 0).getTime();
      return dateB - dateA;
    });

    const head = chainMembers[0];
    const ancestors = chainMembers.slice(1);

    // Mark all as processed
    for (const member of chainMembers) {
      inStack.add(member.id);
    }

    if (ancestors.length > 0) {
      entries.push({
        kind: 'stack',
        thread: head,
        stack: { head, ancestors },
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

export function flattenEntries(entries: ThreadListEntry[], expandedStackIds: Set<string>): Thread[] {
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
