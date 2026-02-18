import { memo, useMemo, useCallback } from 'react';
import { SidebarHeader } from './SidebarHeader';
import { SidebarSearch } from './SidebarSearch';
import { PinnedSection } from './PinnedSection';
import { WorkspaceNode } from './WorkspaceNode';
import { SidebarContextMenu } from './SidebarContextMenu';
import { useSidebarState } from './useSidebarState';
import { useSettingsContext } from '../../contexts/SettingsContext';
import type { SidebarProps } from './types';

export const Sidebar = memo(function Sidebar({
  threads,
  metadata,
  onSelectThread,
  activeThreadId,
  runningThreads = {},
  onArchiveThread,
  onOpenInBrowser,
  onDeleteThread,
  onCopyThreadId,
  onCopyThreadUrl,
  onOpenTerminal,
  terminalMinimized,
}: SidebarProps) {
  const {
    sidebarCollapsed: collapsed,
    handleToggleSidebar: onToggleCollapse,
    scmRefreshKey,
  } = useSettingsContext();
  const {
    expandedWorkspaces,
    searchQuery,
    setSearchQuery,
    pinnedIds,
    pinnedExpanded,
    setPinnedExpanded,
    focusedThreadId,
    contextMenu,
    sidebarContentRef,
    togglePin,
    filteredThreads,
    pinnedThreads,
    workspaceGroups,
    toggleWorkspace,
    toggleAllWorkspaces,
    handleContextMenu,
    closeContextMenu,
    allExpanded,
  } = useSidebarState(threads, collapsed, onSelectThread);

  const runningCount = Object.keys(runningThreads).length;

  // Stable callback so PinnedSection's memo() isn't defeated
  const handleTogglePinnedExpanded = useCallback(() => {
    setPinnedExpanded((prev) => !prev);
  }, [setPinnedExpanded]);

  // Pre-compute stable toggle callbacks per workspace to avoid inline closures
  // that would defeat WorkspaceNode's memo()
  const workspaceToggleCallbacks = useMemo(() => {
    const map = new Map<string, () => void>();
    for (const group of workspaceGroups) {
      map.set(group.workspace, () => toggleWorkspace(group.workspace));
    }
    return map;
  }, [workspaceGroups, toggleWorkspace]);

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`} tabIndex={0}>
      <SidebarHeader
        collapsed={collapsed}
        runningCount={runningCount}
        allExpanded={allExpanded}
        onToggleCollapse={onToggleCollapse}
        onToggleAllWorkspaces={toggleAllWorkspaces}
      />

      {!collapsed && <SidebarSearch searchQuery={searchQuery} onSearchChange={setSearchQuery} />}

      <div className="sidebar-content" ref={sidebarContentRef}>
        {!collapsed && (
          <PinnedSection
            threads={pinnedThreads}
            metadata={metadata}
            activeThreadId={activeThreadId}
            runningThreads={runningThreads}
            expanded={pinnedExpanded}
            onToggleExpanded={handleTogglePinnedExpanded}
            focusedThreadId={focusedThreadId}
            onSelectThread={onSelectThread}
            onArchiveThread={onArchiveThread}
            onOpenInBrowser={onOpenInBrowser}
            onTogglePin={togglePin}
            onContextMenu={handleContextMenu}
          />
        )}

        {workspaceGroups.map((group) => (
          <WorkspaceNode
            key={group.workspace}
            group={group}
            metadata={metadata}
            expanded={expandedWorkspaces.has(group.workspace)}
            onToggle={
              workspaceToggleCallbacks.get(group.workspace) ??
              (() => toggleWorkspace(group.workspace))
            }
            onSelectThread={onSelectThread}
            activeThreadId={activeThreadId}
            runningThreads={runningThreads}
            collapsed={collapsed}
            onArchiveThread={onArchiveThread}
            onOpenInBrowser={onOpenInBrowser}
            pinnedIds={pinnedIds}
            onTogglePin={togglePin}
            focusedThreadId={focusedThreadId}
            onContextMenu={handleContextMenu}
            onExpandSidebar={collapsed ? onToggleCollapse : undefined}
            scmRefreshKey={scmRefreshKey}
          />
        ))}
      </div>

      <div className={`sidebar-footer ${collapsed ? 'collapsed' : ''}`}>
        {!collapsed && (
          <span className="sidebar-footer-text">
            {filteredThreads.length} threads · {workspaceGroups.length} projects
          </span>
        )}
        {onOpenTerminal && (
          <button
            className={`sidebar-footer-btn ${terminalMinimized ? 'has-session' : ''}`}
            onClick={() => onOpenTerminal()}
            title={terminalMinimized ? 'Restore Terminal (Ctrl+T)' : 'Open Terminal (Ctrl+T)'}
            aria-label={terminalMinimized ? 'Restore Terminal' : 'Open Terminal'}
          >
            <span className="terminal-icon">&gt;_</span>
            {terminalMinimized && <span className="terminal-badge">1</span>}
          </button>
        )}
      </div>

      <SidebarContextMenu
        state={contextMenu}
        onClose={closeContextMenu}
        onContinue={() => contextMenu.thread && onSelectThread(contextMenu.thread)}
        onOpenInBrowser={
          onOpenInBrowser && contextMenu.thread
            ? () => onOpenInBrowser(contextMenu.thread?.id ?? '')
            : undefined
        }
        onCopyId={
          onCopyThreadId && contextMenu.thread
            ? () => onCopyThreadId(contextMenu.thread?.id ?? '')
            : undefined
        }
        onCopyUrl={
          onCopyThreadUrl && contextMenu.thread
            ? () => onCopyThreadUrl(contextMenu.thread?.id ?? '')
            : undefined
        }
        onArchive={
          onArchiveThread && contextMenu.thread
            ? () => onArchiveThread(contextMenu.thread?.id ?? '')
            : undefined
        }
        onDelete={
          onDeleteThread && contextMenu.thread
            ? () => onDeleteThread(contextMenu.thread?.id ?? '')
            : undefined
        }
      />
    </aside>
  );
});
