import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check, Terminal, Brain, MessageSquare } from 'lucide-react';

const CodeBlock = ({ children, className }) => {
  const [copied, setCopied] = useState(false);
  const code = String(children).replace(/\n$/, '');

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group relative my-4 overflow-hidden rounded-xl border border-white/10 bg-black/80 shadow-2xl backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-white/5 bg-white/5 px-4 py-2">
        <div className="flex items-center gap-2">
          <Terminal className="h-3.5 w-3.5 text-slate-500" />
          <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">Terminal Output</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded-md bg-white/5 px-2 py-1 text-[10px] font-bold text-slate-400 transition-all hover:bg-white/10 hover:text-white"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-sm leading-relaxed text-emerald-400 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        <code>{code}</code>
      </pre>
    </div>
  );
};

const MarkdownViewer = ({ text }) => {
  if (!text) return null;

  return (
    <div className="prose prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mb-6 text-3xl font-black text-white tracking-tight">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-4 mt-8 text-2xl font-bold text-white border-b border-white/10 pb-2">{children}</h2>
          ),
          h3: ({ children }) => {
            const isInsight = String(children).includes('Insight');
            const isWarRoom = String(children).includes('War-Room') || String(children).includes('Log');
            
            return (
              <div className="mb-4 mt-8 flex items-center gap-3 border-b border-gray-700/50 pb-2">
                {isInsight && <Brain className="h-5 w-5 text-yellow-400" />}
                {isWarRoom && <MessageSquare className="h-5 w-5 text-blue-400" />}
                <h3 className={`text-xl font-bold !m-0 ${isInsight ? 'text-yellow-400' : isWarRoom ? 'text-blue-400' : 'text-white'}`}>
                  {children}
                </h3>
              </div>
            );
          },
          p: ({ children }) => (
            <p className="mb-4 text-gray-200 leading-relaxed text-sm antialiased">{children}</p>
          ),
          strong: ({ children }) => {
            const content = String(children);
            const isCritical = /CRITICAL|ERROR|장애|위험|9[0-9]%/.test(content);
            const isWarning = /WARNING|주의|8[0-9]%/.test(content);
            
            return (
              <strong className={`font-black ${isCritical ? 'text-red-400 px-1 rounded bg-red-400/10' : isWarning ? 'text-amber-400 px-1 rounded bg-amber-400/10' : 'text-white'}`}>
                {children}
              </strong>
            );
          },
          ul: ({ children }) => (
            <ul className="mb-6 space-y-3 list-none p-0">{children}</ul>
          ),
          li: ({ children }) => (
            <li className="relative pl-6 text-gray-300 text-sm leading-relaxed before:absolute before:left-0 before:top-2 before:h-2 before:w-2 before:rounded-full before:bg-blue-500/50 hover:text-white transition-colors">
              {children}
            </li>
          ),
          code: ({ node, inline, className, children, ...props }) => {
            return !inline ? (
              <CodeBlock children={children} className={className} />
            ) : (
              <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs font-bold text-blue-300" {...props}>
                {children}
              </code>
            );
          },
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-blue-500/50 bg-blue-500/5 p-4 rounded-r-xl my-6 italic text-blue-100">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="my-6 overflow-hidden rounded-xl border border-white/10 bg-white/5 shadow-lg">
              <table className="w-full border-collapse text-left text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-white/10 bg-white/10 px-4 py-3 font-bold text-white">{children}</th>
          ),
          td: ({ children }) => (
            <td className="border-b border-white/5 px-4 py-3 text-gray-300">{children}</td>
          )
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownViewer;
