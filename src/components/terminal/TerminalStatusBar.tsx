import { CostInfoTip } from '../CostInfoTip';
import type { TerminalStatusBarProps } from './types';

export function TerminalStatusBar({ usage }: TerminalStatusBarProps) {
  return (
    <div className="terminal-status-bar">
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
