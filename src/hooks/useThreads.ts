import { useState, useEffect, useCallback, useRef } from 'react';
import type { Thread, ThreadsResult } from '../types';
import { apiGet, ApiError } from '../api/client';

// Auto-refresh interval (30 seconds)
const AUTO_REFRESH_INTERVAL_MS = 30000;

export function useThreads() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const cursorRef = useRef<string | null>(null);
  const autoRefreshRef = useRef<number | null>(null);

  const fetchThreads = useCallback(async (append = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const cursor = append ? cursorRef.current : null;
      const data = await apiGet<ThreadsResult>(
        `/api/threads?limit=50${cursor ? `&cursor=${cursor}` : ''}`
      );

      setThreads(prev => append ? [...prev, ...data.threads] : data.threads);
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
  }, []);

  const loadMore = useCallback(() => {
    if (hasMore && !loadingMore) {
      void fetchThreads(true);
    }
  }, [hasMore, loadingMore, fetchThreads]);

  const removeThread = useCallback((threadId: string) => {
    setThreads(prev => prev.filter(t => t.id !== threadId));
  }, []);

  useEffect(() => {
    void fetchThreads();
    
    // Set up auto-refresh
    autoRefreshRef.current = window.setInterval(() => {
      void fetchThreads(false);
    }, AUTO_REFRESH_INTERVAL_MS);
    
    return () => {
      if (autoRefreshRef.current !== null) {
        clearInterval(autoRefreshRef.current);
        autoRefreshRef.current = null;
      }
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
