import {
  List,
  Plus,
  Trash2,
  Wrench,
  Eye,
  TerminalSquare,
  FileSearch,
  CheckCircle,
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
      id: 'skill-info',
      category: CATEGORIES.SKILL,
      label: 'info',
      icon: <Wrench size={14} />,
      action: () => handlers.onSkillInfo?.(),
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
      id: 'mcp-add',
      category: CATEGORIES.MCP,
      label: 'add server',
      icon: <Plus size={14} />,
      action: () => handlers.onMcpAdd?.(),
    },
    {
      id: 'mcp-approve',
      category: CATEGORIES.MCP,
      label: 'approve server',
      icon: <CheckCircle size={14} />,
      action: () => handlers.onMcpApprove?.(),
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
      id: 'tools-code-review',
      category: CATEGORIES.TOOLS,
      label: 'code review',
      icon: <FileSearch size={14} />,
      action: () => handlers.onCodeReview?.(),
    },
  ];
}
