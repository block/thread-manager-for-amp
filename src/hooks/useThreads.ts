import { useState, useEffect, useCallback, useRef } from 'react';
import type { Thread, ThreadsResult } from '../types';
import { apiGet, ApiError } from '../api/client';

// Auto-refresh interval (30 seconds)
const AUTO_REFRESH_INTERVAL_MS = 30000;

export function useThreads() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const autoRefreshRef = useRef<number | null>(null);

  const fetchThreads = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch all threads — the server paginates the Amp API internally (500 per call)
      const data = await apiGet<ThreadsResult>('/api/threads?limit=10000');

      // Stabilize reference: skip setState if thread list hasn't meaningfully changed,
      // preventing downstream re-renders (e.g., useFilters label re-fetch) on every poll
      setThreads((prev) => {
        if (prev.length !== data.threads.length) return data.threads;
        const changed = prev.some((t, i) => {
          const next = data.threads[i];
          return (
            !next ||
            t.id !== next.id ||
            t.title !== next.title ||
            t.lastUpdated !== next.lastUpdated
          );
        });
        return changed ? data.threads : prev;
      });
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
    }
  }, []);

  const removeThread = useCallback((threadId: string) => {
    setThreads((prev) => prev.filter((t) => t.id !== threadId));
  }, []);

  useEffect(() => {
    void fetchThreads();

    const startPolling = () => {
      if (autoRefreshRef.current !== null) return;
      autoRefreshRef.current = window.setInterval(() => {
        void fetchThreads();
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
        void fetchThreads();
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
    error,
    refetch: fetchThreads,
    removeThread,
  };
}
