import { Loader2, ChevronsUpDown, PanelLeftClose, PanelLeft } from 'lucide-react';
import type { SidebarHeaderProps } from './types';

export function SidebarHeader({
  collapsed,
  runningCount,
  allExpanded,
  onToggleCollapse,
  onToggleAllWorkspaces,
}: SidebarHeaderProps) {
  return (
    <div className="sidebar-header">
      {!collapsed && (
        <>
          <span className="sidebar-title">Projects</span>
          {runningCount > 0 && (
            <span className="sidebar-stats">
              <span className="sidebar-stat running">
                <Loader2 size={12} className="spinning" />
                {runningCount}
              </span>
            </span>
          )}
          <button 
            className="sidebar-expand-all-btn"
            onClick={onToggleAllWorkspaces}
            title={allExpanded ? 'Collapse all' : 'Expand all'}
          >
            <ChevronsUpDown size={14} />
          </button>
          <div className="sidebar-header-spacer" />
        </>
      )}
      <button 
        className="sidebar-collapse-btn"
        onClick={onToggleCollapse}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
      </button>
    </div>
  );
}
