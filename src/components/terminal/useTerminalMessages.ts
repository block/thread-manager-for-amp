import { useEffect, useState, useCallback, useRef } from 'react';
import type { Message } from '../../utils/parseMarkdown';
import type { ThreadImage } from '../../types';
import { parseMarkdownHistory } from '../../utils/parseMarkdown';
import { apiGetText, apiGet } from '../../api/client';
import { useUnread } from '../../contexts/UnreadContext';

// Poll for new messages every 10 seconds
const MESSAGE_POLL_INTERVAL_MS = 10000;

interface UseTerminalMessagesOptions {
  threadId: string;
  wsConnected: boolean;
}

export function useTerminalMessages({ threadId, wsConnected }: UseTerminalMessagesOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentOffset, setCurrentOffset] = useState(0);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const messagesRef = useRef<Message[]>(messages);
  const { updateCurrentCount } = useUnread();

  // Keep messagesRef in sync with messages state
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Report message count changes to unread context
  useEffect(() => {
    updateCurrentCount(threadId, messages.length);
  }, [threadId, messages.length, updateCurrentCount]);

  useEffect(() => {
    async function loadHistory() {
      try {
        const [markdown, threadImages] = await Promise.all([
          apiGetText(`/api/thread-history?threadId=${encodeURIComponent(threadId)}`),
          apiGet<ThreadImage[]>(`/api/thread-images?threadId=${encodeURIComponent(threadId)}`).catch((e: unknown) => { console.debug('thread-images:', e instanceof Error ? e.message : String(e)); return []; }),
        ]);
        
        const totalMatch = markdown.match(/totalMessages:\s*(\d+)/);
        const totalMessages = totalMatch?.[1] ? parseInt(totalMatch[1], 10) : 0;
        
        const historyMessages = parseMarkdownHistory(markdown);
        if (historyMessages.length > 0) {
          for (const msg of historyMessages) {
            if (msg.type === 'user' && !msg.image) {
              const pathMatch = msg.content.match(/artifacts\/[^/]+\/\d+\.(png|jpg|jpeg|gif|webp)/i);
              if (pathMatch) {
                const matchedImage = threadImages.find(img => 
                  img.sourcePath?.includes(pathMatch[0])
                );
                if (matchedImage) {
                  msg.image = { data: matchedImage.data, mediaType: matchedImage.mediaType };
                  msg.content = msg.content
                    .replace(/First, analyze this image: [^\n]+\n+Then respond to: /g, '')
                    .trim();
                }
              }
            }
          }
          
          setMessages(historyMessages);
          setCurrentOffset(historyMessages.length);
          setHasMoreMessages(historyMessages.length < totalMessages);
        }
      } catch (e) {
        console.error('Failed to load history:', e);
      }
      setIsLoading(false);
    }
    void loadHistory();
  }, [threadId]);

  const loadMoreMessages = useCallback(async () => {
    if (loadingMore || !hasMoreMessages) return;
    
    setLoadingMore(true);
    try {
      const markdown = await apiGetText(
        `/api/thread-history?threadId=${encodeURIComponent(threadId)}&limit=50&offset=${currentOffset}`
      );
      
      const totalMatch = markdown.match(/totalMessages:\s*(\d+)/);
      const totalMessages = totalMatch?.[1] ? parseInt(totalMatch[1], 10) : 0;
      
      const olderMessages = parseMarkdownHistory(markdown);
      if (olderMessages.length > 0) {
        setMessages(prev => [...olderMessages, ...prev]);
        setCurrentOffset(prev => prev + olderMessages.length);
        setHasMoreMessages(currentOffset + olderMessages.length < totalMessages);
      } else {
        setHasMoreMessages(false);
      }
    } catch (e) {
      console.error('Failed to load more messages:', e);
    }
    setLoadingMore(false);
  }, [threadId, currentOffset, loadingMore, hasMoreMessages]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    
    const handleScroll = () => {
      if (container.scrollTop < 100 && hasMoreMessages && !loadingMore) {
        void loadMoreMessages();
      }
    };
    
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [hasMoreMessages, loadingMore, loadMoreMessages]);

  // Poll for new messages (for CLI-initiated continuations)
  // Disabled when WebSocket is connected — WS is the sole data source to avoid race conditions
  useEffect(() => {
    if (wsConnected) return;

    const pollForNewMessages = async () => {
      try {
        const currentMessages = messagesRef.current;
        const markdown = await apiGetText(`/api/thread-history?threadId=${encodeURIComponent(threadId)}`);
        const totalMatch = markdown.match(/totalMessages:\s*(\d+)/);
        const totalMessages = totalMatch?.[1] ? parseInt(totalMatch[1], 10) : 0;
        
        // If there are more messages than we have, reload
        if (totalMessages > currentMessages.length) {
          const newMessages = parseMarkdownHistory(markdown);
          if (newMessages.length > currentMessages.length) {
            // Only update if we got new messages and they're different
            const lastNewId = newMessages[newMessages.length - 1]?.id;
            const lastCurrentId = currentMessages[currentMessages.length - 1]?.id;
            if (lastNewId !== lastCurrentId) {
              setMessages(newMessages);
              setCurrentOffset(newMessages.length);
            }
          }
        }
      } catch {
        // Silently fail - don't disrupt the user
      }
    };

    const intervalId = setInterval(pollForNewMessages, MESSAGE_POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [threadId, wsConnected]);

  return {
    messages,
    setMessages,
    isLoading,
    setIsLoading,
    hasMoreMessages,
    loadingMore,
    loadMoreMessages,
    messagesContainerRef,
    messagesEndRef,
    messageRefs,
  };
}
