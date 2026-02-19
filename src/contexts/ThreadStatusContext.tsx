import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useMemo,
  type ReactNode,
} from 'react';

export type TabThreadStatus = 'idle' | 'running' | 'error';

interface ThreadStatusState {
  [threadId: string]: TabThreadStatus;
}

interface ThreadStatusContextValue {
  getStatus: (threadId: string) => TabThreadStatus;
  setStatus: (threadId: string, status: TabThreadStatus) => void;
  clearStatus: (threadId: string) => void;
}

const ThreadStatusContext = createContext<ThreadStatusContextValue | null>(null);

export function ThreadStatusProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ThreadStatusState>({});

  // Ref-based approach: getStatus reads from a ref so the callback identity
  // is stable forever, preventing cascading re-renders of all consumers when
  // any single thread's status changes.
  const stateRef = useRef(state);
  stateRef.current = state;

  const getStatus = useCallback((threadId: string): TabThreadStatus => {
    return stateRef.current[threadId] || 'idle';
  }, []);

  const setStatus = useCallback((threadId: string, status: TabThreadStatus) => {
    setState((prev) => {
      if (prev[threadId] === status) return prev;
      return { ...prev, [threadId]: status };
    });
  }, []);

  const clearStatus = useCallback((threadId: string) => {
    setState((prev) => {
      if (!prev[threadId]) return prev;
      const { [threadId]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const value = useMemo<ThreadStatusContextValue>(
    () => ({ getStatus, setStatus, clearStatus }),
    [getStatus, setStatus, clearStatus],
  );

  return <ThreadStatusContext.Provider value={value}>{children}</ThreadStatusContext.Provider>;
}

export function useThreadStatus() {
  const context = useContext(ThreadStatusContext);
  if (!context) {
    throw new Error('useThreadStatus must be used within ThreadStatusProvider');
  }
  return context;
}
