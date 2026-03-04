import { useRef, useState, useCallback } from 'react';
import { Send, Loader2 } from 'lucide-react';
import type { TerminalInputProps } from './types';
import { DEEP_EFFORT_LABELS } from '../../../shared/websocket.js';
import { useMentionAutocomplete } from '../../hooks/useMentionAutocomplete';
import { MentionAutocomplete, type MentionAutocompleteHandle } from './MentionAutocomplete';

function getStatusMessage(agentStatus: string): string {
  switch (agentStatus) {
    case 'waiting':
      return 'Waiting for response...';
    case 'streaming':
      return 'Streaming response...';
    case 'running_tools':
      return 'Running tools...';
    case 'queued':
      return 'Message queued — press Enter to interrupt and send now';
    default:
      return '';
  }
}

export function TerminalInput({
  input,
  isConnected,
  isSending,
  isRunning,
  agentStatus,
  pendingImages,
  inputRef,
  onInputChange,
  onSend,
  onCancel: _onCancel,
  onClose,
  onPendingImageRemove,
  onPendingImageAdd,
  searchOpen,
  workspacePath,
  agentMode,
  deepReasoningEffort,
  onCycleMode,
  isModeLocked,
  hasQueuedMessage,
  userMessageHistory = [],
}: TerminalInputProps) {
  void _onCancel;
  const autocompleteRef = useRef<MentionAutocompleteHandle>(null);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isDragOver, setIsDragOver] = useState(false);
  const savedInputRef = useRef('');
  const { mentionState, closeMention, selectMention } = useMentionAutocomplete(
    input,
    cursorPosition,
    inputRef,
  );

  const trackCursor = useCallback(() => {
    const pos = inputRef.current?.selectionStart ?? 0;
    setCursorPosition(pos);
  }, [inputRef]);

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    let hasImage = false;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        if (!hasImage) {
          e.preventDefault();
          hasImage = true;
        }
        const file = item.getAsFile();
        if (!file) continue;
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          const base64 = dataUrl.split(',')[1] ?? '';
          const mediaType = item.type;
          onPendingImageAdd({ data: base64, mediaType });
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    // When autocomplete is active, delegate navigation keys
    if (mentionState.active && autocompleteRef.current) {
      const handled = autocompleteRef.current.handleKeyDown(e);
      if (handled) return;
    }

    // Arrow key history navigation
    if (e.key === 'ArrowUp' && !e.shiftKey && userMessageHistory.length > 0) {
      const atStart = input.trim() === '' || historyIndex >= 0;
      if (atStart) {
        e.preventDefault();
        if (historyIndex === -1) {
          savedInputRef.current = input;
        }
        const newIndex = Math.min(historyIndex + 1, userMessageHistory.length - 1);
        const historyItem = userMessageHistory[userMessageHistory.length - 1 - newIndex];
        if (newIndex !== historyIndex && historyItem !== undefined) {
          setHistoryIndex(newIndex);
          onInputChange(historyItem);
        }
        return;
      }
    }
    if (e.key === 'ArrowDown' && !e.shiftKey && historyIndex >= 0) {
      e.preventDefault();
      const newIndex = historyIndex - 1;
      if (newIndex < 0) {
        setHistoryIndex(-1);
        onInputChange(savedInputRef.current);
      } else {
        const item = userMessageHistory[userMessageHistory.length - 1 - newIndex];
        if (item !== undefined) {
          setHistoryIndex(newIndex);
          onInputChange(item);
        }
      }
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      setHistoryIndex(-1);
      // Allow force-send of queued message even with empty input
      if (hasQueuedMessage || input.trim() || pendingImages.length > 0) {
        onSend();
      }
    }
    if (e.key === 'Escape' && !searchOpen) {
      if (isSending || isRunning) {
        // Let global handler deal with cancel
        return;
      } else if (pendingImages.length > 0) {
        onPendingImageRemove(pendingImages.length - 1);
      } else {
        onClose();
      }
    }
    if (e.ctrlKey && e.key === 'c' && (isSending || isRunning)) {
      // Let global handler deal with cancel
      return;
    }
    if (e.metaKey && e.key === 'Backspace') {
      e.preventDefault();
      onInputChange('');
      return;
    }

    if (e.ctrlKey && e.key === 'v') {
      try {
        const clipboardItems = await navigator.clipboard.read();
        for (const item of clipboardItems) {
          const imageType = item.types.find((t) => t.startsWith('image/'));
          if (imageType) {
            e.preventDefault();
            const blob = await item.getType(imageType);
            const reader = new FileReader();
            reader.onload = () => {
              const dataUrl = reader.result as string;
              const base64 = dataUrl.split(',')[1] ?? '';
              onPendingImageAdd({ data: base64, mediaType: imageType });
            };
            reader.readAsDataURL(blob);
            return;
          }
        }
      } catch {
        // Clipboard API not available or permission denied
      }
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.some((t) => t === 'Files')) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      const files = Array.from(e.dataTransfer.files);
      for (const file of files) {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            const base64 = dataUrl.split(',')[1] ?? '';
            onPendingImageAdd({ data: base64, mediaType: file.type });
          };
          reader.readAsDataURL(file);
        }
      }
    },
    [onPendingImageAdd],
  );

  const handleMentionSelect = (value: string) => {
    selectMention(value, onInputChange);
  };

  const isActive = isSending || isRunning;
  const statusMessage = getStatusMessage(agentStatus);

  // Detect shell mode prefix for visual indicator
  const shellMode = input.trimStart().startsWith('$$')
    ? 'incognito'
    : input.trimStart().startsWith('$') && input.trimStart().length > 1
      ? 'context'
      : null;

  const modeLabel = agentMode === 'deep' ? DEEP_EFFORT_LABELS[deepReasoningEffort] : agentMode;
  const modeIcon =
    agentMode === 'deep' ? '🧠' : agentMode === 'rush' ? '🚀' : agentMode === 'large' ? '🐘' : '⚡';

  return (
    <div
      className={`terminal-input-area${isDragOver ? ' drag-over' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {mentionState.active && (
        <MentionAutocomplete
          ref={autocompleteRef}
          type={mentionState.type}
          query={mentionState.query}
          workspacePath={workspacePath}
          onSelect={handleMentionSelect}
          onClose={closeMention}
        />
      )}
      {isActive && statusMessage && (
        <div className="terminal-status-indicator" aria-live="polite" role="status">
          <Loader2 size={12} className="spinning" />
          <span className="terminal-status-message">{statusMessage}</span>
          <span className="terminal-status-hint">Esc to cancel</span>
        </div>
      )}
      {pendingImages.length > 0 && (
        <div className="pending-images-preview">
          {pendingImages.map((img, i) => (
            <div key={i} className="pending-image-item">
              <img
                src={`data:${img.mediaType};base64,${img.data}`}
                alt={`Pending attachment ${i + 1}`}
              />
              <button
                className="pending-image-remove"
                onClick={() => onPendingImageRemove(i)}
                title="Remove image"
              >
                ×
              </button>
            </div>
          ))}
          {pendingImages.length >= 5 && (
            <span className="pending-images-limit">Maximum 5 images</span>
          )}
        </div>
      )}
      {shellMode && (
        <div
          className={`shell-mode-indicator ${shellMode === 'incognito' ? 'shell-incognito' : ''}`}
        >
          <span className="shell-mode-prefix">{shellMode === 'incognito' ? '$$' : '$'}</span>
          <span className="shell-mode-label">
            {shellMode === 'incognito'
              ? 'Shell (incognito — output hidden from agent)'
              : 'Shell (output added to agent context)'}
          </span>
        </div>
      )}
      <textarea
        ref={inputRef}
        value={input}
        onChange={(e) => {
          onInputChange(e.target.value);
          setHistoryIndex(-1);
          trackCursor();
        }}
        onKeyDown={handleKeyDown}
        onKeyUp={trackCursor}
        onClick={trackCursor}
        onSelect={trackCursor}
        onPaste={handlePaste}
        placeholder={
          !isConnected
            ? 'Connecting...'
            : pendingImages.length > 0
              ? 'Add a message or press Enter to send...'
              : 'Type @ for files, @@ for threads...'
        }
        disabled={!isConnected}
        className="terminal-input"
        rows={1}
        aria-label="Message input"
      />
      <button
        className={`terminal-mode-badge mode-${agentMode} ${isModeLocked ? 'mode-locked' : ''}`}
        onClick={isModeLocked ? undefined : onCycleMode}
        disabled={isModeLocked}
        title={
          isModeLocked
            ? `Mode: ${modeLabel} (locked for this thread)`
            : `Mode: ${modeLabel} (click to change)`
        }
        aria-label={`Agent mode: ${modeLabel}${isModeLocked ? ' (locked)' : ''}`}
      >
        <span className="mode-icon">{modeIcon}</span>
        <span className="mode-label">{modeLabel}</span>
      </button>
      <button
        onClick={onSend}
        disabled={
          !isConnected || (!input.trim() && pendingImages.length === 0 && !hasQueuedMessage)
        }
        className={`terminal-send ${isActive && input.trim() ? 'will-cancel' : ''} ${hasQueuedMessage && !input.trim() ? 'will-cancel' : ''}`}
        title={
          hasQueuedMessage && !input.trim()
            ? 'Send now (will interrupt current operation)'
            : isActive && input.trim()
              ? 'Send (will queue message)'
              : 'Send message'
        }
      >
        <Send size={18} />
      </button>
    </div>
  );
}
