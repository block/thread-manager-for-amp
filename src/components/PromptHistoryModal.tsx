import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Search, Clock, ChevronRight } from 'lucide-react';
import { BaseModal } from './BaseModal';
import { apiGet } from '../api/client';

interface PromptHistoryEntry {
  id: number;
  text: string;
  threadId: string;
  createdAt: number;
}

interface PromptHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (text: string) => void;
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

function formatTime(unixSeconds: number): string {
  if (!unixSeconds) return '';
  const date = new Date(unixSeconds * 1000);
  const now = Date.now();
  const diff = now - date.getTime();
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  const minutes = Math.floor(diff / 60000);
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

// Inner component that mounts fresh each time the modal opens, avoiding setState-in-effect issues
function PromptHistoryContent({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (text: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PromptHistoryEntry[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Load recent prompts on mount
  useEffect(() => {
    apiGet<PromptHistoryEntry[]>('/api/prompt-history?limit=50')
      .then(setResults)
      .catch(() => setResults([]))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!query.trim()) return;

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams({ limit: '50' });
      params.set('q', query.trim());

      apiGet<PromptHistoryEntry[]>(`/api/prompt-history?${params.toString()}`)
        .then((data) => {
          setResults(data);
          setSelectedIndex(0);
        })
        .catch(() => setResults([]));
    }, 150);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const clampedIndex = Math.min(selectedIndex, Math.max(0, results.length - 1));

  useEffect(() => {
    if (resultsRef.current && results.length > 0) {
      const el = resultsRef.current.children[clampedIndex] as HTMLElement | undefined;
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [clampedIndex, results.length]);

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
          if (results[clampedIndex]) {
            onSelect(results[clampedIndex].text);
            onClose();
          }
          break;
      }
    },
    [results, clampedIndex, onSelect, onClose],
  );

  const handleResultClick = useCallback(
    (entry: PromptHistoryEntry) => {
      onSelect(entry.text);
      onClose();
    },
    [onSelect, onClose],
  );

  return (
    <div onKeyDown={handleKeyDown}>
      <div className="message-search-header">
        <div className="message-search-input-wrapper">
          <Search size={16} className="message-search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="message-search-input"
            placeholder="Search prompt history..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search prompt history"
          />
        </div>
        <button className="message-search-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
      </div>

      <div
        className="message-search-results"
        ref={resultsRef}
        role="listbox"
        aria-label="Prompt history results"
      >
        {isLoading && <div className="message-search-empty">Loading prompt history...</div>}
        {!isLoading && results.length === 0 && (
          <div className="message-search-empty">
            {query ? 'No matching prompts found' : 'No prompt history yet'}
          </div>
        )}
        {results.map((entry, index) => (
          <div
            key={entry.id}
            className={`message-search-result ${index === clampedIndex ? 'selected' : ''}`}
            role="option"
            aria-selected={index === clampedIndex}
            onClick={() => handleResultClick(entry)}
          >
            <div className="message-search-result-type type-user">
              <Clock size={14} />
              <span>{formatTime(entry.createdAt)}</span>
            </div>
            <div className="message-search-result-preview">
              {highlightMatch(entry.text.slice(0, 120).replace(/\n/g, ' '), query)}
            </div>
            <div className="message-search-result-meta">
              <ChevronRight size={14} />
            </div>
          </div>
        ))}
      </div>

      {results.length > 0 && (
        <div className="message-search-footer">
          <span className="message-search-hint">
            <kbd>↑↓</kbd> Navigate <kbd>Enter</kbd> Insert <kbd>Esc</kbd> Close
          </span>
          <span className="message-search-count">
            {results.length} prompt{results.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
}

export function PromptHistoryModal({ isOpen, onClose, onSelect }: PromptHistoryModalProps) {
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Prompt History"
      className="message-search-modal"
      overlayClassName="message-search-overlay"
      trapFocus={false}
    >
      {isOpen && <PromptHistoryContent onClose={onClose} onSelect={onSelect} />}
    </BaseModal>
  );
}
