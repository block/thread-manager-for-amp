import { useState, useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import { FileText, MessageSquare, Loader2 } from 'lucide-react';
import { apiGet } from '../../api/client';
import type { SearchResult, ThreadsResult } from '../../types';

interface FileListResult {
  files: string[];
  truncated: boolean;
}

interface MentionItem {
  value: string;
  label: string;
  secondary?: string;
}

interface MentionAutocompleteProps {
  type: 'file' | 'thread';
  query: string;
  workspacePath: string | null;
  onSelect: (value: string) => void;
  onClose: () => void;
}

export interface MentionAutocompleteHandle {
  handleKeyDown: (e: React.KeyboardEvent) => boolean;
}

export const MentionAutocomplete = forwardRef<MentionAutocompleteHandle, MentionAutocompleteProps>(
  function MentionAutocomplete({ type, query, workspacePath, onSelect, onClose }, ref) {
    const [items, setItems] = useState<MentionItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const listRef = useRef<HTMLDivElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    // Fetch suggestions with debounce
    useEffect(() => {
      if (debounceRef.current) clearTimeout(debounceRef.current);

      debounceRef.current = setTimeout(async () => {
        setLoading(true);
        try {
          if (type === 'file') {
            if (!workspacePath) {
              setItems([]);
              setLoading(false);
              return;
            }
            const result = await apiGet<FileListResult>(
              `/api/files?workspace=${encodeURIComponent(workspacePath)}&q=${encodeURIComponent(query)}`,
            );
            setItems(
              result.files.map((f) => ({
                value: f,
                label: truncatePath(f),
                secondary: f,
              })),
            );
          } else {
            if (query) {
              const results = await apiGet<SearchResult[]>(
                `/api/search?q=${encodeURIComponent(query)}`,
              );
              setItems(
                results.slice(0, 10).map((r) => ({
                  value: r.threadId,
                  label: r.title,
                  secondary: r.threadId,
                })),
              );
            } else {
              const result = await apiGet<ThreadsResult>('/api/threads?limit=10');
              setItems(
                result.threads.map((t) => ({
                  value: t.id,
                  label: t.title,
                  secondary: t.id,
                })),
              );
            }
          }
        } catch {
          setItems([]);
        }
        setLoading(false);
        setSelectedIndex(0);
      }, 150);

      return () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
      };
    }, [type, query, workspacePath]);

    // Scroll selected into view
    useEffect(() => {
      if (listRef.current) {
        const selected = listRef.current.querySelector('.mention-item.selected');
        selected?.scrollIntoView({ block: 'nearest' });
      }
    }, [selectedIndex]);

    const handleSelect = useCallback(
      (item: MentionItem) => {
        onSelect(item.value);
      },
      [onSelect],
    );

    // Expose keyboard handler via ref
    useImperativeHandle(
      ref,
      () => ({
        handleKeyDown(e: React.KeyboardEvent): boolean {
          switch (e.key) {
            case 'ArrowDown':
              e.preventDefault();
              setSelectedIndex((i) => Math.min(i + 1, items.length - 1));
              return true;
            case 'ArrowUp':
              e.preventDefault();
              setSelectedIndex((i) => Math.max(i - 1, 0));
              return true;
            case 'Enter':
            case 'Tab':
              e.preventDefault();
              if (items[selectedIndex]) {
                handleSelect(items[selectedIndex]);
              }
              return true;
            case 'Escape':
              e.preventDefault();
              onClose();
              return true;
            default:
              return false;
          }
        },
      }),
      [items, selectedIndex, handleSelect, onClose],
    );

    const Icon = type === 'file' ? FileText : MessageSquare;
    const noWorkspace = type === 'file' && !workspacePath;

    return (
      <div className="mention-autocomplete" role="listbox" aria-label={`${type} suggestions`}>
        {loading && (
          <div className="mention-item mention-loading">
            <Loader2 size={14} className="spinning" />
            <span>Searching…</span>
          </div>
        )}
        {!loading && noWorkspace && (
          <div className="mention-item mention-empty">No workspace associated with this thread</div>
        )}
        {!loading && !noWorkspace && items.length === 0 && (
          <div className="mention-item mention-empty">No matches</div>
        )}
        {!loading && (
          <div ref={listRef}>
            {items.map((item, index) => (
              <div
                key={item.value}
                className={`mention-item ${index === selectedIndex ? 'selected' : ''}`}
                role="option"
                aria-selected={index === selectedIndex}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setSelectedIndex(index)}
                title={item.secondary}
              >
                <Icon size={14} className="mention-item-icon" />
                <span className="mention-item-label">{item.label}</span>
                {item.secondary && item.secondary !== item.label && (
                  <span className="mention-item-secondary">{item.secondary}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  },
);

function truncatePath(path: string, maxLen = 60): string {
  if (path.length <= maxLen) return path;
  return '…' + path.slice(path.length - maxLen + 1);
}
