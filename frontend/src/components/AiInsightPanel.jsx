import React, { useState, useEffect, useRef } from 'react';
import { Brain, Activity, MessageSquare, Zap, Users, AlertTriangle, FileText } from 'lucide-react';
import MarkdownViewer from './MarkdownViewer';

const API_BASE_URL = window.location.hostname === 'localhost'
  ? 'https://sguardai.khcho0421.workers.dev'
  : 'https://sguardai.khcho0421.workers.dev';

export default function AiInsightPanel({ onLogReceived, onShowDetail, selectedSms, onOpenWarRoom, onAgentContent, warRooms }) {

  const [insightData, setInsightData] = useState({
    status: 'active',
    current_log: { type: 'info', text: 'AI 엔진 연결 중...' }
  });
  const [displayedText, setDisplayedText] = useState('');
  const [isAnalyzingSms, setIsAnalyzingSms] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [isCritical, setIsCritical] = useState(false);
  const [smsAnalysisTitle, setSmsAnalysisTitle] = useState('');

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
      return;
    }

    setIsAnalyzingSms(true);
    setAnalysisComplete(false);
    setIsCritical(false);
    delayShownRef.current = false;
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
            return (base ? base + '\n' : '') + '선택된 SMS수신 내역이 없습니다. 내역을 선택해주세요.\n';

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
                      user_id: String(userData.inc_id || 'SYSTEM')
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
            return (base ? base + '\n' : '') + '선택된 SMS수신 내역이 없습니다. 내역을 선택해주세요.\n';

          });
          setAnalysisComplete(true);
        }
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
                if (data.answer) {
                  cumulativeText += data.answer;
                  enqueueText(data.answer);
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
        enqueueText("선택된 SMS수신 내역이 없습니다. 내역을 선택해주세요.", { reset: true });


        if (!isCancelled) setTimeout(startStreaming, 7000);
      }
    };

    startStreaming();
    return () => { isCancelled = true; };
  }, [isAnalyzingSms, selectedSms]);

  const [showReportModal, setShowReportModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

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

  // 현재 SMS incident에 이미 생성된 War-Room이 있는지 확인 (status 무관)
  const warRoomExists = warRooms && selectedSms && warRooms.some(r => 
    String(r.inc_id) === String(selectedSms.inc_id)
  );

  // War-Room 개설 버튼 (분석 완료 시 표시, 단 이미 개설된 경우는 제외)
  const showWarRoomButton = analysisComplete && !warRoomExists;


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
          <div>
            <h2 className="font-bold text-lg text-white flex items-center gap-2">
              S-Autopilot Insight
              <span className="flex h-2 w-2 relative">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isAnalyzingSms && isCritical ? 'bg-red-400' : isAnalyzingSms ? 'bg-yellow-400' : 'bg-blue-400'}`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isAnalyzingSms && isCritical ? 'bg-red-500' : isAnalyzingSms ? 'bg-yellow-500' : 'bg-blue-500'}`}></span>
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              {isAnalyzingSms ? smsAnalysisTitle : '실시간 인공지능 분석 스트림'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button 
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 transition-all text-[10px] font-bold"
            onClick={() => setShowReportModal(true)}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>관련 보고서</span>
          </button>
          <button 
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10 transition-all text-[10px] font-bold"
            onClick={() => setShowHistoryModal(true)}
          >
            <Users className="w-3.5 h-3.5" />
            <span>관련 워룸 히스토리</span>
          </button>
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
        </div>
      </div>

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
              <MarkdownViewer text={displayedText} />
              <span className={`animate-pulse inline-block w-1.5 h-4 align-middle ml-1 ${isAnalyzingSms && isCritical ? 'bg-red-500' : isAnalyzingSms ? 'bg-yellow-500' : 'bg-blue-500'}`}></span>
            </div>
          </div>
        </div>
      </div>

      {/* War-Room 개설 버튼 */}
      {showWarRoomButton && (
        <div className={`mt-4 flex items-center gap-3 p-4 rounded-2xl border animate-in fade-in slide-in-from-bottom-2 duration-500
          ${isCritical ? 'bg-red-500/5 border-red-500/20' : 'bg-yellow-500/5 border-yellow-500/20'}`}>
          <div className={`flex-1 text-xs ${isCritical ? 'text-red-300' : 'text-yellow-300'}`}>
            {isCritical
              ? '⚠️ CRITICAL 장애가 감지되었습니다. 즉시 팀 전체가 참여하는 War-Room을 개설하세요.'
              : '💡 분석이 완료되었습니다. 필요 시 War-Room을 개설하여 팀과 상황을 공유하세요.'}
          </div>
          <button
            onClick={handleOpenWarRoom}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition-all active:scale-95 shadow-lg
              ${isCritical
                ? 'bg-red-500 hover:bg-red-400 text-white shadow-red-500/30'
                : 'bg-yellow-500 hover:bg-yellow-400 text-black shadow-yellow-500/30'}`}
          >
            <Users className="w-4 h-4" />
            War-Room 개설
          </button>
        </div>
      )}


      {/* 관련 보고서 모달 리스트 (Mock) */}
      {showReportModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowReportModal(false)} />
          <div className="bg-[#1a1f2e] w-full max-w-md rounded-3xl border border-white/10 p-6 relative z-10 shadow-2xl animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-blue-400">
              <FileText className="w-5 h-5" /> 과거 관련 보고서 리스트
            </h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {[1, 2, 3].map(i => (
                <div key={i} className="p-4 bg-[#11141d] rounded-2xl border border-white/5 hover:border-blue-500/30 transition-all cursor-pointer group">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] text-slate-500 font-mono">2026.03.{10-i} 14:00</span>
                    <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20">완료</span>
                  </div>
                  <p className="text-sm font-bold text-slate-200 group-hover:text-blue-400 transition-colors">유사 장애 사례 #{i}: DB 커넥션 유실 건</p>
                  <p className="text-[11px] text-slate-500 mt-1">Dify RAG 분석 결과 관련성 92%</p>
                </div>
              ))}
            </div>
            <button className="w-full mt-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all" onClick={() => setShowReportModal(false)}>닫기</button>
          </div>
        </div>
      )}

      {/* 관련 워룸 히스토리 모달 (Mock) */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowHistoryModal(false)} />
          <div className="bg-[#1a1f2e] w-full max-w-md rounded-3xl border border-white/10 p-6 relative z-10 shadow-2xl animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-purple-400">
              <MessageSquare className="w-5 h-5" /> 과거 워룸 대화 히스토리
            </h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {[1, 2].map(i => (
                <div key={i} className="p-4 bg-[#11141d] rounded-2xl border border-white/5 hover:border-purple-500/30 transition-all cursor-pointer group">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] text-slate-500 font-mono">2026.02.{15+i} 10:30</span>
                    <span className="text-[10px] bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded border border-purple-500/20">Closed</span>
                  </div>
                  <p className="text-sm font-bold text-slate-200 group-hover:text-purple-400 transition-colors">War-Room: 시스템 연동 오류 대응 회의</p>
                  <p className="text-[11px] text-slate-500 mt-1">참여자: 김철수, 이영희 외 4명</p>
                </div>
              ))}
            </div>
            <button className="w-full mt-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-all" onClick={() => setShowHistoryModal(false)}>닫기</button>
          </div>
        </div>
      )}
    </div>
  );
}
