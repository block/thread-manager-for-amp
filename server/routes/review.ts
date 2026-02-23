import type { IncomingMessage, ServerResponse } from 'http';
import { sendError, parseBody, handleRouteError, getParam, jsonResponse } from '../lib/utils.js';
import {
  runReview,
  streamReview,
  discoverReviewChecks,
  type ReviewOptions,
} from '../lib/review.js';

interface ReviewBody {
  workspace?: string;
  files?: string[];
  instructions?: string;
  summaryOnly?: boolean;
  stream?: boolean;
}

export async function handleReviewRoutes(
  url: URL,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  if (url.pathname === '/api/review-checks') {
    if (req.method !== 'GET') {
      return sendError(res, 405, 'Method not allowed');
    }
    try {
      const workspace = getParam(url, 'workspace');
      const checks = await discoverReviewChecks(workspace);
      return jsonResponse(res, checks);
    } catch (err) {
      const message = (err as Error).message;
      const status = message.includes('required') ? 400 : 500;
      return sendError(res, status, message);
    }
  }

  if (url.pathname !== '/api/review') return false;

  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed');
  }

  try {
    const body = await parseBody<ReviewBody>(req);
    if (!body.workspace) throw new Error('workspace required');

    const options: ReviewOptions = {
      workspace: body.workspace,
      files: body.files,
      instructions: body.instructions,
      summaryOnly: body.summaryOnly,
    };

    if (body.stream) {
      streamReview(options, res);
      return true;
    }

    const output = await runReview(options);
    // CORS headers already set by server/index.ts
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ output, success: true }));
    return true;
  } catch (err) {
    return handleRouteError(res, err);
  }
}
