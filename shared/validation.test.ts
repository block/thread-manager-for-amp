import { describe, it, expect } from 'vitest';
import { isWsClientMessage, isShellClientMessage } from './validation.js';

describe('isWsClientMessage', () => {
  it('accepts a valid message with content', () => {
    expect(isWsClientMessage({ type: 'message', content: 'hello' })).toBe(true);
  });

  it('accepts a message with optional image field', () => {
    expect(
      isWsClientMessage({
        type: 'message',
        content: 'analyze this',
        image: { data: 'base64...', mediaType: 'image/png' },
      }),
    ).toBe(true);
  });

  it('accepts a valid cancel message', () => {
    expect(isWsClientMessage({ type: 'cancel' })).toBe(true);
  });

  it('rejects message type with missing content', () => {
    expect(isWsClientMessage({ type: 'message' })).toBe(false);
  });

  it('rejects message type with non-string content', () => {
    expect(isWsClientMessage({ type: 'message', content: 123 })).toBe(false);
  });

  it('rejects unknown type', () => {
    expect(isWsClientMessage({ type: 'unknown' })).toBe(false);
  });

  it('rejects null', () => {
    expect(isWsClientMessage(null)).toBe(false);
  });

  it('rejects undefined', () => {
    expect(isWsClientMessage(undefined)).toBe(false);
  });

  it('rejects primitive string', () => {
    expect(isWsClientMessage('hello')).toBe(false);
  });

  it('rejects empty object', () => {
    expect(isWsClientMessage({})).toBe(false);
  });

  it('rejects array', () => {
    expect(isWsClientMessage([{ type: 'cancel' }])).toBe(false);
  });

  it('accepts a message with valid mode', () => {
    expect(isWsClientMessage({ type: 'message', content: 'hello', mode: 'smart' })).toBe(true);
    expect(isWsClientMessage({ type: 'message', content: 'hello', mode: 'rush' })).toBe(true);
    expect(isWsClientMessage({ type: 'message', content: 'hello', mode: 'deep' })).toBe(true);
    expect(isWsClientMessage({ type: 'message', content: 'hello', mode: 'large' })).toBe(true);
  });

  it('accepts a message without mode (optional)', () => {
    expect(isWsClientMessage({ type: 'message', content: 'hello' })).toBe(true);
  });

  it('rejects a message with invalid mode', () => {
    expect(isWsClientMessage({ type: 'message', content: 'hello', mode: 'turbo' })).toBe(false);
    expect(isWsClientMessage({ type: 'message', content: 'hello', mode: 123 })).toBe(false);
    expect(isWsClientMessage({ type: 'message', content: 'hello', mode: '' })).toBe(false);
  });

  it('accepts a message with valid deepReasoningEffort', () => {
    expect(
      isWsClientMessage({
        type: 'message',
        content: 'hello',
        mode: 'deep',
        deepReasoningEffort: 'medium',
      }),
    ).toBe(true);
    expect(
      isWsClientMessage({
        type: 'message',
        content: 'hello',
        mode: 'deep',
        deepReasoningEffort: 'high',
      }),
    ).toBe(true);
    expect(
      isWsClientMessage({
        type: 'message',
        content: 'hello',
        mode: 'deep',
        deepReasoningEffort: 'xhigh',
      }),
    ).toBe(true);
  });

  it('accepts a message without deepReasoningEffort (optional)', () => {
    expect(isWsClientMessage({ type: 'message', content: 'hello', mode: 'deep' })).toBe(true);
  });

  it('rejects a message with invalid deepReasoningEffort', () => {
    expect(
      isWsClientMessage({ type: 'message', content: 'hello', deepReasoningEffort: 'ultra' }),
    ).toBe(false);
    expect(isWsClientMessage({ type: 'message', content: 'hello', deepReasoningEffort: 123 })).toBe(
      false,
    );
    expect(isWsClientMessage({ type: 'message', content: 'hello', deepReasoningEffort: '' })).toBe(
      false,
    );
  });

  it('accepts a valid shell_exec message', () => {
    expect(isWsClientMessage({ type: 'shell_exec', command: 'ls -la', incognito: false })).toBe(
      true,
    );
    expect(isWsClientMessage({ type: 'shell_exec', command: 'pwd', incognito: true })).toBe(true);
  });

  it('rejects shell_exec with missing command', () => {
    expect(isWsClientMessage({ type: 'shell_exec', incognito: false })).toBe(false);
  });

  it('rejects shell_exec with non-string command', () => {
    expect(isWsClientMessage({ type: 'shell_exec', command: 123, incognito: false })).toBe(false);
  });

  it('rejects shell_exec with missing incognito', () => {
    expect(isWsClientMessage({ type: 'shell_exec', command: 'ls' })).toBe(false);
  });

  it('rejects shell_exec with non-boolean incognito', () => {
    expect(isWsClientMessage({ type: 'shell_exec', command: 'ls', incognito: 'yes' })).toBe(false);
  });
});

describe('isShellClientMessage', () => {
  it('accepts a valid input message', () => {
    expect(isShellClientMessage({ type: 'input', data: 'ls\n' })).toBe(true);
  });

  it('accepts input message without data (optional field)', () => {
    expect(isShellClientMessage({ type: 'input' })).toBe(true);
  });

  it('accepts a valid resize message', () => {
    expect(isShellClientMessage({ type: 'resize', cols: 80, rows: 24 })).toBe(true);
  });

  it('accepts resize message without dimensions (optional fields)', () => {
    expect(isShellClientMessage({ type: 'resize' })).toBe(true);
  });

  it('accepts a valid ping message', () => {
    expect(isShellClientMessage({ type: 'ping' })).toBe(true);
  });

  it('rejects unknown type', () => {
    expect(isShellClientMessage({ type: 'execute' })).toBe(false);
  });

  it('rejects null', () => {
    expect(isShellClientMessage(null)).toBe(false);
  });

  it('rejects empty object', () => {
    expect(isShellClientMessage({})).toBe(false);
  });

  it('rejects primitive number', () => {
    expect(isShellClientMessage(42)).toBe(false);
  });
});
