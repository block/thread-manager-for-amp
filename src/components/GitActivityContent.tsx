import { useState } from 'react';
import {
  GitCommit as GitCommitIcon,
  GitBranch,
  GitPullRequest,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ExternalLink,
  Clock,
  CheckCircle,
  Circle,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import type { ThreadGitActivity, GitCommit } from '../types';

interface GitActivityContentProps {
  activity: ThreadGitActivity;
}

function formatTime(ts: number): string {
  const date = new Date(ts);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTimeRange(startMs: number, endMs: number): string {
  const start = new Date(startMs);
  const end = new Date(endMs);

  const sameDay = start.toDateString() === end.toDateString();

  if (sameDay) {
    return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${start.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} – ${end.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
  }

  return `${formatTime(startMs)} – ${formatTime(endMs)}`;
}

function PRStateIcon({ state }: { state: string }) {
  switch (state.toLowerCase()) {
    case 'merged':
      return <GitPullRequest size={14} className="pr-icon merged" />;
    case 'closed':
      return <XCircle size={14} className="pr-icon closed" />;
    case 'open':
      return <Circle size={14} className="pr-icon open" />;
    default:
      return <AlertCircle size={14} className="pr-icon" />;
  }
}

export function GitActivityContent({ activity }: GitActivityContentProps) {
  const [expandedCommits, setExpandedCommits] = useState(true);
  const [expandedBranches, setExpandedBranches] = useState(false);
  const [expandedPRs, setExpandedPRs] = useState(true);

  if (activity.error || activity.workspaces.length === 0) {
    return <div className="discovery-empty">No git activity found</div>;
  }

  const workspace = activity.workspaces[0];
  if (!workspace) return null;

  if (workspace.error) {
    return <div className="discovery-empty">Error loading git data</div>;
  }

  const highConfidenceCommits = workspace.commits.filter((c) => c.confidence === 'high');
  const totalCommits = workspace.commits.length;
  const hasPRs = workspace.prs.length > 0;
  const hasBranches = workspace.branches.length > 0;

  return (
    <div className="discovery-git">
      {/* Time window */}
      <div className="git-time-window">
        <Clock size={12} />
        <span>
          Activity window: {formatTimeRange(workspace.windowStartMs, workspace.windowEndMs)}
        </span>
      </div>

      {/* Current branch */}
      {workspace.currentBranch && (
        <div className="git-current-branch">
          <GitBranch size={12} />
          <span>
            Current: <code>{workspace.currentBranch}</code>
          </span>
        </div>
      )}

      {/* PRs Section */}
      {hasPRs && (
        <div className="git-section">
          <button className="git-section-toggle" onClick={() => setExpandedPRs(!expandedPRs)}>
            <GitPullRequest size={14} />
            <span>Pull Requests ({workspace.prs.length})</span>
            {expandedPRs ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {expandedPRs && (
            <div className="git-pr-list">
              {workspace.prs.map((pr) => (
                <a
                  key={pr.number}
                  href={pr.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="git-pr-item"
                >
                  <PRStateIcon state={pr.state} />
                  <span className="pr-number">#{pr.number}</span>
                  <span className="pr-title">{pr.title}</span>
                  <span className={`pr-state ${pr.state.toLowerCase()}`}>{pr.state}</span>
                  <ExternalLink size={12} className="pr-external" />
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Branches Section */}
      {hasBranches && (
        <div className="git-section">
          <button
            className="git-section-toggle"
            onClick={() => setExpandedBranches(!expandedBranches)}
          >
            <GitBranch size={14} />
            <span>Likely branches ({workspace.branches.length})</span>
            {expandedBranches ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {expandedBranches && (
            <div className="git-branch-list">
              {workspace.branches.map((branch) => (
                <div key={branch.name} className="git-branch-item">
                  <GitBranch size={12} />
                  <code>{branch.name}</code>
                  <span className="branch-type">{branch.type}</span>
                  <span className="branch-hits">{branch.hitCount} commits</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Commits Section */}
      {totalCommits > 0 && (
        <div className="git-section">
          <button
            className="git-section-toggle"
            onClick={() => setExpandedCommits(!expandedCommits)}
          >
            <GitCommitIcon size={14} />
            <span>
              Commits ({highConfidenceCommits.length} matched, {totalCommits} total)
            </span>
            {expandedCommits ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {expandedCommits && (
            <div className="git-commit-list">
              {workspace.commits.slice(0, 20).map((commit) => (
                <CommitItem key={commit.sha} commit={commit} repo={workspace.repo} />
              ))}
              {workspace.commits.length > 20 && (
                <div className="git-more-commits">
                  +{workspace.commits.length - 20} more commits
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CommitItem({ commit, repo }: { commit: GitCommit; repo?: string | null }) {
  const [expanded, setExpanded] = useState(false);

  const commitUrl = repo ? `https://github.com/${repo}/commit/${commit.sha}` : null;

  return (
    <div className={`git-commit-item ${commit.confidence}`}>
      <div className="commit-header">
        {commit.confidence === 'high' ? (
          <CheckCircle size={12} className="confidence-icon high" />
        ) : (
          <Circle size={12} className="confidence-icon low" />
        )}

        {commitUrl ? (
          <a href={commitUrl} target="_blank" rel="noopener noreferrer" className="commit-sha">
            {commit.shortSha}
          </a>
        ) : (
          <code className="commit-sha">{commit.shortSha}</code>
        )}

        <span className="commit-subject">{commit.subject}</span>

        {commit.matchedFileCount > 0 && (
          <button className="commit-files-toggle" onClick={() => setExpanded(!expanded)}>
            {commit.matchedFileCount} matched
            {expanded ? <ChevronUp size={10} /> : <ChevronRight size={10} />}
          </button>
        )}
      </div>

      <div className="commit-meta">
        <span className="commit-author">{commit.authorName}</span>
        <span className="commit-time">{formatTime(commit.commitTime)}</span>
      </div>

      {expanded && commit.matchedFiles.length > 0 && (
        <div className="commit-files">
          {commit.matchedFiles.map((file) => (
            <div key={file} className="commit-file">
              {file}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
