import type { Message } from './parseMarkdown';
import { formatToolUse, type ToolInput } from './format';

interface ThreadMessageContent {
  type: string;
  text?: string;
  name?: string;
  input?: ToolInput;
  content?: string | Array<{ type: string; text?: string }>;
  [key: string]: unknown;
}

interface ThreadMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | ThreadMessageContent[];
  meta?: { sentAt?: number };
}

let replayIdCounter = 0;
function nextReplayId(): string {
  return `replay-${++replayIdCounter}`;
}

export function resetReplayIdCounter(): void {
  replayIdCounter = 0;
}

function extractTextFromContent(content: string | ThreadMessageContent[]): string {
  if (typeof content === 'string') return content;
  const parts: string[] = [];
  for (const block of content) {
    if (block.type === 'text' && block.text) {
      parts.push(block.text);
    }
  }
  return parts.join('\n');
}

export function parseReplayMessages(raw: ThreadMessage[]): Message[] {
  resetReplayIdCounter();
  const messages: Message[] = [];

  for (const msg of raw) {
    const timestamp = msg.meta?.sentAt ? new Date(msg.meta.sentAt).toISOString() : undefined;

    if (msg.role === 'user') {
      const text = extractTextFromContent(msg.content);
      if (text) {
        messages.push({
          id: nextReplayId(),
          type: 'user',
          content: text,
          timestamp,
        });
      }
    } else if (msg.role === 'assistant') {
      if (typeof msg.content === 'string') {
        if (msg.content) {
          messages.push({
            id: nextReplayId(),
            type: 'assistant',
            content: msg.content,
            timestamp,
          });
        }
      } else if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.type === 'text' && block.text) {
            messages.push({
              id: nextReplayId(),
              type: 'assistant',
              content: block.text,
              timestamp,
            });
          } else if (block.type === 'tool_use' && block.name) {
            const input: ToolInput = block.input ?? {};
            messages.push({
              id: nextReplayId(),
              type: 'tool_use',
              content: formatToolUse(block.name, input),
              toolName: block.name,
              toolInput: input,
            });
          } else if (block.type === 'tool_result') {
            const resultText =
              typeof block.content === 'string'
                ? block.content
                : Array.isArray(block.content)
                  ? block.content
                      .filter((c) => c.type === 'text' && c.text)
                      .map((c) => c.text)
                      .join('\n')
                  : '';
            if (resultText) {
              messages.push({
                id: nextReplayId(),
                type: 'tool_result',
                content: resultText,
                success: true,
              });
            }
          }
        }
      }
    }
  }

  return messages;
}
