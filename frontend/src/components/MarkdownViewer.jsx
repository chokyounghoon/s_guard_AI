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

const highlightString = (str) => {
  const regex = /(\b\d+(?:\.\d+)?%|행원 권한 누락|권한 점검 프로세스 가동|오류율|급증|누락|실패|초과|지연|권한|장애|원인|오류|비정상|중단|불가|예외|버그|에러|정상|복구|완료|점검|가동|해결|성공|안정|재시작)/g;
  const parts = str.split(regex);
  return parts.map((part, index) => {
    if (/^\d+(?:\.\d+)?%$/.test(part)) {
      return <span key={index} className="font-mono font-black text-[#fb923c] px-1.5 py-0.5 bg-orange-500/15 border border-orange-500/30 rounded shadow-sm mx-0.5 inline-block">{part}</span>;
    }
    if (/^(행원 권한 누락|오류율|급증|누락|실패|초과|지연|권한|장애|원인|오류|비정상|중단|불가|예외|버그|에러)$/.test(part)) {
      return <span key={index} className="font-black text-white underline decoration-amber-500 decoration-2 underline-offset-4 bg-amber-500/15 px-1.5 py-0.5 rounded border-b border-amber-500 mx-0.5 shadow-[0_0_10px_rgba(245,158,11,0.2)] inline-block">{part}</span>;
    }
    if (/^(권한 점검 프로세스 가동|정상|복구|완료|점검|가동|해결|성공|안정|재시작)$/.test(part)) {
      return <span key={index} className="font-bold text-emerald-300 bg-emerald-500/15 px-1.5 py-0.5 rounded border border-emerald-500/30 mx-0.5 inline-block">{part}</span>;
    }
    return part;
  });
};

const highlightKeywords = (node) => {
  if (typeof node === 'string') return highlightString(node);
  if (Array.isArray(node)) return node.map((child, i) => React.createElement(React.Fragment, { key: i }, highlightKeywords(child)));
  if (React.isValidElement(node)) {
    if (node.type === 'code' || node.type === 'pre' || node.type === 'a' || node.type === 'button' || node.type === 'span') return node;
    if (node.props && node.props.children) {
      return React.cloneElement(node, {}, highlightKeywords(node.props.children));
    }
  }
  return node;
};

const MarkdownViewer = ({ text, onLinkClick }) => {
  if (!text) return null;

  // 📝 Pre-process: 불필요 요소 제거 (번호 제목 **N.** 패턴은 유지)
  const processedText = text
    .replace(/#*\s*\[?S-Autopilot Insight\]?\s*\n?/gi, '') // Remove redundant [S-Autopilot Insight] title
    .replace(/([^\n])(⏱️)/g, '$1\n\n$2')
    .replace(/⏱️\s*장애 대응 타임라인 요약\s*\*?/g, '')
    .replace(/⏱️\s*[^\n]*/g, '')
    // **N. 제목** 패턴은 건드리지 않음 (숫자+점 형태만 보존)
    .replace(/(?<!\*\*\d+\..*?)\*\*([^*\n]*)\*\*/g, '$1')  // 일반 bold만 제거
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/^[\*]\s+/gm, '- ')
    // 숫자. 패턴 변환은 하지 않음 (번호 제목 보존)
    .replace(/([^\n])\n?(💡 핵심 원인|Root Cause:)/g, '$1\n\n$2')
    .replace(/([^\n])\n?(✅ 최종 조치 결과|Resolution:)/g, '$1\n\n$2')
    .replace(/\n{3,}/g, '\n\n');

  return (
    <div className="prose prose-invert max-w-none space-y-2 pb-2">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mb-2 text-xl font-black text-white tracking-tight">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-2 mt-5 text-[15px] font-black text-white flex items-center gap-2 pb-1.5 border-b border-white/5">
              <div className="w-2 h-4 bg-blue-500 rounded-full" />
              {children}
            </h2>
          ),
          strong: ({ children }) => <span className="font-black text-white">{children}</span>,
          em: ({ children }) => <span className="text-slate-400 italic">{children}</span>,

          // 🔗 링크 렌더러: 내부 해시 링크는 현재 창에서, 외부 링크는 새 창에서 열기
          a: ({ href, children }) => {
            const isInternal = href && (href.startsWith('#') || href.startsWith('/#'));
            return (
              <a 
                href={href} 
                target={isInternal ? undefined : "_blank"} 
                rel={isInternal ? undefined : "noreferrer"}
                className="text-blue-400 underline underline-offset-2 hover:text-blue-300 font-bold"
                onClick={(e) => {
                  if (isInternal) {
                    // 이벤트 전파 방지하여 부모 컴포넌트의 클릭 이벤트 간섭 차단
                    e.stopPropagation();
                  }
                }}
              >
                {children}
              </a>
            );
          },

          p: ({ children }) => {
            // Helper to get text content from children for pattern matching
            const getText = (node) => {
              if (typeof node === 'string') return node;
              if (Array.isArray(node)) return node.map(getText).join('');
              if (node?.props?.children) return getText(node.props.children);
              return '';
            };
            
            const contentStr = getText(children);

            // 💡 입력값 구조화 (▶ 기호 파싱)
            if (contentStr.includes('▶')) {
              const idx = contentStr.indexOf('▶');
              const prefixText = contentStr.substring(0, idx).trim();
              const parts = contentStr.substring(idx).split('▶').map(s => s.trim()).filter(Boolean);
              
              return (
                <div className="my-3 space-y-2">
                  {prefixText && <div className="text-slate-300 text-xs font-bold mb-2">{prefixText}</div>}
                  <div className="text-[10px] font-black text-[#00e5ff] uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                    <Database size={12} /> 분석 입력값 메타데이터
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-[#0c181c]/90 p-3 rounded-xl border border-[#00e5ff]/30 shadow-[0_0_15px_rgba(0,229,255,0.1)]">
                    {parts.map((pt, i) => {
                      const colonIdx = pt.indexOf(':');
                      const k = colonIdx !== -1 ? pt.substring(0, colonIdx).trim() : '항목';
                      const v = colonIdx !== -1 ? pt.substring(colonIdx + 1).trim() : pt;
                      return (
                        <div key={i} className="flex items-center justify-between p-2.5 bg-[#00e5ff]/10 border border-[#00e5ff]/20 rounded-lg shadow-sm">
                          <span className="text-[11px] font-bold text-slate-400 truncate mr-2">{k}</span>
                          <span className="text-xs font-mono font-black text-[#ffffff] drop-shadow-[0_0_8px_rgba(0,229,255,0.8)] shrink-0">{v}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }

            // 💡 핵심 원인 (Root Cause)
            if (contentStr.includes('💡 핵심 원인') || contentStr.includes('Root Cause:')) {
              return (
                <div className="my-3 flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                  <TriangleAlert className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest block mb-1">Root Cause</span>
                    <div className="text-amber-50/90 text-[14px] leading-relaxed break-words">{highlightKeywords(children)}</div>
                  </div>
                </div>
              );
            }

            // ✅ 최종 조치 결과 (Resolution)
            if (contentStr.includes('✅ 최종 조치 결과') || contentStr.includes('Resolution:')) {
              return (
                <div className="my-3 flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                  <CircleCheckBig className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest block mb-1">Resolution</span>
                    <div className="text-emerald-50/90 text-[14px] leading-relaxed break-words">{highlightKeywords(children)}</div>
                  </div>
                </div>
              );
            }

            return <div className="mb-1.5 text-slate-200 leading-relaxed text-[14px] break-words">{highlightKeywords(children)}</div>;
          },

          ol: ({ children }) => <div className="space-y-1 my-2">{children}</div>,
          ul: ({ children }) => <div className="space-y-1 my-2">{children}</div>,

          li: ({ children }) => {
            const extractText = (node) => {
              if (typeof node === 'string' || typeof node === 'number') return String(node);
              if (Array.isArray(node)) return node.map(extractText).join('');
              if (node?.props?.children) return extractText(node.props.children);
              return '';
            };
            const content = extractText(children).trim();
            if (!content || content === '*' || content === '-') return null;

            // ⏱️ Timeline Item pattern matching
            const timestampMatch = content.match(/^\[?((?:\d{4}-\d{2}-\d{2}\s)?\d{2}:\d{2}(?::\d{2})?(?:\s*~\s*\d{2}:\d{2})?(?:\sKST)?)\]?/);
            if (timestampMatch || content.match(/^\d{2}:\d{2}/)) {
              const fullMatch = timestampMatch ? timestampMatch[0] : content.split(':')[0] + ':' + content.split(':')[1].substring(0,2);
              const timestamp = timestampMatch ? timestampMatch[1] : fullMatch;
              
              // We keep the original children but try to indent them
              return (
                <div className="flex items-start gap-2 py-1 group">
                  <div className="mt-2 w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                  <span className="px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-400 font-mono text-[11px] font-black border border-blue-500/20 shrink-0">
                    {timestamp}
                  </span>
                  <span className="text-slate-200 text-[14px] leading-relaxed break-words">{children}</span>
                </div>
              );
            }

            return (
              <div className="flex items-start gap-2 py-1">
                <div className="mt-2 w-1.5 h-1.5 rounded-full bg-blue-500/70 shrink-0" />
                <span className="text-slate-200 text-[14px] leading-relaxed break-words">{children}</span>
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
            <div className="relative my-3 pl-4 border-l-2 border-blue-500/60 bg-blue-500/5 py-2 rounded-r-lg">
              <div className="text-[14px] text-blue-100/85 italic leading-relaxed">{children}</div>
            </div>
          ),

          table: ({ children }) => (
            <div className="my-3 overflow-hidden rounded-xl border border-white/10 bg-[#1a1f2e]/40 shadow-xl">
              <table className="w-full border-collapse text-left text-[12px]">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="bg-white/5 px-3 py-2.5 font-black text-white uppercase tracking-wide border-b border-white/10 text-[11px]">{children}</th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 text-slate-200 border-b border-white/5 text-[14px]">{children}</td>
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
        {processedText}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownViewer;
