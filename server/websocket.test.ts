import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createServer, Server } from 'http';
import { WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { setupWebSocket } from './websocket.js';

// Mock child_process.spawn to prevent real process spawning
vi.mock('child_process', () => ({
  spawn: vi.fn(() => {
    const child = new EventEmitter() as EventEmitter & {
      pid: number;
      stdout: EventEmitter;
      stderr: EventEmitter;
      kill: ReturnType<typeof vi.fn>;
    };
    child.pid = 12345;
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = vi.fn();
    return child;
  }),
}));

// Mock fs/promises to prevent file reads for thread initialization
vi.mock('fs/promises', () => ({
  readFile: vi.fn().mockRejectedValue(new Error('not found')),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

// Mock database to prevent SQLite initialization
vi.mock('./lib/database.js', () => ({
  createArtifact: vi.fn(),
}));

import { spawn } from 'child_process';

function waitForMessage(ws: WebSocket, type: string): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const handler = (data: Buffer) => {
      const msg = JSON.parse(data.toString()) as Record<string, unknown>;
      if (msg.type === type) {
        ws.off('message', handler);
        resolve(msg);
      }
    };
    ws.on('message', handler);
  });
}

describe('WebSocket origin validation', () => {
  let server: Server;
  let port: number;

  beforeEach(async () => {
    vi.clearAllMocks();
    server = createServer();
    setupWebSocket(server);

    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve());
    });

    const addr = server.address();
    port = typeof addr === 'object' && addr ? addr.port : 0;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('rejects WebSocket upgrade from disallowed origin', async () => {
    const threadId = `T-test-origin-bad-${Date.now()}`;
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?threadId=${threadId}`, {
      headers: { Origin: 'https://evil.com' },
    });

    const closed = new Promise<{ code: number }>((resolve) => {
      ws.on('close', (code: number) => resolve({ code }));
      ws.on('error', () => resolve({ code: -1 }));
    });

    const result = await closed;
    // Connection should be rejected — either closed or errored
    expect(result.code).not.toBe(1000); // 1000 = normal close
  });

  it('allows WebSocket upgrade from localhost origin', async () => {
    const threadId = `T-test-origin-ok-${Date.now()}`;
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?threadId=${threadId}`, {
      headers: { Origin: `http://localhost:${port}` },
    });

    const ready = await waitForMessage(ws, 'ready');
    expect(ready.type).toBe('ready');
    expect(ready.threadId).toBe(threadId);

    ws.close();
  });

  it('allows WebSocket upgrade with no origin header', async () => {
    const threadId = `T-test-origin-none-${Date.now()}`;
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?threadId=${threadId}`);

    const ready = await waitForMessage(ws, 'ready');
    expect(ready.type).toBe('ready');

    ws.close();
  });
});

describe('concurrent spawn race condition', () => {
  let server: Server;
  let port: number;

  beforeEach(async () => {
    vi.clearAllMocks();
    server = createServer();
    setupWebSocket(server);

    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve());
    });

    const addr = server.address();
    port = typeof addr === 'object' && addr ? addr.port : 0;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('rejects second message while first is still spawning', async () => {
    const threadId = `T-test-${Date.now()}`;
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?threadId=${threadId}`);

    // Wait for the 'ready' message
    await waitForMessage(ws, 'ready');

    // Send two messages in rapid succession (no await between them)
    ws.send(JSON.stringify({ type: 'message', content: 'first message' }));
    ws.send(JSON.stringify({ type: 'message', content: 'second message' }));

    // Wait a bit for messages to be processed
    await new Promise((resolve) => setTimeout(resolve, 200));

    // spawn should only have been called once — the second message is queued
    // as pendingMessage, not rejected with an error
    expect(spawn).toHaveBeenCalledTimes(1);

    ws.close();
  });

  it('allows a new message after the first child process exits', async () => {
    const threadId = `T-test-sequential-${Date.now()}`;
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?threadId=${threadId}`);

    await waitForMessage(ws, 'ready');

    // Send first message
    ws.send(JSON.stringify({ type: 'message', content: 'first message' }));

    // Wait for spawn to be called
    await vi.waitFor(() => {
      expect(spawn).toHaveBeenCalledTimes(1);
    });

    // Simulate child process completing by emitting 'close'
    const result = (spawn as ReturnType<typeof vi.fn>).mock.results[0];
    const firstChild = result?.value as EventEmitter;
    firstChild.emit('close', 0);

    // Wait for the 'done' message
    await waitForMessage(ws, 'done');

    // Now send second message — should be accepted
    ws.send(JSON.stringify({ type: 'message', content: 'second message' }));

    await vi.waitFor(() => {
      expect(spawn).toHaveBeenCalledTimes(2);
    });

    ws.close();
  });
});
