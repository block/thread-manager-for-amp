import type { Message } from '../../utils/parseMarkdown';
import type { Thread } from '../../types';
import type { AgentStatus } from './useTerminalWebSocket';
import type { AgentMode } from '../../../shared/websocket.js';

export interface UsageInfo {
  contextPercent: number;
  inputTokens: number;
  outputTokens: number;
  maxTokens: number;
  estimatedCost: string;
}

export interface TerminalProps {
  thread: Thread;
  onClose: () => void;
  embedded?: boolean;
  onHandoff?: (threadId: string) => void;
  onNewThread?: () => void;
  onOpenThread?: (thread: Thread) => void;
  autoFocus?: boolean;
  replayThreadId?: string | null;
  onStopReplay?: () => void;
}

export interface TerminalHeaderProps {
  threadTitle: string;
  embedded: boolean;
  onClose: () => void;
}

export interface TerminalMessagesProps {
  messages: Message[];
  isLoading: boolean;
  hasMoreMessages: boolean;
  loadingMore: boolean;
  isRunning?: boolean;
  activeMinimapId?: string;
  messagesContainerRef: React.RefObject<HTMLDivElement | null>;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  messageRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  onLoadMore: () => void;
  onViewImage: (image: { data: string; mediaType: string }) => void;
  showThinkingBlocks: boolean;
  onEditMessage?: (messageIndex: number, currentText: string) => void;
  onUndoLastTurn?: () => void;
}

export interface TerminalInputProps {
  input: string;
  isConnected: boolean;
  isSending: boolean;
  isRunning: boolean;
  agentStatus: AgentStatus;
  pendingImage: { data: string; mediaType: string } | null;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onCancel: () => void;
  onClose: () => void;
  onPendingImageRemove: () => void;
  onPendingImageSet: (image: { data: string; mediaType: string }) => void;
  searchOpen: boolean;
  workspacePath: string | null;
  agentMode: AgentMode;
  onCycleMode: () => void;
  isModeLocked: boolean;
  hasQueuedMessage: boolean;
}

export interface GitInfo {
  branch: string | null;
  isWorktree: boolean;
}

export interface TerminalStatusBarProps {
  usage: UsageInfo;
  gitInfo?: GitInfo | null;
}

export interface ContextWarningProps {
  threadId: string;
  onHandoff?: (threadId: string) => void;
  onNewThread?: () => void;
  onDismiss: () => void;
}
