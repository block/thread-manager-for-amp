import { Shield, Settings, Volume2, VolumeX } from 'lucide-react';
import { CATEGORIES } from './categories';
import type { Command, CommandFactoryContext, CommandHandlers } from './types';

export function createSettingsCommands(
  handlers: CommandHandlers,
  context: CommandFactoryContext,
): Command[] {
  const { soundEnabled, toggleSound } = context;

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
  ];
}
