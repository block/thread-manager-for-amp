import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDestructive?: boolean;
}

export function ConfirmModal({
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  isDestructive = false,
}: ConfirmModalProps) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-container" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          {isDestructive && <AlertTriangle size={20} className="modal-warning-icon" />}
          <h3>{title}</h3>
          <button className="modal-close" onClick={onCancel}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">
          <p>{message}</p>
        </div>
        <div className="modal-footer">
          <button className="modal-btn cancel" onClick={onCancel}>
            {cancelText}
          </button>
          <button 
            className={`modal-btn ${isDestructive ? 'destructive' : 'primary'}`} 
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
