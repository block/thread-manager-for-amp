import { readFile } from 'fs/promises';
import { join } from 'path';
import { THREADS_DIR, isTextContent, type ThreadFile } from './threadTypes.js';

export interface ResolvedMessage {
  message: string;
  fileRefs: string[];
  threadRefs: string[];
}

// Match @@T-<uuid-like> (thread references)
const THREAD_REF_RE = /(?:^|(?<=\s))@@(T-[\w-]+)/g;

// Match @<filepath> (file references — no spaces, starts at word boundary)
// Must not match email patterns (word@word) — require @ at start or after whitespace
const FILE_REF_RE = /(?:^|(?<=\s))@((?!@)[^\s]+)/g;

async function getThreadTitle(threadId: string): Promise<string | null> {
  try {
    const filePath = join(THREADS_DIR, `${threadId}.json`);
    const content = await readFile(filePath, 'utf-8');
    const data = JSON.parse(content) as ThreadFile;
    if (data.title) return data.title;

    // Fall back to first user message
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

export async function resolveMessageReferences(message: string): Promise<ResolvedMessage> {
  const fileRefs: string[] = [];
  const threadRefs: string[] = [];

  // Extract thread refs first (@@T-xxx)
  const threadMatches = [...message.matchAll(THREAD_REF_RE)];
  for (const match of threadMatches) {
    if (match[1]) threadRefs.push(match[1]);
  }

  // Extract file refs (@path) — but not thread refs
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
    cleanMessage = cleanMessage.replace(`@@${ref}`, '').trim();
  }
  for (const ref of fileRefs) {
    cleanMessage = cleanMessage.replace(`@${ref}`, '').trim();
  }

  // Clean up extra whitespace
  cleanMessage = cleanMessage.replace(/\s+/g, ' ').trim();

  // Build context prefix
  const parts: string[] = [];

  if (fileRefs.length > 0) {
    parts.push(
      `The user has referenced the following files (read them if relevant to the task):\n${fileRefs.map((f) => `- ${f}`).join('\n')}`,
    );
  }

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
