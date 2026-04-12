import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, ArrowLeft, CheckCircle2, Zap, Shield, Calendar, BarChart3, ChevronRight, User, Clock, Terminal, Printer, LayoutGrid, UserX } from 'lucide-react';

const API_BASE = 'https://sguardai.khcho0421.workers.dev';

const FLOW_STEPS = [
  { id: 'SMS', label: 'SMS 수신 및 장애 인지', icon: Terminal, color: 'blue' },
  { id: 'RAG_AGENT', label: 'AI AGENT 분석 완료', icon: Zap, color: 'purple' },
  { id: 'WARROOM', label: '워룸 생성 및 할당', icon: Activity, color: 'indigo' },
  { id: 'KNOWLEDGE', label: '장애 대응 및 지식화', icon: CheckCircle2, color: 'emerald' }
];

export default function WorkflowPage() {
  const { inc_id } = useParams();
  const navigate = useNavigate();
  const [incidentData, setIncidentData] = useState(null);
  const [workflowLogs, setWorkflowLogs] = useState([]);
  const [assignees, setAssignees] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(true);

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
    const yy = String(d.getFullYear()).slice(2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${yy}/${mm}/${dd} ${hh}:${min}:${ss}`;
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!inc_id) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const normId = inc_id.replace('INC-', '');
        let incRes = await fetch(`${API_BASE}/ai/incident/${normId}`);
        if (!incRes.ok) incRes = await fetch(`${API_BASE}/sms/${normId}`);

        if (incRes.ok) {
          const data = await incRes.json();
          const incData = data.incident || data; 
          setIncidentData({
            title: incData.title || incData.message || incData.description,
            sender: incData.sender || 'SYSTEM',
            created_at: incData.created_at || incData.timestamp || incData.reg_dt,
            assigned_at: incData.assigned_at || incData.reg_dt,
            assignees: incData.assignee_name || incData.assignees || '조경훈',
            severity: incData.severity || 'NORMAL'
          });
        }

        const flowUrl = `${API_BASE}/ai/incident/workflow-details?inc_id=${inc_id}`;
        console.log("[Workflow Debug] Fetching flowUrl:", flowUrl);
        const flowRes = await fetch(flowUrl);
        if (flowRes.ok) {
          const flowData = await flowRes.json();
          console.log("[Workflow Debug] Fetched flowData:", flowData);
          setWorkflowLogs(flowData.steps || []);
          setAssignees(flowData.assignees || []);
        }
      } catch (e) {
        console.error("Workflow fetch error:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [inc_id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0c14] flex flex-col items-center justify-center text-white overflow-hidden">
        <div className="relative">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-24 h-24 rounded-full border-t-2 border-b-2 border-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.3)]"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <Activity className="w-8 h-8 text-blue-400 animate-pulse" />
          </div>
        </div>
        <motion.p 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-slate-500 font-mono text-[10px] tracking-[0.3em] uppercase mt-8"
        >
          Synchronizing Neural Pipeline
        </motion.p>
      </div>
    );
  }

  const firstPendingIdx = FLOW_STEPS.findIndex(step => {
    if (step.id === 'RAG_AGENT') return !workflowLogs.find(l => l.id === 'RAG') && !workflowLogs.find(l => l.id === 'AGENT');
    return !workflowLogs.find(l => l.id === step.id);
  });

  const startLog = workflowLogs.find(l => l.id === 'SMS');
  const endLog = workflowLogs.find(l => l.id === 'KNOWLEDGE');
  const startTime = startLog ? new Date(startLog.timestamp) : (incidentData?.created_at ? new Date(incidentData.created_at) : null);
  const endTime = endLog ? new Date(endLog.timestamp) : null;
  const durationMs = (startTime && !isNaN(startTime.getTime())) ? (endTime || currentTime) - startTime : 0;
  const isClosed = !!endTime;

  const totalPossibleSteps = FLOW_STEPS.length;
  const completedSteps = FLOW_STEPS.filter((step, idx) => {
    if (step.id === 'RAG_AGENT') return workflowLogs.find(l => l.id === 'RAG') || workflowLogs.find(l => l.id === 'AGENT');
    return workflowLogs.find(l => l.id === step.id);
  }).length;
  const progressPercent = (completedSteps / totalPossibleSteps) * 100;

  return (
    <div className="min-h-screen bg-[#0a0c14] text-white font-sans pb-32 selection:bg-blue-500/30">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/5 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/5 blur-[120px] rounded-full" />
      </div>

      <header className="sticky top-0 z-50 bg-[#0a0c14]/60 backdrop-blur-2xl border-b border-white/5 shadow-2xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate(-1)} 
              className="p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all group"
            >
              <ArrowLeft className="w-5 h-5 text-slate-400 group-hover:text-white" />
            </motion.button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-black tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                  Incident Intelligence Flow
                </h1>
                <div className="px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-[9px] font-black text-blue-400 tracking-widest uppercase">
                  Real-time
                </div>
              </div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-1">S-GUARD AI ANALYTICS PIPELINE</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Process Stability</span>
              <div className="flex items-center gap-2">
                <div className="w-32 h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    className="h-full bg-gradient-to-r from-blue-600 to-indigo-500"
                  />
                </div>
                <span className="text-xs font-mono text-blue-400 font-bold">{Math.round(progressPercent)}%</span>
              </div>
            </div>
            <div className="px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl font-mono text-[10px] font-black text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
              {inc_id}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 pt-12 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-28">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-[#151926]/40 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-8 shadow-2xl overflow-hidden relative group"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl rounded-full" />
              
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2.5 bg-red-500/10 rounded-xl border border-red-500/20">
                    <Shield className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-red-500/80">Active Emergency</span>
                    <h2 className="text-xs font-bold text-slate-400 mt-0.5">LIFECYCLE ALPHA-7</h2>
                  </div>
                </div>

                <h3 className="text-xl font-black text-white leading-tight mb-8 group-hover:text-blue-400 transition-colors">
                  {incidentData?.title || inc_id}
                </h3>

                <div className="space-y-6">
                  <div className="p-5 bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 transition-all">
                    <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-3 block">MTTR (In-Progress Time)</span>
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${isClosed ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-blue-500 animate-pulse shadow-[0_0_15px_rgba(59,130,246,0.8)]'}`} />
                      <span className="text-4xl font-black font-mono tracking-tighter tabular-nums">
                        {formatDuration(durationMs)}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                      <div className="flex items-center gap-3">
                        <Calendar className="w-4 h-4 text-slate-500" />
                        <span className="text-[11px] font-bold text-slate-400">Detection</span>
                      </div>
                      <span className="text-[11px] font-mono font-bold text-white">{formatYYMMDD(incidentData?.created_at)}</span>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                      <div className="flex items-center gap-3">
                        <User className="w-4 h-4 text-slate-500" />
                        <span className="text-[11px] font-bold text-slate-400">Reporter</span>
                      </div>
                      <span className="text-[11px] font-bold text-white">{incidentData?.sender || 'SYSTEM'}</span>
                    </div>
                    <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                      <div className="flex items-center gap-3 mb-3">
                        <LayoutGrid className="w-4 h-4 text-slate-500" />
                        <span className="text-[11px] font-bold text-slate-400">Response Team</span>
                        <span className="ml-auto text-[10px] font-black text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-md uppercase tracking-tighter">
                          {assignees.length} members
                        </span>
                      </div>
                      <div className="space-y-2">
                        {assignees.length > 0 ? (
                          assignees.map((asgn, idx) => (
                            <div key={`${asgn.user_id}-${idx}`} className="flex items-center justify-between group/user">
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full shadow-lg ${
                                  asgn.status === '처리완료' ? 'bg-emerald-500' : 
                                  asgn.status === '미참여' ? 'bg-slate-700' : 
                                  'bg-orange-500 animate-pulse ring-4 ring-orange-500/20'
                                }`} />
                                <span className="text-[11px] font-bold text-white group-hover/user:text-blue-400 transition-colors">{asgn.name || asgn.user_id}</span>
                              </div>
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1.5 shadow-sm transition-all border ${
                                asgn.status === '처리완료' 
                                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                                  : asgn.status === '미참여'
                                  ? 'bg-slate-800/50 text-slate-500 border-white/5 opacity-60'
                                  : 'bg-orange-500/20 text-orange-400 border-orange-500/30 animate-pulse shadow-[0_0_10px_rgba(249,115,22,0.2)]'
                              }`}>
                                {asgn.status === '처리중' && <Zap className="w-2.5 h-2.5 text-orange-400" />}
                                {asgn.status === '처리완료' && <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />}
                                {asgn.status === '미참여' && <UserX className="w-2.5 h-2.5 text-slate-600" />}
                                {asgn.status}
                              </span>
                            </div>
                          ))
                        ) : (
                          <span className="text-[11px] text-slate-600 italic">No assignees found</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex gap-3">
                   <motion.button 
                     whileHover={{ y: -2 }}
                     onClick={() => window.print()}
                     className="flex-1 py-4 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 flex items-center justify-center gap-2 text-[11px] font-black text-slate-400 hover:text-white transition-all shadow-lg"
                   >
                     <Printer className="w-3.5 h-3.5" /> PDF Summary
                   </motion.button>
                   <motion.button 
                     whileHover={{ y: -2 }}
                     onClick={() => navigate('/dashboard')}
                     className="flex-1 py-4 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 flex items-center justify-center gap-2 text-[11px] font-black text-slate-400 hover:text-white transition-all shadow-lg"
                   >
                     <LayoutGrid className="w-3.5 h-3.5" /> Dashboard
                   </motion.button>
                </div>
              </div>
            </motion.div>
          </div>

          <div className="lg:col-span-8">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#151926]/40 backdrop-blur-xl border border-white/10 rounded-[3rem] p-10 lg:p-16 shadow-2xl relative"
            >
              <div className="absolute left-[58px] lg:left-[82px] top-24 bottom-24 w-[2px] bg-gradient-to-b from-blue-600/50 via-white/5 to-transparent" />
              
              <div className="space-y-12">
                <AnimatePresence>
                  {FLOW_STEPS.map((step, sIdx) => {
                    let stepLog = workflowLogs.find(l => l.id === step.id);
                    if (step.id === 'RAG_AGENT') {
                      stepLog = workflowLogs.find(l => l.id === 'RAG') || workflowLogs.find(l => l.id === 'AGENT');
                    }
                    const isCompleted = !!stepLog;
                    const isNextStep = sIdx === firstPendingIdx;
                    const Icon = step.icon;

                    return (
                      <motion.div 
                        key={step.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: sIdx * 0.15 }}
                        className="relative pl-20 lg:pl-28 group"
                      >
                        <div className={`absolute left-0 top-0 w-12 h-12 lg:w-16 lg:h-16 rounded-[1.5rem] lg:rounded-[2rem] border-2 border-[#151926] z-20 flex items-center justify-center transition-all duration-700
                          ${isCompleted 
                            ? `bg-${step.color === 'blue' ? 'blue' : step.color === 'purple' ? 'purple' : step.color === 'indigo' ? 'indigo' : 'emerald'}-600 border-white/20 shadow-[0_0_30px_rgba(59,130,246,0.3)]` 
                            : (isNextStep ? 'bg-[#0a0c14] border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.1)] scale-110' : 'bg-[#0a0c14] border-white/5')
                          }`}
                        >
                          <Icon className={`w-5 h-5 lg:w-7 lg:h-7 ${isCompleted ? 'text-white' : (isNextStep ? 'text-blue-400' : 'text-slate-800')}`} />
                          
                          {isNextStep && (
                            <motion.div 
                              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.2, 0.5] }}
                              transition={{ duration: 2, repeat: Infinity }}
                              className="absolute inset-0 rounded-[1.5rem] lg:rounded-[2rem] bg-blue-500/20"
                            />
                          )}
                        </div>

                        <div className={`transition-all duration-700 ${isCompleted ? 'opacity-100' : (isNextStep ? 'opacity-100 translate-x-1' : 'opacity-10')}`}>
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                            <div>
                              <h4 className={`text-xl lg:text-2xl font-black tracking-tight ${isCompleted ? 'text-white' : (isNextStep ? 'text-blue-400' : 'text-slate-600')}`}>
                                {step.label}
                              </h4>
                              {isCompleted && (
                                <div className="mt-2 text-[10px] font-mono text-slate-500 flex items-center gap-2">
                                  <Clock className="w-3 h-3" />
                                  {formatYYMMDD(stepLog.timestamp)}
                                </div>
                              )}
                            </div>

                            {isCompleted ? (
                              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                                <CheckCircle2 className="w-3 h-3" /> Verified
                              </div>
                            ) : (
                              isNextStep && (
                                <div className="flex items-center gap-4">
                                  <div className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] font-black text-blue-400 uppercase tracking-widest animate-pulse">
                                    Processing
                                  </div>
                                  {(() => {
                                    const prevStepLog = sIdx > 0 ? workflowLogs.find(l => l.id === FLOW_STEPS[sIdx-1].id) : null;
                                    if (prevStepLog) {
                                      const diff = currentTime - new Date(prevStepLog.timestamp);
                                      const m = Math.floor(diff / 60000);
                                      const s = Math.floor((diff % 60000) / 1000);
                                      return (
                                        <span className="text-[11px] font-mono font-black text-blue-400/60 tabular-nums">
                                          {String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
                                        </span>
                                      );
                                    }
                                    return null;
                                  })()}
                                </div>
                              )
                            )}
                          </div>

                          <div className={`p-6 rounded-2xl border transition-all duration-500 ${isCompleted ? 'bg-white/5 border-white/5' : (isNextStep ? 'bg-blue-500/5 border-blue-500/20 shadow-xl' : 'bg-transparent border-transparent')}`}>
                            <p className={`text-sm lg:text-base leading-relaxed ${isCompleted ? 'text-slate-400 font-medium' : (isNextStep ? 'text-slate-200 font-semibold' : 'text-slate-800')}`}>
                              {isCompleted ? stepLog.detail : (isNextStep ? '실시간 인공지능 분석 및 보안 정책 대조를 통한 대응 시퀀스가 활성화되었습니다. 시스템 무결성을 유지하며 처리 중입니다...' : '업무 단계 연결을 기다리는 중')}
                            </p>
                            
                            {(isCompleted || isNextStep) && step.id === 'WARROOM' && (
                              <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => navigate(`/chat/${inc_id}`)}
                                className={`mt-8 w-full group overflow-hidden relative flex items-center justify-center gap-4 py-5 rounded-2xl font-black text-sm transition-all ${isClosed ? 'bg-slate-800 text-slate-400' : 'bg-blue-600 text-white shadow-[0_20px_40px_rgba(37,99,235,0.3)] hover:shadow-[0_25px_60px_rgba(37,99,235,0.5)]'}`}
                              >
                                <Zap className={`w-5 h-5 fill-current ${isClosed ? '' : 'animate-pulse'}`} />
                                {isClosed ? 'View War-Room History' : 'Enter Live War-Room & Take Action'}
                                <ChevronRight className="w-5 h-5 group-hover:translate-x-1.5 transition-transform" />
                              </motion.button>
                            )}
                          </div>
                        </div>

                        {isCompleted && sIdx < FLOW_STEPS.length - 1 && (
                          <div className="absolute left-[54px] lg:left-[78px] top-full h-12 w-[10px] flex items-center justify-center pointer-events-none">
                            <div className="w-[1px] h-full bg-white/10" />
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        </div>


      </main>

      <style>{`
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
        ::selection {
          background: rgba(59, 130, 246, 0.3);
          color: white;
        }
      `}</style>
    </div>
  );
}
