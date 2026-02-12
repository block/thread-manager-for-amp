import { memo, useState, useCallback } from 'react';
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
                    {repoThreads.map(thread => (
                      <ThreadNode
                        key={thread.id}
                        thread={thread}
                        status={metadata[thread.id]?.status}
                        isActive={activeThreadId === thread.id}
                        runningStatus={runningThreads?.[thread.id]?.status ?? null}
                        isFocused={focusedThreadId === thread.id}
                        isPinned={pinnedIds.has(thread.id)}
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
            ))
          ) : (
            // Single repo or no repos - show threads directly (flattened)
            group.threads.map(thread => (
              <ThreadNode
                key={thread.id}
                thread={thread}
                status={metadata[thread.id]?.status}
                isActive={activeThreadId === thread.id}
                runningStatus={runningThreads?.[thread.id]?.status ?? null}
                isFocused={focusedThreadId === thread.id}
                isPinned={pinnedIds.has(thread.id)}
                onSelect={() => onSelectThread(thread)}
                onArchive={onArchiveThread ? () => onArchiveThread(thread.id) : undefined}
                onOpenInBrowser={onOpenInBrowser ? () => onOpenInBrowser(thread.id) : undefined}
                onTogglePin={() => onTogglePin(thread.id)}
                onContextMenu={(e) => onContextMenu(e, thread)}
              />
            ))
          )}
        </div>
        {group.threads.length > 0 && group.threads[0]?.workspacePath && (
          <WorkspaceSourceControl
            workspacePath={group.threads[0].workspacePath}
            expanded={scmExpanded}
            onToggle={() => setScmExpanded(!scmExpanded)}
            refreshKey={scmRefreshKey}
          />
        )}
      </>
      )}
    </div>
  );
});
