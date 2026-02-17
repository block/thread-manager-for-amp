import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { MarkdownContent } from './MarkdownContent';

interface ToolResultProps {
  content: string;
  success: boolean;
  onRef: (el: HTMLDivElement | null) => void;
}

const PREVIEW_CHARS = 800;

function looksLikeMarkdown(content: string): boolean {
  return /^#{1,6}\s|^\s*[-*]\s|\*\*|`{1,3}|^\d+\.\s/m.test(content);
}

function looksLikeJson(content: string): boolean {
  const trimmed = content.trim();
  return (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
         (trimmed.startsWith('[') && trimmed.endsWith(']'));
}

// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents -- explicit for readability
function tryParseJson(content: string): unknown | null {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function extractNestedResult(content: string): string {
  const parsed = tryParseJson(content);
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard for parsed JSON
  if (parsed && typeof parsed === 'object' && parsed !== null) {
    const obj = parsed as Record<string, unknown>;
    const runResult = obj.run as { result?: unknown } | undefined;
    if (runResult?.result !== undefined) {
      if (typeof runResult.result === 'string') {
        return runResult.result;
      }
      const output = (runResult.result as { output?: string }).output;
      if (output !== undefined) {
        return output;
      }
      return JSON.stringify(runResult.result, null, 2);
    }
  }
  return content;
}

interface DiffResult {
  diff: string;
  lineRange?: [number, number];
}

function isEditFileDiffResult(parsed: unknown): parsed is DiffResult {
  if (typeof parsed !== 'object' || parsed === null) return false;
  const obj = parsed as Record<string, unknown>;
  return typeof obj.diff === 'string' && obj.diff.includes('```diff');
}

function extractDiffContent(diffStr: string): string {
  const match = diffStr.match(/```diff\n([\s\S]*?)```/);
  return match ? match[1] : diffStr;
}

function renderDiff(diffContent: string): React.ReactNode {
  const lines = diffContent.split('\n');
  return (
    <div className="edit-diff">
      <div className="edit-diff-content">
        {lines.map((line, i) => {
          let lineClass = '';
          let marker = ' ';
          if (line.startsWith('+') && !line.startsWith('+++')) {
            lineClass = 'added';
            marker = '+';
          } else if (line.startsWith('-') && !line.startsWith('---')) {
            lineClass = 'removed';
            marker = '-';
          } else if (line.startsWith('@@')) {
            lineClass = 'hunk';
          }
          return (
            <div key={i} className={`diff-line ${lineClass}`}>
              <span className="diff-line-marker">{marker}</span>
              <span className="diff-line-content">{line.slice(lineClass === 'added' || lineClass === 'removed' ? 1 : 0) || ' '}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

let jsonKeyCounter = 0;
function getJsonKey(prefix: string): string {
  return `${prefix}-${++jsonKeyCounter}`;
}

function highlightJson(json: unknown, indent = 0): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const spaces = '  '.repeat(indent);
  
  if (json === null) {
    nodes.push(<span key={getJsonKey('null')} className="json-null">null</span>);
  } else if (typeof json === 'boolean') {
    nodes.push(<span key={getJsonKey('bool')} className="json-boolean">{json.toString()}</span>);
  } else if (typeof json === 'number') {
    nodes.push(<span key={getJsonKey('num')} className="json-number">{json}</span>);
  } else if (typeof json === 'string') {
    const escaped = json.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    nodes.push(<span key={getJsonKey('str')} className="json-string">"{escaped}"</span>);
  } else if (Array.isArray(json)) {
    if (json.length === 0) {
      nodes.push(<span key={getJsonKey('empty-arr')} className="json-bracket">[]</span>);
    } else {
      nodes.push(<span key={getJsonKey('open-arr')} className="json-bracket">[</span>, '\n');
      json.forEach((item, i) => {
        nodes.push(spaces + '  ');
        nodes.push(...highlightJson(item, indent + 1));
        if (i < json.length - 1) nodes.push(<span key={getJsonKey('comma')} className="json-punctuation">,</span>);
        nodes.push('\n');
      });
      nodes.push(spaces, <span key={getJsonKey('close-arr')} className="json-bracket">]</span>);
    }
  } else if (typeof json === 'object') {
    const entries = Object.entries(json as Record<string, unknown>);
    if (entries.length === 0) {
      nodes.push(<span key={getJsonKey('empty-obj')} className="json-bracket">{'{}'}</span>);
    } else {
      nodes.push(<span key={getJsonKey('open-obj')} className="json-bracket">{'{'}</span>, '\n');
      entries.forEach(([key, value], i) => {
        nodes.push(spaces + '  ');
        nodes.push(<span key={getJsonKey(`key-${key}`)} className="json-key">"{key}"</span>);
        nodes.push(<span key={getJsonKey(`colon-${key}`)} className="json-punctuation">: </span>);
        nodes.push(...highlightJson(value, indent + 1));
        if (i < entries.length - 1) nodes.push(<span key={getJsonKey('comma')} className="json-punctuation">,</span>);
        nodes.push('\n');
      });
      nodes.push(spaces, <span key={getJsonKey('close-obj')} className="json-bracket">{'}'}</span>);
    }
  }
  return nodes;
}

export function ToolResult({ content, success, onRef }: ToolResultProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const extractedContent = useMemo(() => extractNestedResult(content), [content]);
  
  const isDiffOrJson = looksLikeJson(extractedContent);
  const needsExpansion = extractedContent.length > PREVIEW_CHARS || isDiffOrJson;
  
  const displayContent = isExpanded 
    ? extractedContent 
    : extractedContent.slice(0, PREVIEW_CHARS) + (needsExpansion ? '...' : '');

  const contentType = useMemo(() => {
    if (looksLikeJson(extractedContent)) {
      const parsed = tryParseJson(extractedContent);
      if (parsed !== null) {
        if (isEditFileDiffResult(parsed)) {
          return { type: 'diff' as const, parsed };
        }
        return { type: 'json' as const, parsed };
      }
    }
    if (looksLikeMarkdown(extractedContent)) return { type: 'markdown' as const };
    return { type: 'plain' as const };
  }, [extractedContent]);

  const renderedContent = useMemo(() => {
    if (contentType.type === 'diff') {
      const diffContent = extractDiffContent(contentType.parsed.diff);
      return renderDiff(diffContent);
    }
    if (contentType.type === 'json') {
      return <pre className="json-highlighted">{highlightJson(contentType.parsed)}</pre>;
    }
    return null;
  }, [contentType]);

  if (!extractedContent.trim()) {
    return null;
  }

  return (
    <div 
      ref={onRef}
      className={`tool-result ${success ? 'success' : 'error'} ${isExpanded ? 'expanded' : 'collapsed'} ${contentType.type === 'markdown' ? 'markdown' : ''}`}
    >
      <div className="tool-result-content">
        {contentType.type === 'diff' || contentType.type === 'json' ? (
          renderedContent
        ) : contentType.type === 'markdown' ? (
          <MarkdownContent content={displayContent} />
        ) : (
          <pre>{displayContent}</pre>
        )}
      </div>
      {needsExpansion && (
        <button 
          className="tool-result-toggle"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? (
            <>
              <ChevronDown size={14} />
              <span>Collapse</span>
            </>
          ) : (
            <>
              <ChevronRight size={14} />
              <span>Expand</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
