import { describe, it, expect } from 'vitest';
import { parseIssueUrl, getIssueColor, extractIssueUrl } from './issueTracker';

describe('parseIssueUrl', () => {
  it('returns null for empty string', () => {
    expect(parseIssueUrl('')).toBeNull();
  });

  it('returns null for invalid URL', () => {
    expect(parseIssueUrl('not-a-url')).toBeNull();
  });

  it('parses Linear issue URL', () => {
    const result = parseIssueUrl('https://linear.app/myteam/issue/TEAM-123/some-title');
    expect(result).toEqual({
      type: 'linear',
      id: 'TEAM-123',
      displayName: 'TEAM-123',
      url: 'https://linear.app/myteam/issue/TEAM-123/some-title',
    });
  });

  it('parses Linear issue URL case-insensitively', () => {
    const result = parseIssueUrl('https://linear.app/myteam/issue/team-456/title');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('TEAM-456');
  });

  it('parses GitHub issue URL', () => {
    const result = parseIssueUrl('https://github.com/org/repo/issues/42');
    expect(result).toEqual({
      type: 'github',
      id: 'org/repo#42',
      displayName: '#42',
      url: 'https://github.com/org/repo/issues/42',
    });
  });

  it('parses GitHub PR URL', () => {
    const result = parseIssueUrl('https://github.com/org/repo/pull/99');
    expect(result).toEqual({
      type: 'github',
      id: 'org/repo#99',
      displayName: 'PR #99',
      url: 'https://github.com/org/repo/pull/99',
    });
  });

  it('parses Jira URL', () => {
    const result = parseIssueUrl('https://jira.example.com/browse/PROJ-789');
    expect(result).toEqual({
      type: 'jira',
      id: 'PROJ-789',
      displayName: 'PROJ-789',
      url: 'https://jira.example.com/browse/PROJ-789',
    });
  });

  it('returns unknown type for valid but unrecognized URL', () => {
    const result = parseIssueUrl('https://example.com/something');
    expect(result).toEqual({
      type: 'unknown',
      id: 'https://example.com/something',
      displayName: 'example.com',
      url: 'https://example.com/something',
    });
  });

  it('handles GitHub URL without issue/PR path', () => {
    const result = parseIssueUrl('https://github.com/org/repo');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('unknown');
  });
});

describe('getIssueColor', () => {
  it('returns purple for linear', () => {
    expect(getIssueColor('linear')).toContain('purple');
  });

  it('returns text-primary for github', () => {
    expect(getIssueColor('github')).toContain('text-primary');
  });

  it('returns blue for jira', () => {
    expect(getIssueColor('jira')).toContain('blue');
  });

  it('returns muted for unknown', () => {
    expect(getIssueColor('unknown')).toContain('muted');
  });
});

describe('extractIssueUrl', () => {
  it('returns null for text without URLs', () => {
    expect(extractIssueUrl('no urls here')).toBeNull();
  });

  it('extracts Linear URL from text', () => {
    const text = 'Working on https://linear.app/team/issue/PROJ-123/my-issue today';
    expect(extractIssueUrl(text)).toBe('https://linear.app/team/issue/PROJ-123/my-issue');
  });

  it('extracts GitHub issue URL from text', () => {
    const text = 'See https://github.com/org/repo/issues/42 for details';
    expect(extractIssueUrl(text)).toBe('https://github.com/org/repo/issues/42');
  });

  it('extracts GitHub PR URL from text', () => {
    const text = 'Review https://github.com/org/repo/pull/99 please';
    expect(extractIssueUrl(text)).toBe('https://github.com/org/repo/pull/99');
  });

  it('extracts Jira URL from text', () => {
    const text = 'Ticket: https://jira.company.com/browse/TEAM-456';
    expect(extractIssueUrl(text)).toBe('https://jira.company.com/browse/TEAM-456');
  });

  it('returns null for unrecognized URLs', () => {
    expect(extractIssueUrl('Visit https://example.com for info')).toBeNull();
  });
});
