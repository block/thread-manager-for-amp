import { useState, useEffect, useRef } from 'react';
import { Circle, ChevronDown } from 'lucide-react';
import type { ThreadStatus } from '../../types';
import { STATUS_OPTIONS } from './constants';

interface BulkStatusMenuProps {
  onStatusChange: (status: ThreadStatus) => void;
}

export function BulkStatusMenu({ onStatusChange }: BulkStatusMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="bulk-status-menu" ref={menuRef}>
      <button
        className="bulk-btn status"
        onClick={() => setOpen(!open)}
      >
        <Circle size={14} />
        Status
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="bulk-status-dropdown">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className="bulk-status-option"
              onClick={() => {
                onStatusChange(opt.value);
                setOpen(false);
              }}
              style={{ '--status-color': opt.color } as React.CSSProperties}
            >
              <Circle size={10} className="status-dot" />
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
