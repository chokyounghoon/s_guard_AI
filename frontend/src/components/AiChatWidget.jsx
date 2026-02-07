import React, { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Sparkles, Server, Activity } from 'lucide-react';

const API_BASE_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:8000'
  : 'https://api.chokerslab.store';

export default function AiChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { 
      type: 'ai', 
      text: '안녕하세요! S-Guard AI 에이전트입니다. 👋\n서버 로그나 시스템 상태에 대해 무엇이든 물어보세요.',
      logs: []
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;

    const userMessage = inputText;
    setInputText('');
    setMessages(prev => [...prev, { type: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userMessage })
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(prev => [...prev, { 
          type: 'ai', 
          text: data.response,
          logs: data.related_logs || []
        }]);
      } else {
        throw new Error('API Error');
      }
    } catch (error) {
      console.error('Chat Error:', error);
      setMessages(prev => [...prev, { 
        type: 'ai', 
        text: '죄송합니다. 서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.',
        logs: []
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-24 right-6 z-50 flex flex-col items-end">
      
      {/* Chat Window */}
      {isOpen && (
        <div className="mb-4 w-96 max-w-[calc(100vw-3rem)] h-[500px] bg-[#0f1421] rounded-3xl border border-blue-500/20 shadow-2xl shadow-blue-900/40 flex flex-col overflow-hidden animate-slide-up-fade origin-bottom-right">
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-600 flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <div className="bg-white/20 p-1.5 rounded-lg">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">S-Autopilot Agent</h3>
                <div className="flex items-center space-x-1">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-[10px] text-blue-100">Online • Log Analysis Active</span>
                </div>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-full hover:bg-white/10 transition-colors text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
            {messages.map((msg, idx) => (
              <div 
                key={idx} 
                className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start items-start space-x-3'}`}
              >
                {msg.type === 'ai' && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-lg mt-1">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                )}
                
                <div className={`max-w-[80%] space-y-2`}>
                  <div 
                    className={`p-3.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.type === 'user' 
                        ? 'bg-blue-600 text-white rounded-tr-none shadow-lg shadow-blue-900/20' 
                        : 'bg-[#1a1f2e] text-slate-200 border border-white/5 rounded-tl-none'
                    }`}
                  >
                    {msg.text}
                  </div>
                  
                  {/* Related Logs (AI Only) */}
                  {msg.type === 'ai' && msg.logs && msg.logs.length > 0 && (
                    <div className="bg-black/30 rounded-xl border border-white/5 p-3 text-[10px] font-mono overflow-hidden">
                      <div className="flex items-center space-x-1.5 mb-2 text-slate-400 border-b border-white/5 pb-1">
                        <Server className="w-3 h-3" />
                        <span>Analysis Context</span>
                      </div>
                      <div className="space-y-1">
                        {msg.logs.map((log, logIdx) => (
                          <div key={logIdx} className={`${log.includes('ERROR') ? 'text-red-400' : 'text-emerald-400/80'} truncate`}>
                            {log}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start items-center space-x-3">
                 <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-lg">
                    <Bot className="w-4 h-4 text-white animate-pulse" />
                  </div>
                 <div className="bg-[#1a1f2e] p-3 rounded-2xl rounded-tl-none border border-white/5">
                    <div className="flex space-x-1">
                      <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                      <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                      <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce"></div>
                    </div>
                 </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <form onSubmit={handleSendMessage} className="p-3 bg-[#0f1421] border-t border-white/5 flex items-center space-x-2">
            <input 
              type="text" 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="서버 상태나 로그에 대해 물어보세요..." 
              className="flex-1 bg-[#1a1f2e] text-white text-sm rounded-xl py-3 px-4 focus:outline-none focus:ring-1 focus:ring-blue-500/50 border border-white/5 placeholder:text-slate-500"
              autoFocus
            />
            <button 
              type="submit"
              disabled={!inputText.trim() || isLoading}
              className="p-3 bg-blue-600 rounded-xl text-white hover:bg-blue-500 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
            >
              <Send className="w-4 h-4 fill-current" />
            </button>
          </form>
        </div>
      )}

      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center justify-center p-4 rounded-full shadow-lg transition-all duration-300 border border-white/20 group relative overflow-hidden
          ${isOpen ? 'bg-slate-700 rotate-90 scale-90' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:scale-110 shadow-blue-500/40'}
        `}
        aria-label="S-Autopilot 호출"
      >
        {!isOpen && (
            <>
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 rounded-full" />
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
            </>
        )}
        {isOpen ? (
            <X className="w-8 h-8 text-white" />
        ) : (
            <Bot className="w-8 h-8 text-white animate-pulse-slow" />
        )}
      </button>
    </div>
  );
}
