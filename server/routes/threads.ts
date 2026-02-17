import type { IncomingMessage, ServerResponse } from 'http';
import { jsonResponse, sendError, getParam, parseBody } from '../lib/utils.js';
import { CORS_HEADERS } from '../lib/constants.js';
import {
  getThreads,
  searchThreads,
  getThreadChanges,
  getThreadChain,
  getRelatedThreads,
  getThreadMarkdown,
  getThreadImages,
  archiveThread,
  deleteThread,
  createThread,
  getKnownWorkspaces,
  handoffThread,
  renameThread,
  shareThread,
} from '../lib/threads.js';

export async function handleThreadRoutes(
  url: URL,
  req: IncomingMessage,
  res: ServerResponse
): Promise<boolean> {
  const pathname = url.pathname;

  if (pathname === '/api/threads') {
    try {
      const limit = parseInt(url.searchParams.get('limit') || '50', 10);
      const cursor = url.searchParams.get('cursor') || null;
      const result = await getThreads({ limit, cursor });
      return jsonResponse(res, result);
    } catch (err) {
      return sendError(res, 500, (err as Error).message);
    }
  }

  if (pathname === '/api/search') {
    try {
      const query = getParam(url, 'q');
      const results = await searchThreads(query);
      return jsonResponse(res, results);
    } catch (err) {
      const status = (err as Error).message.includes('required') ? 400 : 500;
      return sendError(res, status, (err as Error).message);
    }
  }

  if (pathname === '/api/related-threads') {
    try {
      const threadId = getParam(url, 'threadId');
      const related = await getRelatedThreads(threadId);
      return jsonResponse(res, related);
    } catch (err) {
      const status = (err as Error).message.includes('required') ? 400 : 500;
      return sendError(res, status, (err as Error).message);
    }
  }

  if (pathname === '/api/thread-chain') {
    try {
      const threadId = getParam(url, 'threadId');
      const chain = await getThreadChain(threadId);
      return jsonResponse(res, chain);
    } catch (err) {
      const status = (err as Error).message.includes('required') ? 400 : 500;
      return sendError(res, status, (err as Error).message);
    }
  }

  if (pathname === '/api/thread-changes') {
    try {
      const threadId = getParam(url, 'threadId');
      const changes = await getThreadChanges(threadId);
      return jsonResponse(res, changes);
    } catch (err) {
      const status = (err as Error).message.includes('required') ? 400 : 500;
      return sendError(res, status, (err as Error).message);
    }
  }

  if (pathname === '/api/thread-history') {
    try {
      const threadId = getParam(url, 'threadId');
      const limit = parseInt(url.searchParams.get('limit') || '50', 10);
      const offset = parseInt(url.searchParams.get('offset') || '0', 10);
      const history = await getThreadMarkdown(threadId, limit, offset);
      res.writeHead(200, { ...CORS_HEADERS, 'Content-Type': 'text/plain' });
      res.end(history);
    } catch (err) {
      const status = (err as Error).message.includes('required') ? 400 : 500;
      return sendError(res, status, (err as Error).message);
    }
    return true;
  }

  if (pathname === '/api/thread-images') {
    try {
      const threadId = getParam(url, 'threadId');
      const images = await getThreadImages(threadId);
      return jsonResponse(res, images);
    } catch (err) {
      const status = (err as Error).message.includes('required') ? 400 : 500;
      return sendError(res, status, (err as Error).message);
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
      const status = (err as Error).message.includes('required') ? 400 : 500;
      return sendError(res, status, (err as Error).message);
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
      const status = (err as Error).message.includes('required') ? 400 : 500;
      return sendError(res, status, (err as Error).message);
    }
  }

  if (pathname === '/api/thread-new') {
    if (req.method !== 'POST') {
      return sendError(res, 405, 'Method not allowed');
    }
    try {
      const body = await parseBody<{ workspace?: string }>(req);
      const workspacePath = body.workspace || null;
      const result = await createThread(workspacePath);
      return jsonResponse(res, result);
    } catch (err) {
      return sendError(res, 500, (err as Error).message);
    }
  }

  if (pathname === '/api/workspaces') {
    try {
      const workspaces = await getKnownWorkspaces();
      return jsonResponse(res, workspaces);
    } catch (err) {
      return sendError(res, 500, (err as Error).message);
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
      const status = (err as Error).message.includes('required') ? 400 : 500;
      return sendError(res, status, (err as Error).message);
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
      const status = (err as Error).message.includes('required') ? 400 : 500;
      return sendError(res, status, (err as Error).message);
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
      const status = (err as Error).message.includes('required') ? 400 : 500;
      return sendError(res, status, (err as Error).message);
    }
  }

  return false;
}
