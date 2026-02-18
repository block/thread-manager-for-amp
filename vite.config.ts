import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

function getServerPort(): number {
  const portFile = '.server-port';
  if (existsSync(portFile)) {
    const port = parseInt(readFileSync(portFile, 'utf-8').trim(), 10);
    if (!isNaN(port)) return port;
  }
  return parseInt(process.env.PORT || '3001', 10);
}

export default defineConfig(() => {
  const serverPort = getServerPort();

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@shared': path.resolve(__dirname, 'shared'),
      },
    },
    server: {
      host: '0.0.0.0',
      strictPort: false,
      proxy: {
        '/api': {
          target: `http://localhost:${serverPort}`,
          changeOrigin: true,
        },
        '/ws': {
          target: `ws://localhost:${serverPort}`,
          ws: true,
        },
        '/shell': {
          target: `ws://localhost:${serverPort}`,
          ws: true,
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            markdown: ['react-markdown', 'remark-gfm'],
            vendor: ['react', 'react-dom'],
            icons: ['lucide-react'],
            terminal: ['@xterm/xterm', '@xterm/addon-fit'],
          },
        },
      },
    },
  };
});
