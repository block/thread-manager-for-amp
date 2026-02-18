// Re-export all types from shared package
export * from '../shared/types.js';
export type { WsEvent, WsServerMessage, WsClientMessage, ToolInput } from '../shared/websocket.js';

export type ViewMode = 'table' | 'kanban' | 'cards';
