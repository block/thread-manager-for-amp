import { useState, useEffect, useCallback, useRef } from 'react';
import type { Thread, ThreadsResult } from '../types';
import { apiGet, ApiError } from '../api/client';

// Auto-refresh interval (30 seconds)
const AUTO_REFRESH_INTERVAL_MS = 30000;

// Grace period to suppress deleted threads from reappearing via API polling (2 minutes)
const DELETE_GRACE_PERIOD_MS = 120000;

// How many threads to fetch per batch.
// Higher initial batch ensures most top-level threads are visible even with
// heavy stacking (handoff chains collapse many threads into single entries).
const BATCH_SIZE = 1000;

export function useThreads() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const autoRefreshRef = useRef<number | null>(null);

  // How many threads we've loaded (for offset-based pagination)
  const loadedCountRef = useRef(BATCH_SIZE);

  // Track recently deleted thread IDs with expiry timestamps.
  const deletedIdsRef = useRef<Map<string, number>>(new Map());
  // Snapshot of thread IDs from the last fetch before any deletes.
  const knownIdsRef = useRef<Set<string> | null>(null);
  const lastDeleteTimeRef = useRef<number>(0);

  /** Prune expired entries and return current pending-delete count. */
  const pruneDeleted = useCallback((): number => {
    const now = Date.now();
    const deleted = deletedIdsRef.current;
    for (const [id, expiry] of deleted) {
      if (now >= expiry) deleted.delete(id);
    }
    if (deleted.size === 0) {
      knownIdsRef.current = null;
    }
    return deleted.size;
  }, []);

  const fetchThreads = useCallback(
    async (append = false) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const limit = loadedCountRef.current;
        const data = await apiGet<ThreadsResult>(`/api/threads?limit=${limit}`);

        const pendingDeletes = pruneDeleted();
        const deleted = deletedIdsRef.current;

        let filtered: Thread[];

        if (pendingDeletes > 0 && knownIdsRef.current) {
          const known = knownIdsRef.current;
          const cutoff = lastDeleteTimeRef.current;
          filtered = data.threads.filter((t) => {
            if (deleted.has(t.id)) return false;
            if (known.has(t.id)) return true;
            const threadTime = t.lastUpdatedDate ? new Date(t.lastUpdatedDate).getTime() : 0;
            return threadTime > cutoff;
          });
        } else {
          filtered = data.threads;
          knownIdsRef.current = new Set(data.threads.map((t) => t.id));
        }

        setThreads(filtered);
        setHasMore(data.hasMore);
        setTotalCount(data.totalCount);
      } catch (err) {
        if (err instanceof ApiError) {
          console.error(`[useThreads] API error ${err.status}: ${err.message}`);
          setError(err.message);
        } else {
          console.error('[useThreads] Unexpected error:', err);
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [pruneDeleted],
  );

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore) return;
    loadedCountRef.current += BATCH_SIZE;
    // Clear anti-backfill filter — user explicitly asked for more data
    knownIdsRef.current = null;
    deletedIdsRef.current.clear();
    void fetchThreads(true);
  }, [hasMore, loadingMore, fetchThreads]);

  const removeThread = useCallback((threadId: string) => {
    if (!knownIdsRef.current) {
      setThreads((prev) => {
        knownIdsRef.current = new Set(prev.map((t) => t.id));
        return prev.filter((t) => t.id !== threadId);
      });
    } else {
      setThreads((prev) => prev.filter((t) => t.id !== threadId));
    }
    deletedIdsRef.current.set(threadId, Date.now() + DELETE_GRACE_PERIOD_MS);
    lastDeleteTimeRef.current = Date.now();
  }, []);

  useEffect(() => {
    void fetchThreads();

    const startPolling = () => {
      if (autoRefreshRef.current !== null) return;
      autoRefreshRef.current = window.setInterval(() => {
        void fetchThreads(false);
      }, AUTO_REFRESH_INTERVAL_MS);
    };

    const stopPolling = () => {
      if (autoRefreshRef.current !== null) {
        clearInterval(autoRefreshRef.current);
        autoRefreshRef.current = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        void fetchThreads(false);
        startPolling();
      }
    };

    startPolling();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchThreads]);

  return {
    threads,
    loading,
    loadingMore,
    error,
    hasMore,
    totalCount,
    refetch: () => fetchThreads(false),
    loadMore,
    removeThread,
  };
}
