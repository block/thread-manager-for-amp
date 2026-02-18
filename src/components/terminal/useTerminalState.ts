import { useState, useRef, useCallback } from 'react';
import type { ThreadMetadata } from '../../types';
import type { Message } from '../../utils/parseMarkdown';
import type { UsageInfo } from './types';
import { DEFAULT_MAX_CONTEXT_TOKENS } from '../../constants';
export { generateId } from '../../../shared/utils.js';

interface UseTerminalStateOptions {
  thread: {
    contextPercent?: number;
    cost?: number;
    maxContextTokens?: number;
  };
}

export function useTerminalState({ thread }: UseTerminalStateOptions) {
  const [input, setInput] = useState('');
  const [activeMinimapId, setActiveMinimapId] = useState<string | undefined>();
  const [usage, setUsage] = useState<UsageInfo | null>(() => {
    if (thread.contextPercent !== undefined && thread.cost !== undefined) {
      return {
        contextPercent: thread.contextPercent,
        inputTokens: Math.round(
          (thread.contextPercent / 100) * (thread.maxContextTokens || DEFAULT_MAX_CONTEXT_TOKENS),
        ),
        outputTokens: 0,
        maxTokens: thread.maxContextTokens || DEFAULT_MAX_CONTEXT_TOKENS,
        estimatedCost: thread.cost.toFixed(2),
      };
    }
    return null;
  });
  const [contextWarningDismissed, setContextWarningDismissed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ data: string; mediaType: string } | null>(
    null,
  );
  const [sessionImages, setSessionImages] = useState<Array<{ data: string; mediaType: string }>>(
    [],
  );
  const [viewingImage, setViewingImage] = useState<{ data: string; mediaType: string } | null>(
    null,
  );
  const [metadata, setMetadata] = useState<ThreadMetadata | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const autoInvokeTriggeredRef = useRef(false);

  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  const dismissContextWarning = useCallback(() => setContextWarningDismissed(true), []);
  const clearPendingImage = useCallback(() => setPendingImage(null), []);
  const closeViewingImage = useCallback(() => setViewingImage(null), []);

  const addSessionImage = useCallback((image: { data: string; mediaType: string }) => {
    setSessionImages((prev) => [...prev, image]);
  }, []);

  const clearInput = useCallback(() => {
    setInput('');
    setPendingImage(null);
  }, []);

  const scrollToMessage = useCallback(
    (id: string, messageRefs: React.MutableRefObject<Map<string, HTMLDivElement>>) => {
      const el = messageRefs.current.get(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setActiveMinimapId(id);
      }
    },
    [],
  );

  const checkContextWarning = useCallback(
    (messages: Message[]) => {
      const hasContextLimitError = messages.some((m) => m.type === 'error' && m.isContextLimit);
      return (
        !contextWarningDismissed && ((usage && usage.contextPercent >= 95) || hasContextLimitError)
      );
    },
    [contextWarningDismissed, usage],
  );

  return {
    // State
    input,
    activeMinimapId,
    usage,
    contextWarningDismissed,
    searchOpen,
    pendingImage,
    sessionImages,
    viewingImage,
    metadata,

    // Refs
    containerRef,
    inputRef,
    autoInvokeTriggeredRef,

    // Setters
    setInput,
    setActiveMinimapId,
    setUsage,
    setMetadata,
    setPendingImage,
    setViewingImage,

    // Actions
    openSearch,
    closeSearch,
    dismissContextWarning,
    clearPendingImage,
    closeViewingImage,
    addSessionImage,
    clearInput,
    scrollToMessage,
    checkContextWarning,
  };
}
