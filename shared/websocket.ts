// Shared WebSocket types between frontend and backend

export interface ToolInput {
  cmd?: string;
  cwd?: string;
  path?: string;
  pattern?: string;
  old_str?: string;
  new_str?: string;
  content?: string;
  filePattern?: string;
  query?: string;
  task?: string;
  context?: string;
  files?: string[];
  prompt?: string;
  description?: string;
  objective?: string;
  url?: string;
  code?: string;
  name?: string;
  [key: string]: unknown;
}

// Agent mode passed with messages to control CLI --mode flag
export type AgentMode = 'smart' | 'rush' | 'deep' | 'large';

export const AGENT_MODES: readonly AgentMode[] = ['smart', 'rush', 'deep', 'large'] as const;

// Deep reasoning effort levels (deep, deep², deep³)
export type DeepReasoningEffort = 'medium' | 'high' | 'xhigh';

export const DEEP_EFFORTS: readonly DeepReasoningEffort[] = ['medium', 'high', 'xhigh'] as const;

export const DEEP_EFFORT_LABELS: Record<DeepReasoningEffort, string> = {
  medium: 'deep',
  high: 'deep²',
  xhigh: 'deep³',
};

// Client -> Server messages
export type WsClientMessage =
  | {
      type: 'message';
      content: string;
      image?: { data: string; mediaType: string };
      mode?: AgentMode;
      deepReasoningEffort?: DeepReasoningEffort;
    }
  | { type: 'cancel' };

// Server -> Client messages
export type WsServerMessage =
  | { type: 'ready'; threadId: string; mode?: AgentMode; interrupted?: boolean }
  | {
      type: 'usage';
      contextPercent: number;
      inputTokens: number;
      outputTokens: number;
      maxTokens: number;
      estimatedCost: string;
    }
  | { type: 'text'; content: string }
  | { type: 'thinking'; content: string }
  | { type: 'tool_use'; id: string; name: string; input: ToolInput }
  | { type: 'tool_result'; id: string; success: boolean; result: string }
  | { type: 'error'; content: string }
  | { type: 'done'; code: number }
  | { type: 'system'; subtype: string }
  | { type: 'cancelled' };

// Alias for backward compatibility with frontend
export type WsEvent = WsServerMessage;

// Shell WebSocket types (aligned with server/shell-websocket.ts)
export type ShellClientMessage =
  | { type: 'input'; data?: string }
  | { type: 'resize'; cols?: number; rows?: number }
  | { type: 'ping' };

export type ShellServerMessage =
  | { type: 'connected'; sessionId?: string; shell?: string; cwd?: string }
  | { type: 'output'; data?: string }
  | { type: 'exit'; exitCode?: number }
  | { type: 'error'; content?: string }
  | { type: 'pong' };
