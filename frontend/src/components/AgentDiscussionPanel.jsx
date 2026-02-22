import React, { useEffect, useRef } from 'react';
import { Shield, Database, Server, User, Terminal } from 'lucide-react';

const AgentAvatar = ({ role }) => {
  const getAgentStyle = (role) => {
    switch (role) {
      case 'Security': return { bg: 'bg-red-500/20', text: 'text-red-400', icon: Shield, border: 'border-red-500/30' };
      case 'DB': return { bg: 'bg-yellow-500/20', text: 'text-yellow-400', icon: Database, border: 'border-yellow-500/30' };
      case 'DevOps': return { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: Server, border: 'border-blue-500/30' };
      case 'Leader': return { bg: 'bg-purple-500/20', text: 'text-purple-400', icon: User, border: 'border-purple-500/30' };
      default: return { bg: 'bg-slate-700', text: 'text-slate-300', icon: Terminal, border: 'border-white/10' };
    }
  };

  const style = getAgentStyle(role);
  const Icon = style.icon;

  return (
    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${style.bg} border ${style.border}`}>
      <Icon className={`w-4 h-4 ${style.text}`} />
    </div>
  );
};

export default function AgentDiscussionPanel({ messages, isVisible, onClose, embedded = false }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (!isVisible) return null;

  const containerClasses = embedded 
    ? "w-full h-[600px] bg-[#0f1421] border border-white/10 rounded-2xl shadow-inner overflow-hidden flex flex-col animate-in fade-in duration-500"
    : "fixed right-4 bottom-4 w-96 max-h-[600px] bg-[#0f1421]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col z-40 animate-in slide-in-from-right duration-500";

  return (
    <div className={containerClasses}>
      {/* Header */}
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

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="text-center text-slate-500 text-xs py-10 mt-20 opacity-50">
            AI Agents are monitoring the system...
          </div>
        )}
        
        {messages.map((msg, idx) => (
          <div key={idx} className="flex items-start space-x-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <AgentAvatar role={msg.role} />
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold ${
                  msg.role === 'Security' ? 'text-red-400' :
                  msg.role === 'DB' ? 'text-yellow-400' :
                  msg.role === 'DevOps' ? 'text-blue-400' :
                  'text-purple-400'
                }`}>{msg.role} Agent</span>
                <span className="text-[9px] text-slate-600">{new Date().toLocaleTimeString()}</span>
              </div>
              <div className="text-xs text-slate-300 leading-relaxed bg-white/5 p-2 rounded-lg border border-white/5">
                {msg.text}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Footer Status */}
      <div className="p-2 bg-black/40 border-t border-white/5 text-[10px] text-slate-500 text-center">
        Multi-Agent System Active • 4 Agents Online
      </div>
    </div>
  );
}
