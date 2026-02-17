let msgCounter = 0;

export function generateId(): string {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- crypto.randomUUID may not exist in all runtimes
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `msg-${crypto.randomUUID()}`;
  }
  return `msg-${Date.now()}-${++msgCounter}`;
}

export function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '');
}
