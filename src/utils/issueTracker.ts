export interface ParsedIssue {
  type: 'linear' | 'github' | 'jira' | 'unknown';
  id: string;
  displayName: string;
  url: string;
}

export function parseIssueUrl(url: string): ParsedIssue | null {
  if (!url) return null;
  
  try {
    const parsed = new URL(url);
    
    // Linear: https://linear.app/TEAM/issue/TEAM-123/...
    if (parsed.hostname === 'linear.app') {
      const match = url.match(/\/issue\/([A-Z]+-\d+)/i);
      if (match) {
        return {
          type: 'linear',
          id: match[1].toUpperCase(),
          displayName: match[1].toUpperCase(),
          url,
        };
      }
    }
    
    // GitHub: https://github.com/org/repo/issues/123
    if (parsed.hostname === 'github.com') {
      const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/);
      if (match) {
        return {
          type: 'github',
          id: `${match[1]}/${match[2]}#${match[3]}`,
          displayName: `#${match[3]}`,
          url,
        };
      }
      // Also handle PRs
      const prMatch = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
      if (prMatch) {
        return {
          type: 'github',
          id: `${prMatch[1]}/${prMatch[2]}#${prMatch[3]}`,
          displayName: `PR #${prMatch[3]}`,
          url,
        };
      }
    }
    
    // Jira: https://jira.example.com/browse/PROJ-123
    if (url.includes('/browse/')) {
      const match = url.match(/\/browse\/([A-Z]+-\d+)/i);
      if (match) {
        return {
          type: 'jira',
          id: match[1].toUpperCase(),
          displayName: match[1].toUpperCase(),
          url,
        };
      }
    }
    
    // Unknown but valid URL
    return {
      type: 'unknown',
      id: url,
      displayName: parsed.hostname,
      url,
    };
  } catch {
    return null;
  }
}

export function getIssueColor(type: ParsedIssue['type']): string {
  switch (type) {
    case 'linear': return 'var(--accent-purple, #8B5CF6)';
    case 'github': return 'var(--text-primary)';
    case 'jira': return 'var(--accent-blue)';
    default: return 'var(--text-muted)';
  }
}

export function extractIssueUrl(text: string): string | null {
  // Match Linear URLs
  const linearMatch = text.match(/https:\/\/linear\.app\/[^\s]+\/issue\/[A-Z]+-\d+[^\s]*/i);
  if (linearMatch) return linearMatch[0];
  
  // Match GitHub issue/PR URLs
  const githubMatch = text.match(/https:\/\/github\.com\/[^\s]+\/(issues|pull)\/\d+[^\s]*/i);
  if (githubMatch) return githubMatch[0];
  
  // Match Jira URLs
  const jiraMatch = text.match(/https:\/\/[^\s]+\/browse\/[A-Z]+-\d+[^\s]*/i);
  if (jiraMatch) return jiraMatch[0];
  
  return null;
}
