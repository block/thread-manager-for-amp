import { useState, useCallback } from 'react';
import { Link2, X, ExternalLink, Check } from 'lucide-react';
import { parseIssueUrl, getIssueColor } from '../utils/issueTracker';

interface LinkedIssueBadgeProps {
  url: string;
  compact?: boolean;
}

export function LinkedIssueBadge({ url, compact = false }: LinkedIssueBadgeProps) {
  const parsed = parseIssueUrl(url);
  if (!parsed) return null;

  const color = getIssueColor(parsed.type);
  
  return (
    <a
      href={parsed.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`linked-issue-badge ${compact ? 'compact' : ''}`}
      style={{ '--issue-color': color } as React.CSSProperties}
      title={`Open ${parsed.displayName}`}
      onClick={(e) => e.stopPropagation()}
    >
      <Link2 size={compact ? 10 : 12} />
      <span>{parsed.displayName}</span>
      {!compact && <ExternalLink size={10} />}
    </a>
  );
}

interface LinkedIssueEditorProps {
  threadId: string;
  currentUrl?: string | null;
  onUpdate: (url: string | null) => void;
}

export function LinkedIssueEditor({ threadId, currentUrl, onUpdate }: LinkedIssueEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(currentUrl || '');
  const [saving, setSaving] = useState(false);

  const parsed = currentUrl ? parseIssueUrl(currentUrl) : null;

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/thread-linked-issue', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId, url: inputValue.trim() || null }),
      });
      if (response.ok) {
        onUpdate(inputValue.trim() || null);
        setIsEditing(false);
      }
    } catch (err) {
      console.error('Failed to update linked issue:', err);
    } finally {
      setSaving(false);
    }
  }, [threadId, inputValue, onUpdate]);

  const handleRemove = useCallback(async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/thread-linked-issue', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId, url: null }),
      });
      if (response.ok) {
        onUpdate(null);
        setInputValue('');
      }
    } catch (err) {
      console.error('Failed to remove linked issue:', err);
    } finally {
      setSaving(false);
    }
  }, [threadId, onUpdate]);

  if (isEditing) {
    return (
      <div className="linked-issue-editor">
        <input
          type="url"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Paste Linear, GitHub, or Jira URL..."
          className="linked-issue-input"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') {
              setIsEditing(false);
              setInputValue(currentUrl || '');
            }
          }}
        />
        <button 
          onClick={handleSave} 
          disabled={saving}
          className="linked-issue-save"
          title="Save"
        >
          <Check size={14} />
        </button>
        <button 
          onClick={() => {
            setIsEditing(false);
            setInputValue(currentUrl || '');
          }}
          className="linked-issue-cancel"
          title="Cancel"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  if (parsed) {
    return (
      <div className="linked-issue-display">
        <LinkedIssueBadge url={currentUrl!} />
        <button 
          onClick={() => setIsEditing(true)} 
          className="linked-issue-edit"
          title="Edit"
        >
          Edit
        </button>
        <button 
          onClick={handleRemove} 
          disabled={saving}
          className="linked-issue-remove"
          title="Remove"
        >
          <X size={12} />
        </button>
      </div>
    );
  }

  return (
    <button 
      onClick={() => setIsEditing(true)}
      className="linked-issue-add"
    >
      <Link2 size={14} />
      Link issue
    </button>
  );
}
