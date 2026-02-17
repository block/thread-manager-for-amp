import type { WsClientMessage, ShellClientMessage } from './websocket.js';

/**
 * Runtime type guard for WsClientMessage.
 * Validates the `type` discriminant and required fields for each variant.
 */
export function isWsClientMessage(data: unknown): data is WsClientMessage {
  if (typeof data !== 'object' || data === null) return false;

  const obj = data as Record<string, unknown>;

  if (obj.type === 'message') {
    return typeof obj.content === 'string';
  }

  if (obj.type === 'cancel') {
    return true;
  }

  return false;
}

/**
 * Runtime type guard for ShellClientMessage.
 * Validates the `type` discriminant and required fields for each variant.
 */
export function isShellClientMessage(data: unknown): data is ShellClientMessage {
  if (typeof data !== 'object' || data === null) return false;

  const obj = data as Record<string, unknown>;

  switch (obj.type) {
    case 'input':
      return true;
    case 'resize':
      return true;
    case 'ping':
      return true;
    default:
      return false;
  }
}
