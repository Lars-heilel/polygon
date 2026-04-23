import { useState } from 'react';

import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';

import { prismTheme } from './prism-theme';

interface CodeBlockProps {
  language: string;
  value: string;
}

export default function CodeBlock({ language, value }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="rounded-lg overflow-hidden border border-border">
      <div className="flex items-center justify-between px-4 py-2 bg-surface border-b border-border">
        <span className="text-xs text-text-muted font-mono">{language}</span>
        <button
          onClick={handleCopy}
          className="text-xs text-text-muted hover:text-text transition-colors"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={prismTheme}
        PreTag="div"
        customStyle={{
          margin: 0,
          padding: '0.75rem 1rem',
          background: 'var(--color-surface-elevated)',
          fontSize: '0.75rem',
          lineHeight: '1.6',
        }}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
}
