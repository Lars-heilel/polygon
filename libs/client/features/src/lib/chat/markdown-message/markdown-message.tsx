import { Suspense, lazy } from 'react';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const CodeBlock = lazy(() => import('./code-block'));

function normalizeContent(text: string): string {
  return text
    .replace(/([^\n])\n(`{3,})/g, '$1\n\n$2')
    .replace(/^(`{3,})/, '\n$1')
    .replace(/^(`{3,}\w+) +([^\n]+)$/gm, '$1\n$2');
}

export function MarkdownMessage({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <span className="block leading-relaxed">{children}</span>,
        pre: ({ children }) => <>{children}</>,
        code({ className, children }) {
          const match = /language-(\w+)/.exec(className ?? '');
          const codeText = String(children).replace(/\n$/, '');

          if (match) {
            return (
              <Suspense
                fallback={
                  <pre className="my-2 p-3 rounded-lg bg-surface-elevated text-text text-xs font-mono overflow-x-auto">
                    {codeText}
                  </pre>
                }
              >
                <CodeBlock
                  language={match[1]}
                  value={codeText}
                />
              </Suspense>
            );
          }

          return (
            <code className="px-1.5 py-0.5 rounded text-xs font-mono bg-surface-elevated text-purple-70">
              {children}
            </code>
          );
        },
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
      }}
    >
      {normalizeContent(content)}
    </ReactMarkdown>
  );
}
