import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { Activity, Server, AlertTriangle, CheckCircle, Clock, Search, Bell, BellDot, Cpu, Menu, User, ChevronRight, ChevronUp, Zap, Shield, Database, Sparkles, MessageSquare, Brain, MoreHorizontal, RefreshCw, Info, X, BarChart2, Hash, Users, LogIn, AlertCircle, Home, Phone, Building2, IdCard, ChevronDown, BarChart3, FileText, Settings, LogOut, ExternalLink, CheckCircle2, Filter, Lock, Eye, EyeOff, Calendar, Camera, Bot, Check, Download, Apple, SmartphoneNfc } from 'lucide-react';
import AgentDiscussionPanel from '../../components/AgentDiscussionPanel';
import EmergencyActionModal from '../../components/EmergencyActionModal';
import AiInsightPanel from '../../components/AiInsightPanel';
import WarRoomChatPanel from '../../components/WarRoomChatPanel';

import ErrorBoundary from '../../components/ErrorBoundary';
import AIInsightModal from '../../components/AIInsightModal';
import { useCodebook } from '../../context/CodebookContext';
import { getAccessToken, clearSession, getAuthHeaders, getUserProfile, getAllowedPaths, addAuthListener } from '../../lib/authStore';
import { toast } from 'react-hot-toast';

const SHINHAN_COMPANIES = [
  '신한금융지주', '신한은행', '신한카드', '신한투자증권', '신한라이프',
  '신한캐피탈', '신한자산운용', '신한저축은행', '신한AI', '신한DS',
  '제주은행', '신한벤처투자', '신한리츠운용', '신한대체투자운용',
  '신한자산신탁', '신한펀드파트너스', '신한금융플러스', '신한큐브리스크컨설팅',
];

const parseSMS = (message) => {
  if (!message) return null;
  
  let parts = [];
  if (message.includes('▶')) {
    parts = message.split('▶').map(p => p.trim()).filter(Boolean);
  } else if (message.includes('\n')) {
    parts = message.split('\n').map(p => p.trim()).filter(Boolean);
  } else {
    return null;
  }
  
  if (parts.length === 0) return null;
  
  let title = '';
  let startIndex = 0;
  
  if (!parts[0].includes(':')) {
    title = parts[0];
    startIndex = 1;
  }
  
  const items = [];
  for (let i = startIndex; i < parts.length; i++) {
    const part = parts[i];
    const colonIndex = part.indexOf(':');
    if (colonIndex !== -1) {
      const key = part.substring(0, colonIndex).trim();
      const val = part.substring(colonIndex + 1).trim();
      items.push({ key, value: val });
    } else {
      items.push({ key: part, value: '' });
    }
  }
  
  return { title, items };
};

const cleanValue = (val) => {
  if (!val) return '';
  let cleaned = val.trim();
  
  const match = cleaned.match(/^\[(.*?)\](.*)$/);
  if (match) {
    const inside = match[1].trim();
    const extra = match[2].trim();
    
    let formattedInside = inside;
    if (/^\d{8}$/.test(inside)) {
      formattedInside = `${inside.substring(0, 4)}-${inside.substring(4, 6)}-${inside.substring(6, 8)}`;
    }
    
    if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}$/.test(inside)) {
      formattedInside = inside;
    }
    
    if (extra) {
      if (extra.startsWith('%')) {
        cleaned = `${formattedInside}%`;
      } else {
        cleaned = `${formattedInside} ${extra}`;
      }
    } else {
      cleaned = formattedInside;
    }
  }
  
  return cleaned;
};

const renderFormattedSMS = (message, severity) => {
  const parsed = parseSMS(message);
  if (!parsed) {
    return (
      <p className="text-[14px] leading-relaxed font-bold break-all whitespace-pre-wrap text-[#ffffff] tracking-tight">
        {message}
      </p>
    );
  }

  const { title, items } = parsed;
  const sev = String(severity || '').toUpperCase();
  
  let headerBg = 'bg-[#00e5ff]/10 border-[#00e5ff]/20 text-[#00e5ff]';
  let bulletColor = 'bg-[#00e5ff] shadow-[0_0_8px_#00e5ff]';
  
  if (sev === 'CRITICAL') {
    headerBg = 'bg-red-500/10 border-red-500/20 text-red-400';
    bulletColor = 'bg-red-500 shadow-[0_0_8px_#ef4444]';
  } else if (sev === 'MAJOR' || sev === 'WARNING' || sev === 'HIGH') {
    headerBg = 'bg-amber-500/10 border-amber-500/20 text-amber-400';
    bulletColor = 'bg-amber-500 shadow-[0_0_8px_#f59e0b]';
  }

  return (
    <div className="flex flex-col gap-2 w-full text-slate-200">
      {title && (
        <div className={`text-[13px] font-black border px-3 py-2 rounded-xl flex items-center gap-2 mb-1 ${headerBg}`}>
          <span className={`w-2 h-2 rounded-full animate-pulse ${bulletColor}`} />
          <span>{title}</span>
        </div>
      )}
      <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden p-2.5 grid grid-cols-[auto_auto] gap-x-5 gap-y-1.5 items-start">
        {items.map((item, idx) => {
          const isError = item.key.includes('오류') || item.key.includes('초과');
          let cleanedVal = cleanValue(item.value);
          if (item.key === '거래집계일시') {
            const timeMatch = cleanedVal.match(/\d{2}:\d{2}:\d{2}/);
            if (timeMatch) cleanedVal = timeMatch[0];
          }
          const hasValue = cleanedVal && cleanedVal !== '-' && cleanedVal !== '0' && cleanedVal !== '[-]' && cleanedVal !== '[0]';
          const highlight = isError && hasValue;
          
          if (!item.value) {
            return (
              <div key={idx} className="col-span-2 text-[11px] font-bold text-slate-400 bg-white/5 -mx-2.5 px-2.5 py-1 border-y border-white/5">
                {item.key}
              </div>
            );
          }
          
          return (
            <div key={idx} className="flex items-start gap-1 text-[11px] leading-tight min-w-0">
              <span className={`font-bold shrink-0 whitespace-nowrap ${highlight ? 'text-red-300' : 'text-slate-400'}`}>
                {item.key}:
              </span>
              <span className={`font-mono text-left ${
                item.key.includes('메시지') || 
                item.key.includes('수신자') || 
                item.key.includes('노드') || 
                item.key.includes('건수') || 
                item.key.includes('명')
                  ? 'break-all'
                  : 'whitespace-nowrap'
              } ${highlight ? 'text-red-400 font-black' : 'text-slate-100 font-semibold'}`} title={cleanedVal}>
                {cleanedVal}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── 데이터 입력 서브 컴포넌트 ─────────────────────
function SelectWithOther({ label, icon: Icon, options, value, onChange, required, disabled }) {
  // options can be a list of strings or list of { name, code }
  const getCode = (o) => typeof o === 'object' ? o.code : o;
  const getName = (o) => typeof o === 'object' ? o.name : o;

  const nonOther = options.filter(o => getName(o) !== '기타');
  
  // ⚠️ isOther는 useState 초기값이 아닌 useEffect로 계산 — options가 비동기 로드되기 때문
  const isInOptions = !!value && nonOther.find(o => getCode(o) === value);
  const [isOther, setIsOther] = useState(false);
  const [otherText, setOtherText] = useState('');

  // options 또는 value가 변할 때마다 재계산
  useEffect(() => {
    if (!value) { setIsOther(false); setOtherText(''); return; }
    const found = nonOther.find(o => getCode(o) === value);
    if (found) {
      setIsOther(false); // 옵션에서 찾음 → 정상 선택
    } else if (options.length > 0) {
      setIsOther(true);  // 옵션이 있는데 못 찾음 → 기타
      setOtherText(value);
    }
    // options.length === 0 이면 아직 로딩 중 — isOther 변경 안 함
  }, [options, value]);

  const selectVal = isOther ? '기타' : (value || '');

  const handleSelect = (e) => {
    const v = e.target.value;
    if (v === '기타') {
      setIsOther(true);
      onChange('');
    } else {
      setIsOther(false);
      setOtherText('');
      onChange(v);
    }
  };

  const handleOther = (e) => {
    setOtherText(e.target.value);
    onChange(e.target.value);
  };

  const inputClass = "w-full bg-[#0d272b] border border-[#00e5ff]/20 rounded-xl py-3.5 pl-11 pr-4 text-sm placeholder-slate-500 focus:outline-none focus:border-[#00e5ff] focus:ring-1 focus:ring-[#00e5ff] transition-all text-slate-200";

  return (
    <div className={disabled ? 'opacity-50 pointer-events-none' : ''}>
      <label className="text-xs font-semibold text-slate-400 ml-1 mb-1.5 block">
        {label} {required && disabled !== true && <span className="text-[#00e5ff]">*</span>}
      </label>
      <div className="relative">
        <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <select
          required={required && !isOther && !disabled}
          disabled={disabled}
          value={selectVal}
          onChange={handleSelect}
          className={`${inputClass} appearance-none pr-10`}
        >
          <option value="" disabled className="bg-[#0d272b] text-slate-500">{disabled ? '해당없음' : `${label} 선택`}</option>
          {options.map(o => (
            <option key={getCode(o)} value={getCode(o)} className="bg-[#0d272b] text-slate-200">{getName(o)}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
      </div>
      {isOther && (
        <input
          required={required}
          type="text"
          value={otherText}
          onChange={handleOther}
          placeholder={`${label} 직접 입력`}
          className={`${inputClass} mt-2 pl-4`}
        />
      )}
    </div>
  );
}

// ── 메인 대시보드 컴포넌트 ───────────────────────
export default function DashboardPage({ allowedPaths: _ignored, onAiClick }) {
  const navigate = useNavigate();
  const location = useLocation();

  // authStore 직접 구독 → 다른 탭/하를 콘솔에서 권한 변경 시 즉시 반영
  const [liveAllowedPaths, setLiveAllowedPaths] = useState(() => getAllowedPaths());
  useEffect(() => {
    const remove = addAuthListener(({ allowedPaths: newPaths }) => {
      setLiveAllowedPaths(newPaths);
    });
    return remove;
  }, []);

  // 로컴 state 기반 권한 체크
  const checkAllowed = (path) => {
    if (!path || path === '/dashboard') return true;
    const u = getUserProfile();
    if (u && (u.role === 'SUPER_ADMIN' || u.role === 'ADMIN' || u.role === 'super_admin' || u.role === 'admin' || u.is_admin === 1)) return true;
    if (liveAllowedPaths === null || liveAllowedPaths === undefined) return true;
    if (!Array.isArray(liveAllowedPaths)) return true;
    if (liveAllowedPaths.length === 0) return false;
    return liveAllowedPaths.some(p => path === p || path.startsWith(p + '/'));
  };

  const [showAgentPanel, setShowAgentPanel] = useState(false);

  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [activeLogTab, setActiveLogTab] = useState('ai'); // 'ai' or 'human'
  const [agentMessages, setAgentMessages] = useState([]);
  const [systemStatus, setSystemStatus] = useState('normal'); 
  const [messages, setMessages] = useState([]); 
  const [allNotifications, setAllNotifications] = useState([]); 
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showFullTimeline, setShowFullTimeline] = useState(true);
  const { refreshCodes } = useCodebook();
  
  // 🌐 API Configuration (Production Worker)
  const apiBase = 'https://sguardai.khcho0421.workers.dev';

  const [showNotifications, setShowNotifications] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('week');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [aiInsights, setAiInsights] = useState({});
  const [selectedInsight, setSelectedInsight] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [smsMessages, setSmsMessages] = useState([]);
  const [deletedSmsIds, setDeletedSmsIds] = useState(new Set());
  const [isSmsPanelCollapsed, setIsSmsPanelCollapsed] = useState(false);
  const [showThresholdSettings, setShowThresholdSettings] = useState(false);
  const [thresholds, setThresholds] = useState({ technical: 0.85, casual: 0.95 });

  const [isSavingThreshold, setIsSavingThreshold] = useState(false);
  const [isLiveStreamCollapsed, setIsLiveStreamCollapsed] = useState(false);
  const [isWarRoomCollapsed, setIsWarRoomCollapsed] = useState(false);
  const [isAssignmentsCollapsed, setIsAssignmentsCollapsed] = useState(false);
  const [isFlowCollapsed, setIsFlowCollapsed] = useState(false);
  const [selectedIncidentIdFlow, setSelectedIncidentIdFlow] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [incidentWorkflowSteps, setIncidentWorkflowSteps] = useState([]);
  const [totalSmsVolume, setTotalSmsVolume] = useState(0);

  // MTTR 타이머 실시간 동기화
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 🚀 Dashboard Entry: Fetch latest codebook data
  useEffect(() => {
    refreshCodes();
  }, [refreshCodes]);

  const FLOW_STEPS = [
    { id: 'SMS', label: 'SMS 수신 및 장애 인지' },
    { id: 'RAG_AGENT', label: 'RAG 및 AI AGENT 분석 완료' },
    { id: 'WARROOM', label: '워룸 생성 및 할당 완료(처리중)' },
    { id: 'KNOWLEDGE', label: '지식화/장애/보고 처리완료' }
  ];

  // Helper for Date/Duration Formatting
  const formatDuration = (ms) => {
    if (ms < 0) return '00:00:00';
    const totalSecs = Math.floor(ms / 1000);
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const formatYYMMDD = (dateStr) => {
    if (!dateStr) return '';
    
    // DB에서 '2026-04-03 12:00:00' 형태로 들어올 때 브라우저가 Local로 오해하지 않도록 보정
    // 만약 ISO 형식이 아니면 ISO로 변환 (특히 ' '를 'T'로)
    let d;
    if (typeof dateStr === 'string' && !dateStr.includes('T') && !dateStr.includes('Z')) {
       // '2026-04-05 21:00:00' -> '2026-04-05T21:00:00'
       // 브라우저는 T가 없으면 로컬 시간으로 해석함. DB값이 KST라면 그대로 쓰면 됨.
       // 하지만 DB값이 UTC인데 T/Z가 없다면 직접 보정 필요.
       d = new Date(dateStr.replace(' ', 'T'));
    } else {
       d = new Date(dateStr);
    }

    if (isNaN(d.getTime())) return dateStr;

    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
  };

  const getKstDate = (daysAgo = 0) => {
    const d = new Date();
    const kstOffset = 9 * 60 * 60 * 1000;
    const kstDate = new Date(d.getTime() + kstOffset - (daysAgo * 24 * 60 * 60 * 1000));
    return kstDate.toISOString().split('T')[0];
  };

  const [hideCompletedSms, setHideCompletedSms] = useState(true);
  const [selectedSms, setSelectedSms] = useState(null);
  const [insightSms, setInsightSms] = useState(null);
  const lastProcessedLogIncId = useRef(null);
  const selectedSmsRef = useRef(null);
  const [lastAutoTriggeredKey, setLastAutoTriggeredKey] = useState(null);
  const lastAutoTriggeredKeyRef = useRef(null);
  const [saveStatus, setSaveStatus] = useState('');
  const [isAnalyzingActive, setIsAnalyzingActive] = useState(false);
  const [isInsightComplete, setIsInsightComplete] = useState(false);
  const [insightContent, setInsightContent] = useState('');

  useEffect(() => {
    if (selectedSms) {
      localStorage.setItem('sguard_current_incident', JSON.stringify({
        id: selectedSms.inc_id,
        title: selectedSms.service_name || selectedSms.title || "시스템 장애",
        message: selectedSms.message || selectedSms.error_message || "상세 정보 없음"
      }));
    } else {
      localStorage.removeItem('sguard_current_incident');
    }
    window.dispatchEvent(new Event('sguard_current_incident_changed'));
  }, [selectedSms]);
  
  // 🚀 Derived State: Filtered SMS list based on visibility settings
  const visibleSms = useMemo(() => {
    return smsMessages
      .filter(msg => !deletedSmsIds.has(msg.inc_id))
      .filter(msg => !hideCompletedSms || msg.incident_status !== '처리완료');
  }, [smsMessages, hideCompletedSms, deletedSmsIds]);

  // 🚀 Auto-Reset: Clear other regions if no active incidents are visible
  useEffect(() => {
    if (visibleSms.length === 0) {
      // Initialize/Reset all interactive regions if nothing is visible
      if (selectedSms) setSelectedSms(null);
      if (insightSms) setInsightSms(null);
      if (showAgentPanel) setShowAgentPanel(false);
      if (agentMessages.length > 0) setAgentMessages([]);
      if (incidentWorkflowSteps.length > 0) setIncidentWorkflowSteps([]);
    } else if (selectedSms && !visibleSms.some(m => m.inc_id === selectedSms.inc_id)) {
      // If currently selected incident is hidden by filter, deselect it
      setSelectedSms(null);
      setShowAgentPanel(false);
      setAgentMessages([]);
      setIncidentWorkflowSteps([]);
    }
  }, [visibleSms, selectedSms, insightSms, showAgentPanel, agentMessages.length, incidentWorkflowSteps.length]);

  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const isFirstMountRef = React.useRef(true);
  const [warRooms, setWarRooms] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [myAssignments, setMyAssignments] = useState([]);
  const [expandedAssignments, setExpandedAssignments] = useState(new Set());
  const pressTimerRef = React.useRef(null);
  const [userActivityHistory, setUserActivityHistory] = useState([]);
  const [assignmentDateRange, setAssignmentDateRange] = useState({
    from: getKstDate(7),
    to: getKstDate(0)
  });
  const [isMyAssignOpen, setIsMyAssignOpen] = useState(true);
  const [isOpeningWarRoom, setIsOpeningWarRoom] = useState(false);

  const [showSmsScrollIndicator, setShowSmsScrollIndicator] = useState(false);
  const smsListContainerRef = React.useRef(null);

  const checkSmsScroll = React.useCallback(() => {
    if (!smsListContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = smsListContainerRef.current;
    if (scrollHeight > clientHeight + 15 && scrollTop + clientHeight < scrollHeight - 35) {
      setShowSmsScrollIndicator(true);
    } else {
      setShowSmsScrollIndicator(false);
    }
  }, []);

  React.useEffect(() => {
    const timer = setTimeout(checkSmsScroll, 150);
    return () => clearTimeout(timer);
  }, [visibleSms, checkSmsScroll]);

  const handleOpenWarRoomFromInsight = useCallback(async (smsMessage, analysisText) => {
    if (isOpeningWarRoom) return;
    const currentSms = smsMessage || selectedSmsRef.current;
    if (!currentSms) return;
    setIsOpeningWarRoom(true);

    // The raw received SMS ID (e.g. 20231026154512345) MUST be the primary key DB identifier
    // to match aichat_history.
    const incidentId = String(currentSms.inc_id || currentSms.id || `${Date.now()}`);
    
    const formattedUiId = incidentId; // Display prefix
    const rawMsg = currentSms.message || currentSms.error_message || "SMS 장애 감지";
    const truncatedMsg = rawMsg.length > 50 ? rawMsg.substring(0, 50) + "..." : rawMsg;
    const smsTitle = `${formattedUiId} | ${truncatedMsg}`;
    
    // Check if War-Room already exists
    const existingRoom = warRooms.find(r => r.id === incidentId);
    if (existingRoom) {
      navigate(`/chat/${incidentId}`);
      setIsOpeningWarRoom(false);
      return;
    }

    // 🚀 Concurrency Lock: Try to acquire lock before proceeding
    try {
      const lockRes = await fetch(`${apiBase}/ai/warroom/lock/${incidentId}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ user_name: userProfile?.name || 'Unknown User' })
      });
      const lockData = await lockRes.json();
      if (!lockData.success) {
        alert(`이미 ${lockData.owner} 매니저님이 워룸 개설을 진행 중입니다.`);
        setIsOpeningWarRoom(false);
        return;
      }
    } catch (lockError) {
      console.error("Lock acquisition failed, proceeding anyway", lockError);
    }
    
    let diagnosisText = '';
    let leaderSummary = '';
    // AI 분석 텍스트에서 심각도 추출 (CRITICAL / MAJOR / NORMAL)
    let detectedSeverity = (currentSms?.severity || '').toUpperCase();
    if (analysisText) {
      const diagnosisMatch = analysisText.match(/\[전문가별 심층 진단\]([\s\S]*?)(\[|$)/);
      if (diagnosisMatch) {
        diagnosisText = diagnosisMatch[1].replace(/(\*\*.+?\*\*|###.+?\n|---)/g, '').trim();
      }
      const leaderMatch = analysisText.match(/\[Leader\][\s\S]*?[:：]\s*([\s\S]*?)(?=\[|$)/);
      if (leaderMatch) {
        leaderSummary = leaderMatch[1].replace(/(\*\*.+?\*\*|###.+?\n|---)/g, '').trim();
      }
      if (!leaderSummary && analysisText.length < 2000) leaderSummary = analysisText.trim();
      // AI 분석 결과에서 심각도 키워드 추출
      if (!detectedSeverity) {
        if (/CRITICAL|크리티컬|심각/i.test(analysisText)) detectedSeverity = 'CRITICAL';
        else if (/MAJOR|주의|경고/i.test(analysisText))    detectedSeverity = 'MAJOR';
        else detectedSeverity = 'NORMAL';
      }
    }
    const roomSeverity = ['CRITICAL','MAJOR','NORMAL'].includes(detectedSeverity)
      ? detectedSeverity : 'NORMAL';

    // 1. Add to local state
    const newRoom = {
      id: incidentId,
      title: smsTitle,
      lastMsg: analysisText ? 'AI분석 완료' : '',
      time: formatYYMMDD(new Date()),
      participants: 1,
      severity: roomSeverity,
      unread: true
    };
    setWarRooms(prev => [newRoom, ...prev]);

    // 2. Persist to DB
    try {
      // Save to warroom_list
      const res = await fetch(`${apiBase}/ai/warroom/open`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          inc_id: incidentId,
          title: smsTitle,
          creator_id: userProfile?.employee_id || null,
          severity: roomSeverity,
          leader_summary: leaderSummary
        })
      });

      const openData = await res.json();
      // Even if status === 'exists', we proceed to UPDATE legacy incidents and insert AI analysis if provided.
      
      // Legacy incidents metadata (using UPSERT logic on backend to update description safely)
      await fetch(`${apiBase}/incidents`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          inc_id: String(incidentId),
          title: smsTitle,
          description: diagnosisText || 'SMS 장애 상세 분석 대기 중',
          severity: roomSeverity,
          incident_type: 'SMS',
          source_sms_id: String(currentSms.inc_id)
        })
      });

      await fetchWarRooms();
      setShowEmergencyModal(false);
      navigate(`/chat/${incidentId}`);
    } catch (err) {
      console.error("Failed to open War-Room:", err);
      // Clean up lock on failure so others can try
      fetch(`${apiBase}/ai/warroom/lock/${incidentId}`, { 
        method: 'DELETE',
        headers: getAuthHeaders()
      }).catch(() => {});
    } finally {
      setIsOpeningWarRoom(false);
    }
  }, [isOpeningWarRoom, warRooms, navigate, userProfile, apiBase]);

  // Initialize data from localStorage (or fetch from API if missing)
  useEffect(() => {
    const initUser = async () => {
      try {
        const savedUser = localStorage.getItem('sguard_user');
        if (savedUser && savedUser !== 'undefined' && savedUser !== 'null') {
          setUserProfile(JSON.parse(savedUser));
          return;
        }
      } catch {
        localStorage.removeItem('sguard_user');
      }

      // Try to restore from token
      const token = getAccessToken();
      if (token) {
        try {
          // In some cases we might still want to fetch fresh user data if needed
        } catch {
          // ignore
        }
      }

      // No valid session found: redirect to login
      navigate('/');
    };

    initUser();

    try {
      const savedCollapsed = localStorage.getItem('sguard_sms_collapsed');
      if (savedCollapsed) {
        setIsSmsPanelCollapsed(JSON.parse(savedCollapsed));
      }
    } catch {
      localStorage.removeItem('sguard_sms_collapsed');
    }
  }, []);

  // 독립 함수: 외부(handleAnalysisComplete 등)에서도 호출 가능
  const fetchWorkflowForId = useCallback(async (incId) => {
    if (!incId) return;
    try {
      const res = await fetch(`${apiBase}/ai/incident/workflow-details?inc_id=${incId}`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      setIncidentWorkflowSteps(data.steps || []);
    } catch (e) {
      console.error('Workflow fetch failed:', e);
    }
  }, [apiBase]);

  // Fetch detailed workflow when an incident is selected
  useEffect(() => {
    if (!selectedIncidentIdFlow) {
      setIncidentWorkflowSteps([]);
      return;
    }
    fetchWorkflowForId(selectedIncidentIdFlow);
  }, [selectedIncidentIdFlow, fetchWorkflowForId]);

  // 상단 S-Autopilot Insight 패널은 항상 최신 SMS만 분석하도록 고정
  // 상단 S-Autopilot Insight 패널은 선택된 SMS를 우선 표시하고, 없을 경우 최신 SMS를 분석
  useEffect(() => {
    if (visibleSms.length > 0) {
      const targetSms = selectedSms || visibleSms[0];
      setInsightSms(prev => {
        // 객체 참조 변경 방지 (무한 리렌더링 및 API 재조회 루프 방지)
        if (prev && prev.inc_id === targetSms.inc_id) return prev;
        return targetSms;
      });
    } else {
      setInsightSms(null);
    }
  }, [selectedSms, visibleSms]);

  // Fetch War-Rooms & SMS periodically
  useEffect(() => {
    if (isFirstMountRef.current) {
      setIsInitialLoading(true);
      Promise.allSettled([
        fetchSMSMessages(),
        fetchWarRooms(),
        fetchActivityLogs(),
        fetchMyAssignments(),
        fetchUserActivityHistory(),
        fetchSettings()
      ]).finally(() => {
        setIsInitialLoading(false);
        isFirstMountRef.current = false;
      });
    } else {
      fetchSMSMessages();
      fetchWarRooms();
      fetchActivityLogs();
      fetchMyAssignments();
      fetchUserActivityHistory();
    }
    // 🚀 Performance Optimization: Reduce polling pressure during active AI analysis
    const pollIntervalMultiplier = isAnalyzingActive ? 4 : 1; // 4x slower during analysis

    const smsInterval = setInterval(fetchSMSMessages, 10000 * pollIntervalMultiplier);
    const wrInterval = isAnalyzingActive ? null : setInterval(fetchWarRooms, 15000);
    const activityInterval = isAnalyzingActive ? null : setInterval(fetchActivityLogs, 20000);
    const assignmentInterval = isAnalyzingActive ? null : setInterval(fetchMyAssignments, 20000);
    const historyInterval = isAnalyzingActive ? null : setInterval(fetchUserActivityHistory, 30000);

    // 🚀 NEW: Real-time SMS Stream (SSE) — use real JWT for query param auth
    const token = getAccessToken();
    const sse = new EventSource(`${apiBase}/sms/notification-stream${token ? `?token=${token}` : ''}`);
    sse.addEventListener('new_sms', (event) => {
      console.log('Real-time SMS Event:', event.data);
      // Immediately pull fresh data when a new SMS notification arrives
      fetchSMSMessages();
    });

    sse.onerror = () => {
       console.warn('SMS SSE Connection failed, falling back to polling.');
       sse.close();
       // Retry after 5 seconds to recover from transient network/worker issues
       setTimeout(() => { fetchSMSMessages(); }, 5000);
    };

    return () => {
      clearInterval(smsInterval);
      clearInterval(wrInterval);
      clearInterval(activityInterval);
      clearInterval(assignmentInterval);
      if (historyInterval) clearInterval(historyInterval);
      sse.close();
    };
  }, [userProfile, assignmentDateRange, hideCompletedSms, isAnalyzingActive]);

  // SMS 선택 시 에이전트 토론 자동 시작
   useEffect(() => {
     if (selectedSms) {
       startLiveScenario(selectedSms);
     } else {
       setShowAgentPanel(false);
       setAgentMessages([]);
     }
   }, [selectedSms]);

  const fetchWarRooms = async () => {
    if (!userProfile?.employee_id) return;
    try {
      const res = await fetch(`${apiBase}/ai/warroom/my-rooms?user_id=${userProfile.employee_id}`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        const mapped = (data.rooms || []).map(room => ({
          ...room,
          id: room.inc_id,
          lastMsg: room.status === 'Completed' ? '종료된 체널' : '대화가 시작되지 않았습니다.',
          time: room.reg_dt ? formatYYMMDD(room.reg_dt) : formatYYMMDD(new Date()),
          participants: room.participants || Math.floor(Math.random() * 5) + 2,
          severity: room.severity || 'NORMAL',
          unread: false
        }));
        setWarRooms(prev => {
          const prevSig = (prev || []).map(r => `${r.inc_id}_${r.status}`).join('|');
          const nextSig = mapped.map(r => `${r.inc_id}_${r.status}`).join('|');
          if (prevSig === nextSig) return prev;
          return mapped;
        });
      }
    } catch (err) {
      console.error("Failed to fetch War-Rooms:", err);
    }
  };

  const fetchActivityLogs = async () => {
    if (!userProfile?.employee_id) return;
    try {
      const res = await fetch(`${apiBase}/activity-logs`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setActivityLogs(data.logs || []);
      }
    } catch (err) {
      console.error("Failed to fetch activity logs:", err);
    }
  };

  const fetchMyAssignments = async () => {
    if (!userProfile?.employee_id) return;
    try {
      const res = await fetch(`${apiBase}/ai/incident/my-assignments?user_id=${userProfile.employee_id}&from=${assignmentDateRange.from}&to=${assignmentDateRange.to}`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        const mapped = (data.assignments || []).map(inc => ({
          ...inc,
          inc_id: String(inc.inc_id)
        }));
        setMyAssignments(mapped);
      }
    } catch (err) {
      console.error("Failed to fetch assignments:", err);
    }
  };

  const fetchUserActivityHistory = async () => {
    if (!userProfile?.employee_id) return;
    try {
      const res = await fetch(`${apiBase}/ai/user/activity-history?user_id=${userProfile.employee_id}`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setUserActivityHistory(data.history || []);
      }
    } catch (err) {
      console.error("Failed to fetch activity history:", err);
    }
  };

  const leaveWarRoom = async (e, inc_id) => {
    e.stopPropagation();
    if (!userProfile?.employee_id || !window.confirm('이 워룸에서 나가시겠습니까?')) return;
    try {
      const res = await fetch(`${apiBase}/ai/warroom/leave`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ user_id: userProfile.employee_id, inc_id: inc_id })
      });
      if (res.ok) {
        fetchWarRooms();
      }
    } catch (err) {
      console.error("Failed to leave war-room:", err);
    }
  };

  const updateAssignmentStatus = async (inc_id, newStatus) => {
    if (!userProfile?.employee_id) return;
    try {
      const res = await fetch(`${apiBase}/ai/incident/status`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          user_id: userProfile.employee_id,
          inc_id: inc_id,
          status: newStatus
        })
      });
      if (res.ok) {
        fetchMyAssignments();
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };


  const fetchSettings = async () => {
    try {
      const response = await fetch(`${apiBase}/sms/settings`, {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        const tech = data.settings.find(s => s.key === 'similarity_threshold_technical')?.value || 0.85;
        const casual = data.settings.find(s => s.key === 'similarity_threshold_casual')?.value || 0.95;
        setThresholds({ technical: parseFloat(tech), casual: parseFloat(casual) });
      }
    } catch (e) {
      console.error("Fetch settings error:", e);
    }
  };

  const updateThreshold = async (key, value) => {
    setIsSavingThreshold(true);
    try {
      const response = await fetch(`${apiBase}/sms/settings`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ key, value: String(value) })
      });
      if (response.ok) {
        console.log(`${key === 'similarity_threshold_technical' ? '기술' : '일상'} 임계값이 ${value}로 업데이트되었습니다.`);
        setSaveStatus(`${key === 'similarity_threshold_technical' ? 'Technical threshold' : 'Casual strictness'} 저장 완료!`);
        setTimeout(() => setSaveStatus(''), 2500);
        fetchSettings();
      }
    } catch (e) {
      console.error("설정 업데이트 실패", e);
    } finally {
      setIsSavingThreshold(false);
    }
  };

  const fetchSMSMessages = async () => {
    // 🚫 Don't poll if not authenticated — prevents 401 loop
    if (!getAccessToken() && !localStorage.getItem('sguard_ghost')) return;
    try {
      const response = await fetch(`${apiBase}/sms/recent?limit=20${hideCompletedSms ? '&excludeCompleted=true' : ''}`, {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        const freshMsgs = (data.messages || []).filter(msg => {
          if (deletedSmsIds.has(msg.inc_id)) return false;
          return true;
        });

        const uniqueMap = new Map();
        freshMsgs.forEach(msg => {
          if (!uniqueMap.has(msg.inc_id)) {
            uniqueMap.set(msg.inc_id, msg);
          }
        });
        
        const finalMsgs = Array.from(uniqueMap.values());
        
        // 🛡️ Deduplication: Only update if the list has actually changed
        setSmsMessages(prev => {
          const prevIds = (prev || []).map(m => `${m.inc_id}_${m.received_count}`).join(',');
          const nextIds = finalMsgs.map(m => `${m.inc_id}_${m.received_count}`).join(',');
          if (prevIds === nextIds) return prev;
          return finalMsgs;
        });

        const totalVolume = finalMsgs.reduce((acc, m) => acc + (Number(m.received_count) || 1), 0);
        setTotalSmsVolume(totalVolume);

        if (finalMsgs.length > 0) {
          const latestMsg = finalMsgs[0];
          const latestKey = String(latestMsg.inc_id); // timestamp 변경으로 인한 불필요한 재트리거 방지
          
          if (latestKey !== lastAutoTriggeredKeyRef.current) {
            lastAutoTriggeredKeyRef.current = latestKey;
            setLastAutoTriggeredKey(latestMsg.inc_id);
            
            // 🛡️ Deduplication: Only auto-select if nothing is selected or it's a DIFFERENT incident
            if (!selectedSmsRef.current || selectedSmsRef.current.inc_id !== latestMsg.inc_id) {
              setSelectedSms(latestMsg);
              startLiveScenario(latestMsg);
            }
          }
        }
      }
    } catch (error) {
      console.error('SMS 메시지 로드 실패:', error);
    }
  };

  const toggleSmsPanel = () => {
    const newState = !isSmsPanelCollapsed;
    setIsSmsPanelCollapsed(newState);
    localStorage.setItem('sguard_sms_collapsed', JSON.stringify(newState));
  };

  const deleteSMSMessage = async (e, id) => {
    e.stopPropagation();
    try {
      const response = await fetch(`${apiBase}/sms/${id}`, { 
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (response.ok) {
        // 즉시 화면에서 제거하기 위한 로컬 상태 업데이트
        setDeletedSmsIds(prev => {
          const newSet = new Set(prev);
          newSet.add(id);
          return newSet;
        });
        setSmsMessages(prev => prev.filter(msg => msg.inc_id !== id));
      }
    } catch (error) {
      console.error('SMS 메시지 삭제 실패:', error);
    }
  };


  const totalAssignedCount = myAssignments.length;

  // Dummy data for status cards
  const statusCards = [
    { id: 'critical', label: 'Critical', val: 0, icon: AlertTriangle, color: 'bg-[#00e5ff]/20', text: 'text-[#00e5ff]', bar: 'bg-[#00e5ff]', borderColor: 'border-[#00e5ff]/30' },
    { id: 'major', label: 'Major', val: 1, icon: Shield, color: 'bg-[#00e5ff]/20', text: 'text-[#00e5ff]', bar: 'bg-[#00e5ff]', borderColor: 'border-[#00e5ff]/30' },
    { id: 'normal', label: 'Normal', val: 24, icon: CheckCircle, color: 'bg-[#00e5ff]/20', text: 'text-[#00e5ff]', bar: 'bg-[#00e5ff]', borderColor: 'border-[#00e5ff]/30' },
    { id: 'info', label: 'Info', val: 156, icon: Info, color: 'bg-[#00e5ff]/20', text: 'text-[#00e5ff]', bar: 'bg-[#00e5ff]', borderColor: 'border-[#00e5ff]/30' },
  ];



  const [metrics, setMetrics] = useState({
    cpu: 45,
    memory: 52,
    requests: 240,
    errorRate: 0.1
  });

  // Demo Trigger Handler (Secret Key: 'd')
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'd' && !showAgentPanel) {
        console.log('Demo scenario removed.');
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showAgentPanel]);


  // Metric Simulation Loop
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(prev => {
        if (systemStatus === 'critical') {
          return {
            cpu: Math.min(98, prev.cpu + Math.random() * 5),
            memory: Math.min(95, prev.memory + Math.random() * 3),
            requests: Math.min(3000, prev.requests + Math.random() * 100),
            errorRate: Math.min(15, prev.errorRate + Math.random() * 2)
          };
        } else if (systemStatus === 'recovering') {
          return {
            cpu: Math.max(45, prev.cpu - 5),
            memory: Math.max(52, prev.memory - 3),
            requests: Math.max(240, prev.requests - 50),
            errorRate: Math.max(0.1, prev.errorRate - 1)
          };
        } else {
          // Normal fluctuation
          return {
            cpu: 40 + Math.random() * 20,
            memory: 50 + Math.random() * 15,
            requests: 200 + Math.random() * 100,
            errorRate: Math.random() * 0.5
          };
        }
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [systemStatus]);

  const toggleAssignmentsPanel = () => {
    setIsAssignmentsCollapsed(!isAssignmentsCollapsed);
  };

  const toggleFlowPanel = () => {
    setIsFlowCollapsed(!isFlowCollapsed);
  };

  const toggleLiveStreamPanel = () => {
    setIsLiveStreamCollapsed(!isLiveStreamCollapsed);
  };

  const toggleWarRoomPanel = () => {
    setIsWarRoomCollapsed(!isWarRoomCollapsed);
  };

  // ── PC 버전과 동일한 parseTranscript (DashboardPage.jsx 기준) ──────────────
  const parseTranscript = (text) => {
    if (!text) return [];

    // ── 에이전트 이름 → 정규화 키 매핑
    const AGENT_ORDER = ['Security', 'DB', 'DevOps', 'Leader'];

    const detectAgentName = (str) => {
      const s = str.trim();
      if (/security/i.test(s))             return 'Security';
      if (/db|database/i.test(s))          return 'DB';
      if (/devops|infra|analyst/i.test(s)) return 'DevOps';
      if (/leader/i.test(s))              return 'Leader';
      return null;
    };

    // ── [전문가별 심층 진단] 섹션 시작점 찾기
    const sectionMarkers = ['[전문가별 심층 진단]', '전문가별 심층 진단', '## 전문가', '### 전문가'];
    let startIndex = -1;
    for (const marker of sectionMarkers) {
      const idx = text.indexOf(marker);
      if (idx !== -1) { startIndex = idx; break; }
    }
    if (startIndex === -1) startIndex = 0;

    const lines = text.substring(startIndex).split('\n');
    const msgsMap = new Map();
    let currentAgent = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // ── 패턴 1: `- **Security Agent**: 내용` 또는 `• Security Agent: 내용`
      const bulletMatch = trimmed.match(
        /^[-•*·\d.]\s*\*{0,4}(Security|DB|DevOps|Leader)\s*Agent\*{0,4}\s*[:：]\s*(.+)/i
      );
      if (bulletMatch) {
        const agentName = detectAgentName(bulletMatch[1]);
        const content = bulletMatch[2].trim();
        if (agentName && content) {
          const prev = msgsMap.get(agentName) || '';
          msgsMap.set(agentName, prev + (prev ? '\n' : '') + content);
          currentAgent = agentName;
          continue;
        }
      }

      // ── 패턴 2: 헤더 형식 (`### Security Agent`, `**DB Agent**`, `[Security Agent]`)
      const isHeaderLike = (
        /^#{1,4}\s/.test(trimmed) ||
        /^\*{1,2}[^*]/.test(trimmed) ||
        /^\[.{2,40}\]/.test(trimmed) ||
        /^\d+[\.]\s/.test(trimmed) ||
        (/[：:]\s*$/.test(trimmed) && trimmed.length < 60)
      );
      if (isHeaderLike && /security|db|database|devops|infra|leader/i.test(trimmed)) {
        const agentName = detectAgentName(trimmed);
        if (agentName) {
          currentAgent = agentName;
          continue;
        }
      }

      // ── 패턴 2.5: [리더의 최종 조치 가이드] 마커 → currentAgent를 Leader로 강제 전환
      // DevOps 등 다른 에이전트가 currentAgent인 상태에서 이 마커가 나오면 Leader 블록으로 귀속시킴
      if (/\[?리더의 최종 조치 가이드\]?/.test(trimmed)) {
        currentAgent = 'Leader';
        const leaderPrev = msgsMap.get('Leader') || '';
        msgsMap.set('Leader', leaderPrev + (leaderPrev ? '\n' : '') + trimmed);
        continue;
      }

      // ── 패턴 3: 이전 에이전트 내용 누적
      if (currentAgent) {
        const prev = msgsMap.get(currentAgent) || '';
        msgsMap.set(currentAgent, prev + (prev ? '\n' : '') + trimmed);
      }
    }

    // ── 정의된 4개 순서로 결과 반환
    const result = [];
    for (const name of AGENT_ORDER) {
      const raw = msgsMap.get(name);
      if (!raw) continue;

      let processed = raw;

      // Leader: [리더의 최종 조치 가이드] 마커 이후 내용을 Leader 메시지로 사용
      if (name === 'Leader') {
        const guidePattern = /(\*{0,2}#{0,4}\s*\[?리더의 최종 조치 가이드\]?\*{0,2}[\s:：]?)/;
        const guideMatch = guidePattern.exec(processed);
        if (guideMatch) {
          const afterMarker = processed.substring(guideMatch.index + guideMatch[0].length).trim();
          const beforeMarker = processed.substring(0, guideMatch.index).trim();
          processed = [beforeMarker, afterMarker].filter(Boolean).join('\n\n');
        }
      }

      const cleaned = processed
        .replace(/^#{1,4}\s*/gm, '')
        .replace(/^\*{1,2}(.*?)\*{1,2}$/gm, '$1')
        .replace(/^[-•·]\s*/gm, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      if (cleaned.length > 3) {
        result.push({ role: name, text: cleaned, delay: 0 });
      }
    }

    return result;
  };

  const deduplicateMessages = (msgs) => {
    const seen = new Set();
    return msgs.filter(m => {
      const key = `${m.role}:${(m.text || '').trim().substring(0, 30)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  // Callback called from AiInsightPanel (PC 버전과 동일한 로직)
  const handleAgentContent = useCallback((fullTranscript, isDone) => {
    const currentMsgs = parseTranscript(fullTranscript);
    
    // 🛑 Dify 서버 에러 메시지는 전문가 의견으로 처리하지 않음
    const filteredMsgs = currentMsgs.filter(m => {
      const isError = m.text && (
        m.text.includes('AI 엔진 서버 오류') || 
        m.text.includes('Dify 측 서버 상태가 불안정') ||
        m.text.includes('인증 오류') ||
        m.text.includes('엔드포인트 오류')
      );
      return m.role !== 'AI분석' && !isError;
    });

    if (filteredMsgs.length > 0) {
      setShowAgentPanel(true);
      // 순서대로(Security→DB→DevOps→Leader) 중복 제거 후 표시
      setAgentMessages(deduplicateMessages(filteredMsgs.map(m => ({ ...m, isCompleted: isDone }))));
    }

    // 완료 시에만 중복 제거된 내역을 DB 저장
    if (isDone && currentMsgs.length > 0) {
      const currentIncId = selectedSmsRef.current?.inc_id;
      if (currentIncId) {
        fetch(`${apiBase}/ai/chat-history/save`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ incident_id: String(currentIncId), messages: deduplicateMessages(currentMsgs) })
        }).catch(console.error);

        setTimeout(() => setShowEmergencyModal(true), 1500);
      }
    }
  }, [apiBase, parseTranscript]);


  const agentPanelRef = useRef(null);

  const startLiveScenario = async (smsMessage) => {
    if (!smsMessage) return;
    setSystemStatus('critical');
    setShowAgentPanel(true);
    // 초기 메시지는 클릭 핸들러에서 이미 세팅 — 여기서 덮어쓰지 않음

    // Update both state and ref
    setSelectedSms(smsMessage);
    selectedSmsRef.current = smsMessage;

    // ⚡ One-View Automation: Ensure visibility when explicitly selected
    setIsSmsPanelCollapsed(false);
    setIsLiveStreamCollapsed(false);
    setIsWarRoomCollapsed(false);
    setIsAssignmentsCollapsed(false);
    setIsFlowCollapsed(false);
    setShowAgentPanel(true);
    setSelectedIncidentIdFlow(smsMessage.inc_id); // Ensure the flow panel displays its data

    // Filter inc_id to strictly numeric if it has INC- prefix
    const cleanIncId = String(smsMessage.inc_id);

    // Trigger Assignment to the current user
    if (userProfile?.employee_id) {
      fetch(`${apiBase}/ai/incident/assign`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          user_id: userProfile.employee_id,
          login_id: userProfile.email,
          inc_id: String(smsMessage.inc_id),
          incident_title: 'SMS 수신 확인'
        })
      })
      .then(() => fetchMyAssignments())
      .catch(err => console.error("Assignment failed:", err));
    }


    try {
      // Dashboard에서는 히스토리 존재 여부만 체크하고 패널을 열어준다.
      // -------------------------------------------------------------
      const checkRes = await fetch(`${apiBase}/ai/chat-history/${cleanIncId}`);
      if (checkRes.ok) {
         const data = await checkRes.json();
         if (data.messages && data.messages.length > 0) {
            const filtered = data.messages.filter(m => m.role !== 'AI분석');
            const completedMsgs = deduplicateMessages(filtered.map(m => ({ ...m, isCompleted: true })));
            const hasSecurityExpert = filtered.some(m => /Security|보안/i.test(m.role));

            if (hasSecurityExpert) {
              setAgentMessages(completedMsgs);
              setTimeout(() => setShowEmergencyModal(true), 1500);
              return; 
            }
            setAgentMessages(completedMsgs);
         }
      }
    } catch (err) {
      console.error("Chat history check failed:", err);
    }

    // Note: AiInsightPanel이 마운트되어 있으면 selectedSms 변경 시 자동으로 분석 스트림이 시작됩니다.
    console.log("Waiting for AiInsightPanel to handle streaming for:", smsMessage.inc_id);
    
  };

  const handleApproveAction = () => {
    setShowEmergencyModal(false);
    setSystemStatus('recovering');
    setAgentMessages(prev => [...prev, { role: 'Leader', text: '✅ 조치 승인됨. 재기동 스크립트 실행 중...', delay: 0 }]);

    setTimeout(() => {
      setAgentMessages(prev => [...prev, { role: 'DevOps', text: '🚀 WAS-03 재기동 완료.', delay: 0 }]);
    }, 2000);

    setTimeout(async () => {
      setAgentMessages(prev => [...prev, { role: 'Leader', text: '🎉 시스템 안정화 확인. 사후 분석(Post-Mortem) 보고서 생성 및 KMS 저장 중...', delay: 0 }]);
      setSystemStatus('normal');

      try {
        const reportTitle = "Agent Discussion Report " + new Date().toISOString().split('T')[0];
        const reportContent = agentMessages.map(m => `[${m.role}] ${m.text}`).join('\n');

        const res = await fetch(`${apiBase}/ai/report/save`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            title: reportTitle,
            content: reportContent,
            inc_id: String(selectedSms?.inc_id || selectedIncidentIdFlow),
            user_id: userProfile?.email || 'khcho0421@gmail.com'
          })
        });

        if (res.ok) {
          setAgentMessages(prev => [...prev, { role: 'Leader', text: '💾 [KMS 업데이트 완료] 성공적으로 사후 분석 보고서가 지식 베이스에 임베딩되어 향후 RAG 분석에 반영됩니다.', delay: 0 }]);
        }
      } catch (err) {
        console.error("KMS 저장 실패:", err);
      }

      // Auto close panel delay
      setTimeout(() => setShowAgentPanel(false), 5000);
    }, 4000);
  };

  const dismissMessage = (id) => {
    setMessages(messages.filter(msg => msg.id !== id));
  };

  // Modal State
  const [showInsightModal, setShowInsightModal] = useState(false);
  const [selectedInsightData, setSelectedInsightData] = useState(null);

  // Mock Data for AI Prediction Modal (from screenshot)
  const demoInsightData = {
    predictionId: 'PRED-2024-001',
    severity: 'high',
    category: '장애',
    aiReasoning: '평소 화요일 오전 08:00~09:00 CPU 사용률은 45% 수준이나, 현재 92%로 급증하였습니다. 배치 프로세스 (batch_processor_v2)의 무한 루프가 의심되며, 메모리 누수(Memory Leak) 패턴도 함께 감지되었습니다. 과거 유사 사례 분석 결과, 이러한 패턴은 평균 15분 이내에 서비스 중단으로 이어질 확률이 높습니다.',
    relatedMetrics: {
      cpu: 92,
      memory: 78,
      diskIO: 65
    },
    recommendedActions: [
      '배치 프로세스 즉시 재시작 (service restart batch_processor_v2)',
      '로그 파일 확인하여 루프 원인 파악 (/var/log/batch_errors.log)',
      '메모리 덤프 생성 후 누수 지점 분석',
      '임시 조치: 프로세스 타임아웃 설정 강화 (timeout 300s -> 120s)'
    ],
    confidence: 95,
    similarCases: 37
  };

  const handleShowInsight = useCallback((type) => {
    // In a real app, we would fetch data based on type using the API
    // For now, we use the demo data matching the screenshot
    // setSelectedInsightData(demoInsightData);
    // setShowInsightModal(true);
    console.log("AI Insight Modal disabled by user request");
  }, []);

  const handleAnalysisComplete = useCallback((done, content) => {
    setIsInsightComplete(done);
    if (done) {
      setInsightContent(content);
      setIsAnalyzingActive(false);
      const doneIncId = selectedSmsRef.current?.inc_id;
      if (doneIncId) {
        // 1) 목록 배지 업데이트 (로컬 패치 — 재분석 루프 방지)
        setSmsMessages(prev =>
          (prev || []).map(m =>
            m.inc_id === doneIncId ? { ...m, is_analyzed: 1 } : m
          )
        );
        // 2) 장애 처리 현황 타임라인 재조회 (workflow steps 갱신)
        fetchWorkflowForId(doneIncId);
      }
    }
  }, [fetchWorkflowForId]);

  const handleLogReceived = useCallback((log, counts) => {
    // 🛡️ SECURITY: Dify 서버 에러나 기술적 오류 문구가 포함된 로그는 대시보드에 노출하지 않음
    const errorRegex = /(AI 엔진 서버 오류|Dify 측 서버 상태|인증 오류|엔드포인트 오류|대기 시간 초과|Dify API 오류|🤖|⚠️)/i;
    const logContent = log.message || log.text || '';
    if (logContent && errorRegex.test(logContent)) {
      // 🔇 Silent block for technical errors
      return; 
    }

    const currentIncId = selectedSms?.inc_id;
    if (currentIncId && lastProcessedLogIncId.current === currentIncId && logContent.length <= (lastProcessedLogIncId.current_len || 0)) {
      return; 
    }
    lastProcessedLogIncId.current = currentIncId;
    lastProcessedLogIncId.current_len = logContent.length;

    // console.log("Log received in Dashboard:", log);
    const uniqueId = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setAllNotifications(prev => [{
      id: uniqueId,
      title: log.title || 'AI Log',
      content: logContent,
      type: 'AI',
      severity: log.severity,
      time: formatYYMMDD(new Date())
    }, ...prev]);
  }, [selectedSms]);

  // ── Tooltip Logic for Header ─────────────────────
  const [activeTooltip, setActiveTooltip] = useState(null);
  const tooltipTimerRef = useRef(null);

  const handleTooltipStart = (text) => {
    // 200ms 이상 누르고 있으면 툴팁 노출
    tooltipTimerRef.current = setTimeout(() => {
      setActiveTooltip(text);
    }, 200);
  };

  const handleTooltipEnd = () => {
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    setActiveTooltip(null);
  };

  const renderProfileModal = () => {
    if (!showProfileModal) return null;

    const currentProfile = userProfile || { name: 'Guest User', email: 'guest@s-guard.ai', profile_picture: null, dept: '', team: '' };

    return (
      <ProfileModalContent
        apiBase={apiBase}
        profile={currentProfile}
        onClose={() => setShowProfileModal(false)}
        onSave={async (updated) => {
          try {
            const token = getAccessToken();
            const res = await fetch(`${apiBase}/auth/profile`, {
              method: 'PATCH',
              headers: getAuthHeaders(),
              body: JSON.stringify({
                user_id: updated.id,
                name: updated.name,
                phone: updated.phone,
                company: updated.company,
                honbu: updated.honbu,
                team: updated.team,
                part: updated.part,
                subpart: updated.subpart,
                os_type: updated.os_type,
                profile_picture: updated.profile_picture,
              }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || '수정 실패');

            setUserProfile(data.user);
            localStorage.setItem('sguard_user', JSON.stringify(data.user));
            setShowProfileModal(false);
            alert('개인 정보가 수정되었습니다.');
          } catch (err) {
            alert(err.message);
          }
        }}
        navigate={navigate}
      />
    );
  };

  const handleManualRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    
    const msgId = `refresh-${Date.now()}`;
    setMessages(prev => [...prev, { id: msgId, type: 'info', text: '데이터를 최신화하는 중입니다...' }]);
    
    try {
      await Promise.all([
        fetchSMSMessages(),
        fetchWarRooms(),
        fetchMyAssignments(),
        fetchActivityLogs(),
        // Trigger backend self-healing
        fetch(`${apiBase}/ai/knowledge/sync-status`, {
          headers: getAuthHeaders()
        }).catch(e => console.warn("Sync status trigger failed:", e))
      ]);
      
      // Remove loading message
      setMessages(prev => prev.filter(m => m.id !== msgId));
      
      // Show success message
      const successId = `success-${Date.now()}`;
      setMessages(prev => [...prev, { id: successId, type: 'success', text: '모든 데이터가 성공적으로 새로고침되었습니다.' }]);
      
      // Auto dismiss success after 3s
      setTimeout(() => {
        setMessages(prev => prev.filter(m => m.id !== successId));
      }, 3000);
    } catch (err) {
      console.error("Manual refresh error:", err);
      setMessages(prev => prev.filter(m => m.id !== msgId));
      setMessages(prev => [...prev, { id: `err-${Date.now()}`, type: 'error', text: '데이터 새로고침 중 오류가 발생했습니다.' }]);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="fixed inset-0 text-slate-200 font-sans overflow-x-clip overflow-y-auto" style={{ background: '#121212' }}>
      {isInitialLoading && (
        <div className="absolute inset-0 z-[500] bg-[#121212]/95 backdrop-blur-md flex flex-col items-center justify-center space-y-4 animate-in fade-in duration-300">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 border-4 border-[#00e5ff]/20 rounded-full" />
            <div className="absolute inset-0 border-4 border-[#00e5ff] border-t-transparent rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Zap className="w-6 h-6 text-[#00e5ff] animate-pulse" />
            </div>
          </div>
          <div className="text-center space-y-1">
            <h3 className="text-sm font-black tracking-wider text-slate-200">S-GUARD 시스템 데이터 렌더링 중입니다...</h3>
            <p className="text-[11px] text-slate-400">실시간 전파 이력 및 워룸 현황을 동기화하고 있습니다</p>
          </div>
        </div>
      )}
      <nav className="mobile-top-nav flex justify-between items-end px-2.5 sm:px-4 sticky top-0 z-[100] backdrop-blur-md"
        style={{ 
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: '12px',
          height: 'calc(62px + env(safe-area-inset-top, 0px))',
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(0, 229, 255, 0.15)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.9)'
        }}>

        {/* Left: logo + icon buttons */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button onClick={() => window.location.reload()}
            className="text-sm sm:text-lg font-black tracking-widest uppercase text-slate-200 whitespace-nowrap font-mono flex items-center"
            style={{ textShadow: '0 0 15px rgba(255,255,255,0.4)' }}
          >
            S-GUARD
          </button>
        </div>

        {/* Center: War-Room Action Button (More compact sizing) */}
        <div className="flex-1 max-w-[110px] sm:max-w-[125px] mx-1 sm:mx-2">
          {insightSms && isInsightComplete && (
            <div className="animate-in fade-in zoom-in duration-500">
               {(() => {
                  const sev = (insightSms.severity || 'NORMAL').toUpperCase();
                  const incidentStatus = insightSms.status || 'INC_001';
                  const isProcessing = incidentStatus === 'INC_002';
                  const isCompleted = incidentStatus === 'INC_003';
                  
                  const btnCls = (isCompleted || isProcessing)
                    ? 'bg-[#121820] text-slate-300 border-white/15 shadow-sm font-bold'
                    : 'bg-[#081820] text-[#00e5ff] border-[#00e5ff]/50 shadow-[0_0_12px_rgba(0,229,255,0.25)] animate-pulse font-black';

                  return (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (isOpeningWarRoom) return;
                        handleOpenWarRoomFromInsight(insightSms, insightContent);
                      }}
                      disabled={isOpeningWarRoom}
                      className={`w-full flex items-center justify-center gap-1 py-1 sm:py-1.5 px-1.5 sm:px-2.5 rounded-lg font-black text-[9.5px] sm:text-[10px] tracking-tight transition-all border ${btnCls} disabled:opacity-50 whitespace-nowrap overflow-hidden shadow-md`}
                    >
                      {isOpeningWarRoom ? (
                        <div className="w-2.5 h-2.5 border-2 border-white/20 border-t-white rounded-full animate-spin shrink-0" />
                      ) : (
                        <Users size={11} className="shrink-0" />
                      )}
                      <span className="truncate">
                        {isOpeningWarRoom ? '진행중' : (isCompleted || isProcessing) ? 'WAR-ROOM 이동' : 'WAR-ROOM 개설'}
                      </span>
                    </button>
                  );
               })()}
            </div>
          )}
        </div>


        {/* Right: Icon buttons + AI button + profile */}
        <div className="flex items-center gap-1 sm:gap-2">
          <div className="flex items-center gap-1 mr-0.5">
            {/* Orbital Command */}
            <button onClick={() => {
              if (!checkAllowed('/orbital-command')) {
                toast.error('해당 화면의 권한이 없습니다.');
                return;
              }
              navigate('/orbital-command');
            }}
              disabled={!checkAllowed('/orbital-command')}
              onPointerDown={() => handleTooltipStart('Orbital Command')} onPointerUp={handleTooltipEnd} onPointerLeave={handleTooltipEnd}
              className={`w-8 h-8 rounded-xl flex items-center justify-center active:opacity-60 relative hover:bg-white/10 active:bg-white/20 transition-all cursor-pointer ${!checkAllowed('/orbital-command') ? 'opacity-30 cursor-not-allowed' : ''}`}
              style={{ background: 'transparent' }}>
              <Cpu size={16} style={{ color: '#00e5ff' }} />
              {!checkAllowed('/orbital-command') && <Lock className="w-2.5 h-2.5 text-[#00e5ff] absolute -top-1 -right-1" />}
            </button>

            {/* Alert Monitor */}
            <button onClick={() => {
              if (!checkAllowed('/alert-monitor')) {
                toast.error('해당 화면의 권한이 없습니다.');
                return;
              }
              navigate('/alert-monitor');
            }}
              disabled={!checkAllowed('/alert-monitor')}
              onPointerDown={() => handleTooltipStart('Alert Monitor')} onPointerUp={handleTooltipEnd} onPointerLeave={handleTooltipEnd}
              className={`w-8 h-8 rounded-xl flex items-center justify-center active:opacity-60 relative hover:bg-white/10 active:bg-white/20 transition-all cursor-pointer ${!checkAllowed('/alert-monitor') ? 'opacity-30 cursor-not-allowed' : ''}`}
              style={{ background: 'transparent' }}>
              <BellDot size={16} style={{ color: '#00e5ff' }} />
              {!checkAllowed('/alert-monitor') && <Lock className="w-2.5 h-2.5 text-[#00e5ff] absolute -top-1 -right-1" />}
            </button>

            {/* Threshold */}
            <button onClick={(e) => { e.stopPropagation(); setShowThresholdSettings(!showThresholdSettings); }}
              onPointerDown={() => handleTooltipStart('Threshold')} onPointerUp={handleTooltipEnd} onPointerLeave={handleTooltipEnd}
              className={`w-8 h-8 rounded-xl flex items-center justify-center active:opacity-60 relative hover:bg-white/10 active:bg-white/20 transition-all cursor-pointer ${showThresholdSettings ? 'bg-white/10' : ''}`}
              style={{ background: 'transparent' }}>
              <Settings size={16} className={showThresholdSettings ? 'rotate-45' : ''} style={{ color: showThresholdSettings ? '#00e5ff' : '#94a3b8', transition: 'transform 0.3s' }} />
            </button>
          </div>

          {/* AI Assistant */}
          <button onClick={onAiClick}
            onPointerDown={() => handleTooltipStart('AI Assistant')} onPointerUp={handleTooltipEnd} onPointerLeave={handleTooltipEnd}
            className="w-8 h-8 rounded-xl flex items-center justify-center active:opacity-60 relative hover:bg-white/10 active:bg-white/20 transition-all cursor-pointer"
            style={{ background: 'transparent' }}>
            <Bot size={16} style={{ color: '#00e5ff' }} />
          </button>

          <button onClick={() => setShowProfileModal(true)} className="flex items-center gap-1.5 active:opacity-60 shrink-0 ml-0.5">
            {userProfile && <span className="text-[11px] font-semibold text-slate-400 hidden sm:block">{userProfile.name}</span>}
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden flex items-center justify-center shadow-[0_0_10px_rgba(0,229,255,0.2)] shrink-0"
              style={{ border: '1px solid #00e5ff', background: '#102428' }}>
              {userProfile?.profile_picture
                ? <img src={userProfile.profile_picture} alt="Profile" className="w-full h-full object-cover" />
                : <User size={14} className="text-slate-400" />}
            </div>
          </button>
        </div>

        {/* Tooltip */}
        {activeTooltip && (
          <div className="fixed left-1/2 -translate-x-1/2 z-[200]" style={{ top: 'calc(70px + env(safe-area-inset-top, 0px))' }}>
            <div className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-slate-200 tracking-widest uppercase"
              style={{ background: '#1e40af', border: '1px solid rgba(96,165,250,0.4)' }}>
              {activeTooltip}
            </div>
          </div>
        )}
      </nav>

      {/* Top Banner Messages */}
      {messages.length > 0 && (
        <div className="fixed left-1/2 -translate-x-1/2 z-[150] w-full max-w-md p-4 space-y-2" style={{ top: 'calc(70px + env(safe-area-inset-top, 0px))' }}>
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex items-center justify-between p-3 rounded-xl shadow-lg animate-in fade-in slide-in-from-top-2 duration-300
                ${msg.type === 'error' ? 'bg-[#00e5ff] text-slate-200' : 'bg-[#00e5ff] text-slate-200'}
              `}
            >
              <p className="text-sm font-medium">{msg.text}</p>
              <button
                onClick={() => dismissMessage(msg.id)}
                className="ml-2 p-1 rounded-full hover:bg-white/20 transition-colors shrink-0"
              >
                <X className="w-5 h-5 text-slate-200" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Notification Drawer Panel */}
      {showNotifications && (
        <div className="fixed inset-0 z-[110] flex justify-end animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowNotifications(false)} />
          <div className="w-full max-w-sm bg-[#0a1c20] h-full shadow-[0_0_30px_rgba(0,0,0,0.8)] relative z-10 animate-in slide-in-from-right duration-500 flex flex-col border-l border-white/10">
            <div className="p-6 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-[#00e5ff]/10 to-transparent">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 relative group overflow-hidden shrink-0"
                  style={{
                    background: 'linear-gradient(135deg, rgba(0,229,255,0.15) 0%, rgba(0,229,255,0.05) 100%)',
                    border: '1px solid #00e5ff',
                    boxShadow: '0 0 15px rgba(0,229,255,0.3)'
                  }}>
                  <Bell className="w-5 h-5 text-[#00e5ff] drop-shadow-[0_0_8px_rgba(0,229,255,0.8)]" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-200 text-lg">알림 센터</h3>
                  <p className="text-[10px] text-[#00e5ff] font-mono uppercase">Notification Center</p>
                </div>
              </div>
              <button
                onClick={() => setShowNotifications(false)}
                className="p-2 rounded-full hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {allNotifications.length > 0 ? (
                allNotifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => {
                      setShowNotifications(false);
                    if (n.type === 'SMS') {
                      navigate('/chat');
                    } else {
                      // Blocked legacy assignment-detail link
                    }
                    }}
                    className={`p-4 rounded-2xl border ${n.severity === 'CRITICAL' ? 'bg-[#00e5ff]/5 border-[#00e5ff]/30 shadow-[0_0_15px_rgba(0,229,255,0.15)]' : 'bg-[#102428] border-white/10 hover:border-[#00e5ff]/50 hover:shadow-[0_0_15px_rgba(0,229,255,0.2)]'} transition-all cursor-pointer group active:scale-[0.98] relative`}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setAllNotifications(prev => prev.filter(item => item.id !== n.id));
                      }}
                      className="absolute right-3 top-3 p-1 rounded-lg hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-all z-10"
                    >
                      <X className="w-3.5 h-3.5 text-slate-500 hover:text-[#00e5ff]" />
                    </button>

                    <div className="flex justify-between items-start mb-2 pr-6">
                      <div className="flex items-center gap-2">
                        {n.type === 'AI' ? (
                          <Brain className="w-3.5 h-3.5 text-[#00e5ff]" />
                        ) : (
                          <MessageSquare className="w-3.5 h-3.5 text-[#00e5ff]" />
                        )}
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${n.severity === 'CRITICAL' ? 'bg-[#00e5ff]/20 text-[#00e5ff] border border-[#00e5ff]/30' : 'bg-[#00e5ff]/20 text-[#00e5ff] border border-[#00e5ff]/30'}`}>
                          {n.type}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">{n.time}</span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-200 mb-1 group-hover:text-[#00e5ff] transition-colors line-clamp-1">{n.title}</h4>
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">{n.content}</p>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-center space-y-4 opacity-50">
                  <Bell className="w-12 h-12 text-slate-600" />
                  <div>
                    <p className="text-sm font-bold text-slate-400">새로운 알림이 없습니다.</p>
                    <p className="text-[10px] text-slate-500">실시간으로 수집되는 정보를 기다리고 있습니다.</p>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-white/10">
              <button
                onClick={() => {
                  setAllNotifications([]);
                  setShowNotifications(false);
                }}
                className="w-full py-3 rounded-xl bg-slate-800 text-slate-400 text-xs font-bold hover:bg-slate-700 transition-colors"
              >
                모든 알림 지우기
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ── MAIN BENTO GRID SCROLL ───────────────────────────────── */}
      <div className="px-3.5 pt-5 sm:pt-6 grid grid-cols-1 md:grid-cols-2 gap-4" style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>

        {/* ── PANEL 1: SMS FEED (Bento Wide) ── */}
        {(() => {
          const isCrit = smsMessages.some(m => m.severity === 'CRITICAL' || m.severity === 'MAJOR');
          const borderGlow = isCrit ? 'rgba(0,229,255,0.6)' : 'rgba(0,229,255,0.5)';
          const borderColor = isCrit ? '#00e5ff' : '#00e5ff';
          return (
        <div className="md:col-span-2 transition-all duration-300 shadow-2xl relative" style={{
          background: 'linear-gradient(180deg, #102428 0%, #081619 100%)',
          border: `1px solid ${borderColor}`,
          borderRadius: 24,
          overflow: 'hidden',
          boxShadow: `0 0 25px ${borderGlow}, inset 0 1px 0 rgba(255,255,255,0.1)`,
          backdropFilter: 'blur(20px)'
        }}>

          {/* Panel header */}
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
            <div className="flex items-center gap-2.5">
              <MessageSquare size={16} style={{ color: borderColor, filter: `drop-shadow(0 0 8px ${borderColor})` }} />
              <span className="text-[12px] font-black text-slate-200 uppercase tracking-[0.15em]">실시간 SMS 수신내역</span>
            </div>
            <div className="flex items-center gap-3">
              {/* Hide Done toggle */}
              <button onClick={(e) => { e.stopPropagation(); setHideCompletedSms(!hideCompletedSms); }}
                className="flex items-center gap-1.5 active:opacity-60">
                <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: hideCompletedSms ? '#00e5ff' : '#475569' }}>Done 숨김</span>
                <div className="w-7 h-3.5 rounded-full relative" style={{ background: hideCompletedSms ? '#00e5ff' : '#1e293b', border: '1px solid rgba(255,255,255,0.1)', boxShadow: hideCompletedSms ? '0 0 8px #00e5ff' : 'none' }}>
                  <div className="absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white" style={{ left: hideCompletedSms ? '13px' : '1px', transition: 'left 0.2s' }} />
                </div>
              </button>
              {/* LIVE dot */}
              {(() => {
                const isLive = smsMessages.length > 0 && smsMessages.some(m => !m.is_analyzed || Number(m.is_analyzed) === 0);
                return (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg"
                    style={{ border: `1px solid ${isLive ? '#00e5ff' : 'rgba(255,255,255,0.15)'}`, background: isLive ? 'rgba(0,229,255,0.1)' : 'transparent', boxShadow: isLive ? '0 0 10px rgba(0,229,255,0.3)' : 'none' }}>
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: isLive ? '#00e5ff' : '#475569', boxShadow: isLive ? '0 0 8px #00e5ff' : 'none' }} />
                    <span className="text-[9px] font-black tracking-widest" style={{ color: isLive ? '#00e5ff' : '#64748b' }}>{isLive ? 'LIVE' : 'DONE'}</span>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Threshold panel */}
          <div style={{ maxHeight: showThresholdSettings ? 200 : 0, overflow: 'hidden', transition: 'max-height 0.3s', borderBottom: showThresholdSettings ? '1px solid rgba(255,255,255,0.08)' : 'none', background: 'rgba(0,229,255,0.05)' }}>
            <div className="px-5 py-4 space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Technical Threshold</span>
                  <span className="text-[10px] font-black font-mono" style={{ color: '#00e5ff', textShadow: '0 0 8px rgba(0,229,255,0.5)' }}>{(thresholds.technical * 100).toFixed(0)}%</span>
                </div>
                <input type="range" min="0.5" max="1.0" step="0.01" value={thresholds.technical}
                  onChange={(e) => setThresholds(prev => ({ ...prev, technical: parseFloat(e.target.value) }))}
                  onMouseUp={() => updateThreshold('similarity_threshold_technical', thresholds.technical)}
                  className="w-full h-1 rounded appearance-none cursor-pointer accent-[#00e5ff]" style={{ background: 'rgba(255,255,255,0.15)' }} />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Casual Strictness</span>
                  <span className="text-[10px] font-black font-mono" style={{ color: '#00e5ff', textShadow: '0 0 8px rgba(0,229,255,0.5)' }}>{(thresholds.casual * 100).toFixed(0)}%</span>
                </div>
                <input type="range" min="0.7" max="1.0" step="0.01" value={thresholds.casual}
                  onChange={(e) => setThresholds(prev => ({ ...prev, casual: parseFloat(e.target.value) }))}
                  onMouseUp={() => updateThreshold('similarity_threshold_casual', thresholds.casual)}
                  className="w-full h-1 rounded appearance-none cursor-pointer accent-[#00e5ff]" style={{ background: 'rgba(255,255,255,0.15)' }} />
              </div>
            </div>
          </div>

          {/* SMS list */}
          <div 
            ref={smsListContainerRef}
            onScroll={checkSmsScroll}
            className="overflow-y-auto max-h-[420px] p-3 space-y-2 custom-scrollbar"
          >
            {visibleSms.length > 0 ? visibleSms.map((msg) => {
              const isSel = selectedSms?.inc_id === msg.inc_id;
              const isCrit = msg.severity === 'CRITICAL';
              const isMaj = msg.severity === 'MAJOR';
              const accentColor = isSel ? '#00e5ff' : isCrit ? '#00e5ff' : isMaj ? '#00e5ff' : '#00e5ff';
              return (
                <div key={`sms-${msg.inc_id}`}
                  onClick={() => {
                    if (selectedSms?.inc_id === msg.inc_id) { setSelectedSms(null); selectedSmsRef.current = null; setShowAgentPanel(false); setAgentMessages([]); }
                    else { setSelectedSms(msg); selectedSmsRef.current = msg; setShowAgentPanel(true); setAgentMessages([{ role: 'Security', text: '🔍 AI 분석을 시작합니다...', delay: 0 }]); }
                  }}
                  className="rounded-2xl p-4.5 cursor-pointer transition-all duration-200 hover:scale-[0.99] active:scale-[0.98] flex flex-col gap-3 relative overflow-hidden"
                  style={{
                    background: isSel ? 'rgba(0,229,255,0.08)' : 'rgba(18,21,26,0.85)',
                    borderTop: '1px solid rgba(255,255,255,0.05)',
                    borderRight: '1px solid rgba(255,255,255,0.05)',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    borderLeft: `4px solid ${accentColor}`,
                    borderRadius: 16,
                    boxShadow: isSel ? `0 0 15px ${accentColor}40` : '0 4px 15px rgba(0,0,0,0.4)'
                  }}>
                  {/* Header: Notification Type & Severity */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {msg.keyword_detected ? <AlertCircle size={15} style={{ color: accentColor }} /> : <Info size={15} style={{ color: accentColor }} />}
                      <span className="text-[12px] font-bold tracking-wide text-slate-300 uppercase">
                        {msg.sender === 'Manual Entry' || msg.channel === 'MANUAL' ? 'Manual Registration' : 'SMS Detected'}
                      </span>
                      {msg.severity && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider"
                          style={{ color: accentColor, border: `1px solid ${accentColor}`, background: `${accentColor}15` }}>
                          {msg.severity}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">{formatYYMMDD(msg.timestamp)}</span>
                  </div>

                  {/* Main Contents: SMS Message */}
                  {renderFormattedSMS(msg.message, msg.severity)}

                  {/* Sub Contents: Sender & Employee Chip */}
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                    <span>발신: <span className="font-mono text-slate-200 font-semibold">{msg.sender}</span></span>
                    {msg.employee_id && (
                      <>
                        <span className="text-slate-600">|</span>
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-lg font-mono shrink-0 flex items-center gap-1 shadow-sm"
                          style={{ color: '#cbd5e1', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}>
                          👤 담당자: {msg.employee_id}{msg.sender_name && ` (${msg.sender_name})`}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Footer / Right Action Bar */}
                  <div className="flex items-center justify-between mt-1 pt-3.5 border-t border-white/5">
                    {msg.similarity_score != null ? (() => {
                      const score = msg.similarity_score;
                      let matchColor = '#00e5ff';
                      let matchBg = 'rgba(0,229,255,0.1)';
                      let matchBorder = 'rgba(0,229,255,0.2)';
                      if (score >= 0.8) {
                        matchColor = '#f87171'; // Coral Red
                        matchBg = 'rgba(248,113,113,0.15)';
                        matchBorder = 'rgba(248,113,113,0.3)';
                      } else if (score >= 0.5) {
                        matchColor = '#fb923c'; // Amber/Orange
                        matchBg = 'rgba(251,146,60,0.15)';
                        matchBorder = 'rgba(251,146,60,0.3)';
                      }
                      return (
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg border uppercase tracking-wider flex items-center gap-1 shrink-0 font-mono"
                          style={{ color: matchColor, background: matchBg, borderColor: matchBorder }}>
                          ⚡ Match {(score * 100).toFixed(1)}%
                        </span>
                      );
                    })() : <span />}

                    <div className="flex items-center gap-2 ml-auto">
                      {(() => {
                        const isDone = msg.incident_status === '처리완료' || Number(msg.is_analyzed) >= 1;
                        return (
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg shrink-0 ${!isDone ? 'animate-pulse bg-[#00e5ff]/15 text-[#00e5ff] border border-[#00e5ff]/30 shadow-[0_0_8px_rgba(0,229,255,0.2)] font-black' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold'}`}>
                            {msg.incident_status === '처리완료' ? '완료' : Number(msg.is_analyzed) >= 1 ? 'ANALYZED' : 'ANALYZING'}
                          </span>
                        );
                      })()}

                      <button onClick={(e) => { e.stopPropagation(); navigate(`/workflow/${msg.inc_id}`); }}
                        className="text-[10px] font-bold px-3 py-1 rounded-lg active:scale-95 transition-all hover:bg-[#00e5ff]/20 shrink-0 shadow-sm"
                        style={{ color: '#00e5ff', border: '1px solid #00e5ff', background: 'rgba(0,229,255,0.1)' }}>
                        현황
                      </button>

                      {(msg.incident_status === '처리완료' || msg.incident_status === 'Completed' || msg.status === '처리완료' || msg.status === 'Completed' || Number(msg.is_analyzed) >= 1) && (
                        <button onClick={(e) => { e.stopPropagation(); navigate(`/ai-report/${msg.inc_id}`); }}
                          className="text-[10px] font-bold px-3 py-1 rounded-lg active:scale-95 transition-all text-[#ff4a4a] hover:bg-[#ff4a4a]/30 shrink-0 shadow-sm"
                          style={{ border: '1px solid #ff4a4a', background: 'rgba(255,74,74,0.15)' }}>
                          REPORT
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            }) : (
              <div className="py-12 flex flex-col items-center gap-3 opacity-30">
                <MessageSquare size={28} className="text-[#00e5ff]" />
                <p className="text-[11px] font-bold text-[#00e5ff] uppercase tracking-wider">수신된 SMS 없음</p>
              </div>
            )}
          </div>

          {/* Floating scroll indicator */}
          {showSmsScrollIndicator && (
            <div 
              onClick={() => {
                if (smsListContainerRef.current) {
                  smsListContainerRef.current.scrollTo({ top: smsListContainerRef.current.scrollHeight, behavior: 'smooth' });
                }
              }}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 cursor-pointer animate-bounce flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#081820] text-[#00e5ff] border border-[#00e5ff]/50 font-black text-xs shadow-[0_0_15px_rgba(0,229,255,0.3)] transition-all hover:scale-105 active:scale-95 select-none"
            >
              <span>아래 수신내역 더보기</span>
              <ChevronDown className="w-4 h-4 text-[#00e5ff] shrink-0" />
            </div>
          )}
        </div>
          );
        })()}

        {/* ── PANEL 2: AI Insight (Bento Wide) ── */}
        {(visibleSms.length > 0 || selectedSms) && (
          <div className="md:col-span-2 transition-all duration-300 shadow-2xl" style={{
            background: 'linear-gradient(180deg, #102428 0%, #081619 100%)',
            border: '1px solid #00e5ff',
            borderRadius: 24,
            overflow: 'hidden',
            boxShadow: '0 0 25px rgba(0,229,255,0.25), inset 0 1px 0 rgba(255,255,255,0.1)',
            backdropFilter: 'blur(20px)'
          }}>
            <AiInsightPanel
              onLogReceived={handleLogReceived}
              onShowDetail={handleShowInsight}
              selectedSms={insightSms}
              onOpenWarRoom={handleOpenWarRoomFromInsight}
              onAnalyzingChange={setIsAnalyzingActive}
              isOpening={isOpeningWarRoom}
              onAgentContent={handleAgentContent}
              warRooms={warRooms}
              hideWarRoomButton={true}
              onAnalysisComplete={handleAnalysisComplete}
            />
          </div>
        )}

        {/* ── PANEL 3: Expert Advisor (Bento Card) ── */}
        <div className="md:col-span-1 transition-all duration-300 flex flex-col shadow-2xl" style={{
          background: 'linear-gradient(180deg, #102428 0%, #081619 100%)',
          border: '1px solid #00e5ff',
          borderRadius: 24,
          overflow: 'hidden',
          boxShadow: '0 0 25px rgba(0,229,255,0.25), inset 0 1px 0 rgba(255,255,255,0.1)',
          backdropFilter: 'blur(20px)'
        }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
            <div className="flex items-center gap-2.5">
              <Sparkles size={16} style={{ color: '#00e5ff', filter: 'drop-shadow(0 0 8px #00e5ff)' }} />
              <span className="text-[12px] font-black text-slate-200 uppercase tracking-[0.15em]">Expert Advisor</span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setActiveLogTab('ai')}
                className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all"
                style={{ background: activeLogTab === 'ai' ? 'rgba(0,229,255,0.2)' : 'transparent', color: activeLogTab === 'ai' ? '#00e5ff' : '#64748b', border: activeLogTab === 'ai' ? '1px solid #00e5ff' : '1px solid rgba(255,255,255,0.15)', textShadow: activeLogTab === 'ai' ? '0 0 8px rgba(0,229,255,0.5)' : 'none' }}>
                AI
              </button>
              <button onClick={() => setActiveLogTab('human')}
                className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ml-0.5 transition-all"
                style={{ background: activeLogTab === 'human' ? 'rgba(0,229,255,0.2)' : 'transparent', color: activeLogTab === 'human' ? '#00e5ff' : '#64748b', border: activeLogTab === 'human' ? '1px solid #00e5ff' : '1px solid rgba(255,255,255,0.15)', textShadow: activeLogTab === 'human' ? '0 0 8px rgba(0,229,255,0.5)' : 'none' }}>
                Chat
              </button>
              {(() => {
                const isDone = selectedSms && Number(selectedSms.is_analyzed) >= 1;
                const isLive = showAgentPanel && agentMessages.length > 0 && !isDone;
                return (
                  <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg ml-1"
                    style={{ border: `1px solid ${isLive ? '#00e5ff' : 'rgba(255,255,255,0.15)'}`, background: isLive ? 'rgba(0,229,255,0.1)' : 'transparent', boxShadow: isLive ? '0 0 8px rgba(0,229,255,0.3)' : 'none' }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: isDone ? '#64748b' : isLive ? '#00e5ff' : '#64748b', boxShadow: isLive ? '0 0 6px #00e5ff' : 'none' }} />
                    <span className="text-[9px] font-black tracking-widest" style={{ color: isDone ? '#94a3b8' : isLive ? '#00e5ff' : '#94a3b8' }}>
                      {isDone ? 'DONE' : isLive ? 'LIVE' : 'IDLE'}
                    </span>
                  </div>
                );
              })()}
            </div>
          </div>
          <div className="flex-1 flex flex-col" style={{ minHeight: 360 }}>
            {showAgentPanel || selectedSms ? (
              activeLogTab === 'ai' ? (
                <AgentDiscussionPanel
                  messages={agentMessages}
                  isVisible={true}
                  embedded={true}
                  incident={selectedSms}
                  onClose={() => { setShowAgentPanel(false); setSelectedSms(null); }}
                />
              ) : typeof document !== 'undefined' ? createPortal(
                <div className="fixed inset-0 z-[500] bg-[#0a0c12] flex flex-col h-[100dvh]">
                  {/* 헤더 영역 (닫기 버튼 포함) */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0 bg-[#0a0c12] z-10">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-[#00e5ff]/20 flex items-center justify-center border border-[#00e5ff]/30">
                        <MessageSquare className="w-4 h-4 text-[#00e5ff]" />
                      </div>
                      <div>
                        <h2 className="text-sm font-black text-slate-200 uppercase tracking-wider">War-Room Chat</h2>
                        <p className="text-[10px] text-slate-400 font-mono">Expert Advisor Collaboration</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setActiveLogTab('ai')}
                      className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-300 text-xs font-bold active:scale-95 transition-all"
                    >
                      닫기
                    </button>
                  </div>
                  {/* 채팅 패널 영역 (스크롤을 여기서 처리) */}
                  <div className="flex-1 min-h-0 relative">
                    <WarRoomChatPanel incidentId={selectedSms?.inc_id} currentUser={userProfile || {}} isVisible={true} />
                  </div>
                </div>,
                document.body
              ) : null
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center opacity-30" style={{ minHeight: 240 }}>
                <Brain size={32} className="text-[#00e5ff] mb-3 filter drop-shadow-[0_0_8px_rgba(0,229,255,0.5)]" />
                <p className="text-[11px] font-bold text-[#00e5ff] uppercase tracking-wider">SMS를 선택하면 분석이 시작됩니다</p>
              </div>
            )}
          </div>
        </div>

        {/* ── PANEL 4: 장애 처리 현황 (Bento Card) ── */}
        {(() => {
          const isActive = !!selectedIncidentIdFlow;
          const isClosedFlow = incidentWorkflowSteps.some(s => s.id === 'KNOWLEDGE');
          return (
        <div className="md:col-span-1 transition-all duration-300 flex flex-col shadow-2xl" style={{
          background: 'linear-gradient(180deg, #102428 0%, #081619 100%)',
          border: `1px solid ${isActive ? (isClosedFlow ? '#10b981' : '#00e5ff') : 'rgba(255,255,255,0.15)'}`,
          borderRadius: 24,
          overflow: 'hidden',
          boxShadow: isActive
            ? (isClosedFlow ? '0 0 20px rgba(16,185,129,0.2), inset 0 1px 0 rgba(255,255,255,0.1)' : '0 0 25px rgba(0,229,255,0.3), inset 0 1px 0 rgba(255,255,255,0.1)')
            : '0 8px 24px -5px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
          backdropFilter: 'blur(20px)'
        }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
            <div className="flex items-center gap-2.5">
              <Activity size={16} style={{ color: selectedIncidentIdFlow ? (isClosedFlow ? '#10b981' : '#00e5ff') : '#94a3b8', filter: selectedIncidentIdFlow && !isClosedFlow ? 'drop-shadow(0 0 8px #00e5ff)' : 'none' }} />
              <span className="text-[12px] font-black text-slate-200 uppercase tracking-[0.15em]">장애 처리 현황</span>
            </div>
            {isClosedFlow ? (
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-inner">
                <Check size={12} />COMPLETED FLOW
              </span>
            ) : (
              <span className="text-[10px] font-bold text-[#00e5ff] bg-[#00e5ff]/10 border border-[#00e5ff]/30 px-2.5 py-1 rounded-full flex items-center gap-1.5 animate-pulse shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00e5ff] animate-ping" />LIVE FLOW
              </span>
            )}
          </div>

          {/* 가로 프로그레스 바 & 활동 링 */}
          {selectedIncidentIdFlow && (() => {
            const smsStep = incidentWorkflowSteps.find(s => s.id === 'SMS');
            const ragStep = incidentWorkflowSteps.find(s => s.id === 'RAG') || incidentWorkflowSteps.find(s => s.id === 'AGENT');
            const warStep = incidentWorkflowSteps.find(s => s.id === 'WARROOM');
            const knwStep = incidentWorkflowSteps.find(s => s.id === 'KNOWLEDGE');
            const diffObj = (a, b) => { if (!a) return null; const ms = (b ? new Date(b.timestamp) : currentTime) - new Date(a.timestamp); const m = Math.floor(ms/60000), s2 = Math.floor((ms%60000)/1000); return { text: m > 0 ? `${m}m ${s2}s` : `${s2}s`, min: m }; };

            const durationMs = (knwStep ? new Date(knwStep.timestamp) : currentTime) - new Date(smsStep?.timestamp || currentTime);
            const isClosed = !!knwStep;

            const steps = [
              { id: 'SMS', label: '문자수신', done: !!smsStep || !!ragStep || !!warStep || !!knwStep, active: false, dObj: null },
              { id: 'RAG', label: 'RAG분석완료', done: !!ragStep || !!warStep || !!knwStep, active: !!smsStep && !ragStep, dObj: diffObj(smsStep, ragStep) },
              { id: 'WARROOM', label: '담당자인지(워룸개설)', done: !!warStep || !!knwStep, active: !!ragStep && !warStep, dObj: diffObj(ragStep, warStep) },
              { id: 'KNOWLEDGE', label: '처리완료(보고/지식화)', done: !!knwStep, active: !!warStep && !knwStep, dObj: diffObj(warStep, knwStep) }
            ];

            const radius = 70;
            const circum = 2 * Math.PI * radius;
            const progressPct = knwStep ? 100 : warStep ? 75 : ragStep ? 50 : smsStep ? 25 : 0;
            const offset = circum - (progressPct / 100) * circum;

            const ringColor = isClosed ? '#10b981' : '#00e5ff';
            const ringShadow = isClosed ? 'drop-shadow(0 0 4px rgba(16, 185, 129, 0.3))' : 'drop-shadow(0 0 10px rgba(0, 229, 255, 0.5))';

            return (
              <div className="flex flex-col">
                {/* 가로 프로그레스 바 (Horizontal Stepper) */}
                <div className="flex items-center justify-between px-6 py-5 bg-black/20 border-b border-white/5 relative">
                  {steps.map((st, i) => {
                    const isDone = st.done;
                    const isActive = st.active;
                    const isBottleneck = st.dObj?.min > 60;
                    return (
                      <React.Fragment key={st.id}>
                        <div className="relative z-10 flex flex-col items-center gap-1.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all ${isDone ? (isBottleneck ? 'bg-[#fb923c] text-black shadow-[0_0_12px_rgba(251,146,60,0.6)] ring-2 ring-orange-400 font-black' : 'bg-[#00e5ff] text-black opacity-80') : isActive ? 'bg-[#00e5ff] text-black ring-4 ring-[#00e5ff]/30 animate-pulse shadow-[0_0_12px_#00e5ff]' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}>
                            {isDone ? <CheckCircle2 size={16} /> : i + 1}
                          </div>
                          <span className={`text-[11px] font-black tracking-tight ${isBottleneck ? 'text-[#fb923c]' : isDone ? 'text-[#00e5ff]' : isActive ? 'text-[#00e5ff]' : 'text-slate-500'}`}>{st.label}</span>
                        </div>
                        {i < steps.length - 1 && (() => {
                          const nextStep = steps[i + 1];
                          const durationObj = nextStep.dObj;
                          const isNextStepDone = nextStep.done;
                          const isNextStepActive = nextStep.active;
                          const isArrowBottleneck = durationObj?.min > 60;
                          return (
                            <div className="flex-1 flex flex-col items-center justify-center px-1">
                              <div className="w-8 h-8 flex items-center justify-center">
                                <svg className={`w-5 h-5 ${isNextStepDone ? 'text-[#00e5ff]' : isNextStepActive ? 'text-[#00e5ff] animate-pulse' : 'text-slate-700'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                                </svg>
                              </div>
                              {durationObj ? (
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded shadow-sm font-mono mt-1.5 whitespace-nowrap ${isArrowBottleneck ? 'bg-orange-500/20 text-[#fb923c] border border-orange-500/40 animate-pulse' : 'bg-slate-900 text-[#ffffff] border border-white/20'}`}>
                                  {durationObj.text}
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-600 font-mono mt-1.5">-</span>
                              )}
                            </div>
                          );
                        })()}
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* 애플워치 스타일 활동 링 (Activity Ring) */}
                <div className="py-8 flex flex-col items-center justify-center bg-gradient-to-b from-black/40 to-transparent relative">
                  <div className="relative w-52 h-52 flex items-center justify-center">
                    <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 180 180">
                      <defs>
                        <linearGradient id="activityGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor={ringColor} />
                          <stop offset="100%" stopColor={isClosed ? '#059669' : '#00e5ff'} />
                        </linearGradient>
                      </defs>
                      <circle cx="90" cy="90" r="70" stroke="#1e293b" strokeWidth="12" fill="none" />
                      <circle cx="90" cy="90" r="70" stroke="url(#activityGradient)" strokeWidth="12" fill="none" strokeDasharray={circum} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-1000" filter={ringShadow} />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">MTTR TIMER</span>
                      <span className="text-3xl font-black font-mono tracking-tighter tabular-nums" style={{ color: ringColor, textShadow: isClosed ? '0 0 10px rgba(16,185,129,0.3)' : '0 0 15px rgba(0,229,255,0.8)' }}>
                        {formatDuration(durationMs)}
                      </span>
                      <span className={`text-[11px] font-bold mt-2 px-3 py-1 rounded-full border shadow-inner ${isClosed ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' : 'bg-white/5 border-white/10 text-slate-300'}`}>
                        {isClosed ? '조치 완료 (SAFE)' : '실시간 대응 중'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 워룸 이동/개설 액션 및 아코디언 버튼 */}
                <div className="px-5 pb-5 flex flex-col gap-3">
                  {warStep && !knwStep && (() => {
                    const roomExists = warRooms.some(r => String(r.id) === String(selectedIncidentIdFlow) || String(r.inc_id) === String(selectedIncidentIdFlow));
                    return roomExists ? (
                      <button onClick={() => navigate(`/chat/${selectedIncidentIdFlow}`)} className="skeuo-btn w-full py-3.5 bg-gradient-to-r from-[#00e5ff]/20 to-[#00e5ff]/10 border border-[#00e5ff]/50 rounded-xl font-bold text-sm text-[#00e5ff] flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(0,229,255,0.3)]">
                        <Zap size={16} />해당 워룸으로 이동<ChevronRight size={16} />
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleOpenWarRoomFromInsight(selectedSms)} 
                        disabled={isOpeningWarRoom}
                        className={`skeuo-btn w-full py-3.5 bg-gradient-to-r from-[#00e5ff]/20 to-[#00e5ff]/10 border border-[#00e5ff]/50 rounded-xl font-bold text-sm text-[#00e5ff] flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(0,229,255,0.3)] ${isOpeningWarRoom ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <Users size={16} />{isOpeningWarRoom ? '워룸 개설 진행 중...' : '긴급 워룸 개설하기'}
                      </button>
                    );
                  })()}

                  <button
                    onClick={() => setShowFullTimeline(!showFullTimeline)}
                    className="skeuo-btn w-full py-3.5 px-4 bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 rounded-xl text-slate-300 font-bold text-xs flex items-center justify-between transition-all shadow-sm"
                  >
                    <span className="flex items-center gap-2">
                      <Clock size={16} className="text-[#00e5ff]" />
                      전체 스텝 상세 히스토리 타임라인 {showFullTimeline ? '접기' : '보기'}
                    </span>
                    {showFullTimeline ? <ChevronUp size={22} className="text-[#00e5ff] shrink-0 ml-auto" /> : <ChevronDown size={22} className="text-slate-300 shrink-0 ml-auto" />}
                  </button>
                </div>
              </div>
            );
          })()}

          {/* 기존 상세 Timeline (아코디언 토글 시에만 노출) */}
          <div className={`transition-all duration-300 overflow-hidden ${showFullTimeline ? 'block border-t border-white/5 bg-black/20' : 'hidden'}`}>
            <div className="p-5 flex-1">
              {selectedIncidentIdFlow ? (
              <div className="relative">
                <div className="absolute left-[9px] top-0 bottom-0 w-px" style={{ background: 'rgba(255,255,255,0.1)' }} />
                {(() => {
                  const firstPendingIdx = FLOW_STEPS.findIndex(step => {
                    if (step.id === 'RAG_AGENT') {
                      const isDone = (selectedSms && Number(selectedSms.is_analyzed) >= 1) || 
                                    incidentWorkflowSteps.find(s=>s.id==='RAG') || 
                                    incidentWorkflowSteps.find(s=>s.id==='AGENT');
                      return !isDone;
                    }
                    return !incidentWorkflowSteps.find(s=>s.id===step.id);
                  });
                  return FLOW_STEPS.map((step, sIdx) => {
                    let stepData = incidentWorkflowSteps.find(s=>s.id===step.id);
                    if (step.id==='RAG_AGENT'){
                      const rag=incidentWorkflowSteps.find(s=>s.id==='RAG'), agent=incidentWorkflowSteps.find(s=>s.id==='AGENT');
                      const isAnalyzed = selectedSms && Number(selectedSms.is_analyzed) >= 1;
                      
                      if(rag && agent) {
                        stepData={...agent,id:'RAG_AGENT',timestamp:agent.timestamp>rag.timestamp?agent.timestamp:rag.timestamp,detail:'AI 에이전트 그룹이 수천 건의 과거 데이터와 내부 지식베이스를 결합하여 인시던트 근본 원인을 입체적으로 분석하고 대응 시나리오를 수립했습니다.'};
                      } else if(rag || agent) {
                        stepData={...(rag||agent),id:'RAG_AGENT'};
                      } else if(isAnalyzed) {
                        stepData={id:'RAG_AGENT', timestamp: selectedSms.timestamp, detail: 'AI 엔진의 지능형 분석이 완료되었습니다.'};
                      }
                    }
                    if(step.id==='WARROOM'&&stepData?.detail?.includes('2.0님'))stepData.detail=stepData.detail.replace('2.0님','조경훈님');
                    const isCompleted=!!stepData, isNextStep=sIdx===firstPendingIdx;
                    let intervalText=null, intervalMinutes=0;
                    if (sIdx > 0) {
                      let prevStep = FLOW_STEPS[sIdx - 1];
                      let prevLog = incidentWorkflowSteps.find(s => s.id === prevStep.id);
                      if (!prevLog && prevStep.id === 'RAG_AGENT') {
                        prevLog = incidentWorkflowSteps.find(s => s.id === 'RAG') || incidentWorkflowSteps.find(s => s.id === 'AGENT');
                      }
                      if (!prevLog && prevStep.id === 'SMS' && selectedSms) {
                        prevLog = { timestamp: selectedSms.timestamp || selectedSms.reg_dt };
                      }
                      
                      if (prevLog && prevLog.timestamp) {
                        if (isCompleted) {
                          const ms = new Date(stepData.timestamp) - new Date(prevLog.timestamp);
                          const m = Math.floor(ms / 60000), sec = Math.floor((ms % 60000) / 1000);
                          intervalMinutes = m;
                          intervalText = m > 60 ? `⏱ ${Math.floor(m / 60)}h ${m % 60}m` : m > 0 ? `⏱ ${m}m ${sec}s` : `⏱ ${sec}s`;
                        } else if (isNextStep) {
                          const ms = currentTime - new Date(prevLog.timestamp);
                          const m = Math.floor(ms / 60000), sec = Math.floor((ms % 60000) / 1000);
                          intervalMinutes = m;
                          intervalText = m > 60 ? `⏱ ${Math.floor(m / 60)}h ${m % 60}m 경과` : m > 0 ? `⏱ ${m}m ${sec}s 경과` : `⏱ ${sec}s 경과`;
                        }
                      }
                    }

                    const isBottleneck = isNextStep && intervalMinutes > 60;
                    
                    let transMs = 0;
                    if (sIdx < FLOW_STEPS.length - 1 && isCompleted) {
                      const nextStep = FLOW_STEPS[sIdx + 1];
                      let nextLog = incidentWorkflowSteps.find(s => s.id === nextStep.id);
                      if (!nextLog && nextStep.id === 'RAG_AGENT') {
                        nextLog = incidentWorkflowSteps.find(s => s.id === 'RAG') || incidentWorkflowSteps.find(s => s.id === 'AGENT');
                      }
                      if (nextLog && nextLog.timestamp) {
                        transMs = new Date(nextLog.timestamp) - new Date(stepData.timestamp);
                      } else if (sIdx + 1 === firstPendingIdx) {
                        transMs = currentTime - new Date(stepData.timestamp);
                      }
                    }
                    const transMins = Math.floor(transMs / 60000);
                    const isLineBottleneck = sIdx < FLOW_STEPS.length - 1 && !incidentWorkflowSteps.find(s => s.id === FLOW_STEPS[sIdx+1].id) && transMins > 60;
                    const pb = sIdx === FLOW_STEPS.length - 1 ? 24 : Math.min(160, Math.max(24, Math.round(24 + transMins * 0.2)));
                    return (
                      <div key={step.id} className="relative pl-10 transition-all duration-300" style={{ paddingBottom: pb+'px', opacity: !isCompleted&&!isNextStep ? 0.3 : 1 }}>
                        {sIdx < FLOW_STEPS.length-1 && <div className="absolute left-[9px] top-5 bottom-0 transition-all" style={{ width: isLineBottleneck ? '2px' : '1px', background: isLineBottleneck ? '#fb923c' : isCompleted ? '#00e5ff' : 'rgba(255,255,255,0.1)', boxShadow: isLineBottleneck ? '0 0 8px rgba(251,146,60,0.5)' : 'none' }} />}
                        <div className="absolute left-0 top-0 w-[18px] h-[18px] rounded-full flex items-center justify-center shadow-md transition-all" style={{ background: isBottleneck ? 'rgba(251,146,60,0.2)' : isCompleted ? 'rgba(0,229,255,0.15)' : isNextStep ? 'rgba(0,229,255,0.2)' : '#0a1c20', border: `1px solid ${isBottleneck ? '#fb923c' : isCompleted ? '#00e5ff' : isNextStep ? '#00e5ff' : 'rgba(255,255,255,0.15)'}`, boxShadow: isBottleneck ? '0 0 10px rgba(251,146,60,0.4)' : isCompleted ? 'none' : isNextStep ? '0 0 10px rgba(0,229,255,0.4)' : 'none' }}>
                          {isCompleted ? <CheckCircle2 size={10} style={{ color: isBottleneck ? '#fb923c' : '#00e5ff', opacity: isBottleneck ? 1 : 0.8 }} /> : isNextStep ? <span className="w-1.5 h-1.5 rounded-full animate-ping" style={{ background: '#00e5ff' }} /> : <span className="w-1 h-1 rounded-full" style={{ background: '#475569' }} />}
                        </div>
                        <div className="ml-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[13px] font-bold" style={{ color: isBottleneck ? '#fb923c' : isCompleted ? '#fff' : isNextStep ? '#00e5ff' : '#64748b', textShadow: isNextStep ? '0 0 8px rgba(0,229,255,0.5)' : 'none' }}>{step.label}</span>
                            {isNextStep && <span className="text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider animate-pulse" style={{ color: '#00e5ff', border: '1px solid #00e5ff', background: 'rgba(0,229,255,0.15)', boxShadow: '0 0 8px rgba(0,229,255,0.4)' }}>진행중</span>}
                            {isCompleted && <span className="text-[10px] font-mono text-slate-400">{formatYYMMDD(stepData.timestamp)}</span>}
                          </div>
                          <p className="text-[12px] leading-relaxed font-normal" style={{ color: isCompleted ? '#94a3b8' : isNextStep ? '#cbd5e1' : '#475569' }}>
                            {isCompleted ? stepData.detail : isNextStep ? '처리 진행 중...' : '대기 중'}
                          </p>
                          {intervalText && sIdx > 0 && (
                            <span className="inline-block mt-2 text-[11px] font-bold px-2.5 py-1 rounded-lg shadow-sm font-mono" style={{ color: isBottleneck ? '#fb923c' : '#ffffff', border: `1px solid ${isBottleneck ? '#fb923c' : 'rgba(255,255,255,0.3)'}`, background: isBottleneck ? 'rgba(251,146,60,0.15)' : 'rgba(255,255,255,0.1)' }}>{intervalText}</span>
                          )}
                          {(isCompleted||isNextStep)&&step.id==='WARROOM'&&(()=>{
                            const roomExists=warRooms.some(r=>String(r.id)===String(selectedIncidentIdFlow)||String(r.inc_id)===String(selectedIncidentIdFlow));
                            return roomExists?(
                              <button onClick={()=>navigate(`/chat/${selectedIncidentIdFlow}`)} className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl active:scale-95 transition-all text-[12px] font-bold shadow-[0_0_15px_rgba(0,229,255,0.3)]" style={{ color: "#00e5ff", border: "1px solid #00e5ff", background: "rgba(0,229,255,0.15)" }}>
                                <Zap size={12} />워룸 이동<ChevronRight size={12} />
                              </button>
                            ):(
                               <button 
                                 onClick={() => handleOpenWarRoomFromInsight(selectedSms)} 
                                 disabled={isOpeningWarRoom}
                                 className={`mt-2 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl active:scale-95 transition-all text-[12px] font-bold shadow-[0_0_15px_rgba(0,229,255,0.3)] ${isOpeningWarRoom ? 'opacity-50 cursor-not-allowed' : ''}`} 
                                 style={{ color: "#00e5ff", border: "1px solid #00e5ff", background: "rgba(0,229,255,0.15)" }} 
                               > 
                                 <Users size={12} />
                                 {isOpeningWarRoom ? '개설 진행 중...' : '워룸 개설하기'} 
                               </button>
                            );
                          })()}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center py-16 opacity-30" style={{ minHeight: 240 }}>
                <Activity size={32} className="text-[#00e5ff] mb-3 filter drop-shadow-[0_0_8px_rgba(0,229,255,0.5)]" />
                <p className="text-[11px] font-bold text-[#00e5ff] uppercase tracking-wider">인시던트를 선택하면 활성화됩니다</p>
              </div>
            )}
            </div>
          </div>
        </div>
          );
        })()}

      </div>

      {/* EmergencyActionModal - disabled by user request */}
      {renderProfileModal()}
      {/* AIInsightModal - disabled */}


      {/* 🚀 Dynamic Save Toast for Thresholds */}
      {saveStatus && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[300] bg-[#0a1c20] border border-[#00e5ff] text-[#00e5ff] shadow-[0_0_20px_rgba(0,229,255,0.4)] text-xs font-black px-6 py-3.5 rounded-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom duration-300">
          <CheckCircle className="w-4 h-4 animate-bounce" />
          <span>{saveStatus}</span>
        </div>
      )}
    </div>
  );
}

function MetricCard({ title, value, subValue, trend, trendUp, icon: Icon, color }) {
  const colorClasses = {
    blue: "text-[#00e5ff] bg-[#00e5ff]/10 shadow-[0_0_10px_rgba(0,229,255,0.2)] border border-[#00e5ff]/30",
    purple: "text-[#a855f7] bg-[#a855f7]/10 shadow-[0_0_10px_rgba(168,85,247,0.2)] border border-[#a855f7]/30",
    green: "text-[#00e5ff] bg-[#00e5ff]/10 shadow-[0_0_10px_rgba(0,229,255,0.2)] border border-[#00e5ff]/30",
    emerald: "text-[#00e5ff] bg-[#00e5ff]/10 shadow-[0_0_10px_rgba(0,229,255,0.2)] border border-[#00e5ff]/30",
    red: "text-[#00e5ff] bg-[#00e5ff]/10 shadow-[0_0_10px_rgba(0,229,255,0.2)] border border-[#00e5ff]/30",
    yellow: "text-[#00e5ff] bg-[#00e5ff]/10 shadow-[0_0_10px_rgba(0,229,255,0.2)] border border-[#00e5ff]/30",
  };

  return (
    <div className="bg-[#102428] p-5 rounded-2xl border border-white/10 hover:border-[#00e5ff]/50 transition-all hover:shadow-[0_0_15px_rgba(0,229,255,0.2)]">
      <div className="flex justify-between items-start mb-2">
        <div className={`p-2 rounded-lg ${colorClasses[color]} mb-2`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${trendUp ? 'text-[#00e5ff] bg-[#00e5ff]/10 border border-[#00e5ff]/30' : 'text-[#00e5ff] bg-[#00e5ff]/10 border border-[#00e5ff]/30'}`}>
            {trend}
          </span>
        )}
      </div>
      <div>
        <h4 className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">{title}</h4>
        <div className="flex items-baseline space-x-2">
          <span className="text-xl font-bold text-slate-200">{value}</span>
          {subValue && <span className="text-xs text-slate-500">{subValue}</span>}
        </div>
      </div>
    </div>
  );
}

function AlertItem({ title, time, severity, desc, isSelected }) {
  const sevColor = {
    critical: "bg-[#00e5ff] shadow-[0_0_8px_#00e5ff]",
    warning: "bg-[#00e5ff] shadow-[0_0_8px_#00e5ff]",
    info: "bg-[#00e5ff] shadow-[0_0_8px_#00e5ff]",
    success: "bg-[#00e5ff] shadow-[0_0_8px_#00e5ff]"
  };

  return (
    <div className={`flex items-start space-x-2 p-3 rounded-xl transition-all group cursor-pointer ${
      isSelected 
        ? "bg-[#00e5ff]/10 border border-[#00e5ff] shadow-[0_0_15px_rgba(0,229,255,0.3)]" 
        : "bg-[#0a1c20] border border-white/10 hover:border-[#00e5ff]/50 hover:shadow-[0_0_10px_rgba(0,229,255,0.2)]"
    }`}>
      <div className={`w-1.5 h-1.5 mt-2 rounded-full shrink-0 ${sevColor[severity]} ${isSelected ? 'animate-pulse' : ''}`}></div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start mb-1 gap-2">
          <h4 className={`font-bold text-sm transition-colors ${isSelected ? 'text-[#00e5ff]' : 'text-slate-200 group-hover:text-slate-200'}`}>{title}</h4>
          <span className="text-[11px] font-black text-slate-200 whitespace-nowrap bg-white/10 px-2 py-0.5 rounded border border-white/20 shadow-md shrink-0">
            {time}
          </span>
        </div>
        <p className={`text-xs leading-relaxed ${isSelected ? 'text-yellow-100/80' : 'text-slate-400'}`}>{desc}</p>
      </div>
    </div>
  );
}

function ProfileModalContent({ apiBase, profile, onClose, onSave, navigate }) {
  // ── 조직도 전체 트리 상태 (depth 기반 올바른 매핑) ──
  // depth1: 회사(company), depth2: 부문(honbu), depth3: 본부(team), depth4: 팀(part), depth5: 파트(subpart)
  const [companyList, setCompanyList]   = useState([]); // depth1
  const [honbuMap, setHonbuMap]         = useState({}); // company.code → depth2[]
  const [teamMap, setTeamMap]           = useState({}); // honbu.code   → depth3[]
  const [partMap, setPartMap]           = useState({}); // team.code    → depth4[]
  const [subpartMap, setSubpartMap]     = useState({}); // part.code    → depth5[]
  const [showIosManual, setShowIosManual] = useState(false);
  const [showAndroidManual, setShowAndroidManual] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    fetch(`${apiBase}/org/tree`, {
      headers: getAuthHeaders()
    })
      .then(r => r.json())
      .then(tree => {
        const cList = [];
        const hMap  = {};
        const tMap  = {};
        const pMap  = {};
        const sMap  = {};

        (tree || []).forEach(d1 => {
          // depth1 = 회사
          cList.push({ name: d1.name, code: d1.code || d1.name });
          const hList = [];

          (d1.children || []).forEach(d2 => {
            // depth2 = 부문(honbu)
            hList.push({ name: d2.name, code: d2.code || d2.name });
            const tList = [];

            (d2.children || []).forEach(d3 => {
              // depth3 = 본부(team)
              tList.push({ name: d3.name, code: d3.code || d3.name });
              const pList = [];

              (d3.children || []).forEach(d4 => {
                // depth4 = 팀(part)
                pList.push({ name: d4.name, code: d4.code || d4.name });
                const sList = [];

                (d4.children || []).forEach(d5 => {
                  // depth5 = 파트(subpart)
                  sList.push({ name: d5.name, code: d5.code || d5.name });
                });
                if (sList.length > 0) sMap[d4.code || d4.name] = sList;
              });
              if (pList.length > 0) pMap[d3.code || d3.name] = pList;
            });
            if (tList.length > 0) tMap[d2.code || d2.name] = tList;
          });
          if (hList.length > 0) hMap[d1.code || d1.name] = hList;
        });

        setCompanyList(cList);
        setHonbuMap(hMap);
        setTeamMap(tMap);
        setPartMap(pMap);
        setSubpartMap(sMap);

        // 각 레벨 전체 코드 목록 (이름↔코드 양방향 조회용)
        const allItems = { company: cList, honbu: [], team: [], part: [], subpart: [] };
        Object.values(hMap).forEach(arr => allItems.honbu.push(...arr));
        Object.values(tMap).forEach(arr => allItems.team.push(...arr));
        Object.values(pMap).forEach(arr => allItems.part.push(...arr));
        Object.values(sMap).forEach(arr => allItems.subpart.push(...arr));

        // 저장된 값이 코드인지 이름인지 멘저 조회 맞추기
        const resolve = (stored, candidates) => {
          if (!stored) return stored;
          const byCode = candidates.find(c => c.code === stored);
          if (byCode) return byCode.code; // 코드가 일치
          const byName = candidates.find(c => c.name === stored);
          if (byName) return byName.code; // 이름으로 코드 추캜
          return stored; // 일치 없으면 원래값 유지
        };

        // formData의 회사를 코드로 정리한 후 연쁨마다 resolve
        setFormData(prev => ({
          ...prev,
          company: resolve(prev.company, cList),
          honbu:   resolve(prev.honbu,   allItems.honbu),
          team:    resolve(prev.team,    allItems.team),
          part:    resolve(prev.part,    allItems.part),
          subpart: resolve(prev.subpart, allItems.subpart),
        }));
      })
      .catch(err => {
        console.error('Org tree fetch failed:', err);
        // org tree 실패해도 기존 formData 코드값 유지 — 화면에 코드가 보일 수 있지만 데이터는 보존됨
      });
  }, []);

  const [formData, setFormData] = useState({
    id: profile.id || profile.employee_id || profile.inc_id,
    name: profile.name || '',
    phone: profile.phone || '',
    company: profile.company || '',
    honbu: profile.honbu || '',
    team: profile.team || '',
    part: profile.part || '',
    subpart: profile.subpart || '',
    os_type: profile.os_type || 'android',
    profile_picture: profile.profile_picture || null,
  });

  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [profilePreview, setProfilePreview] = useState(profile.profile_picture || null);

  // ── 비밀번호 변경 상태 ──
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');  // 현재 비밀번호
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handleChange = (field) => (val) =>
    setFormData(prev => ({ ...prev, [field]: typeof val === 'string' ? val : val.target.value }));

  // 전화번호 자동 포맷: 숫자만 추출 → XXX-XXXX-XXXX
  const handlePhoneChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '');
    let formatted = digits;
    if (digits.length > 3 && digits.length <= 7) {
      formatted = `${digits.slice(0,3)}-${digits.slice(3)}`;
    } else if (digits.length > 7) {
      formatted = `${digits.slice(0,3)}-${digits.slice(3,7)}-${digits.slice(7)}`;
    }
    setFormData(prev => ({ ...prev, phone: formatted }));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드 가능합니다.');
      return;
    }

    setIsUploading(true);
    const formDataObj = new FormData();
    formDataObj.append('file', file);
    // 사번(employee_id)을 키로 사용 — incident_id 불필요
    formDataObj.append('employee_id', formData.id || profile.employee_id || profile.id || '');
    formDataObj.append('uploaded_by', profile.name || profile.employee_id || '사용자');

    try {
      const res = await fetch(`${apiBase}/warroom/upload`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': null }),
        body: formDataObj
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || '업로드 서버 오류');
      }
      const data = await res.json();
      
      setProfilePreview(data.url);
      setFormData(prev => ({ ...prev, profile_picture: data.url }));
    } catch (err) {
      console.error(err);
      alert(`프로필 이미지 업로드에 실패했습니다: ${err.message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = () => {
    if (!formData.name.trim()) { alert('이름을 입력해 주세요.'); return; }
    onSave(formData);
  };

  const handlePasswordChange = async () => {
    if (!currentPassword) { alert('현재 비밀번호를 입력해 주세요.'); return; }
    if (!newPassword) { alert('새 비밀번호를 입력해 주세요.'); return; }
    if (newPassword !== confirmPassword) { alert('비밀번호가 일치하지 않습니다.'); return; }
    if (newPassword.length < 4) { alert('비밀번호는 4자 이상이어야 합니다.'); return; }
    if (currentPassword === newPassword) { alert('새 비밀번호가 현재 비밀번호와 동일합니다.'); return; }

    setIsChangingPassword(true);
    try {
      const res = await fetch(`${apiBase}/auth/change-password`, {
        method: 'POST',
        headers: getAuthHeaders(),
        // old_password로 자체 검증 — JWT 불필요
        body: JSON.stringify({
          user_id: formData.id,
          old_password: currentPassword,
          new_password: newPassword,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        alert('비밀번호가 성공적으로 변경되었습니다.');
        setShowPasswordChange(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        alert(data.detail || '비밀번호 변경 중 오류가 발생했습니다.');
      }
    } catch {
      alert('서버와 통신 중 오류가 발생했습니다.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleLogout = async () => {
    if (window.confirm('로그아웃 하시겠습니까?')) {
      try {
        // 1. 백엔드에 로그아웃 요청 — HttpOnly 쿠키(세션) 삭제
        await fetch(`${apiBase}/auth/logout`, {
          method: 'POST',
          headers: getAuthHeaders(),
          credentials: 'include'
        }).catch(() => {});
      } finally {
        // 2. 프론트 모든 인증 정보 제거 (Ghost Token, User Cache 등)
        clearSession();
        // 3. checkSession의 localStorage 복원을 차단하는 플래그 설정
        sessionStorage.setItem('s_logged_out', '1');
        navigate('/', { replace: true });
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => {
        if (profile.dept && profile.team) onClose();
      }}></div>

      <div className="relative w-full max-w-lg bg-gradient-to-b from-[#102428] to-[#081619] border border-white/10 rounded-3xl shadow-[0_0_40px_rgba(0,0,0,0.9)] flex flex-col max-h-[90dvh] overflow-hidden animate-scale-up">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#00e5ff] to-[#00e5ff] shrink-0"></div>

        <div className="p-6 sm:p-8 flex flex-col max-h-full overflow-hidden flex-1">
          <div className="flex justify-between items-center mb-6 shrink-0">
            <h2 className="text-xl font-bold text-slate-200 flex items-center space-x-2">
              <User className="w-5 h-5 text-[#00e5ff]" />
              <span>회원 정보 관리</span>
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          <div className="flex items-center space-x-4 mb-6 bg-slate-900/40 p-4 rounded-2xl border border-white/5 relative shrink-0">
            <div 
              className={`relative w-16 h-16 rounded-full bg-slate-800 border-2 ${isUploading ? 'border-[#00e5ff] animate-pulse' : 'border-[#00e5ff]/50'} overflow-hidden shadow-[0_0_15px_rgba(0,229,255,0.2)] shrink-0 group cursor-pointer`}
              onClick={() => fileInputRef.current?.click()}
            >
              {profilePreview ? (
                <img src={profilePreview} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="w-8 h-8 text-slate-500" />
                </div>
              )}
              {/* Hover Overlay */}
              <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="w-5 h-5 text-slate-200/80" />
              </div>
            </div>
            
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleImageUpload} 
            />

            <div>
              <h3 className="text-lg font-bold text-slate-200 leading-tight">{formData.name}</h3>
              <p className="text-xs text-slate-400">{profile.email}</p>
              {(profile.employee_id || profile.id) && (
                <div className="flex items-center gap-1.5 mt-1">
                  <IdCard className="w-3 h-3 text-[#00e5ff]" />
                  <span className="text-[11px] font-mono text-[#00e5ff]">사번 {profile.employee_id || profile.id}</span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4 flex-1 overflow-y-auto pr-2 pb-8 custom-scrollbar">
            {/* 사번 (읽기 전용) */}
            {(profile.employee_id || profile.id) && (
              <div>
                <label className="text-xs font-semibold text-slate-400 ml-1 mb-1.5 block">사번 (Employee ID)</label>
                <div className="relative">
                  <IdCard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    readOnly
                    type="text"
                    value={profile.employee_id || profile.id}
                    className="w-full bg-[#0a1c20] border border-white/5 rounded-xl py-3.5 pl-11 pr-4 text-sm text-slate-400 cursor-not-allowed appearance-none select-all font-mono"
                  />
                </div>
                <p className="text-[10px] text-slate-600 ml-1 mt-1">사번은 관리자만 변경할 수 있습니다.</p>
              </div>
            )}

            {/* 이름 */}
            <div>
              <label className="text-xs font-semibold text-slate-400 ml-1 mb-1.5 block">이름 *</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input required type="text" value={formData.name} onChange={handleChange('name')} placeholder="홍길동" className="w-full bg-[#0a1c20] border border-[#00e5ff]/30 rounded-xl py-3.5 pl-11 pr-4 text-sm placeholder-slate-500 focus:outline-none focus:border-[#00e5ff] focus:ring-1 focus:ring-[#00e5ff] transition-all text-slate-200 appearance-none" />
              </div>
            </div>

            {/* 핸드폰 */}
            <div>
              <label className="text-xs font-semibold text-slate-400 ml-1 mb-1.5 block">핸드폰 번호</label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input type="tel" value={formData.phone || ''} onChange={handlePhoneChange} placeholder="010-0000-0000" maxLength={13} className="w-full bg-[#0a1c20] border border-[#00e5ff]/30 rounded-xl py-3.5 pl-11 pr-4 text-sm placeholder-slate-500 focus:outline-none focus:border-[#00e5ff] focus:ring-1 focus:ring-[#00e5ff] transition-all text-slate-200 appearance-none" />
              </div>
            </div>
            {/* 휴대폰 기종 */}
            <div>
              <label className="text-xs font-semibold text-slate-400 ml-1 mb-1.5 block">휴대폰 기종 (Push 알림용)</label>
              <div className="flex gap-2">
                {['android', 'ios'].map(os => (
                  <button
                    key={os}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, os_type: os }))}
                    className={`flex-1 py-3.5 rounded-xl border text-xs font-black transition-all ${
                      formData.os_type === os 
                        ? 'bg-[#00e5ff] border-[#00e5ff] text-black shadow-[0_0_15px_rgba(0,229,255,0.4)] font-black' 
                        : 'bg-[#0a1c20] border-white/10 text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {os === 'android' ? 'Android' : 'iOS (iPhone)'}
                  </button>
                ))}
              </div>
            </div>

            {/* 회사소속 */}
            <div>
              <label className="text-xs font-semibold text-slate-400 ml-1 mb-1.5 block">회사소속</label>
              <div className="relative">
                <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <select
                  value={formData.company}
                  onChange={e => {
                    handleChange('company')(e.target.value);
                    handleChange('honbu')('');
                    handleChange('team')('');
                    handleChange('part')('');
                    handleChange('subpart')('');
                  }}
                  className="w-full bg-[#0a1c20] border border-[#00e5ff]/30 rounded-xl py-3.5 pl-11 pr-10 text-sm focus:outline-none focus:border-[#00e5ff] focus:ring-1 focus:ring-[#00e5ff] transition-all text-slate-200 appearance-none"
                >
                  <option value="">회사를 선택하세요</option>
                  {companyList.map(c => (
                    <option key={c.code} value={c.code} className="bg-[#0a1c20] text-slate-200">{c.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* 부문 (honbu) = depth2, company 하위 */}
              <SelectWithOther
                label="부문"
                icon={Building2}
                options={honbuMap[formData.company] || []}
                value={formData.honbu}
                disabled={!formData.company || !(honbuMap[formData.company] || []).length}
                onChange={(val) => {
                  handleChange('honbu')(val);
                  handleChange('team')('');
                  handleChange('part')('');
                  handleChange('subpart')('');
                }}
              />
              {/* 본부 (team) = depth3, honbu 하위 */}
              <SelectWithOther
                label="본부"
                icon={Building2}
                options={teamMap[formData.honbu] || []}
                value={formData.team}
                disabled={!formData.honbu || !(teamMap[formData.honbu] || []).length}
                onChange={(val) => {
                  handleChange('team')(val);
                  handleChange('part')('');
                  handleChange('subpart')('');
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3">
              {/* 팀 (part) = depth4, team 하위 */}
              <SelectWithOther
                label="팀"
                icon={Building2}
                options={partMap[formData.team] || []}
                value={formData.part}
                disabled={!formData.team || !(partMap[formData.team] || []).length}
                onChange={(val) => {
                  handleChange('part')(val);
                  handleChange('subpart')('');
                }}
              />
              {/* 파트 (subpart) = depth5, part 하위 */}
              <SelectWithOther
                label="파트"
                icon={Building2}
                options={subpartMap[formData.part] || []}
                value={formData.subpart}
                disabled={!formData.part || !(subpartMap[formData.part] || []).length}
                onChange={handleChange('subpart')}
              />
            </div>

            {/* 비밀번호 변경 섹션 */}
            <div className="pt-4 mt-2 border-t border-white/5">
              <button 
                onClick={() => setShowPasswordChange(!showPasswordChange)}
                className="flex items-center space-x-2 text-xs font-bold text-[#00e5ff] hover:text-[#00e5ff]/80 transition-colors uppercase tracking-wider mb-3"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{showPasswordChange ? '비밀번호 변경 취소' : '비밀번호 변경하기'}</span>
              </button>

              {showPasswordChange && (
                <div className="space-y-3 bg-white/5 p-4 rounded-2xl border border-white/5 animate-slide-down">
                  {/* 현재 비밀번호 */}
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#00e5ff]" />
                      <input 
                        type={showPw ? 'text' : 'password'} 
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="현재 비밀번호" 
                        className="w-full bg-[#0a1c20] border border-[#00e5ff]/50 rounded-xl py-3 pl-11 pr-4 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#00e5ff] focus:ring-1 focus:ring-[#00e5ff] transition-all appearance-none"
                      />
                    </div>
                    <div className="border-t border-white/5 pt-3">
                      {/* 새 비밀번호 */}
                      <div className="relative mb-3">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input 
                          type={showPw ? 'text' : 'password'} 
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="새 비밀번호 입력" 
                          className="w-full bg-[#0a1c20] border border-[#00e5ff]/30 rounded-xl py-3 pl-11 pr-11 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#00e5ff] focus:ring-1 focus:ring-[#00e5ff] transition-all appearance-none"
                        />
                        <button
                          onClick={() => setShowPw(!showPw)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200"
                        >
                          {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {/* 새 비밀번호 확인 */}
                      <div className="relative">
                        <CheckCircle2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input 
                          type={showPw ? 'text' : 'password'} 
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="새 비밀번호 확인" 
                          className="w-full bg-[#0a1c20] border border-[#00e5ff]/30 rounded-xl py-3 pl-11 pr-4 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#00e5ff] focus:ring-1 focus:ring-[#00e5ff] transition-all appearance-none"
                        />
                      </div>
                    </div>
                  <button
                    onClick={handlePasswordChange}
                    disabled={isChangingPassword}
                    className="w-full bg-[#00e5ff]/10 hover:bg-[#00e5ff] text-[#00e5ff] hover:text-black font-black py-2.5 rounded-xl transition-all text-xs border border-[#00e5ff]/30 shadow-[0_0_10px_rgba(0,229,255,0.2)]"
                  >
                    {isChangingPassword ? '변경 중...' : '비밀번호 변경 적용'}
                  </button>
                </div>
              )}
            </div>


            <div className="pt-6 pb-2 flex flex-col space-y-3 shrink-0 border-t border-white/5">
              <div className="flex gap-3">
                <button
                  onClick={() => setShowAndroidManual(true)}
                  className="flex-1 bg-gradient-to-r from-blue-600/20 to-cyan-600/20 hover:from-blue-600/40 hover:to-cyan-600/40 text-[#00e5ff] font-black py-3.5 px-3 rounded-2xl transition-all flex items-center justify-center gap-2 border border-[#00e5ff]/30 shadow-[0_4px_20px_rgba(0,229,255,0.2)] active:scale-[0.98]"
                >
                  <Download className="w-4 h-4 shrink-0" />
                  <span className="text-[11px] sm:text-xs tracking-wider whitespace-nowrap">Android S-bridge</span>
                </button>
                <button
                  onClick={() => setShowIosManual(true)}
                  className="flex-1 bg-gradient-to-r from-purple-600/20 to-pink-600/20 hover:from-purple-600/40 hover:to-pink-600/40 text-purple-300 hover:text-white font-black py-3.5 px-3 rounded-2xl transition-all flex items-center justify-center gap-2 border border-purple-500/30 shadow-[0_4px_20px_rgba(168,85,247,0.2)] active:scale-[0.98]"
                >
                  <Apple className="w-4 h-4 shrink-0" />
                  <span className="text-[11px] sm:text-xs tracking-wider whitespace-nowrap">iOS S-bridge</span>
                </button>
              </div>

              <button
                onClick={handleSave}
                className="w-full bg-[#00e5ff] hover:bg-[#00e5ff]/80 text-black font-black py-4 rounded-xl shadow-[0_0_20px_rgba(0,229,255,0.4)] transition-all transform active:scale-[0.98]"
              >
                저장하기 (Save)
              </button>
              <button
                onClick={handleLogout}
                className="w-full bg-white/5 hover:bg-[#00e5ff]/10 text-slate-400 hover:text-[#00e5ff] font-medium py-3 rounded-xl transition-all flex items-center justify-center space-x-1"
              >
                <LogIn className="w-4 h-4 rotate-180" />
                <span>Logout</span>
              </button>
            </div>

            {(!formData.company || !formData.honbu || !formData.team || !formData.part) && (
              <p className="text-[10px] text-[#00e5ff]/80 text-center mt-4 italic shrink-0">
                * 서비스 이용을 위해 필수 정보를 모두 입력해 주세요.
              </p>
            )}
          </div>
        </div>

        {/* iOS 단축어 설정 매뉴얼 모달 */}
        {showIosManual && (
          <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
            <div className="relative w-full max-w-md bg-[#0b1322] border border-purple-500/40 rounded-[28px] p-6 sm:p-8 shadow-[0_0_50px_rgba(168,85,247,0.3)] flex flex-col max-h-[85vh]">
              <div className="flex items-center justify-between pb-4 mb-6 border-b border-white/10 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600/30 to-pink-600/30 border border-purple-500/40 text-purple-300 flex items-center justify-center shrink-0 shadow-inner shadow-purple-500/20">
                    <Apple className="w-5 h-5 shrink-0" />
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-white tracking-tight whitespace-nowrap">iOS 단축어 연동 매뉴얼</h3>
                </div>
                <button 
                  onClick={() => setShowIosManual(false)} 
                  className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 text-slate-400 hover:text-white transition-colors shrink-0"
                >
                  <X className="w-5 h-5 shrink-0" />
                </button>
              </div>

              <div className="overflow-y-auto pr-2 space-y-6 flex-1 text-slate-300 text-xs sm:text-sm custom-scrollbar">
                <div className="space-y-2">
                  <h4 className="flex items-center gap-2 text-purple-400 font-bold text-sm sm:text-base">
                    <span className="w-5 h-5 rounded bg-purple-400 text-[#0b1322] flex items-center justify-center font-black text-xs shrink-0">1</span>
                    단축어 프로파일 다운로드
                  </h4>
                  <p className="pl-7 leading-relaxed text-slate-400">
                    하단의 <span className="text-white font-bold">단축어 프로파일 다운로드</span> 버튼을 탭하여 <span className="text-white font-bold">S-BRIDGE-iOS.shortcut</span> 파일을 실행하고 내 단축어에 추가합니다.
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="flex items-center gap-2 text-purple-400 font-bold text-sm sm:text-base">
                    <span className="w-5 h-5 rounded bg-purple-400 text-[#0b1322] flex items-center justify-center font-black text-xs shrink-0">2</span>
                    개인용 자동화(Automation) 생성
                  </h4>
                  <p className="pl-7 leading-relaxed text-slate-400">
                    아이폰 <span className="text-white font-bold">단축어(Shortcuts)</span> 앱 하단 <span className="text-white font-bold">자동화</span> 탭에서 [+] 버튼을 눌러 새 자동화를 생성합니다. 조건으로 <span className="text-white font-bold">메시지</span>를 선택하고, '메시지 포함 내용'에 <span className="text-purple-300 font-bold">[Web발신] 또는 알림, 신한, 경보</span> 등 수신할 문자의 공통 키워드를 필수로 입력합니다. 반드시 <span className="text-purple-300 font-bold">즉시 실행</span>을 체크해 주세요.
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="flex items-center gap-2 text-emerald-400 font-bold text-sm sm:text-base">
                    <span className="w-5 h-5 rounded bg-emerald-400 text-[#0b1322] flex items-center justify-center font-black text-xs shrink-0">3</span>
                    무인 백그라운드 동작 설정
                  </h4>
                  <p className="pl-7 leading-relaxed text-slate-400">
                    동작으로 추가한 <span className="text-white font-bold">S-BRIDGE-iOS</span> 단축어를 연결한 뒤, <span className="text-red-400 font-bold">실행 전에 묻기</span> 및 <span className="text-red-400 font-bold">실행되면 알림</span> 스위치를 꺼서 무인 연동을 완료합니다.
                  </p>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-white/10 shrink-0">
                <button
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = '/S-BRIDGE-iOS.shortcut?v=' + Date.now();
                    link.download = 'S-BRIDGE-iOS.shortcut';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    setShowIosManual(false);
                  }}
                  className="w-full py-4 px-4 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-[0_10px_25px_rgba(168,85,247,0.4)] active:scale-95 transition-all truncate border border-purple-400/30"
                >
                  <Download className="w-5 h-5 shrink-0" />
                  <span className="truncate tracking-wide font-black">iOS 단축어 프로파일 다운로드</span>
                </button>
                <p className="text-[11px] text-center text-slate-500 mt-3.5">
                  iOS 보안 정책에 따라 사파리(Safari) 브라우저에서의 다운로드를 권장합니다.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Android S-bridge 설치 매뉴얼 모달 */}
        {showAndroidManual && (
          <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
            <div className="relative w-full max-w-md bg-[#0b1322] border border-blue-500/40 rounded-[28px] p-6 sm:p-8 shadow-[0_0_50px_rgba(0,229,255,0.3)] flex flex-col max-h-[85vh]">
              <div className="flex items-center justify-between pb-4 mb-6 border-b border-white/10 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600/30 to-cyan-600/30 border border-blue-500/40 text-[#00e5ff] flex items-center justify-center shrink-0 shadow-inner shadow-blue-500/20">
                    <Download className="w-5 h-5 shrink-0" />
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-white tracking-tight whitespace-nowrap">Android S-bridge 설치 매뉴얼</h3>
                </div>
                <button 
                  onClick={() => setShowAndroidManual(false)} 
                  className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 text-slate-400 hover:text-white transition-colors shrink-0"
                >
                  <X className="w-5 h-5 shrink-0" />
                </button>
              </div>

              <div className="overflow-y-auto pr-2 space-y-6 flex-1 text-slate-300 text-xs sm:text-sm custom-scrollbar">
                <div className="space-y-2">
                  <h4 className="flex items-center gap-2 text-[#00e5ff] font-bold text-sm sm:text-base">
                    <span className="w-5 h-5 rounded bg-[#00e5ff] text-[#0b1322] flex items-center justify-center font-black text-xs shrink-0">1</span>
                    Play 프로텍트 설정 진입
                  </h4>
                  <ul className="pl-7 leading-relaxed text-slate-400 list-disc space-y-1">
                    <li>Google Play 스토어 앱을 실행합니다.</li>
                    <li>우측 상단의 <span className="text-white font-bold">프로필 아이콘(내 계정)</span>을 탭합니다.</li>
                    <li>메뉴 목록 중 <span className="text-white font-bold">Play 프로텍트</span>를 선택합니다.</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <h4 className="flex items-center gap-2 text-[#00e5ff] font-bold text-sm sm:text-base">
                    <span className="w-5 h-5 rounded bg-[#00e5ff] text-[#0b1322] flex items-center justify-center font-black text-xs shrink-0">2</span>
                    실시간 검사 비활성화
                  </h4>
                  <ul className="pl-7 leading-relaxed text-slate-400 list-disc space-y-1">
                    <li>화면 우측 상단의 <span className="text-white font-bold">톱니바퀴(설정)</span> 아이콘을 클릭합니다.</li>
                    <li><span className="text-red-400 font-bold">Play 프로텍트로 앱 검사</span> 스위치를 끕니다.</li>
                    <li>확인 팝업 창에서 <span className="text-white font-bold">종료</span> 버튼을 누릅니다.</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <h4 className="flex items-center gap-2 text-emerald-400 font-bold text-sm sm:text-base">
                    <span className="w-5 h-5 rounded bg-emerald-400 text-[#0b1322] flex items-center justify-center font-black text-xs shrink-0">3</span>
                    앱 설치 및 복구
                  </h4>
                  <ul className="pl-7 leading-relaxed text-slate-400 list-disc space-y-1">
                    <li>하단의 <span className="text-white font-bold">APK 다운로드 시작</span> 버튼을 클릭하여 설치합니다.</li>
                    <li>설치 완료 후 반드시 다시 Play 프로텍트 설정으로 돌아가 <span className="text-emerald-400 font-bold">앱 검사</span>를 활성화(켜기) 상태로 되돌려 주세요.</li>
                  </ul>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-white/10 shrink-0">
                <button
                  onClick={() => {
                    window.location.href = '/s-bridge.apk?v=' + Date.now();
                    setShowAndroidManual(false);
                  }}
                  className="w-full py-4 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-[0_10px_25px_rgba(0,229,255,0.4)] active:scale-95 transition-all truncate border border-blue-400/30"
                >
                  <Download className="w-5 h-5 shrink-0" />
                  <span className="truncate tracking-wide font-black">Android S-bridge APK 다운로드 시작</span>
                </button>
                <p className="text-[11px] text-center text-slate-500 mt-3.5">
                  보안 정책에 따라 설치 파일은 사내 네트워크에서만 다운로드 가능할 수 있습니다.
                </p>
              </div>
            </div>
          </div>
        )}


      </div>
    </div>
  );
}
