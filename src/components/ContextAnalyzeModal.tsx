import { useState, useEffect, useCallback, useRef } from 'react';
import { X, BarChart3 } from 'lucide-react';
import { BaseModal } from './BaseModal';
import { apiGet } from '../api/client';

interface ContextAnalyzeModalProps {
  isOpen: boolean;
  onClose: () => void;
  threadId: string;
}

interface ContextAnalysis {
  threadId: string;
  model: string;
  totalTurns: number;
  totalCost: number;
  tokenBreakdown: {
    totalInput: number;
    totalOutput: number;
    totalCacheCreation: number;
    totalCacheRead: number;
    cacheHitRate: number;
  };
  context: {
    currentTokens: number;
    maxTokens: number;
    percent: number;
  };
  turns: {
    turn: number;
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
    contextTokens: number;
    maxContextTokens: number;
    contextPercent: number;
    cost: number;
  }[];
  tools: {
    name: string;
    count: number;
    estimatedCost: number;
  }[];
  costBreakdown: {
    tokenCost: number;
    toolCost: number;
  };
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatCost(n: number): string {
  return `$${n.toFixed(4)}`;
}

export function ContextAnalyzeModal({ isOpen, onClose, threadId }: ContextAnalyzeModalProps) {
  const [data, setData] = useState<ContextAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchAnalysis = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setData(null);
    setError(null);
    try {
      const result = await apiGet<ContextAnalysis>(
        `/api/context-analyze?threadId=${encodeURIComponent(threadId)}`,
        controller.signal,
      );
      setData(result);
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
    void fetchAnalysis();
    return () => abortRef.current?.abort();
  }, [isOpen, fetchAnalysis]);

  const sortedTools = data ? [...data.tools].sort((a, b) => b.count - a.count) : [];

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Context Analysis"
      className="context-analyze-modal"
    >
      <div className="context-analyze-content">
        <div className="context-analyze-header">
          <div className="context-analyze-title">
            <BarChart3 size={18} />
            <h2>Context Analysis</h2>
          </div>
          <button className="context-analyze-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {loading && <div className="context-analyze-loading">Analyzing thread…</div>}

        {error && <div className="context-analyze-error">{error}</div>}

        {data && (
          <div className="context-analyze-body">
            {/* Summary */}
            <section className="context-analyze-section">
              <h3 className="context-analyze-section-title">Summary</h3>
              <div className="context-analyze-stats-grid">
                <div className="context-analyze-stat">
                  <span className="context-analyze-stat-label">Model</span>
                  <span className="context-analyze-stat-value">{data.model}</span>
                </div>
                <div className="context-analyze-stat">
                  <span className="context-analyze-stat-label">Turns</span>
                  <span className="context-analyze-stat-value">{data.totalTurns}</span>
                </div>
                <div className="context-analyze-stat">
                  <span className="context-analyze-stat-label">Total Cost</span>
                  <span className="context-analyze-stat-value">{formatCost(data.totalCost)}</span>
                </div>
              </div>
              <div className="context-analyze-progress-wrapper">
                <span className="context-analyze-progress-label">
                  Context: {formatTokens(data.context.currentTokens)} /{' '}
                  {formatTokens(data.context.maxTokens)} ({data.context.percent.toFixed(1)}%)
                </span>
                <div className="context-analyze-progress-bar">
                  <div
                    className="context-analyze-progress-fill"
                    style={{ width: `${Math.min(data.context.percent, 100)}%` }}
                  />
                </div>
              </div>
            </section>

            {/* Token Breakdown */}
            <section className="context-analyze-section">
              <h3 className="context-analyze-section-title">Token Breakdown</h3>
              <table className="context-analyze-table">
                <tbody>
                  <tr>
                    <td className="context-analyze-table-label">Input</td>
                    <td className="context-analyze-table-value">
                      {formatTokens(data.tokenBreakdown.totalInput)}
                    </td>
                  </tr>
                  <tr>
                    <td className="context-analyze-table-label">Output</td>
                    <td className="context-analyze-table-value">
                      {formatTokens(data.tokenBreakdown.totalOutput)}
                    </td>
                  </tr>
                  <tr>
                    <td className="context-analyze-table-label">Cache Creation</td>
                    <td className="context-analyze-table-value">
                      {formatTokens(data.tokenBreakdown.totalCacheCreation)}
                    </td>
                  </tr>
                  <tr>
                    <td className="context-analyze-table-label">Cache Read</td>
                    <td className="context-analyze-table-value">
                      {formatTokens(data.tokenBreakdown.totalCacheRead)}
                    </td>
                  </tr>
                  <tr>
                    <td className="context-analyze-table-label">Cache Hit Rate</td>
                    <td className="context-analyze-table-value">
                      {(data.tokenBreakdown.cacheHitRate * 100).toFixed(1)}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </section>

            {/* Cost Breakdown */}
            <section className="context-analyze-section">
              <h3 className="context-analyze-section-title">Cost Breakdown</h3>
              <table className="context-analyze-table">
                <tbody>
                  <tr>
                    <td className="context-analyze-table-label">Token Cost</td>
                    <td className="context-analyze-table-value">
                      {formatCost(data.costBreakdown.tokenCost)}
                    </td>
                  </tr>
                  <tr>
                    <td className="context-analyze-table-label">Tool Cost</td>
                    <td className="context-analyze-table-value">
                      {formatCost(data.costBreakdown.toolCost)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </section>

            {/* Tool Usage */}
            {sortedTools.length > 0 && (
              <section className="context-analyze-section">
                <h3 className="context-analyze-section-title">Tool Usage</h3>
                <table className="context-analyze-table context-analyze-tool-table">
                  <thead>
                    <tr>
                      <th>Tool</th>
                      <th>Count</th>
                      <th>Est. Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTools.map((tool) => (
                      <tr key={tool.name}>
                        <td className="context-analyze-tool-name">{tool.name}</td>
                        <td className="context-analyze-table-value">{tool.count}</td>
                        <td className="context-analyze-table-value">
                          {formatCost(tool.estimatedCost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            {/* Context Growth */}
            {data.turns.length > 0 && (
              <section className="context-analyze-section">
                <h3 className="context-analyze-section-title">Context Growth</h3>
                <div className="context-analyze-growth">
                  {data.turns.map((turn) => (
                    <div key={turn.turn} className="context-analyze-growth-row">
                      <span className="context-analyze-growth-label">T{turn.turn}</span>
                      <div className="context-analyze-growth-bar-track">
                        <div
                          className="context-analyze-growth-bar-fill"
                          style={{ width: `${Math.min(turn.contextPercent, 100)}%` }}
                          title={`${turn.contextPercent.toFixed(1)}% — ${formatTokens(turn.contextTokens)} tokens — ${formatCost(turn.cost)}`}
                        />
                      </div>
                      <span className="context-analyze-growth-pct">
                        {turn.contextPercent.toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </BaseModal>
  );
}
