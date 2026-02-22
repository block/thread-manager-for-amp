import type { ThreadChain, ChainThread } from '../../shared/types.js';
import { readFile, readdir, stat } from 'fs/promises';
import { join } from 'path';
import { runAmp, stripAnsi, formatRelativeTime } from './utils.js';
import {
  THREADS_DIR,
  isHandoffRelationship,
  isTextContent,
  type ThreadFile,
} from './threadTypes.js';

interface LoadedThread {
  id: string;
  title: string;
  lastUpdated: string;
  workspace: string | null;
  relationships: ThreadFile['relationships'];
}

async function loadThreadSummaries(): Promise<Map<string, LoadedThread>> {
  const files = await readdir(THREADS_DIR);
  const threadFiles = files.filter((f: string) => f.startsWith('T-') && f.endsWith('.json'));

  const entries = await Promise.all(
    threadFiles.map(async (file): Promise<[string, LoadedThread] | null> => {
      const filePath = join(THREADS_DIR, file);
      try {
        const content = await readFile(filePath, 'utf-8');
        const data = JSON.parse(content) as ThreadFile;
        const fileStat = await stat(filePath);

        const messages = data.messages || [];
        let title = data.title || '';
        if (!title && messages.length > 0) {
          const firstUser = messages.find((m) => m.role === 'user');
          if (firstUser?.content) {
            let textContent = '';
            if (typeof firstUser.content === 'string') {
              textContent = firstUser.content;
            } else if (Array.isArray(firstUser.content)) {
              const textBlock = firstUser.content.find(isTextContent);
              textContent = textBlock?.text || '';
            }
            title = textContent.slice(0, 60).replace(/\n/g, ' ').trim();
            if (textContent.length > 60) title += '...';
          }
        }
        if (!title) title = file.replace('.json', '');

        const trees = data.env?.initial?.trees || [];
        const workspace = trees[0]?.displayName || null;
        const id = file.replace('.json', '');

        return [
          id,
          {
            id,
            title,
            lastUpdated: formatRelativeTime(fileStat.mtime),
            workspace,
            relationships: data.relationships,
          },
        ];
      } catch {
        return null;
      }
    }),
  );

  return new Map(entries.filter((e): e is [string, LoadedThread] => e !== null));
}

export async function getThreadChain(threadId: string): Promise<ThreadChain> {
  const threadMap = await loadThreadSummaries();

  const ancestors: ChainThread[] = [];
  const visited = new Set<string>([threadId]);

  // role describes the CURRENT thread's role:
  //   role: 'child'  → I am the child  → rel.threadID is my parent (ancestor)
  //   role: 'parent' → I am the parent → rel.threadID is my child (descendant)

  function findAncestors(id: string): void {
    const thread = threadMap.get(id);
    if (!thread?.relationships) return;

    for (const rel of thread.relationships) {
      if (isHandoffRelationship(rel) && rel.role === 'child' && !visited.has(rel.threadID)) {
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
    const thread = threadMap.get(id);
    if (!thread?.relationships) return;

    for (const rel of thread.relationships) {
      if (isHandoffRelationship(rel) && rel.role === 'parent' && !visited.has(rel.threadID)) {
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
