import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Play, ExternalLink, Copy, Link, Archive, Trash2 } from 'lucide-react';
import type { SidebarContextMenuProps } from './types';

export function SidebarContextMenu({
  state,
  onClose,
  onContinue,
  onOpenInBrowser,
  onCopyId,
  onCopyUrl,
  onArchive,
  onDelete,
}: SidebarContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!state.visible) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [state.visible, onClose]);

  if (!state.visible || !state.thread) return null;

  const menuItems = [
    { label: 'Continue', icon: Play, action: onContinue },
    { label: 'Open in Browser', icon: ExternalLink, action: onOpenInBrowser },
    { label: 'Copy Thread ID', icon: Copy, action: onCopyId },
    { label: 'Copy Thread URL', icon: Link, action: onCopyUrl },
    { type: 'separator' as const },
    { label: 'Archive', icon: Archive, action: onArchive },
    { label: 'Delete', icon: Trash2, action: onDelete, danger: true },
  ];

  return createPortal(
    <div ref={menuRef} className="sidebar-context-menu" style={{ left: state.x, top: state.y }}>
      {menuItems.map((item, idx) => {
        if (item.type === 'separator') {
          return <div key={idx} className="sidebar-context-menu-separator" />;
        }
        const Icon = item.icon;
        return (
          <button
            key={item.label}
            className={`sidebar-context-menu-item ${item.danger ? 'danger' : ''}`}
            onClick={() => {
              item.action?.();
              onClose();
            }}
            disabled={!item.action}
          >
            <Icon size={14} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>,
    document.body,
  );
}
