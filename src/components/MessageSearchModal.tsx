import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { X, Search, User, Bot, Terminal, AlertCircle, ChevronRight } from 'lucide-react';
import { BaseModal } from './BaseModal';
import type { Message } from '../utils/parseMarkdown';
import '../styles/terminal.css';

interface MessageSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  onJumpToMessage: (messageId: string) => void;
}

interface SearchResult {
  message: Message;
  matchIndex: number;
  preview: string;
  lineNumber: number;
}

function getMessageTypeIcon(type: Message['type']) {
  switch (type) {
    case 'user':
      return <User size={14} />;
    case 'assistant':
      return <Bot size={14} />;
    case 'tool_use':
    case 'tool_result':
      return <Terminal size={14} />;
    case 'error':
      return <AlertCircle size={14} />;
    default:
      return <Bot size={14} />;
  }
}

function getMessageTypeLabel(type: Message['type']): string {
  switch (type) {
    case 'user':
      return 'User';
    case 'assistant':
      return 'Assistant';
    case 'tool_use':
      return 'Tool';
    case 'tool_result':
      return 'Result';
    case 'error':
      return 'Error';
    default:
      return 'System';
  }
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text;

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);

  if (index === -1) return text;

  return (
    <>
      {text.slice(0, index)}
      <mark className="search-highlight">{text.slice(index, index + query.length)}</mark>
      {text.slice(index + query.length)}
    </>
  );
}

export function MessageSearchModal({
  isOpen,
  onClose,
  messages,
  onJumpToMessage,
}: MessageSearchModalProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const results = useMemo<SearchResult[]>(() => {
    if (!query.trim()) return [];

    const lowerQuery = query.toLowerCase();
    const matches: SearchResult[] = [];

    messages.forEach((message, index) => {
      const lowerContent = message.content.toLowerCase();
      const matchIndex = lowerContent.indexOf(lowerQuery);

      if (matchIndex !== -1) {
        const start = Math.max(0, matchIndex - 30);
        const end = Math.min(message.content.length, matchIndex + query.length + 50);
        let preview = message.content.slice(start, end).replace(/\n/g, ' ');
        if (start > 0) preview = '...' + preview;
        if (end < message.content.length) preview = preview + '...';

        matches.push({
          message,
          matchIndex,
          preview,
          lineNumber: index + 1,
        });
      }
    });

    return matches;
  }, [query, messages]);

  const clampedSelectedIndex = Math.min(selectedIndex, Math.max(0, results.length - 1));

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (resultsRef.current && results.length > 0) {
      const selectedElement = resultsRef.current.children[clampedSelectedIndex] as HTMLElement;
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard
      selectedElement?.scrollIntoView({ block: 'nearest' });
    }
  }, [clampedSelectedIndex, results.length]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (results[clampedSelectedIndex]) {
            onJumpToMessage(results[clampedSelectedIndex].message.id);
            onClose();
          }
          break;
      }
    },
    [results, clampedSelectedIndex, onJumpToMessage, onClose],
  );

  const handleResultClick = useCallback(
    (result: SearchResult) => {
      onJumpToMessage(result.message.id);
      onClose();
    },
    [onJumpToMessage, onClose],
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Search Messages"
      className="message-search-modal"
      overlayClassName="message-search-overlay"
      trapFocus={false}
    >
      <div onKeyDown={handleKeyDown}>
        <div className="message-search-header">
          <div className="message-search-input-wrapper">
            <Search size={16} className="message-search-icon" />
            <input
              ref={inputRef}
              type="text"
              className="message-search-input"
              placeholder="Search messages..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search messages"
            />
          </div>
          <button className="message-search-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div
          className="message-search-results"
          ref={resultsRef}
          role="listbox"
          aria-label="Search results"
        >
          {query && results.length === 0 && (
            <div className="message-search-empty">No results found</div>
          )}
          {results.map((result, index) => (
            <div
              key={result.message.id}
              className={`message-search-result ${
                index === clampedSelectedIndex ? 'selected' : ''
              }`}
              role="option"
              aria-selected={index === clampedSelectedIndex}
              onClick={() => handleResultClick(result)}
            >
              <div className={`message-search-result-type type-${result.message.type}`}>
                {getMessageTypeIcon(result.message.type)}
                <span>{getMessageTypeLabel(result.message.type)}</span>
              </div>
              <div className="message-search-result-preview">
                {highlightMatch(result.preview, query)}
              </div>
              <div className="message-search-result-meta">
                <span className="message-search-result-line">#{result.lineNumber}</span>
                <ChevronRight size={14} />
              </div>
            </div>
          ))}
        </div>

        {results.length > 0 && (
          <div className="message-search-footer">
            <span className="message-search-hint">
              <kbd>↑↓</kbd> Navigate <kbd>Enter</kbd> Jump <kbd>Esc</kbd> Close
            </span>
            <span className="message-search-count">
              {results.length} result{results.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>
    </BaseModal>
  );
}
