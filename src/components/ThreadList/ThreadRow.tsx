import { memo } from 'react';
import {
  ExternalLink,
  Archive,
  Trash2,
  CheckSquare,
  Square,
  Link2,
  ChevronRight,
  ChevronDown,
  Layers,
} from 'lucide-react';
import { ThreadStatusBadge } from '../ThreadStatusBadge';
import { ThreadLabelEditor } from '../ThreadLabelEditor';
import { LinkedIssueBadge } from '../LinkedIssue';
import type { ThreadRowProps } from './types';

export const ThreadRow = memo(function ThreadRow({
  thread,
  metadata,
  initialLabels,
  selected,
  focused,
  onContinue,
  onArchive,
  onDelete,
  onStatusChange,
  onSelect,
  stackSize,
  isExpanded,
  onToggleExpand,
  isStackChild,
}: ThreadRowProps) {
  const hasStack = stackSize && stackSize > 1;

  return (
    <tr
      className={`clickable-row ${selected ? 'selected' : ''} ${focused ? 'focused' : ''} ${
        isStackChild ? 'stack-child' : ''
      }`}
      onClick={() => onContinue(thread)}
    >
      <td className="checkbox-cell" onClick={(e) => e.stopPropagation()}>
        <button
          className="row-checkbox"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(thread.id, e.shiftKey);
          }}
          aria-label={selected ? 'Deselect thread' : 'Select thread'}
        >
          {selected ? <CheckSquare size={16} /> : <Square size={16} />}
        </button>
      </td>
      <td className="thread-status" onClick={(e) => e.stopPropagation()}>
        <div className="status-with-blockers">
          <ThreadStatusBadge
            threadId={thread.id}
            status={metadata?.status || 'active'}
            onStatusChange={(status) => onStatusChange?.(thread.id, status)}
            compact
          />
          {metadata?.blockers && metadata.blockers.length > 0 && (
            <span
              className="blocker-count"
              title={`Blocked by ${metadata.blockers.length} thread(s)`}
            >
              <Link2 size={10} />
              {metadata.blockers.length}
            </span>
          )}
        </div>
      </td>
      <td className="thread-title">
        <div className="thread-title-wrapper">
          {hasStack && (
            <button
              className="stack-toggle"
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand?.();
              }}
              title={isExpanded ? 'Collapse stack' : `Expand stack (${stackSize} threads)`}
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <Layers size={12} className="stack-icon" />
              <span className="stack-count">{stackSize}</span>
            </button>
          )}
          {isStackChild && <span className="stack-indent" />}
          <span className="thread-title-text">{thread.title}</span>
          {metadata?.linked_issue_url && (
            <LinkedIssueBadge url={metadata.linked_issue_url} compact />
          )}
        </div>
      </td>
      <td className="thread-labels" onClick={(e) => e.stopPropagation()}>
        <ThreadLabelEditor threadId={thread.id} initialLabels={initialLabels} compact />
      </td>
      <td className="thread-time">{thread.lastUpdated}</td>
      <td className="thread-workspace" title={thread.workspacePath ?? undefined}>
        {thread.workspace || '—'}
      </td>
      <td className="thread-context">
        {thread.contextPercent !== undefined ? (
          <span className={thread.contextPercent > 80 ? 'context-warning' : ''}>
            {thread.contextPercent}%
          </span>
        ) : (
          '—'
        )}
      </td>
      <td
        className={`thread-cost${thread.cost && thread.cost >= 50 ? ' cost-warning' : ''}`}
        title={
          thread.cost
            ? 'Estimated cost — may differ from actual billing due to subagent, oracle, and other tool usage not fully tracked in thread data'
            : undefined
        }
      >
        {thread.cost ? `~$${thread.cost.toFixed(2)}` : '—'}
      </td>
      <td className="thread-actions" onClick={(e) => e.stopPropagation()}>
        <a
          href={`https://ampcode.com/threads/${thread.id}`}
          target="_blank"
          rel="noopener noreferrer"
          title="Open in browser"
          className="action-btn external"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink size={14} />
        </a>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onArchive(thread);
          }}
          title="Archive thread"
          className="action-btn archive"
        >
          <Archive size={14} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(thread);
          }}
          title="Delete thread permanently"
          className="action-btn delete"
        >
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  );
});
