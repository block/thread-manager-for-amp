import type { ContextWarningProps } from './types';

export function ContextWarning({ 
  threadId, 
  onHandoff, 
  onNewThread, 
  onDismiss 
}: ContextWarningProps) {
  return (
    <div className="context-limit-modal">
      <div className="context-limit-content">
        <h3 className="context-limit-title">Context Limit Reached</h3>
        <p className="context-limit-message">
          This conversation has reached the context window limit. Start a new thread or use Handoff to continue with relevant context.
        </p>
        <div className="context-limit-actions">
          {onHandoff && (
            <button 
              className="context-limit-btn primary"
              onClick={() => {
                onDismiss();
                onHandoff(threadId);
              }}
            >
              ▶ Handoff
            </button>
          )}
          {onNewThread && (
            <button 
              className="context-limit-btn"
              onClick={() => {
                onDismiss();
                onNewThread();
              }}
            >
              New Thread
            </button>
          )}
          <button 
            className="context-limit-btn dismiss"
            onClick={onDismiss}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
