import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveMessageReferences } from './mentionResolver.js';

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

  it('detects file references with @ and injects file contents', async () => {
    // First call: file read for the referenced file
    mockReadFile.mockResolvedValueOnce('const x = 1;\n');
    const result = await resolveMessageReferences('@src/index.ts what does this do', '/workspace');
    expect(result.fileRefs).toEqual(['src/index.ts']);
    expect(result.message).toContain('<file path="src/index.ts">');
    expect(result.message).toContain('const x = 1;');
    expect(result.message).toContain('what does this do');
  });

  it('detects thread references with @T- prefix (single @)', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({ title: 'Fix auth bug' }));
    const result = await resolveMessageReferences('@T-abc123 continue this work');
    expect(result.threadRefs).toEqual(['T-abc123']);
    expect(result.message).toContain('T-abc123');
    expect(result.message).toContain('Fix auth bug');
    expect(result.message).toContain('continue this work');
  });

  it('handles mixed file and thread references', async () => {
    // readFile is called for the file content, then for thread title
    mockReadFile
      .mockResolvedValueOnce('export default App;')
      .mockResolvedValueOnce(JSON.stringify({ title: 'My thread' }));
    const result = await resolveMessageReferences(
      '@src/app.ts @T-def456 please review these',
      '/workspace',
    );
    expect(result.fileRefs).toEqual(['src/app.ts']);
    expect(result.threadRefs).toEqual(['T-def456']);
    expect(result.message).toContain('<file path="src/app.ts">');
    expect(result.message).toContain('export default App;');
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
    mockReadFile.mockResolvedValueOnce('{}');
    const result = await resolveMessageReferences('@package.json check the deps', '/workspace');
    expect(result.fileRefs).toEqual(['package.json']);
    expect(result.message).toContain('<file path="package.json">');
  });

  it('handles multiple file references', async () => {
    mockReadFile.mockResolvedValueOnce('file a').mockResolvedValueOnce('file b');
    const result = await resolveMessageReferences(
      '@src/a.ts @src/b.ts compare these files',
      '/workspace',
    );
    expect(result.fileRefs).toEqual(['src/a.ts', 'src/b.ts']);
    expect(result.message).toContain('<file path="src/a.ts">');
    expect(result.message).toContain('<file path="src/b.ts">');
  });

  it('handles thread with no title gracefully', async () => {
    mockReadFile.mockRejectedValue(new Error('File not found'));
    const result = await resolveMessageReferences('@T-missing check this');
    expect(result.threadRefs).toEqual(['T-missing']);
    expect(result.message).toContain('T-missing');
  });

  it('handles file with line range #L syntax', async () => {
    mockReadFile.mockResolvedValueOnce('line1\nline2\nline3\nline4\nline5\n');
    const result = await resolveMessageReferences(
      '@src/index.ts#L2-L4 explain these lines',
      '/workspace',
    );
    expect(result.fileRefs).toEqual(['src/index.ts#L2-L4']);
    expect(result.message).toContain('lines 2-4');
    expect(result.message).toContain('line2\nline3\nline4');
    expect(result.message).not.toContain('line1');
    expect(result.message).not.toContain('line5');
  });

  it('handles file with single line #L syntax', async () => {
    mockReadFile.mockResolvedValueOnce('line1\nline2\nline3\n');
    const result = await resolveMessageReferences('@src/index.ts#L2 what is this', '/workspace');
    expect(result.fileRefs).toEqual(['src/index.ts#L2']);
    expect(result.message).toContain('line 2');
    expect(result.message).toContain('line2');
  });

  it('shows error message when file cannot be read', async () => {
    mockReadFile.mockRejectedValueOnce(new Error('ENOENT'));
    const result = await resolveMessageReferences('@nonexistent.ts what is this', '/workspace');
    expect(result.fileRefs).toEqual(['nonexistent.ts']);
    expect(result.message).toContain('[Could not read file]');
  });
});
