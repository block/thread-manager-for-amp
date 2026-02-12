import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'markdown': ['react-markdown', 'remark-gfm'],
          'vendor': ['react', 'react-dom'],
          'icons': ['lucide-react'],
          'terminal': ['@xterm/xterm', '@xterm/addon-fit'],
        }
      }
    }
  }
});
