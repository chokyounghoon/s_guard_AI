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

const cleanProfilePic = (picStr) => {
  if (!picStr || picStr === 'null') return null;
  const cleaned = picStr.replace(/^"|"$/g, '');
  if (!cleaned) return null;
  if (cleaned.startsWith('http') || cleaned.startsWith('data:image')) return cleaned;
  return `https://sguardai.khcho0421.workers.dev${cleaned.startsWith('/') ? '' : '/'}${cleaned}`;
};

export default function WarRoomChatPanel({ incidentId, currentUser, isVisible }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [participants, setParticipants] = useState([]);
  const wsRef = useRef(null);
  const scrollRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const textareaRef = useRef(null);

  const AI_AGENTS = [
    { id: 'expert', name: 'AI Expert', label: 'S-Autopilot Expert' },
    { id: 'security', name: 'Security Agent', label: '보안 전문가' },
    { id: 'db', name: 'DB Agent', label: 'DB 전문가' },
    { id: 'devops', name: 'DevOps Agent', label: '인프라 전문가' },
    { id: 'leader', name: 'Leader Agent', label: '총괄 매니저' }
  ];

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
            time: formatKst(m.timestamp),
            avatar_url: cleanProfilePic(m.profile_picture)
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
                  timestamp: data.timestamp,
                  avatar_url: cleanProfilePic(data.profile_picture)
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

  const handleSendMessage = async () => {
    const text = inputValue.trim();
    if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    setInputValue('');
    setShowMentionMenu(false);

    let isAiQuery = false;
    let aiQueryText = text;
    let aiAgentName = 'AI Expert';
    
    for (const agent of AI_AGENTS) {
      if (text.includes(`@${agent.name}`)) {
        isAiQuery = true;
        aiAgentName = agent.name;
        aiQueryText = text.replace(`@${agent.name}`, '').trim();
        break;
      }
    }
    
    if (!isAiQuery && text.trim().startsWith('@')) {
      isAiQuery = true;
      aiQueryText = text.replace(/^@[^\s]+/, '').trim();
    }

    wsRef.current.send(JSON.stringify({
      type: "CHAT_SEND",
      incident_id: incidentId,
      sender: currentUser.employee_id,
      name: currentUser.name,
      role: currentUser.role,
      profile_picture: cleanProfilePic(currentUser.profile_picture),
      msg_type: "user",
      text: text
    }));

    if (isAiQuery) {
      try {
        const apiKey = 'app-ZDaVB8EWtA5vmTYJLmbysdQq';
        const cleanUser = String(currentUser?.employee_id || "sguard_user").replace(/[^a-zA-Z0-9_-]/g, '') || "sguard_user";
        const difyRes = await fetch('https://api.dify.ai/v1/chat-messages', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            inputs: {},
            query: `[${incidentId || "INC_000"}] ${aiQueryText}`.trim(),
            response_mode: "blocking",
            user: cleanUser
          })
        });
        if (difyRes.ok) {
          const difyData = await difyRes.json();
          const aiAnswer = difyData.answer;
          
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: "CHAT_SEND",
              incident_id: incidentId,
              sender: aiAgentName,
              name: aiAgentName,
              role: aiAgentName,
              profile_picture: null,
              msg_type: "assistant",
              text: aiAnswer
            }));
          }
        } else {
          const errText = await difyRes.text();
          console.error("Dify API 400 Error:", errText);
        }
      } catch (err) {
        console.error("AI API Error:", err);
      }
    }
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

        {messages
          .filter(m => 
            m.type !== 'ai' && 
            m.type !== 'ai_analysis' && 
            m.type !== 'system' && 
            m.role !== 'assistant' && 
            m.role !== 'AI Expert' &&
            !/Agent/i.test(m.sender_name || m.sender || '') &&
            !/Agent/i.test(m.role || '')
          )
          .map((msg, idx) => {
            const avatarSrc = msg.avatar_url || (msg.profile_picture ? (msg.profile_picture.startsWith('http') || msg.profile_picture.startsWith('data:image') ? msg.profile_picture : `https://sguardai.khcho0421.workers.dev${msg.profile_picture}`) : null);
            return (
              <div 
                key={msg.id || idx} 
                className={`flex w-full ${msg.type === 'me' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-1 duration-300 mb-2`}
              >
                <div className={`flex max-w-[85%] ${msg.type === 'me' ? 'flex-row-reverse' : 'flex-row'} items-end gap-2`}>
                  {/* Avatar */}
                  {msg.type !== 'me' && (
                    <div className="relative w-8 h-8 shrink-0 self-start mt-0.5">
                      {avatarSrc ? (
                        <img 
                          src={avatarSrc} 
                          alt={msg.sender || 'User'} 
                          className="w-8 h-8 rounded-full object-cover border border-white/10 shadow-sm"
                          onError={(e) => { e.currentTarget.style.display = 'none'; if (e.currentTarget.nextElementSibling) e.currentTarget.nextElementSibling.style.display = 'flex'; }}
                        />
                      ) : null}
                      <div className={`w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-[11px] font-bold border border-white/10 shadow-sm ${avatarSrc ? 'hidden' : 'flex'}`}>
                        {(msg.sender_name || msg.sender)?.[0] || 'U'}
                      </div>
                    </div>
                  )}

                  <div className={`flex flex-col ${msg.type === 'me' ? 'items-end' : 'items-start'} max-w-full`}>
                    {msg.type !== 'me' && (
                      <span className="text-[10px] text-slate-500 mb-1 px-1 font-medium">{msg.sender_name || msg.sender}</span>
                    )}
                    
                    <div className={`flex items-end gap-1.5 ${msg.type === 'me' ? 'flex-row-reverse' : 'flex-row'}`}>
                      {/* 말풍선 본체 */}
                      <div className={`rounded-2xl px-3.5 py-2.5 text-[13px] leading-[1.4] shadow-md break-words whitespace-pre-wrap
                        ${msg.type === 'me' 
                          ? 'bg-[#0038a8] text-white rounded-tr-none' 
                          : 'bg-[#2a2f3a] text-slate-100 rounded-tl-none border border-white/5'
                        }`}
                      >
                        {msg.text}
                      </div>
                      {/* 메타데이터 (시간 등) - 세로형 Flex 컨테이너 */}
                      <div className={`flex flex-col justify-end shrink-0 select-none pb-0.5 ${msg.type === 'me' ? 'items-end mr-0.5' : 'items-start ml-0.5'}`}>
                        <span className="text-[9px] font-mono text-slate-400 leading-none">{msg.time}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-[#0d111a] border-t border-white/5 relative">
        {showMentionMenu && (
          <div className="absolute bottom-full left-4 right-4 mb-2 bg-[#1a2035] border border-white/10 rounded-2xl p-1.5 shadow-2xl z-[100] max-h-48 overflow-y-auto">
            {AI_AGENTS.filter(a => a.name.toLowerCase().includes(mentionFilter) || a.label.toLowerCase().includes(mentionFilter)).map(agent => (
              <div 
                key={agent.id}
                onClick={() => {
                  const lastAtPos = inputValue.lastIndexOf('@');
                  const newVal = inputValue.slice(0, lastAtPos) + `@${agent.name} `;
                  setInputValue(newVal);
                  setShowMentionMenu(false);
                  if (textareaRef.current) textareaRef.current.focus();
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/10 active:bg-white/20 cursor-pointer transition-colors"
              >
                <div className="w-6 h-6 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                  <span className="text-[10px]">🤖</span>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-white truncate">{agent.name}</span>
                  <span className="text-[9px] text-slate-400 truncate">{agent.label}</span>
                </div>
              </div>
            ))}
            {AI_AGENTS.filter(a => a.name.toLowerCase().includes(mentionFilter) || a.label.toLowerCase().includes(mentionFilter)).length === 0 && (
              <div className="px-3 py-2 text-xs text-slate-500 text-center">검색 결과가 없습니다</div>
            )}
          </div>
        )}
        <div className="relative flex items-center gap-2">
          <input 
            ref={textareaRef}
            type="text"
            value={inputValue}
            onChange={(e) => {
              const val = e.target.value;
              setInputValue(val);
              const lastAtPos = val.lastIndexOf('@');
              if (lastAtPos !== -1) {
                const textAfterAt = val.slice(lastAtPos + 1);
                if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
                  setShowMentionMenu(true);
                  setMentionFilter(textAfterAt.toLowerCase());
                } else {
                  setShowMentionMenu(false);
                }
              } else {
                setShowMentionMenu(false);
              }
            }}
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
