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
  addMcp,
  approveMcp,
  listPermissions,
  testPermission,
  getSettingsPath,
  getAmpHelp,
  listAgentsMd,
  getUsage,
  getAmpVersion,
  getCustomThemes,
} from '../lib/skills.js';

interface SkillAddBody {
  source?: string;
}

interface SkillRemoveBody {
  name?: string;
}

interface McpAddBody {
  name?: string;
  source?: string;
}

interface McpApproveBody {
  name?: string;
}

interface PermissionsTestBody {
  tool?: string;
  cmd?: string;
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

  if (pathname === '/api/mcp-add') {
    if (req.method !== 'POST') {
      return sendError(res, 405, 'Method not allowed');
    }
    try {
      const body = await parseBody<McpAddBody>(req);
      const { name, source } = body;
      if (!name) throw new Error('name required');
      if (!source) throw new Error('source required');
      const result = await addMcp(name, source);
      return jsonResponse(res, result);
    } catch (err) {
      const message = (err as Error).message;
      const status = message.includes('required') ? 400 : 500;
      return sendError(res, status, message);
    }
  }

  if (pathname === '/api/mcp-approve') {
    if (req.method !== 'POST') {
      return sendError(res, 405, 'Method not allowed');
    }
    try {
      const body = await parseBody<McpApproveBody>(req);
      const { name } = body;
      if (!name) throw new Error('name required');
      const result = await approveMcp(name);
      return jsonResponse(res, result);
    } catch (err) {
      const message = (err as Error).message;
      const status = message.includes('required') ? 400 : 500;
      return sendError(res, status, message);
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

  if (pathname === '/api/permissions-test') {
    if (req.method !== 'POST') {
      return sendError(res, 405, 'Method not allowed');
    }
    try {
      const body = await parseBody<PermissionsTestBody>(req);
      const { tool, cmd } = body;
      if (!tool) throw new Error('tool required');
      if (!cmd) throw new Error('cmd required');
      const result = await testPermission(tool, cmd);
      return jsonResponse(res, result);
    } catch (err) {
      const message = (err as Error).message;
      const status = message.includes('required') ? 400 : 500;
      return sendError(res, status, message);
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

  if (pathname === '/api/amp-usage') {
    try {
      const result = await getUsage();
      return jsonResponse(res, result);
    } catch (err) {
      return sendError(res, 500, (err as Error).message);
    }
  }

  if (pathname === '/api/amp-version') {
    try {
      const result = await getAmpVersion();
      return jsonResponse(res, result);
    } catch (err) {
      return sendError(res, 500, (err as Error).message);
    }
  }

  if (pathname === '/api/custom-themes') {
    try {
      const themes = await getCustomThemes();
      return jsonResponse(res, themes);
    } catch (err) {
      return sendError(res, 500, (err as Error).message);
    }
  }

  return false;
}
