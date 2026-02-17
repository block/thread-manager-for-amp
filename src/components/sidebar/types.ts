import type { Thread, ThreadStatus, ThreadMetadata, RunningThreadsMap, RunningStatus } from '../../types';

export const PINNED_THREADS_KEY = 'amp-thread-manager-pinned-threads';

export interface SidebarProps {
  threads: Thread[];
  metadata: Record<string, ThreadMetadata>;
  onSelectThread: (thread: Thread) => void;
  activeThreadId?: string;
  runningThreads?: RunningThreadsMap;
  onArchiveThread?: (threadId: string) => void;
  onOpenInBrowser?: (threadId: string) => void;
  onDeleteThread?: (threadId: string) => void;
  onCopyThreadId?: (threadId: string) => void;
  onCopyThreadUrl?: (threadId: string) => void;
  onOpenTerminal?: () => void;
  terminalMinimized?: boolean;
}

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  thread: Thread | null;
}

export interface WorkspaceGroup {
  workspace: string;
  displayName: string;
  threads: Thread[];
  repos: Map<string, Thread[]>;
}

export interface ThreadNodeProps {
  thread: Thread;
  status?: ThreadStatus;
  isActive: boolean;
  runningStatus: RunningStatus | null;
  isFocused: boolean;
  isPinned: boolean;
  onSelect: () => void;
  onArchive?: () => void;
  onOpenInBrowser?: () => void;
  onTogglePin: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

export interface WorkspaceNodeProps {
  group: WorkspaceGroup;
  metadata: Record<string, ThreadMetadata>;
  expanded: boolean;
  onToggle: () => void;
  onSelectThread: (thread: Thread) => void;
  activeThreadId?: string;
  runningThreads?: RunningThreadsMap;
  collapsed: boolean;
  onArchiveThread?: (threadId: string) => void;
  onOpenInBrowser?: (threadId: string) => void;
  pinnedIds: Set<string>;
  onTogglePin: (threadId: string) => void;
  focusedThreadId?: string;
  onContextMenu: (e: React.MouseEvent, thread: Thread) => void;
  onExpandSidebar?: () => void;
  scmRefreshKey?: number;
}

export interface SidebarContextMenuProps {
  state: ContextMenuState;
  onClose: () => void;
  onContinue: () => void;
  onOpenInBrowser?: () => void;
  onCopyId?: () => void;
  onCopyUrl?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
}

export interface SidebarHeaderProps {
  collapsed: boolean;
  runningCount: number;
  allExpanded: boolean;
  onToggleCollapse: () => void;
  onToggleAllWorkspaces: () => void;
}

export interface SidebarSearchProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export interface PinnedSectionProps {
  threads: Thread[];
  metadata: Record<string, ThreadMetadata>;
  activeThreadId?: string;
  runningThreads: RunningThreadsMap;
  expanded: boolean;
  onToggleExpanded: () => void;
  focusedThreadId?: string;
  onSelectThread: (thread: Thread) => void;
  onArchiveThread?: (threadId: string) => void;
  onOpenInBrowser?: (threadId: string) => void;
  onTogglePin: (threadId: string) => void;
  onContextMenu: (e: React.MouseEvent, thread: Thread) => void;
}

export { type Thread, type ThreadStatus, type ThreadMetadata, type RunningThreadsMap, type RunningStatus };
