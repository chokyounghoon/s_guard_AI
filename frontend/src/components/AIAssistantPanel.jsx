import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Bot, Send, X, Star, Zap, FileText, AlertTriangle, MessageSquare, Menu, Plus, Trash2, History, ChevronRight, ChevronDown } from 'lucide-react';
import AIChatBubble from './AIChatBubble';
import AIThinkingIndicator from './AIThinkingIndicator';
import ServerStatusChart from './chat/ServerStatusChart';

// API URL helper: /ai/ endpoints go to local FastAPI, others to Cloudflare Worker
const getApiUrl = (endpoint) => {
  const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (isLocalDev && endpoint.startsWith('/ai/')) {
    return `http://127.0.0.1:8000${endpoint}`;
  }
  return 'https://sguardai.khcho0421.workers.dev' + endpoint;
};

// 한국 시간(KST) 포맷팅 헬퍼
const formatKst = (dateInput) => {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return dateInput;

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');

  return `${yyyy}년 ${mm}월 ${dd}일 ${hh}:${min}:${ss}`;
};

export default function AIAssistantPanel({ isOpen, onClose, incidentId, userProfile, onShareToTeam }) {
  // Session History States
  const [chatSessions, setChatSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [expandedSessionIds, setExpandedSessionIds] = useState(new Set());

  const toggleSessionExpand = (e, id) => {
    e.stopPropagation();
    setExpandedSessionIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Existing UI States
  const [aiMessages, setAiMessages] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  
  const aiAbortRef = useRef(null);
  const aiTypingTimerRef = useRef(null);
  const aiQueueRef = useRef('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [aiMessages, isAiThinking]);

  // 1. 초기 렌더링 시 로컬 스토리지에서 세션 불러오기
  useEffect(() => {
    const fetchSessions = async () => {
      const userId = userProfile?.employee_id || 'anonymous';
      try {
        const res = await fetch(getApiUrl(`/api/v1/user/chat-sessions/${userId}`));
        if (res.ok) {
          const data = await res.json();
          if (data.sessions && data.sessions.length > 0) {
            const restored = data.sessions.map(s => ({
              ...s,
              messages: s.messages.map(m => ({ ...m, timestamp: new Date(m.timestamp) }))
            }));
            setChatSessions(restored);
            setActiveSessionId(restored[0].id);
            setAiMessages(restored[0].messages || []);
            return;
          }
        }
      } catch(e) {
        console.error("Failed to fetch sessions from DB", e);
      }
      createNewSession();
    };
    fetchSessions();
  }, [userProfile]);

  // 2. 새로운 채팅 세션 생성
  const createNewSession = () => {
    const newId = Date.now().toString();
    const newSession = {
      id: newId,
      title: '새로운 채팅',
      messages: [],
      updatedAt: new Date().toISOString()
    };
    
    // 이전에 빈 세션이 맨 위에 있는데 또 새 채팅을 누르면 그걸 재사용
    setChatSessions(prev => {
      if (prev.length > 0 && prev[0].title === '새로운 채팅' && prev[0].messages.length === 0) {
        setActiveSessionId(prev[0].id);
        setAiMessages([]);
        return prev;
      }
      setActiveSessionId(newId);
      setAiMessages([]);
      return [newSession, ...prev];
    });
    setIsSidebarOpen(false);
  };

  // 3. 특정 세션 선택 (전환)
  const switchSession = (id) => {
    const session = chatSessions.find(s => s.id === id);
    if (session) {
      setActiveSessionId(id);
      setAiMessages(session.messages || []);
      setIsSidebarOpen(false);
      // Abort any ongoing stream
      if (aiAbortRef.current) aiAbortRef.current.abort();
      stopAiTypewriter();
      setIsAiThinking(false);
    }
  };

  // 4. 세션 삭제
  const deleteSession = (e, id) => {
    e.stopPropagation(); // 카드 클릭 스위치 방지
    fetch(getApiUrl(`/api/v1/user/chat-sessions/${id}`), { method: 'DELETE' }).catch(console.error);
    setChatSessions(prev => {
      const filtered = prev.filter(s => s.id !== id);
      // 삭제하는 세션이 현재 활성 상태면 첫번째로 전환, 없으면 새거 생성
      if (activeSessionId === id) {
        if (filtered.length > 0) {
          setActiveSessionId(filtered[0].id);
          setAiMessages(filtered[0].messages);
        } else {
          // 비동기 타이핑 안전을 위한 약간의 편법 (타이밍 이슈 방지)
          setTimeout(() => createNewSession(), 0);
        }
      }
      return filtered;
    });
  };

  // 5. aiMessages 배열이 바뀔 때마다 chatSessions 동기화 및 DB 저장
  useEffect(() => {
    if (activeSessionId && aiMessages !== null) {
      setChatSessions(prev => {
        const next = prev.map(s => {
          if (s.id === activeSessionId) {
            let newTitle = s.title;
            // 첫 메시지가 왔고 제목이 아직 초기값인 경우 타이틀 뽑아내기
            if (newTitle === '새로운 채팅' && aiMessages.length > 0) {
              const firstUserMsg = aiMessages.find(m => m.type === 'user');
              if (firstUserMsg) {
                newTitle = firstUserMsg.text.slice(0, 20) + (firstUserMsg.text.length > 20 ? '...' : '');
              }
            }
            return { ...s, messages: aiMessages, title: newTitle, updatedAt: new Date().toISOString() };
          }
          return s;
        });

        // 비동기로 DB에 Session Upsert 요청
        const updatedSession = next.find(s => s.id === activeSessionId);
        if (updatedSession) {
          fetch(getApiUrl('/api/v1/user/chat-sessions'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
               id: updatedSession.id,
               user_id: userProfile?.employee_id || 'anonymous',
               title: updatedSession.title,
               messages: updatedSession.messages,
               updated_at: updatedSession.updatedAt
            })
          }).catch(console.error);
        }
        return next;
      });
    }
  }, [aiMessages, activeSessionId, userProfile]);


  const stopAiTypewriter = () => {
    if (aiTypingTimerRef.current) {
      clearInterval(aiTypingTimerRef.current);
      aiTypingTimerRef.current = null;
    }
    aiQueueRef.current = '';
  };

  const quickActions = [
    { id: 'error', label: '이 에러 원인 분석해줘', icon: AlertTriangle },
    { id: 'history', label: '유사 장애 이력 찾아줘', icon: FileText },
    { id: 'action', label: '조치 방법 추천해줘', icon: Zap }
  ];

  const handleAIMessage = async (message, hiddenPrompt = "", contextObj = null) => {
    if (!message.trim()) return;

    let activeContext = contextObj;
    if (!activeContext) {
      try {
        const saved = localStorage.getItem('sguard_current_incident');
        if (saved) activeContext = JSON.parse(saved);
      } catch(e) {}
    }

    let contextPrompt = "";
    if (activeContext) {
      contextPrompt = `\n\n[참고: 현재 대응 중인 장애 현황 - ID: ${activeContext.id}, 시스템: ${activeContext.title}, 내역: ${activeContext.message}]`;
    }

    const userMessage = { type: 'user', text: message, context: activeContext, timestamp: new Date() };
    setAiMessages(prev => [...prev, userMessage]);
    setUserInput('');
    setIsAiThinking(true);

    try {
      if (aiAbortRef.current) aiAbortRef.current.abort();
      const controller = new AbortController();
      aiAbortRef.current = controller;

      stopAiTypewriter();

      const aiMsgId = Date.now() + Math.random();
      setAiMessages(prev => [...prev, { id: aiMsgId, type: 'ai', text: '', timestamp: new Date() }]);

      const apiResponse = await fetch(getApiUrl('/ai/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: message + hiddenPrompt + contextPrompt, incident_id: incidentId }),
        signal: controller.signal,
      });
      
      if (!apiResponse.ok || !apiResponse.body) throw new Error(`API Error: ${apiResponse.status}`);

      const reader = apiResponse.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const enqueue = (text) => {
        if (!text) return;
        aiQueueRef.current += text;
        if (aiTypingTimerRef.current) return;
        aiTypingTimerRef.current = setInterval(() => {
          if (!aiQueueRef.current.length) {
            clearInterval(aiTypingTimerRef.current);
            aiTypingTimerRef.current = null;
            return;
          }
          const ch = aiQueueRef.current[0];
          aiQueueRef.current = aiQueueRef.current.slice(1);
          setAiMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: (m.text || '') + ch } : m));
        }, 18);
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const evt of events) {
          const lines = evt.split('\n');
          for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            const dataStr = line.slice(5).trim();
            if (!dataStr) continue;
            if (dataStr === '[DONE]') return;
            try {
              const data = JSON.parse(dataStr);
              if (data.error) {
                setAiMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: '⚠️ [통신 지연 오류] 시스템 부하로 인해 응답을 완료하지 못했습니다. 다시 시도해 주세요.' } : m));
                stopAiTypewriter();
                return;
              }
              if (data.answer) enqueue(data.answer);
            } catch (e) {}
          }
        }
      }
    } catch (error) {
      console.error("Failed to connect to AI backend:", error);
      if (error.name !== 'AbortError') {
        setAiMessages(prev => [...prev, { type: 'ai', text: "⚠️ [통신 오류] 서버 연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.", timestamp: new Date() }]);
      }
    } finally {
      setIsAiThinking(false);
    }
  };

  const handleQuickAction = (action) => {
    let hiddenPrompt = "";
    if (action.id === 'error') hiddenPrompt = " (반드시 get_incident_history 도구를 사용하여 에러 원인을 분석해줘)";
    if (action.id === 'history') hiddenPrompt = " (반드시 get_incident_history 도구를 사용하여 유사 장애 이력을 찾아줘)";
    if (action.id === 'action') hiddenPrompt = " (반드시 get_incident_solutions 도구를 사용하여 조치 방법을 추천해줘)";

    let contextObj = null;
    try {
      const saved = localStorage.getItem('sguard_current_incident');
      if (saved) {
        contextObj = JSON.parse(saved);
      }
    } catch(e) {}

    handleAIMessage(action.label, hiddenPrompt, contextObj);
  };
  const handleCopyMessage = (text) => {
    navigator.clipboard.writeText(text);
    alert('메시지가 클립보드에 복사되었습니다.');
  };

  const handleShare = (text) => {
    if (onShareToTeam) {
      onShareToTeam(text);
    } else {
      alert('공유 기능을 사용할 수 없습니다.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="absolute right-0 top-0 h-full w-full max-w-md bg-[#0f1421] shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sidebar Drawer Overlayer */}
        {isSidebarOpen && (
          <div 
            className="absolute inset-0 bg-black/60 z-[60] backdrop-blur-sm transition-opacity"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
        
        {/* History Sidebar */}
        <div 
          className={`absolute top-0 left-0 h-full w-[280px] bg-[#0a0d14] border-r border-white/10 shadow-2xl z-[70] transform transition-transform duration-300 ease-in-out flex flex-col ${
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="p-4 border-b border-white/5 flex items-center justify-between bg-slate-900/30">
            <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
              <History className="w-4 h-4 text-purple-400" />
              최근 채팅 내역
            </h3>
            <button onClick={() => setIsSidebarOpen(false)} className="p-1 hover:bg-white/10 rounded-lg text-slate-500">
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="p-3">
            <button 
              onClick={createNewSession}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-purple-600/20 to-blue-600/20 hover:from-purple-600/30 hover:to-blue-600/30 border border-purple-500/20 text-purple-300 text-sm font-bold transition-all"
            >
              <Plus className="w-4 h-4" />
              새 채팅 시작
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-1">
            {chatSessions.map(session => (
              <div 
                key={session.id}
                onClick={() => switchSession(session.id)}
                className={`relative group flex flex-col px-3 py-3 rounded-xl cursor-pointer transition-all ${
                  activeSessionId === session.id 
                    ? 'bg-purple-900/40 border border-purple-500/30' 
                    : 'hover:bg-white/5 border border-transparent'
                }`}
              >
                <div className="flex items-start w-full">
                  <button 
                    onClick={(e) => toggleSessionExpand(e, session.id)} 
                    className={`mr-2 mt-0.5 opacity-50 hover:opacity-100 flex-shrink-0 transition-transform ${expandedSessionIds.has(session.id) ? 'rotate-180' : ''}`}
                  >
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  </button>
                  <div className="flex-1 min-w-0 pr-6">
                    <p className={`text-xs font-medium ${expandedSessionIds.has(session.id) ? 'break-words whitespace-pre-wrap leading-relaxed' : 'truncate'} ${
                      activeSessionId === session.id ? 'text-purple-300' : 'text-slate-300'
                    }`}>
                      {session.title || '새로운 채팅'}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {formatKst(session.updatedAt).split(' ')[1]} {formatKst(session.updatedAt).split(' ')[2]}
                    </p>
                  </div>
                </div>

                {expandedSessionIds.has(session.id) && session.messages && session.messages.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
                    {/* 장애 컨텍스트 (첫 메시지에 존재할 경우) */}
                    {session.messages[0].context && (
                      <div className="pl-6 mb-2">
                        <div className="bg-slate-900/60 border border-slate-700/50 rounded-lg p-2.5">
                          <p className="text-[11px] font-bold text-blue-300 mb-1.5 border-b border-slate-700/50 pb-1.5">
                            [{session.messages[0].context.id}] {session.messages[0].context.title}
                          </p>
                          <div className="text-[10px] text-slate-400 font-mono whitespace-pre-wrap break-words max-h-48 overflow-y-auto pr-1">
                            {session.messages[0].context.message}
                          </div>
                        </div>
                      </div>
                    )}

                    {session.messages.slice(0, 3).map((m, i) => (
                      <div key={i} className="text-[10px] text-slate-400 pl-6 flex items-start">
                        <span className={`font-bold mr-1 flex-shrink-0 ${m.type === 'user' ? 'text-blue-400' : 'text-purple-400'}`}>
                          {m.type === 'user' ? 'Q:' : 'A:'}
                        </span>
                        <span className="line-clamp-2 break-words">
                          {m.text || (m.type === 'ai' && '...')}
                        </span>
                      </div>
                    ))}
                    {session.messages.length > 3 && (
                      <p className="text-[9px] text-slate-500 text-center pt-2 border-t border-white/5 mt-2">+ {session.messages.length - 3}개의 메시지</p>
                    )}
                  </div>
                )}

                <button 
                  onClick={(e) => deleteSession(e, session.id)}
                  className={`absolute right-2 top-3 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/20 hover:text-red-400 ${
                    activeSessionId === session.id ? 'text-purple-400 opacity-100' : 'text-slate-500'
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {chatSessions.length === 0 && (
              <div className="text-center py-10 opacity-30">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 text-slate-500" />
                <p className="text-xs text-slate-500">대화 내역이 없습니다</p>
              </div>
            )}
          </div>
        </div>

        {/* Panel Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-gradient-to-r from-purple-900/20 to-blue-900/20 relative">
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 border border-white/10 hover:bg-white/10 rounded-xl transition-colors bg-slate-900/50"
            >
              <Menu className="w-5 h-5 text-slate-300" />
            </button>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white">AI Assistant</h3>
              <p className="text-[10px] text-slate-400">S-Autopilot 실시간 분석</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Chat UI Section */}
        <div className="p-4 space-y-3 border-b border-white/5 bg-[#0a0d14] sticky top-0 z-10 shadow-sm shadow-[#0a0d14]/50">
              <p className="text-xs text-slate-400">💡 빠른 질문</p>
              <div className="grid grid-cols-2 gap-2">
                {quickActions.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => handleQuickAction(action)}
                    className="flex items-center space-x-2 p-3 bg-gradient-to-br from-slate-800/60 to-slate-900/60 hover:from-purple-900/30 hover:to-blue-900/30 border border-white/5 hover:border-purple-500/30 rounded-xl text-left transition-all group"
                  >
                    <action.icon className="w-4 h-4 text-purple-400 group-hover:text-purple-300 flex-shrink-0" />
                    <span className="text-[11px] text-slate-300 leading-tight">{action.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {aiMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600/20 to-blue-600/20 flex items-center justify-center border border-purple-500/20">
                    <Bot className="w-8 h-8 text-purple-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white mb-1">새로운 대화를 시작하세요</h4>
                    <p className="text-xs text-slate-400 leading-relaxed max-w-xs">
                      현재 에러 증상이나 궁금한 점을<br/>물어보시면 과거 장애 이력을 토대로 답변해 드립니다!
                    </p>
                  </div>
                </div>
              )}

              {aiMessages.map((msg, index) => (
                <div key={index}>
                  {msg.type === 'user' ? (
                    <div className="flex flex-col items-end space-y-1">
                      <div className="bg-blue-600 rounded-2xl rounded-tr-none px-4 py-3 max-w-[85%] text-sm leading-relaxed shadow-lg shadow-blue-900/20 whitespace-pre-wrap">
                        {msg.context && (
                          <div className="hidden">
                            <details className="mb-3 bg-blue-900/40 border border-blue-400/20 rounded-xl overflow-hidden group cursor-pointer text-left shadow-inner">
                              <summary className="flex items-center space-x-2 text-[11px] font-semibold text-blue-100 p-2.5 outline-none hover:bg-white/5 transition-colors">
                                <FileText className="w-3.5 h-3.5 opacity-70 flex-shrink-0" />
                                <span className="truncate">[장애 컨텍스트 첨부] {msg.context.id}</span>
                                <ChevronDown className="w-3.5 h-3.5 opacity-50 ml-auto group-open:rotate-180 transition-transform flex-shrink-0" />
                              </summary>
                              <div className="p-3 pt-1.5 border-t border-blue-400/20 bg-blue-950/60 text-[10px] text-blue-100/70 font-mono overflow-auto max-h-48 whitespace-pre-wrap cursor-text">
                                <span className="text-blue-300 block mb-1">시스템: {msg.context.title}</span>
                                <span className="block border-l-2 border-blue-500/30 pl-2">{msg.context.message}</span>
                              </div>
                            </details>
                          </div>
                        )}
                        {msg.text}
                      </div>
                      <span className="text-[10px] text-slate-500">
                        {msg.timestamp.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ) : (
                    <>
                      <AIChatBubble 
                        message={msg}
                        onCopy={handleCopyMessage}
                        onShare={handleShare}
                      />
                      {msg.metrics && (
                        <div className="ml-10 max-w-[85%] mt-2 animate-fade-in-up">
                            <ServerStatusChart />
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
              {isAiThinking && <AIThinkingIndicator />}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-3 border-t border-white/10 bg-[#0a0d14]">
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAIMessage(userInput)}
                  placeholder="AI에게 질문하세요..."
                  className="flex-1 bg-slate-800/60 rounded-full py-2.5 px-4 text-sm border border-white/5 focus:outline-none focus:border-purple-500/50 transition-all placeholder:text-slate-500"
                />
                <button
                  onClick={() => handleAIMessage(userInput)}
                  disabled={!userInput.trim() || isAiThinking}
                  className="p-2.5 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white shadow-lg shadow-purple-900/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>

      </div>
    </div>
  );
}
