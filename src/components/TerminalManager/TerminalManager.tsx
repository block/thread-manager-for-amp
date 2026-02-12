import { memo, useState } from 'react';
import { Terminal } from '../Terminal';
import { ErrorBoundary } from '../ErrorBoundary';
import { X, Columns, Grid2X2, Maximize, Square, Minus, ChevronUp, GripHorizontal } from 'lucide-react';
import { TerminalTabs } from './TerminalTabs';
import { useTerminalManager, type LayoutMode } from './useTerminalManager';
import type { Thread } from '../../types';

interface TerminalManagerProps {
  threads: Thread[];
  onClose: (threadId: string) => void;
  onCloseAll: () => void;
  layout?: LayoutMode;
  onLayoutChange?: (layout: LayoutMode) => void;
  onActiveChange?: (threadId: string) => void;
  onHandoff?: (threadId: string) => void;
  onNewThread?: () => void;
  onOpenThread?: (thread: Thread) => void;
  focusThreadId?: string;
}

export const TerminalManager = memo(function TerminalManager({ 
  threads, 
  onClose, 
  onCloseAll,
  layout: externalLayout,
  onLayoutChange,
  onActiveChange,
  onHandoff,
  onNewThread,
  onOpenThread,
  focusThreadId,
}: TerminalManagerProps) {
  const [internalLayout, setInternalLayout] = useState<LayoutMode>('tabs');
  const layout = externalLayout ?? internalLayout;
  const setLayout = onLayoutChange ?? setInternalLayout;

  const {
    activeId,
    isMinimized,
    setIsMinimized,
    isExpanded,
    setIsExpanded,
    panelHeight,
    draggedTab,
    orderedThreads,
    visibleIds,
    setActiveId,
    handleDragStart,
    handleTabDragStart,
    handleTabDragOver,
    handleTabDragEnd,
    moveToFront,
    handleClose,
  } = useTerminalManager({
    threads,
    onClose,
    onCloseAll,
    layout,
    setLayout,
    focusThreadId,
    onActiveChange,
  });

  if (threads.length === 0) return null;

  const managerClass = [
    'terminal-manager',
    isMinimized ? 'minimized' : '',
    isExpanded ? 'expanded' : '',
  ].filter(Boolean).join(' ');

  const panelStyle = (!isExpanded && !isMinimized) 
    ? { height: `${panelHeight}vh` } 
    : undefined;

  return (
    <div className={managerClass} style={panelStyle}>
      <div 
        className="terminal-resize-handle"
        onMouseDown={handleDragStart}
        title="Drag to resize"
      >
        <GripHorizontal size={16} />
      </div>
      <div className="terminal-dock">
        <TerminalTabs
          orderedThreads={orderedThreads}
          activeId={activeId}
          layout={layout}
          visibleIds={visibleIds}
          draggedTab={draggedTab}
          onTabClick={setActiveId}
          onTabDoubleClick={moveToFront}
          onTabClose={handleClose}
          onDragStart={handleTabDragStart}
          onDragOver={handleTabDragOver}
          onDragEnd={handleTabDragEnd}
        />
        
        <div className="terminal-dock-controls">
          <button 
            className={`dock-btn expand ${isExpanded ? 'active' : ''}`}
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Restore' : 'Maximize'}
          >
            {isExpanded ? <Square size={14} /> : <Maximize size={14} />}
          </button>
          {threads.length >= 2 && (
            <button 
              className={`dock-btn split ${layout === 'split' ? 'active' : ''}`}
              onClick={() => setLayout('split')}
              title="Split view"
            >
              <Columns size={14} />
            </button>
          )}
          {threads.length >= 3 && (
            <button 
              className={`dock-btn grid ${layout === 'grid' ? 'active' : ''}`}
              onClick={() => setLayout('grid')}
              title="Grid view"
            >
              <Grid2X2 size={14} />
            </button>
          )}
          <div className="dock-divider" />
          <button 
            className="dock-btn minimize"
            onClick={() => setIsMinimized(!isMinimized)}
            title={isMinimized ? 'Restore' : 'Minimize'}
          >
            {isMinimized ? <ChevronUp size={14} /> : <Minus size={14} />}
          </button>
          <button 
            className="dock-btn close"
            onClick={onCloseAll}
            title="Close all"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <div className={`terminal-panes layout-${layout}`}>
          {orderedThreads.map((thread) => {
            const isVisible = visibleIds.has(thread.id);
            return (
              <div 
                key={thread.id} 
                className="terminal-pane"
                style={{ display: isVisible ? undefined : 'none' }}
              >
                <ErrorBoundary>
                  <Terminal
                    thread={thread}
                    onClose={() => handleClose(thread.id)}
                    embedded
                    onHandoff={onHandoff}
                    onNewThread={onNewThread}
                    onOpenThread={onOpenThread}
                    autoFocus={thread.id === focusThreadId && isVisible}
                  />
                </ErrorBoundary>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});
