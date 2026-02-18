import { useState, useEffect, useCallback } from 'react';
import type { Thread } from '../../types';

interface UseThreadListKeyboardOptions {
  threads: Thread[];
  onContinue: (thread: Thread) => void;
  toggleSelect: (threadId: string, shiftKey: boolean) => void;
}

export function useThreadListKeyboard({
  threads,
  onContinue,
  toggleSelect,
}: UseThreadListKeyboardOptions) {
  const [focusedIndex, setFocusedIndex] = useState(-1);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case 'j':
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex((prev) => Math.min(prev + 1, threads.length - 1));
          break;
        case 'k':
        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter': {
          const enterThread = focusedIndex >= 0 ? threads[focusedIndex] : undefined;
          if (enterThread) {
            onContinue(enterThread);
          }
          break;
        }
        case 'x': {
          const xThread = focusedIndex >= 0 ? threads[focusedIndex] : undefined;
          if (xThread) {
            toggleSelect(xThread.id, e.shiftKey);
          }
          break;
        }
        case 'Escape':
          setFocusedIndex(-1);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [threads, focusedIndex, onContinue, toggleSelect]);

  const focusedThreadId = focusedIndex >= 0 ? threads[focusedIndex]?.id : undefined;

  const resetFocus = useCallback(() => {
    setFocusedIndex(-1);
  }, []);

  return {
    focusedIndex,
    focusedThreadId,
    setFocusedIndex,
    resetFocus,
  };
}
