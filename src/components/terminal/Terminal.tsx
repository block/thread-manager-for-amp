import { useEffect, useCallback, useMemo, useRef, useState } from 'react';
import { Minimap, type MinimapItem } from '../Minimap';
import { ThreadDiscovery } from '../ThreadDiscovery/index';
import { MessageSearchModal } from '../MessageSearchModal';
import { ImageViewer } from '../ImageViewer';
import { apiGet, apiPatch } from '../../api/client';
import type { ThreadMetadata } from '../../types';
import { extractIssueUrl } from '../../utils/issueTracker';
import type { AgentMode } from '../../../shared/websocket.js';
import type { TerminalProps } from './types';
import { useTerminalWebSocket } from './useTerminalWebSocket';
import { useTerminalMessages } from './useTerminalMessages';
import { useTerminalState, generateId } from './useTerminalState';
import { TerminalHeader } from './TerminalHeader';
import { TerminalMessages } from './TerminalMessages';
import { TerminalInput } from './TerminalInput';
import { TerminalStatusBar } from './TerminalStatusBar';
import { ContextWarning } from './ContextWarning';
import { ReplayControls } from './ReplayControls';
import { useScrollBehavior } from './useScrollBehavior';
import { useUnread } from '../../contexts/UnreadContext';
import { useThreadStatus } from '../../contexts/ThreadStatusContext';
import { useSettingsContext } from '../../contexts/SettingsContext';
import { useReplayMode } from '../../hooks/useReplayMode';

export function Terminal({
  thread,
  onClose,
  embedded = false,
  onHandoff,
  onNewThread,
  onOpenThread,
  autoFocus = false,
  replayThreadId,
  onStopReplay,
}: TerminalProps) {
  const { id: threadId, title: threadTitle } = thread;
  const { markAsSeen } = useUnread();
  const { setStatus: setThreadStatus, clearStatus: clearThreadStatus } = useThreadStatus();
  const { agentMode, cycleAgentMode, showThinkingBlocks, setActiveThreadModeLocked } =
    useSettingsContext();

  const replay = useReplayMode();

  // Start replay when replayThreadId is set
  useEffect(() => {
    if (replayThreadId && replayThreadId === threadId && replay.replayState === 'idle') {
      replay.startReplay(threadId);
    }
  }, [replayThreadId, threadId, replay]);

  const isReplaying = replay.replayState !== 'idle';

  const handleStopReplay = useCallback(() => {
    replay.stopReplay();
    onStopReplay?.();
  }, [replay, onStopReplay]);

  const state = useTerminalState({ thread });
  const {
    input,
    activeMinimapId,
    usage,
    searchOpen,
    pendingImage,
    sessionImages,
    viewingImage,
    metadata,
    containerRef,
    inputRef,
    autoInvokeTriggeredRef,
    setInput,
    setUsage,
    setMetadata,
    setPendingImage,
    setViewingImage,
    openSearch,
    closeSearch,
    dismissContextWarning,
    clearPendingImage,
    closeViewingImage,
    addSessionImage,
    clearInput,
    scrollToMessage,
    checkContextWarning,
  } = state;

  const [wsConnected, setWsConnected] = useState(false);
  const [queuedMsg, setQueuedMsg] = useState<{
    content: string;
    image?: { data: string; mediaType: string };
    mode: AgentMode;
  } | null>(null);

  const {
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
  } = useTerminalMessages({ threadId, wsConnected });

  const {
    isConnected,
    isSending,
    isRunning,
    agentStatus,
    connectionError,
    threadMode,
    sendMessage: wsSendMessage,
    cancelOperation,
    reconnect,
  } = useTerminalWebSocket({ threadId, setMessages, setUsage, setIsLoading });

  // Effective mode: locked thread mode takes priority over global setting
  const effectiveMode = threadMode ?? agentMode;
  const isModeLocked = threadMode !== null;

  // Publish mode lock state so command palette and shortcuts can respect it
  useEffect(() => {
    if (autoFocus) {
      setActiveThreadModeLocked(isModeLocked);
    }
  }, [autoFocus, isModeLocked, setActiveThreadModeLocked]);

  // Sync WS connection state to control message polling
  useEffect(() => {
    setWsConnected(isConnected);
  }, [isConnected]);

  // Auto-send queued message when agent finishes
  const prevRunningRef = useRef(false);
  useEffect(() => {
    const wasRunning = prevRunningRef.current;
    prevRunningRef.current = isRunning || isSending;

    if (wasRunning && !isRunning && !isSending && queuedMsg) {
      wsSendMessage(queuedMsg.content, queuedMsg.image, queuedMsg.mode);
      setQueuedMsg(null);
      setMessages((prev) => prev.map((m) => (m.queued ? { ...m, queued: false } : m)));
    }
  }, [isRunning, isSending, queuedMsg, wsSendMessage, setMessages]);

  useScrollBehavior({ messages, loadingMore, messagesContainerRef });

  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    const hasError = !!lastMessage && lastMessage.type === 'error';
    if (isRunning || isSending) {
      setThreadStatus(threadId, 'running');
    } else if (hasError) {
      setThreadStatus(threadId, 'error');
    } else {
      setThreadStatus(threadId, 'idle');
    }
  }, [threadId, isRunning, isSending, messages, setThreadStatus]);

  useEffect(() => {
    return () => clearThreadStatus(threadId);
  }, [threadId, clearThreadStatus]);

  const handleScrollToMessage = useCallback(
    (id: string) => {
      scrollToMessage(id, messageRefs);
    },
    [scrollToMessage, messageRefs],
  );

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [autoFocus, inputRef]);

  // Mark messages as seen when terminal is focused/active
  useEffect(() => {
    if (autoFocus) {
      markAsSeen(threadId);
    }
  }, [autoFocus, threadId, markAsSeen, messages.length]);

  useEffect(() => {
    if (thread.autoInvoke && isConnected && !isLoading && !autoInvokeTriggeredRef.current) {
      autoInvokeTriggeredRef.current = true;
      setTimeout(() => wsSendMessage('Please proceed with the task.'), 100);
    }
  }, [thread.autoInvoke, isConnected, isLoading, wsSendMessage, autoInvokeTriggeredRef]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (
        !containerRef.current?.contains(document.activeElement) &&
        document.activeElement !== document.body
      )
        return;
      if ((isSending || isRunning) && (e.key === 'Escape' || (e.ctrlKey && e.key === 'c'))) {
        e.preventDefault();
        cancelOperation();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isSending, isRunning, cancelOperation, containerRef]);

  useEffect(() => {
    apiGet<ThreadMetadata>(`/api/thread-status?threadId=${encodeURIComponent(threadId)}`)
      .then(setMetadata)
      .catch((err: unknown) => console.error('Failed to fetch thread metadata:', err));
  }, [threadId, setMetadata]);

  useEffect(() => {
    if (isConnected && !isLoading) inputRef.current?.focus();
  }, [isConnected, isLoading, inputRef]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        if (containerRef.current?.contains(document.activeElement) || embedded) {
          e.preventDefault();
          openSearch();
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [embedded, openSearch, containerRef]);

  const displayMessages = isReplaying ? replay.replayMessages : messages;

  const minimapItems: MinimapItem[] = useMemo(
    () =>
      displayMessages
        .filter((msg) => msg.type !== 'tool_result')
        .map((msg) => {
          let label = msg.type === 'user' ? 'User:' : 'Assistant:';
          let preview = msg.content.slice(0, 30).replace(/\n/g, ' ');
          let type: MinimapItem['type'] = msg.type === 'user' ? 'user' : 'assistant';
          if (msg.type === 'tool_use' && msg.toolName) {
            if (msg.toolName === 'Task' && msg.toolInput) {
              label = 'Subagent';
              preview = (msg.toolInput.description || '').slice(0, 30);
            } else {
              label = msg.toolName;
              preview = msg.content.slice(0, 25).replace(/\n/g, ' ');
            }
            type = 'tool';
          } else if (msg.type === 'error') {
            label = 'Error';
            preview = msg.content.slice(0, 25);
            type = 'error';
          }
          return {
            id: msg.id,
            type,
            label,
            preview: preview + (msg.content.length > 30 ? '…' : ''),
            toolName: msg.toolName,
          };
        }),
    [displayMessages],
  );

  const showContextWarning = !isReplaying && checkContextWarning(messages);

  const handleSendMessage = useCallback(() => {
    const isActive = isSending || isRunning;

    // Force-send: empty input + queued message → interrupt and send now
    if (!input.trim() && !pendingImage && queuedMsg && isActive) {
      wsSendMessage(queuedMsg.content, queuedMsg.image, queuedMsg.mode);
      setQueuedMsg(null);
      setMessages((prev) => prev.map((m) => (m.queued ? { ...m, queued: false } : m)));
      return;
    }

    if ((!input.trim() && !pendingImage) || !isConnected) return;
    const messageText = input.trim() || 'Analyze this image';

    // Queue client-side if agent is busy
    if (isActive) {
      // Remove any previously queued message
      setMessages((prev) => {
        const withoutQueued = prev.filter((m) => !m.queued);
        return [
          ...withoutQueued,
          {
            id: generateId(),
            type: 'user' as const,
            content: messageText,
            image: pendingImage || undefined,
            queued: true,
          },
        ];
      });
      setQueuedMsg({ content: messageText, image: pendingImage || undefined, mode: agentMode });
      if (pendingImage) addSessionImage(pendingImage);
      clearInput();
      return;
    }

    setMessages((prev) => [
      ...prev,
      { id: generateId(), type: 'user', content: messageText, image: pendingImage || undefined },
    ]);
    wsSendMessage(messageText, pendingImage || undefined, agentMode);
    if (pendingImage) addSessionImage(pendingImage);
    clearInput();

    if (!metadata?.linked_issue_url) {
      const issueUrl = extractIssueUrl(messageText);
      if (issueUrl) {
        apiPatch('/api/thread-linked-issue', { threadId, url: issueUrl })
          .then(() =>
            setMetadata((prev) => (prev ? { ...prev, linked_issue_url: issueUrl } : prev)),
          )
          .catch((err: unknown) => console.debug('Auto-link issue failed:', err));
      }
    }
  }, [
    input,
    pendingImage,
    isConnected,
    isSending,
    isRunning,
    queuedMsg,
    setMessages,
    wsSendMessage,
    addSessionImage,
    clearInput,
    metadata,
    threadId,
    setMetadata,
    agentMode,
  ]);

  const content = (
    <div
      ref={containerRef}
      className={`terminal-container with-minimap ${embedded ? 'embedded' : ''}`}
      onClick={(e) => e.stopPropagation()}
    >
      <TerminalHeader threadTitle={threadTitle} embedded={embedded} onClose={onClose} />
      {isReplaying && (
        <ReplayControls
          replayState={replay.replayState}
          replaySpeed={replay.replaySpeed}
          progress={replay.replayProgress}
          onPause={replay.pauseReplay}
          onResume={replay.resumeReplay}
          onStop={handleStopReplay}
          onSkipToEnd={replay.skipToEnd}
          onSetSpeed={replay.setReplaySpeed}
        />
      )}
      {!isReplaying && (
        <ThreadDiscovery
          threadId={threadId}
          onOpenThread={onOpenThread}
          messages={messages}
          onJumpToMessage={handleScrollToMessage}
          sessionImages={sessionImages}
          metadata={metadata || undefined}
          onMetadataChange={setMetadata}
          onSearchOpen={openSearch}
        />
      )}
      <div className="terminal-body">
        <TerminalMessages
          messages={displayMessages}
          isLoading={isLoading}
          hasMoreMessages={hasMoreMessages}
          loadingMore={loadingMore}
          activeMinimapId={activeMinimapId}
          messagesContainerRef={messagesContainerRef}
          messagesEndRef={messagesEndRef}
          messageRefs={messageRefs}
          onLoadMore={loadMoreMessages}
          onViewImage={setViewingImage}
          showThinkingBlocks={showThinkingBlocks}
        />
        <Minimap
          items={minimapItems}
          activeId={activeMinimapId}
          onItemClick={handleScrollToMessage}
          hasMoreMessages={hasMoreMessages}
          loadingMore={loadingMore}
          onLoadMore={loadMoreMessages}
        />
      </div>
      {usage && <TerminalStatusBar usage={usage} />}
      {showContextWarning && (
        <ContextWarning
          threadId={threadId}
          onHandoff={onHandoff}
          onNewThread={onNewThread}
          onDismiss={dismissContextWarning}
        />
      )}
      {connectionError && (
        <div className="context-limit-modal">
          <div className="context-limit-content">
            <p className="context-limit-message">Connection lost. Unable to reconnect to server.</p>
            <div className="context-limit-actions">
              <button className="context-limit-btn primary" onClick={reconnect}>
                Reconnect
              </button>
            </div>
          </div>
        </div>
      )}
      <TerminalInput
        input={input}
        isConnected={isConnected}
        isSending={isSending}
        isRunning={isRunning}
        agentStatus={queuedMsg ? 'queued' : agentStatus}
        pendingImage={pendingImage}
        inputRef={inputRef}
        onInputChange={setInput}
        onSend={handleSendMessage}
        onCancel={cancelOperation}
        onClose={onClose}
        onPendingImageRemove={clearPendingImage}
        onPendingImageSet={setPendingImage}
        searchOpen={searchOpen}
        workspacePath={thread.workspacePath ?? null}
        agentMode={effectiveMode}
        onCycleMode={cycleAgentMode}
        isModeLocked={isModeLocked}
        hasQueuedMessage={!!queuedMsg}
      />
      <MessageSearchModal
        isOpen={searchOpen}
        onClose={closeSearch}
        messages={messages}
        onJumpToMessage={handleScrollToMessage}
      />
      {viewingImage && (
        <ImageViewer
          images={[
            { data: viewingImage.data, mediaType: viewingImage.mediaType, sourcePath: null },
          ]}
          currentIndex={0}
          onClose={closeViewingImage}
          onNavigate={() => {}}
        />
      )}
    </div>
  );

  return embedded ? (
    content
  ) : (
    <div className="terminal-overlay" onClick={onClose}>
      {content}
    </div>
  );
}
