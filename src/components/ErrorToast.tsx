import { useEffect } from 'react';
import { AlertCircle, X } from 'lucide-react';

export interface ErrorToastMessage {
  id: string;
  message: string;
}

interface ErrorToastProps {
  errors: ErrorToastMessage[];
  onDismiss: (id: string) => void;
}

const AUTO_DISMISS_MS = 5000;

export function ErrorToast({ errors, onDismiss }: ErrorToastProps) {
  useEffect(() => {
    if (errors.length === 0) return;

    const timers = errors.map(err =>
      setTimeout(() => onDismiss(err.id), AUTO_DISMISS_MS)
    );

    return () => timers.forEach(clearTimeout);
  }, [errors, onDismiss]);

  if (errors.length === 0) return null;

  return (
    <div className="error-toast-container" aria-live="assertive">
      {errors.map(err => (
        <div key={err.id} className="error-toast" role="alert">
          <AlertCircle size={16} className="error-toast-icon" />
          <span className="error-toast-message">{err.message}</span>
          <button
            className="error-toast-close"
            onClick={() => onDismiss(err.id)}
            aria-label="Dismiss error"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
