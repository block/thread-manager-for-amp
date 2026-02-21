import { describe, it, expect, beforeAll } from 'vitest';
import { initDatabase, recordPrompt, searchPromptHistory } from './database.js';

beforeAll(() => {
  initDatabase(':memory:');
});

describe('prompt history', () => {
  it('records a prompt and retrieves it', () => {
    recordPrompt('hello world', 'T-test-1');
    const results = searchPromptHistory('', 10);
    expect(results.some((r) => r.text === 'hello world')).toBe(true);
  });

  it('finds prompts by search query', () => {
    recordPrompt('fix the authentication bug', 'T-test-2');
    recordPrompt('add tests for login', 'T-test-2');

    const results = searchPromptHistory('authentication', 10);
    expect(results).toHaveLength(1);
    expect(results[0]?.text).toBe('fix the authentication bug');
  });

  it('deduplicates prompts by moving to top on re-use', () => {
    recordPrompt('unique prompt alpha', 'T-test-3');
    recordPrompt('unique prompt beta', 'T-test-3');
    recordPrompt('unique prompt alpha', 'T-test-4'); // same text, new thread

    const results = searchPromptHistory('unique prompt', 10);
    // Both should exist
    const texts = results.map((r) => r.text);
    expect(texts).toContain('unique prompt alpha');
    expect(texts).toContain('unique prompt beta');

    // alpha should be more recent (higher created_at) since it was re-recorded
    const alphaIdx = results.findIndex((r) => r.text === 'unique prompt alpha');
    const betaIdx = results.findIndex((r) => r.text === 'unique prompt beta');
    expect(alphaIdx).toBeGreaterThanOrEqual(0);
    expect(betaIdx).toBeGreaterThanOrEqual(0);
    // alpha was re-inserted after beta, so it should appear first (ordered by created_at DESC)
    expect(alphaIdx).toBeLessThan(betaIdx);
  });

  it('ignores empty prompts', () => {
    const before = searchPromptHistory('', 100).length;
    recordPrompt('', 'T-test-5');
    recordPrompt('   ', 'T-test-5');
    const after = searchPromptHistory('', 100).length;
    expect(after).toBe(before);
  });

  it('trims whitespace from prompts', () => {
    recordPrompt('  trimmed prompt  ', 'T-test-6');
    const results = searchPromptHistory('trimmed prompt', 10);
    expect(results.some((r) => r.text === 'trimmed prompt')).toBe(true);
  });

  it('returns results ordered by most recent first', () => {
    recordPrompt('ordered first', 'T-test-7');
    recordPrompt('ordered second', 'T-test-7');
    recordPrompt('ordered third', 'T-test-7');

    const results = searchPromptHistory('ordered', 10);
    expect(results[0]?.text).toBe('ordered third');
    expect(results[1]?.text).toBe('ordered second');
    expect(results[2]?.text).toBe('ordered first');
  });

  it('respects limit parameter', () => {
    for (let i = 0; i < 10; i++) {
      recordPrompt(`limit-test-${i}`, 'T-test-8');
    }
    const results = searchPromptHistory('limit-test', 3);
    expect(results).toHaveLength(3);
  });

  it('returns recent prompts when query is empty', () => {
    const results = searchPromptHistory('', 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(5);
  });
});
