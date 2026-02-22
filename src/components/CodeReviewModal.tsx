import { useState, useCallback, useRef, useEffect } from 'react';
import { X, FileSearch, Play, Square, ChevronDown, ShieldCheck } from 'lucide-react';
import { BaseModal } from './BaseModal';
import { MarkdownContent } from './MarkdownContent';
import { apiGet, apiPost } from '../api/client';
import type { ReviewCheck } from '../types';

interface CodeReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspace?: string;
}

interface FileItem {
  name: string;
  path: string;
}

interface ReviewResult {
  output: string;
  success: boolean;
}

export function CodeReviewModal({ isOpen, onClose, workspace }: CodeReviewModalProps) {
  const [instructions, setInstructions] = useState('');
  const [summaryOnly, setSummaryOnly] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [availableFiles, setAvailableFiles] = useState<FileItem[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [fileSearch, setFileSearch] = useState('');
  const [reviewOutput, setReviewOutput] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checks, setChecks] = useState<ReviewCheck[]>([]);
  const [selectedChecks, setSelectedChecks] = useState<string[]>([]);
  const [showChecks, setShowChecks] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setReviewOutput('');
      setError(null);
      setReviewing(false);
      setSelectedFiles([]);
      setInstructions('');
      setSummaryOnly(false);
      setShowFilePicker(false);
      setSelectedChecks([]);
      setShowChecks(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !workspace) return;
    void apiGet<ReviewCheck[]>(`/api/review-checks?workspace=${encodeURIComponent(workspace)}`)
      .then(setChecks)
      .catch(() => setChecks([]));
  }, [isOpen, workspace]);

  const loadFiles = useCallback(async () => {
    if (!workspace) return;
    setLoadingFiles(true);
    try {
      const result = await apiGet<{ files: string[]; truncated: boolean }>(
        `/api/files?workspace=${encodeURIComponent(workspace)}`,
      );
      setAvailableFiles(result.files.map((f) => ({ name: f.split('/').pop() || f, path: f })));
    } catch {
      setAvailableFiles([]);
    } finally {
      setLoadingFiles(false);
    }
  }, [workspace]);

  useEffect(() => {
    if (showFilePicker && availableFiles.length === 0) {
      void loadFiles();
    }
  }, [showFilePicker, availableFiles.length, loadFiles]);

  const handleStartReview = useCallback(async () => {
    if (!workspace) return;
    setReviewing(true);
    setReviewOutput('');
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      let reviewInstructions = instructions.trim() || undefined;
      if (selectedChecks.length > 0) {
        const checkDescs = checks
          .filter((c) => selectedChecks.includes(c.name))
          .map((c) => `- **${c.name}** (${c.severity || 'default'}): ${c.description}`)
          .join('\n');
        const checksBlock = `\n\nApply these review checks:\n${checkDescs}`;
        reviewInstructions = (reviewInstructions || '') + checksBlock;
      }

      const body = {
        workspace,
        files: selectedFiles.length > 0 ? selectedFiles : undefined,
        instructions: reviewInstructions,
        summaryOnly,
        stream: true,
      };

      const response = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Review failed: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7);
          } else if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (currentEvent === 'text') {
              try {
                const text = JSON.parse(data) as string;
                setReviewOutput((prev) => prev + text + '\n');
              } catch {
                /* skip malformed data */
              }
            } else if (currentEvent === 'error') {
              try {
                const errText = JSON.parse(data) as string;
                setError(errText);
              } catch {
                /* skip */
              }
            }
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;

      // Fallback to non-streaming
      try {
        const result = await apiPost<ReviewResult>('/api/review', {
          workspace,
          files: selectedFiles.length > 0 ? selectedFiles : undefined,
          instructions: instructions.trim() || undefined,
          summaryOnly,
        });
        setReviewOutput(result.output);
      } catch (fallbackErr) {
        setError((fallbackErr as Error).message);
      }
    } finally {
      setReviewing(false);
      abortRef.current = null;
    }
  }, [workspace, selectedFiles, instructions, summaryOnly, selectedChecks, checks]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    setReviewing(false);
  }, []);

  const toggleFile = useCallback((filePath: string) => {
    setSelectedFiles((prev) =>
      prev.includes(filePath) ? prev.filter((f) => f !== filePath) : [...prev, filePath],
    );
  }, []);

  const toggleCheck = useCallback((checkName: string) => {
    setSelectedChecks((prev) =>
      prev.includes(checkName) ? prev.filter((c) => c !== checkName) : [...prev, checkName],
    );
  }, []);

  const filteredFiles = fileSearch
    ? availableFiles.filter(
        (f) =>
          f.name.toLowerCase().includes(fileSearch.toLowerCase()) ||
          f.path.toLowerCase().includes(fileSearch.toLowerCase()),
      )
    : availableFiles;

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Code Review" className="code-review-modal">
      <div className="code-review-content">
        <div className="code-review-header">
          <div className="code-review-title">
            <FileSearch size={18} />
            <h2>Code Review</h2>
          </div>
          <button className="code-review-close" onClick={onClose} aria-label="Close code review">
            <X size={18} />
          </button>
        </div>

        {!workspace && (
          <div className="code-review-no-workspace">
            Open a thread with a workspace to run code review.
          </div>
        )}

        {workspace && (
          <>
            <div className="code-review-form">
              <div className="code-review-workspace">
                <span className="code-review-label">Workspace:</span>
                <span className="code-review-workspace-path">{workspace}</span>
              </div>

              <button
                className="code-review-file-toggle"
                onClick={() => setShowFilePicker(!showFilePicker)}
                type="button"
              >
                <span>
                  {selectedFiles.length > 0
                    ? `${selectedFiles.length} file${selectedFiles.length !== 1 ? 's' : ''} selected`
                    : 'All files'}
                </span>
                <ChevronDown size={14} className={showFilePicker ? 'rotated' : ''} />
              </button>

              {showFilePicker && (
                <div className="code-review-file-picker">
                  <input
                    type="text"
                    className="code-review-file-search"
                    placeholder="Filter files..."
                    value={fileSearch}
                    onChange={(e) => setFileSearch(e.target.value)}
                    aria-label="Filter files"
                  />
                  <div className="code-review-file-list">
                    {loadingFiles && <div className="code-review-loading">Loading files...</div>}
                    {!loadingFiles && filteredFiles.length === 0 && (
                      <div className="code-review-loading">No files found</div>
                    )}
                    {filteredFiles.slice(0, 50).map((file) => (
                      <label key={file.path} className="code-review-file-item">
                        <input
                          type="checkbox"
                          checked={selectedFiles.includes(file.path)}
                          onChange={() => toggleFile(file.path)}
                        />
                        <span className="code-review-file-name">{file.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {checks.length > 0 && (
                <>
                  <button
                    className="code-review-file-toggle"
                    onClick={() => setShowChecks(!showChecks)}
                    type="button"
                  >
                    <ShieldCheck size={14} />
                    <span>
                      {selectedChecks.length > 0
                        ? `${selectedChecks.length} check${selectedChecks.length !== 1 ? 's' : ''} selected`
                        : `${checks.length} available check${checks.length !== 1 ? 's' : ''}`}
                    </span>
                    <ChevronDown size={14} className={showChecks ? 'rotated' : ''} />
                  </button>

                  {showChecks && (
                    <div className="code-review-file-picker">
                      <div className="code-review-file-list">
                        {checks.map((check) => (
                          <label key={check.name} className="code-review-file-item">
                            <input
                              type="checkbox"
                              checked={selectedChecks.includes(check.name)}
                              onChange={() => toggleCheck(check.name)}
                            />
                            <span className="code-review-check-info">
                              <span className="code-review-file-name">{check.name}</span>
                              {check.severity && (
                                <span className={`code-review-severity ${check.severity}`}>
                                  {check.severity}
                                </span>
                              )}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              <textarea
                className="code-review-instructions"
                placeholder="Optional review instructions..."
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={3}
                disabled={reviewing}
                aria-label="Review instructions"
              />

              <div className="code-review-options">
                <label className="code-review-checkbox">
                  <input
                    type="checkbox"
                    checked={summaryOnly}
                    onChange={(e) => setSummaryOnly(e.target.checked)}
                    disabled={reviewing}
                  />
                  Summary only
                </label>

                <div className="code-review-actions">
                  {reviewing ? (
                    <button className="code-review-cancel-btn" onClick={handleCancel}>
                      <Square size={14} />
                      Cancel
                    </button>
                  ) : (
                    <button
                      className="code-review-start-btn"
                      onClick={() => void handleStartReview()}
                    >
                      <Play size={14} />
                      Start Review
                    </button>
                  )}
                </div>
              </div>
            </div>

            {error && <div className="code-review-error">{error}</div>}

            {reviewOutput && (
              <div className="code-review-output">
                <MarkdownContent content={reviewOutput} />
              </div>
            )}

            {reviewing && !reviewOutput && (
              <div className="code-review-loading">Running review...</div>
            )}
          </>
        )}
      </div>
    </BaseModal>
  );
}
