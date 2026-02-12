import type { ViewMode } from '../Toolbar';

interface PaginationBarProps {
  totalCount: number;
  startIdx: number;
  endIdx: number;
  currentPage: number;
  totalPages: number;
  viewMode: ViewMode;
  onPageChange: (page: number) => void;
}

export function PaginationBar({
  totalCount,
  startIdx,
  endIdx,
  currentPage,
  totalPages,
  viewMode,
  onPageChange,
}: PaginationBarProps) {
  if (totalCount === 0) return null;

  return (
    <div className="pagination-bar">
      <span className="pagination-info">
        {viewMode === 'table' ? (
          <>Showing <strong>{startIdx + 1}–{Math.min(endIdx, totalCount)}</strong> of <strong>{totalCount}</strong> threads</>
        ) : (
          <><strong>{totalCount}</strong> threads</>
        )}
      </span>
      
      <div className="footer-hints">
        <span className="hint"><kbd>j</kbd><kbd>k</kbd> navigate</span>
        <span className="hint"><kbd>⌘O</kbd> commands</span>
        <span className="hint"><kbd>⌘N</kbd> new</span>
        <span className="hint"><kbd>⌘R</kbd> refresh</span>
      </div>

      {viewMode === 'table' && totalPages > 1 && (
        <div className="pagination-controls">
          <button
            className="page-btn"
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            aria-label="First page"
          >
            ««
          </button>
          <button
            className="page-btn"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            aria-label="Previous page"
          >
            «
          </button>
          <span className="page-indicator">
            Page {currentPage} of {totalPages}
          </span>
          <button
            className="page-btn"
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            aria-label="Next page"
          >
            »
          </button>
          <button
            className="page-btn"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages}
            aria-label="Last page"
          >
            »»
          </button>
        </div>
      )}
    </div>
  );
}
