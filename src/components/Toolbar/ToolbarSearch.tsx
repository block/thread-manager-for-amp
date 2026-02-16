import { memo } from 'react';
import { Search } from 'lucide-react';
import type { ToolbarSearchProps } from './types';
import styles from './Toolbar.module.css';

export const ToolbarSearch = memo(function ToolbarSearch({
  searchValue,
  onSearchChange,
}: ToolbarSearchProps) {
  return (
    <div className={styles.search}>
      <Search size={16} className={styles.searchIcon} />
      <input
        type="text"
        placeholder="Filter threads..."
        value={searchValue}
        onChange={(e) => onSearchChange(e.target.value)}
        className={styles.searchInput}
        aria-label="Filter threads"
      />
    </div>
  );
});
