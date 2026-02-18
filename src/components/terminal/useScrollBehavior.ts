import { useEffect, useRef, useCallback } from 'react';
import type { Message } from '../../utils/parseMarkdown';

interface UseScrollBehaviorOptions {
  messages: Message[];
  loadingMore: boolean;
  messagesContainerRef: React.RefObject<HTMLDivElement | null>;
}

export function useScrollBehavior({
  messages,
  loadingMore,
  messagesContainerRef,
}: UseScrollBehaviorOptions) {
  const prevMessageCount = useRef(0);
  const prevLastMessageId = useRef<string | null>(null);
  const isNearBottomRef = useRef(true);

  const scrollToBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messagesContainerRef]);

  // Track if user is near the bottom (within 100px)
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      isNearBottomRef.current = scrollHeight - scrollTop - clientHeight < 100;
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [messagesContainerRef]);

  // Only auto-scroll on content changes if user is already at bottom
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      // Only scroll if user was already near bottom
      if (isNearBottomRef.current) {
        requestAnimationFrame(scrollToBottom);
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [messagesContainerRef, scrollToBottom]);

  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    const currentLastId = lastMessage?.id ?? null;
    const messagesChanged = currentLastId !== prevLastMessageId.current;

    if (!messagesChanged) return;

    prevLastMessageId.current = currentLastId;

    const wasLoadingOlder =
      loadingMore ||
      (messages.length > prevMessageCount.current + 1 && prevMessageCount.current > 0);
    prevMessageCount.current = messages.length;

    if (wasLoadingOlder) return;

    requestAnimationFrame(scrollToBottom);
  }, [messages, loadingMore, scrollToBottom]);
}
