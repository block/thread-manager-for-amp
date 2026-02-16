import { Search } from 'lucide-react';
import type { SidebarSearchProps } from './types';

export function SidebarSearch({ searchQuery, onSearchChange }: SidebarSearchProps) {
  return (
    <div className="sidebar-search">
      <Search size={14} className="sidebar-search-icon" />
      <input
        type="text"
        placeholder="Filter threads..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className="sidebar-search-input"
        aria-label="Filter threads"
      />
    </div>
  );
}
