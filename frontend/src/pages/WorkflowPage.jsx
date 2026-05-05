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
  { id: 'WARROOM',   label: '워룸 생성 및 할당',       icon: Activity,    color: 'indigo' },
  { id: 'KNOWLEDGE', label: '장애 대응 및 지식화',     icon: CheckCircle2, color: 'emerald' }
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
        const normId = inc_id.replace('INC-', '');
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

        <div className="grid grid-cols-2 gap-3 mt-3">
          <div className="bg-white/[0.02] rounded-xl p-3 border border-white/5">
            <div className="flex items-center gap-1.5 mb-1">
              <Calendar className="w-3 h-3 text-slate-500" />
              <span className="text-[9px] font-bold text-slate-500 uppercase">인지시각</span>
            </div>
            <span className="text-xs font-mono font-bold text-slate-300">{fmt(incidentData?.created_at) || '-'}</span>
          </div>
          <div className="bg-white/[0.02] rounded-xl p-3 border border-white/5">
            <div className="flex items-center gap-1.5 mb-1">
              <User className="w-3 h-3 text-slate-500" />
              <span className="text-[9px] font-bold text-slate-500 uppercase">발신자</span>
            </div>
            <span className="text-xs font-bold text-slate-300 truncate block">{incidentData?.sender || 'SYSTEM'}</span>
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
          {assignees.length > 0 ? assignees.map((a, i) => (
            <div key={`${a.user_id}-${i}`} className="flex items-center justify-between p-3 bg-white/[0.02] rounded-2xl border border-white/5">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-black text-[11px] shadow-inner ${getAvatarColor(a.name || a.user_id)}`}>
                  {getInitials(a.name || a.user_id)}
                </div>
                <div>
                  <p className="text-xs font-bold text-white">{a.name || a.user_id}</p>
                  <p className="text-[9px] text-slate-500 whitespace-nowrap overflow-hidden text-ellipsis max-w-[140px]">
                    {a.user_id} {a.team_name || a.part_name ? `· ${[a.team_name, a.part_name].filter(Boolean).join(' ')}` : ''}
                  </p>
                </div>
              </div>
              <span className={`text-[9px] font-black px-2 py-1 rounded-full flex items-center gap-1 border ${
                a.status==='처리완료' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                a.status==='미참여'   ? 'bg-slate-800 text-slate-500 border-white/5' :
                                        'bg-orange-500/10 text-orange-400 border-orange-500/20'}`}>
                {a.status==='처리중'   && <Zap className="w-2.5 h-2.5" />}
                {a.status==='처리완료' && <CheckCircle2 className="w-2.5 h-2.5" />}
                {a.status==='미참여'   && <UserX className="w-2.5 h-2.5" />}
                {a.status}
              </span>
            </div>
          )) : <div className="p-4 text-center text-[11px] text-slate-500 col-span-2">할당된 담당자가 없습니다.</div>}
        </div>
      </div>

      {/* 원문 SMS */}
      {incidentData?.rawMessage && (
        <div className="bg-[#151926]/80 backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden shadow-lg">
          <button onClick={() => setShowRawMsg(!showRawMsg)} className="w-full px-5 py-4 flex items-center justify-between bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
            <h3 className="text-xs font-black text-white flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
              원문 SMS 전문
            </h3>
            <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${showRawMsg ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence>
            {showRawMsg && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="p-5 bg-black/40 border-t border-white/5">
                  <p className="text-[11px] text-slate-400 font-mono leading-relaxed break-all whitespace-pre-wrap">
                    {incidentData.rawMessage}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

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
          <div className="absolute left-[19px] lg:left-[23px] top-4 bottom-4 w-[2px] bg-gradient-to-b from-blue-600/50 via-white/10 to-transparent pointer-events-none" />

          <div className="space-y-8 relative z-10">
            <AnimatePresence>
              {FLOW_STEPS.map((step, sIdx) => {
                let log = workflowLogs.find(l => l.id === step.id);
                if (step.id === 'RAG_AGENT') log = workflowLogs.find(l=>l.id==='RAG') || workflowLogs.find(l=>l.id==='AGENT');
                const done = !!log;
            const next = sIdx === firstPending;
            const Icon = step.icon;

            let intervalText = null;
            let intervalMinutes = 0;
            if (done && sIdx < FLOW_STEPS.length - 1) {
              const nextId = FLOW_STEPS[sIdx+1].id;
              let nextLog = workflowLogs.find(l => l.id === nextId);
              if (!nextLog && nextId === 'RAG_AGENT') {
                nextLog = workflowLogs.find(l => l.id === 'RAG') || workflowLogs.find(l => l.id === 'AGENT');
              }
              if (nextLog) {
                const diff = new Date(nextLog.timestamp) - new Date(log.timestamp);
                const m = Math.floor(diff / 60000);
                const sec = Math.floor((diff % 60000) / 1000);
                intervalMinutes = m;
                intervalText = m > 60 ? `⏱ ${Math.floor(m/60)}시간 ${m%60}분 소요` : m > 0 ? `⏱ ${m}분 ${sec}초 소요` : `⏱ ${sec}초 소요`;
              } else if (sIdx === firstPending - 1) {
                const diff = currentTime - new Date(log.timestamp);
                const m = Math.floor(diff / 60000);
                const sec = Math.floor((diff % 60000) / 1000);
                intervalMinutes = m;
                intervalText = m > 60 ? `⏱ ${Math.floor(m/60)}시간 ${m%60}분 경과` : m > 0 ? `⏱ ${m}분 ${sec}초 경과` : `⏱ ${sec}초 경과`;
              }
            }

            return (
              <motion.div key={step.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: sIdx * 0.1 }} className="relative pl-14 lg:pl-20">
                {/* 아이콘 마커 */}
                <div className={`absolute left-0 top-0 w-10 h-10 lg:w-12 lg:h-12 rounded-2xl border-2 border-[#0a0c14] z-20 flex items-center justify-center transition-all duration-500
                  ${done ? `bg-${step.color}-500 shadow-[0_0_15px_rgba(var(--color-${step.color}-500),0.5)]` : next ? 'bg-[#151926] border-blue-500' : 'bg-[#151926] border-white/10'}`}>
                  <Icon className={`w-4 h-4 lg:w-5 lg:h-5 ${done ? 'text-white' : next ? 'text-blue-400' : 'text-slate-600'}`} />
                </div>

                {/* 콘텐츠 카드 */}
                <div className={`p-4 lg:p-5 rounded-2xl border transition-all duration-300 ${done ? 'bg-white/[0.03] border-white/10 shadow-lg' : next ? 'bg-blue-900/10 border-blue-500/30 shadow-[0_0_20px_rgba(37,99,235,0.1)]' : 'bg-transparent border-transparent opacity-40'}`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <h4 className={`text-base font-black tracking-tight ${done ? 'text-white' : next ? 'text-blue-400' : 'text-slate-500'}`}>
                      {step.label}
                    </h4>
                    {done ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-slate-400 bg-black/30 px-2 py-0.5 rounded-md">{fmt(log.timestamp)}</span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      </div>
                    ) : next && (
                      <span className="text-[10px] font-black text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md uppercase border border-blue-500/20">Processing</span>
                    )}
                  </div>
                  
                  <p className={`text-sm leading-relaxed ${done ? 'text-slate-300' : next ? 'text-blue-200' : 'text-slate-600'}`}>
                    {done ? log.detail : next ? '실시간 AI 분석 및 보안 정책 대조를 통한 대응 시퀀스가 활성화되었습니다.' : '이전 단계 완료 대기 중'}
                  </p>


                  {/* 소요 시간 라벨 */}
                  {intervalText && sIdx < FLOW_STEPS.length - 1 && (
                    <div className="mt-3 flex justify-end">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border shadow-sm ${
                        intervalMinutes > 60 ? 'text-orange-400 bg-orange-500/10 border-orange-500/20' : intervalMinutes > 10 ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                      }`}>
                        {intervalText}
                      </span>
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
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
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
          {/* 진행도 미니바 */}
          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] font-black text-blue-400">{Math.round(progress)}%</span>
            <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
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
      <main className="flex-1 relative z-10 w-full max-w-7xl mx-auto">
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
