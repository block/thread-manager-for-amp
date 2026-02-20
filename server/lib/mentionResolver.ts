import { readFile } from 'fs/promises';
import { join, resolve } from 'path';
import { THREADS_DIR, isTextContent, type ThreadFile } from './threadTypes.js';

const MAX_FILE_SIZE = 100 * 1024; // 100KB cap for injected file contents
const MAX_FILE_LINES = 2000; // Max lines to inject

export interface ResolvedMessage {
  message: string;
  fileRefs: string[];
  threadRefs: string[];
}

interface ParsedFileRef {
  path: string;
  lineStart?: number;
  lineEnd?: number;
}

// Match @T-<uuid-like> (thread references — T- prefix distinguishes from files)
// Must be at start of string or after whitespace
const THREAD_REF_RE = /(?:^|(?<=\s))@(T-[\w-]+)/g;

// Match @<filepath> (file references — no spaces, starts at word boundary)
// Must not match thread refs (@T-xxx) or emails (word@word)
// Supports optional #L<n> or #L<n>-L<m> suffix
const FILE_REF_RE = /(?:^|(?<=\s))@((?!T-)[^\s@]+)/g;

function parseFileRef(raw: string): ParsedFileRef {
  const lineMatch = raw.match(/#L(\d+)(?:-L?(\d+))?$/);
  if (lineMatch) {
    const path = raw.slice(0, raw.indexOf('#'));
    const lineStart = parseInt(lineMatch[1] ?? '0', 10);
    const lineEnd = lineMatch[2] ? parseInt(lineMatch[2], 10) : undefined;
    return { path, lineStart, lineEnd };
  }
  return { path: raw };
}

async function readFileContents(
  filePath: string,
  workspacePath: string | null,
  lineStart?: number,
  lineEnd?: number,
): Promise<string | null> {
  try {
    // Resolve relative to workspace
    const fullPath = workspacePath ? resolve(workspacePath, filePath) : resolve(filePath);

    // Security: ensure resolved path is within the workspace
    if (workspacePath) {
      const resolvedWorkspace = resolve(workspacePath);
      if (!fullPath.startsWith(resolvedWorkspace + '/') && fullPath !== resolvedWorkspace) {
        return null;
      }
    }

    const content = await readFile(fullPath, 'utf-8');

    // Check size
    if (content.length > MAX_FILE_SIZE) {
      return `[File ${filePath} is too large (${Math.round(content.length / 1024)}KB). Showing first ${MAX_FILE_LINES} lines.]\n\n${content.split('\n').slice(0, MAX_FILE_LINES).join('\n')}`;
    }

    // Apply line range if specified
    if (lineStart !== undefined) {
      const lines = content.split('\n');
      const start = Math.max(0, lineStart - 1); // 1-indexed to 0-indexed
      const end = lineEnd !== undefined ? lineEnd : lineStart;
      const sliced = lines.slice(start, end);
      return sliced.join('\n');
    }

    return content;
  } catch {
    return null;
  }
}

async function getThreadTitle(threadId: string): Promise<string | null> {
  try {
    const filePath = join(THREADS_DIR, `${threadId}.json`);
    const content = await readFile(filePath, 'utf-8');
    const data = JSON.parse(content) as ThreadFile;
    if (data.title) return data.title;

    const firstUser = data.messages?.find((m) => m.role === 'user');
    if (firstUser?.content) {
      const text =
        typeof firstUser.content === 'string'
          ? firstUser.content
          : Array.isArray(firstUser.content)
            ? firstUser.content
                .filter(isTextContent)
                .map((c) => c.text || '')
                .join(' ')
            : '';
      return text.slice(0, 60).replace(/\n/g, ' ').trim() || null;
    }
    return null;
  } catch {
    return null;
  }
}

export async function resolveMessageReferences(
  message: string,
  workspacePath: string | null = null,
): Promise<ResolvedMessage> {
  const fileRefs: string[] = [];
  const threadRefs: string[] = [];

  // Extract thread refs first (@T-xxx) — must check before file refs
  const threadMatches = [...message.matchAll(THREAD_REF_RE)];
  for (const match of threadMatches) {
    if (match[1]) threadRefs.push(match[1]);
  }

  // Extract file refs (@path) — excludes @T-xxx (already captured)
  const fileMatches = [...message.matchAll(FILE_REF_RE)];
  for (const match of fileMatches) {
    if (match[1]) fileRefs.push(match[1]);
  }

  // If no refs, return unchanged
  if (fileRefs.length === 0 && threadRefs.length === 0) {
    return { message, fileRefs, threadRefs };
  }

  // Strip ref tokens from the message
  let cleanMessage = message;

  for (const ref of threadRefs) {
    cleanMessage = cleanMessage.replace(`@${ref}`, '').trim();
  }
  for (const ref of fileRefs) {
    cleanMessage = cleanMessage.replace(`@${ref}`, '').trim();
  }

  // Clean up extra whitespace
  cleanMessage = cleanMessage.replace(/\s+/g, ' ').trim();

  // Build context sections
  const parts: string[] = [];

  // Resolve file references — inject actual contents
  if (fileRefs.length > 0) {
    const fileBlocks = await Promise.all(
      fileRefs.map(async (raw) => {
        const parsed = parseFileRef(raw);
        const lineLabel =
          parsed.lineStart !== undefined
            ? parsed.lineEnd !== undefined
              ? ` (lines ${parsed.lineStart}-${parsed.lineEnd})`
              : ` (line ${parsed.lineStart})`
            : '';

        const contents = await readFileContents(
          parsed.path,
          workspacePath,
          parsed.lineStart,
          parsed.lineEnd,
        );

        if (contents !== null) {
          return `<file path="${parsed.path}"${lineLabel}>\n${contents}\n</file>`;
        } else {
          return `<file path="${parsed.path}"${lineLabel}>[Could not read file]</file>`;
        }
      }),
    );
    parts.push(`The user has referenced the following files:\n\n${fileBlocks.join('\n\n')}`);
  }

  // Resolve thread references
  if (threadRefs.length > 0) {
    const threadDescriptions = await Promise.all(
      threadRefs.map(async (id) => {
        const title = await getThreadTitle(id);
        return title ? `- Thread ${id}: "${title}"` : `- Thread ${id}`;
      }),
    );
    parts.push(
      `The user has referenced the following threads for context:\n${threadDescriptions.join('\n')}`,
    );
  }

  if (cleanMessage) {
    parts.push(cleanMessage);
  }

  return {
    message: parts.join('\n\n'),
    fileRefs,
    threadRefs,
  };
}
