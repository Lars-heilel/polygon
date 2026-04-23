import { Suspense, lazy } from 'react';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import './highlighter.css';

const CodeBlock = lazy(() => import('./syntax-highlighter'));

export function CodeToMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ className, children }) {
          const match = /language-(\w+)/.exec(className || '');
          const codeText = (Array.isArray(children) ? children.join('') : String(children)).replace(/\n$/, '');

          if (match) {
            return (
              <Suspense
                fallback={
                  <pre className="my-2 p-3 bg-surface-elevated text-text text-xs rounded-lg overflow-x-auto">
                    {codeText}
                  </pre>
                }
              >
                <div className="my-2">
                  <CodeBlock
                    language={match[1]}
                    value={codeText}
                  />
                </div>
              </Suspense>
            );
          }

          return <code className="inline-code">{children}</code>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
