import { Archive, Trash2 } from 'lucide-react';
import { BulkStatusMenu } from './BulkStatusMenu';
import type { ThreadStatus } from '../../types';
import type { BulkAction } from './types';

interface BulkActionBarProps {
  selectedCount: number;
  onBulkStatusChange?: (status: ThreadStatus) => void;
  onBulkAction: (action: BulkAction) => void;
  onClearSelection: () => void;
}

export function BulkActionBar({
  selectedCount,
  onBulkStatusChange,
  onBulkAction,
  onClearSelection,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="bulk-action-bar">
      <span className="bulk-count">{selectedCount} selected</span>
      <div className="bulk-actions">
        {onBulkStatusChange && (
          <BulkStatusMenu onStatusChange={onBulkStatusChange} />
        )}
        <button
          className="bulk-btn archive"
          onClick={() => onBulkAction('archive')}
        >
          <Archive size={14} />
          Archive
        </button>
        <button
          className="bulk-btn delete"
          onClick={() => onBulkAction('delete')}
        >
          <Trash2 size={14} />
          Delete
        </button>
        <button
          className="bulk-btn clear"
          onClick={onClearSelection}
        >
          Deselect
        </button>
      </div>
    </div>
  );
}
