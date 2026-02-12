import { memo } from 'react';
import { Table, Columns3, LayoutGrid, CalendarDays } from 'lucide-react';
import type { ToolbarViewSwitcherProps, ViewMode } from './types';
import styles from './Toolbar.module.css';

const VIEW_MODES: { mode: ViewMode; icon: typeof Table; label: string; color: string }[] = [
  { mode: 'table', icon: Table, label: 'Table', color: 'var(--accent-cyan)' },
  { mode: 'kanban', icon: Columns3, label: 'Board', color: 'var(--accent-pink)' },
  { mode: 'cards', icon: LayoutGrid, label: 'Cards', color: 'var(--accent-yellow)' },
];

export const ToolbarViewSwitcher = memo(function ToolbarViewSwitcher({
  viewMode,
  onViewModeChange,
  groupByDate,
  onGroupByDateChange,
}: ToolbarViewSwitcherProps) {
  return (
    <div className={styles.viewsRight}>
      <div className={styles.viewTabs}>
        {VIEW_MODES.map(({ mode, icon: Icon, label, color }) => (
          <button
            key={mode}
            className={`${styles.viewTab} ${viewMode === mode ? styles.viewTabActive : ''}`}
            onClick={() => onViewModeChange(mode)}
            title={label}
            style={{ '--mode-color': color } as React.CSSProperties}
          >
            <Icon size={18} />
          </button>
        ))}
      </div>

      {viewMode === 'cards' && (
        <button
          className={`${styles.groupToggle} ${groupByDate ? styles.groupToggleActive : ''}`}
          onClick={() => onGroupByDateChange(!groupByDate)}
          title="Group by date"
        >
          <CalendarDays size={16} />
        </button>
      )}
    </div>
  );
});
