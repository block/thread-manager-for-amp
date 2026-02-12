import { X } from 'lucide-react';
import '../styles/output-modal.css';

interface OutputModalProps {
  title: string;
  content: string;
  isOpen: boolean;
  onClose: () => void;
}

export function OutputModal({ title, content, isOpen, onClose }: OutputModalProps) {
  if (!isOpen) return null;

  return (
    <div className="output-modal-overlay" onClick={onClose}>
      <div className="output-modal" onClick={e => e.stopPropagation()}>
        <div className="output-modal-header">
          <h3 className="output-modal-title">{title}</h3>
          <button className="output-modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="output-modal-content">
          <pre>{content}</pre>
        </div>
      </div>
    </div>
  );
}
