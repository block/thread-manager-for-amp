import type { Thread, ThreadStatus, SearchResult } from '../../types';

export type ViewMode = 'table' | 'kanban' | 'cards';

export const STATUS_OPTIONS: { value: ThreadStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'parked', label: 'Paused' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'done', label: 'Done' },
];

export const VIEW_MODES: { mode: ViewMode; icon: string; label: string; color: string }[] = [
  { mode: 'table', icon: 'Table', label: 'Table', color: 'var(--accent-cyan)' },
  { mode: 'kanban', icon: 'Columns3', label: 'Board', color: 'var(--accent-pink)' },
  { mode: 'cards', icon: 'LayoutGrid', label: 'Cards', color: 'var(--accent-yellow)' },
];

export interface ToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  loading: boolean;
  onOpenThread?: (thread: Thread) => void;
  onNewThread?: () => void;
  onReset?: () => void;
  threads: Thread[];
  selectedRepo: string | null;
  selectedWorkspace: string | null;
  selectedLabel: string | null;
  selectedStatus: ThreadStatus | null;
  labels: string[];
  onRepoChange: (repo: string | null) => void;
  onWorkspaceChange: (workspace: string | null) => void;
  onLabelChange: (label: string | null) => void;
  onStatusChange: (status: ThreadStatus | null) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  groupByDate: boolean;
  onGroupByDateChange: (value: boolean) => void;
  currentTheme: string;
  onThemeChange: (themeName: string) => void;
}

export interface ToolbarSearchProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
}

export interface ToolbarContentSearchProps {
  onOpenThread?: (thread: Thread) => void;
}

export interface ToolbarFiltersProps {
  threads: Thread[];
  selectedRepo: string | null;
  selectedWorkspace: string | null;
  selectedLabel: string | null;
  selectedStatus: ThreadStatus | null;
  labels: string[];
  onRepoChange: (repo: string | null) => void;
  onWorkspaceChange: (workspace: string | null) => void;
  onLabelChange: (label: string | null) => void;
  onStatusChange: (status: ThreadStatus | null) => void;
}

export interface ToolbarViewSwitcherProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  groupByDate: boolean;
  onGroupByDateChange: (value: boolean) => void;
}

export { type Thread, type ThreadStatus, type SearchResult };
