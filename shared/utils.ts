import type { Thread } from './types.js';

let msgCounter = 0;

export function generateId(): string {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `msg-${crypto.randomUUID()}`;
  }
  return `msg-${Date.now()}-${++msgCounter}`;
}

export function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '');
}

export interface HandoffGraph {
  threadMap: Map<string, Thread>;
  childToParent: Map<string, string>;
  parentToChildren: Map<string, string[]>;
}

export function buildHandoffGraph(threads: Thread[]): HandoffGraph {
  const threadMap = new Map<string, Thread>();
  for (const t of threads) {
    threadMap.set(t.id, t);
  }

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

  return { threadMap, childToParent, parentToChildren };
}
