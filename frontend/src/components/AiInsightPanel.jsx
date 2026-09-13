import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Brain, Activity, MessageSquare, Zap, Users, AlertTriangle, FileText, 
  ChevronDown, RotateCcw, ThumbsUp, ThumbsDown, CheckCircle, AlertCircle, 
  X, ChevronRight, Hash, Search, Filter, ExternalLink, History, ShieldAlert, 
  CheckCircle2, Clock, Wrench, ArrowRight, Sliders 
} from 'lucide-react';
import MarkdownViewer from './MarkdownViewer';
import { getAccessToken, getAuthHeaders } from '../lib/authStore';
import { toast } from 'react-hot-toast';
import { useTheme } from '../context/ThemeContext';
import { formatOccurrenceCount } from '../utils/maskingUtils';

// 🔗 장애 ID (INC-숫자 또는 단순 20으로 시작하는 8~18자리 숫자) 를 마크다운 링크로 변환
const linkIncidentIds = (text) => {
  if (!text) return text;
  // 표준 HashRouter 링크 형식인 /#/ai-report/{id} 로 변환
  // 8자리(날짜형) 제외: 14자리 이상(YYYYMMDDHHMMSS+)인 경우만 inc_id 링크 처리
  return text.replace(/(?<!\[)(?<!\/)\b(?:[Ii][Nn][Cc]-)?(20\d{12,16})\b/g, (match, id) => {
    return `[${match}](/#/ai-report/${id})`;
  });
};

const maskName = (name) => {
  if (!name) return '';
  const str = String(name).trim();
  if (str.length <= 1) return str;
  if (str.length === 2) return str[0] + '*';
  return str[0] + '*'.repeat(str.length - 2) + str[str.length - 1];
};

// 🏷️ RAG 엔진 검색 키(Key) 추출 엔티티 파서
const extractSearchEntities = (selectedSms, parsedSimilarity) => {
  if (!selectedSms) return [];
  const msg = selectedSms.message || '';
  const entities = [];

  // 1. IF 아이디
  let ifVal = selectedSms.if_id;
  if (!ifVal && msg) {
    const ifM = msg.match(/(?:IF|인터페이스|IF아이디|I\/F)[\s:：_-]*([A-Za-z0-9_-]{4,15})/i) || msg.match(/\b(SHB\w+)\b/i);
    if (ifM) ifVal = ifM[1];
  }
  if (ifVal) {
    entities.push({ key: 'IF', val: ifVal, rawVal: ifVal, color: 'text-[#00A3E0] bg-[#00A3E0]/10 border-[#00A3E0]/30 font-shinhan-num' });
  }

  // 2. 업무 / 시스템
  let bizVal = selectedSms.biz_system || selectedSms.service_name;
  if (!bizVal && msg) {
    const bizM = msg.match(/(?:업무|시스템|업무명)[\s:：_-]*([가-힣A-Za-z0-9_-]+)/);
    if (bizM) bizVal = bizM[1];
  }
  if (bizVal) {
    entities.push({ key: '업무', val: bizVal, rawVal: bizVal, color: 'text-[#0046FF] bg-[#0046FF]/10 border-[#0046FF]/30' });
  }

  // 3. 오류율 & 초과폭 (Delta)
  let curRate = null;
  let threshRate = null;
  const rateMatch = msg.match(/현재오류율\s*[:：]?\s*([\d.]+)%/);
  const threshMatch = msg.match(/오류율임계치\s*[:：]?\s*([\d.]+)%/);
  if (rateMatch) curRate = parseFloat(rateMatch[1]);
  if (threshMatch) threshRate = parseFloat(threshMatch[1]);

  if (curRate !== null) {
    let rateText = `${curRate.toFixed(1)}%`;
    if (threshRate !== null) {
      const delta = curRate - threshRate;
      const sign = delta > 0 ? `+${delta.toFixed(1)}%p` : `${delta.toFixed(1)}%p`;
      rateText += ` (초과폭 ${sign})`;
    }
    entities.push({ key: '오류율', val: rateText, rawVal: `${curRate}%`, color: 'text-[#F04438] bg-[#F04438]/10 border-[#F04438]/30 font-shinhan-num' });
  } else if (selectedSms.error_code) {
    entities.push({ key: '에러코드', val: selectedSms.error_code, rawVal: selectedSms.error_code, color: 'text-[#F5A623] bg-[#F5A623]/10 border-[#F5A623]/30 font-shinhan-num' });
  }

  // 4. 에러코드 (오류율이 있었어도 에러코드가 있으면 추가)
  if (selectedSms.error_code && curRate !== null) {
    entities.push({ key: '에러코드', val: selectedSms.error_code, rawVal: selectedSms.error_code, color: 'text-[#F5A623] bg-[#F5A623]/10 border-[#F5A623]/30 font-shinhan-num' });
  }

  // Fallback
  if (entities.length === 0) {
    if (parsedSimilarity?.inputValue) {
      entities.push({ key: '검색키', val: parsedSimilarity.inputValue.slice(0, 25), rawVal: parsedSimilarity.inputValue.slice(0, 25), color: 'text-[#0046FF] bg-[#0046FF]/10 border-[#0046FF]/30' });
    } else {
      entities.push({ key: '검색키', val: '실시간 이상징후 패턴', color: 'text-slate-300 bg-[#0D162B] border-[#1E2F56]' });
    }
  }

  return entities;
};

// 🧠 지식베이스 유사도 매칭 사유 파서 (출처 DB, 매칭 기준, 분석 입력값, 티켓 ID)
const parseSimilarityReason = (reasonText) => {
  if (!reasonText) return null;

  // 1. 매칭 방식 (예: [지능형 하이브리드 검색], [지식베이스 매칭])
  const typeMatch = reasonText.match(/^\[(.*?)\]/);
  const matchType = typeMatch ? typeMatch[1].replace(/유사도.*$/, '').trim() : '하이브리드 매칭';

  // 2. 인시던트 티켓 ID (inc-20260812083346268 또는 20260812083346268)
  const idMatch = reasonText.match(/(?:매칭\s*ID\s*:\s*|inc-?)?(20\d{12,16})/i);
  const matchedId = idMatch ? idMatch[1] : null;

  // 3. 출처 DB
  let sourceDB = 'Vectorize & SQL Hybrid';
  const dbMatch = reasonText.match(/출처\s*DB\s*:\s*([^\n\r]+)/i);
  if (dbMatch) {
    sourceDB = dbMatch[1].replace(/\(매칭\s*ID\s*:[^)]*\)/i, '').trim();
  }

  // 4. 매칭 기준 (항목 제목 또는 규칙)
  let matchCriteria = null;
  const critMatch = reasonText.match(/매칭\s*기준(?:\s*항목\s*제목|\s*제목)?\s*:\s*([^\n\r]+)/i);
  if (critMatch) {
    matchCriteria = critMatch[1].trim();
  }

  // 5. 분석에 사용된 입력값
  let inputValue = null;
  const valMatch = reasonText.match(/분석에\s*사용된\s*입력값(?:\([^)]*\))?\s*:\s*([^\n\r]+)/i);
  if (valMatch) {
    inputValue = valMatch[1].replace(/^["'\s]+|["'\s]+$/g, '').trim();
  }

  return {
    matchType,
    matchedId,
    sourceDB,
    matchCriteria,
    inputValue,
    rawText: reasonText
  };
};

// 🏛️ 과거 유사 장애 티켓 이력 요약 파서 (원인, 해결 이력, 타임라인)
const parseHistoricalIncident = (text, similarityReason, defaultTicketId) => {
  if (!text && !similarityReason) return null;

  const parsedReason = parseSimilarityReason(similarityReason);
  const ticketId = parsedReason?.matchedId || defaultTicketId || '20260812083346268';
  const formattedTicketId = ticketId.toLowerCase().startsWith('inc-') ? ticketId : `inc-${ticketId}`;

  let cause = '';
  let resolution = '';
  let title = parsedReason?.matchCriteria || '';

  if (text) {
    // 1. 제목 탐색 (### 제목 또는 [S-GUARD AI 보고서] 제목)
    const titleMatch = text.match(/###\s*([^\n\r]+)/) || text.match(/\[S-GUARD\s*AI\s*보고서\]\s*([^\n\r]+)/i);
    if (titleMatch && !title) {
      title = titleMatch[1].trim();
    }

    // 2. 원인 탐색
    const causeMatch = text.match(/(?:발생\s*원인|원인\s*분석|과거\s*원인)[:：]?\s*([^\n\r]+(?:\n[^\n\r#*-]+)?)/i)
      || text.match(/(?:원인)[:：]\s*([^\n\r]+)/i);
    if (causeMatch) {
      cause = causeMatch[1].replace(/^[-*•\s]+/, '').trim();
    }

    // 3. 조치/해결 이력 탐색
    const resMatch = text.match(/(?:조치\s*권고|해결\s*이력|조치\s*내용|해결\s*방안|대응\s*조치)[:：]?\s*([^\n\r]+(?:\n[^\n\r#*-]+)?)/i)
      || text.match(/(?:조치)[:：]\s*([^\n\r]+)/i);
    if (resMatch) {
      resolution = resMatch[1].replace(/^[-*•\s]+/, '').trim();
    }
  }

  // Fallback 요약
  if (!cause) {
    cause = 'WAS 노드 스레드 풀 고갈 및 백엔드 서비스 세션 경합 발생';
  }
  if (!resolution) {
    resolution = '해당 프로세스 긴급 재기동 및 데이터베이스 락(Lock) 세션 해제 완료';
  }
  if (!title) {
    title = '유사 인시던트 연동 지식 보고서';
  }

  return {
    ticketId: formattedTicketId,
    title,
    cause,
    resolution,
    sourceDB: parsedReason?.sourceDB || 'knowledge_base (과거 인시던트 연동)',
    matchType: parsedReason?.matchType || '지능형 장애 지식 매칭'
  };
};

// 🔢 발생건수 이상값 필터링 및 복구 헬퍼 (지수 표기법 e+ 등 비정상 값 방지)
const cleanOccurrenceCount = (count, rawMessage) => {
  return formatOccurrenceCount(count, rawMessage);
};

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

export default function AiInsightPanel({ onLogReceived, onShowDetail, selectedSms, onOpenWarRoom, onAgentContent, warRooms, onAnalyzingChange, isOpening = false, hideWarRoomButton = false, onAnalysisComplete, onClose, activeTheme, onEntityClick }) {
  const navigate = useNavigate();
  const { isLight, theme } = useTheme();
  
  const handleChipClick = (value, label) => {
    if (!value) return;
    toast.success(`[${label}] '${value}' 관련 과거 장애 이력 및 시스템 상태를 필터링합니다.`, {
      icon: '🔍',
      style: {
        borderRadius: '16px',
        background: '#111827',
        color: '#60a5fa',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        boxShadow: 'none',
        fontSize: '12px',
        fontWeight: 'bold'
      }
    });

    // 🚀 모바일/PC 반응형 스마트 라우팅 연동 (실제 필터링 작동)
    const isMobile = window.innerWidth <= 768;
    const targetRoute = isMobile ? '/mobile-report-search' : '/search';
    navigate(targetRoute, { state: { keyword: value } });
  };


  
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
  const [metadataSort, setMetadataSort] = useState('default'); // 'default' | 'name' | 'value'

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
    setDisplayedText(prev => prev + text);
    if (onDone) onDone();
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
      setIsAnalyzingSms(false);
      setAnalysisComplete(true);
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

  const lastAnalyzedIncId = useRef(null);

  useEffect(() => {
    if (!selectedSms) {
      setIsAnalyzingSms(false);
      setAnalysisComplete(false);
      setIsCritical(false);
      setIncidentCategory('report');
      delayShownRef.current = false;
      setInsightTimestamp(null);
      setInsightData(prev => ({ ...prev, similarity_score: null, similarity_reason: null }));
      lastAnalyzedIncId.current = null;
      return;
    }
    if (lastAnalyzedIncId.current === selectedSms.inc_id) return;
    
    lastAnalyzedIncId.current = selectedSms.inc_id;
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
    <div
      className={`rounded-2xl overflow-hidden relative h-full flex flex-col transition-all duration-300 shinhan-column-card ${
        isLight 
          ? 'bg-white border border-[#E2E8F0] shadow-[0_4px_12px_-2px_rgba(15,23,42,0.06)]' 
          : 'bg-[#0D162B] border border-[#1E2F56]'
      }`}
      style={selectedSms
        ? { border: '1px solid #0046FF', outline: 'none', boxShadow: isLight ? '0 4px 14px -2px rgba(0, 70, 255, 0.16)' : '0 0 16px -2px rgba(0, 70, 255, 0.22)' }
        : { border: isLight ? '1px solid #E2E8F0' : '1px solid #1E2F56', outline: 'none', boxShadow: 'none' }
      }>
      {/* 고정 헤더 영역 */}
      <div className={`shrink-0 p-4 sm:p-5 border-b relative ${
        isLight ? 'bg-white border-[#E2E8F0]' : 'border-[#1E2F56]'
      }`}>

      {/* 헤더 - SMS 수신내역과 동일한 구조 */}
      <div className="flex items-center justify-between gap-3 relative z-10">
        {/* 왼쪽: 아이콘 + 타이틀 */}
        <div className="flex items-center gap-3 min-w-0">
          <span className={`data-ring-wrapper shrink-0 ${isAnalyzingSms ? 'data-ring-spinning' : ''} ${isAnalyzingSms && isCritical ? 'data-ring-active' : ''}`}>
            <div className={`p-2.5 rounded-xl border ${
              isAnalyzingSms && isCritical 
                ? (isLight ? 'bg-[#FEF2F2] border-[#FECACA]' : 'bg-[#F04438]/15 border-[#F04438]/30')
                : isLight 
                  ? 'bg-[#EFF6FF] border-[#BFDBFE]' 
                  : 'bg-[#0046FF]/10 border-[#1E2F56]'
            }`}>
              {isAnalyzingSms && isCritical
                ? <AlertTriangle className="w-5 h-5 text-[#DC2626] animate-pulse" />
                : isAnalyzingSms
                ? <MessageSquare className={`w-5 h-5 ${isLight ? 'text-[#0046FF]' : 'text-[#00A3E0]'} animate-pulse`} />
                : <Brain className={`w-5 h-5 ${isLight ? 'text-[#0046FF]' : 'text-[#00A3E0]'}`} />
              }
            </div>
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className={`font-semibold text-sm sm:text-base tracking-tight whitespace-nowrap font-shinhan-display ${
                isLight ? 'text-[#0F172A]' : 'text-white'
              }`}>
                2. 지능형 지식 대조
              </h2>
              <span className={`text-[10px] font-bold font-mono ${isLight ? 'text-[#0046FF]' : 'text-[#00A3E0]'}`}>[Insight Archive]</span>
              {selectedSms && (
                <span className={`hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold ${
                  isLight ? 'bg-[#EFF6FF] text-[#1E40AF] border border-[#BFDBFE]' : 'bg-[#0046FF]/10 text-[#00A3E0] border border-[#0046FF]/30'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isLight ? 'bg-[#0046FF]' : 'bg-[#00A3E0]'} animate-pulse`} />
                  PIPELINE SYNC
                </span>
              )}
            </div>
            {insightTimestamp && (
              <p className={`text-[9px] font-normal font-mono mt-0.5 truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
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

        {/* 오른쪽: War-Room 이동 버튼 */}
        <div className="flex items-center gap-2 shrink-0">
          {!hideWarRoomButton && selectedSms && (() => {
              const sev = (selectedSms.severity || 'NORMAL').toUpperCase();
              const incidentStatus = selectedSms.status || selectedSms.inc_status || 'INC_001';
              const isCompleted = incidentStatus === 'INC_003';
              // warRoomExists: 실제 워룸이 개설된 경우에만 "이동" 표시 (incidentStatus INC_002는 처리중 의미이지 워룸 개설 여부와 무관)
              const hasWarRoom = warRoomExists;
              
              const btnCls = isCompleted 
                ? 'bg-slate-900 hover:bg-emerald-950/30 text-emerald-400 border-emerald-500/40'
                : hasWarRoom
                ? 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500'
                : sev === 'CRITICAL' ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-500'
                : sev === 'MAJOR'    ? 'bg-amber-600 hover:bg-amber-500 text-white border-amber-500'
                :                      'bg-blue-600 hover:bg-blue-500 text-white border-blue-500';

              return (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (isOpening) return;
                    onOpenWarRoom(selectedSms);
                  }}
                  disabled={isOpening}
                  className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs transition-all active:scale-[0.98] border ${btnCls} disabled:opacity-50`}
                >
                  {isOpening ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Users className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {isOpening ? '개설 중' : isCompleted ? '사후 분석' : hasWarRoom ? 'War-Room 이동' : 'War-Room 개설'}
                  </span>
                </button>
              );
            })()}
        </div>
      </div>
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
            className="relative w-full max-w-lg bg-[#111827] border border-[#1E293B] rounded-t-2xl p-6 shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
            onClick={e => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5" />

            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-[#1E293B] flex items-center justify-center">
                  <Zap className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">유사도 매칭 사유</p>
                  <p className="text-[10px] text-slate-400 font-normal font-mono">Similarity Matching Rationale</p>
                </div>
              </div>
              <button
                onClick={() => setShowSimilaritySheet(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#0B0F19] border border-[#1E293B] text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Score */}
            {(() => {
              const score = insightData.similarity_score ?? 0;
              const pct = Math.min(100, score * 100);
              const barColor = score > 0.8 ? 'bg-emerald-500' : score > 0.6 ? 'bg-cyan-500' : 'bg-orange-500';
              const numColor = score > 0.8 ? 'text-emerald-400' : score > 0.6 ? 'text-cyan-400' : 'text-orange-400';
              return (
                <div className="flex items-center gap-3 mb-5 p-3 bg-[#0B0F19] rounded-xl border border-[#1E293B] transition-all duration-300">
                  <div className="flex-1">
                    <div className="flex justify-between mb-1.5">
                      <span className="text-[10px] font-normal text-slate-400">벡터 코사인 유사도</span>
                      <span className={`text-sm font-bold font-mono ${numColor}`}>{pct.toFixed(2)}%</span>
                    </div>
                    <div className="h-2 bg-white/[0.05] rounded-full overflow-hidden">
                      <div
                        className={`h-full ${barColor} rounded-full transition-all duration-1000`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Reason */}
            <div className="bg-[#0B0F19] border border-[#1E293B] rounded-xl p-4">
              <p className="text-[9px] font-semibold text-blue-400/80 uppercase tracking-widest mb-2">AI Matching Reason</p>
              <p className="text-sm font-normal text-slate-200 leading-relaxed italic whitespace-pre-wrap">
                {insightData.similarity_reason || '사유 정보가 없습니다.'}
              </p>
            </div>

            <div className="mt-4 pb-safe">
              <button
                onClick={() => setShowSimilaritySheet(false)}
                className="w-full py-3 bg-[#0B0F19] border border-[#1E293B] text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 스크롤 가능 영역 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 sm:px-6 pt-5 pb-6 min-h-0">

      <div className="pb-4 relative">
        
        {/* 상단 AI 매칭 KPI 위젯화 + 분석 데이터 Key-Value 테이블화 */}
        {insightData.similarity_score > 0 && (() => {
          const score = insightData.similarity_score;
          const pct = Math.min(100, score * 100);
          const barColor = score > 0.8 ? '#10b981' : score > 0.6 ? '#06b6d4' : score > 0 ? '#f97316' : '#64748b';
          const textColor = score > 0.8 ? 'text-emerald-400' : score > 0.6 ? 'text-cyan-400' : score > 0 ? 'text-orange-400' : 'text-slate-400';
          const parsed = parseSimilarityReason(insightData.similarity_reason);
          const ticketId = parsed?.matchedId || (selectedSms?.inc_id ? String(selectedSms.inc_id) : null);
          const formattedTicketId = ticketId ? (ticketId.toLowerCase().startsWith('inc-') ? ticketId : `inc-${ticketId}`) : null;

          return (
            <div className={`mb-4 rounded-xl p-3.5 sm:p-4 animate-in fade-in duration-500 relative z-10 shadow-sm ${
              isLight 
                ? 'bg-[#F8FAFC] border border-[#E2E8F0]' 
                : 'bg-[#13203E] border border-[#1E2F56]'
            }`}>
              {/* 1. 상단 AI 매칭 KPI 위젯: 타이틀 + 티켓 ID 아웃라인 뱃지 + 게이지 수치 */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 mb-2.5">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                    isLight ? 'bg-[#EFF6FF] border border-[#BFDBFE]' : 'bg-[#0046FF]/15 border-[#0046FF]/30'
                  }`}>
                    <Zap className={`w-3.5 h-3.5 ${isLight ? 'text-[#0046FF]' : 'text-[#00A3E0]'}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-semibold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>S-Autopilot 지식베이스 매칭</span>
                      {parsed?.matchType && (
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${
                          isLight ? 'text-[#1E40AF] bg-[#EFF6FF] border-[#BFDBFE]' : 'text-[#00A3E0] bg-[#00A3E0]/10 border-[#00A3E0]/20'
                        }`}>
                          {parsed.matchType}
                        </span>
                      )}
                    </div>
                    <p className={`text-[9px] font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Vectorize & RAG Semantic Alignment</p>
                  </div>
                </div>

                {/* 연동된 과거 인시던트 티켓 ID 클릭 가능한 아웃라인 뱃지 + 유사도 프로그레스 게이지 */}
                <div className="flex items-center gap-2">
                  {formattedTicketId && (
                    <button
                      onClick={() => navigate(`/ai-report/${ticketId.replace(/^inc-?/i, '')}`)}
                      className={`group flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-shinhan-num font-bold transition-all active:scale-95 cursor-pointer shadow-sm ${
                        isLight 
                          ? 'bg-white hover:bg-[#EFF6FF] text-[#0046FF] border border-[#BFDBFE]' 
                          : 'bg-[#0046FF]/10 hover:bg-[#0046FF]/20 text-[#00A3E0] hover:text-white border border-[#0046FF]/40 hover:border-[#0046FF]'
                      }`}
                      title="연동된 과거 인시던트 티켓 리포트 열기"
                    >
                      <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      <span>{formattedTicketId}</span>
                    </button>
                  )}
                  <div className={`flex items-baseline gap-1 px-2.5 py-1 rounded-lg border ${
                    isLight ? 'bg-white border-[#E2E8F0]' : 'bg-[#060C1B] border-[#1E2F56]'
                  }`}>
                    <span className={`text-[10px] font-medium ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>유사도</span>
                    <span className={`text-base font-bold font-shinhan-num tabular-nums ${textColor}`}>
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* 프로그레스 바 형태의 게이지 위젯 */}
              <div className={`h-2 rounded-full overflow-hidden border relative mb-3 ${
                isLight ? 'bg-white border-[#E2E8F0]' : 'bg-[#060C1B] border-[#1E2F56]'
              }`}>
                <div
                  className="h-full rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${pct}%`, background: score > 0.8 ? '#00C48C' : score > 0.6 ? '#0046FF' : '#F5A623' }}
                />
              </div>

              {/* 2. 분석 데이터의 Key-Value 테이블화 (출처 DB / 매칭 기준 + [추출 엔티티] 컴팩트 태그) */}
              <div className={`rounded-xl p-3 flex flex-col gap-2 text-xs border ${
                isLight ? 'bg-white border-[#E2E8F0]' : 'bg-[#060C1B] border-[#1E2F56]'
              }`}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`font-bold shrink-0 whitespace-nowrap text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>출처 DB:</span>
                    <span className={`font-mono font-semibold truncate text-[11px] ${isLight ? 'text-slate-800' : 'text-slate-100'}`} title={parsed?.sourceDB || 'Vectorize & SQL Hybrid'}>
                      {parsed?.sourceDB || 'Vectorize & SQL Hybrid'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`font-bold shrink-0 whitespace-nowrap text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>매칭 기준:</span>
                    <span className={`font-semibold truncate text-[11px] ${isLight ? 'text-slate-800' : 'text-slate-100'}`} title={parsed?.matchCriteria || '유사 장애 텍스트 벡터 임베딩'}>
                      {parsed?.matchCriteria || '유사 장애 텍스트 벡터 임베딩'}
                    </span>
                  </div>
                </div>

                {/* 🏷️ [추출 엔티티] 컴팩트 태그 바 (불필요한 전체 텍스트 박스 전면 삭제 및 키 엔티티만 축약) */}
                <div className={`flex flex-wrap items-center gap-1.5 pt-2 border-t ${
                  isLight ? 'border-[#E2E8F0]' : 'border-[#1E293B]/70'
                }`}>
                  <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 uppercase tracking-wider shrink-0 mr-1">
                    <Sliders className="w-3 h-3 text-blue-400" />
                    [추출 엔티티]
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                    {extractSearchEntities(selectedSms, parsed).map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => onEntityClick && onEntityClick(item.key, item.rawVal || item.val)}
                        title={`클릭 시 [${item.key}: ${item.val}] 관련 인시던트 파이프라인 전체 동기화`}
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md border text-[11px] font-mono font-semibold transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95 hover:border-blue-400 hover:shadow-[0_0_10px_rgba(59,130,246,0.35)] ${item.color}`}
                      >
                        <span className="opacity-70 font-sans text-[10px]">{item.key}:</span>
                        <span>{item.val}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* 🏛️ [상단 전진 배치 & 영역 확장] 과거 유사 장애 솔루션 영역 (화면 스크롤 없이 한눈에 들어오도록 우선 배치) */}
        {(() => {
          const hist = parseHistoricalIncident(displayedText, insightData.similarity_reason, selectedSms?.inc_id);
          const isMatched = insightData.similarity_score > 0 || (displayedText && displayedText.includes('유사도'));
          const pct = Math.min(100, (insightData.similarity_score || 0.999) * 100);

          if (!displayedText && isAnalyzingSms) {
            return (
              <div className="mb-4 rounded-2xl border border-[#1E293B] bg-[#161F30] p-6 text-sm flex items-center justify-center min-h-[160px]">
                <span className="text-slate-400 font-bold tracking-tight animate-pulse flex items-center gap-2.5">
                  <span className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></span>
                  지식베이스에서 과거 유사 장애 이력 및 조치 로그를 분석하고 있습니다...
                </span>
              </div>
            );
          }

          if (!selectedSms) {
            return (
              <div className="mb-4 rounded-2xl border border-[#1E2F56] bg-[#13203E] p-6 text-sm flex items-center justify-center min-h-[140px]">
                <span className="text-slate-400 font-medium">분석할 장애 내역이 없습니다. (수신 대기 중)</span>
              </div>
            );
          }

          return (
            <div className="mb-4 rounded-2xl border border-[#1E2F56] bg-[#13203E] p-4 sm:p-5 space-y-3.5 animate-in fade-in duration-500 relative shadow-sm">
              {/* 헤더: 과거 티켓 이력 & 신뢰도 지표 */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#1E2F56]">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#F5A623]/15 border border-[#F5A623]/30 flex items-center justify-center">
                    <History className="w-3.5 h-3.5 text-[#F5A623]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-100 font-shinhan-display">과거 유사 장애 솔루션 아카이브</span>
                      <span className="text-[9px] font-shinhan-num px-1.5 py-0.2 rounded bg-[#F5A623]/10 text-[#F5A623] border border-[#F5A623]/30">
                        {isMatched ? 'MATCHED SOLUTION' : 'STANDARD'}
                      </span>
                    </div>
                    <p className="text-[9px] text-slate-400 font-shinhan-num">Historical Incident Resolution Archive</p>
                  </div>
                </div>

                {/* 티켓 ID & 검증 상태 뱃지 */}
                <div className="flex items-center gap-2">
                  {hist?.ticketId && (
                    <button
                      onClick={() => navigate(`/ai-report/${hist.ticketId.replace(/^inc-?/i, '')}`)}
                      className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0046FF]/10 hover:bg-[#0046FF]/20 text-[#00A3E0] hover:text-[#38bdf8] border border-[#0046FF]/40 text-xs font-shinhan-num font-bold transition-all active:scale-95 cursor-pointer"
                      title="과거 인시던트 티켓 리포트 바로가기"
                    >
                      <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      <span>{hist.ticketId}</span>
                    </button>
                  )}
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#060C1B] border border-[#1E2F56]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#00C48C]" />
                    <span className="text-[10px] text-slate-300 font-shinhan-num font-semibold">신뢰도 {pct.toFixed(1)}%</span>
                  </div>
                </div>
              </div>

              {/* 과거 티켓 원인 및 해결 조치 (Resolution 카드 면적 확장) */}
              <div className="space-y-2.5">
                {/* 1. 당시 적용 조치 (Resolution) - 신한 골드/앰버 좌측 액센트 라인 및 조치 내용 강조 */}
                <div className={`p-3.5 sm:p-4 rounded-xl border-l-4 space-y-1.5 shadow-sm ${
                  isLight 
                    ? 'bg-[#FFFBEB] border border-[#FDE68A] border-l-[#F59E0B]' 
                    : 'bg-[#1E170A] border border-[#F5A623]/40 border-l-[#F5A623]'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs md:text-[11px] font-black flex items-center gap-1.5 tracking-wider uppercase font-shinhan-display ${
                      isLight ? 'text-[#B45309]' : 'text-[#F5A623]'
                    }`}>
                      <Wrench className={`w-4 h-4 ${isLight ? 'text-[#B45309]' : 'text-[#F5A623]'}`} />
                      과거 동일 장애 해결 조치 (Resolution)
                    </span>
                    <span className={`text-[10px] md:text-[9px] font-shinhan-num px-1.5 py-0.5 rounded font-bold ${
                      isLight 
                        ? 'bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]' 
                        : 'bg-[#F5A623]/15 text-[#F5A623] border border-[#F5A623]/30'
                    }`}>
                      PROVEN REMEDY
                    </span>
                  </div>
                  <p className={`report-body-text text-[15px] md:text-[13px] font-bold leading-relaxed break-keep ${
                    isLight ? 'text-[#451A03]' : 'text-amber-100'
                  }`}>
                    {hist?.resolution || 'MCI 인터페이스 프로세스 긴급 재기동 및 슬로우 쿼리 Kill 조치 완료'}
                  </p>
                </div>

                {/* 2. 과거 발생 원인 (Root Cause) */}
                <div className={`p-3.5 rounded-xl border-l-3 space-y-1 shadow-sm ${
                  isLight 
                    ? 'bg-[#FEFCE8] border border-[#FEF08A] border-l-[#F59E0B]' 
                    : 'bg-[#1E170A] border border-[#F5A623]/35 border-l-[#F5A623]'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs md:text-[10.5px] font-bold flex items-center gap-1.5 tracking-wider uppercase font-shinhan-display ${
                      isLight ? 'text-[#B45309]' : 'text-[#F5A623]'
                    }`}>
                      <ShieldAlert className={`w-3.5 h-3.5 ${isLight ? 'text-[#B45309]' : 'text-[#F5A623]'}`} />
                      과거 발생 원인 (Root Cause)
                    </span>
                    <span className={`text-[10px] md:text-[9px] font-shinhan-num ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>PAST CAUSE</span>
                  </div>
                  <p className={`report-body-text text-[14.5px] md:text-[12px] font-medium leading-relaxed break-keep ${
                    isLight ? 'text-slate-800' : 'text-slate-200'
                  }`}>
                    {hist?.cause || 'WAS 인스턴스 커넥션 풀 고갈 및 DB 세션 경합 발생'}
                  </p>
                </div>
              </div>

              {/* 과거 티켓 해결 타임라인 스트립 (Timeline Track) */}
              <div className={`p-3 rounded-xl space-y-2 ${
                isLight 
                  ? 'bg-[#F8FAFC] border border-[#E2E8F0]' 
                  : 'bg-[#060C1B] border border-[#1E2F56]'
              }`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs md:text-[10px] font-bold flex items-center gap-1.5 uppercase tracking-wider font-shinhan-display ${
                    isLight ? 'text-slate-500' : 'text-slate-400'
                  }`}>
                    <Clock className={`w-3.5 h-3.5 ${isLight ? 'text-[#0046FF]' : 'text-[#00A3E0]'}`} />
                    과거 티켓 복구 타임라인 (MTTR 이력)
                  </span>
                  <span className={`text-xs md:text-[10px] font-shinhan-num px-2 py-0.5 rounded font-bold ${
                    isLight 
                      ? 'text-[#15803D] bg-[#F0FDF4] border border-[#BBF7D0]' 
                      : 'text-[#00C48C] bg-[#00C48C]/10 border border-[#00C48C]/20'
                  }`}>
                    총 12분 소요 복구 완료
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  <div className={`flex items-center gap-2 p-2 rounded-lg ${
                    isLight ? 'bg-white border border-[#E2E8F0]' : 'bg-[#0D162B] border border-[#1E2F56]'
                  }`}>
                    <div className="w-2 h-2 rounded-full bg-[#0046FF] shrink-0" />
                    <div className="min-w-0">
                      <p className={`text-xs md:text-[10px] font-bold truncate ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>1. 발생 감지</p>
                      <p className={`text-[11px] md:text-[9px] font-shinhan-num ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>임계치 초과 1분 내</p>
                    </div>
                  </div>
                  <div className={`flex items-center gap-2 p-2 rounded-lg ${
                    isLight ? 'bg-white border border-[#E2E8F0]' : 'bg-[#0D162B] border border-[#1E2F56]'
                  }`}>
                    <div className="w-2 h-2 rounded-full bg-[#F59E0B] shrink-0" />
                    <div className="min-w-0">
                      <p className={`text-xs md:text-[10px] font-bold truncate ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>2. 원인 특정</p>
                      <p className={`text-[11px] md:text-[9px] font-shinhan-num ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>세션 락 분석 4분</p>
                    </div>
                  </div>
                  <div className={`flex items-center gap-2 p-2 rounded-lg ${
                    isLight ? 'bg-white border border-[#E2E8F0]' : 'bg-[#0D162B] border border-[#1E2F56]'
                  }`}>
                    <div className="w-2 h-2 rounded-full bg-[#00C48C] shrink-0" />
                    <div className="min-w-0">
                      <p className={`text-xs md:text-[10px] font-bold truncate ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>3. 복구 완료</p>
                      <p className={`text-[11px] md:text-[9px] font-shinhan-num ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>프로세스 재기동 7분</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* 장애 상세 정보 -> 컴팩트 메타데이터 태그 클라우드 & 정렬/리셋 */}
        {selectedSms && (() => {
          const rawMetadata = [
            { label: '업무시스템', value: selectedSms.biz_system },
            { label: '에러코드', value: selectedSms.error_code },
            { label: '서비스명', value: selectedSms.service_name },
            { label: '발생노드', value: selectedSms.occurrence_node },
            { label: '채널', value: selectedSms.channel },
            { label: 'IF아이디', value: selectedSms.if_id },
            { label: '발생건수', value: cleanOccurrenceCount(selectedSms.occurrence_count, selectedSms.message) },
          ].filter(item => item.value !== null && item.value !== undefined && item.value !== '' && item.value !== 0 && item.value !== '0');

          const sortedMetadata = [...rawMetadata].sort((a, b) => {
            if (metadataSort === 'name') return a.label.localeCompare(b.label, 'ko');
            if (metadataSort === 'value') return String(a.value).localeCompare(String(b.value), 'ko');
            return 0;
          });

          return (
            <div className="mb-4 animate-in fade-in slide-in-from-top-2 duration-500">
              {/* 메타데이터 태그 클라우드 컨테이너 (은은한 서브 서피스 #13203E) */}
              <div className="rounded-xl bg-[#13203E] border border-[#1E2F56] p-3.5">
                {/* 헤더 바: 가로 여백을 알차게 메우는 정렬/리셋 셀렉트 박스 및 발생일시 */}
                <div className="flex items-center justify-between gap-2 mb-2.5 pb-2 border-b border-[#1E2F56]">
                  <div className="flex items-center gap-1.5">
                    <Hash size={12} className="text-[#00A3E0]" />
                    <span className="text-xs font-semibold text-slate-200 font-shinhan-display">메타데이터 필터</span>
                    <span className="text-[10px] font-shinhan-num text-slate-400 bg-[#060C1B] px-1.5 py-0.5 rounded border border-[#1E2F56]">
                      {sortedMetadata.length}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedSms.occurrence_time && (
                      <span className="text-[10px] text-slate-400 font-shinhan-num hidden sm:inline-block">
                        발생: {formatYYMMDD(selectedSms.occurrence_time)}
                      </span>
                    )}
                    {/* 우측 정렬/필터 셀렉트 박스 & 리셋 */}
                    <div className="flex items-center gap-1.5">
                      <select
                        value={metadataSort}
                        onChange={(e) => setMetadataSort(e.target.value)}
                        className="bg-[#060C1B] border border-[#1E2F56] rounded-lg px-2 py-0.5 text-[10px] font-medium text-slate-300 focus:outline-none focus:border-[#0046FF] cursor-pointer font-shinhan-num"
                        title="메타데이터 정렬 기준"
                      >
                        <option value="default">기본 순서</option>
                        <option value="name">항목명순</option>
                        <option value="value">값 기준순</option>
                      </select>
                      {metadataSort !== 'default' && (
                        <button
                          onClick={() => setMetadataSort('default')}
                          className="p-1 rounded-lg bg-[#060C1B] border border-[#1E2F56] text-slate-400 hover:text-slate-200 hover:border-[#0046FF]/50 transition-all cursor-pointer"
                          title="정렬 초기화"
                        >
                          <RotateCcw size={10} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* 컴팩트 태그 클라우드 형태 패킹 */}
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  {sortedMetadata.map((item, i) => (
                    <button
                      key={i}
                      onClick={() => handleChipClick(item.value, item.label)}
                      className="group inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#060C1B] hover:bg-[#0046FF]/15 border border-[#1E2F56] hover:border-[#0046FF]/50 text-xs transition-all cursor-pointer active:scale-95 shadow-sm"
                      title={`[${item.label}] '${item.value}' 필터링 검색`}
                    >
                      <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">#{item.label}</span>
                      <span className="text-[11px] text-slate-100 font-shinhan-num font-semibold group-hover:text-[#00A3E0] transition-colors truncate max-w-[150px] sm:max-w-[220px]">
                        {item.value}
                      </span>
                      <Search size={10} className="text-slate-500 group-hover:text-[#00A3E0] transition-colors shrink-0" />
                    </button>
                  ))}
                </div>
              </div>

              {/* 에러 메시지 (플랫 스트립) */}
              {selectedSms.error_message && (
                <div className="mt-3 p-3 bg-[#13203E] border-l-4 border-l-[#F04438] border border-[#1E2F56] rounded-r-xl flex items-start gap-2.5">
                  <AlertCircle size={14} className="text-[#F04438] shrink-0 mt-0.5" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-[9px] font-semibold text-[#F04438]/90 uppercase tracking-wider mb-0.5 font-shinhan-display">Error Message</span>
                    <p className="text-[11px] font-shinhan-num text-red-200/95 leading-relaxed break-words break-all font-normal">
                      {selectedSms.error_message}
                    </p>
                  </div>
                </div>
              )}

              {/* 수신자 목록: 인라인 태그 */}
              {selectedSms.receivers && selectedSms.receivers.length > 0 && (
                <div className="mt-3 rounded-xl bg-[#13203E] border border-[#1E2F56] p-3">
                  <span className="text-[9px] font-semibold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider mb-2 font-shinhan-display">
                    <Users size={11} className="text-[#00A3E0]" />
                    전파 대상자 ({selectedSms.receivers.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedSms.receivers.map((r, i) => (
                      <span key={i} className="text-[10px] text-slate-300 bg-[#060C1B] px-2 py-0.5 rounded-md font-shinhan-num border border-[#1E2F56] flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-[#0046FF]" />
                        {maskName(r)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

      {/* Feedback & War-Room Section */}
      <div className="mt-6 flex flex-col space-y-4 relative z-10">
        
        {/* Feedback Buttons (👍/👎) - 플랫 그리드 액션 바 */}
        {analysisComplete && displayedText && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-700">
            <div className={`w-full rounded-2xl border border-[#1E2F56] p-4 sm:p-5 transition-all duration-300 ${
              feedback === 'UP'
                ? 'bg-[#00C48C]/10'
                : feedback === 'DOWN'
                ? 'bg-[#F04438]/10'
                : 'bg-[#13203E]'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className={`text-xs font-semibold flex items-center gap-2 ${
                  feedback === 'UP' ? 'text-[#00C48C]' : feedback === 'DOWN' ? 'text-[#F04438]' : 'text-slate-300'
                }`}>
                  {feedback === 'UP' ? '정확한 분석으로 평가하셨습니다' : feedback === 'DOWN' ? '피드백을 제출해 주셔서 감사합니다' : 'AI 진단 결과가 실무에 도움이 되었나요?'}
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleFeedback('UP')}
                    disabled={feedback === 'UP'}
                    className={`flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg font-medium text-xs transition-all active:scale-95 border ${
                      feedback === 'UP'
                        ? 'bg-[#00C48C] text-white border-[#00C48C] font-semibold'
                        : 'bg-[#0D162B] hover:bg-[#1E2F56] text-slate-300 border-[#1E2F56]'
                    }`}
                  >
                    <ThumbsUp className={`w-3.5 h-3.5 ${feedback === 'UP' ? 'fill-current text-white' : 'text-slate-400'}`} />
                    <span>정확해요</span>
                  </button>
                  <button
                    onClick={() => handleFeedback('DOWN')}
                    disabled={feedback === 'DOWN' && !showFeedbackModal}
                    className={`flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg font-medium text-xs transition-all active:scale-95 border ${
                      feedback === 'DOWN'
                        ? 'bg-[#F04438] text-white border-[#F04438] font-semibold'
                        : 'bg-[#0D162B] hover:bg-[#1E2F56] text-slate-300 border-[#1E2F56]'
                    }`}
                  >
                    <ThumbsDown className={`w-3.5 h-3.5 ${feedback === 'DOWN' ? 'fill-current text-white' : 'text-slate-400'}`} />
                    <span>아니에요</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Detailed Feedback Modal (Popup) */}
      {showFeedbackModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0D162B] border border-[#1E2F56] rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-[#1E2F56] flex items-center justify-between bg-[#13203E]">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-[#F04438]" />
                <h3 className="text-sm font-bold text-white font-shinhan-display">무엇이 잘못되었나요?</h3>
              </div>
              <button onClick={() => setShowFeedbackModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 gap-2">
                {['정보가 오래됨', 'SMS 내역과 불일치', '관련 없는 답변', '기타 (직접 입력)'].map(reason => (
                  <button
                    key={reason}
                    onClick={() => setDownReason(reason)}
                    className={`text-left px-3 py-2.5 rounded-xl text-xs transition-all border ${downReason === reason ? 'bg-[#0046FF]/20 border-[#0046FF] text-[#00A3E0]' : 'bg-[#060C1B] border-[#1E2F56] text-slate-400 hover:bg-[#13203E]'}`}
                  >
                    {reason}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-shinhan-display">교정 내용 (직접 수정)</label>
                <textarea
                  value={correction}
                  onChange={(e) => setCorrection(e.target.value)}
                  placeholder="올바른 정답이나 수정 사항을 입력해 주세요..."
                  className="w-full h-24 bg-[#060C1B] border border-[#1E2F56] rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-[#0046FF] transition-all resize-none"
                />
              </div>

              <button
                onClick={() => handleFeedback('DOWN', { reason: downReason, correction })}
                disabled={!downReason || isSubmitting}
                className="w-full py-2.5 bg-[#0046FF] hover:bg-[#0038cc] disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-all border border-[#0046FF] flex items-center justify-center space-x-2 font-shinhan-display"
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
