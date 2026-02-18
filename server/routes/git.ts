import type { ServerResponse } from 'http';
import { jsonResponse, sendError, getParam } from '../lib/utils.js';
import { getWorkspaceGitStatus, getWorkspaceGitStatusDirect, getFileDiff } from '../lib/git.js';
import { getThreadGitActivity } from '../lib/git-activity.js';

export async function handleGitRoutes(
  url: URL,
  _req: unknown,
  res: ServerResponse,
): Promise<boolean> {
  const pathname = url.pathname;

  if (pathname === '/api/thread-git-activity') {
    try {
      const threadId = getParam(url, 'threadId');
      const refresh = url.searchParams.get('refresh') === '1';
      const activity = await getThreadGitActivity(threadId, refresh);
      return jsonResponse(res, activity);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status = message.includes('required') ? 400 : 500;
      return sendError(res, status, message);
    }
  }

  if (pathname === '/api/git-status') {
    try {
      const threadId = getParam(url, 'threadId');
      const gitStatus = await getWorkspaceGitStatus(threadId);
      return jsonResponse(res, gitStatus);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status = message.includes('required') ? 400 : 500;
      return sendError(res, status, message);
    }
  }

  if (pathname === '/api/workspace-git-status') {
    try {
      const workspacePath = getParam(url, 'workspace');
      const gitStatus = await getWorkspaceGitStatusDirect(workspacePath);
      return jsonResponse(res, gitStatus);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status = message.includes('required') ? 400 : 500;
      return sendError(res, status, message);
    }
  }

  if (pathname === '/api/file-diff') {
    try {
      const filePath = getParam(url, 'path');
      const workspacePath = getParam(url, 'workspace');
      const diff = await getFileDiff(filePath, workspacePath);
      return jsonResponse(res, diff);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status = message.includes('required') ? 400 : 500;
      return sendError(res, status, message);
    }
  }

  return false;
}
