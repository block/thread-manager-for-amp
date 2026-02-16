import { memo, useState, useEffect, useRef, useCallback } from 'react';
import { FileText, X } from 'lucide-react';
import { apiGet } from '../../api/client';
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

  const performSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const results = await apiGet<SearchResult[]>(`/api/search?q=${encodeURIComponent(query)}`);
      setSearchResults(results);
      setShowResults(true);
    } catch (err) {
      console.error('Search failed:', err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
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
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
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
      part.toLowerCase() === query.toLowerCase()
        ? <mark key={i} className={styles.searchHighlight}>{part}</mark>
        : part
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
        type="text"
        placeholder="Search all content..."
        value={fullTextQuery}
        onChange={(e) => setFullTextQuery(e.target.value)}
        onFocus={() => searchResults.length > 0 && setShowResults(true)}
        className={styles.searchInput}
        aria-label="Search all content"
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
            <button key={result.threadId} className={styles.searchResult} onClick={() => handleResultClick(result)}>
              <div className={styles.searchResultHeader}>
                <span className={styles.searchResultTitle}>{result.title}</span>
                <Timestamp date={result.lastUpdated} className={styles.searchResultTime} />
              </div>
              <div className={styles.searchResultMatches}>
                {result.matches.map((match, i) => (
                  <div key={i} className={styles.searchResultMatch}>
                    <span className={styles.matchRole}>{match.role}:</span>
                    <span className={styles.matchSnippet}>{highlightMatch(match.snippet, fullTextQuery)}</span>
                  </div>
                ))}
              </div>
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
