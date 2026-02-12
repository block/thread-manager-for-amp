import { spawn, ChildProcess } from 'child_process';
import { readFile, stat } from 'fs/promises';
import { join, resolve, isAbsolute } from 'path';
import { AMP_HOME } from './constants.js';
import type { GitStatus, GitFileStatus, FileDiff } from '../../shared/types.js';

const THREADS_DIR = join(AMP_HOME, '.local', 'share', 'amp', 'threads');

/**
 * Validates and sanitizes a workspace path to prevent path traversal attacks.
 * Returns a resolved absolute path or throws if invalid.
 */
async function validateWorkspacePath(inputPath: string): Promise<string> {
  if (!inputPath || typeof inputPath !== 'string') {
    throw new Error('Invalid workspace path: path must be a non-empty string');
  }

  const resolved = resolve(inputPath);

  if (!isAbsolute(resolved)) {
    throw new Error('Invalid workspace path: must resolve to absolute path');
  }

  try {
    const stats = await stat(resolved);
    if (!stats.isDirectory()) {
      throw new Error('Invalid workspace path: not a directory');
    }
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error('Invalid workspace path: directory does not exist', { cause: e });
    }
    throw e;
  }

  return resolved;
}

/**
 * Validates a file path ensuring it's within the workspace.
 */
function validateFilePath(filePath: string, workspacePath: string): string {
  const resolved = resolve(filePath);
  const resolvedWorkspace = resolve(workspacePath);

  if (!resolved.startsWith(resolvedWorkspace + '/') && resolved !== resolvedWorkspace) {
    throw new Error('Invalid file path: must be within workspace');
  }

  return resolved;
}

type FileStatusLabel = 'added' | 'modified' | 'deleted' | 'renamed';

interface ThreadData {
  env?: {
    initial?: {
      trees?: Array<{ uri: string; displayName: string }>;
    };
  };
  messages?: Array<{
    role: string;
    content?: Array<{
      type: string;
      name?: string;
      input?: { path?: string };
    }>;
  }>;
}

interface WorkspaceGitStatusByPath {
  workspacePath?: string;
  workspaceName?: string;
  files: Array<{
    path: string;
    relativePath: string;
    status: FileStatusLabel;
  }>;
  error?: string;
}

interface DirectGitFileStatus {
  path: string;
  status: FileStatusLabel;
  staged: boolean;
}

interface WorkspaceGitStatusDirect {
  isGitRepo: boolean;
  workspace: string;
  branch?: string;
  files: DirectGitFileStatus[];
  totalCount?: number;
  addedCount?: number;
  modifiedCount?: number;
  deletedCount?: number;
  error?: string;
}

/**
 * Spawns git with the given arguments and captures stdout.
 * Uses hardcoded 'git' command to prevent command injection.
 */
function spawnGitAndCapture(args: string[], cwd?: string): Promise<string> {
  return new Promise((resolve) => {
    // nosemgrep: javascript.lang.security.audit.child_process.child_process
    const child: ChildProcess = spawn('git', args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });

    const timeout = setTimeout(() => {
      child.kill();
      resolve('');
    }, 10_000);

    let stdout = '';
    child.stdout?.on('data', (d: Buffer) => {
      stdout += d.toString();
    });
    child.on('close', () => {
      clearTimeout(timeout);
      resolve(stdout);
    });
    child.on('error', () => {
      clearTimeout(timeout);
      resolve('');
    });
  });
}

/**
 * Spawns git with the given arguments and checks exit code.
 * Uses hardcoded 'git' command to prevent command injection.
 */
function spawnGitAndCheckExit(args: string[], cwd?: string): Promise<boolean> {
  return new Promise((resolve) => {
    // nosemgrep: javascript.lang.security.audit.child_process.child_process
    const child: ChildProcess = spawn('git', args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });

    const timeout = setTimeout(() => {
      child.kill();
      resolve(false);
    }, 10_000);

    child.on('close', (code: number | null) => {
      clearTimeout(timeout);
      resolve(code === 0);
    });
    child.on('error', () => {
      clearTimeout(timeout);
      resolve(false);
    });
  });
}

function parseStatusLabel(status: string): FileStatusLabel {
  if (status === '??' || status === 'A') return 'added';
  if (status === 'D') return 'deleted';
  if (status === 'R') return 'renamed';
  return 'modified';
}

interface GitStatusError {
  error: string;
  files: GitFileStatus[];
}

export async function getWorkspaceGitStatus(
  threadId: string
): Promise<GitStatus | GitStatusError> {
  const threadPath = join(THREADS_DIR, `${threadId}.json`);

  try {
    const content = await readFile(threadPath, 'utf-8');
    const data: ThreadData = JSON.parse(content);

    const trees = data.env?.initial?.trees || [];
    if (trees.length === 0) {
      return { error: 'No workspace found', files: [] };
    }

    const workspaceUri = trees[0].uri;
    const rawWorkspacePath = workspaceUri.replace('file://', '');
    const workspacePath = await validateWorkspacePath(rawWorkspacePath);
    const workspaceName = trees[0].displayName;

    const touchedFiles = new Set<string>();
    const messages = data.messages || [];
    for (const msg of messages) {
      if (msg.role === 'assistant' && Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.type === 'tool_use' && block.input?.path) {
            if (block.name === 'edit_file' || block.name === 'create_file') {
              touchedFiles.add(block.input.path);
            }
          }
        }
      }
    }

    const gitStatus = await spawnGitAndCapture(['status', '--porcelain'], workspacePath);

    const files: GitFileStatus[] = [];
    const statusLines = gitStatus.trim().split('\n').filter(Boolean);

    for (const line of statusLines) {
      const status = line.slice(0, 2).trim();
      const filePath = line.slice(3);
      const fullPath = join(workspacePath, filePath);

      const touchedByThread = touchedFiles.has(fullPath);

      files.push({
        path: fullPath,
        relativePath: filePath,
        status: parseStatusLabel(status),
        touchedByThread,
      });
    }

    return {
      workspacePath,
      workspaceName,
      files,
      touchedFiles: Array.from(touchedFiles),
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error('[git] Failed to get git status:', error);
    return { error, files: [] };
  }
}

export async function getWorkspaceGitStatusByPath(
  inputWorkspacePath: string
): Promise<WorkspaceGitStatusByPath> {
  try {
    const workspacePath = await validateWorkspacePath(inputWorkspacePath);
    const workspaceName = workspacePath.split('/').pop() || '';

    const gitStatus = await spawnGitAndCapture(['status', '--porcelain'], workspacePath);

    const files: WorkspaceGitStatusByPath['files'] = [];
    const statusLines = gitStatus.trim().split('\n').filter(Boolean);

    for (const line of statusLines) {
      const status = line.slice(0, 2).trim();
      const filePath = line.slice(3);
      const fullPath = join(workspacePath, filePath);

      files.push({
        path: fullPath,
        relativePath: filePath,
        status: parseStatusLabel(status),
      });
    }

    return {
      workspacePath,
      workspaceName,
      files,
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error('[git] Failed to get workspace git status:', error);
    return { error, files: [] };
  }
}

export async function getWorkspaceGitStatusDirect(
  inputWorkspacePath: string
): Promise<WorkspaceGitStatusDirect> {
  try {
    const workspacePath = await validateWorkspacePath(inputWorkspacePath);

    const isGit = await spawnGitAndCheckExit(
      ['-C', workspacePath, 'rev-parse', '--git-dir']
    );

    if (!isGit) {
      return { isGitRepo: false, files: [], workspace: workspacePath };
    }

    const branch = (
      await spawnGitAndCapture(['-C', workspacePath, 'branch', '--show-current'])
    ).trim() || 'HEAD';

    const gitStatus = await spawnGitAndCapture(
      ['-C', workspacePath, 'status', '--porcelain']
    );

    const files: DirectGitFileStatus[] = [];
    const statusLines = gitStatus.trim().split('\n').filter(Boolean);

    for (const line of statusLines) {
      const status = line.slice(0, 2).trim();
      const filePath = line.slice(3);

      files.push({
        path: filePath,
        status: parseStatusLabel(status),
        staged: status[0] !== ' ' && status[0] !== '?',
      });
    }

    return {
      isGitRepo: true,
      workspace: workspacePath,
      branch,
      files,
      totalCount: files.length,
      addedCount: files.filter((f) => f.status === 'added').length,
      modifiedCount: files.filter((f) => f.status === 'modified').length,
      deletedCount: files.filter((f) => f.status === 'deleted').length,
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error('[git] Failed to get workspace git status:', error);
    return { error, files: [], isGitRepo: false, workspace: inputWorkspacePath };
  }
}

export async function getFileDiff(
  inputFilePath: string,
  inputWorkspacePath: string
): Promise<FileDiff> {
  try {
    const workspacePath = await validateWorkspacePath(inputWorkspacePath);
    const filePath = validateFilePath(inputFilePath, workspacePath);
    const relativePath = filePath.replace(workspacePath + '/', '');

    const diff = await spawnGitAndCapture(
      ['diff', '--no-color', 'HEAD', '--', relativePath],
      workspacePath
    );

    if (!diff.trim()) {
      const cachedDiff = await spawnGitAndCapture(
        ['diff', '--no-color', '--cached', '--', relativePath],
        workspacePath
      );

      if (cachedDiff.trim()) {
        return { diff: cachedDiff, isNew: true };
      }

      try {
        const content = await readFile(filePath, 'utf-8');
        return {
          diff: undefined,
          isNew: true,
          content: content.slice(0, 5000),
          lines: content.split('\n').length,
        };
      } catch {
        return { diff: '', error: 'Could not read file' };
      }
    }

    return { diff };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return { error };
  }
}
