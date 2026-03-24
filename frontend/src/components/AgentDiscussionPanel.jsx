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

const TypewriterText = ({ text, delay = 15 }) => {
  const [displayedText, setDisplayedText] = React.useState('');
  const [currentIndex, setCurrentIndex] = React.useState(0);

  React.useEffect(() => {
    // Reset if text changes
    setDisplayedText('');
    setCurrentIndex(0);
  }, [text]);

  React.useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayedText(prev => prev + text[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }, delay);
      return () => clearTimeout(timeout);
    }
  }, [currentIndex, text, delay]);

  return <>{displayedText}</>;
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
      <div className="flex-1 overflow-y-auto p-4 space-y-6" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center text-slate-500 text-xs py-10 mt-10 opacity-50 space-y-3">
            <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center animate-pulse">
              <Shield className="w-5 h-5 text-slate-600" />
            </div>
            <p>Agent들이 시스템 로그를 파악하고 있습니다...</p>
          </div>
        )}
        
        {messages.map((msg, idx) => {
          const isLeader = msg.role === 'Leader';
          const isLast = idx === messages.length - 1;
          
          return (
            <div key={idx} className={`flex w-full animate-in fade-in slide-in-from-bottom-2 duration-300 ${isLeader ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex max-w-[90%] ${isLeader ? 'flex-row-reverse' : 'flex-row'} items-start gap-2.5`}>
                
                {/* Avatar */}
                <div className="shrink-0 mt-1 shadow-md">
                  <AgentAvatar role={msg.role} />
                </div>
                
                {/* Message Content */}
                <div className={`flex flex-col ${isLeader ? 'items-end' : 'items-start'}`}>
                  {/* Name */}
                  <span className={`text-[11px] mb-1.5 px-1 font-bold tracking-wide ${
                    msg.role === 'Security' ? 'text-red-400' :
                    msg.role === 'DB' ? 'text-yellow-400' :
                    msg.role === 'DevOps' ? 'text-blue-400' :
                    msg.role === 'Leader' ? 'text-purple-400' :
                    'text-slate-400'
                  }`}>{msg.role} Agent</span>
                  
                  {/* Bubble and Time */}
                  <div className={`flex items-end gap-2 ${isLeader ? 'flex-row-reverse' : 'flex-row'}`}>
                    {/* Bubble */}
                    <div className={`p-3.5 text-[13px] leading-relaxed shadow-lg whitespace-pre-wrap break-words ${
                      isLeader 
                        ? 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-2xl rounded-tr-sm border border-purple-500/30' 
                        : 'bg-slate-800 text-slate-200 rounded-2xl rounded-tl-sm border border-white/5 shadow-black/20'
                    }`}>
                      {isLast ? <TypewriterText text={msg.text} /> : msg.text}
                    </div>
                    {/* Time */}
                    <span className="text-[10px] text-slate-500 shrink-0 mb-1 font-mono tracking-tighter">
                      {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Footer Status */}
      <div className="p-2 bg-black/40 border-t border-white/5 text-[10px] text-slate-500 text-center">
        Multi-Agent System Active • 4 Agents Online
      </div>
    </div>
  );
}
