import { GitBranch } from 'lucide-react';
import { CostInfoTip } from '../CostInfoTip';
import type { TerminalStatusBarProps } from './types';

export function TerminalStatusBar({ usage, gitInfo }: TerminalStatusBarProps) {
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
        <span className={`status-value ${usage.contextPercent > 80 ? 'warning' : ''}`}>
          {usage.contextPercent}%
        </span>
        <div className="context-bar">
          <div
            className={`context-fill ${usage.contextPercent > 80 ? 'warning' : ''}`}
            style={{ width: `${Math.min(usage.contextPercent, 100)}%` }}
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
