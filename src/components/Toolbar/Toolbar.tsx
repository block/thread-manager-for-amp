import { memo } from 'react';
import { RefreshCw, Plus } from 'lucide-react';
import { ThemePicker } from '../ThemePicker';
import { ToolbarSearch } from './ToolbarSearch';
import { ToolbarContentSearch } from './ToolbarContentSearch';
import { ToolbarFilters } from './ToolbarFilters';
import { ToolbarViewSwitcher } from './ToolbarViewSwitcher';
import type { ToolbarProps } from './types';
import styles from './Toolbar.module.css';

export const Toolbar = memo(function Toolbar({
  searchValue,
  onSearchChange,
  onRefresh,
  loading,
  onOpenThread,
  onNewThread,
  onReset,
  threads,
  selectedRepo,
  selectedWorkspace,
  selectedLabel,
  selectedStatus,
  labels,
  onRepoChange,
  onWorkspaceChange,
  onLabelChange,
  onStatusChange,
  viewMode,
  onViewModeChange,
  groupByDate,
  onGroupByDateChange,
  currentTheme,
  onThemeChange,
}: ToolbarProps) {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <button
            className={styles.logo}
            onClick={onReset}
            title="Reset view"
            type="button"
          >
            <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#0ef3ff" />
                  <stop offset="50%" stopColor="#ff2592" />
                  <stop offset="100%" stopColor="#ffd400" />
                </linearGradient>
              </defs>
              <rect width="32" height="32" rx="7" fill="#1a1a2e"/>
              <path d="M8 10l6 6-6 6" stroke="url(#logoGradient)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              <line x1="17" y1="22" x2="24" y2="22" stroke="url(#logoGradient)" strokeWidth="3" strokeLinecap="round"/>
            </svg>
          </button>

          <ToolbarSearch searchValue={searchValue} onSearchChange={onSearchChange} />
          <ToolbarContentSearch onOpenThread={onOpenThread} />
        </div>

        <div className={styles.headerRight}>
          <ThemePicker currentTheme={currentTheme} onThemeChange={onThemeChange} />
          
          <button
            onClick={onRefresh}
            disabled={loading}
            className={styles.iconBtn}
            title="Refresh (⌘R)"
          >
            <RefreshCw size={16} className={loading ? styles.spinning : ''} />
          </button>

          {onNewThread && (
            <button className={styles.newBtn} onClick={onNewThread}>
              <Plus size={16} />
              <span>New Thread</span>
            </button>
          )}
        </div>
      </div>

      <div className={styles.views}>
        <ToolbarFilters
          threads={threads}
          selectedRepo={selectedRepo}
          selectedWorkspace={selectedWorkspace}
          selectedLabel={selectedLabel}
          selectedStatus={selectedStatus}
          labels={labels}
          onRepoChange={onRepoChange}
          onWorkspaceChange={onWorkspaceChange}
          onLabelChange={onLabelChange}
          onStatusChange={onStatusChange}
        />
        <ToolbarViewSwitcher
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
          groupByDate={groupByDate}
          onGroupByDateChange={onGroupByDateChange}
        />
      </div>
    </div>
  );
});
