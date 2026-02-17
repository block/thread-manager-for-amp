import { useState, useEffect, useCallback, useRef } from 'react';
import { GitBranch, Plus, Pencil, Trash2, X, ExternalLink, ChevronRight } from 'lucide-react';
import { apiGet } from '../../api/client';
import { parseDiffToLines } from '../../utils/git';

interface WorkspaceGitStatus {
  isGitRepo: boolean;
  workspace: string;
  branch?: string;
  files: Array<{
    path: string;
    status: 'added' | 'modified' | 'deleted' | 'renamed';
    staged: boolean;
  }>;
  totalCount: number;
  addedCount: number;
  modifiedCount: number;
  deletedCount: number;
  error?: string;
}

interface FileDiff {
  diff?: string;
  isNew?: boolean;
  content?: string;
  lines?: number;
  error?: string;
}

interface WorkspaceSourceControlModalProps {
  workspacePath: string;
  workspaceName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function WorkspaceSourceControlModal({
  workspacePath,
  workspaceName,
  isOpen,
  onClose,
}: WorkspaceSourceControlModalProps) {
  const [gitStatus, setGitStatus] = useState<WorkspaceGitStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileDiff, setFileDiff] = useState<FileDiff | null>(null);
  const [loadingDiff, setLoadingDiff] = useState(false);

  const selectedFileRef = useRef(selectedFile);
  selectedFileRef.current = selectedFile;

  useEffect(() => {
    if (!isOpen) return;
    
    async function fetchStatus() {
      setLoading(true);
      try {
        const data = await apiGet<WorkspaceGitStatus>(
          `/api/workspace-git-status?workspace=${encodeURIComponent(workspacePath)}`
        );
        setGitStatus(data);
        
        // Auto-select first file if available
        if (data.files.length > 0 && !selectedFileRef.current && data.files[0]) {
          setSelectedFile(data.files[0].path);
        }
      } catch (err) {
        console.error('Failed to fetch git status:', err);
      } finally {
        setLoading(false);
      }
    }
    void fetchStatus();
  }, [isOpen, workspacePath]);

  // Auto-load diff when selectedFile changes
  useEffect(() => {
    if (selectedFile && isOpen) {
      setLoadingDiff(true);
      setFileDiff(null);
      
      const fullPath = `${workspacePath}/${selectedFile}`;
      void apiGet<FileDiff>(
        `/api/file-diff?path=${encodeURIComponent(fullPath)}&workspace=${encodeURIComponent(workspacePath)}`
      ).then(diff => {
        setFileDiff(diff);
      }).catch((err: unknown) => {
        console.error('Failed to load diff:', err);
        setFileDiff({ error: 'Failed to load diff' });
      }).finally(() => {
        setLoadingDiff(false);
      });
    }
  }, [selectedFile, isOpen, workspacePath]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const selectFile = useCallback((filePath: string) => {
    setSelectedFile(filePath);
  }, []);

  const openInEditor = (path: string) => {
    window.open(`vscode://file/${workspacePath}/${path}`, '_blank');
  };

  if (!isOpen) return null;

  if (loading) {
    return (
      <div className="source-control-modal" onClick={onClose}>
        <div className="source-control-container" onClick={e => e.stopPropagation()}>
          <div className="source-control-loading">Loading workspace changes...</div>
        </div>
      </div>
    );
  }

  if (!gitStatus || gitStatus.error) {
    return (
      <div className="source-control-modal" onClick={onClose}>
        <div className="source-control-container" onClick={e => e.stopPropagation()}>
          <div className="source-control-header">
            <div className="source-control-title">
              <GitBranch size={18} />
              <h2>Source Control</h2>
            </div>
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

  const { oldLines, newLines } = fileDiff?.diff 
    ? parseDiffToLines(fileDiff.diff) 
    : { oldLines: [], newLines: [] };

  return (
    <div className="source-control-modal" onClick={onClose}>
      <div className="source-control-container" onClick={e => e.stopPropagation()}>
        <div className="source-control-header">
          <div className="source-control-title">
            <GitBranch size={18} />
            <h2>Source Control</h2>
            <span className="source-control-workspace">{workspaceName}</span>
          </div>
          <button className="source-control-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="source-control-toolbar">
          <div className="source-control-stats">
            {gitStatus.addedCount > 0 && <span className="stat-added"><Plus size={12} /> {gitStatus.addedCount}</span>}
            {gitStatus.modifiedCount > 0 && <span className="stat-modified"><Pencil size={12} /> {gitStatus.modifiedCount}</span>}
            {gitStatus.deletedCount > 0 && <span className="stat-deleted"><Trash2 size={12} /> {gitStatus.deletedCount}</span>}
          </div>
        </div>

        <div className="source-control-body">
          <div className="source-control-files">
            {gitStatus.files.length === 0 ? (
              <div className="source-control-empty">
                No uncommitted changes in workspace
              </div>
            ) : (
              gitStatus.files.map((file) => (
                <button
                  key={file.path}
                  className={`source-control-file ${selectedFile === file.path ? 'selected' : ''}`}
                  onClick={() => selectFile(file.path)}
                >
                  <span className={`file-status-icon ${file.status}`}>
                    {file.status === 'added' && <Plus size={12} />}
                    {file.status === 'modified' && <Pencil size={12} />}
                    {file.status === 'deleted' && <Trash2 size={12} />}
                  </span>
                  <span className="file-name">{file.path.split('/').pop()}</span>
                  <span className="file-path">{file.path.split('/').slice(0, -1).join('/')}</span>
                  <ChevronRight size={12} className="file-arrow" />
                </button>
              ))
            )}
          </div>

          <div className="source-control-diff">
            {!selectedFile && (
              <div className="diff-placeholder">
                Select a file to view changes
              </div>
            )}
            
            {selectedFile && loadingDiff && (
              <div className="diff-loading">Loading diff...</div>
            )}
            
            {selectedFile && fileDiff && !loadingDiff && (
              <>
                <div className="diff-header">
                  <span className="diff-filename">{selectedFile}</span>
                  <button 
                    className="diff-open-btn"
                    onClick={() => openInEditor(selectedFile)}
                    title="Open in VS Code"
                  >
                    <ExternalLink size={14} />
                  </button>
                </div>
                
                {fileDiff.error && (
                  <div className="diff-error">{fileDiff.error}</div>
                )}
                
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
