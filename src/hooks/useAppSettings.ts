import { useState, useCallback, useEffect } from 'react';
import type { ViewMode } from '../types';
import type { AgentMode } from '../../shared/websocket.js';
import { AGENT_MODES } from '../../shared/websocket.js';
import {
  applyTheme,
  loadSavedTheme,
  getPresetByName,
  getThemeForPreset,
  THEME_PRESETS,
} from '../lib/theme';

type TerminalLayout = 'tabs' | 'split' | 'grid';

interface UseAppSettingsReturn {
  terminalLayout: TerminalLayout;
  setTerminalLayout: (layout: TerminalLayout) => void;
  handleToggleLayout: () => void;

  viewMode: ViewMode;
  handleViewModeChange: (mode: ViewMode) => void;

  groupByDate: boolean;
  handleGroupByDateChange: (value: boolean) => void;

  currentTheme: string;
  setCurrentTheme: (theme: string) => void;

  sidebarCollapsed: boolean;
  handleToggleSidebar: () => void;

  scmRefreshKey: number;
  triggerScmRefresh: () => void;

  agentMode: AgentMode;
  handleSetAgentMode: (mode: AgentMode) => void;
  toggleDeepMode: () => void;
  cycleAgentMode: () => void;
}

export function useAppSettings(): UseAppSettingsReturn {
  const [terminalLayout, setTerminalLayout] = useState<TerminalLayout>('tabs');

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('threadListViewMode');
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard
    return (saved as ViewMode) || 'table';
  });

  const [groupByDate, setGroupByDate] = useState<boolean>(() => {
    const saved = localStorage.getItem('threadListGroupByDate');
    return saved === 'true';
  });

  const [currentTheme, setCurrentTheme] = useState<string>(() => {
    const themeName = loadSavedTheme();
    return getPresetByName(themeName)?.name ?? THEME_PRESETS[0]?.name ?? 'Cyberpunk 2077';
  });

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved === 'true';
  });

  const [scmRefreshKey, setScmRefreshKey] = useState(0);

  const [agentMode, setAgentMode] = useState<AgentMode>(() => {
    const saved = localStorage.getItem('agentMode');
    return AGENT_MODES.includes(saved as AgentMode) ? (saved as AgentMode) : 'smart';
  });

  useEffect(() => {
    const themeName = loadSavedTheme();
    const preset = getPresetByName(themeName) ?? THEME_PRESETS[0];
    if (!preset) return;
    const theme = getThemeForPreset(preset);
    applyTheme(theme);
  }, []);

  const handleToggleLayout = useCallback(() => {
    setTerminalLayout((prev) => {
      if (prev === 'tabs') return 'split';
      if (prev === 'split') return 'grid';
      return 'tabs';
    });
  }, []);

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('threadListViewMode', mode);
  }, []);

  const handleGroupByDateChange = useCallback((value: boolean) => {
    setGroupByDate(value);
    localStorage.setItem('threadListGroupByDate', String(value));
  }, []);

  const handleToggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const newValue = !prev;
      localStorage.setItem('sidebarCollapsed', String(newValue));
      return newValue;
    });
  }, []);

  const triggerScmRefresh = useCallback(() => {
    setScmRefreshKey((prev) => prev + 1);
  }, []);

  const handleSetAgentMode = useCallback((mode: AgentMode) => {
    setAgentMode(mode);
    localStorage.setItem('agentMode', mode);
  }, []);

  const toggleDeepMode = useCallback(() => {
    setAgentMode((prev) => {
      const next = prev === 'deep' ? 'smart' : 'deep';
      localStorage.setItem('agentMode', next);
      return next;
    });
  }, []);

  const cycleAgentMode = useCallback(() => {
    setAgentMode((prev) => {
      const idx = AGENT_MODES.indexOf(prev);
      const nextIdx = (idx + 1) % AGENT_MODES.length;
      const next = AGENT_MODES[nextIdx] ?? 'smart';
      localStorage.setItem('agentMode', next);
      return next;
    });
  }, []);

  return {
    terminalLayout,
    setTerminalLayout,
    handleToggleLayout,
    viewMode,
    handleViewModeChange,
    groupByDate,
    handleGroupByDateChange,
    currentTheme,
    setCurrentTheme,
    sidebarCollapsed,
    handleToggleSidebar,
    scmRefreshKey,
    triggerScmRefresh,
    agentMode,
    handleSetAgentMode,
    toggleDeepMode,
    cycleAgentMode,
  };
}
