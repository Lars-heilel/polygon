import { memo, useMemo } from 'react';

import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

import CodeBlock from './code-block';

const normalizeContent = (text: string) =>
  text
    .replace(/([^\n])\n(`{3,})/g, '$1\n\n$2')
    .replace(/^(`{3,})/, '\n$1')
    .replace(/^(`{3,}\w+) +([^\n]+)$/gm, '$1\n$2');

export const MarkdownMessage = memo(function MarkdownMessage({ content }: { content: string }) {
  const normalized = useMemo(() => normalizeContent(content), [content]);

  const components: Components = useMemo(
    () => ({
      p: ({ children }) => <span className="block leading-relaxed mb-1 last:mb-0">{children}</span>,

      pre: ({ children }) => children,

      code({ className, children, node: _node, ...props }) {
        const match = /language-(\w+)/.exec(className ?? '');
        const codeText = String(children).replace(/\n$/, '');

        if (match) {
          return (
            <CodeBlock
              language={match[1]}
              value={codeText}
            />
          );
        }

        return (
          <code
            {...props}
            className="px-1.5 py-0.5 rounded text-xs font-mono bg-[#1a1a1a] text-purple-70"
          >
            {children}
          </code>
        );
      },

      a: ({ href, children, node: _node, ...props }) => (
        <a
          {...props}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline hover:opacity-80 transition-opacity"
        >
          {children}
        </a>
      ),

      ul: ({ children }) => <ul className="list-disc pl-5 my-1">{children}</ul>,

      ol: ({ children }) => <ol className="list-decimal pl-5 my-1">{children}</ol>,

      li: ({ children }) => <li className="leading-relaxed">{children}</li>,

      blockquote: ({ children }) => (
        <blockquote className="border-l-2 border-[#808080] pl-3 my-1 text-[#808080] italic">
          {children}
        </blockquote>
      ),

      strong: ({ children }) => <strong className="font-semibold">{children}</strong>,

      em: ({ children }) => <em className="italic">{children}</em>,
    }),
    [],
  );

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={components}
    >
      {normalized}
    </ReactMarkdown>
  );
});
