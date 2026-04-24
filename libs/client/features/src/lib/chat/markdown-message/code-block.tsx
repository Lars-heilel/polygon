import { useState } from 'react';

import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { toast } from 'sonner';

import { appPrismTheme } from './prism-theme';

const SUPPORTED_LANGUAGES = new Set([
  'bash',
  'c',
  'cpp',
  'csharp',
  'css',
  'go',
  'html',
  'java',
  'javascript',
  'js',
  'json',
  'jsx',
  'kotlin',
  'markdown',
  'md',
  'php',
  'python',
  'py',
  'regex',
  'ruby',
  'rb',
  'rust',
  'sh',
  'sql',
  'swift',
  'ts',
  'tsx',
  'typescript',
  'yaml',
  'yml',
]);

interface CodeBlockProps {
  language: string;
  value: string;
}

export default function CodeBlock({ language, value }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const lang = SUPPORTED_LANGUAGES.has(language) ? language : 'text';
  const showLabel = SUPPORTED_LANGUAGES.has(language);

  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      toast.info(`Успешное копирование`);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="rounded-lg overflow-hidden border border-[#262626] my-2">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#141414] border-b border-[#262626]">
        {showLabel ? (
          <span className="text-[10px] text-[#808080] font-mono uppercase tracking-wide">
            {language}
          </span>
        ) : (
          <span />
        )}
        <button
          onClick={handleCopy}
          className="text-[10px] text-[#808080] hover:text-white transition-colors"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <div className="bg-[#1a1a1a] p-3 overflow-x-auto">
        <SyntaxHighlighter
          language={lang}
          style={appPrismTheme}
          PreTag="div"
          useInlineStyles={true}
          customStyle={{
            margin: 0,
            padding: 0,
            background: 'transparent',
            fontSize: '0.75rem',
            lineHeight: '1.6',
          }}
          codeTagProps={{
            style: {
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            },
          }}
        >
          {value}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
