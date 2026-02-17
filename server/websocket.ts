import { spawn, ChildProcess } from 'child_process';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage, Server } from 'http';
import { Duplex } from 'stream';
import type { RunningThreadState, RunningThreadsMap, ThreadImage } from '../shared/types.js';
import type { WsServerMessage } from '../shared/websocket.js';
import { isWsClientMessage } from '../shared/validation.js';
import { calculateCost, isHiddenCostTool, TOOL_COST_ESTIMATES, estimateTaskCost } from '../shared/cost.js';
import { AMP_BIN, AMP_HOME, DEFAULT_MAX_CONTEXT_TOKENS } from './lib/constants.js';
import { createArtifact } from './lib/database.js';
import { THREADS_DIR, ARTIFACTS_DIR, type ThreadFile, type ToolUseContent } from './lib/threadTypes.js';

// Grace period before killing child process on disconnect (30 seconds)
const DISCONNECT_GRACE_PERIOD_MS = 30_000;
// Ping interval for heartbeat (25 seconds, less than typical 30s timeout)
const PING_INTERVAL_MS = 25_000;

// ── Per-thread session ──────────────────────────────────────────────────
// Owns the child process and all mutable state that must survive reconnects.
// Stream listeners always route through `session.currentWs` so a new socket
// immediately picks up where the old one left off.

interface PendingMessage {
  content: string;
  image: ThreadImage | null;
}

interface ThreadSession {
  threadId: string;
  child: ChildProcess | null;
  currentWs: WebSocket | null;
  buffer: string;
  stderrBuffer: string;
  cumulativeCost: number;
  isOpus: boolean;
  connectedAt: number;
  startedAt?: number;
  killTimeout: NodeJS.Timeout | null;
  processing: boolean;
  pendingMessage: PendingMessage | null;
  activeMessage: string | null;
}

const sessions = new Map<string, ThreadSession>();

// ── Public helpers ──────────────────────────────────────────────────────

export function getRunningThreads(): RunningThreadsMap {
  const result: RunningThreadsMap = {};
  for (const [threadId, session] of sessions) {
    let status: RunningThreadState['status'] = 'connected';
    if (session.child) status = 'running';
    if (!session.currentWs) status = 'disconnected';

    result[threadId] = {
      status,
      connectedAt: session.connectedAt,
      startedAt: session.startedAt,
    };
  }
  return result;
}

// ── Amp stream event types ──────────────────────────────────────────────

interface AmpUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  max_tokens?: number;
}

interface AmpContentBlock {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  toolUseID?: string;
  content?: string | unknown[];
  is_error?: boolean;
  run?: { result?: unknown; status?: string };
}

interface AmpStreamEvent {
  type: 'system' | 'assistant' | 'user' | 'result';
  subtype?: string;
  message?: {
    content?: AmpContentBlock[];
    usage?: AmpUsage;
  };
  tool_use_id?: string;
  is_error?: boolean;
  result?: string | Record<string, unknown>;
}

// ── Safe WS send ────────────────────────────────────────────────────────

function sendToSession(session: ThreadSession, message: WsServerMessage): void {
  const ws = session.currentWs;
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  try {
    ws.send(JSON.stringify(message), (err) => {
      if (err) console.warn('[WS] send failed:', err.message);
    });
  } catch (e) {
    console.warn('[WS] send threw:', (e as Error).message);
  }
}

// ── Stream event handler (per-session, references session.currentWs) ────

function handleStreamEvent(session: ThreadSession, event: AmpStreamEvent): void {
  switch (event.type) {
    case 'system':
      sendToSession(session, { type: 'system', subtype: event.subtype || '' });
      break;
    case 'assistant': {
      const content = event.message?.content;
      const usage = event.message?.usage;

      if (usage) {
        const inputTokens = usage.input_tokens || 0;
        const cacheCreationTokens = usage.cache_creation_input_tokens || 0;
        const cacheReadTokens = usage.cache_read_input_tokens || 0;
        const outputTokens = usage.output_tokens || 0;
        const maxTokens = usage.max_tokens || DEFAULT_MAX_CONTEXT_TOKENS;

        const totalContext = inputTokens + cacheCreationTokens + cacheReadTokens;
        const contextPercent = Math.round((totalContext / maxTokens) * 100);

        const messageCost = calculateCost({
          inputTokens,
          cacheCreationTokens,
          cacheReadTokens,
          outputTokens,
          isOpus: session.isOpus,
          turns: 1,
        });

        session.cumulativeCost += messageCost;

        sendToSession(session, {
          type: 'usage',
          contextPercent,
          inputTokens: totalContext,
          outputTokens,
          maxTokens,
          estimatedCost: session.cumulativeCost.toFixed(4),
        });
      }

      if (content) {
        for (const block of content) {
          if (block.type === 'text' && block.text) {
            sendToSession(session, { type: 'text', content: block.text });
          } else if (block.type === 'tool_use' && block.id && block.name) {
            if (isHiddenCostTool(block.name)) {
              let toolCost: number;
              if (block.name === 'Task' && block.input) {
                const prompt = (block.input.prompt as string) || '';
                toolCost = estimateTaskCost(prompt.length);
              } else {
                toolCost = TOOL_COST_ESTIMATES[block.name] || 0;
              }
              session.cumulativeCost += toolCost;
              sendToSession(session, {
                type: 'usage',
                contextPercent: -1,
                inputTokens: 0,
                outputTokens: 0,
                maxTokens: 0,
                estimatedCost: session.cumulativeCost.toFixed(4),
              });
            }
            sendToSession(session, {
              type: 'tool_use',
              id: block.id,
              name: block.name,
              input: block.input as Record<string, unknown>,
            });
          }
        }
      }
      break;
    }
    case 'user': {
      const userContent = event.message?.content;
      if (userContent) {
        for (const block of userContent) {
          if (block.type === 'tool_result') {
            const toolId = block.tool_use_id || block.toolUseID || '';
            let resultStr = '';

            if (block.run?.result !== undefined) {
              if (typeof block.run.result === 'string') {
                resultStr = block.run.result;
              } else {
                resultStr = JSON.stringify(block.run.result);
              }
            } else if (typeof block.content === 'string') {
              resultStr = block.content;
            } else if (Array.isArray(block.content)) {
              resultStr = block.content
                .map(c => typeof c === 'string' ? c : (c as { text?: string }).text || '')
                .join('\n');
            }

            if (resultStr && toolId) {
              sendToSession(session, {
                type: 'tool_result',
                id: toolId,
                success: !block.is_error,
                result: resultStr.slice(0, 10000),
              });
            }
          }
        }
      }
      break;
    }
    case 'result':
      if (event.tool_use_id) {
        let resultStr: string;

        if (typeof event.result === 'string') {
          resultStr = event.result.slice(0, 10000);
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard
        } else if (typeof event.result === 'object' && event.result !== null) {
          const resultObj = event.result as { result?: unknown; status?: string };
          if (resultObj.result !== undefined) {
            if (typeof resultObj.result === 'string') {
              resultStr = resultObj.result.slice(0, 10000);
            } else {
              resultStr = JSON.stringify(resultObj.result).slice(0, 10000);
            }
          } else {
            resultStr = JSON.stringify(event.result).slice(0, 10000);
          }
        } else {
          resultStr = String(event.result).slice(0, 10000);
        }

        sendToSession(session, {
          type: 'tool_result',
          id: event.tool_use_id,
          success: !event.is_error,
          result: resultStr,
        });
      }
      break;
  }
}

// ── Spawn amp child process on a session ────────────────────────────────

async function spawnAmpOnSession(
  session: ThreadSession,
  message: string,
  image: ThreadImage | null = null
): Promise<void> {
  // If a child is already running, interrupt it and queue this message.
  // The SIGINT kills the child before amp persists the user's message to the
  // thread file, so we compose both the interrupted message and the new one
  // into a single prompt for the next spawn.
  if (session.child) {
    const interruptedMsg = session.activeMessage;
    const composed = interruptedMsg
      ? `[The user sent this message but interrupted before you could respond:]\n${interruptedMsg}\n\n[The user then sent this follow-up message:]\n${message}`
      : message;
    session.pendingMessage = { content: composed, image };
    session.child.kill('SIGINT');
    sendToSession(session, { type: 'system', subtype: 'interrupting' });
    return;
  }

  // Serialization guard: prevent the async gap race where two rapid messages
  // both pass the session.child check before either spawns.
  if (session.processing) {
    session.pendingMessage = { content: message, image };
    return;
  }

  session.processing = true;
  try {
    let finalMessage = message;

    if (image) {
      try {
        const threadArtifactsDir = join(ARTIFACTS_DIR, session.threadId);
        await mkdir(threadArtifactsDir, { recursive: true });

        const ext = image.mediaType.split('/')[1] || 'png';
        const filename = `${Date.now()}.${ext}`;
        const imagePath = join(threadArtifactsDir, filename);
        const imageBuffer = Buffer.from(image.data, 'base64');
        await writeFile(imagePath, imageBuffer);

        createArtifact({
          threadId: session.threadId,
          type: 'image',
          title: `Uploaded image ${filename}`,
          content: null,
          filePath: imagePath,
          mediaType: image.mediaType,
        });

        finalMessage = `First, analyze this image: ${imagePath}\n\nThen respond to: ${message}`;
      } catch (e) {
        console.error('[TERM] Failed to save image:', e);
        sendToSession(session, { type: 'error', content: 'Failed to process image' });
      }
    }

    const child = spawn(AMP_BIN, [
      'threads', 'continue', session.threadId,
      '--no-ide',
      '--execute', finalMessage,
      '--stream-json',
    ], {
      cwd: AMP_HOME,
      env: { ...process.env, CI: '1', TERM: 'dumb' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    session.child = child;
    session.startedAt = Date.now();
    session.activeMessage = finalMessage;

    child.on('error', (err: Error) => {
      console.error(`[WS] Child process error for thread ${session.threadId}:`, err.message);
      sendToSession(session, { type: 'error', content: `Failed to start agent: ${err.message}` });
      sendToSession(session, { type: 'done', code: 1 });
      session.child = null;
      session.startedAt = undefined;
      session.activeMessage = null;
    });

    child.stdout.on('data', (data: Buffer) => {
      session.buffer += data.toString();
      const lines = session.buffer.split('\n');
      session.buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const json = JSON.parse(line) as AmpStreamEvent;
          handleStreamEvent(session, json);
        } catch {
          // Skip non-JSON lines
        }
      }
    });

    child.stderr.on('data', (data: Buffer) => {
      session.stderrBuffer += data.toString();
      if (session.stderrBuffer.length > 40000) {
        session.stderrBuffer = session.stderrBuffer.slice(-20000);
      }
    });

    child.on('close', (code: number | null) => {
      // Flush remaining buffered content
      if (session.buffer.trim()) {
        try {
          const json = JSON.parse(session.buffer) as AmpStreamEvent;
          handleStreamEvent(session, json);
        } catch {
          // Ignore
        }
        session.buffer = '';
      }

      const exitCode = code ?? 0;
      const pending = session.pendingMessage;

      // If a message is queued (interrupt-then-send), suppress the error/done
      // from the interrupted child — the client stays in "waiting" state and
      // the pending message will spawn immediately below.
      if (!pending) {
        if (exitCode !== 0) {
          const stderrMsg = session.stderrBuffer.trim();
          sendToSession(session, {
            type: 'error',
            content: stderrMsg || `amp exited with code ${exitCode}`,
          });
        }

        sendToSession(session, { type: 'done', code: exitCode });
      }

      session.stderrBuffer = '';
      session.child = null;
      session.startedAt = undefined;
      session.activeMessage = null;

      if (pending) {
        session.pendingMessage = null;
        void spawnAmpOnSession(session, pending.content, pending.image).catch((err: unknown) => {
          console.error(`[WS] spawnAmp error for queued message on thread ${session.threadId}:`, err);
          sendToSession(session, { type: 'error', content: 'Failed to process queued message' });
        });
      }
    });
  } finally {
    session.processing = false;
  }
}

// ── Initialise session cost/model from thread file ──────────────────────

async function initSessionFromThread(session: ThreadSession): Promise<void> {
  try {
    const threadPath = join(THREADS_DIR, `${session.threadId}.json`);
    const content = await readFile(threadPath, 'utf-8');
    const data = JSON.parse(content) as ThreadFile;
    const tags = data.env?.initial?.tags || [];
    const modelTag = tags.find((t: string) => t.startsWith('model:'));
    if (modelTag) {
      session.isOpus = modelTag.includes('opus');
    }

    const messages = data.messages || [];
    let freshInputTokens = 0;
    let totalOutputTokens = 0;
    let cacheCreation = 0;
    let cacheRead = 0;
    let contextTokens = 0;
    let maxContextTokens = DEFAULT_MAX_CONTEXT_TOKENS;
    let hiddenToolCost = 0;
    let turns = 0;

    for (const msg of messages) {
      if (msg.usage) {
        freshInputTokens += msg.usage.inputTokens || 0;
        totalOutputTokens += msg.usage.outputTokens || 0;
        cacheCreation += msg.usage.cacheCreationInputTokens || 0;
        cacheRead += msg.usage.cacheReadInputTokens || 0;
        contextTokens = msg.usage.totalInputTokens || contextTokens;
        maxContextTokens = msg.usage.maxInputTokens || maxContextTokens;
        turns++;
      }
      if (msg.content && Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (typeof block === 'string' || block.type !== 'tool_use') continue;
          const tool = block as ToolUseContent;
          if (tool.name && isHiddenCostTool(tool.name)) {
            if (tool.name === 'Task') {
              const rawPrompt = tool.input?.prompt;
              const prompt = typeof rawPrompt === 'string' ? rawPrompt : '';
              hiddenToolCost += estimateTaskCost(prompt.length);
            } else {
              hiddenToolCost += TOOL_COST_ESTIMATES[tool.name] || 0;
            }
          }
        }
      }
    }

    session.cumulativeCost = calculateCost({
      inputTokens: freshInputTokens,
      cacheCreationTokens: cacheCreation,
      cacheReadTokens: cacheRead,
      outputTokens: totalOutputTokens,
      isOpus: session.isOpus,
      turns,
    }) + hiddenToolCost;

    const contextPercent = maxContextTokens > 0
      ? Math.round((contextTokens / maxContextTokens) * 100)
      : 0;

    sendToSession(session, {
      type: 'usage',
      contextPercent,
      inputTokens: contextTokens,
      outputTokens: totalOutputTokens,
      maxTokens: maxContextTokens,
      estimatedCost: session.cumulativeCost.toFixed(4),
    });
  } catch {
    // Default to opus pricing if we can't read the thread
  }
}

// ── Disconnect handling ─────────────────────────────────────────────────

function startGracePeriod(session: ThreadSession, reason: string): void {
  if (session.killTimeout) return; // already ticking

  console.warn(`[WS] ${reason} for thread ${session.threadId}, starting ${DISCONNECT_GRACE_PERIOD_MS / 1000}s grace period`);
  session.currentWs = null;

  session.killTimeout = setTimeout(() => {
    console.warn(`[WS] Grace period expired for thread ${session.threadId}, killing child process`);
    session.child?.kill('SIGTERM');
    session.child = null;
    session.killTimeout = null;
    session.startedAt = undefined;
    sessions.delete(session.threadId);
  }, DISCONNECT_GRACE_PERIOD_MS);
}

// ── WebSocket server setup ──────────────────────────────────────────────

export function setupWebSocket(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(request.url || '/', `http://${request.headers.host}`);

    if (url.pathname !== '/ws') {
      return; // Let other handlers (e.g. shell-websocket) handle non-/ws paths
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const threadId = url.searchParams.get('threadId') || '';

    if (!threadId || !/^T-[\w-]+$/.test(threadId)) {
      console.warn('[WS] Rejected connection with invalid threadId:', threadId);
      ws.close(1008, 'Invalid threadId');
      return;
    }

    // ── Get or create session ──────────────────────────────────────────
    let session = sessions.get(threadId);

    if (session) {
      // Cancel any pending kill — we're back
      if (session.killTimeout) {
        clearTimeout(session.killTimeout);
        session.killTimeout = null;
        console.warn(`[WS] Reconnected within grace period for thread ${threadId}`);
      }
      // Swap the socket pointer — child listeners will now route here
      session.currentWs = ws;
    } else {
      session = {
        threadId,
        child: null,
        currentWs: ws,
        buffer: '',
        stderrBuffer: '',
        cumulativeCost: 0,
        isOpus: true,
        connectedAt: Date.now(),
        killTimeout: null,
        processing: false,
        pendingMessage: null,
        activeMessage: null,
      };
      sessions.set(threadId, session);
    }

    // ── Per-connection heartbeat ────────────────────────────────────────
    let isAlive = true;
    const pingInterval = setInterval(() => {
      if (!isAlive) {
        console.warn(`[WS] No pong received for thread ${threadId}, terminating stale connection`);
        ws.terminate();
        return;
      }
      isAlive = false;
      ws.ping();
    }, PING_INTERVAL_MS);

    ws.on('pong', () => {
      isAlive = true;
    });

    // ── Initialise cost/usage from thread file ──────────────────────────
    await initSessionFromThread(session);

    // ── Tell the client we're ready ─────────────────────────────────────
    sendToSession(session, { type: 'ready', threadId });

    // If a child is already running (reconnect mid-run), tell client it's active
    if (session.child) {
      sendToSession(session, { type: 'system', subtype: 'resumed' });
    }

    // ── Client messages ─────────────────────────────────────────────────
    ws.on('message', (data: Buffer) => {
      // Ignore messages from stale sockets
      if (session.currentWs !== ws) return;

      const msg = data.toString();
      let parsed: unknown;
      try {
        parsed = JSON.parse(msg) as unknown;
      } catch {
        sendToSession(session, { type: 'error', content: 'Invalid message format' });
        return;
      }

      if (!isWsClientMessage(parsed)) {
        sendToSession(session, { type: 'error', content: 'Invalid message format' });
        return;
      }

      if (parsed.type === 'message' && parsed.content) {
        const image = parsed.image
          ? ({ data: parsed.image.data, mediaType: parsed.image.mediaType } as ThreadImage)
          : null;
        void spawnAmpOnSession(session, parsed.content, image).catch((err: unknown) => {
          console.error(`[WS] spawnAmp error for thread ${threadId}:`, err);
          sendToSession(session, { type: 'error', content: 'Failed to process message' });
        });
      } else if (parsed.type === 'cancel') {
        if (session.child) {
          session.child.kill('SIGINT');
          sendToSession(session, { type: 'cancelled' });
        }
      }
    });

    // ── Close / error ───────────────────────────────────────────────────
    ws.on('close', () => {
      clearInterval(pingInterval);

      // Only act if this is still the current socket for the session
      if (session.currentWs !== ws) return;

      if (session.child) {
        startGracePeriod(session, 'Connection closed');
      } else {
        sessions.delete(threadId);
      }
    });

    ws.on('error', (err: Error) => {
      console.error('[WS] WebSocket error:', err);
      clearInterval(pingInterval);

      if (session.currentWs !== ws) return;

      if (session.child) {
        startGracePeriod(session, 'Connection error');
      } else {
        sessions.delete(threadId);
      }
    });
  });

  return wss;
}
