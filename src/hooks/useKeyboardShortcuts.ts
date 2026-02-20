import { useEffect, useRef } from 'react';

export interface KeyboardShortcutHandlers {
  onOpenCommandPalette: () => void;
  onNewThread: () => void;
  onRefresh: () => void;
  onCloseThread: () => void;
  onOpenSettings: () => void;
  onHandoff: () => void;
  onToggleSidebar: () => void;
  onOpenShellTerminal: () => void;
  onToggleDeepMode: () => void;
  onToggleThinkingBlocks: () => void;
  onOpenPromptHistory?: () => void;
  onUndoLastTurn?: () => void;
}

export interface UseKeyboardShortcutsOptions {
  handlers: KeyboardShortcutHandlers;
  activeThreadId: string | undefined;
  activeThreadModeLocked: boolean;
}

export function useKeyboardShortcuts({
  handlers,
  activeThreadId,
  activeThreadModeLocked,
}: UseKeyboardShortcutsOptions): void {
  const handlersRef = useRef(handlers);
  const activeThreadIdRef = useRef(activeThreadId);
  const modeLockedRef = useRef(activeThreadModeLocked);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    activeThreadIdRef.current = activeThreadId;
  }, [activeThreadId]);

  useEffect(() => {
    modeLockedRef.current = activeThreadModeLocked;
  }, [activeThreadModeLocked]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const h = handlersRef.current;
      const threadId = activeThreadIdRef.current;

      // Ctrl+O or Cmd+O to open command palette
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        h.onOpenCommandPalette();
      }
      // Ctrl+N for new thread
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        h.onNewThread();
      }
      // Ctrl+R: prompt history when thread is active, otherwise refresh
      if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        if (threadId && h.onOpenPromptHistory) {
          h.onOpenPromptHistory();
        } else {
          h.onRefresh();
        }
      }
      // Ctrl+W to close current thread
      if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        e.preventDefault();
        if (threadId) {
          h.onCloseThread();
        }
      }
      // Ctrl+, to open settings
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        h.onOpenSettings();
      }
      // Ctrl+H for handoff
      if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
        e.preventDefault();
        if (threadId) {
          h.onHandoff();
        }
      }
      // Ctrl+B to toggle sidebar
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        h.onToggleSidebar();
      }
      // Ctrl+T to open shell terminal (not Cmd, to avoid browser conflicts)
      if (e.ctrlKey && !e.metaKey && e.key === 't') {
        e.preventDefault();
        h.onOpenShellTerminal();
      }
      // Alt+D to toggle deep mode (disabled when thread mode is locked)
      if (e.altKey && e.key === 'd') {
        e.preventDefault();
        if (!modeLockedRef.current) {
          h.onToggleDeepMode();
        }
      }
      // Alt+T to toggle thinking blocks visibility
      if (e.altKey && e.key === 't') {
        e.preventDefault();
        h.onToggleThinkingBlocks();
      }
      // Ctrl+Z when not in a text input — undo last turn
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key === 'z' &&
        !e.shiftKey &&
        threadId &&
        h.onUndoLastTurn
      ) {
        const target = e.target as HTMLElement;
        const isTextInput =
          target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
        if (!isTextInput) {
          e.preventDefault();
          h.onUndoLastTurn();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
