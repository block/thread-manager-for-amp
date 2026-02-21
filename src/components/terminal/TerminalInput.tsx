import { useRef, useState, useCallback } from 'react';
import { Send, Loader2 } from 'lucide-react';
import type { TerminalInputProps } from './types';
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
  pendingImage,
  inputRef,
  onInputChange,
  onSend,
  onCancel: _onCancel,
  onClose,
  onPendingImageRemove,
  onPendingImageSet,
  searchOpen,
  workspacePath,
  threadMode,
}: TerminalInputProps) {
  void _onCancel;
  const autocompleteRef = useRef<MentionAutocompleteHandle>(null);
  const [cursorPosition, setCursorPosition] = useState(0);
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
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          const base64 = dataUrl.split(',')[1] ?? '';
          const mediaType = item.type;
          onPendingImageSet({ data: base64, mediaType });
        };
        reader.readAsDataURL(file);
        return;
      }
    }
  };

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    // When autocomplete is active, delegate navigation keys
    if (mentionState.active && autocompleteRef.current) {
      const handled = autocompleteRef.current.handleKeyDown(e);
      if (handled) return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
    if (e.key === 'Escape' && !searchOpen) {
      if (isSending || isRunning) {
        // Let global handler deal with cancel
        return;
      } else if (pendingImage) {
        onPendingImageRemove();
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
              onPendingImageSet({ data: base64, mediaType: imageType });
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

  const handleMentionSelect = (value: string) => {
    selectMention(value, onInputChange);
  };

  const isActive = isSending || isRunning;
  const statusMessage = getStatusMessage(agentStatus);

  return (
    <div className="terminal-input-area">
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
      {pendingImage && (
        <div className="pending-image-preview">
          <img
            src={`data:${pendingImage.mediaType};base64,${pendingImage.data}`}
            alt="Pending attachment"
          />
          <button
            className="pending-image-remove"
            onClick={onPendingImageRemove}
            title="Remove image"
          >
            ×
          </button>
        </div>
      )}
      <textarea
        ref={inputRef}
        value={input}
        onChange={(e) => {
          onInputChange(e.target.value);
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
            : pendingImage
              ? 'Add a message or press Enter to send...'
              : 'Type @ for files, @@ for threads...'
        }
        disabled={!isConnected}
        className="terminal-input"
        rows={1}
        aria-label="Message input"
      />
      {threadMode && (
        <span
          className={`terminal-mode-badge mode-${threadMode}`}
          title={`Mode: ${threadMode}`}
          aria-label={`Agent mode: ${threadMode}`}
        >
          <span className="mode-icon">
            {threadMode === 'deep' ? '🧠' : threadMode === 'rush' ? '🚀' : '⚡'}
          </span>
          <span className="mode-label">{threadMode}</span>
        </span>
      )}
      <button
        onClick={onSend}
        disabled={!isConnected || (!input.trim() && !pendingImage)}
        className={`terminal-send ${isActive && input.trim() ? 'will-cancel' : ''}`}
        title={isActive && input.trim() ? 'Send (will cancel current operation)' : 'Send message'}
      >
        <Send size={18} />
      </button>
    </div>
  );
}
