import { spawn, ChildProcess } from 'child_process';
import { readFile, writeFile, mkdir, stat } from 'fs/promises';
import type { Stats } from 'fs';
import { join, dirname, isAbsolute, relative, basename } from 'path';
import { AMP_HOME } from './constants.js';
import { THREADS_DIR } from './threadTypes.js';
import type {
  ThreadGitActivity,
  WorkspaceGitActivity,
  GitCommit,
  GitBranch,
  LinkedPR,
} from '../../shared/types.js';

const CACHE_DIR = join(AMP_HOME, '.local', 'share', 'amp-thread-manager', 'cache', 'thread-git');
const PR_INDEX_PATH = join(AMP_HOME, '.local', 'share', 'amp-thread-manager', 'cache', 'pr-index.json');

interface TimeWindow {
  startMs: number;
  endMs: number;
  startISO: string;
  endISO: string;
}

interface TouchedFiles {
  touchedAbs: string[];
  touchedRel: string[];
}

interface RawCommit {
  sha: string;
  shortSha: string;
  commitTime: number;
  commitTimeISO: string;
  authorName: string;
  authorEmail: string;
  subject: string;
  files: string[];
}

interface ThreadMessage {
  role?: string;
  timestamp?: number;
  meta?: { sentAt?: number };
  usage?: { timestamp?: string };
  content?: Array<{
    type: string;
    input?: { path?: string };
  }>;
}

interface ThreadData {
  created?: number;
  messages?: ThreadMessage[];
  env?: {
    initial?: {
      trees?: Array<{
        uri?: string;
        path?: string;
        displayName?: string;
        remotes?: Array<{ name: string; url?: string }>;
        repository?: {
          remotes?: Array<{ name: string; url?: string }>;
          url?: string;
        };
      }>;
    };
  };
}

interface CacheData extends ThreadGitActivity {
  threadMtimeMs: number;
}

type PrIndex = Record<string, string[]>;

async function ensureCacheDir(): Promise<void> {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
  } catch {
    // Ignore if exists
  }
}

function runGit(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child: ChildProcess = spawn('git', args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });

    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`git timed out after 15s: git ${args.join(' ')}`));
    }, 15_000);

    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d: Buffer) => {
      stdout += d.toString();
    });
    child.stderr?.on('data', (d: Buffer) => {
      stderr += d.toString();
    });

    child.on('close', (code: number | null) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(stderr || `git exited with code ${code}`));
      } else {
        resolve(stdout);
      }
    });
    child.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

async function isGitRepo(cwd: string): Promise<boolean> {
  try {
    await runGit(['rev-parse', '--git-dir'], cwd);
    return true;
  } catch {
    return false;
  }
}

function runGh(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child: ChildProcess = spawn('gh', args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, GH_PROMPT_DISABLED: '1' },
    });

    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`gh timed out after 15s: gh ${args.join(' ')}`));
    }, 15_000);

    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d: Buffer) => {
      stdout += d.toString();
    });
    child.stderr?.on('data', (d: Buffer) => {
      stderr += d.toString();
    });

    child.on('close', (code: number | null) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(stderr || `gh exited with code ${code}`));
      } else {
        resolve(stdout);
      }
    });
    child.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

function normalizeTimestamp(ts: number | undefined | null): number | null {
  if (!ts) return null;
  return ts > 1e12 ? ts : ts * 1000;
}

function getThreadTimeWindow(messages: ThreadMessage[], threadCreated?: number): TimeWindow | null {
  let startTs = Infinity;
  let endTs = 0;

  for (const msg of messages) {
    let ts = normalizeTimestamp(msg.timestamp);

    if (!ts && msg.meta?.sentAt) {
      ts = normalizeTimestamp(msg.meta.sentAt);
    }

    if (!ts && msg.usage?.timestamp) {
      ts = new Date(msg.usage.timestamp).getTime();
    }

    if (ts && !isNaN(ts)) {
      if (ts < startTs) startTs = ts;
      if (ts > endTs) endTs = ts;
    }
  }

  if (startTs === Infinity && threadCreated) {
    startTs = normalizeTimestamp(threadCreated) ?? Infinity;
  }

  if (endTs === 0 && startTs !== Infinity) {
    endTs = Date.now();
  }

  if (startTs === Infinity || endTs === 0) {
    return null;
  }

  return {
    startMs: startTs - 10 * 60 * 1000,
    endMs: endTs + 30 * 60 * 1000,
    startISO: new Date(startTs - 10 * 60 * 1000).toISOString(),
    endISO: new Date(endTs + 30 * 60 * 1000).toISOString(),
  };
}

function extractTouchedFiles(messages: ThreadMessage[], workspacePath: string): TouchedFiles {
  const touchedAbs = new Set<string>();
  const touchedRel = new Set<string>();

  for (const msg of messages) {
    if (msg.role === 'assistant' && Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block.type === 'tool_use' && block.input?.path) {
          const path = block.input.path;
          touchedAbs.add(path);

          if (isAbsolute(path) && workspacePath && path.startsWith(workspacePath)) {
            touchedRel.add(relative(workspacePath, path));
          } else if (!isAbsolute(path)) {
            touchedRel.add(path);
          } else {
            touchedRel.add(basename(path));
          }
        }
      }
    }
  }

  return { touchedAbs: [...touchedAbs], touchedRel: [...touchedRel] };
}

function parseGitLog(output: string): RawCommit[] {
  const commits: RawCommit[] = [];
  const entries = output.split('---\n').filter(Boolean);

  for (const entry of entries) {
    const lines = entry.trim().split('\n');
    if (lines.length < 1) continue;

    const firstLine = lines[0];
    if (!firstLine) continue;
    const parts = firstLine.split('\t');
    if (parts.length < 5) continue;

    const sha = parts[0] ?? '';
    const commitTime = parts[1] ?? '';
    const authorName = parts[2] ?? '';
    const authorEmail = parts[3] ?? '';
    const subject = parts[4] ?? '';
    const files = lines.slice(1).filter(f => f.trim());

    commits.push({
      sha,
      shortSha: sha.slice(0, 7),
      commitTime: parseInt(commitTime, 10) * 1000,
      commitTimeISO: new Date(parseInt(commitTime, 10) * 1000).toISOString(),
      authorName,
      authorEmail,
      subject,
      files,
    });
  }

  return commits;
}

async function getCommitsInWindow(workspacePath: string, startISO: string, endISO: string): Promise<RawCommit[]> {
  try {
    const output = await runGit(
      [
        'log',
        `--since=${startISO}`,
        `--until=${endISO}`,
        '--date=unix',
        '--name-only',
        '--pretty=format:---%n%H%x09%ad%x09%an%x09%ae%x09%s',
      ],
      workspacePath
    );

    return parseGitLog(output);
  } catch (e) {
    console.error('[GIT] Failed to get commits:', (e as Error).message);
    return [];
  }
}

function scoreCommits(commits: RawCommit[], touchedRelSet: Set<string>): GitCommit[] {
  return commits.map(commit => {
    const matchedFiles = commit.files.filter(f => touchedRelSet.has(f));
    const confidence: 'high' | 'low' = matchedFiles.length > 0 ? 'high' : 'low';

    return {
      ...commit,
      matchedFiles,
      matchedFileCount: matchedFiles.length,
      confidence,
    };
  });
}

async function getBranchesForCommits(workspacePath: string, commits: GitCommit[]): Promise<GitBranch[]> {
  const branchHits = new Map<string, number>();

  const topCommits = commits.filter(c => c.confidence === 'high').slice(0, 10);

  for (const commit of topCommits) {
    try {
      const localOutput = await runGit(['branch', '--contains', commit.sha], workspacePath);
      for (const line of localOutput.split('\n')) {
        const branch = line.replace(/^\*?\s*/, '').trim();
        if (branch) {
          branchHits.set(branch, (branchHits.get(branch) || 0) + 1);
        }
      }

      const remoteOutput = await runGit(['branch', '-r', '--contains', commit.sha], workspacePath);
      for (const line of remoteOutput.split('\n')) {
        const branch = line.trim();
        if (branch && !branch.includes('->')) {
          branchHits.set(branch, (branchHits.get(branch) || 0) + 1);
        }
      }
    } catch {
      // Commit might not be on any branch
    }
  }

  const branches: GitBranch[] = [...branchHits.entries()]
    .map(([name, hitCount]) => ({
      name,
      type: name.startsWith('origin/') || name.includes('/') ? 'remote' as const : 'local' as const,
      hitCount,
    }))
    .sort((a, b) => b.hitCount - a.hitCount)
    .slice(0, 10);

  return branches;
}

function parseGitHubRepo(remoteUrl: string | undefined | null): string | null {
  if (!remoteUrl) return null;

  const sshMatch = remoteUrl.match(/git@github\.com:([^/]+\/[^/.]+)(?:\.git)?$/);
  if (sshMatch?.[1]) return sshMatch[1];

  const httpsMatch = remoteUrl.match(/github\.com\/([^/]+\/[^/.]+)(?:\.git)?$/);
  if (httpsMatch?.[1]) return httpsMatch[1];

  return null;
}

interface GhPrListResult {
  number: number;
  title: string;
  url: string;
  state: string;
  createdAt?: string;
  mergedAt?: string | null;
  headRefName: string;
  baseRefName: string;
}

interface GhPrApiResult {
  number: number;
  title: string;
  html_url: string;
  state: string;
  created_at?: string;
  merged_at?: string | null;
  head?: { ref: string };
  base?: { ref: string };
}

async function getPRsForBranches(workspacePath: string, repo: string | null, branches: GitBranch[]): Promise<LinkedPR[]> {
  if (!repo) return [];

  const prs = new Map<number, LinkedPR>();

  const remoteBranches = branches.filter(b => b.type === 'remote').map(b => b.name.replace(/^origin\//, ''));

  for (const branch of remoteBranches.slice(0, 5)) {
    try {
      const output = await runGh(
        [
          'pr',
          'list',
          '--repo',
          repo,
          '--head',
          branch,
          '--state',
          'all',
          '--json',
          'number,title,url,state,createdAt,mergedAt,headRefName,baseRefName',
        ],
        workspacePath
      );

      const prList = JSON.parse(output || '[]') as GhPrListResult[];
      for (const pr of prList) {
        if (!prs.has(pr.number)) {
          prs.set(pr.number, {
            ...pr,
            repo,
            matchReason: `head branch: ${branch}`,
          });
        }
      }
    } catch (e) {
      console.error(`[GIT] Failed to get PRs for branch ${branch}:`, (e as Error).message);
    }
  }

  return [...prs.values()];
}

async function getPRsForCommits(workspacePath: string, repo: string | null, commits: GitCommit[]): Promise<LinkedPR[]> {
  if (!repo) return [];

  const prs = new Map<number, LinkedPR>();
  const topCommits = commits.filter(c => c.confidence === 'high').slice(0, 5);

  for (const commit of topCommits) {
    try {
      const output = await runGh(
        ['api', '-H', 'Accept: application/vnd.github+json', `repos/${repo}/commits/${commit.sha}/pulls`],
        workspacePath
      );

      const prList = JSON.parse(output || '[]') as GhPrApiResult[];
      for (const pr of prList) {
        if (!prs.has(pr.number)) {
          prs.set(pr.number, {
            number: pr.number,
            title: pr.title,
            url: pr.html_url,
            state: pr.state,
            headRefName: pr.head?.ref ?? '',
            baseRefName: pr.base?.ref ?? '',
            createdAt: pr.created_at,
            mergedAt: pr.merged_at,
            repo,
            matchReason: `contains commit: ${commit.shortSha}`,
          });
        }
      }
    } catch {
      // Ignore API errors for individual commits
    }
  }

  return [...prs.values()];
}

async function getHeadSha(workspacePath: string): Promise<string | null> {
  try {
    const output = await runGit(['rev-parse', 'HEAD'], workspacePath);
    return output.trim();
  } catch {
    return null;
  }
}

async function getCurrentBranch(workspacePath: string): Promise<string | null> {
  try {
    const output = await runGit(['rev-parse', '--abbrev-ref', 'HEAD'], workspacePath);
    return output.trim();
  } catch {
    return null;
  }
}

async function loadCache(threadId: string): Promise<CacheData | null> {
  try {
    const cachePath = join(CACHE_DIR, `${threadId}.json`);
    const content = await readFile(cachePath, 'utf-8');
    return JSON.parse(content) as CacheData;
  } catch {
    return null;
  }
}

async function saveCache(threadId: string, data: CacheData): Promise<void> {
  try {
    await ensureCacheDir();
    const cachePath = join(CACHE_DIR, `${threadId}.json`);
    await writeFile(cachePath, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('[GIT] Failed to save cache:', (e as Error).message);
  }
}

async function loadPrIndex(): Promise<PrIndex> {
  try {
    const content = await readFile(PR_INDEX_PATH, 'utf-8');
    return JSON.parse(content) as PrIndex;
  } catch {
    return {};
  }
}

async function savePrIndex(index: PrIndex): Promise<void> {
  try {
    await ensureCacheDir();
    const indexDir = dirname(PR_INDEX_PATH);
    await mkdir(indexDir, { recursive: true });
    await writeFile(PR_INDEX_PATH, JSON.stringify(index, null, 2));
  } catch (e) {
    console.error('[GIT] Failed to save PR index:', (e as Error).message);
  }
}

async function updatePrIndex(threadId: string, prs: LinkedPR[]): Promise<void> {
  const index = await loadPrIndex();

  for (const key of Object.keys(index)) {
    const entries = index[key];
    if (!entries) continue;
    const filtered = entries.filter(id => id !== threadId);
    index[key] = filtered;
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- TODO: refactor to use Map
    if (filtered.length === 0) delete index[key];
  }

  for (const pr of prs) {
    const key = `${pr.repo}#${pr.number}`;
    if (!index[key]) index[key] = [];
    const arr = index[key] ?? [];
    if (!arr.includes(threadId)) {
      arr.push(threadId);
    }
  }

  await savePrIndex(index);
}

export async function getThreadGitActivity(threadId: string, forceRefresh = false): Promise<ThreadGitActivity> {
  const threadPath = join(THREADS_DIR, `${threadId}.json`);

  try {
    const content = await readFile(threadPath, 'utf-8');
    const data = JSON.parse(content) as ThreadData;
    const threadStat: Stats = await stat(threadPath);

    const trees = data.env?.initial?.trees || [];
    if (trees.length === 0) {
      return { threadId, workspaces: [], error: 'No workspace found' };
    }

    const messages = data.messages || [];
    const timeWindow = getThreadTimeWindow(messages, data.created);

    if (!timeWindow) {
      return { threadId, workspaces: [], error: 'Could not determine time window' };
    }

    const workspaces: WorkspaceGitActivity[] = [];

    for (const tree of trees) {
      const workspaceUri = tree.uri || tree.path;
      const workspacePath = workspaceUri?.replace('file://', '');
      if (!workspacePath) continue;

      const workspaceName = tree.displayName || basename(workspacePath);

      let headSha: string | null;
      try {
        headSha = await getHeadSha(workspacePath);
      } catch {
        workspaces.push({
          workspacePath,
          workspaceName,
          error: 'Not a git repository',
          windowStartMs: timeWindow.startMs,
          windowEndMs: timeWindow.endMs,
          windowStartISO: timeWindow.startISO,
          windowEndISO: timeWindow.endISO,
          touchedFiles: [],
          commits: [],
          branches: [],
          prs: [],
        });
        continue;
      }

      const cache = await loadCache(threadId);
      const cachedWorkspace = cache?.workspaces.find(w => w.workspacePath === workspacePath);

      const cacheValid =
        cachedWorkspace && cache?.threadMtimeMs === threadStat.mtimeMs && cachedWorkspace.gitHeadSha === headSha && !forceRefresh;

      if (cacheValid) {
        workspaces.push(cachedWorkspace);
        continue;
      }

      if (!(await isGitRepo(workspacePath))) {
        continue;
      }

      const { touchedAbs, touchedRel } = extractTouchedFiles(messages, workspacePath);
      const touchedRelSet = new Set(touchedRel);

      const remotes = tree.remotes || tree.repository?.remotes || [];
      const originRemote = remotes.find(r => r.name === 'origin') || remotes[0];
      const repoUrl = originRemote?.url || tree.repository?.url;
      const repo = parseGitHubRepo(repoUrl);

      const rawCommits = await getCommitsInWindow(workspacePath, timeWindow.startISO, timeWindow.endISO);
      const commits = scoreCommits(rawCommits, touchedRelSet);

      commits.sort((a, b) => {
        if (a.confidence !== b.confidence) {
          return a.confidence === 'high' ? -1 : 1;
        }
        return b.commitTime - a.commitTime;
      });

      const branches = await getBranchesForCommits(workspacePath, commits);

      const currentBranch = await getCurrentBranch(workspacePath);

      let prs = await getPRsForBranches(workspacePath, repo, branches);

      if (prs.length === 0 && commits.some(c => c.confidence === 'high')) {
        prs = await getPRsForCommits(workspacePath, repo, commits);
      }

      const workspaceResult: WorkspaceGitActivity = {
        workspacePath,
        workspaceName,
        repo,
        repoUrl,
        windowStartMs: timeWindow.startMs,
        windowEndMs: timeWindow.endMs,
        windowStartISO: timeWindow.startISO,
        windowEndISO: timeWindow.endISO,
        gitHeadSha: headSha ?? undefined,
        currentBranch,
        touchedFiles: touchedAbs,
        commits: commits.slice(0, 50),
        branches,
        prs,
      };

      workspaces.push(workspaceResult);
    }

    const result: CacheData = {
      threadId,
      threadMtimeMs: threadStat.mtimeMs,
      computedAtMs: Date.now(),
      workspaces,
    };

    await saveCache(threadId, result);

    const allPrs = workspaces.flatMap(w => w.prs);
    await updatePrIndex(threadId, allPrs);

    return result;
  } catch (e) {
    console.error('[GIT] Failed to get git activity:', (e as Error).message);
    return { threadId, workspaces: [], error: (e as Error).message };
  }
}
