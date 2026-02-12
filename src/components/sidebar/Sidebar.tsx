import { memo } from 'react';
import { SidebarHeader } from './SidebarHeader';
import { SidebarSearch } from './SidebarSearch';
import { PinnedSection } from './PinnedSection';
import { WorkspaceNode } from './WorkspaceNode';
import { SidebarContextMenu } from './SidebarContextMenu';
import { useSidebarState } from './useSidebarState';
import type { SidebarProps } from './types';

export const Sidebar = memo(function Sidebar({
  threads,
  metadata,
  collapsed,
  onToggleCollapse,
  onSelectThread,
  activeThreadId,
  runningThreads = {},
  onArchiveThread,
  onOpenInBrowser,
  onDeleteThread,
  onCopyThreadId,
  onCopyThreadUrl,
  scmRefreshKey,
  onOpenTerminal,
  terminalMinimized,
}: SidebarProps) {
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

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`} tabIndex={0}>
      <SidebarHeader
        collapsed={collapsed}
        runningCount={runningCount}
        allExpanded={allExpanded}
        onToggleCollapse={onToggleCollapse}
        onToggleAllWorkspaces={toggleAllWorkspaces}
      />

      {!collapsed && (
        <SidebarSearch
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      )}
      
      <div className="sidebar-content" ref={sidebarContentRef}>
        {!collapsed && (
          <PinnedSection
            threads={pinnedThreads}
            metadata={metadata}
            activeThreadId={activeThreadId}
            runningThreads={runningThreads}
            expanded={pinnedExpanded}
            onToggleExpanded={() => setPinnedExpanded(!pinnedExpanded)}
            focusedThreadId={focusedThreadId}
            onSelectThread={onSelectThread}
            onArchiveThread={onArchiveThread}
            onOpenInBrowser={onOpenInBrowser}
            onTogglePin={togglePin}
            onContextMenu={handleContextMenu}
          />
        )}

        {workspaceGroups.map(group => (
          <WorkspaceNode
            key={group.workspace}
            group={group}
            metadata={metadata}
            expanded={expandedWorkspaces.has(group.workspace)}
            onToggle={() => toggleWorkspace(group.workspace)}
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
            title={terminalMinimized ? "Restore Terminal (Ctrl+T)" : "Open Terminal (Ctrl+T)"}
            aria-label={terminalMinimized ? "Restore Terminal" : "Open Terminal"}
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
        onOpenInBrowser={onOpenInBrowser && contextMenu.thread ? () => onOpenInBrowser(contextMenu.thread!.id) : undefined}
        onCopyId={onCopyThreadId && contextMenu.thread ? () => onCopyThreadId(contextMenu.thread!.id) : undefined}
        onCopyUrl={onCopyThreadUrl && contextMenu.thread ? () => onCopyThreadUrl(contextMenu.thread!.id) : undefined}
        onArchive={onArchiveThread && contextMenu.thread ? () => onArchiveThread(contextMenu.thread!.id) : undefined}
        onDelete={onDeleteThread && contextMenu.thread ? () => onDeleteThread(contextMenu.thread!.id) : undefined}
      />
    </aside>
  );
});
