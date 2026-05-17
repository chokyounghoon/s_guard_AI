import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Send, Loader2, Bot, User,
  AlertTriangle, Mic, Square, Wifi, WifiOff, Plus, Sparkles, X
} from 'lucide-react';
import { getAccessToken, getAuthHeaders } from '../../lib/authStore';
import AICardMarkdown from '../../components/AICardMarkdown';
import { useCodebook } from '../../context/CodebookContext';

const API_BASE = 'https://sguardai.khcho0421.workers.dev';

// ── 🚀 2단계 최적화: Base64 → Blob Object URL 단일 변환 캐시 (모바일) ──
const _mobileAvatarCache = new Map();
const getMobileAvatarUrl = (pic) => {
  if (!pic) return null;
  if (_mobileAvatarCache.has(pic)) return _mobileAvatarCache.get(pic);
  if (pic.startsWith('data:image')) {
    try {
      const [header, b64] = pic.split(',');
      const mime = header.match(/:(.*?);/)[1];
      const bstr = atob(b64);
      let n = bstr.length;
      const u8 = new Uint8Array(n);
      while (n--) u8[n] = bstr.charCodeAt(n);
      const url = URL.createObjectURL(new Blob([u8], { type: mime }));
      _mobileAvatarCache.set(pic, url);
      return url;
    } catch { _mobileAvatarCache.set(pic, pic); return pic; }
  } else if (pic.startsWith('http')) {
    _mobileAvatarCache.set(pic, pic); return pic;
  } else {
    const url = `${API_BASE}${pic}`;
    _mobileAvatarCache.set(pic, url); return url;
  }
};

const formatTime = (ts) => {
  if (!ts) return '';
  const d = new Date(typeof ts === 'string' && !ts.includes('T') ? ts.replace(' ', 'T') : ts);
  return isNaN(d) ? '' : d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
};

export default function MobileChat({ user }) {
  const { incidentId } = useParams();
  const navigate = useNavigate();
  const { allCodes } = useCodebook();

  const getStatusName = (code) => {
    if (!code) return '분석중';
    const norm = String(code).toUpperCase().trim();
    const found = allCodes.find(c => c.category === 'INCIDENT_STATUS' && (c.code.toUpperCase() === norm || c.name.toUpperCase() === norm));
    if (found) return found.name;
    if (norm === 'INC_001' || norm === 'OPEN' || norm === '미확인' || norm === '대기') return '미처리';
    if (norm === 'INC_002' || norm === 'PROGRESS' || norm === '분석중' || norm === '처리중' || norm === '진행중') return '진행중';
    if (norm === 'INC_003' || norm === 'CLOSED' || norm === '처리완료' || norm === '조치완료') return '처리완료';
    return code;
  };
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [incidentInfo, setIncidentInfo] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [longPressMsg, setLongPressMsg] = useState(null);
  
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
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const wsRef = useRef(null);
  const recognitionRef = useRef(null);
  const reconnectTimer = useRef(null);
  const isMounted = useRef(true);
  const longPressTimer = useRef(null);

  const cleanProfilePic = (pic) => (typeof pic === 'string' && pic.length > 300) ? null : (pic || null);

  // 인시던트 정보 + 채팅 기록 로드
  useEffect(() => {
    isMounted.current = true;
    if (!incidentId) { setLoading(false); return; }

    const token = getAccessToken();
    const normId = String(incidentId);

    Promise.all([
      fetch(`${API_BASE}/sms/${normId}`, { headers: getAuthHeaders() }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${API_BASE}/warroom/chat/${normId}`, { headers: getAuthHeaders() }).then(r => r.ok ? r.json() : { messages: [] }).catch(() => ({ messages: [] })),
    ]).then(([inc, chat]) => {
      if (!isMounted.current) return;
      setIncidentInfo(inc);

      const history = (chat.messages || []).map(m => ({
        id: m.id || m.seq || Math.random().toString(36),
        seq: m.seq,
        role: m.sender === user?.employee_id || m.sender === user?.name ? 'user' : (m.type === 'ai_analysis' ? 'assistant' : 'other'),
        sender: m.sender_name || m.sender,
        avatar_url: getMobileAvatarUrl(m.profile_picture),
        content: m.text || m.content || '',
        ts: m.timestamp,
        read_count: m.read_count || 0,
      }));
      setMessages(history);
    }).catch(console.error)
      .finally(() => { if (isMounted.current) setLoading(false); });

    return () => { isMounted.current = false; };
  }, [incidentId, user]);

  const fetchParticipants = useCallback(async () => {
    if (!incidentId) return;
    try {
      const normId = String(incidentId);
      const res = await fetch(`${API_BASE}/warroom/participants/${normId}`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setParticipants(data.participants || []);
      }
    } catch (e) { console.error('Failed to fetch participants', e); }
  }, [incidentId]);

  useEffect(() => {
    fetchParticipants();
  }, [fetchParticipants]);

  // Auto-mark as read
  useEffect(() => {
    if (messages.length > 0 && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const normId = String(incidentId);
      messages.forEach(msg => {
        if (msg.read_count > 0 && msg.role !== 'user' && msg.seq) {
          wsRef.current.send(JSON.stringify({
            type: "MARK_READ",
            incident_id: normId,
            seq: msg.seq,
            user_id: user.employee_id
          }));
        }
      });
    }
  }, [messages.length, user?.employee_id, incidentId]);

  // WebSocket 연결
  useEffect(() => {
    if (!incidentId || !user?.employee_id) return;
    const normId = String(incidentId);

    const connect = () => {
      if (!isMounted.current) return;
      try {
        const token = getAccessToken();
        const ws = new WebSocket(`wss://sguardai.khcho0421.workers.dev/warroom/ws/${normId}${token ? `?token=${token}` : ''}`);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isMounted.current) { ws.close(); return; }
          setIsConnected(true);
          ws.send(JSON.stringify({
            type: 'JOIN',
            user_id: user.employee_id,
            name: user.name,
            incident_id: normId,
          }));
        };

        ws.onmessage = (event) => {
          if (!isMounted.current) return;
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'CHAT_MESSAGE') {
              setMessages(prev => {
                if (prev.some(m => m.id === data.msg_id || (m.seq && m.seq === data.seq))) return prev;
                return [...prev, {
                  id: data.msg_id || Date.now(),
                  seq: data.seq,
                  role: (data.sender === user.employee_id || data.sender === user.name) ? 'user' : 'other',
                  sender: data.sender_name || data.sender,
                  avatar_url: getMobileAvatarUrl(data.profile_picture),
                  content: data.text,
                  ts: data.timestamp,
                  read_count: data.read_count || 0,
                }];
              });
              if (data.sender !== user.employee_id && data.sender !== user.name && data.seq && wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                  type: "MARK_READ", incident_id: normId, seq: data.seq, user_id: user.employee_id
                }));
              }
            } else if (data.type === 'READ_UPDATE') {
              setMessages(prev => prev.map(m => (m.seq === data.seq) ? { ...m, read_count: data.read_count !== undefined ? data.read_count : Math.max(0, (m.read_count || 1) - 1) } : m));
            } else if (data.type === 'AI_SUMMARY') {
              setMessages(prev => [...prev, {
                id: `ai_${Date.now()}`,
                role: 'assistant',
                sender: 'AI Analyst',
                content: data.summary,
                ts: new Date().toISOString(),
              }]);
            }
          } catch (_) {}
        };

        ws.onclose = () => {
          if (!isMounted.current) return;
          setIsConnected(false);
          reconnectTimer.current = setTimeout(connect, 3000);
        };

        ws.onerror = () => { ws.close(); };
      } catch (_) {}
    };

    connect();

    const handleVisibilityChange = () => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      wsRef.current.send(JSON.stringify({
        type: document.hidden ? 'PAGE_HIDDEN' : 'PAGE_VISIBLE',
        user_id: user?.employee_id,
      }));
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted.current = false;
      clearTimeout(reconnectTimer.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
        wsRef.current.close();
      }
    };
  }, [incidentId, user]);

  // 스크롤 하단 유지
  useEffect(() => {
    if (messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || sending || !incidentId) return;
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      alert('연결이 끊어졌습니다. 잠시 후 다시 시도해 주세요.');
      return;
    }
    const normId = String(incidentId);
    setSending(true);
    setInput('');
    setShowMentionMenu(false);
    if (textareaRef.current) textareaRef.current.style.height = '14px';

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

    // 로컬에 즉시 표시
    const tempMsg = {
      id: Date.now(),
      seq: null,
      role: 'user',
      sender: user?.name || '나',
      profile_picture: user?.profile_picture || null,
      content: text,
      ts: new Date().toISOString(),
      read_count: Math.max(0, participants.length - 1)
    };
    setMessages(prev => [...prev, tempMsg]);

    // WebSocket으로 전송
    wsRef.current.send(JSON.stringify({
      type: 'CHAT_SEND',
      incident_id: normId,
      sender: user?.employee_id,
      name: user?.name,
      role: user?.role,
      profile_picture: cleanProfilePic(user?.profile_picture),
      msg_type: 'user',
      text,
    }));

    // DB에도 저장
    try {
      await fetch(`${API_BASE}/warroom/chat`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          incident_id: normId,
          sender: user?.employee_id,
          name: user?.name,
          sender_name: user?.name,
          role: user?.role || 'user',
          profile_picture: cleanProfilePic(user?.profile_picture),
          type: 'user',
          text,
        }),
      });
    } catch (_) {}

    // Dify API 호출
    if (isAiQuery) {
      const callDify = async () => {
        setIsAiTyping(true);
        try {
          const apiKey = 'app-ZDaVB8EWtA5vmTYJLmbysdQq';
          const cleanUser = String(user?.employee_id || "sguard_user").replace(/[^a-zA-Z0-9_-]/g, '') || "sguard_user";
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
              buffer = lines.pop(); // keep incomplete last line

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
                sender: `system_${aiAgentName.replace(/ /g, '_').toLowerCase()}`,
                name: aiAgentName,
                role: 'assistant',
                msg_type: "ai_analysis",
                text: accumulatedAnswer.trim()
              }));
            }
          } else {
            const errText = await difyRes.text();
            console.error("Dify API 400 Error:", errText);
          }
        } catch (e) {
          console.error("Dify API error", e);
        } finally {
          setIsAiTyping(false);
        }
      };
      callDify();
    }

    setSending(false);
  }, [input, sending, incidentId, user, participants.length]);

  const handleDeleteMessage = useCallback(async (msgId) => {
    try {
      const cleanIncId = String(incidentId).replace('INC-', '');
      const res = await fetch(`${API_BASE}/warroom/chat/${cleanIncId}/${msgId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        setMessages(prev => prev.filter(m => (m.id || m.seq || m.inc_id) !== msgId));
      } else {
        console.error("Failed to delete message from DB");
      }
    } catch (err) {
      console.error("Error deleting message:", err);
    }
  }, [incidentId]);

  return (
    <div className="flex flex-col bg-[#191919] overflow-hidden" style={{ height: '100dvh' }}>

      {/* 헤더 */}
      <header className="flex items-center gap-3 px-4 py-3 bg-[#191919] border-b border-[#242424] shrink-0"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}>
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-white/10 active:scale-90 transition-all">
          <ChevronLeft className="w-5 h-5 text-slate-300" />
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4 text-red-400" />
          </div>
          <div className="min-w-0 flex-1 pr-1">
            <p className="text-base sm:text-lg font-black text-white truncate tracking-wide">
              {(() => {
                const titleStr = incidentInfo?.service_name || incidentInfo?.message || 'Incident Chat';
                return titleStr.replace(/^[\d-]+\s*\|\s*/, '').trim() || '시스템 장애 대응 워룸';
              })()}
            </p>
            {incidentInfo?.message && incidentInfo.message !== incidentInfo.service_name && (
              <p className="text-[11px] text-slate-400 truncate mt-0.5 tracking-tight">{incidentInfo.message}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* W/R 분석 버튼 추가 - PC 버전과 동일한 스트리밍 페이지로 연결 */}
          <button
            onClick={() => navigate(`/chat-summary/${incidentId}`)}
            className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center active:scale-95 transition-all shadow-[0_0_15px_rgba(99,102,241,0.2)]"
            title="W/R 분석"
          >
            <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
          </button>

          <div className="flex flex-col items-end gap-0.5 ml-1">
            {isConnected
              ? <><div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" /><span className="text-[10px] text-green-400 font-mono">LIVE</span></>
              : <><WifiOff className="w-3.5 h-3.5 text-red-400" /><span className="text-[10px] text-red-400 font-mono">OFFLINE</span></>
            }
          </div>
        </div>
      </header>

      {/* 인시던트 배너 */}
      {incidentInfo?.message && (
        <div className="bg-red-900/10 border-b border-red-500/15 px-4 py-2 shrink-0 flex items-center gap-3">
          <p className="text-[11px] text-red-400/80 flex-1 truncate">{incidentInfo.message}</p>
          <span className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full font-bold shrink-0">{getStatusName(incidentInfo?.status)}</span>
        </div>
      )}

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500/40" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-600">
            <Bot className="w-12 h-12 mb-4 opacity-30" />
            <p className="text-sm text-center">War-Room에 오신 것을 환영합니다.<br />메시지를 입력하여 대화를 시작하세요.</p>
          </div>
        ) : null}

        {messages.map((msg) => {
          const avatarUrl = msg.avatar_url || null;
          const isAiAgent = msg.role === 'assistant' || msg.msg_type === 'ai_analysis' || /agent|expert/i.test(msg.sender || msg.name || '');

          if (isAiAgent) {
            return (
              <div key={msg.id} className="w-full my-4 bg-gradient-to-br from-[#051329] to-[#0a1b3a] border border-[#00e5ff]/30 rounded-2xl p-4 shadow-[0_4px_20px_rgba(0,229,255,0.15)] animate-in fade-in duration-300">
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
                      <span>{formatTime(msg.ts || msg.time)}</span>
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
                  <AICardMarkdown text={msg.content || msg.text || ''} />
                </div>
              </div>
            );
          }

          return (
            <div key={msg.id} className={`flex gap-2 items-end ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} mb-3`}>
              <div className="relative w-8 h-8 shrink-0 self-start mt-0.5">
                {avatarUrl ? (
                  <img 
                    src={avatarUrl} 
                    alt={msg.sender || 'User'} 
                    className="w-8 h-8 rounded-full object-cover border border-white/10 shadow-sm"
                    onError={(e) => { e.currentTarget.style.display = 'none'; if (e.currentTarget.nextElementSibling) e.currentTarget.nextElementSibling.style.display = 'flex'; }}
                  />
                ) : null}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold ${avatarUrl ? 'hidden' : 'flex'} ${
                  msg.role === 'user'
                    ? 'bg-[#00236e]/20 border border-[#00236e]/30 text-white/70'
                    : 'bg-[#333333] border border-white/5 text-slate-400'
                }`}>
                  {msg.role === 'user' ? (user?.name?.[0] || 'U') : (msg.sender?.[0] || '?')}
                </div>
              </div>
              <div className={`flex flex-col max-w-[75%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                {msg.role === 'other' && (
                  <span className="text-[10px] text-slate-500 px-1 font-medium mb-1">{msg.sender}</span>
                )}
                <div className={`flex items-end gap-1.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  {/* 말풍선 본체 */}
                  <div 
                    onTouchStart={() => { isMounted.current && (longPressTimer.current = setTimeout(() => setLongPressMsg(msg), 500)); }}
                    onTouchEnd={() => clearTimeout(longPressTimer.current)}
                    onTouchMove={() => clearTimeout(longPressTimer.current)}
                    onContextMenu={(e) => { e.preventDefault(); setLongPressMsg(msg); }}
                    className={`rounded-2xl px-3.5 py-2.5 text-sm leading-[1.4] shadow-md break-words select-none ${
                      msg.role === 'user'
                        ? 'bg-[#0038a8] text-white rounded-tr-none'
                        : 'bg-[#2a2f3a] border border-white/5 text-slate-100 rounded-tl-none'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  {/* 말풍선 메타데이터 (시간 + 안읽음 숫자) - 세로형 Flex 컨테이너 */}
                  <div className={`flex flex-col justify-end shrink-0 select-none pb-0.5 ${msg.role === 'user' ? 'items-end mr-0.5' : 'items-start ml-0.5'}`}>
                    {msg.read_count > 0 && (
                      <span className="text-[10px] font-black text-[#FAE100] leading-none mb-1 drop-shadow-sm">{msg.read_count}</span>
                    )}
                    <span className="text-[9px] font-mono text-slate-400 leading-none">{formatTime(msg.ts)}</span>
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
                <span className="truncate">AI가 S-Guard 내부 DB 및 지식 기반을 연동하여 실시간 답변을 생성 중입니다...</span>
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 입력 영역 (초슬림 모바일 버전) */}
      <div className="bg-[#191919] border-t border-[#242424] px-2 py-1.5 shrink-0 relative"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' }}>
        
        {/* Mention Menu */}
        {showMentionMenu && (
          <div className="absolute bottom-full left-2 right-2 mb-2 bg-[#1a2035] border border-white/10 rounded-2xl p-1.5 shadow-2xl z-[100] max-h-48 overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            {AI_PROMPT_SUGGESTIONS.filter(p => p.title.toLowerCase().includes(mentionFilter)).map(prompt => (
              <div 
                key={prompt.id}
                onClick={() => {
                  const promptText = `@AI ${prompt.title}`;
                  setShowMentionMenu(false);
                  setInput('');
                  sendMessage(promptText);
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

        <div className="flex items-end gap-1">
          {/* 파일 첨부/기능 (Plus) */}
          <button className="flex items-center justify-center rounded-full bg-[#2A2A2A] border border-white/10 text-slate-300 transition-all active:scale-90 flex-none mb-0.5"
            style={{ width: 36, height: 36, minWidth: 36, minHeight: 36 }}>
            <Plus className="w-5 h-5" />
          </button>

          {/* 입력 필드 (Pill - 수직 중앙 정렬 items-center) */}
          <div className="flex-1 bg-[#2A2A2A] border border-white/10 rounded-[18px] flex items-center overflow-hidden" style={{ minHeight: 36 }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                const val = e.target.value;
                setInput(val);
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
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault(); sendMessage();
                }
              }}
              placeholder={isConnected ? '메시지를 입력하세요...' : '연결 중...'}
              rows={1}
              disabled={!isConnected}
              className="flex-1 bg-transparent px-4 py-[7px] text-[14px] text-white placeholder:text-[#666666] resize-none focus:outline-none leading-tight disabled:opacity-50"
              style={{ minHeight: 32, maxHeight: 120 }}
            />
            {/* 이모지 버튼 (2xl 확대) */}
            <button className="flex items-center justify-center w-9 h-9 mr-1 rounded-full text-2xl leading-none shrink-0 text-slate-400 hover:text-white transition-all">
              😊
            </button>
          </div>

          {/* 전송 버튼 (독립 배치) */}
          <button id="mobile-chat-send" onClick={sendMessage} disabled={sending || !input.trim() || !isConnected}
            className={`flex items-center justify-center rounded-full transition-all active:scale-95 flex-none shadow-lg mb-0.5
              ${sending || !input.trim() || !isConnected
                ? 'bg-slate-800 text-slate-600 opacity-50'
                : 'bg-blue-600 text-white shadow-blue-900/30'
              }`}
            style={{ width: 36, height: 36, minWidth: 36, minHeight: 36 }}>
            {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 fill-current" />}
          </button>
        </div>
      </div>

      {/* 🗨️ 모바일 길게 누르기 바텀시트 */}
      {longPressMsg && (
        <div
          className="fixed inset-0 z-[200] flex items-end justify-center"
          onClick={() => setLongPressMsg(null)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" />
          <div
            className="relative w-full max-w-lg bg-[#1a2035] rounded-t-3xl border-t border-white/10 shadow-2xl animate-in slide-in-from-bottom-4 duration-300 pb-safe"
            onClick={e => e.stopPropagation()}
          >
            {/* 핸들 */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-white/20 rounded-full" />
            </div>

            {/* 메시지 내용 상단 표시 */}
            <div className="mx-4 mb-3 px-4 py-3 bg-[#191919] rounded-2xl border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold shrink-0 text-white">
                  {longPressMsg.sender?.[0] || 'U'}
                </div>
                <span className="text-[12px] font-bold text-slate-300">{longPressMsg.sender || (longPressMsg.role === 'user' ? (user?.name || '나') : 'AI Assistant')}</span>
                <span className="text-[10px] text-slate-500 ml-auto">{formatTime(longPressMsg.ts || longPressMsg.timestamp || Date.now())}</span>
              </div>
              <div className="max-h-32 overflow-y-auto" style={{scrollbarWidth:'thin',scrollbarColor:'rgba(255,255,255,0.08) transparent'}}>
                <p className="text-[14px] text-white leading-relaxed break-all whitespace-pre-wrap">{longPressMsg.content || longPressMsg.text || ''}</p>
              </div>
            </div>

            {/* 액션 목록 */}
            <div className="divide-y divide-white/5">
              {(longPressMsg?.role === 'user' || String(longPressMsg?.sender ?? '').trim() === String(user?.employee_id ?? '').trim() || String(longPressMsg?.sender ?? '').trim() === String(user?.name ?? '').trim()) && (
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
            <div className="h-6" /> {/* safe area padding */}
          </div>
        </div>
      )}
    </div>
  );
}
