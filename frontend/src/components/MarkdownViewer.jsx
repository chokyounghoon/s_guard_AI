import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check, Terminal, Brain, MessageSquare, AlertTriangle, CheckCircle2, Clock, Zap, Shield, Database, Server, Star } from 'lucide-react';

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

  // 📝 Pre-process text to ensure Callout Sections are separated by newlines
  // This ensures that even if Dify sends them in one paragraph, they are rendered as distinct blocks.
  const processedText = text
    .replace(/([^\n])\n?(💡 핵심 원인|Root Cause:)/g, '$1\n\n$2')
    .replace(/([^\n])\n?(✅ 최종 조치 결과|Resolution:)/g, '$1\n\n$2');

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
            const contentStr = String(children);
            const isInsight = contentStr.includes('Insight');
            const isWarRoom = contentStr.includes('War-Room') || contentStr.includes('Log');
            
            const isSecurity = contentStr.includes('Security') && (contentStr.includes('Agent') || contentStr.includes('AGENT'));
            const isDB = contentStr.includes('DB') && (contentStr.includes('Agent') || contentStr.includes('AGENT'));
            const isDevOps = contentStr.includes('DevOps') && (contentStr.includes('Agent') || contentStr.includes('AGENT'));
            const isLeader = contentStr.includes('Leader') && (contentStr.includes('Agent') || contentStr.includes('AGENT'));
            
            let Icon = null;
            let iconColor = '';
            let textColor = 'text-white';
            
            if (isInsight) { Icon = Brain; iconColor = 'text-yellow-400'; textColor = 'text-yellow-400'; }
            else if (isWarRoom) { Icon = MessageSquare; iconColor = 'text-blue-400'; textColor = 'text-blue-400'; }
            else if (isSecurity) { Icon = Shield; iconColor = 'text-red-400'; textColor = 'text-red-400'; }
            else if (isDB) { Icon = Database; iconColor = 'text-yellow-400'; textColor = 'text-yellow-400'; }
            else if (isDevOps) { Icon = Server; iconColor = 'text-blue-400'; textColor = 'text-blue-400'; }
            else if (isLeader) { Icon = Star; iconColor = 'text-purple-400'; textColor = 'text-purple-400'; }
            
            return (
              <div className="mb-4 mt-8 flex items-center gap-3 border-b border-gray-700/50 pb-2">
                {Icon && <Icon className={`h-5 w-5 ${iconColor}`} />}
                <h3 className={`text-xl font-bold !m-0 ${textColor}`}>
                  {children}
                </h3>
              </div>
            );
          },
          p: ({ children }) => {
            // Check if children contain any block-level components to avoid invalid nesting
            const childrenArray = React.Children.toArray(children);
            const hasBlockElement = childrenArray.some(child => {
              if (React.isValidElement(child)) {
                return typeof child.type !== 'string' || ['div', 'pre', 'table', 'blockquote', 'h1', 'h2', 'h3'].includes(child.type);
              }
              return false;
            });

            const contentStr = childrenArray.map(child => {
              if (typeof child === 'string') return child;
              if (React.isValidElement(child) && typeof child.props.children === 'string') return child.props.children;
              return '';
            }).join('');

            // 💡 핵심 원인 (Root Cause) 특수 스타일 적용
            if (contentStr.includes('💡 핵심 원인') || contentStr.includes('Root Cause:')) {
              return (
                <div className="my-6 p-6 rounded-3xl bg-amber-500/10 border border-amber-500/20 shadow-xl shadow-amber-900/10 border-l-4 border-l-amber-500 animate-in fade-in slide-in-from-left-2 duration-500">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="bg-amber-500/20 p-1.5 rounded-lg">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                    </div>
                    <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Root Cause Analysis</span>
                  </div>
                  <div className="text-amber-100/90 font-bold leading-relaxed text-[13px]">
                    {children}
                  </div>
                </div>
              );
            }

            // ✅ 최종 조치 결과 (Resolution) 특수 스타일 적용
            if (contentStr.includes('✅ 최종 조치 결과') || contentStr.includes('Resolution:')) {
              return (
                <div className="my-6 p-6 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 shadow-xl shadow-emerald-900/10 border-l-4 border-l-emerald-500 animate-in fade-in slide-in-from-left-2 duration-500">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="bg-emerald-500/20 p-1.5 rounded-lg">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    </div>
                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Final Resolution Confirmed</span>
                  </div>
                  <div className="text-emerald-50/90 font-bold leading-relaxed text-[13px]">
                    {children}
                  </div>
                </div>
              );
            }

            // Timestamp detection logic for paragraph starts
            let timestampBadge = null;
            let remainingChildren = children;

            if (childrenArray.length > 0 && typeof childrenArray[0] === 'string') {
              const firstChild = childrenArray[0];
              const timestampMatch = firstChild.match(/^\[(\d{1,2}:\d{2}(?::\d{2})?(?:\sKST)?)\]\s*/);
              
              if (timestampMatch) {
                const timestamp = timestampMatch[1];
                timestampBadge = (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 mr-2 rounded bg-indigo-500/20 text-indigo-300 font-mono text-[10px] font-black border border-indigo-500/30 shadow-lg shadow-indigo-500/10 uppercase tracking-tighter">
                    <Clock className="w-3 h-3" />
                    {timestamp}
                  </span>
                );
                
                // Remove the matched timestamp from the first text node
                const cleanedText = firstChild.replace(timestampMatch[0], '');
                remainingChildren = [cleanedText, ...childrenArray.slice(1)];
              }
            }

            const content = (
              <>
                {timestampBadge}
                {remainingChildren}
              </>
            );

            if (hasBlockElement) {
              return <div className="mb-4 text-gray-200 leading-relaxed text-sm antialiased">{content}</div>;
            }
            return <p className="mb-6 text-gray-200 leading-relaxed text-sm antialiased">{content}</p>;
          },
          strong: ({ children }) => {
            const content = String(children);
            const isCritical = /CRITICAL|ERROR|장애|위험|9[0-9]%/.test(content);
            const isWarning = /WARNING|주의|8[0-9]%/.test(content);
            
            const isSecurity = content.includes('Security') && (content.includes('Agent') || content.includes('AGENT'));
            const isDB = content.includes('DB') && (content.includes('Agent') || content.includes('AGENT'));
            const isDevOps = content.includes('DevOps') && (content.includes('Agent') || content.includes('AGENT'));
            const isLeader = content.includes('Leader') && (content.includes('Agent') || content.includes('AGENT'));
            
            let colorCls = 'text-white';
            if (isSecurity) colorCls = 'text-red-400';
            else if (isDB) colorCls = 'text-yellow-400';
            else if (isDevOps) colorCls = 'text-blue-400';
            else if (isLeader) colorCls = 'text-purple-400';
            else if (isCritical) colorCls = 'text-red-400 px-1 rounded bg-red-400/10';
            else if (isWarning) colorCls = 'text-amber-400 px-1 rounded bg-amber-400/10';

            return (
              <strong className={`font-black ${colorCls}`}>
                {children}
              </strong>
            );
          },
          ul: ({ children }) => (
            <ul className="mb-4 space-y-2 list-none p-0">
              {children}
            </ul>
          ),
          li: ({ children }) => {
            const content = String(children);
            // Enhanced timestamp regex to support:
            // [18:12:10], [14:52 KST], [2024-03-28 14:52 KST]
            const timestampMatch = content.match(/^\[((?:\d{4}-\d{2}-\d{2}\s)?\d{2}:\d{2}(?::\d{2})?(?:\sKST)?)\]/);
            
            if (timestampMatch) {
              const timestamp = timestampMatch[1];
              const text = content.replace(timestampMatch[0], '').trim();
              
              return (
                <li className="relative pl-12 pb-8 list-none group/item">
                  {/* Timeline Line */}
                  <div className="absolute left-[3px] top-4 bottom-0 w-[1.5px] bg-gradient-to-b from-blue-500/40 via-blue-500/10 to-transparent group-last/item:hidden" />
                  
                  {/* Timeline Dot */}
                  <div className="absolute left-[-4px] top-1.5 z-10 h-4 w-4 rounded-full border-2 border-[#1a1f2e] bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)] group-hover/item:scale-125 transition-transform duration-300" />
                  
                  {/* Content Card */}
                  <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 transition-all duration-300 group-hover/item:bg-white/[0.05] group-hover/item:border-white/10 group-hover/item:translate-x-1 shadow-lg shadow-black/10">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 font-mono text-[10px] font-bold border border-blue-500/20">
                        {timestamp}
                      </span>
                      <div className="h-px flex-1 bg-white/5" />
                    </div>
                    <div className="text-gray-200 text-sm leading-relaxed antialiased">
                      <ReactMarkdown components={{ p: ({children}) => <span>{children}</span> }}>{text}</ReactMarkdown>
                    </div>
                  </div>
                </li>
              );
            }

            return (
              <li className={`relative pl-4 text-gray-300 text-sm leading-relaxed mb-2
                before:absolute before:left-0 before:top-2 before:h-1.5 before:w-1.5 before:rounded-full 
                before:bg-slate-500
                hover:text-white transition-all`}>
                {children}
              </li>
            );
          },
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
          ),
          img: ({ src, alt }) => {
            if (src && (src.includes('aitopia.ai') || src.includes('logo.svg'))) {
              return (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400 text-xs font-black my-4 animate-pulse shadow-lg shadow-blue-500/5">
                  <Brain className="h-4 w-4" />
                  <span className="uppercase tracking-tighter">S-Guard Intelligent Asset</span>
                </span>
              );
            }
            return <img src={src} alt={alt} className="rounded-xl border border-white/10 my-6 max-w-full h-auto shadow-2xl transition-all hover:scale-[1.02]" />;
          }
        }}
      >
        {processedText}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownViewer;
