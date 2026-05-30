import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBackNavigation } from '../hooks/useBackNavigation';
import {
  Shield, Zap, Database, MessageSquare, Users, CheckCircle2,
  BarChart3, Clock, Sparkles, Activity, FileSearch, Brain,
  Target, Rocket, Heart, Medal, ChevronLeft, Loader2, RefreshCw,
  Layers, ArrowRight
} from 'lucide-react';

import { getAuthHeaders } from '../lib/authStore';

const API_BASE = 'https://sguardai.khcho0421.workers.dev';

const EMPTY_STATS = {
  incidents: { total: 0, resolved: 0, rate: 0, integrity: 0, mttr: 0, mtta: 0 },
  knowledge: { total: 0, growth: '0' },
  warrooms: { active: 0 },
  categories: [],
  topContributors: [],
  recentFeed: [],
};

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
    <div className="h-screen w-screen overflow-hidden bg-zinc-950 text-slate-300 font-sans flex flex-col select-none pb-[120px] xl:pb-0 relative">
      {/* Background Effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/5 blur-[120px] rounded-full pointer-events-none z-0" />
      <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-purple-500/5 blur-[120px] rounded-full pointer-events-none z-0" />

      {/* Header */}
      <header className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b border-white/5 bg-zinc-950/90 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => goBack()} className="w-9 h-9 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all flex items-center justify-center cursor-pointer active:scale-95">
            <ChevronLeft size={18} className="text-slate-400" />
          </button>
          <div>
            <h1 className="text-sm lg:text-base font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 tracking-tight flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" /> Global Stats Dashboard
            </h1>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-0.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
              DREAM MODE LIVE
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5">
             <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent text-slate-300 text-xs font-bold outline-none cursor-pointer" />
             <span className="text-slate-500 text-xs">~</span>
             <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent text-slate-300 text-xs font-bold outline-none cursor-pointer" />
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-mono font-bold text-slate-400">
            {now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <button onClick={() => fetchData(true, startDate, endDate)} className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/30 hover:bg-indigo-500/20 text-indigo-400 transition-all flex items-center justify-center cursor-pointer">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 flex flex-col p-4 gap-4 z-10 overflow-y-auto xl:overflow-hidden custom-scrollbar">
        
        {/* ROW 1: KPIs & Flow */}
        <div className="flex flex-col xl:flex-row gap-4 shrink-0">
          
          {/* KPI Grid */}
          <div className="flex-1 grid grid-cols-2 lg:grid-cols-5 gap-3">
            {KPI.map((k, i) => {
              const Icon = k.icon;
              return (
                <div key={i} className={`rounded-3xl p-4 bg-gradient-to-br from-white/5 to-transparent border border-white/5 relative overflow-hidden group hover:border-white/10 transition-all flex flex-col justify-center`}>
                  <div className={`absolute -right-4 -top-4 w-24 h-24 ${k.bg} blur-[30px] rounded-full group-hover:scale-110 transition-transform opacity-50`}></div>
                  <div className={`w-8 h-8 rounded-xl mb-3 flex items-center justify-center ${k.iconBg} border ${k.iconBorder}`}>
                    <Icon className={`w-4 h-4 ${k.color}`} />
                  </div>
                  <div className="text-3xl font-black text-slate-100 font-mono tracking-tighter mb-1">
                    {k.value}
                  </div>
                  <div className="text-[11px] font-bold text-slate-400 mb-1">{k.label}</div>
                  <div className="text-[9px] font-bold text-slate-500">{k.sub}</div>
                  <div className={`mt-3 text-[9px] font-mono font-bold px-2 py-1 rounded-lg border inline-flex self-start ${k.color} ${k.bg} ${k.iconBorder} opacity-80`}>
                    {k.formula}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Incident Lifecycle Flow */}
          <div className="xl:w-[450px] shrink-0 bg-zinc-900/40 backdrop-blur-sm rounded-3xl p-4 border border-white/5 flex flex-col shadow-lg">
            <div className="flex items-center gap-2 mb-4 shrink-0">
              <div className="p-1.5 bg-indigo-500/10 rounded-lg"><Activity className="w-4 h-4 text-indigo-400" /></div>
              <span className="text-sm font-black text-slate-200">인시던트 생애주기</span>
            </div>
            <div className="flex-1 flex items-center justify-between gap-1">
              {FLOW.map((f, i) => {
                const Icon = f.icon;
                return (
                  <React.Fragment key={i}>
                    <div className="flex flex-col items-center gap-2 flex-1">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${f.bg} border ${f.border} ${f.glow ? 'shadow-[0_0_15px_rgba(16,185,129,0.3)] animate-pulse' : ''}`}>
                        <Icon className={`w-5 h-5 ${f.color}`} />
                      </div>
                      <span className={`text-base font-black font-mono ${f.color}`}>{f.value}</span>
                      <span className="text-[9px] font-bold text-slate-400 text-center leading-tight break-keep">{f.label}</span>
                    </div>
                    {i < FLOW.length - 1 && (
                      <div className="w-4 h-[1px] bg-white/10 shrink-0" />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
          
        </div>

        {/* ROW 2: 4 Columns Data Grid */}
        <div className="flex-1 min-h-[400px] grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 pb-4">
          
          {/* Column 1: MTTA */}
          <div className="bg-zinc-900/40 backdrop-blur-sm rounded-3xl p-4 border border-white/5 flex flex-col min-h-0 shadow-lg">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-black text-slate-200">일자별 MTTA</h3>
              </div>
              <span className="text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded-full">Performance</span>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-3">
              {stats.incidents.mttaList && stats.incidents.mttaList.length > 0 ? stats.incidents.mttaList.map((m, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-3 shrink-0 hover:bg-white/10 transition-colors">
                  <div className="text-xs font-black text-slate-300 mb-2">{m.date}</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-2">
                      <div className="text-[10px] font-bold text-amber-400 mb-1">주간 (09~18)</div>
                      <div className="flex items-end gap-1">
                        <span className="text-lg font-black font-mono text-amber-200 leading-none">{m.dayMtta}</span>
                        <span className="text-[9px] font-bold text-slate-500 mb-0.5">분</span>
                      </div>
                      <div className="text-[9px] text-slate-500 mt-1">{m.dayCount}건 처리</div>
                    </div>
                    <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-xl p-2">
                      <div className="text-[10px] font-bold text-indigo-400 mb-1">야간 (18~09)</div>
                      <div className="flex items-end gap-1">
                        <span className="text-lg font-black font-mono text-indigo-200 leading-none">{m.nightMtta}</span>
                        <span className="text-[9px] font-bold text-slate-500 mb-0.5">분</span>
                      </div>
                      <div className="text-[9px] text-slate-500 mt-1">{m.nightCount}건 처리</div>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="flex items-center justify-center h-full text-xs font-bold text-slate-500">MTTA 데이터 없음</div>
              )}
            </div>
          </div>

          {/* Column 2: Categories */}
          <div className="bg-zinc-900/40 backdrop-blur-sm rounded-3xl p-4 border border-white/5 flex flex-col min-h-0 shadow-lg">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-black text-slate-200">카테고리 밀도</h3>
              </div>
              <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">{stats.knowledge.total} Assets</span>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-3">
              {stats.categories.length > 0 ? stats.categories.map((cat, i) => {
                const pct = Math.min(100, (cat.c / (stats.knowledge.total || 1)) * 100);
                const hue = (i * 47) % 360;
                const clr = `hsl(${hue}, 70%, 60%)`;
                return (
                  <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-3 shrink-0 hover:bg-white/10 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-black text-slate-300">{cat.category || '기타'}</span>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-lg" style={{ color: clr, backgroundColor: `${clr}15`, border: `1px solid ${clr}30` }}>{cat.c}</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${clr}80, ${clr})` }} />
                    </div>
                    <div className="mt-1.5 text-[9px] font-bold font-mono text-slate-500 text-right">{pct.toFixed(1)}% of total</div>
                  </div>
                );
              }) : (
                <div className="flex items-center justify-center h-full text-xs font-bold text-slate-500">카테고리 데이터 없음</div>
              )}
            </div>
          </div>

          {/* Column 3: Contributors */}
          <div className="bg-zinc-900/40 backdrop-blur-sm rounded-3xl p-4 border border-white/5 flex flex-col min-h-0 shadow-lg">
            <div className="flex items-center justify-between mb-2 shrink-0">
              <div className="flex items-center gap-2">
                <Medal className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-black text-slate-200">전문가 기여도</h3>
              </div>
              <span className="text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">Honor Board</span>
            </div>
            <div className="flex flex-wrap gap-2 p-2 rounded-xl bg-white/5 border border-white/10 mb-3 shrink-0">
              <span className="text-[8px] font-bold text-slate-500">SCORE =</span>
              <span className="text-[8px] font-black text-pink-400">전파 × 50pt</span>
              <span className="text-[8px] font-bold text-slate-500">+</span>
              <span className="text-[8px] font-black text-emerald-400">KB × 30pt</span>
              <span className="text-[8px] font-bold text-slate-500">+</span>
              <span className="text-[8px] font-black text-blue-400">참여 × 20pt</span>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-3">
              {stats.topContributors.length > 0 ? stats.topContributors.map((user, i) => {
                const isTop = i === 0;
                return (
                  <div key={i} className={`flex items-center gap-3 rounded-2xl p-3 shrink-0 transition-all ${isTop ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-white/5 border border-white/10 hover:bg-white/10'}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black shrink-0 ${isTop ? 'bg-amber-500/20 border-2 border-amber-500/40 text-amber-400' : 'bg-white/5 border border-white/10 text-slate-400'}`}>
                      {isTop ? '🥇' : `${i + 1}`}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-xs font-black truncate mb-0.5 ${isTop ? 'text-amber-200' : 'text-slate-200'}`}>@{user.name}</div>
                      <div className="text-[9px] font-bold text-slate-500 truncate mb-1.5">{user.full_org}</div>
                      <div className="flex gap-2">
                        <span className="text-[9px] font-bold text-pink-400">전파:{user.warroom_count}</span>
                        <span className="text-[9px] font-bold text-emerald-400">KB:{user.kb_count}</span>
                        <span className="text-[9px] font-bold text-blue-400">참여:{user.chat_count}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
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

          {/* Column 4: Feed */}
          <div className="bg-zinc-900/40 backdrop-blur-sm rounded-3xl p-4 border border-white/5 flex flex-col min-h-0 shadow-lg">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <div className="flex items-center gap-2">
                <FileSearch className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-black text-slate-200">인텔리전스 피드</h3>
              </div>
              <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-3">
              {stats.recentFeed.length > 0 ? stats.recentFeed.map((item, i) => (
                <div key={i} className={`rounded-2xl p-3 shrink-0 relative overflow-hidden transition-all ${i === 0 ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-white/5 border border-white/10 hover:bg-white/10'}`}>
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
                  <div className="flex items-center gap-1.5">
                    <Brain className="w-3 h-3 text-slate-500" />
                    <span className="text-[9px] font-bold text-slate-400">@{item.reg_name || 'SYSTEM'}</span>
                    <span className="text-[9px] font-bold text-slate-600 ml-1">· RAG Synced ✦</span>
                  </div>
                </div>
              )) : (
                <div className="flex items-center justify-center h-full text-xs font-bold text-slate-500">피드 데이터 없음</div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
