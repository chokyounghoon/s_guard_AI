import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Server, AlertTriangle, CheckCircle, Clock, Search, Bell, Menu, User, ChevronRight, Zap, Shield, Database, Sparkles, MessageSquare, Brain, MoreHorizontal, RefreshCw, Info, X, BarChart2, Hash, Users, LogIn, AlertCircle, Home, Phone, Building2, IdCard, ChevronDown, BarChart3, FileText, Settings, LogOut, ExternalLink, CheckCircle2, Filter, Lock, Eye, EyeOff, Calendar } from 'lucide-react';
import AgentDiscussionPanel from '../components/AgentDiscussionPanel';
import EmergencyActionModal from '../components/EmergencyActionModal';
import AiInsightPanel from '../components/AiInsightPanel';

import ErrorBoundary from '../components/ErrorBoundary';
import AIInsightModal from '../components/AIInsightModal';
import BottomMenu from '../components/BottomMenu';



// ── 데이터 ─────────────────────────────────────────
const getApiUrl = (endpoint) => {
  const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  // AI 및 DB 관련 에코시스템은 FastAPI 백엔드 프록시를 통해 동기화 이점을 누린다.
  if (isLocalDev && (endpoint.startsWith('/ai/') || endpoint.startsWith('/db/'))) {
    return `http://127.0.0.1:8000${endpoint}`;
  }
  // 그 외 SMS 목록 조회 등 순수 데이터는 Worker API 직접 호출
  return 'https://sguardai.khcho0421.workers.dev' + endpoint;
};

const API_BASE = getApiUrl('');

// ── 셀렉트 + 기타 입력 컴포넌트 ───────────────────
function SelectWithOther({ label, icon: Icon, options, value, onChange, required, disabled }) {
  const nonOther = options.filter(o => o !== '기타');
  const initialIsOther = !!value && !nonOther.includes(value);
  const [isOther, setIsOther] = useState(initialIsOther);
  const [otherText, setOtherText] = useState(initialIsOther ? value : '');

  const selectVal = isOther ? '기타' : (value || '');

  const handleSelect = (e) => {
    const v = e.target.value;
    if (v === '기타') {
      setIsOther(true);
      onChange(otherText);
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
            <option key={o} value={o} className="bg-[#1a1f2e] text-white">{o}</option>
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

export default function DashboardPage() {
  const navigate = useNavigate();
  const [showAgentPanel, setShowAgentPanel] = useState(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [agentMessages, setAgentMessages] = useState([]);
  const [systemStatus, setSystemStatus] = useState('normal'); // normal, critical, recovering
  const [messages, setMessages] = useState([]); // For top-banner messages
  const [allNotifications, setAllNotifications] = useState([]); // For notification drawer
  const [showNotifications, setShowNotifications] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('week');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [aiInsights, setAiInsights] = useState({});
  const [selectedInsight, setSelectedInsight] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showWarRoomPopup, setShowWarRoomPopup] = useState(false);
  const [smsMessages, setSmsMessages] = useState([]);
  const [deletedSmsIds, setDeletedSmsIds] = useState(new Set());
  const [isSmsPanelCollapsed, setIsSmsPanelCollapsed] = useState(false);
  const [isLiveStreamCollapsed, setIsLiveStreamCollapsed] = useState(false);
  const [isWarRoomCollapsed, setIsWarRoomCollapsed] = useState(false);
  const [isAssignmentsCollapsed, setIsAssignmentsCollapsed] = useState(false);
  const [isFlowCollapsed, setIsFlowCollapsed] = useState(false);
  const [selectedIncidentIdFlow, setSelectedIncidentIdFlow] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [incidentWorkflowSteps, setIncidentWorkflowSteps] = useState([]);

  // MTTR Timer Effect
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const FLOW_STEPS = [
    { id: 'SMS', label: 'SMS 수신 및 장애 인지' },
    { id: 'RAG_AGENT', label: 'RAG 및 AI AGENT 분석 완료' },
    { id: 'WARROOM', label: '워룸생성 및 할당완료' },
    { id: 'REPORT', label: '보고서 생성완료' },
    { id: 'KNOWLEDGE', label: '지식화 및 보고완료' },
    { id: 'CLOSE', label: '워룸종료 및 장애처리완료' }
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
    const d = new Date(dateStr);
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

  const [selectedSms, setSelectedSms] = useState(null);
  const [insightSms, setInsightSms] = useState(null);
  const selectedSmsRef = useRef(null);
  const [lastAutoTriggeredId, setLastAutoTriggeredId] = useState(null);
  const lastAutoTriggeredIdRef = useRef(null);

  const [warRooms, setWarRooms] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [myAssignments, setMyAssignments] = useState([]);
  const [userActivityHistory, setUserActivityHistory] = useState([]);
  const [assignmentDateRange, setAssignmentDateRange] = useState({
    from: getKstDate(7),
    to: getKstDate(0)
  });

  const handleOpenWarRoomFromInsight = async (smsMessage, analysisText) => {
    const currentSms = smsMessage || selectedSmsRef.current;
    if (!currentSms) return;

    // The raw received SMS ID (e.g. 20231026154512345) MUST be the primary key DB identifier
    // to match aichat_history.
    const incidentId = String(currentSms.inc_id || currentSms.id || `${Date.now()}`).replace('INC-', '');
    
    const formattedUiId = `INC-${incidentId}`; // Display prefix
    const smsTitle = `${formattedUiId} | SMS 장애 감지`; // Do not include raw SMS message in title
    
    // Check if War-Room already exists
    const existingRoom = warRooms.find(r => r.id === incidentId);
    if (existingRoom) {
      navigate(`/chat/${incidentId}`);
      return;
    }
    
    let diagnosisText = '';
    let leaderSummary = '';
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
    }

    // 1. Add to local state
    const newRoom = {
      id: incidentId,
      title: smsTitle,
      lastMsg: analysisText ? 'AI분석 완료' : '',
      time: formatYYMMDD(new Date()),
      participants: 1,
      severity: 'CRITICAL',
      unread: true
    };
    setWarRooms(prev => [newRoom, ...prev]);

    // 2. Persist to DB
    try {
      const apiBase = 'https://sguardai.khcho0421.workers.dev';
      
      // Save to warroom_list
      const res = await fetch(`${apiBase}/ai/warroom/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inc_id: incidentId,
          title: smsTitle,
          creator_id: userProfile?.id || null,
          severity: 'CRITICAL',
          leader_summary: leaderSummary
        })
      });

      const openData = await res.json();
      // Even if status === 'exists', we proceed to UPDATE legacy incidents and insert AI analysis if provided.
      
      // Legacy incidents metadata (using UPSERT logic on backend to update description safely)
      await fetch(`${apiBase}/incidents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inc_id: String(incidentId).replace('INC-', ''),
          title: smsTitle,
          description: diagnosisText || 'SMS 장애 상세 분석 대기 중',
          severity: 'CRITICAL',
          incident_type: 'SMS',
          source_sms_id: String(currentSms.inc_id).replace('INC-', '')
        })
      });

      // AI Analysis Pinned Message - DEPRECATED as it messes up the clean Agent Discussion flow
      /*
      if (analysisText) {
        await fetch(`${apiBase}/warroom/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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

      // ONLY insert system intro messages if the room was NEWLY created
      if (openData.status !== 'exists') {
        await fetch(`${apiBase}/warroom/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            incident_id: incidentId,
            sender: '시스템',
            role: 'System',
            type: 'system',
            text: 'War-Room 채팅방이 생성되었습니다. 모든 대화 내용은 장애 해결 시 AI 학습에 사용됩니다.'
          })
        });
      }

      await fetchWarRooms();
      setShowEmergencyModal(false);
      navigate(`/chat/${incidentId}`);
    } catch (err) {
      console.error("Failed to open War-Room:", err);
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
      const token = localStorage.getItem('sguard_token');
      if (token) {
        try {
          const userId = token.replace('sguard-token-', '');
          const res = await fetch(`${API_BASE}/users/${userId}`);
          if (res.ok) {
            const user = await res.json();
            localStorage.setItem('sguard_user', JSON.stringify(user));
            setUserProfile(user);
            return;
          }
        } catch {
          // ignore, fall through to modal
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
        const res = await fetch(`${API_BASE}/ai/incident/workflow-details?inc_id=${selectedIncidentIdFlow}`);
        const data = await res.json();
        setIncidentWorkflowSteps(data.steps || []);
      } catch (e) {
        console.error('Workflow fetch failed:', e);
      }
    };

    fetchWorkflow();
  }, [selectedIncidentIdFlow]);

  // 상단 S-Autopilot Insight 패널은 항상 최신 SMS만 분석하도록 고정
  // 상단 S-Autopilot Insight 패널은 선택된 SMS를 우선 표시하고, 없을 경우 최신 SMS를 분석
  useEffect(() => {
    if (selectedSms) {
      setInsightSms(selectedSms);
    } else if (smsMessages.length > 0) {
      setInsightSms(prev => {
        if (!prev || prev.inc_id !== smsMessages[0].inc_id) {
          return smsMessages[0];
        }
        return prev;
      });
    }
  }, [selectedSms, smsMessages]);

  // Fetch War-Rooms & SMS periodically
  useEffect(() => {
    fetchSMSMessages();
    fetchWarRooms();
    fetchActivityLogs();
    fetchMyAssignments();
    fetchUserActivityHistory();
    const smsInterval = setInterval(fetchSMSMessages, 5000);
    const wrInterval = setInterval(fetchWarRooms, 8000);
    const activityInterval = setInterval(fetchActivityLogs, 10000);
    const assignmentInterval = setInterval(fetchMyAssignments, 10000);
    const historyInterval = setInterval(fetchUserActivityHistory, 15000);
    return () => {
      clearInterval(smsInterval);
      clearInterval(wrInterval);
      clearInterval(activityInterval);
      clearInterval(assignmentInterval);
      clearInterval(historyInterval);
    };
  }, [userProfile, assignmentDateRange]);

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
    if (!userProfile?.id) return;
    try {
      const apiBase = 'https://sguardai.khcho0421.workers.dev';
      const res = await fetch(`${apiBase}/ai/warroom/my-rooms?user_id=${userProfile.id}`);
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
    try {
      const apiBase = 'https://sguardai.khcho0421.workers.dev';
      const res = await fetch(`${apiBase}/activity-logs`);
      if (res.ok) {
        const data = await res.json();
        setActivityLogs(data.logs || []);
      }
    } catch (err) {
      console.error("Failed to fetch activity logs:", err);
    }
  };

  const fetchMyAssignments = async () => {
    if (!userProfile?.id) return;
    try {
      const res = await fetch(`${API_BASE}/ai/incident/my-assignments?user_id=${userProfile.id}&from=${assignmentDateRange.from}&to=${assignmentDateRange.to}`);
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
    if (!userProfile?.id) return;
    try {
      const res = await fetch(`${API_BASE}/ai/user/activity-history?user_id=${userProfile.id}`);
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
    if (!userProfile?.id || !window.confirm('이 워룸에서 나가시겠습니까?')) return;
    try {
      const res = await fetch(`${API_BASE}/ai/warroom/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userProfile.id, inc_id: inc_id })
      });
      if (res.ok) {
        fetchWarRooms();
      }
    } catch (err) {
      console.error("Failed to leave war-room:", err);
    }
  };

  const updateAssignmentStatus = async (inc_id, newStatus) => {
    if (!userProfile?.id) return;
    try {
      const res = await fetch(`${API_BASE}/ai/incident/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userProfile.id,
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

  const fetchSMSMessages = async () => {
    try {
      const response = await fetch(getApiUrl('/sms/recent?limit=20'));
      if (response.ok) {
        const data = await response.json();
        const freshMsgs = (data.messages || []).filter(msg => {
          if (deletedSmsIds.has(msg.inc_id)) return false;
          
          // 🚀 Governance Filter: Only show if assigned to current user
          if (userProfile?.name || userProfile?.employee_id) {
            const isAssigned = (msg.receivers || []).some(r => 
              (userProfile.name && r.includes(userProfile.name)) || 
              (userProfile.employee_id && String(r).includes(String(userProfile.employee_id)))
            );
            return isAssigned;
          }
          return true; // Default to all if profile not loaded yet
        });

        setSmsMessages(freshMsgs);

        // --- 실시간 자동 분석 트리거 (New Arrival Automation) ---
        if (freshMsgs.length > 0) {
          const latestId = String(freshMsgs[0].inc_id);
          if (latestId !== lastAutoTriggeredIdRef.current) {
            lastAutoTriggeredIdRef.current = latestId;
            setLastAutoTriggeredId(latestId);
            setSelectedSms(freshMsgs[0]);

            // ⚡ One-View Automation: Expand all relevant panels on new arrival
            setIsSmsPanelCollapsed(false);       // Top SMS Bar
            setIsLiveStreamCollapsed(false);    // Left Incident Stream
            setIsWarRoomCollapsed(false);       // Middle War-Room Header
            setIsAssignmentsCollapsed(false);    // Right Assignments Panel
            setShowAgentPanel(true);             // Bottom Agent Discussion
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
      const response = await fetch(getApiUrl(`/sms/${id}`), { method: 'DELETE' });
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

  // Real-time metrics simulation
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

  // Re-parse transcript (utility for handleAgentContent)
  const parseTranscript = (transcript) => {
    if (!transcript) return [];
    let text = transcript;
    
    // 1. Divide into 'Insight' and 'Expert Diagnosis' with extremely robust split markers
    // Updated to split at both the expert block and the leader block to be truly robust.
    const splitMarker = /\[전문가별 심층 진단\]|### 전문가별|--- ?\s*#* ?\[전문가별|\[리더의 최종 조치 가이드\]|### 리더의 최종/i;
    const parts_split = text.split(splitMarker);
    
    // Only parse everything AFTER the FIRST diagnostic marker (Expert Diagnosis section)
    if (parts_split.length > 1) {
      // JOIN with double newline to ensure masterRegex (which uses ^|\n) catches all participants correctly!
      text = parts_split.slice(1).join('\n\n');
    } else {
      // If the specific [Expert Diagnosis] marker has not appeared yet, 
      // do not parse anything to avoid leaking the Insight summary into the agent bubbles.
      return [];
    }

    // 2. Define the 4 target Agent roles with rich keyword mapping
    const declarations = [
      { name: 'Security', keywords: ['Security', '보안', 'System', '시스템', '보안분석'] },
      { name: 'DB', keywords: ['DB', '데이터베이스', 'Database', 'DATABASE', '쿼리'] },
      { name: 'DevOps', keywords: ['DevOps', '데브옵스', 'Analyst', '어낼리스트', 'Infra', '인프라', 'App', '애플리케이션', '인프라진단', '앱분석'] },
      { name: 'Leader', keywords: ['Leader', '리더', '최종 조치', '조항 조치', '조치 가이드', '최종판단', '리더의 최종 조치 가이드'] }
    ];

    const keywordToName = {};
    declarations.forEach(d => {
      d.keywords.forEach(k => { 
        keywordToName[k.toLowerCase()] = d.name; 
      });
    });

    const allKeywords = declarations.flatMap(d => d.keywords).join('|');
    // Flexible regex for agent title detection: require start of line or header context
    // Now UPDATED to support Emojis as prefixes (e.g., ⚙️ DevOps, 👑 Leader)
    const emojiRange = '[\\uD800-\\uDBFF][\\uDC00-\\uDFFF]';
    const markerPrefix = `(?:^|\\n)[ \\t]*(?:#+\\s*|--- |\\*\\*?|\\d+\\.\\s*|\\s*[\\-\\u2022\\u2043\\u2219\\u25d8\\*]\\s*|\\[|${emojiRange})*`;
    const markerSuffix = `(?:\\s*Agent|\\s*에이전트|\\s*어낼리스트|\\s*분석전문가|\\s*전문가|\\s*분석관|\\s*진단|\\s*연구원|의 최종 조치 가이드|의| 최종 조치 가이드| 가이드|의 최종 조항 조치|${emojiRange})*\\s*(?:\\]|:|\\*\\*)*[ \\t]*`;
    
    const masterRegex = new RegExp(`${markerPrefix}(${allKeywords})${markerSuffix}`, 'gim');

    console.group('[S-GUARD] Agent Transcript Parsing');
    console.log('Raw Section Length:', text.length);

    let normalizedText = text.replace(masterRegex, (match, keyword) => {
      const canonicalName = keywordToName[keyword.toLowerCase()];
      console.log(`Matched Agent: ${canonicalName} (from word: ${keyword})`);
      return `\n\nMARKER_${canonicalName}\n`;
    });

    const parts = normalizedText.split(/\n\nMARKER_(\w+)\n/g);
    console.log('Split Sections Count:', Math.floor(parts.length / 2));
    console.groupEnd();

    const msgs = [];
    
    for (let i = 1; i < parts.length; i += 2) {
        const role = parts[i];
        let content = (parts[i+1] || '').trim();
        
        if (content) {
            // Aggressive cleaning of markdown artifacts, redundant labels, AND Emojis at start
            content = content
                .replace(/^(?:Agent|에이전트|분석|진단|가이드|전문가|[\uD800-\uDBFF][\uDC00-\uDFFF])\s*[:：]\s*/i, '')
                .replace(/^[ \t\-\*\#\.,\:\u2022\u00b7\uD800-\uDBFF\uDC00-\uDFFF]+/gm, '') 
                .replace(/\*\*/g, '')
                .replace(/\n\n+/g, '\n')
                .trim();
            
            if (content) {
                const lastMsg = msgs[msgs.length - 1];
                if (lastMsg && lastMsg.role === role) {
                    lastMsg.text += "\n" + content;
                } else {
                    msgs.push({ role: role, text: content, delay: 0 });
                }
            }
        }
    }
    return msgs;
  };

  // Callback called from AiInsightPanel
  const handleAgentContent = (fullTranscript, isDone) => {
    // 진행 중인 스트리밍 찌꺼기(랜더링 전 텍스트)를 화면에 보이지 않게 하고, 완료 시에만 파싱 결과를 업데이트
    if (isDone) {
      const currentMsgs = parseTranscript(fullTranscript);
      if (currentMsgs.length > 0) {
        // FILTER: Remove any legacy 'AI분석' role messages that might be in history
        const filteredMsgs = currentMsgs.filter(m => m.role !== 'AI분석');
        const completedMsgs = filteredMsgs.map(m => ({ ...m, isCompleted: true }));
        setAgentMessages(completedMsgs);
      }

      const currentIncId = selectedSmsRef.current?.inc_id;

      if (currentIncId) {
        console.log(`AI Analysis Done for ${currentIncId}. Saving to DB...`);
        // Save to DB
        const baseUrl = 'https://sguardai.khcho0421.workers.dev';
        fetch(`${baseUrl}/ai/chat-history/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            incident_id: String(currentIncId),
            messages: currentMsgs
          })
        })
        .then(res => res.json())
        .then(data => console.log("Save complete:", data))
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
    setShowAgentPanel(true);

    // Trigger Assignment to the current user
    if (userProfile?.id) {
      fetch(`${API_BASE}/ai/incident/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userProfile.id,
          login_id: userProfile.email,
          inc_id: String(smsMessage.inc_id).replace('INC-', ''),
          incident_title: 'SMS 수신 확인'
        })
      })
      .then(() => fetchMyAssignments())
      .catch(err => console.error("Assignment failed:", err));
    }


    try {
      // -------------------------------------------------------------
      // UNIFIED STREAMING: AiInsightPanel에서 통합 수행하므로 중복 호출 제거.
      // Dashboard에서는 히스토리 존재 여부만 체크하고 패널을 열어준다.
      // -------------------------------------------------------------
      const checkRes = await fetch(getApiUrl(`/ai/chat-history/${smsMessage.inc_id}`));
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

        const apiUrl = 'https://sguardai.khcho0421.workers.dev/ai/report/save';

        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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

    const currentProfile = userProfile || { name: 'Guest User', email: 'guest@s-guard.ai', picture: null, dept: '', team: '' };

    return (
      <ProfileModalContent
        profile={currentProfile}
        onClose={() => setShowProfileModal(false)}
        onSave={async (updated) => {
          try {
            const res = await fetch(`${API_BASE}/auth/profile`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                user_id: updated.id,
                name: updated.name,
                phone: updated.phone,
                company: updated.company,
                honbu: updated.honbu,
                team: updated.team,
                part: updated.part,
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

  return (
    <div className="min-h-screen bg-[#0f1421] text-white font-sans overflow-x-hidden relative">
      {/* Top Navigation */}
      <nav className="flex justify-between items-center p-4 bg-[#0f1421] border-b border-white/10 sticky top-0 z-30">
        <div
          className="flex items-center space-x-3 cursor-pointer group"
          onClick={() => window.location.reload()}
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center font-bold text-lg shadow-lg shadow-blue-900/50 group-hover:scale-105 transition-transform">S</div>
          <span className="text-lg font-bold tracking-tight group-hover:text-blue-400 transition-colors">S-Guard <span className="text-blue-500">AI</span></span>
        </div>
        <div className="flex items-center space-x-4">
          {/* Search Button removed per user request */}
          <div className="relative group">
            <Bell
              className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors cursor-pointer"
              onClick={() => setShowNotifications(true)}
            />
            {allNotifications.length > 0 && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            )}
          </div>
          <div
            className="flex items-center space-x-3 cursor-pointer hover:bg-white/5 p-1 px-2 rounded-xl transition-colors group"
            onClick={() => setShowProfileModal(true)}
          >
            {userProfile && (
              <span className="text-xs font-bold text-slate-300 hidden sm:inline-block group-hover:text-blue-400">
                {userProfile.name}
              </span>
            )}
            <div className="w-8 h-8 bg-slate-700/50 rounded-full flex items-center justify-center border border-white/10 overflow-hidden ring-2 ring-blue-500/20 group-hover:ring-blue-500/50 transition-all">
              {userProfile?.picture ? (
                <img src={userProfile.picture} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User className="w-5 h-5 text-slate-300 group-hover:text-blue-400" />
              )}
            </div>
          </div>
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

      <div className="p-6 max-w-7xl mx-auto pb-24">
        {/* Header Section */}
        <div>
        </div>

        <div className="flex flex-col gap-6 mb-6">
          {/* 실시간 SMS 수신 내역 패널 (접기/펼치기 가능) */}
          {smsMessages.length > 0 && (
            <div className="bg-[#1a1f2e] rounded-3xl border border-white/5 shadow-xl w-full pb-10">
              <div
                onClick={toggleSmsPanel}
                className="p-6 flex justify-between items-center cursor-pointer hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-blue-600/20 p-2 rounded-xl">
                    <MessageSquare className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-lg">실시간 SMS 수신 내역</h3>
                    <p className="text-[10px] text-slate-500 font-mono uppercase">REAL-TIME SMS MONITORING</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {selectedSms && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedSms(null); }}
                      className="text-[10px] bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 px-2 py-1 rounded-full hover:bg-yellow-500/20 transition-colors"
                    >
                      분석 취소 ✕
                    </button>
                  )}
                  <div className="flex items-center space-x-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono tracking-wider">LIVE</span>
                  </div>
                  <div className={`transition-transform duration-300 ${isSmsPanelCollapsed ? '' : 'rotate-180'}`}>
                    <ChevronRight className="w-5 h-5 text-slate-400 rotate-90" />
                  </div>
                </div>
              </div>

              <div className={`transition-all duration-500 ease-in-out ${isSmsPanelCollapsed ? 'max-h-0 overflow-hidden' : 'max-h-[380px] border-t border-white/5'}`}>
                <div className="p-6 space-y-4 overflow-y-auto max-h-[380px] scrollbar-thin">
                  {smsMessages.filter(msg => !deletedSmsIds.has(msg.inc_id)).map((msg) => {
                    const isSelected = selectedSms?.inc_id === msg.inc_id;
                    return (
                      <div
                        key={msg.inc_id}
                        onClick={() => {
                          const isSelected = selectedSms?.inc_id === msg.inc_id;
                          setSelectedSms(isSelected ? null : msg);
                          if (!isSelected) {
                            startLiveScenario(msg);
                          } else {
                            setShowAgentPanel(false);
                            setAgentMessages([]);
                          }
                        }}
                        className={`rounded-2xl p-4 border flex items-start justify-between group transition-all cursor-pointer
                          ${isSelected
                            ? 'bg-yellow-500/5 border-yellow-500/40 ring-1 ring-yellow-500/30 shadow-lg shadow-yellow-500/10'
                            : 'bg-[#11141d] border-white/5 hover:border-blue-500/30'}`}
                      >
                        <div className="flex items-start space-x-3 flex-1">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isSelected ? 'bg-yellow-600/20' : 'bg-blue-600/10'}`}>
                            {msg.keyword_detected ? (
                              <AlertCircle className={`w-6 h-6 ${isSelected ? 'text-yellow-300' : 'text-yellow-300'}`} />
                            ) : (
                              <Info className={`w-6 h-6 ${isSelected ? 'text-yellow-400' : 'text-blue-400'}`} />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center space-x-2">
                                <h4 className={`font-bold text-sm ${isSelected ? 'text-yellow-300' : 'text-white'}`}>SMS 수신</h4>
                                {msg.keyword_detected && (
                                  <span className="bg-yellow-400/20 text-yellow-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-yellow-400/30">
                                    키워드 감지
                                  </span>
                                )}
                                {isSelected && (
                                  <span className="bg-yellow-500/20 text-yellow-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-yellow-500/30 animate-pulse">
                                    ⚡ 분석 중
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 ml-auto">
                                <span className="text-[10px] text-white font-black font-mono bg-white/10 px-2 py-0.5 rounded whitespace-nowrap shadow-[0_0_10px_rgba(255,255,255,0.1)]">
                                  {formatYYMMDD(msg.timestamp)}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-xs text-slate-400">발신: {msg.sender}</p>
                              {msg.employee_id && (
                                <span className="text-[10px] text-blue-400 font-mono bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                                  사번: {msg.employee_id}
                                </span>
                              )}
                            </div>
                             <div className="flex items-center justify-between gap-4">
                               <p className={`text-sm leading-snug flex-1 ${isSelected ? 'text-yellow-100' : 'text-slate-200'}`}>{msg.message}</p>
                               {msg.received_count >= 2 && (
                                 <span className="text-[11px] font-black text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20 whitespace-nowrap shadow-[0_0_15px_rgba(37,99,235,0.2)]">
                                   수신건수 : {msg.received_count} 건
                                 </span>
                               )}
                               <button
                                 onClick={(e) => { e.stopPropagation(); navigate(`/workflow/${msg.inc_id}`); }}
                                 className="text-[10px] font-black text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 px-2 py-1 rounded transition-all flex items-center gap-1 border border-white/5 shadow-sm"
                               >
                                 상세 흐름 보기 <ExternalLink className="w-2.5 h-2.5" />
                               </button>
                             </div>
                          </div>
                          <button
                            onClick={(e) => deleteSMSMessage(e, msg.inc_id)}
                            className="ml-2 p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-red-400 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                            title="삭제"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* AI Autopilot Insight Panel (항상 최신 SMS만 분석하도록 insightSms 적용) */}
          <div className="w-full">
            <AiInsightPanel 
               onLogReceived={handleLogReceived} 
               onShowDetail={handleShowInsight} 
               selectedSms={insightSms} 
               onOpenWarRoom={handleOpenWarRoomFromInsight} 
               onAgentContent={handleAgentContent}
               warRooms={warRooms}
            />
          </div>

        </div>






        {/* Main Content Areas */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Alerts List (Section 1) */}
          <div id="live-incident-stream" className="lg:col-span-1 bg-[#1a1f2e] p-6 rounded-3xl border border-white/5 flex flex-col max-h-[420px] h-fit shadow-xl transition-all duration-300">
            <div className="flex justify-between items-center mb-4 shrink-0">
              <h3 className="font-bold flex items-center">
                <Activity className="w-4 h-4 mr-2 text-blue-400" />
                Live Incident Stream
              </h3>
              <button 
                onClick={toggleLiveStreamPanel}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/5"
              >
                <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isLiveStreamCollapsed ? 'rotate-180' : ''}`} />
              </button>
            </div>
            {!isLiveStreamCollapsed && (
            <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-700/50 space-y-4">
              {smsMessages.slice(0, 10).map((msg) => {
                let severity = 'info';
                let title = 'System Report';
                const lowerText = (msg.message || '').toLowerCase();

                if (lowerText.includes('critical') || lowerText.includes('db') || lowerText.includes('데이터베이스')) {
                  severity = 'critical';
                  title = 'Critical Process Error';
                } else if (lowerText.includes('err') || lowerText.includes('cpu') || lowerText.includes('메모리')) {
                  severity = 'warning';
                  title = 'System Overload Warning';
                }

                // 방금 들어온(최근 15분) 항목인지 체크 (UI 하이라이트용)
                const isRecent = (new Date() - new Date(msg.timestamp)) < 15 * 60 * 1000;

                return (
                  <div
                    key={msg.inc_id}
                    onClick={(e) => { 
                      e.preventDefault();
                      e.stopPropagation();
                      const isSame = selectedSms?.inc_id === msg.inc_id;
                      setSelectedSms(isSame ? null : msg); 
                      // 좌측 인시던트 스트림 클릭 시에만 에이전트 토론 시작
                      if (!isSame) {
                        startLiveScenario(msg);
                      } else {
                        setShowAgentPanel(false);
                        setAgentMessages([]);
                      }
                    }}
                    className="cursor-pointer transition-transform hover:scale-[1.01] active:scale-[0.99] relative"
                  >

                    {/* 반짝이는 표시기 */}
                    {isRecent && <div className={`absolute top-2 right-2 w-2 h-2 rounded-full animate-ping z-10 ${selectedSms?.inc_id === msg.inc_id ? 'bg-yellow-400' : 'bg-blue-500'}`} />}

                    <AlertItem
                      title={title}
                      time={formatYYMMDD(msg.timestamp)}
                      severity={severity}
                      desc={msg.message}
                      isSelected={selectedSms?.inc_id === msg.inc_id}
                    />
                  </div>
                );
              })}
                {smsMessages.length === 0 && (
                  <div className="text-center text-slate-500 text-sm py-4">Waiting...</div>
                )}
              </div>
            )}
          </div>

          {/* AI War-Room Situation Log (Section 2) */}
          <div className="lg:col-span-2 h-[650px]">
            <div className="bg-[#0a0c12] rounded-3xl border border-white/5 h-full overflow-hidden flex flex-col shadow-2xl">
              {/* Header (Matching Screenshot) */}
              <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </div>
                  <h3 className="font-bold text-white text-[15px] tracking-tight">AI War-Room Situation Log</h3>
                </div>
                <div className="flex items-center gap-3">
                   <button 
                     onClick={toggleWarRoomPanel}
                     className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/5"
                   >
                     <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isWarRoomCollapsed ? 'rotate-180' : ''}`} />
                   </button>
                </div>
              </div>

              {!isWarRoomCollapsed && (
                <div className="flex-1 overflow-hidden">
                  {showAgentPanel || selectedSms ? (
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
                    <div className="flex flex-col items-center justify-center h-full text-slate-600 opacity-30 gap-3">
                      <Brain className="w-10 h-10" />
                      <p className="text-xs font-bold uppercase tracking-wider">Select an incident to analyze</p>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>


        {/* Section 3: My Confirmation History & Recent List */}
        <div className="bg-[#1a1f2e] rounded-3xl p-6 border border-white/5 shadow-xl mt-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <div className="flex items-center space-x-2">
              <User className="w-5 h-5 text-blue-500" />
              <h2 className="font-bold text-lg">나의 할당 및 처리 현황</h2>
            </div>
            <div className="flex items-center gap-3 bg-slate-900/50 p-2 rounded-2xl border border-white/5">
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <input 
                  type="date" 
                  value={assignmentDateRange.from}
                  onChange={(e) => setAssignmentDateRange(prev => ({ ...prev, from: e.target.value }))}
                  className="bg-transparent border-none text-[10px] text-slate-300 outline-none"
                />
                <span className="text-slate-600">~</span>
                <input 
                  type="date" 
                  value={assignmentDateRange.to}
                  onChange={(e) => setAssignmentDateRange(prev => ({ ...prev, to: e.target.value }))}
                  className="bg-transparent border-none text-[10px] text-slate-300 outline-none"
                />
              </div>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-6 mb-8">
            {/* Total */}
            <div className="bg-[#11141d] p-6 rounded-3xl border border-white/5 relative overflow-hidden group cursor-pointer hover:border-white/20 transition-all" onClick={() => navigate('/assignments?tab=전체')}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-slate-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
              <p className="text-[10px] text-slate-500 mb-1 font-black uppercase tracking-widest">Total Incidents</p>
              <div className="flex items-baseline gap-2 mb-4">
                <span className={`text-4xl font-black text-white ${totalAssignedCount > 0 ? 'underline underline-offset-8' : ''}`}>{totalAssignedCount}</span>
                <span className="text-xs text-slate-600 font-bold">건</span>
              </div>
              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-slate-400 w-full transition-all duration-1000" />
              </div>
            </div>

            {/* Unconfirmed (Red Gauge) - Pulse only if count > 0 */}
            <div className={`bg-[#11141d] p-6 rounded-3xl border relative overflow-hidden group cursor-pointer hover:border-red-500/30 transition-all ${myAssignments.filter(a => a.status === '미확인').length > 0 ? 'border-red-500/20' : 'border-white/5'}`} onClick={() => navigate('/assignments?tab=상태: 미확인')}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="flex justify-between items-start mb-1">
                <p className="text-[10px] text-red-500/60 font-black uppercase tracking-widest">Unconfirmed</p>
                {myAssignments.filter(a => a.status === '미확인').length > 0 && (
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]"></span>
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-2 mb-4">
                <span className={`text-4xl font-black text-red-500 ${myAssignments.filter(a => a.status === '미확인').length > 0 ? 'underline underline-offset-8' : ''}`}>{myAssignments.filter(a => a.status === '미확인').length}</span>
                <span className="text-xs text-red-900 font-bold">건</span>
              </div>
              <div className="h-1.5 w-full bg-red-950/30 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-red-600 transition-all duration-1000" 
                  style={{ width: `${(myAssignments.filter(a => a.status === '미확인').length / (totalAssignedCount || 1)) * 100}%` }} 
                />
              </div>
            </div>

            {/* Processing (Orange Gauge) - Pulse if count > 0 */}
            <div className={`bg-[#11141d] p-6 rounded-3xl border relative overflow-hidden group cursor-pointer hover:border-orange-500/30 transition-all ${myAssignments.filter(a => a.status === '처리중').length > 0 ? 'border-orange-500/20' : 'border-white/5'}`} onClick={() => navigate('/assignments?tab=처리중')}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="flex justify-between items-start mb-1">
                <p className="text-[10px] text-orange-500/60 font-black uppercase tracking-widest">In Progress</p>
                {myAssignments.filter(a => a.status === '처리중').length > 0 && (
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]"></span>
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-2 mb-4">
                <span className={`text-4xl font-black text-orange-500 ${myAssignments.filter(a => a.status === '처리중').length > 0 ? 'underline underline-offset-8' : ''}`}>{myAssignments.filter(a => a.status === '처리중').length}</span>
                <span className="text-xs text-orange-900 font-bold">건</span>
              </div>
              <div className="h-1.5 w-full bg-orange-950/30 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-orange-600 transition-all duration-1000" 
                  style={{ width: `${(myAssignments.filter(a => a.status === '처리중').length / (totalAssignedCount || 1)) * 100}%` }} 
                />
              </div>
            </div>

            {/* Completed (Blue Gauge) */}
            <div className="bg-[#11141d] p-6 rounded-3xl border border-white/5 relative overflow-hidden group cursor-pointer hover:border-blue-500/20 transition-all" onClick={() => navigate('/assignments?tab=처리완료')}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
              <p className="text-[10px] text-blue-500/60 mb-1 font-black uppercase tracking-widest">Completed</p>
              <div className="flex items-baseline gap-2 mb-4">
                <span className={`text-4xl font-black text-blue-500 ${myAssignments.filter(a => a.status === '처리완료').length > 0 ? 'underline underline-offset-8' : ''}`}>{myAssignments.filter(a => a.status === '처리완료').length}</span>
                <span className="text-xs text-blue-900 font-bold">건</span>
              </div>
              <div className="h-1.5 w-full bg-blue-950/30 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-600 transition-all duration-1000" 
                  style={{ width: `${(myAssignments.filter(a => a.status === '처리완료').length / (totalAssignedCount || 1)) * 100}%` }} 
                />
              </div>
            </div>
          </div>

          {/* Recent List Header */}
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-white">최근 할당 리스트 ({myAssignments.length})</h3>
            <button
              onClick={() => navigate('/assignments')}
              className="text-[11px] text-blue-500 font-medium hover:text-blue-400 flex items-center"
            >
              전체보기 <ChevronRight className="w-3 h-3 ml-0.5" />
            </button>
          </div>

          {/* List Items - Dynamic */}
          <div className="space-y-3">
            {myAssignments.length > 0 ? (
              myAssignments.slice(0, 5).map((item) => (
                <div
                  key={item.inc_id}
                  className={`p-4 rounded-2xl border relative group hover:border-white/10 transition-colors cursor-pointer
                    ${item.status === '미확인' ? 'bg-red-500/5 border-red-500/10' : 
                      item.status === '처리중' ? 'bg-orange-500/5 border-orange-500/10' : 
                      'bg-emerald-500/5 border-emerald-500/10'}`}
                  onClick={() => {
                    const msg = smsMessages.find(m => m.inc_id === item.inc_id) || { inc_id: item.inc_id, message: item.message, sender: item.sender };
                    setSelectedSms(msg);
                    setSelectedIncidentIdFlow(item.inc_id);
                    startLiveScenario(msg);
                  }}
                >
                  <div className="flex items-start space-x-3">
                    <div className={`${
                      item.status === '미확인' ? 'bg-red-500/10' : 
                      item.status === '처리중' ? 'bg-orange-500/10' : 
                      'bg-emerald-500/10'
                    } p-2 rounded-full mt-0.5`}>
                      <AlertCircle className={`w-5 h-5 ${
                        item.status === '미확인' ? 'text-red-500' : 
                        item.status === '처리중' ? 'text-orange-500' : 
                        'text-emerald-500'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex items-center gap-2 max-w-[70%]">
                          <span className={`text-[8px] font-black px-1 py-0.5 rounded border flex-shrink-0 bg-blue-500/20 text-blue-400 border-blue-500/30`}>
                            SMS
                          </span>
                          <h4 className="text-sm font-bold text-white truncate">{item.message || '상공 발생'}</h4>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`text-[10px] font-bold px-3 py-1 rounded-full border shadow-sm transition-all duration-300 flex items-center gap-1.5
                            ${item.status === '미확인' ? 'bg-red-500/20 text-red-400 border-red-500/30' : 
                              item.status === '처리중' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 
                              'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'}`}
                            style={{
                              animation: item.status === '미확인' ? 'sguard-blink-fast 0.5s infinite' : 
                                         item.status === '처리중' ? 'sguard-blink-slow 2.0s infinite' : 'none'
                            }}>
                            <style>{`
                              @keyframes sguard-blink-fast {
                                0%, 100% { opacity: 1; transform: scale(1); }
                                50% { opacity: 0.3; transform: scale(0.98); }
                              }
                              @keyframes sguard-blink-slow {
                                0%, 100% { opacity: 1; filter: brightness(1.2); }
                                50% { opacity: 0.5; filter: brightness(0.8); }
                              }
                              @keyframes sguard-twinkle {
                                0%, 100% { text-shadow: 0 0 5px rgba(59, 130, 246, 0.5); opacity: 1; }
                                50% { text-shadow: 0 0 15px rgba(59, 130, 246, 0.8), 0 0 20px rgba(59, 130, 246, 0.4); opacity: 0.7; color: #60a5fa; }
                              }
                            `}</style>
                            <div className={`w-1 h-1 rounded-full ${
                              item.status === '미확인' ? 'bg-red-400' : 
                              item.status === '처리중' ? 'bg-orange-400' : 
                              'bg-emerald-400'
                            }`} />
                            {item.status}
                          </div>
                          <span className="text-[10px] text-white font-black font-mono bg-white/10 px-2 py-0.5 rounded whitespace-nowrap shadow-[0_0_10px_rgba(255,255,255,0.1)]">
                            {formatYYMMDD(item.assigned_at)}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-300 leading-snug mb-2 flex items-center gap-3">
                        <span>발신: {item.sender}</span>
                        {item.employee_id && (
                          <span className="text-[10px] text-blue-400 font-mono bg-blue-500/10 px-2 py-0.5 rounded">
                            사번: {item.employee_id}
                          </span>
                        )}
                        {item.received_count > 1 && (
                          <span className="text-blue-400/80 font-bold">({item.received_count}건 중복)</span>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/workflow/${item.id}`); }}
                      className="ml-4 p-2.5 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20 text-blue-400 hover:text-blue-300 transition-all group/flow"
                      title="처리 흐름 상세 보기"
                    >
                      <Activity className="w-4 h-4 group-hover/flow:scale-110 transition-transform" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-[#11141d] p-8 rounded-2xl border border-white/5 text-center">
                <Info className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-slate-400">최근 할당 내역이 없습니다</p>
                <p className="text-xs text-slate-500 mt-1">SMS 메시지를 분석하면 자동으로 할당됩니다</p>
              </div>
            )}
          </div>
        </div>


        {/* Activity History Flow Area */}
        <div className="bg-[#1a1f2e] rounded-3xl p-6 border border-white/5 shadow-xl mt-6">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-purple-400" />
              <h2 className="font-bold text-lg">
                {selectedIncidentIdFlow ? (
                  <>
                    인시던트 처리 흐름 [
                    <span className="text-blue-400">
                      {(myAssignments.find(a => String(a.inc_id).replace('INC-', '') === String(selectedIncidentIdFlow).replace('INC-', ''))?.message || 
                        smsMessages.find(m => String(m.inc_id).replace('INC-', '') === String(selectedIncidentIdFlow).replace('INC-', ''))?.message || 
                        selectedIncidentIdFlow).substring(0, 50)}
                      {(myAssignments.find(a => String(a.inc_id).replace('INC-', '') === String(selectedIncidentIdFlow).replace('INC-', ''))?.message || 
                        smsMessages.find(m => String(m.inc_id).replace('INC-', '') === String(selectedIncidentIdFlow).replace('INC-', ''))?.message || 
                        "").length > 50 ? '...' : ''}
                    </span>
                    ]
                  </>
                ) : '활동 내역 (업무 흐름)'}
              </h2>
            </div>
            <div className="flex items-center gap-6">
              {selectedIncidentIdFlow && (
                <div className="flex items-center gap-6">
                   {(() => {
                     const assignment = myAssignments.find(a => String(a.inc_id).replace('INC-', '') === String(selectedIncidentIdFlow).replace('INC-', '')) || 
                                        smsMessages.find(a => String(a.inc_id).replace('INC-', '') === String(selectedIncidentIdFlow).replace('INC-', ''));
                     const startStep = incidentWorkflowSteps.find(s => s.id === 'SMS');
                     const endStep = incidentWorkflowSteps.find(s => s.id === 'CLOSE');
                     const startTime = startStep ? new Date(startStep.timestamp) : (assignment ? new Date(assignment.timestamp || assignment.assigned_at) : null);
                     const endTime = endStep ? new Date(endStep.timestamp) : null;
                     
                     if (startTime) {
                       const durationMs = (endTime || currentTime) - startTime;
                       const isClosed = !!endTime;

                       return (
                         <>
                           <div className="flex flex-col items-end">
                             <span className="text-[9px] uppercase tracking-widest opacity-60 font-black text-blue-400">INITIAL DETECTION</span>
                             <span className="text-sm font-black font-mono text-white bg-slate-800 px-3 py-1 rounded-lg border border-white/5 shadow-xl">
                               {formatYYMMDD(startTime)}
                             </span>
                           </div>
                           <div className={`flex flex-col items-end ${isClosed ? 'text-emerald-400' : 'text-blue-400'}`}>
                             <span className="text-[9px] uppercase tracking-widest opacity-60 font-black">TOTAL ELAPSED (MTTR)</span>
                             <div className="flex items-center gap-2">
                               <div className={`w-2 h-2 rounded-full ${isClosed ? 'bg-emerald-500' : 'bg-blue-500 animate-pulse outline outline-4 outline-blue-500/20'}`} />
                               <span className="text-2xl font-black font-mono tracking-tighter tabular-nums">
                                 {formatDuration(durationMs)}
                               </span>
                             </div>
                           </div>
                         </>
                       );
                     }
                     return null;
                   })()}
                  <button 
                    onClick={() => setSelectedIncidentIdFlow(null)}
                    className="text-[10px] bg-slate-800 border border-white/10 px-4 py-2.5 rounded-xl text-slate-400 hover:text-white transition-all hover:bg-slate-700 font-bold uppercase tracking-tight"
                  >
                    목록으로 돌아가기
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="relative">
            {/* Vertical Line */}
            <div className="absolute left-[11px] top-4 bottom-4 w-[2px] bg-gradient-to-b from-blue-600/50 via-purple-500/50 to-transparent" />

            <div className="space-y-8">
              {selectedIncidentIdFlow ? (
                // Workflow Flow View
                <div className="flex flex-col space-y-0 py-6 relative">
                  {(() => {
                    const firstPendingIdx = FLOW_STEPS.findIndex(step => {
                      if (step.id === 'RAG_AGENT') {
                        return !incidentWorkflowSteps.find(s => s.id === 'RAG') && !incidentWorkflowSteps.find(s => s.id === 'AGENT');
                      }
                      return !incidentWorkflowSteps.find(s => s.id === step.id);
                    });
                    
                    return FLOW_STEPS.map((step, sIdx) => {
                      let stepData = incidentWorkflowSteps.find(s => s.id === step.id);
                      
                      // Combined RAG/AGENT logic
                      if (step.id === 'RAG_AGENT') {
                         const rag = incidentWorkflowSteps.find(s => s.id === 'RAG');
                         const agent = incidentWorkflowSteps.find(s => s.id === 'AGENT');
                         if (rag && agent) {
                           stepData = { 
                             ...agent, 
                             id: 'RAG_AGENT',
                             timestamp: agent.timestamp > rag.timestamp ? agent.timestamp : rag.timestamp, 
                             detail: 'AI 에이전트 그룹이 수천 건의 과거 데이터와 내부 지식베이스를 결합하여 인시던트 근본 원인을 입체적으로 분석하고 대응 시나리오를 수립했습니다.' 
                           };
                         } else if (rag || agent) {
                           stepData = { ...(rag || agent), id: 'RAG_AGENT' };
                         }
                      }
                      
                      const isCompleted = !!stepData;
                      const isNextStep = sIdx === firstPendingIdx;
                      
                      // Fix detail for WARROOM if it's 2.0 (replace with user name)
                      if (step.id === 'WARROOM' && stepData?.detail?.includes('2.0님')) {
                        stepData.detail = stepData.detail.replace('2.0님', '조경훈님');
                      }
                      
                      // Calculate interval duration to the NEXT step (the line below this step)
                      let intervalText = null;
                      if (isCompleted && sIdx < FLOW_STEPS.length - 1) {
                        const nextStepData = incidentWorkflowSteps.find(s => s.id === FLOW_STEPS[sIdx+1].id);
                        if (nextStepData) {
                          const diff = new Date(nextStepData.timestamp) - new Date(stepData.timestamp);
                          const m = Math.floor(diff / 60000);
                          const s = Math.floor((diff % 60000) / 1000);
                          intervalText = `⏱ ${m > 0 ? `${m}분 ` : ''}${s}초 소요`;
                        } else if (sIdx === firstPendingIdx - 1) {
                          // Next step is in progress, show elapsed since this step
                          const diff = currentTime - new Date(stepData.timestamp);
                          const m = Math.floor(diff / 60000);
                          const s = Math.floor((diff % 60000) / 1000);
                          intervalText = `⏱ ${m > 0 ? `${m}분 ` : ''}${s}초 소요`;
                        }
                      }

                      return (
                        <div key={step.id} className="relative pl-14 pb-12 group">
                          {/* Connecting Line */}
                          {sIdx < FLOW_STEPS.length - 1 && (
                            <div className={`absolute left-[11px] top-7 bottom-[-24px] w-[2px] transition-colors duration-500
                              ${isCompleted ? 'bg-blue-600' : 'bg-white/5'}`}>
                              {intervalText && (
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 whitespace-nowrap">
                                  <span className="text-[9px] font-bold text-slate-500 bg-slate-800/50 px-2 py-0.5 rounded-full border border-white/5">
                                    {intervalText}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Node Circle */}
                          <div className={`absolute left-0 top-0 w-6 h-6 rounded-full border-2 border-[#1a1f2e] z-10 flex items-center justify-center transition-all duration-700
                            ${isCompleted ? 'bg-blue-600 border-blue-400 shadow-[0_0_20px_rgba(37,99,235,0.5)]' : 
                              (isNextStep ? 'bg-blue-500/20 border-blue-400 shadow-[0_0_15px_rgba(37,99,235,0.2)]' : 'bg-gray-800 border-white/5')}`}>
                            
                            {isCompleted ? (
                               <CheckCircle2 className="w-3.5 h-3.5 text-white animate-in zoom-in duration-300" />
                            ) : (
                               isNextStep ? (
                                 <div className="relative flex h-3 w-3">
                                   <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                   <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                                 </div>
                               ) : (
                                 <div className="w-1.5 h-1.5 rounded-full bg-gray-600" />
                               )
                            )}
                          </div>

                          <div className={`transition-all duration-700 ${isCompleted ? 'opacity-100' : (isNextStep ? 'opacity-100 translate-x-1' : 'opacity-30')}`}>
                            <div className="flex items-center gap-3 mb-1.5">
                              <h4 className={`font-black tracking-tight text-base ${isCompleted ? 'text-white' : (isNextStep ? 'text-blue-400' : 'text-gray-500')}`}>
                                {step.label}
                                {isNextStep && (
                                  <div className="flex items-center gap-3 ml-3">
                                    <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-blue-500 text-white shadow-[0_0_10px_rgba(37,99,235,0.4)]">
                                      In Progress
                                    </span>
                                    {(() => {
                                      const prevStepData = sIdx > 0 ? incidentWorkflowSteps.find(s => s.id === FLOW_STEPS[sIdx-1].id) : null;
                                      if (prevStepData) {
                                        const diff = currentTime - new Date(prevStepData.timestamp);
                                        const m = Math.floor(diff / 60000);
                                        const s = Math.floor((diff % 60000) / 1000);
                                        return (
                                          <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 px-3 py-0.5 rounded-xl shadow-[0_0_15px_rgba(37,99,235,0.1)]">
                                            <span className="text-[8px] font-black text-blue-400/60 uppercase tracking-tighter">Current Stage Elapsed</span>
                                            <span className="text-xs font-black font-mono text-blue-400 tabular-nums">
                                              {String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
                                            </span>
                                          </div>
                                        );
                                      }
                                      return null;
                                    })()}
                                  </div>
                                )}
                              </h4>
                              {isCompleted && (
                                <span className="text-[10px] text-white font-black font-mono bg-white/10 px-2 py-0.5 rounded whitespace-nowrap shadow-[0_0_10px_rgba(255,255,255,0.1)]">
                                  {formatYYMMDD(stepData.timestamp)}
                                </span>
                              )}
                            </div>
                            <p className={`text-xs max-w-xl leading-relaxed ${isCompleted ? 'text-slate-400' : (isNextStep ? 'text-slate-300 font-medium' : 'text-slate-600')}`}>
                              {isCompleted ? stepData.detail : (isNextStep ? '실시간 데이터 분석 및 대응 절차를 진행 중입니다...' : '업무 단계 대기 중')}
                            </p>
                            
                            {(isCompleted || isNextStep) && step.id === 'WARROOM' && (
                               <button
                                 onClick={() => navigate(`/chat/${selectedIncidentIdFlow}`)}
                                 className="mt-4 flex items-center gap-2 group/btn text-[11px] font-black text-white border border-blue-500/30 hover:border-blue-400 px-6 py-3 rounded-2xl bg-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] transition-all transform hover:scale-[1.02]"
                               >
                                 <Zap className="w-4 h-4 fill-white animate-pulse" />
                                 워룸으로 즉시 이동하여 대응하기 <ChevronRight className="w-3 h-3 group-hover/btn:translate-x-1 transition-transform" />
                               </button>
                            )}
                          </div>
                        </div>
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

        {/* Handling Progress Area */}
      </div>

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
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${room.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-500 border-red-500/30' : 'bg-orange-500/20 text-orange-500 border-orange-500/30'
                        }`}>
                        {room.severity}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">ROOM #{room.id}</span>
                    </div>
                    <span className="text-[10px] text-white font-black font-mono bg-white/10 px-2 py-0.5 rounded whitespace-nowrap shadow-[0_0_10px_rgba(255,255,255,0.1)]">{room.time}</span>
                  </div>

                  <h4 className="font-bold text-slate-200 mb-2 group-hover:text-blue-400 transition-colors leading-relaxed line-clamp-2">
                    {room.title}
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
        onWarRoomClick={() => {
          fetchWarRooms();
          setShowWarRoomPopup(true);
        }} 
      />
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
    <div className={`flex items-start space-x-4 p-4 rounded-xl transition-all group cursor-pointer ${
      isSelected 
        ? "bg-yellow-500/10 border border-yellow-500/30 shadow-lg shadow-yellow-500/5" 
        : "bg-slate-900/30 border border-white/5 hover:bg-slate-800/50"
    }`}>
      <div className={`w-1.5 h-1.5 mt-2 rounded-full ${sevColor[severity]} ${isSelected ? 'animate-pulse' : ''} shadow-[0_0_8px_rgba(var(--color-primary),0.6)]`}></div>
      <div className="flex-1">
        <div className="flex justify-between items-start mb-1">
          <h4 className={`font-bold text-sm transition-colors ${isSelected ? 'text-yellow-400' : 'text-slate-200 group-hover:text-white'}`}>{title}</h4>
          <span className="text-[11px] font-black text-white whitespace-nowrap ml-2 bg-white/10 px-2.5 py-1 rounded border border-white/20 shadow-md">
            {time}
          </span>
        </div>
        <p className={`text-xs leading-relaxed ${isSelected ? 'text-yellow-100/80' : 'text-slate-400'}`}>{desc}</p>
      </div>
    </div>
  );
}

function ProfileModalContent({ profile, onClose, onSave, navigate }) {
  // ── 조직도 동적 상태 ──
  const [honbuList, setHonbuList] = useState([]);
  const [orgMapping, setOrgMapping] = useState({});
  const [teamMapping, setTeamMapping] = useState({});
  const [partMapping, setPartMapping] = useState({});

  useEffect(() => {
    fetch(`${API_BASE}/org/tree`)
      .then(r => r.json())
      .then(tree => {
        const hList = [];
        const oMap = {};
        const tMap = {};
        const pMap = {};
        tree.forEach(d1 => {
          hList.push(d1.name);
          if (d1.children && d1.children.length > 0) {
            oMap[d1.name] = d1.children.map(d2 => d2.name);
            d1.children.forEach(d2 => {
              if (d2.children && d2.children.length > 0) {
                tMap[d2.name] = d2.children.map(d3 => d3.name);
                d2.children.forEach(d3 => {
                  if (d3.children && d3.children.length > 0) {
                    pMap[d3.name] = d3.children.map(d4 => d4.name);
                  }
                });
              }
            });
          }
        });
        setHonbuList(hList);
        setOrgMapping(oMap);
        setTeamMapping(tMap);
        setPartMapping(pMap);
      })
      .catch(err => console.error('Org tree fetch failed:', err));
  }, []);

  const [formData, setFormData] = useState({
    id: profile.inc_id,
    name: profile.name || '',
    phone: profile.phone || '',
    company: profile.company || '',
    honbu: profile.honbu || '',
    team: profile.team || '',
    part: profile.part || '',
    subpart: profile.subpart || '',
  });

  // ── 비밀번호 변경 상태 ──
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handleChange = (field) => (val) =>
    setFormData(prev => ({ ...prev, [field]: typeof val === 'string' ? val : val.target.value }));

  const handleSave = () => {
    if (!formData.name.trim()) { alert('이름을 입력해 주세요.'); return; }
    if (!formData.company) { alert('회사소속을 선택해 주세요.'); return; }
    if (!formData.honbu) { alert('부문을 선택해 주세요.'); return; }

    // Conditional validation using LIVE org mapping
    const teamOptions = orgMapping[formData.honbu] || [];
    if (teamOptions.length > 0 && !formData.team) { alert('본부를 선택해 주세요.'); return; }

    const partOptions = teamMapping[formData.team] || [];
    if (partOptions.length > 0 && !formData.part) { alert('팀을 선택해 주세요.'); return; }

    const subpartOptions = partMapping[formData.part] || [];
    if (subpartOptions.length > 0 && !formData.subpart) { alert('파트를 선택해 주세요.'); return; }

    onSave(formData);
  };

  const handlePasswordChange = async () => {
    if (!newPassword) { alert('새 비밀번호를 입력해 주세요.'); return; }
    if (newPassword !== confirmPassword) { alert('비밀번호가 일치하지 않습니다.'); return; }
    if (newPassword.length < 4) { alert('비밀번호는 4자 이상이어야 합니다.'); return; }

    setIsChangingPassword(true);
    try {
      const res = await fetch(`${API_BASE}/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: profile.inc_id, new_password: newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        alert('비밀번호가 성공적으로 변경되었습니다.');
        setShowPasswordChange(false);
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

  const handleLogout = () => {
    if (window.confirm('로그아웃 하시겠습니까?')) {
      localStorage.removeItem('sguard_user');
      navigate('/');
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

          <div className="flex items-center space-x-4 mb-8 bg-slate-900/40 p-4 rounded-2xl border border-white/5">
            <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-blue-500/20 overflow-hidden shadow-lg shrink-0">
              <div className="w-full h-full flex items-center justify-center">
                <User className="w-8 h-8 text-slate-500" />
              </div>
            </div>
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
                <input required type="text" value={formData.name} onChange={handleChange('name')} placeholder="홍길동" className="w-full bg-[#1a1f2e] border border-blue-500/20 rounded-xl py-3.5 pl-11 pr-4 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-white" />
              </div>
            </div>

            {/* 핸드폰 */}
            <div>
              <label className="text-xs font-semibold text-slate-400 ml-1 mb-1.5 block">핸드폰 번호</label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input type="tel" value={formData.phone} onChange={handleChange('phone')} placeholder="010-0000-0000" className="w-full bg-[#1a1f2e] border border-blue-500/20 rounded-xl py-3.5 pl-11 pr-4 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-white" />
              </div>
            </div>

            {/* 회사소속 */}
            <div>
              <label className="text-xs font-semibold text-slate-400 ml-1 mb-1.5 block">회사소속 *</label>
              <div className="relative">
                <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <select
                  required
                  value={formData.company}
                  onChange={handleChange('company')}
                  className="w-full bg-[#1a1f2e] border border-blue-500/20 rounded-xl py-3.5 pl-11 pr-10 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-white appearance-none"
                >
                  <option value="" disabled>회사를 선택하세요</option>
                  {SHINHAN_COMPANIES.map(c => (
                    <option key={c} value={c} className="bg-[#1a1f2e] text-white">{c}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <SelectWithOther
                label="부문"
                icon={Building2}
                options={honbuList}
                value={formData.honbu}
                onChange={(val) => {
                  handleChange('honbu')(val);
                  handleChange('team')('');
                  handleChange('part')('');
                  handleChange('subpart')('');
                }}
                required
              />
              <SelectWithOther
                label="본부"
                icon={Building2}
                options={orgMapping[formData.honbu] || []}
                value={formData.team}
                onChange={(val) => {
                  handleChange('team')(val);
                  handleChange('part')('');
                  handleChange('subpart')('');
                }}
                required={(orgMapping[formData.honbu] || []).length > 0}
                disabled={!(orgMapping[formData.honbu] || []).length > 0}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3">
              <SelectWithOther
                label="팀"
                icon={Building2}
                options={teamMapping[formData.team] || []}
                value={formData.part}
                onChange={(val) => {
                  handleChange('part')(val);
                  handleChange('subpart')('');
                }}
                required={(teamMapping[formData.team] || []).length > 0}
                disabled={!(teamMapping[formData.team] || []).length > 0}
              />
              <SelectWithOther
                label="파트"
                icon={Building2}
                options={partMapping[formData.part] || []}
                value={formData.subpart}
                onChange={handleChange('subpart')}
                required={(partMapping[formData.part] || []).length > 0}
                disabled={!(partMapping[formData.part] || []).length > 0}
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
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input 
                      type={showPw ? 'text' : 'password'} 
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="새 비밀번호 입력" 
                      className="w-full bg-[#1a1f2e] border border-blue-500/20 rounded-xl py-3 pl-11 pr-11 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                    />
                    <button
                      onClick={() => setShowPw(!showPw)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                    >
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="relative">
                    <CheckCircle2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input 
                      type={showPw ? 'text' : 'password'} 
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="새 비밀번호 확인" 
                      className="w-full bg-[#1a1f2e] border border-blue-500/20 rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                    />
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
