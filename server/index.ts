import { createServer, IncomingMessage, ServerResponse } from 'http';
import { createServer as createNetServer } from 'net';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { PORT, getCorsHeaders } from './lib/constants.js';
import { serveStatic } from './lib/utils.js';
import { handleThreadRoutes } from './routes/threads.js';
import { handleGitRoutes } from './routes/git.js';
import { handleSkillRoutes } from './routes/skills.js';
import { handleMetadataRoutes } from './routes/metadata.js';
import { handleArtifactRoutes } from './routes/artifacts.js';
import { handleReviewRoutes } from './routes/review.js';
import { setupWebSocket } from './websocket.js';
import { setupShellWebSocket } from './shell-websocket.js';
import { startPromptHistoryBackfill } from './lib/promptHistory.js';

const PORT_FILE = join(import.meta.dirname, '..', '.server-port');

// Prevent silent crashes from unhandled errors
process.on('unhandledRejection', (reason) => {
  console.error('[PROCESS] Unhandled rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[PROCESS] Uncaught exception:', err);
});

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = createNetServer();
    tester.once('error', () => resolve(false));
    tester.once('listening', () => {
      tester.close(() => resolve(true));
    });
    tester.listen(port, '127.0.0.1');
  });
}

async function findAvailablePort(startPort: number, maxAttempts = 10): Promise<number> {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(
    `No available port found between ${startPort} and ${startPort + maxAttempts - 1}`,
  );
}

function cleanupPortFile(): void {
  try {
    unlinkSync(PORT_FILE);
  } catch {
    // File may not exist
  }
}

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  // Set CORS headers for all responses (dynamic per-request origin check)
  const corsHeaders = getCorsHeaders(req.headers.origin);
  for (const [key, value] of Object.entries(corsHeaders)) {
    res.setHeader(key, value);
  }

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

  try {
    // Try each route handler
    if (await handleThreadRoutes(url, req, res)) return;
    if (await handleGitRoutes(url, req, res)) return;
    if (await handleSkillRoutes(url, req, res)) return;
    if (await handleMetadataRoutes(url, req, res)) return;
    if (await handleArtifactRoutes(url, req, res)) return;
    if (await handleReviewRoutes(url, req, res)) return;

    // Fallback to static file serving
    await serveStatic(req, res);
  } catch (err) {
    console.error(`Unhandled error for ${req.method} ${url.pathname}:`, err);
    if (!res.headersSent) {
      const message = err instanceof Error ? err.message : 'Internal server error';
      const status = message === 'Request body too large' ? 413 : 500;
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: message }));
    }
  }
});

// Set up WebSockets
setupWebSocket(server);
setupShellWebSocket(server);

// Clean up port file on exit
process.on('exit', cleanupPortFile);
process.on('SIGINT', () => {
  cleanupPortFile();
  process.exit(0);
});
process.on('SIGTERM', () => {
  cleanupPortFile();
  process.exit(0);
});

async function start(): Promise<void> {
  const port = await findAvailablePort(PORT);
  writeFileSync(PORT_FILE, String(port), 'utf-8');

  server.listen(port, '127.0.0.1', () => {
    console.warn(`🚀 Thread Manager for Amp running at http://localhost:${port}`);
    console.warn(`📡 WebSocket server ready`);
    console.warn(`💻 Shell WebSocket ready at /shell`);
    startPromptHistoryBackfill();
  });
}

start().catch((err: unknown) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
