import { describe, it, expect } from 'vitest';
import type { Thread } from '../types';
import { buildThreadStacks, flattenEntries, getStackSize } from './threadStacks';

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

  it('groups parent-child into a stack', () => {
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
    // Child is more recent, so it becomes head
    expect(at(entries, 0).thread.id).toBe('child');
    expect(at(entries, 0).stack?.ancestors).toHaveLength(1);
    expect(at(entries, 0).stack?.ancestors[0]?.id).toBe('parent');
  });

  it('picks most recently updated thread as head', () => {
    const threads = [
      makeThread({ id: 'old', lastUpdatedDate: '2025-01-01T00:00:00Z' }),
      makeThread({ id: 'new', handoffParentId: 'old', lastUpdatedDate: '2025-01-10T00:00:00Z' }),
    ];
    const entries = buildThreadStacks(threads);
    expect(at(entries, 0).thread.id).toBe('new');
  });

  it('builds a 3-thread chain', () => {
    const threads = [
      makeThread({ id: 'a', lastUpdatedDate: '2025-01-01T00:00:00Z' }),
      makeThread({ id: 'b', handoffParentId: 'a', lastUpdatedDate: '2025-01-02T00:00:00Z' }),
      makeThread({ id: 'c', handoffParentId: 'b', lastUpdatedDate: '2025-01-03T00:00:00Z' }),
    ];
    const entries = buildThreadStacks(threads);
    expect(entries).toHaveLength(1);
    expect(at(entries, 0).kind).toBe('stack');
    expect(at(entries, 0).thread.id).toBe('c');
    expect(at(entries, 0).stack?.ancestors).toHaveLength(2);
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
    // Most recently updated child becomes head
    expect(at(entries, 0).thread.id).toBe('child3');
    // All others are ancestors (sorted by recency)
    expect(at(entries, 0).stack?.ancestors).toHaveLength(3);
    const ancestorIds = at(entries, 0).stack?.ancestors.map((a) => a.id) ?? [];
    expect(ancestorIds).toContain('parent');
    expect(ancestorIds).toContain('child1');
    expect(ancestorIds).toContain('child2');

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
    // leaf is most recent
    expect(at(entries, 0).thread.id).toBe('leaf');
    expect(getStackSize(at(entries, 0))).toBe(4);

    // Topology captures the full tree including fork at root
    const topo = at(entries, 0).stack?.topology;
    expect(topo).toBeDefined();
    expect(topo?.rootId).toBe('root');
    // root has two children (branch-a and branch-b)
    expect(topo?.parentToChildren['root']).toHaveLength(2);
    expect(topo?.parentToChildren['root']).toContain('branch-a');
    expect(topo?.parentToChildren['root']).toContain('branch-b');
    // branch-a has one child (leaf)
    expect(topo?.parentToChildren['branch-a']).toEqual(['leaf']);
    // branch-b is a leaf (no children entry)
    expect(topo?.parentToChildren['branch-b']).toBeUndefined();
    // child-to-parent edges
    expect(topo?.childToParent['branch-a']).toBe('root');
    expect(topo?.childToParent['branch-b']).toBe('root');
    expect(topo?.childToParent['leaf']).toBe('branch-a');
  });
});

describe('flattenEntries', () => {
  it('returns threads in order when no stacks expanded', () => {
    const threads = [makeThread({ id: 'a' }), makeThread({ id: 'b' })];
    const entries = buildThreadStacks(threads);
    const flat = flattenEntries(entries, new Set());
    expect(flat.map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('includes ancestors when stack is expanded', () => {
    const threads = [
      makeThread({ id: 'parent', lastUpdatedDate: '2025-01-01T00:00:00Z' }),
      makeThread({
        id: 'child',
        handoffParentId: 'parent',
        lastUpdatedDate: '2025-01-02T00:00:00Z',
      }),
    ];
    const entries = buildThreadStacks(threads);
    const headId = at(entries, 0).thread.id; // 'child' is head
    const flat = flattenEntries(entries, new Set([headId]));
    expect(flat).toHaveLength(2);
  });

  it('does not include ancestors when stack is collapsed', () => {
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
});

describe('getStackSize', () => {
  it('returns 1 for a single thread entry', () => {
    const entries = buildThreadStacks([makeThread({ id: 'a' })]);
    expect(getStackSize(at(entries, 0))).toBe(1);
  });

  it('returns count including ancestors for a stack', () => {
    const threads = [
      makeThread({ id: 'a', lastUpdatedDate: '2025-01-01T00:00:00Z' }),
      makeThread({ id: 'b', handoffParentId: 'a', lastUpdatedDate: '2025-01-02T00:00:00Z' }),
      makeThread({ id: 'c', handoffParentId: 'b', lastUpdatedDate: '2025-01-03T00:00:00Z' }),
    ];
    const entries = buildThreadStacks(threads);
    expect(getStackSize(at(entries, 0))).toBe(3);
  });
});
