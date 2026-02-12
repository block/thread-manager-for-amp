import { useState, useCallback } from 'react';
import { apiPost, apiDelete, apiPatch } from '../api/client';
import type { Thread, ThreadStatus } from '../types';

export interface UseThreadActionsOptions {
  threads: Thread[];
  refetch: () => void;
  removeThread: (id: string) => void;
  updateStatus: (id: string, status: ThreadStatus) => Promise<unknown>;
  addBlocker: (threadId: string, blockedBy: string, reason?: string) => Promise<unknown>;
  removeBlocker: (threadId: string, blockedBy: string) => Promise<unknown>;
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
  handleArchiveOldThreads: () => Promise<void>;
  handoffThreadId: string | null;
  setHandoffThreadId: (id: string | null) => void;
}

export function useThreadActions({
  threads,
  refetch,
  removeThread,
  updateStatus,
}: UseThreadActionsOptions): UseThreadActionsReturn {
  const [openThreads, setOpenThreads] = useState<Thread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | undefined>();
  const [focusThreadId, setFocusThreadId] = useState<string | undefined>();
  const [handoffThreadId, setHandoffThreadId] = useState<string | null>(null);

  const handleContinue = useCallback((thread: Thread) => {
    setOpenThreads(prev => {
      if (prev.find(t => t.id === thread.id)) {
        setFocusThreadId(thread.id);
        return prev;
      }
      return [...prev, thread];
    });
    setFocusThreadId(thread.id);
  }, []);

  const handleCloseThread = useCallback((threadId: string) => {
    setOpenThreads(prev => prev.filter(t => t.id !== threadId));
  }, []);

  const handleCloseAll = useCallback(() => {
    setOpenThreads([]);
  }, []);

  const handleArchive = useCallback(async (threadId: string) => {
    removeThread(threadId);
    setOpenThreads(prev => prev.filter(t => t.id !== threadId));

    try {
      await apiPost<{ success: boolean }>('/api/thread-archive', { threadId });
      refetch();
    } catch (err) {
      console.error('Failed to archive:', err);
      refetch();
    }
  }, [refetch, removeThread]);

  const handleDelete = useCallback(async (threadId: string) => {
    removeThread(threadId);
    setOpenThreads(prev => prev.filter(t => t.id !== threadId));

    try {
      const data = await apiDelete<{ success: boolean; error?: string }>(
        '/api/thread-delete', { threadId }
      );
      if (!data.success) {
        console.error('Failed to delete:', data.error);
        refetch();
      }
    } catch (err) {
      console.error('Failed to delete:', err);
      refetch();
    }
  }, [refetch, removeThread]);

  const handleBulkArchive = useCallback(async (threadIds: string[]) => {
    threadIds.forEach(id => {
      removeThread(id);
      setOpenThreads(prev => prev.filter(t => t.id !== id));
    });

    try {
      await Promise.allSettled(
        threadIds.map(id =>
          apiPost<{ success: boolean }>('/api/thread-archive', { threadId: id })
        )
      );
    } catch (err) {
      console.error('Bulk archive error:', err);
    }
    refetch();
  }, [refetch, removeThread]);

  const handleBulkDelete = useCallback(async (threadIds: string[]) => {
    threadIds.forEach(id => {
      removeThread(id);
      setOpenThreads(prev => prev.filter(t => t.id !== id));
    });

    try {
      const results = await Promise.allSettled(
        threadIds.map(id =>
          apiDelete<{ success: boolean; error?: string }>(
            '/api/thread-delete', { threadId: id }
          )
        )
      );
      const failures = results.filter(
        r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)
      );
      if (failures.length > 0) {
        console.error(`${failures.length} delete(s) failed`);
      }
    } catch (err) {
      console.error('Bulk delete error:', err);
    }
    refetch();
  }, [refetch, removeThread]);

  const handleBulkStatusChange = useCallback(async (threadIds: string[], status: ThreadStatus) => {
    try {
      await Promise.all(threadIds.map(id => updateStatus(id, status)));
    } catch (err) {
      console.error('Bulk status change error:', err);
    }
  }, [updateStatus]);

  const handleCreateThreadInWorkspace = useCallback(async (workspacePath: string | null) => {
    try {
      const result = await apiPost<{ threadId: string; workspace?: string }>(
        '/api/thread-new',
        { workspace: workspacePath }
      );
      const newThread: Thread = {
        id: result.threadId,
        title: 'New Thread',
        lastUpdated: 'Just now',
        visibility: 'Private',
        messages: 0,
        workspace: workspacePath ? workspacePath.split('/').pop() : undefined,
      };
      setOpenThreads(prev => [...prev, newThread]);
      setActiveThreadId(result.threadId);
      refetch();
    } catch (err) {
      console.error('Failed to create thread:', err);
    }
  }, [refetch]);

  const handleHandoffConfirm = useCallback(async (goal: string, newTitle?: string): Promise<void> => {
    if (!handoffThreadId) return;
    const result = await apiPost<{ threadId: string }>(
      '/api/thread-handoff',
      { threadId: handoffThreadId, goal }
    );

    // Use provided title, or fall back to goal-based name
    const threadName = newTitle || (goal.length > 60 ? goal.slice(0, 57) + '...' : goal);
    await apiPatch<{ success: boolean }>('/api/thread-rename', { threadId: result.threadId, name: threadName });

    const newThread: Thread = {
      id: result.threadId,
      title: threadName,
      lastUpdated: 'Just now',
      visibility: 'Private',
      messages: 0,
      autoInvoke: true,
    };
    setOpenThreads(prev => [...prev, newThread]);
    setActiveThreadId(result.threadId);
    setFocusThreadId(result.threadId);
    refetch();
    setHandoffThreadId(null);
  }, [handoffThreadId, refetch]);

  const handleRenameThread = useCallback((id: string) => {
    const newName = window.prompt('Enter new thread name:');
    if (newName) {
      apiPatch<{ success: boolean }>('/api/thread-rename', { threadId: id, name: newName })
        .then(() => refetch())
        .catch(err => console.error('Failed to rename:', err));
    }
  }, [refetch]);

  const handleArchiveAndClose = useCallback(async (id: string) => {
    await handleArchive(id);
    handleCloseThread(id);
  }, [handleArchive, handleCloseThread]);

  const handleArchiveOldThreads = useCallback(async () => {
    const oldThreads = threads.filter(t => {
      const updated = new Date(t.lastUpdated);
      const daysOld = (Date.now() - updated.getTime()) / (1000 * 60 * 60 * 24);
      return daysOld > 7;
    });
    if (oldThreads.length === 0) {
      alert('No threads older than 7 days found');
      return;
    }
    if (window.confirm(`Archive ${oldThreads.length} threads older than 7 days?`)) {
      for (const t of oldThreads) {
        await handleArchive(t.id);
      }
    }
  }, [threads, handleArchive]);

  return {
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
  };
}
