import { useState, useEffect, useCallback, useRef } from 'react';
import { apiGet } from '../api/client';
import type { RunningThreadsMap } from '../types';

const POLL_INTERVAL_MS = 2500;

interface UseRunningThreadsResult {
  runningThreads: RunningThreadsMap;
  isLoading: boolean;
}

export function useRunningThreads(): UseRunningThreadsResult {
  const [runningThreads, setRunningThreads] = useState<RunningThreadsMap>({});
  const [isLoading, setIsLoading] = useState(true);
  const intervalRef = useRef<number | null>(null);

  const fetchRunningThreads = useCallback(async () => {
    try {
      const data = await apiGet<RunningThreadsMap>('/api/running-threads');
      setRunningThreads(prev => {
        const prevKeys = Object.keys(prev).sort().join(',');
        const newKeys = Object.keys(data).sort().join(',');
        if (prevKeys !== newKeys) return data;
        const changed = Object.entries(data).some(([k, v]) => 
          prev[k]?.status !== v.status
        );
        return changed ? data : prev;
      });
    } catch (error) {
      console.error('Failed to fetch running threads:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRunningThreads();

    const startPolling = () => {
      if (intervalRef.current !== null) return;
      intervalRef.current = window.setInterval(() => { void fetchRunningThreads(); }, POLL_INTERVAL_MS);
    };

    const stopPolling = () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        void fetchRunningThreads();
        startPolling();
      }
    };

    startPolling();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchRunningThreads]);

  return { runningThreads, isLoading };
}
