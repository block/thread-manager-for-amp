import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Thread, ThreadChainNode } from '../../shared/types.js';

vi.mock('./threadCrud.js', () => ({
  getThreads: vi.fn(),
}));

import { getThreadChain } from './threadChain.js';
import { getThreads } from './threadCrud.js';

const mockedGetThreads = vi.mocked(getThreads);

function makeThread(overrides: Partial<Thread> & { id: string }): Thread {
  return {
    title: `Thread ${overrides.id}`,
    lastUpdated: '2 hours ago',
    visibility: 'Private' as const,
    messages: 5,
    ...overrides,
  };
}

function collectNodeIds(nodes: ThreadChainNode[]): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    ids.push(node.thread.id);
    ids.push(...collectNodeIds(node.children));
  }
  return ids;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getThreadChain', () => {
  it('returns empty chain for a thread with no relationships', async () => {
    mockedGetThreads.mockResolvedValue({
      threads: [makeThread({ id: 'solo' })],
      nextCursor: null,
      hasMore: false,
    });

    const chain = await getThreadChain('solo');
    expect(chain.ancestors).toEqual([]);
    expect(chain.current?.id).toBe('solo');
    expect(chain.descendants).toEqual([]);
    expect(chain.descendantsTree).toEqual([]);
  });

  it('returns linear ancestors for a simple chain', async () => {
    mockedGetThreads.mockResolvedValue({
      threads: [
        makeThread({ id: 'root' }),
        makeThread({ id: 'middle', handoffParentId: 'root' }),
        makeThread({ id: 'leaf', handoffParentId: 'middle' }),
      ],
      nextCursor: null,
      hasMore: false,
    });

    const chain = await getThreadChain('leaf');
    expect(chain.ancestors.map((a) => a.id)).toEqual(['root', 'middle']);
    expect(chain.current?.id).toBe('leaf');
    expect(chain.descendants).toEqual([]);
    expect(chain.descendantsTree).toEqual([]);
  });

  it('returns flat descendants and tree for a fork', async () => {
    // root → mid → [child-a, child-b]
    mockedGetThreads.mockResolvedValue({
      threads: [
        makeThread({ id: 'root' }),
        makeThread({ id: 'mid', handoffParentId: 'root' }),
        makeThread({ id: 'child-a', handoffParentId: 'mid' }),
        makeThread({ id: 'child-b', handoffParentId: 'mid' }),
      ],
      nextCursor: null,
      hasMore: false,
    });

    const chain = await getThreadChain('root');
    expect(chain.ancestors).toEqual([]);
    expect(chain.current?.id).toBe('root');

    // Flat descendants should contain all 3
    const descIds = chain.descendants.map((d) => d.id);
    expect(descIds).toContain('mid');
    expect(descIds).toContain('child-a');
    expect(descIds).toContain('child-b');

    // Tree: root's direct child is mid, mid has two children
    expect(chain.descendantsTree).toHaveLength(1);
    const midNode = chain.descendantsTree?.[0];
    expect(midNode?.thread.id).toBe('mid');
    expect(midNode?.children).toHaveLength(2);
    const childIds = midNode?.children.map((c) => c.thread.id) ?? [];
    expect(childIds).toContain('child-a');
    expect(childIds).toContain('child-b');
  });

  it('builds tree from middle of a chain', async () => {
    // root → mid → [child-a → grandchild, child-b]
    mockedGetThreads.mockResolvedValue({
      threads: [
        makeThread({ id: 'root' }),
        makeThread({ id: 'mid', handoffParentId: 'root' }),
        makeThread({ id: 'child-a', handoffParentId: 'mid' }),
        makeThread({ id: 'child-b', handoffParentId: 'mid' }),
        makeThread({ id: 'grandchild', handoffParentId: 'child-a' }),
      ],
      nextCursor: null,
      hasMore: false,
    });

    const chain = await getThreadChain('mid');

    // Ancestors: just root
    expect(chain.ancestors.map((a) => a.id)).toEqual(['root']);
    expect(chain.current?.id).toBe('mid');

    // Descendants tree: two children of mid
    expect(chain.descendantsTree).toHaveLength(2);
    const allDescIds = collectNodeIds(chain.descendantsTree ?? []);
    expect(allDescIds).toContain('child-a');
    expect(allDescIds).toContain('child-b');
    expect(allDescIds).toContain('grandchild');

    // child-a should have grandchild as its child in the tree
    const childANode = chain.descendantsTree?.find((n) => n.thread.id === 'child-a');
    expect(childANode?.children).toHaveLength(1);
    expect(childANode?.children[0]?.thread.id).toBe('grandchild');

    // child-b is a leaf
    const childBNode = chain.descendantsTree?.find((n) => n.thread.id === 'child-b');
    expect(childBNode?.children).toEqual([]);
  });

  it('returns null current for unknown thread id', async () => {
    mockedGetThreads.mockResolvedValue({
      threads: [makeThread({ id: 'other' })],
      nextCursor: null,
      hasMore: false,
    });

    const chain = await getThreadChain('nonexistent');
    expect(chain.current).toBeNull();
    expect(chain.ancestors).toEqual([]);
    expect(chain.descendants).toEqual([]);
  });

  it('flat descendants match tree contents', async () => {
    // Verify the flat list and tree contain the same threads
    // root → [a → [a1, a2], b]
    mockedGetThreads.mockResolvedValue({
      threads: [
        makeThread({ id: 'root' }),
        makeThread({ id: 'a', handoffParentId: 'root' }),
        makeThread({ id: 'b', handoffParentId: 'root' }),
        makeThread({ id: 'a1', handoffParentId: 'a' }),
        makeThread({ id: 'a2', handoffParentId: 'a' }),
      ],
      nextCursor: null,
      hasMore: false,
    });

    const chain = await getThreadChain('root');
    const flatIds = chain.descendants.map((d) => d.id).sort();
    const treeIds = collectNodeIds(chain.descendantsTree ?? []).sort();
    expect(flatIds).toEqual(treeIds);
    expect(flatIds).toEqual(['a', 'a1', 'a2', 'b']);
  });
});
