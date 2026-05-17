import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Sparkles } from 'lucide-react';

const AICardMarkdown = ({ text }) => {
  if (!text) return null;

  // Pre-process raw text for flawless table & break rendering
  const cleanText = text
    .replace(/<br\s*\/?>/gi, '\n')
    // Ensure there's a blank line before any markdown table so parser doesn't miss it
    .replace(/([^\n])\n(\s*\|.*?\|)/g, '$1\n\n$2')
    .replace(/\n{3,}/g, '\n\n');

  return (
    <div className="prose prose-invert max-w-none text-slate-100 leading-[1.6]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-lg sm:text-xl font-black text-[#00e5ff] flex items-center gap-2 my-3 pb-2 border-b border-[#00e5ff]/20">
              <Sparkles className="w-5 h-5 text-[#00e5ff] shrink-0" />
              <span>{children}</span>
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base sm:text-lg font-black text-[#00ff88] flex items-center gap-2 mt-5 mb-2.5 pb-1 border-b border-[#00ff88]/20">
              <span className="w-1.5 h-4 bg-[#00ff88] rounded-full shrink-0 inline-block" />
              <span>{children}</span>
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-1.5 mt-4 mb-2">
              <span className="w-1.5 h-1.5 bg-[#00e5ff] rounded-full shrink-0 inline-block" />
              <span>{children}</span>
            </h3>
          ),
          strong: ({ children }) => (
            <span className="font-black text-[#00ff88] bg-[#00ff88]/15 px-2 py-0.5 rounded-md border border-[#00ff88]/30 shadow-[0_0_10px_rgba(0,255,136,0.2)] mx-0.5 my-0.5 inline-block tracking-wide">
              {children}
            </span>
          ),
          em: ({ children }) => <span className="text-slate-300 italic font-medium">{children}</span>,
          p: ({ children }) => (
            <div className="my-2.5 text-[13px] sm:text-[14px] leading-[1.65] text-slate-100 break-words whitespace-pre-wrap font-sans">
              {children}
            </div>
          ),
          ul: ({ children }) => <ul className="space-y-2 my-3 pl-2">{children}</ul>,
          ol: ({ children }) => <ol className="space-y-2 my-3 pl-2 list-decimal list-inside">{children}</ol>,
          li: ({ children }) => (
            <li className="flex items-start gap-2 text-[13px] sm:text-[14px] text-slate-200 leading-relaxed font-sans">
              <span className="mt-2 w-1.5 h-1.5 rounded-full bg-[#00e5ff] shrink-0 shadow-[0_0_6px_rgba(0,229,255,0.8)] inline-block" />
              <span className="flex-1 min-w-0 block">{children}</span>
            </li>
          ),
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto rounded-xl border border-white/10 bg-[#040e21]/80 backdrop-blur-md shadow-2xl">
              <table className="w-full border-collapse text-left text-xs sm:text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="bg-[#00e5ff]/15 px-4 py-3 font-black text-[#00e5ff] uppercase tracking-wider border-b border-white/10 whitespace-nowrap">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-3 text-slate-200 border-b border-white/5 align-top leading-relaxed whitespace-pre-wrap">
              {children}
            </td>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-3 pl-4 border-l-4 border-[#00e5ff] bg-[#00e5ff]/5 py-2.5 pr-3 rounded-r-xl text-slate-300 italic text-sm">
              {children}
            </blockquote>
          ),
          code: ({ inline, children }) => (
            inline ? (
              <span className="bg-[#00e5ff]/15 text-[#00e5ff] font-mono font-bold px-1.5 py-0.5 rounded text-xs border border-[#00e5ff]/30 inline-block">
                {children}
              </span>
            ) : (
              <pre className="my-3 rounded-xl border border-white/10 bg-black/80 font-mono text-xs text-emerald-400 p-4 overflow-x-auto shadow-2xl block">
                <code>{children}</code>
              </pre>
            )
          )
        }}
      >
        {cleanText}
      </ReactMarkdown>
    </div>
  );
};

export default AICardMarkdown;
