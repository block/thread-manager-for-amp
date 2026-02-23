import { describe, it, expect } from 'vitest';
import type { Thread } from '../types';
import {
  buildThreadStacks,
  flattenEntries,
  getStackSize,
  getLastActiveThread,
} from './threadStacks';

function at<T>(arr: T[], index: number): T {
  const item = arr[index];
  if (item === undefined) throw new Error(`Expected item at index ${index}`);
  return item;
}

function makeThread(overrides: Partial<Thread> & { id: string }): Thread {
  return {
    title: `Thread ${overrides.id}`,
    lastUpdated: '2 hours ago',
    visibility: 'Private' as const,
    messages: 5,
    ...overrides,
  };
}

describe('buildThreadStacks', () => {
  it('returns empty array for empty input', () => {
    expect(buildThreadStacks([])).toEqual([]);
  });

  it('returns single thread as kind=thread (no stack)', () => {
    const threads = [makeThread({ id: 'a' })];
    const entries = buildThreadStacks(threads);
    expect(entries).toHaveLength(1);
    expect(at(entries, 0).kind).toBe('thread');
    expect(at(entries, 0).thread.id).toBe('a');
    expect(at(entries, 0).stack).toBeUndefined();
  });

  it('groups parent-child into a stack with root as head', () => {
    const threads = [
      makeThread({ id: 'parent', lastUpdatedDate: '2025-01-01T00:00:00Z' }),
      makeThread({
        id: 'child',
        handoffParentId: 'parent',
        lastUpdatedDate: '2025-01-02T00:00:00Z',
      }),
    ];
    const entries = buildThreadStacks(threads);
    expect(entries).toHaveLength(1);
    expect(at(entries, 0).kind).toBe('stack');
    // Root (parent) is head
    expect(at(entries, 0).thread.id).toBe('parent');
    expect(at(entries, 0).stack?.descendants).toHaveLength(1);
    expect(at(entries, 0).stack?.descendants[0]?.id).toBe('child');
    // lastActiveDate is the child's date (most recent)
    expect(at(entries, 0).stack?.lastActiveDate).toBe('2025-01-02T00:00:00Z');
  });

  it('picks root (no parent) as head, not most recent', () => {
    const threads = [
      makeThread({ id: 'old', lastUpdatedDate: '2025-01-01T00:00:00Z' }),
      makeThread({ id: 'new', handoffParentId: 'old', lastUpdatedDate: '2025-01-10T00:00:00Z' }),
    ];
    const entries = buildThreadStacks(threads);
    expect(at(entries, 0).thread.id).toBe('old');
    expect(at(entries, 0).stack?.lastActiveDate).toBe('2025-01-10T00:00:00Z');
  });

  it('builds a 3-thread chain with root as head', () => {
    const threads = [
      makeThread({ id: 'a', lastUpdatedDate: '2025-01-01T00:00:00Z' }),
      makeThread({ id: 'b', handoffParentId: 'a', lastUpdatedDate: '2025-01-02T00:00:00Z' }),
      makeThread({ id: 'c', handoffParentId: 'b', lastUpdatedDate: '2025-01-03T00:00:00Z' }),
    ];
    const entries = buildThreadStacks(threads);
    expect(entries).toHaveLength(1);
    expect(at(entries, 0).kind).toBe('stack');
    expect(at(entries, 0).thread.id).toBe('a');
    expect(at(entries, 0).stack?.descendants).toHaveLength(2);
    // DFS order from root: b then c
    expect(at(entries, 0).stack?.descendants.map((d) => d.id)).toEqual(['b', 'c']);
  });

  it('handles unrelated threads as separate entries', () => {
    const threads = [
      makeThread({ id: 'a', lastUpdatedDate: '2025-01-01T00:00:00Z' }),
      makeThread({ id: 'b', lastUpdatedDate: '2025-01-02T00:00:00Z' }),
    ];
    const entries = buildThreadStacks(threads);
    expect(entries).toHaveLength(2);
    expect(at(entries, 0).kind).toBe('thread');
    expect(at(entries, 1).kind).toBe('thread');
  });

  it('ignores handoffParentId referencing thread not in list', () => {
    const threads = [
      makeThread({
        id: 'child',
        handoffParentId: 'missing-parent',
        lastUpdatedDate: '2025-01-01T00:00:00Z',
      }),
    ];
    const entries = buildThreadStacks(threads);
    expect(entries).toHaveLength(1);
    expect(at(entries, 0).kind).toBe('thread');
  });

  it('handles thread with null handoffParentId', () => {
    const threads = [makeThread({ id: 'a', handoffParentId: null })];
    const entries = buildThreadStacks(threads);
    expect(entries).toHaveLength(1);
    expect(at(entries, 0).kind).toBe('thread');
  });

  it('groups multiple children of the same parent into one stack', () => {
    const threads = [
      makeThread({ id: 'parent', lastUpdatedDate: '2025-01-01T00:00:00Z' }),
      makeThread({
        id: 'child1',
        handoffParentId: 'parent',
        lastUpdatedDate: '2025-01-02T00:00:00Z',
      }),
      makeThread({
        id: 'child2',
        handoffParentId: 'parent',
        lastUpdatedDate: '2025-01-03T00:00:00Z',
      }),
      makeThread({
        id: 'child3',
        handoffParentId: 'parent',
        lastUpdatedDate: '2025-01-04T00:00:00Z',
      }),
    ];
    const entries = buildThreadStacks(threads);
    expect(entries).toHaveLength(1);
    expect(at(entries, 0).kind).toBe('stack');
    // Root (parent) is head
    expect(at(entries, 0).thread.id).toBe('parent');
    // All children are descendants
    expect(at(entries, 0).stack?.descendants).toHaveLength(3);
    const descendantIds = at(entries, 0).stack?.descendants.map((d) => d.id) ?? [];
    // DFS order: sorted by lastUpdatedDate desc (child3, child2, child1)
    expect(descendantIds).toEqual(['child3', 'child2', 'child1']);
    // lastActiveDate is child3's date
    expect(at(entries, 0).stack?.lastActiveDate).toBe('2025-01-04T00:00:00Z');

    // Topology captures the fork: parent has 3 children
    const topo = at(entries, 0).stack?.topology;
    expect(topo).toBeDefined();
    expect(topo?.rootId).toBe('parent');
    expect(topo?.parentToChildren['parent']).toHaveLength(3);
    expect(topo?.parentToChildren['parent']).toContain('child1');
    expect(topo?.parentToChildren['parent']).toContain('child2');
    expect(topo?.parentToChildren['parent']).toContain('child3');
    expect(topo?.childToParent['child1']).toBe('parent');
    expect(topo?.childToParent['child2']).toBe('parent');
    expect(topo?.childToParent['child3']).toBe('parent');
  });

  it('handles fan-out: parent with children that also have children', () => {
    const threads = [
      makeThread({ id: 'root', lastUpdatedDate: '2025-01-01T00:00:00Z' }),
      makeThread({
        id: 'branch-a',
        handoffParentId: 'root',
        lastUpdatedDate: '2025-01-02T00:00:00Z',
      }),
      makeThread({
        id: 'branch-b',
        handoffParentId: 'root',
        lastUpdatedDate: '2025-01-03T00:00:00Z',
      }),
      makeThread({
        id: 'leaf',
        handoffParentId: 'branch-a',
        lastUpdatedDate: '2025-01-05T00:00:00Z',
      }),
    ];
    const entries = buildThreadStacks(threads);
    expect(entries).toHaveLength(1);
    expect(at(entries, 0).kind).toBe('stack');
    // Root is head
    expect(at(entries, 0).thread.id).toBe('root');
    expect(getStackSize(at(entries, 0))).toBe(4);

    // DFS order: branch-a subtree is more recent (leaf=Jan5), so branch-a comes first
    // branch-a (Jan 2), leaf (Jan 5), branch-b (Jan 3)
    // Wait: children of root sorted by lastUpdatedDate desc. branch-b=Jan3, branch-a=Jan2
    // But branch-a has child leaf=Jan5. Children sort is by their OWN date, not subtree.
    // So root's children sorted desc: branch-b (Jan3), branch-a (Jan2)
    // DFS: branch-b, then branch-a, leaf
    const descendantIds = at(entries, 0).stack?.descendants.map((d) => d.id) ?? [];
    expect(descendantIds).toEqual(['branch-b', 'branch-a', 'leaf']);

    // Topology captures the full tree including fork at root
    const topo = at(entries, 0).stack?.topology;
    expect(topo).toBeDefined();
    expect(topo?.rootId).toBe('root');
    expect(topo?.parentToChildren['root']).toHaveLength(2);
    expect(topo?.parentToChildren['root']).toContain('branch-a');
    expect(topo?.parentToChildren['root']).toContain('branch-b');
    expect(topo?.parentToChildren['branch-a']).toEqual(['leaf']);
    expect(topo?.parentToChildren['branch-b']).toBeUndefined();
    expect(topo?.childToParent['branch-a']).toBe('root');
    expect(topo?.childToParent['branch-b']).toBe('root');
    expect(topo?.childToParent['leaf']).toBe('branch-a');
  });

  it('sorts entries by lastActiveDate desc so active stacks float to top', () => {
    const threads = [
      // Stack 1: root old, child recent
      makeThread({ id: 'stack1-root', lastUpdatedDate: '2025-01-01T00:00:00Z' }),
      makeThread({
        id: 'stack1-child',
        handoffParentId: 'stack1-root',
        lastUpdatedDate: '2025-01-10T00:00:00Z',
      }),
      // Standalone: mid-range date
      makeThread({ id: 'standalone', lastUpdatedDate: '2025-01-05T00:00:00Z' }),
    ];
    const entries = buildThreadStacks(threads);
    // Stack1 has lastActiveDate Jan 10, standalone has Jan 5
    // Stack1 should come first
    expect(at(entries, 0).thread.id).toBe('stack1-root');
    expect(at(entries, 1).thread.id).toBe('standalone');
  });
});

describe('flattenEntries', () => {
  it('returns threads in order when no stacks expanded', () => {
    const threads = [
      makeThread({ id: 'a', lastUpdatedDate: '2025-01-02T00:00:00Z' }),
      makeThread({ id: 'b', lastUpdatedDate: '2025-01-01T00:00:00Z' }),
    ];
    const entries = buildThreadStacks(threads);
    const flat = flattenEntries(entries, new Set());
    // Sorted by lastUpdatedDate desc
    expect(flat.map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('includes descendants when stack is expanded', () => {
    const threads = [
      makeThread({ id: 'parent', lastUpdatedDate: '2025-01-01T00:00:00Z' }),
      makeThread({
        id: 'child',
        handoffParentId: 'parent',
        lastUpdatedDate: '2025-01-02T00:00:00Z',
      }),
    ];
    const entries = buildThreadStacks(threads);
    const headId = at(entries, 0).thread.id; // 'parent' is head (root)
    expect(headId).toBe('parent');
    const flat = flattenEntries(entries, new Set([headId]));
    expect(flat).toHaveLength(2);
    expect(flat.map((t) => t.id)).toEqual(['parent', 'child']);
  });

  it('does not include descendants when stack is collapsed', () => {
    const threads = [
      makeThread({ id: 'parent', lastUpdatedDate: '2025-01-01T00:00:00Z' }),
      makeThread({
        id: 'child',
        handoffParentId: 'parent',
        lastUpdatedDate: '2025-01-02T00:00:00Z',
      }),
    ];
    const entries = buildThreadStacks(threads);
    const flat = flattenEntries(entries, new Set());
    expect(flat).toHaveLength(1);
  });

  it('produces tree-ordered output for fan-out stacks', () => {
    const threads = [
      makeThread({ id: 'root', lastUpdatedDate: '2025-01-01T00:00:00Z' }),
      makeThread({
        id: 'child-a',
        handoffParentId: 'root',
        lastUpdatedDate: '2025-01-02T00:00:00Z',
      }),
      makeThread({
        id: 'child-b',
        handoffParentId: 'root',
        lastUpdatedDate: '2025-01-03T00:00:00Z',
      }),
      makeThread({
        id: 'grandchild',
        handoffParentId: 'child-a',
        lastUpdatedDate: '2025-01-04T00:00:00Z',
      }),
    ];
    const entries = buildThreadStacks(threads);
    const flat = flattenEntries(entries, new Set(['root']));
    // root, then DFS: child-b (Jan3, sorted first), child-a (Jan2), grandchild (Jan4)
    expect(flat.map((t) => t.id)).toEqual(['root', 'child-b', 'child-a', 'grandchild']);
  });
});

describe('getStackSize', () => {
  it('returns 1 for a single thread entry', () => {
    const entries = buildThreadStacks([makeThread({ id: 'a' })]);
    expect(getStackSize(at(entries, 0))).toBe(1);
  });

  it('returns count including descendants for a stack', () => {
    const threads = [
      makeThread({ id: 'a', lastUpdatedDate: '2025-01-01T00:00:00Z' }),
      makeThread({ id: 'b', handoffParentId: 'a', lastUpdatedDate: '2025-01-02T00:00:00Z' }),
      makeThread({ id: 'c', handoffParentId: 'b', lastUpdatedDate: '2025-01-03T00:00:00Z' }),
    ];
    const entries = buildThreadStacks(threads);
    expect(getStackSize(at(entries, 0))).toBe(3);
  });
});

describe('getLastActiveThread', () => {
  it('returns the thread itself for a non-stack entry', () => {
    const entries = buildThreadStacks([
      makeThread({ id: 'a', lastUpdatedDate: '2025-01-01T00:00:00Z' }),
    ]);
    expect(getLastActiveThread(at(entries, 0)).id).toBe('a');
  });

  it('returns the most recently updated thread in a stack', () => {
    const threads = [
      makeThread({ id: 'root', lastUpdatedDate: '2025-01-01T00:00:00Z' }),
      makeThread({
        id: 'child',
        handoffParentId: 'root',
        lastUpdatedDate: '2025-01-05T00:00:00Z',
      }),
    ];
    const entries = buildThreadStacks(threads);
    // Head is root, but last active is child
    expect(at(entries, 0).thread.id).toBe('root');
    expect(getLastActiveThread(at(entries, 0)).id).toBe('child');
  });

  it('returns root if root is most recent', () => {
    const threads = [
      makeThread({ id: 'root', lastUpdatedDate: '2025-01-10T00:00:00Z' }),
      makeThread({
        id: 'child',
        handoffParentId: 'root',
        lastUpdatedDate: '2025-01-01T00:00:00Z',
      }),
    ];
    const entries = buildThreadStacks(threads);
    expect(getLastActiveThread(at(entries, 0)).id).toBe('root');
  });
});
