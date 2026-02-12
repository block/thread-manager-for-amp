import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { Thread, ContextMenuState, WorkspaceGroup } from './types';
import { PINNED_THREADS_KEY } from './types';

export function useSidebarState(
  threads: Thread[],
  collapsed: boolean,
  onSelectThread: (thread: Thread) => void
) {
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<Set<string>>(() => new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(PINNED_THREADS_KEY);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [pinnedExpanded, setPinnedExpanded] = useState(true);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    thread: null,
  });
  const sidebarContentRef = useRef<HTMLDivElement>(null);

  // Persist pinned IDs
  useEffect(() => {
    localStorage.setItem(PINNED_THREADS_KEY, JSON.stringify([...pinnedIds]));
  }, [pinnedIds]);

  const togglePin = useCallback((threadId: string) => {
    setPinnedIds(prev => {
      const next = new Set(prev);
      if (next.has(threadId)) {
        next.delete(threadId);
      } else {
        next.add(threadId);
      }
      return next;
    });
  }, []);

  // Filter threads by search query
  const filteredThreads = useMemo(() => {
    if (!searchQuery.trim()) return threads;
    const query = searchQuery.toLowerCase();
    return threads.filter(t => t.title.toLowerCase().includes(query));
  }, [threads, searchQuery]);

  // Separate pinned and unpinned threads
  const pinnedThreads = useMemo(() => 
    filteredThreads.filter(t => pinnedIds.has(t.id)),
    [filteredThreads, pinnedIds]
  );

  const unpinnedThreads = useMemo(() => 
    filteredThreads.filter(t => !pinnedIds.has(t.id)),
    [filteredThreads, pinnedIds]
  );

  // Flat list of visible threads for keyboard navigation
  const visibleThreads = useMemo(() => {
    const result: Thread[] = [];
    if (pinnedExpanded) {
      result.push(...pinnedThreads);
    }
    result.push(...unpinnedThreads);
    return result;
  }, [pinnedThreads, unpinnedThreads, pinnedExpanded]);

  const focusedThreadId = visibleThreads[focusedIndex]?.id;

  // Group unpinned threads by workspace
  const workspaceGroups = useMemo(() => {
    const groups = new Map<string, WorkspaceGroup>();
    
    for (const thread of unpinnedThreads) {
      const workspace = thread.workspace || 'No Workspace';
      const displayName = workspace === 'No Workspace' 
        ? 'No Workspace' 
        : workspace.split('/').pop() || workspace;
      
      if (!groups.has(workspace)) {
        groups.set(workspace, {
          workspace,
          displayName,
          threads: [],
          repos: new Map(),
        });
      }
      
      const group = groups.get(workspace)!;
      group.threads.push(thread);
      
      if (thread.repo) {
        const repoName = thread.repo.split('/').pop() || thread.repo;
        if (!group.repos.has(repoName)) {
          group.repos.set(repoName, []);
        }
        group.repos.get(repoName)!.push(thread);
      }
    }
    
    return Array.from(groups.values()).sort((a, b) => {
      if (b.threads.length !== a.threads.length) {
        return b.threads.length - a.threads.length;
      }
      return a.displayName.localeCompare(b.displayName);
    });
  }, [unpinnedThreads]);

  const toggleWorkspace = useCallback((workspace: string) => {
    setExpandedWorkspaces(prev => {
      const next = new Set(prev);
      if (next.has(workspace)) {
        next.delete(workspace);
      } else {
        next.add(workspace);
      }
      return next;
    });
  }, []);

  const toggleAllWorkspaces = useCallback(() => {
    setExpandedWorkspaces(prev => {
      if (prev.size > 0) {
        return new Set();
      } else {
        return new Set(workspaceGroups.map(g => g.workspace));
      }
    });
  }, [workspaceGroups]);

  const handleContextMenu = useCallback((e: React.MouseEvent, thread: Thread) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      thread,
    });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(prev => ({ ...prev, visible: false, thread: null }));
  }, []);

  // Keyboard navigation
  useEffect(() => {
    if (collapsed) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex(prev => Math.min(prev + 1, visibleThreads.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && focusedIndex >= 0) {
        e.preventDefault();
        const thread = visibleThreads[focusedIndex];
        if (thread) {
          onSelectThread(thread);
        }
      }
    };

    const sidebar = sidebarContentRef.current?.closest('.sidebar');
    sidebar?.addEventListener('keydown', handleKeyDown as EventListener);
    return () => sidebar?.removeEventListener('keydown', handleKeyDown as EventListener);
  }, [collapsed, focusedIndex, visibleThreads, onSelectThread]);

  // Scroll focused thread into view
  useEffect(() => {
    if (focusedIndex < 0) return;
    const thread = visibleThreads[focusedIndex];
    if (!thread) return;
    const el = sidebarContentRef.current?.querySelector(`[data-thread-id="${thread.id}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [focusedIndex, visibleThreads]);

  const allExpanded = expandedWorkspaces.size === workspaceGroups.length && workspaceGroups.length > 0;

  return {
    expandedWorkspaces,
    searchQuery,
    setSearchQuery,
    pinnedIds,
    pinnedExpanded,
    setPinnedExpanded,
    focusedThreadId,
    contextMenu,
    sidebarContentRef,
    togglePin,
    filteredThreads,
    pinnedThreads,
    unpinnedThreads,
    workspaceGroups,
    toggleWorkspace,
    toggleAllWorkspaces,
    handleContextMenu,
    closeContextMenu,
    allExpanded,
  };
}
