import { memo, useCallback, useState } from 'react';

import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import c from 'react-syntax-highlighter/dist/esm/languages/prism/c';
import cpp from 'react-syntax-highlighter/dist/esm/languages/prism/cpp';
import csharp from 'react-syntax-highlighter/dist/esm/languages/prism/csharp';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import go from 'react-syntax-highlighter/dist/esm/languages/prism/go';
import java from 'react-syntax-highlighter/dist/esm/languages/prism/java';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
import kotlin from 'react-syntax-highlighter/dist/esm/languages/prism/kotlin';
import markdown from 'react-syntax-highlighter/dist/esm/languages/prism/markdown';
import markup from 'react-syntax-highlighter/dist/esm/languages/prism/markup';
import php from 'react-syntax-highlighter/dist/esm/languages/prism/php';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import regex from 'react-syntax-highlighter/dist/esm/languages/prism/regex';
import ruby from 'react-syntax-highlighter/dist/esm/languages/prism/ruby';
import rust from 'react-syntax-highlighter/dist/esm/languages/prism/rust';
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql';
import swift from 'react-syntax-highlighter/dist/esm/languages/prism/swift';
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml';
import { toast } from 'sonner';

import { appPrismTheme } from './prism-theme';

SyntaxHighlighter.registerLanguage('bash', bash);
SyntaxHighlighter.registerLanguage('sh', bash);
SyntaxHighlighter.registerLanguage('c', c);
SyntaxHighlighter.registerLanguage('cpp', cpp);
SyntaxHighlighter.registerLanguage('csharp', csharp);
SyntaxHighlighter.registerLanguage('css', css);
SyntaxHighlighter.registerLanguage('go', go);
SyntaxHighlighter.registerLanguage('html', markup);
SyntaxHighlighter.registerLanguage('java', java);
SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('js', javascript);
SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('jsx', jsx);
SyntaxHighlighter.registerLanguage('kotlin', kotlin);
SyntaxHighlighter.registerLanguage('markdown', markdown);
SyntaxHighlighter.registerLanguage('md', markdown);
SyntaxHighlighter.registerLanguage('php', php);
SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('py', python);
SyntaxHighlighter.registerLanguage('regex', regex);
SyntaxHighlighter.registerLanguage('ruby', ruby);
SyntaxHighlighter.registerLanguage('rb', ruby);
SyntaxHighlighter.registerLanguage('rust', rust);
SyntaxHighlighter.registerLanguage('sql', sql);
SyntaxHighlighter.registerLanguage('swift', swift);
SyntaxHighlighter.registerLanguage('ts', typescript);
SyntaxHighlighter.registerLanguage('tsx', tsx);
SyntaxHighlighter.registerLanguage('typescript', typescript);
SyntaxHighlighter.registerLanguage('yaml', yaml);
SyntaxHighlighter.registerLanguage('yml', yaml);

interface CodeBlockProps {
  language: string;
  value: string;
}

const CodeBlock = memo(function CodeBlock({ language, value }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      toast.info(`Скопировано`);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [value]);

  return (
    <div className="rounded-lg overflow-hidden border border-[#262626] my-2 bg-[#1a1a1a] isolate">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#141414] border-b border-[#262626]">
        <span className="text-[10px] text-[#808080] font-mono uppercase tracking-wide">
          {language}
        </span>
        <button
          onClick={handleCopy}
          className="text-[10px] text-[#808080] hover:text-white transition-colors"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <div className="p-3 overflow-x-auto">
        <SyntaxHighlighter
          language={language}
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
        >
          {value}
        </SyntaxHighlighter>
      </div>
    </div>
  );
});

export default CodeBlock;
