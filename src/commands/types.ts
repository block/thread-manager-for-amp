import type { ReactNode } from 'react';
import type { AgentMode, DeepReasoningEffort } from '../../shared/websocket.js';

export interface Command {
  id: string;
  category: string;
  label: string;
  shortcut?: string;
  icon?: ReactNode;
  action: () => void;
  disabled?: boolean;
}

export interface UseCommandsOptions {
  onNewThread: () => void;
  onRefresh: () => void;
  onCloseAllTerminals: () => void;
  onCloseThread?: (id: string) => void;
  openThreads: { id: string; title: string }[];
  activeThreadId?: string;
  onCopyThreadId?: (id: string) => void;
  onCopyThreadUrl?: (id: string) => void;
  onOpenInBrowser?: (id: string) => void;
  onArchiveThread?: (id: string) => void;
  onDeleteThread?: (id: string) => void;
  onToggleLayout?: () => void;
  onHandoff?: (id: string) => void;
  onRenameThread?: (id: string) => void;
  onShareThread?: (id: string) => void;
  onShowSkills?: () => void;
  onShowTools?: () => void;
  onShowMcpStatus?: () => void;
  onShowMcpList?: () => void;
  onShowPermissions?: () => void;
  onShowHelp?: () => void;
  onThreadMap?: (id: string) => void;
  onArchiveAndClose?: (id: string) => void;
  onArchiveOldThreads?: () => void;
  onSwitchToPrevious?: () => void;
  onSwitchToNext?: () => void;
  onContextAnalyze?: () => void;
  onAddLabel?: (id: string) => void;
  onRemoveLabel?: (id: string) => void;
  onSkillAdd?: () => void;
  onSkillRemove?: () => void;
  onSkillInfo?: () => void;
  onManageBlockers?: (id: string) => void;
  onToggleSidebar?: () => void;
  onOpenShellTerminal?: () => void;
  onReplayThread?: (id: string) => void;
  onCodeReview?: () => void;
  onOpenPromptHistory?: () => void;
  onUndoLastTurn?: () => void;
  onShowAgentsMdList?: () => void;
  onSetVisibility?: (id: string, visibility: string) => void;
  onShowUsage?: () => void;
  onCheckForUpdates?: () => void;
}

export interface CommandFactoryContext {
  activeThreadId?: string;
  hasActiveThread: boolean;
  openThreadsCount: number;
  soundEnabled: boolean;
  toggleSound: () => void;
  agentMode: AgentMode;
  deepReasoningEffort: DeepReasoningEffort;
  onSetAgentMode?: (mode: AgentMode) => void;
  onToggleDeepMode?: () => void;
  activeThreadModeLocked: boolean;
  showThinkingBlocks: boolean;
  onToggleThinkingBlocks?: () => void;
}

export type CommandHandlers = Omit<UseCommandsOptions, 'openThreads' | 'activeThreadId'>;
