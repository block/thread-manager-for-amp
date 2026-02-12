import { createServer, IncomingMessage, ServerResponse } from 'http';
import { PORT, CORS_HEADERS } from './lib/constants.js';
import { serveStatic } from './lib/utils.js';
import { handleThreadRoutes } from './routes/threads.js';
import { handleGitRoutes } from './routes/git.js';
import { handleSkillRoutes } from './routes/skills.js';
import { handleMetadataRoutes } from './routes/metadata.js';
import { handleArtifactRoutes } from './routes/artifacts.js';
import { setupWebSocket } from './websocket.js';
import { setupShellWebSocket } from './shell-websocket.js';

// Prevent silent crashes from unhandled errors
process.on('unhandledRejection', (reason) => {
  console.error('[PROCESS] Unhandled rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[PROCESS] Uncaught exception:', err);
});

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  // Set CORS headers for all responses
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    res.setHeader(key, value);
  }

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url!, `http://${req.headers.host}`);

  try {
    // Try each route handler
    if (await handleThreadRoutes(url, req, res)) return;
    if (await handleGitRoutes(url, req, res)) return;
    if (await handleSkillRoutes(url, req, res)) return;
    if (await handleMetadataRoutes(url, req, res)) return;
    if (await handleArtifactRoutes(url, req, res)) return;

    // Fallback to static file serving
    await serveStatic(req, res);
  } catch (err) {
    console.error(`Unhandled error for ${req.method} ${url.pathname}:`, err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  }
});

// Set up WebSockets
setupWebSocket(server);
setupShellWebSocket(server);

server.listen(PORT, '127.0.0.1', () => {
  console.log(`🚀 Thread Manager for Amp running at http://localhost:${PORT}`);
  console.log(`📡 WebSocket server ready`);
  console.log(`💻 Shell WebSocket ready at /shell`);
});
