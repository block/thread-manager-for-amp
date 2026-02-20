import {
  List,
  Plus,
  Trash2,
  Wrench,
  Eye,
  Box,
  Plug,
  TerminalSquare,
  ClipboardList,
  Import,
  FileSearch,
} from 'lucide-react';
import { CATEGORIES } from './categories';
import type { Command, CommandFactoryContext, CommandHandlers } from './types';

export function createToolsCommands(
  handlers: CommandHandlers,
  context: CommandFactoryContext,
): Command[] {
  const { hasActiveThread } = context;

  return [
    {
      id: 'skill-list',
      category: CATEGORIES.SKILL,
      label: 'list',
      icon: <List size={14} />,
      action: () => handlers.onShowSkills?.(),
    },
    {
      id: 'skill-add',
      category: CATEGORIES.SKILL,
      label: 'add',
      icon: <Plus size={14} />,
      action: () => handlers.onSkillAdd?.(),
    },
    {
      id: 'skill-remove',
      category: CATEGORIES.SKILL,
      label: 'remove',
      icon: <Trash2 size={14} />,
      action: () => handlers.onSkillRemove?.(),
    },
    {
      id: 'skill-invoke',
      category: CATEGORIES.SKILL,
      label: 'invoke',
      icon: <Wrench size={14} />,
      action: () => handlers.onSkillInvoke?.(),
      disabled: !hasActiveThread,
    },
    {
      id: 'tools-list',
      category: CATEGORIES.TOOLS,
      label: 'list',
      icon: <Wrench size={14} />,
      action: () => handlers.onShowTools?.(),
    },
    {
      id: 'mcp-status',
      category: CATEGORIES.MCP,
      label: 'status',
      icon: <Eye size={14} />,
      action: () => handlers.onShowMcpStatus?.(),
    },
    {
      id: 'mcp-list',
      category: CATEGORIES.MCP,
      label: 'list servers',
      icon: <List size={14} />,
      action: () => handlers.onShowMcpList?.(),
    },
    {
      id: 'toolbox-list',
      category: CATEGORIES.TOOLBOX,
      label: 'list',
      icon: <Box size={14} />,
      action: () => handlers.onShowToolbox?.(),
    },
    {
      id: 'ide-connect',
      category: CATEGORIES.IDE,
      label: 'connect',
      icon: <Plug size={14} />,
      action: () => handlers.onIdeConnect?.(),
    },
    {
      id: 'shell-terminal',
      category: CATEGORIES.TOOLS,
      label: 'terminal',
      icon: <TerminalSquare size={14} />,
      shortcut: '⌃T',
      action: () => handlers.onOpenShellTerminal?.(),
    },
    {
      id: 'tasks-list',
      category: CATEGORIES.TASKS,
      label: 'list',
      icon: <ClipboardList size={14} />,
      action: () => handlers.onShowTasks?.(),
    },
    {
      id: 'tasks-import',
      category: CATEGORIES.TASKS,
      label: 'import',
      icon: <Import size={14} />,
      action: () => handlers.onImportTasks?.(),
    },
    {
      id: 'tools-code-review',
      category: CATEGORIES.TOOLS,
      label: 'code review',
      icon: <FileSearch size={14} />,
      action: () => handlers.onCodeReview?.(),
    },
  ];
}
