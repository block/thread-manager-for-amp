import type { IncomingMessage, ServerResponse } from 'http';
import { jsonResponse, sendError, parseBody } from '../lib/utils.js';
import { listTasks, importTasks } from '../lib/tasks.js';

interface TasksImportBody {
  source?: string;
  workspace?: string;
}

export async function handleTasksRoutes(
  url: URL,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const pathname = url.pathname;

  if (pathname === '/api/tasks') {
    try {
      const workspace = url.searchParams.get('workspace') || undefined;
      const result = await listTasks(workspace);
      return jsonResponse(res, result);
    } catch (err) {
      return sendError(res, 500, (err as Error).message);
    }
  }

  if (pathname === '/api/tasks-import') {
    if (req.method !== 'POST') {
      return sendError(res, 405, 'Method not allowed');
    }
    try {
      const body = await parseBody<TasksImportBody>(req);
      const source = body.source;
      if (!source) throw new Error('source required');
      const result = await importTasks(source, body.workspace);
      return jsonResponse(res, result);
    } catch (err) {
      const message = (err as Error).message;
      const status = message.includes('required') ? 400 : 500;
      return sendError(res, status, message);
    }
  }

  return false;
}
