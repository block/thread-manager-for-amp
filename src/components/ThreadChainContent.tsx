import { ChevronRight } from 'lucide-react';
import type { ThreadChain, ChainThread, Thread } from '../types';

interface ThreadChainContentProps {
  chain: ThreadChain;
  onOpenThread: (thread: Thread) => void;
}

export function ThreadChainContent({ chain, onOpenThread }: ThreadChainContentProps) {
  const handleClick = (t: ChainThread) => {
    onOpenThread({
      id: t.id,
      title: t.title,
      lastUpdated: t.lastUpdated,
      visibility: 'Private',
      messages: 0,
      workspace: t.workspace,
    });
  };

  return (
    <div className="discovery-chain">
      <div className="thread-chain-list">
        {chain.ancestors.map((t, i) => (
          <div key={t.id} className="chain-item ancestor">
            <button className="chain-thread-btn" onClick={() => handleClick(t)}>
              <span className="chain-label">↑ From</span>
              <span className="chain-title">{t.title}</span>
              {t.comment && <span className="chain-comment">"{t.comment}"</span>}
            </button>
            {(i < chain.ancestors.length - 1 || chain.current) && (
              <div className="chain-connector">
                <ChevronRight size={12} />
              </div>
            )}
          </div>
        ))}

        {chain.current && (
          <div className="chain-item current">
            <div className="chain-current-marker">
              <span className="chain-label">Current</span>
              <span className="chain-title">{chain.current.title}</span>
            </div>
            {chain.descendants.length > 0 && (
              <div className="chain-connector">
                <ChevronRight size={12} />
              </div>
            )}
          </div>
        )}

        {chain.descendants.map((t, i) => (
          <div key={t.id} className="chain-item descendant">
            <button className="chain-thread-btn" onClick={() => handleClick(t)}>
              <span className="chain-label">↓ To</span>
              <span className="chain-title">{t.title}</span>
              {t.comment && <span className="chain-comment">"{t.comment}"</span>}
            </button>
            {i < chain.descendants.length - 1 && (
              <div className="chain-connector">
                <ChevronRight size={12} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
