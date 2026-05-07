import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Activity, Server, AlertTriangle, CheckCircle, Clock, Search, Bell, BellDot, Cpu, Menu, User, ChevronRight, ChevronUp, Zap, Shield, Database, Sparkles, MessageSquare, Brain, MoreHorizontal, RefreshCw, Info, X, BarChart2, Hash, Users, LogIn, AlertCircle, Home, Phone, Building2, IdCard, ChevronDown, BarChart3, FileText, Settings, LogOut, ExternalLink, CheckCircle2, Filter, Lock, Eye, EyeOff, Calendar, Camera, Bot } from 'lucide-react';
import AgentDiscussionPanel from '../../components/AgentDiscussionPanel';
import EmergencyActionModal from '../../components/EmergencyActionModal';
import AiInsightPanel from '../../components/AiInsightPanel';
import WarRoomChatPanel from '../../components/WarRoomChatPanel';

import ErrorBoundary from '../../components/ErrorBoundary';
import AIInsightModal from '../../components/AIInsightModal';
import BottomMenu from '../components/BottomMenu.mobile';
import { useCodebook } from '../../context/CodebookContext';
import { getAccessToken, clearSession, getAuthHeaders } from '../../lib/authStore';

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
  const location = useLocation();
  const [showMoreMenuFromConsole, setShowMoreMenuFromConsole] = useState(false);
  const [showAgentPanel, setShowAgentPanel] = useState(false);

  // 더보기 서브페이지에서 뒤로가기 시 콘솔 자동 오픈
  useEffect(() => {
    const fromState = location.state?.openMoreMenu;
    const fromStorage = sessionStorage.getItem('console_return_pending') === '1';
    if (fromState || fromStorage) {
      setShowMoreMenuFromConsole(true);
      sessionStorage.removeItem('console_return_pending');
      window.history.replaceState({}, '');
    }
  }, [location.key]); // location.key는 매 navigation마다 갱신됨

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
    { id: 'WARROOM', label: '워룸생성 및 할당완료' },
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
            startLiveScenario(latestMsg);
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

      // Leader: [리더의 최종 조치 가이드] 이하 제거
      if (name === 'Leader') {
        const guidePattern = /(\*{0,2}#{0,4}\s*\[?리더의 최종 조치 가이드\]?\*{0,2})/;
        const guideMatch = guidePattern.exec(processed);
        if (guideMatch) processed = processed.substring(0, guideMatch.index);
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

  // Callback called from AiInsightPanel (PC 버전과 동일한 로직)
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

    if (filteredMsgs.length > 0) {
      setShowAgentPanel(true);
      // 순서대로(Security→DB→DevOps→Leader) 즉시 전부 표시
      setAgentMessages(filteredMsgs.map(m => ({ ...m, isCompleted: isDone })));
    }

    // 완료 시에만 DB 저장
    if (isDone && currentMsgs.length > 0) {
      const currentIncId = selectedSmsRef.current?.inc_id;
      if (currentIncId) {
        fetch(`${apiBase}/ai/chat-history/save`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ incident_id: String(currentIncId), messages: currentMsgs })
        }).catch(console.error);

        setTimeout(() => setShowEmergencyModal(true), 1500);
      }
    }
  };


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
  };

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
    <div className="text-white font-sans overflow-x-clip relative" style={{ background: '#080c14', minHeight: '100dvh' }}>

      {/* ── TOP NAV ──────────────────────────────────── */}
      <nav className="mobile-top-nav flex justify-between items-center px-4 sticky top-0 z-30"
        style={{ background: '#080c14', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>

        {/* Left: logo + icon buttons */}
        <div className="flex items-center gap-4">
          <button onClick={() => window.location.reload()}
            className="text-sm font-black tracking-[0.2em] uppercase text-white">
            S-GUARD <span style={{ color: '#3b82f6' }}>AI</span>
          </button>

          <div className="flex items-center gap-1.5">
            {/* Orbital Command */}
            <button onClick={() => navigate('/orbital-command')}
              onPointerDown={() => handleTooltipStart('Orbital Command')} onPointerUp={handleTooltipEnd} onPointerLeave={handleTooltipEnd}
              className="w-8 h-8 rounded-lg flex items-center justify-center active:opacity-60"
              style={{ border: '1px solid rgba(6,182,212,0.4)', background: 'transparent' }}>
              <Cpu size={15} style={{ color: '#06b6d4' }} />
            </button>

            {/* Alert Monitor */}
            <button onClick={() => navigate('/alert-monitor')}
              onPointerDown={() => handleTooltipStart('Alert Monitor')} onPointerUp={handleTooltipEnd} onPointerLeave={handleTooltipEnd}
              className="w-8 h-8 rounded-lg flex items-center justify-center active:opacity-60"
              style={{ border: '1px solid rgba(239,68,68,0.4)', background: 'transparent' }}>
              <BellDot size={15} style={{ color: '#ef4444' }} />
            </button>

            {/* Threshold */}
            <button onClick={(e) => { e.stopPropagation(); setShowThresholdSettings(!showThresholdSettings); }}
              onPointerDown={() => handleTooltipStart('Threshold')} onPointerUp={handleTooltipEnd} onPointerLeave={handleTooltipEnd}
              className="w-8 h-8 rounded-lg flex items-center justify-center active:opacity-60"
              style={{
                border: showThresholdSettings ? '1px solid rgba(59,130,246,0.7)' : '1px solid rgba(255,255,255,0.12)',
                background: showThresholdSettings ? 'rgba(59,130,246,0.1)' : 'transparent'
              }}>
              <Settings size={15} className={showThresholdSettings ? 'rotate-45' : ''} style={{ color: showThresholdSettings ? '#60a5fa' : '#64748b', transition: 'transform 0.3s' }} />
            </button>

            {/* S-Callert (admin only) */}
            {(userProfile?.is_admin === 1 || userProfile?.role === 'admin') && (
              <button onClick={() => navigate('/s-callert')}
                onPointerDown={() => handleTooltipStart('S-Callert')} onPointerUp={handleTooltipEnd} onPointerLeave={handleTooltipEnd}
                className="w-8 h-8 rounded-lg flex items-center justify-center active:opacity-60"
                style={{ border: '1px solid rgba(251,146,60,0.4)', background: 'transparent' }}>
                <Phone size={15} style={{ color: '#fb923c' }} />
              </button>
            )}
          </div>
        </div>

        {/* Right: AI button + profile */}
        <div className="flex items-center gap-3">
          <button onClick={onAiClick}
            onPointerDown={() => handleTooltipStart('AI Assistant')} onPointerUp={handleTooltipEnd} onPointerLeave={handleTooltipEnd}
            className="w-8 h-8 rounded-lg flex items-center justify-center active:opacity-60"
            style={{ border: '1px solid rgba(168,85,247,0.5)', background: 'rgba(168,85,247,0.08)' }}>
            <Bot size={16} style={{ color: '#a855f7' }} />
          </button>

          <button onClick={() => setShowProfileModal(true)} className="flex items-center gap-2 active:opacity-60">
            {userProfile && <span className="text-[11px] font-semibold text-slate-400 hidden sm:block">{userProfile.name}</span>}
            <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center"
              style={{ border: '1px solid rgba(59,130,246,0.3)', background: '#13182a' }}>
              {userProfile?.profile_picture
                ? <img src={userProfile.profile_picture} alt="Profile" className="w-full h-full object-cover" />
                : <User size={15} className="text-slate-400" />}
            </div>
          </button>
        </div>

        {/* Tooltip */}
        {activeTooltip && (
          <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[200]">
            <div className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white tracking-widest uppercase"
              style={{ background: '#1e40af', border: '1px solid rgba(96,165,250,0.4)' }}>
              {activeTooltip}
            </div>
          </div>
        )}
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
                <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 relative group overflow-hidden shrink-0"
                  style={{
                    background: 'linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(59,130,246,0.05) 100%)',
                    border: '1px solid rgba(59,130,246,0.3)',
                    boxShadow: '0 4px 12px -2px rgba(59,130,246,0.15)'
                  }}>
                  <Bell className="w-5 h-5 text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
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
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${n.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-500' : 'bg-blue-500/20 text-blue-400'}`}>
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


      {/* ── MAIN SCROLL ───────────────────────────────── */}
      <div className="px-3 pt-3 space-y-3" style={{ paddingBottom: 'calc(64px + env(safe-area-inset-bottom, 0px) + 16px)' }}>

        {/* ── PANEL 1: SMS FEED ── */}
        {(() => {
          const isCrit = smsMessages.some(m => m.severity === 'CRITICAL' || m.severity === 'MAJOR');
          const smsColor = isCrit ? '239,68,68' : '59,130,246';
          return (
        <div style={{
          background: '#0d1117',
          border: `1px solid rgba(${smsColor},0.45)`,
          borderRadius: 16,
          boxShadow: `0 0 12px rgba(${smsColor},0.18), 0 0 24px rgba(${smsColor},0.08), inset 0 0 10px rgba(${smsColor},0.06)`
        }}>

          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="flex items-center gap-2.5">
              <MessageSquare size={14} style={{ color: smsMessages.some(m => m.severity === 'CRITICAL' || m.severity === 'MAJOR') ? '#ef4444' : '#3b82f6' }} />
              <span className="text-[11px] font-bold text-white uppercase tracking-[0.15em]">실시간 SMS 수신내역</span>
            </div>
            <div className="flex items-center gap-3">
              {/* Hide Done toggle */}
              <button onClick={(e) => { e.stopPropagation(); setHideCompletedSms(!hideCompletedSms); }}
                className="flex items-center gap-1.5 active:opacity-60">
                <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: hideCompletedSms ? '#3b82f6' : '#475569' }}>Done 숨김</span>
                <div className="w-7 h-3.5 rounded-full relative" style={{ background: hideCompletedSms ? '#1d4ed8' : '#1e293b', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <div className="absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white" style={{ left: hideCompletedSms ? '13px' : '1px', transition: 'left 0.2s' }} />
                </div>
              </button>
              {/* LIVE dot */}
              {(() => {
                const isLive = smsMessages.length > 0 && smsMessages.some(m => !m.is_analyzed || Number(m.is_analyzed) === 0);
                return (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded"
                    style={{ border: `1px solid ${isLive ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.08)'}`, background: isLive ? 'rgba(59,130,246,0.06)' : 'transparent' }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: isLive ? '#3b82f6' : '#334155' }} />
                    <span className="text-[9px] font-black tracking-widest" style={{ color: isLive ? '#60a5fa' : '#475569' }}>{isLive ? 'LIVE' : 'DONE'}</span>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Threshold panel */}
          <div style={{ maxHeight: showThresholdSettings ? 200 : 0, overflow: 'hidden', transition: 'max-height 0.3s', borderBottom: showThresholdSettings ? '1px solid rgba(255,255,255,0.05)' : 'none', background: 'rgba(59,130,246,0.03)' }}>
            <div className="px-4 py-4 space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Technical Threshold</span>
                  <span className="text-[10px] font-black font-mono" style={{ color: '#60a5fa' }}>{(thresholds.technical * 100).toFixed(0)}%</span>
                </div>
                <input type="range" min="0.5" max="1.0" step="0.01" value={thresholds.technical}
                  onChange={(e) => setThresholds(prev => ({ ...prev, technical: parseFloat(e.target.value) }))}
                  onMouseUp={() => updateThreshold('similarity_threshold_technical', thresholds.technical)}
                  className="w-full h-1 rounded appearance-none cursor-pointer accent-blue-500" style={{ background: 'rgba(255,255,255,0.1)' }} />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Casual Strictness</span>
                  <span className="text-[10px] font-black font-mono" style={{ color: '#a855f7' }}>{(thresholds.casual * 100).toFixed(0)}%</span>
                </div>
                <input type="range" min="0.7" max="1.0" step="0.01" value={thresholds.casual}
                  onChange={(e) => setThresholds(prev => ({ ...prev, casual: parseFloat(e.target.value) }))}
                  onMouseUp={() => updateThreshold('similarity_threshold_casual', thresholds.casual)}
                  className="w-full h-1 rounded appearance-none cursor-pointer accent-purple-500" style={{ background: 'rgba(255,255,255,0.1)' }} />
              </div>
            </div>
          </div>

          {/* SMS list */}
          <div className="overflow-y-auto max-h-[420px] p-2 space-y-1.5">
            {visibleSms.length > 0 ? visibleSms.map((msg) => {
              const isSel = selectedSms?.inc_id === msg.inc_id;
              const isCrit = msg.severity === 'CRITICAL';
              const isMaj = msg.severity === 'MAJOR';
              const accentColor = isSel ? '#eab308' : isCrit ? '#ef4444' : isMaj ? '#f97316' : '#3b82f6';
              return (
                <div key={`sms-${msg.inc_id}`}
                  onClick={() => {
                    if (selectedSms?.inc_id === msg.inc_id) { setSelectedSms(null); setShowAgentPanel(false); setAgentMessages([]); }
                    else { setSelectedSms(msg); setShowAgentPanel(true); setAgentMessages([{ role: 'Security', text: '🔍 AI 분석을 시작합니다...', delay: 0 }]); }
                  }}
                  className="rounded-xl p-3 cursor-pointer active:opacity-70"
                  style={{
                    background: isSel ? 'rgba(234,179,8,0.04)' : '#0d1117',
                    borderLeft: `2px solid ${accentColor}`,
                    border: `1px solid ${isSel ? 'rgba(234,179,8,0.3)' : 'rgba(255,255,255,0.05)'}`,
                    borderLeftColor: accentColor,
                    borderLeftWidth: 3,
                    borderRadius: 10
                  }}>
                  {/* Row 1: type + badges */}
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      {msg.keyword_detected ? <AlertCircle size={12} style={{ color: accentColor }} /> : <Info size={12} style={{ color: accentColor }} />}
                      <span className="text-[11px] font-bold" style={{ color: isSel ? '#facc15' : '#e2e8f0' }}>
                        {msg.sender === 'Manual Entry' || msg.channel === 'MANUAL' ? 'Manual Registration' : 'SMS Detected'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {msg.severity && (
                        <span className="text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider"
                          style={{ color: accentColor, border: `1px solid ${accentColor}40`, background: `${accentColor}10` }}>
                          {msg.severity}
                        </span>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); navigate(`/workflow/${msg.inc_id}`); }}
                        className="text-[8px] font-black px-1.5 py-0.5 rounded active:opacity-60"
                        style={{ color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.06)' }}>
                        현황
                      </button>
                      <span className="text-[8px] font-black px-1.5 py-0.5 rounded"
                        style={{
                          color: msg.incident_status === '처리완료' ? '#34d399' : Number(msg.is_analyzed) >= 1 ? '#60a5fa' : '#facc15',
                          border: `1px solid ${msg.incident_status === '처리완료' ? 'rgba(52,211,153,0.3)' : Number(msg.is_analyzed) >= 1 ? 'rgba(96,165,250,0.3)' : 'rgba(250,204,21,0.3)'}`,
                          background: msg.incident_status === '처리완료' ? 'rgba(52,211,153,0.05)' : Number(msg.is_analyzed) >= 1 ? 'rgba(96,165,250,0.05)' : 'rgba(250,204,21,0.05)'
                        }}>
                        {msg.incident_status === '처리완료' ? '완료' : Number(msg.is_analyzed) >= 1 ? 'ANALYZED' : 'ANALYZING'}
                      </span>
                    </div>
                  </div>
                  {/* Row 2: sender */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] text-slate-500">발신 <span className="font-mono text-slate-400">{msg.sender}</span></span>
                    {msg.employee_id && (
                      <span className="text-[8px] font-mono px-1 rounded" style={{ color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)', background: 'rgba(59,130,246,0.05)' }}>
                        {msg.employee_id}{msg.sender_name && ` (${msg.sender_name})`}
                      </span>
                    )}
                  </div>
                  {/* Row 3: message */}
                  <p className="text-[12px] leading-relaxed break-all whitespace-pre-wrap" style={{ color: isSel ? '#fef9c3' : '#94a3b8' }}>{msg.message}</p>
                  {/* Row 4: footer */}
                  <div className="flex items-center justify-between mt-1.5 pt-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    {msg.similarity_score != null && (
                      <span className="text-[8px] font-black uppercase" style={{ color: msg.similarity_score >= 0.8 ? '#34d399' : '#60a5fa' }}>
                        ⚡ Match {(msg.similarity_score * 100).toFixed(1)}%
                      </span>
                    )}
                    <span className="text-[8px] font-mono text-slate-600 ml-auto">{formatYYMMDD(msg.timestamp)}</span>
                  </div>
                </div>
              );
            }) : (
              <div className="py-10 flex flex-col items-center gap-2 opacity-20">
                <MessageSquare size={24} className="text-slate-500" />
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">수신된 SMS 없음</p>
              </div>
            )}
          </div>
        </div>
          );
        })()}

        {/* ── PANEL 2: AI Insight (SMS 있을 때만) ── */}
        {visibleSms.length > 0 && (
          <div style={{
            background: '#0d1117',
            border: '1px solid rgba(168,85,247,0.4)',
            borderRadius: 16,
            overflow: 'hidden',
            boxShadow: '0 0 12px rgba(168,85,247,0.2), 0 0 28px rgba(168,85,247,0.08), inset 0 0 12px rgba(168,85,247,0.06)'
          }}>
            <AiInsightPanel
              onLogReceived={handleLogReceived}
              onShowDetail={handleShowInsight}
              selectedSms={insightSms}
              onOpenWarRoom={handleOpenWarRoomFromInsight}
              onAgentContent={handleAgentContent}
              warRooms={warRooms}
            />
          </div>
        )}


        {/* ── PANEL 3: Expert Advisor ── */}
        <div style={{
          background: '#0d1117',
          border: '1px solid rgba(45,212,191,0.4)',
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 0 12px rgba(45,212,191,0.18), 0 0 28px rgba(45,212,191,0.07), inset 0 0 12px rgba(45,212,191,0.05)'
        }}>
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="flex items-center gap-2.5">
              <Sparkles size={14} style={{ color: '#2dd4bf' }} />
              <span className="text-[11px] font-bold text-white uppercase tracking-[0.15em]">Expert Advisor</span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setActiveLogTab('ai')}
                className="px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-widest"
                style={{ background: activeLogTab === 'ai' ? '#312e81' : 'transparent', color: activeLogTab === 'ai' ? '#a5b4fc' : '#475569', border: '1px solid rgba(129,140,248,0.3)' }}>
                AI
              </button>
              <button onClick={() => setActiveLogTab('human')}
                className="px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-widest ml-0.5"
                style={{ background: activeLogTab === 'human' ? '#1e3a5f' : 'transparent', color: activeLogTab === 'human' ? '#60a5fa' : '#475569', border: '1px solid rgba(96,165,250,0.3)' }}>
                Chat
              </button>
              {(() => {
                const isDone = selectedSms && Number(selectedSms.is_analyzed) >= 1;
                const isLive = showAgentPanel && agentMessages.length > 0 && !isDone;
                return (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded ml-1"
                    style={{ border: `1px solid ${isLive ? 'rgba(52,211,153,0.4)' : 'rgba(255,255,255,0.08)'}`, background: isLive ? 'rgba(52,211,153,0.05)' : 'transparent' }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: isDone ? '#334155' : isLive ? '#34d399' : '#334155' }} />
                    <span className="text-[9px] font-black tracking-widest" style={{ color: isDone ? '#475569' : isLive ? '#6ee7b7' : '#475569' }}>
                      {isDone ? 'DONE' : isLive ? 'LIVE' : 'IDLE'}
                    </span>
                  </div>
                );
              })()}
            </div>
          </div>
          <div style={{ minHeight: 360 }}>
            {showAgentPanel || selectedSms ? (
              activeLogTab === 'ai' ? (
                <AgentDiscussionPanel
                  messages={agentMessages}
                  isVisible={true}
                  embedded={true}
                  incident={selectedSms}
                  onClose={() => { setShowAgentPanel(false); setSelectedSms(null); }}
                />
              ) : (
                <WarRoomChatPanel incidentId={selectedSms?.inc_id} currentUser={userProfile || {}} isVisible={true} />
              )
            ) : (
              <div className="flex flex-col items-center justify-center opacity-20" style={{ height: 200 }}>
                <Brain size={28} className="text-slate-600 mb-2" />
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">SMS를 선택하면 분석이 시작됩니다</p>
              </div>
            )}
          </div>
        </div>

        {/* ── PANEL 4: 장애 처리 현황 ── */}
        {(() => {
          const isActive = !!selectedIncidentIdFlow;
          const flowRgb = isActive ? '16,185,129' : '148,163,184';
          return (
        <div style={{
          background: '#0d1117',
          border: `1px solid rgba(${flowRgb},${isActive ? '0.45' : '0.3'})`,
          borderRadius: 16,
          boxShadow: isActive
            ? `0 0 14px rgba(${flowRgb},0.22), 0 0 30px rgba(${flowRgb},0.08), inset 0 0 12px rgba(${flowRgb},0.06)`
            : `0 0 8px rgba(${flowRgb},0.1), inset 0 0 6px rgba(${flowRgb},0.03)`
        }}>
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="flex items-center gap-2.5">
              <Activity size={14} style={{ color: selectedIncidentIdFlow ? '#10b981' : '#94a3b8' }} />
              <span className="text-[11px] font-bold text-white uppercase tracking-[0.15em]">장애 처리 현황</span>
            </div>
            {selectedIncidentIdFlow && (() => {
              const startStep = incidentWorkflowSteps.find(s => s.id === 'SMS');
              const endStep = incidentWorkflowSteps.find(s => s.id === 'KNOWLEDGE');
              if (!startStep) return null;
              const durationMs = (endStep ? new Date(endStep.timestamp) : currentTime) - new Date(startStep.timestamp);
              const isClosed = !!endStep;
              return (
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: isClosed ? '#34d399' : '#3b82f6' }} />
                  <span className="text-xs font-black font-mono tabular-nums" style={{ color: isClosed ? '#34d399' : '#60a5fa' }}>{formatDuration(durationMs)}</span>
                  <span className="text-[9px] font-bold text-slate-500 uppercase">MTTR</span>
                </div>
              );
            })()}
          </div>

          {/* Phase badges */}
          {selectedIncidentIdFlow && (() => {
            const smsStep = incidentWorkflowSteps.find(s => s.id === 'SMS');
            const ragStep = incidentWorkflowSteps.find(s => s.id === 'RAG') || incidentWorkflowSteps.find(s => s.id === 'AGENT');
            const warStep = incidentWorkflowSteps.find(s => s.id === 'WARROOM');
            const knwStep = incidentWorkflowSteps.find(s => s.id === 'KNOWLEDGE');
            const diff = (a, b) => { if (!a) return '-'; const ms = (b ? new Date(b.timestamp) : currentTime) - new Date(a.timestamp); const m = Math.floor(ms/60000), s2 = Math.floor((ms%60000)/1000); return m > 0 ? `${m}m${s2}s` : `${s2}s`; };
            return (
              <div className="flex items-center gap-1.5 px-4 py-2 flex-wrap" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                {[{l:'인지',a:smsStep,b:ragStep},{l:'분석',a:ragStep,b:warStep},{l:'워룸',a:warStep,b:knwStep},{l:'완료',a:smsStep,b:knwStep}].map(({l,a,b})=>{
                  const done = l==='완료'?!!knwStep:!!b; const active=!!a&&!b; const t=diff(a,b);
                  return <div key={l} className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold" style={{color:done?'#34d399':active?'#60a5fa':'#334155',border:`1px solid ${done?'rgba(52,211,153,0.3)':active?'rgba(96,165,250,0.3)':'rgba(255,255,255,0.06)'}`,background:done?'rgba(52,211,153,0.04)':active?'rgba(96,165,250,0.04)':'transparent'}}><span className="opacity-70">{l}</span><span className="font-mono">{t}</span></div>;
                })}
              </div>
            );
          })()}

          {/* Timeline */}
          <div className="p-4">
            {selectedIncidentIdFlow ? (
              <div className="relative">
                <div className="absolute left-[9px] top-0 bottom-0 w-px" style={{ background: 'rgba(59,130,246,0.2)' }} />
                {(() => {
                  const firstPendingIdx = FLOW_STEPS.findIndex(step => {
                    if (step.id === 'RAG_AGENT') return !incidentWorkflowSteps.find(s=>s.id==='RAG')&&!incidentWorkflowSteps.find(s=>s.id==='AGENT');
                    return !incidentWorkflowSteps.find(s=>s.id===step.id);
                  });
                  return FLOW_STEPS.map((step, sIdx) => {
                    let stepData = incidentWorkflowSteps.find(s=>s.id===step.id);
                    if (step.id==='RAG_AGENT'){const rag=incidentWorkflowSteps.find(s=>s.id==='RAG'),agent=incidentWorkflowSteps.find(s=>s.id==='AGENT');if(rag&&agent)stepData={...agent,id:'RAG_AGENT',timestamp:agent.timestamp>rag.timestamp?agent.timestamp:rag.timestamp,detail:'AI 에이전트 그룹이 수천 건의 과거 데이터와 내부 지식베이스를 결합하여 인시던트 근본 원인을 입체적으로 분석하고 대응 시나리오를 수립했습니다.'};else if(rag||agent)stepData={...(rag||agent),id:'RAG_AGENT'};}
                    if(step.id==='WARROOM'&&stepData?.detail?.includes('2.0님'))stepData.detail=stepData.detail.replace('2.0님','조경훈님');
                    const isCompleted=!!stepData, isNextStep=sIdx===firstPendingIdx;
                    let intervalText=null, intervalMinutes=0;
                    if(isCompleted&&sIdx<FLOW_STEPS.length-1){const nextId=FLOW_STEPS[sIdx+1].id;let next=incidentWorkflowSteps.find(s=>s.id===nextId);if(!next&&nextId==='RAG_AGENT')next=incidentWorkflowSteps.find(s=>s.id==='RAG')||incidentWorkflowSteps.find(s=>s.id==='AGENT');if(next){const ms=new Date(next.timestamp)-new Date(stepData.timestamp);const m=Math.floor(ms/60000),sec=Math.floor((ms%60000)/1000);intervalMinutes=m;intervalText=m>60?`⏱ ${Math.floor(m/60)}h ${m%60}m`:m>0?`⏱ ${m}m ${sec}s`:`⏱ ${sec}s`;}else if(sIdx===firstPendingIdx-1){const ms=currentTime-new Date(stepData.timestamp);const m=Math.floor(ms/60000),sec=Math.floor((ms%60000)/1000);intervalMinutes=m;intervalText=m>60?`⏱ ${Math.floor(m/60)}h ${m%60}m 경과`:m>0?`⏱ ${m}m ${sec}s 경과`:`⏱ ${sec}s 경과`;}}
                    const pb = intervalMinutes===0?24:Math.min(160,Math.max(24,Math.round(24+intervalMinutes*0.2)));
                    return (
                      <div key={step.id} className="relative pl-10" style={{ paddingBottom: pb+'px', opacity: !isCompleted&&!isNextStep ? 0.3 : 1 }}>
                        {sIdx < FLOW_STEPS.length-1 && <div className="absolute left-[9px] top-5 bottom-0 w-px" style={{ background: isCompleted ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.06)' }} />}
                        <div className="absolute left-0 top-0 w-[18px] h-[18px] rounded-full flex items-center justify-center" style={{ background: isCompleted ? '#1e3a8a' : isNextStep ? '#172554' : '#0f172a', border: `1px solid ${isCompleted ? '#3b82f6' : isNextStep ? 'rgba(96,165,250,0.5)' : 'rgba(255,255,255,0.1)'}` }}>
                          {isCompleted ? <CheckCircle2 size={10} style={{ color: '#60a5fa' }} /> : isNextStep ? <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#3b82f6' }} /> : <span className="w-1 h-1 rounded-full" style={{ background: '#1e293b' }} />}
                        </div>
                        <div className="ml-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[12px] font-bold" style={{ color: isCompleted ? '#e2e8f0' : isNextStep ? '#60a5fa' : '#334155' }}>{step.label}</span>
                            {isNextStep && <span className="text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider" style={{ color: '#60a5fa', border: '1px solid rgba(96,165,250,0.4)', background: 'rgba(96,165,250,0.08)' }}>진행중</span>}
                            {isCompleted && <span className="text-[9px] font-mono text-slate-500">{formatYYMMDD(stepData.timestamp)}</span>}
                          </div>
                          <p className="text-[11px] leading-relaxed" style={{ color: isCompleted ? '#64748b' : isNextStep ? '#94a3b8' : '#1e293b' }}>
                            {isCompleted ? stepData.detail : isNextStep ? '처리 진행 중...' : '대기 중'}
                          </p>
                          {intervalText && sIdx < FLOW_STEPS.length-1 && (
                            <span className="inline-block mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ color: intervalMinutes>60?'#fb923c':intervalMinutes>10?'#eab308':'#34d399', border: `1px solid ${intervalMinutes>60?'rgba(251,146,60,0.3)':intervalMinutes>10?'rgba(234,179,8,0.3)':'rgba(52,211,153,0.3)'}`, background: 'transparent' }}>{intervalText}</span>
                          )}
                          {(isCompleted||isNextStep)&&step.id==='WARROOM'&&(()=>{
                            const roomExists=warRooms.some(r=>String(r.id)===String(selectedIncidentIdFlow)||String(r.inc_id)===String(selectedIncidentIdFlow));
                            return roomExists?(
                              <button onClick={()=>navigate(`/chat/${selectedIncidentIdFlow}`)} className="mt-1.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded active:opacity-60 text-[11px] font-bold" style={{ color: '#e2e8f0', border: '1px solid rgba(59,130,246,0.5)', background: 'rgba(59,130,246,0.1)' }}>
                                <Zap size={11} />워룸 이동<ChevronRight size={11} />
                              </button>
                            ):(
                              <button disabled className="mt-1.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-bold" style={{ color: '#334155', border: '1px solid rgba(255,255,255,0.06)', background: 'transparent', cursor:'not-allowed' }}>
                                <Users size={11} />워룸 미개설
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
              <div className="flex flex-col items-center justify-center py-12 opacity-15">
                <Activity size={24} className="text-slate-600 mb-2" />
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">인시던트를 선택하면 활성화됩니다</p>
              </div>
            )}
          </div>
        </div>
          );
        })()}

      </div>

      {/* EmergencyActionModal - disabled by user request */}
      {renderProfileModal()}
      {/* AIInsightModal - disabled */}

      {/* War Room Chat List Popup */}
      {showWarRoomPopup && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowWarRoomPopup(false)} />

          <div className="bg-[#1a1f2e] w-full max-w-xl rounded-t-[2.5rem] border-t border-white/10 shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[80vh] animate-in slide-in-from-bottom-full duration-500">
            {/* Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-blue-600/10 to-transparent">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 relative group overflow-hidden shrink-0"
                  style={{
                    background: 'linear-gradient(135deg, rgba(59,130,246,0.2) 0%, rgba(59,130,246,0.05) 100%)',
                    border: '1px solid rgba(59,130,246,0.4)',
                    boxShadow: '0 4px 12px -2px rgba(59,130,246,0.2)'
                  }}>
                  <MessageSquare className="w-5 h-5 text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
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
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${room.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-500 border-red-500/30' : 'bg-orange-500/20 text-orange-500 border-orange-500/30'
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


      {/* Bottom Navigation */}
      <BottomMenu 
        currentPath="/dashboard" 
        initialOpenMoreMenu={showMoreMenuFromConsole}
        onWarRoomClick={() => {
          fetchWarRooms();
          setShowWarRoomPopup(true);
        }} 
      />

      {/* 🚀 Dynamic Save Toast for Thresholds */}
      {saveStatus && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[300] bg-[#1a1f2e] border border-emerald-500/30 text-emerald-400 text-xs font-black px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom duration-300">
          <CheckCircle className="w-4 h-4 animate-bounce" />
          <span>{saveStatus}</span>
        </div>
      )}
    </div>
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
              {(profile.employee_id || profile.id) && (
                <div className="flex items-center gap-1.5 mt-1">
                  <IdCard className="w-3 h-3 text-slate-500" />
                  <span className="text-[11px] font-mono text-slate-400">사번 {profile.employee_id || profile.id}</span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
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
                    className="w-full bg-slate-900/60 border border-white/5 rounded-xl py-3.5 pl-11 pr-4 text-sm text-slate-400 cursor-not-allowed appearance-none select-all font-mono"
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
