import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBackNavigation } from '../../hooks/useBackNavigation';
import { 
  ArrowLeft, Bell, Brain, Users, CheckCircle2, AlertCircle, TrendingUp, Layers, User, Zap, ArrowRight, Activity, PieChart as PieChartIcon, ShieldAlert,
  Calendar, Clock, Server, Network
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip
} from 'recharts';
import ReactECharts from 'echarts-for-react';
import { getAccessToken, getAuthHeaders, getUserProfile } from '../../lib/authStore';
import { toast } from 'react-hot-toast';

// --- Shared Helper Functions ---
const parseDate = (val) => {
  if (!val) return null;
  let s = String(val).trim();
  if (!s.includes('T') && s.length >= 16) {
    s = s.substring(0, 10) + 'T' + s.substring(11, 16) + (s.length >= 19 ? s.substring(16, 19) : ':00');
  }
  if (!s.endsWith('Z') && !s.includes('+') && !s.includes('-') && s.includes('T')) {
    s += 'Z';
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

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
      if (extra.startsWith('%')) cleaned = `${formattedInside}%`;
      else cleaned = `${formattedInside} ${extra}`;
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
      <div className="text-[12px] leading-relaxed font-bold break-all whitespace-pre-wrap text-[#ffffff] tracking-tight">
        {message}
      </div>
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
        <div className={`text-[12px] font-black border px-3 py-1.5 rounded-xl flex items-center gap-2 mb-1 ${headerBg}`}>
          <span className={`w-2 h-2 rounded-full animate-pulse ${bulletColor}`} />
          <span>{title}</span>
        </div>
      )}
      <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden p-2.5 grid grid-cols-[auto_auto] gap-x-4 gap-y-1 items-start">
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
              <div key={idx} className="col-span-2 text-[10px] font-bold text-slate-400 bg-white/5 -mx-2.5 px-2.5 py-0.5 border-y border-white/5">
                {item.key}
              </div>
            );
          }
          
          return (
            <div key={idx} className="flex items-start gap-1 text-[10px] leading-tight min-w-0">
              <span className={`font-bold shrink-0 whitespace-nowrap ${highlight ? 'text-red-300' : 'text-slate-400'}`}>
                {item.key}:
              </span>
              <span className={`font-mono text-left ${
                item.key.includes('메시지') || item.key.includes('수신자') || item.key.includes('노드') || item.key.includes('건수') || item.key.includes('명')
                  ? 'break-all' : 'whitespace-nowrap'
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

const getFallbackBizSystem = (msg) => {
  const text = String(msg).toUpperCase();
  if (text.includes('S-BRIDGE') || text.includes('BRIDGE')) return 'S-BRIDGE Gateway';
  if (text.includes('DB') || text.includes('SQL') || text.includes('ORACLE') || text.includes('QUERY')) return 'Database Server';
  if (text.includes('WAS') || text.includes('TOMCAT') || text.includes('API') || text.includes('HTTP')) return 'WAS Web Server';
  if (text.includes('NETWORK') || text.includes('SWITCH') || text.includes('ROUTER') || text.includes('IP')) return 'Network Node';
  if (text.includes('PDS') || text.includes('CALLERT') || text.includes('PHONE')) return 'S-CALLERT VoIP';
  return 'Infra Core System';
};
const getFallbackKeyword = (msg) => {
  const text = String(msg).toUpperCase();
  if (text.includes('CRITICAL') || text.includes('FATAL') || text.includes('EMERGENCY')) return 'CRITICAL_ERR';
  if (text.includes('WARN') || text.includes('WARNING')) return 'SYS_WARN';
  if (text.includes('TIMEOUT') || text.includes('DELAY')) return 'TIMEOUT_ALERT';
  if (text.includes('CPU') || text.includes('LOAD')) return 'CPU_HIGH';
  if (text.includes('MEMORY') || text.includes('RAM') || text.includes('HEAP')) return 'MEM_EXHAUST';
  return 'GENERIC_ALERT';
};
const getFallbackNode = (msg, idx) => {
  const text = String(msg).toUpperCase();
  if (text.includes('WAS-01') || text.includes('WAS1')) return 'WAS-PROD-01';
  if (text.includes('WAS-02') || text.includes('WAS2')) return 'WAS-PROD-02';
  if (text.includes('DB-01') || text.includes('DB1')) return 'DB-MASTER-01';
  if (text.includes('DB-02') || text.includes('DB2')) return 'DB-SLAVE-02';
  if (text.includes('L4') || text.includes('SWITCH')) return 'NET-CORE-L4';
  const nodes = ['WAS-PROD-01', 'WAS-PROD-02', 'DB-MASTER-01', 'DB-SLAVE-02', 'NET-CORE-L4', 'API-GATEWAY-01'];
  return nodes[idx % nodes.length];
};

const findNodeInTree = (nodes, target, targetDepth = null, currentDepth = 1) => {
  if (!target || !nodes || nodes.length === 0) return null;
  const norm = String(target).trim().toLowerCase();
  for (const node of nodes) {
    const match = (node.code && String(node.code).trim().toLowerCase() === norm) || (String(node.name).trim().toLowerCase() === norm);
    if (match) {
      if (targetDepth === null || currentDepth === targetDepth) return node;
    }
  }
  for (const node of nodes) {
    if (node.children?.length) {
      const found = findNodeInTree(node.children, target, targetDepth, currentDepth + 1);
      if (found) return found;
    }
  }
  return null;
};

// --- Mobile Realtime Pipeline Component ---
export default function MobileRealtimePipelinePage() {
  const navigate = useNavigate();
  const goBack = useBackNavigation('/dashboard');
  const user = getUserProfile();

  const [activeTab, setActiveTab] = useState('live'); // 'live' | 'analytics'
  
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('today');
  const [selectedCardId, setSelectedCardId] = useState(null);
  const [isSimulationActive, setIsSimulationActive] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [orgTree, setOrgTree] = useState([]);
  const [warRooms, setWarRooms] = useState([]);
  const [isOpeningWarRoom, setIsOpeningWarRoom] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Filters for Analytics
  const [filterStage, setFilterStage] = useState('all');
  const [orgLevel, setOrgLevel] = useState('team');
  const [selectedBumun, setSelectedBumun] = useState('all');
  const [selectedHonbu, setSelectedHonbu] = useState('all');
  const [selectedTeam, setSelectedTeam] = useState('all');
  
  const apiBase = 'https://sguardai.khcho0421.workers.dev';
  const eventSourceRef = useRef(null);

  const fetchWarRooms = async () => {
    const userProfile = getUserProfile();
    if (!userProfile?.employee_id) return;
    try {
      const res = await fetch(`${apiBase}/ai/warroom/my-rooms?user_id=${userProfile.employee_id}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        const rooms = data.rooms || [];
        const uniqueRooms = Array.from(new Map(rooms.map(r => [r.inc_id || r.id, r])).values());
        setWarRooms(uniqueRooms);
      }
    } catch (err) {}
  };

  const handleOpenWarRoom = async (card) => {
    if (isOpeningWarRoom) return;
    if (!card) return;
    setIsOpeningWarRoom(true);

    const userProfile = getUserProfile();
    const incidentId = String(card.inc_id);
    const rawMsg = card.message || "SMS 장애 감지";
    const truncatedMsg = rawMsg.length > 50 ? rawMsg.substring(0, 50) + "..." : rawMsg;
    const smsTitle = `${incidentId} | ${truncatedMsg}`;
    
    const existingRoom = warRooms.find(r => String(r.id) === String(incidentId) || String(r.inc_id) === String(incidentId));
    if (existingRoom) {
      navigate(`/chat/${incidentId}`);
      setIsOpeningWarRoom(false);
      return;
    }

    try {
      const res = await fetch(`${apiBase}/ai/warroom/open`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          inc_id: incidentId,
          title: smsTitle,
          creator_id: userProfile?.employee_id || null,
          severity: card.severity || 'NORMAL',
          leader_summary: '실시간 관제 워룸 생성'
        })
      });
      await fetch(`${apiBase}/incidents`, {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({
          inc_id: String(incidentId), title: smsTitle, description: rawMsg,
          severity: card.severity || 'NORMAL', incident_type: 'SMS', source_sms_id: String(card.inc_id)
        })
      });
      await fetchWarRooms();
      toast.success('워룸 개설 완료!');
      navigate(`/chat/${incidentId}`);
    } catch (err) {
      toast.error('워룸 개설 실패');
    } finally {
      setIsOpeningWarRoom(false);
    }
  };

  const playAlertSound = (type) => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      if (type === 'critical') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(680, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start(); osc.stop(ctx.currentTime + 0.3);
      } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime);
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start(); osc.stop(ctx.currentTime + 0.25);
      }
    } catch (e) {}
  };

  const fetchLiveMessages = async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    try {
      const response = await fetch(`${apiBase}/sms/recent?limit=100`, { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        const liveMsgs = data.messages || data || [];
        const mappedCards = liveMsgs.map((msg, idx) => {
          let stage = 1;
          const statusNorm = String(msg.incident_status || '').toUpperCase().trim();
          const isAnalyzed = Number(msg.is_analyzed) > 0;
          if (statusNorm === 'INC_003' || statusNorm === 'CLOSED' || statusNorm === '처리완료' || statusNorm === '조치완료') stage = 4;
          else if (statusNorm === 'INC_002' || statusNorm === 'PROGRESS' || statusNorm === '진행중' || statusNorm === '처리중') stage = 3;
          else if (isAnalyzed) stage = 2;

          let finalRegDt = msg.reg_dt || msg.timestamp || new Date().toISOString();
          if (msg.occurrence_time) {
            const ot = String(msg.occurrence_time).trim();
            if (ot.length >= 19 && ot.match(/^\d{4}-\d{2}-\d{2}/)) finalRegDt = ot;
            else if (ot.match(/^\d{2}:\d{2}/)) {
              const d = new Date();
              finalRegDt = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${ot}`;
            } else finalRegDt = ot;
          }

          let timer = 180;
          if (stage === 3) {
            const parsedRegDate = parseDate(finalRegDt) || new Date();
            const ageSec = Math.floor((Date.now() - parsedRegDate.getTime()) / 1000);
            timer = ageSec > 0 && ageSec < 180 ? 180 - ageSec : 120;
          }

          let finalClosedDt = msg.closed_dt || null;
          let baseDate = parseDate(msg.warroom_dt) || parseDate(msg.ai_dt) || parseDate(finalRegDt);
          if (finalClosedDt && baseDate) {
            const cDate = parseDate(finalClosedDt);
            if (cDate && (cDate.getTime() - baseDate.getTime() > 3600000 * 12)) {
               finalClosedDt = new Date(baseDate.getTime() + 39000).toISOString();
            }
          }

          return {
            inc_id: msg.inc_id || `INC-${msg.id || idx}`,
            message: msg.message || '',
            sender_name: msg.name || msg.sender_name || '미정',
            severity: msg.severity || 'WARNING',
            reg_dt: finalRegDt,
            ai_dt: msg.ai_dt || null,
            warroom_dt: msg.warroom_dt || null,
            closed_dt: finalClosedDt,
            stage,
            timer,
            bizSystem: msg.biz_system || getFallbackBizSystem(msg.message),
            keyword: msg.keyword_detected || getFallbackKeyword(msg.message),
            node: msg.occurrence_node || getFallbackNode(msg.message, idx),
            bumun: msg.bumun || '미분류 부문',
            honbu: msg.honbu || '미분류 본부',
            team: msg.team || '미분류 팀',
            part: msg.part || '미분류 파트',
          };
        });
        setCards(mappedCards);
        if (mappedCards.length > 0 && !selectedCardId) setSelectedCardId(mappedCards[0].inc_id);
      }
    } catch (e) {} finally { setLoading(false); }
  };

  useEffect(() => {
    fetchWarRooms();
    fetchLiveMessages();
    fetch(`${apiBase}/org/tree`, { headers: getAuthHeaders() })
      .then(r => r.ok ? r.json() : [])
      .then(tree => setOrgTree(Array.isArray(tree) ? tree : []))
      .catch(() => {});
      
    const interval = setInterval(fetchWarRooms, 8000);
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => { clearInterval(interval); clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (!isSimulationActive) {
      if (eventSourceRef.current) { eventSourceRef.current.close(); eventSourceRef.current = null; }
      return;
    }
    let sseRetry = 0, sseRetryTimer = null;
    const connectSSE = () => {
      const token = getAccessToken();
      if (!token) return;
      if (eventSourceRef.current) { eventSourceRef.current.close(); eventSourceRef.current = null; }

      const sse = new EventSource(`${apiBase}/sms/notification-stream?token=${token}`);
      eventSourceRef.current = sse;

      sse.addEventListener('sms_received', (event) => {
        sseRetry = 0;
        try {
          const raw = JSON.parse(event.data);
          if (raw && raw.message) {
            playAlertSound(raw.severity?.toLowerCase() === 'critical' ? 'critical' : 'warning');
            const newCard = {
              inc_id: raw.inc_id || `INC-LIVE-${Date.now()}`,
              message: raw.message,
              sender_name: raw.sender_name || '실시간유입',
              severity: raw.severity || 'WARNING',
              reg_dt: new Date().toISOString(),
              stage: 1, timer: 180,
              bizSystem: getFallbackBizSystem(raw.message),
              keyword: getFallbackKeyword(raw.message),
              node: getFallbackNode(raw.message, Date.now()),
              bumun: raw.bumun || '미분류 부문',
              honbu: raw.honbu || '미분류 본부',
              team: raw.team || '미분류 팀',
              part: raw.part || '미분류 파트',
            };
            setCards(prev => [newCard, ...prev]);
            toast.success(`[신규 장애 수신] ${newCard.inc_id} 유입`);
          }
        } catch (err) {}
      });
      sse.onerror = () => {
        sse.close(); eventSourceRef.current = null;
        sseRetryTimer = setTimeout(connectSSE, Math.min(1000 * Math.pow(2, sseRetry++), 30000));
      };
    };
    connectSSE();
    return () => {
      clearTimeout(sseRetryTimer);
      if (eventSourceRef.current) { eventSourceRef.current.close(); eventSourceRef.current = null; }
    };
  }, [isSimulationActive]);

  useEffect(() => {
    const timerInterval = setInterval(() => {
      setCards(prev => prev.map(card => {
        if (card.stage === 3 && card.timer > 0) {
          const nextTimer = card.timer - 1;
          if (nextTimer === 0 && (card.severity === 'CRITICAL' || card.severity === 'MAJOR')) {
            playAlertSound('critical');
            return { ...card, timer: 0, stage: 4 };
          }
          return { ...card, timer: nextTimer };
        }
        return card;
      }));
    }, 1000);
    return () => clearInterval(timerInterval);
  }, [soundEnabled]);

  const getFilteredCards = () => {
    const now = new Date();
    return cards.filter(c => {
      if (c.reg_dt) {
        const regDate = parseDate(c.reg_dt);
        if (period === 'today' && regDate.toDateString() !== now.toDateString()) return false;
      }
      if (filterStage !== 'all' && c.stage?.toString() !== filterStage) return false;
      return true;
    });
  };

  const displayedCards = getFilteredCards();
  const activeDagCard = displayedCards.find(c => c.inc_id === selectedCardId) || displayedCards[0] || null;

  const totalCount = displayedCards.length;
  const countsByStage = {
    1: displayedCards.filter(c => c.stage === 1).length,
    2: displayedCards.filter(c => c.stage === 2).length,
    3: displayedCards.filter(c => c.stage === 3).length,
    4: displayedCards.filter(c => c.stage === 4).length,
  };

  const renderTimeline = (card) => {
    if (!card) return <div className="text-slate-500 text-xs text-center py-10">인시던트가 없습니다.</div>;
    const { stage, reg_dt } = card;
    const t1 = parseDate(reg_dt) || new Date();
    const t2 = stage >= 2 ? (parseDate(card.ai_dt) || new Date(t1.getTime() + 10000)) : null;
    const t3 = stage >= 3 ? (parseDate(card.warroom_dt) || new Date((t2 || t1).getTime() + 120000)) : null;
    const t4 = stage >= 4 ? (parseDate(card.closed_dt) || new Date((t3 || t2 || t1).getTime() + 60000)) : null;

    const diffObj = (a, b) => { 
      if (!a) return null; 
      const ms = Math.max(0, (b ? new Date(b) : currentTime) - new Date(a)); 
      const m = Math.floor(ms / 60000), s2 = Math.floor((ms % 60000) / 1000); 
      return { text: m > 0 ? `${m}m ${s2}s` : `${s2}s`, min: m }; 
    };

    const durationMs = (t4 ? new Date(t4) : currentTime) - new Date(t1);
    const isClosed = stage >= 4;

    const FLOW_STEPS = [
      { id: 'SMS', label: 'SMS 수신 및 인지', icon: <Bell className="w-3.5 h-3.5" />, color: '#3b82f6' },
      { id: 'RAG_AGENT', label: 'RAG/AI 분석 완료', icon: <Brain className="w-3.5 h-3.5" />, color: '#8b5cf6' },
      { id: 'WARROOM', label: '워룸 생성 (처리중)', icon: <Users className="w-3.5 h-3.5" />, color: '#00e5ff' },
      { id: 'KNOWLEDGE', label: '최종 조치 완료', icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: '#10b981' }
    ];

    return (
      <div className="flex flex-col gap-3 pb-8">
        {/* Mobile Compact Activity Ring */}
        <div className="flex items-center gap-4 bg-white/[0.02] border border-white/5 p-3 rounded-2xl">
          <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" stroke="#1e293b" strokeWidth="8" fill="none" />
              <circle cx="50" cy="50" r="40" stroke={isClosed ? '#10b981' : '#00e5ff'} strokeWidth="8" fill="none" strokeDasharray={2 * Math.PI * 40} strokeDashoffset={(2 * Math.PI * 40) * (1 - (stage/4))} strokeLinecap="round" className="transition-all duration-1000" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[10px] font-black text-white" style={{ textShadow: `0 0 8px ${isClosed ? '#10b981' : '#00e5ff'}` }}>
                {Math.floor(durationMs / 60000)}m
              </span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-black text-white truncate mr-2">{card.inc_id}</span>
              <span className={`px-1.5 py-0.5 rounded text-[8px] font-black shrink-0 ${card.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                {card.severity}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 leading-tight">
              {card.bizSystem} <br/> {card.bumun} &gt; {card.team}
            </div>
          </div>
        </div>

        {/* Vertical Timeline */}
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-4 relative">
          <div className="absolute left-7 top-6 bottom-6 w-[2px] bg-white/5 rounded-full z-0" />
          
          {FLOW_STEPS.map((step, sIdx) => {
            const stepStageNum = sIdx + 1;
            const isCompleted = stage >= stepStageNum;
            const isActive = stage === stepStageNum && stage < 4;
            const ts = stepStageNum === 1 ? t1 : stepStageNum === 2 ? t2 : stepStageNum === 3 ? t3 : t4;
            
            return (
              <div key={step.id} className={`relative flex items-start gap-3 z-10 ${!isCompleted && !isActive ? 'opacity-30' : ''}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border-2 bg-[#0a0e17] transition-all`}
                     style={{ borderColor: isCompleted ? step.color : '#1e293b', color: isCompleted ? step.color : '#475569' }}>
                  {step.icon}
                </div>
                <div className="flex-1 min-w-0 pt-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[11px] font-black ${isCompleted ? 'text-white' : 'text-slate-400'}`}>{step.label}</span>
                    {ts && <span className="text-[9px] font-mono text-slate-500">{`${ts.getHours().toString().padStart(2,'0')}:${ts.getMinutes().toString().padStart(2,'0')}`}</span>}
                  </div>
                  {isActive && <div className="text-[9px] text-cyan-400 mt-1 animate-pulse font-bold">진행 중...</div>}
                  {step.id === 'WARROOM' && (isCompleted || isActive) && (() => {
                      const roomExists = warRooms.some(r => String(r.id) === String(card.inc_id) || String(r.inc_id) === String(card.inc_id));
                      return roomExists ? (
                        <button onClick={() => navigate(`/chat/${card.inc_id}`)} className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black bg-[#00e5ff]/10 text-[#00e5ff] border border-[#00e5ff]/30 active:scale-95 transition-all">
                          <Zap className="w-3 h-3 text-[#00e5ff]" /><span>워룸 이동</span><ArrowRight className="w-3 h-3" />
                        </button>
                      ) : (
                        <button onClick={() => handleOpenWarRoom(card)} disabled={isOpeningWarRoom} className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black bg-[#00e5ff]/10 text-[#00e5ff] border border-[#00e5ff]/30 active:scale-95 transition-all">
                          <Users className="w-3 h-3" /><span>워룸 개설하기</span>
                        </button>
                      );
                  })()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Message Detail Card */}
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-3">
          <div className="text-[10px] font-black text-slate-400 mb-2 border-b border-white/5 pb-2">SMS 원문</div>
          {renderFormattedSMS(card.message, card.severity)}
        </div>
      </div>
    );
  };

  const renderAnalytics = () => {
    // Analytics Charts preparation
    const trafficMap = {};
    for (let i = 0; i < 24; i++) trafficMap[i.toString().padStart(2, '0') + ':00'] = 0;
    const bizSystemMap = {};
    const orgStatsMap = {};

    displayedCards.forEach(c => {
      const date = parseDate(c.reg_dt) || new Date();
      const hourStr = date.getHours().toString().padStart(2, '0') + ':00';
      trafficMap[hourStr] = (trafficMap[hourStr] || 0) + 1;
      bizSystemMap[c.bizSystem] = (bizSystemMap[c.bizSystem] || 0) + 1;
    });

    const trafficData = Object.keys(trafficMap).sort().map(h => ({ hour: h, count: trafficMap[h] }));
    const bizSystemPieData = Object.keys(bizSystemMap).map((n, i) => ({ name: n, value: bizSystemMap[n], color: ['#00e5ff', '#a855f7', '#f59e0b', '#3b82f6', '#10b981', '#ec4899'][i % 6] }));
    
    const allBumuns = [...new Set(orgTree.flatMap(node => node.children || []).map(n => n.name))].filter(Boolean).sort();
    
    const orgFilteredCards = displayedCards.filter(c => {
      if (orgLevel === 'bumun') return selectedBumun === 'all' || (c.bumun || '') === selectedBumun;
      return true;
    });

    orgFilteredCards.forEach(c => {
      let groupKey = c.bumun || '미분류 부문';
      if (!orgStatsMap[groupKey]) orgStatsMap[groupKey] = { name: groupKey, 수신: 0, 처리대기중: 0, 처리중: 0, 처리완료: 0 };
      orgStatsMap[groupKey].수신 += 1;
      if (c.stage <= 2) orgStatsMap[groupKey].처리대기중 += 1;
      else if (c.stage === 3) orgStatsMap[groupKey].처리중 += 1;
      else if (c.stage === 4) orgStatsMap[groupKey].처리완료 += 1;
    });
    const orgList = Object.values(orgStatsMap).sort((a, b) => b.수신 - a.수신);

    return (
      <div className="flex flex-col gap-4 pb-8">
        {/* System Occupancy */}
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3"><Layers className="w-4 h-4 text-cyan-400" /><h3 className="text-xs font-black text-white">시스템 점유비</h3></div>
          {bizSystemPieData.length > 0 ? (
            <div className="flex flex-col gap-3">
              <div className="w-full h-8 rounded-lg overflow-hidden flex bg-slate-800 shadow-inner">
                {bizSystemPieData.map((item, i) => (
                  <div key={i} style={{ width: `${(item.value / totalCount) * 100}%`, backgroundColor: item.color }} className="h-full border-r border-[#0b0e17]/50 flex items-center justify-center">
                    {((item.value / totalCount) * 100) > 10 && <span className="text-[10px] font-black text-white/90">{Math.round((item.value / totalCount) * 100)}%</span>}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {bizSystemPieData.map((item, i) => (
                  <div key={i} className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: item.color }} /><span className="text-[10px] text-slate-400 truncate">{item.name}</span><span className="text-[10px] font-bold text-slate-200 ml-auto">{item.value}건</span></div>
                ))}
              </div>
            </div>
          ) : <div className="text-center text-xs text-slate-500 py-4">데이터 없음</div>}
        </div>

        {/* Hourly Traffic */}
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3"><TrendingUp className="w-4 h-4 text-cyan-400" /><h3 className="text-xs font-black text-white">실시간 장애 접수 추이</h3></div>
          <div className="h-32 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <AreaChart data={trafficData} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                <defs><linearGradient id="colorTraffic" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00e5ff" stopOpacity={0.4}/><stop offset="95%" stopColor="#00e5ff" stopOpacity={0}/></linearGradient></defs>
                <XAxis dataKey="hour" tick={{ fill: '#64748b', fontSize: 7 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 7 }} axisLine={false} tickLine={false} />
                <Area type="monotone" dataKey="count" stroke="#00e5ff" strokeWidth={1.5} fillOpacity={1} fill="url(#colorTraffic)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Org Stats (Simplified) */}
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3"><Network className="w-4 h-4 text-cyan-400" /><h3 className="text-xs font-black text-white">조직 기반 현황 (부문별)</h3></div>
          <div className="space-y-3">
            {orgList.map(org => (
              <div key={org.name} className="flex flex-col gap-1 border-b border-white/5 pb-2 last:border-0 last:pb-0">
                <div className="text-xs font-black text-white">{org.name}</div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-400">수신: <b className="text-blue-400">{org.수신}</b></span>
                  <span className="text-slate-400">대기: <b className="text-amber-400">{org.처리대기중}</b></span>
                  <span className="text-slate-400">처리중: <b className="text-red-400">{org.처리중}</b></span>
                  <span className="text-slate-400">완료: <b className="text-emerald-400">{org.처리완료}</b></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#070b12] text-white font-sans flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#0b0e17]/90 backdrop-blur-md border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => goBack()} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center active:scale-95 text-slate-300">
            <ArrowLeft size={16} />
          </button>
          <h1 className="text-sm font-black tracking-tight text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" /> Realtime Pipeline
          </h1>
        </div>
        <div className="flex gap-1 bg-black/40 p-1 rounded-lg">
          <button onClick={() => setActiveTab('live')} className={`px-3 py-1 rounded-md text-[10px] font-black transition-all ${activeTab === 'live' ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-500'}`}>LIVE</button>
          <button onClick={() => setActiveTab('analytics')} className={`px-3 py-1 rounded-md text-[10px] font-black transition-all ${activeTab === 'analytics' ? 'bg-purple-500/20 text-purple-400' : 'text-slate-500'}`}>분석</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 custom-scrollbar">
        {/* Funnel Dashboard Header (Always Visible) */}
        <div className="bg-black/30 border border-white/5 rounded-2xl p-3 mb-4">
          <div className="grid grid-cols-4 gap-2 mb-3">
            {[
              { label: '수신/인지', count: countsByStage[1], color: 'text-blue-400', bg: 'bg-blue-500/10' },
              { label: 'AI 분석', count: countsByStage[2], color: 'text-purple-400', bg: 'bg-purple-500/10' },
              { label: '처리중', count: countsByStage[3], color: 'text-red-400', bg: 'bg-red-500/10' },
              { label: '처리완료', count: countsByStage[4], color: 'text-emerald-400', bg: 'bg-emerald-500/10' }
            ].map((st, i) => (
              <div key={i} className={`${st.bg} flex flex-col items-center justify-center rounded-xl py-2 border border-white/5`} onClick={() => { setFilterStage(String(i+1)); setActiveTab('live'); }}>
                <span className="text-[9px] font-bold text-slate-400 mb-1 tracking-tighter whitespace-nowrap">{st.label}</span>
                <span className={`text-[12px] font-black font-mono ${st.color}`}>{st.count}</span>
              </div>
            ))}
          </div>
          {/* Ticker */}
          <div className="bg-[#121622] rounded-lg border border-white/5 h-8 flex items-center overflow-hidden pl-2 pr-1 relative">
            <div className="flex items-center gap-1 text-red-400 text-[8px] font-black shrink-0 mr-2 z-10 bg-[#121622] pr-2">
              <AlertCircle className="w-2.5 h-2.5 animate-pulse" /> Breaking
            </div>
            <div className="flex-1 overflow-hidden relative h-full flex items-center">
              <div className="whitespace-nowrap animate-marquee flex items-center gap-8 absolute left-0" style={{ animationPlayState: isSimulationActive ? 'running' : 'paused' }}>
                {displayedCards.slice(0, 5).map((c, i) => (
                  <span key={i} className="text-[9px] text-slate-300 font-bold" onClick={() => { setSelectedCardId(c.inc_id); setActiveTab('live'); }}>
                    <span className="text-cyan-400 mr-1">[{c.bizSystem}]</span>{c.inc_id} 유입
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Content based on Tab */}
        {activeTab === 'live' ? (
          <>
            {/* Active Incident View */}
            {renderTimeline(activeDagCard)}
            
            {/* Horizontal scrollable incident cards */}
            <div className="mt-4 mb-8">
              <div className="text-[10px] font-black text-slate-400 mb-2 px-1">실시간 대기열 ({displayedCards.length}건)</div>
              <div className="flex gap-3 overflow-x-auto pb-4 custom-scrollbar snap-x">
                {displayedCards.map(c => (
                  <div key={c.inc_id} onClick={() => setSelectedCardId(c.inc_id)} className={`snap-center shrink-0 w-[200px] bg-white/[0.02] border rounded-xl p-3 flex flex-col gap-2 transition-all cursor-pointer ${selectedCardId === c.inc_id ? 'border-cyan-500/50 shadow-[0_0_15px_rgba(0,229,255,0.15)]' : 'border-white/5 opacity-70'}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-white">{c.inc_id}</span>
                      <span className={`w-2 h-2 rounded-full ${c.stage === 4 ? 'bg-emerald-400' : c.stage === 3 ? 'bg-red-400 animate-pulse' : 'bg-blue-400'}`} />
                    </div>
                    <div className="text-[9px] text-slate-400 truncate">{c.bizSystem}</div>
                    <div className="text-[9px] text-slate-500 font-mono mt-auto">{c.reg_dt.slice(11, 16)}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          renderAnalytics()
        )}
      </div>
    </div>
  );
}
