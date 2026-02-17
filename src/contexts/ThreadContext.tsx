import { createContext, useContext, type ReactNode } from 'react';
import { useThreadActions, type UseThreadActionsReturn, type UseThreadActionsOptions } from '../hooks/useThreadActions';
import type { Thread, ThreadMetadata, ThreadStatus } from '../types';

type MetadataMap = Record<string, ThreadMetadata>;

export interface ThreadContextValue extends UseThreadActionsReturn {
  threads: Thread[];
  metadata: MetadataMap;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void> | void;
  updateStatus: (id: string, status: ThreadStatus) => Promise<unknown>;
  addBlocker: (threadId: string, blockedBy: string, reason?: string) => Promise<unknown>;
  removeBlocker: (threadId: string, blockedBy: string) => Promise<unknown>;
}

const ThreadContext = createContext<ThreadContextValue | null>(null);

export interface ThreadProviderProps extends UseThreadActionsOptions {
  children: ReactNode;
  metadata: MetadataMap;
  loading: boolean;
  error: string | null;
}

export function ThreadProvider({
  children,
  threads,
  refetch,
  removeThread,
  updateStatus,
  addBlocker,
  removeBlocker,
  metadata,
  loading,
  error,
}: ThreadProviderProps) {
  const threadActions = useThreadActions({
    threads,
    refetch,
    removeThread,
    updateStatus,
    addBlocker,
    removeBlocker,
  });

  const value: ThreadContextValue = {
    ...threadActions,
    threads,
    metadata,
    loading,
    error,
    refetch,
    updateStatus,
    addBlocker,
    removeBlocker,
  };

  return (
    <ThreadContext.Provider value={value}>
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
