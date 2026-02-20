import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveMessageReferences } from './mentionResolver.js';

// Mock fs and threadTypes
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
}));

import { readFile } from 'fs/promises';

const mockReadFile = vi.mocked(readFile);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('resolveMessageReferences', () => {
  it('returns original message when no references present', async () => {
    const result = await resolveMessageReferences('hello world');
    expect(result.message).toBe('hello world');
    expect(result.fileRefs).toEqual([]);
    expect(result.threadRefs).toEqual([]);
  });

  it('detects file references with @', async () => {
    const result = await resolveMessageReferences('@src/index.ts what does this do');
    expect(result.fileRefs).toEqual(['src/index.ts']);
    expect(result.message).toContain('src/index.ts');
    expect(result.message).toContain('what does this do');
  });

  it('detects thread references with @@', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({ title: 'Fix auth bug' }));
    const result = await resolveMessageReferences('@@T-abc123 continue this work');
    expect(result.threadRefs).toEqual(['T-abc123']);
    expect(result.message).toContain('T-abc123');
    expect(result.message).toContain('Fix auth bug');
    expect(result.message).toContain('continue this work');
  });

  it('handles mixed file and thread references', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({ title: 'My thread' }));
    const result = await resolveMessageReferences('@src/app.ts @@T-def456 please review these');
    expect(result.fileRefs).toEqual(['src/app.ts']);
    expect(result.threadRefs).toEqual(['T-def456']);
    expect(result.message).toContain('src/app.ts');
    expect(result.message).toContain('T-def456');
    expect(result.message).toContain('please review these');
  });

  it('does NOT treat email addresses as file references', async () => {
    const result = await resolveMessageReferences('send to user@domain.com please');
    expect(result.fileRefs).toEqual([]);
    expect(result.threadRefs).toEqual([]);
    expect(result.message).toBe('send to user@domain.com please');
  });

  it('handles @ at start of message', async () => {
    const result = await resolveMessageReferences('@package.json check the deps');
    expect(result.fileRefs).toEqual(['package.json']);
  });

  it('handles multiple file references', async () => {
    const result = await resolveMessageReferences('@src/a.ts @src/b.ts compare these files');
    expect(result.fileRefs).toEqual(['src/a.ts', 'src/b.ts']);
  });

  it('handles thread with no title gracefully', async () => {
    mockReadFile.mockRejectedValue(new Error('File not found'));
    const result = await resolveMessageReferences('@@T-missing check this');
    expect(result.threadRefs).toEqual(['T-missing']);
    expect(result.message).toContain('T-missing');
  });

  it('does not treat @@ alone as a reference', async () => {
    const result = await resolveMessageReferences('@@ ');
    expect(result.threadRefs).toEqual([]);
    // @@ without a valid thread ID pattern is treated as file ref with empty query
  });
});
