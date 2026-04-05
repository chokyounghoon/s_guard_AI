import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Activity, ArrowLeft, CheckCircle2, Zap, Shield, Calendar, BarChart3, ChevronRight, User } from 'lucide-react';

const API_BASE = 'https://sguardai.khcho0421.workers.dev';

const FLOW_STEPS = [
  { id: 'SMS', label: 'SMS 수신 및 장애 인지' },
  { id: 'RAG_AGENT', label: 'RAG 및 AI AGENT 분석 완료' },
  { id: 'WARROOM', label: '워룸생성 및 할당완료' },
  { id: 'KNOWLEDGE', label: '지식화/장애/보고 처리완료' }
];

export default function WorkflowPage() {
  const { inc_id } = useParams();
  const navigate = useNavigate();
  const [incidentData, setIncidentData] = useState(null);
  const [workflowLogs, setWorkflowLogs] = useState([]);
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
        
        // 1. Fetch incident base data
        let incRes = await fetch(`${API_BASE}/ai/incident/${normId}`);
        if (!incRes.ok) {
           incRes = await fetch(`${API_BASE}/sms/${normId}`);
        }

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

        // 2. Fetch Workflow Details (This endpoint aggregates everything)
        const flowRes = await fetch(`${API_BASE}/ai/incident/workflow-details?inc_id=${inc_id}`);
        if (flowRes.ok) {
          const flowData = await flowRes.json();
          // flowData.steps contains the aggregated timeline entries
          setWorkflowLogs(flowData.steps || []);
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
      <div className="min-h-screen bg-[#0f111a] flex flex-col items-center justify-center text-white">
        <Activity className="w-12 h-12 text-blue-500 animate-pulse mb-4" />
        <p className="text-slate-400 font-mono text-sm tracking-widest uppercase">Initializing Workflow View</p>
      </div>
    );
  }

  const firstPendingIdx = FLOW_STEPS.findIndex(step => {
    if (step.id === 'RAG_AGENT') {
      return !workflowLogs.find(l => l.id === 'RAG') && !workflowLogs.find(l => l.id === 'AGENT');
    }
    return !workflowLogs.find(l => l.id === step.id);
  });

  const startLog = workflowLogs.find(l => l.id === 'SMS');
  const endLog = workflowLogs.find(l => l.id === 'KNOWLEDGE');
  
  const startTime = startLog ? new Date(startLog.timestamp) : (incidentData?.created_at ? new Date(incidentData.created_at) : null);
  const endTime = endLog ? new Date(endLog.timestamp) : null;
  const durationMs = (startTime && !isNaN(startTime.getTime())) ? (endTime || currentTime) - startTime : 0;

  const isClosed = !!endTime;

  return (
    <div className="min-h-screen bg-[#0f111a] text-white font-sans pb-32">
      {/* Header */}
      <header className="flex items-center justify-between p-6 sticky top-0 bg-[#0f111a]/80 backdrop-blur-xl z-50 border-b border-white/5 shadow-2xl">
        <div className="flex items-center space-x-4">
          <button onClick={() => navigate(-1)} className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors border border-white/10 group">
            <ArrowLeft className="w-5 h-5 text-slate-400 group-hover:text-white" />
          </button>
          <div>
            <h1 className="text-xl font-black tracking-tight flex items-center gap-3">
              인시던트 상세 처리 흐름
              <span className="text-[10px] bg-blue-500 text-white px-2 py-0.5 rounded-md font-black uppercase tracking-widest">LIVE TRACKING</span>
            </h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-0.5">S-GUARD AI LIFECYCLE MONITORING</p>
          </div>
        </div>
        <div className="px-4 py-2 bg-slate-800/80 rounded-xl border border-white/5 font-mono text-[11px] font-black text-blue-400">
          INC_ID: {inc_id}
        </div>
      </header>

      <main className="p-8 max-w-5xl mx-auto">
        {/* Top Summary Card */}
        <div className="bg-[#1a1f2e] rounded-[2rem] p-8 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] mb-10 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2" />
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center relative z-10 gap-8">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-red-500" />
                <span className="text-[10px] font-black uppercase tracking-widest text-red-500">Incident Detection Alpha</span>
              </div>
              <h2 className="text-2xl font-black mb-4 leading-tight group-hover:text-blue-400 transition-colors">
                [<span className="text-blue-400">{incidentData?.title || inc_id}</span>]
              </h2>
              <div className="flex items-center gap-6 text-[11px] text-slate-400 font-bold">
                <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-slate-500" /> {formatYYMMDD(incidentData?.created_at || incidentData?.assigned_at)}</div>
                <div className="flex items-center gap-2"><User className="w-4 h-4 text-slate-500" /> {incidentData?.sender || 'SYSTEM'}</div>
              </div>
            </div>

            <div className="flex gap-10 shrink-0">
               <div className="flex flex-col items-end">
                 <span className="text-[9px] uppercase tracking-widest opacity-60 font-black text-blue-400 mb-1">INITIAL DETECTION</span>
                 <span className="text-lg font-black font-mono text-white bg-slate-800/80 px-4 py-2 rounded-xl border border-white/5 shadow-xl">
                   {formatYYMMDD(incidentData?.created_at || incidentData?.assigned_at || startTime)}
                 </span>
               </div>
               <div className={`flex flex-col items-end ${isClosed ? 'text-emerald-400' : 'text-blue-400'}`}>
                 <span className="text-[9px] uppercase tracking-widest opacity-60 font-black mb-1">TOTAL ELAPSED (MTTR)</span>
                 <div className="flex items-center gap-3">
                   <div className={`w-3 h-3 rounded-full ${isClosed ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'bg-blue-500 animate-pulse shadow-[0_0_20px_rgba(37,99,235,0.8)]'}`} />
                   <span className="text-4xl font-black font-mono tracking-tighter tabular-nums text-white">
                     {formatDuration(durationMs)}
                   </span>
                 </div>
               </div>
            </div>
          </div>
        </div>
          
        {/* Detailed Info (Message & Assignee) */}
        <div className="flex flex-col md:flex-row gap-8 relative z-10 px-2 pb-2">
          <div className="flex-1 bg-white/5 p-6 rounded-2xl border border-white/5">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Incident Message</span>
            <p className="text-lg font-bold text-white leading-relaxed">
              {incidentData?.title || inc_id}
            </p>
          </div>
          <div className="w-full md:w-64 bg-white/5 p-6 rounded-2xl border border-white/5 flex flex-col justify-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Current Assignee</span>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                <User className="w-4 h-4 text-blue-400" />
              </div>
              <span className="text-lg font-black text-white">{incidentData?.assignees || '조경훈'}</span>
            </div>
          </div>
        </div>

        {/* Workflow Timeline Section */}
        <div className="bg-[#1a1f2e] rounded-[2.5rem] p-12 border border-white/5 shadow-2xl relative">
          {/* Central Vertical Line */}
          <div className="absolute left-[45px] top-16 bottom-16 w-[3px] bg-gradient-to-b from-blue-600 via-blue-400/20 to-transparent" />

          <div className="space-y-0 relative z-10">
            {FLOW_STEPS.map((step, sIdx) => {
              let stepLog = workflowLogs.find(l => l.id === step.id);
              
              // Handle RAG_AGENT combined logic
              if (step.id === 'RAG_AGENT') {
                stepLog = workflowLogs.find(l => l.id === 'RAG') || workflowLogs.find(l => l.id === 'AGENT');
              }

              const isCompleted = !!stepLog;
              const isNextStep = sIdx === firstPendingIdx;
              
              // Calculate interval duration to the NEXT step
              let intervalText = null;
              if (isCompleted && sIdx < FLOW_STEPS.length - 1) {
                const nextStepLog = workflowLogs.find(l => l.id === FLOW_STEPS[sIdx+1].id);
                if (nextStepLog) {
                  const diff = new Date(nextStepLog.timestamp) - new Date(stepLog.timestamp);
                  const m = Math.floor(diff / 60000);
                  const s = Math.floor((diff % 60000) / 1000);
                  intervalText = `⏱ ${m > 0 ? `${m}분 ` : ''}${s}초 소요`;
                }
              }

              return (
                <div key={step.id} className="relative pl-24 pb-16 group last:pb-0">
                  {/* Connecting Line Time Badge */}
                  {intervalText && (
                    <div className="absolute left-[60px] top-1/2 -translate-y-1/2 whitespace-nowrap z-20">
                      <span className="text-[10px] font-black text-slate-500 bg-[#0f111a] px-3 py-1 rounded-full border border-white/10 shadow-lg">
                        {intervalText}
                      </span>
                    </div>
                  )}

                  {/* Node Circle */}
                  <div className={`absolute left-0 top-0 w-12 h-12 rounded-[1.25rem] border-2 border-[#1a1f2e] z-30 flex items-center justify-center transition-all duration-700
                    ${isCompleted 
                      ? (step.id === 'KNOWLEDGE' ? 'bg-emerald-600 border-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.4)]' : 'bg-blue-600 border-blue-400 shadow-[0_0_25px_rgba(37,99,235,0.4)]')
                      : (isNextStep ? 'bg-blue-500/20 border-blue-400/50 shadow-[0_0_15px_rgba(37,99,235,0.1)]' : 'bg-[#0f111a] border-white/5')}`}>
                    
                    {isCompleted ? (
                       <CheckCircle2 className="w-5 h-5 text-white" />
                    ) : (
                       isNextStep ? (
                         <div className="relative flex h-4 w-4">
                           <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                           <span className="relative inline-flex rounded-full h-4 w-4 bg-blue-500"></span>
                         </div>
                       ) : (
                         <div className="w-2 h-2 rounded-full bg-slate-800" />
                       )
                    )}
                  </div>

                  <div className={`transition-all duration-700 ${isCompleted ? 'opacity-100 translate-x-0' : (isNextStep ? 'opacity-100 translate-x-2' : 'opacity-20')}`}>
                    <div className="flex items-center gap-4 mb-3">
                      <h4 className={`font-black text-xl tracking-tight ${isCompleted ? (step.id === 'KNOWLEDGE' ? 'text-emerald-400' : 'text-white') : (isNextStep ? 'text-blue-400' : 'text-slate-600')}`}>
                        {step.label}
                      </h4>
                      {isCompleted && (
                        <span className="text-[11px] text-white font-black font-mono bg-white/10 px-3 py-1 rounded-lg shadow-lg border border-white/5">
                          {formatYYMMDD(stepLog.timestamp)}
                        </span>
                      )}
                      {isNextStep && (
                         <div className="flex items-center gap-3">
                            <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-blue-500 text-white shadow-xl animate-pulse">
                              Processing
                            </span>
                            {(() => {
                              const prevStepLog = sIdx > 0 ? workflowLogs.find(l => l.id === FLOW_STEPS[sIdx-1].id) : null;
                              if (prevStepLog) {
                                const diff = currentTime - new Date(prevStepLog.timestamp);
                                const m = Math.floor(diff / 60000);
                                const s = Math.floor((diff % 60000) / 1000);
                                return (
                                  <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 px-3 py-1 rounded-xl shadow-lg">
                                    <span className="text-[9px] font-black text-blue-400 opacity-60 uppercase tracking-tighter">Current Step Elapsed</span>
                                    <span className="text-sm font-black font-mono text-blue-400 tabular-nums">
                                      {String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
                                    </span>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                         </div>
                      )}
                    </div>
                    
                    <p className={`text-sm max-w-2xl leading-relaxed ${isCompleted ? 'text-slate-400 font-medium' : (isNextStep ? 'text-slate-300 font-bold' : 'text-slate-700')}`}>
                      {isCompleted ? stepLog.detail : (isNextStep ? '실시간 데이터 분석 및 연동된 보안 정책을 바탕으로 대응 절차를 집행 중입니다...' : '업무 단계 활성화 대기 중')}
                    </p>
                    
                    {(isCompleted || isNextStep) && step.id === 'WARROOM' && (
                       <button
                         onClick={() => navigate(`/chat/${inc_id}`)}
                         className={`mt-6 flex items-center gap-3 group/btn text-xs font-black text-white border border-blue-400/30 px-8 py-4 rounded-[1.25rem] ${isClosed ? 'bg-slate-800 shadow-xl' : 'bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.4)] hover:shadow-[0_0_20px_rgba(37,99,235,0.6)]'} transition-all transform hover:scale-[1.03] active:scale-[0.98]`}
                       >
                         <Zap className={`w-4 h-4 fill-white ${isClosed ? '' : 'animate-pulse'}`} />
                         {isClosed ? '워룸 히스토리 보기(readOnly)' : '워룸으로 즉시 이동하여 대응하기'} <ChevronRight className="w-5 h-5 group-hover/btn:translate-x-1.5 transition-transform" />
                       </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Footer */}
        <div className="flex gap-6 mt-12 pb-20">
          <button 
            onClick={() => navigate('/dashboard')}
            className="flex-1 py-5 rounded-2xl bg-[#0f111a] text-slate-400 text-sm font-black hover:text-white hover:bg-slate-800 transition-all border border-white/5 flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> 대시보드 메인으로 돌아가기
          </button>
          <button 
             onClick={() => window.print()}
             className="flex-1 py-5 rounded-2xl bg-gradient-to-r from-blue-700 to-blue-600 text-white text-sm font-black shadow-[0_10px_30px_rgba(37,99,235,0.3)] hover:shadow-[0_20px_50px_rgba(37,99,235,0.5)] transition-all transform hover:-translate-y-1 flex items-center justify-center gap-2 border border-blue-400/30"
          >
            <BarChart3 className="w-4 h-4" /> 종합 보고서 출력 (PDF)
          </button>
        </div>
      </main>
    </div>
  );
}
