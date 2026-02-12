import type { ThreadStatus } from '../../types';

export const STATUS_OPTIONS: { value: ThreadStatus; label: string; color: string }[] = [
  { value: 'active', label: 'Active', color: 'var(--accent-cyan)' },
  { value: 'parked', label: 'Paused', color: 'var(--accent-yellow)' },
  { value: 'blocked', label: 'Blocked', color: 'var(--accent-pink)' },
  { value: 'done', label: 'Done', color: 'var(--accent-green)' },
];

export const PAGE_SIZE = 25;
