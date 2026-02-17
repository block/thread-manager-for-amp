import { memo } from 'react';
import { RefreshCw, Plus } from 'lucide-react';
import { ThemePicker } from '../ThemePicker';
import { ToolbarSearch } from './ToolbarSearch';
import { ToolbarContentSearch } from './ToolbarContentSearch';
import { ToolbarFilters } from './ToolbarFilters';
import { ToolbarViewSwitcher } from './ToolbarViewSwitcher';
import { useSettingsContext } from '../../contexts/SettingsContext';
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
}: ToolbarProps) {
  const { viewMode, handleViewModeChange, groupByDate, handleGroupByDateChange, currentTheme, setCurrentTheme } = useSettingsContext();
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
                <linearGradient id="lg1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ff2592" />
                  <stop offset="30%" stopColor="#ffd400" />
                  <stop offset="70%" stopColor="#ffd400" />
                  <stop offset="100%" stopColor="#0ef3ff" />
                </linearGradient>
                <linearGradient id="lg2" x1="100%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#0ef3ff" stopOpacity="0.92" />
                  <stop offset="50%" stopColor="#ffa040" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#ff2592" stopOpacity="0.15" />
                </linearGradient>
                <radialGradient id="rg1" cx="15%" cy="85%" r="75%">
                  <stop offset="0%" stopColor="#ff2592" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#ff2592" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="rg2" cx="85%" cy="15%" r="55%">
                  <stop offset="0%" stopColor="#0ef3ff" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#0ef3ff" stopOpacity="0" />
                </radialGradient>
                <clipPath id="logoClip"><rect width="32" height="32" rx="7"/></clipPath>
                <mask id="logoMask">
                  <rect width="32" height="32" fill="white"/>
                  <path d="M8 10l6 6-6 6" stroke="black" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  <line x1="17" y1="22" x2="24" y2="22" stroke="black" strokeWidth="3" strokeLinecap="round"/>
                </mask>
              </defs>
              <g mask="url(#logoMask)">
                <g clipPath="url(#logoClip)">
                  <rect width="32" height="32" fill="url(#lg1)"/>
                  <rect width="32" height="32" fill="url(#lg2)"/>
                  <rect width="32" height="32" fill="url(#rg1)"/>
                  <rect width="32" height="32" fill="url(#rg2)"/>
                </g>
              </g>
            </svg>
          </button>

          <ToolbarSearch searchValue={searchValue} onSearchChange={onSearchChange} />
          <ToolbarContentSearch onOpenThread={onOpenThread} />
        </div>

        <div className={styles.headerRight}>
          <ThemePicker currentTheme={currentTheme} onThemeChange={setCurrentTheme} />
          
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
          onViewModeChange={handleViewModeChange}
          groupByDate={groupByDate}
          onGroupByDateChange={handleGroupByDateChange}
        />
      </div>
    </div>
  );
});
