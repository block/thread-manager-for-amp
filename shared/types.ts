// Shared types between frontend and backend
// This is the source of truth - frontend re-exports from here

export interface Thread {
  id: string;
  title: string;
  lastUpdated: string;
  lastUpdatedDate?: string;
  visibility: 'Private' | 'Public' | 'Workspace';
  messages: number;
  model?: string;
  contextPercent?: number;
  maxContextTokens?: number;
  cost?: number;
  workspace?: string | null;
  workspacePath?: string | null;
  repo?: string | null;
  touchedFiles?: string[];
  autoInvoke?: boolean;
  // Handoff relationship IDs (derived from relationships for quick access)
  handoffParentId?: string | null;
  handoffChildId?: string | null;
}

export interface RelatedThread {
  id: string;
  title: string;
  lastUpdated: string;
  workspace?: string | null;
  repo?: string | null;
  commonFiles: string[];
  commonFileCount: number;
}

export interface ThreadRelationship {
  threadID: string;
  type: 'handoff';
  role: 'parent' | 'child';
  messageIndex: number;
  createdAt: number;
  comment?: string;
}

export interface ChainThread {
  id: string;
  title: string;
  lastUpdated: string;
  workspace?: string | null;
  comment?: string;
}

export interface ThreadChain {
  ancestors: ChainThread[];
  current: ChainThread | null;
  descendants: ChainThread[];
}

export interface FileEdit {
  type: 'edit' | 'create';
  oldStr?: string;
  newStr?: string;
  preview?: string;
  lines?: number;
}

export interface FileChange {
  path: string;
  filename: string;
  dir: string;
  created: boolean;
  editCount: number;
  edits: FileEdit[];
}

export interface GitFileStatus {
  path: string;
  relativePath: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  touchedByThread: boolean;
}

export interface GitStatus {
  workspacePath: string;
  workspaceName: string;
  files: GitFileStatus[];
  touchedFiles: string[];
  error?: string;
}

export interface FileDiff {
  diff?: string;
  isNew?: boolean;
  content?: string;
  lines?: number;
  error?: string;
}

export type SortField = 'lastUpdated' | 'title' | 'messages' | 'status' | 'contextPercent' | 'cost';
export type SortDirection = 'asc' | 'desc';

// Thread stacking (for grouping handoff chains)
export interface ThreadStack {
  head: Thread;
  ancestors: Thread[]; // ordered from newest to oldest (head's parent first)
}

export interface ThreadsResult {
  threads: Thread[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface SearchMatch {
  messageIndex: number;
  role: string;
  snippet: string;
}

export interface SearchResult {
  threadId: string;
  title: string;
  lastUpdated: string;
  matches: SearchMatch[];
}

// Git Activity Types
export interface GitCommit {
  sha: string;
  shortSha: string;
  subject: string;
  authorName: string;
  authorEmail: string;
  commitTime: number;
  commitTimeISO: string;
  files: string[];
  matchedFiles: string[];
  matchedFileCount: number;
  confidence: 'high' | 'low';
}

export interface GitBranch {
  name: string;
  type: 'local' | 'remote';
  hitCount: number;
}

export interface LinkedPR {
  repo: string;
  number: number;
  title: string;
  url: string;
  state: string;
  headRefName: string;
  baseRefName: string;
  createdAt?: string;
  mergedAt?: string | null;
  matchReason: string;
}

export interface WorkspaceGitActivity {
  workspacePath: string;
  workspaceName: string;
  repo?: string | null;
  repoUrl?: string | null;
  windowStartMs: number;
  windowEndMs: number;
  windowStartISO: string;
  windowEndISO: string;
  gitHeadSha?: string;
  currentBranch?: string | null;
  touchedFiles: string[];
  commits: GitCommit[];
  branches: GitBranch[];
  prs: LinkedPR[];
  error?: string;
}

export interface ThreadGitActivity {
  threadId: string;
  threadMtimeMs?: number;
  computedAtMs?: number;
  workspaces: WorkspaceGitActivity[];
  error?: string;
}

export interface KnownWorkspace {
  path: string;
  name: string;
  repo?: string | null;
  lastUsed?: string;
  source?: 'thread' | 'scan';
}

export interface ThreadImage {
  mediaType: string;
  data: string;
  sourcePath?: string | null;
}

// Thread metadata (stored in local SQLite)
export type ThreadStatus = 'active' | 'parked' | 'done' | 'blocked';

export interface ThreadBlocker {
  blocked_by_thread_id: string;
  reason?: string;
  blocker_status?: ThreadStatus;
}

export interface ThreadMetadata {
  thread_id: string;
  status: ThreadStatus;
  blockers?: ThreadBlocker[];
  isBlocked?: boolean;
  linked_issue_url?: string | null;
  created_at?: number;
  updated_at?: number;
}

// Running thread state (from WebSocket tracking)
export type RunningStatus = 'connected' | 'running' | 'disconnected';

export interface RunningThreadState {
  status: RunningStatus;
  connectedAt: number;
  startedAt?: number;
}

export type RunningThreadsMap = Record<string, RunningThreadState>;

// Artifacts
export type ArtifactType = 'note' | 'research' | 'plan' | 'image' | 'file';

export interface Artifact {
  id: number;
  thread_id: string;
  type: ArtifactType;
  title: string;
  content?: string | null;
  file_path?: string | null;
  media_type?: string | null;
  created_at: number;
  updated_at: number;
}
