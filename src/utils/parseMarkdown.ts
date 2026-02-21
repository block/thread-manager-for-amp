import { formatToolUse, type ToolInput } from './format';

export interface AttachedImage {
  data: string;
  mediaType: string;
}

export interface Message {
  id: string;
  type: 'user' | 'assistant' | 'system' | 'tool_use' | 'tool_result' | 'error' | 'thinking';
  content: string;
  toolName?: string;
  toolId?: string;
  toolInput?: ToolInput;
  success?: boolean;
  image?: AttachedImage;
  isContextLimit?: boolean;
  timestamp?: string; // ISO date string
  interrupted?: boolean;
  queued?: boolean;
}

// Parse a section into individual message blocks
function parseSection(text: string, role: 'user' | 'assistant', sectionIndex: number): Message[] {
  const messages: Message[] = [];
  let localIndex = 0;

  if (role === 'assistant') {
    // Helper: split a text chunk into thinking blocks and plain text, preserving order
    const pushTextWithThinking = (chunk: string) => {
      // Combined regex matching both thinking markers and legacy JSON blocks
      const thinkingRegex =
        /<!--thinking:([\s\S]*?)-->|\{"type":"thinking"[\s\S]*?"provider":"(?:anthropic|openai)"[\s\S]*?\}/g;
      let pos = 0;
      let thinkMatch;

      while ((thinkMatch = thinkingRegex.exec(chunk)) !== null) {
        // Push any plain text before this thinking block
        const before = chunk.slice(pos, thinkMatch.index).trim();
        if (before) {
          messages.push({
            id: `msg-s${sectionIndex}-${localIndex++}`,
            type: 'assistant',
            content: before,
          });
        }

        // Extract thinking text
        let thinkingText = thinkMatch[1]?.trim(); // from marker format
        if (!thinkingText) {
          // Legacy JSON format
          try {
            const parsed = JSON.parse(thinkMatch[0].trim()) as {
              content?: string;
              thinking?: string;
            };
            thinkingText = (parsed.content || parsed.thinking || '').trim();
          } catch {
            // Skip unparseable
          }
        }
        if (thinkingText) {
          messages.push({
            id: `msg-s${sectionIndex}-${localIndex++}`,
            type: 'thinking',
            content: thinkingText,
          });
        }
        pos = thinkMatch.index + thinkMatch[0].length;
      }

      // Push any remaining plain text
      const remaining = chunk.slice(pos).trim();
      if (remaining) {
        messages.push({
          id: `msg-s${sectionIndex}-${localIndex++}`,
          type: 'assistant',
          content: remaining,
        });
      }
    };

    // Find all tool uses
    const toolUseRegex = /\*\*Tool Use:\*\*\s*`(\w+)`\s*```json\s*([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;

    while ((match = toolUseRegex.exec(text)) !== null) {
      // Process text before this tool use (may contain thinking blocks)
      const textBefore = text.slice(lastIndex, match.index);
      pushTextWithThinking(textBefore);

      // Add the tool use
      let input: ToolInput = {};
      try {
        // Unescape triple backticks that were escaped during formatting
        const jsonStr = (match[2] ?? '').replace(/\\`\\`\\`/g, '```');
        input = JSON.parse(jsonStr) as ToolInput;
      } catch {
        /* ignore parse errors */
      }

      messages.push({
        id: `msg-s${sectionIndex}-${localIndex++}`,
        type: 'tool_use',
        content: formatToolUse(match[1] ?? '', input),
        toolName: match[1] ?? '',
        toolInput: input,
      });

      lastIndex = match.index + match[0].length;
    }

    // Process any remaining text after last tool use
    pushTextWithThinking(text.slice(lastIndex));
  } else {
    // User section - find tool results and plain text
    const toolResultRegex = /\*\*Tool Result:\*\*\s*`[^`]*`\s*```([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;

    while ((match = toolResultRegex.exec(text)) !== null) {
      // Add any text before this tool result
      const textBefore = text.slice(lastIndex, match.index).trim();
      if (textBefore) {
        messages.push({
          id: `msg-s${sectionIndex}-${localIndex++}`,
          type: 'user',
          content: textBefore,
        });
      }

      // Add the tool result (skip empty/no output ones)
      // Unescape triple backticks that were escaped during formatting
      const resultContent = (match[1] ?? '').trim().replace(/\\`\\`\\`/g, '```');
      if (resultContent && resultContent !== 'undefined' && resultContent !== '(no output)') {
        messages.push({
          id: `msg-s${sectionIndex}-${localIndex++}`,
          type: 'tool_result',
          content: resultContent,
          success: true,
        });
      }

      lastIndex = match.index + match[0].length;
    }

    // Add any remaining text after last tool result
    const remainingText = text.slice(lastIndex).trim();
    if (remainingText) {
      messages.push({
        id: `msg-s${sectionIndex}-${localIndex}`,
        type: 'user',
        content: remainingText,
      });
    }
  }

  return messages;
}

export function parseMarkdownHistory(markdown: string): Message[] {
  const messages: Message[] = [];

  // Remove YAML frontmatter
  const content = markdown.replace(/^---[\s\S]*?---\n*/, '').trim();
  if (!content) return messages;

  // Remove the title heading
  const withoutTitle = content.replace(/^#\s+[^\n]+\n*/, '').trim();

  // Split by ## User or ## Assistant headers (with optional timestamp comment)
  const sections = withoutTitle.split(
    /^## (User|Assistant)(?:\s*<!--\s*timestamp:([^>]+)\s*-->)?\s*$/m,
  );

  let sectionIndex = 0;
  for (let i = 1; i < sections.length; i += 3) {
    const role = sections[i] as 'User' | 'Assistant';
    const timestamp = sections[i + 1]?.trim() || undefined;
    const sectionText = sections[i + 2]?.trim();

    if (!sectionText) continue;

    const sectionMessages = parseSection(
      sectionText,
      role.toLowerCase() as 'user' | 'assistant',
      sectionIndex++,
    );

    // Apply timestamp to the first message in this section (the main user/assistant message)
    const firstMessage = sectionMessages[0];
    if (firstMessage && timestamp) {
      firstMessage.timestamp = timestamp;
    }

    messages.push(...sectionMessages);
  }

  return messages;
}
