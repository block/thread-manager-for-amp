import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
