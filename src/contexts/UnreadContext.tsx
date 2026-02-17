import { createContext, useContext, useState, useCallback, useRef, useMemo, type ReactNode } from 'react';

interface UnreadState {
  [threadId: string]: {
    lastSeenCount: number;
    currentCount: number;
  };
}

interface UnreadContextValue {
  getUnreadCount: (threadId: string) => number;
  updateCurrentCount: (threadId: string, count: number) => void;
  markAsSeen: (threadId: string) => void;
  clearThread: (threadId: string) => void;
}

const UnreadContext = createContext<UnreadContextValue | null>(null);

export function UnreadProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<UnreadState>({});

  // Ref-based approach: getUnreadCount reads from a ref so the callback
  // identity is stable forever, preventing cascading re-renders of all
  // consumers when any single thread's unread count changes.
  const stateRef = useRef(state);
  stateRef.current = state;

  const getUnreadCount = useCallback((threadId: string): number => {
    const threadState = stateRef.current[threadId];
    if (!threadState) return 0;
    return Math.max(0, threadState.currentCount - threadState.lastSeenCount);
  }, []);

  const updateCurrentCount = useCallback((threadId: string, count: number) => {
    setState(prev => {
      const existing = prev[threadId];
      if (existing && existing.currentCount === count) return prev;
      return {
        ...prev,
        [threadId]: {
          lastSeenCount: existing?.lastSeenCount ?? count,
          currentCount: count,
        },
      };
    });
  }, []);

  const markAsSeen = useCallback((threadId: string) => {
    setState(prev => {
      const existing = prev[threadId];
      if (!existing || existing.lastSeenCount === existing.currentCount) return prev;
      return {
        ...prev,
        [threadId]: {
          ...existing,
          lastSeenCount: existing.currentCount,
        },
      };
    });
  }, []);

  const clearThread = useCallback((threadId: string) => {
    setState(prev => {
      if (!prev[threadId]) return prev;
      const { [threadId]: _removed, ...rest } = prev;
      void _removed;
      return rest;
    });
  }, []);

  const value = useMemo<UnreadContextValue>(
    () => ({ getUnreadCount, updateCurrentCount, markAsSeen, clearThread }),
    [getUnreadCount, updateCurrentCount, markAsSeen, clearThread],
  );

  return (
    <UnreadContext.Provider value={value}>
      {children}
    </UnreadContext.Provider>
  );
}

export function useUnread() {
  const context = useContext(UnreadContext);
  if (!context) {
    throw new Error('useUnread must be used within UnreadProvider');
  }
  return context;
}
