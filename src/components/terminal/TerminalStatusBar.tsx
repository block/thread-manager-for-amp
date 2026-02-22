import { GitBranch } from 'lucide-react';
import { CostInfoTip } from '../CostInfoTip';
import type { TerminalStatusBarProps } from './types';

export function TerminalStatusBar({ usage, gitInfo }: TerminalStatusBarProps) {
  const contextPct = usage.contextPercent >= 0 ? usage.contextPercent : null;

  return (
    <div className="terminal-status-bar">
      {gitInfo?.branch && (
        <div className="status-item" title={gitInfo.isWorktree ? 'Git worktree' : 'Git branch'}>
          <GitBranch size={12} />
          <span className="status-value">
            {gitInfo.branch}
            {gitInfo.isWorktree && <span className="status-badge worktree-badge">worktree</span>}
          </span>
        </div>
      )}
      <div className="status-item">
        <span className="status-label">Context</span>
        <span className={`status-value ${contextPct !== null && contextPct > 80 ? 'warning' : ''}`}>
          {contextPct !== null ? `${contextPct}%` : '—'}
        </span>
        <div className="context-bar">
          <div
            className={`context-fill ${contextPct !== null && contextPct > 80 ? 'warning' : ''}`}
            style={{ width: `${contextPct !== null ? Math.min(contextPct, 100) : 0}%` }}
          />
        </div>
      </div>
      <div className="status-item">
        <span className="status-label">
          Est. Cost <CostInfoTip />
        </span>
        <span className="status-value">~${usage.estimatedCost}</span>
      </div>
    </div>
  );
}
