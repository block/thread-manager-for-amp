import { memo, useState, useEffect, useRef, useCallback } from 'react';
import { FileText, X } from 'lucide-react';
import { Timestamp } from '../Timestamp';
import type { ToolbarContentSearchProps, SearchResult } from './types';
import styles from './Toolbar.module.css';

export const ToolbarContentSearch = memo(function ToolbarContentSearch({
  onOpenThread,
}: ToolbarContentSearchProps) {
  const [fullTextQuery, setFullTextQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const performSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsSearching(true);
    setSearchResults([]);

    try {
      const seen = new Set<string>();
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&stream`, {
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (controller.signal.aborted) return;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ') && line.length > 6) {
            try {
              const batch = JSON.parse(line.slice(6)) as SearchResult[];
              const fresh = batch.filter((r) => {
                if (seen.has(r.threadId)) return false;
                seen.add(r.threadId);
                return true;
              });
              if (fresh.length > 0) {
                setSearchResults((prev) => [...prev, ...fresh]);
                if (document.activeElement === inputRef.current) {
                  setShowResults(true);
                }
              }
            } catch {
              // skip malformed SSE data
            }
          }
          if (line.startsWith('event: done')) {
            setIsSearching(false);
          }
        }
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      console.error('Search failed:', err);
    } finally {
      if (!controller.signal.aborted) {
        setIsSearching(false);
      }
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (fullTextQuery.length >= 2) {
      debounceRef.current = setTimeout(() => performSearch(fullTextQuery), 300);
    } else {
      setSearchResults([]);
      setShowResults(false);
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fullTextQuery, performSearch]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleResultClick = (result: SearchResult) => {
    if (onOpenThread) {
      onOpenThread({
        id: result.threadId,
        title: result.title,
        lastUpdated: result.lastUpdated,
        visibility: 'Private',
        messages: 0,
      });
    }
    setShowResults(false);
    setFullTextQuery('');
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className={styles.searchHighlight}>
          {part}
        </mark>
      ) : (
        part
      ),
    );
  };

  const handleClear = () => {
    setFullTextQuery('');
    setSearchResults([]);
    setShowResults(false);
  };

  return (
    <div className={styles.contentSearch} ref={searchRef}>
      <FileText size={16} className={styles.searchIconContent} />
      <input
        ref={inputRef}
        type="text"
        placeholder="Search threads..."
        value={fullTextQuery}
        onChange={(e) => setFullTextQuery(e.target.value)}
        onFocus={() => searchResults.length > 0 && setShowResults(true)}
        className={styles.searchInput}
        aria-label="Search threads"
      />
      {fullTextQuery && (
        <button className={styles.searchClear} onClick={handleClear}>
          <X size={14} />
        </button>
      )}
      {isSearching && <span className={styles.searchSpinner} />}

      {showResults && searchResults.length > 0 && (
        <div className={styles.searchResults}>
          {searchResults.map((result) => (
            <button
              key={result.threadId}
              className={styles.searchResult}
              onClick={() => handleResultClick(result)}
            >
              <div className={styles.searchResultHeader}>
                <span className={styles.searchResultTitle}>
                  {highlightMatch(result.title, fullTextQuery)}
                </span>
                <Timestamp date={result.lastUpdated} className={styles.searchResultTime} />
              </div>
              {result.matches.length > 0 ? (
                <div className={styles.searchResultMatches}>
                  {result.matches.map((match, i) => (
                    <div key={i} className={styles.searchResultMatch}>
                      <span className={styles.matchRole}>{match.role}:</span>
                      <span className={styles.matchSnippet}>
                        {highlightMatch(match.snippet, fullTextQuery)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.searchResultMatches}>
                  <div className={styles.searchResultMatch}>
                    <span className={styles.matchSnippet}>
                      {highlightMatch(result.threadId, fullTextQuery)}
                    </span>
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {showResults && fullTextQuery.length >= 2 && searchResults.length === 0 && !isSearching && (
        <div className={styles.searchResults}>
          <div className={styles.searchNoResults}>No matches found</div>
        </div>
      )}
    </div>
  );
});
