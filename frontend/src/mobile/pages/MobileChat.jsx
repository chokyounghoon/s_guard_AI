import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Send, Loader2, Bot, User,
  AlertTriangle, Mic, Square, Wifi, WifiOff
} from 'lucide-react';
import { getAccessToken, getAuthHeaders } from '../../lib/authStore';
import ReactMarkdown from 'react-markdown';

const API_BASE = 'https://sguardai.khcho0421.workers.dev';

const formatTime = (ts) => {
  if (!ts) return '';
  const d = new Date(typeof ts === 'string' && !ts.includes('T') ? ts.replace(' ', 'T') : ts);
  return isNaN(d) ? '' : d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
};

export default function MobileChat({ user }) {
  const { incidentId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [incidentInfo, setIncidentInfo] = useState(null);
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
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const normId = String(incidentId).replace('INC-', '');

    Promise.all([
      fetch(`${API_BASE}/sms/${normId}`, { headers: getAuthHeaders() }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${API_BASE}/warroom/chat/${normId}`, { headers: getAuthHeaders() }).then(r => r.ok ? r.json() : { messages: [] }).catch(() => ({ messages: [] })),
    ]).then(([inc, chat]) => {
      if (!isMounted.current) return;
      setIncidentInfo(inc);

      const history = (chat.messages || []).map(m => ({
        id: m.id || m.seq || Math.random().toString(36),
        role: m.sender === user?.employee_id ? 'user' : (m.type === 'ai_analysis' ? 'assistant' : 'other'),
        sender: m.sender_name || m.sender,
        content: m.text || m.content || '',
        ts: m.timestamp,
      }));
      setMessages(history);
    }).catch(console.error)
      .finally(() => { if (isMounted.current) setLoading(false); });

    return () => { isMounted.current = false; };
  }, [incidentId, user]);

  // WebSocket 연결
  useEffect(() => {
    if (!incidentId || !user?.employee_id) return;
    const normId = String(incidentId).replace('INC-', '');

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
                if (prev.some(m => m.id === data.msg_id)) return prev;
                return [...prev, {
                  id: data.msg_id || Date.now(),
                  role: data.sender === user.employee_id ? 'user' : 'other',
                  sender: data.sender_name || data.sender,
                  content: data.text,
                  ts: data.timestamp,
                }];
              });
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

    // 📱 Page Visibility API: Tell the DO when user leaves/returns
    // This allows the DO to detect who is "offline" for push notifications
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
      if (wsRef.current) wsRef.current.close();
    };
  }, [incidentId, user]);

  // 스크롤 하단 유지
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // textarea 자동 높이
  const adjustHeight = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  };

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || sending || !incidentId) return;
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      alert('연결이 끊어졌습니다. 잠시 후 다시 시도해 주세요.');
      return;
    }
    const normId = String(incidentId).replace('INC-', '');
    setSending(true);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    // 로컬에 즉시 표시
    const tempMsg = {
      id: `local_${Date.now()}`,
      role: 'user',
      sender: user?.name || '나',
      content: text,
      ts: new Date().toISOString(),
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
      const token = getAccessToken();
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
  }, [input, sending, incidentId, user]);

  // STT
  const toggleSTT = () => {
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('이 브라우저는 음성 인식을 지원하지 않습니다.'); return; }
    const rec = new SR();
    rec.lang = 'ko-KR'; rec.interimResults = true; rec.continuous = false;
    rec.onstart = () => setIsListening(true);
    rec.onresult = (e) => {
      const t = Array.from(e.results).map(r => r[0].transcript).join('');
      setInput(t);
    };
    rec.onend = () => setIsListening(false);
    rec.onerror = () => setIsListening(false);
    recognitionRef.current = rec;
    rec.start();
  };

  return (
    <div className="flex flex-col bg-[#0a0e17] overflow-hidden" style={{ height: '100dvh' }}>

      {/* 헤더 */}
      <header className="flex items-center gap-3 px-4 py-3 bg-[#0d1117]/95 backdrop-blur-md border-b border-white/5 shrink-0"
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
        <div className="flex items-center gap-1.5 shrink-0">
          {isConnected
            ? <><div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" /><span className="text-[10px] text-green-400 font-mono">LIVE</span></>
            : <><WifiOff className="w-3.5 h-3.5 text-red-400" /><span className="text-[10px] text-red-400 font-mono">재연결 중</span></>
          }
        </div>
      </header>

      {/* 인시던트 배너 */}
      {incidentInfo?.message && (
        <div className="bg-red-900/10 border-b border-red-500/15 px-4 py-2 shrink-0 flex items-center gap-3">
          <p className="text-[11px] text-red-400/80 flex-1 truncate">{incidentInfo.message}</p>
          <span className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full font-bold shrink-0">ACTIVE</span>
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
              msg.role === 'user' ? 'bg-blue-600/30 border border-blue-500/30 text-blue-300'
              : msg.role === 'assistant' ? 'bg-[#1e2535] border border-white/10 text-slate-300'
              : 'bg-slate-700/40 border border-white/10 text-slate-400'
            }`}>
              {msg.role === 'user' ? (user?.name?.[0] || 'U') : msg.role === 'assistant' ? <Bot className="w-4 h-4" /> : (msg.sender?.[0] || '?')}
            </div>
            <div className={`max-w-[78%] flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              {msg.role === 'other' && (
                <span className="text-[10px] text-slate-500 px-1 font-medium">{msg.sender}</span>
              )}
              <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-tr-md'
                  : msg.role === 'assistant'
                  ? 'bg-[#131927] border border-white/5 text-slate-200 rounded-tl-md'
                  : 'bg-slate-700/40 border border-white/5 text-slate-300 rounded-tl-md'
              }`}>
                {msg.role === 'assistant'
                  ? <div className="prose prose-invert prose-sm max-w-none prose-p:my-1"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                  : <p className="whitespace-pre-wrap">{msg.content}</p>
                }
              </div>
              <span className="text-[10px] text-slate-600 px-1">{formatTime(msg.ts)}</span>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* 입력 영역 */}
      <div className="bg-[#0d1117]/95 backdrop-blur-md border-t border-white/10 px-4 py-3 shrink-0"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 80px)' }}>
        <div className="flex items-end gap-2">
          <button onClick={toggleSTT} className={`p-3 rounded-2xl transition-all shrink-0 ${
            isListening ? 'bg-red-500/30 border border-red-500/40 text-red-400' : 'bg-white/5 border border-white/10 text-slate-500'
          }`}>
            {isListening ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <div className="flex-1 bg-[#1a2035] border border-white/10 rounded-2xl flex items-end overflow-hidden">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => { setInput(e.target.value); adjustHeight(); }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder={isConnected ? '메시지를 입력하세요...' : '연결 중...'}
              rows={1}
              disabled={!isConnected}
              className="flex-1 bg-transparent px-4 py-3 text-sm text-white placeholder:text-slate-600 resize-none focus:outline-none leading-relaxed disabled:opacity-50"
              style={{ maxHeight: '120px' }}
            />
          </div>
          <button id="mobile-chat-send" onClick={sendMessage} disabled={sending || !input.trim() || !isConnected}
            className="w-12 h-12 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed rounded-2xl flex items-center justify-center transition-all active:scale-90 shrink-0">
            {sending ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Send className="w-4 h-4 text-white" />}
          </button>
        </div>
        {isListening && (
          <div className="flex items-center gap-2 mt-2 px-1">
            <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            <span className="text-xs text-red-400">음성 인식 중...</span>
          </div>
        )}
      </div>
    </div>
  );
}
