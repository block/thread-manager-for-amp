import React from 'react';
import type { SortField, SortDirection } from '../../types';

interface SortHeaderProps {
  field: SortField;
  currentField: SortField;
  direction: SortDirection;
  onSort: (field: SortField) => void;
  children: React.ReactNode;
}

export function SortHeader({ field, currentField, direction, onSort, children }: SortHeaderProps) {
  return (
    <th onClick={() => onSort(field)} className="sortable-header">
      {children}
      {currentField === field && (
        <span className="sort-indicator">{direction === 'asc' ? '↑' : '↓'}</span>
      )}
    </th>
  );
}
