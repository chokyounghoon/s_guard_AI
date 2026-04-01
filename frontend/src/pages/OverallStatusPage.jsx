import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Brain, Shield, Zap, TrendingUp, Database, 
  MessageSquare, Users, CheckCircle2, AlertCircle, 
  PieChart, BarChart3, Clock, Sparkles, Activity,
  FileSearch, Lightbulb, ChevronRight, Share2, Globe, Medal,
  Target, Rocket, Heart
} from 'lucide-react';

// API URL helper logic (Consistent with other major pages)
const getApiUrl = (endpoint) => {
  const apiBase = 'https://sguardai.khcho0421.workers.dev';
  return `${apiBase}${endpoint}`;
};

export default function OverallStatusPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    incidents: { total: 0, resolved: 0, rate: 0, integrity: 0, mttr: 0 },
    knowledge: { total: 0, growth: "0%" },
    warrooms: { active: 0 },
    categories: [],
    topContributors: [],
    recentFeed: []
  });

  useEffect(() => {
    const controller = new AbortController();
    
    const fetchData = async () => {
      try {
        const res = await fetch(getApiUrl('/ai/governance/stats'), { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        
        const data = await res.json();
        setStats(data || {
          incidents: { total: 0, resolved: 0, rate: 0, integrity: 0, mttr: 0 },
          knowledge: { total: 0, growth: "0%" },
          warrooms: { active: 0 },
          categories: [],
          topContributors: [],
          recentFeed: []
        });
      } catch (e) {
        if (e.name === 'AbortError') return;
        console.warn("Failed to fetch governance stats (suppressed):", e);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#06080c] flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/10 via-purple-900/5 to-emerald-900/10" />
        <div className="flex flex-col items-center space-y-6 relative z-10">
          <div className="relative">
            <div className="w-24 h-24 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
            <Sparkles className="absolute inset-0 m-auto w-8 h-8 text-blue-400 animate-pulse" />
          </div>
          <p className="text-xl font-black text-white tracking-widest animate-pulse font-mono uppercase">Syncing Dream Analytics...</p>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-[0.3em]">전수 테이블 기반 '꿈의 집계' 데이터를 동기화 중입니다</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#06080c] text-white font-sans selection:bg-blue-500/30 overflow-x-hidden">
      
      {/* 배경 장식 애니메이션 */}
      <div className="fixed top-[-10%] right-[-10%] w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[150px] animate-pulse pointer-events-none" />
      <div className="fixed bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[150px] animate-pulse pointer-events-none" />

      {/* 헤더 영역 */}
      <header className="sticky top-0 z-[60] px-6 py-4 backdrop-blur-xl border-b border-white/5 bg-[#06080c]/80 shadow-2xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <button 
              onClick={() => navigate('/dashboard')}
              className="p-3 rounded-2xl hover:bg-white/5 border border-white/5 transition-all hover:scale-105 active:scale-95 group"
            >
              <ArrowLeft className="w-6 h-6 group-hover:text-blue-400 transition-colors" />
            </button>
            <div className="flex flex-col">
              <h1 className="text-2xl font-black flex items-center gap-3">
                <Target className="w-8 h-8 text-purple-400 animate-bounce" />
                <span className="bg-gradient-to-r from-white via-slate-300 to-slate-500 bg-clip-text text-transparent">
                  S-Guard 핵심 거버넌스 꿈의 집계 (Full-Sync)
                </span>
                <div className="px-3 py-1 bg-purple-500/10 border border-purple-500/30 rounded-full flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,1)]" />
                  <span className="text-[10px] text-purple-400 font-black uppercase tracking-tighter">Dream Mode</span>
                </div>
              </h1>
              <p className="text-[10px] text-slate-500 font-bold tracking-[0.3em] uppercase mt-1">Cross-Table Intelligence: Users · SMS · Knowledge · Logs · Assignments</p>
            </div>
          </div>
          <div className="flex items-center space-x-4 bg-black/40 px-6 py-2.5 rounded-2xl border border-white/10 shadow-inner">
            <Clock className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-mono font-black text-slate-300">
              {new Date().toLocaleTimeString('ko-KR')}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-6 relative z-10 pb-24">
        
        {/* 꿈의 집계 핵심 인디케이터 (With Methodology) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="flex flex-col space-y-2">
            <StatCard 
              icon={<Shield className="text-emerald-400" />}
              label="장애 자산화 성공률"
              value={`${stats.incidents.integrity}%`}
              subValue="수신 대비 KB 등록율"
              trend={"Fidelity Index"}
              color="emerald"
            />
            <div className="px-4 flex items-center gap-1.5 opacity-40 hover:opacity-100 transition-opacity whitespace-nowrap">
              <Database className="w-2.5 h-2.5" />
              <span className="text-[9px] font-mono tracking-tighter uppercase tracking-widest text-[#a855f7]">Formula: (KB_COUNT / TOTAL_INC) * 100</span>
            </div>
          </div>

          <div className="flex flex-col space-y-2">
            <StatCard 
              icon={<Rocket className="text-blue-400" />}
              label="평균 자산화 소요시간"
              value={`${stats.incidents.mttr}m`}
              subValue="MTTR (Recognition to RAG)"
              trend={"Speed of Wisdom"}
              color="blue"
            />
            <div className="px-4 flex items-center gap-1.5 opacity-40 hover:opacity-100 transition-opacity whitespace-nowrap">
              <Clock className="w-2.5 h-2.5" />
              <span className="text-[9px] font-mono tracking-tighter uppercase tracking-widest text-blue-400">Formula: AVG(KB_REG_STAMP - ALERT_STAMP)</span>
            </div>
          </div>

          <div className="flex flex-col space-y-2">
            <StatCard 
              icon={<Heart className="text-red-400" />}
              label="전문가 시너지 지수"
              value={`+${stats.knowledge.growth}`}
              subValue="협업 및 기여 성장세"
              trend="Active Synergy"
              color="red"
            />
            <div className="px-4 flex items-center gap-1.5 opacity-40 hover:opacity-100 transition-opacity whitespace-nowrap">
              <Users className="w-2.5 h-2.5" />
              <span className="text-[9px] font-mono tracking-tighter uppercase tracking-widest text-red-400">Extract: (KB_CONTRIB * 10) + (LOG_ACT * 2)</span>
            </div>
          </div>

          <div className="flex flex-col space-y-2">
            <StatCard 
              icon={<Zap className="text-orange-400" />}
              label="전사 조치 지능 지수"
              value={`${stats.incidents.rate}%`}
              subValue="실시간 조치 완결성"
              trend="High Intelligence"
              color="orange"
            />
            <div className="px-4 flex items-center gap-1.5 opacity-40 hover:opacity-100 transition-opacity whitespace-nowrap">
              <TrendingUp className="w-2.5 h-2.5" />
              <span className="text-[9px] font-mono tracking-tighter uppercase tracking-widest text-orange-400">Formula: (RESOLVED_INC / TOTAL_INC) * 100</span>
            </div>
          </div>
        </div>

        {/* 메인 분석 영역 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* 인시던트 생애주기 풀 스택 흐름 */}
          <div className="lg:col-span-2 bg-[#11141d]/60 backdrop-blur-2xl px-8 py-10 rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden overflow-x-auto group">
             <div className="absolute top-0 right-0 p-8">
               <Globe className="w-10 h-10 text-blue-500/10 animate-spin-slow" />
             </div>
             <div className="flex justify-between items-start mb-10">
               <h3 className="text-lg font-black text-white flex items-center gap-3">
                 <Activity className="w-5 h-5 text-blue-400" />
                 S-Guard 전수 테이블 데이터 상관관계 맵
               </h3>
               <span className="text-[10px] font-mono text-slate-500 opacity-50 group-hover:opacity-100 transition-opacity">
                 JOIN Logic: RECEIVED_MESSAGES ↔ ASSIGNMENTS ↔ KNOWLEDGE_BASE ↔ ACTIVITY_LOGS
               </span>
             </div>

             <div className="relative flex items-center justify-between space-x-4 min-w-[700px] py-10">
                <div className="absolute top-1/2 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                
                <LifecycleStep 
                   icon={<MessageSquare className="w-6 h-6" />}
                   label="장애 인지 (SMS)"
                   value={stats.incidents.total}
                   color="red"
                   status="MESSAGES"
                />
                <LifecycleStep 
                   icon={<Users className="w-6 h-6" />}
                   label="전문가 배정"
                   value={stats.warrooms.active}
                   color="blue"
                   status="ASSIGNMENTS"
                />
                <LifecycleStep 
                   icon={<Zap className="w-6 h-6" />}
                   label="대응 로그"
                   value="ACTIVE"
                   color="purple"
                   status="LOGS"
                />
                <LifecycleStep 
                   icon={<CheckCircle2 className="w-6 h-6" />}
                   label="조치 완료"
                   value={stats.incidents.resolved}
                   color="orange"
                   status="INCIDENTS"
                />
                <LifecycleStep 
                   icon={<Database className="w-6 h-6 shadow-[0_0_25px_rgba(168,85,247,0.4)]" />}
                   label="지식 자산화"
                   value={stats.knowledge.total}
                   color="purple"
                   status="KB_ASSETS"
                   glow={true}
                />
             </div>
          </div>

          {/* 지식 카테고리 심층 분석 */}
          <div className="bg-[#11141d]/60 backdrop-blur-2xl p-8 rounded-[2.5rem] border border-white/5 shadow-2xl">
             <h3 className="text-base font-black text-white flex items-center gap-3 mb-8">
               <BarChart3 className="w-5 h-5 text-emerald-400" />
               인텔리전스 카테고리 밀도
             </h3>
             <div className="space-y-5">
               {stats.categories.length > 0 ? stats.categories.map((cat, i) => (
                 <div key={i} className="group cursor-pointer">
                    <div className="flex justify-between items-center mb-2">
                       <span className="text-xs font-black text-slate-400 group-hover:text-white transition-colors uppercase tracking-widest">{cat.category || '기타'}</span>
                       <span className="text-xs font-mono font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">{cat.c} Assets</span>
                    </div>
                    <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
                       <div 
                         className={`h-full bg-gradient-to-r from-emerald-600 to-blue-500 transition-all duration-1000 delay-${i*100}`}
                         style={{ width: `${Math.min(100, (cat.c / (stats.knowledge.total || 1)) * 100)}%` }}
                       />
                    </div>
                 </div>
               )) : (
                 <div className="text-center py-20 text-slate-500 text-xs font-black uppercase tracking-widest animate-pulse">Syncing categories...</div>
               )}
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-12">
           
           {/* 전문가 시너지 보드 (입체적 기여도 산출) */}
           <div className="bg-[#11141d]/60 backdrop-blur-2xl p-8 rounded-[2.5rem] border border-white/5 shadow-2xl group">
              <div className="flex justify-between items-start mb-10">
                 <div className="flex flex-col gap-1">
                   <h3 className="text-lg font-black text-white flex items-center gap-3">
                     <Medal className="w-6 h-6 text-yellow-500" />
                     전문가 시너지 기여도 (Honor Board)
                   </h3>
                   <span className="text-[10px] font-mono text-slate-500 opacity-50 ml-9 group-hover:opacity-100 transition-opacity">
                     Extraction Formula: (KB_COUNT × 10) + (ACTIVITY_LOGS × 2)
                   </span>
                 </div>
                 <div className="px-4 py-1.5 bg-yellow-500/10 border border-yellow-500/30 rounded-xl relative overflow-hidden">
                    <span className="text-[10px] text-yellow-500 font-black tracking-widest uppercase">Master Contributors</span>
                 </div>
              </div>
              <div className="space-y-4">
                {stats.topContributors.length > 0 ? stats.topContributors.map((user, i) => (
                  <div key={i} className="flex items-center justify-between p-5 bg-white/5 border border-white/5 rounded-3xl hover:bg-white/10 transition-all cursor-default group hover:border-yellow-500/30">
                    <div className="flex items-center space-x-6">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shadow-2xl ${i === 0 ? 'bg-yellow-500/20 text-yellow-400 border-2 border-yellow-400/50' : 'bg-slate-800 text-slate-400 border border-white/10'}`}>
                        {i + 1}
                      </div>
                      <div>
                        <p className="text-lg font-black text-white group-hover:text-yellow-400 transition-colors">@{user.name}</p>
                        <p className="text-[10px] text-slate-500 font-black uppercase mt-1 tracking-tighter">{user.team} · {user.role}</p>
                      </div>
                    </div>
                    <div className="text-right flex flex-col justify-center">
                       <p className="text-2xl font-mono font-black text-white drop-shadow-lg">{user.synergy_score}</p>
                       <div className="flex items-center gap-2 mt-1">
                          <span className="text-[9px] text-slate-500 font-bold">Assigned: {user.assigned_count}</span>
                          <div className="w-1 h-1 rounded-full bg-slate-700" />
                          <span className="text-[9px] text-emerald-400 font-bold">Closed: {user.kb_count}</span>
                       </div>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-20 text-slate-600 font-black uppercase tracking-widest">Gathering contributor synergies...</div>
                )}
              </div>
           </div>

           {/* 최근 거버넌스 피드 (전수 컨텍스트 매핑) */}
           <div className="bg-[#11141d]/60 backdrop-blur-2xl p-8 rounded-[2.5rem] border border-white/5 shadow-2xl">
              <div className="flex justify-between items-center mb-10">
                 <h3 className="text-lg font-black text-white flex items-center gap-3">
                   <FileSearch className="w-6 h-6 text-blue-400" />
                   꿈의 집계: 실시간 인텔리전스 타임라인
                 </h3>
                 <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
              </div>
              <div className="space-y-4 relative">
                 <div className="absolute left-[31px] top-6 bottom-6 w-[1px] bg-gradient-to-b from-blue-500/30 via-slate-500/10 to-transparent" />
                 {stats.recentFeed.length > 0 ? stats.recentFeed.map((item, i) => (
                   <div key={i} className="flex items-start space-x-7 group">
                      <div className="relative mt-2">
                        <div className="w-16 h-16 bg-[#1a1f2e] border border-white/10 rounded-2xl flex items-center justify-center group-hover:rotate-6 transition-transform shadow-xl">
                          <Brain className="w-7 h-7 text-blue-400" />
                        </div>
                        {i === 0 && <span className="absolute -top-1 -right-1 flex h-4 w-4">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-4 w-4 bg-blue-500"></span>
                        </span>}
                      </div>
                      <div className="flex-1 pb-7 border-b border-white/5 group-last:border-none">
                         <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">{item.category || '기타'} · APPROVED</span>
                            <span className="text-[10px] text-slate-500 font-mono font-bold italic">{item.reg_dt.substring(5, 16)}</span>
                         </div>
                         <p className="text-base font-black text-white mt-2 group-hover:text-blue-200 transition-colors leading-relaxed line-clamp-1">
                            {item.title}
                         </p>
                         <div className="flex items-center gap-5 mt-4">
                            <div className="flex items-center gap-2.5 px-3 py-1.5 bg-white/5 rounded-xl border border-white/10">
                               <Users className="w-3.5 h-3.5 text-blue-400/70" />
                               <span className="text-[10px] text-slate-400 font-black">@{item.reg_name || 'SYSTEM'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                               <Sparkles className="w-3.5 h-3.5 text-yellow-500/50" />
                               <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">RAG Synced</span>
                            </div>
                         </div>
                      </div>
                   </div>
                 )) : (
                   <div className="text-center py-20 text-slate-600 font-black uppercase">No recent intelligence feed found.</div>
                 )}
                 <button 
                  onClick={() => navigate('/dashboard')}
                  className="w-full mt-6 py-5 rounded-[1.5rem] bg-gradient-to-r from-blue-600/10 to-purple-600/10 hover:from-blue-600/20 hover:to-purple-600/20 border border-white/10 text-xs font-black text-blue-400 transition-all uppercase tracking-[0.3em] backdrop-blur-xl group shadow-2xl"
                 >
                   <span className="group-hover:scale-110 inline-block transition-transform">Back to Main Control Tower</span>
                 </button>
              </div>
           </div>

        </div>

      </main>

      {/* 플로팅 내비게이션 버튼 (글로벌 맵 테마) */}
      <div className="fixed bottom-12 inset-x-0 w-full px-6 pointer-events-none group">
        <div className="max-w-7xl mx-auto flex justify-end pointer-events-auto">
          <button 
             onClick={() => navigate('/dashboard')}
             className="relative flex items-center space-x-4 px-10 py-5 bg-black text-white rounded-full shadow-[0_0_40px_rgba(59,130,246,0.3)] hover:shadow-[0_0_50px_rgba(59,130,246,0.5)] hover:scale-[1.03] active:scale-95 transition-all group/btn border border-blue-500/30 overflow-hidden"
          >
             <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 opacity-80 group-hover/btn:opacity-100 transition-opacity" />
             <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none" />
             <Sparkles className="w-6 h-6 text-white group-hover/btn:animate-spin relative z-10" />
             <span className="text-sm font-black uppercase tracking-[0.4em] relative z-10">S-Guard Command Tower</span>
             <ChevronRight className="w-5 h-5 opacity-50 relative z-10 group-hover/btn:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, subValue, trend, color }) {
  const colorMap = {
    emerald: 'from-emerald-600/20 text-emerald-400 border-emerald-500/30 shadow-emerald-500/10',
    blue: 'from-blue-600/20 text-blue-400 border-blue-500/30 shadow-blue-500/10',
    purple: 'from-purple-600/20 text-purple-400 border-purple-500/30 shadow-purple-500/10',
    orange: 'from-orange-600/20 text-orange-400 border-orange-500/30 shadow-orange-500/10',
    red: 'from-red-600/20 text-red-400 border-red-500/30 shadow-red-500/10',
  };

  return (
    <div className={`bg-gradient-to-br ${colorMap[color]} backdrop-blur-xl border-2 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden group cursor-default transition-all hover:-translate-y-2`}>
       <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-30 transition-opacity transform rotate-12">
         {React.cloneElement(icon, { className: 'w-16 h-16' })}
       </div>
       <div className="flex flex-col space-y-5 relative z-10">
          <div className="flex items-center space-x-4">
             <div className={`p-3 rounded-2xl bg-black/50 border border-${color}-500/20 backdrop-blur-md`}>
                {React.cloneElement(icon, { className: 'w-6 h-6' })}
             </div>
             <span className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">{label}</span>
          </div>
          <div className="flex flex-col">
             <span className="text-5xl font-black font-mono tracking-tighter text-white drop-shadow-2xl">{value}</span>
             <span className="text-xs font-black text-slate-500 mt-2 uppercase tracking-widest">{subValue}</span>
          </div>
          <div className="pt-5 border-t border-white/5 flex items-center justify-between">
             <span className="text-[10px] font-black text-slate-400 italic font-mono uppercase tracking-widest">{trend}</span>
             <div className="w-2 h-2 rounded-full bg-white/20 group-hover:bg-blue-500 transition-colors" />
          </div>
       </div>
    </div>
  );
}

function LifecycleStep({ icon, label, value, color, status, glow }) {
  const colorMap = {
    red: 'text-red-400 bg-red-500/10 border-red-500/20 shadow-red-500/10',
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20 shadow-blue-500/10',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20 shadow-purple-500/10',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20 shadow-emerald-500/10',
    orange: 'text-orange-400 bg-orange-500/10 border-orange-500/20 shadow-orange-500/10',
  };

  return (
    <div className="flex flex-col items-center space-y-5 relative z-10 group">
       <div className={`w-24 h-24 rounded-[2rem] ${colorMap[color]} border-2 flex items-center justify-center transition-all group-hover:scale-110 group-hover:-translate-y-3 relative shadow-3xl ${glow ? 'animate-pulse shadow-purple-500/40 border-purple-400/50' : 'backdrop-blur-xl'}`}>
          <div className="absolute inset-0 bg-white/5 rounded-[2rem] opacity-0 group-hover:opacity-100 transition-opacity" />
          {icon}
          <div className="absolute -top-4 -right-4 px-3 py-1 bg-black/90 border border-white/20 rounded-xl shadow-[0_0_15px_rgba(0,0,0,0.5)] z-20 overflow-hidden">
             <div className="absolute inset-0 bg-blue-500/5" />
             <span className="relative text-[9px] font-black tracking-[0.2em] text-white uppercase">{status}</span>
          </div>
       </div>
       <div className="text-center px-2">
          <p className="text-2xl font-black font-mono text-white drop-shadow-2xl">{value}</p>
          <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-2 leading-tight">{label}</p>
       </div>
    </div>
  );
}
