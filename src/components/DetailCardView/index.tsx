import { useState, useMemo, useCallback } from 'react';
import { ThreadCard } from './ThreadCard';
import { DateGroup, getDateLabel } from './DateGroup';
import type { Thread, ThreadMetadata, ThreadStatus } from '../../types';
import { buildThreadStacks, getStackSize } from '../../utils/threadStacks';

export interface DetailCardViewProps {
  threads: Thread[];
  metadata: Record<string, ThreadMetadata>;
  onContinue: (thread: Thread) => void;
  onArchive: (threadId: string) => void;
  onDelete: (threadId: string) => void;
  onStatusChange?: (threadId: string, status: ThreadStatus) => void;
  focusedId?: string;
  groupByDate?: boolean;
}

interface DateGroupData {
  label: string;
  threads: Thread[];
}

export function DetailCardView({
  threads,
  metadata,
  onContinue,
  onArchive,
  onDelete,
  onStatusChange,
  focusedId,
  groupByDate = false,
}: DetailCardViewProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [expandedStacks, setExpandedStacks] = useState<Set<string>>(new Set());

  // Build thread stacks from handoff relationships
  const entries = useMemo(() => buildThreadStacks(threads), [threads]);

  const toggleStackExpand = useCallback((headId: string) => {
    setExpandedStacks((prev) => {
      const next = new Set(prev);
      if (next.has(headId)) {
        next.delete(headId);
      } else {
        next.add(headId);
      }
      return next;
    });
  }, []);

  const dateGroups = useMemo((): DateGroupData[] => {
    if (!groupByDate) return [];

    const groups = new Map<string, Thread[]>();
    const order = ['Today', 'Yesterday', 'This Week', 'This Month', 'Older'];

    threads.forEach((thread) => {
      const label = getDateLabel(thread.lastUpdatedDate);
      const existing = groups.get(label);
      if (existing) {
        existing.push(thread);
      } else {
        groups.set(label, [thread]);
      }
    });

    return order
      .filter((label) => groups.has(label))
      .map((label) => ({ label, threads: groups.get(label) ?? [] }));
  }, [threads, groupByDate]);

  const toggleGroup = (label: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  };

  if (groupByDate) {
    return (
      <div className="detail-card-grouped">
        {dateGroups.map((group) => (
          <DateGroup
            key={group.label}
            label={group.label}
            count={group.threads.length}
            isCollapsed={collapsedGroups.has(group.label)}
            onToggle={() => toggleGroup(group.label)}
          >
            {group.threads.map((thread) => (
              <ThreadCard
                key={thread.id}
                thread={thread}
                metadata={metadata}
                onContinue={onContinue}
                onArchive={onArchive}
                onDelete={onDelete}
                onStatusChange={onStatusChange}
                focusedId={focusedId}
              />
            ))}
          </DateGroup>
        ))}

        {threads.length === 0 && <div className="detail-card-empty">No threads to display</div>}
      </div>
    );
  }

  return (
    <div className="detail-card-grid">
      {entries.map((entry) => {
        const stackSize = getStackSize(entry);
        const isExpanded = expandedStacks.has(entry.thread.id);

        return (
          <ThreadCard
            key={entry.thread.id}
            thread={entry.thread}
            metadata={metadata}
            onContinue={onContinue}
            onArchive={onArchive}
            onDelete={onDelete}
            onStatusChange={onStatusChange}
            focusedId={focusedId}
            stackSize={stackSize}
            isExpanded={isExpanded}
            onToggleExpand={() => toggleStackExpand(entry.thread.id)}
            stackDescendants={entry.stack?.descendants}
            topology={entry.stack?.topology}
          />
        );
      })}

      {entries.length === 0 && <div className="detail-card-empty">No threads to display</div>}
    </div>
  );
}

export { ThreadCard } from './ThreadCard';
export { DateGroup, getDateLabel } from './DateGroup';
export type { ThreadCardProps } from './ThreadCard';
export type { DateGroupProps } from './DateGroup';
