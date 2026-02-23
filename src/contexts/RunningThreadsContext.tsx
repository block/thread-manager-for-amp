import { createContext, useContext, type ReactNode } from 'react';
import type { RunningThreadsMap } from '../types';

const RunningThreadsContext = createContext<RunningThreadsMap>({});

export function RunningThreadsProvider({
  value,
  children,
}: {
  value: RunningThreadsMap;
  children: ReactNode;
}) {
  return <RunningThreadsContext.Provider value={value}>{children}</RunningThreadsContext.Provider>;
}

export function useRunningThreadsContext(): RunningThreadsMap {
  return useContext(RunningThreadsContext);
}
