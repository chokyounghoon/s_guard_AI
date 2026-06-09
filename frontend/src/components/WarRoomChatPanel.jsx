import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, User, Sparkles, Zap, Megaphone, Info, Bot, X, Smile } from 'lucide-react';
import AICardMarkdown from './AICardMarkdown';
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
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [longPressMsg, setLongPressMsg] = useState(null);
  const longPressTimer = useRef(null);
  const textareaRef = useRef(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef(null);

  const EMOJI_LIST = [
    { label: '자주 쓰는', emojis: ['👍','✅','🚨','⚠️','🔧','🔥','❌','💡','📋','📞','🕐','⏱️','🎯','🚀','💬'] },
    { label: '표정', emojis: ['😊','😅','😂','🙏','😰','😱','🤔','😡','😭','🥲','🫡','🥳','😎','🤝','💪'] },
    { label: '기호', emojis: ['✔️','❗','❓','⭕','🔴','🟠','🟡','🟢','🔵','⚡','🔔','📌','🗂️','🗃️','📊'] },
  ];

  const AI_AGENTS = [
    { id: 'expert', name: 'AI Expert', label: 'S-Autopilot Expert' },
    { id: 'security', name: 'Security Agent', label: '보안 전문가' },
    { id: 'db', name: 'DB Agent', label: 'DB 전문가' },
    { id: 'devops', name: 'DevOps Agent', label: '인프라 전문가' },
    { id: 'leader', name: 'Leader Agent', label: '총괄 매니저' }
  ];

  const AI_PROMPT_SUGGESTIONS = [
    { id: 'history', title: '유사 장애 이력 찾아줘', desc: '과거 유사 사례 및 조치 이력 검색' },
    { id: 'cause', title: '이 에러 원인 분석해줘', desc: '현재 발생한 에러 로그 및 원인 정밀 분석' },
    { id: 'solution', title: '조치 방법 추천해줘', desc: '단계별 최적의 복구 및 해결 가이드 제시' }
  ];

  // Auto scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // 이모티콘 픽커 외부 클릭 시 닫기
  useEffect(() => {
    if (!showEmojiPicker) return;
    const handleClick = (e) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showEmojiPicker]);

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

  const handleDeleteMessage = async (msgId) => {
    try {
      const cleanIncId = String(incidentId).replace('INC-', '');
      const res = await fetch(`${API_BASE}/warroom/chat/${cleanIncId}/${msgId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${getAccessToken()}`
        }
      });
      if (res.ok) {
        setMessages(prev => prev.filter(m => (m.id || m.seq || m.inc_id) !== msgId));
      } else {
        console.error("Failed to delete message from DB in popup");
      }
    } catch (err) {
      console.error("Error deleting message in popup:", err);
    }
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  const handleSendMessage = async (customText = null) => {
    const text = typeof customText === 'string' ? customText : inputValue;
    if (!text.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

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
      setIsAiTyping(true);
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
            response_mode: "streaming",
            user: cleanUser
          })
        });
        if (difyRes.ok) {
          const reader = difyRes.body.getReader();
          const decoder = new TextDecoder("utf-8");
          let buffer = "";
          let accumulatedAnswer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // incomplete last line kept in buffer

            for (const line of lines) {
              if (line.trim().startsWith('data:')) {
                const jsonStr = line.replace(/^data:\s*/, '').trim();
                if (!jsonStr || jsonStr === '[DONE]') continue;
                try {
                  const parsed = JSON.parse(jsonStr);
                  if (parsed.answer) {
                    accumulatedAnswer += parsed.answer;
                  }
                } catch (e) {}
              }
            }
          }

          if (accumulatedAnswer.trim() && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: "CHAT_SEND",
              incident_id: incidentId,
              sender: aiAgentName,
              name: aiAgentName,
              role: 'assistant',
              profile_picture: null,
              msg_type: "mention_reply",
              text: accumulatedAnswer.trim()
            }));
          }
        } else {
          const errText = await difyRes.text();
          console.error("Dify API 400 Error:", errText);
        }
      } catch (err) {
        console.error("AI API Error:", err);
      } finally {
        setIsAiTyping(false);
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
            m.msg_type === 'mention_reply' || m.role === 'assistant' || m.role === 'AI Expert' || (
              m.type !== 'ai' && 
              m.type !== 'ai_analysis' && 
              m.type !== 'system' && 
              m.role !== 'assistant' && 
              m.role !== 'AI Expert' &&
              !/Agent/i.test(m.sender_name || m.sender || '') &&
              !/Agent/i.test(m.role || '')
            )
          )
          .map((msg, idx) => {
            const avatarSrc = msg.avatar_url || (msg.profile_picture ? (msg.profile_picture.startsWith('http') || msg.profile_picture.startsWith('data:image') ? msg.profile_picture : `https://sguardai.khcho0421.workers.dev${msg.profile_picture}`) : null);
            const isAiAgent = msg.msg_type === 'mention_reply' || msg.role === 'assistant' || msg.role === 'AI Expert' || /Agent|Expert/i.test(msg.sender_name || msg.sender || msg.name || '');

            if (isAiAgent) {
              return (
                <div key={msg.id || idx} className="w-full my-4 bg-gradient-to-br from-[#051329] to-[#0a1b3a] border border-[#00e5ff]/30 rounded-2xl p-4 shadow-[0_4px_20px_rgba(0,229,255,0.15)] animate-in fade-in duration-300">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-[#00e5ff]/20 border border-[#00e5ff]/50 flex items-center justify-center shadow-[0_0_10px_rgba(0,229,255,0.3)] shrink-0">
                        <Bot className="w-4 h-4 text-[#00e5ff]" />
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-black text-white text-sm tracking-wide">{msg.name || msg.sender_name || msg.sender || 'AI Assistant'}</span>
                        <span className="px-2 py-0.5 rounded-md bg-[#00ff88]/10 border border-[#00ff88]/40 text-[#00ff88] text-[10px] font-mono font-bold tracking-wider uppercase shadow-[0_0_8px_rgba(0,255,136,0.2)]">
                          [S-GUARD AI System]
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-slate-400 text-[10px] font-mono shrink-0">
                      <div className="flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-[#00e5ff]" />
                        <span>{msg.time || msg.ts ? formatKst(msg.time || msg.ts) : ''}</span>
                      </div>
                      <button 
                        onClick={() => handleDeleteMessage(msg.id || msg.seq)}
                        className="px-2.5 py-1 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 hover:text-red-300 active:scale-95 transition-all ml-1 flex items-center gap-1 shadow-[0_0_12px_rgba(239,68,68,0.25)] font-sans font-bold text-xs cursor-pointer z-10"
                        title="메시지 삭제"
                      >
                        <X className="w-3.5 h-3.5 text-red-400 stroke-[3]" />
                        <span>삭제</span>
                      </button>
                    </div>
                  </div>
                  <div className="pt-2">
                    <AICardMarkdown text={msg.text || msg.content || ''} />
                  </div>
                </div>
              );
            }

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
                      <div 
                        onTouchStart={() => { longPressTimer.current = setTimeout(() => setLongPressMsg(msg), 500); }}
                        onTouchEnd={() => clearTimeout(longPressTimer.current)}
                        onTouchMove={() => clearTimeout(longPressTimer.current)}
                        onContextMenu={(e) => { e.preventDefault(); setLongPressMsg(msg); }}
                        className={`rounded-2xl px-3.5 py-2.5 text-[13px] leading-[1.4] shadow-md break-words whitespace-pre-wrap select-none
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
        {isAiTyping && (
          <div className="w-full my-4 bg-gradient-to-br from-[#051329]/90 to-[#0a1b3a]/90 border border-[#00e5ff]/40 rounded-2xl p-4 shadow-[0_4px_25px_rgba(0,229,255,0.25)] animate-pulse flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#00e5ff]/20 border border-[#00e5ff]/50 flex items-center justify-center shrink-0 animate-spin shadow-[0_0_12px_rgba(0,229,255,0.5)]">
              <Bot className="w-4 h-4 text-[#00e5ff]" />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-black text-white text-sm tracking-wide">AI Assistant</span>
                <span className="px-1.5 py-0.5 rounded-md bg-[#00e5ff]/15 border border-[#00e5ff]/30 text-[#00e5ff] text-[10px] font-mono font-bold animate-pulse tracking-wider">THINKING</span>
              </div>
              <span className="text-xs text-[#00ff88] font-mono mt-1 flex items-center gap-2 truncate">
                <span className="inline-block w-2 h-2 rounded-full bg-[#00ff88] animate-ping shrink-0 shadow-[0_0_8px_#00ff88]" />
                <span className="truncate">AI가 S-Guard 내부 시스템 및 지식 기반을 연동하여 실시간 답변을 생성 중입니다...</span>
              </span>
            </div>
          </div>
        )}

        {/* 🗨️ 팝업창 길게 누르기 바텀시트 */}
        {longPressMsg && (
          <div
            className="absolute inset-0 z-[200] flex items-end justify-center"
            onClick={() => setLongPressMsg(null)}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" />
            <div
              className="relative w-full max-w-lg bg-[#1a2035] rounded-t-3xl border-t border-white/10 shadow-2xl animate-in slide-in-from-bottom-4 duration-300 pb-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 bg-white/20 rounded-full" />
              </div>

              <div className="mx-4 mb-3 px-4 py-3 bg-[#191919] rounded-2xl border border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold shrink-0 text-white">
                    {longPressMsg.sender_name?.[0] || longPressMsg.sender?.[0] || 'U'}
                  </div>
                  <span className="text-[12px] font-bold text-slate-300">{longPressMsg.sender_name || longPressMsg.sender || (longPressMsg.type === 'me' ? (currentUser?.name || '나') : 'AI Assistant')}</span>
                  <span className="text-[10px] text-slate-500 ml-auto">{longPressMsg.time}</span>
                </div>
                <div className="max-h-32 overflow-y-auto" style={{scrollbarWidth:'thin',scrollbarColor:'rgba(255,255,255,0.08) transparent'}}>
                  <p className="text-[14px] text-white leading-relaxed break-all whitespace-pre-wrap">{longPressMsg.text || longPressMsg.content || ''}</p>
                </div>
              </div>

              <div className="divide-y divide-white/5">
                {(longPressMsg?.type === 'me' || String(longPressMsg?.sender ?? '').trim() === String(currentUser?.employee_id ?? '').trim() || String(longPressMsg?.sender ?? '').trim() === String(currentUser?.name ?? '').trim()) && (
                  <button
                    onClick={() => { handleDeleteMessage(longPressMsg.id || longPressMsg.seq || longPressMsg.inc_id); setLongPressMsg(null); }}
                    className="w-full flex items-center gap-4 px-6 py-3.5 hover:bg-red-500/10 transition-colors text-left group"
                  >
                    <div className="w-9 h-9 rounded-full bg-red-500/15 group-hover:bg-red-500/25 flex items-center justify-center transition-colors">
                      <X className="w-4 h-4 text-red-400 stroke-[3]" />
                    </div>
                    <span className="text-[15px] text-red-400 font-bold">내 메시지 삭제</span>
                  </button>
                )}
                <button
                  onClick={() => setLongPressMsg(null)}
                  className="w-full flex items-center gap-4 px-6 py-3.5 hover:bg-white/5 transition-colors text-left"
                >
                  <div className="w-9 h-9 rounded-full bg-slate-700/50 flex items-center justify-center">
                    <X className="w-4 h-4 text-slate-400" />
                  </div>
                  <span className="text-[15px] text-slate-400 font-medium">취소</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-[#0d111a] border-t border-white/5 relative">
        {showMentionMenu && (
          <div className="absolute bottom-full left-4 right-4 mb-2 bg-[#1a2035] border border-white/10 rounded-2xl p-1.5 shadow-2xl z-[100] max-h-48 overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            {AI_PROMPT_SUGGESTIONS.filter(p => p.title.toLowerCase().includes(mentionFilter)).map(prompt => (
              <div 
                key={prompt.id}
                onClick={() => {
                  const promptText = `@AI ${prompt.title}`;
                  setShowMentionMenu(false);
                  setInputValue('');
                  handleSendMessage(promptText);
                }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 active:bg-white/20 cursor-pointer transition-all border border-white/5 my-0.5 bg-black/20 hover:border-[#00e5ff]/30 group"
              >
                <div className="w-7 h-7 rounded-xl bg-[#00e5ff]/20 border border-[#00e5ff]/40 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <Sparkles className="w-3.5 h-3.5 text-[#00e5ff]" />
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-xs font-black text-white truncate group-hover:text-[#00e5ff] transition-colors">{prompt.title}</span>
                  <span className="text-[10px] text-slate-400 truncate">{prompt.desc}</span>
                </div>
              </div>
            ))}
            {AI_PROMPT_SUGGESTIONS.filter(p => p.title.toLowerCase().includes(mentionFilter)).length === 0 && (
              <div className="px-3 py-2 text-xs text-slate-500 text-center">검색 결과가 없습니다</div>
            )}
          </div>
        )}
        <div className="relative flex items-end gap-2">
          {/* 이모티콘 버튼 */}
          <div className="relative" ref={emojiPickerRef}>
            <button
              type="button"
              onClick={() => setShowEmojiPicker(p => !p)}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all active:scale-95 shrink-0"
              title="이모티콘"
            >
              <Smile className="w-4 h-4 text-yellow-400" />
            </button>
            {/* 이모티콘 픽커 팝업 */}
            {showEmojiPicker && (
              <div
                className="absolute bottom-full left-0 mb-2 w-64 bg-[#1a2035] border border-white/10 rounded-2xl shadow-2xl z-[200] p-3 animate-in fade-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
              >
                {EMOJI_LIST.map(cat => (
                  <div key={cat.label} className="mb-2">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">{cat.label}</p>
                    <div className="grid grid-cols-5 gap-1">
                      {cat.emojis.map(emoji => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => {
                            setInputValue(prev => prev + emoji);
                            textareaRef.current?.focus();
                            setShowEmojiPicker(false);
                          }}
                          className="w-10 h-10 flex items-center justify-center text-xl rounded-xl hover:bg-white/10 active:scale-90 transition-all"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputValue}
            onChange={(e) => {
              const val = e.target.value;
              setInputValue(val);
              // 자동 높이 조절
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
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
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="전문가들과 의견을 나누세요... (이모티콘 가능 😊)"
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 transition-all resize-none overflow-hidden leading-relaxed"
            style={{ minHeight: '40px', maxHeight: '120px' }}
          />
          <button 
            onClick={handleSendMessage}
            disabled={!inputValue.trim()}
            className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:grayscale transition-all shadow-lg active:scale-95 shrink-0"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
