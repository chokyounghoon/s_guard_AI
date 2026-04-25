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

  // 📝 Pre-process: 불필요 요소 제거 및 타임라인 포맷 정리
  const processedText = text
    .replace(/([^\n])(⏱️)/g, '$1\n\n$2')            // ⏱️ 앞에 줄바꿈 삽입 (인트로 문장 분리)
    .replace(/⏱️\s*장애 대응 타임라인 요약\s*\*?/g, '') // 타임라인 제목 제거
    .replace(/⏱️\s*[^\n]*/g, '')                      // 남은 ⏱️ 라인 제거
    .replace(/\*\*([^*\n]*)\*\*/g, '$1')   // **bold** → 텍스트
    .replace(/\*([^*\n]+)\*/g, '$1')       // *italic* → 텍스트
    .replace(/\*\*/g, '')                  // 남은 ** 제거
    .replace(/^[\*]\s+/gm, '- ')           // 라인 시작 * 를 - 로 통일
    .replace(/\d+\.\s+[\*\-]?\s*/g, '- ')  // '1. * '/'1. '/'1. - ' → '- '
    .replace(/([^\n])\n?(💡 핵심 원인|Root Cause:)/g, '$1\n\n$2')
    .replace(/([^\n])\n?(✅ 최종 조치 결과|Resolution:)/g, '$1\n\n$2')
    .replace(/\n{3,}/g, '\n\n');          // 연속 빈 줄 정리

  // 소제목 감지: 리스트 마커 유무 무관 → 항상 '- __SH__keyword' 형식
  const SH_KEYWORDS = ['장애내용','장애 내용','발생원인','발생 원인','핵심원인','핵심 원인','진행결과','진행 결과','진행경과','진행 경과','상황종료','상황 종료','추가작업 진행여부','추가작업','추가 작업'];
  const numberedText = processedText.replace(
    new RegExp(`^(?:[-*]\\s+)?(${SH_KEYWORDS.join('|')})\\s*$`, 'gm'),
    (_, kw) => `- __SH__${kw}`
  );

  return (
    <div className="prose prose-invert max-w-none space-y-8 pb-12">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mb-8 text-4xl font-black text-white tracking-tighter bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-6 mt-12 text-2xl font-black text-white flex items-center gap-3">
              <div className="w-2 h-8 bg-blue-500 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
              {children}
            </h2>
          ),
          strong: ({ children }) => <span className="font-black text-white border-b border-blue-500/30">{children}</span>,
          em: ({ children }) => <span className="text-slate-400 italic">{children}</span>,
          
          p: ({ children }) => {
            const childrenArray = React.Children.toArray(children);
            const contentStr = childrenArray.map(child => typeof child === 'string' ? child : '').join('');

            // 💡 핵심 원인 (Root Cause) - High Fidelity Card
            if (contentStr.includes('💡 핵심 원인') || contentStr.includes('Root Cause:')) {
              return (
                <div className="group my-8 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 to-orange-600/5 blur-xl opacity-50" />
                  <div className="relative bg-[#1a1c26]/80 backdrop-blur-2xl rounded-[2.5rem] border border-amber-500/20 p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all hover:border-amber-500/40 group/card">
                    <div className="flex items-start gap-6 mb-6">
                      <div className="w-14 h-14 bg-gradient-to-br from-amber-400 to-orange-600 shadow-[0_0_25px_rgba(245,158,11,0.4)] rounded-[1.25rem] shrink-0 flex items-center justify-center rotate-3 group-hover/card:rotate-0 transition-transform duration-500">
                        <TriangleAlert className="w-7 h-7 text-black stroke-[2.5px]" />
                      </div>
                      <div className="pt-1">
                        <span className="text-[11px] font-black text-amber-500 uppercase tracking-[0.3em] block mb-1 opacity-80">Critical Analysis</span>
                        <h4 className="text-2xl font-black text-white tracking-tight">핵심 원인 분석</h4>
                      </div>
                    </div>
                    <div className="text-amber-50/90 font-medium leading-relaxed text-[16px] pl-6 border-l-2 border-amber-500/30 ml-1 py-1">
                      {children}
                    </div>
                  </div>
                </div>
              );
            }

            // ✅ 최종 조치 결과 (Resolution) - High Fidelity Card
            if (contentStr.includes('✅ 최종 조치 결과') || contentStr.includes('Resolution:')) {
              return (
                <div className="group my-8 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-teal-600/5 blur-xl opacity-50" />
                  <div className="relative bg-[#1a1c26]/80 backdrop-blur-2xl rounded-[2.5rem] border border-emerald-500/20 p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all hover:border-emerald-500/40 group/card">
                    <div className="flex items-start gap-6 mb-6">
                      <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-teal-600 shadow-[0_0_25px_rgba(16,185,129,0.4)] rounded-[1.25rem] shrink-0 flex items-center justify-center -rotate-3 group-hover/card:rotate-0 transition-transform duration-500">
                        <CircleCheckBig className="w-7 h-7 text-black stroke-[2.5px]" />
                      </div>
                      <div className="pt-1">
                        <span className="text-[11px] font-black text-emerald-500 uppercase tracking-[0.3em] block mb-1 opacity-80">Resolution Confirmed</span>
                        <h4 className="text-2xl font-black text-white tracking-tight">최종 조치 결과</h4>
                      </div>
                    </div>
                    <div className="text-emerald-50/90 font-medium leading-relaxed text-[16px] pl-6 border-l-2 border-emerald-500/30 ml-1 py-1">
                      {children}
                    </div>
                  </div>
                </div>
              );
            }

            return <div className="mb-4 text-slate-300 leading-relaxed text-[15px] font-medium antialiased">{children}</div>;
          },

          ol: ({ children }) => <div className="space-y-6 my-8">{children}</div>,
          ul: ({ children }) => <div className="space-y-6 my-8">{children}</div>,

          li: ({ children }) => {
            const extractText = (node) => {
              if (typeof node === 'string' || typeof node === 'number') return String(node);
              if (Array.isArray(node)) return node.map(extractText).join('');
              if (React.isValidElement(node)) return extractText(node.props.children);
              return '';
            };
            const content = extractText(children).trim();
            if (!content || content === '*' || content === '-') return null;

            // ⏱️ Timeline Item Logic
            const timestampMatch = content.match(/^\[?((?:\d{4}-\d{2}-\d{2}\s)?\d{2}:\d{2}(?::\d{2})?(?:\s*~\s*\d{2}:\d{2})?(?:\sKST)?)\]?/);
            if (timestampMatch || content.match(/^\d{2}:\d{2}/)) {
              const fullMatch = timestampMatch ? timestampMatch[0] : content.split(':')[0] + ':' + content.split(':')[1].substring(0,2);
              const timestamp = timestampMatch ? timestampMatch[1] : fullMatch;
              const text = content.replace(fullMatch, '').replace(/^[:\s\-~]+/, '').trim();
              
              return (
                <div className="relative pl-12 pb-8 last:pb-0 group">
                  {/* Timeline Line */}
                  <div className="absolute left-[19px] top-2 bottom-0 w-0.5 bg-gradient-to-b from-blue-500/50 to-transparent group-last:hidden" />
                  {/* Timeline Dot */}
                  <div className="absolute left-0 top-1.5 w-10 h-10 flex items-center justify-center">
                    <div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.8)] z-10 transition-transform group-hover:scale-125" />
                    <div className="absolute w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 animate-pulse" />
                  </div>
                  
                  <div className="bg-[#1a1f2e]/40 border border-white/5 rounded-3xl p-5 transition-all hover:bg-[#1a1f2e]/60 hover:border-blue-500/30">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 font-mono text-[11px] font-black border border-blue-500/20 shadow-inner">
                        {timestamp}
                      </span>
                      <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
                    </div>
                    <p className="text-slate-200 text-[14px] leading-relaxed font-semibold">{text}</p>
                  </div>
                </div>
              );
            }

            // 🏷️ Section Header Logic
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
                <div className="mt-16 mb-8 first:mt-4">
                  <div className="flex items-center gap-4 mb-4">
                    <div className={`bg-${color}-500 shadow-[0_0_15px_rgba(0,0,0,0.2)] p-2 rounded-xl`}>
                      <SectionIcon className="w-5 h-5 text-black stroke-[2.5px]" />
                    </div>
                    <h3 className={`text-xl font-black text-white tracking-tight uppercase`}>{heading}</h3>
                  </div>
                  <div className={`h-1 w-full bg-gradient-to-r from-${color}-500/50 via-${color}-500/10 to-transparent rounded-full`} />
                </div>
              );
            }

            // Regular List Item
            return (
              <div className="flex items-start gap-4 bg-white/5 border border-white/5 p-5 rounded-3xl hover:bg-white/10 transition-all group">
                <div className="mt-2 w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)] shrink-0 transition-transform group-hover:scale-150" />
                <span className="text-slate-200 text-[15px] font-medium leading-relaxed">{content}</span>
              </div>
            );
          },

          code: ({ inline, className, children }) => {
            return !inline ? (
              <CodeBlock children={children} className={className} />
            ) : (
              <code className="rounded-lg bg-blue-500/10 px-2 py-1 font-mono text-[11px] font-black text-blue-400 border border-blue-500/20">
                {children}
              </code>
            );
          },

          blockquote: ({ children }) => (
            <div className="relative my-10 pl-8">
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-blue-600 to-indigo-600 rounded-full" />
              <div className="bg-gradient-to-r from-blue-500/10 to-transparent p-6 rounded-r-[2rem] italic text-lg text-blue-50 font-medium leading-relaxed">
                {children}
              </div>
            </div>
          ),

          table: ({ children }) => (
            <div className="my-10 overflow-hidden rounded-[2.5rem] border border-white/10 bg-[#1a1f2e]/40 shadow-2xl backdrop-blur-xl">
              <table className="w-full border-collapse text-left text-[13px]">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="bg-white/5 px-6 py-4 font-black text-white uppercase tracking-widest border-b border-white/10">{children}</th>
          ),
          td: ({ children }) => (
            <td className="px-6 py-4 text-slate-300 border-b border-white/5">{children}</td>
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
        {numberedText}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownViewer;
