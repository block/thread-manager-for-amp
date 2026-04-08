/**
 * Workspace discovery and management utilities
 */

import { readFile, readdir, stat, access } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import type { KnownWorkspace } from '../../shared/types.js';
import { listAllThreads } from './threadProvider.js';

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function getRepoFromGitConfig(repoPath: string): Promise<string | null> {
  try {
    const configPath = join(repoPath, '.git', 'config');
    if (!(await fileExists(configPath))) return null;

    const config = await readFile(configPath, 'utf-8');
    const match = config.match(/url\s*=\s*.*[:/]([^/]+\/[^/]+?)(?:\.git)?$/m);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export async function getKnownWorkspaces(): Promise<KnownWorkspace[]> {
  const threads = await listAllThreads();
  const workspaceMap = new Map<string, KnownWorkspace>();

  for (const thread of threads) {
    if (thread.workspacePath && !workspaceMap.has(thread.workspacePath)) {
      workspaceMap.set(thread.workspacePath, {
        path: thread.workspacePath,
        name: thread.workspace || thread.workspacePath.split('/').pop() || thread.workspacePath,
        repo: thread.repo,
        lastUsed: thread.lastUpdatedDate,
        source: 'thread',
      });
    }
  }

  // Also scan ~/Development for git repos
  const devDir = join(homedir(), 'Development');
  try {
    if (await fileExists(devDir)) {
      const entries = await readdir(devDir);
      for (const entry of entries) {
        const fullPath = join(devDir, entry);
        try {
          const entryStat = await stat(fullPath);
          if (entryStat.isDirectory() && !entry.startsWith('.')) {
            // Check if it's a git repo
            const gitPath = join(fullPath, '.git');
            const isGitRepo = await fileExists(gitPath);

            if (!workspaceMap.has(fullPath)) {
              workspaceMap.set(fullPath, {
                path: fullPath,
                name: entry,
                repo: isGitRepo ? await getRepoFromGitConfig(fullPath) : null,
                source: 'scan',
              });
            }
          }
        } catch {
          // Skip if can't stat
        }
      }
    }
  } catch (err) {
    console.error('Error scanning Development directory:', err);
  }

  return [...workspaceMap.values()].sort((a, b) => {
    // Thread-sourced first, then alphabetical
    if (a.source !== b.source) {
      return a.source === 'thread' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}
