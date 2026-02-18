import { useState, useEffect, useCallback } from 'react';
import { GitBranch, Plus, Pencil, Trash2, X, ExternalLink, ChevronRight } from 'lucide-react';
import { apiGet } from '../api/client';
import { parseDiffToLines } from '../utils/git';
import type { GitStatus, GitFileStatus, FileDiff } from '../types';

interface SourceControlProps {
  threadId: string;
  onClose: () => void;
}

export function SourceControl({ threadId, onClose }: SourceControlProps) {
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<GitFileStatus | null>(null);
  const [fileDiff, setFileDiff] = useState<FileDiff | null>(null);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [showOnlyThreadFiles, setShowOnlyThreadFiles] = useState(true);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const data = await apiGet<GitStatus>(
          `/api/git-status?threadId=${encodeURIComponent(threadId)}`,
        );
        setGitStatus(data);
      } catch (err) {
        console.error('Failed to fetch git status:', err);
      } finally {
        setLoading(false);
      }
    }
    void fetchStatus();
  }, [threadId]);

  const loadFileDiff = useCallback(
    async (file: GitFileStatus) => {
      if (!gitStatus) return;

      setSelectedFile(file);
      setLoadingDiff(true);
      setFileDiff(null);

      try {
        const diff = await apiGet<FileDiff>(
          `/api/file-diff?path=${encodeURIComponent(file.path)}&workspace=${encodeURIComponent(gitStatus.workspacePath)}`,
        );
        setFileDiff(diff);
      } catch (err) {
        console.error('Failed to load diff:', err);
        setFileDiff({ error: 'Failed to load diff' });
      } finally {
        setLoadingDiff(false);
      }
    },
    [gitStatus],
  );

  const openInEditor = (path: string) => {
    window.open(`vscode://file/${path}`, '_blank');
  };

  if (loading) {
    return (
      <div className="source-control-modal">
        <div className="source-control-container">
          <div className="source-control-loading">Loading workspace changes...</div>
        </div>
      </div>
    );
  }

  if (!gitStatus || gitStatus.error) {
    return (
      <div className="source-control-modal">
        <div className="source-control-container">
          <div className="source-control-header">
            <h2>Source Control</h2>
            <button className="source-control-close" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
          <div className="source-control-error">
            {gitStatus?.error || 'Could not load workspace status'}
          </div>
        </div>
      </div>
    );
  }

  const filteredFiles = showOnlyThreadFiles
    ? gitStatus.files.filter((f) => f.touchedByThread)
    : gitStatus.files;

  const addedCount = filteredFiles.filter((f) => f.status === 'added').length;
  const modifiedCount = filteredFiles.filter((f) => f.status === 'modified').length;
  const deletedCount = filteredFiles.filter((f) => f.status === 'deleted').length;

  const { oldLines, newLines } = fileDiff?.diff
    ? parseDiffToLines(fileDiff.diff)
    : { oldLines: [], newLines: [] };

  return (
    <div className="source-control-modal" onClick={onClose}>
      <div className="source-control-container" onClick={(e) => e.stopPropagation()}>
        <div className="source-control-header">
          <div className="source-control-title">
            <GitBranch size={18} />
            <h2>Source Control</h2>
            <span className="source-control-workspace">{gitStatus.workspaceName}</span>
          </div>
          <button className="source-control-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="source-control-toolbar">
          <label className="source-control-filter">
            <input
              type="checkbox"
              checked={showOnlyThreadFiles}
              onChange={(e) => setShowOnlyThreadFiles(e.target.checked)}
            />
            Show only files changed by this thread
          </label>
          <div className="source-control-stats">
            {addedCount > 0 && (
              <span className="stat-added">
                <Plus size={12} /> {addedCount}
              </span>
            )}
            {modifiedCount > 0 && (
              <span className="stat-modified">
                <Pencil size={12} /> {modifiedCount}
              </span>
            )}
            {deletedCount > 0 && (
              <span className="stat-deleted">
                <Trash2 size={12} /> {deletedCount}
              </span>
            )}
          </div>
        </div>

        <div className="source-control-body">
          <div className="source-control-files">
            {filteredFiles.length === 0 ? (
              <div className="source-control-empty">
                {showOnlyThreadFiles
                  ? 'No uncommitted changes from this thread'
                  : 'No uncommitted changes in workspace'}
              </div>
            ) : (
              filteredFiles.map((file) => (
                <button
                  key={file.path}
                  className={`source-control-file ${selectedFile?.path === file.path ? 'selected' : ''} ${file.touchedByThread ? 'thread-touched' : ''}`}
                  onClick={() => loadFileDiff(file)}
                >
                  <span className={`file-status-icon ${file.status}`}>
                    {file.status === 'added' && <Plus size={12} />}
                    {file.status === 'modified' && <Pencil size={12} />}
                    {file.status === 'deleted' && <Trash2 size={12} />}
                  </span>
                  <span className="file-name">{file.relativePath.split('/').pop()}</span>
                  <span className="file-path">
                    {file.relativePath.split('/').slice(0, -1).join('/')}
                  </span>
                  <ChevronRight size={12} className="file-arrow" />
                </button>
              ))
            )}
          </div>

          <div className="source-control-diff">
            {!selectedFile && <div className="diff-placeholder">Select a file to view changes</div>}

            {selectedFile && loadingDiff && <div className="diff-loading">Loading diff...</div>}

            {selectedFile && fileDiff && !loadingDiff && (
              <>
                <div className="diff-header">
                  <span className="diff-filename">{selectedFile.relativePath}</span>
                  <button
                    className="diff-open-btn"
                    onClick={() => openInEditor(selectedFile.path)}
                    title="Open in VS Code"
                  >
                    <ExternalLink size={14} />
                  </button>
                </div>

                {fileDiff.error && <div className="diff-error">{fileDiff.error}</div>}

                {fileDiff.isNew && fileDiff.content && (
                  <div className="diff-new-file">
                    <div className="diff-new-label">New file ({fileDiff.lines} lines)</div>
                    <pre className="diff-content">{fileDiff.content}</pre>
                  </div>
                )}

                {fileDiff.diff && (
                  <div className="diff-side-by-side">
                    <div className="diff-pane diff-old">
                      <div className="diff-pane-header">Before</div>
                      <pre className="diff-pane-content">
                        {oldLines.map((line, i) => (
                          <div
                            key={i}
                            className={`diff-line ${line === '' && newLines[i] !== '' ? 'empty' : ''} ${line !== '' && newLines[i] === '' ? 'removed' : ''}`}
                          >
                            <span className="line-number">{line === '...' ? '' : i + 1}</span>
                            <span className="line-content">{line}</span>
                          </div>
                        ))}
                      </pre>
                    </div>
                    <div className="diff-pane diff-new">
                      <div className="diff-pane-header">After</div>
                      <pre className="diff-pane-content">
                        {newLines.map((line, i) => (
                          <div
                            key={i}
                            className={`diff-line ${line === '' && oldLines[i] !== '' ? 'empty' : ''} ${line !== '' && oldLines[i] === '' ? 'added' : ''}`}
                          >
                            <span className="line-number">{line === '...' ? '' : i + 1}</span>
                            <span className="line-content">{line}</span>
                          </div>
                        ))}
                      </pre>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
