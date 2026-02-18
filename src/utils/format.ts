import type { ToolInput } from '../../shared/websocket.js';
export type { ToolInput };

export function shortenPath(path: string): string {
  return path.replace(/^\/Users\/[^/]+/, '~');
}

export function formatToolUse(name: string, input: ToolInput): string {
  const lowerName = name.toLowerCase();
  switch (lowerName) {
    case 'bash': {
      const cmd = input.cmd || '(empty command)';
      const cwd = input.cwd ? ` (in: ${shortenPath(input.cwd)})` : '';
      return `${cmd}${cwd}`;
    }
    case 'read':
      return `Read ${shortenPath(input.path || '')}`;
    case 'grep': {
      const grepPath = shortenPath(input.path || '');
      return `Grep ${input.pattern || ''} in ${grepPath}`;
    }
    case 'glob':
      return `glob ${input.filePattern || ''}`;
    case 'finder':
      return `finder: ${input.query || ''}`;
    case 'edit_file':
      return `Edit ${shortenPath(input.path || '')}`;
    case 'create_file':
      return `Create ${shortenPath(input.path || '')}`;
    default:
      return name;
  }
}

function normalizeToolName(name: string): string {
  const lower = name.toLowerCase();
  switch (lower) {
    case 'bash':
      return 'Bash';
    case 'read':
      return 'Read';
    case 'grep':
      return 'Grep';
    case 'task':
      return 'Task';
    case 'oracle':
      return 'oracle';
    case 'librarian':
      return 'librarian';
    default:
      return name;
  }
}

export function getToolIcon(name: string): string {
  const normalized = normalizeToolName(name);
  switch (normalized) {
    case 'Bash':
      return '$';
    case 'Read':
      return '📄';
    case 'Grep':
      return '🔍';
    case 'edit_file':
      return '✏️';
    case 'create_file':
      return '📝';
    case 'glob':
      return '📁';
    case 'finder':
      return '🔎';
    case 'Task':
      return '🔧';
    case 'oracle':
      return '🔮';
    case 'librarian':
      return '📚';
    case 'skill':
      return '⚡';
    case 'web_search':
      return '🌐';
    case 'read_web_page':
      return '🌐';
    case 'mermaid':
      return '📊';
    case 'look_at':
      return '👁️';
    default:
      return '🔧';
  }
}

export function getToolLabel(name: string): string {
  const normalized = normalizeToolName(name);
  switch (normalized) {
    case 'Bash':
      return '';
    case 'Read':
      return 'Read';
    case 'Grep':
      return 'Grep';
    case 'edit_file':
      return 'Edit';
    case 'create_file':
      return 'Create';
    case 'glob':
      return 'glob';
    case 'finder':
      return 'finder';
    case 'Task':
      return 'Subagent';
    case 'oracle':
      return 'Oracle';
    case 'librarian':
      return 'Librarian';
    case 'skill':
      return 'skill';
    case 'web_search':
      return 'Search';
    case 'read_web_page':
      return 'Web';
    case 'mermaid':
      return 'Diagram';
    case 'look_at':
      return 'Look at';
    default:
      return name;
  }
}
