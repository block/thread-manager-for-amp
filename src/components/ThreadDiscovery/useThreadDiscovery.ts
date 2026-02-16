import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { apiGet } from '../../api/client';
import type { 
  FileChange, 
  ThreadGitActivity, 
  ThreadChain as ThreadChainType, 
  RelatedThread,
  Thread,
  GitStatus,
  ThreadImage,
  ThreadMetadata,
  Artifact,
} from '../../types';
import type { Message } from '../../utils/parseMarkdown';
import { shortenPath } from '../../utils/format';

type TabId = 'changes' | 'git' | 'chain' | 'related' | 'artifacts' | 'skills';

interface SessionImage {
  data: string;
  mediaType: string;
}

interface SummaryData {
  fileCount: number;
  editCount: number;
  commitCount: number;
  prCount: number;
  chainCount: number;
  relatedCount: number;
}

export interface DocArtifact {
  path: string;
  shortPath: string;
  type: 'research' | 'plan';
  messageId: string;
}

export interface LoadedSkill {
  name: string;
  messageId: string;
  loadedAt?: number;
}

export interface AvailableSkill {
  name: string;
  description: string;
  source: string;
}

export interface SkillsSummary {
  count: number;
  skills: AvailableSkill[];
}

function extractDocArtifacts(messages: Message[]): DocArtifact[] {
  const docs: DocArtifact[] = [];
  const seen = new Set<string>();

  for (const msg of messages) {
    if (msg.type !== 'tool_use' || msg.toolName !== 'create_file') continue;
    const path = msg.toolInput?.path;
    if (!path || typeof path !== 'string' || seen.has(path)) continue;
    
    const lowerPath = path.toLowerCase();
    const filename = lowerPath.split('/').pop() || '';
    
    let type: 'research' | 'plan' | null = null;
    if (filename.includes('research') || filename.includes('findings')) {
      type = 'research';
    } else if (filename.includes('plan') || filename === 'todo.md' || filename === 'tasks.md') {
      type = 'plan';
    }
    
    if (type && filename.endsWith('.md')) {
      seen.add(path);
      docs.push({ path, shortPath: shortenPath(path), type, messageId: msg.id });
    }
  }
  return docs;
}

function extractLoadedSkills(messages: Message[]): LoadedSkill[] {
  const skills: LoadedSkill[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.type !== 'tool_use' || msg.toolName !== 'skill') continue;
    
    const skillName = msg.toolInput?.name;
    if (!skillName || typeof skillName !== 'string' || seen.has(skillName)) continue;
    
    // Check if there's a successful tool_result for this skill
    const hasResult = messages.slice(i + 1).some(
      m => m.type === 'tool_result' && m.toolId === msg.toolId && m.success !== false
    );
    
    if (hasResult) {
      seen.add(skillName);
      skills.push({
        name: skillName,
        messageId: msg.id,
        loadedAt: i,
      });
    }
  }
  return skills;
}

export interface UseThreadDiscoveryOptions {
  threadId: string;
  onOpenThread?: (thread: Thread) => void;
  messages?: Message[];
  sessionImages?: SessionImage[];
  metadata?: ThreadMetadata;
  onMetadataChange?: (metadata: ThreadMetadata) => void;
}

export interface UseThreadDiscoveryResult {
  activeTab: TabId | null;
  setActiveTab: (tab: TabId | null) => void;
  handleTabClick: (tab: TabId) => void;
  
  summary: SummaryData;
  loading: boolean;
  refreshing: boolean;
  
  changes: FileChange[];
  gitActivity: ThreadGitActivity | null;
  chain: ThreadChainType | null;
  related: RelatedThread[];
  allImages: ThreadImage[];
  savedArtifacts: Artifact[];
  setSavedArtifacts: React.Dispatch<React.SetStateAction<Artifact[]>>;
  docArtifacts: DocArtifact[];
  noteArtifacts: Artifact[];
  loadedSkills: LoadedSkill[];
  availableSkillsCount: number;
  availableSkills: AvailableSkill[];
  
  uncommittedCount: number;
  showSourceControl: boolean;
  setShowSourceControl: (show: boolean) => void;
  viewingImageIndex: number | null;
  setViewingImageIndex: (index: number | null) => void;
  
  artifactCount: number;
  hasLinkedIssue: boolean;
  hasAnyData: boolean;
  
  handleRefresh: () => Promise<void>;
  handleLinkedIssueUpdate: (url: string | null) => void;
}

export function useThreadDiscovery({
  threadId,
  onOpenThread,
  messages = [],
  sessionImages = [],
  metadata,
  onMetadataChange,
}: UseThreadDiscoveryOptions): UseThreadDiscoveryResult {
  const [activeTab, setActiveTab] = useState<TabId | null>(null);
  const [summary, setSummary] = useState<SummaryData>({
    fileCount: 0,
    editCount: 0,
    commitCount: 0,
    prCount: 0,
    chainCount: 0,
    relatedCount: 0,
  });
  
  const docArtifacts = useMemo(() => extractDocArtifacts(messages), [messages]);
  const loadedSkills = useMemo(() => extractLoadedSkills(messages), [messages]);
  
  const [changes, setChanges] = useState<FileChange[]>([]);
  const [gitActivity, setGitActivity] = useState<ThreadGitActivity | null>(null);
  const [chain, setChain] = useState<ThreadChainType | null>(null);
  const [related, setRelated] = useState<RelatedThread[]>([]);
  const [images, setImages] = useState<ThreadImage[]>([]);
  const [savedArtifacts, setSavedArtifacts] = useState<Artifact[]>([]);
  const [uncommittedCount, setUncommittedCount] = useState(0);
  const [availableSkillsCount, setAvailableSkillsCount] = useState(0);
  const [availableSkills, setAvailableSkills] = useState<AvailableSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showSourceControl, setShowSourceControl] = useState(false);
  const [viewingImageIndex, setViewingImageIndex] = useState<number | null>(null);

  const onOpenThreadRef = useRef(onOpenThread);
  onOpenThreadRef.current = onOpenThread;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const tid = threadId;

    const p1 = apiGet<FileChange[]>(`/api/thread-changes?threadId=${encodeURIComponent(tid)}`)
      .catch((e) => { console.debug('thread-changes:', e.message); return [] as FileChange[]; })
      .then((data) => { if (!cancelled) {
        setChanges(data);
        setSummary(prev => ({ ...prev, fileCount: data.length, editCount: data.reduce((sum, c) => sum + c.editCount, 0) }));
      }});

    const p2 = apiGet<ThreadGitActivity>(`/api/thread-git-activity?threadId=${encodeURIComponent(tid)}`)
      .catch((e) => { console.debug('thread-git-activity:', e.message); return null; })
      .then((data) => { if (!cancelled) {
        setGitActivity(data);
        const workspace = data?.workspaces?.[0];
        setSummary(prev => ({ ...prev, commitCount: workspace?.commits?.filter(c => c.confidence === 'high').length || 0, prCount: workspace?.prs?.length || 0 }));
      }});

    const p3 = apiGet<ThreadChainType>(`/api/thread-chain?threadId=${encodeURIComponent(tid)}`)
      .catch((e) => { console.debug('thread-chain:', e.message); return null; })
      .then((data) => { if (!cancelled) {
        setChain(data);
        const chainCount = data ? (data.ancestors?.length || 0) + (data.descendants?.length || 0) : 0;
        setSummary(prev => ({ ...prev, chainCount }));
      }});

    const p4 = (onOpenThreadRef.current
      ? apiGet<RelatedThread[]>(`/api/related-threads?threadId=${encodeURIComponent(tid)}`).catch((e) => { console.debug('related-threads:', e.message); return [] as RelatedThread[]; })
      : Promise.resolve([] as RelatedThread[])
    ).then((data) => { if (!cancelled) {
      setRelated(data);
      setSummary(prev => ({ ...prev, relatedCount: data.length }));
    }});

    const p5 = apiGet<GitStatus>(`/api/git-status?threadId=${encodeURIComponent(tid)}`)
      .catch((e) => { console.debug('git-status:', e.message); return null; })
      .then((data) => { if (!cancelled) {
        const threadUncommitted = data?.files?.filter(f => f.touchedByThread).length || 0;
        setUncommittedCount(threadUncommitted);
      }});

    const p6 = apiGet<ThreadImage[]>(`/api/thread-images?threadId=${encodeURIComponent(tid)}`)
      .catch((e) => { console.debug('thread-images:', e.message); return [] as ThreadImage[]; })
      .then((data) => { if (!cancelled) { setImages(data); }});

    const p7 = apiGet<Artifact[]>(`/api/artifacts?threadId=${encodeURIComponent(tid)}`)
      .catch((e) => { console.debug('artifacts:', e.message); return [] as Artifact[]; })
      .then((data) => { if (!cancelled) { setSavedArtifacts(data); }});

    const p8 = apiGet<SkillsSummary>('/api/skills-summary')
      .catch((e) => { console.debug('skills-summary:', e.message); return { count: 0, skills: [] } as SkillsSummary; })
      .then((data) => { if (!cancelled) {
        setAvailableSkillsCount(data.count);
        setAvailableSkills(data.skills);
      }});

    // Set loading=false one tick after all data setters have been applied,
    // so chips from the final fetch render before the spinner disappears.
    Promise.all([p1, p2, p3, p4, p5, p6, p7, p8]).then(() => {
      if (!cancelled) {
        requestAnimationFrame(() => { if (!cancelled) setLoading(false); });
      }
    });

    return () => { cancelled = true; };
  }, [threadId]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const gitData = await apiGet<ThreadGitActivity>(
        `/api/thread-git-activity?threadId=${encodeURIComponent(threadId)}&refresh=1`
      );
      setGitActivity(gitData);
      const workspace = gitData?.workspaces?.[0];
      setSummary(prev => ({
        ...prev,
        commitCount: workspace?.commits?.filter(c => c.confidence === 'high').length || 0,
        prCount: workspace?.prs?.length || 0,
      }));
    } finally {
      setRefreshing(false);
    }
  }, [threadId]);

  const handleTabClick = useCallback((tab: TabId) => {
    setActiveTab(prev => prev === tab ? null : tab);
  }, []);

  const allImages: ThreadImage[] = useMemo(() => {
    const combined = [...images];
    for (const si of sessionImages) {
      combined.push({ data: si.data, mediaType: si.mediaType, sourcePath: null });
    }
    return combined;
  }, [images, sessionImages]);
  
  const noteArtifacts = useMemo(
    () => savedArtifacts.filter(a => ['note', 'research', 'plan'].includes(a.type)),
    [savedArtifacts]
  );
  const artifactCount = allImages.length + docArtifacts.length + noteArtifacts.length;
  const hasLinkedIssue = !!metadata?.linked_issue_url;
  const hasAnyData = summary.fileCount > 0 || summary.commitCount > 0 || 
                     summary.prCount > 0 || summary.chainCount > 0 || summary.relatedCount > 0 ||
                     artifactCount > 0 || hasLinkedIssue;

  const handleLinkedIssueUpdate = useCallback((url: string | null) => {
    if (onMetadataChange && metadata) {
      onMetadataChange({ ...metadata, linked_issue_url: url });
    }
  }, [metadata, onMetadataChange]);

  return {
    activeTab,
    setActiveTab,
    handleTabClick,
    
    summary,
    loading,
    refreshing,
    
    changes,
    gitActivity,
    chain,
    related,
    allImages,
    savedArtifacts,
    setSavedArtifacts,
    docArtifacts,
    noteArtifacts,
    loadedSkills,
    availableSkillsCount,
    availableSkills,
    
    uncommittedCount,
    showSourceControl,
    setShowSourceControl,
    viewingImageIndex,
    setViewingImageIndex,
    
    artifactCount,
    hasLinkedIssue,
    hasAnyData,
    
    handleRefresh,
    handleLinkedIssueUpdate,
  };
}
