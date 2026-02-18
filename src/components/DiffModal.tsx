import { X, ExternalLink } from 'lucide-react';
import { BaseModal } from './BaseModal';

interface FileDiff {
  diff?: string;
  isNew?: boolean;
  content?: string;
  lines?: number;
  error?: string;
}

interface DiffModalProps {
  isOpen: boolean;
  filename: string;
  filePath: string;
  workspacePath: string;
  diff: FileDiff | null;
  loading: boolean;
  onClose: () => void;
}

function parseDiffToLines(diff: string): { oldLines: string[]; newLines: string[] } {
  const oldLines: string[] = [];
  const newLines: string[] = [];

  const lines = diff.split('\n');
  let inHunk = false;

  for (const line of lines) {
    if (line.startsWith('@@')) {
      inHunk = true;
      oldLines.push('...');
      newLines.push('...');
      continue;
    }

    if (!inHunk) continue;

    if (line.startsWith('-') && !line.startsWith('---')) {
      oldLines.push(line.slice(1));
      newLines.push('');
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      oldLines.push('');
      newLines.push(line.slice(1));
    } else if (line.startsWith(' ') || line === '') {
      oldLines.push(line.slice(1) || '');
      newLines.push(line.slice(1) || '');
    }
  }

  return { oldLines, newLines };
}

export function DiffModal({
  isOpen,
  filename,
  filePath,
  workspacePath,
  diff,
  loading,
  onClose,
}: DiffModalProps) {
  const openInEditor = () => {
    window.open(`vscode://file/${workspacePath}/${filePath}`, '_blank');
  };

  const { oldLines, newLines } = diff?.diff
    ? parseDiffToLines(diff.diff)
    : { oldLines: [], newLines: [] };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={filename}
      className="diff-modal-container"
      overlayClassName="diff-modal-overlay"
    >
      <div className="diff-modal-header">
        <div className="diff-modal-title">
          <span className="diff-modal-filename">{filename}</span>
          <span className="diff-modal-path">{filePath}</span>
        </div>
        <div className="diff-modal-actions">
          <button className="diff-modal-btn" onClick={openInEditor} title="Open in VS Code">
            <ExternalLink size={14} />
          </button>
          <button className="diff-modal-btn" onClick={onClose} title="Close">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="diff-modal-body">
        {loading && <div className="diff-modal-loading">Loading diff...</div>}

        {diff?.error && <div className="diff-modal-error">{diff.error}</div>}

        {diff?.isNew && diff.content && (
          <div className="diff-modal-new-file">
            <div className="diff-modal-new-label">New file ({diff.lines} lines)</div>
            <pre className="diff-modal-content">{diff.content}</pre>
          </div>
        )}

        {diff?.diff && (
          <div className="diff-modal-side-by-side">
            <div className="diff-modal-pane old">
              <div className="diff-modal-pane-header">Before</div>
              <pre className="diff-modal-pane-content">
                {oldLines.map((line, i) => (
                  <div
                    key={i}
                    className={`diff-line ${line === '' && newLines[i] !== '' ? 'empty' : ''} ${
                      line !== '' && newLines[i] === '' ? 'removed' : ''
                    }`}
                  >
                    <span className="line-number">{line === '...' ? '' : i + 1}</span>
                    <span className="line-content">{line}</span>
                  </div>
                ))}
              </pre>
            </div>
            <div className="diff-modal-pane new">
              <div className="diff-modal-pane-header">After</div>
              <pre className="diff-modal-pane-content">
                {newLines.map((line, i) => (
                  <div
                    key={i}
                    className={`diff-line ${line === '' && oldLines[i] !== '' ? 'empty' : ''} ${
                      line !== '' && oldLines[i] === '' ? 'added' : ''
                    }`}
                  >
                    <span className="line-number">{line === '...' ? '' : i + 1}</span>
                    <span className="line-content">{line}</span>
                  </div>
                ))}
              </pre>
            </div>
          </div>
        )}
      </div>
    </BaseModal>
  );
}
