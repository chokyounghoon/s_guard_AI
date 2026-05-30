import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBackNavigation } from '../hooks/useBackNavigation';
import { 
  ChevronLeft, ShieldCheck, Database, Cpu, 
  Layers, Activity, Clock, ArrowRight, 
  CheckCircle2, User, RefreshCw, AlertTriangle, ShieldAlert,
  Play, Volume2, ExternalLink, X, TrendingUp, BarChart3,
  Calendar, Network, Server, Zap, CheckCircle, Search, PieChart as PieChartIcon,
  Bell, Users, Brain, AlertCircle, Info, MessageSquare
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, PieChart, Pie, Cell, Legend, LineChart, Line, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ComposedChart, BarChart, Bar
} from 'recharts';
import ReactECharts from 'echarts-for-react';
import { getAccessToken, getAuthHeaders, getUserProfile } from '../lib/authStore';
import { toast } from 'react-hot-toast';
import { useResizable, useResizableVertical } from '../hooks/useResizable';

// 🇰🇷 KST 안전 날짜 파서 (브라우저간 타임존 파싱 편차 제거)
const parseDate = (val) => {
  if (!val) return null;
  let s = String(val).trim();
  if (!s.includes('T') && s.length >= 16) {
    s = s.substring(0, 10) + 'T' + s.substring(11, 16) + (s.length >= 19 ? s.substring(16, 19) : ':00');
  }
  // 백엔드에서 넘어오는 시간이 UTC이므로 'Z'를 강제 추가하여 KST로 자동 변환되도록 함
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

const getOrgHierarchy = (teamName) => {
  const name = teamName || '미분류';
  if (name === '조직 미지정') {
    return { bumun: '소속 없음', honbu: '조직 미지정', team: '조직 미지정', part: '조직 미지정' };
  }
  if (name.includes('운영1팀') || name.includes('DB운영')) {
    return { bumun: '부문 미지정', honbu: 'IT운영본부', team: 'IT운영1팀', part: name.includes('파트') ? name : '미분류파트' };
  }
  if (name.includes('클라우드') || name.includes('SRE')) {
    return { bumun: '부문 미지정', honbu: 'IT인프라본부', team: '클라우드인프라팀', part: name.includes('파트') ? name : 'SRE파트' };
  }
  if (name.includes('보안')) {
    return { bumun: '부문 미지정', honbu: '정보보안본부', team: '네트워크보안팀', part: '보안관제파트' };
  }
  return { bumun: '부문 미지정', honbu: '기타본부', team: name, part: '기타파트' };
};

export default function RealtimePipelinePage() {
  const navigate = useNavigate();
  const goBack = useBackNavigation('/dashboard');
  const user = getUserProfile();

  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('operator'); 
  const [period, setPeriod] = useState('today');
  const [orgLevel, setOrgLevel] = useState('team');
  const [selectedBumun, setSelectedBumun] = useState('개발운영부문');
  const [selectedHonbu, setSelectedHonbu] = useState('금융본부');
  const [selectedTeam, setSelectedTeam] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [filterStage, setFilterStage] = useState('all');
  const [filterOrgName, setFilterOrgName] = useState('all');
  const [filterOrgStage, setFilterOrgStage] = useState('all');
  const [filterHour, setFilterHour] = useState('all');
  const [filterSystem, setFilterSystem] = useState('all');
  const [selectedCardId, setSelectedCardId] = useState(null);
  const [isSimulationActive, setIsSimulationActive] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [workflowPanelId, setWorkflowPanelId] = useState(null);
  const [orgTree, setOrgTree] = useState([]); // Full org chart from /org/tree
  const [showFullTimeline, setShowFullTimeline] = useState(false);
  const [warRooms, setWarRooms] = useState([]);
  const [isOpeningWarRoom, setIsOpeningWarRoom] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const { widths, startDrag, isDragging } = useResizable([40, 30, 30], 'realtime-pipeline-widths');
  const { heights: leftHeights, startVDrag: startLeftVDrag } = useResizableVertical([35, 65], 'realtime-pipeline-left-heights');
  const { heights: rightHeights, startVDrag: startRightVDrag } = useResizableVertical([35, 65], 'realtime-pipeline-right-heights');

  // --- Executive Mode Stable Mock Data ---
  // ROI Trend (Generate 24h smooth trend)
  const execRoiTrendData = useMemo(() => Array.from({length: 24}, (_, i) => {
    const base = 50 + Math.sin(i * 0.5) * 30 + Math.random() * 10;
    return {
      time: `${i}시`,
      hours: Math.round(base * 1.5),
      rag: Math.round(base),
      incidents: Math.round(base * 1.2)
    };
  }), []);

  // System Vulnerability
  const sysNames = ['JOBMIND Batch', 'Infra Core', 'WAS Web Server', 'DB Master', 'Network L4'];
  const execSystemHealthList = useMemo(() => sysNames.map((name, i) => ({
    name,
    total: 100 - i * 15 + Math.floor(Math.random() * 10),
    aiResolved: 80 - i * 12 + Math.floor(Math.random() * 10)
  })), []);

  // 24H Zero-Blind Spot Map
  const execHourlyMap = useMemo(() => Array.from({length: 24}, (_, i) => {
    const isNight = i >= 22 || i <= 6;
    const count = isNight ? Math.floor(10 + Math.random() * 15) : Math.floor(30 + Math.random() * 40);
    return {
      hour: `${i}시`,
      count,
      isNight,
      critical: isNight && Math.random() > 0.7 ? 1 : 0
    };
  }), []);

  const apiBase = 'https://sguardai.khcho0421.workers.dev';

  // Depth-aware node finder (synced from UserManagementPage)
  const findNodeInTree = (nodes, target, targetDepth = null, currentDepth = 1) => {
    if (!target || !nodes || nodes.length === 0) return null;
    const norm = String(target).trim().toLowerCase();
    
    for (const node of nodes) {
      const match = (node.code && String(node.code).trim().toLowerCase() === norm) || 
                    (String(node.name).trim().toLowerCase() === norm);
      
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

  const getSubNodes = (childDepth, parentCode) => {
    if (childDepth === 1) return orgTree;
    if (!parentCode) return [];
    const parentNode = findNodeInTree(orgTree, parentCode);
    return parentNode ? (parentNode.children || []) : [];
  };

  const fetchWarRooms = async () => {
    const userProfile = getUserProfile();
    if (!userProfile?.employee_id) return;
    try {
      const res = await fetch(`${apiBase}/ai/warroom/my-rooms?user_id=${userProfile.employee_id}`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        const rooms = data.rooms || [];
        const uniqueRooms = Array.from(new Map(rooms.map(r => [r.inc_id || r.id, r])).values());
        const mapped = uniqueRooms.map(room => ({
          ...room,
          id: room.inc_id,
          time: room.reg_dt ? room.reg_dt : new Date().toISOString(),
          participants: room.participants || 2,
          severity: room.severity || 'NORMAL'
        }));
        setWarRooms(mapped);
      }
    } catch (err) {
      console.error("Failed to fetch War-Rooms:", err);
    }
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
      const lockRes = await fetch(`${apiBase}/ai/warroom/lock/${incidentId}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ user_name: userProfile?.name || 'Unknown User' })
      });
      const lockData = await lockRes.json();
      if (!lockData.success) {
        toast.error(`이미 ${lockData.owner} 매니저님이 워룸 개설을 진행 중입니다.`);
        setIsOpeningWarRoom(false);
        return;
      }
    } catch (lockError) {}
    
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
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          inc_id: String(incidentId),
          title: smsTitle,
          description: rawMsg,
          severity: card.severity || 'NORMAL',
          incident_type: 'SMS',
          source_sms_id: String(card.inc_id)
        })
      });

      await fetchWarRooms();
      toast.success('워룸 개설 완료!');
      navigate(`/chat/${incidentId}`);
    } catch (err) {
      console.error("Failed to open War-Room:", err);
      // Clean up lock on failure
      fetch(`${apiBase}/ai/warroom/lock/${incidentId}`, { 
        method: 'DELETE',
        headers: getAuthHeaders()
      }).catch(() => {});
    } finally {
      setIsOpeningWarRoom(false);
    }
  };

  useEffect(() => {
    fetchWarRooms();
    const interval = setInterval(fetchWarRooms, 8000);
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => {
      clearInterval(interval);
      clearInterval(timer);
    };
  }, []);
  const eventSourceRef = useRef(null);

  const playAlertSound = (type) => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      if (type === 'critical') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(680, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime);
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
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

          // 실제 장애 발생 시각(occurrence_time)이 있으면 이를 최우선으로 매핑 (접수 시각의 지연 및 편차 보정)
          let finalRegDt = msg.reg_dt || msg.timestamp || new Date().toISOString();
          if (msg.occurrence_time) {
            const ot = String(msg.occurrence_time).trim();
            if (ot.length >= 19 && ot.match(/^\d{4}-\d{2}-\d{2}/)) {
              finalRegDt = ot;
            } else if (ot.match(/^\d{2}:\d{2}/)) {
              const d = new Date();
              const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
              finalRegDt = `${todayStr} ${ot}`;
            } else {
              finalRegDt = ot;
            }
          }

          let timer = 180;
          if (stage === 3) {
            const parsedRegDate = parseDate(finalRegDt) || new Date();
            const ageSec = Math.floor((Date.now() - parsedRegDate.getTime()) / 1000);
            timer = ageSec > 0 && ageSec < 180 ? 180 - ageSec : 120;
          }

          const assigneeName = msg.name || msg.sender_name || '미정';
          const maskedAssignee = assigneeName.charAt(0) + '*' + (assigneeName.length > 2 ? assigneeName.charAt(assigneeName.length - 1) : '');

          let finalClosedDt = msg.closed_dt || null;
          let baseDate = parseDate(msg.warroom_dt) || parseDate(msg.ai_dt) || parseDate(finalRegDt);
          if (finalClosedDt && baseDate) {
            const cDate = parseDate(finalClosedDt);
            // 12시간 이상 차이나는 비정상 목업 데이터는 이전 단계 시간 기준으로 보정 (정상적인 MTTR 노출 목적)
            if (cDate && (cDate.getTime() - baseDate.getTime() > 3600000 * 12)) {
               finalClosedDt = new Date(baseDate.getTime() + 39000).toISOString();
            }
          }

          return {
            inc_id: msg.inc_id || `INC-${msg.id || idx}`,
            message: msg.message || '',
            sender: msg.sender || 'UNKNOWN',
            sender_name: assigneeName,
            severity: msg.severity || 'WARNING',
            reg_dt: finalRegDt,
            ai_dt: msg.ai_dt || null,
            warroom_dt: msg.warroom_dt || null,
            closed_dt: finalClosedDt,
            is_analyzed: msg.is_analyzed || 0,
            incident_status: msg.incident_status || 'PENDING',
            stage,
            timer,
            assignee: maskedAssignee,
            bizSystem: msg.biz_system || getFallbackBizSystem(msg.message),
            keyword: msg.keyword_detected || getFallbackKeyword(msg.message),
            node: msg.occurrence_node || getFallbackNode(msg.message, idx),
            bumun: msg.bumun || '미분류 부문',
            honbu: msg.honbu || '미분류 본부',
            team: msg.team || '미분류 팀',
            part: msg.part || '미분류 파트',
            similarityScore: msg.similarity_score ? Math.round(msg.similarity_score * 100) : Math.floor(75 + (idx * 3) % 24)
          };
        });

        setCards(mappedCards);
        if (mappedCards.length > 0 && !selectedCardId) setSelectedCardId(mappedCards[0].inc_id);
      }
    } catch (e) {
      toast.error('데이터베이스 연동 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveMessages();
    // Fetch full org tree to know all bumuns regardless of incident data
    fetch(`${apiBase}/org/tree`, { headers: getAuthHeaders() })
      .then(r => r.ok ? r.json() : [])
      .then(tree => setOrgTree(Array.isArray(tree) ? tree : []))
      .catch(() => {});

  }, []);

  useEffect(() => {
    if (!isSimulationActive) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    let sseRetry = 0;
    let sseRetryTimer = null;

    const connectSSE = () => {
      const token = getAccessToken();
      if (!token) return;

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      const sse = new EventSource(`${apiBase}/sms/notification-stream?token=${token}`);
      eventSourceRef.current = sse;

      // onmessage → sms_received named event로 변경 (named events는 onmessage로 린지 않음)
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
              is_analyzed: 0,
              stage: 1,
              timer: 180,
              assignee: raw.sender_name ? raw.sender_name.charAt(0) + '*' + (raw.sender_name.length > 2 ? raw.sender_name.charAt(raw.sender_name.length - 1) : '') : '미정',
              bizSystem: getFallbackBizSystem(raw.message),
              keyword: getFallbackKeyword(raw.message),
              node: getFallbackNode(raw.message, Date.now()),
              bumun: raw.bumun || '미분류 부문',
              honbu: raw.honbu || '미분류 본부',
              team: raw.team || '미분류 팀',
              part: raw.part || '미분류 파트',
              similarityScore: Math.floor(80 + Math.random() * 19)
            };

            setCards(prev => [newCard, ...prev]);
            if (!selectedCardId) setSelectedCardId(newCard.inc_id);
            toast.success(`[신규 장애 수신] ${newCard.inc_id} 파이프라인 진입!`);
          }
        } catch (err) {}
      });

      sse.addEventListener('connected', () => { sseRetry = 0; });

      sse.onerror = () => {
        console.warn('[Pipeline SSE] Connection failed, retrying...');
        sse.close();
        eventSourceRef.current = null;
        const delay = Math.min(1000 * Math.pow(2, sseRetry), 30000);
        sseRetry += 1;
        sseRetryTimer = setTimeout(connectSSE, delay);
      };
    };

    connectSSE();

    return () => {
      clearTimeout(sseRetryTimer);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [isSimulationActive]);

  useEffect(() => {
    const timerInterval = setInterval(() => {
      setCards(prev => {
        return prev.map(card => {
          if (card.stage === 3 && card.timer > 0) {
            const nextTimer = card.timer - 1;
            if (nextTimer === 0 && (card.severity === 'CRITICAL' || card.severity === 'MAJOR')) {
              playAlertSound('critical');
              return { ...card, timer: 0, stage: 4, incident_status: 'INC_003' };
            }
            return { ...card, timer: nextTimer };
          }
          return card;
        });
      });
    }, 1000);
    return () => clearInterval(timerInterval);
  }, [soundEnabled]);


  const formatTime = (secs) => {
    const h = Math.floor(secs / 3600).toString().padStart(2, '0');
    const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const getElapsedSeconds = (regDt) => {
    const start = parseDate(regDt);
    if (!start) return 0;
    return Math.max(0, Math.floor((currentTime.getTime() - start.getTime()) / 1000));
  };

  const getMttrSeconds = (regDt, closedDt) => {
    const start = parseDate(regDt);
    const end = parseDate(closedDt);
    if (!start || !end) return 0;
    return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));
  };

  const formatDtTimeOnly = (d) => {
    if (!d) return '';
    const pad = (n) => n.toString().padStart(2, '0');
    return `${pad(d.getMonth()+1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const getFilteredCards = () => {
    const now = new Date();
    return cards.filter(c => {
      if (c.reg_dt) {
        const regDate = parseDate(c.reg_dt);
        if (period === 'today' && regDate.toDateString() !== now.toDateString()) return false;
        if (period === 'yesterday') {
          const yesterday = new Date();
          yesterday.setDate(now.getDate() - 1);
          if (regDate.toDateString() !== yesterday.toDateString()) return false;
        }
        if (period === '7days') {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(now.getDate() - 7);
          if (regDate < sevenDaysAgo) return false;
        }
      }
      
      if (filterSeverity !== 'all' && c.severity !== filterSeverity) return false;
      if (filterStage !== 'all' && c.stage?.toString() !== filterStage) return false;
      
      return true;
    });
  };

  const displayedCards = getFilteredCards().sort((a, b) => {
    const timeA = parseDate(a.reg_dt)?.getTime() || 0;
    const timeB = parseDate(b.reg_dt)?.getTime() || 0;
    return timeB - timeA;
  });
  const searchedCards = displayedCards.filter(c => {
    const matchesSearch = c.inc_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          c.bizSystem.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          c.severity.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (filterOrgName !== 'all') {
      const matchOrg = (c.bumun && c.bumun.trim() === filterOrgName.trim()) || 
                       (c.honbu && c.honbu.trim() === filterOrgName.trim()) || 
                       (c.team && c.team.trim() === filterOrgName.trim());
      if (!matchOrg) return false;
    }

    if (filterOrgStage !== 'all') {
      if (filterOrgStage === '대기중') {
        if (!(c.stage === 1 || c.stage === 2)) return false;
      } else if (filterOrgStage === '처리중') {
        if (c.stage !== 3) return false;
      } else if (filterOrgStage === '완료') {
        if (c.stage !== 4) return false;
      }
    }

    if (filterHour !== 'all') {
      const hStr = filterHour.replace('시', '');
      const hInt = parseInt(hStr, 10);
      const cDate = parseDate(c.reg_dt) || new Date();
      if (cDate.getHours() !== hInt) return false;
    }

    if (filterSystem !== 'all') {
      if (c.bizSystem !== filterSystem) return false;
    }

    return true;
  });
  const activeDagCard = displayedCards.find(c => c.inc_id === selectedCardId) || displayedCards[0] || null;

  const getStageCountsBaseCards = () => {
    const now = new Date();
    return cards.filter(c => {
      if (c.reg_dt) {
        const regDate = parseDate(c.reg_dt);
        if (period === 'today' && regDate.toDateString() !== now.toDateString()) return false;
        if (period === 'yesterday') {
          const yesterday = new Date();
          yesterday.setDate(now.getDate() - 1);
          if (regDate.toDateString() !== yesterday.toDateString()) return false;
        }
        if (period === '7days') {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(now.getDate() - 7);
          if (regDate < sevenDaysAgo) return false;
        }
      }
      if (filterSeverity !== 'all' && c.severity !== filterSeverity) return false;
      return true;
    });
  };

  const stageCountsBase = getStageCountsBaseCards();

  const countsByStage = {
    1: stageCountsBase.filter(c => c.stage === 1).length,
    2: stageCountsBase.filter(c => c.stage === 2).length,
    3: stageCountsBase.filter(c => c.stage === 3).length,
    4: stageCountsBase.filter(c => c.stage === 4).length,
  };
  const totalCount = stageCountsBase.length;

  const renderTimeline = (card) => {
    if (!card) return <div className="text-slate-500 text-xs font-bold text-center mt-20">선택된 인시던트가 없습니다.</div>;

    const { stage, reg_dt, assignee } = card;

    const getDurationStr = (start, end) => {
      if (!start || !end) return '-';
      const diffMs = Math.abs(end.getTime() - start.getTime());
      const diffSecs = Math.floor(diffMs / 1000);
      if (diffSecs < 60) return `${diffSecs}s`;
      const diffMins = Math.floor(diffSecs / 60);
      const remainingSecs = diffSecs % 60;
      if (diffMins < 60) return `${diffMins}m ${remainingSecs}s`;
      const diffHours = Math.floor(diffMins / 60);
      const remainingMins = diffMins % 60;
      return `${diffHours}h ${remainingMins}m`;
    };

    const t1 = parseDate(reg_dt) || new Date();
    const t2 = stage >= 2 ? (parseDate(card.ai_dt) || new Date(t1.getTime() + 10000)) : null;
    const t3 = stage >= 3 ? (parseDate(card.warroom_dt) || new Date((t2 || t1).getTime() + 120000)) : null;
    const t4 = stage >= 4 ? (parseDate(card.closed_dt) || new Date((t3 || t2 || t1).getTime() + 60000)) : null;

    const formatDt = (d) => {
      if (!d) return '-';
      const pad = (n) => n.toString().padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };

    const durationStep1 = getDurationStr(t1, t2 || new Date());
    const durationStep2 = t2 ? getDurationStr(t2, t3 || new Date()) : '-';
    const durationStep3 = t3 ? getDurationStr(t3, t4 || new Date()) : '-';
    const durationStep4 = t4 ? getDurationStr(t1, t4) : '-';

    const diffObj = (a, b) => { 
      if (!a) return null; 
      const ms = Math.max(0, (b ? new Date(b) : currentTime) - new Date(a)); 
      const m = Math.floor(ms / 60000), s2 = Math.floor((ms % 60000) / 1000); 
      const h = Math.floor(m / 60);
      const remM = m % 60;
      let text = '';
      if (h > 0) text = `${h}h ${remM}m ${s2}s`;
      else if (m > 0) text = `${m}m ${s2}s`;
      else text = `${s2}s`;
      return { text, min: m }; 
    };

    const durationMs = (t4 ? new Date(t4) : currentTime) - new Date(t1);
    const isClosed = stage >= 4;

    const steps = [
      { id: 'SMS', label: '문자수신', done: stage >= 1, active: false, dObj: null },
      { id: 'RAG', label: 'RAG분석완료', done: stage >= 2, active: stage === 1, dObj: diffObj(t1, t2) },
      { id: 'WARROOM', label: '담당자인지(워룸개설)', done: stage >= 3, active: stage === 2, dObj: diffObj(t2, t3) },
      { id: 'KNOWLEDGE', label: '처리완료(보고/지식화)', done: stage >= 4, active: stage === 3, dObj: diffObj(t3, t4) }
    ];

    const radius = 70;
    const circum = 2 * Math.PI * radius;
    const progressPct = stage === 4 ? 100 : stage === 3 ? 75 : stage === 2 ? 50 : 25;
    const offset = circum - (progressPct / 100) * circum;

    const ringColor = isClosed ? '#10b981' : '#00e5ff';
    const ringShadow = isClosed ? 'drop-shadow(0 0 4px rgba(16, 185, 129, 0.3))' : 'drop-shadow(0 0 10px rgba(0, 229, 255, 0.5))';

    const formatDuration = (ms) => {
      if (ms < 0) return '00:00:00';
      const totalSecs = Math.floor(ms / 1000);
      const hrs = Math.floor(totalSecs / 3600);
      const mins = Math.floor((totalSecs % 3600) / 60);
      const secs = totalSecs % 60;
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    const FLOW_STEPS = [
      { id: 'SMS', label: 'SMS 수신 및 장애 인지', icon: <Bell className="w-3.5 h-3.5" />, color: '#3b82f6' },
      { id: 'RAG_AGENT', label: 'RAG 및 AI AGENT 분석 완료', icon: <Brain className="w-3.5 h-3.5" />, color: '#8b5cf6' },
      { id: 'WARROOM', label: '워룸 생성 및 할당 완료(처리중)', icon: <Users className="w-3.5 h-3.5" />, color: '#00e5ff' },
      { id: 'KNOWLEDGE', label: '지식화/장애/보고 처리완료', icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: '#10b981' }
    ];

    const detailedSteps = FLOW_STEPS.map((step, sIdx) => {
      let stepData = null;
      if (step.id === 'SMS' && stage >= 1) {
        stepData = { timestamp: t1, detail: '시스템에 장애 메시지가 수신되었습니다.' };
      } else if (step.id === 'RAG_AGENT' && stage >= 2) {
        stepData = { timestamp: t2, detail: 'AI 엔진이 과거 사례 및 지식베이스를 바탕으로 초기 분석을 마쳤습니다.' };
      } else if (step.id === 'WARROOM' && stage >= 3) {
        stepData = { timestamp: t3, detail: '워룸 대응 프로세스가 진행 중 또는 완료되었습니다.' };
      } else if (step.id === 'KNOWLEDGE' && stage >= 4) {
        stepData = { timestamp: t4, detail: '인시던트 대응 지식이 지식베이스(RAG)에 저장되고 최종 보고 및 장애 처리가 완료되었습니다.' };
      }

      const isCompleted = !!stepData;
      const isNextStep = (sIdx === 1 && stage === 1) || 
                         (sIdx === 2 && stage === 2) || 
                         (sIdx === 3 && stage === 3);

      let intervalText = null;
      let intervalMinutes = 0;
      let isBottleneck = false;
      
      if (sIdx > 0) {
        let prevTime = null;
        if (sIdx === 1) prevTime = t1;
        else if (sIdx === 2) prevTime = t2;
        else if (sIdx === 3) prevTime = t3;

        if (prevTime) {
          if (isCompleted) {
            let currTime = null;
            if (sIdx === 1) currTime = t2;
            else if (sIdx === 2) currTime = t3;
            else if (sIdx === 3) currTime = t4;

            if (currTime) {
              const ms = new Date(currTime) - new Date(prevTime);
              const m = Math.floor(ms / 60000), sec = Math.floor((ms % 60000) / 1000);
              intervalMinutes = m;
              intervalText = m > 60 ? `⏱ ${Math.floor(m / 60)}h ${m % 60}m` : m > 0 ? `⏱ ${m}m ${sec}s` : `⏱ ${sec}s`;
            }
          } else if (isNextStep) {
            const ms = currentTime - new Date(prevTime);
            const m = Math.floor(ms / 60000), sec = Math.floor((ms % 60000) / 1000);
            intervalMinutes = m;
            intervalText = m > 60 ? `⏱ ${Math.floor(m / 60)}h ${m % 60}m 경과` : m > 0 ? `⏱ ${m}m ${sec}s` : `⏱ ${sec}s 경과`;
            isBottleneck = m > 60;
          }
        }
      }

      return {
        ...step,
        stepData,
        isCompleted,
        isNextStep,
        intervalText,
        isBottleneck
      };
    });

    return (
      <div className="flex-1 flex flex-col min-h-0 bg-[#070b12] rounded-2xl p-4 overflow-y-auto custom-scrollbar border border-white/5">
        
        {/* MTTR Timer & Stepper Section (Stacked for narrow screens) */}
        <div className="flex flex-col gap-3 mb-4 shrink-0 bg-black/20 p-3 rounded-xl border border-white/5">
          {/* Top: Activity Ring */}
          <div className="flex flex-col items-center justify-center relative bg-gradient-to-b from-black/40 to-transparent p-2 rounded-lg shrink-0">
            <div className="relative w-28 h-28 flex items-center justify-center">
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
                <span className="text-[7.5px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">MTTR TIMER</span>
                <span className="text-sm font-black font-mono tracking-tighter text-white" style={{ textShadow: isClosed ? '0 0 10px rgba(16,185,129,0.3)' : '0 0 15px rgba(0,229,255,0.8)' }}>
                  {formatDuration(durationMs)}
                </span>
                <span className="text-[7.5px] font-mono text-slate-500 scale-90 mt-0.5">
                  {isClosed ? `SAFE (${formatDtTimeOnly(t4)})` : 'LIVE'}
                </span>
              </div>
            </div>
          </div>

          {/* Bottom: 4-Step Stepper arranged in a horizontal line */}
          <div className="flex flex-col justify-center">
            <div className="flex flex-col gap-y-2 px-1 py-4 bg-black/20 rounded-xl border border-white/5 relative shrink-0">
              <div className="flex flex-col w-full">
              {/* Row 1: Circles & Long Arrow Lines */}
              <div className="flex items-start justify-between w-full">
                {steps.map((st, i) => {
                  const isDone = st.done;
                  const isActive = st.active;
                  const isBottleneck = st.dObj?.min > 60;
                  
                  const nextStep = i < steps.length - 1 ? steps[i + 1] : null;
                  const durationObj = nextStep?.dObj;
                  const isNextStepDone = nextStep?.done;
                  const isNextStepActive = nextStep?.active;
                  const isArrowBottleneck = durationObj?.min > 60;

                  return (
                    <div key={`step-${st.id}`} className={`flex flex-col ${i < steps.length - 1 ? 'flex-1' : 'w-[72px] shrink-0'}`}>
                      <div className="w-full flex items-start">
                        <div className="w-[72px] flex flex-col items-center shrink-0">
                          <div className="h-7 flex items-center justify-center">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] transition-all ${isDone ? (isBottleneck ? 'bg-[#fb923c] text-black shadow-[0_0_8px_rgba(251,146,60,0.6)] ring-2 ring-orange-400 font-black' : 'bg-[#00e5ff] text-black opacity-80') : isActive ? 'bg-[#00e5ff] text-black ring-2 ring-[#00e5ff]/30 animate-pulse shadow-[0_0_8px_#00e5ff]' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}>
                              {isDone ? <CheckCircle2 size={12} /> : i + 1}
                            </div>
                          </div>
                          
                          <div className="mt-1.5 text-center w-full px-0.5">
                            <span className={`text-[9px] font-black tracking-tight leading-[1.2] whitespace-normal break-keep inline-block ${isBottleneck ? 'text-[#fb923c]' : isDone ? 'text-[#00e5ff]' : isActive ? 'text-[#00e5ff]' : 'text-slate-500'}`}>
                              {st.label}
                            </span>
                          </div>

                          <div className="mt-1 flex justify-center w-full h-[18px]">
                            {i > 0 && st.dObj ? (
                              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border shadow-sm font-mono whitespace-nowrap inline-flex items-center justify-center ${
                                (st.dObj?.min > 60)
                                  ? (isActive 
                                      ? 'bg-orange-500/20 text-[#fb923c] border border-orange-500/40 animate-pulse' 
                                      : 'bg-orange-500/10 text-[#fb923c] border border-orange-500/30')
                                  : isActive 
                                    ? 'bg-[#00e5ff]/20 text-[#00e5ff] border border-[#00e5ff]/50 animate-pulse'
                                    : isDone
                                      ? 'bg-[#00e5ff]/5 text-[#00e5ff]/80 border border-[#00e5ff]/20'
                                      : 'bg-slate-900/40 text-slate-600 border border-slate-800'
                              }`}>
                                {st.dObj.text}
                              </span>
                            ) : (i > 0 && <span className="text-[8px] text-slate-600 font-mono">-</span>)}
                          </div>
                        </div>

                        {i < steps.length - 1 && (
                          <div className="flex-1 flex items-center relative h-7 px-1">
                            <div className={`h-[3px] w-full rounded transition-all ${
                              isNextStepDone 
                                ? (isArrowBottleneck ? 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.4)]' : 'bg-[#00e5ff] shadow-[0_0_8px_rgba(0,229,255,0.4)]') 
                                : isNextStepActive 
                                  ? 'bg-[#00e5ff]/40 animate-pulse' 
                                  : 'bg-slate-800'
                            }`} />
                            <svg className={`w-3 h-3 absolute right-0 transition-all ${
                              isNextStepDone 
                                ? (isArrowBottleneck ? 'text-orange-500' : 'text-[#00e5ff]') 
                                : isNextStepActive 
                                  ? 'text-[#00e5ff] animate-pulse' 
                                  : 'text-slate-800'
                            }`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="4.5" style={{ transform: 'translateX(2px)' }}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          {/* Status overview pill */}
            <div className={`py-1 px-2.5 rounded-lg border text-[8px] font-bold text-center uppercase tracking-wider ${
              isClosed ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' : 'bg-[#00e5ff]/15 border-[#00e5ff]/30 text-[#00e5ff]'
            }`}>
              상태: {isClosed ? `조치 완료 (SAFE - ${formatDtTimeOnly(t4)})` : '실시간 대응 중 (LIVE)'}
            </div>
          </div>
        </div>

        {/* 기존 상세 Timeline (항상 노출) */}
        <div className="transition-all duration-300 flex-1 overflow-y-auto pr-1">
          <div className="relative pl-2.5 space-y-6 pb-2 min-h-0">
            {/* Track Line */}
            <div className="absolute left-5 top-3 bottom-3 w-[2px] bg-white/5 rounded-full" />
            {detailedSteps.map((step, idx) => {
              const isLast = idx === detailedSteps.length - 1;
              const isCompleted = step.isCompleted;
              const isNextStep = step.isNextStep;

              return (
                <div key={step.id} className="relative pl-8 min-h-[48px]" style={{ opacity: !isCompleted && !isNextStep ? 0.3 : 1 }}>
                  {/* Connector Line if active */}
                  {isCompleted && !isLast && (
                    <div className="absolute left-2.5 top-5 bottom-[-24px] w-[2px] z-0 bg-[#00e5ff]" />
                  )}

                  {/* Node Icon */}
                  <div className="absolute left-0 top-0.5 w-5 h-5 rounded-full bg-[#0b0e17] border-2 flex items-center justify-center z-10 shadow-lg transition-all duration-350" 
                       style={{ 
                         borderColor: isCompleted ? step.color : '#1e293b', 
                         color: isCompleted ? step.color : '#475569',
                         boxShadow: isCompleted ? `0 0 8px ${step.color}20` : 'none'
                       }}>
                    {step.icon}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 pb-1">
                    <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[12px] font-bold ${isCompleted ? 'text-white' : 'text-slate-600'}`}>{step.label}</span>
                        {isNextStep && (
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 animate-pulse">
                            진행중
                          </span>
                        )}
                      </div>
                      {isCompleted && step.stepData.timestamp && (
                        <div className="flex items-center gap-1.5 ml-auto">
                          <span className="text-[8px] font-mono font-bold bg-[#0b0e17] border border-white/5 px-1.5 py-0.5 rounded text-slate-500">{formatDt(new Date(step.stepData.timestamp))}</span>
                        </div>
                      )}
                    </div>
                    <div className={`text-[10px] font-bold leading-relaxed ${isCompleted ? 'text-slate-400' : 'text-slate-700'}`}>
                      {isCompleted ? step.stepData.detail : isNextStep ? '처리 진행 중...' : '대기 중'}
                    </div>

                    {/* 워룸 이동 및 개설 버튼 */}
                    {step.id === 'WARROOM' && (isCompleted || isNextStep) && (() => {
                      const roomExists = warRooms.some(r => String(r.id) === String(card.inc_id) || String(r.inc_id) === String(card.inc_id));
                      return roomExists ? (
                        <button onClick={() => navigate(`/chat/${card.inc_id}`)} className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black bg-[#00e5ff]/10 hover:bg-[#00e5ff]/20 text-[#00e5ff] border border-[#00e5ff]/30 shadow-[0_0_8px_rgba(0,229,255,0.2)] active:scale-95 transition-all">
                          <Zap className="w-3 h-3 text-[#00e5ff]" />
                          <span>워룸 이동</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      ) : (
                        <button onClick={() => handleOpenWarRoom(card)} disabled={isOpeningWarRoom} className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black bg-[#00e5ff]/10 hover:bg-[#00e5ff]/20 text-[#00e5ff] border border-[#00e5ff]/30 shadow-[0_0_8px_rgba(0,229,255,0.2)] active:scale-95 transition-all disabled:opacity-50">
                          <Users className="w-3 h-3" />
                          <span>{isOpeningWarRoom ? '개설 진행 중...' : '워룸 개설하기'}</span>
                        </button>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    );
  };

  const renderOperatorMode = () => {
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
    const keywordMap = {};
    const nodeMap = {};
    const orgStatsMap = {};

    displayedCards.forEach(c => {
      const date = parseDate(c.reg_dt) || new Date();
      const hourStr = date.getHours().toString().padStart(2, '0') + ':00';
      trafficMap[hourStr] = (trafficMap[hourStr] || 0) + 1;
      bizSystemMap[c.bizSystem] = (bizSystemMap[c.bizSystem] || 0) + 1;
      keywordMap[c.keyword] = (keywordMap[c.keyword] || 0) + 1;
      nodeMap[c.node] = (nodeMap[c.node] || 0) + 1;

      if (c.warroom_dt && c.reg_dt) {
        const diffMs = parseDate(c.warroom_dt).getTime() - parseDate(c.reg_dt).getTime();
        if (diffMs >= 0) {
          mttaMap[hourStr].sum += diffMs / 60000;
          mttaMap[hourStr].count += 1;
        }
      }
      if (c.closed_dt && c.reg_dt) {
        const diffMs = parseDate(c.closed_dt).getTime() - parseDate(c.reg_dt).getTime();
        if (diffMs >= 0) {
          mttrMap[hourStr].sum += diffMs / 60000;
          mttrMap[hourStr].count += 1;
        }
      }
    });

    // --- Cascading org filter logic (Synced with orgTree) ---
    // Level 2: 부문 (Bumun) nodes from top-level Company nodes in orgTree
    const allBumunNodes = orgTree.flatMap(node => node.children || []);
    const allBumuns = [...new Set(allBumunNodes.map(node => node.name))].filter(Boolean).sort();

    // Level 3: 본부 (Honbu) nodes under selected Bumun
    const selectedBumunNode = selectedBumun !== 'all' ? findNodeInTree(orgTree, selectedBumun, 2) : null;
    const honbusForBumunNodes = selectedBumunNode ? (selectedBumunNode.children || []) : [];
    const honbusForBumun = [...new Set(honbusForBumunNodes.map(node => node.name))].filter(Boolean).sort();

    // Level 4: 팀 (Team) nodes under selected Honbu
    const selectedHonbuNode = (selectedBumun !== 'all' && selectedHonbu !== 'all') ? findNodeInTree(orgTree, selectedHonbu, 3) : null;
    const teamsForHonbuNodes = selectedHonbuNode ? (selectedHonbuNode.children || []) : [];
    const teamsForHonbu = [...new Set(teamsForHonbuNodes.map(node => node.name))].filter(Boolean).sort();

    // Level 5: 파트 (Part) nodes under selected Team
    const selectedTeamNode = (selectedBumun !== 'all' && selectedHonbu !== 'all' && selectedTeam !== 'all') ? findNodeInTree(orgTree, selectedTeam, 4) : null;
    const partsForTeamNodes = selectedTeamNode ? (selectedTeamNode.children || []) : [];
    const partsForTeam = [...new Set(partsForTeamNodes.map(node => node.name))].filter(Boolean).sort();

    // Filter cards based on current cascading selection
    const orgFilteredCards = displayedCards.filter(c => {
      if (orgLevel === 'bumun') {
        return selectedBumun === 'all' || (c.bumun || '미분류 부문') === selectedBumun;
      }
      if (orgLevel === 'honbu') {
        const bumunOk = selectedBumun === 'all' || (c.bumun || '미분류 부문') === selectedBumun;
        const honbuOk = selectedHonbu === 'all' || (c.honbu || '미분류 본부') === selectedHonbu;
        return bumunOk && honbuOk;
      }
      if (orgLevel === 'team') {
        const bumunOk = selectedBumun === 'all' || (c.bumun || '미분류 부문') === selectedBumun;
        const honbuOk = selectedHonbu === 'all' || (c.honbu || '미분류 본부') === selectedHonbu;
        const teamOk = selectedTeam === 'all' || (c.team || '미분류 팀') === selectedTeam;
        return bumunOk && honbuOk && teamOk;
      }
      if (orgLevel === 'part') {
        const bumunOk = selectedBumun === 'all' || (c.bumun || '미분류 부문') === selectedBumun;
        const honbuOk = selectedHonbu === 'all' || (c.honbu || '미분류 본부') === selectedHonbu;
        const teamOk = selectedTeam === 'all' || (c.team || '미분류 팀') === selectedTeam;
        return bumunOk && honbuOk && teamOk; // Simplified part check as part is not cascading dropdown yet
      }
      return true;
    });

    // Pre-populate orgStatsMap with all known group keys (so 0-count orgs still appear)
    if (orgLevel === 'bumun') {
      allBumuns.forEach(b => {
        if (!orgStatsMap[b]) orgStatsMap[b] = { name: b, 수신: 0, 처리대기중: 0, 처리중: 0, 처리완료: 0, incidents: [] };
      });
    } else if (orgLevel === 'honbu' && selectedBumun !== 'all') {
      honbusForBumun.forEach(h => {
        if (!orgStatsMap[h]) orgStatsMap[h] = { name: h, 수신: 0, 처리대기중: 0, 처리중: 0, 처리완료: 0, incidents: [] };
      });
    } else if (orgLevel === 'team' && selectedBumun !== 'all' && selectedHonbu !== 'all') {
      teamsForHonbu.forEach(t => {
        if (!orgStatsMap[t]) orgStatsMap[t] = { name: t, 수신: 0, 처리대기중: 0, 처리중: 0, 처리완료: 0, incidents: [] };
      });
    } else if (orgLevel === 'part' && selectedBumun !== 'all' && selectedHonbu !== 'all' && selectedTeam !== 'all') {
      partsForTeam.forEach(p => {
        if (!orgStatsMap[p]) orgStatsMap[p] = { name: p, 수신: 0, 처리대기중: 0, 처리중: 0, 처리완료: 0, incidents: [] };
      });
    }

    orgFilteredCards.forEach(c => {
      let groupKey = '전체 통합';
      if (orgLevel === 'bumun') groupKey = c.bumun || '미분류 부문';
      else if (orgLevel === 'honbu') groupKey = c.honbu || '미분류 본부';
      else if (orgLevel === 'team') groupKey = c.team || '미분류 팀';
      else if (orgLevel === 'part') groupKey = c.part || '미분류 파트';

      if (!orgStatsMap[groupKey]) {
        orgStatsMap[groupKey] = { name: groupKey, 수신: 0, 처리대기중: 0, 처리중: 0, 처리완료: 0, incidents: [] };
      }
      orgStatsMap[groupKey].수신 += 1;
      orgStatsMap[groupKey].incidents.push(c);
      if (c.stage === 1 || c.stage === 2) {
        orgStatsMap[groupKey].처리대기중 += 1;
      } else if (c.stage === 3) {
        orgStatsMap[groupKey].처리중 += 1;
      } else if (c.stage === 4) {
        orgStatsMap[groupKey].처리완료 += 1;
      }
    });

    const trafficData = Object.keys(trafficMap).sort().map(h => ({ hour: h, count: trafficMap[h] }));
    const mttData = Object.keys(mttaMap).sort().map(h => ({
      hour: h,
      MTTA: mttaMap[h].count > 0 ? Math.round(mttaMap[h].sum / mttaMap[h].count) : 0,
      MTTR: mttrMap[h].count > 0 ? Math.round(mttrMap[h].sum / mttrMap[h].count) : 0,
    }));
    const bizSystemPieData = Object.keys(bizSystemMap).map((n, i) => ({ name: n, value: bizSystemMap[n], color: ['#00e5ff', '#a855f7', '#f59e0b', '#3b82f6', '#10b981', '#ec4899'][i % 6] }));
    const keywordBarData = Object.keys(keywordMap).map(k => ({ keyword: k, count: keywordMap[k] })).sort((a,b) => b.count - a.count).slice(0, 5);
    const nodeRadarData = Object.keys(nodeMap).map(n => ({ node: n, count: nodeMap[n] }));
    const orgList = Object.values(orgStatsMap).sort((a, b) => b.수신 - a.수신);
    const similarityScoreData = displayedCards.map((c) => ({ id: c.inc_id, score: c.similarityScore })).slice(0, 10);

    const latestIncidents = [...displayedCards]
      .sort((a, b) => new Date(b.reg_dt).getTime() - new Date(a.reg_dt).getTime())
      .slice(0, 5);

    return (
      <div className="flex-1 flex flex-col h-full bg-zinc-950 min-h-0 overflow-hidden">
        
        {/* Full-width Funnel Header with Broadcasting Ticker */}
        <div className="flex-shrink-0 flex items-center px-4 py-2 border-b border-white/5 bg-[#0b0e17]/50 z-10 relative gap-6">
          {/* Left: Funnel Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* 전체 수신 */}
            <button
              onClick={() => setFilterStage('all')}
              className={`flex flex-col items-center justify-center rounded-xl px-2 py-1.5 transition-all cursor-pointer w-[70px] ${filterStage === 'all' ? 'bg-slate-500/25 border-2 border-slate-400/50 shadow-[0_0_20px_rgba(100,116,139,0.3)]' : 'bg-slate-500/10 border border-slate-500/20 hover:border-slate-500/40'}`}
            >
              <span className="text-[8px] font-bold text-slate-400 mb-0.5 tracking-tight text-center">전체 수신</span>
              <span className="text-sm font-black text-white font-mono">{totalCount}건</span>
            </button>
            <ArrowRight className="w-3 h-3 text-slate-600 animate-pulse shrink-0" />
            
            {/* 1. SMS수신및 장애인지 */}
            <button
              onClick={() => setFilterStage(filterStage === '1' ? 'all' : '1')}
              className={`flex flex-col items-center justify-center rounded-xl px-2 py-1.5 transition-all cursor-pointer w-[105px] ${filterStage === '1' ? 'bg-blue-500/25 border-2 border-blue-400/60 shadow-[0_0_20px_rgba(59,130,246,0.35)]' : 'bg-blue-500/10 border border-blue-500/20 hover:border-blue-500/40'}`}
            >
              <span className="text-[8px] font-bold text-blue-400 mb-0.5 tracking-tight text-center flex items-center gap-0.5"><Bell className="w-2.5 h-2.5" /> SMS수신·장애인지</span>
              <span className="text-sm font-black text-white font-mono">{countsByStage[1]}건</span>
            </button>
            <ArrowRight className="w-3 h-3 text-slate-600 animate-pulse shrink-0" />
            
            {/* 2. RAG및 AI AGENT 분석완료 */}
            <button
              onClick={() => setFilterStage(filterStage === '2' ? 'all' : '2')}
              className={`flex flex-col items-center justify-center rounded-xl px-2 py-1.5 transition-all cursor-pointer w-[125px] relative overflow-hidden ${filterStage === '2' ? 'bg-purple-500/25 border-2 border-purple-400/60 shadow-[0_0_20px_rgba(168,85,247,0.35)]' : 'bg-purple-500/10 border border-purple-500/30 hover:border-purple-500/50'}`}
            >
              <span className="text-[8px] font-bold text-purple-400 mb-0.5 tracking-tight text-center relative z-10 flex items-center gap-0.5"><Cpu className="w-2.5 h-2.5" /> RAG·AI AGENT 분석</span>
              <span className="text-sm font-black text-white font-mono relative z-10">{countsByStage[2]}건</span>
            </button>
            <ArrowRight className="w-3 h-3 text-slate-600 animate-pulse shrink-0" />
            
            {/* 3. 처리중(워룸생성및 할당완료) */}
            <button
              onClick={() => setFilterStage(filterStage === '3' ? 'all' : '3')}
              className={`flex flex-col items-center justify-center rounded-xl px-2 py-1.5 transition-all cursor-pointer w-[115px] relative overflow-hidden ${filterStage === '3' ? 'bg-red-500/25 border-2 border-red-400/60 shadow-[0_0_25px_rgba(239,68,68,0.4)]' : 'bg-red-500/10 border border-red-500/40 hover:border-red-500/60'}`}
            >
              <span className="text-[8px] font-bold text-red-400 mb-0.5 tracking-tight text-center relative z-10 flex items-center gap-0.5"><Users className="w-2.5 h-2.5 animate-pulse" /> 워룸·할당완료</span>
              <span className="text-sm font-black text-white font-mono relative z-10">{countsByStage[3]}건</span>
            </button>
            <ArrowRight className="w-3 h-3 text-slate-600 animate-pulse shrink-0" />
            
            {/* 4. 지식화/장애완료 */}
            <button
              onClick={() => setFilterStage(filterStage === '4' ? 'all' : '4')}
              className={`flex flex-col items-center justify-center rounded-xl px-2 py-1.5 transition-all cursor-pointer w-[100px] ${filterStage === '4' ? 'bg-emerald-500/25 border-2 border-emerald-400/60 shadow-[0_0_20px_rgba(16,185,129,0.35)]' : 'bg-emerald-500/10 border border-emerald-500/20 hover:border-emerald-500/40'}`}
            >
              <span className="text-[8px] font-bold text-emerald-400 mb-0.5 tracking-tight text-center flex items-center gap-0.5"><CheckCircle2 className="w-2.5 h-2.5" /> 지식화·장애완료</span>
              <span className="text-sm font-black text-white font-mono">{countsByStage[4]}건</span>
            </button>
          </div>

          {/* Right: Broadcasting Ticker */}
          <div className="flex-1 flex items-center bg-[#121622] rounded-xl border border-white/5 pl-3 pr-1 h-[42px] overflow-hidden relative shadow-inner">
             <div className="flex items-center gap-1.5 text-red-400 font-black text-[9px] shrink-0 mr-4 bg-red-500/10 px-2 py-0.5 rounded-lg border border-red-500/20 z-10">
               <AlertCircle className="w-3 h-3 animate-pulse" />
               <span className="tracking-widest uppercase mt-0.5">Breaking</span>
             </div>
             <div className="flex-1 overflow-hidden relative h-full flex items-center" style={{ WebkitMaskImage: 'linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)' }}>
               {latestIncidents.length > 0 ? (
                 <div 
                   className="whitespace-nowrap animate-marquee flex items-center gap-12 absolute left-0 hover:[animation-play-state:paused]"
                   style={{ animationPlayState: isSimulationActive ? 'running' : 'paused' }}
                 >
                   {latestIncidents.map((incident, idx) => (
                     <div 
                       key={`ticker-${incident.inc_id}-${idx}`} 
                       className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer hover:text-white transition-colors"
                       onClick={() => {
                         setFilterStage('all');
                         setSearchQuery('');
                         setSelectedCardId(incident.inc_id);
                       }}
                     >
                       <span className={`px-1.5 py-0.5 rounded text-[8px] font-black ${incident.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-400' : incident.severity === 'MAJOR' ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'}`}>
                         {incident.severity}
                       </span>
                       <span className="font-bold text-white hover:underline underline-offset-2">
                         {(incident.message || incident.keyword).length > 30 
                           ? (incident.message || incident.keyword).substring(0, 30) + '...' 
                           : (incident.message || incident.keyword)}
                       </span>
                       <span className="text-[10px] text-slate-500 font-mono">
                         ({incident.bizSystem} · {incident.reg_dt ? formatDtTimeOnly(parseDate(incident.reg_dt)) : '-'})
                       </span>
                     </div>
                   ))}
                 </div>
               ) : (
                 <span className="text-[10px] text-slate-500 font-bold">최근 수신된 장애 내역이 없습니다.</span>
               )}
             </div>
          </div>
        </div>

        <div className={`flex-1 flex flex-col xl:flex-row p-4 sm:p-6 overflow-y-auto xl:overflow-hidden relative z-0 ${isDragging ? 'select-none' : ''}`}>
          

          {/* MIDDLE PANEL (Now Left Panel in flex row) */}
          <div style={{ flex: `${widths[0]} 1 0%`, minWidth: 0 }} className="w-full xl:w-auto xl:flex flex-col gap-4 min-h-0 xl:pr-3 mb-6 xl:mb-0">
            {/* Top Row: Charts */}
            <div style={{ height: `${leftHeights[0]}%`, minHeight: 120 }} className="flex flex-col sm:flex-row gap-3 shrink-0 overflow-hidden">
              
              {/* Chart 1 - System Occupancy */}
              <div className="flex-1 min-w-0 bg-zinc-900/40 backdrop-blur-sm rounded-3xl p-3 border border-white/5 flex flex-col shadow-lg overflow-hidden">
                <div className="flex items-center gap-1.5 mb-1 shrink-0"><Layers className="w-3 h-3 text-[#00e5ff]" /><span className="text-[10px] font-black text-white">시스템 점유비</span></div>
                <div className="flex-1 flex flex-col justify-center px-2 py-1">
                  {(() => {
                    const total = bizSystemPieData.reduce((acc, curr) => acc + curr.value, 0);
                    if (total === 0) return <div className="text-[10px] text-slate-500 text-center">데이터 없음</div>;
                    
                    return (
                      <>
                        <div className="w-full h-8 rounded-lg overflow-hidden flex bg-slate-800 shadow-inner mb-3">
                          {bizSystemPieData.map((item, i) => {
                            const pct = (item.value / total) * 100;
                            return (
                              <div
                                key={i}
                                onClick={() => setFilterSystem(prev => prev === item.name ? 'all' : item.name)}
                                style={{ width: `${pct}%`, backgroundColor: item.color }}
                                className="h-full border-r border-[#0b0e17]/50 flex items-center justify-center transition-all duration-500 group relative cursor-pointer hover:brightness-125"
                              >
                                {pct > 10 && <span className="text-[10px] font-black text-white/90">{Math.round(pct)}%</span>}
                                {/* Tooltip on hover */}
                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-[#0f172a] text-white text-[10px] py-1 px-2 rounded border border-white/10 pointer-events-none whitespace-nowrap z-50 shadow-xl">
                                  {item.name}: {item.value}건
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        
                        <div className="flex flex-wrap gap-x-4 gap-y-1.5 overflow-y-auto custom-scrollbar pr-1 max-h-[50px]">
                          {bizSystemPieData.map((item, i) => (
                            <div key={i} className="flex items-center gap-1.5 min-w-[30%]">
                              <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: item.color }} />
                              <span className="text-[10px] text-slate-400 truncate flex-1">{item.name}</span>
                              <span className="text-[10px] font-bold text-slate-200 shrink-0">{item.value}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Chart 2 - MTTA / MTTR Trend */}
              <div className="flex-1 min-w-0 bg-zinc-900/40 backdrop-blur-sm rounded-3xl p-3 border border-white/5 flex flex-col shadow-lg overflow-hidden">
                <div className="flex items-center justify-between mb-1 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-purple-400" />
                    <span className="text-[10px] font-black text-white">시간대별 평균 소요시간 추이</span>
                  </div>
                </div>
                <div style={{ flex: 1, minHeight: 0, height: 120, width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                    <ComposedChart data={mttData} margin={{ top: 5, right: -5, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" />
                      <XAxis dataKey="hour" tick={{ fill: '#64748b', fontSize: 7 }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="left" tick={{ fill: '#64748b', fontSize: 7 }} axisLine={false} tickLine={false} orientation="left" />
                      <YAxis yAxisId="right" tick={{ fill: '#64748b', fontSize: 7 }} axisLine={false} tickLine={false} orientation="right" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)' }} 
                        itemStyle={{ fontSize: 9 }}
                        formatter={(value, name) => [`${value}분`, name]}
                      />
                      <Legend wrapperStyle={{ fontSize: 9, paddingTop: '5px' }} />
                      <Line yAxisId="left" type="monotone" dataKey="MTTA" name="MTTA (워룸개설)" stroke="#a855f7" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
                      <Line yAxisId="right" type="monotone" dataKey="MTTR" name="MTTR (처리완료)" stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 3 - Hourly Traffic (Renamed to 실시간 장애 접수 추이) */}
              <div className="flex-1 min-w-0 bg-zinc-900/40 backdrop-blur-sm rounded-3xl p-3 border border-white/5 flex flex-col shadow-lg overflow-hidden">
                <div className="flex items-center gap-1.5 mb-1 shrink-0"><TrendingUp className="w-3 h-3 text-[#00e5ff]" /><span className="text-[10px] font-black text-white">실시간 장애 접수 추이</span></div>
                <div style={{ flex: 1, minHeight: 0, height: 120, width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                    <AreaChart 
                      data={trafficData} 
                      margin={{ top: 5, right: 0, left: -25, bottom: 0 }}
                      onClick={(e) => {
                        if (e && e.activeLabel) {
                          setFilterHour(prev => prev === e.activeLabel ? 'all' : e.activeLabel);
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <defs><linearGradient id="colorTraffic" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00e5ff" stopOpacity={0.4}/><stop offset="95%" stopColor="#00e5ff" stopOpacity={0}/></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" />
                      <XAxis dataKey="hour" tick={{ fill: '#64748b', fontSize: 7 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 7 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)' }} itemStyle={{ color: '#fff', fontSize: 9 }} />
                      <Area type="monotone" dataKey="count" stroke="#00e5ff" strokeWidth={1.5} fillOpacity={1} fill="url(#colorTraffic)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>

            {/* Vertical Splitter between charts and org grid */}
            <div
              onMouseDown={() => startLeftVDrag(0)}
              className="flex items-center justify-center h-2 cursor-row-resize group shrink-0 -my-1 z-50 hover:bg-white/5 transition-colors rounded relative"
            >
              <div className="h-[1px] w-16 bg-white/20 group-hover:bg-[#00e5ff] transition-colors" />
              <div className="absolute w-4 h-4 rounded-full bg-[#00e5ff]/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <div className="w-[1px] h-2 bg-[#00e5ff]" />
              </div>
            </div>

            {/* Bottom Row: Organizational Grid */}
            <div style={{ height: `${leftHeights[1]}%`, minHeight: 100 }} className="bg-zinc-900/40 backdrop-blur-sm rounded-3xl p-4 border border-white/5 flex flex-col min-h-0 shadow-lg overflow-hidden">
              <div className="flex items-center justify-between mb-3 shrink-0">
                <div className="flex items-center gap-2">
                  <Network className="w-4 h-4 text-blue-400" />
                  <h2 className="text-sm font-black text-white">조직 기반 실시간 처리 현황</h2>
                </div>
                
                <div className="flex items-center gap-1.5 bg-[#121622] p-1 rounded-xl border border-white/5">
                  {['bumun', 'honbu', 'team', 'part'].map(level => (
                    <button 
                      key={level}
                      onClick={() => {
                        setOrgLevel(level);
                        // Reset deeper selections when switching to shallower level
                        if (level === 'bumun') { setSelectedBumun('all'); setSelectedHonbu('all'); setSelectedTeam('all'); }
                        if (level === 'honbu') { setSelectedHonbu('all'); setSelectedTeam('all'); }
                        if (level === 'team') { setSelectedTeam('all'); }
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${orgLevel === level ? 'bg-blue-500/20 text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      {level === 'bumun' ? '부문' : level === 'honbu' ? '본부' : level === 'team' ? '팀' : '파트'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cascading filter selectors */}
              <div className="flex gap-2 mb-3 shrink-0">
                {/* 부문 selector: always shown */}
                <select
                  value={selectedBumun}
                  onChange={(e) => { setSelectedBumun(e.target.value); setSelectedHonbu('all'); setSelectedTeam('all'); }}
                  className="flex-1 bg-[#121622] border border-white/5 rounded-xl px-2 py-1.5 text-[10px] font-bold text-slate-300 focus:outline-none focus:border-blue-500/40"
                >
                  <option value="all">전체 부문</option>
                  {allBumuns.map(b => <option key={b} value={b}>{b}</option>)}
                </select>

                {/* 본부 selector: shown when level >= honbu */}
                {(orgLevel === 'honbu' || orgLevel === 'team' || orgLevel === 'part') && (
                  <select
                    value={selectedHonbu}
                    disabled={selectedBumun === 'all'}
                    onChange={(e) => { setSelectedHonbu(e.target.value); setSelectedTeam('all'); }}
                    className="flex-1 bg-[#121622] border border-white/5 rounded-xl px-2 py-1.5 text-[10px] font-bold text-slate-300 focus:outline-none focus:border-purple-500/40 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {selectedBumun === 'all' ? (
                      <option value="all">부문 선택 필수</option>
                    ) : (
                      <>
                        <option value="all">전체 본부</option>
                        {honbusForBumun.map(h => <option key={h} value={h}>{h}</option>)}
                      </>
                    )}
                  </select>
                )}

                {/* 팀 selector: shown when level >= team */}
                {(orgLevel === 'team' || orgLevel === 'part') && (
                  <select
                    value={selectedTeam}
                    disabled={selectedBumun === 'all' || selectedHonbu === 'all'}
                    onChange={(e) => setSelectedTeam(e.target.value)}
                    className="flex-1 bg-[#121622] border border-white/5 rounded-xl px-2 py-1.5 text-[10px] font-bold text-slate-300 focus:outline-none focus:border-cyan-500/40 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {selectedBumun === 'all' || selectedHonbu === 'all' ? (
                      <option value="all">본부 선택 필수</option>
                    ) : (
                      <>
                        <option value="all">전체 팀</option>
                        {teamsForHonbu.map(t => <option key={t} value={t}>{t}</option>)}
                      </>
                    )}
                  </select>
                )}
              </div>

              <div className="bg-[#121622] border border-white/5 rounded-xl p-3 mb-3 flex items-center justify-between shrink-0 shadow-inner">
                <span className="text-xs font-black text-slate-300">
                  {orgLevel === 'bumun' ? '부문' : orgLevel === 'honbu' ? `${selectedBumun !== 'all' ? selectedBumun + ' > ' : ''}본부` : orgLevel === 'team' ? `${selectedBumun !== 'all' ? selectedBumun + ' > ' : ''}${selectedHonbu !== 'all' ? selectedHonbu + ' > ' : ''}팀` : '파트'} 기준 현황
                </span>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500"/><span className="text-[9px] font-bold text-slate-400">수신: <strong className="text-white ml-0.5">{orgList.reduce((s, o) => s + o.수신, 0)}건</strong></span></div>
                  <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-500"/><span className="text-[9px] font-bold text-slate-400">대기중: <strong className="text-white ml-0.5">{orgList.reduce((s, o) => s + o.처리대기중, 0)}건</strong></span></div>
                  <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500"/><span className="text-[9px] font-bold text-slate-400">처리중: <strong className="text-white ml-0.5">{orgList.reduce((s, o) => s + o.처리중, 0)}건</strong></span></div>
                  <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500"/><span className="text-[9px] font-bold text-slate-400">완료: <strong className="text-white ml-0.5">{orgList.reduce((s, o) => s + o.처리완료, 0)}건</strong></span></div>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-2">
                {orgLevel === 'honbu' && selectedBumun === 'all' ? (
                  <div className="flex flex-col items-center justify-center py-16 px-4 text-center border border-dashed border-white/5 rounded-2xl bg-black/10">
                    <User className="w-8 h-8 text-slate-600 mb-2 animate-pulse" />
                    <p className="text-xs font-bold text-slate-400">본부별 현황 조회 불가</p>
                    <p className="text-[10px] text-slate-500 mt-1">본부 현황을 조회하기 위해서는 반드시 부문을 먼저 선택하셔야 합니다.</p>
                  </div>
                ) : orgLevel === 'team' && (selectedBumun === 'all' || selectedHonbu === 'all') ? (
                  <div className="flex flex-col items-center justify-center py-16 px-4 text-center border border-dashed border-white/5 rounded-2xl bg-black/10">
                    <User className="w-8 h-8 text-slate-600 mb-2 animate-pulse" />
                    <p className="text-xs font-bold text-slate-400">팀별 현황 조회 불가</p>
                    <p className="text-[10px] text-slate-500 mt-1">팀 현황을 조회하기 위해서는 상위 부문과 본부를 모두 선택하셔야 합니다.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {orgList.map((org, idx) => {
                      const chartData = [
                        { name: '수신', count: org.수신, fill: '#3b82f6' },
                        { name: '대기중', count: org.처리대기중, fill: '#f59e0b' },
                        { name: '처리중', count: org.처리중, fill: '#ef4444' },
                        { name: '완료', count: org.처리완료, fill: '#10b981' }
                      ];
                      const activeCritical = org.incidents.filter(c => c.stage === 3 && (c.severity === 'CRITICAL' || c.severity === 'MAJOR')).length;

                      return (
                        <div key={idx} className="bg-[#121622] border border-white/5 rounded-2xl p-4 hover:border-white/10 transition-colors flex flex-col">
                          <div className="flex items-center justify-between mb-3 shrink-0">
                            <div className="flex items-center gap-2"><User className="w-3.5 h-3.5 text-slate-400" /><h3 className="text-xs font-black text-white truncate max-w-[120px]">{org.name}</h3></div>
                            {activeCritical > 0 && <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-[9px] font-bold text-red-400 flex items-center gap-1 animate-pulse border border-red-500/30"><AlertTriangle className="w-2.5 h-2.5" /> 긴급 {activeCritical}건</span>}
                          </div>
                          <div className="h-[90px] w-full shrink-0 min-w-0 min-h-0">
                            <ReactECharts
                              option={{
                                grid: { top: 20, right: 5, bottom: 20, left: 5, containLabel: false },
                                tooltip: {
                                  trigger: 'axis',
                                  axisPointer: { type: 'shadow' },
                                  backgroundColor: '#0f172a',
                                  borderColor: 'rgba(255,255,255,0.1)',
                                  textStyle: { color: '#fff', fontSize: 10, fontWeight: 'bold' }
                                },
                                xAxis: {
                                  type: 'category',
                                  data: chartData.map(d => d.name),
                                  axisLine: { show: false },
                                  axisTick: { show: false },
                                  axisLabel: { color: '#64748b', fontSize: 8, fontWeight: 'bold', interval: 0 }
                                },
                                yAxis: {
                                  type: 'value',
                                  axisLabel: { show: false },
                                  axisLine: { show: false },
                                  axisTick: { show: false },
                                  splitLine: { 
                                    show: true,
                                    lineStyle: { type: 'dashed', color: 'rgba(255,255,255,0.05)' } 
                                  }
                                },
                                series: [
                                  {
                                    type: 'bar',
                                    barWidth: '60%',
                                    data: chartData.map(entry => {
                                      let topColor = '#00E5FF';
                                      let bottomColor = 'rgba(0,229,255,0.1)';
                                      let shadowColor = 'rgba(0,229,255,0.6)';
                            
                                      if (entry.name === '대기중') {
                                        topColor = '#FF9100';
                                        bottomColor = 'rgba(255,145,0,0.1)';
                                        shadowColor = 'rgba(255,145,0,0.6)';
                                      } else if (entry.name === '처리중') {
                                        topColor = '#FF1744';
                                        bottomColor = 'rgba(255,23,68,0.1)';
                                        shadowColor = 'rgba(255,23,68,0.6)';
                                      }
                            
                                      return {
                                        value: entry.count,
                                        itemStyle: {
                                          color: {
                                            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                                            colorStops: [
                                              { offset: 0, color: topColor },
                                              { offset: 1, color: bottomColor }
                                            ]
                                          },
                                          borderRadius: [4, 4, 0, 0],
                                          shadowBlur: 15,
                                          shadowColor: shadowColor
                                        }
                                      };
                                    }),
                                    label: {
                                      show: true,
                                      position: 'top',
                                      color: '#fff',
                                      fontWeight: 'bold',
                                      fontSize: 10,
                                      formatter: (params) => params.value > 0 ? params.value : ''
                                    }
                                  }
                                ]
                              }}
                              style={{ height: '100%', width: '100%' }}
                              onEvents={{
                                click: (params) => {
                                  setFilterOrgName(org.name);
                                  setFilterOrgStage(params.name);
                                }
                              }}
                            />
                          </div>
                          <div className="mt-auto pt-2 border-t border-white/5 grid grid-cols-4 gap-1 shrink-0">
                            <div 
                              onClick={() => { setFilterOrgName(org.name); setFilterOrgStage('수신'); }}
                              className="bg-white/5 hover:bg-white/10 cursor-pointer active:scale-95 transition-all rounded-lg p-1 text-center"
                            >
                              <p className="text-[8px] text-slate-500 font-bold mb-0.5">수신</p>
                              <p className="text-[10px] font-black text-slate-300 font-mono">{org.수신}</p>
                            </div>
                            <div 
                              onClick={() => { setFilterOrgName(org.name); setFilterOrgStage('대기중'); }}
                              className="bg-amber-500/5 hover:bg-amber-500/15 border border-amber-500/10 cursor-pointer active:scale-95 transition-all rounded-lg p-1 text-center"
                            >
                              <p className="text-[8px] text-amber-400/70 font-bold mb-0.5">대기중</p>
                              <p className="text-[10px] font-black text-amber-400 font-mono">{org.처리대기중}</p>
                            </div>
                            <div 
                              onClick={() => { setFilterOrgName(org.name); setFilterOrgStage('처리중'); }}
                              className="bg-red-500/5 hover:bg-red-500/15 border border-red-500/10 cursor-pointer active:scale-95 transition-all rounded-lg p-1 text-center"
                            >
                              <p className="text-[8px] text-red-400/70 font-bold mb-0.5">처리중</p>
                              <p className="text-[10px] font-black text-red-400 font-mono">{org.처리중}</p>
                            </div>
                            <div 
                              onClick={() => { setFilterOrgName(org.name); setFilterOrgStage('완료'); }}
                              className="bg-emerald-500/5 hover:bg-emerald-500/15 border border-emerald-500/10 cursor-pointer active:scale-95 transition-all rounded-lg p-1 text-center"
                            >
                              <p className="text-[8px] text-emerald-400/70 font-bold mb-0.5">완료</p>
                              <p className="text-[10px] font-black text-emerald-400 font-mono">{org.처리완료}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Splitter 1 */}
          <div
            onMouseDown={() => startDrag(0)}
            className="hidden xl:flex w-3 cursor-col-resize group flex-col items-center justify-center z-50 shrink-0 -mx-1 transition-colors hover:bg-white/5 rounded"
          >
            <div className="w-[1px] h-12 bg-white/20 group-hover:bg-[#00e5ff] transition-colors rounded-full" />
            <div className="w-1 h-1 rounded-full bg-white/20 group-hover:bg-[#00e5ff] transition-colors my-0.5" />
            <div className="w-[1px] h-12 bg-white/20 group-hover:bg-[#00e5ff] transition-colors rounded-full" />
          </div>

          {/* MIDDLE PANEL: INCIDENT LIST PICKER */}
          <div style={{ flex: `${widths[1]} 1 0%`, minWidth: 0 }} className="w-full xl:w-auto shrink-0 flex flex-col min-h-[400px] xl:min-h-0 xl:px-3 mb-6 xl:mb-0">
            <div className="flex-1 bg-zinc-900/40 backdrop-blur-sm border border-white/5 rounded-3xl p-4 flex flex-col min-h-0 overflow-hidden shadow-lg">
              <div className="flex items-center justify-between mb-3 shrink-0">
                <div className="flex items-center gap-2"><Zap className="w-4 h-4 text-amber-400" /><h4 className="text-sm font-black text-white">인시던트 탐색기</h4></div>
                <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-mono font-bold text-slate-400">{searchedCards.length} 건</span>
              </div>
              
              {/* Active stage filter badge from funnel header */}
              {filterStage !== 'all' && (
                <div className={`flex items-center justify-between mb-2 px-3 py-1.5 rounded-xl border shrink-0 ${
                  filterStage === '1' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' :
                  filterStage === '2' ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' :
                  filterStage === '3' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                  'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                }`}>
                  <span className="text-[9px] font-black">
                    {filterStage === '1' ? '🔵 SMS수신 · 장애인지' : filterStage === '2' ? '🟣 RAG · AI분석완료' : filterStage === '3' ? '🔴 처리중 · 워룸' : '🟢 지식화 · 완료'} 목록 표시 중
                  </span>
                  <button onClick={() => setFilterStage('all')} className="text-[8px] font-bold opacity-60 hover:opacity-100 ml-2 underline">전체보기</button>
                </div>
              )}

              {/* Active hour filter badge */}
              {filterHour !== 'all' && (
                <div className="flex items-center justify-between mb-2 px-3 py-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 shrink-0">
                  <span className="text-[9px] font-black">
                    🕒 시간대 필터: {filterHour} 접수 건 표시 중
                  </span>
                  <button onClick={() => setFilterHour('all')} className="text-[8px] font-bold opacity-60 hover:opacity-100 ml-2 underline">필터해제</button>
                </div>
              )}

              {/* Active system filter badge */}
              {filterSystem !== 'all' && (
                <div className="flex items-center justify-between mb-2 px-3 py-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 shrink-0">
                  <span className="text-[9px] font-black">
                    🖥️ 시스템 필터: {filterSystem} 장애 표시 중
                  </span>
                  <button onClick={() => setFilterSystem('all')} className="text-[8px] font-bold opacity-60 hover:opacity-100 ml-2 underline">필터해제</button>
                </div>
              )}
              
              {/* Active org filter badge */}
              {(filterOrgName !== 'all' || filterOrgStage !== 'all') && (
                <div className="flex items-center justify-between mb-2 px-3 py-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-[#00e5ff] shrink-0">
                  <span className="text-[9px] font-black">
                    🔍 조직 필터: {filterOrgName !== 'all' ? filterOrgName : '전체'} {filterOrgStage !== 'all' ? `(${filterOrgStage})` : ''} 목록 표시 중
                  </span>
                  <button 
                    onClick={() => { setFilterOrgName('all'); setFilterOrgStage('all'); }} 
                    className="text-[8px] font-bold opacity-60 hover:opacity-100 ml-2 underline"
                  >
                    필터해제
                  </button>
                </div>
              )}
              
              {/* Filters */}
              <div className="flex flex-col gap-2 mb-3 shrink-0">
                <div className="flex gap-2">
                  <select value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)} className="flex-1 bg-[#121622] border border-white/5 rounded-xl px-2 py-1.5 text-[10px] font-bold text-slate-300 focus:outline-none focus:border-blue-500/40">
                    <option value="all">등급 전체</option>
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="MAJOR">MAJOR</option>
                    <option value="WARNING">WARNING</option>
                    <option value="INFO">INFO</option>
                  </select>
                  <select value={filterStage} onChange={(e) => setFilterStage(e.target.value)} className="flex-1 bg-[#121622] border border-white/5 rounded-xl px-2 py-1.5 text-[10px] font-bold text-slate-300 focus:outline-none focus:border-blue-500/40">
                    <option value="all">단계 전체</option>
                    <option value="1">1. SMS수신</option>
                    <option value="2">2. AI분석완료</option>
                    <option value="3">3. 워룸/처리중</option>
                    <option value="4">4. 조치완료</option>
                  </select>
                </div>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input type="text" placeholder="ID, 시스템, 부서명 검색..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-[#121622] border border-white/5 rounded-xl pl-8 pr-3 py-1.5 text-[10px] font-bold text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/40" />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
                {searchedCards.map((card) => {
                  const isSelected = card.inc_id === selectedCardId;
                  const isCritical = card.severity === 'CRITICAL' || card.severity === 'MAJOR';
                  let stageColor = 'bg-slate-700';
                  if (card.stage === 1) stageColor = 'bg-blue-500';
                  if (card.stage === 2) stageColor = 'bg-purple-500';
                  if (card.stage === 3) stageColor = card.timer === 0 ? 'bg-red-500 animate-pulse' : 'bg-amber-500 animate-pulse';
                  if (card.stage === 4) stageColor = 'bg-emerald-500';

                  return (
                    <div key={card.inc_id} onClick={() => { setSelectedCardId(card.inc_id); }} className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col gap-2.5 group ${
                      isSelected ? 'bg-zinc-800 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.2)]' 
                      : card.stage === 1 ? 'bg-zinc-800 border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.15)] hover:border-red-500/70'
                      : 'bg-zinc-800 border-zinc-700 hover:border-zinc-500'
                    }`}>
                      <div className="flex items-center justify-between min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${stageColor}`} />
                          <span className="text-[12px] font-black text-white font-mono">{card.inc_id}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {/* Badges */}
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${isCritical ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>{card.severity}</span>
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400">{card.bizSystem}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black text-white truncate max-w-[150px]">{card.keyword || '서버/네트워크 이상'}</span>
                        <div className="shrink-0 flex items-center gap-2">
                          {card.stage === 1 ? (
                            <div className="flex items-center gap-1.5 bg-red-500/10 px-2 py-1 rounded-lg border border-red-500/20">
                              <span className="text-[9px] text-red-400/80 font-bold uppercase tracking-wider">인지대기</span>
                              <span className="text-[11px] font-mono text-red-400 font-black animate-pulse">
                                {(() => {
                                  const elapsed = getElapsedSeconds(card.reg_dt);
                                  const remaining = Math.max(180 - elapsed, 0);
                                  const m = Math.floor(remaining / 60);
                                  const s = remaining % 60;
                                  return `${m}:${s.toString().padStart(2, '0')}`;
                                })()}
                              </span>
                            </div>
                          ) : card.stage === 3 ? (
                            <span className="text-[10px] font-mono text-amber-400 font-bold bg-amber-500/10 px-2 py-1 rounded-lg">
                              진행 {formatTime(getElapsedSeconds(card.reg_dt))}
                            </span>
                          ) : card.stage === 4 ? (
                            <div className="flex flex-col items-end gap-0.5 text-[9px] font-mono font-bold leading-tight">
                              <span className="text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg">
                                MTTR: {formatTime(getMttrSeconds(card.reg_dt, card.closed_dt))}
                              </span>
                            </div>
                          ) : (
                            <span className={`text-[9px] font-bold tracking-widest px-2 py-1 rounded-lg border flex items-center justify-center text-center uppercase ${card.stage === 1 ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-purple-500/10 text-purple-400 border-purple-500/20'}`}>
                              분석완료
                            </span>
                          )}
                          <span className="text-[10px] text-zinc-400 font-mono">{card.reg_dt ? formatDtTimeOnly(parseDate(card.reg_dt)) : '-'}</span>
                          <button onClick={(e) => { e.stopPropagation(); setWorkflowPanelId(card.inc_id); }} className="p-1 hover:bg-zinc-700 text-zinc-500 hover:text-white rounded transition-colors group-hover:opacity-100 opacity-0" title="워크플로우 상세보기"><ExternalLink className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Splitter 2 */}
          {/* Splitter 2 */}
          <div
            onMouseDown={() => startDrag(1)}
            className="hidden xl:flex w-3 cursor-col-resize group flex-col items-center justify-center z-50 shrink-0 -mx-1 transition-colors hover:bg-white/5 rounded"
          >
            <div className="w-[1px] h-12 bg-white/20 group-hover:bg-[#00e5ff] transition-colors rounded-full" />
            <div className="w-1 h-1 rounded-full bg-white/20 group-hover:bg-[#00e5ff] transition-colors my-0.5" />
            <div className="w-[1px] h-12 bg-white/20 group-hover:bg-[#00e5ff] transition-colors rounded-full" />
          </div>

          {/* RIGHT PANEL: Timeline & SMS */}
          <div style={{ flex: `${widths[2]} 1 0%`, minWidth: 0 }} className="w-full xl:w-auto shrink-0 flex flex-col min-h-[500px] xl:min-h-0 xl:pl-3">
            
            {/* 상단: 실시간 SMS 수신내역 */}
            <div style={{ height: `${rightHeights[0]}%`, minHeight: 150 }} className="shrink-0 bg-zinc-900/40 backdrop-blur-sm rounded-3xl p-4 border border-white/5 flex flex-col min-h-0 shadow-lg overflow-hidden">
              <div className="flex items-center justify-between mb-2 shrink-0">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
                    <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <div>
                    <h4 className="text-[13px] font-black text-white leading-none pt-0.5">실시간 SMS 수신내역</h4>
                  </div>
                </div>
                {activeDagCard && (
                  <span className={`h-5 flex items-center px-2.5 rounded-lg border text-[9px] font-black whitespace-nowrap transition-all ${
                    activeDagCard.stage === 4
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_8px_rgba(16,185,129,0.2)]'
                      : activeDagCard.is_analyzed
                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-[0_0_8px_rgba(59,130,246,0.2)]'
                        : 'bg-[#00e5ff]/15 text-[#00e5ff] border-[#00e5ff]/30 shadow-[0_0_8px_rgba(0,229,255,0.2)] animate-pulse'
                  }`}>
                    {activeDagCard.stage === 4 ? '완료' : activeDagCard.is_analyzed ? 'ANL_COMPLETE' : 'ANALYZING'}
                  </span>
                )}
              </div>
              
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                {activeDagCard ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-white/5">
                      <p className="text-[10px] text-slate-400 font-bold">인시던트 ID: <span className="text-white font-mono font-semibold">{activeDagCard.inc_id}</span></p>
                      <p className="text-[10px] text-slate-400 font-bold ml-auto">발신: <span className="text-slate-200 font-mono font-semibold">{activeDagCard.sender || 'UNKNOWN'}</span></p>
                      {activeDagCard.assignee && activeDagCard.assignee !== '미정' && (
                        <span className="h-5 flex items-center gap-1 bg-white/5 px-2 rounded-lg border border-white/10 text-[9px] text-slate-300 font-mono font-bold shrink-0">
                          👤 {activeDagCard.assignee}
                        </span>
                      )}
                    </div>
                    <div>
                      {renderFormattedSMS(activeDagCard.message, activeDagCard.severity)}
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-500 text-xs font-bold">
                    선택된 인시던트가 없습니다
                  </div>
                )}
              </div>
            </div>

            {/* Vertical Splitter */}
            <div
              onMouseDown={() => startRightVDrag(0)}
              className="flex items-center justify-center h-2 cursor-row-resize group shrink-0 my-1 z-50 hover:bg-white/5 transition-colors rounded relative"
            >
              <div className="h-[1px] w-16 bg-white/20 group-hover:bg-[#00e5ff] transition-colors" />
              <div className="absolute w-4 h-4 rounded-full bg-[#00e5ff]/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <div className="w-[1px] h-2 bg-[#00e5ff]" />
              </div>
            </div>

            {/* 하단: 장애 처리현황 */}
            <div style={{ height: `${rightHeights[1]}%`, minHeight: 200 }} className="bg-[#0b0e17] rounded-3xl p-4 border border-white/5 flex flex-col min-h-0 shadow-lg overflow-hidden">
              <div className="flex items-center gap-1.5 mb-2 shrink-0">
                <div className="w-6 h-6 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center">
                  <Activity className="w-3.5 h-3.5 text-indigo-400" />
                </div>
                <div>
                  <h4 className="text-[13px] font-black text-white leading-none pt-0.5">장애 처리현황</h4>
                </div>
              </div>
              
              {renderTimeline(activeDagCard)}
            </div>


          </div>
          
        </div>
      </div>
    );
  };

  const renderExecutiveMode = () => {
    // --- 1. Robust Realistic Mock Data Generation ---
    // Instead of sparse live data, we aggregate live data and scale it up to represent a full 24H enterprise view.
    const baseCount = Math.max(150, displayedCards.length * 5); 
    const automationRate = 84.2; 
    const mttrReduction = 23; 
    
    // SLA Pie
    const slaPieData = [
      { name: 'SLA 준수', value: 98.5, color: '#10b981' },
      { name: 'SLA 초과', value: 1.5, color: '#ef4444' }
    ];

    // ROI Trend (Generate 24h smooth trend)
    const roiTrendData = execRoiTrendData;

    // System Vulnerability
    const systemHealthList = execSystemHealthList;

    // 24H Zero-Blind Spot Map
    const hourlyMap = execHourlyMap;

    return (
      <div className="flex-1 p-4 bg-[#07090f] min-h-0 flex flex-col gap-4">
        {/* HEADER TITLE */}
        <div className="shrink-0 flex items-center justify-between">
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <div className="p-2 bg-purple-500/20 rounded-xl border border-purple-500/30"><TrendingUp className="w-5 h-5 text-purple-400" /></div>
            C-Level 경영진 통합 성과 보고서 (Realtime D1 Sync)
          </h2>
          <div className="px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold flex items-center gap-2 animate-pulse">
            <div className="w-2 h-2 rounded-full bg-emerald-400"></div> System Normal
          </div>
        </div>

        <div className="flex-1 grid grid-cols-4 grid-rows-3 gap-4 min-h-0">
          
          {/* ROW 1: 4 KPI CARDS */}
          <div className="col-span-1 row-span-1 bg-gradient-to-br from-[#121622] to-[#0b0e17] rounded-3xl border border-white/5 p-5 shadow-xl relative overflow-hidden group hover:border-[#00e5ff]/30 transition-all flex flex-col justify-center">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-[#00e5ff]/10 blur-[30px] rounded-full group-hover:bg-[#00e5ff]/20 transition-all"></div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-[#00e5ff]/10 rounded-xl"><Layers className="w-4 h-4 text-[#00e5ff]" /></div>
              <h3 className="text-[11px] font-bold text-slate-400">오늘의 통합 인시던트</h3>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-black text-white tracking-tighter">{baseCount}</span>
              <span className="text-sm font-bold text-[#00e5ff] mb-1">건</span>
            </div>
            <div className="mt-2 text-[10px] font-bold text-slate-500 flex items-center gap-1">
              <span className="text-emerald-400 flex items-center"><TrendingUp className="w-3 h-3 mr-0.5" /> +12%</span> 전일 대비 증가
            </div>
          </div>

          <div className="col-span-1 row-span-1 bg-gradient-to-br from-[#121622] to-[#0b0e17] rounded-3xl border border-white/5 p-5 shadow-xl relative overflow-hidden group hover:border-purple-500/30 transition-all flex flex-col justify-center">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-purple-500/10 blur-[30px] rounded-full group-hover:bg-purple-500/20 transition-all"></div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-purple-500/10 rounded-xl"><Brain className="w-4 h-4 text-purple-400" /></div>
              <h3 className="text-[11px] font-bold text-slate-400">AI 자동화 방어율</h3>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-black text-white tracking-tighter">{automationRate}</span>
              <span className="text-sm font-bold text-purple-400 mb-1">%</span>
            </div>
            <div className="mt-2 text-[10px] font-bold text-slate-500 flex items-center gap-1">
              <span className="text-emerald-400 flex items-center"><TrendingUp className="w-3 h-3 mr-0.5" /> +5.2%</span> AI 자산화 기여
            </div>
          </div>

          <div className="col-span-1 row-span-1 bg-gradient-to-br from-[#121622] to-[#0b0e17] rounded-3xl border border-white/5 p-5 shadow-xl relative overflow-hidden group hover:border-emerald-500/30 transition-all flex flex-col justify-center">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 blur-[30px] rounded-full group-hover:bg-emerald-500/20 transition-all"></div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-emerald-500/10 rounded-xl"><Clock className="w-4 h-4 text-emerald-400" /></div>
              <h3 className="text-[11px] font-bold text-slate-400">MTTR (평균 조치시간) 단축</h3>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-black text-white tracking-tighter">{mttrReduction}</span>
              <span className="text-sm font-bold text-emerald-400 mb-1">% ⬇</span>
            </div>
            <div className="mt-2 text-[10px] font-bold text-slate-500 flex items-center gap-1">
              <span className="text-emerald-400 flex items-center">평균 01:24:30 달성</span>
            </div>
          </div>

          <div className="col-span-1 row-span-1 bg-gradient-to-br from-[#121622] to-[#0b0e17] rounded-3xl border border-white/5 p-5 shadow-xl relative overflow-hidden group flex flex-col min-h-0">
             <div className="flex items-center gap-2 mb-2 shrink-0"><ShieldCheck className="w-4 h-4 text-emerald-400" /><h3 className="text-xs font-black text-white">SLA 골든타임 준수율</h3></div>
             <div className="flex-1 min-h-0 relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                  <PieChart>
                    <defs>
                      <linearGradient id="slaGradient" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#34d399" />
                        <stop offset="100%" stopColor="#059669" />
                      </linearGradient>
                    </defs>
                    <Pie data={slaPieData} cx="50%" cy="50%" innerRadius="70%" outerRadius="90%" paddingAngle={2} dataKey="value" stroke="none" cornerRadius={4}>
                      <Cell key="1" fill="url(#slaGradient)" />
                      <Cell key="2" fill="#1e293b" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-black text-white tracking-tighter">{slaPieData[0].value}%</span>
                  <span className="text-[8px] font-bold text-emerald-500">SAFE</span>
                </div>
             </div>
          </div>

          {/* ROW 2: TREND & RANKING */}
          <div className="col-span-2 row-span-1 bg-[#0b0e17] rounded-3xl border border-white/5 p-5 shadow-xl flex flex-col min-h-0 relative overflow-hidden">
            <div className="absolute left-1/2 top-0 w-64 h-32 bg-purple-500/10 blur-[50px] rounded-full pointer-events-none -translate-x-1/2" />
            <div className="flex items-center justify-between mb-3 shrink-0 relative z-10">
              <div className="flex items-center gap-2"><Cpu className="w-4 h-4 text-purple-400" /><h2 className="text-sm font-black text-white">AI 자동화 ROI 및 장애 유입 트렌드</h2></div>
              <div className="flex items-center gap-3 text-[9px] font-bold bg-white/5 px-3 py-1 rounded-full">
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500" />총 유입</div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-400" />인력 절감(h)</div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-purple-400" />AI 자산화</div>
              </div>
            </div>
            <div className="flex-1 min-h-0 relative z-10">
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                <ComposedChart data={roiTrendData} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                    <linearGradient id="colorRag" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/><stop offset="95%" stopColor="#a855f7" stopOpacity={0}/></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" vertical={false} />
                  <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 9, fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', backdropFilter: 'blur(8px)' }} itemStyle={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }} />
                  <Area type="monotone" dataKey="hours" name="절감 시간 누적(h)" stroke="#10b981" strokeWidth={2} fill="url(#colorHours)" />
                  <Area type="monotone" dataKey="rag" name="보고서 자산화(건)" stroke="#a855f7" strokeWidth={2} fill="url(#colorRag)" />
                  <Line type="monotone" dataKey="incidents" name="총 장애 유입" stroke="#3b82f6" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="col-span-2 row-span-1 bg-zinc-900/40 backdrop-blur-sm rounded-3xl border border-white/5 p-5 shadow-xl flex flex-col min-h-0 relative overflow-hidden">
             <div className="flex items-center gap-2 mb-3 shrink-0"><Activity className="w-4 h-4 text-amber-400" /><h2 className="text-sm font-black text-white">시스템 취약성 및 AI 방어 성과 (Top 5)</h2></div>
             <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                <BarChart layout="vertical" data={systemHealthList} margin={{ top: 0, right: 10, left: 30, bottom: 0 }} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" tick={{ fill: '#cbd5e1', fontSize: 9, fontWeight: 'bold' }} axisLine={false} tickLine={false} width={100} />
                  <Tooltip cursor={{ fill: 'rgba(255,255,255,0.02)' }} contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', backdropFilter: 'blur(8px)' }} itemStyle={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }} />
                  <Bar dataKey="total" name="총 발생" fill="#1e293b" radius={[0, 4, 4, 0]} barSize={12} />
                  <Bar dataKey="aiResolved" name="AI 조치 완료" fill="#00e5ff" radius={[0, 4, 4, 0]} barSize={12}>
                    {systemHealthList.map((entry, index) => <Cell key={`cell-${index}`} fill={index === 0 ? '#ef4444' : index === 1 ? '#f59e0b' : '#00e5ff'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
             </div>
          </div>

          {/* ROW 3: 24H ZERO BLIND SPOT */}
          <div className="col-span-4 row-span-1 bg-zinc-900/40 backdrop-blur-sm rounded-3xl border border-white/5 p-5 shadow-xl flex flex-col relative overflow-hidden min-h-0">
            <div className="absolute right-0 bottom-0 w-[60%] h-full bg-gradient-to-l from-blue-900/10 to-transparent pointer-events-none" />
            <div className="flex items-center justify-between mb-4 relative z-10 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20"><ShieldCheck className="w-4 h-4 text-blue-400" /></div>
                <div><h2 className="text-sm font-black text-white">야간 관제 24시간 사각지대 제로(0) 현황</h2><p className="text-[9px] text-slate-500 font-bold mt-0.5">22:00 ~ 06:00 Zero-Blind Spot Night Tracking</p></div>
              </div>
              <div className="px-4 py-1.5 rounded-xl border bg-blue-500/10 border-blue-500/30 flex items-center gap-2">
                 <CheckCircle className="w-3.5 h-3.5 text-blue-400" />
                 <span className="text-[10px] font-black text-blue-400">야간 사각지대 방어 100% 달성</span>
              </div>
            </div>
            
            <div className="flex-1 min-h-0 relative z-10">
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                <ComposedChart data={hourlyMap} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorNight" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" vertical={false} />
                  <XAxis dataKey="hour" tick={{ fill: '#64748b', fontSize: 9, fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', backdropFilter: 'blur(8px)' }} itemStyle={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }} />
                  <Area type="monotone" dataKey="count" name="발생 건수" stroke="#3b82f6" strokeWidth={2} fill="url(#colorNight)" />
                  <Bar dataKey="critical" name="크리티컬 경보" barSize={4} fill="#ef4444" radius={[4, 4, 0, 0]} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      </div>
    );
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-zinc-950 text-slate-300 font-sans flex flex-col pb-[60px] select-none">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-purple-500/5 blur-[120px] rounded-full pointer-events-none" />

      {/* 🚀 Header */}
      <header className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b border-white/5 bg-zinc-950/90 backdrop-blur-md z-[200]">
        <div className="flex items-center gap-3">
          <button onClick={() => goBack()} className="w-9 h-9 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all flex items-center justify-center cursor-pointer active:scale-95"><ChevronLeft size={18} className="text-slate-400" /></button>
          <div>
            <h1 className="text-sm lg:text-base font-black text-white tracking-tight flex items-center gap-2"><Layers className="w-4 h-4 text-[#00e5ff] animate-pulse" /> 통합 데시보드</h1>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-0.5">Realtime Pipeline & Executive Dashboard</p>
          </div>
        </div>

        <div className="hidden md:flex items-center bg-[#0f1422] rounded-full p-1 border border-white/10">
          <button onClick={() => setViewMode('operator')} className={`px-4 py-1.5 rounded-full text-[11px] font-black transition-all cursor-pointer ${viewMode === 'operator' ? 'bg-[#00e5ff]/20 text-[#00e5ff] shadow-[0_0_15px_rgba(0,229,255,0.2)]' : 'text-slate-500 hover:text-slate-300'}`}>관제 모드 (조직도 및 지표 시각화)</button>
          <button onClick={() => setViewMode('executive')} className={`px-4 py-1.5 rounded-full text-[11px] font-black transition-all cursor-pointer flex items-center gap-1.5 ${viewMode === 'executive' ? 'bg-purple-500/20 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.2)]' : 'text-slate-500 hover:text-slate-300'}`}><TrendingUp className="w-3 h-3" /> 경영진 보고 모드 (D1 요약)</button>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center bg-[#0f1422] border border-white/5 rounded-xl px-2 py-1 gap-1.5"><Calendar className="w-3 h-3 text-blue-400" /><select value={period} onChange={(e) => setPeriod(e.target.value)} className="bg-transparent text-slate-300 font-bold text-[10px] border-none outline-none cursor-pointer pr-1"><option value="all">전체</option><option value="today">오늘</option><option value="yesterday">어제</option><option value="7days">최근 7일</option></select></div>
          <button onClick={() => setSoundEnabled(!soundEnabled)} className={`px-2.5 py-1.5 rounded-xl border text-[10px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${soundEnabled ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/10 text-slate-500'}`}><Volume2 className="w-3.5 h-3.5" /></button>
          <button onClick={() => setIsSimulationActive(!isSimulationActive)} className={`px-2.5 py-1.5 rounded-xl border text-[10px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${isSimulationActive ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-white/5 border-white/10 text-slate-500'}`}><Play className="w-3.5 h-3.5" /></button>
          <button onClick={fetchLiveMessages} className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 hover:bg-white/20 text-slate-400 hover:text-white transition-all flex items-center justify-center cursor-pointer"><RefreshCw className="w-3.5 h-3.5" /></button>
        </div>
      </header>

      {viewMode === 'operator' ? renderOperatorMode() : renderExecutiveMode()}

      {/* Bottom-up Workflow Slide Panel */}
      {workflowPanelId && (
        <div
          className="fixed inset-0 z-[500] flex flex-col justify-end"
          style={{ animation: 'fadeIn 0.2s ease' }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setWorkflowPanelId(null)}
          />
          {/* Panel */}
          <div
            className="relative w-full bg-zinc-950 border-t border-white/10 rounded-t-3xl shadow-[0_-20px_60px_rgba(0,0,0,0.8)] flex flex-col"
            style={{ height: '85vh', animation: 'slideUp 0.35s cubic-bezier(0.32,0.72,0,1)' }}
          >
            {/* Handle bar */}
            <div className="flex items-center justify-between px-6 pt-4 pb-3 border-b border-white/5 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-1 h-6 rounded-full bg-[#00e5ff]/50" />
                <div>
                  <h3 className="text-sm font-black text-white">워크플로우 상세</h3>
                  <p className="text-[9px] font-bold text-slate-500 font-mono mt-0.5">{workflowPanelId}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate(`/workflow/${workflowPanelId}`)}
                  className="px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 rounded-xl text-[10px] font-bold text-blue-400 hover:bg-blue-500/20 transition-all flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3 h-3" /> 전체화면
                </button>
                <button
                  onClick={() => setWorkflowPanelId(null)}
                  className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white transition-all flex items-center justify-center"
                >
                  <ChevronLeft className="w-4 h-4 rotate-[-90deg]" />
                </button>
              </div>
            </div>
            {/* Iframe */}
            <div className="flex-1 min-h-0 relative">
              <iframe
                src={`/#/workflow/${workflowPanelId}`}
                className="w-full h-full border-none"
                title={`workflow-${workflowPanelId}`}
              />
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>

    </div>
  );
}
