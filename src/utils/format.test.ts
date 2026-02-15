import { describe, it, expect } from 'vitest';
import { shortenPath, formatToolUse, getToolIcon, getToolLabel } from './format';

describe('shortenPath', () => {
  it('replaces /Users/<username> with ~', () => {
    expect(shortenPath('/Users/alice/projects/app')).toBe('~/projects/app');
  });

  it('returns path unchanged when no /Users prefix', () => {
    expect(shortenPath('/tmp/file.txt')).toBe('/tmp/file.txt');
  });

  it('handles empty string', () => {
    expect(shortenPath('')).toBe('');
  });
});

describe('formatToolUse', () => {
  it('formats bash command with cwd', () => {
    const result = formatToolUse('bash', { cmd: 'ls -la', cwd: '/Users/bob/project' });
    expect(result).toBe('ls -la (in: ~/project)');
  });

  it('formats bash command without cwd', () => {
    const result = formatToolUse('Bash', { cmd: 'echo hello' });
    expect(result).toBe('echo hello');
  });

  it('formats bash with empty command', () => {
    const result = formatToolUse('bash', {});
    expect(result).toBe('(empty command)');
  });

  it('formats read tool', () => {
    const result = formatToolUse('Read', { path: '/Users/alice/src/index.ts' });
    expect(result).toBe('Read ~/src/index.ts');
  });

  it('formats grep tool', () => {
    const result = formatToolUse('grep', { pattern: 'TODO', path: '/Users/alice/src' });
    expect(result).toBe('Grep TODO in ~/src');
  });

  it('formats glob tool', () => {
    const result = formatToolUse('glob', { filePattern: '**/*.ts' });
    expect(result).toBe('glob **/*.ts');
  });

  it('formats finder tool', () => {
    const result = formatToolUse('finder', { query: 'authentication' });
    expect(result).toBe('finder: authentication');
  });

  it('formats edit_file tool', () => {
    const result = formatToolUse('edit_file', { path: '/Users/alice/src/app.ts' });
    expect(result).toBe('Edit ~/src/app.ts');
  });

  it('formats create_file tool', () => {
    const result = formatToolUse('create_file', { path: '/Users/alice/new.ts' });
    expect(result).toBe('Create ~/new.ts');
  });

  it('returns tool name for unknown tools', () => {
    const result = formatToolUse('custom_tool', {});
    expect(result).toBe('custom_tool');
  });
});

describe('getToolIcon', () => {
  it('returns $ for bash', () => {
    expect(getToolIcon('bash')).toBe('$');
    expect(getToolIcon('Bash')).toBe('$');
  });

  it('returns correct icons for known tools', () => {
    expect(getToolIcon('Read')).toBe('📄');
    expect(getToolIcon('Grep')).toBe('🔍');
    expect(getToolIcon('Task')).toBe('🔧');
    expect(getToolIcon('oracle')).toBe('🔮');
  });

  it('returns default icon for unknown tools', () => {
    expect(getToolIcon('unknown_tool')).toBe('🔧');
  });
});

describe('getToolLabel', () => {
  it('returns empty string for bash', () => {
    expect(getToolLabel('bash')).toBe('');
  });

  it('returns correct labels for known tools', () => {
    expect(getToolLabel('Read')).toBe('Read');
    expect(getToolLabel('edit_file')).toBe('Edit');
    expect(getToolLabel('Task')).toBe('Subagent');
  });

  it('returns tool name for unknown tools', () => {
    expect(getToolLabel('something')).toBe('something');
  });
});
