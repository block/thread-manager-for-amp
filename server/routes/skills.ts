import type { IncomingMessage, ServerResponse } from 'http';
import { sendJson, sendError, getParam, parseBody } from '../lib/utils.js';
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
} from '../lib/skills.js';

interface SkillAddBody {
  source?: string;
}

interface SkillRemoveBody {
  name?: string;
}

export async function handleSkillRoutes(url: URL, req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const pathname = url.pathname;

  if (pathname === '/api/skills-list') {
    try {
      const result = await listSkills();
      sendJson(res, 200, result);
    } catch (err) {
      sendError(res, 500, (err as Error).message);
    }
    return true;
  }

  if (pathname === '/api/skills-summary') {
    try {
      const result = await getSkillsSummary();
      sendJson(res, 200, result);
    } catch (err) {
      sendError(res, 500, (err as Error).message);
    }
    return true;
  }

  if (pathname === '/api/skill-add') {
    if (req.method !== 'POST') {
      sendError(res, 405, 'Method not allowed');
      return true;
    }
    try {
      const body = await parseBody<SkillAddBody>(req);
      const source = body.source;
      if (!source) throw new Error('source required');
      const result = await addSkill(source);
      sendJson(res, 200, result);
    } catch (err) {
      const message = (err as Error).message;
      const status = message.includes('required') ? 400 : 500;
      sendError(res, status, message);
    }
    return true;
  }

  if (pathname === '/api/skill-remove') {
    if (req.method !== 'DELETE') {
      sendError(res, 405, 'Method not allowed');
      return true;
    }
    try {
      const body = await parseBody<SkillRemoveBody>(req);
      const name = body.name;
      if (!name) throw new Error('name required');
      const result = await removeSkill(name);
      sendJson(res, 200, result);
    } catch (err) {
      const message = (err as Error).message;
      const status = message.includes('required') ? 400 : 500;
      sendError(res, status, message);
    }
    return true;
  }

  if (pathname === '/api/skill-info') {
    try {
      const name = getParam(url, 'name');
      const result = await getSkillInfo(name);
      sendJson(res, 200, result);
    } catch (err) {
      const message = (err as Error).message;
      const status = message.includes('required') ? 400 : 500;
      sendError(res, status, message);
    }
    return true;
  }

  if (pathname === '/api/tools-list') {
    try {
      const result = await listTools();
      sendJson(res, 200, result);
    } catch (err) {
      sendError(res, 500, (err as Error).message);
    }
    return true;
  }

  if (pathname === '/api/mcp-status') {
    try {
      const result = await getMcpStatus();
      sendJson(res, 200, result);
    } catch (err) {
      sendError(res, 500, (err as Error).message);
    }
    return true;
  }

  if (pathname === '/api/mcp-list') {
    try {
      const result = await listMcp();
      sendJson(res, 200, result);
    } catch (err) {
      sendError(res, 500, (err as Error).message);
    }
    return true;
  }

  if (pathname === '/api/permissions-list') {
    try {
      const result = await listPermissions();
      sendJson(res, 200, result);
    } catch (err) {
      sendError(res, 500, (err as Error).message);
    }
    return true;
  }

  if (pathname === '/api/settings-path') {
    try {
      sendJson(res, 200, { path: getSettingsPath() });
    } catch (err) {
      sendError(res, 500, (err as Error).message);
    }
    return true;
  }

  if (pathname === '/api/amp-help') {
    try {
      const result = await getAmpHelp();
      sendJson(res, 200, result);
    } catch (err) {
      sendError(res, 500, (err as Error).message);
    }
    return true;
  }

  return false;
}
