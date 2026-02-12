import { createContext, useContext, type ReactNode } from 'react';
import { useThreadActions, type UseThreadActionsReturn, type UseThreadActionsOptions } from '../hooks/useThreadActions';

type ThreadContextValue = UseThreadActionsReturn;

const ThreadContext = createContext<ThreadContextValue | null>(null);

export interface ThreadProviderProps extends UseThreadActionsOptions {
  children: ReactNode;
}

export function ThreadProvider({
  children,
  threads,
  refetch,
  removeThread,
  updateStatus,
  addBlocker,
  removeBlocker,
}: ThreadProviderProps) {
  const threadActions = useThreadActions({
    threads,
    refetch,
    removeThread,
    updateStatus,
    addBlocker,
    removeBlocker,
  });

  return (
    <ThreadContext.Provider value={threadActions}>
      {children}
    </ThreadContext.Provider>
  );
}

export function useThreadContext(): ThreadContextValue {
  const context = useContext(ThreadContext);
  if (!context) {
    throw new Error('useThreadContext must be used within a ThreadProvider');
  }
  return context;
}
