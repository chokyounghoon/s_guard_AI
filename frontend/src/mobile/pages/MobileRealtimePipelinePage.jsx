import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBackNavigation } from '../../hooks/useBackNavigation';
import { 
  ArrowLeft, Bell, Brain, Users, CheckCircle2, AlertCircle, TrendingUp, Layers, User, Zap, ArrowRight, Activity, PieChart as PieChartIcon, ShieldAlert,
  Calendar, Clock, Server, Network
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ComposedChart, Line, Legend
} from 'recharts';
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
      
    const interval = setInterval(() => {
      if (!document.hidden) fetchWarRooms();
    }, 10000);
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
    if (!card) return <div className="text-slate-500 text-xs text-center py-20 flex flex-col items-center"><Layers className="w-8 h-8 mb-3 opacity-20" />인시던트가 없습니다.</div>;
    const { stage, reg_dt } = card;
    const t1 = parseDate(reg_dt) || new Date();
    const t2 = stage >= 2 ? (parseDate(card.ai_dt) || new Date(t1.getTime() + 10000)) : null;
    const t3 = stage >= 3 ? (parseDate(card.warroom_dt) || new Date((t2 || t1).getTime() + 120000)) : null;
    const t4 = stage >= 4 ? (parseDate(card.closed_dt) || new Date((t3 || t2 || t1).getTime() + 60000)) : null;

    const durationMs = (t4 ? new Date(t4) : currentTime) - new Date(t1);
    const isClosed = stage >= 4;

    const FLOW_STEPS = [
      { id: 'SMS', label: '장애 이벤트 인지', icon: <Bell className="w-4 h-4" />, color: '#00e5ff', shadow: 'rgba(0,229,255,0.4)' },
      { id: 'RAG_AGENT', label: 'AI 컨텍스트 분석', icon: <Brain className="w-4 h-4" />, color: '#a855f7', shadow: 'rgba(168,85,247,0.4)' },
      { id: 'WARROOM', label: '합동 워룸 대응', icon: <Users className="w-4 h-4" />, color: '#ef4444', shadow: 'rgba(239,68,68,0.4)' },
      { id: 'KNOWLEDGE', label: '최종 복구 확인', icon: <CheckCircle2 className="w-4 h-4" />, color: '#10b981', shadow: 'rgba(16,185,129,0.4)' }
    ];

    return (
      <div className="flex flex-col gap-4 pb-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Mobile Compact Activity Ring */}
        <div className="flex items-center gap-5 bg-gradient-to-r from-white/[0.05] to-transparent border border-white/10 p-4 rounded-3xl shadow-xl backdrop-blur-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#00e5ff]/5 rounded-full blur-3xl -z-10" />
          <div className="relative w-20 h-20 shrink-0 flex items-center justify-center drop-shadow-[0_0_15px_rgba(0,0,0,0.5)]">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" stroke="rgba(255,255,255,0.05)" strokeWidth="8" fill="none" />
              <circle cx="50" cy="50" r="42" stroke={isClosed ? '#10b981' : '#00e5ff'} strokeWidth="8" fill="none" strokeDasharray={2 * Math.PI * 42} strokeDashoffset={(2 * Math.PI * 42) * (1 - (stage/4))} strokeLinecap="round" className="transition-all duration-1000 ease-out" style={{ filter: `drop-shadow(0 0 6px ${isClosed ? '#10b981' : '#00e5ff'})` }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[12px] font-black text-white" style={{ textShadow: `0 0 10px ${isClosed ? 'rgba(16,185,129,0.8)' : 'rgba(0,229,255,0.8)'}` }}>
                {Math.floor(durationMs / 60000)}m
              </span>
            </div>
          </div>
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[13px] font-black text-white truncate mr-2 tracking-wide drop-shadow-md">{card.inc_id}</span>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black shrink-0 border ${card.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-400 border-red-500/40 shadow-[0_0_10px_rgba(239,68,68,0.2)]' : 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.2)]'}`}>
                {card.severity}
              </span>
            </div>
            <div className="text-[11px] font-bold text-slate-300 leading-tight">
              <span className="text-[#00e5ff]">{card.bizSystem}</span> <br/> 
              <span className="text-slate-500 mt-1 inline-block">{card.bumun} &gt; {card.team}</span>
            </div>
          </div>
        </div>

        {/* Vertical Timeline */}
        <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-5 space-y-5 relative shadow-lg backdrop-blur-sm mt-2">
          <div className="absolute left-9 top-8 bottom-8 w-0.5 bg-gradient-to-b from-white/10 via-white/5 to-transparent rounded-full z-0" />
          
          {FLOW_STEPS.map((step, sIdx) => {
            const stepStageNum = sIdx + 1;
            const isCompleted = stage >= stepStageNum;
            const isActive = stage === stepStageNum && stage < 4;
            const ts = stepStageNum === 1 ? t1 : stepStageNum === 2 ? t2 : stepStageNum === 3 ? t3 : t4;
            
            return (
              <div key={step.id} className={`relative flex items-start gap-4 z-10 transition-opacity duration-300 ${!isCompleted && !isActive ? 'opacity-40 grayscale' : 'opacity-100'}`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border-2 transition-all duration-500 ${isActive ? 'scale-110' : ''}`}
                     style={{ 
                       backgroundColor: isCompleted ? `${step.color}15` : '#0a0e17',
                       borderColor: isCompleted ? step.color : '#1e293b', 
                       color: isCompleted ? step.color : '#475569',
                       boxShadow: isActive || isCompleted ? `0 0 15px ${step.shadow}` : 'none'
                     }}>
                  {step.icon}
                </div>
                <div className="flex-1 min-w-0 pt-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[12px] font-black ${isCompleted ? 'text-white drop-shadow-md' : 'text-slate-500'}`}>{step.label}</span>
                    {ts && <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-1.5 py-0.5 rounded">{`${ts.getHours().toString().padStart(2,'0')}:${ts.getMinutes().toString().padStart(2,'0')}`}</span>}
                  </div>
                  {isActive && <div className="text-[10px] text-[#00e5ff] mt-1.5 animate-pulse font-bold tracking-wide">분석/처리 진행중...</div>}
                  {step.id === 'WARROOM' && (isCompleted || isActive) && (() => {
                      const roomExists = warRooms.some(r => String(r.id) === String(card.inc_id) || String(r.inc_id) === String(card.inc_id));
                      return roomExists ? (
                        <button onClick={() => navigate(`/chat/${card.inc_id}`)} className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-black bg-[#00e5ff]/10 hover:bg-[#00e5ff]/20 text-[#00e5ff] border border-[#00e5ff]/30 shadow-[0_0_15px_rgba(0,229,255,0.15)] active:scale-95 transition-all">
                          <Zap className="w-3.5 h-3.5" /><span>워룸 즉시 이동</span><ArrowRight className="w-3.5 h-3.5 ml-1" />
                        </button>
                      ) : (
                        <button onClick={() => handleOpenWarRoom(card)} disabled={isOpeningWarRoom} className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-black bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.15)] active:scale-95 transition-all disabled:opacity-50">
                          <Users className="w-3.5 h-3.5" />
                          <span>{isOpeningWarRoom ? '개설 준비 중...' : '합동 대응 워룸 개설'}</span>
                        </button>
                      );
                  })()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Message Detail Card */}
        <div className="bg-[#0a0e17] border border-white/5 rounded-3xl p-4 shadow-xl relative overflow-hidden mt-2 group">
          <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-500 to-purple-500 opacity-50" />
          <div className="text-[11px] font-black text-slate-400 mb-3 flex items-center gap-2">
            <Server className="w-3.5 h-3.5" /> RAW Payload Data
          </div>
          <div className="pl-2">
            {renderFormattedSMS(card.message, card.severity)}
          </div>
        </div>
      </div>
    );
  };

  const renderAnalytics = () => {
    // Analytics Charts preparation
    const trafficMap = {};
    const mttaMap = {};
    const mttrMap = {};
    for (let i = 0; i < 24; i++) {
      const hStr = i.toString().padStart(2, '0') + ':00';
      trafficMap[hStr] = 0;
      mttaMap[hStr] = { sum: 0, count: 0 };
      mttrMap[hStr] = { sum: 0, count: 0 };
    }
    const bizSystemMap = {};
    const orgStatsMap = {};

    displayedCards.forEach(c => {
      const date = parseDate(c.reg_dt) || new Date();
      const hourStr = date.getHours().toString().padStart(2, '0') + ':00';
      trafficMap[hourStr] += 1;
      bizSystemMap[c.bizSystem] = (bizSystemMap[c.bizSystem] || 0) + 1;
      
      if (c.warroom_dt && c.reg_dt) {
        const diffMs = parseDate(c.warroom_dt).getTime() - parseDate(c.reg_dt).getTime();
        if (diffMs >= 0) { mttaMap[hourStr].sum += diffMs / 60000; mttaMap[hourStr].count += 1; }
      }
      if (c.closed_dt && c.reg_dt) {
        const diffMs = parseDate(c.closed_dt).getTime() - parseDate(c.reg_dt).getTime();
        if (diffMs >= 0) { mttrMap[hourStr].sum += diffMs / 60000; mttrMap[hourStr].count += 1; }
      }
    });

    const trafficData = Object.keys(trafficMap).sort().map(h => ({ hour: h, count: trafficMap[h] }));
    const mttData = Object.keys(mttaMap).sort().map(h => ({
      hour: h,
      MTTA: mttaMap[h].count > 0 ? Math.round(mttaMap[h].sum / mttaMap[h].count) : 0,
      MTTR: mttrMap[h].count > 0 ? Math.round(mttrMap[h].sum / mttrMap[h].count) : 0,
    }));
    
    const bizSystemPieData = Object.keys(bizSystemMap).map((n, i) => ({ name: n, value: bizSystemMap[n], color: ['#00e5ff', '#a855f7', '#f59e0b', '#3b82f6', '#10b981', '#ec4899'][i % 6] }));
    
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
      <div className="flex flex-col gap-6 pb-8 animate-in fade-in duration-500">
        
        {/* MTTA / MTTR Trend (New!) */}
        <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-5 shadow-lg backdrop-blur-sm">
          <div className="flex items-center gap-2.5 mb-4">
            <Clock className="w-4 h-4 text-purple-400 drop-shadow-[0_0_5px_rgba(168,85,247,0.8)]" />
            <h3 className="text-[13px] font-black text-white tracking-wide">대응 시간 (MTTA/MTTR)</h3>
          </div>
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={mttData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="hour" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} tickMargin={8} />
                <YAxis yAxisId="left" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} />
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'rgba(11,14,23,0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}
                  itemStyle={{ padding: '2px 0' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                <Line yAxisId="left" type="monotone" dataKey="MTTA" name="MTTA (분)" stroke="#a855f7" strokeWidth={2.5} dot={{ r: 2 }} activeDot={{ r: 5, strokeWidth: 0, fill: '#a855f7' }} style={{ filter: 'drop-shadow(0 0 5px rgba(168,85,247,0.5))' }} />
                <Line yAxisId="left" type="monotone" dataKey="MTTR" name="MTTR (분)" stroke="#00e5ff" strokeWidth={2.5} dot={{ r: 2 }} activeDot={{ r: 5, strokeWidth: 0, fill: '#00e5ff' }} style={{ filter: 'drop-shadow(0 0 5px rgba(0,229,255,0.5))' }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Hourly Traffic */}
        <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-5 shadow-lg backdrop-blur-sm">
          <div className="flex items-center gap-2.5 mb-4">
            <TrendingUp className="w-4 h-4 text-[#00e5ff] drop-shadow-[0_0_5px_rgba(0,229,255,0.8)]" />
            <h3 className="text-[13px] font-black text-white tracking-wide">실시간 장애 접수 추이</h3>
          </div>
          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trafficData} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                <defs><linearGradient id="colorTrafficMob" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00e5ff" stopOpacity={0.5}/><stop offset="95%" stopColor="#00e5ff" stopOpacity={0}/></linearGradient></defs>
                <XAxis dataKey="hour" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} tickMargin={8} />
                <YAxis tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} />
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <Tooltip contentStyle={{ backgroundColor: 'rgba(11,14,23,0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }} />
                <Area type="monotone" dataKey="count" name="발생건수" stroke="#00e5ff" strokeWidth={2} fillOpacity={1} fill="url(#colorTrafficMob)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* System Occupancy */}
        <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-5 shadow-lg backdrop-blur-sm">
          <div className="flex items-center gap-2.5 mb-5">
            <Layers className="w-4 h-4 text-emerald-400 drop-shadow-[0_0_5px_rgba(16,185,129,0.8)]" />
            <h3 className="text-[13px] font-black text-white tracking-wide">주요 시스템 점유율</h3>
          </div>
          {bizSystemPieData.length > 0 ? (
            <div className="flex flex-col gap-4">
              <div className="w-full h-10 rounded-xl overflow-hidden flex shadow-inner border border-white/5">
                {bizSystemPieData.map((item, i) => (
                  <div key={i} style={{ width: `${(item.value / totalCount) * 100}%`, backgroundColor: item.color }} className="h-full border-r border-[#0b0e17]/30 flex items-center justify-center transition-all">
                    {((item.value / totalCount) * 100) > 12 && <span className="text-[11px] font-black text-black/70 drop-shadow-sm">{Math.round((item.value / totalCount) * 100)}%</span>}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3 mt-1">
                {bizSystemPieData.map((item, i) => (
                  <div key={i} className="flex items-center justify-between bg-white/[0.03] px-3 py-2 rounded-lg border border-white/5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-3 h-3 rounded-md shadow-sm shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-[11px] font-bold text-slate-300 truncate">{item.name}</span>
                    </div>
                    <span className="text-[12px] font-black text-white ml-2 shrink-0">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <div className="text-center text-xs text-slate-500 py-6 bg-white/5 rounded-xl">접수된 시스템 통계가 없습니다</div>}
        </div>

        {/* Org Stats Leaderboard */}
        <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-5 shadow-lg backdrop-blur-sm">
          <div className="flex items-center gap-2.5 mb-5">
            <Network className="w-4 h-4 text-red-400 drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]" />
            <h3 className="text-[13px] font-black text-white tracking-wide">부문별 대응 리더보드</h3>
          </div>
          <div className="space-y-3">
            {orgList.map((org, idx) => (
              <div key={org.name} className="flex flex-col gap-2 bg-white/[0.03] border border-white/5 p-3 rounded-2xl relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-600 rounded-l-2xl" />
                <div className="flex justify-between items-center pl-2">
                  <div className="text-[12px] font-black text-white flex items-center gap-2">
                    <span className="text-[10px] font-mono text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">#{idx+1}</span>
                    {org.name}
                  </div>
                  <div className="text-[11px] font-black bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full shadow-[0_0_5px_rgba(59,130,246,0.2)]">
                    TOTAL {org.수신}
                  </div>
                </div>
                <div className="flex items-center justify-between text-[10px] pl-2 bg-black/20 rounded-xl p-2 mt-1">
                  <span className="text-slate-400 font-bold flex flex-col items-center">대기 <b className="text-amber-400 text-[12px]">{org.처리대기중}</b></span>
                  <div className="w-px h-6 bg-white/10" />
                  <span className="text-slate-400 font-bold flex flex-col items-center">대응 <b className="text-red-400 text-[12px]">{org.처리중}</b></span>
                  <div className="w-px h-6 bg-white/10" />
                  <span className="text-slate-400 font-bold flex flex-col items-center">완료 <b className="text-emerald-400 text-[12px]">{org.처리완료}</b></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#050810] text-slate-200 font-sans flex flex-col relative overflow-hidden">
      {/* Background glow effects */}
      <div className="fixed top-0 left-0 w-full h-96 bg-[#00e5ff]/5 rounded-full blur-[120px] -z-10 opacity-60 pointer-events-none" />
      <div className="fixed bottom-0 right-0 w-96 h-96 bg-purple-500/5 rounded-full blur-[120px] -z-10 opacity-40 pointer-events-none" />

      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#070b14]/80 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center justify-between shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-3">
          <button onClick={() => goBack()} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center active:scale-95 text-slate-300 transition-all shadow-sm">
            <ArrowLeft size={16} />
          </button>
          <h1 className="text-sm font-black tracking-tight text-white flex items-center gap-2" style={{ textShadow: '0 0 10px rgba(0,229,255,0.3)' }}>
            <Activity className="w-4 h-4 text-[#00e5ff] drop-shadow-[0_0_8px_rgba(0,229,255,0.8)]" /> Pipeline
          </h1>
        </div>
        
        {/* Segmented Control */}
        <div className="relative flex items-center bg-black/40 p-1 rounded-xl shadow-inner border border-white/5">
          <button 
            onClick={() => setActiveTab('live')} 
            className={`relative z-10 px-4 py-1.5 rounded-lg text-[11px] font-black transition-colors duration-300 ${activeTab === 'live' ? 'text-white' : 'text-slate-500'}`}
          >
            LIVE
          </button>
          <button 
            onClick={() => setActiveTab('analytics')} 
            className={`relative z-10 px-4 py-1.5 rounded-lg text-[11px] font-black transition-colors duration-300 ${activeTab === 'analytics' ? 'text-white' : 'text-slate-500'}`}
          >
            분석
          </button>
          {/* Active Slider */}
          <div 
            className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-gradient-to-r from-blue-600/80 to-purple-600/80 rounded-lg shadow-[0_0_10px_rgba(59,130,246,0.3)] transition-transform duration-300 ease-out border border-white/10`} 
            style={{ transform: activeTab === 'analytics' ? 'translateX(calc(100% + 8px))' : 'translateX(0)' }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-5 pb-10 custom-scrollbar z-10">
        {/* Funnel Dashboard Header (Always Visible) */}
        <div className="bg-white/[0.02] backdrop-blur-md border border-white/10 rounded-3xl p-4 mb-5 shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
          <div className="grid grid-cols-4 gap-2 mb-4 relative z-10">
            {[
              { label: '수신/인지', count: countsByStage[1], color: 'text-[#00e5ff]', glow: 'shadow-[#00e5ff]/20', bg: 'bg-gradient-to-b from-[#00e5ff]/10 to-[#00e5ff]/5 border-[#00e5ff]/20' },
              { label: 'AI 분석', count: countsByStage[2], color: 'text-purple-400', glow: 'shadow-purple-500/20', bg: 'bg-gradient-to-b from-purple-500/10 to-purple-500/5 border-purple-500/20' },
              { label: '처리중', count: countsByStage[3], color: 'text-red-400', glow: 'shadow-red-500/20', bg: 'bg-gradient-to-b from-red-500/10 to-red-500/5 border-red-500/20' },
              { label: '처리완료', count: countsByStage[4], color: 'text-emerald-400', glow: 'shadow-emerald-500/20', bg: 'bg-gradient-to-b from-emerald-500/10 to-emerald-500/5 border-emerald-500/20' }
            ].map((st, i) => (
              <div 
                key={i} 
                className={`${st.bg} ${st.glow} flex flex-col items-center justify-center rounded-2xl py-3 border backdrop-blur-sm shadow-inner transition-transform active:scale-95`} 
                onClick={() => { setFilterStage(String(i+1)); setActiveTab('live'); }}
              >
                <span className="text-[10px] font-black text-slate-300 mb-1 tracking-tighter whitespace-nowrap drop-shadow-md">{st.label}</span>
                <span className={`text-[15px] font-black font-mono ${st.color} drop-shadow-[0_0_8px_currentColor]`}>{st.count}</span>
              </div>
            ))}
          </div>
          
          {/* Ticker */}
          <div className="bg-black/60 rounded-xl border border-white/5 h-10 flex items-center overflow-hidden pl-3 pr-2 relative shadow-inner">
            <div className="flex items-center gap-1.5 text-red-400 text-[10px] font-black shrink-0 mr-2 z-20 bg-black/60 pr-2 h-full">
              <span className="relative flex h-2.5 w-2.5 mr-1">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
              </span>
              BREAKING
            </div>
            {/* Fade masks */}
            <div className="absolute left-20 top-0 bottom-0 w-8 bg-gradient-to-r from-black/60 to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-black/60 to-transparent z-10 pointer-events-none" />
            
            <div className="flex-1 overflow-hidden relative h-full flex items-center">
              <div className="whitespace-nowrap animate-marquee flex items-center gap-10 absolute left-0" style={{ animationPlayState: isSimulationActive ? 'running' : 'paused' }}>
                {displayedCards.slice(0, 5).map((c, i) => (
                  <span key={i} className="text-[11px] text-slate-300 font-bold tracking-wide" onClick={() => { setSelectedCardId(c.inc_id); setActiveTab('live'); }}>
                    <span className="text-[#00e5ff] mr-1.5">[{c.bizSystem}]</span>{c.inc_id} 유입
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
            <div className="mt-5 mb-8">
              <div className="text-[11px] font-black text-slate-400 mb-3 px-1 tracking-wide uppercase">실시간 대기열 ({displayedCards.length}건)</div>
              <div className="flex gap-4 overflow-x-auto pb-6 pt-2 px-1 custom-scrollbar snap-x">
                {displayedCards.map(c => {
                  const isSelected = selectedCardId === c.inc_id;
                  return (
                  <div 
                    key={c.inc_id} 
                    onClick={() => setSelectedCardId(c.inc_id)} 
                    className={`snap-center shrink-0 w-[220px] rounded-2xl p-4 flex flex-col gap-2.5 transition-all duration-300 cursor-pointer ${
                      isSelected 
                      ? 'bg-gradient-to-br from-[#00e5ff]/20 to-blue-600/20 border-2 border-[#00e5ff]/50 shadow-[0_0_25px_rgba(0,229,255,0.2)] scale-100 z-10' 
                      : 'bg-white/[0.03] border border-white/5 opacity-60 scale-95 hover:opacity-100 hover:scale-100'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[12px] font-black ${isSelected ? 'text-white' : 'text-slate-300'}`}>{c.inc_id}</span>
                      <span className={`relative flex h-2.5 w-2.5`}>
                        {c.stage === 3 && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>}
                        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${c.stage === 4 ? 'bg-emerald-400' : c.stage === 3 ? 'bg-red-500' : 'bg-purple-400'}`}></span>
                      </span>
                    </div>
                    <div className="text-[11px] font-bold text-slate-300 truncate">{c.bizSystem}</div>
                    <div className="flex justify-between items-center mt-auto">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${c.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                        {c.severity}
                      </span>
                      <div className="text-[10px] text-slate-500 font-mono font-bold bg-black/40 px-2 py-0.5 rounded-full">{c.reg_dt.slice(11, 16)}</div>
                    </div>
                  </div>
                )})}
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
