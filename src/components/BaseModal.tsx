import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
  overlayClassName?: string;
  /** Set to false to disable the focus trap (e.g., for modals with complex internal focus logic). */
  trapFocus?: boolean;
  /** Set to false to prevent closing when the overlay is clicked. */
  closeOnOverlayClick?: boolean;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function BaseModal({
  isOpen,
  onClose,
  title,
  children,
  className,
  overlayClassName,
  trapFocus = true,
  closeOnOverlayClick = true,
}: BaseModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);

  // Capture the element that was focused when the modal opened
  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement;
    }
  }, [isOpen]);

  // Focus trap + ESC handler
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }

      if (trapFocus && e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first || !last) {
          e.preventDefault();
          return;
        }

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, trapFocus]);

  // Focus restoration on close
  useEffect(() => {
    if (isOpen) return;

    const trigger = triggerRef.current;
    if (trigger && trigger instanceof HTMLElement) {
      trigger.focus();
    }
    triggerRef.current = null;
  }, [isOpen]);

  // Auto-focus first focusable element inside modal on open
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    const raf = requestAnimationFrame(() => {
      if (!modalRef.current) return;
      const focusable = modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      focusable[0]?.focus();
    });

    return () => cancelAnimationFrame(raf);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  return createPortal(
    <div className={overlayClassName ?? 'modal-overlay'} onClick={handleOverlayClick}>
      <div
        ref={modalRef}
        className={className}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
