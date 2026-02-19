import type { Thread, ThreadChain, ChainThread, ThreadRelationship } from '../../shared/types.js';
import { runAmp, stripAnsi } from './utils.js';
import { getThreads } from './threadCrud.js';
import { isHandoffRelationship } from './threadTypes.js';

export async function getThreadChain(threadId: string): Promise<ThreadChain> {
  const { threads } = await getThreads({ limit: 1000 });
  const threadMap = new Map(threads.map((t) => [t.id, t]));

  const ancestors: ChainThread[] = [];
  const visited = new Set<string>([threadId]);

  interface ThreadWithRelationships extends Thread {
    relationships?: ThreadRelationship[];
  }

  function findAncestors(id: string): void {
    const thread = threadMap.get(id) as ThreadWithRelationships | undefined;
    if (!thread?.relationships) return;

    for (const rel of thread.relationships) {
      if (isHandoffRelationship(rel) && rel.role === 'parent' && !visited.has(rel.threadID)) {
        visited.add(rel.threadID);
        const parentThread = threadMap.get(rel.threadID);
        if (parentThread) {
          ancestors.unshift({
            id: parentThread.id,
            title: parentThread.title,
            lastUpdated: parentThread.lastUpdated,
            workspace: parentThread.workspace,
            comment: rel.comment,
          });
          findAncestors(rel.threadID);
        }
      }
    }
  }

  const descendants: ChainThread[] = [];

  function findDescendants(id: string): void {
    const thread = threadMap.get(id) as ThreadWithRelationships | undefined;
    if (!thread?.relationships) return;

    for (const rel of thread.relationships) {
      if (isHandoffRelationship(rel) && rel.role === 'child' && !visited.has(rel.threadID)) {
        visited.add(rel.threadID);
        const childThread = threadMap.get(rel.threadID);
        if (childThread) {
          descendants.push({
            id: childThread.id,
            title: childThread.title,
            lastUpdated: childThread.lastUpdated,
            workspace: childThread.workspace,
            comment: rel.comment,
          });
          findDescendants(rel.threadID);
        }
      }
    }
  }

  findAncestors(threadId);
  findDescendants(threadId);

  const currentThread = threadMap.get(threadId);
  const current: ChainThread | null = currentThread
    ? {
        id: currentThread.id,
        title: currentThread.title,
        lastUpdated: currentThread.lastUpdated,
        workspace: currentThread.workspace,
      }
    : null;

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
  return { threadId: match[0] };
}
