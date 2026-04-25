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
          // ** * 모두 plain text로
          strong: ({ children }) => <span className="font-semibold text-white">{children}</span>,
          em: ({ children }) => <span>{children}</span>,
          h3: ({ children }) => {
            // h3 → 타임라인 안에서 문단 시작 레이블로 표시
            const contentStr = String(React.Children.toArray(children).map(c => typeof c === 'string' ? c : '').join(''));
            // 타임라인 제목 계열은 완전 숨김
            if (contentStr.includes('타임라인 요약') || contentStr.includes('\u23f1')) return null;
            return (
              <div className="flex items-center gap-2 mt-5 mb-2">
                <div className="w-1 h-4 bg-indigo-500 rounded-full" />
                <span className="text-[11px] font-black text-indigo-300 uppercase tracking-widest">{contentStr}</span>
                <div className="flex-1 h-px bg-white/5" />
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

            // 💡 핵심 원인 (Root Cause) 특수 스타일 적용 - 강조 색상
            if (contentStr.includes('💡 핵심 원인') || contentStr.includes('Root Cause:')) {
              return (
                <div className="my-4 p-4 rounded-2xl bg-amber-500/15 border-2 border-amber-500/50 shadow-lg shadow-amber-900/20 animate-in fade-in slide-in-from-left-2 duration-500">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="bg-amber-500/30 p-1.5 rounded-lg">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                    </div>
                    <span className="text-xs font-black text-amber-400 uppercase tracking-widest">⚠ 핵심 원인 분석</span>
                  </div>
                  <div className="text-amber-100 font-semibold leading-relaxed text-sm">
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
          // 소제목 순번 카운터 - 렌더 스코프 변수
          ol: ({ children }) => (
            <ol className="mb-2 space-y-3 list-none p-0 m-0">
              {children}
            </ol>
          ),
          ul: ({ children }) => (
            <ul className="mb-2 space-y-3 list-none p-0 m-0">
              {children}
            </ul>
          ),
          li: ({ children }) => {
            // 재귀적으로 텍스트 추출
            const extractText = (node) => {
              if (typeof node === 'string' || typeof node === 'number') return String(node);
              if (Array.isArray(node)) return node.map(extractText).join('');
              if (React.isValidElement(node)) return extractText(node.props.children);
              return '';
            };
            const rawContent = extractText(children);
            // ** 및 단독 * 완전 제거 (leading * 포함)
            const content = rawContent
              .replace(/\*\*/g, '')
              .replace(/^\*\s*/,'')   // 앞에 붙은 * 제거
              .replace(/\*/g, '')     // 나머지 * 제거
              .trim();

            // 빈 리스트 아이템 숨김 (* 단독 등)
            if (!content || content === '*' || content === '-') return null;

            const timestampMatch = content.match(/^\[((?:\d{4}-\d{2}-\d{2}\s)?\d{2}:\d{2}(?::\d{2})?(?:\sKST)?)\]/);

            if (timestampMatch) {
              const timestamp = timestampMatch[1];
              const text = content.replace(timestampMatch[0], '').replace(/\*\*/g, '').replace(/^:\s*/, '').trim();
              if (!text) return null;
              return (
                <li className="list-none w-full pb-3">
                  <div className="w-full bg-white/[0.03] border border-white/5 rounded-xl p-3 hover:bg-white/[0.05] transition-all">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 font-mono text-[10px] font-bold border border-blue-500/20 shrink-0">
                        {timestamp}
                      </span>
                      <div className="h-px flex-1 bg-white/5" />
                    </div>
                    <p className="text-gray-200 text-sm leading-relaxed m-0">{text}</p>
                  </div>
                </li>
              );
            }

            // ✅ 소제목 감지: __SH_N__키워드 패턴 (processedText에서 미리 번호 삽입됨)
            const shMatch = content.match(/^__SH__(.+)$/);
            if (shMatch) {
              const heading = shMatch[1].trim();
              const SUB_COLORS = {
                '장애': { text: 'text-blue-300', border: 'border-blue-400/60', num: 'text-blue-400' },
                '발생': { text: 'text-amber-300', border: 'border-amber-400/60', num: 'text-amber-400' },
                '핵심': { text: 'text-amber-300', border: 'border-amber-400/60', num: 'text-amber-400' },
                '진행': { text: 'text-indigo-300', border: 'border-indigo-400/60', num: 'text-indigo-400' },
                '상황': { text: 'text-emerald-300', border: 'border-emerald-400/60', num: 'text-emerald-400' },
                '추가': { text: 'text-purple-300', border: 'border-purple-400/60', num: 'text-purple-400' },
              };
              const colorKey = Object.keys(SUB_COLORS).find(k => heading.includes(k)) || '장애';
              const color = SUB_COLORS[colorKey];
              return (
                <li className="list-none w-full mt-6 mb-2">
                  <div className={`flex items-baseline gap-1.5 pb-2 border-b-2 ${color.border} w-full`}>
                    <span className={`text-base font-black tracking-tight ${color.text}`}>{heading}</span>
                  </div>
                </li>
              );
            }

            // 구레거 소제목 감지 코드 제거 (전체 매칭만 허용)
            // 일반 리스트 아이템
            return (
              <li className="list-none text-gray-300 text-sm leading-relaxed pb-1 flex items-start gap-2">
                <span className="mt-1.5 w-1 h-1 rounded-full bg-slate-500 shrink-0" />
                <span>{content}</span>
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
        {numberedText}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownViewer;
