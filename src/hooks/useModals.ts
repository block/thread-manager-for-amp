import { useState, useCallback } from 'react';

export interface OutputModalState {
  title: string;
  content: string;
}

export interface ShellTerminalState {
  cwd?: string;
  minimized?: boolean;
}

export interface InputModalState {
  title: string;
  label: string;
  placeholder?: string;
  confirmText?: string;
  validate?: (value: string) => string | null;
  onConfirm: (value: string) => void;
}

export interface ConfirmModalState {
  title: string;
  message: string;
  confirmText?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
}

export interface TasksModalState {
  tab: 'list' | 'import';
}

export interface CodeReviewModalState {
  workspace?: string;
}

export interface UseModalsReturn {
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;

  outputModal: OutputModalState | null;
  setOutputModal: (modal: OutputModalState | null) => void;

  inputModal: InputModalState | null;
  setInputModal: (modal: InputModalState | null) => void;

  confirmModal: ConfirmModalState | null;
  setConfirmModal: (modal: ConfirmModalState | null) => void;

  workspacePickerOpen: boolean;
  setWorkspacePickerOpen: (open: boolean) => void;

  blockerThreadId: string | null;
  setBlockerThreadId: (id: string | null) => void;

  shellTerminal: ShellTerminalState | null;
  setShellTerminal: (state: ShellTerminalState | null) => void;
  openShellTerminal: (cwd?: string) => void;
  closeShellTerminal: () => void;
  minimizeShellTerminal: () => void;
  restoreShellTerminal: () => void;

  tasksModal: TasksModalState | null;
  setTasksModal: (state: TasksModalState | null) => void;

  replayThreadId: string | null;
  setReplayThreadId: (id: string | null) => void;

  codeReviewModal: CodeReviewModalState | null;
  setCodeReviewModal: (state: CodeReviewModalState | null) => void;
}

export function useModals(): UseModalsReturn {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [outputModal, setOutputModal] = useState<OutputModalState | null>(null);
  const [inputModal, setInputModal] = useState<InputModalState | null>(null);
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState | null>(null);
  const [workspacePickerOpen, setWorkspacePickerOpen] = useState(false);
  const [blockerThreadId, setBlockerThreadId] = useState<string | null>(null);
  const [shellTerminal, setShellTerminal] = useState<ShellTerminalState | null>(null);
  const [tasksModal, setTasksModal] = useState<TasksModalState | null>(null);
  const [replayThreadId, setReplayThreadId] = useState<string | null>(null);
  const [codeReviewModal, setCodeReviewModal] = useState<CodeReviewModalState | null>(null);

  const openShellTerminal = useCallback((cwd?: string) => {
    setShellTerminal((prev) => (prev ? { ...prev, minimized: false } : { cwd }));
  }, []);

  const closeShellTerminal = useCallback(() => {
    setShellTerminal(null);
  }, []);

  const minimizeShellTerminal = useCallback(() => {
    setShellTerminal((prev) => (prev ? { ...prev, minimized: true } : null));
  }, []);

  const restoreShellTerminal = useCallback(() => {
    setShellTerminal((prev) => (prev ? { ...prev, minimized: false } : null));
  }, []);

  return {
    commandPaletteOpen,
    setCommandPaletteOpen,
    outputModal,
    setOutputModal,
    inputModal,
    setInputModal,
    confirmModal,
    setConfirmModal,
    workspacePickerOpen,
    setWorkspacePickerOpen,
    blockerThreadId,
    setBlockerThreadId,
    shellTerminal,
    setShellTerminal,
    openShellTerminal,
    closeShellTerminal,
    minimizeShellTerminal,
    restoreShellTerminal,
    tasksModal,
    setTasksModal,
    replayThreadId,
    setReplayThreadId,
    codeReviewModal,
    setCodeReviewModal,
  };
}
