import { MermaidDiagram } from './MermaidDiagram';
import type { ThreadChain, ChainThread, ThreadChainNode } from '../types';

interface ThreadMapViewProps {
  chain: ThreadChain;
  onOpenThread?: (thread: { id: string; title: string }) => void;
}

function flattenDescendants(nodes: ThreadChainNode[]): ChainThread[] {
  const result: ChainThread[] = [];
  for (const node of nodes) {
    result.push(node.thread);
    result.push(...flattenDescendants(node.children));
  }
  return result;
}

function sanitizeLabel(text: string): string {
  return text
    .replace(/["[\](){}|<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
}

function nodeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9]/g, '_');
}

function buildMermaidCode(chain: ThreadChain): string {
  const lines: string[] = ['flowchart TD'];
  const descendants = flattenDescendants(chain.descendantsTree);

  const allNodes: ChainThread[] = [
    ...chain.ancestors,
    ...(chain.current ? [chain.current] : []),
    ...descendants,
  ];

  if (allNodes.length === 0) return '';

  // Define nodes
  for (const node of allNodes) {
    const label = sanitizeLabel(node.title || node.id);
    const nid = nodeId(node.id);
    if (chain.current && node.id === chain.current.id) {
      lines.push(`    ${nid}[["${label}"]]`);
    } else {
      lines.push(`    ${nid}["${label}"]`);
    }
  }

  // Define edges: ancestors chain
  for (let i = 0; i < chain.ancestors.length - 1; i++) {
    const from = chain.ancestors[i];
    const to = chain.ancestors[i + 1];
    if (!from || !to) continue;
    const label = to.comment ? ` -->|"${sanitizeLabel(to.comment)}"| ` : ' --> ';
    lines.push(`    ${nodeId(from.id)}${label}${nodeId(to.id)}`);
  }

  // Last ancestor -> current
  if (chain.ancestors.length > 0 && chain.current) {
    const lastAncestor = chain.ancestors[chain.ancestors.length - 1];
    if (lastAncestor) {
      const label = chain.current.comment
        ? ` -->|"${sanitizeLabel(chain.current.comment)}"| `
        : ' --> ';
      lines.push(`    ${nodeId(lastAncestor.id)}${label}${nodeId(chain.current.id)}`);
    }
  }

  // Current -> descendants
  if (chain.current && descendants.length > 0) {
    for (const desc of descendants) {
      const label = desc.comment ? ` -->|"${sanitizeLabel(desc.comment)}"| ` : ' --> ';
      lines.push(`    ${nodeId(chain.current.id)}${label}${nodeId(desc.id)}`);
    }
  }

  // Styles
  lines.push('');
  lines.push('    classDef ancestor fill:#1a2a3a,stroke:#4a7bd4,color:#a9b1d6');
  lines.push('    classDef current fill:#0a3a1a,stroke:#4ade80,color:#ffffff,stroke-width:2px');
  lines.push('    classDef descendant fill:#2a1a3a,stroke:#bd93f9,color:#e0def4');

  for (const anc of chain.ancestors) {
    lines.push(`    class ${nodeId(anc.id)} ancestor`);
  }
  if (chain.current) {
    lines.push(`    class ${nodeId(chain.current.id)} current`);
  }
  for (const desc of descendants) {
    lines.push(`    class ${nodeId(desc.id)} descendant`);
  }

  return lines.join('\n');
}

export function ThreadMapView({ chain, onOpenThread }: ThreadMapViewProps) {
  const mermaidCode = buildMermaidCode(chain);

  const descendants = flattenDescendants(chain.descendantsTree);
  const allNodes: ChainThread[] = [
    ...chain.ancestors,
    ...(chain.current ? [chain.current] : []),
    ...descendants,
  ];

  if (!mermaidCode || allNodes.length === 0) {
    return <div className="thread-map-empty">No thread chain data available.</div>;
  }

  return (
    <div className="thread-map-view">
      <div className="thread-map-legend">
        <span className="legend-item">
          <span className="legend-dot ancestor" />
          Ancestor
        </span>
        <span className="legend-item">
          <span className="legend-dot current" />
          Current
        </span>
        <span className="legend-item">
          <span className="legend-dot descendant" />
          Descendant
        </span>
      </div>
      <div className="thread-map-diagram">
        <MermaidDiagram code={mermaidCode} />
      </div>
      {onOpenThread && (
        <div className="thread-map-nodes">
          {allNodes.map((node) => (
            <button
              key={node.id}
              className={`thread-map-node-btn ${chain.current?.id === node.id ? 'is-current' : ''}`}
              onClick={() => onOpenThread({ id: node.id, title: node.title })}
              title={`Navigate to: ${node.title || node.id}`}
            >
              {node.title || node.id}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
