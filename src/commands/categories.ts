export const CATEGORIES = {
  THREAD: 'thread',
  CONTEXT: 'context',
  SKILL: 'skill',
  TOOLS: 'tools',
  MCP: 'mcp',
  PERMISSIONS: 'permissions',
  SETTINGS: 'settings',
  AMP: 'amp',
  TERMINAL: 'terminal',
  VIEW: 'view',
} as const;

export type Category = (typeof CATEGORIES)[keyof typeof CATEGORIES];
