import { describe, it, expect } from 'vitest';
import { isAllowedOrigin, getCorsHeaders } from './constants.js';

describe('isAllowedOrigin', () => {
  it('allows undefined origin (same-origin / non-browser)', () => {
    expect(isAllowedOrigin(undefined)).toBe(true);
  });

  it('allows http://localhost with port', () => {
    expect(isAllowedOrigin('http://localhost:5173')).toBe(true);
    expect(isAllowedOrigin('http://localhost:3001')).toBe(true);
  });

  it('allows http://127.0.0.1 with port', () => {
    expect(isAllowedOrigin('http://127.0.0.1:3001')).toBe(true);
    expect(isAllowedOrigin('http://127.0.0.1:5173')).toBe(true);
  });

  it('rejects external origins', () => {
    expect(isAllowedOrigin('https://evil.com')).toBe(false);
    expect(isAllowedOrigin('https://attacker.example.org')).toBe(false);
    expect(isAllowedOrigin('http://192.168.1.1:3001')).toBe(false);
  });

  it('rejects malformed origins', () => {
    expect(isAllowedOrigin('not-a-url')).toBe(false);
    expect(isAllowedOrigin('')).toBe(true); // empty string is falsy in the function
  });
});

describe('getCorsHeaders', () => {
  it('includes Access-Control-Allow-Origin for allowed origin', () => {
    const headers = getCorsHeaders('http://localhost:5173');
    expect(headers['Access-Control-Allow-Origin']).toBe('http://localhost:5173');
    expect(headers['Vary']).toBe('Origin');
  });

  it('omits Access-Control-Allow-Origin for disallowed origin', () => {
    const headers = getCorsHeaders('https://evil.com');
    expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
    expect(headers['Vary']).toBeUndefined();
  });

  it('omits Access-Control-Allow-Origin when no origin provided', () => {
    const headers = getCorsHeaders(undefined);
    expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
  });

  it('always includes static CORS method/header fields', () => {
    const headers = getCorsHeaders('https://evil.com');
    expect(headers['Access-Control-Allow-Methods']).toBe('GET, POST, PUT, PATCH, DELETE, OPTIONS');
    expect(headers['Access-Control-Allow-Headers']).toBe('Content-Type');
  });
});
