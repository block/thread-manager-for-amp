import { memo, useState, useCallback, useMemo } from 'react';
import { 
  ChevronRight, 
  ChevronDown, 
  Folder, 
  FolderOpen,
  GitBranch,
} from 'lucide-react';
import { ThreadNode } from './ThreadNode';
import { WorkspaceSourceControl } from './WorkspaceSourceControl';
import type { WorkspaceNodeProps } from './types';

export const WorkspaceNode = memo(function WorkspaceNode({ 
  group, 
  metadata,
  expanded, 
  onToggle, 
  onSelectThread,
  activeThreadId,
  runningThreads,
  collapsed: sidebarCollapsed,
  onArchiveThread,
  onOpenInBrowser,
  pinnedIds,
  onTogglePin,
  focusedThreadId,
  onContextMenu,
  onExpandSidebar,
  scmRefreshKey,
}: WorkspaceNodeProps) {
  const [expandedRepos, setExpandedRepos] = useState<Set<string>>(new Set());
  const [scmExpanded, setScmExpanded] = useState(false);
  const hasRepos = group.repos.size > 0;
  const threadCount = group.threads.length;

  const toggleRepo = useCallback((repo: string) => {
    setExpandedRepos(prev => {
      const next = new Set(prev);
      if (next.has(repo)) {
        next.delete(repo);
      } else {
        next.add(repo);
      }
      return next;
    });
  }, []);

  // Stable callback maps keyed by thread ID to avoid inline arrows in .map()
  // that would defeat memo() on ThreadNode
  const threadCallbacks = useMemo(() => {
    const map = new Map<string, {
      onSelect: () => void;
      onArchive: (() => void) | undefined;
      onOpenInBrowser: (() => void) | undefined;
      onTogglePin: () => void;
      onContextMenu: (e: React.MouseEvent) => void;
    }>();
    for (const thread of group.threads) {
      map.set(thread.id, {
        onSelect: () => onSelectThread(thread),
        onArchive: onArchiveThread ? () => onArchiveThread(thread.id) : undefined,
        onOpenInBrowser: onOpenInBrowser ? () => onOpenInBrowser(thread.id) : undefined,
        onTogglePin: () => onTogglePin(thread.id),
        onContextMenu: (e: React.MouseEvent) => onContextMenu(e, thread),
      });
    }
    return map;
  }, [group.threads, onSelectThread, onArchiveThread, onOpenInBrowser, onTogglePin, onContextMenu]);

  if (sidebarCollapsed) {
    return (
      <div className="sidebar-node workspace collapsed" title={group.displayName}>
        <button className="sidebar-node-header" onClick={() => {
          onExpandSidebar?.();
          if (!expanded) onToggle();
        }}>
          <Folder size={18} />
        </button>
      </div>
    );
  }

  return (
    <div className="sidebar-node workspace">
      <button className="sidebar-node-header" onClick={onToggle}>
        <span className="sidebar-chevron">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        {expanded ? <FolderOpen size={16} /> : <Folder size={16} />}
        <span className="sidebar-node-label">{group.displayName}</span>
        <span className="sidebar-node-count">{threadCount}</span>
      </button>
      
      {expanded && (
        <>
        <div className="sidebar-node-children">
          {hasRepos && group.repos.size > 1 ? (
            // Multiple repos - show repo hierarchy
            Array.from(group.repos.entries()).map(([repo, repoThreads]) => (
              <div key={repo} className="sidebar-node repo">
                <button 
                  className="sidebar-node-header" 
                  onClick={() => toggleRepo(repo)}
                >
                  <span className="sidebar-chevron">
                    {expandedRepos.has(repo) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </span>
                  <GitBranch size={14} />
                  <span className="sidebar-node-label">{repo}</span>
                  <span className="sidebar-node-count">{repoThreads.length}</span>
                </button>
                
                {expandedRepos.has(repo) && (
                  <div className="sidebar-node-children">
                    {repoThreads.map(thread => {
                      const cbs = threadCallbacks.get(thread.id);
                      return (
                        <ThreadNode
                          key={thread.id}
                          thread={thread}
                          status={metadata[thread.id]?.status}
                          isActive={activeThreadId === thread.id}
                          runningStatus={runningThreads?.[thread.id]?.status ?? null}
                          isFocused={focusedThreadId === thread.id}
                          isPinned={pinnedIds.has(thread.id)}
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
            ))
          ) : (
            // Single repo or no repos - show threads directly (flattened)
            group.threads.map(thread => {
              const cbs = threadCallbacks.get(thread.id);
              return (
                <ThreadNode
                  key={thread.id}
                  thread={thread}
                  status={metadata[thread.id]?.status}
                  isActive={activeThreadId === thread.id}
                  runningStatus={runningThreads?.[thread.id]?.status ?? null}
                  isFocused={focusedThreadId === thread.id}
                  isPinned={pinnedIds.has(thread.id)}
                  onSelect={cbs?.onSelect ?? (() => onSelectThread(thread))}
                  onArchive={cbs?.onArchive}
                  onOpenInBrowser={cbs?.onOpenInBrowser}
                  onTogglePin={cbs?.onTogglePin ?? (() => onTogglePin(thread.id))}
                  onContextMenu={cbs?.onContextMenu ?? ((e) => onContextMenu(e, thread))}
                />
              );
            })
          )}
        </div>
        {(() => {
          const firstThread = group.threads[0];
          return firstThread?.workspacePath ? (
            <WorkspaceSourceControl
              workspacePath={firstThread.workspacePath}
              expanded={scmExpanded}
              onToggle={() => setScmExpanded(!scmExpanded)}
              refreshKey={scmRefreshKey}
            />
          ) : null;
        })()}
      </>
      )}
    </div>
  );
});
