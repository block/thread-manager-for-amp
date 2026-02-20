import { spawn } from 'child_process';
import { validateWorkspacePath } from './git.js';

export interface FileListResult {
  files: string[];
  truncated: boolean;
}

export async function listWorkspaceFiles(
  workspacePath: string,
  query?: string,
  limit = 50,
): Promise<FileListResult> {
  const validated = await validateWorkspacePath(workspacePath);

  const allFiles = await new Promise<string[]>((resolve, reject) => {
    const child = spawn('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
      cwd: validated,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const chunks: Buffer[] = [];
    child.stdout.on('data', (data: Buffer) => chunks.push(data));

    const stderrChunks: Buffer[] = [];
    child.stderr.on('data', (data: Buffer) => stderrChunks.push(data));

    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('git ls-files timed out'));
    }, 10000);

    child.on('error', (err: Error) => {
      clearTimeout(timeout);
      reject(err);
    });

    child.on('close', (code: number | null) => {
      clearTimeout(timeout);
      if (code !== 0) {
        const stderr = Buffer.concat(stderrChunks).toString('utf-8');
        reject(new Error(stderr || `git ls-files exited with code ${code}`));
      } else {
        const output = Buffer.concat(chunks).toString('utf-8');
        resolve(output.split('\n').filter(Boolean));
      }
    });
  });

  const queryLower = query?.toLowerCase() || '';
  const filtered = queryLower
    ? allFiles.filter((f) => f.toLowerCase().includes(queryLower))
    : allFiles;

  return {
    files: filtered.slice(0, limit),
    truncated: filtered.length > limit,
  };
}
