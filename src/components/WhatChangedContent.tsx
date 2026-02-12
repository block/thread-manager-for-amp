import { useState } from 'react';
import { Plus, Pencil, ChevronDown, ChevronRight } from 'lucide-react';
import type { FileChange } from '../types';

interface WhatChangedContentProps {
  changes: FileChange[];
}

export function WhatChangedContent({ changes }: WhatChangedContentProps) {
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  const createdCount = changes.filter(c => c.created).length;
  const editedCount = changes.filter(c => !c.created).length;

  const toggleFile = (path: string) => {
    setExpandedFiles(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

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
      </div>
      
      <div className="change-file-list">
        {changes.map((file) => (
          <div key={file.path} className="change-file">
            <button
              className="change-file-header"
              onClick={() => toggleFile(file.path)}
            >
              <span className={`change-icon ${file.created ? 'created' : 'edited'}`}>
                {file.created ? <Plus size={12} /> : <Pencil size={12} />}
              </span>
              <span className="change-filename">{file.filename}</span>
              <span className="change-dir">{file.dir}</span>
              {file.edits.length > 0 && (
                <span className="change-expand">
                  {expandedFiles.has(file.path) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
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
                        {edit.preview && (
                          <pre className="diff-preview">{edit.preview}</pre>
                        )}
                      </div>
                    ) : (
                      <div className="diff-edit">
                        {edit.oldStr && (
                          <div className="diff-old">
                            <span className="diff-marker">-</span>
                            <pre>{edit.oldStr.slice(0, 500)}{edit.oldStr.length > 500 ? '...' : ''}</pre>
                          </div>
                        )}
                        {edit.newStr && (
                          <div className="diff-new">
                            <span className="diff-marker">+</span>
                            <pre>{edit.newStr.slice(0, 500)}{edit.newStr.length > 500 ? '...' : ''}</pre>
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
