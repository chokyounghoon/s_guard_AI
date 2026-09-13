import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBackNavigation } from '../hooks/useBackNavigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, ArrowLeft, CheckCircle2, Zap, Shield, Calendar,
         ChevronRight, ChevronDown, User, Clock, Terminal, Printer,
         LayoutDashboard, UserX, MessageSquare, AlertTriangle, Users } from 'lucide-react';
import { getAuthHeaders, getUserProfile } from '../lib/authStore';
import toast from 'react-hot-toast';
import { formatOccurrenceCount } from '../utils/maskingUtils';
import { useTheme } from '../context/ThemeContext';

const API_BASE = 'https://sguardai.khcho0421.workers.dev';

const FLOW_STEPS = [
  { id: 'SMS',       label: 'SMS 수신 및 장애 인지',  icon: Terminal,    color: 'blue' },
  { id: 'RAG_AGENT', label: 'AI AGENT 분석 완료',     icon: Zap,         color: 'purple' },
  { id: 'WARROOM',   label: '워룸 생성 및 할당 완료(처리중)',       icon: Activity,    color: 'indigo' },
  { id: 'KNOWLEDGE', label: '지식화/장애/보고 처리완료',     icon: CheckCircle2, color: 'emerald' }
];

const parseMciFields = (msg) => {
  if (!msg) return {};
  const patterns = {
    '채널':       /▶\s*채널\s*:\s*\[([^\]]*)\]/,
    'IF아이디':   /▶\s*IF아이디\s*:\s*\[([^\]]*)\]/,
    'IF명':       /▶\s*IF명\s*:\s*\[([^\]]*)\]/,
    '서비스코드': /▶\s*서비스코드\s*:\s*\[([^\]]*)\]/,
    '서비스명':   /▶\s*서비스명\s*:\s*\[([^\]]*)\]/,
    '업무코드':   /▶\s*업무코드\s*:\s*\[([^\]]*)\]/,
    '업무시스템': /▶\s*업무시스템[^:]*:\s*\[([^\]]*)\]/,
    '발생건수':   /▶\s*발생건수\s*:\s*\[([^\]]*)\]/,
    '발생노드':   /▶\s*발생노드\s*:\s*\[([^\]]*)\]/,
    '에러메시지': /▶\s*에러메시지\s*:\s*\[([^\]]*)\]/,
    '발생시각':   /▶\s*발생시각\s*:\s*\[([^\]]*)\]/,
    '거래일자':   /▶\s*거래일자\s*:\s*\[([^\]]*)\]/,
    '거래시간':   /▶\s*거래시간\s*:\s*\[([^\]]*)\]/,
    '비교일수':   /▶\s*비교일수[^:]*:\s*\[([^\]]*)\]/,
    '오류율임계치': /▶\s*오류율임계치\s*:\s*\[([^\]]*)\]/,
    '현재거래건수': /▶\s*현재거래건수\s*:\s*\[([^\]]*)\]/,
    '현재오류율': /▶\s*현재오류율\s*:\s*\[([^\]]*)\]/,
    '메시지수신자': /▶\s*메시지\s*수신자\s*:\s*\[([^\]]*)\]/,
    '메시지발생일시': /▶\s*메시지\s*발생일시\s*:\s*\[([^\]]*)\]/,
    '대외기관': /▶\s*대외기관\s*:\s*\[([^\]]*)\]/,
  };
  const result = {};
  for (const [key, re] of Object.entries(patterns)) {
    const m = msg.match(re);
    if (m && m[1] && m[1].trim() !== '-' && m[1].trim() !== '') {
      result[key] = m[1].trim();
    }
  }
  return result;
};

export default function WorkflowPage() {
  const { isLight, theme } = useTheme();
  const { inc_id } = useParams();
  const navigate = useNavigate();
  const goBack = useBackNavigation('/dashboard');
  const [incidentData, setIncidentData] = useState(null);
  const [workflowLogs, setWorkflowLogs] = useState([]);
  const [assignees, setAssignees] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [showRawMsg, setShowRawMsg] = useState(false);
  
  // 모바일 탭 상태: 'info' | 'timeline'
  const [activeTab, setActiveTab] = useState('info');

  const formatDuration = (ms) => {
    if (ms < 0) return '00:00:00';
    const s = Math.floor(ms / 1000);
    return `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor((s%3600)/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  };

  const [isOpeningWarRoom, setIsOpeningWarRoom] = useState(false);

  const handleOpenWarRoom = async () => {
    if (isOpeningWarRoom) return;
    setIsOpeningWarRoom(true);
    const userProfile = getUserProfile();
    const incidentId = inc_id;
    
    try {
      const lockRes = await fetch(`${API_BASE}/ai/warroom/lock/${incidentId}`, {
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
      const rawMsg = incidentData?.rawMessage || 'SMS 장애 감지';
      const truncatedMsg = rawMsg.length > 50 ? rawMsg.substring(0, 50) + '...' : rawMsg;
      
      const res = await fetch(`${API_BASE}/ai/warroom/open`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          inc_id: incidentId,
          title: `${incidentId} | ${truncatedMsg}`,
          creator_id: userProfile?.employee_id || null,
          severity: incidentData?.severity || 'NORMAL',
          leader_summary: '실시간 관제 워룸 생성'
        })
      });
      navigate(`/chat/${incidentId}`);
    } catch (err) {
      console.error("Failed to create War-Room:", err);
      toast.error("워룸 개설 중 오류가 발생했습니다.");
    } finally {
      setIsOpeningWarRoom(false);
    }
  };

  const fmt = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const yy = String(d.getFullYear()).slice(2);
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    const hh = String(d.getHours()).padStart(2,'0');
    const mi = String(d.getMinutes()).padStart(2,'0');
    const ss = String(d.getSeconds()).padStart(2,'0');
    return `${yy}/${mm}/${dd} ${hh}:${mi}:${ss}`;
  };

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!inc_id) return;
    (async () => {
      setLoading(true);
      try {
        const normId = inc_id;
        let r = await fetch(`${API_BASE}/ai/incident/${normId}`, { headers: getAuthHeaders() });
        if (!r.ok) r = await fetch(`${API_BASE}/sms/${normId}`, { headers: getAuthHeaders() });
        if (r.ok) {
          const data = await r.json();
          const d = data.incident || data;
          const rawMsg = d.message || d.description || '';
          const p = parseMciFields(rawMsg);
          setIncidentData({
            rawMessage: rawMsg,
            sender:     d.sender || 'SYSTEM',
            created_at: d.created_at || d.timestamp || d.reg_dt,
            severity:   d.severity || 'NORMAL',
            channel:        d.channel        || p['채널']       || null,
            if_id:          d.if_id          || p['IF아이디']   || null,
            if_name:        d.if_name        || p['IF명']       || null,
            service_name:   d.service_name   || p['서비스명']   || null,
            service_code:   d.service_code   || p['서비스코드'] || null,
            biz_system:     d.biz_system     || p['업무시스템'] || null,
            error_code:     d.error_code     || null,
            occurrence_count: formatOccurrenceCount(d.occurrence_count, rawMsg),
            occurrence_node:  d.occurrence_node  || p['발생노드'] || null,
            error_message:    d.error_message    || p['에러메시지'] || null,
            occurrence_time:  d.occurrence_time  || p['발생시각'] || null,
            trade_date:       p['거래일자'] || null,
            trade_time:       p['거래시간'] || null,
            error_rate:       p['현재오류율'] || null,
            threshold:        p['오류율임계치'] || null,
          });
        }
        const fr = await fetch(`${API_BASE}/ai/incident/workflow-details?inc_id=${inc_id}`, {
          headers: getAuthHeaders()
        });
        if (fr.ok) {
          const fd = await fr.json();
          setWorkflowLogs(fd.steps || []);
          setAssignees(fd.assignees || []);
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [inc_id]);

  if (loading) return (
    <div className="min-h-screen bg-[#0a0c14] flex flex-col items-center justify-center text-white">
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        className="w-16 h-16 rounded-full border-t-2 border-b-2 border-blue-500" />
      <p className="text-blue-400 font-mono text-[10px] tracking-[0.3em] uppercase mt-6 animate-pulse">Synchronizing Pipeline</p>
    </div>
  );

  const firstPending = FLOW_STEPS.findIndex(s => {
    if (s.id === 'RAG_AGENT') return !workflowLogs.find(l => l.id==='RAG') && !workflowLogs.find(l => l.id==='AGENT');
    return !workflowLogs.find(l => l.id === s.id);
  });
  const startLog = workflowLogs.find(l => l.id === 'SMS');
  const endLog   = workflowLogs.find(l => l.id === 'KNOWLEDGE');
  const startT   = startLog ? new Date(startLog.timestamp) : (incidentData?.created_at ? new Date(incidentData.created_at) : null);
  const endT     = endLog ? new Date(endLog.timestamp) : null;
  const durMs    = startT && !isNaN(startT) ? (endT || currentTime) - startT : 0;
  const isClosed = !!endT;
  const doneCount = FLOW_STEPS.filter(s => {
    if (s.id==='RAG_AGENT') return workflowLogs.find(l=>l.id==='RAG')||workflowLogs.find(l=>l.id==='AGENT');
    return workflowLogs.find(l=>l.id===s.id);
  }).length;
  const progress = (doneCount / FLOW_STEPS.length) * 100;

  const fields = [
    { label: '채널',     value: incidentData?.channel,          badge: true },
    { label: 'IF아이디', value: incidentData?.if_id,            mono: true },
    { label: 'IF명',     value: incidentData?.if_name },
    { label: '서비스명', value: incidentData?.service_name },
    { label: '서비스코드',value: incidentData?.service_code,    mono: true },
    { label: '업무시스템',value: incidentData?.biz_system },
    { label: '발생건수', value: incidentData?.occurrence_count, highlight: true },
    { label: '오류율',   value: incidentData?.error_rate,       highlight: true },
    { label: '임계치',   value: incidentData?.threshold },
    { label: '발생노드', value: incidentData?.occurrence_node,  mono: true },
    { label: '발생시각', value: incidentData?.occurrence_time,  mono: true },
    { label: '거래일자', value: incidentData?.trade_date,        mono: true },
    { label: '거래시간', value: incidentData?.trade_time,        mono: true },
    { label: '에러내용', value: incidentData?.error_message,     wrap: true },
  ].filter(f => f.value && f.value !== '0' && f.value !== 0);

  const getAvatarColor = (name) => {
    const colors = ['bg-rose-500', 'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500', 'bg-cyan-500', 'bg-fuchsia-500'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const getInitials = (name) => {
    return name.substring(0, 1).toUpperCase();
  };

  // Info 탭 콘텐츠
  const InfoContent = () => (
    <div className="space-y-4 pb-20 lg:pb-0">
      {/* 뱃지 & MTTR */}
      <div className={`rounded-3xl p-5 border transition-all ${
        isLight ? 'bg-white border-slate-200/90 shadow-sm shadow-slate-200/50' : 'bg-[#151926]/80 backdrop-blur-xl border-white/5 shadow-lg'
      }`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-xl ${isClosed ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
              <Shield className={`w-4 h-4 ${isClosed ? 'text-emerald-500' : 'text-red-500'}`} />
            </div>
            <div>
              <span className={`text-[10px] font-black uppercase tracking-widest ${isClosed ? (isLight ? 'text-emerald-700' : 'text-emerald-400') : (isLight ? 'text-red-700' : 'text-red-400/90')}`}>
                {isClosed ? 'Incident Closed' : 'Active Emergency'}
              </span>
              <p className="text-[10px] text-slate-500">LIFECYCLE ALPHA-7</p>
            </div>
          </div>
          <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${
            isClosed ? (isLight ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20')
                     : (isLight ? 'bg-red-50 text-red-700 border-red-200 animate-pulse' : 'bg-red-500/10 text-red-400 border-red-500/20 animate-pulse')}`}>
            {isClosed ? 'CLOSED' : 'LIVE'}
          </span>
        </div>
        
        <div className={`rounded-2xl p-4 border flex items-center justify-between transition-colors ${
          isLight ? 'bg-slate-50 border-slate-200/80' : 'bg-black/20 border-white/5'
        }`}>
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block mb-1">MTTR (복구소요시간)</span>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isClosed ? 'bg-emerald-500' : 'bg-blue-400 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]'}`} />
              <span className={`text-3xl font-black font-mono tracking-tighter tabular-nums drop-shadow-sm ${isLight ? 'text-slate-900' : 'text-white'}`}>
                {formatDuration(durMs)}
              </span>
            </div>
          </div>
        </div>

        <div className={`flex items-center justify-between rounded-2xl p-3.5 border mt-3 text-xs flex-wrap gap-y-2 transition-colors ${
          isLight ? 'bg-slate-50/90 border-slate-200' : 'bg-white/[0.02] border-white/5'
        }`}>
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span className={`font-bold ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>인지시각:</span>
            <span className={`font-mono font-bold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>{fmt(incidentData?.created_at) || '-'}</span>
          </div>
          {isClosed && endT && (
            <div className={`flex items-center gap-2 border-l pl-4 ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span className={`font-bold ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>완료시각:</span>
              <span className={`font-mono font-bold ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>{fmt(endT)}</span>
            </div>
          )}
          <div className={`flex items-center gap-2 border-l pl-4 ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
            <User className="w-3.5 h-3.5 text-slate-500" />
            <span className={`font-bold ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>발신자:</span>
            <span className={`font-bold truncate max-w-[120px] ${isLight ? 'text-blue-700' : 'text-blue-400'}`}>{incidentData?.sender || 'SYSTEM'}</span>
          </div>
        </div>
      </div>

      {/* 구조화 장애 정보 */}
      {fields.length > 0 && (
        <div className={`rounded-3xl overflow-hidden border transition-all ${
          isLight ? 'bg-white border-slate-200/90 shadow-sm shadow-slate-200/50' : 'bg-[#151926]/80 backdrop-blur-xl border-white/5 shadow-lg'
        }`}>
          <div className={`px-5 py-4 border-b transition-colors ${
            isLight ? 'border-slate-200 bg-slate-50/80' : 'border-white/5 bg-white/[0.02]'
          }`}>
            <h3 className={`text-xs font-black flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
              <AlertTriangle className="w-3.5 h-3.5 text-blue-500" />
              상세 정보
            </h3>
          </div>
          <div className="p-2">
            {fields.map(f => (
              <div key={f.label} className={`flex flex-col sm:flex-row sm:items-start justify-between gap-1 sm:gap-4 p-3 rounded-xl transition-colors ${
                isLight ? 'hover:bg-slate-50' : 'hover:bg-white/[0.02]'
              }`}>
                <span className={`text-[11px] font-bold shrink-0 pt-0.5 ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>{f.label}</span>
                <span className={`text-[13px] break-all sm:text-right ${
                  f.highlight 
                    ? (isLight ? 'text-amber-600 font-black' : 'text-orange-400 font-bold') 
                    : f.mono 
                      ? (isLight ? 'text-slate-900 font-mono font-semibold' : 'text-slate-300 font-mono') 
                      : (isLight ? 'text-slate-900 font-semibold' : 'text-white')
                } ${f.wrap ? 'whitespace-pre-wrap mt-1 sm:mt-0' : ''}`}>
                  {f.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Response Team */}
      <div className={`rounded-3xl overflow-hidden border transition-all ${
        isLight ? 'bg-white border-slate-200/90 shadow-sm shadow-slate-200/50' : 'bg-[#151926]/80 backdrop-blur-xl border-white/5 shadow-lg'
      }`}>
        <div className={`px-5 py-4 border-b flex items-center justify-between transition-colors ${
          isLight ? 'border-slate-200 bg-slate-50/80' : 'border-white/5 bg-white/[0.02]'
        }`}>
          <h3 className={`text-xs font-black flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
            <Users className="w-3.5 h-3.5 text-indigo-500" />
            대응팀
          </h3>
          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
            isLight ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20'
          }`}>
            {assignees.length} 명
          </span>
        </div>
        <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {assignees.length > 0 ? assignees.map((a, i) => {
            const isUnparticipated = ['미참여', 'INC_001', '미확인', '대기'].includes(a.status);
            const isDone = ['INC_003', '처리완료', 'CLOSED'].includes(a.status);
            const isActive = ['INC_002', '처리중', '진행중'].includes(a.status);
            
            const badgeLabel = isDone ? '처리완료' : isUnparticipated ? '미참여' : isActive ? '참여중' : a.status;
            const badgeCls = isDone || isActive
              ? (isLight ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-black' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-black')
              : (isLight ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-slate-800 text-slate-400 border-white/10');
            const avatarBg = isDone || isActive
              ? 'bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.5)] font-black'
              : (isLight ? 'bg-slate-200 text-slate-600 border border-slate-300' : 'bg-slate-800 text-slate-500 border border-white/10');

            return (
              <div key={`${a.user_id}-${i}`} className={`flex items-center justify-between p-3 rounded-2xl border transition-colors ${
                isLight ? 'bg-slate-50/90 border-slate-200 hover:bg-slate-100/70' : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05]'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] ${avatarBg}`}>
                    {getInitials(a.name || a.user_id)}
                  </div>
                  <div>
                    <p className={`text-[13px] font-black tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>{a.name || a.user_id}</p>
                    <p className={`text-[10px] font-normal whitespace-nowrap overflow-hidden text-ellipsis max-w-[140px] tracking-tight ${isLight ? 'text-slate-500' : 'text-slate-500/70'}`}>
                      {a.user_id} {a.team_name || a.part_name ? `· ${[a.team_name, a.part_name].filter(Boolean).join(' ')}` : ''}
                    </p>
                  </div>
                </div>
                <span className={`text-[9px] px-2.5 py-1 rounded-full flex items-center gap-1 border ${badgeCls}`}>
                  {(isDone || isActive) ? <CheckCircle2 className="w-2.5 h-2.5" /> : <UserX className="w-2.5 h-2.5" />}
                  {badgeLabel}
                </span>
              </div>
            );
          }) : <div className="p-4 text-center text-[11px] text-slate-500 col-span-2">할당된 담당자가 없습니다.</div>}
        </div>
      </div>

    </div>
  );

  // Timeline 탭 콘텐츠
  const TimelineContent = () => {
    const smsStep = workflowLogs.find(s => s.id === 'SMS');
    const ragStep = workflowLogs.find(s => s.id === 'RAG') || workflowLogs.find(s => s.id === 'AGENT');
    const warStep = workflowLogs.find(s => s.id === 'WARROOM');
    const knwStep = workflowLogs.find(s => s.id === 'KNOWLEDGE');

    return (
      <div className={`rounded-3xl p-5 lg:p-8 pb-10 transition-all ${
        isLight 
          ? 'bg-white border border-slate-200/90 shadow-sm shadow-slate-200/40 text-slate-900' 
          : 'bg-[#151926]/40 backdrop-blur-xl border border-white/5 shadow-2xl text-white'
      }`}>
        
        {/* 장애 처리 현황 요약 바 */}
        <div className={`mb-8 p-4 rounded-2xl border transition-colors ${
          isLight ? 'bg-slate-50/90 border-slate-200' : 'bg-white/[0.02] border-white/5'
        }`}>
          <div className="flex items-center gap-2 mb-3">
            <Activity className={`w-4 h-4 ${isLight ? 'text-indigo-600' : 'text-purple-400'}`} />
            <h3 className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>장애 처리 현황</h3>
          </div>
          
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { label: '인지', from: smsStep, to: ragStep },
              { label: '분석', from: ragStep, to: warStep },
              { label: '워룸진행', from: warStep, to: knwStep },
              { label: '처리완료', from: smsStep, to: knwStep },
            ].map(({ label, from, to }) => {
              const isDone = label === '처리완료' ? !!knwStep : !!to;
              const isActive = !!from && !to;
              const ms = from ? ((to ? new Date(to.timestamp) : currentTime) - new Date(from.timestamp)) : 0;
              const m = Math.floor(ms / 60000);
              const s = Math.floor((ms % 60000) / 1000);
              const timeStr = from ? (m > 0 ? `${m}m ${s}s` : `${s}s`) : '-';
              return (
                <div key={label} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-black ${
                  isDone 
                    ? (isLight ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400')
                    : isActive 
                      ? (isLight ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-blue-500/10 border-blue-500/30 text-blue-400')
                      : (isLight ? 'bg-slate-100 border-slate-200 text-slate-500' : 'bg-white/5 border-white/5 text-slate-500')
                }`}>
                  <span className="opacity-80">{label}</span>
                  <span className="font-mono tabular-nums inline-block w-[3.5rem] text-right">{timeStr}</span>
                  {isActive && <span className={`w-1.5 h-1.5 rounded-full ml-1 ${isLight ? 'bg-blue-600' : 'bg-blue-400'}`} />}
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative">
          {/* 타임라인 선 */}
          <div className={`absolute left-[15px] lg:left-[15px] top-4 bottom-4 w-[2px] pointer-events-none ${
            isLight 
              ? 'bg-gradient-to-b from-blue-500 via-slate-200 to-transparent' 
              : 'bg-gradient-to-b from-blue-600/50 via-white/10 to-transparent'
          }`} />

          <div className="space-y-6 relative z-10">
            <AnimatePresence>
              {FLOW_STEPS.map((step, sIdx) => {
                let log = workflowLogs.find(l => l.id === step.id);
                if (step.id === 'RAG_AGENT') log = workflowLogs.find(l=>l.id==='RAG') || workflowLogs.find(l=>l.id==='AGENT');
                const done = !!log;
                const next = sIdx === firstPending;
                const Icon = step.icon;

                const stepPrefixes = {
                  SMS: '[인시던트 인지]',
                  RAG_AGENT: '[AI 초기 분석]',
                  WARROOM: '[대응 워룸 가동]',
                  KNOWLEDGE: '[장애 조치 완료]'
                };

                let intervalText = null;
                let intervalMinutes = 0;
                let isElapsedLive = false;
                if (sIdx > 0) {
                  const prevStep = FLOW_STEPS[sIdx - 1];
                  let prevLog = workflowLogs.find(l => l.id === prevStep.id);
                  if (!prevLog && prevStep.id === 'RAG_AGENT') {
                    prevLog = workflowLogs.find(l => l.id === 'RAG') || workflowLogs.find(l => l.id === 'AGENT');
                  }
                  if (prevLog) {
                    if (done) {
                      const diff = new Date(log.timestamp) - new Date(prevLog.timestamp);
                      const m = Math.floor(diff / 60000);
                      const sec = Math.floor((diff % 60000) / 1000);
                      intervalMinutes = m;
                      intervalText = m > 60 ? `⏱ ${Math.floor(m/60)}시간 ${m%60}분 소요` : m > 0 ? `⏱ ${m}분 ${sec}초 소요` : `⏱ ${sec}초 소요`;
                    } else if (sIdx === firstPending) {
                      isElapsedLive = true;
                      const diff = currentTime - new Date(prevLog.timestamp);
                      const m = Math.floor(diff / 60000);
                      const sec = Math.floor((diff % 60000) / 1000);
                      intervalMinutes = m;
                      intervalText = m > 60 ? `⏱ ${Math.floor(m/60)}시간 ${m%60}분 경과` : m > 0 ? `⏱ ${m}분 ${sec}초 경과` : `⏱ ${sec}초 경과`;
                    }
                  }
                }

                return (
                  <motion.div key={step.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: sIdx * 0.1 }} className="relative pl-10 lg:pl-10">
                    {/* 정제된 타임라인 노드 */}
                    <div className={`absolute left-[3px] lg:left-[3px] top-4 w-6 h-6 rounded-lg z-20 flex items-center justify-center transition-all duration-300 border ${
                      done 
                        ? (isLight ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400') 
                        : next 
                          ? 'bg-blue-600 border-blue-500 text-white' 
                          : (isLight ? 'bg-slate-100 border-slate-200 text-slate-400' : 'bg-slate-900 border-[#1E293B] text-slate-500')
                    }`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>

                    {/* 콘텐츠 카드 */}
                    <div className={`p-4 lg:p-5 rounded-2xl border transition-all duration-300 ${
                      done 
                        ? (isLight ? 'bg-slate-50/90 border-slate-200 hover:border-slate-300 shadow-xs' : 'bg-white/[0.03] border-[#1E293B]') 
                        : next 
                          ? (isLight ? 'bg-blue-50/90 border-blue-200 shadow-xs' : 'bg-blue-900/15 border-blue-500/30') 
                          : (isLight ? 'bg-slate-50/40 border-slate-200/50 opacity-50' : 'bg-transparent border-transparent opacity-40')
                    }`}>
                      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2 pb-2.5 border-b ${
                        isLight ? 'border-slate-200/80' : 'border-white/5'
                      }`}>
                        <h4 className={`text-sm font-black tracking-tight flex items-center gap-1.5 ${
                          done 
                            ? (isLight ? 'text-slate-900' : 'text-white') 
                            : next 
                              ? (isLight ? 'text-blue-700' : 'text-blue-400 font-bold tracking-wide') 
                              : (isLight ? 'text-slate-400' : 'text-slate-500')
                        }`}>
                          <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded border ${
                            isLight ? 'bg-white border-slate-200 text-slate-700 shadow-xs' : 'bg-white/5 border-white/10 text-slate-400'
                          }`}>
                            STEP {sIdx + 1}
                          </span>
                          {step.label}
                        </h4>
                        {done ? (
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md ${
                              isLight ? 'text-slate-600 bg-white border border-slate-200' : 'text-slate-400 bg-black/30'
                            }`}>
                              {fmt(log.timestamp)}
                            </span>
                            <CheckCircle2 className={`w-4 h-4 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`} />
                          </div>
                        ) : next && (
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase border ${
                            isLight ? 'text-blue-700 bg-blue-100/80 border-blue-300' : 'text-blue-400 bg-blue-500/10 border-blue-500/20 shadow-[0_0_8px_rgba(59,130,246,0.5)]'
                          }`}>
                            Processing
                          </span>
                        )}
                      </div>
                      
                      <div className="text-xs sm:text-sm leading-relaxed mt-2">
                        {done ? (
                          <div className="space-y-1">
                            <strong className={`font-black block text-xs tracking-tight ${
                              isLight ? 'text-blue-700' : 'text-blue-400'
                            }`}>
                              {stepPrefixes[step.id]}
                            </strong>
                            <p className={`font-medium leading-relaxed ${
                              isLight ? 'text-slate-800' : 'text-slate-300'
                            }`}>
                              {log.detail}
                            </p>
                          </div>
                        ) : next ? (
                          <div className="space-y-1">
                            <strong className={`font-black block text-xs tracking-tight ${
                              isLight ? 'text-blue-700' : 'text-blue-400'
                            }`}>
                              {stepPrefixes[step.id]} (진행 중)
                            </strong>
                            <p className={`font-medium leading-relaxed ${
                              isLight ? 'text-slate-700' : 'text-blue-200/90'
                            }`}>
                              실시간 AI 분석 및 보안 정책 대조를 통한 대응 시퀀스가 활성화되었습니다.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <strong className={`font-black block text-xs tracking-tight ${
                              isLight ? 'text-slate-500' : 'text-slate-500'
                            }`}>
                              {stepPrefixes[step.id]} (대기)
                            </strong>
                            <p className={`font-normal leading-relaxed ${
                              isLight ? 'text-slate-500' : 'text-slate-600'
                            }`}>
                              이전 단계 완료 대기 중
                            </p>
                          </div>
                        )}
                      </div>

                      {/* 워룸 이동/개설 버튼 (STEP 3) */}
                      {step.id === 'WARROOM' && (done || next) && (
                        <div className="mt-4 flex justify-end">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (done) {
                                navigate(`/chat/${inc_id}`);
                              } else {
                                handleOpenWarRoom();
                              }
                            }}
                            disabled={isOpeningWarRoom}
                            className={`px-4 py-2 rounded-xl text-[11px] font-black border active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 ${
                              isLight 
                                ? 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600 shadow-sm shadow-indigo-200' 
                                : 'bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.15)]'
                            }`}
                          >
                            {isOpeningWarRoom ? '개설 중...' : done ? '합동 워룸 입장' : '워룸 즉시 개설'}
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {/* 소요 시간 라벨 (소요시간 vs 경과시간 Live Dot 분리) */}
                      {intervalText && sIdx > 0 && (
                        <div className="mt-3.5 flex justify-end">
                          {isElapsedLive ? (
                            <span className={`text-[11px] font-black px-3 py-1 rounded-full border flex items-center gap-2 ${
                              isLight 
                                ? 'bg-amber-50 text-amber-800 border-amber-300' 
                                : 'bg-orange-500/15 text-orange-400 border-orange-500/30 shadow-[0_0_12px_rgba(249,115,22,0.25)]'
                            }`}>
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
                              </span>
                              {intervalText} (진행 중)
                            </span>
                          ) : (
                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border shadow-xs ${
                              intervalMinutes > 60 
                                ? (isLight ? 'text-amber-800 bg-amber-50 border-amber-300' : 'text-amber-400 bg-amber-500/10 border-amber-500/20') 
                                : (isLight ? 'text-emerald-800 bg-emerald-50 border-emerald-300' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20')
                            }`}>
                              {intervalText}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`font-sans flex flex-col min-h-screen ${
      isLight ? 'bg-[#F8FAFC] text-slate-900' : 'bg-[#0a0c14] text-white'
    }`}>
      {/* 배경 */}
      {!isLight && (
        <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-blue-600/10 blur-[120px] rounded-full mix-blend-screen" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] bg-indigo-600/10 blur-[120px] rounded-full mix-blend-screen" />
        </div>
      )}

      {/* 상단 앱바 */}
      <header className={`sticky top-0 z-50 backdrop-blur-2xl border-b transition-colors ${
        isLight ? 'bg-white/95 border-slate-200/90 shadow-xs' : 'bg-[#0a0c14]/80 border-white/5'
      }`}>
        <div className="max-w-none mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => goBack()} className={`p-2 -ml-2 rounded-xl transition-colors ${
              isLight ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-white/10 text-slate-300'
            }`}>
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className={`text-sm font-black tracking-tight flex items-center gap-2 ${
                isLight ? 'text-slate-900' : 'text-white'
              }`}>
                Incident Flow
                <span className={`px-1.5 py-0.5 rounded-md text-[9px] uppercase font-bold ${
                  isLight ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-blue-500/20 text-blue-400'
                }`}>Live</span>
              </h1>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">{inc_id}</p>
            </div>
          </div>
          {/* 진행도 미니바 */}
          <div className="flex flex-col items-end gap-1 font-mono">
            <span className={`text-[11px] font-black tracking-wider ${
              isLight ? 'text-cyan-700' : 'text-[#00e5ff] drop-shadow-[0_0_8px_rgba(0,229,255,0.8)]'
            }`}>
              {Math.round(progress)}%
            </span>
            <div className={`w-20 h-1.5 rounded-full overflow-hidden p-0.5 border ${
              isLight ? 'bg-slate-200 border-slate-300' : 'bg-slate-800/80 border-white/5'
            }`}>
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  isLight ? 'bg-cyan-500' : 'bg-gradient-to-r from-blue-500 via-[#00e5ff] to-[#00ffc4] shadow-[0_0_10px_rgba(0,229,255,0.6)] animate-pulse'
                }`} 
                style={{ width: `${progress}%` }} 
              />
            </div>
          </div>
        </div>

        {/* 모바일 탭 네비게이션 (lg 이하에서만 표시) */}
        <div className={`lg:hidden flex border-t ${
          isLight ? 'border-slate-200 bg-white' : 'border-white/5'
        }`}>
          <button onClick={() => setActiveTab('info')} className={`flex-1 py-3 text-xs font-black transition-colors relative ${activeTab === 'info' ? (isLight ? 'text-blue-600' : 'text-blue-400') : 'text-slate-500'}`}>
            상세 정보
            {activeTab === 'info' && <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />}
          </button>
          <button onClick={() => setActiveTab('timeline')} className={`flex-1 py-3 text-xs font-black transition-colors relative ${activeTab === 'timeline' ? (isLight ? 'text-blue-600' : 'text-blue-400') : 'text-slate-500'}`}>
            대응 타임라인
            {activeTab === 'timeline' && <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />}
          </button>
        </div>
      </header>

      {/* 메인 콘텐츠 영역 */}
      <main className="flex-1 relative z-10 w-full max-w-none mx-auto">
        <div className="p-4 lg:p-6 h-full">
          {/* 데스크탑: 2단 레이아웃, 모바일: 탭 스위칭 */}
          <div className="hidden lg:grid grid-cols-12 gap-8 h-full">
            <div className="col-span-5 flex flex-col h-[calc(100vh-8rem)] overflow-y-auto pr-2 custom-scrollbar">
              {InfoContent()}
            </div>
            <div className="col-span-7 flex flex-col h-[calc(100vh-8rem)] overflow-y-auto pl-2 custom-scrollbar">
              {TimelineContent()}
            </div>
          </div>
          
          <div className="block lg:hidden">
            <AnimatePresence mode="wait">
              {activeTab === 'info' ? (
                <motion.div key="info" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                  {InfoContent()}
                </motion.div>
              ) : (
                <motion.div key="timeline" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}>
                  {TimelineContent()}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}
