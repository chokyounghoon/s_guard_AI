import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBackNavigation } from '../hooks/useBackNavigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, ArrowLeft, CheckCircle2, Zap, Shield, Calendar,
         ChevronRight, ChevronDown, User, Clock, Terminal, Printer,
         LayoutDashboard, UserX, MessageSquare, AlertTriangle, Users } from 'lucide-react';
import { getAuthHeaders } from '../lib/authStore';

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
            occurrence_count: d.occurrence_count || p['발생건수'] || null,
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
      <div className="bg-[#151926]/80 backdrop-blur-xl border border-white/5 rounded-3xl p-5 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-xl ${isClosed ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
              <Shield className={`w-4 h-4 ${isClosed ? 'text-emerald-400' : 'text-red-400'}`} />
            </div>
            <div>
              <span className={`text-[10px] font-black uppercase tracking-widest ${isClosed ? 'text-emerald-400' : 'text-red-400/90'}`}>
                {isClosed ? 'Incident Closed' : 'Active Emergency'}
              </span>
              <p className="text-[10px] text-slate-500">LIFECYCLE ALPHA-7</p>
            </div>
          </div>
          <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${
            isClosed ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                     : 'bg-red-500/10 text-red-400 border-red-500/20 animate-pulse'}`}>
            {isClosed ? 'CLOSED' : 'LIVE'}
          </span>
        </div>
        
        <div className="bg-black/20 rounded-2xl p-4 border border-white/5 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block mb-1">MTTR (복구소요시간)</span>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isClosed ? 'bg-emerald-500' : 'bg-blue-400 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]'}`} />
              <span className="text-3xl font-black font-mono tracking-tighter tabular-nums text-white drop-shadow-sm">{formatDuration(durMs)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between bg-white/[0.02] rounded-2xl p-3.5 border border-white/5 mt-3 text-xs flex-wrap gap-y-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-400 font-bold">인지시각:</span>
            <span className="font-mono font-bold text-slate-200">{fmt(incidentData?.created_at) || '-'}</span>
          </div>
          {isClosed && endT && (
            <div className="flex items-center gap-2 border-l border-white/10 pl-4">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-slate-400 font-bold">완료시각:</span>
              <span className="font-mono font-bold text-emerald-400">{fmt(endT)}</span>
            </div>
          )}
          <div className="flex items-center gap-2 border-l border-white/10 pl-4">
            <User className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-400 font-bold">발신자:</span>
            <span className="font-bold text-blue-400 truncate max-w-[120px]">{incidentData?.sender || 'SYSTEM'}</span>
          </div>
        </div>
      </div>

      {/* 구조화 장애 정보 */}
      {fields.length > 0 && (
        <div className="bg-[#151926]/80 backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden shadow-lg">
          <div className="px-5 py-4 border-b border-white/5 bg-white/[0.02]">
            <h3 className="text-xs font-black text-white flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-blue-400" />
              상세 정보
            </h3>
          </div>
          <div className="p-2">
            {fields.map(f => (
              <div key={f.label} className="flex flex-col sm:flex-row sm:items-start justify-between gap-1 sm:gap-4 p-3 hover:bg-white/[0.02] rounded-xl transition-colors">
                <span className="text-[11px] text-slate-500 font-bold shrink-0 pt-0.5">{f.label}</span>
                <span className={`text-[13px] break-all sm:text-right
                  ${f.highlight ? 'text-orange-400 font-bold' : f.mono ? 'text-slate-300 font-mono' : 'text-white'}
                  ${f.wrap ? 'whitespace-pre-wrap mt-1 sm:mt-0' : ''}`}>
                  {f.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Response Team */}
      <div className="bg-[#151926]/80 backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden shadow-lg">
        <div className="px-5 py-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
          <h3 className="text-xs font-black text-white flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-indigo-400" />
            대응팀
          </h3>
          <span className="text-[10px] font-black text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
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
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-black'
              : 'bg-slate-800 text-slate-400 border-white/10';
            const avatarBg = isDone || isActive
              ? 'bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.5)] font-black'
              : 'bg-slate-800 text-slate-500 border border-white/10';

            return (
              <div key={`${a.user_id}-${i}`} className="flex items-center justify-between p-3 bg-white/[0.02] rounded-2xl border border-white/5">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] ${avatarBg}`}>
                    {getInitials(a.name || a.user_id)}
                  </div>
                  <div>
                    <p className="text-[13px] font-black text-white tracking-tight">{a.name || a.user_id}</p>
                    <p className="text-[10px] text-slate-500/70 font-normal whitespace-nowrap overflow-hidden text-ellipsis max-w-[140px] tracking-tight">
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
      <div className="bg-[#151926]/40 backdrop-blur-xl border border-white/5 rounded-3xl shadow-2xl p-5 lg:p-8 pb-10">
        
        {/* 장애 처리 현황 요약 바 */}
        <div className="mb-8 p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-bold text-white">장애 처리 현황</h3>
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
                  isDone ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : isActive ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                  : 'bg-white/5 border-white/5 text-slate-500'
                }`}>
                  <span className="opacity-80">{label}</span>
                  <span className="font-mono tabular-nums inline-block w-[3.5rem] text-right">{timeStr}</span>
                  {isActive && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 ml-1" />}
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative">
          {/* 타임라인 선 */}
          <div className="absolute left-[15px] lg:left-[15px] top-4 bottom-4 w-[2px] bg-gradient-to-b from-blue-600/50 via-white/10 to-transparent pointer-events-none" />

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
                    {/* 원형 타임라인 노드 */}
                    <div className={`absolute left-[3px] lg:left-[3px] top-4 w-6 h-6 rounded-full z-20 flex items-center justify-center transition-all duration-500 border ${
                      done ? 'bg-emerald-500 border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.8)]' : next ? 'bg-blue-600 border-blue-400 shadow-[0_0_12px_rgba(37,99,235,0.8)] animate-pulse' : 'bg-slate-800 border-slate-700'
                    }`}>
                      <Icon className={`w-3.5 h-3.5 ${done || next ? 'text-white' : 'text-slate-500'}`} />
                    </div>

                    {/* 콘텐츠 카드 */}
                    <div className={`p-4 lg:p-5 rounded-2xl border transition-all duration-300 ${done ? 'bg-white/[0.03] border-white/10 shadow-lg' : next ? 'bg-blue-900/15 border-blue-500/40 shadow-[0_0_20px_rgba(37,99,235,0.15)]' : 'bg-transparent border-transparent opacity-40'}`}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2 border-b border-white/5 pb-2.5">
                        <h4 className={`text-sm font-black tracking-tight flex items-center gap-1.5 ${done ? 'text-white' : next ? 'text-blue-400 font-bold tracking-wide' : 'text-slate-500'}`}>
                          <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-400">STEP {sIdx + 1}</span>
                          {step.label}
                        </h4>
                        {done ? (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-slate-400 bg-black/30 px-2 py-0.5 rounded-md">{fmt(log.timestamp)}</span>
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          </div>
                        ) : next && (
                          <span className="text-[10px] font-black text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md uppercase border border-blue-500/20 shadow-[0_0_8px_rgba(59,130,246,0.5)]">Processing</span>
                        )}
                      </div>
                      
                      <div className={`text-xs sm:text-sm leading-relaxed mt-2 ${done ? 'text-slate-300' : next ? 'text-blue-200' : 'text-slate-600'}`}>
                        {done ? (
                          <div className="space-y-1">
                            <strong className="text-white font-black block text-xs tracking-tight text-blue-400">{stepPrefixes[step.id]}</strong>
                            <p className="font-normal text-slate-300 leading-relaxed">{log.detail}</p>
                          </div>
                        ) : next ? (
                          <div className="space-y-1">
                            <strong className="text-blue-400 font-black block text-xs tracking-tight">{stepPrefixes[step.id]} (진행 중)</strong>
                            <p className="font-normal text-blue-200/90 leading-relaxed">실시간 AI 분석 및 보안 정책 대조를 통한 대응 시퀀스가 활성화되었습니다.</p>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <strong className="text-slate-500 font-black block text-xs tracking-tight">{stepPrefixes[step.id]} (대기)</strong>
                            <p className="font-normal text-slate-600 leading-relaxed">이전 단계 완료 대기 중</p>
                          </div>
                        )}
                      </div>

                      {/* 소요 시간 라벨 (소요시간 vs 경과시간 Live Dot 분리) */}
                      {intervalText && sIdx > 0 && (
                        <div className="mt-3.5 flex justify-end">
                          {isElapsedLive ? (
                            <span className="text-[11px] font-black px-3 py-1 rounded-full border bg-orange-500/15 text-orange-400 border-orange-500/30 shadow-[0_0_12px_rgba(249,115,22,0.25)] flex items-center gap-2">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
                              </span>
                              {intervalText} (진행 중)
                            </span>
                          ) : (
                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border shadow-sm ${
                              intervalMinutes > 60 ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
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
    <div className="bg-[#0a0c14] text-white font-sans flex flex-col min-h-screen">
      {/* 배경 */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-blue-600/10 blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] bg-indigo-600/10 blur-[120px] rounded-full mix-blend-screen" />
      </div>

      {/* 상단 앱바 */}
      <header className="sticky top-0 z-50 bg-[#0a0c14]/80 backdrop-blur-2xl border-b border-white/5">
        <div className="max-w-none mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => goBack()} className="p-2 -ml-2 rounded-xl hover:bg-white/10 transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-300" />
            </button>
            <div>
              <h1 className="text-sm font-black tracking-tight text-white flex items-center gap-2">
                Incident Flow
                <span className="px-1.5 py-0.5 rounded-md bg-blue-500/20 text-[9px] text-blue-400 uppercase">Live</span>
              </h1>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">{inc_id}</p>
            </div>
          </div>
          {/* 진행도 미니바 (형광 Cyan 포인트 튜닝) */}
          <div className="flex flex-col items-end gap-1 font-mono">
            <span className="text-[11px] font-black text-[#00e5ff] tracking-wider drop-shadow-[0_0_8px_rgba(0,229,255,0.8)]">
              {Math.round(progress)}%
            </span>
            <div className="w-20 h-1.5 bg-slate-800/80 rounded-full overflow-hidden p-0.5 border border-white/5">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 via-[#00e5ff] to-[#00ffc4] rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(0,229,255,0.6)] animate-pulse" 
                style={{ width: `${progress}%` }} 
              />
            </div>
          </div>
        </div>

        {/* 모바일 탭 네비게이션 (lg 이하에서만 표시) */}
        <div className="lg:hidden flex border-t border-white/5">
          <button onClick={() => setActiveTab('info')} className={`flex-1 py-3 text-xs font-black transition-colors relative ${activeTab === 'info' ? 'text-blue-400' : 'text-slate-500'}`}>
            상세 정보
            {activeTab === 'info' && <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />}
          </button>
          <button onClick={() => setActiveTab('timeline')} className={`flex-1 py-3 text-xs font-black transition-colors relative ${activeTab === 'timeline' ? 'text-blue-400' : 'text-slate-500'}`}>
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
