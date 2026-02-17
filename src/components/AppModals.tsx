import { lazy, Suspense, useCallback } from 'react';
import { useModalContext } from '../contexts/ModalContext';
import { useThreadContext } from '../contexts/ThreadContext';
import { useSettingsContext } from '../contexts/SettingsContext';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useCommands } from '../hooks/useCommands';
import { ShellTerminal } from './ShellTerminal';
import { apiGet, apiPut } from '../api/client';
import type { Thread } from '../types';

const CommandPalette = lazy(() => import('./CommandPalette').then(m => ({ default: m.CommandPalette })));
const WorkspacePicker = lazy(() => import('./WorkspacePicker').then(m => ({ default: m.WorkspacePicker })));
const HandoffModal = lazy(() => import('./HandoffModal').then(m => ({ default: m.HandoffModal })));
const BlockerModal = lazy(() => import('./BlockerModal').then(m => ({ default: m.BlockerModal })));
const OutputModal = lazy(() => import('./OutputModal').then(m => ({ default: m.OutputModal })));

interface AppModalsProps {
  onRefresh: () => void;
  onNewThread: () => void;
  setThreadLabels: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
}

export function AppModals({ onRefresh, onNewThread, setThreadLabels }: AppModalsProps) {
  const modals = useModalContext();
  const threadActions = useThreadContext();
  const settings = useSettingsContext();

  const { threads, metadata, activeThreadId, addBlocker, removeBlocker } = threadActions;

  const handleContinueWithTracking = useCallback((thread: Thread) => {
    threadActions.handleContinue(thread);
    threadActions.setActiveThreadId(thread.id);
  }, [threadActions]);

  const handleSwitchToPrevious = useCallback(() => {
    if (!activeThreadId || threadActions.openThreads.length < 2) return;
    const idx = threadActions.openThreads.findIndex(t => t.id === activeThreadId);
    const prevIdx = idx > 0 ? idx - 1 : threadActions.openThreads.length - 1;
    const prevThread = threadActions.openThreads[prevIdx];
    if (prevThread) threadActions.setActiveThreadId(prevThread.id);
  }, [activeThreadId, threadActions]);

  const handleSwitchToNext = useCallback(() => {
    if (!activeThreadId || threadActions.openThreads.length < 2) return;
    const idx = threadActions.openThreads.findIndex(t => t.id === activeThreadId);
    const nextIdx = idx < threadActions.openThreads.length - 1 ? idx + 1 : 0;
    const nextThread = threadActions.openThreads[nextIdx];
    if (nextThread) threadActions.setActiveThreadId(nextThread.id);
  }, [activeThreadId, threadActions]);

  const handleCopyThreadId = useCallback((id: string) => {
    void navigator.clipboard.writeText(id);
  }, []);

  const handleCopyThreadUrl = useCallback((id: string) => {
    void navigator.clipboard.writeText(`https://ampcode.com/threads/${id}`);
  }, []);

  const handleOpenInBrowser = useCallback((id: string) => {
    window.open(`https://ampcode.com/threads/${id}`, '_blank');
  }, []);

  const handleHandoff = useCallback((id: string) => {
    threadActions.setHandoffThreadId(id);
  }, [threadActions]);

  const handleOpenSettings = useCallback(async () => {
    try {
      const result = await apiGet<{ path: string }>('/api/settings-path');
      window.open(`vscode://file/${result.path}`, '_blank');
    } catch (err) {
      console.error('Failed to open settings:', err);
    }
  }, []);

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

  const handleThreadMap = useCallback((id: string) => {
    window.open(`https://ampcode.com/threads/${id}`, '_blank');
  }, []);

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
      setThreadLabels(prev => ({ ...prev, [id]: newLabels }));
    } catch (err) {
      console.error('Failed to add label:', err);
    }
  }, [setThreadLabels]);

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
      setThreadLabels(prev => ({ ...prev, [id]: newLabels }));
    } catch (err) {
      console.error('Failed to remove label:', err);
    }
  }, [setThreadLabels]);

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

  useKeyboardShortcuts({
    handlers: {
      onOpenCommandPalette: () => modals.setCommandPaletteOpen(true),
      onNewThread: onNewThread,
      onRefresh: onRefresh,
      onCloseThread: () => activeThreadId && threadActions.handleCloseThread(activeThreadId),
      onOpenSettings: handleOpenSettings,
      onHandoff: () => activeThreadId && handleHandoff(activeThreadId),
      onToggleSidebar: settings.handleToggleSidebar,
      onOpenShellTerminal: modals.openShellTerminal,
    },
    activeThreadId,
  });

  const commands = useCommands({
    onNewThread: onNewThread,
    onRefresh: onRefresh,
    onCloseAllTerminals: threadActions.handleCloseAll,
    onCloseThread: threadActions.handleCloseThread,
    openThreads: threadActions.openThreads,
    activeThreadId,
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
    onContextAnalyze: () => modals.handleContextAnalyze(activeThreadId),
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
    <>
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
    </>
  );
}
