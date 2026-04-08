import { useState, useEffect, useCallback, useRef } from 'react';
import type { Thread, ThreadsResult } from '../types';
import { apiGet, ApiError } from '../api/client';

// Auto-refresh interval (30 seconds)
const AUTO_REFRESH_INTERVAL_MS = 30000;

// Grace period to suppress deleted threads from reappearing via API polling (2 minutes)
const DELETE_GRACE_PERIOD_MS = 120000;

export function useThreads() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const cursorRef = useRef<string | null>(null);
  const autoRefreshRef = useRef<number | null>(null);
  // Track recently deleted thread IDs to prevent them reappearing from API during eventual consistency lag
  const deletedIdsRef = useRef<Map<string, number>>(new Map());

  const filterDeleted = useCallback((threadList: Thread[]): Thread[] => {
    const now = Date.now();
    const deleted = deletedIdsRef.current;
    // Prune expired entries
    for (const [id, expiry] of deleted) {
      if (now >= expiry) deleted.delete(id);
    }
    if (deleted.size === 0) return threadList;
    return threadList.filter((t) => !deleted.has(t.id));
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
        const cursor = append ? cursorRef.current : null;
        const data = await apiGet<ThreadsResult>(
          `/api/threads?limit=500${cursor ? `&cursor=${cursor}` : ''}`,
        );

        const filtered = filterDeleted(data.threads);

        if (append) {
          setThreads((prev) => [...prev, ...filterDeleted(data.threads)]);
        } else {
          // Stabilize reference: skip setState if thread list hasn't meaningfully changed,
          // preventing downstream re-renders (e.g., useFilters label re-fetch) on every poll
          setThreads((prev) => {
            if (prev.length !== filtered.length) return filtered;
            const changed = prev.some((t, i) => {
              const next = filtered[i];
              return (
                !next ||
                t.id !== next.id ||
                t.title !== next.title ||
                t.lastUpdated !== next.lastUpdated
              );
            });
            return changed ? filtered : prev;
          });
        }
        cursorRef.current = data.nextCursor;
        setHasMore(data.hasMore);
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
    [filterDeleted],
  );

  const loadMore = useCallback(() => {
    if (hasMore && !loadingMore) {
      void fetchThreads(true);
    }
  }, [hasMore, loadingMore, fetchThreads]);

  const removeThread = useCallback((threadId: string) => {
    deletedIdsRef.current.set(threadId, Date.now() + DELETE_GRACE_PERIOD_MS);
    setThreads((prev) => prev.filter((t) => t.id !== threadId));
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
    refetch: () => fetchThreads(false),
    loadMore,
    removeThread,
  };
}
