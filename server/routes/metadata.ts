import type { IncomingMessage, ServerResponse } from 'http';
import { jsonResponse, parseBody } from '../lib/utils.js';
import {
  getThreadMetadata,
  getAllThreadMetadata,
  updateThreadStatus,
  addThreadBlock,
  removeThreadBlock,
  updateLinkedIssue,
} from '../lib/database.js';
import { callAmpInternalAPI } from '../lib/amp-api.js';
import { getRunningThreads } from '../websocket.js';
import type { ThreadStatus } from '../../shared/types.js';

interface ThreadLabelsBody {
  threadId: string;
  labels: string[];
}

interface ThreadStatusBody {
  threadId: string;
  status?: ThreadStatus;
  goal?: string;
}

interface ThreadBlockBody {
  threadId: string;
  blockedByThreadId: string;
  reason?: string;
}

interface LinkedIssueBody {
  threadId: string;
  url?: string | null;
}

export async function handleMetadataRoutes(
  url: URL,
  req: IncomingMessage,
  res: ServerResponse
): Promise<boolean> {
  // GET /api/running-threads - Get threads with active WebSocket connections
  if (url.pathname === '/api/running-threads' && req.method === 'GET') {
    const running = getRunningThreads();
    return jsonResponse(res, running);
  }
  // GET /api/thread-labels-batch?threadIds=id1,id2,... - Get Amp labels for multiple threads
  if (url.pathname === '/api/thread-labels-batch' && req.method === 'GET') {
    const threadIdsParam = url.searchParams.get('threadIds');
    if (!threadIdsParam) {
      return jsonResponse(res, { error: 'threadIds required' }, 400);
    }

    const threadIds = threadIdsParam.split(',').map(id => decodeURIComponent(id)).filter(Boolean);
    if (threadIds.length === 0) {
      return jsonResponse(res, {});
    }

    // Cap at 100 to prevent abuse
    const capped = threadIds.slice(0, 100);
    const results: Record<string, { name: string }[]> = {};

    // Fetch all in parallel server-side (single HTTP call from client)
    const settled = await Promise.allSettled(
      capped.map(async (threadId) => {
        try {
          const labels = await callAmpInternalAPI<{ name: string }[]>('getThreadLabels', { thread: threadId });
          return { threadId, labels };
        } catch (err) {
          const error = err as Error;
          if (error.message?.includes('Permission denied')) { // eslint-disable-line @typescript-eslint/no-unnecessary-condition -- runtime guard
            return { threadId, labels: [] as { name: string }[] };
          }
          throw err;
        }
      })
    );

    for (const result of settled) {
      if (result.status === 'fulfilled') {
        results[result.value.threadId] = result.value.labels;
      }
      // Silently skip rejected — individual thread failures shouldn't break the batch
    }

    return jsonResponse(res, results);
  }

  // GET /api/thread-labels?threadId=xxx - Get Amp labels for a thread
  if (url.pathname === '/api/thread-labels' && req.method === 'GET') {
    const threadId = url.searchParams.get('threadId');
    if (!threadId) {
      return jsonResponse(res, { error: 'threadId required' }, 400);
    }
    
    try {
      const result = await callAmpInternalAPI('getThreadLabels', { thread: threadId });
      return jsonResponse(res, result);
    } catch (err) {
      const error = err as Error;
      // Silently return empty for permission errors - API may not be available
      if (error.message?.includes('Permission denied')) { // eslint-disable-line @typescript-eslint/no-unnecessary-condition -- runtime guard
        return jsonResponse(res, []);
      }
      console.error('Failed to get thread labels:', error);
      return jsonResponse(res, { error: error.message, labels: [] }, 500);
    }
  }

  // PUT /api/thread-labels - Set Amp labels for a thread
  if (url.pathname === '/api/thread-labels' && req.method === 'PUT') {
    const body = await parseBody<ThreadLabelsBody>(req);
    const { threadId, labels } = body;
    
    if (!threadId) {
      return jsonResponse(res, { error: 'threadId required' }, 400);
    }
    if (!Array.isArray(labels)) {
      return jsonResponse(res, { error: 'labels must be an array' }, 400);
    }
    
    try {
      const result = await callAmpInternalAPI('setThreadLabels', { thread: threadId, labels });
      return jsonResponse(res, result);
    } catch (err) {
      const error = err as Error;
      if (error.message?.includes('Permission denied')) { // eslint-disable-line @typescript-eslint/no-unnecessary-condition -- runtime guard
        return jsonResponse(res, { error: 'Labels API not available' }, 403);
      }
      console.error('Failed to set thread labels:', error);
      return jsonResponse(res, { error: error.message }, 500);
    }
  }

  // GET /api/user-labels - Get all labels the user has created
  if (url.pathname === '/api/user-labels' && req.method === 'GET') {
    const query = url.searchParams.get('query') || '';
    
    try {
      const result = await callAmpInternalAPI('getUserLabels', { query });
      return jsonResponse(res, result);
    } catch (err) {
      const error = err as Error;
      if (error.message?.includes('Permission denied')) { // eslint-disable-line @typescript-eslint/no-unnecessary-condition -- runtime guard
        return jsonResponse(res, []);
      }
      console.error('Failed to get user labels:', error);
      return jsonResponse(res, { error: error.message, labels: [] }, 500);
    }
  }
  // GET /api/thread-status - Get our custom metadata (status, goal, blockers)
  if (url.pathname === '/api/thread-status' && req.method === 'GET') {
    const threadId = url.searchParams.get('threadId');
    
    if (threadId) {
      const metadata = getThreadMetadata(threadId);
      return jsonResponse(res, metadata);
    } else {
      // Return all metadata as a map
      const allMetadata = getAllThreadMetadata();
      return jsonResponse(res, allMetadata);
    }
  }

  // PATCH /api/thread-status - Update status or goal
  if (url.pathname === '/api/thread-status' && req.method === 'PATCH') {
    const body = await parseBody<ThreadStatusBody>(req);
    const { threadId, status } = body;
    
    if (!threadId) {
      return jsonResponse(res, { error: 'threadId required' }, 400);
    }
    
    let result;
    if (status !== undefined) {
      result = updateThreadStatus(threadId, status);
    }
    
    return jsonResponse(res, result || getThreadMetadata(threadId));
  }

  // POST /api/thread-block - Add a blocker
  if (url.pathname === '/api/thread-block' && req.method === 'POST') {
    const body = await parseBody<ThreadBlockBody>(req);
    const { threadId, blockedByThreadId, reason } = body;
    
    if (!threadId || !blockedByThreadId) {
      return jsonResponse(res, { error: 'threadId and blockedByThreadId required' }, 400);
    }
    
    const result = addThreadBlock(threadId, blockedByThreadId, reason ?? null);
    return jsonResponse(res, result);
  }

  // DELETE /api/thread-block - Remove a blocker
  if (url.pathname === '/api/thread-block' && req.method === 'DELETE') {
    const body = await parseBody<ThreadBlockBody>(req);
    const { threadId, blockedByThreadId } = body;
    
    if (!threadId || !blockedByThreadId) {
      return jsonResponse(res, { error: 'threadId and blockedByThreadId required' }, 400);
    }
    
    const result = removeThreadBlock(threadId, blockedByThreadId);
    return jsonResponse(res, result);
  }

  // PATCH /api/thread-linked-issue - Update linked issue URL
  if (url.pathname === '/api/thread-linked-issue' && req.method === 'PATCH') {
    const body = await parseBody<LinkedIssueBody>(req);
    const { threadId, url: issueUrl } = body;
    
    if (!threadId) {
      return jsonResponse(res, { error: 'threadId required' }, 400);
    }
    
    const result = updateLinkedIssue(threadId, issueUrl ?? null);
    return jsonResponse(res, result);
  }

  return false;
}
