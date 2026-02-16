import * as pty from 'node-pty';
import type { IPty } from 'node-pty';
import { homedir } from 'os';
import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type { Server } from 'http';
import type { Duplex } from 'stream';
import type { ShellClientMessage, ShellServerMessage } from '../shared/websocket.js';

interface SessionState {
  cwd: string;
  connectedAt: number;
  ptyProcess: IPty;
}

const PING_INTERVAL_MS = 25_000;

const activeSessions = new Map<string, SessionState>();

export function getActiveSessions(): Record<string, { cwd: string; connectedAt: number }> {
  const result: Record<string, { cwd: string; connectedAt: number }> = {};
  for (const [sessionId, state] of activeSessions) {
    result[sessionId] = {
      cwd: state.cwd,
      connectedAt: state.connectedAt,
    };
  }
  return result;
}

export function setupShellWebSocket(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(request.url || '', `http://${request.headers.host}`);

    if (url.pathname === '/shell') {
      wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const cwd = url.searchParams.get('cwd') || homedir();
    const sessionId = `shell-${Date.now()}`;

    const shell = process.env.SHELL || '/bin/bash';

    let ptyProcess: IPty;
    try {
      ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols: 120,
        rows: 30,
        cwd,
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
        } as Record<string, string>,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('[SHELL] Failed to spawn PTY:', err);
      const errorMsg: ShellServerMessage = { type: 'error', content: `Failed to start shell: ${errorMessage}` };
      ws.send(JSON.stringify(errorMsg));
      ws.close();
      return;
    }

    activeSessions.set(sessionId, {
      cwd,
      connectedAt: Date.now(),
      ptyProcess,
    });

    const connectedMsg: ShellServerMessage = {
      type: 'connected',
      sessionId,
      shell,
      cwd,
    };
    ws.send(JSON.stringify(connectedMsg));

    // Setup ping/pong heartbeat to detect stale connections
    let isAlive = true;
    const pingInterval = setInterval(() => {
      if (!isAlive) {
        console.log(`[SHELL] No pong received for session ${sessionId}, terminating stale connection`);
        ws.terminate();
        return;
      }
      isAlive = false;
      ws.ping();
    }, PING_INTERVAL_MS);

    ws.on('pong', () => {
      isAlive = true;
    });

    ptyProcess.onData((data: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        const outputMsg: ShellServerMessage = { type: 'output', data };
        ws.send(JSON.stringify(outputMsg));
      }
    });

    ptyProcess.onExit(({ exitCode }: { exitCode: number }) => {
      if (ws.readyState === WebSocket.OPEN) {
        const exitMsg: ShellServerMessage = { type: 'exit', exitCode };
        ws.send(JSON.stringify(exitMsg));
        ws.close();
      }
      activeSessions.delete(sessionId);
    });

    ws.on('message', (message: Buffer) => {
      try {
        const msg = JSON.parse(message.toString()) as ShellClientMessage;

        switch (msg.type) {
          case 'input':
            if (msg.data) {
              ptyProcess.write(msg.data);
            }
            break;
          case 'resize':
            if (msg.cols && msg.rows) {
              ptyProcess.resize(msg.cols, msg.rows);
            }
            break;
          case 'ping': {
            const pongMsg: ShellServerMessage = { type: 'pong' };
            ws.send(JSON.stringify(pongMsg));
            break;
          }
        }
      } catch {
        // Ignore parse errors
      }
    });

    ws.on('close', () => {
      clearInterval(pingInterval);
      activeSessions.delete(sessionId);
      if (ptyProcess) {
        ptyProcess.kill();
      }
    });

    ws.on('error', () => {
      clearInterval(pingInterval);
      activeSessions.delete(sessionId);
      if (ptyProcess) {
        ptyProcess.kill();
      }
    });
  });

  return wss;
}
