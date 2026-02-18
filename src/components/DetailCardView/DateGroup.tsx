import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

export interface DateGroupProps {
  label: string;
  count: number;
  isCollapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export function DateGroup({ label, count, isCollapsed, onToggle, children }: DateGroupProps) {
  return (
    <div className="detail-card-group">
      <button className="detail-card-group-header" onClick={onToggle}>
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        <span className="detail-card-group-label">{label}</span>
        <span className="detail-card-group-count">{count}</span>
      </button>

      {!isCollapsed && <div className="detail-card-grid">{children}</div>}
    </div>
  );
}

export function getDateLabel(dateStr: string | undefined): string {
  if (!dateStr) return 'Older';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 'Older';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return 'This Week';
  if (diffDays < 30) return 'This Month';
  return 'Older';
}
