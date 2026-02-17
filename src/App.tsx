import { useState, useCallback, lazy, Suspense, useRef } from 'react';
import { useThreads } from './hooks/useThreads';
import { useThreadMetadata } from './hooks/useThreadMetadata';
import { useRunningThreads } from './hooks/useRunningThreads';
import { useThreadActions } from './hooks/useThreadActions';
import { useModals } from './hooks/useModals';
import { useFilters } from './hooks/useFilters';
import { useSettingsContext } from './contexts/SettingsContext';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

import { ThreadList } from './components/ThreadList';
import { Toolbar } from './components/Toolbar';
import { TerminalManager } from './components/TerminalManager';

const CommandPalette = lazy(() => import('./components/CommandPalette').then(m => ({ default: m.CommandPalette })));
const WorkspacePicker = lazy(() => import('./components/WorkspacePicker').then(m => ({ default: m.WorkspacePicker })));
const HandoffModal = lazy(() => import('./components/HandoffModal').then(m => ({ default: m.HandoffModal })));
const BlockerModal = lazy(() => import('./components/BlockerModal').then(m => ({ default: m.BlockerModal })));
const OutputModal = lazy(() => import('./components/OutputModal').then(m => ({ default: m.OutputModal })));

import { LoadingToast } from './components/LoadingToast';
import { Sidebar } from './components/Sidebar';
import { ShellTerminal } from './components/ShellTerminal';
import { createLoadingState, advanceStep, type LoadingState } from './utils/loadingState';
import { useCommands } from './hooks/useCommands';
import { apiGet, apiPut } from './api/client';
import type { Thread } from './types';
import './styles/index.css';

function App() {
  // Core data hooks
  const { threads, loading, error, refetch, removeThread } = useThreads();
  const { metadata, updateStatus, addBlocker, removeBlocker } = useThreadMetadata();
  const { runningThreads } = useRunningThreads();

  // Thread actions hook
  const threadActions = useThreadActions({
    threads,
    refetch,
    removeThread,
    updateStatus,
    addBlocker,
    removeBlocker,
  });

  // Modals hook
  const modals = useModals();

  // Filters hook
  const filters = useFilters({ threads, metadata });

  // App settings from context
  const settings = useSettingsContext();

  // Loading state for refresh
  const [refreshLoading, setRefreshLoading] = useState<LoadingState | null>(null);
  const loadingStepRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Wrapped refresh with loading steps
  const handleRefreshWithSteps = useCallback(async () => {
    if (loadingStepRef.current) clearTimeout(loadingStepRef.current);
    
    const state = createLoadingState('Syncing Threads', [
      'Fetching thread list...',
      'Loading metadata...',
      'Updating labels...',
    ]);
    setRefreshLoading(state);

    try {
      await refetch();
      setRefreshLoading((prev: LoadingState | null) => prev ? advanceStep(prev) : null);
      
      await new Promise(r => setTimeout(r, 200));
      setRefreshLoading((prev: LoadingState | null) => prev ? advanceStep(prev) : null);
      
      await new Promise(r => setTimeout(r, 300));
      setRefreshLoading((prev: LoadingState | null) => prev ? advanceStep(prev) : null);
      
      loadingStepRef.current = setTimeout(() => {
        setRefreshLoading(null);
      }, 400);
      
      settings.triggerScmRefresh();
    } catch {
      setRefreshLoading(null);
    }
  }, [refetch, settings]);

  // Reset handler — clears all filters, search, and open threads
  const handleReset = useCallback(() => {
    filters.setSearchInput('');
    filters.setFilterRepo(null);
    filters.setFilterWorkspace(null);
    filters.setFilterLabel(null);
    filters.setFilterStatus(null);
    threadActions.handleCloseAll();
    settings.handleViewModeChange('table');
  }, [filters, threadActions, settings]);

  // New thread handler
  const handleNewThread = useCallback(() => {
    modals.setWorkspacePickerOpen(true);
  }, [modals]);

  // Thread navigation handlers
  const handleSwitchToPrevious = useCallback(() => {
    if (!threadActions.activeThreadId || threadActions.openThreads.length < 2) return;
    const idx = threadActions.openThreads.findIndex(t => t.id === threadActions.activeThreadId);
    const prevIdx = idx > 0 ? idx - 1 : threadActions.openThreads.length - 1;
    threadActions.setActiveThreadId(threadActions.openThreads[prevIdx].id);
  }, [threadActions]);

  const handleSwitchToNext = useCallback(() => {
    if (!threadActions.activeThreadId || threadActions.openThreads.length < 2) return;
    const idx = threadActions.openThreads.findIndex(t => t.id === threadActions.activeThreadId);
    const nextIdx = idx < threadActions.openThreads.length - 1 ? idx + 1 : 0;
    threadActions.setActiveThreadId(threadActions.openThreads[nextIdx].id);
  }, [threadActions]);

  // Clipboard handlers
  const handleCopyThreadId = useCallback((id: string) => {
    void navigator.clipboard.writeText(id);
  }, []);

  const handleCopyThreadUrl = useCallback((id: string) => {
    void navigator.clipboard.writeText(`https://ampcode.com/threads/${id}`);
  }, []);

  const handleOpenInBrowser = useCallback((id: string) => {
    window.open(`https://ampcode.com/threads/${id}`, '_blank');
  }, []);

  // Handoff handler
  const handleHandoff = useCallback((id: string) => {
    threadActions.setHandoffThreadId(id);
  }, [threadActions]);

  // Settings handler
  const handleOpenSettings = useCallback(async () => {
    try {
      const result = await apiGet<{ path: string }>('/api/settings-path');
      window.open(`vscode://file/${result.path}`, '_blank');
    } catch (err) {
      console.error('Failed to open settings:', err);
    }
  }, []);

  // Permissions handlers
  const handleOpenPermissionsUser = useCallback(async () => {
    try {
      const result = await apiGet<{ path: string }>('/api/settings-path');
      window.open(`vscode://file/${result.path}`, '_blank');
    } catch (err) {
      console.error('Failed to open permissions:', err);
    }
  }, []);

  const handleOpenPermissionsWorkspace = useCallback(() => {
    window.open('vscode://file/.amp/permissions.json', '_blank');
  }, []);

  // Thread map handler
  const handleThreadMap = useCallback((id: string) => {
    window.open(`https://ampcode.com/threads/${id}`, '_blank');
  }, []);

  // Label handlers
  const handleAddLabel = useCallback(async (id: string) => {
    const label = window.prompt('Enter label (lowercase, alphanumeric, hyphens):');
    if (!label) return;
    
    const labelName = label.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]*$/.test(labelName)) {
      alert('Label must be lowercase alphanumeric with hyphens');
      return;
    }
    
    try {
      const existing = await apiGet<{ name: string }[]>(`/api/thread-labels?threadId=${encodeURIComponent(id)}`);
      const newLabels = [...existing.map(l => l.name), labelName];
      await apiPut('/api/thread-labels', { threadId: id, labels: newLabels });
      filters.setThreadLabels(prev => ({ ...prev, [id]: newLabels }));
    } catch (err) {
      console.error('Failed to add label:', err);
    }
  }, [filters]);

  const handleRemoveLabel = useCallback(async (id: string) => {
    try {
      const existing = await apiGet<{ name: string }[]>(`/api/thread-labels?threadId=${encodeURIComponent(id)}`);
      if (existing.length === 0) {
        alert('This thread has no labels');
        return;
      }
      const labelToRemove = window.prompt(`Enter label to remove:\nCurrent labels: ${existing.map(l => l.name).join(', ')}`);
      if (!labelToRemove) return;
      
      const newLabels = existing.filter(l => l.name !== labelToRemove.toLowerCase()).map(l => l.name);
      await apiPut('/api/thread-labels', { threadId: id, labels: newLabels });
      filters.setThreadLabels(prev => ({ ...prev, [id]: newLabels }));
    } catch (err) {
      console.error('Failed to remove label:', err);
    }
  }, [filters]);

  // Blocker handlers
  const handleManageBlockers = useCallback((threadId: string) => {
    modals.setBlockerThreadId(threadId);
  }, [modals]);

  const handleAddBlocker = useCallback(async (blockedByThreadId: string, reason?: string) => {
    if (!modals.blockerThreadId) return;
    try {
      await addBlocker(modals.blockerThreadId, blockedByThreadId, reason);
    } catch (err) {
      console.error('Failed to add blocker:', err);
    }
  }, [modals.blockerThreadId, addBlocker]);

  const handleRemoveBlocker = useCallback(async (blockedByThreadId: string) => {
    if (!modals.blockerThreadId) return;
    try {
      await removeBlocker(modals.blockerThreadId, blockedByThreadId);
    } catch (err) {
      console.error('Failed to remove blocker:', err);
    }
  }, [modals.blockerThreadId, removeBlocker]);

  // Track active thread when continuing
  const handleContinueWithTracking = useCallback((thread: Thread) => {
    threadActions.handleContinue(thread);
    threadActions.setActiveThreadId(thread.id);
  }, [threadActions]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    handlers: {
      onOpenCommandPalette: () => modals.setCommandPaletteOpen(true),
      onNewThread: handleNewThread,
      onRefresh: handleRefreshWithSteps,
      onCloseThread: () => threadActions.activeThreadId && threadActions.handleCloseThread(threadActions.activeThreadId),
      onOpenSettings: handleOpenSettings,
      onHandoff: () => threadActions.activeThreadId && handleHandoff(threadActions.activeThreadId),
      onToggleSidebar: settings.handleToggleSidebar,
      onOpenShellTerminal: modals.openShellTerminal,
    },
    activeThreadId: threadActions.activeThreadId,
  });

  // Commands for command palette
  const commands = useCommands({
    onNewThread: handleNewThread,
    onRefresh: handleRefreshWithSteps,
    onCloseAllTerminals: threadActions.handleCloseAll,
    onCloseThread: threadActions.handleCloseThread,
    openThreads: threadActions.openThreads,
    activeThreadId: threadActions.activeThreadId,
    onCopyThreadId: handleCopyThreadId,
    onCopyThreadUrl: handleCopyThreadUrl,
    onOpenInBrowser: handleOpenInBrowser,
    onArchiveThread: threadActions.handleArchive,
    onDeleteThread: threadActions.handleDelete,
    onToggleLayout: settings.handleToggleLayout,
    onHandoff: handleHandoff,
    onRenameThread: threadActions.handleRenameThread,
    onShareThread: modals.handleShareThread,
    onShowSkills: modals.handleShowSkills,
    onShowTools: modals.handleShowTools,
    onShowMcpStatus: modals.handleShowMcpStatus,
    onShowMcpList: modals.handleShowMcpList,
    onShowPermissions: modals.handleShowPermissions,
    onOpenSettings: handleOpenSettings,
    onShowHelp: modals.handleShowHelp,
    onThreadMap: handleThreadMap,
    onArchiveAndClose: threadActions.handleArchiveAndClose,
    onArchiveOldThreads: threadActions.handleArchiveOldThreads,
    onSwitchToPrevious: handleSwitchToPrevious,
    onSwitchToNext: handleSwitchToNext,
    onContextAnalyze: () => modals.handleContextAnalyze(threadActions.activeThreadId),
    onOpenPermissionsUser: handleOpenPermissionsUser,
    onOpenPermissionsWorkspace: handleOpenPermissionsWorkspace,
    onIdeConnect: modals.handleIdeConnect,
    onShowToolbox: modals.handleShowToolbox,
    onAddLabel: handleAddLabel,
    onRemoveLabel: handleRemoveLabel,
    onSkillAdd: modals.handleSkillAdd,
    onSkillRemove: modals.handleSkillRemove,
    onSkillInvoke: modals.handleSkillInvoke,
    onManageBlockers: handleManageBlockers,
    onToggleSidebar: settings.handleToggleSidebar,
    onOpenShellTerminal: modals.openShellTerminal,
  });

  return (
    <div className="app">
      <div className="app-layout">
        <Sidebar
          threads={threads}
          metadata={metadata}
          onSelectThread={handleContinueWithTracking}
          activeThreadId={threadActions.activeThreadId}
          runningThreads={runningThreads}
          onArchiveThread={threadActions.handleArchive}
          onOpenInBrowser={handleOpenInBrowser}
          onDeleteThread={threadActions.handleDelete}
          onCopyThreadId={handleCopyThreadId}
          onCopyThreadUrl={handleCopyThreadUrl}
          onOpenTerminal={modals.shellTerminal?.minimized ? modals.restoreShellTerminal : modals.openShellTerminal}
          terminalMinimized={modals.shellTerminal?.minimized}
        />
        
        <main className="main">
          <Toolbar
            searchValue={filters.searchInput}
            onSearchChange={filters.setSearchInput}
            onRefresh={handleRefreshWithSteps}
            loading={loading || !!refreshLoading}
            onOpenThread={handleContinueWithTracking}
            onNewThread={handleNewThread}
            onReset={handleReset}
            threads={threads}
            selectedRepo={filters.filterRepo}
            selectedWorkspace={filters.filterWorkspace}
            selectedLabel={filters.filterLabel}
            selectedStatus={filters.filterStatus}
            labels={filters.availableLabels}
            onRepoChange={filters.setFilterRepo}
            onWorkspaceChange={filters.setFilterWorkspace}
            onLabelChange={filters.setFilterLabel}
            onStatusChange={filters.setFilterStatus}
          />

          {error && <div className="error">Error: {error}</div>}

          {loading && threads.length === 0 ? (
            <div className="loading">Loading threads...</div>
          ) : (
            <ThreadList
              threads={filters.filteredThreads}
              metadata={metadata}
              sortField={filters.sortField}
              sortDirection={filters.sortDirection}
              onSort={filters.handleSort}
              onContinue={handleContinueWithTracking}
              onArchive={threadActions.handleArchive}
              onDelete={threadActions.handleDelete}
              onBulkArchive={threadActions.handleBulkArchive}
              onBulkDelete={threadActions.handleBulkDelete}
              onBulkStatusChange={threadActions.handleBulkStatusChange}
              onStatusChange={updateStatus}
              viewMode={settings.viewMode}
              groupByDate={settings.groupByDate}
            />
          )}
        </main>
      </div>

      {threadActions.openThreads.length > 0 && (
        <TerminalManager
          threads={threadActions.openThreads}
          onClose={threadActions.handleCloseThread}
          onCloseAll={threadActions.handleCloseAll}
          onActiveChange={threadActions.setActiveThreadId}
          onHandoff={handleHandoff}
          onNewThread={handleNewThread}
          onOpenThread={handleContinueWithTracking}
          focusThreadId={threadActions.focusThreadId}
        />
      )}

      <Suspense fallback={null}>
        <CommandPalette
          commands={commands}
          isOpen={modals.commandPaletteOpen}
          onClose={() => modals.setCommandPaletteOpen(false)}
        />

        <OutputModal
          title={modals.outputModal?.title || ''}
          content={modals.outputModal?.content || ''}
          isOpen={!!modals.outputModal}
          onClose={() => modals.setOutputModal(null)}
        />

        <WorkspacePicker
          isOpen={modals.workspacePickerOpen}
          onClose={() => modals.setWorkspacePickerOpen(false)}
          onSelect={threadActions.handleCreateThreadInWorkspace}
        />

        <HandoffModal
          isOpen={!!threadActions.handoffThreadId}
          threadId={threadActions.handoffThreadId || ''}
          threadTitle={threads.find(t => t.id === threadActions.handoffThreadId)?.title}
          onConfirm={threadActions.handleHandoffConfirm}
          onCancel={() => threadActions.setHandoffThreadId(null)}
        />

        <BlockerModal
          isOpen={!!modals.blockerThreadId}
          threadId={modals.blockerThreadId || ''}
          threadTitle={threads.find(t => t.id === modals.blockerThreadId)?.title || ''}
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- metadata lookup may be undefined
          blockers={metadata[modals.blockerThreadId ?? '']?.blockers || []}
          threads={threads}
          onAddBlocker={handleAddBlocker}
          onRemoveBlocker={handleRemoveBlocker}
          onClose={() => modals.setBlockerThreadId(null)}
          onOpenThread={handleContinueWithTracking}
        />
      </Suspense>

      {modals.shellTerminal && (
        <ShellTerminal
          cwd={modals.shellTerminal.cwd}
          onClose={modals.closeShellTerminal}
          onMinimize={modals.minimizeShellTerminal}
          minimized={modals.shellTerminal.minimized}
        />
      )}

      <LoadingToast state={refreshLoading} />
    </div>
  );
}

export default App;
