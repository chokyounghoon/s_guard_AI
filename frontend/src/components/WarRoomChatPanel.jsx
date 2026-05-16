import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, User, Sparkles, Zap, Megaphone, Info } from 'lucide-react';
import { getAccessToken } from '../lib/authStore';

const API_BASE = 'https://sguardai.khcho0421.workers.dev';

const getApiUrl = (endpoint, isWs = false) => {
  const base = isWs ? 'wss://' : 'https://';
  return `${base}sguardai.khcho0421.workers.dev${endpoint}`;
};

const formatKst = (dateInput) => {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
};

export default function WarRoomChatPanel({ incidentId, currentUser, isVisible }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [participants, setParticipants] = useState([]);
  const wsRef = useRef(null);
  const scrollRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);

  // Auto scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Fetch initial history and participants
  useEffect(() => {
    if (!incidentId || !isVisible) return;

    const fetchData = async () => {
      try {
        const [historyRes, partRes] = await Promise.all([
          fetch(`${API_BASE}/warroom/chat/${incidentId}`),
          fetch(`${API_BASE}/warroom/participants/${incidentId}`)
        ]);

        if (historyRes.ok) {
          const data = await historyRes.json();
          setMessages(data.messages.map(m => ({
            ...m,
            sender: m.sender_name || m.sender,
            type: m.sender === currentUser.employee_id ? 'me' : (m.type === 'system' ? 'system' : 'other'),
            time: formatKst(m.timestamp)
          })));
        }
        if (partRes.ok) {
          const data = await partRes.json();
          setParticipants(data.participants || []);
        }
      } catch (err) {
        console.error("Failed to fetch warroom data", err);
      }
    };

    fetchData();
  }, [incidentId, isVisible, currentUser.employee_id]);

  // WebSocket Connection
  useEffect(() => {
    if (!incidentId || !isVisible || !currentUser.employee_id) return;

    let socket;
    let reconnectTimer;
    let isMounted = true;

    const connect = () => {
      if (!isMounted) return;
      const token = getAccessToken();
      const wsUrl = getApiUrl(`/warroom/ws/${incidentId}${token ? `?token=${token}` : ''}`, true);
      socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        if (!isMounted) return;
        setIsConnected(true);
        socket.send(JSON.stringify({
          type: "JOIN",
          user_id: currentUser.employee_id,
          name: currentUser.name,
          incident_id: incidentId
        }));
      };

      socket.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const data = JSON.parse(event.data);
          switch (data.type) {
            case 'CHAT_MESSAGE':
              setMessages(prev => {
                const exists = prev.some(m => m.id === data.msg_id);
                if (exists) return prev;
                return [...prev, {
                  id: data.msg_id,
                  seq: data.seq,
                  type: data.sender === currentUser.employee_id ? 'me' : 'other',
                  sender: data.sender_name || data.sender,
                  sender_id: data.sender,
                  role: data.role,
                  text: data.text,
                  time: formatKst(data.timestamp),
                  timestamp: data.timestamp
                }];
              });
              break;
            case 'AI_SUMMARY':
                setMessages(prev => [...prev, {
                  id: `ai_${Date.now()}`,
                  type: 'ai',
                  sender: 'AI Analyst',
                  text: data.summary,
                  time: formatKst(new Date())
                }]);
                break;
            case 'ONLINE_LIST':
              // Sync participants if needed
              break;
            default:
              break;
          }
        } catch (e) {
          console.error("WS Parse Error", e);
        }
      };

      socket.onclose = () => {
        if (!isMounted) return;
        setIsConnected(false);
        reconnectTimer = setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      isMounted = false;
      clearTimeout(reconnectTimer);
      if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        socket.close();
      }
    };
  }, [incidentId, isVisible, currentUser.employee_id, currentUser.name]);

  const handleSendMessage = () => {
    if (!inputValue.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    wsRef.current.send(JSON.stringify({
      type: "CHAT_SEND",
      incident_id: incidentId,
      sender: currentUser.employee_id,
      name: currentUser.name,
      role: currentUser.role,
      msg_type: "user",
      text: inputValue
    }));

    setInputValue('');
  };

  if (!isVisible) return null;

  return (
    <div className="flex flex-col h-full bg-[#0a0c12] animate-in fade-in duration-500">
      {/* Header Info */}
      <div className="px-5 py-3 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            {participants.slice(0, 3).map((p, i) => (
              <div key={i} className="w-6 h-6 rounded-full bg-slate-800 border-2 border-[#0a0c12] flex items-center justify-center text-[10px] font-bold text-white">
                {p.name?.[0] || 'U'}
              </div>
            ))}
            {participants.length > 3 && (
              <div className="w-6 h-6 rounded-full bg-blue-600/20 border-2 border-[#0a0c12] flex items-center justify-center text-[8px] font-bold text-blue-400">
                +{participants.length - 3}
              </div>
            )}
          </div>
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Expert Panel Active</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-[9px] text-slate-500 font-mono uppercase">{isConnected ? 'Live' : 'Offline'}</span>
        </div>
      </div>

      {/* Message Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center py-20 opacity-30 space-y-3">
            <MessageSquare className="w-8 h-8 text-slate-500" />
            <p className="text-xs font-bold text-slate-500 tracking-tight">전송된 메시지가 없습니다.</p>
          </div>
        )}

        {/* Welcome Msg */}
        <div className="flex flex-col items-center justify-center py-2 mb-4 opacity-80">
          <div className="bg-blue-600/5 border border-blue-500/10 rounded-xl px-4 py-2 flex items-center gap-2 max-w-[90%]">
            <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="text-[11px] text-blue-100/70 leading-tight">실시간 War-Room 협업 대화방이 동기화되었습니다.</span>
          </div>
        </div>

        {messages.map((msg, idx) => (
          <div 
            key={msg.id || idx} 
            className={`flex w-full ${msg.type === 'me' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-1 duration-300`}
          >
            <div className={`flex max-w-[85%] ${msg.type === 'me' ? 'flex-row-reverse' : 'flex-row'} items-start gap-2.5`}>
              {/* Avatar */}
              {msg.type !== 'me' && (
                <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-[10px] font-bold shrink-0 border border-white/5 shadow-lg">
                  {(msg.sender_name || msg.sender)?.[0] || 'U'}
                </div>
              )}

              <div className={`flex flex-col ${msg.type === 'me' ? 'items-end' : 'items-start'}`}>
                {msg.type !== 'me' && (
                  <span className="text-[10px] text-slate-500 mb-1 px-1 font-bold">{msg.sender_name || msg.sender}</span>
                )}
                
                <div className="flex items-end gap-2">
                  {msg.type === 'me' && (
                     <span className="text-[9px] text-slate-600 font-bold mb-1 opacity-60">{msg.time}</span>
                  )}
                  <div className={`px-3 py-2 text-[13px] leading-relaxed shadow-xl break-words whitespace-pre-wrap
                    ${msg.type === 'me' 
                      ? 'bg-blue-600 text-white rounded-2xl rounded-tr-sm' 
                      : msg.type === 'ai'
                      ? 'bg-purple-600/20 text-purple-200 rounded-2xl border border-purple-500/30 font-medium'
                      : 'bg-slate-800/80 text-slate-200 rounded-2xl rounded-tl-sm border border-white/5'
                    }`}
                  >
                    {msg.text}
                  </div>
                  {msg.type !== 'me' && (
                    <span className="text-[9px] text-slate-600 font-bold mb-1 opacity-60">{msg.time}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-[#0d111a] border-t border-white/5">
        <div className="relative flex items-center gap-2">
          <input 
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="전문가들과 의견을 나누세요..."
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 transition-all"
          />
          <button 
            onClick={handleSendMessage}
            disabled={!inputValue.trim()}
            className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:grayscale transition-all shadow-lg active:scale-95"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
