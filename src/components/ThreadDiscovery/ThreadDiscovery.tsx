import { 
  FileCode, 
  GitCommit, 
  GitPullRequest, 
  GitBranch, 
  Link2,
  RefreshCw,
  Package,
  Search,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { SourceControl } from '../SourceControl';
import type { Thread, ThreadMetadata } from '../../types';
import type { Message } from '../../utils/parseMarkdown';
import { WhatChangedContent } from '../WhatChangedContent';
import { GitActivityContent } from '../GitActivityContent';
import { ThreadChainContent } from '../ThreadChainContent';
import { RelatedThreadsContent } from '../RelatedThreadsContent';
import { ImageViewer } from '../ImageViewer';
import { LinkedIssueEditor, LinkedIssueBadge } from '../LinkedIssue';
import { ArtifactNotesList } from '../ArtifactNote';
import { ThreadLabelEditor } from '../ThreadLabelEditor';
import { useThreadDiscovery } from './useThreadDiscovery';

interface SessionImage {
  data: string;
  mediaType: string;
}

interface ThreadDiscoveryProps {
  threadId: string;
  onOpenThread?: (thread: Thread) => void;
  messages?: Message[];
  onJumpToMessage?: (messageId: string) => void;
  sessionImages?: SessionImage[];
  metadata?: ThreadMetadata;
  onMetadataChange?: (metadata: ThreadMetadata) => void;
  onSearchOpen?: () => void;
}

export function ThreadDiscovery({ 
  threadId, 
  onOpenThread, 
  messages = [], 
  onJumpToMessage, 
  sessionImages = [], 
  metadata, 
  onMetadataChange,
  onSearchOpen,
}: ThreadDiscoveryProps) {
  const {
    activeTab,
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
    loadedSkills,
    availableSkillsCount,
    availableSkills,
    uncommittedCount,
    showSourceControl,
    setShowSourceControl,
    viewingImageIndex,
    setViewingImageIndex,
    artifactCount,
    handleRefresh,
    handleLinkedIssueUpdate,
  } = useThreadDiscovery({
    threadId,
    onOpenThread,
    messages,
    sessionImages,
    metadata,
    onMetadataChange,
  });

  return (
    <div className="thread-discovery-v2">
      <div className="discovery-summary">
        <ThreadLabelEditor threadId={threadId} compact />
        
        {summary.fileCount > 0 && (
          <button 
            className={`summary-chip files ${activeTab === 'changes' ? 'active' : ''}`}
            onClick={() => handleTabClick('changes')}
          >
            <FileCode size={12} />
            <span>{summary.fileCount} files</span>
          </button>
        )}
        {(summary.commitCount > 0 || summary.prCount > 0) && (
          <button 
            className={`summary-chip git ${activeTab === 'git' ? 'active' : ''}`}
            onClick={() => handleTabClick('git')}
          >
            <GitCommit size={12} className="commit-icon" />
            <span>{summary.commitCount} commits</span>
            {summary.prCount > 0 && (
              <>
                <GitPullRequest size={12} className="pr-icon" />
                <span>{summary.prCount} PR{summary.prCount !== 1 ? 's' : ''}</span>
              </>
            )}
          </button>
        )}
        {summary.chainCount > 0 && (
          <button 
            className={`summary-chip chain ${activeTab === 'chain' ? 'active' : ''}`}
            onClick={() => handleTabClick('chain')}
          >
            <GitBranch size={12} />
            <span>{summary.chainCount} linked</span>
          </button>
        )}
        {summary.relatedCount > 0 && onOpenThread && (
          <button 
            className={`summary-chip related ${activeTab === 'related' ? 'active' : ''}`}
            onClick={() => handleTabClick('related')}
          >
            <Link2 size={12} />
            <span>{summary.relatedCount} related</span>
          </button>
        )}
        {artifactCount > 0 && (
          <button 
            className={`summary-chip artifacts ${activeTab === 'artifacts' ? 'active' : ''}`}
            onClick={() => handleTabClick('artifacts')}
          >
            <Package size={12} />
            <span>{artifactCount} artifact{artifactCount !== 1 ? 's' : ''}</span>
          </button>
        )}
        {availableSkillsCount > 0 && (
          <button 
            className={`summary-chip skills ${activeTab === 'skills' ? 'active' : ''}`}
            onClick={() => handleTabClick('skills')}
          >
            <Sparkles size={12} />
            <span>
              {loadedSkills.length > 0 && <>{loadedSkills.length}/</> }
              {availableSkillsCount} skills
            </span>
          </button>
        )}
        
        {metadata && (
          <div className="summary-linked-issue">
            {metadata.linked_issue_url ? (
              <LinkedIssueBadge url={metadata.linked_issue_url} />
            ) : (
              <LinkedIssueEditor
                threadId={threadId}
                currentUrl={metadata.linked_issue_url}
                onUpdate={handleLinkedIssueUpdate}
              />
            )}
          </div>
        )}

        {loading && (
          <Loader2 size={12} className="spinning" style={{ opacity: 0.5 }} />
        )}
        
        <div className="summary-actions">
          {uncommittedCount > 0 && (
            <button
              className="summary-action-btn has-changes"
              onClick={() => setShowSourceControl(true)}
              title={`${uncommittedCount} uncommitted file${uncommittedCount === 1 ? '' : 's'}`}
            >
              <GitBranch size={14} />
              <span className="action-badge">{uncommittedCount}</span>
            </button>
          )}
          {onSearchOpen && (
            <button
              className="summary-action-btn"
              onClick={onSearchOpen}
              title="Search messages (⌘F)"
            >
              <Search size={12} />
            </button>
          )}
          <button
            className="summary-action-btn"
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh git data"
          >
            <RefreshCw size={12} className={refreshing ? 'spinning' : ''} />
          </button>
        </div>
      </div>

      {activeTab && (
        <div className="discovery-panel">
          <div className="discovery-content">
            {activeTab === 'changes' && (
              <WhatChangedContent changes={changes} />
            )}
            {activeTab === 'git' && gitActivity && (
              <GitActivityContent activity={gitActivity} />
            )}
            {activeTab === 'chain' && chain && onOpenThread && (
              <ThreadChainContent chain={chain} onOpenThread={onOpenThread} />
            )}
            {activeTab === 'related' && onOpenThread && (
              <RelatedThreadsContent related={related} onOpenThread={onOpenThread} />
            )}
            {activeTab === 'artifacts' && (
              <div className="artifacts-content-list">
                <ArtifactNotesList
                  threadId={threadId}
                  artifacts={savedArtifacts}
                  onArtifactsChange={setSavedArtifacts}
                />
                
                {allImages.length > 0 && (
                  <div className="artifact-group images">
                    <div className="artifact-group-header">Images</div>
                    <div className="images-content-grid">
                      {allImages.map((img, idx) => (
                        <button 
                          key={idx} 
                          className="image-thumbnail" 
                          title={img.sourcePath || `Image ${idx + 1}`}
                          onClick={() => setViewingImageIndex(idx)}
                        >
                          <img 
                            src={`data:${img.mediaType};base64,${img.data}`} 
                            alt={img.sourcePath || `Attached image ${idx + 1}`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {docArtifacts.filter(a => a.type === 'research').length > 0 && (
                  <div className="artifact-group research">
                    <div className="artifact-group-header">Research (from messages)</div>
                    {docArtifacts.filter(a => a.type === 'research').map(a => (
                      <button 
                        key={a.path} 
                        className="artifact-item"
                        onClick={() => onJumpToMessage?.(a.messageId)}
                        title={a.path}
                      >
                        {a.shortPath}
                      </button>
                    ))}
                  </div>
                )}
                {docArtifacts.filter(a => a.type === 'plan').length > 0 && (
                  <div className="artifact-group plan">
                    <div className="artifact-group-header">Plans (from messages)</div>
                    {docArtifacts.filter(a => a.type === 'plan').map(a => (
                      <button 
                        key={a.path} 
                        className="artifact-item"
                        onClick={() => onJumpToMessage?.(a.messageId)}
                        title={a.path}
                      >
                        {a.shortPath}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {activeTab === 'skills' && (
              <div className="skills-content">
                {loadedSkills.length > 0 && (
                  <div className="skills-section">
                    <div className="skills-section-header">Loaded in this session</div>
                    <div className="skills-list">
                      {loadedSkills.map(skill => (
                        <button
                          key={skill.name}
                          className="skill-item loaded"
                          onClick={() => onJumpToMessage?.(skill.messageId)}
                          title={`Jump to where ${skill.name} was loaded`}
                        >
                          <Sparkles size={14} className="skill-icon" />
                          <span className="skill-name">{skill.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="skills-section">
                  <div className="skills-section-header">
                    Available skills ({availableSkillsCount})
                  </div>
                  <div className="skills-list available">
                    {availableSkills.map(skill => {
                      const isLoaded = loadedSkills.some(s => s.name === skill.name);
                      return (
                        <div
                          key={skill.name}
                          className={`skill-item available ${isLoaded ? 'is-loaded' : ''}`}
                          title={skill.description}
                        >
                          <Sparkles size={12} className="skill-icon" />
                          <span className="skill-name">{skill.name}</span>
                          {isLoaded && <span className="skill-loaded-badge">active</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {showSourceControl && (
        <SourceControl 
          threadId={threadId} 
          onClose={() => setShowSourceControl(false)} 
        />
      )}
      
      {viewingImageIndex !== null && (
        <ImageViewer
          images={allImages}
          currentIndex={viewingImageIndex}
          onClose={() => setViewingImageIndex(null)}
          onNavigate={setViewingImageIndex}
        />
      )}
    </div>
  );
}
