import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Activity, Server, AlertTriangle, CheckCircle, Clock, Search, Bell, Menu, User, ChevronRight, ChevronUp, Zap, Shield, Database, Sparkles, MessageSquare, Brain, MoreHorizontal, RefreshCw, RotateCcw, Info, X, BarChart2, Hash, Users, LogIn, AlertCircle, Home, Phone, Building2, IdCard, ChevronDown, BarChart3, FileText, Settings, LogOut, ExternalLink, CheckCircle2, Filter, Lock, Eye, EyeOff, Calendar, Camera, Bot, Cpu, BellDot, Keyboard, Network, BookOpen, Layers, Save } from 'lucide-react';
import AgentDiscussionPanel from '../components/AgentDiscussionPanel';
import EmergencyActionModal from '../components/EmergencyActionModal';
import AiInsightPanel from '../components/AiInsightPanel';
import WarRoomChatPanel from '../components/WarRoomChatPanel';

import ErrorBoundary from '../components/ErrorBoundary';
import AIInsightModal from '../components/AIInsightModal';
import BottomMenu from '../components/BottomMenu';
import { useCodebook } from '../context/CodebookContext';
import { getAccessToken, clearSession, getAuthHeaders } from '../lib/authStore';

const SHINHAN_COMPANIES = [
  '신한금융지주', '신한은행', '신한카드', '신한투자증권', '신한라이프',
  '신한캐피탈', '신한자산운용', '신한저축은행', '신한AI', '신한DS',
  '제주은행', '신한벤처투자', '신한리츠운용', '신한대체투자운용',
  '신한자산신탁', '신한펀드파트너스', '신한금융플러스', '신한큐브리스크컨설팅',
];

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

  const inputClass = "w-full bg-[#1a1f2e] border border-blue-500/20 rounded-xl py-3.5 pl-11 pr-4 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-white";

  return (
    <div className={disabled ? 'opacity-50 pointer-events-none' : ''}>
      <label className="text-xs font-semibold text-slate-400 ml-1 mb-1.5 block">
        {label} {required && disabled !== true && <span className="text-red-400">*</span>}
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
          <option value="" disabled className="bg-[#1a1f2e] text-slate-500">{disabled ? '해당없음' : `${label} 선택`}</option>
          {options.map(o => (
            <option key={getCode(o)} value={getCode(o)} className="bg-[#1a1f2e] text-white">{getName(o)}</option>
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
export default function DashboardPage({ onAiClick }) {
  const navigate = useNavigate();
  const [showMoreMenuFromConsole, setShowMoreMenuFromConsole] = useState(false);
  const location = useLocation();
  const [showAgentPanel, setShowAgentPanel] = useState(false);

  // 더보기 서브페이지에서 뒤로가기 시 콘솔 자동 오픈
  useEffect(() => {
    if (location.state?.openMoreMenu) {
      setShowMoreMenuFromConsole(true);
      // state 소비 후 초기화
      window.history.replaceState({}, '');
    }
  }, [location.state?.openMoreMenu]);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [showWarRoomPopup, setShowWarRoomPopup] = useState(false);
  const [activeLogTab, setActiveLogTab] = useState('ai'); // 'ai' or 'human'
  const [agentMessages, setAgentMessages] = useState([]);
  const [systemStatus, setSystemStatus] = useState('normal'); 
  const [messages, setMessages] = useState([]); 
  const [allNotifications, setAllNotifications] = useState([]); 
  const [isRefreshing, setIsRefreshing] = useState(false);
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
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const [selectedIncidentIdFlow, setSelectedIncidentIdFlow] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [incidentWorkflowSteps, setIncidentWorkflowSteps] = useState([]);
  const [totalSmsVolume, setTotalSmsVolume] = useState(0);
  const [isSmsSpinning, setIsSmsSpinning] = useState(false);
  const [isFlowSpinning, setIsFlowSpinning] = useState(false);
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);

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
    { id: 'SMS', label: 'SMS 수신 및 장애 인지', icon: Bell },
    { id: 'RAG_AGENT', label: 'RAG 및 AI AGENT 분석 완료', icon: Brain },
    { id: 'WARROOM', label: '워룸생성 및 할당완료', icon: Users },
    { id: 'KNOWLEDGE', label: '지식화/장애/보고 처리완료', icon: CheckCircle }
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

    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${yy}/${mm}/${dd} ${hh}:${mi}:${ss}`;
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
  const selectedSmsRef = useRef(null);
  const [lastAutoTriggeredKey, setLastAutoTriggeredKey] = useState(null);
  const lastAutoTriggeredKeyRef = useRef(null);
  const [saveStatus, setSaveStatus] = useState('');

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

  const handleOpenWarRoomFromInsight = async (smsMessage, analysisText) => {
    if (isOpeningWarRoom) return;
    const currentSms = smsMessage || selectedSmsRef.current;
    if (!currentSms) return;
    setIsOpeningWarRoom(true);

    // The raw received SMS ID (e.g. 20231026154512345) MUST be the primary key DB identifier
    // to match aichat_history.
    const incidentId = String(currentSms.inc_id || currentSms.id || `${Date.now()}`).replace('INC-', '');
    
    const formattedUiId = `INC-${incidentId}`; // Display prefix
    const rawMsg = currentSms.message || currentSms.error_message || "SMS 장애 감지";
    const truncatedMsg = rawMsg.length > 50 ? rawMsg.substring(0, 50) + "..." : rawMsg;
    const smsTitle = `${formattedUiId} | ${truncatedMsg}`;
    
    // Check if War-Room already exists
    const existingRoom = warRooms.find(r => r.id === incidentId);
    if (existingRoom) {
      navigate(`/chat/${incidentId}`);
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
      // Extract [전문가별 심층 진단] section for incidents description
      const diagnosisMatch = analysisText.match(/\[전문가별 심층 진단\]([\s\S]*?)(\[|$)/);
      if (diagnosisMatch) {
        diagnosisText = diagnosisMatch[1].replace(/(\*\*.+?\*\*|###.+?\n|---)/g, '').trim();
      }
      // Extract [Leader]: section specifically for the AI ANALYSIS SUMMARY banner
      const leaderMatch = analysisText.match(/\[Leader\][\s\S]*?[:：]\s*([\s\S]*?)(?=\[|$)/);
      if (leaderMatch) {
        leaderSummary = leaderMatch[1].replace(/(\*\*.+?\*\*|###.+?\n|---)/g, '').trim();
      }
      // Fallback: if full text is short or unmatched, use entire text
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
          inc_id: String(incidentId).replace('INC-', ''),
          title: smsTitle,
          description: diagnosisText || 'SMS 장애 상세 분석 대기 중',
          severity: roomSeverity,
          incident_type: 'SMS',
          source_sms_id: String(currentSms.inc_id).replace('INC-', '')
        })
      });

      // AI Analysis Pinned Message - DEPRECATED as it messes up the clean Agent Discussion flow
      /*
      if (analysisText) {
        await fetch(`${apiBase}/warroom/chat`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            incident_id: incidentId,
            sender: 'AI Autopilot',
            role: 'AI분석',
            type: 'ai_analysis',
            text: analysisText
          })
        });
      }
      */

      // System intro user message is now only handled on the UI layer.

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
    }
  };

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

  // Fetch detailed workflow when an incident is selected
  useEffect(() => {
    if (!selectedIncidentIdFlow) {
      setIncidentWorkflowSteps([]);
      return;
    }

    const fetchWorkflow = async () => {
      setIsFlowSpinning(true);
      try {
        const res = await fetch(`${apiBase}/ai/incident/workflow-details?inc_id=${selectedIncidentIdFlow}`, {
          headers: getAuthHeaders()
        });
        const data = await res.json();
        setIncidentWorkflowSteps(data.steps || []);
      } catch (e) {
        console.error('Workflow fetch failed:', e);
        alert("원활한 서비스 조회를 위해 페이지를 새로고침합니다.");
        window.location.reload();
      } finally {
        setIsFlowSpinning(false);
      }
    };

    fetchWorkflow();
  }, [selectedIncidentIdFlow]);

  // 상단 S-Autopilot Insight 패널은 항상 최신 SMS만 분석하도록 고정
  // 상단 S-Autopilot Insight 패널은 선택된 SMS를 우선 표시하고, 없을 경우 최신 SMS를 분석
  useEffect(() => {
    if (visibleSms.length > 0) {
      if (!selectedSms) {
        setSelectedSms(visibleSms[0]);
      }
      setInsightSms(selectedSms || visibleSms[0]);
    } else {
      setInsightSms(null);
    }
  }, [selectedSms, visibleSms]);

  // Fetch War-Rooms & SMS periodically
  useEffect(() => {
    fetchSMSMessages();
    fetchWarRooms();
    fetchActivityLogs();
    fetchMyAssignments();
    fetchUserActivityHistory();
    fetchSettings(); // 🚀 Load thresholds on start
    const smsInterval = setInterval(fetchSMSMessages, 5000);
    const wrInterval = setInterval(fetchWarRooms, 8000);
    const activityInterval = setInterval(fetchActivityLogs, 10000);
    const assignmentInterval = setInterval(fetchMyAssignments, 10000);
    const historyInterval = setInterval(fetchUserActivityHistory, 15000);

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
      clearInterval(historyInterval);
      sse.close();
    };
  }, [userProfile, assignmentDateRange, hideCompletedSms]);

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
        setWarRooms(mapped);
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
          inc_id: String(inc.inc_id).replace('INC-', '')
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
    setIsSmsSpinning(true);
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
        setSmsMessages(finalMsgs);

        const totalVolume = finalMsgs.reduce((acc, m) => acc + (Number(m.received_count) || 1), 0);
        setTotalSmsVolume(totalVolume);

        if (finalMsgs.length > 0) {
          const latestMsg = finalMsgs[0];
          const latestKey = `${latestMsg.inc_id}_${latestMsg.timestamp}`;
          
          if (latestKey !== lastAutoTriggeredKeyRef.current) {
            lastAutoTriggeredKeyRef.current = latestKey;
            setLastAutoTriggeredKey(latestMsg.inc_id);
            setSelectedSms(latestMsg);
            
            // Auto-expand and start analysis
            setIsSmsPanelCollapsed(false);       
            setIsLiveStreamCollapsed(false);    
            setIsWarRoomCollapsed(false);       
            setIsAssignmentsCollapsed(false);    
            setIsFlowCollapsed(false);
            setShowAgentPanel(true);             
            setSelectedIncidentIdFlow(latestMsg.inc_id);
            startLiveScenario(latestMsg);

            // 🚀 Trigger "Lively" animation for SMS panel
            setIsSmsSpinning(true);
            setTimeout(() => setIsSmsSpinning(false), 3500);
          }
        }
      }
    } catch (error) {
      console.error('SMS 메시지 로드 실패:', error);
    } finally {
      setIsSmsSpinning(false);
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
    { id: 'critical', label: 'Critical', val: 0, icon: AlertTriangle, color: 'bg-red-500/20', text: 'text-red-400', bar: 'bg-red-500', borderColor: 'border-red-500/30' },
    { id: 'major', label: 'Major', val: 1, icon: Shield, color: 'bg-orange-500/20', text: 'text-orange-400', bar: 'bg-orange-500', borderColor: 'border-orange-500/30' },
    { id: 'normal', label: 'Normal', val: 24, icon: CheckCircle, color: 'bg-emerald-500/20', text: 'text-emerald-400', bar: 'bg-emerald-500', borderColor: 'border-emerald-500/30' },
    { id: 'info', label: 'Info', val: 156, icon: Info, color: 'bg-blue-500/20', text: 'text-blue-400', bar: 'bg-blue-500', borderColor: 'border-blue-500/30' },
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

  // Helper to parse transcript string into array of message objects
  const parseTranscript = (text) => {
    if (!text) return [];

    // ── 디버그: 전체 텍스트 확인
    console.log('[parseTranscript] full text:\n', text);

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
    const sectionMarkers = [
      '[전문가별 심층 진단]', '전문가별 심층 진단',
      '## 전문가', '### 전문가',
      '**전문가별', '[전문가', '전문가 에이전트',
      // 영어 fallback
      'Expert Analysis', 'Agent Analysis', '## Agent',
    ];
    let startIndex = -1;
    for (const marker of sectionMarkers) {
      const idx = text.indexOf(marker);
      if (idx !== -1) {
        console.log('[parseTranscript] section marker found:', marker, 'at index', idx);
        startIndex = idx;
        break;
      }
    }
    if (startIndex === -1) {
      console.log('[parseTranscript] no section marker found — scanning entire text');
      startIndex = 0;
    }

    const lines = text.substring(startIndex).split('\n');
    const msgsMap = new Map();
    let currentAgent = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // ── 패턴 1: `- **Security Agent**: 내용` 또는 `• Security Agent: 내용`
      // **볼드** 마커를 포함/미포함 모두 지원
      const bulletMatch = trimmed.match(
        /^[-•*·\d.]\s*\*{0,4}(Security|DB|DevOps|Leader)\s*Agent\*{0,4}\s*[:：]\s*(.+)/i
      );
      if (bulletMatch) {
        const agentName = detectAgentName(bulletMatch[1]);
        const content = bulletMatch[2].trim();
        console.log('[parseTranscript] bullet match:', agentName, '→', content.substring(0, 30));
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
        /^\d+[\.\)]\s/.test(trimmed) ||
        (/[：:]\s*$/.test(trimmed) && trimmed.length < 60)
      );
      if (isHeaderLike && /security|db|database|devops|infra|leader/i.test(trimmed)) {
        const agentName = detectAgentName(trimmed);
        if (agentName) {
          console.log('[parseTranscript] header match:', agentName, '←', trimmed);
          currentAgent = agentName;
          continue;
        }
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
          // 마커 이후 텍스트를 Leader 내용으로
          const afterMarker = processed.substring(guideMatch.index + guideMatch[0].length).trim();
          // 마커 이전 텍스트도 있으면 합치기 (Agent 발언 + 가이드)
          const beforeMarker = processed.substring(0, guideMatch.index).trim();
          processed = [beforeMarker, afterMarker].filter(Boolean).join('\n\n');
        }
        // Leader 섹션에 아무 것도 없으면, 전체 텍스트에서 [리더의 최종 조치 가이드] 블록 직접 탐색
        if (!processed.trim()) {
          const fullGuideMatch = guidePattern.exec(text);
          if (fullGuideMatch) {
            processed = text.substring(fullGuideMatch.index + fullGuideMatch[0].length)
              .split(/\n(?=#{1,4}\s|\[|---|\*{2}[A-Z가-힣])/)[0].trim();
          }
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


    console.log('[parseTranscript] result:', result.map(r => `${r.role}(${r.text.length}chars)`));
    return result;
  };







  // Callback called from AiInsightPanel
  const handleAgentContent = (fullTranscript, isDone) => {
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

    console.log('[Expert Advisor] parsed:', filteredMsgs.length, 'agents →', filteredMsgs.map(m => m.role), '| isDone:', isDone);

    if (isDone) {
      // 완료 시: 결과가 있으면 업데이트, 없으면 현재 상태 유지
      if (filteredMsgs.length > 0) {
        setShowAgentPanel(true);
        setAgentMessages(filteredMsgs.map(m => ({ ...m, isCompleted: true })));
      }
    } else {
      // 스트리밍 중: 2개 이상 파싱됐을 때만 중간 업데이트 (깜빡임 방지)
      if (filteredMsgs.length >= 2) {
        setShowAgentPanel(true);
        setAgentMessages(filteredMsgs.map(m => ({ ...m, isCompleted: false })));
      }
    }

    if (isDone && filteredMsgs.length > 0) {
      const currentIncId = selectedSmsRef.current?.inc_id;
      if (currentIncId) {
        fetch(`${apiBase}/ai/chat-history/save`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ incident_id: String(currentIncId), messages: filteredMsgs })
        })
        .then(res => res.json())
        .then(data => console.log('Save complete:', data))
        .catch(console.error);

        setTimeout(() => setShowEmergencyModal(true), 1500);
      }
    }
  };






  const agentPanelRef = useRef(null);

  const startLiveScenario = async (smsMessage) => {
    if (!smsMessage) return;
    setSystemStatus('critical');
    setShowAgentPanel(true);
    setAgentMessages([{ role: 'Security', text: '🔍 새로운 장애 로그 감지. AI 에이전트 분석을 시작합니다...', delay: 0 }]);


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
    const cleanIncId = String(smsMessage.inc_id).replace('INC-', '');

    // Trigger Assignment to the current user
    if (userProfile?.employee_id) {
      fetch(`${apiBase}/ai/incident/assign`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          user_id: userProfile.employee_id,
          login_id: userProfile.email,
          inc_id: String(smsMessage.inc_id).replace('INC-', ''),
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
            const completedMsgs = filtered.map(m => ({ ...m, isCompleted: true }));
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
            inc_id: String(selectedSms?.inc_id || selectedIncidentIdFlow).replace('INC-', ''),
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

  const handleShowInsight = (type) => {
    // In a real app, we would fetch data based on type using the API
    // For now, we use the demo data matching the screenshot
    // setSelectedInsightData(demoInsightData);
    // setShowInsightModal(true);
    console.log("AI Insight Modal disabled by user request");
  };

  const handleLogReceived = (log, counts) => {

    

    console.log("Log received in Dashboard:", log);
    const uniqueId = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setAllNotifications(prev => [{
      id: uniqueId,
      title: log.title || 'AI Log',
      content: log.message || log.text,
      type: 'AI',
      severity: log.severity,
      time: formatYYMMDD(new Date())
    }, ...prev]);
    // Optionally show a temporary message in the top banner for critical logs
    if (log.severity === 'CRITICAL') {
      // 사용자 요청으로 긴급 분석 결과 전체 텍스트 팝업(상단 빨간 배너) 비활성화
      // setMessages(prev => [...prev, { id: `msg-${Date.now()}-${Math.random()}`, type: 'error', text: log.message }]);
    }
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
    <>
    <div className={`h-screen overflow-hidden text-white font-sans relative flex flex-col${isSmsSpinning || isAiAnalyzing || isFlowSpinning ? ' hud-fetching' : ''}`} style={{ background: 'radial-gradient(ellipse 120% 100% at 50% 0%, #0d1528 0%, #080e1a 40%, #050a15 100%)' }}>
      {/* 헤더 접힘 상태일 때 좌상단 플로팅 버튼 */}
      {isNavCollapsed && (
        <div className="fixed top-3 left-4 z-50">
          <button onClick={() => setIsNavCollapsed(false)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#1a1f2e]/90 backdrop-blur-sm border border-white/10 hover:border-blue-500/40 transition-all shadow-xl group">
            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center font-bold text-xs">S</div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-white rotate-180" />
          </button>
        </div>
      )}
      {/* Top Navigation */}
      <nav className={`flex flex-col bg-[#0f1421] border-b border-white/10 sticky top-0 z-30 ${isNavCollapsed ? 'hidden' : 'block'}`}>

        {/* ── 1행: 로고 + 설정버튼 + 우측액션 ── */}
        <div className="flex items-center gap-3 px-5 py-3">

          {/* 좌: 로고 + 설정버튼 */}
          <div className="flex items-center gap-3 shrink-0">
            <div
              className="flex items-center cursor-pointer group shrink-0"
              onClick={() => window.location.reload()}
            >
              <span className="text-lg font-black tracking-widest group-hover:text-blue-400 transition-colors uppercase">S-GUARD <span className="text-blue-500">AI</span></span>
            </div>

            <button
              onClick={(e) => { e.stopPropagation(); setShowThresholdSettings(v => !v); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all shrink-0 ${
                showThresholdSettings
                  ? 'bg-blue-600/15 border-blue-500/40 shadow-[0_0_14px_rgba(6,182,212,0.12)]'
                  : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06] hover:border-white/20'
              }`}
              title="유사도 임계값 설정"
            >
              <Settings className={`w-3.5 h-3.5 shrink-0 transition-all ${
                showThresholdSettings ? 'text-blue-400 rotate-45' : 'text-slate-400'
              } ${isSavingThreshold ? 'animate-spin' : ''}`} />
              <span className={`text-[9px] font-black uppercase tracking-wide whitespace-nowrap ${
                showThresholdSettings ? 'text-blue-400' : 'text-slate-400'
              }`}>Technical threshold</span>
              <span className="text-[9px] text-slate-600">/</span>
              <span className={`text-[9px] font-black uppercase tracking-wide whitespace-nowrap ${
                showThresholdSettings ? 'text-purple-400' : 'text-slate-400'
              }`}>Casual Match Strictness</span>
            </button>
          </div>

          <div className="flex-1" />

          {/* 우: 액션 */}
          <div className="flex items-center gap-2 shrink-0">
            <div
              className={`p-2 rounded-xl hover:bg-white/5 transition-all cursor-pointer group ${isRefreshing ? 'opacity-50' : ''}`}
              onClick={handleManualRefresh}
              title="데이터 새로고침"
            >
              <RefreshCw className={`w-5 h-5 text-slate-400 group-hover:text-blue-400 transition-all ${isRefreshing ? 'animate-spin text-blue-500' : ''}`} />
            </div>
            <button
              onClick={onAiClick}
              className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
            >
              <Bot size={16} color="#a855f7" style={{ filter: 'drop-shadow(0 0 6px rgba(168,85,247,0.4))' }} />
            </button>
            <div
              className="flex items-center gap-2 cursor-pointer hover:bg-white/5 p-1 px-2 rounded-xl transition-colors group"
              onClick={() => setShowProfileModal(true)}
            >
              {userProfile && (
                <span className="text-xs font-bold text-slate-300 hidden sm:inline-block group-hover:text-blue-400">
                  {userProfile.name}
                </span>
              )}
              <div className="w-8 h-8 bg-slate-700/50 rounded-full flex items-center justify-center border border-white/10 overflow-hidden ring-2 ring-blue-500/20 group-hover:ring-blue-500/50 transition-all">
                {userProfile?.profile_picture ? (
                  <img src={userProfile.profile_picture} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-5 h-5 text-slate-300 group-hover:text-blue-400" />
                )}
              </div>
            </div>
            <button onClick={() => setIsNavCollapsed(true)}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all group">
              <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-white" />
            </button>
          </div>
        </div>

        {/* ── 2행: PC/태블릿 전용 메뉴 링크 (lg 이상) ── */}
        <div className="hidden lg:flex items-stretch border-t border-white/5">
          {[
            { label: 'Orbital Command', icon: Cpu,         path: '/orbital-command',        color: '#06b6d4' },
            { label: 'Alert Monitor',   icon: BellDot,     path: '/alert-monitor',          color: '#ef4444' },
            { label: 'Incident KW',     icon: Hash,        path: '/incident-keyword',       color: '#22d3ee' },
            { label: 'Personal KW',     icon: Keyboard,    path: '/user-keyword',           color: '#06b6d4' },
            { label: 'Report Line',     icon: Users,       path: '/report-line-management', color: '#a855f7' },
            { label: 'Accounts',        icon: User,        path: '/user-management',        color: '#3b82f6' },
            { label: 'Security Logs',   icon: Shield,      path: '/security-logs',          color: '#6366f1', adminOnly: true },
            { label: 'Organization',    icon: Network,     path: '/organization-management',color: '#10b981' },
            { label: 'Knowledge Base',  icon: FileText,    path: '/knowledge-base',         color: '#0ea5e9' },
            { label: 'Global Stats',    icon: Activity,    path: '/overall-status',         color: '#f97316' },
            { label: 'War-Room Hub',    icon: Shield,      path: '/warroom-management',     color: '#ef4444' },
            { label: 'Codebook',        icon: BookOpen,    path: '/codebook-management',    color: '#eab308' },
            { label: 'Data Flow',       icon: Layers,      path: '/processing-flow',        color: '#3b82f6', adminOnly: true },
            { label: 'Push Diagnostic', icon: Bell,        path: '/push-diagnostic',        color: '#f59e0b' },
            { label: 'AI Report',       icon: FileText,    action: () => onAiClick?.(),     color: '#3b82f6' },
            { label: 'Report Search',   icon: Search,      path: '/mobile-report-search',   color: '#10b981' },
          ].filter(m => !m.adminOnly || userProfile?.is_admin === 1 || userProfile?.role === 'admin')
           .map((item, idx, arr) => {
            const Icon = item.icon;
            const isActive = window.location.pathname === item.path;
            return (
              <button
                key={item.label}
                onClick={() => item.action ? item.action() : navigate(item.path)}
                className={`flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-bold transition-all relative
                  ${idx < arr.length - 1 ? 'border-r border-white/5' : ''}
                  ${isActive
                    ? 'bg-white/8 text-white'
                    : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'
                  }`}
                style={{ color: isActive ? item.color : undefined }}
              >
                {isActive && (
                  <span className="absolute top-0 left-0 right-0 h-[2px] rounded-b" style={{ background: item.color }} />
                )}
                <Icon size={14} style={{ color: item.color, opacity: isActive ? 1 : 0.55 }} />
                <span className="whitespace-nowrap tracking-wide">{item.label}</span>
              </button>
            );
          })}
        </div>

      </nav>

      {/* Top Banner Messages */}
      {messages.length > 0 && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md p-4 space-y-2">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex items-center justify-between p-3 rounded-xl shadow-lg animate-in fade-in slide-in-from-top-2 duration-300
                ${msg.type === 'error' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'}
              `}
            >
              <p className="text-sm font-medium">{msg.text}</p>
              <button
                onClick={() => dismissMessage(msg.id)}
                className="ml-2 p-1 rounded-full hover:bg-white/20 transition-colors shrink-0"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Notification Drawer Panel */}
      {showNotifications && (
        <div className="fixed inset-0 z-[110] flex justify-end animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowNotifications(false)} />
          <div className="w-full max-w-sm bg-[#1a1f2e] h-full shadow-2xl relative z-10 animate-in slide-in-from-right duration-500 flex flex-col border-l border-white/10">
            <div className="p-6 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-blue-600/10 to-transparent">
              <div className="flex items-center gap-3">
                <div className="bg-blue-600/20 p-2 rounded-xl">
                  <Bell className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg">알림 센터</h3>
                  <p className="text-[10px] text-slate-500 font-mono uppercase">Notification Center</p>
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
                    className={`p-4 rounded-2xl border ${n.severity === 'CRITICAL' ? 'bg-red-500/5 border-red-500/10' : 'bg-[#11141d] border-white/5'} hover:border-blue-500/30 transition-all cursor-pointer group active:scale-[0.98] relative`}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setAllNotifications(prev => prev.filter(item => item.id !== n.id));
                      }}
                      className="absolute right-3 top-3 p-1 rounded-lg hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-all z-10"
                    >
                      <X className="w-3.5 h-3.5 text-slate-500 hover:text-red-400" />
                    </button>

                    <div className="flex justify-between items-start mb-2 pr-6">
                      <div className="flex items-center gap-2">
                        {n.type === 'AI' ? (
                          <Brain className="w-3.5 h-3.5 text-blue-400" />
                        ) : (
                          <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
                        )}
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${n.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-500 bloom-red' : 'bg-blue-500/20 text-blue-400 bloom-cyan'}`}>
                          {n.type}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">{n.time}</span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-200 mb-1 group-hover:text-blue-400 transition-colors line-clamp-1">{n.title}</h4>
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

            <div className="p-4 border-t border-white/5">
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

      <div className="flex-1 overflow-hidden px-4 pt-4 pb-20 flex flex-col">

        {/* ── 3컬럼 메인 그리드 ── */}
        <div className="relative flex-1 h-full">

          {/* ── 데이터 스트림 커넥터: 중앙 빛 흐름 (lg 이상에서만 표시, 처리완료 시 중지) ── */}
          {(() => {
            const isCompleted = selectedSms?.incident_status === '처리완료' || selectedSms?.incident_status === 'Completed' || selectedSms?.status === '처리완료' || selectedSms?.status === 'Completed';
            return (
              <div className="hidden lg:block absolute inset-0 pointer-events-none z-10" aria-hidden="true">
                {/* 중앙 스트림 라인 1개 */}
                <div className="absolute left-0 right-0" style={{ top: '50%', height: 1 }}>
                  <div style={{
                    width: '100%', height: '1px',
                    background: isCompleted
                      ? 'linear-gradient(90deg, transparent 0%, rgba(16,185,129,0.06) 15%, rgba(16,185,129,0.14) 48%, rgba(16,185,129,0.14) 52%, rgba(16,185,129,0.06) 85%, transparent 100%)'
                      : 'linear-gradient(90deg, transparent 0%, rgba(6,182,212,0.04) 15%, rgba(6,182,212,0.18) 48%, rgba(139,92,246,0.18) 52%, rgba(139,92,246,0.04) 85%, transparent 100%)',
                  }} />
                  {/* 처리완료 시 stream-particle 숨김 */}
                  {!isCompleted && <div className="stream-particle" />}
                </div>
                {/* 컬럼 연결 글로우 노드 — 처리완료 시 정지 */}
                {[25, 50, 75].map((x, i) => (
                  <div key={i} className={isCompleted ? '' : 'node-pulse'} style={{
                    position: 'absolute', left: `calc(${x}% - 3px)`, top: '50%',
                    transform: 'translateY(-50%)',
                    ...(isCompleted ? {
                      width: 5, height: 5, borderRadius: '50%',
                      background: 'rgba(16,185,129,0.25)',
                      boxShadow: '0 0 6px rgba(16,185,129,0.3)',
                    } : { animationDelay: `${i * 0.8}s` }),
                  }} />
                ))}
              </div>
            );
          })()}

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-full">

          {/* ── 1/4: 실시간 SMS 수신 내역 ── */}
          <div className="flex flex-col h-full overflow-hidden">
          {/* 실시간 SMS 수신 내역 패널 */}
          <div className="flex-1 overflow-hidden flex flex-col">
          <div className={`bg-[#1a1f2e] rounded-3xl border border-white/5 shadow-xl h-full overflow-hidden flex flex-col hud-card hud-corners
            ${(() => { const v = Number(selectedSms?.received_count); const t = (() => { try { const s = localStorage.getItem('sguard_alert_thresholds_v3'); if (s) { const p = JSON.parse(s); return p.critical?.errorCount || 10; } } catch{} return 10; })(); return v > t ? 'sms-pulse-critical' : v > 3 ? 'sms-pulse-major' : ''; })()}`}>
              <div className="p-4 sm:p-5 flex justify-between items-center border-b border-white/5">
                  <div className="flex items-center gap-3.5">
                    <span className={`data-ring-wrapper shrink-0 ${isSmsSpinning ? 'data-ring-spinning' : ''}`}>
                      <div className={`bg-blue-600/20 p-2.5 rounded-xl border border-blue-500/30 shadow-sm shrink-0 ${isSmsSpinning ? 'animate-pulse' : ''}`}>
                        <MessageSquare className="w-5 h-5 text-blue-400" />
                      </div>
                    </span>
                    <div>
                      <h3 className="font-black text-white text-lg tracking-tight">실시간 SMS수신내역</h3>
                    </div>
                  </div>
                <div className="flex items-center gap-2 sm:gap-4">

                  <label 
                    onClick={(e) => e.stopPropagation()} 
                    className="flex items-center gap-1.5 cursor-pointer bg-white/5 hover:bg-white/10 px-2 sm:px-3 py-1.5 rounded-xl border border-white/5 transition-colors"
                  >
                    <input type="checkbox" checked={hideCompletedSms} onChange={() => setHideCompletedSms(!hideCompletedSms)} className="w-3.5 h-3.5 sm:w-4 sm:h-4 accent-blue-500 rounded border-white/20" />
                    <span className="text-[10px] sm:text-xs font-bold text-slate-300">완료숨김</span>
                  </label>


                  {/* LIVE: is_analyzed=0 → Dify 미처리(깜빡), 1이상 → 처리완료(DONE) */}
                  {(() => {
                    const hasUnanalyzed = smsMessages.length > 0 && smsMessages.some(m => !m.is_analyzed || Number(m.is_analyzed) === 0);
                    return (
                      <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full border transition-all duration-500 ${hasUnanalyzed ? 'bg-blue-500/10 border-blue-500/30' : 'bg-white/[0.03] border-white/10 opacity-40'}`}>
                        <span className="relative flex h-2 w-2">
                          {hasUnanalyzed && (
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                          )}
                          <span className={`relative inline-flex rounded-full h-2 w-2 ${hasUnanalyzed ? 'bg-blue-500' : 'bg-slate-600'}`}></span>
                        </span>
                        <span className={`text-[10px] font-mono tracking-wider font-black ${hasUnanalyzed ? 'text-blue-400' : 'text-slate-500'}`}>
                          {hasUnanalyzed ? 'LIVE' : 'DONE'}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* 🛠️ similarity Threshold Control Panel */}
              <div className={`transition-all duration-500 ease-in-out bg-blue-600/5 border-y border-white/5 ${showThresholdSettings ? 'max-h-64 opacity-100 p-6' : 'max-h-0 opacity-0 overflow-hidden py-0'}`}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-blue-400" />
                        <span className="text-sm font-bold text-white uppercase tracking-wider">Technical threshold</span>
                      </div>
                      <span className="text-xs font-mono font-black text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">{(thresholds.technical * 100).toFixed(0)}%</span>
                    </div>
                    <input 
                      type="range" min="0.5" max="1.0" step="0.01" 
                      value={thresholds.technical}
                      onChange={(e) => setThresholds(prev => ({ ...prev, technical: parseFloat(e.target.value) }))}
                      onMouseUp={() => updateThreshold('similarity_threshold_technical', thresholds.technical)}
                      className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <p className="text-[10px] text-slate-500 leading-relaxed italic">장애 키워드가 포함된 문자의 지식베이스 매칭 강도를 조절합니다.</p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-purple-400" />
                        <span className="text-sm font-bold text-white uppercase tracking-wider">Casual Match Strictness</span>
                      </div>
                      <span className="text-xs font-mono font-black text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">{(thresholds.casual * 100).toFixed(0)}%</span>
                    </div>
                    <input 
                      type="range" min="0.7" max="1.0" step="0.01" 
                      value={thresholds.casual}
                      onChange={(e) => setThresholds(prev => ({ ...prev, casual: parseFloat(e.target.value) }))}
                      onMouseUp={() => updateThreshold('similarity_threshold_casual', thresholds.casual)}
                      className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                    <p className="text-[10px] text-slate-500 leading-relaxed italic">일상적인 대화(키워드 없음)가 지식베이스와 오탐지되는 것을 방지합니다.</p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {visibleSms.length > 0 ? (
                  <div className="p-3 space-y-1.5">
                    {visibleSms.map((msg) => {
                      const isSelected = selectedSms?.inc_id === msg.inc_id;
                      return (
                        <div
                          key={`sms-${msg.inc_id}`}
                          onClick={() => {
                            const isSelected = selectedSms?.inc_id === msg.inc_id;
                            if (!isSelected) {
                              // SMS 선택: selectedSms + insightSms 동시 설정 → AiInsightPanel 분석 트리거
                              setSelectedSms(msg);
                              selectedSmsRef.current = msg;
                              setInsightSms(msg);
                              setAgentMessages([]);
                              setShowAgentPanel(true);
                              setActiveLogTab('ai');
                              setSelectedIncidentIdFlow(msg.inc_id);
                              
                              // 🚀 Trigger "Lively" animation for Flow panel
                              // (setIsFlowSpinning is handled inside fetchWorkflow useEffect)
                            } else {
                              // 선택 해제
                              setSelectedSms(null);
                              selectedSmsRef.current = null;
                              setInsightSms(null);
                              setShowAgentPanel(false);
                              setAgentMessages([]);
                            }
                          }}
                          style={{ border: `1px solid ${isSelected ? 'rgba(234,179,8,0.6)' : 'rgba(255,255,255,0.04)'}` }}
                          className={`rounded-2xl py-2 px-4 flex flex-col group transition-all cursor-pointer ${
                            isSelected ? 'bg-yellow-500/5 ring-1 ring-yellow-500/30' : 'bg-[#11141d] hover:border-yellow-500/30'
                          }`}
                        >
                          {/* 상단: 제목 + 배지 */}
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${isSelected ? 'bg-yellow-600/20' : 'bg-blue-600/10'}`}>
                                {msg.keyword_detected
                                  ? <AlertCircle className="w-4 h-4 text-yellow-300" />
                                  : <Info className={`w-4 h-4 ${isSelected ? 'text-yellow-400' : 'text-blue-400'}`} />
                                }
                              </div>
                              <h4 className={`font-black text-[14.5px] truncate tracking-tight transition-colors ${isSelected ? 'text-yellow-400' : 'text-white'}`}>
                                {msg.sender === 'Manual Entry' || msg.channel === 'MANUAL' ? 'Manual Registration' : 'SMS Detected'}
                              </h4>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={(e) => { e.stopPropagation(); navigate(`/workflow/${msg.inc_id}`); }}
                                className="h-6 flex items-center gap-1 px-2 rounded-lg text-[8.5px] font-black text-blue-400 bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 whitespace-nowrap"
                              >
                                진행상태 <ExternalLink className="w-2.5 h-2.5" />
                              </button>
                              <span className={`h-6 flex items-center px-2 rounded-lg border text-[8.5px] font-black whitespace-nowrap transition-all ${
                                msg.incident_status === '처리완료'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                  : Number(msg.is_analyzed) >= 1
                                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                    : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20 animate-pulse'
                              }`}>
                                {msg.incident_status === '처리완료' ? '완료' : Number(msg.is_analyzed) >= 1 ? 'ANL_COMPLETE' : 'ANALYZING'}
                              </span>

                            </div>
                          </div>

                          {/* 중단: 발신자 + 사번 */}
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <p className="text-[8.5px] text-slate-500 font-bold">발신: <span className="text-slate-400 font-mono">{msg.sender}</span></p>
                            {msg.employee_id && (
                              <span className="h-5 flex items-center gap-1 bg-blue-500/10 px-1.5 rounded-md border border-blue-500/20 text-[8.5px] text-blue-400 font-mono font-black">
                                {msg.employee_id} {msg.sender_name && `(${msg.sender_name})`}
                              </span>
                            )}
                          </div>

                          {/* 하단: 메시지 본문 + 타임스탬프 */}
                          <div className="flex flex-col gap-1">
                            <p className={`text-[13px] leading-relaxed font-medium break-all whitespace-pre-wrap transition-colors ${isSelected ? 'text-yellow-100' : 'text-slate-300'}`}>
                              {msg.message}
                            </p>
                            {(msg.similarity_score !== undefined && msg.similarity_score !== null) && (
                              <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-[8px] font-black uppercase w-fit ${
                                msg.similarity_score >= 0.8 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                              }`}>
                                <Zap className="w-2 h-2" />
                                Match {(msg.similarity_score * 100).toFixed(1)}%
                              </div>
                            )}
                            <div className="flex justify-end border-t border-white/5 pt-1 mt-0.5">
                              <span className="text-[8px] text-slate-600 font-bold font-mono opacity-50">{formatYYMMDD(msg.timestamp)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-4 opacity-30">
                    <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-500/10 flex items-center justify-center">
                      <MessageSquare className="w-6 h-6 text-blue-400" />
                    </div>
                    <div className="text-center space-y-1">
                      <p className="text-xs font-black text-slate-400 uppercase tracking-wider">수신된 SMS 없음</p>
                      <p className="text-[10px] text-slate-600">장애 SMS가 수신되면 여기에 표시됩니다</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>{/* end flex-1 wrapper */}

          </div>{/* end col1 */}

          {/* ── 2/4: S-Autopilot Insight Panel ── */}
          <div className="flex flex-col h-full overflow-hidden">
            <AiInsightPanel 
               onLogReceived={handleLogReceived} 
               onShowDetail={handleShowInsight} 
               selectedSms={insightSms} 
               onOpenWarRoom={handleOpenWarRoomFromInsight} 
               onAgentContent={handleAgentContent}
               warRooms={warRooms}
               onAnalyzingChange={setIsAiAnalyzing}
            />
          </div>{/* end col2 */}

          {/* ── 3/4: S-Autopilot Expert Advisor ── */}
          <div className="flex flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className={`bg-[#0a0c12] rounded-3xl border overflow-hidden flex flex-col shadow-2xl h-full transition-all duration-500 hud-card hud-corners ${selectedSms ? 'border-yellow-500/40 shadow-yellow-500/10' : 'border-white/5'}`}>
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-white/5 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`data-ring-wrapper shrink-0 ${isAiAnalyzing ? 'data-ring-spinning' : ''}`}>
                      <div className={`bg-indigo-500/20 border border-indigo-500/30 p-2.5 rounded-xl shrink-0 ${isAiAnalyzing ? 'animate-pulse' : ''}`}>
                        <Sparkles className="w-5 h-5 text-indigo-300" />
                      </div>
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-black text-white text-base tracking-tight">S-Autopilot Expert Advisor</h3>
                      <span className="text-[9px] font-bold text-slate-500 tracking-widest uppercase">Real-time AI Response Engine</span>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-hidden">
                  {showAgentPanel || selectedSms ? (
                    <div className="h-full flex flex-col overflow-hidden">
                      {activeLogTab === 'ai' ? (
                        <AgentDiscussionPanel
                          messages={agentMessages}
                          isVisible={true}
                          embedded={true}
                          incident={selectedSms}
                          onClose={() => {
                            setShowAgentPanel(false);
                            setSelectedSms(null);
                          }}
                        />
                      ) : (
                        <WarRoomChatPanel
                          incidentId={selectedSms?.inc_id}
                          currentUser={userProfile || {}}
                          isVisible={true}
                        />
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-600 opacity-30 gap-3">
                      <Brain className="w-10 h-10" />
                      <p className="text-xs font-bold uppercase tracking-wider">Select an incident to analyze</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>{/* end col3 */}

          {/* ── 4/4: 처리 현황 ── */}
          <div className="flex flex-col h-full overflow-hidden">
            {/* Activity History Flow Area */}
            <div className="bg-[#0f1421] rounded-3xl border border-white/5 shadow-xl flex-1 overflow-hidden flex flex-col hud-card hud-corners">
              {/* Header */}
              <div className="p-4 sm:p-5 border-b border-white/5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`data-ring-wrapper shrink-0 ${isFlowSpinning ? 'data-ring-spinning' : ''}`}>
                    <div className={`bg-purple-500/20 border border-purple-500/30 p-2.5 rounded-xl shrink-0 ${isFlowSpinning ? 'animate-pulse' : ''}`}>
                      <Activity className="w-5 h-5 text-purple-400" />
                    </div>
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-black text-white text-base tracking-tight">처리 현황</h3>
                    <span className="text-[9px] font-bold text-slate-500 tracking-widest uppercase">Incident Handling Progress</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {/* 시간 정보: DETECTION + MTTR 한 줄 */}
                    {selectedIncidentIdFlow && (() => {
                      const assignment = myAssignments.find(a => String(a.inc_id).replace('INC-', '') === String(selectedIncidentIdFlow).replace('INC-', '')) ||
                                         smsMessages.find(a => String(a.inc_id).replace('INC-', '') === String(selectedIncidentIdFlow).replace('INC-', ''));
                      const startStep = incidentWorkflowSteps.find(s => s.id === 'SMS');
                      const endStep = incidentWorkflowSteps.find(s => s.id === 'KNOWLEDGE');
                      const startTime = startStep ? new Date(startStep.timestamp) : (assignment ? new Date(assignment.timestamp || assignment.assigned_at) : null);
                      const endTime = endStep ? new Date(endStep.timestamp) : null;
                      if (!startTime) return null;
                      const durationMs = (endTime || currentTime) - startTime;
                      const isClosed = !!endTime;

                      const smsStep     = incidentWorkflowSteps.find(s => s.id === 'SMS');
                      const ragStep     = incidentWorkflowSteps.find(s => s.id === 'RAG') || incidentWorkflowSteps.find(s => s.id === 'AGENT');
                      const warStep     = incidentWorkflowSteps.find(s => s.id === 'WARROOM');
                      const knwStep     = incidentWorkflowSteps.find(s => s.id === 'KNOWLEDGE');

                      return (
                        <div className="flex flex-col gap-1 mt-1">
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                              <span className="text-[8px] uppercase tracking-tight text-slate-500 font-bold">DET</span>
                              <span className="text-[10px] font-black font-mono text-white bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                                {formatYYMMDD(startTime)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[8px] uppercase tracking-tight text-slate-500 font-bold">MTTR</span>
                              <div className="flex items-center gap-1">
                                <div className={`w-1 h-1 rounded-full ${isClosed ? 'bg-emerald-500' : 'bg-blue-500 animate-pulse'}`} />
                                <span className={`text-[12px] font-black font-mono tabular-nums ${isClosed ? 'text-emerald-400 bloom-green' : 'text-blue-400 bloom-cyan'}`}>
                                  {formatDuration(durationMs)}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {[
                              { label: '인지', from: smsStep, to: ragStep },
                              { label: '분석', from: ragStep, to: warStep },
                              { label: '워룸', from: warStep, to: knwStep },
                              { label: '완료', from: smsStep, to: knwStep },
                            ].map(({ label, from, to }) => {
                              const isDone = label === '완료' ? !!knwStep : !!to;
                              const isActive = !!from && !to;
                              const ms = from ? ((to ? new Date(to.timestamp) : currentTime) - new Date(from.timestamp)) : 0;
                              const m = Math.floor(ms / 60000);
                              const s = Math.floor((ms % 60000) / 1000);
                              const timeStr = from ? (m > 0 ? `${m}m${s}s` : `${s}s`) : '-';
                              return (
                                <div key={label} className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[8px] font-black ${
                                  isDone ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                  : isActive ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                                  : 'bg-white/3 border-white/5 text-slate-600'
                                }`}>
                                  <span className="opacity-60">{label}</span>
                                  <span className="font-mono">{timeStr}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                </div>
              </div>

              <div className="flex-1 overflow-hidden p-5">
                <div className="relative h-full">
                  <div className="absolute left-[11px] top-4 bottom-4 w-[2px] bg-gradient-to-b from-blue-600/50 via-purple-500/50 to-transparent" />

                  {selectedIncidentIdFlow ? (
                    <div className="flex flex-col h-full relative" style={{ minHeight: '100%' }}>
                      {(() => {
                        const stepTimestamps = FLOW_STEPS.map(step => {
                          let sData = incidentWorkflowSteps.find(s => s.id === step.id);
                          if (!sData && step.id === 'RAG_AGENT') {
                            sData = incidentWorkflowSteps.find(s => s.id === 'RAG') || incidentWorkflowSteps.find(s => s.id === 'AGENT');
                          }
                          return sData ? new Date(sData.timestamp) : null;
                        });

                        const durations = FLOW_STEPS.slice(0, -1).map((_, i) => {
                          const start = stepTimestamps[i];
                          const next  = stepTimestamps[i+1];
                          if (!start) return 0;
                          const end = next || (i === FLOW_STEPS.findIndex(t => !stepTimestamps[FLOW_STEPS.indexOf(t)]) - 1 ? currentTime : start);
                          return Math.max(0, end - start);
                        });

                        const totalDuration = durations.reduce((a, b) => a + b, 0) || 1;

                        return FLOW_STEPS.map((step, sIdx) => {
                          const stepData = incidentWorkflowSteps.find(s => s.id === step.id) || 
                                           (step.id === 'RAG_AGENT' ? (incidentWorkflowSteps.find(s => s.id === 'RAG') || incidentWorkflowSteps.find(s => s.id === 'AGENT')) : null);
                          const isCompleted = !!stepData;
                          const isNextStep = !isCompleted && (sIdx === 0 || !!(incidentWorkflowSteps.find(s => s.id === FLOW_STEPS[sIdx-1].id) || (FLOW_STEPS[sIdx-1].id === 'RAG_AGENT' && (incidentWorkflowSteps.find(s => s.id === 'RAG') || incidentWorkflowSteps.find(s => s.id === 'AGENT')))));

                          const rawWeight = sIdx < FLOW_STEPS.length - 1 ? (durations[sIdx] / totalDuration) : 0;
                          const flexWeight = sIdx < FLOW_STEPS.length - 1 ? (0.2 + rawWeight * 0.8) : 0;

                          return (
                            <React.Fragment key={step.id}>
                              <div className="relative pl-12 group shrink-0">
                                <span className={`data-ring-wrapper data-ring-sm absolute left-0 top-0 z-10 ${isNextStep ? 'data-ring-spinning' : ''}`} style={{ width: 28, height: 28 }}>
                                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-all duration-700
                                    ${isCompleted 
                                      ? 'bg-blue-600/30 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.4)] scale-110' 
                                      : isNextStep 
                                      ? 'bg-yellow-500/20 border-transparent shadow-[0_0_10px_rgba(234,179,8,0.3)]' 
                                      : 'bg-white/5 border-white/10 opacity-40'}`}>
                                    <step.icon className={`w-3.5 h-3.5 ${isCompleted ? 'text-blue-400' : isNextStep ? 'text-yellow-400' : 'text-slate-500'}`} />
                                  </div>
                                </span>
                                <div className={`transition-all duration-700 ${isCompleted ? 'opacity-100' : (isNextStep ? 'opacity-100 translate-x-1' : 'opacity-30')}`}>
                                  <div className="flex items-center gap-3 mb-1">
                                    <h4 className={`font-black tracking-tight text-sm ${isCompleted ? 'text-white' : (isNextStep ? 'text-blue-400' : 'text-gray-500')}`}>
                                      {step.label}
                                    </h4>
                                    {isCompleted && (
                                      <span className="text-[9px] text-white/50 font-mono">
                                        {formatYYMMDD(stepData.timestamp)}
                                      </span>
                                    )}
                                  </div>
                                  <p className={`text-[11px] leading-snug ${isCompleted ? 'text-slate-400' : (isNextStep ? 'text-slate-300' : 'text-slate-600')}`}>
                                    {isCompleted ? (stepData.detail?.length > 60 ? stepData.detail.slice(0,60)+'...' : stepData.detail) : (isNextStep ? '분석 진행 중...' : '대기 중')}
                                  </p>
                                </div>
                              </div>
                              {sIdx < FLOW_STEPS.length - 1 && (
                                <div className="relative ml-[13px] flex-1 min-h-[20px]" style={{ flexGrow: flexWeight }}>
                                  <div className={`absolute left-0 top-0 bottom-0 w-[2px] transition-colors duration-500
                                    ${isCompleted ? 'bg-blue-600' : 'bg-white/5'}`} />
                                  {/* Interval Time Badge (Dynamic Color & Active State) */}
                                  {durations[sIdx] > 10000 && (
                                    <div className={`absolute left-4 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded border flex items-center gap-1.5 transition-all duration-500 z-20
                                      ${durations[sIdx] > 300000 
                                        ? 'bg-red-500/20 border-red-500/50 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.4)]' 
                                        : durations[sIdx] > 60000 
                                        ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.2)]' 
                                        : 'bg-blue-500/10 border-blue-500/30 text-blue-400'}
                                      ${(isCompleted && !stepTimestamps[sIdx+1]) ? 'animate-pulse scale-110 border-blue-400/50 shadow-[0_0_15px_rgba(59,130,246,0.3)]' : ''}`}>
                                      <Clock className={`w-2.5 h-2.5 ${(isCompleted && !stepTimestamps[sIdx+1]) || durations[sIdx] > 60000 ? 'animate-spin' : ''}`} />
                                      <span className={`text-[9px] font-mono font-black ${(isCompleted && !stepTimestamps[sIdx+1]) ? 'text-[10px]' : ''}`}>
                                        {formatDuration(durations[sIdx])}
                                      </span>
                                      {(isCompleted && !stepTimestamps[sIdx+1]) && (
                                        <span className="flex h-1.5 w-1.5 relative">
                                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500"></span>
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </React.Fragment>
                          );
                        });
                      })()}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-24 opacity-20 grayscale transition-all duration-1000">
                      <Activity className="w-16 h-16 mb-4 text-blue-400 animate-pulse" />
                      <h3 className="text-sm font-black tracking-tight text-white mb-2">인시던트 대응 모니터링 활성화 대기 중</h3>
                      <p className="text-[10px] text-slate-500 max-w-[200px] text-center font-medium leading-relaxed">
                        좌측 '조치 리스트'에서 인시던트를 선택하시면,<br/>
                        실시간 MTTR 및 7단계 정밀 대응 흐름이 즉시 활성화됩니다.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Handling Progress Area */}

          {/* AI Agent Demo Components - Emergency Modal Only (Panel is now embedded) */}
          {/* AI Agent Demo Components - Emergency Modal disabled by user request
          <EmergencyActionModal
            isOpen={showEmergencyModal}
            onClose={() => setShowEmergencyModal(false)}
            onApprove={handleApproveAction}
          />
          */}

          {renderProfileModal()}
          {/* <AIInsightModal insight={selectedInsight} onClose={() => setSelectedInsight(null)} /> */}

      {/* War Room Chat List Popup */}
      {showWarRoomPopup && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowWarRoomPopup(false)} />

          <div className="bg-[#1a1f2e] w-full max-w-xl rounded-t-[2.5rem] border-t border-white/10 shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[80vh] animate-in slide-in-from-bottom-full duration-500">
            {/* Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-blue-600/10 to-transparent">
              <div className="flex items-center space-x-3">
                <div className="bg-blue-600/20 p-2.5 rounded-xl border border-blue-500/30">
                  <MessageSquare className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">참여 중인 War-Room</h3>
                  <p className="text-[10px] text-slate-500 font-mono">ACTIVE CHANNELS ({warRooms.length})</p>
                </div>
              </div>
              <button
                onClick={() => setShowWarRoomPopup(false)}
                className="p-2 rounded-full hover:bg-white/5 transition-colors group"
              >
                <X className="w-5 h-5 text-slate-500 group-hover:text-white" />
              </button>
            </div>

            {/* Chat Room List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3 custom-scrollbar">
              {warRooms.filter(r => String(r.status).toUpperCase() === 'OPEN').map((room) => (

                <div
                  key={room.id}
                  onClick={() => {
                    setShowWarRoomPopup(false);
                    navigate(`/chat/${room.id}`);
                  }}
                  className="bg-[#11141d] p-4 rounded-2xl border border-white/5 hover:border-blue-500/30 transition-all cursor-pointer group relative overflow-hidden active:scale-[0.98]"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${room.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-500 border-red-500/30 bloom-red' : 'bg-orange-500/20 text-orange-500 border-orange-500/30 bloom-orange'}
                        }`}>
                        {room.severity}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">ROOM #{room.id}</span>
                    </div>
                    <span className="text-[10px] text-white font-black font-mono bg-white/10 px-2 py-0.5 rounded whitespace-nowrap shadow-[0_0_10px_rgba(255,255,255,0.1)]">{room.time}</span>
                  </div>

                  <h4 className="font-bold text-slate-200 mb-2 group-hover:text-blue-400 transition-colors leading-relaxed line-clamp-2">
                    {room.sms_message ? `INC-${room.id} | ${room.sms_message}` : room.title}
                  </h4>
                  {room.lastMsg && <p className="text-xs text-slate-400 truncate mb-3">{room.lastMsg}</p>}

                  <div className="flex items-center justify-between">
                    <div className="flex -space-x-2">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="w-6 h-6 rounded-full bg-slate-800 border-2 border-[#11141d] flex items-center justify-center">
                          <User className="w-3 h-3 text-slate-400" />
                        </div>
                      ))}
                      <div className="w-6 h-6 rounded-full bg-blue-600/20 border-2 border-[#11141d] flex items-center justify-center">
                        <span className="text-[8px] font-bold text-blue-400">+{room.participants - 3}</span>
                      </div>
                    </div>
                    {room.unread && (
                      <div className="bg-blue-600 text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">NEW</div>
                    )}
                    <button
                      onClick={(e) => leaveWarRoom(e, room.id)}
                      className="text-[10px] bg-red-500/10 border border-red-500/30 text-red-500 px-2 py-1 rounded-full hover:bg-red-500/20 transition-colors ml-auto"
                    >
                      나가기
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Safe Area */}
            <div className="pb-8 px-6 pt-2">
              <button
                onClick={() => navigate('/assignments')}
                className="w-full py-4 rounded-2xl bg-slate-800 text-slate-400 font-bold text-sm hover:bg-slate-700 transition-colors"
              >
                전체 히스토리 보기
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
      </div>
      </div>
    </div>

    <BottomMenu 
        currentPath="/dashboard" 
        user={userProfile}
        onWarRoomClick={() => {
          fetchWarRooms();
          setShowWarRoomPopup(true);
        }} 
        initialOpenMoreMenu={showMoreMenuFromConsole}
      />
      {/* 🚀 Dynamic Save Toast for Thresholds */}
      {saveStatus && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[300] bg-[#1a1f2e] border border-emerald-500/30 text-emerald-400 text-xs font-black px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom duration-300">
          <CheckCircle className="w-4 h-4 animate-bounce" />
          <span>{saveStatus}</span>
        </div>
      )}
    </>
  );
}

function MetricCard({ title, value, subValue, trend, trendUp, icon: Icon, color }) {
  const colorClasses = {
    blue: "text-blue-400 bg-blue-500/10",
    purple: "text-purple-400 bg-purple-500/10",
    green: "text-emerald-400 bg-emerald-500/10",
    emerald: "text-emerald-400 bg-emerald-500/10",
    red: "text-red-400 bg-red-500/10",
    yellow: "text-yellow-400 bg-yellow-500/10",
  };

  return (
    <div className="bg-[#1a1f2e] p-5 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
      <div className="flex justify-between items-start mb-2">
        <div className={`p-2 rounded-lg ${colorClasses[color]} mb-2`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${trendUp ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'}`}>
            {trend}
          </span>
        )}
      </div>
      <div>
        <h4 className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">{title}</h4>
        <div className="flex items-baseline space-x-2">
          <span className="text-xl font-bold text-white">{value}</span>
          {subValue && <span className="text-xs text-slate-500">{subValue}</span>}
        </div>
      </div>
    </div>
  );
}

function AlertItem({ title, time, severity, desc, isSelected }) {
  const sevColor = {
    critical: "bg-red-500",
    warning: "bg-yellow-500",
    info: "bg-blue-500",
    success: "bg-green-500"
  };

  return (
    <div className={`flex items-start space-x-2 p-3 rounded-xl transition-all group cursor-pointer ${
      isSelected 
        ? "bg-yellow-500/10 border border-yellow-500/30 shadow-lg shadow-yellow-500/5" 
        : "bg-slate-900/30 border border-white/5 hover:bg-slate-800/50"
    }`}>
      <div className={`w-1.5 h-1.5 mt-2 rounded-full shrink-0 ${sevColor[severity]} ${isSelected ? 'animate-pulse' : ''} shadow-[0_0_8px_rgba(var(--color-primary),0.6)]`}></div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start mb-1 gap-2">
          <h4 className={`font-bold text-sm transition-colors ${isSelected ? 'text-yellow-400' : 'text-slate-200 group-hover:text-white'}`}>{title}</h4>
          <span className="text-[11px] font-black text-white whitespace-nowrap bg-white/10 px-2 py-0.5 rounded border border-white/20 shadow-md shrink-0">
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
    const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#0f111a]/80 backdrop-blur-sm" onClick={() => {
        if (profile.dept && profile.team) onClose();
      }}></div>

      <div className="relative w-full max-w-lg bg-gradient-to-b from-[#1a1f2e] to-[#0f111a] border border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-scale-up">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-cyan-400"></div>

        <div className="p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white flex items-center space-x-2">
              <User className="w-5 h-5 text-blue-400" />
              <span>회원 정보 관리</span>
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          <div className="flex items-center space-x-4 mb-8 bg-slate-900/40 p-4 rounded-2xl border border-white/5 relative">
            <div 
              className={`relative w-16 h-16 rounded-full bg-slate-800 border-2 ${isUploading ? 'border-amber-500 animate-pulse' : 'border-blue-500/30'} overflow-hidden shadow-lg shrink-0 group cursor-pointer`}
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
                <Camera className="w-5 h-5 text-white/80" />
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
              <h3 className="text-lg font-bold text-white leading-tight">{formData.name}</h3>
              <p className="text-xs text-slate-400">{profile.email}</p>
            </div>
          </div>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
            {/* 이름 */}
            <div>
              <label className="text-xs font-semibold text-slate-400 ml-1 mb-1.5 block">이름 *</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input required type="text" value={formData.name} onChange={handleChange('name')} placeholder="홍길동" className="w-full bg-[#1a1f2e] border border-blue-500/20 rounded-xl py-3.5 pl-11 pr-4 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-white appearance-none" />
              </div>
            </div>

            {/* 핸드폰 */}
            <div>
              <label className="text-xs font-semibold text-slate-400 ml-1 mb-1.5 block">핸드폰 번호</label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input type="tel" value={formData.phone || ''} onChange={handlePhoneChange} placeholder="010-0000-0000" maxLength={13} className="w-full bg-[#1a1f2e] border border-blue-500/20 rounded-xl py-3.5 pl-11 pr-4 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-white appearance-none" />
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
                  className="w-full bg-[#1a1f2e] border border-blue-500/20 rounded-xl py-3.5 pl-11 pr-10 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-white appearance-none"
                >
                  <option value="">회사를 선택하세요</option>
                  {companyList.map(c => (
                    <option key={c.code} value={c.code} className="bg-[#1a1f2e] text-white">{c.name}</option>
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
            </div>

            {/* 비밀번호 변경 섹션 */}
            <div className="pt-4 mt-2 border-t border-white/5">
              <button 
                onClick={() => setShowPasswordChange(!showPasswordChange)}
                className="flex items-center space-x-2 text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors uppercase tracking-wider mb-3"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{showPasswordChange ? '비밀번호 변경 취소' : '비밀번호 변경하기'}</span>
              </button>

              {showPasswordChange && (
                <div className="space-y-3 bg-white/5 p-4 rounded-2xl border border-white/5 animate-slide-down">
                  {/* 현재 비밀번호 */}
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
                      <input 
                        type={showPw ? 'text' : 'password'} 
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="현재 비밀번호" 
                        className="w-full bg-[#1a1f2e] border border-amber-500/30 rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-all appearance-none"
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
                          className="w-full bg-[#1a1f2e] border border-blue-500/20 rounded-xl py-3 pl-11 pr-11 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all appearance-none"
                        />
                        <button
                          onClick={() => setShowPw(!showPw)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
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
                          className="w-full bg-[#1a1f2e] border border-blue-500/20 rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all appearance-none"
                        />
                      </div>
                    </div>
                  <button
                    onClick={handlePasswordChange}
                    disabled={isChangingPassword}
                    className="w-full bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white font-bold py-2.5 rounded-xl transition-all text-xs border border-blue-500/30"
                  >
                    {isChangingPassword ? '변경 중...' : '비밀번호 변경 적용'}
                  </button>
                </div>
              )}
            </div>


          <div className="mt-8 flex flex-col space-y-3">
            <button
              onClick={handleSave}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-900/40 transition-all transform active:scale-[0.98]"
            >
              저장하기 (Save)
            </button>
            <button
              onClick={handleLogout}
              className="w-full bg-white/5 hover:bg-red-500/10 text-slate-400 hover:text-red-400 font-medium py-3 rounded-xl transition-all flex items-center justify-center space-x-1"
            >
              <LogIn className="w-4 h-4 rotate-180" />
              <span>Logout</span>
            </button>
          </div>

          {(!formData.company || !formData.honbu || !formData.team || !formData.part) && (
            <p className="text-[10px] text-yellow-500/70 text-center mt-4 italic">
              * 서비스 이용을 위해 필수 정보를 모두 입력해 주세요.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
