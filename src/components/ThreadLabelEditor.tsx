import { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, X } from 'lucide-react';
import { apiGet, apiPut } from '../api/client';

interface ThreadLabel {
  id: string;
  name: string;
  createdAt: string;
}

function hashStringToHue(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  return Math.abs(hash) % 360;
}

function getLabelColor(labelName: string): { bg: string; text: string; border: string } {
  const hue = hashStringToHue(labelName);
  return {
    bg: `hsla(${hue}, 70%, 50%, 0.15)`,
    text: `hsl(${hue}, 80%, 65%)`,
    border: `hsla(${hue}, 70%, 50%, 0.3)`,
  };
}

interface ThreadLabelEditorProps {
  threadId: string;
  initialLabels?: { name: string }[];
  onLabelsChange?: () => void;
  compact?: boolean;
}

export function ThreadLabelEditor({ threadId, initialLabels, onLabelsChange, compact = false }: ThreadLabelEditorProps) {
  const [labels, setLabels] = useState<ThreadLabel[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadLabels = useCallback(async () => {
    try {
      const result = await apiGet<ThreadLabel[]>(`/api/thread-labels?threadId=${encodeURIComponent(threadId)}`);
      setLabels(result);
      setError(null);
    } catch (err) {
      console.error('Failed to load labels:', err);
      setLabels([]);
    }
  }, [threadId]);

  // Skip mount fetch when parent provides labels (avoids per-row N+1 API calls).
  // After user actions (add/remove), loadLabels() is called explicitly to get fresh data.
  useEffect(() => {
    if (initialLabels) {
      setLabels(initialLabels.map((l, i) => ({ id: `init-${i}`, name: l.name, createdAt: '' })));
    } else {
      void loadLabels();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when threadId changes, not on every initialLabels ref change
  }, [threadId]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleAddLabel = async () => {
    const labelName = newLabel.trim().toLowerCase();
    if (!labelName) return;

    // Validate label format
    if (!/^[a-z0-9][a-z0-9-]*$/.test(labelName)) {
      setError('Label must be lowercase alphanumeric with hyphens');
      return;
    }
    if (labelName.length > 32) {
      setError('Label must be 32 characters or less');
      return;
    }
    if (labels.some(l => l.name === labelName)) {
      setError('Label already exists');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const newLabels = [...labels.map(l => l.name), labelName];
      await apiPut<ThreadLabel[]>('/api/thread-labels', { threadId, labels: newLabels });
      await loadLabels();
      setNewLabel('');
      setIsEditing(false);
      onLabelsChange?.();
    } catch (err) {
      console.error('Failed to add label:', err);
      setError('Failed to add label');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveLabel = async (labelName: string) => {
    setLoading(true);
    try {
      const newLabels = labels.filter(l => l.name !== labelName).map(l => l.name);
      await apiPut<ThreadLabel[]>('/api/thread-labels', { threadId, labels: newLabels });
      await loadLabels();
      onLabelsChange?.();
    } catch (err) {
      console.error('Failed to remove label:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleAddLabel();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setNewLabel('');
      setError(null);
    }
  };

  return (
    <div className={`thread-label-editor ${compact ? 'compact' : ''}`} onClick={e => e.stopPropagation()}>
      {labels.map(label => {
        const colors = getLabelColor(label.name);
        return (
          <button 
            key={label.id} 
            className="label-tag" 
            title={`Click to remove "${label.name}"`}
            onClick={() => { void handleRemoveLabel(label.name); }}
            disabled={loading}
            style={{
              background: colors.bg,
              color: colors.text,
              borderColor: colors.border,
            }}
          >
            {label.name}
            <X size={8} className="label-x" />
          </button>
        );
      })}
      
      {isEditing ? (
        <div className="label-input-wrapper">
          <input
            ref={inputRef}
            type="text"
            value={newLabel}
            onChange={(e) => {
              setNewLabel(e.target.value.toLowerCase());
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              if (!newLabel.trim()) {
                setIsEditing(false);
                setError(null);
              }
            }}
            placeholder="label-name"
            className="label-input"
            disabled={loading}
          />
          {error && <span className="label-error">{error}</span>}
        </div>
      ) : (
        <button 
          className="label-add-btn"
          onClick={() => setIsEditing(true)}
          disabled={loading}
          title="Add label"
        >
          <Plus size={12} />
          {labels.length === 0 && <span>Add label</span>}
        </button>
      )}
    </div>
  );
}
