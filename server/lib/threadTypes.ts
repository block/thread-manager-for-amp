import { join } from 'path';
import { homedir } from 'os';
import { AMP_HOME } from './constants.js';
import type { ThreadRelationship } from '../../shared/types.js';

export const ARTIFACTS_DIR = join(homedir(), '.amp-thread-manager', 'artifacts');
export const THREADS_DIR = join(AMP_HOME, '.local', 'share', 'amp', 'threads');

export interface ThreadUsage {
  inputTokens?: number;
  outputTokens?: number;
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;
  totalInputTokens?: number;
  maxInputTokens?: number;
}

export interface TextContent {
  type: 'text';
  text?: string;
}

export interface ImageSource {
  data?: string;
  mediaType?: string;
}

export interface ImageContent {
  type: 'image';
  source?: ImageSource;
  mediaType?: string;
  sourcePath?: string | null;
}

export interface ToolUseContent {
  type: 'tool_use';
  name?: string;
  input?: {
    path?: string;
    old_str?: string;
    new_str?: string;
    content?: string;
    [key: string]: unknown;
  };
}

export type MessageContentBlock = string | TextContent | ImageContent | ToolUseContent | { type: string; [key: string]: unknown };
export type MessageContent = string | MessageContentBlock[];

export interface ThreadMessage {
  role: 'user' | 'assistant' | 'system';
  content: MessageContent;
  usage?: ThreadUsage;
  meta?: {
    sentAt?: number;
  };
}

export interface ThreadTree {
  displayName?: string;
  uri?: string;
  repository?: {
    url?: string;
  };
}

export interface ThreadEnv {
  initial?: {
    tags?: string[];
    trees?: ThreadTree[];
  };
}

export interface ThreadFile {
  title?: string;
  visibility?: 'Private' | 'Public' | 'Workspace';
  created?: number;  // Unix timestamp in milliseconds
  messages?: ThreadMessage[];
  relationships?: ThreadRelationship[];
  env?: ThreadEnv;
}

export interface FileStat {
  file: string;
  mtime: number;
}
