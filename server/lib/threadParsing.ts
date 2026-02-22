/**
 * Thread content parsing and formatting utilities
 */

interface ThinkingBlock {
  type: 'thinking';
  thinking?: string;
  content?: string;
  provider?: string;
  [key: string]: unknown;
}

interface TextBlock {
  type: 'text';
  text?: string;
}

interface ToolUseBlock {
  type: 'tool_use';
  id?: string;
  name: string;
  input?: Record<string, unknown>;
}

interface ToolResultContentItem {
  type?: string;
  text?: string;
  [key: string]: unknown;
}

interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id?: string;
  content?: string | ToolResultContentItem[] | Record<string, unknown>;
}

type ContentBlock = string | TextBlock | ToolUseBlock | ToolResultBlock | Record<string, unknown>;

type MessageContent = string | ContentBlock[];

export function formatMessageContent(content: MessageContent): string {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((block: ContentBlock): string => {
        if (typeof block === 'string') return block;
        if (block.type === 'thinking') {
          const tb = block as ThinkingBlock;
          const text = tb.thinking || tb.content || '';
          if (!text) return '';
          // Emit a marker the frontend parser can recognize
          return `<!--thinking:${text}-->`;
        }
        if (block.type === 'text') return (block as TextBlock).text || '';
        if (block.type === 'tool_use') {
          const toolBlock = block as ToolUseBlock;
          // Escape triple backticks in JSON to prevent markdown code block from closing prematurely
          const jsonStr = JSON.stringify(toolBlock.input || {}, null, 2).replace(
            /```/g,
            '\\`\\`\\`',
          );
          const idComment = toolBlock.id ? ` <!--toolId:${toolBlock.id}-->` : '';
          return `**Tool Use:** \`${toolBlock.name}\`${idComment}\n\n\`\`\`json\n${jsonStr}\n\`\`\``;
        }
        if (block.type === 'tool_result') {
          const resultBlock = block as ToolResultBlock;
          let resultContent = '';

          // Handle nested run.result structure (oracle, subagent, etc.)
          const rawResult = (resultBlock as unknown as Record<string, unknown>).run as
            | { result?: unknown }
            | undefined;
          const nestedResult = rawResult?.result;

          if (nestedResult !== undefined) {
            if (typeof nestedResult === 'string') {
              resultContent = nestedResult;
            } else if (typeof nestedResult === 'object' && nestedResult !== null) {
              // Handle {output, exitCode} structure from Bash
              const outputObj = nestedResult as { output?: string };
              if (outputObj.output !== undefined) {
                resultContent = outputObj.output;
              } else {
                resultContent = JSON.stringify(nestedResult, null, 2);
              }
            }
          } else if (Array.isArray(resultBlock.content)) {
            resultContent = resultBlock.content
              .map((c: string | ToolResultContentItem): string => {
                if (typeof c === 'string') return c;
                if (c.type === 'text' && c.text) return c.text;
                // Skip image blocks in tool results
                if (c.type === 'image') return '[image]';
                return JSON.stringify(c, null, 2);
              })
              .join('\n');
          } else if (typeof resultBlock.content === 'string') {
            resultContent = resultBlock.content;
          } else if (resultBlock.content) {
            resultContent = JSON.stringify(resultBlock.content, null, 2);
          }

          if (!resultContent || resultContent === 'undefined' || resultContent === 'null') {
            resultContent = '(no output)';
          }
          if (resultContent.length > 10000) {
            resultContent = resultContent.slice(0, 10000) + '\n... (truncated)';
          }
          // Escape triple backticks to prevent markdown code block from closing prematurely
          resultContent = resultContent.replace(/```/g, '\\`\\`\\`');
          const toolId =
            resultBlock.tool_use_id ||
            (resultBlock as unknown as Record<string, unknown>).toolUseID ||
            '';
          // eslint-disable-next-line @typescript-eslint/no-base-to-string, @typescript-eslint/restrict-template-expressions -- TODO: type-narrow toolId
          return `**Tool Result:** \`${toolId}\`\n\n\`\`\`\n${resultContent}\n\`\`\``;
        }
        // Skip image blocks - they contain large base64 data
        if (block.type === 'image' || (block as Record<string, unknown>).mediaType) {
          return '[image attached]';
        }
        return JSON.stringify(block);
      })
      .join('\n\n');
  }

  return JSON.stringify(content);
}
