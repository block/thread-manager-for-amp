import { FileCode } from 'lucide-react';
import type { RelatedThread, Thread } from '../types';

interface RelatedThreadsContentProps {
  related: RelatedThread[];
  onOpenThread: (thread: Thread) => void;
}

export function RelatedThreadsContent({ related, onOpenThread }: RelatedThreadsContentProps) {
  const handleClick = (r: RelatedThread) => {
    onOpenThread({
      id: r.id,
      title: r.title,
      lastUpdated: r.lastUpdated,
      visibility: 'Private',
      messages: 0,
      workspace: r.workspace,
      repo: r.repo,
    });
  };

  if (related.length === 0) {
    return <div className="discovery-empty">No related threads found</div>;
  }

  return (
    <div className="discovery-related">
      <div className="related-threads-list">
        {related.map((r) => (
          <button key={r.id} className="related-thread-item" onClick={() => handleClick(r)}>
            <div className="related-thread-info">
              <span className="related-thread-title">{r.title}</span>
              <span className="related-thread-meta">
                {r.workspace && <span className="related-workspace">{r.workspace}</span>}
                <span className="related-time">{r.lastUpdated}</span>
              </span>
            </div>
            <div className="related-files">
              <FileCode size={12} />
              <span>
                {r.commonFileCount} shared file{r.commonFileCount === 1 ? '' : 's'}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
