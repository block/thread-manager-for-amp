import { useEffect, useRef, useState, useCallback } from 'react';
import type { Message } from '../../utils/parseMarkdown';
import type { WsEvent } from '../../types';
import type { UsageInfo } from './types';
import { formatToolUse } from '../../utils/format';
import { playNotificationSound, isSoundEnabled } from '../../utils/sounds';
import { generateId, stripAnsi } from '../../../shared/utils.js';

interface UseTerminalWebSocketOptions {
  threadId: string;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setUsage: React.Dispatch<React.SetStateAction<UsageInfo | null>>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
}

export type AgentStatus = 'idle' | 'waiting' | 'streaming' | 'running_tools';

const MAX_RECONNECT_ATTEMPTS = 10;

export function useTerminalWebSocket({
  threadId,
  setMessages,
  setUsage,
  setIsLoading,
}: UseTerminalWebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('idle');
  const [connectionError, setConnectionError] = useState(false);
  const [reconnectTrigger, setReconnectTrigger] = useState(0);
  const [, setNoResponseDetected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const gotResponseRef = useRef(false);
  const wasCancelledRef = useRef(false);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?threadId=${encodeURIComponent(
      threadId,
    )}`;
    let isCleanedUp = false;
    let reconnectAttempt = 0;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let errorTimeout: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      if (isCleanedUp) return;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      let wasConnected = false;

      ws.onopen = () => {
        if (errorTimeout) {
          clearTimeout(errorTimeout);
          errorTimeout = null;
        }
        reconnectAttempt = 0;
        setConnectionError(false);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string) as WsEvent;

          switch (data.type) {
            case 'ready':
              wasConnected = true;
              setIsConnected(true);
              break;
            case 'usage':
              setUsage({
                contextPercent: data.contextPercent,
                inputTokens: data.inputTokens,
                outputTokens: data.outputTokens,
                maxTokens: data.maxTokens,
                estimatedCost: data.estimatedCost,
              });
              break;
            case 'text':
              setIsSending(false);
              setIsRunning(true);
              setAgentStatus('streaming');
              gotResponseRef.current = true;
              setMessages((prev) => [
                ...prev,
                { id: generateId(), type: 'assistant', content: data.content },
              ]);
              break;
            case 'tool_use':
              setIsRunning(true);
              setAgentStatus('running_tools');
              gotResponseRef.current = true;
              setMessages((prev) => [
                ...prev,
                {
                  id: generateId(),
                  type: 'tool_use',
                  content: formatToolUse(data.name, data.input),
                  toolName: data.name,
                  toolId: data.id,
                  toolInput: data.input,
                },
              ]);
              break;
            case 'tool_result':
              gotResponseRef.current = true;
              setMessages((prev) => {
                const toolUse = prev.find((m) => m.type === 'tool_use' && m.toolId === data.id);
                return [
                  ...prev,
                  {
                    id: generateId(),
                    type: 'tool_result',
                    content: data.result,
                    toolId: data.id,
                    toolName: toolUse?.toolName,
                    success: data.success,
                  },
                ];
              });
              break;
            case 'error': {
              setIsSending(false);
              setIsRunning(false);
              setAgentStatus('idle');
              const errorContent = stripAnsi(data.content || '').trim();
              if (!errorContent) break;
              const errorLower = errorContent.toLowerCase();
              const isContextLimit =
                (errorLower.includes('context') &&
                  (errorLower.includes('limit') ||
                    errorLower.includes('exceeded') ||
                    errorLower.includes('too long') ||
                    errorLower.includes('full'))) ||
                errorLower.includes('token limit') ||
                errorLower.includes('max_tokens') ||
                errorLower.includes('maximum context') ||
                errorLower.includes('conversation too long') ||
                errorLower.includes('input too long');
              setMessages((prev) => [
                ...prev,
                {
                  id: generateId(),
                  type: 'error',
                  content: errorContent,
                  isContextLimit,
                },
              ]);
              break;
            }
            case 'done':
              setIsSending(false);
              setIsRunning(false);
              setAgentStatus('idle');
              if (!gotResponseRef.current && !wasCancelledRef.current) {
                setNoResponseDetected(true);
                setMessages((prev) => [
                  ...prev,
                  {
                    id: generateId(),
                    type: 'error',
                    content: 'No response from agent. The context window may be full.',
                    isContextLimit: true,
                  },
                ]);
              } else if (isSoundEnabled() && !wasCancelledRef.current) {
                playNotificationSound();
              }
              wasCancelledRef.current = false;
              break;
            case 'system':
              if (data.subtype === 'interrupting') {
                // Mark the last user message as interrupted
                setMessages((prev) => {
                  const lastUserIdx = prev.findLastIndex((m) => m.type === 'user');
                  if (lastUserIdx === -1) return prev;
                  const updated = [...prev];
                  const existing = updated[lastUserIdx];
                  if (existing) {
                    updated[lastUserIdx] = { ...existing, interrupted: true };
                  }
                  return updated;
                });
              }
              break;
            case 'cancelled':
              setIsSending(false);
              setIsRunning(false);
              setAgentStatus('idle');
              wasCancelledRef.current = true;
              setMessages((prev) => [
                ...prev,
                { id: generateId(), type: 'system' as const, content: 'Operation cancelled' },
              ]);
              break;
          }
        } catch {
          // Ignore non-JSON messages
        }
      };

      ws.onerror = (err) => {
        if (isCleanedUp) return;

        console.error('[Terminal] WebSocket error:', err, 'URL:', wsUrl);
        if (wasConnected) {
          setIsSending(false);
        } else {
          errorTimeout = setTimeout(() => {
            if (!wasConnected && !isCleanedUp) {
              console.error('[Terminal] Failed to connect to:', wsUrl);
              setMessages((prev) => [
                ...prev,
                { id: generateId(), type: 'error', content: `Failed to connect to server` },
              ]);
              setIsLoading(false);
              setIsSending(false);
            }
          }, 2000);
        }
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        if (isCleanedUp) return;

        if (wasConnected && event.code !== 1000) {
          reconnectAttempt++;
          if (reconnectAttempt > MAX_RECONNECT_ATTEMPTS) {
            console.error(
              `[Terminal] Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached for thread ${threadId}`,
            );
            setConnectionError(true);
            setMessages((prev) => [
              ...prev,
              {
                id: generateId(),
                type: 'error',
                content: `Connection lost. Failed to reconnect after ${MAX_RECONNECT_ATTEMPTS} attempts.`,
              },
            ]);
            return;
          }
          // Auto-reconnect with exponential backoff (max ~10s)
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempt - 1), 10000);
          console.warn(
            `[Terminal] Connection lost, reconnecting in ${delay}ms (attempt ${reconnectAttempt}/${MAX_RECONNECT_ATTEMPTS})`,
          );
          setMessages((prev) => [
            ...prev,
            {
              id: generateId(),
              type: 'system' as const,
              content: 'Connection lost. Reconnecting...',
            },
          ]);
          reconnectTimeout = setTimeout(connect, delay);
        }
      };
    }

    connect();

    return () => {
      isCleanedUp = true;
      if (errorTimeout) clearTimeout(errorTimeout);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      wsRef.current?.close();
    };
  }, [threadId, reconnectTrigger, setMessages, setUsage, setIsLoading]);

  const sendMessage = useCallback(
    (content: string, image?: { data: string; mediaType: string }) => {
      if (!wsRef.current || !isConnected) return false;

      // Reset response tracking
      gotResponseRef.current = false;
      wasCancelledRef.current = false;
      setNoResponseDetected(false);

      // Always send the message — if the agent is already running, the server
      // will interrupt the current operation (SIGINT) and queue this message
      // to be processed after the child exits. No client-side cancel needed.
      wsRef.current.send(
        JSON.stringify({
          type: 'message',
          content,
          image: image || undefined,
        }),
      );

      setIsSending(true);
      setAgentStatus('waiting');
      return true;
    },
    [isConnected],
  );

  const cancelOperation = useCallback(() => {
    if (wsRef.current && (isSending || isRunning)) {
      wsRef.current.send(JSON.stringify({ type: 'cancel' }));
    }
  }, [isSending, isRunning]);

  const reconnect = useCallback(() => {
    setConnectionError(false);
    setReconnectTrigger((prev) => prev + 1);
  }, []);

  return {
    isConnected,
    isSending,
    isRunning,
    agentStatus,
    connectionError,
    setIsSending,
    sendMessage,
    cancelOperation,
    reconnect,
    generateId,
  };
}
