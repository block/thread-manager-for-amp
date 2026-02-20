import { describe, it, expect, beforeEach } from 'vitest';
import { parseReplayMessages, resetReplayIdCounter } from './parseReplayMessages';

beforeEach(() => {
  resetReplayIdCounter();
});

describe('parseReplayMessages', () => {
  it('converts a simple user message', () => {
    const messages = parseReplayMessages([{ role: 'user', content: 'Hello world' }]);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual({
      id: 'replay-1',
      type: 'user',
      content: 'Hello world',
      timestamp: undefined,
    });
  });

  it('converts assistant text blocks', () => {
    const messages = parseReplayMessages([
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'Here is my response' }],
      },
    ]);
    expect(messages).toHaveLength(1);
    expect(messages[0]?.type).toBe('assistant');
    expect(messages[0]?.content).toBe('Here is my response');
  });

  it('converts tool_use blocks', () => {
    const messages = parseReplayMessages([
      {
        role: 'assistant',
        content: [{ type: 'tool_use', name: 'Read', input: { path: '/tmp/file.ts' } }],
      },
    ]);
    expect(messages).toHaveLength(1);
    expect(messages[0]?.type).toBe('tool_use');
    expect(messages[0]?.toolName).toBe('Read');
  });

  it('handles mixed content blocks', () => {
    const messages = parseReplayMessages([
      { role: 'user', content: 'Fix the bug' },
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'I will read the file' },
          { type: 'tool_use', name: 'Read', input: { path: '/tmp/file.ts' } },
        ],
      },
    ]);
    expect(messages).toHaveLength(3);
    expect(messages[0]?.type).toBe('user');
    expect(messages[1]?.type).toBe('assistant');
    expect(messages[2]?.type).toBe('tool_use');
  });

  it('extracts timestamps from meta', () => {
    const messages = parseReplayMessages([
      { role: 'user', content: 'Hello', meta: { sentAt: 1700000000000 } },
    ]);
    expect(messages[0]?.timestamp).toBeDefined();
  });

  it('handles string assistant content', () => {
    const messages = parseReplayMessages([{ role: 'assistant', content: 'Simple response' }]);
    expect(messages).toHaveLength(1);
    expect(messages[0]?.content).toBe('Simple response');
  });

  it('returns empty array for empty input', () => {
    expect(parseReplayMessages([])).toEqual([]);
  });

  it('handles content array with text extraction for user messages', () => {
    const messages = parseReplayMessages([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Part one' },
          { type: 'text', text: 'Part two' },
        ],
      },
    ]);
    expect(messages).toHaveLength(1);
    expect(messages[0]?.content).toBe('Part one\nPart two');
  });

  it('skips system messages', () => {
    const messages = parseReplayMessages([
      { role: 'system', content: 'System prompt' },
      { role: 'user', content: 'Hello' },
    ]);
    expect(messages).toHaveLength(1);
    expect(messages[0]?.type).toBe('user');
  });
});
