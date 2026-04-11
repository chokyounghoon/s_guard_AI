import React, { useState, useEffect, useRef } from 'react';
import { Brain, Activity, MessageSquare, Zap, Users, AlertTriangle, FileText, ChevronDown } from 'lucide-react';
import MarkdownViewer from './MarkdownViewer';

const getApiUrl = (endpoint) => {
  const isLocalDev = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  if (isLocalDev && (endpoint.startsWith('/ai/') || endpoint.startsWith('/db/'))) {
    return `http://127.0.0.1:8000${endpoint}`;
  }
  // Production Worker API Base
  const apiBase = 'https://sguardai.khcho0421.workers.dev';
  return `${apiBase}${endpoint}`;
};

const API_BASE_URL = getApiUrl('');

export default function AiInsightPanel({ onLogReceived, onShowDetail, selectedSms, onOpenWarRoom, onAgentContent, warRooms }) {

  const [insightData, setInsightData] = useState({
    status: 'active',
    current_log: { type: 'info', text: 'AI 엔진 연결 중...' },
    prediction_counts: { critical: 0, server: 0, security: 0, report: 0 },
    similarity_score: null,
    similarity_reason: null
  });
  const [displayedText, setDisplayedText] = useState('');
  const [isAnalyzingSms, setIsAnalyzingSms] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [isCritical, setIsCritical] = useState(false);
  const [smsAnalysisTitle, setSmsAnalysisTitle] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [insightTimestamp, setInsightTimestamp] = useState(null);
  const [lockingUser, setLockingUser] = useState(null);

  // Streaming typewriter (SSE chunk -> queue -> char-by-char)
  const typingQueueRef = useRef('');
  const typingTimerRef = useRef(null);
  const abortRef = useRef(null);
  const delayShownRef = useRef(false);

  const stopTypewriter = () => {
    if (typingTimerRef.current) {
      clearInterval(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    typingQueueRef.current = '';
  };

  const enqueueText = (text, { reset = false, onDone } = {}) => {
    if (reset) {
      stopTypewriter();
      setDisplayedText('');
    }
    if (!text) return;
    typingQueueRef.current += text;
    if (typingTimerRef.current) return;

    typingTimerRef.current = setInterval(() => {
      if (!typingQueueRef.current.length) {
        clearInterval(typingTimerRef.current);
        typingTimerRef.current = null;
        if (onDone) onDone();
        return;
      }
      const nextChar = typingQueueRef.current[0];
      typingQueueRef.current = typingQueueRef.current.slice(1);
      setDisplayedText(prev => prev + nextChar);
    }, 18);
  };

  // SMS 선택 시 분석 모드로 전환
  useEffect(() => {

    if (!selectedSms) {
      setIsAnalyzingSms(false);
      setAnalysisComplete(false);
      setIsCritical(false);
      delayShownRef.current = false;
      setInsightTimestamp(null);
      setInsightData(prev => ({ ...prev, similarity_score: null, similarity_reason: null }));
      return;
    }

    setIsAnalyzingSms(true);
    setAnalysisComplete(false);
    setIsCritical(false);
    delayShownRef.current = false;
    setInsightData(prev => ({ ...prev, similarity_score: null, similarity_reason: null }));
    setSmsAnalysisTitle(`분석 중: "${selectedSms.sender}" 발신 SMS`);

    const analyze = async () => {
      try {
        // ① Check DB cache FIRST (before aborting anything, no signal needed)
        try {
          const checkRes = await fetch(`${API_BASE_URL}/ai/insight/${selectedSms.inc_id}`);
          if (checkRes.ok) {
            const data = await checkRes.json();
            if (data.content) {
              setDisplayedText(data.content);
              const critical = data.severity === 'CRITICAL';
              setIsCritical(critical);
              setAnalysisComplete(true);
              setInsightTimestamp(data.reg_dt);
              setIsAnalyzingSms(false); // DB 캐시 로드 시 LIVE 애니메이션 비활성화
              if (onLogReceived) {
                onLogReceived({
                  title: `SMS 장애 분석: ${selectedSms.sender}`,
                  text: data.content,
                  message: data.content,
                  severity: data.severity,
                  category: data.category
                });
              }
              // 🚀 NEW: Ensure the AI War-Room Log is populated with cached data
              if (onAgentContent) {
                onAgentContent(data.content, true);
              }
              if (data.similarity_score !== undefined && data.similarity_score !== null) {
                console.log("Loading cached similarity score:", data.similarity_score);
                setInsightData(prev => ({ 
                  ...prev, 
                  similarity_score: data.similarity_score,
                  similarity_reason: data.similarity_reason 
                }));
              }
              return; // Skip Dify streaming
            }
          }
        } catch (e) {
          console.error("Check insight err:", e);
        }

        // ② No cached data → clear old text, abort previous stream, and start new one
        setDisplayedText('');
        if (abortRef.current) abortRef.current.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        const res = await fetch(`${API_BASE_URL}/ai/analyze-sms`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            sender: selectedSms.sender, 
            message: selectedSms.message,
            sms_id: selectedSms.inc_id 
          }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) throw new Error('Network response was not ok');

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let finalText = '';
        let showedWorkingHint = false;
        const startedAt = Date.now();

        const showDelayOnce = () => {
          if (delayShownRef.current) return;
          delayShownRef.current = true;
          stopTypewriter();
          setDisplayedText(prev => {
            const base = (prev || '').trimEnd();
            return (base ? base + '\n' : '');
          });
        };

        // Soft delay notice (do NOT abort; allow late answers to arrive)
        const delayNoticeId = setTimeout(() => {
          if (finalText) return;
          showDelayOnce();
        }, 20000);

        // Hard cap: eventually abort to avoid infinite hanging connections
        const hardAbortId = setTimeout(() => {
          if (finalText) return;
          showDelayOnce();
          try { controller.abort(); } catch {}
        }, 180000); // 3 minutes

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
              if (dataStr === '[DONE]') {
                const critical = isCriticalAnalysis(finalText, selectedSms.message);
                setIsCritical(critical);
                setAnalysisComplete(true);
                setIsAnalyzingSms(false); // 🚀 FIX: Unlock UI since stream finished
                
                // Save insight to DB
                try {
                  const category = getCategoryFromAnalysis(finalText, selectedSms.message);
                  const userData = JSON.parse(localStorage.getItem('sguard_user') || '{}');
                  fetch(`${API_BASE_URL}/ai/insight/save`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      incident_id: String(selectedSms.inc_id),
                      content: finalText,
                      severity: critical ? 'CRITICAL' : 'INFO',
                      category: category,
                      user_id: String(userData.inc_id || 'SYSTEM'),
                      similarity_score: insightData.similarity_score,
                      similarity_reason: insightData.similarity_reason
                    })
                  }).catch(console.error);
                } catch (e) {
                  console.error("Save insight err:", e);
                }

                if (onLogReceived) {
                  onLogReceived({
                    title: `SMS 장애 분석: ${selectedSms.sender}`,
                    text: finalText,
                    message: finalText,
                    severity: critical ? 'CRITICAL' : 'INFO',
                    category: getCategoryFromAnalysis(finalText, selectedSms.message)
                  });
                }
                if (onAgentContent) {
                  onAgentContent(finalText, true);
                }
                return;
              }
              try {
                const data = JSON.parse(dataStr);
                if (data.error) {
                  showDelayOnce();
                  return;
                }
                // keep-alive/status from backend while waiting Dify
                if ((data.status === 'connected' || data.status === 'working') && !finalText) {
                  const elapsedMs = Date.now() - startedAt;
                  if (!showedWorkingHint && elapsedMs > 2500) {
                    showedWorkingHint = true;
                    enqueueText('\n⏳ AI 분석 진행 중...\n');
                  }
                }
                if (data.similarity_score !== undefined && data.similarity_score !== null) {
                  console.log("Received streaming similarity score:", data.similarity_score);
                  setInsightData(prev => ({ 
                    ...prev, 
                    similarity_score: data.similarity_score,
                    similarity_reason: data.similarity_reason !== undefined ? data.similarity_reason : prev.similarity_reason
                  }));
                }
                if (data.answer) {
                  // if we got real content, cancel delay timers
                  try { clearTimeout(delayNoticeId); } catch {}
                  try { clearTimeout(hardAbortId); } catch {}
                  finalText += data.answer;
                  enqueueText(data.answer);
                  
                  // Push to parent for War-Room Log
                  if (onAgentContent) {
                    onAgentContent(finalText, false);
                  }
                }
              } catch (e) {}
            }
          }
        }

        clearTimeout(delayNoticeId);
        clearTimeout(hardAbortId);

        // Stream ended but no answer ever arrived → show graceful delay message.
        if (!finalText) {
          showDelayOnce();
        }
      } catch {
        setIsCritical(false);
        if (!delayShownRef.current) {
          delayShownRef.current = true;
          stopTypewriter();
          setDisplayedText(prev => {
            const base = (prev || '').trimEnd();
            return (base ? base + '\n' : '');
          });
          setAnalysisComplete(true);
        }
      } finally {
        setIsAnalyzingSms(false); // 🚀 FIX: Unlock regardless of success or failure
      }
    };

    analyze();
  }, [selectedSms]);

  const isCriticalAnalysis = (analysisText, message) => {
    const combined = ((analysisText || '') + (message || '')).toLowerCase();
    return combined.includes('critical') || combined.includes('escalation') ||
           combined.includes('에스컬레이션') || combined.includes('war-room') ||
           combined.includes('워룸') || combined.includes('db') ||
           combined.includes('데이터베이스') || combined.includes('서버 다운') ||
           combined.includes('down');
  };

  const getCategoryFromAnalysis = (analysisText, message) => {
    const combined = ((analysisText || '') + (message || '')).toLowerCase();
    if (combined.includes('security') || combined.includes('보안') || combined.includes('접속 시도') || combined.includes('로그인')) {
      return 'security';
    }
    if (combined.includes('critical') || combined.includes('긴급') || combined.includes('장애')) {
      return 'critical';
    }
    if (combined.includes('server') || combined.includes('서버') || combined.includes('cpu') || combined.includes('memory')) {
      return 'server';
    }
    return 'report';
  };

  // 기본 폴링 루프 (SMS 미선택 시)
  useEffect(() => {
    if (isAnalyzingSms) return;
    if (selectedSms) return; // SMS 선택 중엔 폴링 안함 (DB 캐시 로드 후 덮어쓰기 방지)

    let isCancelled = false;
    const startStreaming = async () => {
      if (isCancelled) return;
      stopTypewriter();
      setDisplayedText('');
      
      try {
        const response = await fetch(`${API_BASE_URL}/ai/insight`);
        if (!response.ok) throw new Error('Network response was not ok');
        
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          if (data.current_log?.text) {
            setDisplayedText(data.current_log.text);
            setAnalysisComplete(true);
            if (data.prediction_counts) {
              setInsightData(prev => ({ ...prev, prediction_counts: data.prediction_counts }));
              if (onLogReceived) onLogReceived({ type: 'info' }, data.prediction_counts);
            }
          }
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let cumulativeText = '';
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done || isCancelled) break;
          
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split('\n\n');
          buffer = events.pop() || '';

          for (const evt of events) {
            const lines = evt.split('\n');
            for (const line of lines) {
              if (!line.startsWith('data:')) continue;
              const dataStr = line.slice(5).trim();
              if (dataStr === '[DONE]') {
                setAnalysisComplete(true);
                // After completion, wait 10 seconds before starting a new stream to avoid hammer
                if (!isCancelled) setTimeout(startStreaming, 10000);
                return;
              }
              
              try {
                const data = JSON.parse(dataStr);
                
                // Metadata update (prediction counts, etc.)
                if (data.prediction_counts) {
                  setInsightData(prev => ({ ...prev, prediction_counts: data.prediction_counts }));
                  if (onLogReceived) onLogReceived({ type: 'info' }, data.prediction_counts);
                }
                
                // Streaming text update
                if (data.answer || data.current_log?.text) {
                  const newText = data.answer || data.current_log?.text;
                  cumulativeText += newText;
                  enqueueText(newText);
                }

                // Error handling
                if (data.error) {
                  enqueueText(`\n⚠️ ${data.error}\n`);
                  if (!isCancelled) setTimeout(startStreaming, 10000);
                  return;
                }
              } catch (e) {
                console.error("Error parsing stream chunk:", e);
              }
            }
          }
        }
      } catch (err) {
        console.error("Streaming error:", err);
        enqueueText("", { reset: true });


        if (!isCancelled) setTimeout(startStreaming, 7000);
      }
    };

    startStreaming();
    return () => { isCancelled = true; };
  }, [isAnalyzingSms, selectedSms]);

  // 현재 SMS incident에 이미 생성된 War-Room이 있는지 확인 (status 무관)
  const warRoomExists = warRooms && selectedSms && warRooms.some(r => 
    String(r.inc_id) === String(selectedSms.inc_id) ||
    String(r.id) === String(selectedSms.inc_id)
  );

  // Polling for War-Room Lock status
  useEffect(() => {
    if (!selectedSms || warRoomExists) {
      setLockingUser(null);
      return;
    }

    const checkLock = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/ai/warroom/lock/${selectedSms.inc_id}`);
        if (res.ok) {
          const data = await res.json();
          setLockingUser(data.locked ? data.owner : null);
        }
      } catch (e) {
        console.error("Lock check error", e);
      }
    };

    checkLock();
    const timer = setInterval(checkLock, 3000);
    return () => clearInterval(timer);
  }, [selectedSms, warRoomExists]);


  const handleOpenWarRoom = () => {
    if (onOpenWarRoom && selectedSms) {
      onOpenWarRoom(selectedSms, displayedText);
    }
  };

  const textColor = isAnalyzingSms
    ? (isCritical ? 'text-red-300' : 'text-yellow-300')
    : insightData.current_log?.type === 'insight' ? 'text-yellow-300 font-bold'
    : insightData.current_log?.type === 'warning' ? 'text-orange-400'
    : insightData.current_log?.type === 'success' ? 'text-emerald-400'
    : 'text-blue-200';

  // War-Room 개설 버튼 (분석 완료 시 표시, 이미 개설된 경우 텍스트를 변경해서 표시)
  const showWarRoomButton = analysisComplete;


  return (
    <div className={`bg-gradient-to-br from-[#1a1f2e] to-[#11141d] rounded-3xl p-6 border shadow-xl relative overflow-hidden group transition-all duration-500
      ${isAnalyzingSms && isCritical ? 'border-red-500/30' : isAnalyzingSms ? 'border-yellow-500/20' : 'border-blue-500/20'}`}>
      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

      {/* 헤더 */}
      <div className="flex items-start justify-between mb-4 relative z-10">
        <div className="flex items-center space-x-3">
          <div className={`p-2.5 rounded-xl border ${isAnalyzingSms && isCritical ? 'bg-red-500/20 border-red-500/30' : isAnalyzingSms ? 'bg-yellow-500/20 border-yellow-500/30' : 'bg-blue-600/20 border-blue-500/30'}`}>
            {isAnalyzingSms && isCritical
              ? <AlertTriangle className="w-6 h-6 text-red-400 animate-pulse" />
              : isAnalyzingSms
              ? <MessageSquare className="w-6 h-6 text-yellow-400 animate-pulse" />
              : <Brain className="w-6 h-6 text-blue-400 animate-pulse" />
            }
          </div>
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <h2 className="text-sm font-black text-white flex items-center gap-2">
              <Brain className={`w-4 h-4 ${isAnalyzingSms ? 'text-yellow-400 animate-pulse' : isCritical ? 'text-red-400' : 'text-blue-400'}`} />
              <span className="truncate">S-Autopilot Insight</span>
              <span className="relative flex h-2 w-2 flex-shrink-0">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isAnalyzingSms && isCritical ? 'bg-red-400' : isAnalyzingSms ? 'bg-yellow-400' : 'bg-blue-400'}`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isAnalyzingSms && isCritical ? 'bg-red-500' : isAnalyzingSms ? 'bg-yellow-500' : 'bg-blue-500'}`}></span>
              </span>
            </h2>
            {insightTimestamp && (
              <div className="flex flex-col items-start ml-2 border-l border-white/10 pl-3">
                <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest leading-none mb-1 opacity-60">Registered At</span>
                <span className="text-[10px] text-white font-black font-mono bg-white/10 px-2 py-0.5 rounded shadow-[0_0_10px_rgba(255,255,255,0.1)] border border-white/5 whitespace-nowrap">
                  {(() => {
                    const d = new Date(insightTimestamp);
                    const yy = String(d.getFullYear()).slice(2);
                    const mm = String(d.getMonth() + 1).padStart(2, '0');
                    const dd = String(d.getDate()).padStart(2, '0');
                    const hh = String(d.getHours()).padStart(2, '0');
                    const min = String(d.getMinutes()).padStart(2, '0');
                    const ss = String(d.getSeconds()).padStart(2, '0');
                    return `${yy}/${mm}/${dd} ${hh}:${min}:${ss}`;
                  })()}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {isAnalyzingSms && (
            <div className={`px-3 py-1.5 rounded-lg flex items-center space-x-2 border ${isCritical ? 'bg-red-500/10 border-red-500/30' : 'bg-yellow-500/10 border-yellow-500/30'}`}>
              <Zap className={`w-3 h-3 animate-pulse ${isCritical ? 'text-red-400' : 'text-yellow-400'}`} />
              <span className={`text-xs font-mono ${isCritical ? 'text-red-300' : 'text-yellow-300'}`}>
                {isCritical ? 'CRITICAL' : 'SMS 분석'}
              </span>
            </div>
          )}
          <div
            className={`px-3 py-1.5 rounded-lg flex items-center space-x-2 border transition-all duration-500 ${
              isAnalyzingSms
                ? 'bg-red-500/20 border-red-400/50 shadow-[0_0_14px_rgba(239,68,68,0.45)]'
                : 'bg-[#0f111a] border-white/5'
            }`}
          >
            <span
              className={`relative flex items-center justify-center w-2 h-2 ${isAnalyzingSms ? '' : 'opacity-40'}`}
            >
              {isAnalyzingSms && (
                <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />
              )}
              <Activity className={`relative w-3 h-3 ${isAnalyzingSms ? 'text-red-400 animate-pulse' : 'text-emerald-500'}`} />
            </span>
            <span
              className={`text-xs font-mono font-black tracking-widest ${
                isAnalyzingSms ? 'text-red-300 animate-pulse' : 'text-slate-500'
              }`}
            >
              LIVE
            </span>
          </div>
          <button 
             onClick={() => setIsCollapsed(!isCollapsed)}
             className="px-2 py-1.5 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 transition-colors text-slate-400"
          >
            <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Similarity Score Indicator - 분석 완료 시 항상 표시 (null = 0%) */}
      {analysisComplete && (() => {
        const score = insightData.similarity_score ?? 0;
        const pct = Math.min(100, score * 100);
        const color = score > 0.8 ? 'bg-emerald-500' : score > 0.6 ? 'bg-yellow-500' : score > 0 ? 'bg-orange-500' : 'bg-slate-600';
        const textColor = score > 0.8 ? 'text-emerald-400' : score > 0.6 ? 'text-yellow-400' : score > 0 ? 'text-orange-400' : 'text-slate-500';
        return (
          <div className="flex items-center space-x-4 mb-4 relative z-10 animate-in fade-in duration-700">
            <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-1000 ease-out ${color}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Similarity</span>
              <span className={`text-xs font-mono font-black ${textColor}`}>
                {pct.toFixed(1)}%
              </span>
            </div>
          </div>
        );
      })()}

      {insightData.similarity_reason && (
        <div className="mb-4 px-1 animate-in fade-in slide-in-from-left-2 duration-1000">
          <div className="flex items-start gap-2 bg-blue-500/5 border border-blue-500/10 rounded-xl p-3 shadow-inner">
            <div className="mt-0.5 bg-blue-500/20 p-1 rounded-md">
              <Zap className="w-3 h-3 text-blue-400" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-black text-blue-400/80 uppercase tracking-widest mb-0.5">Matching Rationale</p>
              <p className="text-[11px] text-slate-300 font-medium italic leading-relaxed">
                "{insightData.similarity_reason}"
              </p>
            </div>
          </div>
        </div>
      )}

      <div className={`transition-all duration-700 ease-in-out ${isCollapsed ? 'max-h-0 opacity-0 overflow-hidden' : 'max-h-[5000px] opacity-100'} -mx-2 px-2 pb-12 relative`}>
        
        {/* 장애 상세 정보 (확장 파라미터) */}
        {selectedSms && (
          <div className="mb-6 animate-in fade-in slide-in-from-top-2 duration-500">
            <div className="bg-white/5 rounded-2xl border border-white/5 overflow-hidden">
              <div className="px-4 py-2 border-b border-white/5 bg-white/5 flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">장애 상세 정보 (Detailed Incident Info)</span>
                {selectedSms.occurrence_time && (
                  <span className="text-[10px] text-blue-400 font-mono">발생: {selectedSms.occurrence_time}</span>
                )}
              </div>
              <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
                {[
                  { label: '채널', value: selectedSms.channel },
                  { label: 'IF아이디', value: selectedSms.if_id },
                  { label: '서비스명', value: selectedSms.service_name, code: selectedSms.service_code },
                  { label: '업무시스템', value: selectedSms.biz_system },
                  { label: '에러코드', value: selectedSms.error_code },
                  { label: '발생노드', value: selectedSms.occurrence_node },
                  { label: '발생건수', value: selectedSms.occurrence_count },
                ].map((f, i) => f.value && (
                  <div key={i} className="min-w-0">
                    <p className="text-[9px] text-slate-500 font-bold uppercase mb-0.5">{f.label}</p>
                    <p className="text-[10px] text-slate-200 font-mono break-all leading-tight" title={f.value}>
                      {f.value} {f.code && <span className="text-[10px] text-slate-500">({f.code})</span>}
                    </p>
                  </div>
                ))}
                
                {/* 에러 메시지 - 별도 행 */}
                {selectedSms.error_message && (
                  <div className="col-span-2 md:col-span-4 pt-2 border-t border-white/5">
                    <p className="text-[9px] text-slate-500 font-bold uppercase mb-1">상세 에러 메시지</p>
                    <p className="text-xs text-red-400/80 leading-relaxed font-mono italic">
                      "{selectedSms.error_message}"
                    </p>
                  </div>
                )}

                {/* 수신자 목록 */}
                {selectedSms.receivers && selectedSms.receivers.length > 0 && (
                  <div className="col-span-2 md:col-span-4 pt-2 border-t border-white/5">
                    <p className="text-[9px] text-slate-500 font-bold uppercase mb-1">메시지 수신자 ({selectedSms.receivers.length}명)</p>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {selectedSms.receivers.map((r, i) => (
                        <span key={i} className="text-[10px] text-slate-400 bg-white/10 px-2 py-0.5 rounded-md font-mono border border-white/5">
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 터미널 뷰 (텍스트 양에 맞게 자동 확장) */}
      <div className={`rounded-xl p-5 border text-sm flex items-start relative shadow-2xl transition-all duration-500 min-h-[150px]
        ${isAnalyzingSms && isCritical ? 'bg-[#150a0a] border-red-500/30' : isAnalyzingSms ? 'bg-[#11110a] border-yellow-500/30' : 'bg-[#0a0c12] border-blue-500/10'}`}>
        <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 via-transparent to-blue-500/5 h-full w-full pointer-events-none" />
        <div className="absolute top-0 right-0 p-2 opacity-10 pointer-events-none">
          <Brain className="w-12 h-12" />
        </div>

        <div className="w-full relative z-10">
          <div className="flex items-start space-x-3 text-slate-400 min-h-full">
            <span className={`mt-0.5 shrink-0 font-black ${isAnalyzingSms && isCritical ? 'text-red-500' : isAnalyzingSms ? 'text-yellow-500' : 'text-blue-500'}`}>❯</span>
            <div className={`leading-relaxed w-full ${textColor}`}>
              {displayedText ? (
                <MarkdownViewer text={displayedText} />
              ) : (
                <span className="text-slate-500 font-bold tracking-tight animate-pulse flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"></span>
                  AI 모델이 관련 데이터를 검색하고 해결 방안을 실시간으로 분석하고 있습니다...
                </span>
              )}
              <span className={`animate-pulse inline-block w-1.5 h-4 align-middle ml-1 ${isAnalyzingSms && isCritical ? 'bg-red-500' : isAnalyzingSms ? 'bg-yellow-500' : 'bg-blue-500'}`}></span>
            </div>
          </div>
        </div>
      </div>

      {/* War-Room 개설 버튼 */}
      {/* War-Room 개설 버튼 (항상 표시하며, 상태에 따라 disabled 처리) */}
      <div className={`mt-4 flex items-center gap-3 p-4 rounded-2xl border transition-all duration-500
        ${(!analysisComplete || isAnalyzingSms || !displayedText || displayedText.length < 30) 
          ? 'bg-slate-800/50 border-slate-700/50' 
          : isCritical 
            ? 'bg-red-500/5 border-red-500/20' 
            : 'bg-yellow-500/5 border-yellow-500/20'}`}>
        <div className={`flex-1 text-xs ${(!analysisComplete || isAnalyzingSms || !displayedText || displayedText.length < 30 || lockingUser) ? 'text-slate-400 animate-pulse' : isCritical ? 'text-red-300' : 'text-yellow-300'}`}>
          {(!analysisComplete || isAnalyzingSms || !displayedText || displayedText.length < 30)
            ? '⏳ AI 에이전트가 진단 정보를 통합 분석하고 있습니다. 분석 완료 후 개설 가능합니다...'
            : lockingUser
              ? `⚠️ ${lockingUser} 매니저가 현재 War-Room 개설 작업을 진행 중입니다...`
              : warRoomExists 
                ? '💡 해당 장애 건에 대해 이미 War-Room이 개설되어 진행 중입니다.'
                : isCritical
                  ? '⚠️ CRITICAL 장애가 감지되었습니다. 즉시 팀 전체가 참여하는 War-Room을 개설하세요.'
                  : '💡 분석이 완료되었습니다. 필요 시 War-Room을 개설하여 팀과 상황을 공유하세요.'}
        </div>
        <button
          onClick={handleOpenWarRoom}
          disabled={!analysisComplete || isAnalyzingSms || !displayedText || displayedText.length < 30 || (lockingUser && !warRoomExists)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition-all shadow-lg
            ${(!analysisComplete || isAnalyzingSms || !displayedText || displayedText.length < 30 || (lockingUser && !warRoomExists))
              ? 'bg-slate-700 text-slate-500 cursor-not-allowed shadow-none'
              : isCritical && !warRoomExists
              ? 'bg-red-500 hover:bg-red-400 text-white shadow-red-500/30 active:scale-95'
              : warRoomExists
              ? 'bg-blue-500 hover:bg-blue-400 text-white shadow-blue-500/30 active:scale-95'
              : 'bg-yellow-500 hover:bg-yellow-400 text-black shadow-yellow-500/30 active:scale-95'}`}
        >
          <Users className="w-4 h-4" />
          {lockingUser && !warRoomExists ? '다른 사용자 처리 중' : warRoomExists ? '해당 War-Room 이동' : 'War-Room 개설'}
        </button>
      </div>
      </div>

    </div>
  );
}
