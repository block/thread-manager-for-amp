import { describe, it, expect } from 'vitest';
import { parseMarkdownHistory, type Message } from './parseMarkdown';

const ID_PATTERN = /^msg-\d+$/;

function at<T>(arr: T[], index: number): T {
  const item = arr[index];
  if (item === undefined) throw new Error(`Expected item at index ${index}`);
  return item;
}

function expectMessage(msg: Message, expected: Partial<Message>) {
  expect(msg.id).toMatch(ID_PATTERN);
  if (expected.type) expect(msg.type).toBe(expected.type);
  if (expected.content) expect(msg.content).toBe(expected.content);
  if (expected.toolName) expect(msg.toolName).toBe(expected.toolName);
  if (expected.success !== undefined) expect(msg.success).toBe(expected.success);
  if (expected.timestamp) expect(msg.timestamp).toBe(expected.timestamp);
}

describe('parseMarkdownHistory', () => {
  it('returns empty array for empty string', () => {
    expect(parseMarkdownHistory('')).toEqual([]);
  });

  it('returns empty array for whitespace-only input', () => {
    expect(parseMarkdownHistory('   \n\n  ')).toEqual([]);
  });

  it('returns empty array for frontmatter-only input', () => {
    const md = `---
title: Test
---`;
    expect(parseMarkdownHistory(md)).toEqual([]);
  });

  it('parses a single user message', () => {
    const md = `# Thread Title

## User

Hello, world!`;
    const messages = parseMarkdownHistory(md);
    expect(messages).toHaveLength(1);
    expectMessage(at(messages, 0), { type: 'user', content: 'Hello, world!' });
  });

  it('parses a single assistant message', () => {
    const md = `# Thread Title

## Assistant

Here is my response.`;
    const messages = parseMarkdownHistory(md);
    expect(messages).toHaveLength(1);
    expectMessage(at(messages, 0), { type: 'assistant', content: 'Here is my response.' });
  });

  it('parses user → assistant conversation', () => {
    const md = `# Thread Title

## User

What is 2+2?

## Assistant

The answer is 4.`;
    const messages = parseMarkdownHistory(md);
    expect(messages).toHaveLength(2);
    expectMessage(at(messages, 0), { type: 'user', content: 'What is 2+2?' });
    expectMessage(at(messages, 1), { type: 'assistant', content: 'The answer is 4.' });
  });

  it('strips YAML frontmatter', () => {
    const md = `---
title: My Thread
model: claude-3.5-sonnet
---

# Thread Title

## User

Hello`;
    const messages = parseMarkdownHistory(md);
    expect(messages).toHaveLength(1);
    expectMessage(at(messages, 0), { type: 'user', content: 'Hello' });
  });

  it('parses assistant tool_use blocks', () => {
    const md = `# Thread

## Assistant

Let me check the file.

**Tool Use:** \`Read\`
\`\`\`json
{"path": "/Users/alice/src/index.ts"}
\`\`\`

Done reading.`;
    const messages = parseMarkdownHistory(md);
    expect(messages).toHaveLength(3);
    expectMessage(at(messages, 0), { type: 'assistant', content: 'Let me check the file.' });
    expectMessage(at(messages, 1), { type: 'tool_use', toolName: 'Read' });
    expect(at(messages, 1).content).toContain('Read');
    expectMessage(at(messages, 2), { type: 'assistant', content: 'Done reading.' });
  });

  it('parses tool_use with invalid JSON gracefully', () => {
    const md = `# Thread

## Assistant

**Tool Use:** \`Bash\`
\`\`\`json
{not valid json}
\`\`\``;
    const messages = parseMarkdownHistory(md);
    expect(messages).toHaveLength(1);
    expectMessage(at(messages, 0), { type: 'tool_use', toolName: 'Bash' });
    // Should still produce a message even with invalid JSON
    expect(at(messages, 0).toolInput).toEqual({});
  });

  it('parses user tool_result blocks', () => {
    const md = `# Thread

## User

**Tool Result:** \`Read\`
\`\`\`
file content here
\`\`\``;
    const messages = parseMarkdownHistory(md);
    expect(messages).toHaveLength(1);
    expectMessage(at(messages, 0), { type: 'tool_result', success: true, content: 'file content here' });
  });

  it('skips empty tool results', () => {
    const md = `# Thread

## User

**Tool Result:** \`Bash\`
\`\`\`
(no output)
\`\`\``;
    const messages = parseMarkdownHistory(md);
    expect(messages).toHaveLength(0);
  });

  it('skips undefined tool results', () => {
    const md = `# Thread

## User

**Tool Result:** \`Bash\`
\`\`\`
undefined
\`\`\``;
    const messages = parseMarkdownHistory(md);
    expect(messages).toHaveLength(0);
  });

  it('parses timestamps from section headers', () => {
    const md = `# Thread

## User <!-- timestamp:2025-01-15T10:30:00Z -->

Hello with timestamp`;
    const messages = parseMarkdownHistory(md);
    expect(messages).toHaveLength(1);
    expectMessage(at(messages, 0), { type: 'user', timestamp: '2025-01-15T10:30:00Z' });
  });

  it('strips thinking JSON blocks from assistant messages', () => {
    const md = `# Thread

## Assistant

{"type":"thinking","content":"Let me think...","provider":"anthropic"}

Here is my actual response.`;
    const messages = parseMarkdownHistory(md);
    expect(messages).toHaveLength(1);
    expectMessage(at(messages, 0), { type: 'assistant', content: 'Here is my actual response.' });
  });

  it('handles multiple tool uses in one assistant section', () => {
    const md = `# Thread

## Assistant

First I'll read, then edit.

**Tool Use:** \`Read\`
\`\`\`json
{"path": "/tmp/a.ts"}
\`\`\`

**Tool Use:** \`edit_file\`
\`\`\`json
{"path": "/tmp/a.ts", "old_str": "a", "new_str": "b"}
\`\`\`

All done.`;
    const messages = parseMarkdownHistory(md);
    expect(messages).toHaveLength(4);
    expectMessage(at(messages, 0), { type: 'assistant' });
    expectMessage(at(messages, 1), { type: 'tool_use', toolName: 'Read' });
    expectMessage(at(messages, 2), { type: 'tool_use', toolName: 'edit_file' });
    expectMessage(at(messages, 3), { type: 'assistant', content: 'All done.' });
  });

  it('handles multi-turn conversation', () => {
    const md = `# Thread

## User

Question 1

## Assistant

Answer 1

## User

Question 2

## Assistant

Answer 2`;
    const messages = parseMarkdownHistory(md);
    expect(messages).toHaveLength(4);
    expectMessage(at(messages, 0), { type: 'user', content: 'Question 1' });
    expectMessage(at(messages, 1), { type: 'assistant', content: 'Answer 1' });
    expectMessage(at(messages, 2), { type: 'user', content: 'Question 2' });
    expectMessage(at(messages, 3), { type: 'assistant', content: 'Answer 2' });
  });

  it('unescapes triple backticks in tool use JSON', () => {
    const md = `# Thread

## Assistant

**Tool Use:** \`create_file\`
\`\`\`json
{"path": "/tmp/test.md", "content": "\\\`\\\`\\\`js\\ncode\\n\\\`\\\`\\\`"}
\`\`\``;
    const messages = parseMarkdownHistory(md);
    expect(messages).toHaveLength(1);
    expect(at(messages, 0).toolInput?.content).toContain('```');
  });

  it('handles section with no content after header', () => {
    const md = `# Thread

## User

Hello

## Assistant

## User

Follow-up`;
    const messages = parseMarkdownHistory(md);
    // Empty assistant section is skipped
    expect(messages).toHaveLength(2);
    expectMessage(at(messages, 0), { type: 'user', content: 'Hello' });
    expectMessage(at(messages, 1), { type: 'user', content: 'Follow-up' });
  });
});
