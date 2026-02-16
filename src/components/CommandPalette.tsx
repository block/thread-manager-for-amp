import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { X } from 'lucide-react';
import { BaseModal } from './BaseModal';
import '../styles/command-palette.css';

export interface Command {
  id: string;
  category: string;
  label: string;
  shortcut?: string;
  icon?: React.ReactNode;
  action: () => void;
  disabled?: boolean;
}

interface CommandPaletteProps {
  commands: Command[];
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ commands, isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isKeyboardNav, setIsKeyboardNav] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;
    
    const lowerQuery = query.toLowerCase();
    return commands.filter(cmd => {
      const searchText = `${cmd.category} ${cmd.label}`.toLowerCase();
      // Simple fuzzy: check if all query chars appear in order
      let queryIdx = 0;
      for (const char of searchText) {
        if (char === lowerQuery[queryIdx]) {
          queryIdx++;
          if (queryIdx === lowerQuery.length) return true;
        }
      }
      return queryIdx === lowerQuery.length;
    });
  }, [commands, query]);

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isOpen]);

  // Keep selected index in bounds
  useEffect(() => {
    if (selectedIndex >= filteredCommands.length) {
      setSelectedIndex(Math.max(0, filteredCommands.length - 1));
    }
  }, [filteredCommands.length, selectedIndex]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selected = listRef.current.querySelector('.command-item.selected');
      selected?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const executeCommand = useCallback((cmd: Command) => {
    if (cmd.disabled) return;
    onClose();
    // Small delay to let modal close first
    setTimeout(() => cmd.action(), 50);
  }, [onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setIsKeyboardNav(true);
        setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setIsKeyboardNav(true);
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          executeCommand(filteredCommands[selectedIndex]);
        }
        break;
    }
  }, [filteredCommands, selectedIndex, executeCommand]);

  const handleMouseMove = useCallback(() => {
    setIsKeyboardNav(false);
  }, []);

  // Group commands by category
  const groupedCommands: { category: string; items: Command[] }[] = [];
  let currentCategory = '';
  for (const cmd of filteredCommands) {
    if (cmd.category !== currentCategory) {
      currentCategory = cmd.category;
      groupedCommands.push({ category: cmd.category, items: [] });
    }
    groupedCommands[groupedCommands.length - 1].items.push(cmd);
  }

  let globalIndex = 0;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Command Palette"
      className="command-palette"
      overlayClassName="command-palette-overlay"
      trapFocus={false}
    >
      <div className="command-palette-header">
        <span className="command-palette-title">Command Palette</span>
        <button className="command-palette-close" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      
      <div className="command-palette-input-wrapper">
        <span className="command-palette-prompt">&gt;</span>
        <input
          ref={inputRef}
          type="text"
          className="command-palette-input"
          placeholder="Type a command..."
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            setSelectedIndex(0);
          }}
          onKeyDown={handleKeyDown}
          aria-label="Type a command"
        />
      </div>

      <div className="command-palette-list" ref={listRef} onMouseMove={handleMouseMove}>
        {groupedCommands.map(group => (
          <div key={group.category} className="command-group">
            {group.items.map(cmd => {
              const itemIndex = globalIndex++;
              const isSelected = itemIndex === selectedIndex;
              return (
                <div
                  key={cmd.id}
                  className={`command-item ${isSelected ? 'selected' : ''} ${cmd.disabled ? 'disabled' : ''}`}
                  onClick={() => executeCommand(cmd)}
                  onMouseEnter={() => !isKeyboardNav && setSelectedIndex(itemIndex)}
                >
                  <span className="command-category">{cmd.category}</span>
                  <span className="command-label">
                    {cmd.icon && <span className="command-icon">{cmd.icon}</span>}
                    {cmd.label}
                  </span>
                  {cmd.shortcut && (
                    <span className="command-shortcut">{cmd.shortcut}</span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        {filteredCommands.length === 0 && (
          <div className="command-empty">No matching commands</div>
        )}
      </div>
    </BaseModal>
  );
}
