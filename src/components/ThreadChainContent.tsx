import { GitFork } from 'lucide-react';
import type { ThreadChain, ThreadChainNode, ChainThread, Thread } from '../types';

interface ThreadChainContentProps {
  chain: ThreadChain;
  onOpenThread: (thread: Thread) => void;
}

function TreeNodes({
  nodes,
  depth,
  currentId,
  onClickThread,
}: {
  nodes: ThreadChainNode[];
  depth: number;
  currentId?: string;
  onClickThread: (t: ChainThread) => void;
}) {
  return (
    <>
      {nodes.map((node) => {
        const isCurrent = node.thread.id === currentId;
        return (
          <div key={node.thread.id}>
            <div
              className={`chain-item${isCurrent ? ' is-current' : ''}`}
              style={depth > 0 ? { marginLeft: depth * 16 } : undefined}
            >
              {depth > 0 && nodes.length > 1 && <GitFork size={10} className="chain-fork-icon" />}
              {isCurrent ? (
                <div className="chain-current-marker">
                  <span className="chain-label">Current</span>
                  <span className="chain-title">{node.thread.title}</span>
                </div>
              ) : (
                <button className="chain-thread-btn" onClick={() => onClickThread(node.thread)}>
                  <span className="chain-title">{node.thread.title}</span>
                  {node.thread.comment && (
                    <span className="chain-comment">"{node.thread.comment}"</span>
                  )}
                </button>
              )}
            </div>
            {node.children.length > 0 && (
              <TreeNodes
                nodes={node.children}
                depth={depth + 1}
                currentId={currentId}
                onClickThread={onClickThread}
              />
            )}
          </div>
        );
      })}
    </>
  );
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

  if (chain.root) {
    return (
      <div className="discovery-chain">
        <div className="thread-chain-list">
          <TreeNodes
            nodes={[chain.root]}
            depth={0}
            currentId={chain.currentId}
            onClickThread={handleClick}
          />
        </div>
      </div>
    );
  }

  // Fallback for old API responses without root
  return (
    <div className="discovery-chain">
      <div className="thread-chain-list">
        {chain.ancestors.map((t) => (
          <div key={t.id} className="chain-item">
            <button className="chain-thread-btn" onClick={() => handleClick(t)}>
              <span className="chain-title">{t.title}</span>
            </button>
          </div>
        ))}
        {chain.current && (
          <div className="chain-item is-current">
            <div className="chain-current-marker">
              <span className="chain-label">Current</span>
              <span className="chain-title">{chain.current.title}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
