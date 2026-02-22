import { describe, it, expect } from 'vitest';

// We test the frontmatter parsing logic by importing the discoverReviewChecks function
// and mocking the filesystem, but it's simpler to test the parsing function directly.
// Since parseCheckFrontmatter is not exported, we'll test via discoverReviewChecks
// with a real temp directory.

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { discoverReviewChecks } from './review.js';

describe('discoverReviewChecks', () => {
  let tempDir: string;

  function setup(files: Record<string, string>) {
    tempDir = mkdtempSync(join(tmpdir(), 'review-checks-'));
    const checksDir = join(tempDir, '.agents', 'checks');
    mkdirSync(checksDir, { recursive: true });
    for (const [name, content] of Object.entries(files)) {
      writeFileSync(join(checksDir, name), content);
    }
  }

  function cleanup() {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  }

  it('discovers checks with valid frontmatter', async () => {
    setup({
      'security.md': `---
name: Security Review
description: Check for security vulnerabilities
severity: high
tools:
  - Grep
  - Read
globs:
  - "**/*.ts"
---

Review the code for security issues.
`,
    });
    try {
      const checks = await discoverReviewChecks(tempDir);
      expect(checks).toHaveLength(1);
      expect(checks[0]).toMatchObject({
        name: 'Security Review',
        description: 'Check for security vulnerabilities',
        severity: 'high',
        tools: ['Grep', 'Read'],
        globs: ['**/*.ts'],
      });
      expect(checks[0]?.filePath).toContain('security.md');
    } finally {
      cleanup();
    }
  });

  it('skips files without valid frontmatter', async () => {
    setup({
      'no-frontmatter.md': 'Just some text without YAML frontmatter.',
      'missing-name.md': `---
description: Has description but no name
---
Content here.
`,
    });
    try {
      const checks = await discoverReviewChecks(tempDir);
      expect(checks).toHaveLength(0);
    } finally {
      cleanup();
    }
  });

  it('returns empty array when checks directory does not exist', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'review-checks-'));
    try {
      const checks = await discoverReviewChecks(tempDir);
      expect(checks).toEqual([]);
    } finally {
      cleanup();
    }
  });

  it('skips non-md files', async () => {
    setup({
      'valid.md': `---
name: Valid Check
description: A valid check
---
Content.
`,
      'readme.txt': 'Not a markdown file',
    });
    try {
      const checks = await discoverReviewChecks(tempDir);
      expect(checks).toHaveLength(1);
      expect(checks[0]?.name).toBe('Valid Check');
    } finally {
      cleanup();
    }
  });

  it('handles checks without optional fields', async () => {
    setup({
      'minimal.md': `---
name: Minimal Check
description: Just name and description
---
Content.
`,
    });
    try {
      const checks = await discoverReviewChecks(tempDir);
      expect(checks).toHaveLength(1);
      expect(checks[0]).toMatchObject({
        name: 'Minimal Check',
        description: 'Just name and description',
      });
      expect(checks[0]?.severity).toBeUndefined();
      expect(checks[0]?.tools).toBeUndefined();
      expect(checks[0]?.globs).toBeUndefined();
    } finally {
      cleanup();
    }
  });
});
