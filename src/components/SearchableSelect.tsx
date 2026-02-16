import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { ChevronDown, Search, X, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: SelectOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  allLabel: string;
  icon?: React.ReactNode;
  colorClass?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
}

export const SearchableSelect = memo(function SearchableSelect({
  options,
  value,
  onChange,
  allLabel,
  icon,
  colorClass = '',
  searchable = true,
  searchPlaceholder = 'Search...',
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filteredOptions = search
    ? options.filter(opt => 
        opt.label.toLowerCase().includes(search.toLowerCase()) ||
        opt.value.toLowerCase().includes(search.toLowerCase())
      )
    : options;

  const selectedOption = options.find(opt => opt.value === value);
  const displayLabel = selectedOption?.label || allLabel;

  const handleSelect = useCallback((optValue: string | null) => {
    onChange(optValue);
    setOpen(false);
    setSearch('');
  }, [onChange]);

  useEffect(() => {
    if (open && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [open, searchable]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  return (
    <div className={`searchable-select ${colorClass}`} ref={containerRef}>
      <button
        className={`searchable-select-trigger ${open ? 'open' : ''} ${value ? 'has-value' : ''}`}
        onClick={() => setOpen(!open)}
        type="button"
      >
        {icon && <span className="searchable-select-icon">{icon}</span>}
        <span className="searchable-select-label">{displayLabel}</span>
        <ChevronDown size={14} className={`searchable-select-chevron ${open ? 'rotated' : ''}`} />
      </button>

      {open && (
        <div className="searchable-select-dropdown">
          {searchable && (
            <div className="searchable-select-search">
              <Search size={14} className="searchable-select-search-icon" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="searchable-select-search-input"
                aria-label={searchPlaceholder}
              />
              {search && (
                <button
                  className="searchable-select-search-clear"
                  onClick={() => setSearch('')}
                  type="button"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          )}

          <div className="searchable-select-options">
            <button
              className={`searchable-select-option ${!value ? 'selected' : ''}`}
              onClick={() => handleSelect(null)}
              type="button"
            >
              {!value && <Check size={14} className="searchable-select-check" />}
              <span>{allLabel}</span>
            </button>

            {filteredOptions.map((opt) => (
              <button
                key={opt.value}
                className={`searchable-select-option ${value === opt.value ? 'selected' : ''}`}
                onClick={() => handleSelect(opt.value)}
                type="button"
              >
                {value === opt.value && <Check size={14} className="searchable-select-check" />}
                <span>{opt.label}</span>
              </button>
            ))}

            {filteredOptions.length === 0 && search && (
              <div className="searchable-select-empty">No matches</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
