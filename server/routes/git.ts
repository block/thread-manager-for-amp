import type { ServerResponse } from 'http';
import { sendJson, sendError, getParam } from '../lib/utils.js';
import { getWorkspaceGitStatus, getWorkspaceGitStatusDirect, getFileDiff } from '../lib/git.js';
import { getThreadGitActivity } from '../lib/git-activity.js';

export async function handleGitRoutes(url: URL, _req: unknown, res: ServerResponse): Promise<boolean> {
  const pathname = url.pathname;

  if (pathname === '/api/thread-git-activity') {
    try {
      const threadId = getParam(url, 'threadId');
      const refresh = url.searchParams.get('refresh') === '1';
      const activity = await getThreadGitActivity(threadId, refresh);
      sendJson(res, 200, activity);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status = message.includes('required') ? 400 : 500;
      sendError(res, status, message);
    }
    return true;
  }

  if (pathname === '/api/git-status') {
    try {
      const threadId = getParam(url, 'threadId');
      const gitStatus = await getWorkspaceGitStatus(threadId);
      sendJson(res, 200, gitStatus);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status = message.includes('required') ? 400 : 500;
      sendError(res, status, message);
    }
    return true;
  }

  if (pathname === '/api/workspace-git-status') {
    try {
      const workspacePath = getParam(url, 'workspace');
      const gitStatus = await getWorkspaceGitStatusDirect(workspacePath);
      sendJson(res, 200, gitStatus);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status = message.includes('required') ? 400 : 500;
      sendError(res, status, message);
    }
    return true;
  }

  if (pathname === '/api/file-diff') {
    try {
      const filePath = getParam(url, 'path');
      const workspacePath = getParam(url, 'workspace');
      const diff = await getFileDiff(filePath, workspacePath);
      sendJson(res, 200, diff);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status = message.includes('required') ? 400 : 500;
      sendError(res, status, message);
    }
    return true;
  }

  return false;
}
