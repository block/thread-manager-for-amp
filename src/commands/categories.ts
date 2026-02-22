export const CATEGORIES = {
  THREAD: 'thread',
  CONTEXT: 'context',
  SKILL: 'skill',
  TOOLS: 'tools',
  MCP: 'mcp',
  TOOLBOX: 'toolbox',
  PERMISSIONS: 'permissions',
  IDE: 'ide',
  SETTINGS: 'settings',
  AMP: 'amp',
  TERMINAL: 'terminal',
  VIEW: 'view',
} as const;

export type Category = (typeof CATEGORIES)[keyof typeof CATEGORIES];
