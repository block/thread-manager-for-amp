import { X } from 'lucide-react';
import type { TerminalHeaderProps } from './types';

export function TerminalHeader({ threadTitle, embedded, onClose }: TerminalHeaderProps) {
  if (embedded) {
    return null;
  }

  return (
    <div className="terminal-header">
      <div className="terminal-title">
        <span className="terminal-icon">⚡</span>
        <span>{threadTitle}</span>
      </div>
      <div className="terminal-header-actions">
        <button className="terminal-close" onClick={onClose}>
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
