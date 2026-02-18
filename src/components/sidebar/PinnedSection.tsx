import { memo, useMemo } from 'react';
import { ChevronRight, ChevronDown, Pin } from 'lucide-react';
import { ThreadNode } from './ThreadNode';
import type { PinnedSectionProps } from './types';

export const PinnedSection = memo(function PinnedSection({
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
  // Stable callback maps keyed by thread ID to avoid inline arrows in .map()
  // that would defeat memo() on ThreadNode
  const threadCallbacks = useMemo(() => {
    const map = new Map<
      string,
      {
        onSelect: () => void;
        onArchive: (() => void) | undefined;
        onOpenInBrowser: (() => void) | undefined;
        onTogglePin: () => void;
        onContextMenu: (e: React.MouseEvent) => void;
      }
    >();
    for (const thread of threads) {
      map.set(thread.id, {
        onSelect: () => onSelectThread(thread),
        onArchive: onArchiveThread ? () => onArchiveThread(thread.id) : undefined,
        onOpenInBrowser: onOpenInBrowser ? () => onOpenInBrowser(thread.id) : undefined,
        onTogglePin: () => onTogglePin(thread.id),
        onContextMenu: (e: React.MouseEvent) => onContextMenu(e, thread),
      });
    }
    return map;
  }, [threads, onSelectThread, onArchiveThread, onOpenInBrowser, onTogglePin, onContextMenu]);

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
          {threads.map((thread) => {
            const cbs = threadCallbacks.get(thread.id);
            return (
              <ThreadNode
                key={thread.id}
                thread={thread}
                status={metadata[thread.id]?.status}
                isActive={activeThreadId === thread.id}
                runningStatus={runningThreads[thread.id]?.status ?? null}
                isFocused={focusedThreadId === thread.id}
                isPinned={true}
                onSelect={cbs?.onSelect ?? (() => onSelectThread(thread))}
                onArchive={cbs?.onArchive}
                onOpenInBrowser={cbs?.onOpenInBrowser}
                onTogglePin={cbs?.onTogglePin ?? (() => onTogglePin(thread.id))}
                onContextMenu={cbs?.onContextMenu ?? ((e) => onContextMenu(e, thread))}
              />
            );
          })}
        </div>
      )}
    </div>
  );
});
