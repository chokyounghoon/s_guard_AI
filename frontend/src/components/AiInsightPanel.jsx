import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Brain, Activity, MessageSquare, Zap, Users, AlertTriangle, FileText, ChevronDown, RotateCcw, ThumbsUp, ThumbsDown, CheckCircle, AlertCircle, X, ChevronRight } from 'lucide-react';
import MarkdownViewer from './MarkdownViewer';
import { getAccessToken, getAuthHeaders } from '../lib/authStore';

const getApiUrl = (endpoint) => {
  // 🚀 AI 스트리밍 성능 최적화: Vite Proxy를 거치지 않고 Worker로 직접 호출합니다.
  return `https://sguardai.khcho0421.workers.dev${endpoint}`;
};

const API_BASE_URL = getApiUrl('');

const DEFAULT_THRESHOLDS = {
  critical: { errorCount: 10, errorRate: 50 },
  major:    { errorCount: 3,  errorRate: 25 },
};

// alert-monitor 3단계 판정: CRITICAL / MAJOR / NORMAL
// received_count 없거나 1이하 → 비교 대상 없음 → NORMAL(녹색)
const getSeverityLevel = (smsItem) => {
  const vol = Number(smsItem?.received_count);
  if (!vol || vol <= 1) return 'NORMAL';

  let thresholds = DEFAULT_THRESHOLDS;
  try {
    const saved = localStorage.getItem('sguard_alert_thresholds_v3');
    if (saved) {
      const parsed = JSON.parse(saved);
      thresholds = {
        critical: { ...DEFAULT_THRESHOLDS.critical, ...(parsed.critical || {}) },
        major:    { ...DEFAULT_THRESHOLDS.major,    ...(parsed.major    || {}) },
      };
    }
  } catch { /* 기본값 사용 */ }

  if (vol >= thresholds.critical.errorCount) return 'CRITICAL';
  if (vol >= thresholds.major.errorCount)    return 'MAJOR';
  return 'NORMAL';
};

// 하위 호환 wrapper
const isCriticalAnalysis = (_at, _msg, smsItem) => getSeverityLevel(smsItem) === 'CRITICAL';

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

export default function AiInsightPanel({ onLogReceived, onShowDetail, selectedSms, onOpenWarRoom, onAgentContent, warRooms, onAnalyzingChange, isOpening = false, hideWarRoomButton = false, onAnalysisComplete }) {
  
  const formatYYMMDD = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
  };

  const [insightData, setInsightData] = useState({
    status: 'active',
    current_log: { type: 'info', text: 'AI 엔진 연결 중...' },
    prediction_counts: { critical: 0, server: 0, security: 0, report: 0 },
    similarity_score: null,
    similarity_reason: null,
    vector_id: null
  });
  const [displayedText, setDisplayedText] = useState('');
  const [isAnalyzingSms, setIsAnalyzingSms] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [isCritical, setIsCritical] = useState(false);
  const [incidentCategory, setIncidentCategory] = useState('report'); // 'critical' | 'security' | 'server' | 'report'
  const [smsAnalysisTitle, setSmsAnalysisTitle] = useState('');
  const [insightTimestamp, setInsightTimestamp] = useState(null);
  const [lockingUser, setLockingUser] = useState(null);

  // Sync isAnalyzingSms state to parent if needed
  useEffect(() => {
    if (onAnalyzingChange) onAnalyzingChange(isAnalyzingSms);
  }, [isAnalyzingSms, onAnalyzingChange]);

  // Feedback States
  const [feedback, setFeedback] = useState(null); // 'UP', 'DOWN'
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [downReason, setDownReason] = useState('');
  const [showSimilaritySheet, setShowSimilaritySheet] = useState(false);
  const [correction, setCorrection] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Streaming typewriter (SSE chunk -> queue -> char-by-char)
  const typingQueueRef = useRef('');
  const typingTimerRef = useRef(null);
  const abortRef = useRef(null);
  const delayShownRef = useRef(false);
  const onLogReceivedRef = useRef(onLogReceived);
  const onAgentContentRef = useRef(onAgentContent);

  // Sync props to refs to ensure runAnalysis stays stable
  useEffect(() => {
    onLogReceivedRef.current = onLogReceived;
  }, [onLogReceived]);

  useEffect(() => {
    onAgentContentRef.current = onAgentContent;
  }, [onAgentContent]);

  const stopTypewriter = useCallback(() => {
    if (typingTimerRef.current) {
      clearInterval(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    typingQueueRef.current = '';
  }, []);

  // 🚀 Reset state when selectedSms becomes null (Incident List Cleared)
  useEffect(() => {
    if (!selectedSms) {
      setInsightData({
        status: 'active',
        current_log: { type: 'info', text: '인시던트를 선택해주세요.' },
        prediction_counts: { critical: 0, server: 0, security: 0, report: 0 },
        similarity_score: null,
        similarity_reason: null,
        vector_id: null
      });
      setDisplayedText('');
      setIsAnalyzingSms(false);
      setAnalysisComplete(false);
      setIsCritical(false);
      setSmsAnalysisTitle('');
      setInsightTimestamp(null);
      stopTypewriter();
      if (abortRef.current) abortRef.current.abort();
    }
  }, [selectedSms, stopTypewriter]);

  const enqueueText = useCallback((text, { reset = false, onDone } = {}) => {
    if (reset) {
      stopTypewriter();
      setDisplayedText('');
    }
    if (!text) return;
    typingQueueRef.current += text;
    if (typingTimerRef.current) return;

    // 모바일(좁은 화면)에서는 ReactMarkdown 잦은 렌더링으로 인한 끊김 방지 (간격 늘리고 한 번에 많이)
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const charsPerTick = isMobile ? 12 : 2; 
    const interval = isMobile ? 60 : 25;

    typingTimerRef.current = setInterval(() => {
      if (!typingQueueRef.current.length) {
        clearInterval(typingTimerRef.current);
        typingTimerRef.current = null;
        if (onDone) onDone();
        return;
      }
      const chunk = typingQueueRef.current.slice(0, charsPerTick);
      typingQueueRef.current = typingQueueRef.current.slice(charsPerTick);
      setDisplayedText(prev => prev + chunk);
    }, interval);
  }, [stopTypewriter]);

  // 🚀 Core Analysis Function (Force-able)
  const runAnalysis = useCallback(async (force = false) => {
    if (!selectedSms) return;

    setIsAnalyzingSms(true);
    setAnalysisComplete(false);
    setIsCritical(false);
    delayShownRef.current = false;
    setInsightData(prev => ({ ...prev, similarity_score: null, similarity_reason: null }));

    // 🛡️ Cancel previous request if still running
    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = new AbortController();
    
    const displaySender = selectedSms.sender === 'Manual Entry' ? 'Manual Entry' : `"${selectedSms.sender}" 발신 SMS`;
    setSmsAnalysisTitle(force ? `Manual Recovery: ${displaySender}` : `분석중입니다: ${displaySender}`);

    try {
      // ① Check DB cache FIRST (unless forced)
      if (!force) {
        try {
          const token = getAccessToken();
          const checkRes = await fetch(`${API_BASE_URL}/ai/insight/${selectedSms.inc_id}`, {
            headers: { ...getAuthHeaders() }
          });
          if (checkRes.ok) {
            const data = await checkRes.json();
            // 🛑 에러 메시지가 캐시된 경우(과거 백그라운드 분석 실패 등)는 무시하고 실시간 재분석 시도
            const errorRegex = /(AI 엔진 서버 오류|Dify 측 서버 상태|인증 오류|엔드포인트 오류|대기 시간 초과|Dify API 오류|분석 품질 향상|분석 대기|🤖|⚠️)/i;
            const isErrorMessage = data.content && errorRegex.test(data.content);

            if (data.content && !isErrorMessage) {
              // ⚡ DB 캐시 히트 — 타자기 효과 없이 즉시 전체 렌더링 (시간이 생명)
              stopTypewriter();
              setDisplayedText(data.content);
              const critical = isCriticalAnalysis(data.content, selectedSms?.message, selectedSms);
               setIsCritical(critical);
               setIncidentCategory(data.category || getCategoryFromAnalysis(data.content, selectedSms?.message));
               setAnalysisComplete(true);
               if (onAnalysisComplete) onAnalysisComplete(true, data.content);
               setInsightTimestamp(data.reg_dt);
               setIsAnalyzingSms(false);
              
               if (onLogReceivedRef.current) {
                  onLogReceivedRef.current({
                    title: `SMS 장애 분석: ${selectedSms.sender}`,
                    text: data.content,
                    message: data.content,
                    severity: data.severity,
                    category: data.category
                  });
                }
                if (onAgentContentRef.current) {
                  onAgentContentRef.current(data.content, true);
                }
               if (data.similarity_score !== undefined && data.similarity_score !== null) {
                 setInsightData(prev => ({ 
                   ...prev, 
                   similarity_score: data.similarity_score,
                   similarity_reason: data.similarity_reason 
                 }));
               }
               return; // Exit if cache found
            }
            // 에러 캐시인 경우 — 실시간 재분석으로 fallthrough (onLogReceived 호출 안 함)
            if (isErrorMessage) {
              console.log('[AiInsightPanel] Stale error cache detected — forcing live re-analysis');
            }
          }
        } catch (e) {
          console.error("Check insight err:", e);
        }
      }

      // ② No cached data (or forced) → clear old text and start streaming
      setDisplayedText('');
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const token = getAccessToken();

      const res = await fetch(`${API_BASE_URL}/ai/analyze-sms`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ 
          sender: selectedSms.sender, 
          message: selectedSms.message,
          sms_id: selectedSms.inc_id,
          force: force
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
      // Define showDelayOnce OUTSIDE try so catch can also use it
      const showDelayOnce = () => {
        if (delayShownRef.current) return;
        delayShownRef.current = true;
        stopTypewriter();
        setDisplayedText(prev => {
          const base = (prev || '').trimEnd();
          return (base ? base + '\n' : '');
        });
      };

      let lastSimilarityScore = null;
      let lastSimilarityReason = null;

      const delayNoticeId = setTimeout(() => {
        if (finalText) return;
        showDelayOnce();
      }, 20000);

      const hardAbortId = setTimeout(() => {
        if (finalText) return;
        showDelayOnce();
        try { controller.abort(); } catch {}
      }, 180000);

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
              const critical = isCriticalAnalysis(finalText, selectedSms.message, selectedSms);
              setIsCritical(critical);
              setAnalysisComplete(true);
              setIsAnalyzingSms(false);
              
              const category = getCategoryFromAnalysis(finalText, selectedSms.message);
              setIncidentCategory(category);
              const userData = JSON.parse(localStorage.getItem('sguard_user') || '{}');
              fetch(`${API_BASE_URL}/ai/insight/save`, {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json',
                  ...getAuthHeaders()
                },
                body: JSON.stringify({
                  incident_id: String(selectedSms.inc_id),
                  content: finalText,
                  severity: critical ? 'CRITICAL' : 'INFO',
                  category: category,
                  user_id: String(userData.inc_id || 'SYSTEM'),
                  similarity_score: lastSimilarityScore,
                  similarity_reason: lastSimilarityReason
                })
              }).catch(console.error);

                if (onLogReceivedRef.current) {
                  onLogReceivedRef.current({
                    title: `SMS 장애 분석: ${selectedSms.sender}`,
                    text: finalText,
                    message: finalText,
                    severity: critical ? 'CRITICAL' : 'INFO',
                    category: category
                  });
                }
                if (onAgentContentRef.current) {
                  onAgentContentRef.current(finalText, true);
                }
              if (onAnalysisComplete) onAnalysisComplete(true, finalText);
              return;
            }

            try {
              const data = JSON.parse(dataStr);
              if (data.error) {
                console.warn('[AiInsightPanel] Live analysis failed, triggering local fail-safe:', data.error);
                
                // 🚑 로컬 비상 분석 엔진 (AI 장애 시 작동)
                const localInsight = `[🛠️ 로컬 비상 분석 결과]\n\n현재 AI 엔진 연결이 불안정하여 시스템 기본 규칙에 따라 분석되었습니다.\n\n**장애 요약:** ${selectedSms.message.substring(0, 50)}...\n**조치 권고:** 발신자(${selectedSms.sender}) 정보를 바탕으로 해당 파트의 시스템 로그를 즉시 확인해 주시기 바랍니다.\n\n*정상 복구 시 AI 심층 진단이 자동으로 재시도됩니다.*`;
                
                stopTypewriter();
                setDisplayedText(localInsight);
                setIsCritical(selectedSms.message.toLowerCase().includes('critical') || selectedSms.message.includes('장애'));
                setAnalysisComplete(true);
                setIsAnalyzingSms(false);
                
                if (onLogReceivedRef.current) {
                  onLogReceivedRef.current({
                    title: `[비상] SMS 장애 분석: ${selectedSms.sender}`,
                    text: localInsight,
                    message: localInsight,
                    severity: 'MAJOR',
                    category: 'system'
                  });
                }
                return;
              }
              if (data.status === 'searching' || data.status === 'analyzing') {
                const statusMsg = data.message || (data.status === 'searching' ? '🔍 유사 장애 사례 검색 중...' : '🤖 AI 심층 진단 분석 중...');
                enqueueText(`\n${statusMsg}\n`, { reset: false });
                setSmsAnalysisTitle(statusMsg);
                continue;
              }
              if (data.similarity_score !== undefined && data.similarity_score !== null) {
                lastSimilarityScore = data.similarity_score;
                lastSimilarityReason = data.similarity_reason;
                const vectorId = data.vector_id || null;
                setInsightData(prev => ({ 
                  ...prev, 
                  similarity_score: data.similarity_score,
                  similarity_reason: data.similarity_reason || prev.similarity_reason,
                  vector_id: vectorId || prev.vector_id
                }));
              }
              if (data.answer) {
                try { clearTimeout(delayNoticeId); } catch {}
                try { clearTimeout(hardAbortId); } catch {}
                finalText += data.answer;
                enqueueText(data.answer);
                if (onAgentContentRef.current) onAgentContentRef.current(finalText, false);
              }
            } catch (e) {}
          }
        }
      }
      clearTimeout(delayNoticeId);
      clearTimeout(hardAbortId);
    } catch (err) {
        if (err.name === 'AbortError') return;
        setIsCritical(false);
        setIsAnalyzingSms(false);
        showDelayOnce();
    }
  }, [selectedSms, API_BASE_URL, enqueueText]);

  const handleFeedback = async (type, detail = null) => {
    if (!selectedSms || !displayedText) return;
    
    setFeedback(type);
    if (type === 'DOWN' && !detail) {
      setShowFeedbackModal(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const token = getAccessToken();
      const res = await fetch(`${API_BASE_URL}/ai/feedback`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          inc_id: selectedSms.inc_id,
          vector_id: insightData.vector_id,
          query: selectedSms.message,
          answer: displayedText,
          context: {
            sms: selectedSms,
            similarity: {
              score: insightData.similarity_score,
              reason: insightData.similarity_reason
            }
          },
          feedback_type: type,
          reason: detail?.reason || null,
          user_correction: detail?.correction || null,
          user_id: (() => { try { return JSON.parse(localStorage.getItem('sguard_user') || '{}').employee_id || ''; } catch { return ''; } })()
        })
      });
      if (res.ok) {
        if (type === 'UP') alert('분석 결과에 대한 긍정적인 피드백 감사합니다!');
      }
    } catch (e) {
      console.error("Insight Feedback failed", e);
    } finally {
      setIsSubmitting(false);
      setShowFeedbackModal(false);
    }
  };

  const handleManualAnalyze = () => {
    if (isAnalyzingSms) return;
    runAnalysis(true);
  };

  useEffect(() => {
    if (!selectedSms) {
      setIsAnalyzingSms(false);
      setAnalysisComplete(false);
      setIsCritical(false);
      setIncidentCategory('report');
      delayShownRef.current = false;
      setInsightTimestamp(null);
      setInsightData(prev => ({ ...prev, similarity_score: null, similarity_reason: null }));
      return;
    }
    if (onAnalysisComplete) onAnalysisComplete(false, '');
    runAnalysis(false);
  }, [selectedSms, runAnalysis, onAnalysisComplete]);



  /*
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
        const controller = new AbortController();
        const response = await fetch(`${API_BASE_URL}/ai/insight`, { 
          signal: controller.signal,
          headers: getAuthHeaders()
        });
        if (!response.ok) throw new Error('Network response was not ok');
        
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          if (data.current_log?.text) {
            enqueueText(data.current_log.text, { reset: true });
            setAnalysisComplete(true);
              if (data.prediction_counts) {
                setInsightData(prev => ({ ...prev, prediction_counts: data.prediction_counts }));
                if (onLogReceivedRef.current) onLogReceivedRef.current({ type: 'info' }, data.prediction_counts);
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
          if (done || isCancelled) {
             if (reader) reader.releaseLock();
             break;
          }
          
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
                if (!isCancelled) {
                   const timer = setTimeout(startStreaming, 10000);
                   return timer;
                }
                return;
              }
              
              try {
                const data = JSON.parse(dataStr);
                if (data.prediction_counts) {
                  setInsightData(prev => ({ ...prev, prediction_counts: data.prediction_counts }));
                  if (onLogReceived) onLogReceived({ type: 'info' }, data.prediction_counts);
                }
                if (data.answer || data.current_log?.text) {
                  const newText = data.answer || data.current_log?.text;
                  cumulativeText += newText;
                  enqueueText(newText);
                }
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
  */

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
        const res = await fetch(`${API_BASE_URL}/ai/warroom/lock/${selectedSms.inc_id}`, {
          headers: getAuthHeaders()
        });
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
    <div className={`rounded-3xl border shadow-2xl relative h-full flex flex-col transition-all duration-500
      ${isAnalyzingSms && isCritical
        ? 'bg-gradient-to-br from-[#1f1016] to-[#11141d] border-red-500/40 shadow-red-900/20'
        : selectedSms
        ? 'bg-gradient-to-br from-[#1a1b10] to-[#11141d] border-yellow-500/40 shadow-yellow-500/10'
        : 'bg-gradient-to-br from-[#141928] via-[#161c2b] to-[#0e1018] border-blue-500/20 shadow-blue-900/20'}`}>
      {/* 고정 헤더 영역 */}
      <div className="shrink-0 p-4 sm:p-5 border-b border-white/5 relative">
      <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-500/3 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none" />

      {/* 헤더 - SMS 수신내역과 동일한 구조 */}
      <div className="flex items-center justify-between gap-3 relative z-10">
        {/* 왼쪽: 아이콘 + 타이틀 */}
        <div className="flex items-center gap-3 min-w-0">
          <span className={`data-ring-wrapper shrink-0 ${isAnalyzingSms ? 'data-ring-spinning' : ''} ${isAnalyzingSms && isCritical ? 'data-ring-active' : ''}`}>
            <div className={`p-2.5 rounded-xl border ${isAnalyzingSms && isCritical ? 'bg-red-500/20 border-red-500/30' : isAnalyzingSms ? 'bg-yellow-500/20 border-yellow-500/30' : 'bg-blue-600/20 border-blue-500/30'}`}>
              {isAnalyzingSms && isCritical
                ? <AlertTriangle className="w-5 h-5 text-red-400 animate-pulse" />
                : isAnalyzingSms
                ? <MessageSquare className="w-5 h-5 text-yellow-400 animate-pulse" />
                : <Brain className="w-5 h-5 text-blue-400" />
              }
            </div>
          </span>
          <div className="min-w-0">
            <h2 className="font-black text-white text-base sm:text-lg tracking-tight">
              S-Autopilot Insight
            </h2>
            {insightTimestamp && (
              <p className="text-[9px] text-slate-500 font-mono mt-0.5 truncate">
                {(() => {
                  const d = new Date(insightTimestamp);
                  const yyyy = d.getFullYear();
                  const mm = String(d.getMonth() + 1).padStart(2, '0');
                  const dd = String(d.getDate()).padStart(2, '0');
                  const hh = String(d.getHours()).padStart(2, '0');
                  const min = String(d.getMinutes()).padStart(2, '0');
                  const ss = String(d.getSeconds()).padStart(2, '0');
                  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
                })()}
              </p>
            )}
          </div>
        </div>

        {/* 오른쪽: 분석 중 스피너만 표시 */}
        <div className="flex items-center gap-2 shrink-0">
          {isAnalyzingSms && (
            <div className="flex items-center gap-1.5 px-1.5">
              <span className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>

      {/* Similarity Score Indicator - 분석 완료 시 항상 표시 (null = 0%) */}
      {analysisComplete && (() => {
        const score = insightData.similarity_score ?? 0;
        const pct = Math.min(100, score * 100);
        const color = score > 0.8 ? 'bg-emerald-500' : score > 0.6 ? 'bg-yellow-500' : score > 0 ? 'bg-orange-500' : 'bg-slate-600';
        const textColor = score > 0.8 ? 'text-emerald-400' : score > 0.6 ? 'text-yellow-400' : score > 0 ? 'text-orange-400' : 'text-slate-500';
        const hasReason = !!insightData.similarity_reason;
        return (
          <div className="flex items-center gap-3 mb-4 relative z-10 animate-in fade-in duration-700">
            <div className="flex-1 h-2 bg-white/[0.04] rounded-full overflow-hidden shadow-inner">
              <div
                className={`h-full transition-all duration-1000 ease-out rounded-full shadow-sm ${color}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Similarity</span>
              <span
                className={`text-xs font-mono font-black ${textColor} ${hasReason ? 'underline decoration-dotted underline-offset-2 cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                onClick={hasReason ? () => setShowSimilaritySheet(true) : undefined}
                title={hasReason ? '매칭 사유 보기' : undefined}
              >
                {pct.toFixed(1)}%
              </span>
            </div>
          </div>
        );
      })()}
      </div>

      {/* Similarity Bottom Sheet */}
      {showSimilaritySheet && (
        <div
          className="fixed inset-0 z-[200] flex items-end justify-center"
          onClick={() => setShowSimilaritySheet(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" />
          {/* Sheet */}
          <div
            className="relative w-full max-w-lg bg-[#0f1624] border border-white/10 rounded-t-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
            onClick={e => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5" />

            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-xs font-black text-white uppercase tracking-widest">Similarity Matching Rationale</p>
                  <p className="text-[10px] text-slate-500 font-mono">벡터 유사도 매칭 사유</p>
                </div>
              </div>
              <button
                onClick={() => setShowSimilaritySheet(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Score */}
            {(() => {
              const score = insightData.similarity_score ?? 0;
              const pct = Math.min(100, score * 100);
              const barColor = score > 0.8 ? 'bg-emerald-500' : score > 0.6 ? 'bg-yellow-500' : 'bg-orange-500';
              const numColor = score > 0.8 ? 'text-emerald-400 bloom-green' : score > 0.6 ? 'text-yellow-400 bloom-orange' : 'text-orange-400';
              const containerExtra = score > 0.8 ? 'bloom-green-box' : score > 0.6 ? 'bloom-orange-box' : '';
              return (
                <div className={`flex items-center gap-3 mb-5 p-3 bg-white/[0.03] rounded-2xl border border-white/5 transition-all duration-700 ${containerExtra}`}>
                  <div className="flex-1">
                    <div className="flex justify-between mb-1.5">
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Vector Cosine Similarity</span>
                      <span className={`text-sm font-black font-mono ${numColor}`}>{pct.toFixed(2)}%</span>
                    </div>
                    <div className="h-2 bg-white/[0.05] rounded-full overflow-hidden">
                      <div
                        className={`h-full ${barColor} rounded-full transition-all duration-1000`}
                        style={{
                          width: `${pct}%`,
                          boxShadow: score > 0.8
                            ? '0 0 8px rgba(52,211,153,0.7), 0 0 16px rgba(52,211,153,0.35)'
                            : score > 0.6
                            ? '0 0 8px rgba(251,146,60,0.7), 0 0 16px rgba(251,146,60,0.3)'
                            : 'none'
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Reason */}
            <div className="bg-blue-500/5 border border-blue-500/15 rounded-2xl p-4">
              <p className="text-[9px] font-black text-blue-400/70 uppercase tracking-widest mb-2">AI Matching Reason</p>
              <p className="text-sm text-slate-200 leading-relaxed italic whitespace-pre-wrap">
                {insightData.similarity_reason || '사유 정보가 없습니다.'}
              </p>
            </div>

            <div className="mt-4 pb-safe">
              <button
                onClick={() => setShowSimilaritySheet(false)}
                className="w-full py-3 bg-white/5 border border-white/10 text-slate-300 rounded-2xl text-sm font-black hover:bg-white/10 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 스크롤 가능 영역 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 sm:px-6 pb-3 sm:pb-6 min-h-0">

      <div className="pb-4 relative">
        
        {/* 장애 상세 정보 (확장 파라미터) */}
        {selectedSms && (
          <div className="mb-3 animate-in fade-in slide-in-from-top-2 duration-500">
            <div className="bg-white/5 rounded-2xl border border-white/5 overflow-hidden">
              <div className="px-4 py-2 border-b border-white/5 bg-white/5 flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">장애 상세 정보 (Detailed Incident Info)</span>
                {selectedSms.occurrence_time && (
                  <span className="text-[10px] text-blue-400 font-mono">발생: {formatYYMMDD(selectedSms.occurrence_time)}</span>
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
                ].map((f, i) => (f.value !== null && f.value !== undefined && f.value !== '' && f.value !== 0 && f.value !== '0') && (
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
      <div className={`rounded-2xl p-3 sm:p-5 border text-sm flex items-start relative shadow-2xl transition-all duration-500 min-h-[150px]
        ${isAnalyzingSms && isCritical ? 'bg-[#130a0a] border-red-500/25 shadow-red-900/20' : isAnalyzingSms ? 'bg-[#111009] border-yellow-500/20 shadow-yellow-900/10' : 'bg-[#080a10] border-blue-500/10 shadow-blue-900/20'}`}>
        <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 via-transparent to-blue-500/5 h-full w-full pointer-events-none" />
        <div className="absolute top-0 right-0 p-2 opacity-10 pointer-events-none">
          <Brain className="w-12 h-12" />
        </div>

        <div className="w-full relative z-10">
          <div className={`leading-relaxed w-full ${textColor}`}>
              {displayedText ? (
                <MarkdownViewer text={(() => {
                  let t = displayedText;
                  // [전문가별 심층 진단] 이하 제거
                  const dIdx = t.indexOf('[전문가별 심층 진단]');
                  if (dIdx !== -1) t = t.substring(0, dIdx).trim();
                  // [리더의 최종 조치 가이드] 이하 제거 (Expert Advisor에서만 표시)
                  const lIdx = t.indexOf('[리더의 최종 조치 가이드]');
                  if (lIdx !== -1) t = t.substring(0, lIdx).trim();
                  
                  let finalResult = t || displayedText;
                  
                  // 지식베이스 유사도 정보가 있으면 텍스트 맨 위에 눈에 띄게 삽입
                  if (insightData.similarity_score > 0 && insightData.similarity_reason) {
                    const pct = (insightData.similarity_score * 100).toFixed(1);
                    const reason = insightData.similarity_reason.replace(/\n/g, '\n> ');
                    finalResult = `> **[ 🧠 지능형 지식베이스 매칭 (유사도 ${pct}%) ]**\n> ${reason}\n\n` + finalResult;
                  }
                  
                  return finalResult;
                })()} />
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

      {/* Feedback & War-Room Section */}
      <div className="mt-4 flex flex-col space-y-3 relative z-10">
        
        {/* Feedback Buttons (👍/👎) - 눈에 띄는 전체 너비 카드 */}
        {analysisComplete && displayedText && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-700">
            <div className={`w-full rounded-2xl border p-4 transition-all duration-500 ${
              feedback === 'UP'
                ? 'bg-blue-500/10 border-blue-500/30 shadow-lg shadow-blue-900/20'
                : feedback === 'DOWN'
                ? 'bg-red-500/10 border-red-500/30 shadow-lg shadow-red-900/20'
                : 'bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-transparent border-indigo-500/20 shadow-lg shadow-indigo-900/10'
            }`}>
              <p className={`text-[11px] font-black uppercase tracking-widest mb-3 ${
                feedback === 'UP' ? 'text-blue-400' : feedback === 'DOWN' ? 'text-red-400' : 'text-slate-400'
              }`}>
                {feedback === 'UP' ? '✅ 정확한 분석으로 평가하셨습니다' : feedback === 'DOWN' ? '📝 피드백을 제출해 주셔서 감사합니다' : '🤖 AI 분석이 정확한가요?'}
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleFeedback('UP')}
                  disabled={feedback === 'UP'}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-black text-sm transition-all active:scale-95 ${
                    feedback === 'UP'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-inner'
                      : 'bg-white/5 text-slate-300 border border-white/10 hover:bg-blue-500/15 hover:text-blue-300 hover:border-blue-500/30 hover:shadow-md'
                  }`}
                >
                  <ThumbsUp className={`w-5 h-5 ${feedback === 'UP' ? 'fill-current' : ''}`} />
                  <span>정확해요</span>
                </button>
                <button
                  onClick={() => handleFeedback('DOWN')}
                  disabled={feedback === 'DOWN' && !showFeedbackModal}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-black text-sm transition-all active:scale-95 ${
                    feedback === 'DOWN'
                      ? 'bg-red-500/20 text-red-300 border border-red-500/40 shadow-inner'
                      : 'bg-white/5 text-slate-300 border border-white/10 hover:bg-red-500/15 hover:text-red-300 hover:border-red-500/30 hover:shadow-md'
                  }`}
                >
                  <ThumbsDown className={`w-5 h-5 ${feedback === 'DOWN' ? 'fill-current' : ''}`} />
                  <span>아니에요</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 🚀 War-Room Action (Original Position Restored) */}
        {!hideWarRoomButton && analysisComplete && selectedSms && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-700 delay-150">
             {(() => {
                const sev = (selectedSms.severity || 'NORMAL').toUpperCase();
                const incidentId = String(selectedSms.inc_id || selectedSms.id || '');
                const roomExists = (warRooms || []).some(r => String(r.id) === incidentId);
                
                const btnCls = roomExists 
                  ? 'bg-blue-600/20 text-blue-400 border-blue-500/30 hover:bg-blue-600/30'
                  : sev === 'CRITICAL' ? 'bg-red-600 text-white shadow-[0_0_12px_rgba(239,68,68,0.4)] animate-pulse'
                  : sev === 'MAJOR'    ? 'bg-orange-600 text-white shadow-[0_0_10px_rgba(249,115,22,0.3)]'
                  :                      'bg-emerald-600 text-white shadow-[0_0_10px_rgba(16,185,129,0.3)]';

                return (
                  <button
                    onClick={() => onOpenWarRoom(selectedSms)}
                    disabled={isOpening}
                    className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-sm transition-all active:scale-[0.98] border border-white/10 ${btnCls} disabled:opacity-50`}
                  >
                    {isOpening ? (
                      <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Users className="w-5 h-5" />
                    )}
                    <span>
                      {isOpening ? '개설 진행 중...' : roomExists ? 'War-Room으로 이동' : 'War-Room 개설하기'}
                    </span>
                  </button>
                );
             })()}
          </div>
        )}
      </div>

      {/* Detailed Feedback Modal (Popup) */}
      {showFeedbackModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#1a1f2e] border border-white/10 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-slate-900/40">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <h3 className="text-sm font-bold text-white">무엇이 잘못되었나요?</h3>
              </div>
              <button onClick={() => setShowFeedbackModal(false)} className="text-slate-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 gap-2">
                {['정보가 오래됨', 'SMS 내역과 불일치', '관련 없는 답변', '기타 (직접 입력)'].map(reason => (
                  <button
                    key={reason}
                    onClick={() => setDownReason(reason)}
                    className={`text-left px-3 py-2.5 rounded-xl text-xs transition-all border ${downReason === reason ? 'bg-blue-600/20 border-blue-500/50 text-blue-300' : 'bg-white/5 border-transparent text-slate-400 hover:bg-white/10'}`}
                  >
                    {reason}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">교정 내용 (직접 수정)</label>
                <textarea
                  value={correction}
                  onChange={(e) => setCorrection(e.target.value)}
                  placeholder="올바른 정답이나 수정 사항을 입력해 주세요..."
                  className="w-full h-24 bg-black/20 border border-white/10 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 transition-all resize-none"
                />
              </div>

              <button
                onClick={() => handleFeedback('DOWN', { reason: downReason, correction })}
                disabled={!downReason || isSubmitting}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center space-x-2"
              >
                {isSubmitting ? <span>제출 중...</span> : (
                  <>
                    <span>인사이트 교정 제출하기</span>
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      </div>

      </div>

    </div>
  );
}
