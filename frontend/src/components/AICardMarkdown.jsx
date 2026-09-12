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
            <h1 className="text-lg sm:text-xl font-bold text-blue-400 flex items-center gap-2 my-3 pb-2 border-b border-blue-500/20">
              <Sparkles className="w-5 h-5 text-blue-400 shrink-0" />
              <span>{children}</span>
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base sm:text-lg font-bold text-emerald-400 flex items-center gap-2 mt-5 mb-2.5 pb-1 border-b border-emerald-500/20">
              <span className="w-1.5 h-4 bg-emerald-500 rounded-full shrink-0 inline-block" />
              <span>{children}</span>
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm sm:text-base font-bold text-slate-200 flex items-center gap-1.5 mt-4 mb-2">
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full shrink-0 inline-block" />
              <span>{children}</span>
            </h3>
          ),
          strong: ({ children }) => (
            <span className="font-bold text-slate-100 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700 mx-0.5 inline-block tracking-wide">
              {children}
            </span>
          ),
          em: ({ children }) => <span className="text-slate-300 italic font-medium">{children}</span>,
          p: ({ children }) => (
            <div className="my-2.5 text-[13px] sm:text-[14px] leading-[1.65] text-slate-200 break-words whitespace-pre-wrap font-sans">
              {children}
            </div>
          ),
          ul: ({ children }) => <ul className="space-y-2 my-3 pl-2">{children}</ul>,
          ol: ({ children }) => <ol className="space-y-2 my-3 pl-2 list-decimal list-inside">{children}</ol>,
          li: ({ children }) => (
            <li className="flex items-start gap-2 text-[13px] sm:text-[14px] text-slate-200 leading-relaxed font-sans">
              <span className="mt-2 w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0 inline-block" />
              <span className="flex-1 min-w-0 block">{children}</span>
            </li>
          ),
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto rounded-xl border border-slate-800 bg-[#111827] shadow-lg">
              <table className="w-full border-collapse text-left text-xs sm:text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="bg-slate-800/70 px-4 py-2.5 font-bold text-slate-200 uppercase tracking-wider border-b border-slate-700 whitespace-nowrap">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-3 text-slate-300 border-b border-slate-800/80 align-top leading-relaxed whitespace-pre-wrap">
              {children}
            </td>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-3 pl-4 border-l-4 border-blue-500 bg-blue-500/10 py-2.5 pr-3 rounded-r-xl text-slate-300 italic text-sm">
              {children}
            </blockquote>
          ),
          code: ({ inline, children }) => (
            inline ? (
              <span className="bg-slate-800 text-blue-300 font-mono font-medium px-1.5 py-0.5 rounded text-xs border border-slate-700 inline-block">
                {children}
              </span>
            ) : (
              <pre className="my-3 rounded-xl border border-slate-800 bg-[#080c14] font-mono text-xs text-emerald-400 p-4 overflow-x-auto shadow-md block">
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
