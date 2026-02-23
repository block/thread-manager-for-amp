import { useCallback } from 'react';
import { useModalContext } from '../contexts/ModalContext';
import { useThreadContext } from '../contexts/ThreadContext';
import { useSettingsContext } from '../contexts/SettingsContext';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { useCommands } from './useCommands';
import { useModalActions } from './useModalActions';
import { useErrorToast } from './useErrorToast';
import { apiGet, apiPut, apiPost } from '../api/client';
import type { Thread } from '../types';
import type { Command } from '../commands';

export interface UseAppModalHandlersOptions {
  onRefresh: () => void;
  onNewThread: () => void;
  setThreadLabels: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
}

export interface UseAppModalHandlersReturn {
  modals: ReturnType<typeof useModalContext>;
  threadActions: ReturnType<typeof useThreadContext>;
  commands: Command[];
  errors: ReturnType<typeof useErrorToast>['errors'];
  dismissError: ReturnType<typeof useErrorToast>['dismissError'];
  handleContinueWithTracking: (thread: Thread) => void;
  handleAddBlocker: (blockedByThreadId: string, reason?: string) => Promise<void>;
  handleRemoveBlocker: (blockedByThreadId: string) => Promise<void>;
}

export function useAppModalHandlers({
  onRefresh,
  onNewThread,
  setThreadLabels,
}: UseAppModalHandlersOptions): UseAppModalHandlersReturn {
  const modals = useModalContext();
  const threadActions = useThreadContext();
  const settings = useSettingsContext();
  const { errors, showError, dismissError } = useErrorToast();
  const modalActions = useModalActions(modals, showError);

  const { activeThreadId, addBlocker, removeBlocker } = threadActions;

  const handleContinueWithTracking = useCallback(
    (thread: Thread) => {
      threadActions.handleContinue(thread);
      threadActions.setActiveThreadId(thread.id);
    },
    [threadActions],
  );

  const handleSwitchToPrevious = useCallback(() => {
    if (!activeThreadId || threadActions.openThreads.length < 2) return;
    const idx = threadActions.openThreads.findIndex((t) => t.id === activeThreadId);
    const prevIdx = idx > 0 ? idx - 1 : threadActions.openThreads.length - 1;
    const prevThread = threadActions.openThreads[prevIdx];
    if (prevThread) threadActions.setActiveThreadId(prevThread.id);
  }, [activeThreadId, threadActions]);

  const handleSwitchToNext = useCallback(() => {
    if (!activeThreadId || threadActions.openThreads.length < 2) return;
    const idx = threadActions.openThreads.findIndex((t) => t.id === activeThreadId);
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

  const handleHandoff = useCallback(
    (id: string) => {
      threadActions.setHandoffThreadId(id);
    },
    [threadActions],
  );

  const handleThreadMap = useCallback(
    (id: string) => {
      modalActions.handleThreadMap(id);
    },
    [modalActions],
  );

  const handleAddLabel = useCallback(
    (id: string) => {
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
            const existing = await apiGet<{ name: string }[]>(
              `/api/thread-labels?threadId=${encodeURIComponent(id)}`,
            );
            const newLabels = [...existing.map((l) => l.name), labelName];
            await apiPut('/api/thread-labels', { threadId: id, labels: newLabels });
            setThreadLabels((prev) => ({ ...prev, [id]: newLabels }));
          } catch (err) {
            console.error('Failed to add label:', err);
            showError('Failed to add label');
          }
        },
      });
    },
    [modals, setThreadLabels, showError],
  );

  const handleRemoveLabel = useCallback(
    async (id: string) => {
      try {
        const existing = await apiGet<{ name: string }[]>(
          `/api/thread-labels?threadId=${encodeURIComponent(id)}`,
        );
        if (existing.length === 0) {
          showError('This thread has no labels');
          return;
        }
        modals.setInputModal({
          title: 'Remove Label',
          label: `Current labels: ${existing.map((l) => l.name).join(', ')}`,
          placeholder: 'Enter label to remove',
          confirmText: 'Remove',
          onConfirm: async (labelToRemove: string) => {
            modals.setInputModal(null);
            try {
              const newLabels = existing
                .filter((l) => l.name !== labelToRemove.toLowerCase())
                .map((l) => l.name);
              await apiPut('/api/thread-labels', { threadId: id, labels: newLabels });
              setThreadLabels((prev) => ({ ...prev, [id]: newLabels }));
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
    },
    [modals, setThreadLabels, showError],
  );

  const handleUndoLastTurn = useCallback(() => {
    if (!activeThreadId) return;
    modals.setConfirmModal({
      title: 'Undo Last Turn',
      message:
        'This will remove the last user message and all subsequent assistant responses. This cannot be undone.',
      confirmText: 'Undo',
      isDestructive: true,
      onConfirm: () => {
        modals.setConfirmModal(null);
        apiPost('/api/thread-undo', { threadId: activeThreadId })
          .then(() => onRefresh())
          .catch((err: unknown) => {
            console.error('Failed to undo:', err);
            showError('Failed to undo last turn');
          });
      },
    });
  }, [activeThreadId, modals, onRefresh, showError]);

  const handleManageBlockers = useCallback(
    (threadId: string) => {
      modals.setBlockerThreadId(threadId);
    },
    [modals],
  );

  const handleAddBlocker = useCallback(
    async (blockedByThreadId: string, reason?: string) => {
      if (!modals.blockerThreadId) return;
      try {
        await addBlocker(modals.blockerThreadId, blockedByThreadId, reason);
      } catch (err) {
        console.error('Failed to add blocker:', err);
        showError('Failed to add blocker');
      }
    },
    [modals.blockerThreadId, addBlocker, showError],
  );

  const handleRemoveBlocker = useCallback(
    async (blockedByThreadId: string) => {
      if (!modals.blockerThreadId) return;
      try {
        await removeBlocker(modals.blockerThreadId, blockedByThreadId);
      } catch (err) {
        console.error('Failed to remove blocker:', err);
        showError('Failed to remove blocker');
      }
    },
    [modals.blockerThreadId, removeBlocker, showError],
  );

  useKeyboardShortcuts({
    handlers: {
      onOpenCommandPalette: () => modals.setCommandPaletteOpen(true),
      onNewThread: onNewThread,
      onRefresh: onRefresh,
      onCloseThread: () => activeThreadId && threadActions.handleCloseThread(activeThreadId),
      onCloseAllThreads: threadActions.handleCloseAll,
      onHandoff: () => activeThreadId && handleHandoff(activeThreadId),
      onToggleSidebar: settings.handleToggleSidebar,
      onOpenShellTerminal: modals.openShellTerminal,
      onToggleDeepMode: settings.toggleDeepMode,
      onToggleThinkingBlocks: settings.toggleThinkingBlocks,
      onThreadMap: () => activeThreadId && handleThreadMap(activeThreadId),
      onOpenPromptHistory: () => modals.setPromptHistoryOpen(true),
      onUndoLastTurn: handleUndoLastTurn,
      onSwitchToPrevious: handleSwitchToPrevious,
      onSwitchToNext: handleSwitchToNext,
      onToggleLayout: settings.handleToggleLayout,
      onArchiveAndClose: () =>
        activeThreadId && threadActions.handleArchiveAndClose(activeThreadId),
    },
    activeThreadId,
    activeThreadModeLocked: settings.activeThreadModeLocked,
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
    onShowHelp: modalActions.handleShowHelp,
    onThreadMap: handleThreadMap,
    onArchiveAndClose: threadActions.handleArchiveAndClose,
    onArchiveOldThreads: threadActions.handleArchiveOldThreads,
    onSwitchToPrevious: handleSwitchToPrevious,
    onSwitchToNext: handleSwitchToNext,
    onContextAnalyze: () => modalActions.handleContextAnalyze(activeThreadId),
    onAddLabel: handleAddLabel,
    onRemoveLabel: handleRemoveLabel,
    onSkillAdd: modalActions.handleSkillAdd,
    onSkillRemove: modalActions.handleSkillRemove,
    onSkillInfo: modalActions.handleSkillInfo,
    onManageBlockers: handleManageBlockers,
    onToggleSidebar: settings.handleToggleSidebar,
    onOpenShellTerminal: modals.openShellTerminal,
    onReplayThread: modalActions.handleReplayThread,
    onCodeReview: modalActions.handleCodeReview,
    onOpenPromptHistory: () => modals.setPromptHistoryOpen(true),
    onUndoLastTurn: handleUndoLastTurn,
  });

  return {
    modals,
    threadActions,
    commands,
    errors,
    dismissError,
    handleContinueWithTracking,
    handleAddBlocker,
    handleRemoveBlocker,
  };
}
