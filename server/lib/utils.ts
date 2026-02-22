import type { IncomingMessage, ServerResponse } from 'http';
import { spawn, type StdioOptions } from 'child_process';
import { readFile } from 'fs/promises';
import { join, extname, normalize } from 'path';
import { fileURLToPath } from 'url';
import { MIME_TYPES, AMP_BIN, AMP_HOME } from './constants.js';
export { stripAnsi } from '../../shared/utils.js';

export class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BadRequestError';
  }
}

export function isBadRequest(err: unknown): boolean {
  return err instanceof BadRequestError;
}

/**
 * Safely convert a file:// URI to a filesystem path.
 * Returns null for non-file URIs or invalid input.
 */
export function parseFileUri(uri: string | undefined | null): string | null {
  if (!uri) return null;
  try {
    if (uri.startsWith('file://')) {
      return fileURLToPath(new URL(uri));
    }
    // Already a plain path
    return uri.startsWith('/') ? uri : null;
  } catch {
    return null;
  }
}

/**
 * Standard route error handler. Maps BadRequestError → 400, everything else → 500.
 */
export function handleRouteError(res: ServerResponse, err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  const status = isBadRequest(err) ? 400 : 500;
  return sendError(res, status, message);
}

interface RunAmpOptions {
  cwd?: string;
  stdio?: StdioOptions;
}

export function jsonResponse(res: ServerResponse, data: unknown, status: number = 200): boolean {
  // CORS headers are already set by the top-level handler in index.ts
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
  return true;
}

const MAX_BODY_BYTES = 5 * 1024 * 1024; // 5 MB

export function parseBody<T = Record<string, unknown>>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    let rejected = false;
    req.on('data', (chunk: Buffer) => {
      if (rejected) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        rejected = true;
        req.destroy();
        reject(new Error('Request body too large'));
        return;
      }
      body += chunk.toString();
    });
    req.on('end', () => {
      if (rejected) return;
      try {
        resolve((body ? JSON.parse(body) : {}) as T);
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

export function sendError(res: ServerResponse, status: number, message: string): boolean {
  return jsonResponse(res, { error: message }, status);
}

export function getParam(url: URL, name: string): string {
  const value = url.searchParams.get(name);
  if (!value) {
    throw new BadRequestError(`${name} required`);
  }
  return value;
}

export function runAmp(args: string[], options: RunAmpOptions = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(AMP_BIN, args, {
      cwd: options.cwd || AMP_HOME,
      env: { ...process.env, CI: '1', TERM: 'dumb' },
      stdio: options.stdio || ['ignore', 'pipe', 'pipe'],
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    if (child.stdout) {
      child.stdout.on('data', (data: Buffer) => {
        stdoutChunks.push(data);
      });
    }
    if (child.stderr) {
      child.stderr.on('data', (data: Buffer) => {
        stderrChunks.push(data);
      });
    }

    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('Command timed out after 2 minutes'));
    }, 120000);

    child.on('error', (err: Error) => {
      clearTimeout(timeout);
      reject(err);
    });

    child.on('close', (code: number | null) => {
      clearTimeout(timeout);
      const stdout = Buffer.concat(stdoutChunks).toString('utf-8');
      const stderr = Buffer.concat(stderrChunks).toString('utf-8');

      if (code !== 0) {
        reject(new Error(stderr || `amp exited with code ${code}`));
      } else {
        resolve(stdout);
      }
    });
  });
}

export function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
}

export async function serveStatic(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const filePath = req.url === '/' ? '/index.html' : req.url?.split('?')[0] || '/index.html';

  const distDir = join(process.cwd(), 'dist');
  const normalizedPath = normalize(join(distDir, filePath));

  if (!normalizedPath.startsWith(distDir)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = extname(normalizedPath);

  try {
    const content = await readFile(normalizedPath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'text/plain' });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}
