import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import { useAppSettings } from '../hooks/useAppSettings';
import type { ViewMode } from '../types';
import type { AgentMode, DeepReasoningEffort } from '../../shared/websocket.js';

type TerminalLayout = 'tabs' | 'split' | 'grid';

interface SettingsContextValue {
  viewMode: ViewMode;
  terminalLayout: TerminalLayout;
  sidebarCollapsed: boolean;
  groupByDate: boolean;
  currentTheme: string;
  scmRefreshKey: number;
  agentMode: AgentMode;
  deepReasoningEffort: DeepReasoningEffort;

  handleViewModeChange: (mode: ViewMode) => void;
  handleToggleLayout: () => void;
  handleToggleSidebar: () => void;
  handleGroupByDateChange: (value: boolean) => void;
  setTerminalLayout: (layout: TerminalLayout) => void;
  setCurrentTheme: (theme: string) => void;
  triggerScmRefresh: () => void;
  handleSetAgentMode: (mode: AgentMode) => void;
  toggleDeepMode: () => void;
  cycleAgentMode: () => void;
  showThinkingBlocks: boolean;
  toggleThinkingBlocks: () => void;

  activeThreadModeLocked: boolean;
  setActiveThreadModeLocked: (locked: boolean) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

interface SettingsProviderProps {
  children: ReactNode;
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  const settings = useAppSettings();
  const [activeThreadModeLocked, setLocked] = useState(false);

  const setActiveThreadModeLocked = useCallback((locked: boolean) => {
    setLocked(locked);
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({
      ...settings,
      activeThreadModeLocked,
      setActiveThreadModeLocked,
    }),
    [settings, activeThreadModeLocked, setActiveThreadModeLocked],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettingsContext(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettingsContext must be used within a SettingsProvider');
  }
  return context;
}
