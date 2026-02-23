import { ChevronRight, GitFork } from 'lucide-react';
import type { ThreadChain, ThreadChainNode, ChainThread, Thread } from '../types';

interface ThreadChainContentProps {
  chain: ThreadChain;
  onOpenThread: (thread: Thread) => void;
}

function DescendantNodes({
  nodes,
  depth,
  onClickThread,
}: {
  nodes: ThreadChainNode[];
  depth: number;
  onClickThread: (t: ChainThread) => void;
}) {
  return (
    <>
      {nodes.map((node) => (
        <div key={node.thread.id}>
          <div
            className="chain-item descendant"
            style={depth > 0 ? { marginLeft: depth * 16 } : undefined}
          >
            {depth > 0 && nodes.length > 1 && <GitFork size={10} className="chain-fork-icon" />}
            <button className="chain-thread-btn" onClick={() => onClickThread(node.thread)}>
              <span className="chain-label">↓ To</span>
              <span className="chain-title">{node.thread.title}</span>
              {node.thread.comment && (
                <span className="chain-comment">"{node.thread.comment}"</span>
              )}
            </button>
          </div>
          {node.children.length > 0 && (
            <>
              <div className="chain-connector">
                <ChevronRight size={12} />
              </div>
              <DescendantNodes
                nodes={node.children}
                depth={depth + 1}
                onClickThread={onClickThread}
              />
            </>
          )}
        </div>
      ))}
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
            {chain.descendantsTree.length > 0 && (
              <div className="chain-connector">
                <ChevronRight size={12} />
              </div>
            )}
          </div>
        )}

        <DescendantNodes nodes={chain.descendantsTree} depth={0} onClickThread={handleClick} />
      </div>
    </div>
  );
}
