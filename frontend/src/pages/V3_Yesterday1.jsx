import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Server, AlertTriangle, CheckCircle, Clock, Search, Bell, Menu, User, ChevronRight, Zap, Shield, Database, Sparkles, MessageSquare, Brain, MoreHorizontal, RefreshCw, Info, X, BarChart2, Hash, Users, LogIn, AlertCircle, Home, Phone, Building2, IdCard, ChevronDown, BarChart3, FileText, Settings, LogOut, ExternalLink, CheckCircle2, Filter, Lock, Eye, EyeOff } from 'lucide-react';
import AgentDiscussionPanel from '../components/AgentDiscussionPanel';
import EmergencyActionModal from '../components/EmergencyActionModal';
import AiInsightPanel from '../components/AiInsightPanel';
import AiSmsStatusPanel from '../components/AiSmsStatusPanel';

import ErrorBoundary from '../components/ErrorBoundary';
import AIInsightModal from '../components/AIInsightModal';



// ── 데이터 ─────────────────────────────────────────
const SHINHAN_COMPANIES = [
  '신한금융지주', '신한은행', '신한카드', '신한투자증권', '신한라이프',
  '신한캐피탈', '신한자산운용', '신한저축은행', '신한AI', '신한DS',
  '제주은행', '신한벤처투자', '신한리츠운용', '신한대체투자운용',
  '신한자산신탁', '신한펀드파트너스', '신한금융플러스', '신한큐브리스크컨설팅',
];

const API_BASE = 'https://sguardai.khcho0421.workers.dev';

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

  const [selectedSms, setSelectedSms] = useState(null);
  const [insightSms, setInsightSms] = useState(null);
  const selectedSmsRef = useRef(null);
  const [warRooms, setWarRooms] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);

  const handleOpenWarRoomFromInsight = async (smsMessage, analysisText) => {
    const currentSms = smsMessage || selectedSmsRef.current;
    if (!currentSms) return;

    // The raw received SMS ID (e.g. 20231026154512345) MUST be the primary key DB identifier
    // to match aichat_history, but we prefix it with INC- for the UI title.
    const incidentId = String(currentSms.inc_id || currentSms.id || `INC-${Date.now()}`);
    
    const baseSmsMessage = currentSms.message.length > 30 ? currentSms.message.substring(0, 30) + '...' : currentSms.message;
    const formattedUiId = incidentId.startsWith('INC-') ? incidentId : `INC-${incidentId}`;
    const smsTitle = `${formattedUiId} | ${baseSmsMessage}`;
    
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
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
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
          creator_id: userProfile?.name || 'SYSTEM',
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
          code: incidentId,
          title: smsTitle,
          description: diagnosisText || currentSms.message,
          severity: 'CRITICAL',
          incident_type: 'SMS',
          source_sms_id: currentSms.inc_id
        })
      });

      // AI Analysis Pinned Message
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
            text: `[장애발생] ${currentSms.sender}로부터 SMS 수신: ${currentSms.message}`
          })
        });
        
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
    const smsInterval = setInterval(fetchSMSMessages, 5000);
    const wrInterval = setInterval(fetchWarRooms, 8000);
    const activityInterval = setInterval(fetchActivityLogs, 10000);
    return () => {
      clearInterval(smsInterval);
      clearInterval(wrInterval);
      clearInterval(activityInterval);
    };
  }, []);

  // SMS 선택 시 에이전트 토론 자동 시작은 이제 인시던트 스트림 클릭 시 직접 제어됨
  // useEffect(() => {
  //   if (selectedSms) {
  //     startLiveScenario(selectedSms);
  //   } else {
  //     setShowAgentPanel(false);
  //     setAgentMessages([]);
  //   }
  // }, [selectedSms]);

  const fetchWarRooms = async () => {
    try {
      const apiBase = 'https://sguardai.khcho0421.workers.dev';
      // Fetch ALL rooms (any status) so we can hide the button for any existing room
      const res = await fetch(`${apiBase}/warroom/rooms`);
      if (res.ok) {
        const data = await res.json();
        const mapped = (data.rooms || []).map(room => ({
          id: room.code,
          inc_id: room.inc_id,
          source_sms_id: room.source_sms_id,
          title: room.title || `ROOM ${room.inc_id}`,
          status: room.status || 'OPEN',
          lastMsg: room.status === 'Completed' ? '종료된 체널' : '대화가 시작되지 않았습니다.',
          time: room.reg_dt 
            ? new Date(room.reg_dt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
            : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
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

  const fetchSMSMessages = async () => {
    try {
      // Cloudflare Workers API 사용
      const apiUrl = 'https://sguardai.khcho0421.workers.dev/sms/recent?limit=20';

      const response = await fetch(apiUrl);
      if (response.ok) {
        const data = await response.json();
        // 삭제된 항목은 필터링하여 상태 업데이트
        setSmsMessages((data.messages || []).filter(msg => !deletedSmsIds.has(msg.inc_id)));
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
      const apiUrl = window.location.hostname === 'localhost'
        ? `https://sguardai.khcho0421.workers.dev/sms/${id}`
        : `https://sguardai.khcho0421.workers.dev/sms/${id}`;

      const response = await fetch(apiUrl, { method: 'DELETE' });
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


  // Dummy data for recent assignments
  const recentAssignments = [
    {
      id: 'INC-8823',
      title: 'Payment Gateway Timeout',
      sender: 'AI Autopilot',
      time: '18:45',
      severity: 'CRITICAL',
      code: 'PG-001',
      assignmentType: 'AI',
      bgColor: 'bg-red-500/5',
      borderColor: 'border-red-500/10',
    },
    {
      id: 'SMS-1234',
      title: '서버 CPU 사용량 급증 알림',
      sender: '김철수',
      time: '14:30',
      severity: 'MAJOR',
      code: 'SRV-002',
      assignmentType: 'SMS',
      bgColor: 'bg-orange-500/5',
      borderColor: 'border-orange-500/10',
    },
    {
      id: 'AI-5678',
      title: '데이터베이스 연결 오류 감지',
      sender: 'AI Autopilot',
      time: '10:00',
      severity: 'NORMAL',
      code: 'DB-003',
      assignmentType: 'AI',
      bgColor: 'bg-blue-500/5',
      borderColor: 'border-blue-500/10',
    },
  ];

  const totalAssignedCount = recentAssignments.length;

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

  // Re-parse transcript (utility for handleAgentContent)
  const parseTranscript = (transcript) => {
    if (!transcript) return [];

    // 1. Initial cleanup of common headers/noise
    let text = transcript
      .replace(/--- ?\s*#* ?\[전문가별 심층 진단\]/gi, '')
      .replace(/#* ?\[리더의 최종 조치 가이드\]/gi, '\n[Leader]\n')
      .replace(/Agent:?\s*\*\*/gi, '')
      .replace(/^[ \t\n\r\W]+/gm, ''); // Remove leading non-word chars from overall transcript start

    // 2. Normalize Agent declarations to a uniform [Role] format
    // Includes Korean synonyms for missing roles coverage
    const declarations = [
      { name: 'Security', regex: /^[ \t]*(?:#+\s*|--- |\*\*|\[)?(?:Security|보안)(?:\s*Agent| Agent|분석|진단)?\s*(?:\]|:|\*\*)?/gim },
      { name: 'DB', regex: /^[ \t]*(?:#+\s*|--- |\*\*|\[)?(?:DB|데이터베이스)(?:\s*Agent| Agent|분석|진단)?\s*(?:\]|:|\*\*)?/gim },
      { name: 'DevOps', regex: /^[ \t]*(?:#+\s*|--- |\*\*|\[)?(?:DevOps|데브옵스)(?:\s*Agent| Agent|분석|진단)?\s*(?:\]|:|\*\*)?/gim },
      { name: 'Infra', regex: /^[ \t]*(?:#+\s*|--- |\*\*|\[)?(?:Infra|인프라)(?:\s*Agent| Agent|분석|진단)?\s*(?:\]|:|\*\*)?/gim },
      { name: 'App', regex: /^[ \t]*(?:#+\s*|--- |\*\*|\[)?(?:App|애플리케이션)(?:\s*Agent| Agent|분석|진단)?\s*(?:\]|:|\*\*)?/gim },
      { name: 'Leader', regex: /^[ \t]*(?:#+\s*|--- |\*\*|\[)?(?:Leader|리더|최종 조치)(?:\s*Agent| Agent|분석|진단|가이드)?\s*(?:\]|:|\*\*)?/gim }
    ];

    declarations.forEach(dec => {
      text = text.replace(dec.regex, `\n[${dec.name}]\n`);
    });

    // 3. Split by normalized markers
    // Prepend a newline to ensure the first marker matches the \n[...] multiline pattern
    const rolePattern = /\n\[(Security|DB|DevOps|Infra|App|Leader)\]\n/gi;
    const parts = ('\n' + text).split(rolePattern);
    const msgs = [];
    
    // Safety: ignore text before the first detected role
    let currentRole = null; 

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i].trim();
        if (!part) continue;

        // The split with capturing group puts the role name in the array
        if (['Security', 'DB', 'DevOps', 'Infra', 'App', 'Leader'].includes(part)) {
            currentRole = part;
        } else if (currentRole) {
            // Clean the content block
            const cleanText = part
                .replace(/^[ \t\-\*\#\d\.,\:]+/gm, (match) => {
                  // Only remove leading symbols, but preserve numbers if they are part of guidance
                  // unless it's just "1. " or "2. " exactly? 
                  // Let's be conservative: only remove non-digits at the VERY start of a block
                  return match.replace(/^[ \t\-\*\#\.,\:]+/, '');
                })
                .replace(/\*\*/g, '')           // Remove bolding clatter
                .replace(/^Agent\s*:\s*/i, '')  // Extra "Agent:" check
                .trim();
            
            if (cleanText) {
                const lastMsg = msgs[msgs.length - 1];
                if (lastMsg && lastMsg.role === currentRole) {
                    lastMsg.text += "\n" + cleanText;
                } else {
                    msgs.push({ role: currentRole, text: cleanText, delay: 0 });
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
        const completedMsgs = currentMsgs.map(m => ({ ...m, isCompleted: true }));
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


    try {
      const baseUrl = 'https://sguardai.khcho0421.workers.dev';
      const checkRes = await fetch(`${baseUrl}/ai/chat-history/${smsMessage.inc_id}`);
      if (checkRes.ok) {
         const data = await checkRes.json();
         if (data.messages && data.messages.length > 0) {
            const completedMsgs = data.messages.map(m => ({ ...m, isCompleted: true }));
            setAgentMessages(completedMsgs);
            setTimeout(() => setShowEmergencyModal(true), 1500);
            return; // Skip Dify streaming
         }
      }

      // -------------------------------------------------------------
      // IF CACHE IS EMPTY OR FETCH FAILS: STREAM MANUALLY FOR BOTTOM PANEL ONLY
      // This ensures the Agent panel still streams data even if AiInsightPanel is decoupled!
      // -------------------------------------------------------------
      const streamRes = await fetch(`${baseUrl}/ai/analyze-sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sender: smsMessage.sender, 
          message: smsMessage.message, 
          sms_id: smsMessage.inc_id 
        })
      });
      if (!streamRes.ok) throw new Error('Stream failed');

      const reader = streamRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalText = '';

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
               // Finished streaming
               console.log(`Standalone stream done for ${smsMessage.inc_id}`);
               const finalMsgs = parseTranscript(finalText);
               
               // Save to DB
               fetch(`${baseUrl}/ai/chat-history/save`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    incident_id: String(smsMessage.inc_id),
                    messages: finalMsgs
                  })
               }).catch(console.error);

               setTimeout(() => setShowEmergencyModal(true), 1500);
               return;
            }
            try {
               const data = JSON.parse(dataStr);
               if (data.answer) {
                  finalText += data.answer;
                  const currentMsgs = parseTranscript(finalText);
                  if (currentMsgs.length > 0) {
                    setAgentMessages(currentMsgs);
                  }
               }
            } catch(e) {}
          }
        }
      }

    } catch(e) {
      console.error("Agent panel stream err:", e);
      setAgentMessages([{ role: 'System', text: '데이터 조회에 실패했습니다. 캐시 데이터나 네트워크 상태를 확인해주세요.', delay: 0, isCompleted: true }]);
    }
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
            content: reportContent
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
      time: new Date().toLocaleTimeString()
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
                      navigate(n.type === 'SMS' ? '/chat' : '/assignment-detail?status=Open');
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
            <div className="bg-[#1a1f2e] rounded-3xl border border-white/5 shadow-xl overflow-hidden w-full">
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

              <div className={`transition-all duration-500 ease-in-out overflow-hidden ${isSmsPanelCollapsed ? 'max-h-0' : 'max-h-[1000px] border-t border-white/5'}`}>
                <div className="p-6 space-y-4">
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
                              <span className="text-[10px] text-slate-500 font-mono bg-white/5 px-2 py-0.5 rounded ml-auto whitespace-nowrap">
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 mb-1">발신: {msg.sender}</p>
                            <p className={`text-sm leading-snug ${isSelected ? 'text-yellow-100' : 'text-slate-200'}`}>{msg.message}</p>
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
          {/* Recent Alerts List */}
          <div className="lg:col-span-1 bg-[#1a1f2e] rounded-2xl p-6 border border-white/5 h-[650px] flex flex-col overflow-hidden shadow-xl">
            <h3 className="font-bold mb-4 flex items-center shrink-0">
              <Activity className="w-4 h-4 mr-2 text-blue-400" />
              Live Incident Stream
            </h3>
            <div className="flex-1 overflow-y-auto pr-2 scrollbar-hide space-y-4">
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
                      time={new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      severity={severity}
                      desc={msg.message}
                      isSelected={selectedSms?.inc_id === msg.inc_id}
                    />
                  </div>
                );
              })}

              {smsMessages.length === 0 && (
                <div className="text-center text-slate-500 text-sm py-4">
                  Waiting for incoming incidents...
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions / Assignment / Agent Panel */}
          <div className="lg:col-span-2 h-[650px]">
            <div className="bg-[#1a1f2e] rounded-2xl border border-white/5 h-full overflow-hidden flex flex-col shadow-xl">
              {showAgentPanel || selectedSms ? (
                <AgentDiscussionPanel
                  messages={agentMessages}
                  isVisible={true}
                  embedded={true}
                  onClose={() => {
                    setShowAgentPanel(false);
                    setSelectedSms(null);
                  }}
                />
              ) : (
                <div className="p-6 h-full flex flex-col">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold flex items-center">
                      <Shield className="w-4 h-4 mr-2 text-purple-400" />
                      AI War-Room Situation Log
                    </h3>
                    <span className="text-[10px] text-slate-500 bg-white/5 px-2 py-0.5 rounded">관제 대기 중</span>
                  </div>

                  <div className="flex-1 flex flex-col items-center justify-center opacity-40 py-10">
                    <Brain className="w-12 h-12 text-slate-600 mb-4 animate-pulse" />
                    <p className="text-sm text-slate-500 text-center">SMS 수신 내역을 클릭하여<br/>AI 에이전트 분석을 시작하세요.</p>
                  </div>

                  {/* 하단에 최근 활동 로그 작게 표시 (선택 사항) */}
                  <div className="mt-auto border-t border-white/5 pt-4">
                    <p className="text-[10px] text-slate-500 mb-2 font-bold uppercase tracking-wider">최근 시스템 활동</p>
                    <div className="space-y-2">
                      {activityLogs.slice(0, 2).map(log => (
                        <div key={log.inc_id} className="text-[10px] flex justify-between text-slate-400">
                          <span className="truncate mr-2">{log.action}</span>
                          <span className="shrink-0">{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>


        {/* Section 3: My Confirmation History & Recent List */}
        <div className="bg-[#1a1f2e] rounded-3xl p-6 border border-white/5 shadow-xl mt-6">
          <div className="flex justify-between items-center mb-5">
            <div className="flex items-center space-x-2">
              <User className="w-5 h-5 text-blue-500" />
              <h2 className="font-bold text-lg">나의 할당 및 처리 현황</h2>
            </div>
            <span className="text-[10px] text-slate-400">실시간 업데이트</span>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {/* Total */}
            <div
              onClick={() => navigate('/assignments?tab=전체')}
              className="bg-[#11141d] p-5 rounded-2xl border border-white/5 relative cursor-pointer hover:bg-[#252b41] transition-all hover:scale-[1.02] active:scale-95"
            >
              <p className="text-xs text-slate-400 mb-2 font-medium">총건</p>
              <span className="text-4xl font-bold text-white transition-all duration-500">{totalAssignedCount}</span>
              <div className="absolute bottom-4 right-4 bg-slate-700/20 p-2 rounded-xl">
                <MoreHorizontal className="w-5 h-5 text-slate-500 fill-current" />
              </div>
            </div>

            {/* Unconfirmed (Red) */}
            <div
              onClick={() => navigate('/assignments?tab=상태: 대기')}
              className="bg-[#11141d] p-5 rounded-2xl border border-white/5 relative cursor-pointer hover:bg-[#2e1a1a] transition-all hover:scale-[1.02] active:scale-95"
            >
              <p className="text-xs text-slate-400 mb-2 font-medium">미확인</p>
              <span className="text-4xl font-bold text-red-400">0</span>
              <div className="absolute bottom-4 right-4 bg-red-600/20 p-2 rounded-xl">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              {/* Pulsing Dot for Attention */}
              <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-ping" />
            </div>

            {/* Processing (Orange) */}
            <div
              onClick={() => navigate('/assignments?tab=상태: 처리중')}
              className="bg-[#11141d] p-5 rounded-2xl border border-white/5 relative cursor-pointer hover:bg-[#2e231a] transition-colors"
            >
              <p className="text-xs text-slate-400 mb-2 font-medium">분석중입니다</p>
              <span className="text-4xl font-bold text-orange-400">2</span>
              <div className="absolute bottom-4 right-4 bg-orange-600/20 p-2 rounded-xl">
                <RefreshCw className="w-5 h-5 text-orange-500" />
              </div>
            </div>

            {/* Completed (Blue) */}
            <div
              onClick={() => navigate('/assignments?tab=상태: 완료')}
              className="bg-[#11141d] p-5 rounded-2xl border border-white/5 relative cursor-pointer hover:bg-[#1a1f2e] transition-colors"
            >
              <p className="text-xs text-slate-400 mb-2 font-medium">처리완료</p>
              <span className="text-4xl font-bold text-blue-400">3</span>
              <div className="absolute bottom-4 right-4 bg-blue-600/20 p-2 rounded-xl">
                <CheckCircle className="w-5 h-5 text-blue-500" />
              </div>
            </div>
          </div>

          {/* Recent List Header */}
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-white">최근 할당 리스트 ({recentAssignments.length})</h3>
            <button
              onClick={() => navigate('/assignments')}
              className="text-[11px] text-blue-500 font-medium hover:text-blue-400 flex items-center"
            >
              전체보기 <ChevronRight className="w-3 h-3 ml-0.5" />
            </button>
          </div>

          {/* List Items - Dynamic */}
          <div className="space-y-3">
            {recentAssignments.length > 0 ? (
              recentAssignments.slice(0, 3).map((item) => (
                <div
                  key={item.inc_id}
                  onClick={() => navigate('/assignment-detail?status=Open')}
                  className={`${item.bgColor} p-4 rounded-2xl border ${item.borderColor} relative group hover:border-white/10 transition-colors cursor-pointer`}
                >
                  <div className="flex items-start space-x-3">
                    <div className={`${item.severity === 'CRITICAL' ? 'bg-red-500/10' : 'bg-blue-500/10'} p-2 rounded-full mt-0.5`}>
                      <AlertCircle className={`w-5 h-5 ${item.severity === 'CRITICAL' ? 'text-red-500' : 'text-blue-500'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex items-center gap-2 max-w-[70%]">
                          <span className={`text-[8px] font-black px-1 py-0.5 rounded border flex-shrink-0 ${item.assignmentType === 'AI'
                            ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                            : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                            }`}>
                            {item.assignmentType || 'AI'}
                          </span>
                          <h4 className="text-sm font-bold text-white truncate">{item.title}</h4>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">{item.time}</span>
                      </div>
                      <p className="text-xs text-slate-300 leading-snug mb-2">
                        발신: {item.sender}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className={`${item.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-500 border-red-500/30' : 'bg-blue-500/20 text-blue-500 border-blue-500/30'} text-[10px] font-bold px-2 py-0.5 rounded border`}>
                          {item.severity}
                        </span>
                        <span className="text-[10px] text-slate-500">{item.code}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-[#11141d] p-8 rounded-2xl border border-white/5 text-center">
                <Info className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-slate-400">최근 할당 내역이 없습니다</p>
                <p className="text-xs text-slate-500 mt-1">SMS 메시지가 수신되면 자동으로 추가됩니다</p>
              </div>
            )}
          </div>
        </div>

        {/* Handling Progress Area */}
        <AiSmsStatusPanel />
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
                    <span className="text-[10px] text-slate-500">{room.time}</span>
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
          <span className="text-xs text-slate-500 whitespace-nowrap ml-2">{time}</span>
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
