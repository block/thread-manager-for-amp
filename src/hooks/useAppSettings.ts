import { useState, useCallback, useEffect } from 'react';
import type { ViewMode } from '../components/Toolbar';
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
}

export function useAppSettings(): UseAppSettingsReturn {
  const [terminalLayout, setTerminalLayout] = useState<TerminalLayout>('tabs');

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('threadListViewMode');
    return (saved as ViewMode) || 'table';
  });

  const [groupByDate, setGroupByDate] = useState<boolean>(() => {
    const saved = localStorage.getItem('threadListGroupByDate');
    return saved === 'true';
  });

  const [currentTheme, setCurrentTheme] = useState<string>(() => {
    const themeName = loadSavedTheme();
    return getPresetByName(themeName)?.name || THEME_PRESETS[0].name;
  });

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved === 'true';
  });

  const [scmRefreshKey, setScmRefreshKey] = useState(0);

  useEffect(() => {
    const themeName = loadSavedTheme();
    const preset = getPresetByName(themeName) || THEME_PRESETS[0];
    const theme = getThemeForPreset(preset);
    applyTheme(theme);
  }, []);

  const handleToggleLayout = useCallback(() => {
    setTerminalLayout(prev => {
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
    setSidebarCollapsed(prev => {
      const newValue = !prev;
      localStorage.setItem('sidebarCollapsed', String(newValue));
      return newValue;
    });
  }, []);

  const triggerScmRefresh = useCallback(() => {
    setScmRefreshKey(prev => prev + 1);
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
  };
}
