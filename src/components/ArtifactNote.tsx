import { useState, useCallback } from 'react';
import { Plus, X, Check, FileText, Trash2, Edit3 } from 'lucide-react';
import type { Artifact, ArtifactType } from '../types';
import { MarkdownContent } from './MarkdownContent';

interface ArtifactNoteEditorProps {
  threadId: string;
  artifact?: Artifact;
  onSave: (artifact: Artifact) => void;
  onCancel: () => void;
}

export function ArtifactNoteEditor({ threadId, artifact, onSave, onCancel }: ArtifactNoteEditorProps) {
  const [title, setTitle] = useState(artifact?.title || '');
  const [content, setContent] = useState(artifact?.content || '');
  const [type, setType] = useState<ArtifactType>(artifact?.type || 'note');
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (!title.trim()) return;
    
    setSaving(true);
    try {
      const method = artifact ? 'PATCH' : 'POST';
      const url = artifact ? '/api/artifact' : '/api/artifacts';
      const body = artifact 
        ? { id: artifact.id, title, content }
        : { threadId, type, title, content };
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      if (response.ok) {
        const savedArtifact = await response.json() as Artifact;
        onSave(savedArtifact);
      }
    } catch (err) {
      console.error('Failed to save artifact:', err);
    } finally {
      setSaving(false);
    }
  }, [threadId, artifact, type, title, content, onSave]);

  return (
    <div className="artifact-note-editor">
      <div className="artifact-note-header">
        <select 
          value={type} 
          onChange={(e) => setType(e.target.value as ArtifactType)}
          className="artifact-type-select"
          disabled={!!artifact}
        >
          <option value="note">Note</option>
          <option value="research">Research</option>
          <option value="plan">Plan</option>
        </select>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title..."
          className="artifact-title-input"
          autoFocus
        />
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write your notes in markdown..."
        className="artifact-content-input"
        rows={8}
      />
      <div className="artifact-note-actions">
        <button onClick={onCancel} className="artifact-btn cancel">
          <X size={14} /> Cancel
        </button>
        <button onClick={handleSave} disabled={saving || !title.trim()} className="artifact-btn save">
          <Check size={14} /> {artifact ? 'Update' : 'Save'}
        </button>
      </div>
    </div>
  );
}

interface ArtifactNoteCardProps {
  artifact: Artifact;
  onEdit: () => void;
  onDelete: () => void;
}

export function ArtifactNoteCard({ artifact, onEdit, onDelete }: ArtifactNoteCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      const response = await fetch('/api/artifact', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: artifact.id }),
      });
      if (response.ok) {
        onDelete();
      }
    } catch (err) {
      console.error('Failed to delete artifact:', err);
    } finally {
      setDeleting(false);
    }
  }, [artifact.id, onDelete]);

  const typeLabelMap: Record<string, string> = {
    note: 'Note',
    research: 'Research',
    plan: 'Plan',
    image: 'Image',
    file: 'File',
  };
  const typeLabel = typeLabelMap[artifact.type] || artifact.type;

  return (
    <div className={`artifact-note-card ${expanded ? 'expanded' : ''}`}>
      <button className="artifact-note-card-header" onClick={() => setExpanded(!expanded)}>
        <FileText size={14} />
        <span className="artifact-note-title">{artifact.title}</span>
        <span className={`artifact-note-type ${artifact.type}`}>{typeLabel}</span>
      </button>
      {expanded && (
        <div className="artifact-note-card-body">
          {artifact.content ? (
            <div className="artifact-note-content">
              <MarkdownContent content={artifact.content} />
            </div>
          ) : (
            <div className="artifact-note-empty">No content</div>
          )}
          <div className="artifact-note-card-actions">
            <button onClick={onEdit} className="artifact-action-btn">
              <Edit3 size={12} /> Edit
            </button>
            <button onClick={handleDelete} disabled={deleting} className="artifact-action-btn delete">
              <Trash2 size={12} /> Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface ArtifactNotesListProps {
  threadId: string;
  artifacts: Artifact[];
  onArtifactsChange: (artifacts: Artifact[]) => void;
}

export function ArtifactNotesList({ threadId, artifacts, onArtifactsChange }: ArtifactNotesListProps) {
  const [showEditor, setShowEditor] = useState(false);
  const [editingArtifact, setEditingArtifact] = useState<Artifact | undefined>();

  const handleSave = useCallback((saved: Artifact) => {
    if (editingArtifact) {
      onArtifactsChange(artifacts.map(a => a.id === saved.id ? saved : a));
    } else {
      onArtifactsChange([saved, ...artifacts]);
    }
    setShowEditor(false);
    setEditingArtifact(undefined);
  }, [artifacts, editingArtifact, onArtifactsChange]);

  const handleDelete = useCallback((id: number) => {
    onArtifactsChange(artifacts.filter(a => a.id !== id));
  }, [artifacts, onArtifactsChange]);

  const handleEdit = useCallback((artifact: Artifact) => {
    setEditingArtifact(artifact);
    setShowEditor(true);
  }, []);

  const noteArtifacts = artifacts.filter(a => ['note', 'research', 'plan'].includes(a.type));

  return (
    <div className="artifact-notes-list">
      {showEditor ? (
        <ArtifactNoteEditor
          threadId={threadId}
          artifact={editingArtifact}
          onSave={handleSave}
          onCancel={() => {
            setShowEditor(false);
            setEditingArtifact(undefined);
          }}
        />
      ) : (
        <button onClick={() => setShowEditor(true)} className="artifact-add-btn">
          <Plus size={14} /> Add note
        </button>
      )}
      
      {noteArtifacts.map(artifact => (
        <ArtifactNoteCard
          key={artifact.id}
          artifact={artifact}
          onEdit={() => handleEdit(artifact)}
          onDelete={() => handleDelete(artifact.id)}
        />
      ))}
    </div>
  );
}
