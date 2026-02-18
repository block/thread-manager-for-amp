import { useState, useCallback, useMemo } from 'react';
import type { Thread } from '../../types';

interface UseThreadListSelectionOptions {
  threads: Thread[];
  paginatedThreads: Thread[];
}

export function useThreadListSelection({
  threads,
  paginatedThreads,
}: UseThreadListSelectionOptions) {
  const [rawSelectedIds, setRawSelectedIds] = useState<Set<string>>(new Set());
  const [lastClickedId, setLastClickedId] = useState<string | null>(null);

  const threadIds = useMemo(() => new Set(threads.map((t) => t.id)), [threads]);

  const selectedIds = useMemo(() => {
    return new Set([...rawSelectedIds].filter((id) => threadIds.has(id)));
  }, [rawSelectedIds, threadIds]);

  const toggleSelect = useCallback(
    (threadId: string, shiftKey: boolean) => {
      setRawSelectedIds((prev) => {
        const next = new Set(prev);

        if (shiftKey && lastClickedId) {
          const lastIdx = threads.findIndex((t) => t.id === lastClickedId);
          const currentIdx = threads.findIndex((t) => t.id === threadId);
          if (lastIdx !== -1 && currentIdx !== -1) {
            const [start, end] =
              lastIdx < currentIdx ? [lastIdx, currentIdx] : [currentIdx, lastIdx];
            for (let i = start; i <= end; i++) {
              const t = threads[i];
              if (t) next.add(t.id);
            }
            return next;
          }
        }

        if (next.has(threadId)) {
          next.delete(threadId);
        } else {
          next.add(threadId);
        }
        return next;
      });
      setLastClickedId(threadId);
    },
    [threads, lastClickedId],
  );

  const selectAll = useCallback(() => {
    const pageIds = paginatedThreads.map((t) => t.id);
    const allPageSelected = pageIds.every((id) => selectedIds.has(id));

    if (allPageSelected) {
      setRawSelectedIds((prev) => {
        const next = new Set(prev);
        pageIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setRawSelectedIds((prev) => new Set([...prev, ...pageIds]));
    }
  }, [paginatedThreads, selectedIds]);

  const clearSelection = useCallback(() => {
    setRawSelectedIds(new Set());
  }, []);

  const pageIds = paginatedThreads.map((t) => t.id);
  const selectedOnPage = pageIds.filter((id) => selectedIds.has(id)).length;
  const isAllSelected = paginatedThreads.length > 0 && selectedOnPage === paginatedThreads.length;
  const isSomeSelected = selectedOnPage > 0 && selectedOnPage < paginatedThreads.length;

  return {
    selectedIds,
    toggleSelect,
    selectAll,
    clearSelection,
    isAllSelected,
    isSomeSelected,
  };
}
