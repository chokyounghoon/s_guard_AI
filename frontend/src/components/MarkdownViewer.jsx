import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check, Terminal, Brain, MessageSquare, TriangleAlert, CircleCheckBig, Clock, Zap, Shield, Database, Server, Star, CirclePlus } from 'lucide-react';

const CodeBlock = ({ children, className }) => {
  const [copied, setCopied] = useState(false);
  const code = String(children).replace(/\n$/, '');

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group relative my-2 overflow-hidden rounded-lg border border-white/10 bg-black/80 shadow-xl">
      <div className="flex items-center justify-between border-b border-white/5 bg-white/5 px-3 py-1.5">
        <div className="flex items-center gap-2">
          <Terminal className="h-3 w-3 text-slate-500" />
          <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">Terminal</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-bold text-slate-400 transition-all hover:bg-white/10 hover:text-white"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed text-emerald-400">
        <code>{code}</code>
      </pre>
    </div>
  );
};

const MarkdownViewer = ({ text }) => {
  if (!text) return null;

  // 📝 Pre-process: 불필요 요소 제거 및 타임라인 포맷 정리
  const processedText = text
    .replace(/([^\n])(⏱️)/g, '$1\n\n$2')
    .replace(/⏱️\s*장애 대응 타임라인 요약\s*\*?/g, '')
    .replace(/⏱️\s*[^\n]*/g, '')
    .replace(/\*\*([^*\n]*)\*\*/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/^[\*]\s+/gm, '- ')
    .replace(/\d+\.\s+[\*\-]?\s*/g, '- ')
    .replace(/([^\n])\n?(💡 핵심 원인|Root Cause:)/g, '$1\n\n$2')
    .replace(/([^\n])\n?(✅ 최종 조치 결과|Resolution:)/g, '$1\n\n$2')
    .replace(/\n{3,}/g, '\n\n');

  const SH_KEYWORDS = ['장애내용','장애 내용','발생원인','발생 원인','핵심원인','핵심 원인','진행결과','진행 결과','진행경과','진행 경과','상황종료','상황 종료','추가작업 진행여부','추가작업','추가 작업'];
  const numberedText = processedText.replace(
    new RegExp(`^(?:[-*]\\s+)?(${SH_KEYWORDS.join('|')})\\s*$`, 'gm'),
    (_, kw) => `- __SH__${kw}`
  );

  return (
    <div className="prose prose-invert max-w-none space-y-1 pb-2">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mb-2 text-lg font-black text-white tracking-tight">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-1 mt-4 text-base font-black text-white flex items-center gap-2">
              <div className="w-1.5 h-4 bg-blue-500 rounded-full" />
              {children}
            </h2>
          ),
          strong: ({ children }) => <span className="font-black text-white">{children}</span>,
          em: ({ children }) => <span className="text-slate-400 italic">{children}</span>,

          p: ({ children }) => {
            const childrenArray = React.Children.toArray(children);
            const contentStr = childrenArray.map(child => typeof child === 'string' ? child : '').join('');

            // 💡 핵심 원인 (Root Cause)
            if (contentStr.includes('💡 핵심 원인') || contentStr.includes('Root Cause:')) {
              return (
                <div className="my-2 flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                  <TriangleAlert className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest block mb-0.5">Root Cause</span>
                    <div className="text-amber-50/90 text-sm leading-relaxed">{children}</div>
                  </div>
                </div>
              );
            }

            // ✅ 최종 조치 결과 (Resolution)
            if (contentStr.includes('✅ 최종 조치 결과') || contentStr.includes('Resolution:')) {
              return (
                <div className="my-2 flex items-start gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                  <CircleCheckBig className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest block mb-0.5">Resolution</span>
                    <div className="text-emerald-50/90 text-sm leading-relaxed">{children}</div>
                  </div>
                </div>
              );
            }

            return <div className="mb-1 text-slate-300 leading-snug text-[13px]">{children}</div>;
          },

          ol: ({ children }) => <div className="space-y-0.5 my-1">{children}</div>,
          ul: ({ children }) => <div className="space-y-0.5 my-1">{children}</div>,

          li: ({ children }) => {
            const extractText = (node) => {
              if (typeof node === 'string' || typeof node === 'number') return String(node);
              if (Array.isArray(node)) return node.map(extractText).join('');
              if (React.isValidElement(node)) return extractText(node.props.children);
              return '';
            };
            const content = extractText(children).trim();
            if (!content || content === '*' || content === '-') return null;

            // ⏱️ Timeline Item
            const timestampMatch = content.match(/^\[?((?:\d{4}-\d{2}-\d{2}\s)?\d{2}:\d{2}(?::\d{2})?(?:\s*~\s*\d{2}:\d{2})?(?:\sKST)?)\]?/);
            if (timestampMatch || content.match(/^\d{2}:\d{2}/)) {
              const fullMatch = timestampMatch ? timestampMatch[0] : content.split(':')[0] + ':' + content.split(':')[1].substring(0,2);
              const timestamp = timestampMatch ? timestampMatch[1] : fullMatch;
              const text = content.replace(fullMatch, '').replace(/^[:\s\-~]+/, '').trim();

              return (
                <div className="flex items-start gap-2 py-0.5 group">
                  <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                  <span className="px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-400 font-mono text-[10px] font-black border border-blue-500/20 shrink-0">
                    {timestamp}
                  </span>
                  <span className="text-slate-300 text-[13px] leading-snug">{text}</span>
                </div>
              );
            }

            // 🏷️ Section Header
            const shMatch = content.match(/^__SH__(.+)$/);
            if (shMatch) {
              const heading = shMatch[1].trim();
              const ICONS = {
                '장애': { icon: TriangleAlert, color: 'blue' },
                '발생': { icon: Zap, color: 'amber' },
                '핵심': { icon: Brain, color: 'orange' },
                '진행': { icon: Clock, color: 'indigo' },
                '상황': { icon: Shield, color: 'emerald' },
                '추가': { icon: CirclePlus, color: 'purple' },
              };
              const iconKey = Object.keys(ICONS).find(k => heading.includes(k)) || '장애';
              const { icon: SectionIcon, color } = ICONS[iconKey];

              return (
                <div className="mt-4 mb-1 first:mt-1">
                  <div className="flex items-center gap-2">
                    <div className={`bg-${color}-500/20 border border-${color}-500/30 p-1 rounded-lg`}>
                      <SectionIcon className={`w-3.5 h-3.5 text-${color}-400`} />
                    </div>
                    <h3 className="text-sm font-black text-white tracking-wide uppercase">{heading}</h3>
                    <div className="h-px flex-1 bg-white/10" />
                  </div>
                </div>
              );
            }

            // Regular List Item
            return (
              <div className="flex items-start gap-2 py-0.5">
                <div className="mt-1.5 w-1 h-1 rounded-full bg-blue-500/60 shrink-0" />
                <span className="text-slate-300 text-[13px] leading-snug">{content}</span>
              </div>
            );
          },

          code: ({ inline, className, children }) => {
            return !inline ? (
              <CodeBlock children={children} className={className} />
            ) : (
              <code className="rounded bg-blue-500/10 px-1.5 py-0.5 font-mono text-[10px] font-black text-blue-400 border border-blue-500/20">
                {children}
              </code>
            );
          },

          blockquote: ({ children }) => (
            <div className="relative my-2 pl-3 border-l-2 border-blue-500/50">
              <div className="text-[13px] text-blue-100/80 italic leading-relaxed">{children}</div>
            </div>
          ),

          table: ({ children }) => (
            <div className="my-2 overflow-hidden rounded-xl border border-white/10 bg-[#1a1f2e]/40 shadow-xl">
              <table className="w-full border-collapse text-left text-[11px]">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="bg-white/5 px-3 py-2 font-black text-white uppercase tracking-wide border-b border-white/10 text-[10px]">{children}</th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-1.5 text-slate-300 border-b border-white/5 text-[13px]">{children}</td>
          ),
          img: ({ src, alt }) => {
            if (src && (src.includes('aitopia.ai') || src.includes('logo.svg'))) {
              return (
                <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400 text-[10px] font-black my-1">
                  <Brain className="h-3 w-3" />
                  <span className="uppercase tracking-tight">S-Guard AI</span>
                </span>
              );
            }
            return <img src={src} alt={alt} className="rounded-xl border border-white/10 my-2 max-w-full h-auto shadow-xl" />;
          }
        }}
      >
        {numberedText}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownViewer;
