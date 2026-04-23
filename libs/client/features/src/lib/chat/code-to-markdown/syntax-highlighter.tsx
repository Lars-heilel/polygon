import { useState } from 'react';

import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';

import { prismTheme } from './prism-theme';

// Languages registered in react-syntax-highlighter's Prism bundle
const KNOWN_LANGUAGES = new Set([
  'bash', 'sh', 'shell', 'zsh',
  'c', 'cpp', 'csharp', 'cs',
  'css', 'scss', 'less',
  'dart', 'diff', 'docker', 'dockerfile',
  'go', 'graphql',
  'html', 'xml',
  'ini', 'toml',
  'java', 'javascript', 'js', 'jsx',
  'json', 'json5',
  'kotlin',
  'lua',
  'markdown', 'md',
  'nginx',
  'objectivec',
  'perl', 'php', 'python', 'py',
  'r', 'ruby', 'rb', 'rust',
  'scala', 'sql', 'swift',
  'text', 'plain', 'plaintext',
  'typescript', 'ts', 'tsx',
  'vim', 'yaml', 'yml',
]);

interface CodeBlockProps {
  language: string;
  value: string;
}

export default function CodeBlock({ language, value }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const known = KNOWN_LANGUAGES.has(language.toLowerCase());

  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="rounded-lg overflow-hidden border border-border">
      <div className="flex items-center justify-between px-4 py-2 bg-surface border-b border-border">
        {known ? (
          <span className="text-xs text-text-muted font-mono">{language}</span>
        ) : (
          <span />
        )}
        <button
          onClick={handleCopy}
          className="text-xs text-text-muted hover:text-text transition-colors"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      {known ? (
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
      ) : (
        <pre
          style={{
            margin: 0,
            padding: '0.75rem 1rem',
            background: 'var(--color-surface-elevated)',
            fontSize: '0.75rem',
            lineHeight: '1.6',
            fontFamily: 'ui-monospace, monospace',
            color: 'var(--color-text)',
            overflowX: 'auto',
          }}
        >
          <code>{value}</code>
        </pre>
      )}
    </div>
  );
}
