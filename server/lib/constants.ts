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

// Only allow requests from localhost origins (or no origin for same-origin / non-browser clients)
export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

export function getCorsHeaders(origin: string | undefined): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  if (origin && isAllowedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Vary'] = 'Origin';
  }
  return headers;
}

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

export { DEFAULT_MAX_CONTEXT_TOKENS } from '../../shared/constants.js';
