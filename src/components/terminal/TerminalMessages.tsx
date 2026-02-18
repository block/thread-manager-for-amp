import { memo, useMemo, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { ToolBlock, type ToolStatus } from '../ToolBlock';
import { ToolResult } from '../ToolResult';
import { MarkdownContent } from '../MarkdownContent';
import { Timestamp } from '../Timestamp';
import type { TerminalMessagesProps } from './types';
import type { Message, AttachedImage } from '../../utils/parseMarkdown';

interface PrecomputedData {
  toolStatusMap: Map<string, ToolStatus>;
  subagentResultMap: Map<string, string>;
  toolIdToToolName: Map<string, string>;
  toolIdToToolInput: Map<string, Record<string, unknown>>;
}

function buildPrecomputedData(messages: Message[]): PrecomputedData {
  const toolStatusMap = new Map<string, ToolStatus>();
  const subagentResultMap = new Map<string, string>();
  const toolIdToToolName = new Map<string, string>();
  const toolIdToToolInput = new Map<string, Record<string, unknown>>();

  // Build tool_result index: toolId → result message
  const toolResultByToolId = new Map<string, Message>();
  // Track which indices have a subsequent user/assistant message after them
  let lastUserOrAssistantIndex = -1;

  // First pass: find the last user/assistant message index and index tool_results
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (!msg) continue;
    if (msg.type === 'tool_result' && msg.toolId) {
      toolResultByToolId.set(msg.toolId, msg);
    }
    if ((msg.type === 'user' || msg.type === 'assistant') && lastUserOrAssistantIndex === -1) {
      lastUserOrAssistantIndex = i;
    }
  }

  // Second pass: compute status for each tool_use and build lookup maps
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (!msg) continue;

    if (msg.type === 'tool_use') {
      const key = msg.id;
      const hasSubsequentMessage = i < lastUserOrAssistantIndex;

      // Build toolId → toolName/toolInput lookup for tool_result rendering
      if (msg.toolId) {
        if (msg.toolName) toolIdToToolName.set(msg.toolId, msg.toolName);
        if (msg.toolInput) toolIdToToolInput.set(msg.toolId, msg.toolInput);
      }

      // Compute status
      let status: ToolStatus;
      if (!msg.toolId) {
        status = hasSubsequentMessage ? 'success' : 'running';
      } else {
        const result = toolResultByToolId.get(msg.toolId);
        if (result) {
          if (result.content.includes('Operation cancelled')) {
            status = 'cancelled';
          } else if (result.success === false) {
            status = 'error';
          } else {
            status = 'success';
          }
        } else if (hasSubsequentMessage) {
          status = 'success';
        } else {
          status = 'running';
        }
      }
      toolStatusMap.set(key, status);

      // Subagent result lookup
      if (msg.toolName === 'Task' && msg.toolId) {
        const result = toolResultByToolId.get(msg.toolId);
        if (result) {
          subagentResultMap.set(msg.id, result.content);
        }
      }
    }
  }

  return { toolStatusMap, subagentResultMap, toolIdToToolName, toolIdToToolInput };
}

interface MessageItemProps {
  msg: Message;
  highlighted: boolean;
  toolStatus?: ToolStatus;
  toolResultContent?: string;
  toolName?: string;
  toolInputPath?: string;
  registerRef: (id: string, el: HTMLDivElement | null) => void;
  onViewImage: (image: AttachedImage) => void;
}

const MessageItem = memo(function MessageItem({
  msg,
  highlighted,
  toolStatus,
  toolResultContent,
  toolName,
  toolInputPath,
  registerRef,
  onViewImage,
}: MessageItemProps) {
  if (msg.type === 'tool_use') {
    return (
      <ToolBlock
        toolName={msg.toolName || ''}
        toolInput={msg.toolInput}
        onRef={(el) => registerRef(msg.id, el)}
        highlighted={highlighted}
        status={toolStatus}
        result={toolResultContent}
      />
    );
  }

  if (msg.type === 'tool_result') {
    const resolvedToolName = toolName || msg.toolName;

    // Hide tool_result for subagents - shown inline in ToolBlock
    if (resolvedToolName === 'Task') {
      return null;
    }
    if (resolvedToolName === 'look_at') {
      return null;
    }
    if (resolvedToolName === 'Read') {
      const path = toolInputPath || '';
      if (/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(path)) {
        return null;
      }
    }
    return (
      <ToolResult
        content={msg.content}
        success={msg.success ?? true}
        onRef={(el) => registerRef(msg.id, el)}
      />
    );
  }

  return (
    <div
      ref={(el) => registerRef(msg.id, el)}
      className={`chat-message chat-message-${msg.type} ${highlighted ? 'highlighted' : ''}`}
    >
      <div className="chat-avatar">
        {msg.type === 'user' ? '👤' : msg.type === 'error' ? '❌' : '⚡'}
      </div>
      <div className="chat-bubble">
        <div className="chat-header">
          <span className="chat-sender">
            {msg.type === 'user' ? 'You' : msg.type === 'error' ? 'Error' : 'Amp'}
          </span>
          {msg.interrupted && <span className="chat-interrupted-badge">interrupted</span>}
          {msg.timestamp && <Timestamp date={msg.timestamp} className="chat-timestamp" />}
        </div>
        {msg.image && (
          <div className="chat-image-attachment">
            <img
              src={`data:${msg.image.mediaType};base64,${msg.image.data}`}
              alt="Attached"
              onClick={() => msg.image && onViewImage(msg.image)}
            />
          </div>
        )}
        <div className="chat-content">
          <MarkdownContent content={msg.content} />
        </div>
      </div>
    </div>
  );
});

export const TerminalMessages = memo(function TerminalMessages({
  messages,
  isLoading,
  hasMoreMessages,
  loadingMore,
  activeMinimapId,
  messagesContainerRef,
  messagesEndRef,
  messageRefs,
  onLoadMore,
  onViewImage,
}: TerminalMessagesProps) {
  const precomputed = useMemo(() => buildPrecomputedData(messages), [messages]);

  const registerRef = useCallback(
    (id: string, el: HTMLDivElement | null) => {
      if (el) messageRefs.current.set(id, el);
      else messageRefs.current.delete(id);
    },
    [messageRefs],
  );

  return (
    <div className="terminal-messages" ref={messagesContainerRef}>
      {hasMoreMessages && (
        <button className="load-more-btn" onClick={onLoadMore} disabled={loadingMore}>
          {loadingMore ? (
            <>
              <Loader2 size={14} className="spinning" />
              Loading older messages...
            </>
          ) : (
            'Load older messages'
          )}
        </button>
      )}

      {isLoading && (
        <div className="terminal-loading">
          <Loader2 size={20} className="spinning" />
          <span>Loading thread history...</span>
        </div>
      )}

      {!isLoading && messages.length === 0 && (
        <div className="terminal-empty">No messages yet. Start the conversation below.</div>
      )}

      {messages.map((msg) => (
        <MessageItem
          key={msg.id}
          msg={msg}
          highlighted={msg.id === activeMinimapId}
          toolStatus={precomputed.toolStatusMap.get(msg.id)}
          toolResultContent={precomputed.subagentResultMap.get(msg.id)}
          toolName={msg.toolId ? precomputed.toolIdToToolName.get(msg.toolId) : undefined}
          toolInputPath={
            msg.toolId
              ? (precomputed.toolIdToToolInput.get(msg.toolId)?.path as string | undefined)
              : undefined
          }
          registerRef={registerRef}
          onViewImage={onViewImage}
        />
      ))}

      <div ref={messagesEndRef} style={{ height: 1, flexShrink: 0 }} />
    </div>
  );
});
