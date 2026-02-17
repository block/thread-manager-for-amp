import { createContext, useContext, type ReactNode } from 'react';
import { useAppSettings } from '../hooks/useAppSettings';
import type { ViewMode } from '../types';

type TerminalLayout = 'tabs' | 'split' | 'grid';

interface SettingsContextValue {
  viewMode: ViewMode;
  terminalLayout: TerminalLayout;
  sidebarCollapsed: boolean;
  groupByDate: boolean;
  currentTheme: string;
  scmRefreshKey: number;

  handleViewModeChange: (mode: ViewMode) => void;
  handleToggleLayout: () => void;
  handleToggleSidebar: () => void;
  handleGroupByDateChange: (value: boolean) => void;
  setTerminalLayout: (layout: TerminalLayout) => void;
  setCurrentTheme: (theme: string) => void;
  triggerScmRefresh: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

interface SettingsProviderProps {
  children: ReactNode;
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  const settings = useAppSettings();

  return (
    <SettingsContext.Provider value={settings}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettingsContext(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettingsContext must be used within a SettingsProvider');
  }
  return context;
}
