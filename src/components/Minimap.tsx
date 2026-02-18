import { useRef, useEffect, memo } from 'react';
import {
  FileText,
  Search,
  Terminal,
  User,
  Bot,
  AlertCircle,
  ChevronUp,
  Loader2,
} from 'lucide-react';

export interface MinimapItem {
  id: string;
  type: 'user' | 'assistant' | 'tool' | 'error';
  label: string;
  preview: string;
  toolName?: string;
}

interface MinimapProps {
  items: MinimapItem[];
  activeId?: string;
  onItemClick: (id: string) => void;
  hasMoreMessages?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
}

const TOOL_ICONS: Record<string, typeof FileText> = {
  Read: FileText,
  Grep: Search,
  Bash: Terminal,
  edit_file: FileText,
  create_file: FileText,
  finder: Search,
  glob: Search,
};

function getToolIcon(toolName?: string) {
  if (!toolName) return null;
  const Icon = TOOL_ICONS[toolName] || Terminal;
  return <Icon size={12} />;
}

function getItemIcon(item: MinimapItem) {
  if (item.type === 'user') return <User size={12} />;
  if (item.type === 'error') return <AlertCircle size={12} />;
  if (item.type === 'tool') return getToolIcon(item.toolName) || <Terminal size={12} />;
  return <Bot size={12} />;
}

function getItemColor(item: MinimapItem): string {
  if (item.type === 'user') return 'minimap-user';
  if (item.type === 'error') return 'minimap-error';
  if (item.type === 'tool') {
    const name = item.toolName?.toLowerCase() || '';
    if (name === 'task') return 'minimap-subagent';
    if (name.includes('read') || name.includes('file')) return 'minimap-read';
    if (name.includes('grep') || name.includes('find') || name.includes('glob'))
      return 'minimap-search';
    if (name.includes('bash') || name.includes('terminal')) return 'minimap-bash';
    return 'minimap-tool';
  }
  return 'minimap-assistant';
}

export const Minimap = memo(function Minimap({
  items,
  activeId,
  onItemClick,
  hasMoreMessages,
  loadingMore,
  onLoadMore,
}: MinimapProps) {
  const activeRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevItemCount = useRef(0);
  const prevFirstItemId = useRef<string | undefined>(undefined);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || items.length === 0) return;

    const firstItemId = items[0]?.id;
    const isLoadingOlder =
      firstItemId !== prevFirstItemId.current && prevFirstItemId.current !== undefined;

    // Only scroll to bottom if new messages added at end (not when loading older at top)
    if (items.length > prevItemCount.current && !isLoadingOlder) {
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    }

    prevItemCount.current = items.length;
    prevFirstItemId.current = firstItemId;
  }, [items]);

  useEffect(() => {
    if (items.length === 0) {
      prevItemCount.current = 0;
      prevFirstItemId.current = undefined;
    }
  }, [items.length]);

  return (
    <div className="minimap">
      <div className="minimap-header">
        <span className="minimap-title">MINIMAP</span>
      </div>
      <div className="minimap-items" ref={containerRef}>
        {hasMoreMessages && onLoadMore && (
          <button className="minimap-load-more" onClick={onLoadMore} disabled={loadingMore}>
            {loadingMore ? <Loader2 size={12} className="spinning" /> : <ChevronUp size={12} />}
            <span>{loadingMore ? 'Loading...' : 'Load older'}</span>
          </button>
        )}
        {items.map((item) => (
          <button
            key={item.id}
            ref={item.id === activeId ? activeRef : null}
            className={`minimap-item ${getItemColor(item)} ${item.id === activeId ? 'active' : ''}`}
            onClick={() => onItemClick(item.id)}
          >
            <span className="minimap-icon">{getItemIcon(item)}</span>
            <span className="minimap-label">{item.label}</span>
            <span className="minimap-preview">{item.preview}</span>
          </button>
        ))}
        {items.length === 0 && <div className="minimap-empty">No items yet</div>}
      </div>
    </div>
  );
});
