import { useCallback, useState } from 'react';
import { GitBranch } from 'lucide-react';
import { CostInfoTip } from '../CostInfoTip';
import type { TerminalStatusBarProps } from './types';

export function TerminalStatusBar({ usage, gitInfo }: TerminalStatusBarProps) {
  const contextPct = usage.contextPercent >= 0 ? usage.contextPercent : null;
  const [copied, setCopied] = useState(false);

  const copyWorktreePath = useCallback(() => {
    if (!gitInfo?.worktreePath) return;
    void navigator.clipboard
      .writeText(gitInfo.worktreePath)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  }, [gitInfo]);

  return (
    <div className="terminal-status-bar">
      {gitInfo?.branch && (
        <div
          className={`status-item ${gitInfo.isWorktree && gitInfo.worktreePath ? 'clickable' : ''}`}
          title={
            gitInfo.isWorktree && gitInfo.worktreePath
              ? `Click to copy: ${gitInfo.worktreePath}`
              : 'Git branch'
          }
          onClick={gitInfo.isWorktree ? copyWorktreePath : undefined}
        >
          <GitBranch size={12} />
          <span className="status-value">
            {gitInfo.branch}
            {gitInfo.isWorktree && (
              <span className="status-badge worktree-badge">{copied ? 'copied!' : 'worktree'}</span>
            )}
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
