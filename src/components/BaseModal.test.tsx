import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { BaseModal } from './BaseModal';

afterEach(cleanup);

describe('BaseModal', () => {
  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <BaseModal isOpen={false} onClose={vi.fn()} title="Test">
        <p>Modal content</p>
      </BaseModal>,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders portal with role="dialog" when open', () => {
    render(
      <BaseModal isOpen={true} onClose={vi.fn()} title="Test Modal">
        <p>Modal content</p>
      </BaseModal>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'Test Modal');
    expect(screen.getByText('Modal content')).toBeInTheDocument();
  });

  it('calls onClose when ESC is pressed', () => {
    const onClose = vi.fn();
    render(
      <BaseModal isOpen={true} onClose={onClose} title="Test">
        <button>Focusable</button>
      </BaseModal>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when overlay is clicked', () => {
    const onClose = vi.fn();
    render(
      <BaseModal isOpen={true} onClose={onClose} title="Test">
        <p>Content</p>
      </BaseModal>,
    );
    const overlay = document.querySelector('.modal-overlay');
    expect(overlay).toBeInTheDocument();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- asserted above
    fireEvent.click(overlay!);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not close on overlay click when closeOnOverlayClick is false', () => {
    const onClose = vi.fn();
    render(
      <BaseModal isOpen={true} onClose={onClose} title="Test" closeOnOverlayClick={false}>
        <p>Content</p>
      </BaseModal>,
    );
    const overlay = document.querySelector('.modal-overlay');
    expect(overlay).toBeInTheDocument();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- asserted above
    fireEvent.click(overlay!);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('traps focus within modal (Tab wraps from last to first)', () => {
    render(
      <BaseModal isOpen={true} onClose={vi.fn()} title="Focus Test">
        <button>First</button>
        <button>Last</button>
      </BaseModal>,
    );

    const last = screen.getByText('Last');
    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(screen.getByText('First')).toHaveFocus();
  });

  it('traps focus within modal (Shift+Tab wraps from first to last)', () => {
    render(
      <BaseModal isOpen={true} onClose={vi.fn()} title="Focus Test">
        <button>First</button>
        <button>Last</button>
      </BaseModal>,
    );

    const first = screen.getByText('First');
    first.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(screen.getByText('Last')).toHaveFocus();
  });

  it('applies custom className', () => {
    render(
      <BaseModal isOpen={true} onClose={vi.fn()} title="Test" className="custom-class">
        <p>Content</p>
      </BaseModal>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass('custom-class');
  });
});
