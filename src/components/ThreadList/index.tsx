import React, { useState, useCallback, useMemo, memo } from 'react';
import { CheckSquare, Square, MinusSquare } from 'lucide-react';
import type { Thread, ThreadStatus } from '../../types';
import { ConfirmModal } from '../ConfirmModal';
import { KanbanView } from '../KanbanView';
import { DetailCardView } from '../DetailCardView';
import { SortHeader } from './SortHeader';
import { ThreadRow } from './ThreadRow';
import { BulkActionBar } from './BulkActionBar';
import { PaginationBar } from './PaginationBar';
import { useThreadListSelection } from './useThreadListSelection';
import { useThreadListKeyboard } from './useThreadListKeyboard';
import { PAGE_SIZE } from './constants';
import type { ThreadListProps, BulkAction } from './types';
import { buildThreadStacks, getStackSize } from '../../utils/threadStacks';
import { CostInfoTip } from '../CostInfoTip';

// Re-exports for external consumers
export { SortHeader } from './SortHeader';
export { ThreadRow } from './ThreadRow';
export { BulkActionBar } from './BulkActionBar';
export { PaginationBar } from './PaginationBar';
export { BulkStatusMenu } from './BulkStatusMenu';
export { STATUS_OPTIONS, PAGE_SIZE } from './constants';
 
export { useThreadListSelection } from './useThreadListSelection';
 
export { useThreadListKeyboard } from './useThreadListKeyboard';
export type { ThreadListProps, ThreadRowProps, BulkAction } from './types';
export type { ViewMode } from '../Toolbar';

export const ThreadList = memo(function ThreadList({ 
  threads, 
  metadata,
  sortField, 
  sortDirection, 
  onSort, 
  onContinue, 
  onArchive, 
  onDelete,
  onBulkArchive,
  onBulkDelete,
  onBulkStatusChange,
  onStatusChange,
  viewMode,
  groupByDate = false,
}: ThreadListProps) {
  const [archiveTarget, setArchiveTarget] = useState<Thread | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Thread | null>(null);
  const [bulkAction, setBulkAction] = useState<BulkAction | null>(null);
  const [requestedPage, setRequestedPage] = useState(1);
  const [expandedStacks, setExpandedStacks] = useState<Set<string>>(new Set());

  // Build thread stacks from handoff relationships
  const entries = useMemo(() => buildThreadStacks(threads), [threads]);

  const toggleStackExpand = useCallback((headId: string) => {
    setExpandedStacks(prev => {
      const next = new Set(prev);
      if (next.has(headId)) {
        next.delete(headId);
      } else {
        next.add(headId);
      }
      return next;
    });
  }, []);

  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const endIdx = startIdx + PAGE_SIZE;
  const paginatedEntries = entries.slice(startIdx, endIdx);
  
  // Flatten for selection/keyboard hooks (include expanded stack children)
  const paginatedThreads = useMemo(() => {
    const result: Thread[] = [];
    for (const entry of paginatedEntries) {
      result.push(entry.thread);
      if (entry.kind === 'stack' && entry.stack && expandedStacks.has(entry.thread.id)) {
        result.push(...entry.stack.ancestors);
      }
    }
    return result;
  }, [paginatedEntries, expandedStacks]);

  const {
    selectedIds,
    toggleSelect,
    selectAll,
    clearSelection,
    isAllSelected,
    isSomeSelected,
  } = useThreadListSelection({ threads, paginatedThreads });

  const { focusedThreadId } = useThreadListKeyboard({
    threads,
    onContinue,
    toggleSelect,
  });

  const handleBulkConfirm = useCallback(() => {
    const ids = [...selectedIds];
    if (bulkAction === 'archive') {
      onBulkArchive(ids);
    } else if (bulkAction === 'delete') {
      onBulkDelete(ids);
    }
    clearSelection();
    setBulkAction(null);
  }, [bulkAction, selectedIds, onBulkArchive, onBulkDelete, clearSelection]);

  const handleBulkStatusChange = useCallback((status: ThreadStatus) => {
    if (onBulkStatusChange) {
      onBulkStatusChange([...selectedIds], status);
      clearSelection();
    }
  }, [selectedIds, onBulkStatusChange, clearSelection]);

  const setCurrentPage = useCallback((page: number) => {
    setRequestedPage(page);
  }, []);

  return (
    <div className={`thread-list-container ${viewMode === 'table' ? 'table-view' : ''}`}>
      <div className="thread-list">
        <BulkActionBar
          selectedCount={selectedIds.size}
          onBulkStatusChange={onBulkStatusChange ? handleBulkStatusChange : undefined}
          onBulkAction={setBulkAction}
          onClearSelection={clearSelection}
        />

        {viewMode === 'kanban' && (
          <KanbanView
            threads={threads}
            metadata={metadata}
            onContinue={onContinue}
            onStatusChange={onStatusChange}
            focusedId={focusedThreadId}
          />
        )}

        {viewMode === 'cards' && (
          <DetailCardView
            threads={threads}
            metadata={metadata}
            onContinue={onContinue}
            onArchive={onArchive}
            onDelete={onDelete}
            onStatusChange={onStatusChange}
            focusedId={focusedThreadId}
            groupByDate={groupByDate}
          />
        )}

        {viewMode === 'table' && (
          <table>
            <thead>
              <tr>
                <th className="checkbox-cell">
                  <button
                    className="select-all-btn"
                    onClick={selectAll}
                    title={isAllSelected ? 'Deselect all' : 'Select all'}
                    aria-label={isAllSelected ? 'Deselect all' : 'Select all'}
                  >
                    {isAllSelected ? (
                      <CheckSquare size={16} />
                    ) : isSomeSelected ? (
                      <MinusSquare size={16} />
                    ) : (
                      <Square size={16} />
                    )}
                  </button>
                </th>
                <SortHeader field="status" currentField={sortField} direction={sortDirection} onSort={onSort}>Status</SortHeader>
                <SortHeader field="title" currentField={sortField} direction={sortDirection} onSort={onSort}>Title</SortHeader>
                <th>Labels</th>
                <SortHeader field="lastUpdated" currentField={sortField} direction={sortDirection} onSort={onSort}>Updated</SortHeader>
                <SortHeader field="contextPercent" currentField={sortField} direction={sortDirection} onSort={onSort}>Context</SortHeader>
                <SortHeader field="cost" currentField={sortField} direction={sortDirection} onSort={onSort}>Cost <CostInfoTip /></SortHeader>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedEntries.map((entry) => {
                const stackSize = getStackSize(entry);
                const isExpanded = expandedStacks.has(entry.thread.id);
                
                return (
                  <React.Fragment key={entry.thread.id}>
                    <ThreadRow
                      thread={entry.thread}
                      metadata={metadata[entry.thread.id]}
                      selected={selectedIds.has(entry.thread.id)}
                      focused={focusedThreadId === entry.thread.id}
                      onContinue={onContinue}
                      onArchive={setArchiveTarget}
                      onDelete={setDeleteTarget}
                      onStatusChange={onStatusChange}
                      onSelect={toggleSelect}
                      stackSize={stackSize}
                      isExpanded={isExpanded}
                      onToggleExpand={() => toggleStackExpand(entry.thread.id)}
                    />
                    {entry.kind === 'stack' && entry.stack && isExpanded && 
                      entry.stack.ancestors.map((ancestor) => (
                        <ThreadRow
                          key={ancestor.id}
                          thread={ancestor}
                          metadata={metadata[ancestor.id]}
                          selected={selectedIds.has(ancestor.id)}
                          focused={focusedThreadId === ancestor.id}
                          onContinue={onContinue}
                          onArchive={setArchiveTarget}
                          onDelete={setDeleteTarget}
                          onStatusChange={onStatusChange}
                          onSelect={toggleSelect}
                          isStackChild
                        />
                      ))
                    }
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <PaginationBar
        totalCount={entries.length}
        startIdx={startIdx}
        endIdx={Math.min(endIdx, entries.length)}
        currentPage={currentPage}
        totalPages={totalPages}
        viewMode={viewMode}
        onPageChange={setCurrentPage}
      />

      {archiveTarget && (
        <ConfirmModal
          title="Archive Thread"
          message={`Archive "${archiveTarget.title}"? This hides it from the list. You can restore it later with: amp threads archive --unarchive ${archiveTarget.id}`}
          confirmText="Archive"
          cancelText="Cancel"
          isDestructive={false}
          onConfirm={() => {
            onArchive(archiveTarget.id);
            setArchiveTarget(null);
          }}
          onCancel={() => setArchiveTarget(null)}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete Thread Permanently"
          message={`Are you sure you want to permanently delete "${deleteTarget.title}"? This action cannot be undone.`}
          confirmText="Delete Forever"
          cancelText="Cancel"
          isDestructive
          onConfirm={() => {
            onDelete(deleteTarget.id);
            setDeleteTarget(null);
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {bulkAction === 'archive' && (
        <ConfirmModal
          title="Archive Threads"
          message={`Archive ${selectedIds.size} thread${selectedIds.size === 1 ? '' : 's'}? They will be hidden from the list but can be restored later.`}
          confirmText={`Archive ${selectedIds.size}`}
          cancelText="Cancel"
          isDestructive={false}
          onConfirm={handleBulkConfirm}
          onCancel={() => setBulkAction(null)}
        />
      )}

      {bulkAction === 'delete' && (
        <ConfirmModal
          title="Delete Threads Permanently"
          message={`Are you sure you want to permanently delete ${selectedIds.size} thread${selectedIds.size === 1 ? '' : 's'}? This action cannot be undone.`}
          confirmText={`Delete ${selectedIds.size} Forever`}
          cancelText="Cancel"
          isDestructive
          onConfirm={handleBulkConfirm}
          onCancel={() => setBulkAction(null)}
        />
      )}
    </div>
  );
});
