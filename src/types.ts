// Re-export all types from shared package
// This maintains backward compatibility with existing imports
export * from '../shared/types.js';

export type ViewMode = 'table' | 'kanban' | 'cards';
