import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPatch, apiPost, apiDelete } from '../api/client';
import type { ThreadMetadata, ThreadStatus } from '../types';

type MetadataMap = Record<string, ThreadMetadata>;

export function useThreadMetadata() {
  const [metadata, setMetadata] = useState<MetadataMap>({});
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const data = await apiGet<MetadataMap>('/api/thread-status');
      setMetadata(data);
    } catch (err) {
      console.error('Failed to fetch thread metadata:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const getMetadata = useCallback((threadId: string): ThreadMetadata => {
    return metadata[threadId] || { thread_id: threadId, status: 'active' };
  }, [metadata]);

  const updateStatus = useCallback(async (threadId: string, status: ThreadStatus) => {
    try {
      const updated = await apiPatch<ThreadMetadata>('/api/thread-status', {
        threadId,
        status,
      });
      setMetadata(prev => ({ ...prev, [threadId]: updated }));
      return updated;
    } catch (err) {
      console.error('Failed to update status:', err);
      throw err;
    }
  }, []);

  const addBlocker = useCallback(async (threadId: string, blockedByThreadId: string, reason?: string) => {
    try {
      const updated = await apiPost<ThreadMetadata>('/api/thread-block', {
        threadId,
        blockedByThreadId,
        reason,
      });
      setMetadata(prev => ({ ...prev, [threadId]: updated }));
      return updated;
    } catch (err) {
      console.error('Failed to add blocker:', err);
      throw err;
    }
  }, []);

  const removeBlocker = useCallback(async (threadId: string, blockedByThreadId: string) => {
    try {
      const updated = await apiDelete<ThreadMetadata>('/api/thread-block', {
        threadId,
        blockedByThreadId,
      });
      setMetadata(prev => ({ ...prev, [threadId]: updated }));
      return updated;
    } catch (err) {
      console.error('Failed to remove blocker:', err);
      throw err;
    }
  }, []);

  return {
    metadata,
    loading,
    getMetadata,
    updateStatus,
    addBlocker,
    removeBlocker,
    refetch: fetchAll,
  };
}
