import { memo, useMemo, useState, useCallback } from 'react';
import { ExternalLink, GitBranch, ChevronRight, ChevronDown, Layers } from 'lucide-react';
import type { Thread, ThreadMetadata, ThreadStatus } from '../types';
import {
  buildThreadStacks,
  getStackSize,
  getLastActiveThread,
  type ThreadListEntry,
} from '../utils/threadStacks';

function getDepth(nodeId: string, topology: import('../types').ThreadStackTopology): number {
  let depth = 0;
  let current = nodeId;
  while (topology.childToParent[current]) {
    depth++;
    current = topology.childToParent[current];
  }
  // Subtract 1 because root is depth 0 and its children are depth 1,
  // but root is already shown as the head card
  return Math.max(0, depth - 1);
}

interface KanbanCardProps {
  thread: Thread;
  meta?: ThreadMetadata;
  isFocused: boolean;
  onDragStart: (e: React.DragEvent, thread: Thread) => void;
  onContinue: (thread: Thread) => void;
  // Stack support
  stackSize?: number;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  stackDescendants?: Thread[];
  topology?: import('../types').ThreadStackTopology;
  allMetadata?: Record<string, ThreadMetadata>;
  displayLastUpdated?: string;
}

const KanbanCard = memo(function KanbanCard({
  thread,
  meta,
  isFocused,
  onDragStart,
  onContinue,
  stackSize,
  isExpanded,
  onToggleExpand,
  stackDescendants,
  topology,
  allMetadata,
  displayLastUpdated,
}: KanbanCardProps) {
  const hasStack = stackSize && stackSize > 1;

  return (
    <div
      className={`kanban-card-wrapper ${hasStack ? 'has-stack' : ''} ${
        isExpanded ? 'expanded' : ''
      }`}
    >
      <div
        className={`kanban-card ${isFocused ? 'focused' : ''}`}
        role="button"
        tabIndex={0}
        draggable
        onDragStart={(e) => onDragStart(e, thread)}
        onClick={() => onContinue(thread)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onContinue(thread);
          }
        }}
      >
        <div className="kanban-card-header">
          <div className="kanban-card-title">{thread.title}</div>
          {hasStack && (
            <button
              className="kanban-stack-toggle"
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand?.();
              }}
              title={isExpanded ? 'Collapse stack' : `Expand stack (${stackSize} threads)`}
            >
              <Layers size={11} />
              <span>{stackSize}</span>
              {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
          )}
        </div>
        <div className="kanban-card-meta">
          <span className="kanban-card-time">{displayLastUpdated || thread.lastUpdated}</span>
          {thread.contextPercent !== undefined && (
            <span className={`kanban-card-context ${thread.contextPercent > 80 ? 'warning' : ''}`}>
              {thread.contextPercent}%
            </span>
          )}
          {thread.cost !== undefined && (
            <span
              className="kanban-card-cost"
              title="Estimated cost — may differ from actual billing due to subagent, oracle, and other tool usage not fully tracked in thread data"
            >
              ~${thread.cost.toFixed(2)}
            </span>
          )}
        </div>
        {thread.workspace && <div className="kanban-card-workspace">{thread.workspace}</div>}
        {meta?.blockers && meta.blockers.length > 0 && (
          <div className="kanban-card-blockers">
            <GitBranch size={10} />
            <span>Blocked by {meta.blockers.length}</span>
          </div>
        )}
        <div className="kanban-card-actions">
          <a
            href={`https://ampcode.com/threads/${thread.id}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            title="Open in browser"
          >
            <ExternalLink size={12} />
          </a>
        </div>
      </div>

      {hasStack && isExpanded && stackDescendants && stackDescendants.length > 0 && (
        <div className="kanban-stack-ancestors">
          {stackDescendants.map((desc) => {
            const descMeta = allMetadata?.[desc.id];
            const descStatus = descMeta?.status || 'active';
            const depth = topology ? getDepth(desc.id, topology) : 0;
            return (
              <div
                key={desc.id}
                className={`kanban-card stack-child status-${descStatus}`}
                style={depth > 0 ? { marginLeft: depth * 12 } : undefined}
                role="button"
                tabIndex={0}
                onClick={() => onContinue(desc)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onContinue(desc);
                  }
                }}
              >
                <div className="kanban-card-title">{desc.title}</div>
                <div className="kanban-card-meta">
                  <span className="kanban-card-time">{desc.lastUpdated}</span>
                  <span className={`kanban-card-status status-${descStatus}`}>{descStatus}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

interface KanbanViewProps {
  threads: Thread[];
  metadata: Record<string, ThreadMetadata>;
  onContinue: (thread: Thread) => void;
  onStatusChange?: (threadId: string, status: ThreadStatus) => void;
  focusedId?: string;
}

const COLUMNS: { status: ThreadStatus; label: string; color: string }[] = [
  { status: 'active', label: 'Active', color: 'var(--accent-cyan)' },
  { status: 'blocked', label: 'Blocked', color: 'var(--error)' },
  { status: 'parked', label: 'Paused', color: 'var(--accent-yellow)' },
  { status: 'done', label: 'Done', color: 'var(--success, #00ff88)' },
];

export const KanbanView = memo(function KanbanView({
  threads,
  metadata,
  onContinue,
  onStatusChange,
  focusedId,
}: KanbanViewProps) {
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

  const columnData = useMemo(() => {
    const result: Record<ThreadStatus, ThreadListEntry[]> = {
      active: [],
      blocked: [],
      parked: [],
      done: [],
    };

    for (const entry of entries) {
      // Use last active thread's status for column placement so stacks
      // appear in the column matching their most recent activity
      const activeThread = getLastActiveThread(entry);
      const status = metadata[activeThread.id]?.status || 'active';
      result[status].push(entry);
    }

    return result;
  }, [entries, metadata]);

  const handleDragStart = (e: React.DragEvent, thread: Thread) => {
    e.dataTransfer.setData('threadId', thread.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetStatus: ThreadStatus) => {
    e.preventDefault();
    const threadId = e.dataTransfer.getData('threadId');
    if (threadId && onStatusChange) {
      const currentStatus = metadata[threadId]?.status || 'active';
      if (currentStatus !== targetStatus) {
        onStatusChange(threadId, targetStatus);
      }
    }
  };

  return (
    <div className="kanban-view">
      {COLUMNS.map(({ status, label, color }) => (
        <div
          key={status}
          className="kanban-column"
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, status)}
        >
          <div className="kanban-column-header" style={{ borderColor: color }}>
            <span className="kanban-column-title">{label}</span>
            <span className="kanban-column-count">{columnData[status].length}</span>
          </div>
          <div className="kanban-column-body">
            {columnData[status].map((entry) => {
              const stackSize = getStackSize(entry);
              const isExpanded = expandedStacks.has(entry.thread.id);
              const lastActive = entry.kind === 'stack' ? getLastActiveThread(entry) : undefined;

              return (
                <KanbanCard
                  key={entry.thread.id}
                  thread={entry.thread}
                  meta={metadata[entry.thread.id]}
                  isFocused={focusedId === entry.thread.id}
                  onDragStart={handleDragStart}
                  onContinue={onContinue}
                  stackSize={stackSize}
                  isExpanded={isExpanded}
                  onToggleExpand={() => toggleStackExpand(entry.thread.id)}
                  stackDescendants={entry.stack?.descendants}
                  topology={entry.stack?.topology}
                  allMetadata={metadata}
                  displayLastUpdated={lastActive?.lastUpdated}
                />
              );
            })}
            {columnData[status].length === 0 && <div className="kanban-empty">No threads</div>}
          </div>
        </div>
      ))}
    </div>
  );
});
