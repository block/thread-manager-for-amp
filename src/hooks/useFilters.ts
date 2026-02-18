import { useState, useMemo, useCallback, useEffect } from 'react';
import { apiGet } from '../api/client';
import type { Thread, ThreadStatus, SortField, SortDirection, ThreadMetadata } from '../types';

interface UseFiltersOptions {
  threads: Thread[];
  metadata: Record<string, ThreadMetadata>;
}

interface UseFiltersReturn {
  searchInput: string;
  setSearchInput: (value: string) => void;
  debouncedSearch: string;

  filterRepo: string | null;
  setFilterRepo: (repo: string | null) => void;
  filterWorkspace: string | null;
  setFilterWorkspace: (workspace: string | null) => void;
  filterLabel: string | null;
  setFilterLabel: (label: string | null) => void;
  filterStatus: ThreadStatus | null;
  setFilterStatus: (status: ThreadStatus | null) => void;

  sortField: SortField;
  sortDirection: SortDirection;
  handleSort: (field: SortField) => void;

  filteredThreads: Thread[];
  availableLabels: string[];
  threadLabels: Record<string, string[]>;
  setThreadLabels: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
}

export function useFilters({ threads, metadata }: UseFiltersOptions): UseFiltersReturn {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('lastUpdated');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filterRepo, setFilterRepo] = useState<string | null>(null);
  const [filterWorkspace, setFilterWorkspace] = useState<string | null>(null);
  const [filterLabel, setFilterLabel] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<ThreadStatus | null>(null);
  const [threadLabels, setThreadLabels] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Stable key derived from thread IDs — won't change on every poll if threads are the same
  const threadIdKey = useMemo(
    () =>
      threads
        .slice(0, 50)
        .map((t) => t.id)
        .join(','),
    [threads],
  );

  const fetchThreadLabels = useCallback(async () => {
    const ids = threads.slice(0, 50).map((t) => t.id);
    if (ids.length === 0) return;

    try {
      const labelsMap = await apiGet<Record<string, { name: string }[]>>(
        `/api/thread-labels-batch?threadIds=${ids.map(encodeURIComponent).join(',')}`,
      );
      setThreadLabels(
        Object.fromEntries(
          Object.entries(labelsMap).map(([id, labels]) => [id, labels.map((l) => l.name)]),
        ),
      );
    } catch {
      // Fallback: set empty labels rather than leaving stale state
      setThreadLabels({});
    }
  }, [threads]);

  useEffect(() => {
    if (threadIdKey) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- legitimate async effect fetching labels then calling setState
      void fetchThreadLabels();
    }
  }, [threadIdKey]); // eslint-disable-line react-hooks/exhaustive-deps -- intentionally keyed on stable threadIdKey

  const handleSort = useCallback(
    (field: SortField) => {
      if (field === sortField) {
        setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortDirection('desc');
      }
    },
    [sortField],
  );

  const filteredThreads = useMemo(() => {
    let result = threads.filter(
      (t) =>
        t.title.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        t.id.toLowerCase().includes(debouncedSearch.toLowerCase()),
    );

    if (filterRepo) {
      result = result.filter((t) => t.repo === filterRepo);
    }

    if (filterWorkspace) {
      if (filterWorkspace === '__NO_WORKSPACE__') {
        result = result.filter((t) => !t.workspace);
      } else {
        result = result.filter((t) => t.workspace === filterWorkspace);
      }
    }

    if (filterLabel) {
      result = result.filter((t) => threadLabels[t.id]?.includes(filterLabel));
    }

    if (filterStatus) {
      result = result.filter((t) => (metadata[t.id]?.status || 'active') === filterStatus);
    }

    result.sort((a, b) => {
      let cmp: number;
      if (sortField === 'title') {
        cmp = a.title.localeCompare(b.title);
      } else if (sortField === 'messages') {
        cmp = a.messages - b.messages;
      } else if (sortField === 'status') {
        const statusOrder: Record<string, number> = { active: 0, parked: 1, blocked: 2, done: 3 };
        const aStatus = metadata[a.id]?.status || 'active';
        const bStatus = metadata[b.id]?.status || 'active';
        cmp = (statusOrder[aStatus] ?? 0) - (statusOrder[bStatus] ?? 0);
      } else if (sortField === 'contextPercent') {
        cmp = (a.contextPercent ?? 0) - (b.contextPercent ?? 0);
      } else if (sortField === 'cost') {
        cmp = (a.cost ?? 0) - (b.cost ?? 0);
      } else {
        cmp = 0;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [
    threads,
    debouncedSearch,
    sortField,
    sortDirection,
    filterRepo,
    filterWorkspace,
    filterLabel,
    filterStatus,
    threadLabels,
    metadata,
  ]);

  const availableLabels = useMemo(() => {
    const labelSet = new Set<string>();
    Object.values(threadLabels).forEach((labels) => {
      labels.forEach((label) => labelSet.add(label));
    });
    return [...labelSet].sort();
  }, [threadLabels]);

  return {
    searchInput,
    setSearchInput,
    debouncedSearch,
    filterRepo,
    setFilterRepo,
    filterWorkspace,
    setFilterWorkspace,
    filterLabel,
    setFilterLabel,
    filterStatus,
    setFilterStatus,
    sortField,
    sortDirection,
    handleSort,
    filteredThreads,
    availableLabels,
    threadLabels,
    setThreadLabels,
  };
}
