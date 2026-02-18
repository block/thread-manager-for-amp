import { useState, memo, lazy, Suspense } from 'react';
import { ChevronDown, ChevronRight, Check, Loader2, XCircle, Ban } from 'lucide-react';
import { getToolIcon, getToolLabel, shortenPath, type ToolInput } from '../utils/format';

const MermaidDiagram = lazy(() =>
  import('./MermaidDiagram').then((m) => ({ default: m.MermaidDiagram })),
);

export type ToolStatus = 'running' | 'success' | 'error' | 'cancelled' | undefined;

interface ToolBlockProps {
  toolName: string;
  toolInput?: ToolInput;
  onRef?: (el: HTMLDivElement | null) => void;
  highlighted?: boolean;
  status?: ToolStatus;
  result?: string;
}

const MAX_CMD_LENGTH = 80;
const MAX_DESC_LENGTH = 60;

function formatShortCommand(
  name: string,
  input: ToolInput,
): { text: string; cwd?: string } | string {
  const lowerName = name.toLowerCase();
  switch (lowerName) {
    case 'bash': {
      const cmd = input.cmd || '';
      const firstLine = (cmd.split('\n')[0] ?? '').trim();
      if (!firstLine) {
        return { text: '(empty command)', cwd: input.cwd ? shortenPath(input.cwd) : undefined };
      }
      const shortened =
        firstLine.length > MAX_CMD_LENGTH ? firstLine.slice(0, MAX_CMD_LENGTH) + '...' : firstLine;
      if (input.cwd) {
        return { text: shortened, cwd: shortenPath(input.cwd) };
      }
      return shortened;
    }
    case 'read':
      return shortenPath(input.path || '');
    case 'grep':
      return `"${input.pattern}" in ${shortenPath(input.path || '')}`;
    case 'glob':
      return input.filePattern || '';
    case 'finder':
      return `"${(input.query || '').slice(0, 50)}${(input.query || '').length > 50 ? '...' : ''}"`;
    case 'edit_file':
      return shortenPath(input.path || '');
    case 'create_file':
      return shortenPath(input.path || '');
    case 'skill':
      return input.name || '';
    case 'look_at':
      return shortenPath(input.path || '');
    case 'task': {
      const desc = input.description || '';
      return desc.length > MAX_DESC_LENGTH
        ? desc.slice(0, MAX_DESC_LENGTH) + '...'
        : desc || 'Subagent task';
    }
    default:
      return name;
  }
}

function formatFullCommand(name: string, input: ToolInput): string | null {
  const lowerName = name.toLowerCase();
  switch (lowerName) {
    case 'bash': {
      const cwd = input.cwd ? `\n# cwd: ${shortenPath(input.cwd)}` : '';
      return `${input.cmd || ''}${cwd}`;
    }
    case 'read':
      // Read doesn't need expanded content - the path is already shown
      return null;
    case 'edit_file': {
      if (input.old_str && input.new_str) {
        return `--- old\n${input.old_str}\n+++ new\n${input.new_str}`;
      }
      return null;
    }
    case 'create_file':
      return input.content
        ? input.content.slice(0, 500) + (input.content.length > 500 ? '\n...' : '')
        : null;
    case 'finder':
      return input.query || null;
    case 'oracle':
      return input.task
        ? `Task: ${input.task}${input.context ? `\n\nContext: ${input.context}` : ''}${
            input.files ? `\n\nFiles: ${JSON.stringify(input.files)}` : ''
          }`
        : null;
    case 'librarian':
      return input.query
        ? `Query: ${input.query}${input.context ? `\n\nContext: ${input.context}` : ''}`
        : null;
    case 'task':
      return input.prompt
        ? input.prompt.slice(0, 800) + (input.prompt.length > 800 ? '...' : '')
        : null;
    case 'web_search':
    case 'read_web_page':
      return input.objective || input.url || null;
    case 'mermaid':
      return input.code || null;
    case 'glob':
    case 'grep':
    case 'skill':
    case 'look_at':
      // These tools don't need expanded content
      return null;
    default:
      // For unknown tools, show all input as JSON if it has content
      if (Object.keys(input).length > 0) {
        const json = JSON.stringify(input, null, 2);
        return json.length > 20 ? json.slice(0, 500) + (json.length > 500 ? '\n...' : '') : null;
      }
      return null;
  }
}

function renderEditFileDiff(oldStr: string, newStr: string) {
  const oldLines = oldStr.split('\n');
  const newLines = newStr.split('\n');

  const addedCount = newLines.length;
  const removedCount = oldLines.length;
  const changedCount = Math.min(addedCount, removedCount);

  return (
    <div className="edit-diff">
      <div className="edit-diff-header">
        <span className="diff-stat added">
          +{addedCount - changedCount + (changedCount > 0 ? changedCount : 0)}
        </span>
        <span className="diff-stat removed">~{changedCount}</span>
        <span className="diff-stat changed">
          -{removedCount - changedCount + (changedCount > 0 ? 0 : 0)}
        </span>
      </div>
      <div className="edit-diff-content">
        {oldLines.map((line, i) => (
          <div key={`old-${i}`} className="diff-line removed">
            <span className="diff-line-num">{i + 1}</span>
            <span className="diff-line-marker">-</span>
            <span className="diff-line-content">{line || ' '}</span>
          </div>
        ))}
        {newLines.map((line, i) => (
          <div key={`new-${i}`} className="diff-line added">
            <span className="diff-line-num">{i + 1}</span>
            <span className="diff-line-marker">+</span>
            <span className="diff-line-content">{line || ' '}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: ToolStatus }) {
  switch (status) {
    case 'running':
      return <Loader2 size={14} className="spinning" />;
    case 'success':
      return <Check size={14} />;
    case 'error':
      return <XCircle size={14} />;
    case 'cancelled':
      return <Ban size={14} />;
    default:
      return <Check size={14} />;
  }
}

function getStatusClass(status: ToolStatus): string {
  switch (status) {
    case 'running':
      return 'status-running';
    case 'success':
      return 'status-success';
    case 'error':
      return 'status-error';
    case 'cancelled':
      return 'status-cancelled';
    default:
      return 'status-success';
  }
}

export const ToolBlock = memo(function ToolBlock({
  toolName,
  toolInput = {},
  onRef,
  highlighted,
  status,
  result,
}: ToolBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const shortCmdResult = formatShortCommand(toolName, toolInput);
  const shortCmd = typeof shortCmdResult === 'string' ? shortCmdResult : shortCmdResult.text;
  const shortCwd = typeof shortCmdResult === 'object' ? shortCmdResult.cwd : undefined;
  const fullCmd = formatFullCommand(toolName, toolInput);
  const isEditFile = toolName === 'edit_file' && toolInput.old_str && toolInput.new_str;
  const isMermaid = toolName === 'mermaid' && !!toolInput.code;
  const isSubagent = toolName === 'Task';

  // Only show expand if full command exists and is longer than short version
  const hasExpandable = !!(fullCmd && fullCmd.length > shortCmd.length + 10) || isEditFile;

  const icon = getToolIcon(toolName);
  const label = getToolLabel(toolName);

  // Subagent-style display
  if (isSubagent) {
    const statusClass = getStatusClass(status);
    return (
      <div
        ref={onRef}
        className={`tool-block subagent ${statusClass} ${highlighted ? 'highlighted' : ''}`}
      >
        <div
          className={`tool-block-header ${hasExpandable ? 'expandable' : ''}`}
          onClick={() => hasExpandable && setIsExpanded(!isExpanded)}
        >
          <span className={`subagent-status ${statusClass}`}>
            <StatusIcon status={status} />
          </span>
          <span className="subagent-label">Subagent</span>
          {hasExpandable && (
            <button className="tool-expand-btn" type="button">
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          )}
        </div>
        <div className="subagent-description">{shortCmd}</div>
        {result && <div className="subagent-result">{result}</div>}
        {isExpanded && fullCmd && (
          <div className="tool-block-full subagent-prompt">
            <pre>{fullCmd}</pre>
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={onRef} className={`tool-block ${highlighted ? 'highlighted' : ''}`}>
      <div
        className={`tool-block-header ${hasExpandable ? 'expandable' : ''}`}
        onClick={() => hasExpandable && setIsExpanded(!isExpanded)}
      >
        <span className="tool-icon">{icon}</span>
        {label && <span className="tool-label">{label}</span>}
        <span className="tool-command">{shortCmd}</span>
        {shortCwd && <span className="tool-cwd">(in: {shortCwd})</span>}
        {hasExpandable && (
          <button className="tool-expand-btn" type="button">
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        )}
      </div>
      {isMermaid && (
        <div className="tool-block-full mermaid-container">
          <Suspense fallback={<div className="mermaid-loading">Loading diagram…</div>}>
            <MermaidDiagram code={toolInput.code as string} />
          </Suspense>
        </div>
      )}
      {isExpanded &&
        isEditFile &&
        renderEditFileDiff(toolInput.old_str ?? '', toolInput.new_str ?? '')}
      {isExpanded && fullCmd && !isEditFile && !isMermaid && (
        <div className="tool-block-full">
          <pre>{fullCmd}</pre>
        </div>
      )}
    </div>
  );
});
