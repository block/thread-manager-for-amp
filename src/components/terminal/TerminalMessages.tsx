import { memo } from 'react';
import { Loader2 } from 'lucide-react';
import { ToolBlock, type ToolStatus } from '../ToolBlock';
import { ToolResult } from '../ToolResult';
import { MarkdownContent } from '../MarkdownContent';
import { Timestamp } from '../Timestamp';
import type { TerminalMessagesProps } from './types';
import type { Message, AttachedImage } from '../../utils/parseMarkdown';

function getToolStatus(toolId: string | undefined, msgIndex: number, messages: Message[]): ToolStatus {
  // Check if there are subsequent non-tool-result messages (user input or assistant response)
  // which indicates the conversation continued past this tool
  const hasSubsequentMessage = messages.slice(msgIndex + 1).some(
    m => m.type === 'assistant' || m.type === 'user'
  );
  
  // If no toolId (parsed from history), use subsequent message check
  if (!toolId) {
    return hasSubsequentMessage ? 'success' : 'running';
  }
  
  // For live messages with toolId, first check for matching tool_result
  const result = messages.find(m => m.type === 'tool_result' && m.toolId === toolId);
  if (result) {
    if (result.content?.includes('Operation cancelled')) return 'cancelled';
    if (result.success === false) return 'error';
    return 'success';
  }
  
  // Fallback: if no tool_result but there are subsequent messages, tool completed
  // This handles tools like Task that don't send explicit tool_result events
  if (hasSubsequentMessage) {
    return 'success';
  }
  
  return 'running';
}

interface MessageItemProps {
  msg: Message;
  msgIndex: number;
  messages: Message[];
  activeMinimapId?: string;
  onRef: (id: string, el: HTMLDivElement | null) => void;
  onViewImage: (image: AttachedImage) => void;
}

function MessageItem({
  msg,
  msgIndex,
  messages,
  activeMinimapId,
  onRef,
  onViewImage,
}: MessageItemProps) {
  if (msg.type === 'tool_use') {
    const status = getToolStatus(msg.toolId, msgIndex, messages);
    const isSubagent = msg.toolName === 'Task';
    
    // Find matching tool_result to show inline for subagents
    const toolResult = isSubagent 
      ? messages.find(m => m.type === 'tool_result' && m.toolId === msg.toolId)
      : undefined;
    
    return (
      <ToolBlock
        toolName={msg.toolName || ''}
        toolInput={msg.toolInput}
        onRef={(el) => onRef(msg.id, el)}
        highlighted={msg.id === activeMinimapId}
        status={status}
        result={toolResult?.content}
      />
    );
  }
  
  if (msg.type === 'tool_result') {
    const toolUse = messages.find(m => m.type === 'tool_use' && m.toolId === msg.toolId);
    const toolName = toolUse?.toolName || msg.toolName;
    
    // Hide tool_result for subagents - shown inline in ToolBlock
    if (toolName === 'Task') {
      return null;
    }
    if (toolName === 'look_at') {
      return null;
    }
    if (toolName === 'Read') {
      const path = toolUse?.toolInput?.path || '';
      if (/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(path)) {
        return null;
      }
    }
    return (
      <ToolResult
        content={msg.content}
        success={msg.success ?? true}
        onRef={(el) => onRef(msg.id, el)}
      />
    );
  }

  return (
    <div 
      ref={(el) => onRef(msg.id, el)}
      className={`chat-message chat-message-${msg.type} ${msg.id === activeMinimapId ? 'highlighted' : ''}`}
    >
      <div className="chat-avatar">
        {msg.type === 'user' ? '👤' : msg.type === 'error' ? '❌' : '⚡'}
      </div>
      <div className="chat-bubble">
        <div className="chat-header">
          <span className="chat-sender">
            {msg.type === 'user' ? 'You' : msg.type === 'error' ? 'Error' : 'Amp'}
          </span>
          {msg.timestamp && (
            <Timestamp date={msg.timestamp} className="chat-timestamp" />
          )}
        </div>
        {msg.image && (
          <div className="chat-image-attachment">
            <img 
              src={`data:${msg.image.mediaType};base64,${msg.image.data}`}
              alt="Attached"
              onClick={() => onViewImage(msg.image!)}
            />
          </div>
        )}
        <div className="chat-content">
          <MarkdownContent content={msg.content} />
        </div>
      </div>
    </div>
  );
}

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
  return (
    <div className="terminal-messages" ref={messagesContainerRef}>
      {hasMoreMessages && (
        <button 
          className="load-more-btn"
          onClick={onLoadMore}
          disabled={loadingMore}
        >
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
        <div className="terminal-empty">
          No messages yet. Start the conversation below.
        </div>
      )}

      {messages.map((msg, index) => (
        <MessageItem
          key={msg.id}
          msg={msg}
          msgIndex={index}
          messages={messages}
          activeMinimapId={activeMinimapId}
          onRef={(id, el) => { if (el) messageRefs.current.set(id, el); }}
          onViewImage={onViewImage}
        />
      ))}
      
      <div ref={messagesEndRef} style={{ height: 1, flexShrink: 0 }} />
    </div>
  );
});
