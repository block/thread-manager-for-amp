import { useState, useCallback, useMemo } from 'react';
import { apiPost, apiDelete, apiPatch } from '../api/client';
import { useSettingsContext } from '../contexts/SettingsContext';
import type { Thread, ThreadStatus } from '../types';

export interface UseThreadActionsOptions {
  threads: Thread[];
  refetch: () => void;
  removeThread: (id: string) => void;
  updateStatus: (id: string, status: ThreadStatus) => Promise<unknown>;
  addBlocker: (threadId: string, blockedBy: string, reason?: string) => Promise<unknown>;
  removeBlocker: (threadId: string, blockedBy: string) => Promise<unknown>;
  showError: (message: string) => void;
  showInputModal: (
    modal: {
      title: string;
      label: string;
      placeholder?: string;
      confirmText?: string;
      validate?: (value: string) => string | null;
      onConfirm: (value: string) => void;
    } | null,
  ) => void;
  showConfirmModal: (
    modal: {
      title: string;
      message: string;
      confirmText?: string;
      isDestructive?: boolean;
      onConfirm: () => void;
    } | null,
  ) => void;
}

export interface UseThreadActionsReturn {
  openThreads: Thread[];
  activeThreadId: string | undefined;
  focusThreadId: string | undefined;
  setActiveThreadId: (id: string | undefined) => void;
  setFocusThreadId: (id: string | undefined) => void;
  handleContinue: (thread: Thread) => void;
  handleCloseThread: (id: string) => void;
  handleCloseAll: () => void;
  handleArchive: (id: string) => Promise<void>;
  handleDelete: (id: string) => Promise<void>;
  handleBulkArchive: (ids: string[]) => Promise<void>;
  handleBulkDelete: (ids: string[]) => Promise<void>;
  handleBulkStatusChange: (ids: string[], status: ThreadStatus) => Promise<void>;
  handleCreateThreadInWorkspace: (path: string | null) => Promise<void>;
  handleHandoffConfirm: (goal: string, newTitle?: string) => Promise<void>;
  handleRenameThread: (id: string) => void;
  handleArchiveAndClose: (id: string) => Promise<void>;
  handleArchiveOldThreads: () => void;
  handoffThreadId: string | null;
  setHandoffThreadId: (id: string | null) => void;
}

export function useThreadActions({
  threads,
  refetch,
  removeThread,
  updateStatus,
  showError,
  showInputModal,
  showConfirmModal,
}: UseThreadActionsOptions): UseThreadActionsReturn {
  const { agentMode } = useSettingsContext();
  const [openThreads, setOpenThreads] = useState<Thread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | undefined>();
  const [focusThreadId, setFocusThreadId] = useState<string | undefined>();
  const [handoffThreadId, setHandoffThreadId] = useState<string | null>(null);

  const handleContinue = useCallback((thread: Thread) => {
    setOpenThreads((prev) => {
      if (prev.find((t) => t.id === thread.id)) {
        setFocusThreadId(thread.id);
        return prev;
      }
      return [...prev, thread];
    });
    setFocusThreadId(thread.id);
  }, []);

  const handleCloseThread = useCallback((threadId: string) => {
    setOpenThreads((prev) => prev.filter((t) => t.id !== threadId));
  }, []);

  const handleCloseAll = useCallback(() => {
    setOpenThreads([]);
  }, []);

  const handleArchive = useCallback(
    async (threadId: string) => {
      removeThread(threadId);
      setOpenThreads((prev) => prev.filter((t) => t.id !== threadId));

      try {
        await apiPost<{ success: boolean }>('/api/thread-archive', { threadId });
        refetch();
      } catch (err) {
        console.error('Failed to archive:', err);
        showError('Failed to archive thread');
        refetch();
      }
    },
    [refetch, removeThread, showError],
  );

  const handleDelete = useCallback(
    async (threadId: string) => {
      removeThread(threadId);
      setOpenThreads((prev) => prev.filter((t) => t.id !== threadId));

      try {
        const data = await apiDelete<{ success: boolean; error?: string }>('/api/thread-delete', {
          threadId,
        });
        if (!data.success) {
          console.error('Failed to delete:', data.error);
          showError('Failed to delete thread');
          refetch();
        }
      } catch (err) {
        console.error('Failed to delete:', err);
        showError('Failed to delete thread');
        refetch();
      }
    },
    [refetch, removeThread, showError],
  );

  const handleBulkArchive = useCallback(
    async (threadIds: string[]) => {
      threadIds.forEach((id) => {
        removeThread(id);
        setOpenThreads((prev) => prev.filter((t) => t.id !== id));
      });

      try {
        await Promise.allSettled(
          threadIds.map((id) =>
            apiPost<{ success: boolean }>('/api/thread-archive', { threadId: id }),
          ),
        );
      } catch (err) {
        console.error('Bulk archive error:', err);
        showError('Some threads failed to archive');
      }
      refetch();
    },
    [refetch, removeThread, showError],
  );

  const handleBulkDelete = useCallback(
    async (threadIds: string[]) => {
      threadIds.forEach((id) => {
        removeThread(id);
        setOpenThreads((prev) => prev.filter((t) => t.id !== id));
      });

      try {
        const results = await Promise.allSettled(
          threadIds.map((id) =>
            apiDelete<{ success: boolean; error?: string }>('/api/thread-delete', { threadId: id }),
          ),
        );
        const failures = results.filter(
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard
          (r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success),
        );
        if (failures.length > 0) {
          console.error(`${failures.length} delete(s) failed`);
          showError(`${failures.length} thread(s) failed to delete`);
        }
      } catch (err) {
        console.error('Bulk delete error:', err);
        showError('Some threads failed to delete');
      }
      refetch();
    },
    [refetch, removeThread, showError],
  );

  const handleBulkStatusChange = useCallback(
    async (threadIds: string[], status: ThreadStatus) => {
      try {
        await Promise.all(threadIds.map((id) => updateStatus(id, status)));
      } catch (err) {
        console.error('Bulk status change error:', err);
        showError('Failed to change thread status');
      }
    },
    [updateStatus, showError],
  );

  const handleCreateThreadInWorkspace = useCallback(
    async (workspacePath: string | null) => {
      try {
        const result = await apiPost<{ threadId: string; workspace?: string }>('/api/thread-new', {
          workspace: workspacePath,
          mode: agentMode,
        });
        const newThread: Thread = {
          id: result.threadId,
          title: 'New Thread',
          lastUpdated: 'Just now',
          visibility: 'Private',
          messages: 0,
          workspace: workspacePath ? workspacePath.split('/').pop() : undefined,
        };
        setOpenThreads((prev) => [...prev, newThread]);
        setActiveThreadId(result.threadId);
        refetch();
      } catch (err) {
        console.error('Failed to create thread:', err);
        showError('Failed to create thread');
      }
    },
    [agentMode, refetch, showError],
  );

  const handleHandoffConfirm = useCallback(
    async (goal: string, newTitle?: string): Promise<void> => {
      if (!handoffThreadId) return;
      const result = await apiPost<{ threadId: string }>('/api/thread-handoff', {
        threadId: handoffThreadId,
        goal,
      });

      // Use provided title, or fall back to goal-based name
      const threadName = newTitle || (goal.length > 60 ? goal.slice(0, 57) + '...' : goal);
      await apiPatch<{ success: boolean }>('/api/thread-rename', {
        threadId: result.threadId,
        name: threadName,
      });

      const newThread: Thread = {
        id: result.threadId,
        title: threadName,
        lastUpdated: 'Just now',
        visibility: 'Private',
        messages: 0,
        autoInvoke: true,
      };
      setOpenThreads((prev) => [...prev, newThread]);
      setActiveThreadId(result.threadId);
      setFocusThreadId(result.threadId);
      refetch();
      setHandoffThreadId(null);
    },
    [handoffThreadId, refetch],
  );

  const handleRenameThread = useCallback(
    (id: string) => {
      showInputModal({
        title: 'Rename Thread',
        label: 'New thread name',
        placeholder: 'Enter new thread name',
        confirmText: 'Rename',
        onConfirm: async (newName: string) => {
          showInputModal(null);
          try {
            await apiPatch<{ success: boolean }>('/api/thread-rename', {
              threadId: id,
              name: newName,
            });
            refetch();
          } catch (err) {
            console.error('Failed to rename:', err);
            showError('Failed to rename thread');
          }
        },
      });
    },
    [refetch, showInputModal, showError],
  );

  const handleArchiveAndClose = useCallback(
    async (id: string) => {
      await handleArchive(id);
      handleCloseThread(id);
    },
    [handleArchive, handleCloseThread],
  );

  const handleArchiveOldThreads = useCallback(() => {
    const oldThreads = threads.filter((t) => {
      const updated = new Date(t.lastUpdated);
      const daysOld = (Date.now() - updated.getTime()) / (1000 * 60 * 60 * 24);
      return daysOld > 7;
    });
    if (oldThreads.length === 0) {
      showError('No threads older than 7 days found');
      return;
    }
    showConfirmModal({
      title: 'Archive Old Threads',
      message: `Archive ${oldThreads.length} threads older than 7 days?`,
      confirmText: 'Archive',
      onConfirm: async () => {
        showConfirmModal(null);
        for (const t of oldThreads) {
          await handleArchive(t.id);
        }
      },
    });
  }, [threads, handleArchive, showError, showConfirmModal]);

  return useMemo<UseThreadActionsReturn>(
    () => ({
      openThreads,
      activeThreadId,
      focusThreadId,
      setActiveThreadId,
      setFocusThreadId,
      handleContinue,
      handleCloseThread,
      handleCloseAll,
      handleArchive,
      handleDelete,
      handleBulkArchive,
      handleBulkDelete,
      handleBulkStatusChange,
      handleCreateThreadInWorkspace,
      handleHandoffConfirm,
      handleRenameThread,
      handleArchiveAndClose,
      handleArchiveOldThreads,
      handoffThreadId,
      setHandoffThreadId,
    }),
    [
      openThreads,
      activeThreadId,
      focusThreadId,
      setActiveThreadId,
      setFocusThreadId,
      handleContinue,
      handleCloseThread,
      handleCloseAll,
      handleArchive,
      handleDelete,
      handleBulkArchive,
      handleBulkDelete,
      handleBulkStatusChange,
      handleCreateThreadInWorkspace,
      handleHandoffConfirm,
      handleRenameThread,
      handleArchiveAndClose,
      handleArchiveOldThreads,
      handoffThreadId,
      setHandoffThreadId,
    ],
  );
}
