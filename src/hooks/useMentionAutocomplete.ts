import { useState, useCallback, useMemo } from 'react';

export type MentionType = 'file' | 'thread';

export interface MentionState {
  active: boolean;
  type: MentionType;
  query: string;
  startIndex: number;
}

const INACTIVE: MentionState = {
  active: false,
  type: 'file',
  query: '',
  startIndex: -1,
};

function detectMention(text: string, cursorPos: number): MentionState {
  if (cursorPos <= 0) return INACTIVE;

  const beforeCursor = text.slice(0, cursorPos);

  // Walk backwards from cursor to find the trigger
  for (let i = beforeCursor.length - 1; i >= 0; i--) {
    const ch = beforeCursor[i];

    // Hit whitespace or newline — check if the token starting after it is a mention
    if (ch === ' ' || ch === '\n' || ch === '\t') {
      const token = beforeCursor.slice(i + 1);
      return parseMentionToken(token, i + 1);
    }

    // Reached start of string
    if (i === 0) {
      const token = beforeCursor;
      return parseMentionToken(token, 0);
    }
  }

  return INACTIVE;
}

function parseMentionToken(token: string, startIndex: number): MentionState {
  if (token.startsWith('@@')) {
    return {
      active: true,
      type: 'thread',
      query: token.slice(2),
      startIndex,
    };
  }
  if (token.startsWith('@')) {
    return {
      active: true,
      type: 'file',
      query: token.slice(1),
      startIndex,
    };
  }
  return INACTIVE;
}

export function useMentionAutocomplete(
  input: string,
  cursorPosition: number,
  inputRef: React.RefObject<HTMLTextAreaElement | null>,
) {
  const [dismissed, setDismissed] = useState(false);

  // Compute mention state from input and cursor position during render
  const mentionState = useMemo(() => {
    if (dismissed) return INACTIVE;
    return detectMention(input, cursorPosition);
  }, [input, cursorPosition, dismissed]);

  // Reset dismissed when input changes
  const closeMention = useCallback(() => {
    setDismissed(true);
    // Re-enable on next input change by resetting via a microtask-deferred flag
    // We'll use the input value changing to reset dismissed
  }, []);

  // Reset dismissed flag when input changes (user is typing again)
  useMemo(() => {
    setDismissed(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  const selectMention = useCallback(
    (value: string, onInputChange: (v: string) => void) => {
      if (!mentionState.active) return;

      const prefix = mentionState.type === 'thread' ? '@@' : '@';
      const cursorPos = inputRef.current?.selectionStart ?? input.length;
      const before = input.slice(0, mentionState.startIndex);
      const afterCursor = input.slice(cursorPos);
      const replacement = `${prefix}${value} `;
      const newInput = before + replacement + afterCursor;

      onInputChange(newInput);

      // Restore cursor position after React re-render
      const newCursorPos = before.length + replacement.length;
      requestAnimationFrame(() => {
        const textarea = inputRef.current;
        if (textarea) {
          textarea.selectionStart = newCursorPos;
          textarea.selectionEnd = newCursorPos;
          textarea.focus();
        }
      });
    },
    [mentionState, input, inputRef],
  );

  return { mentionState, closeMention, selectMention };
}
