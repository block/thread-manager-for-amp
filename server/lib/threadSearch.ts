import { readFile, readdir, stat } from 'fs/promises';
import { join } from 'path';
import type {
  SearchResult,
  SearchMatch,
  RelatedThread,
} from '../../shared/types.js';
import {
  THREADS_DIR,
  type TextContent,
  type ThreadFile,
} from './threadTypes.js';
import { getThreads } from './threadCrud.js';

export async function searchThreads(query: string): Promise<SearchResult[]> {
  const searchLower = query.toLowerCase();
  const results: (SearchResult & { mtime: number })[] = [];
  
  try {
    const files = await readdir(THREADS_DIR);
    const threadFiles = files.filter((f: string) => f.startsWith('T-') && f.endsWith('.json'));
    
    for (const file of threadFiles) {
      const filePath = join(THREADS_DIR, file);
      try {
        const fileStat = await stat(filePath);
        const content = await readFile(filePath, 'utf-8');
        const data = JSON.parse(content) as ThreadFile;
        const messages = data.messages || [];
        const threadId = file.replace('.json', '');
        
        const matches: SearchMatch[] = [];
        for (let i = 0; i < messages.length; i++) {
          const msg = messages[i];
          let textContent = '';
          
          if (typeof msg.content === 'string') {
            textContent = msg.content;
          } else if (Array.isArray(msg.content)) {
            textContent = msg.content
              // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard for parsed JSON
              .filter((c): c is TextContent => typeof c === 'object' && c !== null && c.type === 'text')
              .map((c) => c.text || '')
              .join('\n');
          }
          
          if (textContent.toLowerCase().includes(searchLower)) {
            const lines = textContent.split('\n');
            for (const line of lines) {
              if (line.toLowerCase().includes(searchLower)) {
                matches.push({
                  messageIndex: i,
                  role: msg.role,
                  snippet: line.slice(0, 200),
                });
                if (matches.length >= 3) break;
              }
            }
          }
          if (matches.length >= 3) break;
        }
        
        let title = data.title || '';
        if (!title && messages.length > 0) {
          const firstUser = messages.find((m) => m.role === 'user');
          if (firstUser?.content) {
            let tc = '';
            if (typeof firstUser.content === 'string') {
              tc = firstUser.content;
            } else if (Array.isArray(firstUser.content)) {
              const textBlock = firstUser.content.find(
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard for parsed JSON
                (c): c is TextContent => typeof c === 'object' && c !== null && c.type === 'text'
              );
              tc = textBlock?.text || '';
            }
            title = tc.slice(0, 60).replace(/\n/g, ' ').trim();
          }
        }
        if (!title) title = threadId;

        const titleMatches = title.toLowerCase().includes(searchLower);
        const idMatches = threadId.toLowerCase().includes(searchLower);

        if (matches.length > 0 || titleMatches || idMatches) {
          results.push({ threadId, title, lastUpdated: new Date(fileStat.mtimeMs).toISOString(), matches, mtime: fileStat.mtimeMs });
        }
      } catch {
        // Skip threads that fail to parse
      }
    }
    
    results.sort((a, b) => b.mtime - a.mtime);
    return results.map((r) => ({ threadId: r.threadId, title: r.title, lastUpdated: r.lastUpdated, matches: r.matches }));
  } catch (e) {
    console.error('[threads] Search error:', e);
    throw e;
  }
}

export async function getRelatedThreads(threadId: string): Promise<RelatedThread[]> {
  const { threads } = await getThreads({ limit: 1000 });
  const targetThread = threads.find((t) => t.id === threadId);
  
  if (!targetThread?.touchedFiles?.length) {
    return [];
  }
  
  const targetFiles = new Set(targetThread.touchedFiles);
  const related: RelatedThread[] = [];
  
  for (const thread of threads) {
    if (thread.id === threadId) continue;
    if (!thread.touchedFiles?.length) continue;
    
    const commonFiles = thread.touchedFiles.filter((f) => targetFiles.has(f));
    if (commonFiles.length > 0) {
      related.push({
        id: thread.id,
        title: thread.title,
        lastUpdated: thread.lastUpdated,
        workspace: thread.workspace,
        repo: thread.repo,
        commonFiles: commonFiles.slice(0, 5),
        commonFileCount: commonFiles.length,
      });
    }
  }
  
  related.sort((a, b) => b.commonFileCount - a.commonFileCount);
  return related.slice(0, 10);
}
