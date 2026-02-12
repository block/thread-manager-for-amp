import { useState, useCallback, useEffect, useRef } from 'react';
import type { Thread } from '../../types';

export type LayoutMode = 'tabs' | 'split' | 'grid';

interface UseTerminalManagerProps {
  threads: Thread[];
  onClose: (threadId: string) => void;
  onCloseAll: () => void;
  layout: LayoutMode;
  setLayout: (layout: LayoutMode) => void;
  focusThreadId?: string;
  onActiveChange?: (threadId: string) => void;
}

export function useTerminalManager({
  threads,
  onClose,
  onCloseAll,
  layout,
  setLayout,
  focusThreadId,
  onActiveChange,
}: UseTerminalManagerProps) {
  const [selectedId, setSelectedId] = useState<string>(threads[0]?.id || '');
  const [isMinimized, setIsMinimized] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [lastHandledFocus, setLastHandledFocus] = useState<string | undefined>(undefined);
  const [prevFocusThreadId, setPrevFocusThreadId] = useState<string | undefined>(undefined);
  const [panelHeight, setPanelHeight] = useState(50);
  const [threadOrder, setThreadOrder] = useState<string[]>([]);
  const [draggedTab, setDraggedTab] = useState<string | null>(null);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(50);

  useEffect(() => {
    setThreadOrder(prev => {
      const threadIds = threads.map(t => t.id);
      const existingOrder = prev.filter(id => threadIds.includes(id));
      const newThreads = threadIds.filter(id => !prev.includes(id));
      return [...existingOrder, ...newThreads];
    });
  }, [threads]);

  const focusChanged = focusThreadId !== prevFocusThreadId;
  const shouldFocusThread = focusThreadId && 
    focusThreadId !== lastHandledFocus && 
    threads.some(t => t.id === focusThreadId) &&
    focusChanged;

  const activeId = shouldFocusThread
    ? focusThreadId
    : (threads.some(t => t.id === selectedId) ? selectedId : (threads[0]?.id || ''));

  useEffect(() => {
    setPrevFocusThreadId(focusThreadId);
  }, [focusThreadId]);

  useEffect(() => {
    if (shouldFocusThread && focusThreadId) {
      setLastHandledFocus(focusThreadId);
      setSelectedId(focusThreadId);
      setIsMinimized(false);
    }
  }, [shouldFocusThread, focusThreadId]);

  useEffect(() => {
    onActiveChange?.(activeId);
  }, [activeId, onActiveChange]);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    startY.current = e.clientY;
    startHeight.current = panelHeight;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, [panelHeight]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const deltaY = startY.current - e.clientY;
      const deltaPercent = (deltaY / window.innerHeight) * 100;
      const newHeight = Math.min(90, Math.max(20, startHeight.current + deltaPercent));
      setPanelHeight(newHeight);
    };

    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const setActiveId = useCallback((id: string) => {
    setSelectedId(id);
    if (isMinimized) {
      setIsMinimized(false);
    }
  }, [isMinimized]);

  const handleTabDragStart = useCallback((e: React.DragEvent, threadId: string) => {
    setDraggedTab(threadId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', threadId);
  }, []);

  const handleTabDragOver = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedTab || draggedTab === targetId) return;
    
    setThreadOrder(prev => {
      const newOrder = [...prev];
      const draggedIndex = newOrder.indexOf(draggedTab);
      const targetIndex = newOrder.indexOf(targetId);
      if (draggedIndex === -1 || targetIndex === -1) return prev;
      
      newOrder.splice(draggedIndex, 1);
      newOrder.splice(targetIndex, 0, draggedTab);
      return newOrder;
    });
  }, [draggedTab]);

  const handleTabDragEnd = useCallback(() => {
    setDraggedTab(null);
  }, []);

  const moveToFront = useCallback((threadId: string) => {
    setThreadOrder(prev => {
      const filtered = prev.filter(id => id !== threadId);
      return [threadId, ...filtered];
    });
  }, []);

  const handleClose = useCallback((threadId: string) => {
    if (threads.length === 1) {
      onCloseAll();
      return;
    }
    
    const remainingCount = threads.length - 1;
    if (remainingCount < 3 && layout === 'grid') {
      setLayout(remainingCount >= 2 ? 'split' : 'tabs');
    } else if (remainingCount < 2 && layout === 'split') {
      setLayout('tabs');
    }
    
    if (activeId === threadId) {
      const idx = threads.findIndex(t => t.id === threadId);
      const nextThread = threads[idx + 1] || threads[idx - 1];
      if (nextThread) setSelectedId(nextThread.id);
    }
    onClose(threadId);
  }, [threads, activeId, layout, setLayout, onClose, onCloseAll]);

  const orderedThreads = threadOrder
    .map(id => threads.find(t => t.id === id))
    .filter((t): t is Thread => t !== undefined);

  const visibleThreads = layout === 'tabs' 
    ? orderedThreads.filter(t => t.id === activeId)
    : layout === 'split'
    ? orderedThreads.slice(0, 2)
    : orderedThreads.slice(0, 4);

  const visibleIds = new Set(visibleThreads.map(t => t.id));

  return {
    activeId,
    isMinimized,
    setIsMinimized,
    isExpanded,
    setIsExpanded,
    panelHeight,
    draggedTab,
    orderedThreads,
    visibleThreads,
    visibleIds,
    setActiveId,
    handleDragStart,
    handleTabDragStart,
    handleTabDragOver,
    handleTabDragEnd,
    moveToFront,
    handleClose,
  };
}
