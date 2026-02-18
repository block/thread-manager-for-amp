import { useState, useCallback, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { BaseModal } from './BaseModal';

interface InputModalProps {
  isOpen: boolean;
  title: string;
  label: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
  validate?: (value: string) => string | null;
}

function InputModalContent({
  title,
  label,
  placeholder,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  validate,
}: Omit<InputModalProps, 'isOpen'>) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;

    if (validate) {
      const err = validate(trimmed);
      if (err) {
        setError(err);
        return;
      }
    }

    onConfirm(trimmed);
  }, [value, validate, onConfirm]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  return (
    <>
      <div className="modal-header">
        <h3>{title}</h3>
        <button className="modal-close" onClick={onCancel} aria-label="Close">
          <X size={18} />
        </button>
      </div>
      <div className="modal-body">
        <label className="input-modal-label">
          {label}
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="input-modal-input"
            aria-label={label}
          />
        </label>
        {error && (
          <p className="input-modal-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="modal-footer">
        <button className="modal-btn cancel" onClick={onCancel}>
          {cancelText}
        </button>
        <button className="modal-btn primary" onClick={handleSubmit} disabled={!value.trim()}>
          {confirmText}
        </button>
      </div>
    </>
  );
}

export function InputModal({ isOpen, onCancel, title, ...props }: InputModalProps) {
  if (!isOpen) return null;

  return (
    <BaseModal isOpen={isOpen} onClose={onCancel} title={title} className="modal-container">
      <InputModalContent title={title} onCancel={onCancel} {...props} />
    </BaseModal>
  );
}
