import { useState, useCallback, useRef } from 'react';
import { useThreadContext } from './contexts/ThreadContext';
import { useModalContext } from './contexts/ModalContext';
import { useRunningThreads } from './hooks/useRunningThreads';
import { useFilters } from './hooks/useFilters';
import { useSettingsContext } from './contexts/SettingsContext';
import { ThreadList } from './components/ThreadList';
import { Toolbar } from './components/Toolbar';
import { TerminalManager } from './components/TerminalManager';
import { Sidebar } from './components/Sidebar';
import { LoadingToast } from './components/LoadingToast';
import { AppModals } from './components/AppModals';
import { createLoadingState, advanceStep, type LoadingState } from './utils/loadingState';
import type { Thread } from './types';
import './styles/index.css';

function App() {
  const threadCtx = useThreadContext();
  const modals = useModalContext();
  const settings = useSettingsContext();
  const { runningThreads } = useRunningThreads();
  const filters = useFilters({ threads: threadCtx.threads, metadata: threadCtx.metadata });

  const [refreshLoading, setRefreshLoading] = useState<LoadingState | null>(null);
  const loadingStepRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const advance = (prev: LoadingState | null) => prev ? advanceStep(prev) : null;
  const handleRefreshWithSteps = useCallback(async () => {
    if (loadingStepRef.current) clearTimeout(loadingStepRef.current);
    setRefreshLoading(createLoadingState('Syncing Threads', [
      'Fetching thread list...', 'Loading metadata...', 'Updating labels...',
    ]));
    try {
      await threadCtx.refetch();
      setRefreshLoading(advance);
      await new Promise(r => setTimeout(r, 200));
      setRefreshLoading(advance);
      await new Promise(r => setTimeout(r, 300));
      setRefreshLoading(advance);
      loadingStepRef.current = setTimeout(() => setRefreshLoading(null), 400);
      settings.triggerScmRefresh();
    } catch {
      setRefreshLoading(null);
    }
  }, [threadCtx, settings]);

  const handleReset = useCallback(() => {
    filters.setSearchInput(''); filters.setFilterRepo(null);
    filters.setFilterWorkspace(null); filters.setFilterLabel(null);
    filters.setFilterStatus(null); threadCtx.handleCloseAll();
    settings.handleViewModeChange('table');
  }, [filters, threadCtx, settings]);

  const handleNewThread = useCallback(() => modals.setWorkspacePickerOpen(true), [modals]);
  const handleContinue = useCallback((thread: Thread) => {
    threadCtx.handleContinue(thread); threadCtx.setActiveThreadId(thread.id);
  }, [threadCtx]);

  return (
    <div className="app">
      <div className="app-layout">
        <Sidebar
          threads={threadCtx.threads}
          metadata={threadCtx.metadata}
          onSelectThread={handleContinue}
          activeThreadId={threadCtx.activeThreadId}
          runningThreads={runningThreads}
          onArchiveThread={threadCtx.handleArchive}
          onOpenInBrowser={(id: string) => window.open(`https://ampcode.com/threads/${id}`, '_blank')}
          onDeleteThread={threadCtx.handleDelete}
          onCopyThreadId={(id: string) => void navigator.clipboard.writeText(id)}
          onCopyThreadUrl={(id: string) => void navigator.clipboard.writeText(`https://ampcode.com/threads/${id}`)}
          onOpenTerminal={modals.shellTerminal?.minimized ? modals.restoreShellTerminal : modals.openShellTerminal}
          terminalMinimized={modals.shellTerminal?.minimized}
        />

        <main className="main">
          <Toolbar
            searchValue={filters.searchInput}
            onSearchChange={filters.setSearchInput}
            onRefresh={handleRefreshWithSteps}
            loading={threadCtx.loading || !!refreshLoading}
            onOpenThread={handleContinue}
            onNewThread={handleNewThread}
            onReset={handleReset}
            threads={threadCtx.threads}
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

          {threadCtx.error && <div className="error">Error: {threadCtx.error}</div>}

          {threadCtx.loading && threadCtx.threads.length === 0 ? (
            <div className="loading">Loading threads...</div>
          ) : (
            <ThreadList
              threads={filters.filteredThreads}
              metadata={threadCtx.metadata}
              threadLabels={filters.threadLabels}
              sortField={filters.sortField}
              sortDirection={filters.sortDirection}
              onSort={filters.handleSort}
              onContinue={handleContinue}
              onArchive={threadCtx.handleArchive}
              onDelete={threadCtx.handleDelete}
              onBulkArchive={threadCtx.handleBulkArchive}
              onBulkDelete={threadCtx.handleBulkDelete}
              onBulkStatusChange={threadCtx.handleBulkStatusChange}
              onStatusChange={threadCtx.updateStatus}
              viewMode={settings.viewMode}
              groupByDate={settings.groupByDate}
            />
          )}
        </main>
      </div>

      {threadCtx.openThreads.length > 0 && (
        <TerminalManager
          threads={threadCtx.openThreads}
          onClose={threadCtx.handleCloseThread}
          onCloseAll={threadCtx.handleCloseAll}
          onActiveChange={threadCtx.setActiveThreadId}
          onHandoff={(id: string) => threadCtx.setHandoffThreadId(id)}
          onNewThread={handleNewThread}
          onOpenThread={handleContinue}
          focusThreadId={threadCtx.focusThreadId}
        />
      )}

      <AppModals
        onRefresh={handleRefreshWithSteps}
        onNewThread={handleNewThread}
        setThreadLabels={filters.setThreadLabels}
      />

      <LoadingToast state={refreshLoading} />
    </div>
  );
}

export default App;
