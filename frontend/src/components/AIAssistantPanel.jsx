import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Bot, Send, X, Zap, FileText, TriangleAlert, MessageSquare, Plus, Trash2, History, ChevronDown, Menu } from 'lucide-react';
import AIChatBubble from './AIChatBubble';
import AIThinkingIndicator from './AIThinkingIndicator';
import { getAccessToken } from '../lib/authStore';

// 로컬에서는 Vite proxy 경유, 프로덕션은 Worker 직접
const getApiUrl = (endpoint) => {
  const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (isLocalDev) return endpoint;
  return 'https://sguardai.khcho0421.workers.dev' + endpoint;
};

const formatTime = (d) => {
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
};

export default function AIAssistantPanel({ isOpen, onClose, incidentId, userProfile, onShareToTeam }) {
  const [chatSessions, setChatSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [aiMessages, setAiMessages] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);

  // 현재 선택된 장애 컨텍스트 (localStorage 실시간 동기화)
  const [currentIncident, setCurrentIncident] = useState(null);
  const readIncident = () => {
    try { const s = localStorage.getItem('sguard_current_incident'); return s ? JSON.parse(s) : null; } catch { return null; }
  };
  useEffect(() => {
    if (!isOpen) return;
    setCurrentIncident(readIncident());
    // 대시보드에서 SMS 선택이 바뀔 때 동기화
    const onStorage = () => setCurrentIncident(readIncident());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [isOpen]);

  const aiAbortRef = useRef(null);
  const aiTypingTimerRef = useRef(null);
  const aiQueueRef = useRef('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [aiMessages, isAiThinking]);

  useEffect(() => {
    if (userProfile?.employee_id && chatSessions.length === 0) createNewSession();
  }, [userProfile?.employee_id]);

  const createNewSession = () => {
    const newId = Date.now().toString();
    const newSession = { id: newId, title: '새로운 채팅', messages: [], updatedAt: new Date().toISOString() };
    setChatSessions(prev => {
      if (prev.length > 0 && prev[0].title === '새로운 채팅' && prev[0].messages.length === 0) {
        setActiveSessionId(prev[0].id); setAiMessages([]); return prev;
      }
      setActiveSessionId(newId); setAiMessages([]);
      return [newSession, ...prev];
    });
    setIsSidebarOpen(false);
  };

  const switchSession = (id) => {
    const session = chatSessions.find(s => s.id === id);
    if (session) {
      setActiveSessionId(id); setAiMessages(session.messages || []);
      setIsSidebarOpen(false);
      if (aiAbortRef.current) aiAbortRef.current.abort();
      stopTypewriter(); setIsAiThinking(false);
    }
  };

  const deleteSession = (e, id) => {
    e.stopPropagation();
    setChatSessions(prev => {
      const filtered = prev.filter(s => s.id !== id);
      if (activeSessionId === id) {
        if (filtered.length > 0) { setActiveSessionId(filtered[0].id); setAiMessages(filtered[0].messages); }
        else setTimeout(() => createNewSession(), 0);
      }
      return filtered;
    });
  };

  useEffect(() => {
    if (activeSessionId && aiMessages !== null) {
      setChatSessions(prev => prev.map(s => {
        if (s.id !== activeSessionId) return s;
        let newTitle = s.title;
        if (newTitle === '새로운 채팅' && aiMessages.length > 0) {
          const first = aiMessages.find(m => m.type === 'user');
          if (first) newTitle = first.text.slice(0, 20) + (first.text.length > 20 ? '…' : '');
        }
        return { ...s, messages: aiMessages, title: newTitle, updatedAt: new Date().toISOString() };
      }));
    }
  }, [aiMessages, activeSessionId]);

  const stopTypewriter = () => {
    if (aiTypingTimerRef.current) { clearInterval(aiTypingTimerRef.current); aiTypingTimerRef.current = null; }
    aiQueueRef.current = '';
  };

  const quickActions = [
    { id: 'error',   label: '에러 원인 분석',   icon: TriangleAlert, color: '#ef4444', needCtx: true },
    { id: 'history', label: '유사 장애 이력',    icon: FileText,      color: '#3b82f6', needCtx: true },
    { id: 'action',  label: '조치 방법 추천',    icon: Zap,           color: '#10b981', needCtx: true },
  ];

  const handleAIMessage = async (message, hiddenPrompt = '', contextObj = null) => {
    if (!message.trim()) return;
    let activeContext = contextObj;
    if (!activeContext) {
      try { const s = localStorage.getItem('sguard_current_incident'); if (s) activeContext = JSON.parse(s); } catch(e) {}
    }
    const contextPrompt = activeContext
      ? `\n\n[참고: 현재 대응 중인 장애 - ID: ${activeContext.id}, 시스템: ${activeContext.title}, 내역: ${activeContext.message}]`
      : '';

    const userMsg = { type: 'user', text: message, context: activeContext, timestamp: new Date() };
    setAiMessages(prev => [...prev, userMsg]);
    setUserInput(''); setIsAiThinking(true);

    try {
      if (aiAbortRef.current) aiAbortRef.current.abort();
      const controller = new AbortController();
      aiAbortRef.current = controller;
      stopTypewriter();

      const aiMsgId = Date.now() + Math.random();
      setAiMessages(prev => [...prev, { id: aiMsgId, type: 'ai', text: '', timestamp: new Date() }]);

      const token = getAccessToken();
      const res = await fetch(getApiUrl('/ai/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
        body: JSON.stringify({ query: message + hiddenPrompt + contextPrompt, incident_id: incidentId }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error(`API Error: ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const enqueue = (text) => {
        if (!text) return;
        aiQueueRef.current += text;
        if (aiTypingTimerRef.current) return;
        aiTypingTimerRef.current = setInterval(() => {
          if (!aiQueueRef.current.length) { clearInterval(aiTypingTimerRef.current); aiTypingTimerRef.current = null; return; }
          const ch = aiQueueRef.current[0];
          aiQueueRef.current = aiQueueRef.current.slice(1);
          setAiMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: (m.text || '') + ch } : m));
        }, 16);
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';
        for (const evt of events) {
          for (const line of evt.split('\n')) {
            if (!line.startsWith('data:')) continue;
            const dataStr = line.slice(5).trim();
            if (!dataStr || dataStr === '[DONE]') continue;
            try {
              const data = JSON.parse(dataStr);
              if (data.error) { setAiMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: '⚠️ 응답 오류가 발생했습니다. 다시 시도해 주세요.' } : m)); stopTypewriter(); return; }
              if (data.answer) enqueue(data.answer);
            } catch(e) {}
          }
        }
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        setAiMessages(prev => [...prev, { type: 'ai', text: '⚠️ 서버 연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.', timestamp: new Date() }]);
      }
    } finally {
      setIsAiThinking(false);
    }
  };

  const handleQuickAction = (action) => {
    const ctx = readIncident();
    if (action.needCtx && !ctx) {
      // 컨텍스트 없이 장애 분석 불가 → 안내 메시지를 채팅으로 표시
      setAiMessages(prev => [...prev, {
        type: 'ai',
        text: '⚠️ 분석할 장애를 먼저 선택해 주세요.\n\n대시보드에서 SMS 장애 항목을 클릭하면 해당 장애 정보가 여기에 연결됩니다.',
        timestamp: new Date()
      }]);
      return;
    }
    const hints = { error: ' (get_incident_history 도구로 에러 원인 분석)', history: ' (get_incident_history 도구로 유사 이력 검색)', action: ' (get_incident_solutions 도구로 조치 방법 추천)' };
    setCurrentIncident(ctx); // 클릭 시점 재동기화
    handleAIMessage(action.label, hints[action.id] || '', ctx);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[280] flex items-stretch" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* 애니메이션 keyframes 인라인 정의 */}
      <style>{`
        @keyframes ai-progress {
          0%   { transform: translateX(-100%); }
          50%  { transform: translateX(60%); }
          100% { transform: translateX(200%); }
        }
        .ai-progress-bar { animation: ai-progress 1.6s ease-in-out infinite; }
      `}</style>

      {/* Panel — full-height right drawer, 100dvh for mobile browsers */}
      <div
        className="relative ml-auto flex flex-col animate-in slide-in-from-right duration-300"
        style={{ width: '100%', maxWidth: 480, background: '#0a0d14', height: '100dvh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── History Sidebar overlay ── */}
        {isSidebarOpen && (
          <div className="absolute inset-0 z-[60] bg-black/60 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)}>
            <div
              className="absolute top-0 left-0 h-full flex flex-col"
              style={{ width: 280, background: '#0d1018', borderRight: '1px solid rgba(255,255,255,0.08)' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center gap-2">
                  <History size={14} className="text-purple-400" />
                  <span className="text-sm font-bold text-white">채팅 내역</span>
                </div>
                <button onClick={() => setIsSidebarOpen(false)} className="p-1 rounded-lg hover:bg-white/10 text-slate-500"><X size={15} /></button>
              </div>
              <div className="px-3 py-3">
                <button onClick={createNewSession}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-purple-300 transition-all"
                  style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.25)' }}>
                  <Plus size={14} /> 새 채팅
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-1 min-h-0">
                {chatSessions.map(s => (
                  <div key={s.id} onClick={() => switchSession(s.id)}
                    className="relative group flex items-center px-3 py-2.5 rounded-xl cursor-pointer transition-all"
                    style={{ background: activeSessionId === s.id ? 'rgba(168,85,247,0.15)' : 'transparent', border: `1px solid ${activeSessionId === s.id ? 'rgba(168,85,247,0.3)' : 'transparent'}` }}>
                    <MessageSquare size={12} className="text-slate-500 shrink-0 mr-2" />
                    <span className="text-xs text-slate-300 truncate flex-1">{s.title}</span>
                    <button onClick={e => deleteSession(e, s.id)} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-all shrink-0">
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
                {chatSessions.length === 0 && (
                  <div className="text-center py-8 opacity-30"><p className="text-xs text-slate-500">대화 내역이 없습니다</p></div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 py-3 shrink-0"
          style={{ background: 'rgba(168,85,247,0.06)', borderBottom: '1px solid rgba(168,85,247,0.15)', boxShadow: '0 1px 0 rgba(168,85,247,0.1)' }}>
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)}
              className="w-8 h-8 flex items-center justify-center rounded-xl transition-all"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <Menu size={15} className="text-slate-400" />
            </button>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, #a855f7, #6366f1)', boxShadow: '0 0 12px rgba(168,85,247,0.5)' }}>
              <Sparkles size={16} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-black text-white leading-none">AI Assistant</p>
              <p className="text-[9px] text-purple-400 font-bold uppercase tracking-widest mt-0.5">S-Autopilot Intelligence</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl transition-all hover:bg-white/10"
            style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
            <X size={15} className="text-slate-400" />
          </button>
        </div>

        {/* ── Context Badge / Warning ── */}
        {currentIncident ? (
          <div className="mx-4 mt-2.5 mb-0 px-3 py-2 rounded-xl shrink-0 flex items-center gap-2"
            style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" style={{ boxShadow: '0 0 6px rgba(16,185,129,0.8)' }} />
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-black uppercase tracking-widest text-emerald-400 leading-none">분석 대상 장애</p>
              <p className="text-[11px] font-bold text-white truncate mt-0.5">[{currentIncident.id}] {currentIncident.title}</p>
            </div>
          </div>
        ) : (
          <div className="mx-4 mt-2.5 mb-0 px-3 py-2 rounded-xl shrink-0 flex items-center gap-2"
            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
            <span className="text-amber-400 text-xs shrink-0">⚠️</span>
            <p className="text-[10px] font-bold text-amber-300">대시보드에서 SMS 장애를 선택하면 빠른 분석이 활성화됩니다</p>
          </div>
        )}

        {/* ── Quick Actions (horizontal scroll chips) ── */}
        <div className="px-4 py-2.5 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2">빠른 질문</p>
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {quickActions.map(action => {
              const disabled = action.needCtx && !currentIncident;
              return (
                <button key={action.id} onClick={() => handleQuickAction(action)}
                  title={disabled ? '장애를 먼저 선택해 주세요' : action.label}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full shrink-0 transition-all ${
                    disabled ? 'opacity-35 cursor-not-allowed' : 'active:scale-95 cursor-pointer'
                  }`}
                  style={{ background: `${action.color}15`, border: `1px solid ${action.color}${disabled ? '20' : '35'}`, color: action.color }}>
                  <action.icon size={11} />
                  <span className="text-[10px] font-bold whitespace-nowrap">{action.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Messages ── CRITICAL: min-h-0 prevents flex overflow */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
          {aiMessages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4 opacity-40">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.2)' }}>
                <Bot size={28} className="text-purple-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-white mb-1">AI에게 질문하세요</p>
                <p className="text-[11px] text-slate-400 leading-relaxed">장애 이력, 에러 원인, 조치 방법을<br/>실시간으로 분석해 드립니다</p>
              </div>
            </div>
          )}

          {aiMessages.map((msg, i) => (
            <div key={i}>
              {msg.type === 'user' ? (
                <div className="flex flex-col items-end gap-1">
                  <div className="max-w-[82%] px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm leading-relaxed text-white"
                    style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 4px 12px rgba(99,102,241,0.3)' }}>
                    {msg.text}
                  </div>
                  <span className="text-[9px] text-slate-600">{formatTime(msg.timestamp)}</span>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <div className="w-5 h-5 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: 'rgba(168,85,247,0.2)', border: '1px solid rgba(168,85,247,0.3)' }}>
                      <Sparkles size={10} className="text-purple-400" />
                    </div>
                    <span className="text-[9px] font-black text-purple-400 uppercase tracking-widest">AI Assistant</span>
                  </div>
                  {/* 스트리밍 중(text 비어있음)이거나 텍스트가 있으면 항상 표시 */}
                  {msg.text ? (
                    <AIChatBubble
                      message={msg}
                      query={i > 0 ? aiMessages[i - 1].text : ''}
                      incidentId={incidentId || (msg.context ? msg.context.id : null)}
                      onCopy={(text) => navigator.clipboard.writeText(text)}
                      onShare={onShareToTeam}
                    />
                  ) : (
                    /* 스트리밍 시작 직후 text='' 일 때 빈 버블 표시 */
                    <div className="max-w-[88%] px-4 py-3 rounded-2xl rounded-tl-sm text-sm text-slate-300 leading-relaxed whitespace-pre-wrap"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <span className="inline-flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}


          {isAiThinking && (
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'rgba(168,85,247,0.2)', border: '1px solid rgba(168,85,247,0.3)' }}>
                <Sparkles size={10} className="text-purple-400" />
              </div>
              <AIThinkingIndicator />
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ── Input ── pill-shaped chat style, always pinned at bottom */}
        <div className="shrink-0 px-3 pt-2 pb-3"
          style={{
            background: 'linear-gradient(to top, #0a0d14 85%, transparent)',
            paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))',
          }}>

          {/* 응답 중 진행 표시바 */}
          {isAiThinking && (
            <div className="flex items-center gap-2 mb-2 px-1">
              <div className="flex-1 h-0.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div className="ai-progress-bar h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-500"
                  style={{ width: '40%' }} />
              </div>
              <span className="text-[9px] font-black text-purple-400 uppercase tracking-widest shrink-0 animate-pulse">
                AI 응답 중...
              </span>
            </div>
          )}

          <div className="flex items-end gap-2">
            {/* pill input */}
            <div className="flex-1 flex items-center gap-2 px-4 py-2.5"
              style={{
                background: isAiThinking ? 'rgba(168,85,247,0.06)' : 'rgba(255,255,255,0.07)',
                border: `1px solid ${isAiThinking ? 'rgba(168,85,247,0.3)' : userInput.trim() ? 'rgba(168,85,247,0.45)' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 28,
                boxShadow: userInput.trim() && !isAiThinking ? '0 0 12px rgba(168,85,247,0.2), inset 0 1px 0 rgba(255,255,255,0.05)' : 'inset 0 1px 0 rgba(255,255,255,0.04)',
                transition: 'all 0.2s ease',
                minHeight: 44,
              }}>
              <input
                ref={inputRef}
                type="text"
                value={userInput}
                onChange={e => setUserInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && !isAiThinking && handleAIMessage(userInput)}
                placeholder={isAiThinking ? 'AI가 답변 중입니다...' : '메시지를 입력하세요...'}
                disabled={isAiThinking}
                className="flex-1 bg-transparent text-sm text-white placeholder:text-purple-400/50 focus:outline-none leading-relaxed disabled:cursor-not-allowed"
                style={{ caretColor: '#a855f7' }}
              />
            </div>

            {/* 처리중: 중단 버튼 / 대기중: 전송 버튼 */}
            {isAiThinking ? (
              <button
                onClick={() => { if (aiAbortRef.current) aiAbortRef.current.abort(); setIsAiThinking(false); stopTypewriter(); }}
                className="shrink-0 flex items-center justify-center transition-all active:scale-90"
                title="응답 중단"
                style={{
                  width: 44, height: 44,
                  borderRadius: '50%',
                  background: 'rgba(239,68,68,0.15)',
                  border: '1px solid rgba(239,68,68,0.4)',
                  boxShadow: '0 0 12px rgba(239,68,68,0.25)',
                }}>
                <div className="w-3.5 h-3.5 rounded-sm bg-red-400" />
              </button>
            ) : (
              <button
                onClick={() => handleAIMessage(userInput)}
                disabled={!userInput.trim()}
                className="shrink-0 flex items-center justify-center transition-all active:scale-90 disabled:opacity-30"
                style={{
                  width: 44, height: 44,
                  borderRadius: '50%',
                  background: userInput.trim()
                    ? 'linear-gradient(135deg, #a855f7, #6366f1)'
                    : 'rgba(255,255,255,0.08)',
                  border: userInput.trim() ? 'none' : '1px solid rgba(255,255,255,0.1)',
                  boxShadow: userInput.trim() ? '0 0 16px rgba(168,85,247,0.6), 0 4px 12px rgba(99,102,241,0.3)' : 'none',
                  transition: 'all 0.25s ease',
                }}>
                <Send size={16} className="text-white" style={{ transform: 'translateX(1px)' }} />
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

