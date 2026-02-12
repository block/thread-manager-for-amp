import Database, { Database as DatabaseType, Statement } from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import {
  Artifact,
  ArtifactType,
  ThreadBlocker,
  ThreadStatus,
} from '../../shared/types.js';

// Store database in user's home directory
const DATA_DIR = join(homedir(), '.amp-thread-manager');
const DB_PATH = join(DATA_DIR, 'threads.db');

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize database
const db: DatabaseType = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS thread_metadata (
    thread_id TEXT PRIMARY KEY,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'parked', 'done', 'blocked')),
    goal TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS thread_blocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id TEXT NOT NULL,
    blocked_by_thread_id TEXT NOT NULL,
    reason TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (thread_id) REFERENCES thread_metadata(thread_id),
    UNIQUE(thread_id, blocked_by_thread_id)
  );

  CREATE INDEX IF NOT EXISTS idx_thread_status ON thread_metadata(status);
  CREATE INDEX IF NOT EXISTS idx_thread_blocks_thread ON thread_blocks(thread_id);
  CREATE INDEX IF NOT EXISTS idx_thread_blocks_blocker ON thread_blocks(blocked_by_thread_id);
`);

// Migration: Add linked_issue_url column if it doesn't exist
try {
  db.exec(`ALTER TABLE thread_metadata ADD COLUMN linked_issue_url TEXT`);
  console.log('📦 Added linked_issue_url column');
} catch {
  // Column already exists
}

// Create artifacts table
db.exec(`
  CREATE TABLE IF NOT EXISTS artifacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('note', 'research', 'plan', 'image', 'file')),
    title TEXT NOT NULL,
    content TEXT,
    file_path TEXT,
    media_type TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
  );
  
  CREATE INDEX IF NOT EXISTS idx_artifacts_thread ON artifacts(thread_id);
  CREATE INDEX IF NOT EXISTS idx_artifacts_type ON artifacts(type);
`);

// Database row types
interface ThreadMetadataRow {
  thread_id: string;
  status: ThreadStatus;
  goal: string | null;
  linked_issue_url: string | null;
  created_at: number;
  updated_at: number;
}

interface ThreadBlockRow {
  id: number;
  thread_id: string;
  blocked_by_thread_id: string;
  reason: string | null;
  created_at: number;
  blocker_status?: ThreadStatus;
  blocker_goal?: string | null;
  blocked_status?: ThreadStatus;
  blocked_goal?: string | null;
}

interface ArtifactRow {
  id: number;
  thread_id: string;
  type: ArtifactType;
  title: string;
  content: string | null;
  file_path: string | null;
  media_type: string | null;
  created_at: number;
  updated_at: number;
}

interface BlockedThreadRow {
  thread_id: string;
}

// Prepared statements
interface Statements {
  getMetadata: Statement<[string], ThreadMetadataRow>;
  upsertMetadata: Statement<{ thread_id: string; status: ThreadStatus | null; goal: string | null }>;
  updateStatus: Statement<{ thread_id: string; status: ThreadStatus }>;
  updateGoal: Statement<{ thread_id: string; goal: string }>;
  updateLinkedIssue: Statement<{ thread_id: string; linked_issue_url: string | null }>;
  getAllMetadata: Statement<[], ThreadMetadataRow>;
  getBlockers: Statement<[string], ThreadBlockRow>;
  getBlocking: Statement<[string], ThreadBlockRow>;
  addBlock: Statement<{ thread_id: string; blocked_by_thread_id: string; reason: string | null }>;
  removeBlock: Statement<{ thread_id: string; blocked_by_thread_id: string }>;
  getBlockedThreads: Statement<[], BlockedThreadRow>;
  getArtifacts: Statement<[string], ArtifactRow>;
  getArtifact: Statement<[number], ArtifactRow>;
  createArtifact: Statement<{
    thread_id: string;
    type: ArtifactType;
    title: string;
    content: string | null;
    file_path: string | null;
    media_type: string | null;
  }>;
  updateArtifact: Statement<{ id: number; title: string | null; content: string | null }>;
  deleteArtifact: Statement<[number]>;
}

const statements: Statements = {
  getMetadata: db.prepare(`
    SELECT * FROM thread_metadata WHERE thread_id = ?
  `),
  
  upsertMetadata: db.prepare(`
    INSERT INTO thread_metadata (thread_id, status, goal, updated_at)
    VALUES (@thread_id, @status, @goal, unixepoch())
    ON CONFLICT(thread_id) DO UPDATE SET
      status = COALESCE(@status, status),
      goal = COALESCE(@goal, goal),
      updated_at = unixepoch()
  `),
  
  updateStatus: db.prepare(`
    INSERT INTO thread_metadata (thread_id, status, updated_at)
    VALUES (@thread_id, @status, unixepoch())
    ON CONFLICT(thread_id) DO UPDATE SET
      status = @status,
      updated_at = unixepoch()
  `),
  
  updateGoal: db.prepare(`
    INSERT INTO thread_metadata (thread_id, goal, updated_at)
    VALUES (@thread_id, @goal, unixepoch())
    ON CONFLICT(thread_id) DO UPDATE SET
      goal = @goal,
      updated_at = unixepoch()
  `),
  
  updateLinkedIssue: db.prepare(`
    INSERT INTO thread_metadata (thread_id, linked_issue_url, updated_at)
    VALUES (@thread_id, @linked_issue_url, unixepoch())
    ON CONFLICT(thread_id) DO UPDATE SET
      linked_issue_url = @linked_issue_url,
      updated_at = unixepoch()
  `),
  
  getAllMetadata: db.prepare(`
    SELECT * FROM thread_metadata
  `),
  
  getBlockers: db.prepare(`
    SELECT tb.*, tm.status as blocker_status, tm.goal as blocker_goal
    FROM thread_blocks tb
    LEFT JOIN thread_metadata tm ON tb.blocked_by_thread_id = tm.thread_id
    WHERE tb.thread_id = ?
  `),
  
  getBlocking: db.prepare(`
    SELECT tb.*, tm.status as blocked_status, tm.goal as blocked_goal
    FROM thread_blocks tb
    LEFT JOIN thread_metadata tm ON tb.thread_id = tm.thread_id
    WHERE tb.blocked_by_thread_id = ?
  `),
  
  addBlock: db.prepare(`
    INSERT OR IGNORE INTO thread_blocks (thread_id, blocked_by_thread_id, reason)
    VALUES (@thread_id, @blocked_by_thread_id, @reason)
  `),
  
  removeBlock: db.prepare(`
    DELETE FROM thread_blocks 
    WHERE thread_id = @thread_id AND blocked_by_thread_id = @blocked_by_thread_id
  `),
  
  getBlockedThreads: db.prepare(`
    SELECT DISTINCT thread_id FROM thread_blocks
  `),
  
  // Artifact statements
  getArtifacts: db.prepare(`
    SELECT * FROM artifacts WHERE thread_id = ? ORDER BY created_at DESC
  `),
  
  getArtifact: db.prepare(`
    SELECT * FROM artifacts WHERE id = ?
  `),
  
  createArtifact: db.prepare(`
    INSERT INTO artifacts (thread_id, type, title, content, file_path, media_type)
    VALUES (@thread_id, @type, @title, @content, @file_path, @media_type)
  `),
  
  updateArtifact: db.prepare(`
    UPDATE artifacts SET
      title = COALESCE(@title, title),
      content = COALESCE(@content, content),
      updated_at = unixepoch()
    WHERE id = @id
  `),
  
  deleteArtifact: db.prepare(`
    DELETE FROM artifacts WHERE id = ?
  `),
};

// Extended metadata type with blockers array
interface ThreadMetadataWithBlockers extends ThreadMetadataRow {
  blockers?: ThreadBlocker[];
  isBlocked?: boolean;
}

// API functions
export function getThreadMetadata(threadId: string): ThreadMetadataWithBlockers {
  const metadata = statements.getMetadata.get(threadId);
  if (!metadata) {
    return { 
      thread_id: threadId, 
      status: 'active', 
      goal: null,
      linked_issue_url: null,
      created_at: 0,
      updated_at: 0,
    };
  }
  
  // Get blockers
  const blockers = statements.getBlockers.all(threadId);
  const result: ThreadMetadataWithBlockers = {
    ...metadata,
    blockers: blockers.map((b) => ({
      blocked_by_thread_id: b.blocked_by_thread_id,
      reason: b.reason ?? undefined,
      blocker_status: b.blocker_status,
    })),
  };
  
  return result;
}

export function getAllThreadMetadata(): Record<string, ThreadMetadataWithBlockers> {
  const all = statements.getAllMetadata.all();
  const blockedSet = new Set(
    statements.getBlockedThreads.all().map((r) => r.thread_id)
  );
  
  // Create a map for quick lookup
  const metadataMap: Record<string, ThreadMetadataWithBlockers> = {};
  for (const m of all) {
    const blockers = statements.getBlockers.all(m.thread_id);
    metadataMap[m.thread_id] = {
      ...m,
      blockers: blockers.map((b) => ({
        blocked_by_thread_id: b.blocked_by_thread_id,
        reason: b.reason ?? undefined,
        blocker_status: b.blocker_status,
      })),
      isBlocked: blockedSet.has(m.thread_id),
    };
  }
  
  return metadataMap;
}

export function updateThreadStatus(
  threadId: string,
  status: ThreadStatus
): ThreadMetadataWithBlockers {
  statements.updateStatus.run({ thread_id: threadId, status });
  
  // If marking as done, auto-unblock threads blocked by this one
  if (status === 'done') {
    const blocking = statements.getBlocking.all(threadId);
    for (const block of blocking) {
      statements.removeBlock.run({
        thread_id: block.thread_id,
        blocked_by_thread_id: threadId,
      });
    }
  }
  
  return getThreadMetadata(threadId);
}

export function addThreadBlock(
  threadId: string,
  blockedByThreadId: string,
  reason: string | null = null
): ThreadMetadataWithBlockers {
  statements.addBlock.run({
    thread_id: threadId,
    blocked_by_thread_id: blockedByThreadId,
    reason,
  });
  
  // Auto-set status to blocked if not already
  const metadata = statements.getMetadata.get(threadId);
  if (!metadata || metadata.status !== 'blocked') {
    statements.updateStatus.run({ thread_id: threadId, status: 'blocked' });
  }
  
  return getThreadMetadata(threadId);
}

export function removeThreadBlock(
  threadId: string,
  blockedByThreadId: string
): ThreadMetadataWithBlockers {
  statements.removeBlock.run({
    thread_id: threadId,
    blocked_by_thread_id: blockedByThreadId,
  });
  
  // Check if still blocked by other threads
  const remainingBlockers = statements.getBlockers.all(threadId);
  if (remainingBlockers.length === 0) {
    const metadata = statements.getMetadata.get(threadId);
    if (metadata && metadata.status === 'blocked') {
      statements.updateStatus.run({ thread_id: threadId, status: 'active' });
    }
  }
  
  return getThreadMetadata(threadId);
}

export function getThreadsBlockedBy(threadId: string): ThreadBlockRow[] {
  return statements.getBlocking.all(threadId);
}

export function updateLinkedIssue(
  threadId: string,
  url: string | null
): ThreadMetadataWithBlockers {
  statements.updateLinkedIssue.run({
    thread_id: threadId,
    linked_issue_url: url || null,
  });
  return getThreadMetadata(threadId);
}

// Artifact functions
export function getArtifacts(threadId: string): Artifact[] {
  return statements.getArtifacts.all(threadId);
}

export function getArtifact(id: number): Artifact | undefined {
  return statements.getArtifact.get(id);
}

interface CreateArtifactParams {
  threadId: string;
  type: ArtifactType;
  title: string;
  content?: string | null;
  filePath?: string | null;
  mediaType?: string | null;
}

export function createArtifact({
  threadId,
  type,
  title,
  content = null,
  filePath = null,
  mediaType = null,
}: CreateArtifactParams): Artifact {
  const result = statements.createArtifact.run({
    thread_id: threadId,
    type,
    title,
    content,
    file_path: filePath,
    media_type: mediaType,
  });
  const created = getArtifact(Number(result.lastInsertRowid));
  if (!created) {
    throw new Error('Failed to create artifact');
  }
  return created;
}

interface UpdateArtifactParams {
  title?: string | null;
  content?: string | null;
}

export function updateArtifact(
  id: number,
  { title, content }: UpdateArtifactParams
): Artifact | undefined {
  statements.updateArtifact.run({ id, title: title ?? null, content: content ?? null });
  return getArtifact(id);
}

export function deleteArtifact(id: number): Artifact | undefined {
  const artifact = getArtifact(id);
  statements.deleteArtifact.run(id);
  return artifact;
}

// Delete all thread data from database (metadata, blocks, artifacts)
const deleteThreadMetadataStmt = db.prepare<[string]>(
  `DELETE FROM thread_metadata WHERE thread_id = ?`
);
const deleteThreadBlocksStmt = db.prepare<[string, string]>(
  `DELETE FROM thread_blocks WHERE thread_id = ? OR blocked_by_thread_id = ?`
);
const deleteThreadArtifactsStmt = db.prepare<[string]>(
  `DELETE FROM artifacts WHERE thread_id = ?`
);

interface DeleteThreadDataResult {
  artifacts: Artifact[];
}

export function deleteThreadData(threadId: string): DeleteThreadDataResult {
  // Get artifacts to return file paths for cleanup
  const artifacts = getArtifacts(threadId);
  
  // Delete all related records
  deleteThreadArtifactsStmt.run(threadId);
  deleteThreadBlocksStmt.run(threadId, threadId);
  deleteThreadMetadataStmt.run(threadId);
  
  return { artifacts };
}

console.log(`📦 Database initialized at ${DB_PATH}`);

export default db;
