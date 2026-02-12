import { useState, useRef, useEffect } from 'react';
import { Link2, X, Trash2, Plus } from 'lucide-react';
import type { ThreadBlocker, Thread } from '../types';

interface BlockerModalProps {
  isOpen: boolean;
  threadId: string;
  threadTitle: string;
  blockers: ThreadBlocker[];
  threads: Thread[];
  onAddBlocker: (blockedByThreadId: string, reason?: string) => void;
  onRemoveBlocker: (blockedByThreadId: string) => void;
  onClose: () => void;
  onOpenThread?: (thread: Thread) => void;
}

export function BlockerModal({
  isOpen,
  threadId,
  threadTitle,
  blockers,
  threads,
  onAddBlocker,
  onRemoveBlocker,
  onClose,
  onOpenThread,
}: BlockerModalProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedThreadId, setSelectedThreadId] = useState('');
  const [reason, setReason] = useState('');
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (showAddForm && selectRef.current) {
      selectRef.current.focus();
    }
  }, [showAddForm]);

  if (!isOpen) return null;

  const availableThreads = threads.filter(
    t => t.id !== threadId && !blockers.some(b => b.blocked_by_thread_id === t.id)
  );

  const handleAdd = () => {
    if (selectedThreadId) {
      onAddBlocker(selectedThreadId, reason || undefined);
      setShowAddForm(false);
      setSelectedThreadId('');
      setReason('');
    }
  };

  const getThreadTitle = (id: string) => {
    const thread = threads.find(t => t.id === id);
    return thread?.title || id.slice(0, 12) + '...';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="blocker-modal" onClick={e => e.stopPropagation()}>
        <div className="blocker-modal-header">
          <Link2 size={18} />
          <h3>Thread Blockers</h3>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="blocker-modal-body">
          <p className="blocker-thread-title">{threadTitle}</p>
          <p className="blocker-thread-id">{threadId}</p>

          {blockers.length === 0 && !showAddForm && (
            <p className="blocker-empty">No blockers. This thread is not waiting on any other threads.</p>
          )}

          {blockers.length > 0 && (
            <div className="blocker-list">
              <h4>Blocked by:</h4>
              {blockers.map(blocker => (
                <div key={blocker.blocked_by_thread_id} className="blocker-item">
                  <div className="blocker-item-info">
                    <button
                      className="blocker-thread-link"
                      onClick={() => {
                        const thread = threads.find(t => t.id === blocker.blocked_by_thread_id);
                        if (thread && onOpenThread) {
                          onOpenThread(thread);
                          onClose();
                        }
                      }}
                    >
                      {getThreadTitle(blocker.blocked_by_thread_id)}
                    </button>
                    {blocker.reason && (
                      <span className="blocker-reason">{blocker.reason}</span>
                    )}
                    {blocker.blocker_status && (
                      <span className={`blocker-status status-${blocker.blocker_status}`}>
                        {blocker.blocker_status}
                      </span>
                    )}
                  </div>
                  <button
                    className="blocker-remove"
                    onClick={() => onRemoveBlocker(blocker.blocked_by_thread_id)}
                    title="Remove blocker"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {showAddForm ? (
            <div className="blocker-add-form">
              <select
                ref={selectRef}
                value={selectedThreadId}
                onChange={e => setSelectedThreadId(e.target.value)}
                className="blocker-select"
              >
                <option value="">Select a thread...</option>
                {availableThreads.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.title.slice(0, 50)}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Reason (optional)"
                className="blocker-reason-input"
              />
              <div className="blocker-add-actions">
                <button className="modal-btn cancel" onClick={() => setShowAddForm(false)}>
                  Cancel
                </button>
                <button
                  className="modal-btn primary"
                  onClick={handleAdd}
                  disabled={!selectedThreadId}
                >
                  Add Blocker
                </button>
              </div>
            </div>
          ) : (
            <button className="blocker-add-btn" onClick={() => setShowAddForm(true)}>
              <Plus size={14} />
              Add Blocker
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
