import { lazy, Suspense } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const MermaidDiagram = lazy(() => import('./MermaidDiagram').then(m => ({ default: m.MermaidDiagram })));

interface MarkdownContentProps {
  content: string;
}

export function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        ),
        code: ({ className, children }) => {
          const isInline = !className;
          if (isInline) {
            return <code className="inline-code">{children}</code>;
          }
          if (className === 'language-mermaid') {
            const code = Array.isArray(children)
              ? children.filter(c => typeof c === 'string').join('')
              : typeof children === 'string' ? children : '';
            return (
              <Suspense fallback={<div className="mermaid-loading">Loading diagram…</div>}>
                <MermaidDiagram code={code.replace(/\n$/, '')} />
              </Suspense>
            );
          }
          return (
            <pre className="code-block">
              <code>{children}</code>
            </pre>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
