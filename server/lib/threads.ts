import { readFile, readdir, stat, unlink, rm } from 'fs/promises';
import type { Stats } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { AMP_HOME, DEFAULT_MAX_CONTEXT_TOKENS } from './constants.js';
import { calculateCost, estimateToolCosts, isHiddenCostTool } from '../../shared/cost.js';
import type { ToolCostCounts } from '../../shared/cost.js';
import { formatRelativeTime, runAmp, stripAnsi } from './utils.js';
import { getArtifacts, deleteThreadData } from './database.js';
import { formatMessageContent } from './threadParsing.js';
import { getKnownWorkspaces as getKnownWorkspacesImpl } from './workspaces.js';
import type {
  Thread,
  ThreadsResult,
  RelatedThread,
  ThreadChain,
  ChainThread,
  ThreadRelationship,
  FileChange,
  FileEdit,
  SearchResult,
  SearchMatch,
  KnownWorkspace,
  ThreadImage,
  Artifact,
} from '../../shared/types.js';

// Re-export for backward compatibility
export { formatMessageContent } from './threadParsing.js';
export { getRepoFromGitConfig } from './workspaces.js';

const ARTIFACTS_DIR = join(homedir(), '.amp-thread-manager', 'artifacts');
const THREADS_DIR = join(AMP_HOME, '.local', 'share', 'amp', 'threads');

// Internal types for thread JSON parsing
interface ThreadUsage {
  inputTokens?: number;
  outputTokens?: number;
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;
  totalInputTokens?: number;
  maxInputTokens?: number;
}

interface TextContent {
  type: 'text';
  text?: string;
}

interface ImageSource {
  data?: string;
  mediaType?: string;
}

interface ImageContent {
  type: 'image';
  source?: ImageSource;
  mediaType?: string;
  sourcePath?: string | null;
}

interface ToolUseContent {
  type: 'tool_use';
  name?: string;
  input?: {
    path?: string;
    old_str?: string;
    new_str?: string;
    content?: string;
    [key: string]: unknown;
  };
}

type MessageContentBlock = string | TextContent | ImageContent | ToolUseContent | { type: string; [key: string]: unknown };
type MessageContent = string | MessageContentBlock[];

interface ThreadMessage {
  role: 'user' | 'assistant' | 'system';
  content: MessageContent;
  usage?: ThreadUsage;
  meta?: {
    sentAt?: number;
  };
}

interface ThreadTree {
  displayName?: string;
  uri?: string;
  repository?: {
    url?: string;
  };
}

interface ThreadEnv {
  initial?: {
    tags?: string[];
    trees?: ThreadTree[];
  };
}

interface ThreadFile {
  title?: string;
  visibility?: 'Private' | 'Public' | 'Workspace';
  created?: number;  // Unix timestamp in milliseconds
  messages?: ThreadMessage[];
  relationships?: ThreadRelationship[];
  env?: ThreadEnv;
}

interface FileStat {
  file: string;
  mtime: number;
}

interface GetThreadsOptions {
  limit?: number;
  cursor?: string | null;
}

export async function getThreads({ limit = 50, cursor = null }: GetThreadsOptions = {}): Promise<ThreadsResult> {
  try {
    const files = await readdir(THREADS_DIR);
    const threadFiles = files.filter((f: string) => f.startsWith('T-') && f.endsWith('.json'));
    
    // Get file stats for sorting before loading full content
    const fileStats = await Promise.all(
      threadFiles.map(async (file: string): Promise<FileStat | null> => {
        const filePath = join(THREADS_DIR, file);
        try {
          const fileStat: Stats = await stat(filePath);
          return { file, mtime: fileStat.mtime.getTime() };
        } catch {
          return null;
        }
      })
    );
    
    // Sort by mtime descending
    const sortedFiles = (fileStats.filter(Boolean) as FileStat[])
      .sort((a, b) => b.mtime - a.mtime);
    
    // Find cursor position and slice
    let startIndex = 0;
    if (cursor) {
      const cursorIndex = sortedFiles.findIndex((f) => f.file === `${cursor}.json`);
      if (cursorIndex !== -1) {
        startIndex = cursorIndex + 1;
      }
    }
    
    const slicedFiles = sortedFiles.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < sortedFiles.length;
    
    const threads = await Promise.all(
      slicedFiles.map(async ({ file }): Promise<Thread | null> => {
        const filePath = join(THREADS_DIR, file);
        try {
          const content = await readFile(filePath, 'utf-8');
          const data: ThreadFile = JSON.parse(content);
          const fileStat: Stats = await stat(filePath);
          
          const messages = data.messages || [];
          
          // Get title from first user message or use thread ID
          let title = data.title || '';
          if (!title && messages.length > 0) {
            const firstUser = messages.find((m) => m.role === 'user');
            if (firstUser?.content) {
              let textContent = '';
              if (typeof firstUser.content === 'string') {
                textContent = firstUser.content;
              } else if (Array.isArray(firstUser.content)) {
                const textBlock = firstUser.content.find(
                  (c): c is TextContent => typeof c === 'object' && c !== null && c.type === 'text'
                );
                textContent = textBlock?.text || '';
              }
              title = textContent.slice(0, 60).replace(/\n/g, ' ').trim();
              if (textContent.length > 60) title += '...';
            }
          }
          if (!title) title = file.replace('.json', '');
          
          // Extract model from tags
          const tags = data.env?.initial?.tags || [];
          const modelTag = tags.find((t) => t.startsWith('model:'));
          let model: string | undefined;
          let isOpus = false;
          if (modelTag) {
            const modelName = modelTag.replace('model:', '');
            if (modelName.includes('opus')) {
              model = 'opus';
              isOpus = true;
            } else if (modelName.includes('sonnet')) {
              model = 'sonnet';
            } else {
              model = modelName;
            }
          }
          
          // Calculate token usage and cost
          let freshInputTokens = 0;  // Non-cached input tokens
          let totalOutputTokens = 0;
          let cacheCreation = 0;
          let cacheRead = 0;
          let contextTokens = 0;
          let maxContextTokens = DEFAULT_MAX_CONTEXT_TOKENS;
          const hiddenToolCounts: ToolCostCounts = {};
          const taskPromptLengths: number[] = [];
          
          for (const msg of messages) {
            if (msg.usage) {
              freshInputTokens += msg.usage.inputTokens || 0;
              totalOutputTokens += msg.usage.outputTokens || 0;
              cacheCreation += msg.usage.cacheCreationInputTokens || 0;
              cacheRead += msg.usage.cacheReadInputTokens || 0;
              contextTokens = msg.usage.totalInputTokens || contextTokens;
              maxContextTokens = msg.usage.maxInputTokens || maxContextTokens;
            }
            if (Array.isArray(msg.content)) {
              for (const block of msg.content) {
                if (typeof block === 'object' && block !== null && block.type === 'tool_use') {
                  const toolBlock = block as ToolUseContent;
                  const name = toolBlock.name;
                  if (name && isHiddenCostTool(name)) {
                    hiddenToolCounts[name] = (hiddenToolCounts[name] || 0) + 1;
                    if (name === 'Task') {
                      const prompt = (toolBlock.input?.prompt as string) || '';
                      taskPromptLengths.push(prompt.length);
                    }
                  }
                }
              }
            }
          }
          
          const tokenCost = calculateCost({
            inputTokens: freshInputTokens,
            cacheCreationTokens: cacheCreation,
            cacheReadTokens: cacheRead,
            outputTokens: totalOutputTokens,
            isOpus,
          });
          const cost = tokenCost + estimateToolCosts(hiddenToolCounts, taskPromptLengths);
          
          const contextPercent = maxContextTokens > 0 
            ? Math.round((contextTokens / maxContextTokens) * 100) 
            : 0;
          
          // Extract workspace/repo info
          const trees = data.env?.initial?.trees || [];
          const workspace = trees[0]?.displayName || null;
          const workspaceUri = trees[0]?.uri || null;
          const workspacePath = workspaceUri ? workspaceUri.replace('file://', '') : null;
          const repoUrl = trees[0]?.repository?.url || null;
          let repo: string | null = null;
          if (repoUrl) {
            const match = repoUrl.match(/[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
            repo = match ? match[1] : repoUrl;
          }
          
          // Extract handoff relationships
          const relationships = data.relationships || [];
          let handoffParentId: string | null = null;
          let handoffChildId: string | null = null;
          for (const rel of relationships) {
            if (rel.type === 'handoff') {
              if (rel.role === 'parent') {
                handoffParentId = rel.threadID;
              } else if (rel.role === 'child') {
                handoffChildId = rel.threadID;
              }
            }
          }
          
          // Extract touched files from tool uses
          const touchedFiles = new Set<string>();
          for (const msg of messages) {
            if (msg.role === 'assistant' && Array.isArray(msg.content)) {
              for (const block of msg.content) {
                if (typeof block === 'object' && block !== null && block.type === 'tool_use') {
                  const toolBlock = block as ToolUseContent;
                  if (toolBlock.input?.path) {
                    touchedFiles.add(toolBlock.input.path);
                  }
                }
              }
            }
          }
          
          return {
            id: file.replace('.json', ''),
            title,
            lastUpdated: formatRelativeTime(fileStat.mtime),
            lastUpdatedDate: fileStat.mtime.toISOString(),
            visibility: data.visibility || 'Private',
            messages: messages.length,
            model,
            contextPercent,
            maxContextTokens,
            cost: Math.round(cost * 100) / 100,
            workspace,
            workspacePath,
            repo,
            touchedFiles: [...touchedFiles],
            handoffParentId,
            handoffChildId,
          };
        } catch (e) {
          const error = e as Error;
          console.error(`[threads] Failed to parse ${file}:`, error.message);
          return null;
        }
      })
    );
    
    const validThreads = threads.filter((t): t is Thread => t !== null);
    
    const nextCursor = validThreads.length > 0 && hasMore
      ? validThreads[validThreads.length - 1].id
      : null;
    
    return {
      threads: validThreads,
      nextCursor,
      hasMore,
    };
  } catch (e) {
    console.error('[threads] Error reading threads directory:', e);
    throw e;
  }
}

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
        const data: ThreadFile = JSON.parse(content);
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
        
        if (matches.length > 0) {
          let title = data.title || '';
          if (!title && messages.length > 0) {
            const firstUser = messages.find((m) => m.role === 'user');
            if (firstUser?.content) {
              let tc = '';
              if (typeof firstUser.content === 'string') {
                tc = firstUser.content;
              } else if (Array.isArray(firstUser.content)) {
                const textBlock = firstUser.content.find(
                  (c): c is TextContent => typeof c === 'object' && c !== null && c.type === 'text'
                );
                tc = textBlock?.text || '';
              }
              title = tc.slice(0, 60).replace(/\n/g, ' ').trim();
            }
          }
          if (!title) title = threadId;
          
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

interface FileChangesData {
  edits: FileEdit[];
  created: boolean;
}

export async function getThreadChanges(threadId: string): Promise<FileChange[]> {
  const threadPath = join(THREADS_DIR, `${threadId}.json`);
  
  try {
    const content = await readFile(threadPath, 'utf-8');
    const data: ThreadFile = JSON.parse(content);
    const messages = data.messages || [];
    
    const fileChanges = new Map<string, FileChangesData>();
    
    for (const msg of messages) {
      if (msg.role === 'assistant' && Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (typeof block === 'object' && block !== null && block.type === 'tool_use') {
            const toolBlock = block as ToolUseContent;
            const { name, input } = toolBlock as { name?: string; input?: ToolUseContent['input'] };
            
            if (name === 'create_file' && input?.path) {
              const path = input.path;
              if (!fileChanges.has(path)) {
                fileChanges.set(path, { edits: [], created: true });
              }
              const fc = fileChanges.get(path)!;
              fc.created = true;
              if (input.content) {
                fc.edits.push({
                  type: 'create',
                  preview: input.content.slice(0, 500),
                  lines: input.content.split('\n').length,
                });
              }
            } else if (name === 'edit_file' && input?.path) {
              const path = input.path;
              if (!fileChanges.has(path)) {
                fileChanges.set(path, { edits: [], created: false });
              }
              fileChanges.get(path)!.edits.push({
                type: 'edit',
                oldStr: input.old_str || '',
                newStr: input.new_str || '',
              });
            }
          }
        }
      }
    }
    
    const changes: FileChange[] = [];
    for (const [path, changeData] of fileChanges) {
      const filename = path.split('/').pop() || path;
      const dir = path.split('/').slice(-3, -1).join('/');
      
      changes.push({
        path,
        filename,
        dir,
        created: changeData.created,
        editCount: changeData.edits.filter((e) => e.type === 'edit').length,
        edits: changeData.edits.slice(0, 10),
      });
    }
    
    changes.sort((a, b) => b.editCount - a.editCount);
    return changes;
  } catch (e) {
    const error = e as Error;
    console.error('[threads] Failed to get thread changes:', error.message);
    return [];
  }
}

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
      if (rel.type === 'handoff' && rel.role === 'parent' && !visited.has(rel.threadID)) {
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
      if (rel.type === 'handoff' && rel.role === 'child' && !visited.has(rel.threadID)) {
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
  const current: ChainThread | null = currentThread ? {
    id: currentThread.id,
    title: currentThread.title,
    lastUpdated: currentThread.lastUpdated,
    workspace: currentThread.workspace,
  } : null;
  
  return { ancestors, current, descendants };
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

export async function getThreadMarkdown(threadId: string, limit: number = 50, offset: number = 0): Promise<string> {
  const threadPath = join(THREADS_DIR, `${threadId}.json`);
  const content = await readFile(threadPath, 'utf-8');
  const data: ThreadFile = JSON.parse(content);
  
  let messages = data.messages || [];
  const totalMessages = messages.length;
  
  // Calculate slice from the end
  if (limit > 0) {
    const endIdx = totalMessages - offset;
    const startIdx = Math.max(0, endIdx - limit);
    messages = messages.slice(startIdx, endIdx);
  }
  
  const title = data.title || threadId;
  const created = data.created || new Date().toISOString();
  const tags = data.env?.initial?.tags || [];
  const modelTag = tags.find((t) => t.startsWith('model:'));
  const agentMode = modelTag ? modelTag.replace('model:', '') : 'unknown';
  
  let markdown = `---
title: ${title}
threadId: ${threadId}
created: ${created}
agentMode: ${agentMode}
totalMessages: ${totalMessages}
offset: ${offset}
---

# ${title}

`;

  for (const msg of messages) {
    const timestamp = msg.meta?.sentAt ? new Date(msg.meta.sentAt).toISOString() : '';
    if (msg.role === 'user') {
      markdown += `## User${timestamp ? ` <!-- timestamp:${timestamp} -->` : ''}\n\n`;
      const formattedContent = formatMessageContent(msg.content as Parameters<typeof formatMessageContent>[0]);
      markdown += formattedContent + '\n\n';
    } else if (msg.role === 'assistant') {
      markdown += `## Assistant${timestamp ? ` <!-- timestamp:${timestamp} -->` : ''}\n\n`;
      const formattedContent = formatMessageContent(msg.content as Parameters<typeof formatMessageContent>[0]);
      markdown += formattedContent + '\n\n';
    }
  }
  
  return markdown;
}

export async function getThreadImages(threadId: string): Promise<ThreadImage[]> {
  const images: ThreadImage[] = [];
  
  // 1. Get images from artifacts table
  try {
    const artifacts: Artifact[] = getArtifacts(threadId);
    for (const artifact of artifacts) {
      if (artifact.type === 'image' && artifact.file_path) {
        try {
          const imageData = await readFile(artifact.file_path);
          images.push({
            mediaType: artifact.media_type || 'image/png',
            data: imageData.toString('base64'),
            sourcePath: artifact.file_path,
          });
        } catch {
          // File might have been deleted
        }
      }
    }
  } catch {
    // Database might not have artifacts yet
  }
  
  // 2. Get images from thread JSON (inline base64 from Amp CLI)
  try {
    const threadPath = join(THREADS_DIR, `${threadId}.json`);
    const content = await readFile(threadPath, 'utf-8');
    const data: ThreadFile = JSON.parse(content);
    const messages = data.messages || [];
    
    for (const msg of messages) {
      if (msg.role === 'user' && Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (typeof block === 'object' && block !== null && block.type === 'image') {
            const imgBlock = block as ImageContent;
            if (imgBlock.source?.data) {
              images.push({
                mediaType: imgBlock.mediaType || imgBlock.source?.mediaType || 'image/png',
                data: imgBlock.source.data,
                sourcePath: imgBlock.sourcePath || null,
              });
            }
          }
        }
      }
    }
  } catch {
    // Thread JSON might not exist or have images
  }
  
  return images;
}

export async function archiveThread(threadId: string): Promise<string> {
  return runAmp(['threads', 'archive', threadId]);
}

async function cleanupThreadFiles(threadId: string): Promise<void> {
  // Delete artifacts directory
  const threadArtifactsDir = join(ARTIFACTS_DIR, threadId);
  await rm(threadArtifactsDir, { recursive: true, force: true }).catch(() => {});
  
  // Delete SQLite records (metadata, blocks, artifacts)
  deleteThreadData(threadId);
}

interface DeleteResult {
  success: boolean;
  localOnly?: boolean;
  error?: string;
}

interface SecretsFile {
  apiKey?: string;
  API_KEY?: string;
  amp_api_key?: string;
}

export async function deleteThread(threadId: string): Promise<DeleteResult> {
  const secretsPath = join(AMP_HOME, '.local', 'share', 'amp', 'secrets.json');
  
  try {
    const secretsContent = await readFile(secretsPath, 'utf-8');
    const secrets: SecretsFile = JSON.parse(secretsContent);
    const apiKey = secrets.apiKey || secrets.API_KEY || secrets.amp_api_key;
    
    if (!apiKey) {
      throw new Error('No API key found');
    }
    
    // Try remote delete first (with timeout)
    const controller = new AbortController();
    const deleteTimeout = setTimeout(() => controller.abort(), 10000);
    let response: Response;
    try {
      response = await fetch(`https://ampcode.com/api/threads/${threadId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${apiKey}` },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(deleteTimeout);
    }
    
    if (!response.ok && response.status !== 404) {
      const text = await response.text();
      throw new Error(`Remote delete failed: ${text}`);
    }
    
    // Delete local file
    const threadPath = join(THREADS_DIR, `${threadId}.json`);
    await unlink(threadPath);
    
    // Cleanup all thread-related files and database records
    await cleanupThreadFiles(threadId);
    
    return { success: true };
  } catch (e) {
    const error = e as Error;
    // If remote fails, try local only
    try {
      const threadPath = join(THREADS_DIR, `${threadId}.json`);
      await unlink(threadPath);
      
      // Cleanup all thread-related files and database records
      await cleanupThreadFiles(threadId);
      
      return { success: true, localOnly: true };
    } catch {
      return { success: false, error: error.message };
    }
  }
}

interface CreateThreadResult {
  threadId: string;
  workspace: string | null;
}

export async function createThread(workspacePath: string | null = null): Promise<CreateThreadResult> {
  // Run amp threads new from the specified workspace directory
  const cwd = workspacePath || AMP_HOME;
  const stdout = await runAmp(['threads', 'new'], { cwd });
  const match = stdout.match(/T-[\w-]+/);
  if (!match) {
    throw new Error('Could not parse thread ID from output');
  }
  return { threadId: match[0], workspace: workspacePath };
}

export async function getKnownWorkspaces(): Promise<KnownWorkspace[]> {
  return getKnownWorkspacesImpl(getThreads);
}

interface HandoffResult {
  threadId: string;
}

export async function handoffThread(threadId: string, goal: string = 'Continue the previous work'): Promise<HandoffResult> {
  const stdout = await runAmp(['threads', 'handoff', threadId, '--goal', goal, '--print']);
  const stripped = stripAnsi(stdout);
  const match = stripped.match(/T-[\w-]+/);
  if (!match) {
    throw new Error('Could not parse new thread ID');
  }
  return { threadId: match[0] };
}

export async function renameThread(threadId: string, name: string): Promise<string> {
  return runAmp(['threads', 'rename', threadId, name]);
}

interface ShareResult {
  output: string;
}

export async function shareThread(threadId: string): Promise<ShareResult> {
  const stdout = await runAmp(['threads', 'share', threadId]);
  return { output: stdout.trim() };
}
