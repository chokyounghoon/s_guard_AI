import React, { useEffect, useRef } from 'react';
import { Shield, Database, Server, User, Terminal } from 'lucide-react';

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
    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${style.bg} border ${style.border} shadow-sm`}>
      <Icon className={`w-4 h-4 ${style.text}`} />
    </div>
  );
};

export default function AgentDiscussionPanel({ messages, isVisible, onClose, embedded = false, incident }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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
      <div className="flex-1 overflow-y-auto p-5 space-y-8 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent" ref={scrollRef}>
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
          
          return (
            <div key={idx} className="flex w-full animate-in fade-in slide-in-from-bottom-2 duration-300 justify-start">
              <div className="flex max-w-[85%] flex-row items-start gap-3">
                
                {/* Avatar */}
                <div className="shrink-0 mt-1 shadow-2xl">
                  <AgentAvatar role={msg.role} />
                </div>
                
                {/* Message Content */}
                <div className="flex flex-col items-start">
                  {/* Name */}
                  <span className={`text-[11px] mb-2 px-1 font-black tracking-widest uppercase ${
                    msg.role.toLowerCase().includes('security') || msg.role.toLowerCase().includes('system') ? 'text-red-400' :
                    msg.role.toLowerCase().includes('db') ? 'text-yellow-400' :
                    msg.role.toLowerCase().includes('devops') || msg.role.toLowerCase().includes('analyst') ? 'text-blue-400' :
                    isLeader ? 'text-purple-400' :
                    'text-slate-400'
                  }`}>
                    {msg.role.toLowerCase().includes('agent') ? msg.role : `${msg.role} Agent`}
                  </span>
                  
                  {/* Bubble and Time Row */}
                  <div className="flex items-end gap-2 flex-row">
                    {/* Bubble */}
                    <div className={`p-4 text-[13.5px] leading-relaxed shadow-2xl transition-all duration-300 whitespace-pre-wrap break-words
                      ${isLeader 
                        ? 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-2xl rounded-tl-sm border border-purple-500/30' 
                        : 'bg-slate-800/80 text-slate-100 rounded-2xl rounded-tl-sm border border-white/5 shadow-black/40'
                    }`}>
                      {msg.text}
                    </div>
                    
                    {/* Time */}
                    <span className="text-[10px] text-slate-500 shrink-0 mb-1 font-bold tracking-tighter tabular-nums opacity-60">
                      {new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: true })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Footer Status */}
      <div className="p-3 bg-[#0d111a] border-t border-white/5 text-[10px] text-slate-500 text-center font-bold tracking-widest uppercase">
        Multi-Agent System Active • 4 Agents Online
      </div>
    </div>
  );
}
