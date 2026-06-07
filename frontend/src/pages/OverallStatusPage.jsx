import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBackNavigation } from '../hooks/useBackNavigation';
import {
  Shield, Zap, Database, MessageSquare, Users, CheckCircle2,
  BarChart3, Clock, Sparkles, Activity, FileSearch, Brain,
  Target, Rocket, Heart, Medal, ChevronLeft, Loader2, RefreshCw,
  Layers, ArrowRight, FileText
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, PieChart, Pie, Cell, BarChart, Bar
} from 'recharts';

import { getAuthHeaders } from '../lib/authStore';
import { useResizable, useResizableVertical } from '../hooks/useResizable';

const API_BASE = 'https://sguardai.khcho0421.workers.dev';

const EMPTY_STATS = {
  incidents: { total: 0, resolved: 0, rate: 0, integrity: 0, mttr: 0, mtta: 0 },
  knowledge: { total: 0, growth: '0' },
  warrooms: { active: 0 },
  categories: [],
  topContributors: [],
  recentFeed: [],
};

const TABS = ['개요', 'MTTA 분석', '카테고리', '기여자', '피드'];

export default function OverallStatusPage() {
  const navigate = useNavigate();
  const goBack = useBackNavigation('/dashboard');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [now, setNow] = useState(new Date());
  
  const getDefaultDates = () => {
    const today = new Date();
    const end = today.toISOString().split('T')[0];
    const start = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    return { start, end };
  };
  const { start: defaultStart, end: defaultEnd } = getDefaultDates();
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  
  // 모바일 호환을 위한 상태 복원
  const [tab, setTab] = useState(0);
  const [isPC, setIsPC] = useState(typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);

  // Resize hooks for PC Layout
  const { heights: vH, startVDrag: vDrag, isDragging: vDragIng } = useResizableVertical([45, 55], 'overall-v');
  const { widths: wR1, startDrag: hDrag1, isDragging: hDragIng1 } = useResizable([65, 35], 'overall-r1');
  const { widths: wR2, startDrag: hDrag2, isDragging: hDragIng2 } = useResizable([25, 25, 25, 25], 'overall-r2');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => setIsPC(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 탭 전환 시 스크롤 위치 초기화
  const scrollContainerRef = useRef(null);
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [tab]);

  const fetchData = async (isManual = false, sd = startDate, ed = endDate) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch(`${API_BASE}/ai/governance/stats`);
      if (res.ok) {
        const data = await res.json() || EMPTY_STATS;
        try {
          let url = `${API_BASE}/sms/recent?limit=${sd ? 1000 : 100}`;
          if (sd) url += `&startDate=${sd}`;
          if (ed) url += `&endDate=${ed}`;
          
          const cardsRes = await fetch(url, { headers: getAuthHeaders() });
          if (cardsRes.ok) {
            const cardsData = await cardsRes.json();
            const messages = cardsData.messages || [];
            let totalDiff = 0, count = 0;
            let globalDayTotal = 0, globalDayCount = 0;
            let globalNightTotal = 0, globalNightCount = 0;
            const mttaStats = {};
            
            messages.forEach(c => {
              if (c.warroom_dt && c.timestamp) {
                const tDate = new Date(c.timestamp);
                const diff = (new Date(c.warroom_dt) - tDate) / 60000;
                if (diff >= 0 && diff < 100000) {
                  const dateKey = tDate.toISOString().split('T')[0];
                  const hour = tDate.getHours();
                  const isDay = hour >= 9 && hour < 18;
                  const timeKey = isDay ? 'day' : 'night';
                  
                  if (!mttaStats[dateKey]) {
                    mttaStats[dateKey] = { day: { total: 0, count: 0 }, night: { total: 0, count: 0 } };
                  }
                  mttaStats[dateKey][timeKey].total += diff;
                  mttaStats[dateKey][timeKey].count += 1;

                  if (isDay) { globalDayTotal += diff; globalDayCount++; }
                  else { globalNightTotal += diff; globalNightCount++; }

                  totalDiff += diff;
                  count++;
                }
              }
            });
            
            if (!data.incidents) data.incidents = { ...EMPTY_STATS.incidents };
            data.incidents.mtta = count > 0 ? Math.round(totalDiff / count) : 0;
            data.incidents.dayMtta = globalDayCount > 0 ? Math.round(globalDayTotal / globalDayCount) : 0;
            data.incidents.nightMtta = globalNightCount > 0 ? Math.round(globalNightTotal / globalNightCount) : 0;
            
            data.incidents.mttaList = Object.keys(mttaStats).map(date => {
              const d = mttaStats[date];
              return {
                date,
                dayMtta: d.day.count > 0 ? Math.round(d.day.total / d.day.count) : 0,
                nightMtta: d.night.count > 0 ? Math.round(d.night.total / d.night.count) : 0,
                dayCount: d.day.count,
                nightCount: d.night.count
              };
            }).sort((a, b) => b.date.localeCompare(a.date));
          }
        } catch (e) {
           console.warn('MTTA calc failed', e);
        }
        setStats(data);
      }
    } catch (e) { console.warn(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => {
    fetchData(false, startDate, endDate);
    const iv = setInterval(() => { fetchData(false, startDate, endDate); setNow(new Date()); }, 15000);
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => { clearInterval(iv); clearInterval(tick); };
  }, [startDate, endDate]);

  const KPI = [
    {
      label: '자산화 성공률', sub: 'Fidelity Index',
      value: `${stats.incidents.integrity}%`,
      icon: Shield, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', iconBg: 'bg-emerald-500/20', iconBorder: 'border-emerald-500/30',
      formula: 'KB_COUNT / TOTAL_INC × 100',
    },
    {
      label: '평균 복구 소요시간', sub: 'MTTR (인지→지식화)',
      value: stats.incidents.mttr > 0 ? `${stats.incidents.mttr}m` : '-',
      icon: Rocket, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', iconBg: 'bg-blue-500/20', iconBorder: 'border-blue-500/30',
      formula: 'AVG(KB_REG - SMS_RECV)',
    },
    {
      label: '평균 인지 소요시간', sub: `주간: ${stats.incidents.dayMtta || 0}m / 야간: ${stats.incidents.nightMtta || 0}m`,
      value: stats.incidents.mtta > 0 ? `${stats.incidents.mtta}m` : '-',
      icon: Clock, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20', iconBg: 'bg-purple-500/20', iconBorder: 'border-purple-500/30',
      formula: 'AVG(WARROOM - SMS_RECV)',
    },
    {
      label: '이번달 KB 증가', sub: '전월 대비 지식 성장률',
      value: stats.knowledge.growth || '-',
      icon: Heart, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', iconBg: 'bg-red-500/20', iconBorder: 'border-red-500/30',
      formula: 'THIS_MONTH / LAST_MONTH',
    },
    {
      label: '전사 조치 지수', sub: 'High Intelligence',
      value: `${stats.incidents.rate}%`,
      icon: Zap, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', iconBg: 'bg-amber-500/20', iconBorder: 'border-amber-500/30',
      formula: 'RESOLVED / TOTAL × 100',
    },
  ];

  const FLOW = [
    { label: 'SMS 수신', value: stats.incidents.total, icon: MessageSquare, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
    { label: '전문가 배정', value: stats.warrooms?.assignedUsers ?? stats.warrooms.active, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
    { label: '대응 중', value: Math.max(0, stats.incidents.total - stats.incidents.resolved), icon: Activity, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
    { label: '조치 완료', value: stats.incidents.resolved, icon: CheckCircle2, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
    { label: '지식 자산', value: stats.knowledge.total, icon: Database, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', glow: true },
  ];

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-zinc-950 gap-4">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
        <div className="text-sm font-black text-slate-500 tracking-widest">
          SYNCING DREAM ANALYTICS...
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-screen overflow-hidden bg-zinc-950 text-slate-300 font-sans flex flex-col select-none relative">
      {/* Background Effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/5 blur-[120px] rounded-full pointer-events-none z-0" />
      <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-purple-500/5 blur-[120px] rounded-full pointer-events-none z-0" />

      {/* Header */}
      <header className="flex-shrink-0 flex items-center justify-between px-3 md:px-6 py-3 border-b border-white/5 bg-zinc-950/90 backdrop-blur-md z-10 gap-2">
        <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
          
          <button onClick={() => goBack()} className="w-7 h-7 md:w-8 md:h-8 min-w-[28px] md:min-w-[32px] shrink-0 rounded-xl md:rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all flex items-center justify-center cursor-pointer active:scale-95">
            <ChevronLeft className="w-4 h-4 md:w-5 md:h-5 text-slate-400" />
          </button>
          
          <div className="flex flex-col justify-center min-w-0">
            <h1 className="text-[11px] sm:text-xs md:text-sm lg:text-base font-black tracking-tight flex items-center gap-1.5 text-indigo-400 md:text-transparent md:bg-clip-text md:bg-gradient-to-r md:from-indigo-400 md:via-purple-400 md:to-pink-400 truncate">
              <Layers className="w-3.5 h-3.5 md:w-4 md:h-4 text-indigo-400 shrink-0" /> 
              <span className="truncate">Global Stats Dashboard</span>
            </h1>
            <p className="text-[8px] md:text-[9px] text-slate-500 font-bold uppercase tracking-[0.1em] md:tracking-[0.2em] mt-0.5 flex items-center gap-1.5 truncate">
              <span className="w-1.5 h-1.5 shrink-0 rounded-full bg-indigo-500 animate-pulse"></span>
              <span className="truncate">DREAM MODE LIVE</span>
            </p>
          </div>

        </div>

        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          <div className="hidden lg:flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5">
             <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent text-slate-300 text-xs font-bold outline-none cursor-pointer" />
             <span className="text-slate-500 text-xs">~</span>
             <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent text-slate-300 text-xs font-bold outline-none cursor-pointer" />
          </div>
          <div className="px-2 md:px-3 py-1 md:py-1.5 rounded-xl bg-white/5 border border-white/10 text-[10px] md:text-xs font-mono font-bold text-slate-400 whitespace-nowrap">
            {now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <button onClick={() => fetchData(true, startDate, endDate)} className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/30 hover:bg-indigo-500/20 text-indigo-400 transition-all flex items-center justify-center cursor-pointer">
            <RefreshCw className={`w-3.5 h-3.5 md:w-4 md:h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* Mobile Tabs (Hidden on PC) */}
      <div className="lg:hidden flex shrink-0 px-4 pt-4 pb-0 gap-2 overflow-x-auto custom-scrollbar z-10">
        {TABS.map((t, i) => (
          <button 
            key={i} 
            onClick={() => setTab(i)} 
            className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-black transition-all ${tab === i ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <div ref={scrollContainerRef} className="flex-1 min-h-0 p-4 pb-24 z-10 overflow-y-auto custom-scrollbar lg:flex lg:flex-col lg:gap-4">
        
        {/* ROW 1: KPIs & Flow (Tab 0 on Mobile) */}
        {(isPC || tab === 0) && (
          <div 
            className="flex flex-col lg:flex-row gap-4 lg:gap-0 shrink-0 lg:items-start mb-4 lg:mb-0"
            style={isPC ? { height: `${vH[0]}%`, minHeight: '150px' } : {}}
          >
          
          {/* KPI Grid */}
          <div className="flex-1 grid grid-cols-2 lg:grid-cols-5 gap-3 lg:h-full" style={isPC ? { width: `${wR1[0]}%`, flex: 'none' } : {}}>
            {KPI.map((k, i) => {
              const Icon = k.icon;
              return (
                <div key={i} className={`rounded-3xl p-4 bg-gradient-to-br from-white/5 to-transparent border border-white/5 relative overflow-hidden group hover:border-white/10 transition-all flex flex-col justify-start h-full ${i === 4 ? 'col-span-2 lg:col-span-1' : ''}`}>
                  <div className={`absolute -right-4 -top-4 w-24 h-24 ${k.bg} blur-[30px] rounded-full group-hover:scale-110 transition-transform opacity-50`}></div>
                  
                  <div>
                    <div className={`w-8 h-8 rounded-xl mb-3 flex items-center justify-center ${k.iconBg} border ${k.iconBorder} shrink-0`}>
                      <Icon className={`w-4 h-4 ${k.color}`} />
                    </div>
                    <div className="text-3xl font-black text-slate-100 font-mono tracking-tighter mb-1 leading-none">
                      {k.value}
                    </div>
                  </div>
                  
                  <div className="flex flex-col justify-end mt-auto pt-2">
                    <div className="text-[11px] font-bold text-slate-400 mb-1 leading-tight">{k.label}</div>
                    <div className="text-[9px] font-bold text-slate-500 leading-tight">{k.sub}</div>
                    <div className={`mt-3 text-[9px] font-mono font-bold px-2 py-1 rounded-lg border inline-flex self-start ${k.color} ${k.bg} ${k.iconBorder} opacity-80 shrink-0`}>
                      {k.formula}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {isPC && <div onMouseDown={(e) => hDrag1(0, e)} className={`w-1.5 md:w-2 cursor-ew-resize shrink-0 bg-transparent hover:bg-blue-500/50 transition-colors z-20 ${hDragIng1 ? 'bg-blue-500/50' : ''}`} />}

          {/* Incident Lifecycle Flow */}
          <div className="lg:w-[450px] shrink-0 bg-zinc-900/40 backdrop-blur-sm rounded-3xl p-4 border border-white/5 flex flex-col shadow-lg overflow-hidden lg:h-full" style={isPC ? { width: `${wR1[1]}%`, flex: 'none' } : {}}>
            <div className="flex items-center gap-2 mb-4 shrink-0">
              <div className="p-1.5 bg-indigo-500/10 rounded-lg"><Activity className="w-4 h-4 text-indigo-400" /></div>
              <span className="text-sm font-black text-slate-200">인시던트 생애주기</span>
            </div>
            <div className="flex-1 flex items-center justify-between gap-1 mt-1 md:mt-0">
              {FLOW.map((f, i) => {
                const Icon = f.icon;
                return (
                  <React.Fragment key={i}>
                    <div className="flex flex-col items-center gap-1 md:gap-2 flex-1 p-1 md:p-0 rounded-xl md:rounded-none bg-transparent border-none">
                      <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl flex items-center justify-center ${f.bg} border ${f.border} ${f.glow ? 'shadow-[0_0_15px_rgba(16,185,129,0.3)] animate-pulse' : ''}`}>
                        <Icon className={`w-4 h-4 md:w-5 md:h-5 ${f.color}`} />
                      </div>
                      <div className="text-center">
                         <span className={`text-[11px] md:text-base font-black font-mono leading-tight block md:inline ${f.color}`}>{f.value}</span>
                         <span className="text-[8px] md:text-[9px] font-bold text-slate-400 text-center leading-tight break-keep block md:inline md:ml-1 whitespace-nowrap md:whitespace-normal">{f.label}</span>
                      </div>
                    </div>
                    {i < FLOW.length - 1 && (
                      <div className="w-2 md:w-4 h-[1px] bg-white/10 shrink-0" />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>
        )}

        {isPC && <div onMouseDown={(e) => vDrag(0, e)} className={`h-1.5 md:h-2 cursor-ns-resize shrink-0 bg-transparent hover:bg-blue-500/50 transition-colors z-20 ${vDragIng ? 'bg-blue-500/50' : ''}`} />}

        {/* ROW 2: 4 Columns Data Grid */}
        {(isPC || tab !== 0) && (
          <div 
            className="lg:flex-1 lg:min-h-0 lg:flex lg:flex-row lg:gap-0 flex flex-col gap-4 pb-4 lg:pb-0"
            style={isPC ? { height: `${vH[1]}%` } : {}}
          >
          
          {/* Column 1: MTTA (Tab 1 on Mobile) */}
          {(isPC || tab === 1) && (
            <div className="flex bg-zinc-900/40 backdrop-blur-sm rounded-3xl px-4 pt-2 md:pt-3 pb-4 border border-white/5 flex-col justify-start lg:flex-1 lg:min-h-0 shadow-lg relative overflow-hidden" style={isPC ? { width: `${wR2[0]}%`, flex: 'none' } : {}}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 blur-[40px] pointer-events-none"></div>
            <div className="flex items-center justify-between mb-4 shrink-0 relative z-10 min-h-[28px]">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-black text-slate-200">일자별 MTTA 추이</h3>
              </div>
            </div>
            <div className="flex items-center gap-3 text-[9px] font-bold mb-3 shrink-0 relative z-10 px-1">
               <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-400"></div>주간 평균(m)</div>
               <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-indigo-400"></div>야간 평균(m)</div>
            </div>
            <div className="flex-1 min-h-[200px] lg:min-h-0 relative z-10">
              {stats.incidents.mttaList && stats.incidents.mttaList.length > 0 ? (
                <div className="absolute inset-0">
                  <ResponsiveContainer width="99%" height="100%" minWidth={1} minHeight={1}>
                    <AreaChart data={[...stats.incidents.mttaList].reverse()} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorDay" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#fbbf24" stopOpacity={0.4}/><stop offset="95%" stopColor="#fbbf24" stopOpacity={0}/></linearGradient>
                        <linearGradient id="colorNight" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#818cf8" stopOpacity={0.4}/><stop offset="95%" stopColor="#818cf8" stopOpacity={0}/></linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 9, fontWeight: 'bold' }} axisLine={false} tickLine={false} tickFormatter={(v) => v.substring(5)} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', backdropFilter: 'blur(8px)' }} itemStyle={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }} />
                      <Area type="monotone" dataKey="dayMtta" name="주간(분)" stroke="#fbbf24" strokeWidth={2} fill="url(#colorDay)" />
                      <Area type="monotone" dataKey="nightMtta" name="야간(분)" stroke="#818cf8" strokeWidth={2} fill="url(#colorNight)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-xs font-bold text-slate-500 absolute inset-0">데이터 없음</div>
              )}
            </div>
          </div>
        )}

          {isPC && <div onMouseDown={(e) => hDrag2(0, e)} className={`w-1.5 md:w-2 cursor-ew-resize shrink-0 bg-transparent hover:bg-blue-500/50 transition-colors z-20 ${hDragIng2 ? 'bg-blue-500/50' : ''}`} />}

          {/* Column 2: Categories (Tab 2 on Mobile) */}
          {(isPC || tab === 2) && (
            <div className="flex bg-zinc-900/40 backdrop-blur-sm rounded-3xl px-4 pt-2 md:pt-3 pb-4 border border-white/5 flex-col justify-start lg:flex-1 lg:min-h-0 shadow-lg relative overflow-hidden" style={isPC ? { width: `${wR2[1]}%`, flex: 'none' } : {}}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-[40px] pointer-events-none"></div>
            <div className="flex items-center justify-between mb-4 shrink-0 relative z-10 min-h-[28px]">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-black text-slate-200">인텔리전스 카테고리</h3>
              </div>
            </div>
            <div className="flex-1 min-h-[200px] lg:min-h-0 relative flex items-center justify-center z-10">
              {stats.categories && stats.categories.length > 0 ? (
                <>
                  <div className="absolute inset-0">
                    <ResponsiveContainer width="99%" height="100%" minWidth={1} minHeight={1}>
                      <PieChart>
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', backdropFilter: 'blur(8px)' }} 
                          itemStyle={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }} 
                          formatter={(val) => [`${val}건`, '문서 수']} 
                        />
                        <Pie
                          data={stats.categories}
                          dataKey="c"
                          nameKey="category"
                          cx="50%"
                          cy="50%"
                          innerRadius="65%"
                          outerRadius="85%"
                          paddingAngle={4}
                          cornerRadius={4}
                          stroke="none"
                        >
                          {stats.categories.map((entry, index) => {
                             const hue = (index * 47) % 360;
                             return <Cell key={`cell-${index}`} fill={`hsl(${hue}, 70%, 55%)`} />;
                          })}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <Database className="w-5 h-5 text-emerald-400 opacity-60 mb-1" />
                    <span className="text-2xl font-black text-white font-mono">{stats.knowledge.total}</span>
                    <span className="text-[8px] font-bold text-slate-400">TOTAL ASSETS</span>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-xs font-bold text-slate-500 absolute inset-0">데이터 없음</div>
              )}
            </div>
          </div>
        )}

          {isPC && <div onMouseDown={(e) => hDrag2(1, e)} className={`w-1.5 md:w-2 cursor-ew-resize shrink-0 bg-transparent hover:bg-blue-500/50 transition-colors z-20 ${hDragIng2 ? 'bg-blue-500/50' : ''}`} />}

          {/* Column 3: Contributors (Tab 3 on Mobile) */}
          {(isPC || tab === 3) && (
            <div className="flex bg-zinc-900/40 backdrop-blur-sm rounded-3xl px-4 pt-2 md:pt-3 pb-4 border border-white/5 flex-col justify-start lg:flex-1 lg:min-h-0 shadow-lg relative overflow-hidden" style={isPC ? { width: `${wR2[2]}%`, flex: 'none' } : {}}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 blur-[40px] pointer-events-none"></div>
            <div className="flex items-center justify-between mb-4 shrink-0 relative z-10 min-h-[28px]">
              <div className="flex items-center gap-2">
                <Medal className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-black text-slate-200">전문가 기여도</h3>
              </div>
              <span className="text-[9px] font-black bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">Honor Board</span>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-2.5 relative z-10">
              {stats.topContributors.length > 0 ? stats.topContributors.map((user, i) => {
                const isTop = i === 0;
                const maxScore = stats.topContributors[0].synergy_score || 1;
                const pct = Math.max(8, (user.synergy_score / maxScore) * 100);

                return (
                  <div key={i} className={`flex items-center gap-3 rounded-2xl p-3 shrink-0 relative overflow-hidden transition-all ${isTop ? 'border border-amber-500/30' : 'border border-white/5 hover:border-white/10'}`}>
                    
                    {/* Background Progress Bar */}
                    <div className="absolute top-0 bottom-0 left-0 z-0 transition-all duration-1000" style={{ width: `${pct}%`, background: isTop ? 'linear-gradient(90deg, rgba(245,158,11,0.2), rgba(245,158,11,0.05))' : 'rgba(255,255,255,0.03)' }} />
                    
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black shrink-0 relative z-10 ${isTop ? 'bg-amber-500/20 border-2 border-amber-500/40 text-amber-400' : 'bg-white/5 border border-white/10 text-slate-400'}`}>
                      {isTop ? '🥇' : `${i + 1}`}
                    </div>
                    <div className="flex-1 min-w-0 relative z-10">
                      <div className={`text-xs font-black truncate mb-0.5 ${isTop ? 'text-amber-200' : 'text-slate-200'}`}>@{user.name}</div>
                      <div className="text-[9px] font-bold text-slate-500 truncate mb-1.5">{user.full_org}</div>
                      <div className="flex gap-2">
                        <span className="text-[9px] font-bold text-pink-400">전파:{user.warroom_count}</span>
                        <span className="text-[9px] font-bold text-emerald-400">KB:{user.kb_count}</span>
                        <span className="text-[9px] font-bold text-blue-400">참여:{user.chat_count}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0 relative z-10">
                      <div className={`text-lg font-black font-mono leading-none ${isTop ? 'text-amber-400' : 'text-slate-400'}`}>{user.synergy_score}</div>
                      <div className="text-[8px] font-bold text-slate-500 mt-1">SCORE</div>
                    </div>
                  </div>
                );
              }) : (
                <div className="flex items-center justify-center h-full text-xs font-bold text-slate-500">기여자 데이터 없음</div>
              )}
            </div>
          </div>
        )}

          {isPC && <div onMouseDown={(e) => hDrag2(2, e)} className={`w-1.5 md:w-2 cursor-ew-resize shrink-0 bg-transparent hover:bg-blue-500/50 transition-colors z-20 ${hDragIng2 ? 'bg-blue-500/50' : ''}`} />}

          {/* Column 4: Feed (Tab 4 on Mobile) */}
          {(isPC || tab === 4) && (
            <div className="flex bg-zinc-900/40 backdrop-blur-sm rounded-3xl px-4 pt-2 md:pt-3 pb-4 border border-white/5 flex-col justify-start lg:flex-1 lg:min-h-0 shadow-lg relative overflow-hidden" style={isPC ? { width: `${wR2[3]}%`, flex: 'none' } : {}}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[40px] pointer-events-none"></div>
            <div className="flex items-center justify-between mb-4 shrink-0 relative z-10 min-h-[28px]">
              <div className="flex items-center gap-2">
                <FileSearch className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-black text-slate-200">인텔리전스 피드</h3>
              </div>
              <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-3 relative z-10">
              {stats.recentFeed.length > 0 ? stats.recentFeed.map((item, i) => (
                <div key={i} className={`rounded-2xl p-3 shrink-0 relative overflow-hidden transition-all ${i === 0 ? 'bg-blue-500/10 border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.1)]' : 'bg-white/5 border border-white/10 hover:bg-white/10'}`}>
                  {i === 0 && (
                    <div className="absolute top-0 left-0 bottom-0 w-1 bg-gradient-to-b from-blue-400 to-indigo-500" />
                  )}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] font-black text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md">
                      {item.category || '기타'} · APPROVED
                    </span>
                    <span className="text-[9px] font-mono font-bold text-slate-500">{(item.reg_dt || '').substring(5, 16)}</span>
                  </div>
                  <div className="text-xs font-black text-slate-200 leading-snug mb-2 line-clamp-2">
                    {item.title}
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="flex items-center gap-1.5">
                      <Brain className="w-3 h-3 text-slate-500" />
                      <span className="text-[9px] font-bold text-slate-400">@{item.reg_name || 'SYSTEM'}</span>
                      <span className="text-[9px] font-bold text-slate-600 ml-1">· RAG Synced ✦</span>
                    </div>
                    {(() => {
                      // Extract inc_id from title: "[S-GUARD AI 보고서] {inc_id}: ..."
                      const match = (item.title || '').match(/\]\s*([\d]+)[:：]/);
                      const incId = match ? match[1] : (item.inc_id || null);
                      return incId ? (
                        <button
                          onClick={() => navigate(`/ai-report/${incId}`)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black transition-all active:scale-95 shrink-0"
                          style={{
                            background: 'rgba(59,130,246,0.12)',
                            border: '1px solid rgba(59,130,246,0.3)',
                            color: '#60a5fa',
                            boxShadow: '0 0 8px rgba(59,130,246,0.15)'
                          }}
                          onMouseEnter={e => e.currentTarget.style.boxShadow = '0 0 14px rgba(59,130,246,0.35)'}
                          onMouseLeave={e => e.currentTarget.style.boxShadow = '0 0 8px rgba(59,130,246,0.15)'}
                        >
                          <FileText className="w-2.5 h-2.5" />
                          <span>AI 레포트</span>
                          <ArrowRight className="w-2.5 h-2.5" />
                        </button>
                      ) : null;
                    })()}
                  </div>
                </div>
              )) : (
                <div className="flex items-center justify-center h-full text-xs font-bold text-slate-500">피드 데이터 없음</div>
              )}
            </div>
          </div>
        )}
          </div>
        )}
      </div>
    </div>
  );
}
