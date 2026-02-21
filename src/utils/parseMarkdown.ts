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
}

// Parse a section into individual message blocks
function parseSection(text: string, role: 'user' | 'assistant', sectionIndex: number): Message[] {
  const messages: Message[] = [];
  let localIndex = 0;

  if (role === 'assistant') {
    // Extract thinking markers (<!--thinking:text-->) emitted by the server
    const thinkingMarkerRegex = /<!--thinking:([\s\S]*?)-->\s*/g;
    let thinkingMatch;
    while ((thinkingMatch = thinkingMarkerRegex.exec(text)) !== null) {
      const thinkingText = thinkingMatch[1]?.trim();
      if (thinkingText) {
        messages.push({
          id: `msg-s${sectionIndex}-${localIndex++}`,
          type: 'thinking',
          content: thinkingText,
        });
      }
    }
    let cleanText = text.replace(thinkingMarkerRegex, '');

    // Also handle legacy thinking JSON blocks (from older threads)
    const thinkingJsonRegex =
      /\{"type":"thinking"[\s\S]*?"provider":"(?:anthropic|openai)"[\s\S]*?\}\s*/g;
    let jsonMatch;
    while ((jsonMatch = thinkingJsonRegex.exec(cleanText)) !== null) {
      try {
        const parsed = JSON.parse(jsonMatch[0].trim()) as {
          content?: string;
          thinking?: string;
        };
        const jsonThinkingText = parsed.content || parsed.thinking;
        if (jsonThinkingText) {
          messages.push({
            id: `msg-s${sectionIndex}-${localIndex++}`,
            type: 'thinking',
            content: jsonThinkingText,
          });
        }
      } catch {
        // Skip unparseable thinking blocks
      }
    }
    cleanText = cleanText.replace(thinkingJsonRegex, '');

    // Find all tool uses
    const toolUseRegex = /\*\*Tool Use:\*\*\s*`(\w+)`\s*```json\s*([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;

    while ((match = toolUseRegex.exec(cleanText)) !== null) {
      // Add any text before this tool use
      const textBefore = cleanText.slice(lastIndex, match.index).trim();
      if (textBefore) {
        messages.push({
          id: `msg-s${sectionIndex}-${localIndex++}`,
          type: 'assistant',
          content: textBefore,
        });
      }

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

    // Add any remaining text after last tool use
    const remainingText = cleanText.slice(lastIndex).trim();
    if (remainingText) {
      messages.push({
        id: `msg-s${sectionIndex}-${localIndex}`,
        type: 'assistant',
        content: remainingText,
      });
    }
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
