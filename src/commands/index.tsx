import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { isSoundEnabled, setSoundEnabled } from '../utils/sounds';
import { createThreadCommands } from './threadCommands.js';
import { createNavigationCommands } from './navigationCommands.js';
import { createToolsCommands } from './toolsCommands.js';
import { createSettingsCommands } from './settingsCommands.js';
import type { Command, UseCommandsOptions, CommandHandlers, CommandFactoryContext } from './types';

export type { Command, UseCommandsOptions } from './types';
export { CATEGORIES } from './categories';

// eslint-disable-next-line react-refresh/only-export-components -- Barrel exports are intentional
export function useCommands(options: UseCommandsOptions): Command[] {
  const {
    openThreads,
    activeThreadId,
    onNewThread,
    onRefresh,
    onCloseAllTerminals,
    ...restHandlers
  } = options;

  const hasActiveThread = !!activeThreadId;
  const [soundEnabled, setSoundEnabledState] = useState(isSoundEnabled);

  const toggleSound = useCallback(() => {
    const newValue = !isSoundEnabled();
    setSoundEnabled(newValue);
    setSoundEnabledState(newValue);
  }, []);

  const handlersRef = useRef<CommandHandlers>({
    onNewThread,
    onRefresh,
    onCloseAllTerminals,
    ...restHandlers,
  });

  useEffect(() => {
    handlersRef.current = {
      onNewThread,
      onRefresh,
      onCloseAllTerminals,
      ...restHandlers,
    };
  });

  return useMemo(() => {
    // eslint-disable-next-line react-hooks/refs -- Intentional: handlers are stable refs accessed in memoized factory
    const handlers = handlersRef.current;
    const context: CommandFactoryContext = {
      activeThreadId,
      hasActiveThread,
      openThreadsCount: openThreads.length,
      soundEnabled,
      toggleSound,
    };

    return [
      ...createThreadCommands(handlers, context),
      ...createNavigationCommands(handlers, context),
      ...createToolsCommands(handlers, context),
      ...createSettingsCommands(handlers, context),
    ];
  }, [
    openThreads.length,
    activeThreadId,
    hasActiveThread,
    soundEnabled,
    toggleSound,
  ]);
}
