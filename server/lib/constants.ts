import { homedir } from 'os';
import { join } from 'path';
import { existsSync } from 'fs';

export const PORT: number = parseInt(process.env.PORT || '3001', 10);
export const AMP_HOME: string = process.env.AMP_HOME || homedir();

function findAmpBin(): string {
  if (process.env.AMP_BIN) return process.env.AMP_BIN;
  const localBin = join(homedir(), '.local', 'bin', 'amp');
  if (existsSync(localBin)) return localBin;
  return 'amp';
}
export const AMP_BIN: string = findAmpBin();

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
} as const;

export const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// Default context window for Claude models (Sonnet 4/Opus 4)
export const DEFAULT_MAX_CONTEXT_TOKENS = 168000;
