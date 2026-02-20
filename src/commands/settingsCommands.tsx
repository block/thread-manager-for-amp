import { Shield, Settings, Volume2, VolumeX, Zap, Rocket, Brain } from 'lucide-react';
import { CATEGORIES } from './categories';
import type { Command, CommandFactoryContext, CommandHandlers } from './types';

export function createSettingsCommands(
  handlers: CommandHandlers,
  context: CommandFactoryContext,
): Command[] {
  const {
    soundEnabled,
    toggleSound,
    agentMode,
    onSetAgentMode,
    onToggleDeepMode,
    showThinkingBlocks,
    onToggleThinkingBlocks,
  } = context;

  return [
    {
      id: 'permissions-list',
      category: CATEGORIES.PERMISSIONS,
      label: 'list',
      icon: <Shield size={14} />,
      action: () => handlers.onShowPermissions?.(),
    },
    {
      id: 'permissions-open-user',
      category: CATEGORIES.PERMISSIONS,
      label: 'open in editor (user)',
      icon: <Shield size={14} />,
      action: () => handlers.onOpenPermissionsUser?.(),
    },
    {
      id: 'permissions-open-workspace',
      category: CATEGORIES.PERMISSIONS,
      label: 'open in editor (workspace)',
      icon: <Shield size={14} />,
      action: () => handlers.onOpenPermissionsWorkspace?.(),
    },
    {
      id: 'settings-open',
      category: CATEGORIES.SETTINGS,
      label: 'open in editor',
      icon: <Settings size={14} />,
      shortcut: 'Ctrl+,',
      action: () => handlers.onOpenSettings?.(),
    },
    {
      id: 'settings-toggle-sound',
      category: CATEGORIES.SETTINGS,
      label: soundEnabled ? 'disable notification sound' : 'enable notification sound',
      icon: soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />,
      action: toggleSound,
    },
    {
      id: 'settings-mode-smart',
      category: CATEGORIES.SETTINGS,
      label: `set mode: smart${agentMode === 'smart' ? ' (active)' : ''}`,
      icon: <Zap size={14} />,
      action: () => onSetAgentMode?.('smart'),
    },
    {
      id: 'settings-mode-rush',
      category: CATEGORIES.SETTINGS,
      label: `set mode: rush${agentMode === 'rush' ? ' (active)' : ''}`,
      icon: <Rocket size={14} />,
      action: () => onSetAgentMode?.('rush'),
    },
    {
      id: 'settings-mode-deep',
      category: CATEGORIES.SETTINGS,
      label: `set mode: deep${agentMode === 'deep' ? ' (active)' : ''}`,
      icon: <Brain size={14} />,
      action: () => onSetAgentMode?.('deep'),
    },
    {
      id: 'settings-toggle-deep',
      category: CATEGORIES.SETTINGS,
      label: agentMode === 'deep' ? 'disable deep mode' : 'enable deep mode',
      shortcut: 'Alt+D',
      icon: <Brain size={14} />,
      action: () => onToggleDeepMode?.(),
    },
    {
      id: 'settings-toggle-thinking',
      category: CATEGORIES.SETTINGS,
      label: showThinkingBlocks ? 'hide thinking blocks' : 'show thinking blocks',
      shortcut: 'Alt+T',
      icon: <Brain size={14} />,
      action: () => onToggleThinkingBlocks?.(),
    },
  ];
}
