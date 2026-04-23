import { Suspense, lazy } from 'react';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import './highlighter.css';

const CodeBlock = lazy(() => import('./syntax-highlighter'));

const fallbackStyle = {
  margin: 0,
  padding: '0.75rem 1rem',
  background: 'var(--color-surface-elevated)',
  fontSize: '0.75rem',
  fontFamily: 'ui-monospace, monospace',
  color: 'var(--color-text)',
  borderRadius: '0.5rem',
  overflowX: 'auto' as const,
};

export function CodeToMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Remove <pre> wrapper — CodeBlock provides its own container
        pre({ children }) {
          return <>{children}</>;
        },
        // Remove browser default margins on paragraphs
        p({ children }) {
          return <p className="m-0">{children}</p>;
        },
        code({ children, className, node, ...rest }) {
          const match = /language-(\w+)/.exec(className || '');
          const raw = String(children);
          // Fenced code blocks always have a trailing \n from remark
          const isFenced = raw.endsWith('\n');
          const codeText = raw.replace(/\n$/, '');

          if (match || isFenced) {
            return (
              <Suspense fallback={<pre style={fallbackStyle}>{codeText}</pre>}>
                <div className="my-2">
                  <CodeBlock
                    language={match?.[1] ?? ''}
                    value={codeText}
                  />
                </div>
              </Suspense>
            );
          }

          return (
            <code
              {...rest}
              className="inline-code"
            >
              {children}
            </code>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
