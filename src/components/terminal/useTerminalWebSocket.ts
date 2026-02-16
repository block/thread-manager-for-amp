import { useEffect, useRef, useState, useCallback } from 'react';
import type { Message } from '../../utils/parseMarkdown';
import type { WsEvent } from '../../types/websocket';
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
  const [, setNoResponseDetected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const gotResponseRef = useRef(false);
  const wasCancelledRef = useRef(false);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?threadId=${encodeURIComponent(threadId)}`;
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
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as WsEvent;
          
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
              setMessages(prev => [...prev, { id: generateId(), type: 'assistant', content: data.content }]);
              break;
            case 'tool_use':
              setIsRunning(true);
              setAgentStatus('running_tools');
              gotResponseRef.current = true;
              setMessages(prev => [...prev, { 
                id: generateId(), 
                type: 'tool_use', 
                content: formatToolUse(data.name, data.input),
                toolName: data.name,
                toolId: data.id,
                toolInput: data.input
              }]);
              break;
            case 'tool_result':
              gotResponseRef.current = true;
              setMessages(prev => {
                const toolUse = prev.find(m => m.type === 'tool_use' && m.toolId === data.id);
                return [...prev, { 
                  id: generateId(), 
                  type: 'tool_result', 
                  content: data.result,
                  toolId: data.id,
                  toolName: toolUse?.toolName,
                  success: data.success
                }];
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
                (errorLower.includes('context') && (
                  errorLower.includes('limit') || 
                  errorLower.includes('exceeded') ||
                  errorLower.includes('too long') ||
                  errorLower.includes('full')
                )) ||
                errorLower.includes('token limit') ||
                errorLower.includes('max_tokens') ||
                errorLower.includes('maximum context') ||
                errorLower.includes('conversation too long') ||
                errorLower.includes('input too long');
              setMessages(prev => [...prev, { 
                id: generateId(), 
                type: 'error', 
                content: errorContent,
                isContextLimit,
              }]);
              break;
            }
            case 'done':
              setIsSending(false);
              setIsRunning(false);
              setAgentStatus('idle');
              if (!gotResponseRef.current && !wasCancelledRef.current) {
                setNoResponseDetected(true);
                setMessages(prev => [...prev, { 
                  id: generateId(), 
                  type: 'error', 
                  content: 'No response from agent. The context window may be full.',
                  isContextLimit: true,
                }]);
              } else if (isSoundEnabled() && !wasCancelledRef.current) {
                playNotificationSound();
              }
              wasCancelledRef.current = false;
              break;
            case 'cancelled':
              setIsSending(false);
              setIsRunning(false);
              setAgentStatus('idle');
              wasCancelledRef.current = true;
              setMessages(prev => [...prev, { id: generateId(), type: 'system' as const, content: 'Operation cancelled' }]);
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
              setMessages(prev => [...prev, { id: generateId(), type: 'error', content: `Failed to connect to server` }]);
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
          // Auto-reconnect with exponential backoff (max ~10s)
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempt), 10000);
          reconnectAttempt++;
          console.log(`[Terminal] Connection lost, reconnecting in ${delay}ms (attempt ${reconnectAttempt})`);
          setMessages(prev => [...prev, { id: generateId(), type: 'system' as const, content: 'Connection lost. Reconnecting...' }]);
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
  }, [threadId, setMessages, setUsage, setIsLoading]);

  const sendMessage = useCallback((content: string, image?: { data: string; mediaType: string }, cancelFirst?: boolean) => {
    if (!wsRef.current || !isConnected) return false;
    
    // Reset response tracking
    gotResponseRef.current = false;
    wasCancelledRef.current = false;
    setNoResponseDetected(false);
    
    // If we need to cancel first, send cancel and delay the message
    if (cancelFirst && (isSending || isRunning)) {
      wsRef.current.send(JSON.stringify({ type: 'cancel' }));
      // Send message after a short delay to let cancel process
      setTimeout(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ 
            type: 'message', 
            content,
            image: image || undefined,
          }));
          setIsSending(true);
          setAgentStatus('waiting');
        }
      }, 100);
      return true;
    }
    
    if (isSending) return false;
    
    wsRef.current.send(JSON.stringify({ 
      type: 'message', 
      content,
      image: image || undefined,
    }));
    
    setIsSending(true);
    setAgentStatus('waiting');
    return true;
  }, [isConnected, isSending, isRunning]);

  const cancelOperation = useCallback(() => {
    if (wsRef.current && (isSending || isRunning)) {
      wsRef.current.send(JSON.stringify({ type: 'cancel' }));
    }
  }, [isSending, isRunning]);

  return {
    isConnected,
    isSending,
    isRunning,
    agentStatus,
    setIsSending,
    sendMessage,
    cancelOperation,
    generateId,
  };
}
