import { useState, useRef } from 'react';
import { GitBranch, X, Loader2 } from 'lucide-react';
import { BaseModal } from './BaseModal';

interface HandoffModalProps {
  isOpen: boolean;
  threadId: string;
  threadTitle?: string;
  onConfirm: (goal: string, newTitle?: string) => Promise<void>;
  onCancel: () => void;
}

export function HandoffModal({ isOpen, threadId, threadTitle, onConfirm, onCancel }: HandoffModalProps) {
  const [goal, setGoal] = useState('');
  const [title, setTitle] = useState('');
  const [phase, setPhase] = useState<'idle' | 'running' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = async () => {
    if (phase === 'running') return;
    setPhase('running');
    setErrorMessage('');
    try {
      await onConfirm(goal.trim() || 'Continue the previous work', title.trim() || undefined);
    } catch (err) {
      setPhase('error');
      setErrorMessage(err instanceof Error ? err.message : 'Handoff failed');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && phase !== 'running') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isDisabled = phase === 'running';

  const handleClose = () => {
    if (!isDisabled) {
      onCancel();
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Handoff Thread"
      className="handoff-modal"
      closeOnOverlayClick={!isDisabled}
    >
      <div className="handoff-modal-header">
        <GitBranch size={18} />
        <h3>{phase === 'running' ? 'Creating Thread...' : 'Handoff Thread'}</h3>
        {!isDisabled && (
          <button className="modal-close" onClick={onCancel}>
            <X size={18} />
          </button>
        )}
      </div>
      
      <div className="handoff-modal-body">
        {phase === 'running' ? (
          <div className="handoff-loading">
            <Loader2 size={32} className="handoff-spinner" />
            <p className="handoff-loading-text">Creating new thread from handoff...</p>
            <p className="handoff-loading-subtext">This may take 10-30 seconds</p>
          </div>
        ) : (
          <>
            <p className="handoff-thread-id">{threadTitle || threadId}</p>
            {phase === 'error' && (
              <div className="handoff-error">
                {errorMessage}
              </div>
            )}
            <label className="handoff-label">
              New thread title
              <span className="handoff-optional">(optional)</span>
            </label>
            <input
              type="text"
              className="handoff-title-input"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Auto-generated from goal..."
              disabled={isDisabled}
              aria-label="New thread title"
            />
            <label className="handoff-label">
              Goal for the new thread
              <span className="handoff-optional">(optional)</span>
            </label>
            <textarea
              ref={inputRef}
              className="handoff-input"
              value={goal}
              onChange={e => setGoal(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Continue the previous work..."
              rows={3}
              disabled={isDisabled}
              aria-label="Goal for the new thread"
            />
            <p className="handoff-hint">
              Press <kbd>Enter</kbd> to confirm, <kbd>Esc</kbd> to cancel
            </p>
          </>
        )}
      </div>
      
      {phase !== 'running' && (
        <div className="handoff-modal-footer">
          <button className="modal-btn cancel" onClick={onCancel}>
            Cancel
          </button>
          <button 
            className="modal-btn primary"
            onClick={handleSubmit}
            disabled={isDisabled}
          >
            <GitBranch size={14} />
            {phase === 'error' ? 'Retry' : 'Handoff'}
          </button>
        </div>
      )}
    </BaseModal>
  );
}
