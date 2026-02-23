import { spawn } from 'child_process';
import type { ServerResponse } from 'http';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { AMP_BIN } from './constants.js';
import { stripAnsi, runAmp } from './utils.js';

export interface ReviewCheck {
  name: string;
  description: string;
  severity?: string;
  tools?: string[];
  globs?: string[];
  filePath: string;
}

export interface ReviewOptions {
  workspace: string;
  files?: string[];
  instructions?: string;
  summaryOnly?: boolean;
}

export async function runReview(options: ReviewOptions): Promise<string> {
  const args = ['review'];
  if (options.files?.length) args.push('--files', ...options.files);
  if (options.instructions) args.push('--instructions', options.instructions);
  if (options.summaryOnly) args.push('--summary-only');

  const output = await runAmp(args, { cwd: options.workspace });
  return stripAnsi(output);
}

export function streamReview(options: ReviewOptions, res: ServerResponse): void {
  const args = ['review'];
  if (options.files?.length) args.push('--files', ...options.files);
  if (options.instructions) args.push('--instructions', options.instructions);
  if (options.summaryOnly) args.push('--summary-only');

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const child = spawn(AMP_BIN, args, {
    cwd: options.workspace,
    env: { ...process.env, CI: '1', TERM: 'dumb' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const sendEvent = (event: string, data: string) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  let stdoutBuffer = '';

  child.stdout.on('data', (chunk: Buffer) => {
    stdoutBuffer += chunk.toString('utf-8');
    const lines = stdoutBuffer.split('\n');
    // Keep the last incomplete line in the buffer
    stdoutBuffer = lines.pop() || '';
    for (const line of lines) {
      sendEvent('text', stripAnsi(line));
    }
  });

  child.stderr.on('data', (chunk: Buffer) => {
    sendEvent('error', stripAnsi(chunk.toString('utf-8')));
  });

  const timeout = setTimeout(() => {
    child.kill('SIGKILL');
    sendEvent('error', 'Review timed out after 2 minutes');
    res.write('event: done\ndata: {}\n\n');
    res.end();
  }, 120000);

  child.on('error', (err: Error) => {
    clearTimeout(timeout);
    sendEvent('error', err.message);
    res.write('event: done\ndata: {}\n\n');
    res.end();
  });

  child.on('close', (code: number | null) => {
    clearTimeout(timeout);
    // Flush any remaining buffer
    if (stdoutBuffer) {
      sendEvent('text', stripAnsi(stdoutBuffer));
    }
    res.write(`event: done\ndata: ${JSON.stringify({ code })}\n\n`);
    res.end();
  });

  // Handle client disconnect
  res.on('close', () => {
    clearTimeout(timeout);
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  });
}

export async function discoverReviewChecks(workspace: string): Promise<ReviewCheck[]> {
  const checksDir = join(workspace, '.agents', 'checks');
  let entries: string[];
  try {
    entries = await readdir(checksDir);
  } catch {
    return [];
  }

  const checks: ReviewCheck[] = [];
  for (const entry of entries) {
    if (!entry.endsWith('.md')) continue;
    const filePath = join(checksDir, entry);
    try {
      const content = await readFile(filePath, 'utf-8');
      const check = parseCheckFrontmatter(content, filePath);
      if (check) checks.push(check);
    } catch {
      // Skip unreadable files
    }
  }
  return checks;
}

function parseCheckFrontmatter(content: string, filePath: string): ReviewCheck | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match?.[1]) return null;

  const yaml = match[1];
  const get = (key: string): string | undefined => {
    const m = yaml.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
    return m?.[1]?.trim();
  };
  const getList = (key: string): string[] | undefined => {
    const idx = yaml.indexOf(`${key}:`);
    if (idx === -1) return undefined;
    const items: string[] = [];
    const lines = yaml.slice(idx).split('\n').slice(1);
    for (const line of lines) {
      const itemMatch = line.match(/^\s*-\s+(.+)$/);
      if (itemMatch?.[1]) items.push(itemMatch[1].trim().replace(/^["']|["']$/g, ''));
      else break;
    }
    return items.length > 0 ? items : undefined;
  };

  const name = get('name');
  const description = get('description');
  if (!name || !description) return null;

  return {
    name,
    description,
    severity: get('severity'),
    tools: getList('tools'),
    globs: getList('globs'),
    filePath,
  };
}
