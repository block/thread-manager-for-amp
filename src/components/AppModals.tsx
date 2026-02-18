import { lazy, Suspense, useCallback } from 'react';
import { useModalContext } from '../contexts/ModalContext';
import { useThreadContext } from '../contexts/ThreadContext';
import { useSettingsContext } from '../contexts/SettingsContext';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useCommands } from '../hooks/useCommands';
import { useModalActions } from '../hooks/useModalActions';
import { useErrorToast } from '../hooks/useErrorToast';
import { ShellTerminal } from './ShellTerminal';
import { InputModal } from './InputModal';
import { ConfirmModal } from './ConfirmModal';
import { ErrorToast } from './ErrorToast';
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
  const { errors, showError, dismissError } = useErrorToast();
  const modalActions = useModalActions(modals, showError);

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
      showError('Failed to open settings');
    }
  }, [showError]);

  const handleOpenPermissionsUser = useCallback(async () => {
    try {
      const result = await apiGet<{ path: string }>('/api/settings-path');
      window.open(`vscode://file/${result.path}`, '_blank');
    } catch (err) {
      console.error('Failed to open permissions:', err);
      showError('Failed to open permissions');
    }
  }, [showError]);

  const handleOpenPermissionsWorkspace = useCallback(() => {
    window.open('vscode://file/.amp/permissions.json', '_blank');
  }, []);

  const handleThreadMap = useCallback((id: string) => {
    window.open(`https://ampcode.com/threads/${id}`, '_blank');
  }, []);

  const handleAddLabel = useCallback((id: string) => {
    modals.setInputModal({
      title: 'Add Label',
      label: 'Label name',
      placeholder: 'lowercase, alphanumeric, hyphens',
      confirmText: 'Add',
      validate: (value: string) => {
        const labelName = value.trim().toLowerCase();
        if (!/^[a-z0-9][a-z0-9-]*$/.test(labelName)) {
          return 'Label must be lowercase alphanumeric with hyphens';
        }
        return null;
      },
      onConfirm: async (value: string) => {
        const labelName = value.trim().toLowerCase();
        modals.setInputModal(null);
        try {
          const existing = await apiGet<{ name: string }[]>(`/api/thread-labels?threadId=${encodeURIComponent(id)}`);
          const newLabels = [...existing.map(l => l.name), labelName];
          await apiPut('/api/thread-labels', { threadId: id, labels: newLabels });
          setThreadLabels(prev => ({ ...prev, [id]: newLabels }));
        } catch (err) {
          console.error('Failed to add label:', err);
          showError('Failed to add label');
        }
      },
    });
  }, [modals, setThreadLabels, showError]);

  const handleRemoveLabel = useCallback(async (id: string) => {
    try {
      const existing = await apiGet<{ name: string }[]>(`/api/thread-labels?threadId=${encodeURIComponent(id)}`);
      if (existing.length === 0) {
        showError('This thread has no labels');
        return;
      }
      modals.setInputModal({
        title: 'Remove Label',
        label: `Current labels: ${existing.map(l => l.name).join(', ')}`,
        placeholder: 'Enter label to remove',
        confirmText: 'Remove',
        onConfirm: async (labelToRemove: string) => {
          modals.setInputModal(null);
          try {
            const newLabels = existing.filter(l => l.name !== labelToRemove.toLowerCase()).map(l => l.name);
            await apiPut('/api/thread-labels', { threadId: id, labels: newLabels });
            setThreadLabels(prev => ({ ...prev, [id]: newLabels }));
          } catch (err) {
            console.error('Failed to remove label:', err);
            showError('Failed to remove label');
          }
        },
      });
    } catch (err) {
      console.error('Failed to load labels:', err);
      showError('Failed to load labels');
    }
  }, [modals, setThreadLabels, showError]);

  const handleManageBlockers = useCallback((threadId: string) => {
    modals.setBlockerThreadId(threadId);
  }, [modals]);

  const handleAddBlocker = useCallback(async (blockedByThreadId: string, reason?: string) => {
    if (!modals.blockerThreadId) return;
    try {
      await addBlocker(modals.blockerThreadId, blockedByThreadId, reason);
    } catch (err) {
      console.error('Failed to add blocker:', err);
      showError('Failed to add blocker');
    }
  }, [modals.blockerThreadId, addBlocker, showError]);

  const handleRemoveBlocker = useCallback(async (blockedByThreadId: string) => {
    if (!modals.blockerThreadId) return;
    try {
      await removeBlocker(modals.blockerThreadId, blockedByThreadId);
    } catch (err) {
      console.error('Failed to remove blocker:', err);
      showError('Failed to remove blocker');
    }
  }, [modals.blockerThreadId, removeBlocker, showError]);

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
    onShareThread: modalActions.handleShareThread,
    onShowSkills: modalActions.handleShowSkills,
    onShowTools: modalActions.handleShowTools,
    onShowMcpStatus: modalActions.handleShowMcpStatus,
    onShowMcpList: modalActions.handleShowMcpList,
    onShowPermissions: modalActions.handleShowPermissions,
    onOpenSettings: handleOpenSettings,
    onShowHelp: modalActions.handleShowHelp,
    onThreadMap: handleThreadMap,
    onArchiveAndClose: threadActions.handleArchiveAndClose,
    onArchiveOldThreads: threadActions.handleArchiveOldThreads,
    onSwitchToPrevious: handleSwitchToPrevious,
    onSwitchToNext: handleSwitchToNext,
    onContextAnalyze: () => modalActions.handleContextAnalyze(activeThreadId),
    onOpenPermissionsUser: handleOpenPermissionsUser,
    onOpenPermissionsWorkspace: handleOpenPermissionsWorkspace,
    onIdeConnect: modalActions.handleIdeConnect,
    onShowToolbox: modalActions.handleShowToolbox,
    onAddLabel: handleAddLabel,
    onRemoveLabel: handleRemoveLabel,
    onSkillAdd: modalActions.handleSkillAdd,
    onSkillRemove: modalActions.handleSkillRemove,
    onSkillInvoke: modalActions.handleSkillInvoke,
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

      <InputModal
        isOpen={!!modals.inputModal}
        title={modals.inputModal?.title ?? ''}
        label={modals.inputModal?.label ?? ''}
        placeholder={modals.inputModal?.placeholder}
        confirmText={modals.inputModal?.confirmText}
        validate={modals.inputModal?.validate}
        onConfirm={(value) => modals.inputModal?.onConfirm(value)}
        onCancel={() => modals.setInputModal(null)}
      />

      {modals.confirmModal && (
        <ConfirmModal
          title={modals.confirmModal.title}
          message={modals.confirmModal.message}
          confirmText={modals.confirmModal.confirmText}
          isDestructive={modals.confirmModal.isDestructive}
          onConfirm={modals.confirmModal.onConfirm}
          onCancel={() => modals.setConfirmModal(null)}
        />
      )}

      {modals.shellTerminal && (
        <ShellTerminal
          cwd={modals.shellTerminal.cwd}
          onClose={modals.closeShellTerminal}
          onMinimize={modals.minimizeShellTerminal}
          minimized={modals.shellTerminal.minimized}
        />
      )}

      <ErrorToast errors={errors} onDismiss={dismissError} />
    </>
  );
}
