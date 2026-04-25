import { Suspense, lazy, type ReactElement } from 'react';

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
        pre: ({ children }) => children as ReactElement,
        code({ className, children }) {
          const match = /language-(\w+)/.exec(className ?? '');
          const codeText = String(children).replace(/\n$/, '');

          if (match) {
            return (
              <Suspense
                fallback={
                  <pre className="my-2 p-3 rounded-lg bg-[#1a1a1a] text-white text-xs font-mono overflow-x-auto">
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
            <code className="px-1.5 py-0.5 rounded text-xs font-mono bg-[#1a1a1a] text-purple-70">
              {children}
            </code>
          );
        },
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        ul: ({ children }) => <ul className="list-disc list-outside pl-5 my-1 space-y-0.5">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-outside pl-5 my-1 space-y-0.5">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-[#808080] pl-3 my-1 text-[#808080] italic">
            {children}
          </blockquote>
        ),
        a: ({ href, children }) => {
          const safe = /^https?:|^mailto:/i.test(href ?? '');
          return safe ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-70 underline underline-offset-2 hover:opacity-75 transition-opacity"
            >
              {children}
            </a>
          ) : (
            <span className="text-purple-70">{children}</span>
          );
        },
      }}
    >
      {normalizeContent(content)}
    </ReactMarkdown>
  );
}
