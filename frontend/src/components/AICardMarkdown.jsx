import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Sparkles } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const AICardMarkdown = ({ text }) => {
  const { isLight } = useTheme();
  if (!text) return null;

  // Pre-process raw text for flawless table & break rendering
  const cleanText = text
    .replace(/<br\s*\/?>/gi, '\n')
    // Ensure there's a blank line before any markdown table so parser doesn't miss it
    .replace(/([^\n])\n(\s*\|.*?\|)/g, '$1\n\n$2')
    .replace(/^[\*•●]\s+/gm, '- ')
    .replace(/\n{3,}/g, '\n\n');

  return (
    <div className={`max-w-none leading-[1.6] ${isLight ? 'text-slate-900' : 'prose prose-invert text-slate-100'}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className={`text-lg sm:text-xl font-bold flex items-center gap-2 my-3 pb-2 border-b ${isLight ? 'text-blue-700 border-blue-200' : 'text-blue-400 border-blue-500/20'}`}>
              <Sparkles className={`w-5 h-5 shrink-0 ${isLight ? 'text-blue-600' : 'text-blue-400'}`} />
              <span>{children}</span>
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className={`text-base sm:text-lg font-bold flex items-center gap-2 mt-5 mb-2.5 pb-1 border-b ${isLight ? 'text-emerald-700 border-emerald-200' : 'text-emerald-400 border-emerald-500/20'}`}>
              <span className={`w-1.5 h-4 rounded-full shrink-0 inline-block ${isLight ? 'bg-emerald-600' : 'bg-emerald-500'}`} />
              <span>{children}</span>
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className={`text-sm sm:text-base font-bold flex items-center gap-1.5 mt-4 mb-2 ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 inline-block ${isLight ? 'bg-blue-600' : 'bg-blue-400'}`} />
              <span>{children}</span>
            </h3>
          ),
          strong: ({ children }) => (
            <span className={`font-bold px-1.5 py-0.5 rounded border mx-0.5 inline-block tracking-wide ${
              isLight ? 'text-slate-900 bg-slate-100 border-slate-300' : 'text-slate-100 bg-slate-800/80 border-slate-700'
            }`}>
              {children}
            </span>
          ),
          em: ({ children }) => <span className={`italic font-medium ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{children}</span>,
          p: ({ children }) => (
            <div className={`my-2.5 text-[13px] sm:text-[14px] leading-[1.65] break-words whitespace-pre-wrap font-sans ${isLight ? 'text-slate-900 font-medium' : 'text-slate-200'}`}>
              {children}
            </div>
          ),
          ul: ({ children }) => <ul className="space-y-2 my-3 pl-2">{children}</ul>,
          ol: ({ children }) => <ol className="space-y-2 my-3 pl-2 list-decimal list-inside">{children}</ol>,
          li: ({ children }) => (
            <li className={`flex items-start gap-2 text-[13px] sm:text-[14px] leading-relaxed font-sans ${isLight ? 'text-slate-900 font-medium' : 'text-slate-200'}`}>
              <span className={`mt-2 w-1.5 h-1.5 rounded-full shrink-0 inline-block ${isLight ? 'bg-blue-600' : 'bg-blue-400'}`} />
              <span className="flex-1 min-w-0 block">{children}</span>
            </li>
          ),
          table: ({ children }) => (
            <div className={`my-4 overflow-x-auto rounded-xl border ${isLight ? 'border-slate-200 bg-white shadow-xs' : 'border-slate-800 bg-[#111827] shadow-lg'}`}>
              <table className="w-full border-collapse text-left text-xs sm:text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className={`px-4 py-2.5 font-bold uppercase tracking-wider border-b whitespace-nowrap ${isLight ? 'bg-slate-100 text-slate-900 border-slate-200' : 'bg-slate-800/70 text-slate-200 border-slate-700'}`}>
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className={`px-4 py-3 border-b align-top leading-relaxed whitespace-pre-wrap ${isLight ? 'text-slate-900 border-slate-200' : 'text-slate-300 border-slate-800/80'}`}>
              {children}
            </td>
          ),
          blockquote: ({ children }) => (
            <blockquote className={`my-3 pl-4 border-l-4 py-2.5 pr-3 rounded-r-xl italic text-sm ${isLight ? 'border-blue-600 bg-blue-50 text-slate-800' : 'border-blue-500 bg-blue-500/10 text-slate-300'}`}>
              {children}
            </blockquote>
          ),
          code: ({ inline, children }) => (
            inline ? (
              <span className={`font-mono font-medium px-1.5 py-0.5 rounded text-xs border inline-block ${isLight ? 'bg-slate-100 text-blue-700 border-slate-300' : 'bg-slate-800 text-blue-300 border-slate-700'}`}>
                {children}
              </span>
            ) : (
              <pre className={`my-3 rounded-xl border font-mono text-xs p-4 overflow-x-auto shadow-md block ${isLight ? 'border-slate-200 bg-slate-50 text-slate-900' : 'border-slate-800 bg-[#080c14] text-emerald-400'}`}>
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
