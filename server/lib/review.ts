import { spawn } from 'child_process';
import type { ServerResponse } from 'http';
import { AMP_BIN } from './constants.js';
import { stripAnsi, runAmp } from './utils.js';

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
