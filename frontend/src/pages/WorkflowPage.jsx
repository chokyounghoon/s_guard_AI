import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, ArrowLeft, CheckCircle2, Zap, Shield, Calendar,
         ChevronRight, ChevronDown, User, Clock, Terminal, Printer,
         LayoutGrid, UserX, MessageSquare } from 'lucide-react';
import { getAuthHeaders } from '../lib/authStore';

const API_BASE = 'https://sguardai.khcho0421.workers.dev';

const FLOW_STEPS = [
  { id: 'SMS',       label: 'SMS 수신 및 장애 인지',  icon: Terminal,    color: 'blue' },
  { id: 'RAG_AGENT', label: 'AI AGENT 분석 완료',     icon: Zap,         color: 'purple' },
  { id: 'WARROOM',   label: '워룸 생성 및 할당',       icon: Activity,    color: 'indigo' },
  { id: 'KNOWLEDGE', label: '장애 대응 및 지식화',     icon: CheckCircle2, color: 'emerald' }
];

/** ▶ 키 : [값] 형태의 MCI SMS 메시지 파싱 */
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
  const [incidentData, setIncidentData] = useState(null);
  const [workflowLogs, setWorkflowLogs] = useState([]);
  const [assignees, setAssignees] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [showRawMsg, setShowRawMsg] = useState(false);

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
        className="w-20 h-20 rounded-full border-t-2 border-b-2 border-blue-500" />
      <p className="text-slate-500 font-mono text-[10px] tracking-[0.3em] uppercase mt-6">Synchronizing Neural Pipeline</p>
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

  // 구조화된 필드 목록 (값 있는 것만)
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
  ].filter(f => f.value);

  const PANEL_H = 'calc(100vh - 7.5rem)';

  return (
    <div className="bg-[#0a0c14] text-white font-sans flex flex-col" style={{ height: '100vh', overflow: 'hidden' }}>
      {/* 배경 그래디언트 */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/5 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/5 blur-[120px] rounded-full" />
      </div>

      {/* 헤더 */}
      <header className="z-50 bg-[#0a0c14]/90 backdrop-blur-2xl border-b border-white/5 flex-shrink-0">
        <div className="max-w-7xl mx-auto px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={() => navigate(-1)}
              className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all group">
              <ArrowLeft className="w-4 h-4 text-slate-400 group-hover:text-white" />
            </motion.button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-black tracking-tight text-white">Incident Intelligence Flow</h1>
                <span className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-[9px] font-black text-blue-400 uppercase tracking-widest">Real-time</span>
              </div>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.2em]">S-GUARD AI ANALYTICS PIPELINE</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Process Stability</span>
              <div className="flex items-center gap-2">
                <div className="w-24 h-1 bg-white/5 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }}
                    className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 rounded-full" />
                </div>
                <span className="text-xs font-mono text-blue-400 font-bold">{Math.round(progress)}%</span>
              </div>
            </div>
            <div className="px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg font-mono text-[9px] font-black text-blue-400">{inc_id}</div>
          </div>
        </div>
      </header>

      {/* 메인 — 좌우 동일 높이, 각자 스크롤 */}
      <main className="flex-1 relative z-10 overflow-hidden md:overflow-hidden overflow-y-auto">
        <div className="max-w-6xl mx-auto px-4 md:px-5 py-4 md:py-5 md:h-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-5 md:h-full">

            {/* ── 좌측 패널 ── */}
            <div className="lg:col-span-4 flex flex-col" style={{ height: window.innerWidth >= 1024 ? PANEL_H : 'auto' }}>
              <div className="bg-[#151926]/70 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ minHeight: '300px' }}>

                {/* 고정 헤더 */}
                <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-white/5 space-y-3">
                  {/* 뱃지 */}
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-red-500/10 rounded-lg border border-red-500/20">
                      <Shield className="w-3.5 h-3.5 text-red-400" />
                    </div>
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-red-400/80">Active Emergency</span>
                      <p className="text-[9px] text-slate-500 leading-none">LIFECYCLE ALPHA-7</p>
                    </div>
                    <span className={`ml-auto text-[9px] font-black px-2 py-0.5 rounded-full border ${
                      isClosed ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                               : 'bg-orange-500/10 text-orange-400 border-orange-500/20 animate-pulse'}`}>
                      {isClosed ? 'CLOSED' : 'LIVE'}
                    </span>
                  </div>

                  {/* MTTR */}
                  <div className="px-3 py-2.5 bg-white/5 rounded-xl border border-white/5">
                    <span className="text-[8px] text-slate-500 font-black uppercase tracking-widest">MTTR</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isClosed ? 'bg-emerald-500' : 'bg-blue-400 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]'}`} />
                      <span className="text-2xl font-black font-mono tracking-tighter tabular-nums">{formatDuration(durMs)}</span>
                    </div>
                  </div>

                  {/* Detection / Reporter */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="px-3 py-2 bg-white/5 rounded-xl border border-white/5">
                      <div className="flex items-center gap-1 mb-0.5">
                        <Calendar className="w-2.5 h-2.5 text-slate-500" />
                        <span className="text-[8px] font-bold text-slate-500 uppercase">인지시각</span>
                      </div>
                      <span className="text-[9px] font-mono font-bold text-white leading-tight block">{fmt(incidentData?.created_at)}</span>
                    </div>
                    <div className="px-3 py-2 bg-white/5 rounded-xl border border-white/5">
                      <div className="flex items-center gap-1 mb-0.5">
                        <User className="w-2.5 h-2.5 text-slate-500" />
                        <span className="text-[8px] font-bold text-slate-500 uppercase">발신자</span>
                      </div>
                      <span className="text-[9px] font-bold text-white leading-tight block truncate">{incidentData?.sender || 'SYSTEM'}</span>
                    </div>
                  </div>
                </div>

                {/* 스크롤 가능 본문 */}
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>

                  {/* 구조화 장애 정보 */}
                  {fields.length > 0 && (
                    <section>
                      <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest mb-2">장애 상세 정보</p>
                      <div className="space-y-1">
                        {fields.map(f => (
                          <div key={f.label} className="flex items-start gap-2 px-3 py-2 bg-white/[0.04] rounded-lg border border-white/[0.06] hover:bg-white/[0.07] transition-colors">
                            <span className="text-[9px] text-slate-500 font-bold min-w-[60px] flex-shrink-0 mt-px">{f.label}</span>
                            <span className={`text-[11px] leading-snug break-all font-medium
                              ${f.highlight ? 'text-orange-300' : f.mono ? 'text-slate-300 font-mono' : 'text-white'}
                              ${f.wrap ? 'whitespace-pre-wrap' : ''}`}>
                              {f.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* 원문 SMS 토글 */}
                  {incidentData?.rawMessage && (
                    <section>
                      <button onClick={() => setShowRawMsg(v => !v)}
                        className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-300 transition-colors w-full mb-1.5">
                        <MessageSquare className="w-2.5 h-2.5" />
                        원문 SMS 전문
                        <ChevronDown className={`w-2.5 h-2.5 ml-auto transition-transform ${showRawMsg ? 'rotate-180' : ''}`} />
                      </button>
                      {showRawMsg && (
                        <div className="bg-black/40 border border-white/5 rounded-xl p-3 max-h-36 overflow-y-auto">
                          <p className="text-[10px] text-slate-400 font-mono leading-relaxed break-all whitespace-pre-wrap">
                            {incidentData.rawMessage}
                          </p>
                        </div>
                      )}
                    </section>
                  )}

                  {/* Response Team */}
                  <section>
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest">Response Team</p>
                      <span className="ml-auto text-[8px] font-black text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">{assignees.length} members</span>
                    </div>
                    <div className="space-y-1">
                      {assignees.length > 0 ? assignees.map((a, i) => (
                        <div key={`${a.user_id}-${i}`} className="flex items-center justify-between px-3 py-2 bg-white/[0.04] rounded-lg border border-white/[0.06]">
                          <div className="flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                              a.status==='처리완료' ? 'bg-emerald-500' : a.status==='미참여' ? 'bg-slate-700' : 'bg-orange-400 animate-pulse'}`} />
                            <span className="text-[11px] font-bold text-white">{a.name || a.user_id}</span>
                          </div>
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 border ${
                            a.status==='처리완료' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                            a.status==='미참여'   ? 'bg-slate-800 text-slate-500 border-white/5' :
                                                    'bg-orange-500/20 text-orange-400 border-orange-500/30'}`}>
                            {a.status==='처리중'   && <Zap className="w-2 h-2" />}
                            {a.status==='처리완료' && <CheckCircle2 className="w-2 h-2" />}
                            {a.status==='미참여'   && <UserX className="w-2 h-2" />}
                            {a.status}
                          </span>
                        </div>
                      )) : <p className="text-[10px] text-slate-600 italic">No assignees found</p>}
                    </div>
                  </section>
                </div>

                {/* 하단 버튼 */}
                <div className="flex-shrink-0 px-4 py-3 border-t border-white/5 flex gap-2">
                  <motion.button whileHover={{ y: -1 }} onClick={() => window.print()}
                    className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 flex items-center justify-center gap-1.5 text-[10px] font-black text-slate-400 hover:text-white transition-all">
                    <Printer className="w-3 h-3" /> PDF
                  </motion.button>
                  <motion.button whileHover={{ y: -1 }} onClick={() => navigate('/dashboard')}
                    className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 flex items-center justify-center gap-1.5 text-[10px] font-black text-slate-400 hover:text-white transition-all">
                    <LayoutGrid className="w-3 h-3" /> Dashboard
                  </motion.button>
                </div>
              </div>
            </div>

            {/* ── 우측 패널 ── */}
            <div className="lg:col-span-8 flex flex-col" style={{ height: window.innerWidth >= 1024 ? PANEL_H : 'auto' }}>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="bg-[#151926]/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl relative flex-1 overflow-y-auto"
                style={{ minHeight: '400px', scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
                {/* 수직 타임라인 선 */}
                <div className="absolute left-[68px] top-16 bottom-16 w-[1px] bg-gradient-to-b from-blue-600/40 via-white/5 to-transparent pointer-events-none" />

                <div className="p-8">
                  <div className="space-y-10">
                    <AnimatePresence>
                      {FLOW_STEPS.map((step, sIdx) => {
                        let log = workflowLogs.find(l => l.id === step.id);
                        if (step.id === 'RAG_AGENT') log = workflowLogs.find(l=>l.id==='RAG') || workflowLogs.find(l=>l.id==='AGENT');
                        const done = !!log;
                        const next = sIdx === firstPending;
                        const Icon = step.icon;

                        return (
                          <motion.div key={step.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: sIdx * 0.12 }} className="relative pl-20">

                            {/* 아이콘 */}
                            <div className={`absolute left-0 top-0 w-12 h-12 rounded-2xl border-2 border-[#151926] z-20 flex items-center justify-center transition-all duration-500
                              ${done
                                ? `bg-${step.color==='blue'?'blue':step.color==='purple'?'purple':step.color==='indigo'?'indigo':'emerald'}-600 shadow-lg`
                                : next ? 'bg-[#0a0c14] border-blue-500' : 'bg-[#0a0c14] border-white/5'}`}>
                              <Icon className={`w-5 h-5 ${done ? 'text-white' : next ? 'text-blue-400' : 'text-slate-800'}`} />
                              {next && (
                                <motion.div animate={{ scale:[1,1.3,1], opacity:[0.4,0.1,0.4] }}
                                  transition={{ duration: 2, repeat: Infinity }}
                                  className="absolute inset-0 rounded-2xl bg-blue-500/20" />
                              )}
                            </div>

                            {/* 내용 */}
                            <div className={`transition-all duration-500 ${done||next ? 'opacity-100' : 'opacity-10'}`}>
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                                <div>
                                  <h4 className={`text-base font-black ${done ? 'text-white' : next ? 'text-blue-400' : 'text-slate-600'}`}>
                                    {step.label}
                                  </h4>
                                  {done && (
                                    <div className="mt-0.5 flex items-center gap-1.5 text-[10px] font-mono text-slate-500">
                                      <Clock className="w-2.5 h-2.5" />
                                      {fmt(log.timestamp)}
                                    </div>
                                  )}
                                </div>
                                {done ? (
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-black text-emerald-400 uppercase tracking-widest flex-shrink-0">
                                    <CheckCircle2 className="w-2.5 h-2.5" /> VERIFIED
                                  </div>
                                ) : next && (
                                  <div className="px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[9px] font-black text-blue-400 uppercase tracking-widest animate-pulse flex-shrink-0">
                                    Processing…
                                  </div>
                                )}
                              </div>

                              <div className={`p-4 rounded-xl border transition-all duration-300
                                ${done ? 'bg-white/5 border-white/5' : next ? 'bg-blue-500/5 border-blue-500/20' : 'bg-transparent border-transparent'}`}>
                                <p className={`text-sm leading-relaxed ${done ? 'text-slate-300' : next ? 'text-slate-200 font-semibold' : 'text-slate-800'}`}>
                                  {done ? log.detail : next
                                    ? '실시간 AI 분석 및 보안 정책 대조를 통한 대응 시퀀스가 활성화되었습니다.'
                                    : '업무 단계 연결을 기다리는 중'}
                                </p>

                                {(done || next) && step.id === 'WARROOM' && (
                                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                    onClick={() => navigate(`/chat/${inc_id}`)}
                                    className={`mt-5 w-full flex items-center justify-center gap-3 py-4 rounded-xl font-black text-sm transition-all
                                      ${isClosed ? 'bg-slate-800 text-slate-400' : 'bg-blue-600 text-white shadow-[0_10px_30px_rgba(37,99,235,0.35)] hover:shadow-[0_15px_40px_rgba(37,99,235,0.5)]'}`}>
                                    <Zap className={`w-4 h-4 fill-current ${isClosed ? '' : 'animate-pulse'}`} />
                                    {isClosed ? 'View War-Room History' : 'Enter Live War-Room & Take Action'}
                                    <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                                  </motion.button>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
