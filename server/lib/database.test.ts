import { describe, it, expect, afterEach } from 'vitest';
import {
  getThreadMetadata,
  getAllThreadMetadata,
  updateThreadStatus,
  addThreadBlock,
  removeThreadBlock,
  getThreadsBlockedBy,
  updateLinkedIssue,
  createArtifact,
  getArtifacts,
  getArtifact,
  updateArtifact,
  deleteArtifact,
  deleteThreadData,
} from './database.js';

// Use unique thread IDs per test run to avoid collisions with real data
const prefix = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
let testIds: string[] = [];

function makeId(suffix: string): string {
  const id = `T-${prefix}-${suffix}`;
  testIds.push(id);
  return id;
}

afterEach(() => {
  // Clean up all test threads
  for (const id of testIds) {
    try {
      deleteThreadData(id);
    } catch {
      // Ignore cleanup errors
    }
  }
  testIds = [];
});

describe('thread metadata CRUD', () => {
  it('returns default metadata for unknown thread', () => {
    const id = makeId('unknown');
    const metadata = getThreadMetadata(id);
    expect(metadata.thread_id).toBe(id);
    expect(metadata.status).toBe('active');
    expect(metadata.goal).toBeNull();
    expect(metadata.created_at).toBe(0);
  });

  it('creates metadata via updateThreadStatus', () => {
    const id = makeId('create');
    const result = updateThreadStatus(id, 'active');
    expect(result.thread_id).toBe(id);
    expect(result.status).toBe('active');
    expect(result.created_at).toBeGreaterThan(0);
  });

  it('updates status from active to parked', () => {
    const id = makeId('park');
    updateThreadStatus(id, 'active');
    const result = updateThreadStatus(id, 'parked');
    expect(result.status).toBe('parked');
  });

  it('updates status to done', () => {
    const id = makeId('done');
    updateThreadStatus(id, 'active');
    const result = updateThreadStatus(id, 'done');
    expect(result.status).toBe('done');
  });

  it('appears in getAllThreadMetadata after creation', () => {
    const id = makeId('all');
    updateThreadStatus(id, 'active');
    const all = getAllThreadMetadata();
    expect(all[id]).toBeDefined();
    expect(all[id].status).toBe('active');
  });
});

describe('thread blockers', () => {
  it('adds a blocker and auto-sets status to blocked', () => {
    const threadId = makeId('blocked');
    const blockerId = makeId('blocker');
    updateThreadStatus(threadId, 'active');
    updateThreadStatus(blockerId, 'active');

    const result = addThreadBlock(threadId, blockerId, 'waiting for API');
    expect(result.status).toBe('blocked');
    expect(result.blockers).toHaveLength(1);
    const blocker0 = result.blockers?.[0];
    expect(blocker0?.blocked_by_thread_id).toBe(blockerId);
    expect(blocker0?.reason).toBe('waiting for API');
  });

  it('removes a blocker and auto-unblocks when no remaining blockers', () => {
    const threadId = makeId('unblock');
    const blockerId = makeId('unblocker');
    updateThreadStatus(threadId, 'active');
    updateThreadStatus(blockerId, 'active');

    addThreadBlock(threadId, blockerId);
    const result = removeThreadBlock(threadId, blockerId);
    expect(result.status).toBe('active');
    expect(result.blockers).toHaveLength(0);
  });

  it('stays blocked when removing one of multiple blockers', () => {
    const threadId = makeId('multi-blocked');
    const blocker1 = makeId('b1');
    const blocker2 = makeId('b2');
    updateThreadStatus(threadId, 'active');
    updateThreadStatus(blocker1, 'active');
    updateThreadStatus(blocker2, 'active');

    addThreadBlock(threadId, blocker1, 'reason 1');
    addThreadBlock(threadId, blocker2, 'reason 2');

    const result = removeThreadBlock(threadId, blocker1);
    expect(result.status).toBe('blocked');
    expect(result.blockers).toHaveLength(1);
    expect(result.blockers?.[0]?.blocked_by_thread_id).toBe(blocker2);
  });

  it('auto-unblocks when blocker is marked done', () => {
    const threadId = makeId('auto-unblock');
    const blockerId = makeId('done-blocker');
    updateThreadStatus(threadId, 'active');
    updateThreadStatus(blockerId, 'active');

    addThreadBlock(threadId, blockerId);
    expect(getThreadMetadata(threadId).status).toBe('blocked');

    // Mark blocker as done — should auto-remove the block
    updateThreadStatus(blockerId, 'done');

    const metadata = getThreadMetadata(threadId);
    expect(metadata.blockers).toHaveLength(0);
  });

  it('getThreadsBlockedBy returns threads blocked by a given thread', () => {
    const blocker = makeId('blocks-others');
    const blocked1 = makeId('victim1');
    const blocked2 = makeId('victim2');
    updateThreadStatus(blocker, 'active');
    updateThreadStatus(blocked1, 'active');
    updateThreadStatus(blocked2, 'active');

    addThreadBlock(blocked1, blocker, 'dep');
    addThreadBlock(blocked2, blocker, 'dep');

    const blockedBy = getThreadsBlockedBy(blocker);
    const blockedIds = blockedBy.map((b) => b.thread_id);
    expect(blockedIds).toContain(blocked1);
    expect(blockedIds).toContain(blocked2);
  });

  it('does not duplicate blocks on repeated add', () => {
    const threadId = makeId('dup-block');
    const blockerId = makeId('dup-blocker');
    updateThreadStatus(threadId, 'active');
    updateThreadStatus(blockerId, 'active');

    addThreadBlock(threadId, blockerId, 'first');
    addThreadBlock(threadId, blockerId, 'second');

    const metadata = getThreadMetadata(threadId);
    expect(metadata.blockers).toHaveLength(1);
  });
});

describe('linked issue', () => {
  it('updates linked issue URL', () => {
    const id = makeId('issue');
    updateThreadStatus(id, 'active');
    const result = updateLinkedIssue(id, 'https://github.com/org/repo/issues/42');
    expect(result.linked_issue_url).toBe('https://github.com/org/repo/issues/42');
  });

  it('clears linked issue URL with null', () => {
    const id = makeId('clear-issue');
    updateThreadStatus(id, 'active');
    updateLinkedIssue(id, 'https://example.com');
    const result = updateLinkedIssue(id, null);
    expect(result.linked_issue_url).toBeNull();
  });
});

describe('artifacts', () => {
  it('creates and retrieves an artifact', () => {
    const threadId = makeId('art-create');
    updateThreadStatus(threadId, 'active');

    const artifact = createArtifact({
      threadId,
      type: 'note',
      title: 'Test Note',
      content: 'Hello world',
    });

    expect(artifact.id).toBeGreaterThan(0);
    expect(artifact.thread_id).toBe(threadId);
    expect(artifact.type).toBe('note');
    expect(artifact.title).toBe('Test Note');
    expect(artifact.content).toBe('Hello world');
  });

  it('retrieves artifact by ID', () => {
    const threadId = makeId('art-get');
    updateThreadStatus(threadId, 'active');

    const created = createArtifact({
      threadId,
      type: 'research',
      title: 'Research Doc',
      content: 'findings',
    });

    const fetched = getArtifact(created.id);
    expect(fetched).toBeDefined();
    expect(fetched?.title).toBe('Research Doc');
  });

  it('lists artifacts for a thread', () => {
    const threadId = makeId('art-list');
    updateThreadStatus(threadId, 'active');

    createArtifact({ threadId, type: 'note', title: 'Note 1' });
    createArtifact({ threadId, type: 'plan', title: 'Plan 1', content: 'steps' });

    const artifacts = getArtifacts(threadId);
    expect(artifacts).toHaveLength(2);
  });

  it('updates artifact title and content', () => {
    const threadId = makeId('art-update');
    updateThreadStatus(threadId, 'active');

    const artifact = createArtifact({
      threadId,
      type: 'note',
      title: 'Original',
      content: 'v1',
    });

    const updated = updateArtifact(artifact.id, {
      title: 'Updated',
      content: 'v2',
    });

    expect(updated).toBeDefined();
    expect(updated?.title).toBe('Updated');
    expect(updated?.content).toBe('v2');
  });

  it('deletes an artifact', () => {
    const threadId = makeId('art-delete');
    updateThreadStatus(threadId, 'active');

    const artifact = createArtifact({
      threadId,
      type: 'file',
      title: 'Temp File',
      filePath: '/tmp/test.txt',
    });

    const deleted = deleteArtifact(artifact.id);
    expect(deleted).toBeDefined();
    expect(deleted?.id).toBe(artifact.id);

    const fetched = getArtifact(artifact.id);
    expect(fetched).toBeUndefined();
  });
});

describe('deleteThreadData (cascade)', () => {
  it('deletes metadata, blocks, and artifacts for a thread', () => {
    const threadId = makeId('cascade');
    const blockerId = makeId('cascade-blocker');
    updateThreadStatus(threadId, 'active');
    updateThreadStatus(blockerId, 'active');

    addThreadBlock(threadId, blockerId, 'dep');
    createArtifact({ threadId, type: 'note', title: 'will be deleted' });

    const result = deleteThreadData(threadId);
    expect(result.artifacts).toHaveLength(1);
    expect(result.artifacts[0].title).toBe('will be deleted');

    // Metadata should be gone — returns default
    const metadata = getThreadMetadata(threadId);
    expect(metadata.created_at).toBe(0);

    // Artifacts should be gone
    expect(getArtifacts(threadId)).toHaveLength(0);
  });

  it('removes blocks in both directions on cascade delete', () => {
    const threadA = makeId('cascade-a');
    const threadB = makeId('cascade-b');
    updateThreadStatus(threadA, 'active');
    updateThreadStatus(threadB, 'active');

    addThreadBlock(threadA, threadB);
    deleteThreadData(threadB);

    // threadA should no longer have threadB as a blocker
    const metadata = getThreadMetadata(threadA);
    expect(metadata.blockers).toHaveLength(0);
  });
});
