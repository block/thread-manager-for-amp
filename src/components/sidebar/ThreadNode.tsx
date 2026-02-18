import { memo, useCallback } from 'react';
import { MessageSquare, ExternalLink, Archive, Pin, PinOff } from 'lucide-react';
import { getStatusIcon } from './utils';
import type { ThreadNodeProps } from './types';

export const ThreadNode = memo(function ThreadNode({
  thread,
  status,
  isActive,
  runningStatus,
  isFocused,
  isPinned,
  onSelect,
  onArchive,
  onOpenInBrowser,
  onTogglePin,
  onContextMenu,
}: ThreadNodeProps) {
  const handleActionClick = useCallback((e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect();
      }
    },
    [onSelect],
  );

  return (
    <div
      className={`sidebar-node thread ${isActive ? 'active' : ''} ${isFocused ? 'focused' : ''}`}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      onContextMenu={onContextMenu}
      title={thread.title}
      data-thread-id={thread.id}
      role="button"
      tabIndex={0}
    >
      <span className="sidebar-node-header">
        {getStatusIcon(status, runningStatus)}
        <MessageSquare size={14} />
        <span className="sidebar-node-label">{thread.title}</span>
        <span className="sidebar-thread-actions">
          <button
            className={`sidebar-action-btn ${isPinned ? 'pinned' : ''}`}
            onClick={(e) => handleActionClick(e, onTogglePin)}
            title={isPinned ? 'Unpin' : 'Pin'}
          >
            {isPinned ? <PinOff size={12} /> : <Pin size={12} />}
          </button>
          {onOpenInBrowser && (
            <button
              className="sidebar-action-btn"
              onClick={(e) => handleActionClick(e, onOpenInBrowser)}
              title="Open in browser"
            >
              <ExternalLink size={12} />
            </button>
          )}
          {onArchive && (
            <button
              className="sidebar-action-btn"
              onClick={(e) => handleActionClick(e, onArchive)}
              title="Archive"
            >
              <Archive size={12} />
            </button>
          )}
        </span>
      </span>
    </div>
  );
});
