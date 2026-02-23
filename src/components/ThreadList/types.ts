import type { Thread, SortField, SortDirection, ThreadMetadata, ThreadStatus } from '../../types';
import type { ViewMode } from '../Toolbar';

export type BulkAction = 'archive' | 'delete';

export interface ThreadListProps {
  threads: Thread[];
  metadata: Record<string, ThreadMetadata>;
  threadLabels?: Record<string, string[]>;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  onContinue: (thread: Thread) => void;
  onArchive: (threadId: string) => void;
  onDelete: (threadId: string) => void;
  onBulkArchive: (threadIds: string[]) => void;
  onBulkDelete: (threadIds: string[]) => void;
  onBulkStatusChange?: (threadIds: string[], status: ThreadStatus) => void;
  onStatusChange?: (threadId: string, status: ThreadStatus) => void;
  viewMode: ViewMode;
  groupByDate?: boolean;
}

export interface ThreadRowProps {
  thread: Thread;
  metadata: ThreadMetadata | undefined;
  initialLabels?: { name: string }[];
  selected: boolean;
  focused: boolean;
  onContinue: (thread: Thread) => void;
  onArchive: (thread: Thread) => void;
  onDelete: (thread: Thread) => void;
  onStatusChange?: (threadId: string, status: ThreadStatus) => void;
  onSelect: (threadId: string, shiftKey: boolean) => void;
  // Stack support
  stackSize?: number;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  isStackChild?: boolean;
  stackDepth?: number;
  displayLastUpdated?: string;
}
