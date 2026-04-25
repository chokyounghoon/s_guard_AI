import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Shield, Database, Server, User, Terminal, Copy, Check, X } from 'lucide-react';

const AgentAvatar = ({ role }) => {
  const getAgentStyle = (role) => {
    // Normalize role name for styling
    const normalized = role.toLowerCase();
    
    if (normalized.includes('security') || normalized.includes('system')) {
      return { bg: 'bg-red-500/20', text: 'text-red-400', icon: Shield, border: 'border-red-500/30' };
    }
    if (normalized.includes('db') || normalized.includes('데이터베이스')) {
      return { bg: 'bg-yellow-500/20', text: 'text-yellow-400', icon: Database, border: 'border-yellow-500/30' };
    }
    if (normalized.includes('devops') || normalized.includes('데브옵스') || normalized.includes('analyst')) {
      return { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: Server, border: 'border-blue-500/30' };
    }
    if (normalized.includes('leader') || normalized.includes('리더')) {
      return { bg: 'bg-purple-500/20', text: 'text-purple-400', icon: User, border: 'border-purple-500/30' };
    }
    
    return { bg: 'bg-slate-700', text: 'text-slate-300', icon: Terminal, border: 'border-white/10' };
  };

  const style = getAgentStyle(role);
  const Icon = style.icon;

  return (
    <div className={`w-9 h-9 rounded-full flex items-center justify-center ${style.bg} border ${style.border} shadow-md shrink-0`}>
      <Icon className={`w-4 h-4 ${style.text}`} />
    </div>
  );
};

// ** 등 마크다운 마커 제거 함수
const cleanText = (text = '') =>
  text
    .replace(/\*\*(.*?)\*\*/g, '$1')   // **bold** → bold
    .replace(/\*(.*?)\*/g, '$1')        // *italic* → italic
    .replace(/^#+\s/gm, '')             // ## 헤딩 제거
    .replace(/`([^`]+)`/g, '$1')        // `code` → code
    .trim();

export default function AgentDiscussionPanel({ messages, isVisible, onClose, embedded = false, incident }) {
  const scrollRef = useRef(null);
  const longPressTimer = useRef(null);
  const [contextMenu, setContextMenu] = useState(null); // { text, x, y }
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // 컨텍스트 메뉴 닫기
  useEffect(() => {
    const close = () => setContextMenu(null);
    if (contextMenu) {
      window.addEventListener('touchstart', close, { once: true });
      window.addEventListener('mousedown', close, { once: true });
    }
    return () => {
      window.removeEventListener('touchstart', close);
      window.removeEventListener('mousedown', close);
    };
  }, [contextMenu]);

  const startLongPress = useCallback((text, e) => {
    e.preventDefault();
    const touch = e.touches?.[0] || e;
    const x = Math.min(touch.clientX, window.innerWidth - 180);
    const y = Math.max(touch.clientY - 100, 60);
    longPressTimer.current = setTimeout(() => {
      setContextMenu({ text, x, y });
      // 진동 피드백 (모바일)
      if (navigator.vibrate) navigator.vibrate(30);
    }, 500);
  }, []);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleCopy = async () => {
    if (!contextMenu?.text) return;
    try {
      await navigator.clipboard.writeText(contextMenu.text);
      setCopied(true);
      setTimeout(() => { setCopied(false); setContextMenu(null); }, 1200);
    } catch {
      const el = document.createElement('textarea');
      el.value = contextMenu.text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => { setCopied(false); setContextMenu(null); }, 1200);
    }
  };

  if (!isVisible) return null;

  const containerClasses = embedded 
    ? "w-full h-full bg-[#0a0c12] flex flex-col overflow-hidden animate-in fade-in duration-500"
    : "fixed right-4 bottom-4 w-96 max-h-[600px] bg-[#0a0c12]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col z-40 animate-in slide-in-from-right duration-500";

  return (
    <div className={containerClasses}>
      {/* Header - Only show if NO-EMBEDDED */}
      {!embedded && (
        <div className="p-4 border-b border-white/10 bg-gradient-to-r from-slate-900 to-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="relative">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </span>
            </div>
            <h3 className="font-bold text-white text-sm">AI War-Room Situation Log</h3>
          </div>
          <div className="flex items-center space-x-3">
              <span className="text-[10px] text-slate-500 font-mono">LIVE</span>
              <button 
                  onClick={onClose}
                  className="text-slate-500 hover:text-white transition-colors"
                  aria-label="Close"
              >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
          </div>
        </div>
      )}

      {/* Incident Details Summary (Shared) */}
      {incident && (
        <div className="px-5 pt-5 pb-2 border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-start gap-3 mb-3">
            <div className="p-1.5 bg-blue-500/10 rounded-lg shrink-0 border border-blue-500/20">
              <Terminal className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="min-w-0">
              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">Source SMS Message</h4>
              <p className="text-xs text-white line-clamp-2 leading-relaxed opacity-80 italic">"{incident.message}"</p>
            </div>
          </div>
          {/* Detailed Badges */}
          <div className="flex flex-wrap gap-2 mb-2">
            {[
              { label: 'CH', value: incident.channel },
              { label: 'SVC', value: incident.service_name || incident.service_code },
              { label: 'ERR', value: incident.error_code },
              { label: 'NODE', value: incident.occurrence_node },
            ].map((d, i) => d.value && (
              <div key={i} className="flex items-center gap-1.5 bg-white/5 px-2 py-0.5 rounded border border-white/5">
                <span className="text-[9px] text-slate-500 font-bold">{d.label}</span>
                <span className="text-[10px] text-blue-300 font-mono">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center text-slate-500 text-xs py-20 opacity-40 space-y-3">
            <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center animate-pulse border border-white/5">
              <Shield className="w-5 h-5 text-slate-600" />
            </div>
            <p className="font-medium">분석 대기 중...</p>
          </div>
        )}
        
        {messages.map((msg, idx) => {
          const isLeader = msg.role.toLowerCase().includes('leader') || msg.role.toLowerCase().includes('리더');
          const roleColor =
            msg.role.toLowerCase().includes('security') || msg.role.toLowerCase().includes('system') ? 'text-red-400' :
            msg.role.toLowerCase().includes('db') ? 'text-yellow-400' :
            msg.role.toLowerCase().includes('devops') || msg.role.toLowerCase().includes('analyst') ? 'text-blue-400' :
            isLeader ? 'text-purple-400' : 'text-slate-400';

          const bubbleBg = isLeader
            ? { background: 'linear-gradient(135deg, rgba(37,99,235,0.15) 0%, rgba(30,58,138,0.3) 100%)', borderColor: 'rgba(59,130,246,0.3)' }
            : { background: 'rgba(26,31,46,0.8)', borderColor: 'rgba(255,255,255,0.05)' };

          const tailColor = isLeader ? 'rgba(37,99,235,0.2)' : 'rgba(26,31,46,0.8)';

          return (
            <div key={idx} className="flex w-full animate-in fade-in slide-in-from-bottom-2 duration-300 justify-start mb-1">
              <div className="flex max-w-[90%] flex-row items-start gap-2">

                {/* Avatar */}
                <div className="shrink-0 mt-5">
                  <AgentAvatar role={msg.role} />
                </div>

                {/* Message Content */}
                <div className="flex flex-col items-start gap-0.5">
                  {/* Name */}
                  <span className={`text-[10px] px-1 font-bold ${roleColor}`}>
                    {msg.role.toLowerCase().includes('agent') ? msg.role : `${msg.role} Agent`}
                  </span>

                  {/* Bubble + Time */}
                  <div className="flex items-end gap-1.5">
                    <div className="relative">
                      {/* 카카오톡 스타일 꼬리 */}
                      <div style={{
                        position: 'absolute',
                        left: '-7px',
                        top: '12px',
                        width: 0,
                        height: 0,
                        borderTop: '7px solid transparent',
                        borderRight: `7px solid ${tailColor}`,
                        borderBottom: '7px solid transparent',
                      }} />
                      {/* 말풍선 본체 */}
                      <div
                        className="px-4 py-3 text-[14px] leading-relaxed shadow-[0_8px_30px_rgba(0,0,0,0.3)] whitespace-pre-wrap break-words select-none backdrop-blur-md transition-all active:scale-[0.98]"
                        style={{
                          ...bubbleBg,
                          borderRadius: '0 24px 24px 24px',
                          border: `1px solid ${bubbleBg.borderColor}`,
                          color: isLeader ? '#ffffff' : '#e2e8f0',
                          fontWeight: 500
                        }}
                        onTouchStart={(e) => startLongPress(cleanText(msg.text), e)}
                        onTouchEnd={cancelLongPress}
                        onTouchMove={cancelLongPress}
                        onMouseDown={(e) => startLongPress(cleanText(msg.text), e)}
                        onMouseUp={cancelLongPress}
                        onMouseLeave={cancelLongPress}
                        onContextMenu={(e) => { e.preventDefault(); startLongPress(cleanText(msg.text), e); }}
                      >
                        {cleanText(msg.text)}
                      </div>
                    </div>
                    {/* Time */}
                    <span className="text-[9px] text-slate-600 shrink-0 mb-1 tabular-nums">
                      {new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: true })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* 롱 프레스 컨텍스트 메뉴 */}
      {contextMenu && (
        <div
          className="fixed z-[9999] bg-[#1a1f2e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
          style={{ left: contextMenu.x, top: contextMenu.y, minWidth: 160 }}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <button
            onClick={handleCopy}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-white hover:bg-white/10 transition-all"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-blue-400" />}
            {copied ? '복사됨!' : '텍스트 복사'}
          </button>
          <div className="h-px bg-white/5" />
          <button
            onClick={() => setContextMenu(null)}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-400 hover:bg-white/10 transition-all"
          >
            <X className="w-4 h-4" />
            닫기
          </button>
        </div>
      )}

      {/* Footer Status */}
      <div className="p-3 bg-[#0d111a] border-t border-white/5 text-[10px] text-slate-500 text-center font-bold tracking-widest uppercase">
        Multi-Agent System Active • 4 Agents Online
      </div>
    </div>
  );
}
