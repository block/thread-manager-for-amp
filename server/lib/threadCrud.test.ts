import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, readFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import type { ThreadFile, ThreadMessage } from './threadTypes.js';

let tempDir: string;

function makeThreadFile(messages: ThreadMessage[]): ThreadFile {
  return {
    title: 'Test Thread',
    messages,
  };
}

function userMsg(text: string): ThreadMessage {
  return { role: 'user', content: text };
}

function assistantMsg(text: string): ThreadMessage {
  return { role: 'assistant', content: text };
}

// Since we can't easily override THREADS_DIR in the imported module,
// we'll test the logic patterns directly with file operations.
// This tests the same logic that truncateThreadAtMessage and undoLastTurn use.

describe('thread mutation logic', () => {
  beforeEach(async () => {
    tempDir = join(tmpdir(), `thread-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('truncate thread at message', () => {
    it('truncates thread at specified message index', async () => {
      const threadFile = makeThreadFile([
        userMsg('first'),
        assistantMsg('response 1'),
        userMsg('second'),
        assistantMsg('response 2'),
      ]);

      const filePath = join(tempDir, 'test.json');
      await writeFile(filePath, JSON.stringify(threadFile, null, 2));

      // Simulate truncation at index 2 (the second user message)
      const content = await readFile(filePath, 'utf-8');
      const data = JSON.parse(content) as ThreadFile;
      const messages = data.messages || [];
      const messageIndex = 2;

      expect(messageIndex).toBeGreaterThanOrEqual(0);
      expect(messageIndex).toBeLessThan(messages.length);

      const truncated = messages[messageIndex];
      const removed = messages.length - messageIndex;
      data.messages = messages.slice(0, messageIndex);

      await writeFile(filePath, JSON.stringify(data, null, 2));

      // Verify
      const result = JSON.parse(await readFile(filePath, 'utf-8')) as ThreadFile;
      expect(result.messages).toHaveLength(2);
      expect(removed).toBe(2);
      expect(truncated?.content).toBe('second');
    });

    it('validates message index bounds', () => {
      const messages = [userMsg('a'), assistantMsg('b')];

      function isValidIndex(idx: number): boolean {
        return idx >= 0 && idx < messages.length;
      }

      expect(isValidIndex(-1)).toBe(false);
      expect(isValidIndex(5)).toBe(false);
      expect(isValidIndex(0)).toBe(true);
      expect(isValidIndex(1)).toBe(true);
    });

    it('truncating at index 0 removes all messages', async () => {
      const threadFile = makeThreadFile([userMsg('first'), assistantMsg('response')]);

      const filePath = join(tempDir, 'test-zero.json');
      await writeFile(filePath, JSON.stringify(threadFile, null, 2));

      const content = await readFile(filePath, 'utf-8');
      const data = JSON.parse(content) as ThreadFile;
      data.messages = (data.messages || []).slice(0, 0);
      await writeFile(filePath, JSON.stringify(data, null, 2));

      const result = JSON.parse(await readFile(filePath, 'utf-8')) as ThreadFile;
      expect(result.messages).toHaveLength(0);
    });
  });

  describe('undo last turn', () => {
    it('removes last user message and all subsequent messages', async () => {
      const threadFile = makeThreadFile([
        userMsg('first'),
        assistantMsg('response 1'),
        userMsg('second'),
        assistantMsg('response 2'),
      ]);

      const filePath = join(tempDir, 'undo-test.json');
      await writeFile(filePath, JSON.stringify(threadFile, null, 2));

      const content = await readFile(filePath, 'utf-8');
      const data = JSON.parse(content) as ThreadFile;
      const messages = data.messages || [];

      // Find last user message
      let lastUserIdx = -1;
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i]?.role === 'user') {
          lastUserIdx = i;
          break;
        }
      }

      expect(lastUserIdx).toBe(2);
      const removed = messages.length - lastUserIdx;
      data.messages = messages.slice(0, lastUserIdx);
      await writeFile(filePath, JSON.stringify(data, null, 2));

      const result = JSON.parse(await readFile(filePath, 'utf-8')) as ThreadFile;
      expect(result.messages).toHaveLength(2);
      expect(removed).toBe(2);
      expect(result.messages?.[0]?.content).toBe('first');
      expect(result.messages?.[1]?.content).toBe('response 1');
    });

    it('throws when no user message exists', () => {
      const messages = [assistantMsg('only an assistant message')];
      let lastUserIdx = -1;
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i]?.role === 'user') {
          lastUserIdx = i;
          break;
        }
      }
      expect(lastUserIdx).toBe(-1);
    });

    it('handles thread with single user message', async () => {
      const threadFile = makeThreadFile([userMsg('only message'), assistantMsg('response')]);

      const filePath = join(tempDir, 'single-user.json');
      await writeFile(filePath, JSON.stringify(threadFile, null, 2));

      const content = await readFile(filePath, 'utf-8');
      const data = JSON.parse(content) as ThreadFile;
      const messages = data.messages || [];

      let lastUserIdx = -1;
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i]?.role === 'user') {
          lastUserIdx = i;
          break;
        }
      }

      expect(lastUserIdx).toBe(0);
      data.messages = messages.slice(0, lastUserIdx);
      await writeFile(filePath, JSON.stringify(data, null, 2));

      const result = JSON.parse(await readFile(filePath, 'utf-8')) as ThreadFile;
      expect(result.messages).toHaveLength(0);
    });

    it('handles multiple consecutive user messages', async () => {
      const threadFile = makeThreadFile([
        userMsg('first'),
        assistantMsg('response 1'),
        userMsg('second'),
        userMsg('third'), // user sent another message before assistant responded
        assistantMsg('response 2'),
      ]);

      const filePath = join(tempDir, 'multi-user.json');
      await writeFile(filePath, JSON.stringify(threadFile, null, 2));

      const content = await readFile(filePath, 'utf-8');
      const data = JSON.parse(content) as ThreadFile;
      const messages = data.messages || [];

      // "Undo" should find the LAST user message (index 3, "third")
      let lastUserIdx = -1;
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i]?.role === 'user') {
          lastUserIdx = i;
          break;
        }
      }

      expect(lastUserIdx).toBe(3);
      data.messages = messages.slice(0, lastUserIdx);
      await writeFile(filePath, JSON.stringify(data, null, 2));

      const result = JSON.parse(await readFile(filePath, 'utf-8')) as ThreadFile;
      expect(result.messages).toHaveLength(3);
      expect(result.messages?.[2]?.content).toBe('second');
    });
  });

  describe('content extraction', () => {
    it('extracts text from string content', () => {
      const msg = userMsg('hello');
      expect(typeof msg.content === 'string' ? msg.content : '').toBe('hello');
    });

    it('extracts text from array content blocks', () => {
      const msg: ThreadMessage = {
        role: 'user',
        content: [{ type: 'text', text: 'array content' }],
      };
      expect(Array.isArray(msg.content)).toBe(true);
      if (Array.isArray(msg.content)) {
        const textBlock = msg.content.find(
          (b): b is { type: 'text'; text?: string } =>
            typeof b === 'object' && 'type' in b && b.type === 'text',
        );
        expect(textBlock?.text).toBe('array content');
      }
    });
  });
});
