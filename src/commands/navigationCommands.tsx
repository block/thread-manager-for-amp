import { X, LayoutGrid, PanelLeft, RefreshCw, HelpCircle } from 'lucide-react';
import { CATEGORIES } from './categories';
import type { Command, CommandFactoryContext, CommandHandlers } from './types';

export function createNavigationCommands(
  handlers: CommandHandlers,
  context: CommandFactoryContext,
): Command[] {
  const { activeThreadId, hasActiveThread, openThreadsCount } = context;

  return [
    {
      id: 'terminal-close',
      category: CATEGORIES.TERMINAL,
      label: 'close current',
      icon: <X size={14} />,
      shortcut: 'Ctrl+W',
      action: () => activeThreadId && handlers.onCloseThread?.(activeThreadId),
      disabled: !hasActiveThread,
    },
    {
      id: 'terminal-close-all',
      category: CATEGORIES.TERMINAL,
      label: 'close all',
      icon: <X size={14} />,
      shortcut: '⌘⇧W',
      action: handlers.onCloseAllTerminals,
      disabled: openThreadsCount === 0,
    },
    {
      id: 'terminal-toggle-layout',
      category: CATEGORIES.TERMINAL,
      label: 'toggle layout',
      icon: <LayoutGrid size={14} />,
      shortcut: 'Alt+L',
      action: () => handlers.onToggleLayout?.(),
      disabled: openThreadsCount < 2,
    },
    {
      id: 'view-toggle-sidebar',
      category: CATEGORIES.VIEW,
      label: 'toggle sidebar',
      icon: <PanelLeft size={14} />,
      shortcut: 'Ctrl+B',
      action: () => handlers.onToggleSidebar?.(),
    },
    {
      id: 'amp-help',
      category: CATEGORIES.AMP,
      label: 'help',
      icon: <HelpCircle size={14} />,
      action: () => handlers.onShowHelp?.(),
    },
    {
      id: 'amp-refresh',
      category: CATEGORIES.AMP,
      label: 'refresh thread list',
      icon: <RefreshCw size={14} />,
      shortcut: 'Ctrl+R',
      action: handlers.onRefresh,
    },
  ];
}
