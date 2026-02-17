import { useEffect, useRef, useState, useId } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  themeVariables: {
    darkMode: true,
    background: 'transparent',
    primaryColor: '#1a3a5c',
    primaryTextColor: '#e0e0e0',
    primaryBorderColor: '#4a7bd4',
    lineColor: '#4a7bd4',
    secondaryColor: '#1a2a3a',
    tertiaryColor: '#0a1a2a',
  },
  flowchart: { htmlLabels: true, curve: 'basis' },
  securityLevel: 'strict',
});

interface MermaidDiagramProps {
  code: string;
}

export function MermaidDiagram({ code }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const uniqueId = useId().replace(/:/g, '-');

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        const { svg: rendered } = await mermaid.render(`mermaid-${uniqueId}`, code);
        if (!cancelled) {
          setSvg(rendered);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to render diagram');
          setSvg(null);
        }
      }
    }

    void render();
    return () => { cancelled = true; };
  }, [code, uniqueId]);

  if (error) {
    return (
      <div className="mermaid-error">
        <div className="mermaid-error-label">Diagram error</div>
        <pre className="mermaid-error-detail">{error}</pre>
        <pre className="mermaid-source">{code}</pre>
      </div>
    );
  }

  if (!svg) {
    return <div className="mermaid-loading">Rendering diagram…</div>;
  }

  return (
    <div
      ref={containerRef}
      className="mermaid-diagram"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
