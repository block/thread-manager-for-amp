import { useState, useCallback } from 'react';
import { Plus, Pencil, ChevronDown, ChevronRight, Undo2, Loader2, Check } from 'lucide-react';
import type { FileChange } from '../types';
import { apiPost } from '../api/client';

interface WhatChangedContentProps {
  changes: FileChange[];
  workspacePath?: string | null;
}

export function WhatChangedContent({ changes, workspacePath }: WhatChangedContentProps) {
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [revertingFiles, setRevertingFiles] = useState<Set<string>>(new Set());
  const [revertedFiles, setRevertedFiles] = useState<Set<string>>(new Set());

  const createdCount = changes.filter((c) => c.created && !revertedFiles.has(c.path)).length;
  const editedCount = changes.filter((c) => !c.created && !revertedFiles.has(c.path)).length;

  const toggleFile = (path: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const handleRevert = useCallback(
    async (file: FileChange, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!workspacePath || revertingFiles.has(file.path)) return;

      setRevertingFiles((prev) => new Set(prev).add(file.path));
      try {
        await apiPost('/api/git-revert-file', {
          workspacePath,
          filePath: file.path,
          created: file.created,
        });
        setRevertedFiles((prev) => new Set(prev).add(file.path));
      } catch (err) {
        console.error('Failed to revert file:', err);
      } finally {
        setRevertingFiles((prev) => {
          const next = new Set(prev);
          next.delete(file.path);
          return next;
        });
      }
    },
    [workspacePath, revertingFiles],
  );

  const visibleChanges = changes.filter((c) => !revertedFiles.has(c.path));

  return (
    <div className="discovery-changes">
      <div className="change-summary">
        {createdCount > 0 && (
          <span className="summary-created">
            <Plus size={12} /> {createdCount} created
          </span>
        )}
        {editedCount > 0 && (
          <span className="summary-edited">
            <Pencil size={12} /> {editedCount} edited
          </span>
        )}
        {revertedFiles.size > 0 && (
          <span className="summary-reverted">
            <Check size={12} /> {revertedFiles.size} reverted
          </span>
        )}
      </div>

      <div className="change-file-list">
        {visibleChanges.map((file) => (
          <div key={file.path} className="change-file">
            <button className="change-file-header" onClick={() => toggleFile(file.path)}>
              <span className={`change-icon ${file.created ? 'created' : 'edited'}`}>
                {file.created ? <Plus size={12} /> : <Pencil size={12} />}
              </span>
              <span className="change-filename">{file.filename}</span>
              <span className="change-dir">{file.dir}</span>
              {workspacePath && (
                <button
                  className={`change-revert-btn ${revertingFiles.has(file.path) ? 'reverting' : ''}`}
                  onClick={(e) => handleRevert(file, e)}
                  disabled={revertingFiles.has(file.path)}
                  title={`Revert ${file.filename}`}
                  aria-label={`Revert ${file.filename}`}
                >
                  {revertingFiles.has(file.path) ? (
                    <Loader2 size={12} className="spinning" />
                  ) : (
                    <Undo2 size={12} />
                  )}
                </button>
              )}
              {file.edits.length > 0 && (
                <span className="change-expand">
                  {expandedFiles.has(file.path) ? (
                    <ChevronDown size={12} />
                  ) : (
                    <ChevronRight size={12} />
                  )}
                </span>
              )}
            </button>

            {expandedFiles.has(file.path) && file.edits.length > 0 && (
              <div className="change-diffs">
                {file.edits.map((edit, i) => (
                  <div key={i} className="change-diff">
                    {edit.type === 'create' ? (
                      <div className="diff-create">
                        <span className="diff-label">Created ({edit.lines} lines)</span>
                        {edit.preview && <pre className="diff-preview">{edit.preview}</pre>}
                      </div>
                    ) : (
                      <div className="diff-edit">
                        {edit.oldStr && (
                          <div className="diff-old">
                            <span className="diff-marker">-</span>
                            <pre>
                              {edit.oldStr.slice(0, 500)}
                              {edit.oldStr.length > 500 ? '...' : ''}
                            </pre>
                          </div>
                        )}
                        {edit.newStr && (
                          <div className="diff-new">
                            <span className="diff-marker">+</span>
                            <pre>
                              {edit.newStr.slice(0, 500)}
                              {edit.newStr.length > 500 ? '...' : ''}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
