import { Shield, Volume2, VolumeX, Zap, Rocket, Brain, Maximize, FileText } from 'lucide-react';
import { CATEGORIES } from './categories';
import { DEEP_EFFORT_LABELS } from '../../shared/websocket.js';
import type { Command, CommandFactoryContext, CommandHandlers } from './types';

export function createSettingsCommands(
  handlers: CommandHandlers,
  context: CommandFactoryContext,
): Command[] {
  const {
    soundEnabled,
    toggleSound,
    agentMode,
    deepReasoningEffort,
    onSetAgentMode,
    onToggleDeepMode,
    activeThreadModeLocked,
    showThinkingBlocks,
    onToggleThinkingBlocks,
  } = context;

  const deepLabel = DEEP_EFFORT_LABELS[deepReasoningEffort];

  const modeLocked = activeThreadModeLocked;

  return [
    {
      id: 'permissions-list',
      category: CATEGORIES.PERMISSIONS,
      label: 'list',
      icon: <Shield size={14} />,
      action: () => handlers.onShowPermissions?.(),
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
      label: `set mode: smart${agentMode === 'smart' ? ' (active)' : ''}${modeLocked ? ' (locked)' : ''}`,
      icon: <Zap size={14} />,
      action: () => onSetAgentMode?.('smart'),
      disabled: modeLocked,
    },
    {
      id: 'settings-mode-rush',
      category: CATEGORIES.SETTINGS,
      label: `set mode: rush${agentMode === 'rush' ? ' (active)' : ''}${modeLocked ? ' (locked)' : ''}`,
      icon: <Rocket size={14} />,
      action: () => onSetAgentMode?.('rush'),
      disabled: modeLocked,
    },
    {
      id: 'settings-mode-deep',
      category: CATEGORIES.SETTINGS,
      label: `set mode: deep${agentMode === 'deep' ? ` (${deepLabel})` : ''}${modeLocked ? ' (locked)' : ''}`,
      icon: <Brain size={14} />,
      action: () => onSetAgentMode?.('deep'),
      disabled: modeLocked,
    },
    {
      id: 'settings-mode-large',
      category: CATEGORIES.SETTINGS,
      label: `set mode: large${agentMode === 'large' ? ' (active)' : ''}${modeLocked ? ' (locked)' : ''}`,
      icon: <Maximize size={14} />,
      action: () => onSetAgentMode?.('large'),
      disabled: modeLocked,
    },
    {
      id: 'settings-toggle-deep',
      category: CATEGORIES.SETTINGS,
      label:
        agentMode === 'deep'
          ? `cycle deep mode (${deepLabel} → ${deepLabel === 'deep³' ? 'smart' : 'next'})`
          : 'enable deep mode',
      shortcut: 'Alt+D',
      icon: <Brain size={14} />,
      action: () => onToggleDeepMode?.(),
      disabled: modeLocked,
    },
    {
      id: 'settings-toggle-thinking',
      category: CATEGORIES.SETTINGS,
      label: showThinkingBlocks ? 'hide thinking blocks' : 'show thinking blocks',
      shortcut: 'Alt+T',
      icon: <Brain size={14} />,
      action: () => onToggleThinkingBlocks?.(),
    },
    {
      id: 'agents-md-list',
      category: CATEGORIES.AMP,
      label: 'agents-md: list',
      icon: <FileText size={14} />,
      action: () => handlers.onShowAgentsMdList?.(),
    },
  ];
}
