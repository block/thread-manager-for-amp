import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

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
  const getStatus = useCallback((threadId: string): TabThreadStatus => {
    return state[threadId] || 'idle';
  }, [state]);

  const setStatus = useCallback((threadId: string, status: TabThreadStatus) => {
    setState(prev => {
      if (prev[threadId] === status) return prev;
      return { ...prev, [threadId]: status };
    });
  }, []);

  const clearStatus = useCallback((threadId: string) => {
    setState(prev => {
      if (!prev[threadId]) return prev;
      const { [threadId]: _removed, ...rest } = prev;
      void _removed;
      return rest;
    });
  }, []);

  return (
    <ThreadStatusContext.Provider value={{ getStatus, setStatus, clearStatus }}>
      {children}
    </ThreadStatusContext.Provider>
  );
}

export function useThreadStatus() {
  const context = useContext(ThreadStatusContext);
  if (!context) {
    throw new Error('useThreadStatus must be used within ThreadStatusProvider');
  }
  return context;
}
