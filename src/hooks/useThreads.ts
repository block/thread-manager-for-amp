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

  // Track recently deleted thread IDs with expiry timestamps.
  const deletedIdsRef = useRef<Map<string, number>>(new Map());
  // Snapshot of thread IDs from the last fetch before any deletes.
  // While deletes are pending, only threads in this set (minus deleted ones) are shown,
  // preventing backfill from threads beyond the original API window.
  const knownIdsRef = useRef<Set<string> | null>(null);
  // Timestamp of the most recent delete — threads created after this are allowed through
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
        const cursor = append ? cursorRef.current : null;
        const data = await apiGet<ThreadsResult>(
          `/api/threads?limit=1000${cursor ? `&cursor=${cursor}` : ''}`,
        );

        const pendingDeletes = pruneDeleted();
        const deleted = deletedIdsRef.current;

        let filtered: Thread[];

        if (pendingDeletes > 0 && knownIdsRef.current) {
          // While deletes are pending, only show threads that:
          // 1. Were in our known set before the delete (minus deleted ones), OR
          // 2. Are genuinely new (interacted with after the last delete)
          const known = knownIdsRef.current;
          const cutoff = lastDeleteTimeRef.current;
          filtered = data.threads.filter((t) => {
            if (deleted.has(t.id)) return false;
            if (known.has(t.id)) return true;
            // Allow genuinely new threads (created/updated after the delete)
            const threadTime = t.lastUpdatedDate ? new Date(t.lastUpdatedDate).getTime() : 0;
            return threadTime > cutoff;
          });
        } else {
          filtered = data.threads;
          // Establish known set for future delete operations
          knownIdsRef.current = new Set(data.threads.map((t) => t.id));
        }

        if (append) {
          setThreads((prev) => [...prev, ...filtered]);
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
    [pruneDeleted],
  );

  const loadMore = useCallback(() => {
    if (hasMore && !loadingMore) {
      void fetchThreads(true);
    }
  }, [hasMore, loadingMore, fetchThreads]);

  const removeThread = useCallback((threadId: string) => {
    // Snapshot current thread IDs before any deletions
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
    refetch: () => fetchThreads(false),
    loadMore,
    removeThread,
  };
}
