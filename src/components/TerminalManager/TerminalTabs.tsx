import { memo } from 'react';
import { X } from 'lucide-react';
import type { Thread } from '../../types';
import type { LayoutMode } from './useTerminalManager';
import { useUnread } from '../../contexts/UnreadContext';
import { useThreadStatus } from '../../contexts/ThreadStatusContext';

interface TerminalTabsProps {
  orderedThreads: Thread[];
  activeId: string;
  layout: LayoutMode;
  visibleIds: Set<string>;
  draggedTab: string | null;
  onTabClick: (id: string) => void;
  onTabDoubleClick: (id: string) => void;
  onTabClose: (id: string) => void;
  onDragStart: (e: React.DragEvent, threadId: string) => void;
  onDragOver: (e: React.DragEvent, threadId: string) => void;
  onDragEnd: () => void;
}

export const TerminalTabs = memo(function TerminalTabs({
  orderedThreads,
  activeId,
  layout,
  visibleIds,
  draggedTab,
  onTabClick,
  onTabDoubleClick,
  onTabClose,
  onDragStart,
  onDragOver,
  onDragEnd,
}: TerminalTabsProps) {
  const { getUnreadCount, markAsSeen } = useUnread();
  const { getStatus } = useThreadStatus();
  const maxVisible = layout === 'split' ? 2 : 4;
  const showVisibilityIndicator = layout !== 'tabs' && orderedThreads.length > maxVisible;

  const handleTabClick = (threadId: string) => {
    markAsSeen(threadId);
    onTabClick(threadId);
  };

  return (
    <div className="terminal-tabs">
      {orderedThreads.map((thread) => {
        const isVisible = visibleIds.has(thread.id);
        const unreadCount = getUnreadCount(thread.id);
        const isActive = thread.id === activeId;
        const status = getStatus(thread.id);
        return (
          <div
            key={thread.id}
            className={`terminal-tab ${isActive ? 'active' : ''} ${isVisible && layout !== 'tabs' ? 'in-view' : ''} ${draggedTab === thread.id ? 'dragging' : ''} ${unreadCount > 0 ? 'has-unread' : ''}`}
            onClick={() => handleTabClick(thread.id)}
            onDoubleClick={() => layout !== 'tabs' && onTabDoubleClick(thread.id)}
            draggable
            onDragStart={(e) => onDragStart(e, thread.id)}
            onDragOver={(e) => onDragOver(e, thread.id)}
            onDragEnd={onDragEnd}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') handleTabClick(thread.id); }}
            title={showVisibilityIndicator && !isVisible ? 'Double-click to show in view' : thread.title}
          >
            {showVisibilityIndicator && (
              <span className={`tab-visibility ${isVisible ? 'visible' : 'hidden'}`}>
                {isVisible ? '●' : '○'}
              </span>
            )}
            <span className={`terminal-tab-status status-${status}`} />
            <span className="terminal-tab-title">{thread.title.slice(0, 25)}...</span>
            {unreadCount > 0 && !isActive && (
              <span className="terminal-tab-unread">{unreadCount}</span>
            )}
            <button 
              className="terminal-tab-close"
              onClick={(e) => { e.stopPropagation(); onTabClose(thread.id); }}
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
});
