import type { IncomingMessage, ServerResponse } from 'http';
import { jsonResponse, sendError, handleRouteError, getParam, parseBody } from '../lib/utils.js';
import {
  getThreads,
  searchThreads,
  getThreadChanges,
  getThreadChain,
  getRelatedThreads,
  getThreadMarkdown,
  getThreadImages,
  getThreadMessages,
  archiveThread,
  deleteThread,
  createThread,
  getKnownWorkspaces,
  handoffThread,
  renameThread,
  shareThread,
  listWorkspaceFiles,
} from '../lib/threads.js';
import { truncateThreadAtMessage, undoLastTurn } from '../lib/threadCrud.js';
import { getPromptHistory, addPromptToHistory } from '../lib/promptHistory.js';
import { analyzeContext } from '../lib/contextAnalyze.js';

export async function handleThreadRoutes(
  url: URL,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const pathname = url.pathname;

  if (pathname === '/api/threads') {
    try {
      const limit = parseInt(url.searchParams.get('limit') || '50', 10);
      const cursor = url.searchParams.get('cursor') || null;
      const result = await getThreads({ limit, cursor });
      return jsonResponse(res, result);
    } catch (err) {
      return handleRouteError(res, err);
    }
  }

  if (pathname === '/api/search') {
    try {
      const query = getParam(url, 'q');
      const results = await searchThreads(query);
      return jsonResponse(res, results);
    } catch (err) {
      return handleRouteError(res, err);
    }
  }

  if (pathname === '/api/related-threads') {
    try {
      const threadId = getParam(url, 'threadId');
      const related = await getRelatedThreads(threadId);
      return jsonResponse(res, related);
    } catch (err) {
      return handleRouteError(res, err);
    }
  }

  if (pathname === '/api/thread-chain') {
    try {
      const threadId = getParam(url, 'threadId');
      const chain = await getThreadChain(threadId);
      return jsonResponse(res, chain);
    } catch (err) {
      return handleRouteError(res, err);
    }
  }

  if (pathname === '/api/thread-changes') {
    try {
      const threadId = getParam(url, 'threadId');
      const changes = await getThreadChanges(threadId);
      return jsonResponse(res, changes);
    } catch (err) {
      return handleRouteError(res, err);
    }
  }

  if (pathname === '/api/thread-history') {
    try {
      const threadId = getParam(url, 'threadId');
      const limit = parseInt(url.searchParams.get('limit') || '50', 10);
      const offset = parseInt(url.searchParams.get('offset') || '0', 10);
      const history = await getThreadMarkdown(threadId, limit, offset);
      // CORS headers are already set by the top-level handler in index.ts
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(history);
    } catch (err) {
      return handleRouteError(res, err);
    }
    return true;
  }

  if (pathname === '/api/thread-images') {
    try {
      const threadId = getParam(url, 'threadId');
      const images = await getThreadImages(threadId);
      return jsonResponse(res, images);
    } catch (err) {
      return handleRouteError(res, err);
    }
  }

  if (pathname === '/api/thread-archive') {
    if (req.method !== 'POST') {
      return sendError(res, 405, 'Method not allowed');
    }
    try {
      const body = await parseBody<{ threadId?: string }>(req);
      const threadId = body.threadId;
      if (!threadId) throw new Error('threadId required');
      await archiveThread(threadId);
      return jsonResponse(res, { success: true });
    } catch (err) {
      return handleRouteError(res, err);
    }
  }

  if (pathname === '/api/thread-delete') {
    if (req.method !== 'DELETE') {
      return sendError(res, 405, 'Method not allowed');
    }
    try {
      const body = await parseBody<{ threadId?: string }>(req);
      const threadId = body.threadId;
      if (!threadId) throw new Error('threadId required');
      const result = await deleteThread(threadId);
      return jsonResponse(res, result);
    } catch (err) {
      return handleRouteError(res, err);
    }
  }

  if (pathname === '/api/thread-new') {
    if (req.method !== 'POST') {
      return sendError(res, 405, 'Method not allowed');
    }
    try {
      const body = await parseBody<{ workspace?: string; mode?: string }>(req);
      const workspacePath = body.workspace || null;
      const result = await createThread(workspacePath, body.mode);
      return jsonResponse(res, result);
    } catch (err) {
      return handleRouteError(res, err);
    }
  }

  if (pathname === '/api/files') {
    try {
      const workspace = getParam(url, 'workspace');
      const query = url.searchParams.get('q') || '';
      const files = await listWorkspaceFiles(workspace, query);
      return jsonResponse(res, files);
    } catch (err) {
      return handleRouteError(res, err);
    }
  }

  if (pathname === '/api/workspaces') {
    try {
      const workspaces = await getKnownWorkspaces();
      return jsonResponse(res, workspaces);
    } catch (err) {
      return handleRouteError(res, err);
    }
  }

  if (pathname === '/api/thread-handoff') {
    if (req.method !== 'POST') {
      return sendError(res, 405, 'Method not allowed');
    }
    try {
      const body = await parseBody<{ threadId?: string; goal?: string }>(req);
      const threadId = body.threadId;
      if (!threadId) throw new Error('threadId required');
      const goal = body.goal || undefined;
      const result = await handoffThread(threadId, goal);
      return jsonResponse(res, result);
    } catch (err) {
      return handleRouteError(res, err);
    }
  }

  if (pathname === '/api/thread-rename') {
    if (req.method !== 'PATCH') {
      return sendError(res, 405, 'Method not allowed');
    }
    try {
      const body = await parseBody<{ threadId?: string; name?: string }>(req);
      const threadId = body.threadId;
      const name = body.name;
      if (!threadId) throw new Error('threadId required');
      if (!name) throw new Error('name required');
      await renameThread(threadId, name);
      return jsonResponse(res, { success: true });
    } catch (err) {
      return handleRouteError(res, err);
    }
  }

  if (pathname === '/api/thread-messages') {
    try {
      const threadId = getParam(url, 'threadId');
      const result = await getThreadMessages(threadId);
      return jsonResponse(res, result);
    } catch (err) {
      return handleRouteError(res, err);
    }
  }

  if (pathname === '/api/thread-share') {
    if (req.method !== 'POST') {
      return sendError(res, 405, 'Method not allowed');
    }
    try {
      const body = await parseBody<{ threadId?: string }>(req);
      const threadId = body.threadId;
      if (!threadId) throw new Error('threadId required');
      const result = await shareThread(threadId);
      return jsonResponse(res, result);
    } catch (err) {
      return handleRouteError(res, err);
    }
  }

  if (pathname === '/api/thread-edit') {
    if (req.method !== 'POST') {
      return sendError(res, 405, 'Method not allowed');
    }
    try {
      const body = await parseBody<{
        threadId?: string;
        messageIndex?: number;
      }>(req);
      if (!body.threadId) throw new Error('threadId required');
      if (body.messageIndex === undefined) {
        throw new Error('messageIndex required');
      }
      const result = await truncateThreadAtMessage(body.threadId, body.messageIndex);
      return jsonResponse(res, { success: true, ...result });
    } catch (err) {
      return handleRouteError(res, err);
    }
  }

  if (pathname === '/api/thread-undo') {
    if (req.method !== 'POST') {
      return sendError(res, 405, 'Method not allowed');
    }
    try {
      const body = await parseBody<{ threadId?: string }>(req);
      if (!body.threadId) throw new Error('threadId required');
      const result = await undoLastTurn(body.threadId);
      return jsonResponse(res, { success: true, ...result });
    } catch (err) {
      return handleRouteError(res, err);
    }
  }

  if (pathname === '/api/context-analyze') {
    try {
      const threadId = getParam(url, 'threadId');
      const result = await analyzeContext(threadId);
      return jsonResponse(res, result);
    } catch (err) {
      return handleRouteError(res, err);
    }
  }

  if (pathname === '/api/prompt-history') {
    try {
      const query = url.searchParams.get('q') || '';
      const limit = parseInt(url.searchParams.get('limit') || '50', 10);
      const results = await getPromptHistory(query, limit);
      return jsonResponse(res, results);
    } catch (err) {
      return handleRouteError(res, err);
    }
  }

  if (pathname === '/api/prompt-record') {
    if (req.method !== 'POST') {
      return sendError(res, 405, 'Method not allowed');
    }
    try {
      const body = await parseBody<{ text?: string; threadId?: string }>(req);
      if (!body.text) throw new Error('text required');
      if (!body.threadId) throw new Error('threadId required');
      addPromptToHistory(body.text, body.threadId);
      return jsonResponse(res, { success: true });
    } catch (err) {
      return handleRouteError(res, err);
    }
  }

  return false;
}
