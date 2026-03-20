import { useState, useEffect, useCallback } from 'react';
import { apiGet } from '../api/client';

const POLL_INTERVAL = 30_000; // 30 seconds, same as thread polling

export function useActualCosts() {
  const [costs, setCosts] = useState<Record<string, number>>({});

  const fetchCosts = useCallback(async () => {
    try {
      const data = await apiGet<Record<string, number>>('/api/thread-costs');
      setCosts((prev) => {
        const keys = Object.keys(data);
        if (keys.length === Object.keys(prev).length && keys.every((k) => prev[k] === data[k])) {
          return prev;
        }
        return data;
      });
    } catch {
      // Silently fail — actual costs are a nice-to-have
    }
  }, []);

  useEffect(() => {
    // Initial fetch + polling: use setInterval with immediate first tick
    const timeout = setTimeout(() => void fetchCosts(), 0);
    const interval = setInterval(() => void fetchCosts(), POLL_INTERVAL);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [fetchCosts]);

  return costs;
}
