import { readFile } from 'fs/promises';
import { getArtifacts } from './database.js';
import { formatMessageContent } from './threadParsing.js';
import type { ThreadImage, Artifact } from '../../shared/types.js';
import { isImageContent, type ThreadMessage } from './threadTypes.js';
import { readThreadFile } from './threadProvider.js';

export async function getThreadMarkdown(
  threadId: string,
  limit: number = 50,
  offset: number = 0,
): Promise<string> {
  const data = await readThreadFile(threadId);

  let messages = data.messages || [];
  const totalMessages = messages.length;

  // Calculate slice from the end
  if (limit > 0) {
    const endIdx = totalMessages - offset;
    const startIdx = Math.max(0, endIdx - limit);
    messages = messages.slice(startIdx, endIdx);
  }

  const title = data.title || threadId;
  const created = data.created || new Date().toISOString();
  const tags = data.env?.initial?.tags || [];
  const modelTag = tags.find((t) => t.startsWith('model:'));
  const agentMode = modelTag ? modelTag.replace('model:', '') : 'unknown';

  let markdown = `---
title: ${title}
threadId: ${threadId}
created: ${created}
agentMode: ${agentMode}
totalMessages: ${totalMessages}
offset: ${offset}
---

# ${title}

`;

  for (const msg of messages) {
    const timestamp = msg.meta?.sentAt ? new Date(msg.meta.sentAt).toISOString() : '';
    if (msg.role === 'user') {
      markdown += `## User${timestamp ? ` <!-- timestamp:${timestamp} -->` : ''}\n\n`;
      const formattedContent = formatMessageContent(
        msg.content as Parameters<typeof formatMessageContent>[0],
      );
      markdown += formattedContent + '\n\n';
    } else if (msg.role === 'assistant') {
      markdown += `## Assistant${timestamp ? ` <!-- timestamp:${timestamp} -->` : ''}\n\n`;
      const formattedContent = formatMessageContent(
        msg.content as Parameters<typeof formatMessageContent>[0],
      );
      markdown += formattedContent + '\n\n';
    }
  }

  return markdown;
}

export async function getThreadImages(threadId: string): Promise<ThreadImage[]> {
  const images: ThreadImage[] = [];

  // 1. Get images from artifacts table
  try {
    const artifacts: Artifact[] = getArtifacts(threadId);
    for (const artifact of artifacts) {
      if (artifact.type === 'image' && artifact.file_path) {
        try {
          const imageData = await readFile(artifact.file_path);
          images.push({
            mediaType: artifact.media_type || 'image/png',
            data: imageData.toString('base64'),
            sourcePath: artifact.file_path,
          });
        } catch {
          // File might have been deleted
        }
      }
    }
  } catch {
    // Database might not have artifacts yet
  }

  // 2. Get images from thread JSON (inline base64 from Amp CLI)
  try {
    const data = await readThreadFile(threadId);
    const messages = data.messages || [];

    for (const msg of messages) {
      if (msg.role === 'user' && Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (isImageContent(block)) {
            if (block.source?.data) {
              images.push({
                mediaType: block.mediaType || block.source.mediaType || 'image/png',
                data: block.source.data,
                sourcePath: block.sourcePath || null,
              });
            }
          }
        }
      }
    }
  } catch {
    // Thread JSON might not exist or have images
  }

  return images;
}

export async function getThreadMessages(
  threadId: string,
): Promise<{ messages: ThreadMessage[]; title?: string }> {
  const data = await readThreadFile(threadId);
  return { messages: data.messages || [], title: data.title };
}
