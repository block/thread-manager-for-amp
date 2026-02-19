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

export type MessageContentBlock =
  | string
  | TextContent
  | ImageContent
  | ToolUseContent
  | { type: string; [key: string]: unknown };
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
  created?: number; // Unix timestamp in milliseconds
  messages?: ThreadMessage[];
  relationships?: ThreadRelationship[];
  env?: ThreadEnv;
}

export interface FileStat {
  file: string;
  mtime: number;
}

// ── Type guards for parsed JSON content blocks ──────────────────────────
// These accept `unknown` because thread JSON is external data that may not
// conform to the TypeScript types at runtime.

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isTextContent(value: unknown): value is TextContent {
  return isObject(value) && value.type === 'text';
}

export function isToolUseContent(value: unknown): value is ToolUseContent {
  return isObject(value) && value.type === 'tool_use';
}

export function isImageContent(value: unknown): value is ImageContent {
  return isObject(value) && value.type === 'image';
}

export function isHandoffRelationship(
  value: unknown,
): value is { type: 'handoff'; role: 'parent' | 'child'; threadID: string; comment?: string } {
  return (
    isObject(value) &&
    value.type === 'handoff' &&
    (value.role === 'parent' || value.role === 'child') &&
    typeof value.threadID === 'string'
  );
}
