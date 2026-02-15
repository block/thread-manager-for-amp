import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    extends: './vite.config.ts',
    test: {
      name: 'frontend',
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}', 'shared/**/*.test.ts'],
      setupFiles: ['./src/test-setup.ts'],
    },
  },
  {
    test: {
      name: 'server',
      environment: 'node',
      include: ['server/**/*.test.ts'],
    },
  },
]);
