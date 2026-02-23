import type { IncomingMessage, ServerResponse } from 'http';
import { jsonResponse, sendError, getParam, parseBody, handleRouteError } from '../lib/utils.js';
import {
  listSkills,
  getSkillsSummary,
  addSkill,
  removeSkill,
  getSkillInfo,
  listTools,
  getMcpStatus,
  listMcp,
  listPermissions,
  getSettingsPath,
  getAmpHelp,
  listAgentsMd,
} from '../lib/skills.js';

interface SkillAddBody {
  source?: string;
}

interface SkillRemoveBody {
  name?: string;
}

export async function handleSkillRoutes(
  url: URL,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const pathname = url.pathname;

  if (pathname === '/api/skills-list') {
    try {
      const result = await listSkills();
      return jsonResponse(res, result);
    } catch (err) {
      return handleRouteError(res, err);
    }
  }

  if (pathname === '/api/skills-summary') {
    try {
      const result = await getSkillsSummary();
      return jsonResponse(res, result);
    } catch (err) {
      return handleRouteError(res, err);
    }
  }

  if (pathname === '/api/skill-add') {
    if (req.method !== 'POST') {
      return sendError(res, 405, 'Method not allowed');
    }
    try {
      const body = await parseBody<SkillAddBody>(req);
      const source = body.source;
      if (!source) throw new Error('source required');
      const result = await addSkill(source);
      return jsonResponse(res, result);
    } catch (err) {
      return handleRouteError(res, err);
    }
  }

  if (pathname === '/api/skill-remove') {
    if (req.method !== 'DELETE') {
      return sendError(res, 405, 'Method not allowed');
    }
    try {
      const body = await parseBody<SkillRemoveBody>(req);
      const name = body.name;
      if (!name) throw new Error('name required');
      const result = await removeSkill(name);
      return jsonResponse(res, result);
    } catch (err) {
      return handleRouteError(res, err);
    }
  }

  if (pathname === '/api/skill-info') {
    try {
      const name = getParam(url, 'name');
      const result = await getSkillInfo(name);
      return jsonResponse(res, result);
    } catch (err) {
      return handleRouteError(res, err);
    }
  }

  if (pathname === '/api/tools-list') {
    try {
      const result = await listTools();
      return jsonResponse(res, result);
    } catch (err) {
      return handleRouteError(res, err);
    }
  }

  if (pathname === '/api/mcp-status') {
    try {
      const result = await getMcpStatus();
      return jsonResponse(res, result);
    } catch (err) {
      return handleRouteError(res, err);
    }
  }

  if (pathname === '/api/mcp-list') {
    try {
      const result = await listMcp();
      return jsonResponse(res, result);
    } catch (err) {
      return handleRouteError(res, err);
    }
  }

  if (pathname === '/api/permissions-list') {
    try {
      const result = await listPermissions();
      return jsonResponse(res, result);
    } catch (err) {
      return handleRouteError(res, err);
    }
  }

  if (pathname === '/api/settings-path') {
    try {
      return jsonResponse(res, { path: getSettingsPath() });
    } catch (err) {
      return handleRouteError(res, err);
    }
  }

  if (pathname === '/api/amp-help') {
    try {
      const result = await getAmpHelp();
      return jsonResponse(res, result);
    } catch (err) {
      return handleRouteError(res, err);
    }
  }

  if (pathname === '/api/agents-md-list') {
    try {
      const workspace = url.searchParams.get('workspace') ?? undefined;
      const result = await listAgentsMd(workspace);
      return jsonResponse(res, result);
    } catch (err) {
      return sendError(res, 500, (err as Error).message);
    }
  }

  return false;
}
