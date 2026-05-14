import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Send, Loader2, Bot, User,
  AlertTriangle, Mic, Square, Wifi, WifiOff, Plus, Sparkles
} from 'lucide-react';
import { getAccessToken, getAuthHeaders } from '../../lib/authStore';
import ReactMarkdown from 'react-markdown';
import { useCodebook } from '../../context/CodebookContext';

const API_BASE = 'https://sguardai.khcho0421.workers.dev';

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
    if (!code) return 'INC_002'; // Fallback
    const found = allCodes.find(c => c.category === 'INCIDENT_STATUS' && c.code === code);
    return found ? found.name : code;
  };
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [incidentInfo, setIncidentInfo] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const wsRef = useRef(null);
  const recognitionRef = useRef(null);
  const reconnectTimer = useRef(null);
  const isMounted = useRef(true);

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
    if (textareaRef.current) textareaRef.current.style.height = '14px';

    // 로컬에 즉시 표시
    const tempMsg = {
      id: Date.now(),
      seq: null,
      role: 'user',
      sender: user?.name || '나',
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
          role: user?.role || 'user',
          type: 'user',
          text,
        }),
      });
    } catch (_) {}
    setSending(false);
  }, [input, sending, incidentId, user, participants.length]);

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
          <div className="min-w-0">
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-tight">War-Room · {incidentId || '-'}</p>
            <p className="text-sm font-bold text-white truncate">
              {incidentInfo?.service_name || incidentInfo?.message?.substring(0, 28) || 'Incident Chat'}
            </p>
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

        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[11px] font-bold ${
              msg.role === 'user'
                ? 'bg-[#00236e]/20 border border-[#00236e]/30 text-white/70'
                : msg.role === 'assistant' ? 'bg-[#242424] border border-white/10 text-slate-300'
                : 'bg-[#333333] border border-white/5 text-slate-400'
            }`}>
              {msg.role === 'user' ? (user?.name?.[0] || 'U') : msg.role === 'assistant' ? <Bot className="w-4 h-4" /> : (msg.sender?.[0] || '?')}
            </div>
            <div className={`max-w-[78%] flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              {msg.role === 'other' && (
                <span className="text-[10px] text-slate-500 px-1 font-medium">{msg.sender}</span>
              )}
              <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              msg.role === 'user'
                  ? 'bg-[#00236e] text-white rounded-2xl rounded-tr-none'
                  : msg.role === 'assistant'
                  ? 'bg-[#242424] border border-[#333] text-slate-200 rounded-2xl rounded-tl-none'
                  : 'bg-[#333333] border border-white/5 text-white rounded-2xl rounded-tl-none'
              }`}>
                {msg.role === 'assistant'
                  ? <div className="prose prose-invert prose-sm max-w-none prose-p:my-1"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                  : <p className="whitespace-pre-wrap">{msg.content}</p>
                }
              </div>
              <div className={`flex items-end gap-1.5 px-1 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <span className="text-[10px] text-slate-600 shrink-0">{formatTime(msg.ts)}</span>
                {msg.read_count > 0 && (
                  <span className="text-[11px] font-bold text-[#FAE100] leading-none mb-0.5">{msg.read_count}</span>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* 입력 영역 (초슬림 모바일 버전) */}
      <div className="bg-[#191919] border-t border-[#242424] px-2 py-1.5 shrink-0"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' }}>
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
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
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
    </div>
  );
}
