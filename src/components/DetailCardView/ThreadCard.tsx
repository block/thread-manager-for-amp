import { ExternalLink, Archive, Trash2, MessageSquare, FileText, GitBranch, Folder, ChevronRight, ChevronDown, Layers } from 'lucide-react';
import { ThreadStatusBadge } from '../ThreadStatusBadge';
import { LinkedIssueBadge } from '../LinkedIssue';
import type { Thread, ThreadMetadata, ThreadStatus } from '../../types';

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return dateStr;
}

export interface ThreadCardProps {
  thread: Thread;
  metadata: Record<string, ThreadMetadata>;
  onContinue: (thread: Thread) => void;
  onArchive: (threadId: string) => void;
  onDelete: (threadId: string) => void;
  onStatusChange?: (threadId: string, status: ThreadStatus) => void;
  focusedId?: string;
  // Stack support
  stackSize?: number;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  isStackChild?: boolean;
  stackAncestors?: Thread[];
}

function getFilename(path: string): string {
  return path.split('/').pop() || path;
}

export function ThreadCard({ 
  thread, 
  metadata, 
  onContinue, 
  onArchive,
  onDelete,
  onStatusChange,
  focusedId,
  stackSize,
  isExpanded,
  onToggleExpand,
  isStackChild,
  stackAncestors,
}: ThreadCardProps) {
  const meta = metadata[thread.id];
  const status = meta?.status || 'active';
  const blockerCount = meta?.blockers?.length || 0;
  const touchedFiles = thread.touchedFiles || [];
  const hasStack = stackSize && stackSize > 1;
  
  return (
    <div className={`detail-card-wrapper ${hasStack ? 'has-stack' : ''} ${isExpanded ? 'expanded' : ''}`}>
      <div
        className={`detail-card ${focusedId === thread.id ? 'focused' : ''} status-${status} ${isStackChild ? 'stack-child' : ''}`}
        onClick={() => onContinue(thread)}
      >
        <div className="detail-card-header">
          <ThreadStatusBadge
            threadId={thread.id}
            status={status}
            onStatusChange={(s) => onStatusChange?.(thread.id, s)}
            compact
          />
          <div className="detail-card-header-right" onClick={(e) => e.stopPropagation()}>
            {hasStack && (
              <button
                className="stack-toggle-card"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleExpand?.();
                }}
                title={isExpanded ? 'Collapse stack' : `Expand stack (${stackSize} threads)`}
              >
                <Layers size={12} />
                <span>{stackSize}</span>
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            )}
            <div className="detail-card-actions">
              <a
                href={`https://ampcode.com/threads/${thread.id}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Open in browser"
              >
                <ExternalLink size={14} />
              </a>
              <button onClick={() => onArchive(thread.id)} title="Archive">
                <Archive size={14} />
              </button>
              <button onClick={() => onDelete(thread.id)} title="Delete" className="delete-btn">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        </div>

        <h3 className="detail-card-title">{thread.title}</h3>

        {thread.workspace && (
          <div className="detail-card-workspace">
            <Folder size={11} />
            {thread.workspace}
          </div>
        )}

        <div className="detail-card-meta">
          <span className="detail-card-time">{formatRelativeTime(thread.lastUpdated)}</span>
          <span className="detail-card-stat">
            <MessageSquare size={11} />
            {thread.messages}
          </span>
          {thread.contextPercent !== undefined && (
            <span className={`detail-card-stat ${thread.contextPercent > 80 ? 'warning' : ''}`}>
              {thread.contextPercent}%
            </span>
          )}
          {thread.cost !== undefined && (
            <span className="detail-card-stat cost">${thread.cost.toFixed(2)}</span>
          )}
        </div>

        {touchedFiles.length > 0 && (
          <div className="detail-card-files">
            <FileText size={11} />
            {touchedFiles.slice(0, 3).map((file, idx) => (
              <span key={idx} className="detail-card-file" title={file}>
                {getFilename(file)}
              </span>
            ))}
            {touchedFiles.length > 3 && (
              <span className="detail-card-files-more">+{touchedFiles.length - 3}</span>
            )}
          </div>
        )}

        {meta?.linked_issue_url && (
          <div className="detail-card-issue">
            <LinkedIssueBadge url={meta.linked_issue_url} compact />
          </div>
        )}

        {blockerCount > 0 && (
          <div className="detail-card-blockers">
            <GitBranch size={11} />
            Blocked by {blockerCount}
          </div>
        )}
      </div>

      {hasStack && isExpanded && stackAncestors && stackAncestors.length > 0 && (
        <div className="stack-ancestors">
          {stackAncestors.map((ancestor) => {
            const ancestorMeta = metadata[ancestor.id];
            return (
              <div
                key={ancestor.id}
                className={`detail-card stack-child status-${ancestorMeta?.status || 'active'}`}
                onClick={() => onContinue(ancestor)}
              >
                <div className="detail-card-header">
                  <ThreadStatusBadge
                    threadId={ancestor.id}
                    status={ancestorMeta?.status || 'active'}
                    onStatusChange={(s) => onStatusChange?.(ancestor.id, s)}
                    compact
                  />
                </div>
                <h3 className="detail-card-title">{ancestor.title}</h3>
                <div className="detail-card-meta">
                  <span className="detail-card-time">{formatRelativeTime(ancestor.lastUpdated)}</span>
                  {ancestor.cost !== undefined && (
                    <span className="detail-card-stat cost">${ancestor.cost.toFixed(2)}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
