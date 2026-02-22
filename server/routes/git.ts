import type { IncomingMessage, ServerResponse } from 'http';
import {
  jsonResponse,
  getParam,
  parseBody,
  handleRouteError,
  BadRequestError,
} from '../lib/utils.js';
import {
  getWorkspaceGitStatus,
  getWorkspaceGitStatusDirect,
  getFileDiff,
  getWorkspaceGitInfo,
} from '../lib/git.js';
import { getThreadGitActivity } from '../lib/git-activity.js';

export async function handleGitRoutes(
  url: URL,
  req: IncomingMessage,
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
      return handleRouteError(res, err);
    }
  }

  if (pathname === '/api/git-status') {
    try {
      const threadId = getParam(url, 'threadId');
      const gitStatus = await getWorkspaceGitStatus(threadId);
      return jsonResponse(res, gitStatus);
    } catch (err) {
      return handleRouteError(res, err);
    }
  }

  if (pathname === '/api/workspace-git-status') {
    try {
      const workspacePath = getParam(url, 'workspace');
      const gitStatus = await getWorkspaceGitStatusDirect(workspacePath);
      return jsonResponse(res, gitStatus);
    } catch (err) {
      return handleRouteError(res, err);
    }
  }

  if (pathname === '/api/workspace-git-info') {
    try {
      if (req.method === 'POST') {
        const body = await parseBody<{
          workspace?: string;
          touchedFiles?: string[];
        }>(req);
        if (!body.workspace) throw new BadRequestError('workspace required');
        const info = await getWorkspaceGitInfo(body.workspace, body.touchedFiles);
        return jsonResponse(res, info);
      }
      const workspacePath = getParam(url, 'workspace');
      const info = await getWorkspaceGitInfo(workspacePath);
      return jsonResponse(res, info);
    } catch (err) {
      return handleRouteError(res, err);
    }
  }

  if (pathname === '/api/file-diff') {
    try {
      const filePath = getParam(url, 'path');
      const workspacePath = getParam(url, 'workspace');
      const diff = await getFileDiff(filePath, workspacePath);
      return jsonResponse(res, diff);
    } catch (err) {
      return handleRouteError(res, err);
    }
  }

  return false;
}
