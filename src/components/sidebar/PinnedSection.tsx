import { ChevronRight, ChevronDown, Pin } from 'lucide-react';
import { ThreadNode } from './ThreadNode';
import type { PinnedSectionProps } from './types';

export function PinnedSection({
  threads,
  metadata,
  activeThreadId,
  runningThreads,
  expanded,
  onToggleExpanded,
  focusedThreadId,
  onSelectThread,
  onArchiveThread,
  onOpenInBrowser,
  onTogglePin,
  onContextMenu,
}: PinnedSectionProps) {
  if (threads.length === 0) return null;

  return (
    <div className="sidebar-node pinned-section">
      <button className="sidebar-node-header" onClick={onToggleExpanded}>
        <span className="sidebar-chevron">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <Pin size={14} className="sidebar-pin-icon" />
        <span className="sidebar-node-label">Pinned</span>
        <span className="sidebar-node-count">{threads.length}</span>
      </button>
      {expanded && (
        <div className="sidebar-node-children">
          {threads.map(thread => (
            <ThreadNode
              key={thread.id}
              thread={thread}
              status={metadata[thread.id]?.status} // eslint-disable-line @typescript-eslint/no-unnecessary-condition -- metadata lookup may be undefined
              isActive={activeThreadId === thread.id}
              runningStatus={runningThreads[thread.id]?.status ?? null} // eslint-disable-line @typescript-eslint/no-unnecessary-condition -- dynamic key lookup may be undefined
              isFocused={focusedThreadId === thread.id}
              isPinned={true}
              onSelect={() => onSelectThread(thread)}
              onArchive={onArchiveThread ? () => onArchiveThread(thread.id) : undefined}
              onOpenInBrowser={onOpenInBrowser ? () => onOpenInBrowser(thread.id) : undefined}
              onTogglePin={() => onTogglePin(thread.id)}
              onContextMenu={(e) => onContextMenu(e, thread)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
