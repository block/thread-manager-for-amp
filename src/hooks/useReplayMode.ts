import { useState, useCallback, useRef, useEffect } from 'react';
import { apiGet } from '../api/client';
import type { Message } from '../utils/parseMarkdown';
import { parseReplayMessages } from '../utils/parseReplayMessages';

export type ReplayState = 'idle' | 'loading' | 'playing' | 'paused' | 'done';

interface ThreadMessagesResponse {
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string | Array<{ type: string; [key: string]: unknown }>;
    meta?: { sentAt?: number };
  }>;
  title?: string;
}

export interface UseReplayModeReturn {
  replayState: ReplayState;
  replayMessages: Message[];
  replaySpeed: number;
  replayProgress: { current: number; total: number };
  startReplay: (threadId: string) => void;
  pauseReplay: () => void;
  resumeReplay: () => void;
  stopReplay: () => void;
  setReplaySpeed: (speed: number) => void;
  skipToEnd: () => void;
}

function getBaseDelay(msg: Message): number {
  switch (msg.type) {
    case 'user':
      return 500;
    case 'assistant':
      return 100;
    case 'tool_use':
    case 'tool_result':
      return 50;
    default:
      return 100;
  }
}

export function useReplayMode(): UseReplayModeReturn {
  const [replayState, setReplayState] = useState<ReplayState>('idle');
  const [replayMessages, setReplayMessages] = useState<Message[]>([]);
  const [replaySpeed, setReplaySpeed] = useState(1);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const allMessagesRef = useRef<Message[]>([]);
  const currentIndexRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speedRef = useRef(replaySpeed);
  const stateRef = useRef(replayState);

  useEffect(() => {
    speedRef.current = replaySpeed;
  }, [replaySpeed]);

  useEffect(() => {
    stateRef.current = replayState;
  }, [replayState]);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Use a ref-based schedule to avoid circular dependency
  const scheduleNextRef = useRef<() => void>(() => {});

  useEffect(() => {
    scheduleNextRef.current = () => {
      const messages = allMessagesRef.current;
      const idx = currentIndexRef.current;

      if (idx >= messages.length) {
        setReplayState('done');
        setProgress({ current: messages.length, total: messages.length });
        return;
      }

      if (stateRef.current !== 'playing') return;

      const msg = messages[idx];
      if (!msg) return;
      const delay = getBaseDelay(msg) / speedRef.current;

      timerRef.current = setTimeout(() => {
        currentIndexRef.current = idx + 1;
        setReplayMessages((prev) => [...prev, msg]);
        setProgress({ current: idx + 1, total: messages.length });
        scheduleNextRef.current();
      }, delay);
    };
  });

  const startReplay = useCallback(
    async (threadId: string) => {
      clearTimer();
      setReplayState('loading');
      setReplayMessages([]);
      currentIndexRef.current = 0;

      try {
        const result = await apiGet<ThreadMessagesResponse>(
          `/api/thread-messages?threadId=${encodeURIComponent(threadId)}`,
        );
        const parsed = parseReplayMessages(result.messages);
        allMessagesRef.current = parsed;
        setProgress({ current: 0, total: parsed.length });

        if (parsed.length === 0) {
          setReplayState('done');
          return;
        }

        setReplayState('playing');
      } catch {
        setReplayState('idle');
      }
    },
    [clearTimer],
  );

  // When state transitions to 'playing', kick off the schedule
  useEffect(() => {
    if (replayState === 'playing') {
      scheduleNextRef.current();
    }
    return () => clearTimer();
  }, [replayState, clearTimer]);

  const pauseReplay = useCallback(() => {
    clearTimer();
    setReplayState('paused');
  }, [clearTimer]);

  const resumeReplay = useCallback(() => {
    setReplayState('playing');
  }, []);

  const stopReplay = useCallback(() => {
    clearTimer();
    setReplayState('idle');
    setReplayMessages([]);
    allMessagesRef.current = [];
    currentIndexRef.current = 0;
    setProgress({ current: 0, total: 0 });
  }, [clearTimer]);

  const skipToEnd = useCallback(() => {
    clearTimer();
    const all = allMessagesRef.current;
    setReplayMessages([...all]);
    currentIndexRef.current = all.length;
    setProgress({ current: all.length, total: all.length });
    setReplayState('done');
  }, [clearTimer]);

  return {
    replayState,
    replayMessages,
    replaySpeed,
    replayProgress: progress,
    startReplay,
    pauseReplay,
    resumeReplay,
    stopReplay,
    setReplaySpeed,
    skipToEnd,
  };
}
