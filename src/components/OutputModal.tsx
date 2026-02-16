import { X } from 'lucide-react';
import { BaseModal } from './BaseModal';
import '../styles/output-modal.css';

interface OutputModalProps {
  title: string;
  content: string;
  isOpen: boolean;
  onClose: () => void;
}

export function OutputModal({ title, content, isOpen, onClose }: OutputModalProps) {
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      className="output-modal"
      overlayClassName="output-modal-overlay"
    >
      <div className="output-modal-header">
        <h3 className="output-modal-title">{title}</h3>
        <button className="output-modal-close" onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      <div className="output-modal-content">
        <pre>{content}</pre>
      </div>
    </BaseModal>
  );
}
