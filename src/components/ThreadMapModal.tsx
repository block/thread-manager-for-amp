import { useState, useEffect, useCallback, useRef } from 'react';
import { X, GitBranch, ChevronDown } from 'lucide-react';
import { BaseModal } from './BaseModal';
import { Timestamp } from './Timestamp';
import { apiGet } from '../api/client';

interface ThreadMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  threadId: string;
  onOpenThread?: (threadId: string) => void;
}

interface ChainThread {
  id: string;
  title: string;
  lastUpdated: string;
  workspace?: string;
  comment?: string;
}

interface ThreadChain {
  ancestors: ChainThread[];
  current: ChainThread | null;
  descendants: ChainThread[];
}

export function ThreadMapModal({ isOpen, onClose, threadId, onOpenThread }: ThreadMapModalProps) {
  const [chain, setChain] = useState<ThreadChain | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchChain = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setChain(null);
    setError(null);
    try {
      const result = await apiGet<ThreadChain>(
        `/api/thread-chain?threadId=${encodeURIComponent(threadId)}`,
        controller.signal,
      );
      setChain(result);
    } catch (err: unknown) {
      if ((err as Error).name !== 'AbortError') {
        setError((err as Error).message);
      }
    } finally {
      setLoading(false);
    }
  }, [threadId]);

  useEffect(() => {
    if (!isOpen) return;
    void fetchChain();
    return () => abortRef.current?.abort();
  }, [isOpen, fetchChain]);

  const handleThreadClick = useCallback(
    (id: string) => {
      onOpenThread?.(id);
    },
    [onOpenThread],
  );

  const hasChain = chain && (chain.ancestors.length > 0 || chain.descendants.length > 0);

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Thread Map" className="thread-map-modal">
      <div className="thread-map-content">
        <div className="thread-map-header">
          <div className="thread-map-title">
            <GitBranch size={18} />
            <h2>Thread Map</h2>
          </div>
          <button className="thread-map-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {loading && <div className="thread-map-loading">Loading thread chain…</div>}

        {error && <div className="thread-map-error">{error}</div>}

        {chain && !hasChain && (
          <div className="thread-map-empty">This thread has no handoff chain.</div>
        )}

        {chain && hasChain && (
          <div className="thread-map-chain">
            {chain.ancestors.map((t, i) => (
              <div key={t.id} className="thread-map-item">
                <button
                  className="thread-map-card thread-map-card--ancestor"
                  onClick={() => handleThreadClick(t.id)}
                >
                  <span className="thread-map-card-label">↑ Ancestor</span>
                  <span className="thread-map-card-title">{t.title}</span>
                  <span className="thread-map-card-meta">
                    <Timestamp date={t.lastUpdated} />
                    {t.workspace && (
                      <span className="thread-map-workspace-badge">
                        {t.workspace.split('/').pop()}
                      </span>
                    )}
                  </span>
                </button>
                {t.comment && (
                  <div className="thread-map-handoff-label">
                    <span className="thread-map-handoff-text">"{t.comment}"</span>
                  </div>
                )}
                {(i < chain.ancestors.length - 1 || chain.current) && (
                  <div className="thread-map-connector">
                    <ChevronDown size={14} />
                  </div>
                )}
              </div>
            ))}

            {chain.current && (
              <div className="thread-map-item">
                <div className="thread-map-card thread-map-card--current">
                  <span className="thread-map-card-label">● Current</span>
                  <span className="thread-map-card-title">{chain.current.title}</span>
                  <span className="thread-map-card-meta">
                    <Timestamp date={chain.current.lastUpdated} />
                    {chain.current.workspace && (
                      <span className="thread-map-workspace-badge">
                        {chain.current.workspace.split('/').pop()}
                      </span>
                    )}
                  </span>
                </div>
                {chain.current.comment && chain.descendants.length > 0 && (
                  <div className="thread-map-handoff-label">
                    <span className="thread-map-handoff-text">"{chain.current.comment}"</span>
                  </div>
                )}
                {chain.descendants.length > 0 && (
                  <div className="thread-map-connector">
                    <ChevronDown size={14} />
                  </div>
                )}
              </div>
            )}

            {chain.descendants.map((t, i) => (
              <div key={t.id} className="thread-map-item">
                <button
                  className="thread-map-card thread-map-card--descendant"
                  onClick={() => handleThreadClick(t.id)}
                >
                  <span className="thread-map-card-label">↓ Descendant</span>
                  <span className="thread-map-card-title">{t.title}</span>
                  <span className="thread-map-card-meta">
                    <Timestamp date={t.lastUpdated} />
                    {t.workspace && (
                      <span className="thread-map-workspace-badge">
                        {t.workspace.split('/').pop()}
                      </span>
                    )}
                  </span>
                </button>
                {t.comment && i < chain.descendants.length - 1 && (
                  <div className="thread-map-handoff-label">
                    <span className="thread-map-handoff-text">"{t.comment}"</span>
                  </div>
                )}
                {i < chain.descendants.length - 1 && (
                  <div className="thread-map-connector">
                    <ChevronDown size={14} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </BaseModal>
  );
}
