import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Activity, Server, Clock, AlertTriangle, CheckCircle, 
  BarChart2, PieChart, Shield, Zap, Info, ChevronRight, Filter,
  TrendingUp, Monitor, Database, Network, Radio, Cpu
} from 'lucide-react';

export default function OverallStatusPage() {
  const navigate = useNavigate();
  const [transCount, setTransCount] = useState(141407232);
  const [loading, setLoading] = useState(true);
  const [tps, setTps] = useState(5882.0);
  const [latency, setLatency] = useState(0.082);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1200);
    
    // Counter animation
    const counterInterval = setInterval(() => {
      setTransCount(prev => prev + Math.floor(Math.random() * 150 + 50));
    }, 1000);
    
    // TPS/Latency fluctuation
    const metricsInterval = setInterval(() => {
      setTps(prev => prev + (Math.random() - 0.5) * 200);
      setLatency(prev => Math.max(0.05, prev + (Math.random() - 0.5) * 0.01));
    }, 1500);
    
    return () => {
      clearTimeout(timer);
      clearInterval(counterInterval);
      clearInterval(metricsInterval);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#06080c] flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/10 via-purple-900/5 to-emerald-900/10" />
        <div className="flex flex-col items-center space-y-6 relative z-10">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
            <div className="absolute inset-0 w-20 h-20 border-4 border-purple-500/20 border-b-purple-500 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
          </div>
          <div className="text-center space-y-2">
            <p className="text-xl font-bold text-blue-400 animate-pulse">시스템 처리 현황을 불러오는 중...</p>
            <p className="text-xs text-slate-500 font-mono">INITIALIZING MONITORING DASHBOARD</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#06080c] text-white font-sans flex flex-col p-4 space-y-4 relative overflow-hidden">
      
      {/* Animated Background Gradients */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[150px] animate-pulse pointer-events-none" style={{ animationDuration: '4s' }} />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[150px] animate-pulse pointer-events-none" style={{ animationDuration: '6s' }} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-600/5 rounded-full blur-[200px] pointer-events-none" />
      
      {/* Header */}
      <header className="flex items-center justify-between bg-gradient-to-r from-[#11141d]/90 via-[#151923]/90 to-[#11141d]/90 backdrop-blur-xl p-5 rounded-3xl border border-white/10 sticky top-0 z-50 shadow-2xl shadow-black/50">
        <div className="flex items-center space-x-4">
          <button onClick={() => navigate(-1)} className="p-2.5 rounded-2xl hover:bg-white/10 transition-all hover:scale-110 active:scale-95">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="h-10 w-px bg-white/10" />
          <div>
            <h1 className="text-xl font-black flex items-center gap-2.5">
              <div className="relative">
                <Activity className="w-6 h-6 text-emerald-400" />
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              </div>
              <span className="bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">서버 모니터링 현황</span>
              <span className="text-[10px] bg-gradient-to-r from-emerald-500/20 to-emerald-600/20 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/30 ml-2 font-bold animate-pulse backdrop-blur-sm">● RUNNING</span>
            </h1>
            <p className="text-[10px] text-slate-500 font-mono tracking-wider mt-1 flex items-center gap-2">
              <Radio className="w-3 h-3" />
              TRANMANAGER / SHINHAN CARD / 운영환경
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3 text-[10px] font-mono text-slate-300 bg-black/40 px-5 py-2.5 rounded-2xl border border-white/10 backdrop-blur-sm">
          <Clock className="w-4 h-4 text-blue-400 animate-pulse" />
          <span className="font-bold">REALTIME: {new Date().toLocaleTimeString('ko-KR')}</span>
        </div>
      </header>

      {/* Main Grid */}
      <main className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 relative z-10">
        
        {/* Left Column: Core Stats */}
        <div className="md:col-span-8 space-y-4">
          
          {/* Top Summary with Glassmorphism */}
          <div className="bg-gradient-to-br from-[#11141d]/80 via-[#13161f]/80 to-[#11141d]/80 backdrop-blur-xl rounded-3xl p-7 border border-white/10 grid grid-cols-1 lg:grid-cols-3 gap-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-blue-600/10 to-transparent rounded-full blur-3xl" />
            
            {/* Total Count with Shimmer Effect */}
            <div className="lg:col-span-1 border-r border-white/10 pr-6 relative overflow-hidden group">
              <div className="absolute -top-10 -left-10 w-40 h-40 bg-emerald-500/20 blur-3xl rounded-full group-hover:scale-125 transition-transform duration-1000" />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              
              <p className="text-xs text-emerald-400/80 font-black mb-3 uppercase tracking-[0.2em] flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 animate-pulse" />
                오늘 총 거래건수
              </p>
              <div className="text-5xl font-black text-transparent bg-gradient-to-r from-emerald-400 via-emerald-300 to-emerald-500 bg-clip-text font-mono tracking-tighter animate-pulse drop-shadow-[0_0_15px_rgba(52,211,153,0.5)]">
                {transCount.toLocaleString()}
              </div>
              <div className="mt-5 flex items-center gap-2 text-[11px] text-slate-400 bg-black/30 px-3 py-2 rounded-xl border border-emerald-500/20 backdrop-blur-sm">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span>전일 대비 <span className="text-emerald-400 font-black text-sm">+12.4%</span> 증가</span>
              </div>
            </div>

            {/* Status Grid with Hover Effects */}
            <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: '정상 처리', val: '138,714,043', color: 'text-emerald-400', bg: 'from-emerald-500/20 to-emerald-600/10', border: 'border-emerald-500/30', glow: 'shadow-emerald-500/20' },
                { label: '타임아웃', val: '505', color: 'text-orange-400', bg: 'from-orange-500/20 to-orange-600/10', border: 'border-orange-500/30', glow: 'shadow-orange-500/20' },
                { label: '오류(SYS)', val: '11,491', color: 'text-red-400', bg: 'from-red-500/20 to-red-600/10', border: 'border-red-500/30', glow: 'shadow-red-500/20' },
                { label: '지연 발생', val: '1,534,846', color: 'text-yellow-400', bg: 'from-yellow-500/20 to-yellow-600/10', border: 'border-yellow-500/30', glow: 'shadow-yellow-500/20' },
              ].map((stat, i) => (
                <div key={i} className={`bg-gradient-to-br ${stat.bg} ${stat.border} border-2 p-4 rounded-2xl flex flex-col justify-between relative overflow-hidden group cursor-pointer transition-all hover:scale-105 hover:shadow-xl ${stat.glow} backdrop-blur-sm`}>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider relative z-10">{stat.label}</span>
                  <span className={`text-base font-black font-mono ${stat.color} relative z-10 drop-shadow-lg`}>{stat.val}</span>
                  <div className={`absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r ${stat.bg.replace('/20', '/60').replace('/10', '/40')}`} />
                </div>
              ))}
            </div>
          </div>

          {/* Enhanced TPS Chart */}
          <div className="bg-gradient-to-br from-[#11141d]/80 via-[#13161f]/80 to-[#11141d]/80 backdrop-blur-xl rounded-3xl p-7 border border-white/10 shadow-2xl space-y-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-blue-600/10 to-purple-600/5 rounded-full blur-[150px]" />
            
            <div className="flex justify-between items-center relative z-10">
              <h3 className="text-base font-black flex items-center gap-3">
                <div className="bg-blue-600/20 p-2 rounded-xl border border-blue-500/30">
                  <Zap className="w-5 h-5 text-blue-400" />
                </div>
                <span className="bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">실시간 거래 처리 현황</span>
              </h3>
              <div className="flex gap-3">
                <span className="text-[10px] text-slate-400 flex items-center gap-1.5 bg-blue-500/10 px-3 py-1.5 rounded-xl border border-blue-500/20">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" /> TPS
                </span>
                <span className="text-[10px] text-slate-400 flex items-center gap-1.5 bg-orange-500/10 px-3 py-1.5 rounded-xl border border-orange-500/20">
                  <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" /> LATENCY
                </span>
              </div>
            </div>

            {/* Enhanced Chart with Glow */}
            <div className="h-56 relative flex items-end justify-between space-x-0.5 border-b-2 border-white/10 pb-2 group">
              {Array.from({ length: 50 }).map((_, i) => {
                const height = 20 + Math.random() * 75;
                const delay = i * 20;
                return (
                  <div key={i} className="flex-1 space-y-0.5 relative" style={{ animationDelay: `${delay}ms` }}>
                    <div 
                      className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t hover:from-blue-500 hover:to-blue-300 transition-all duration-300 relative overflow-hidden group/bar shadow-lg shadow-blue-500/30" 
                      style={{ height: `${height}%` }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/20 to-transparent opacity-0 group-hover/bar:opacity-100 transition-opacity" />
                    </div>
                    <div 
                      className="w-full bg-gradient-to-t from-orange-600 to-orange-400 rounded-t hover:from-orange-500 hover:to-orange-300 transition-all duration-300 shadow-lg shadow-orange-500/20" 
                      style={{ height: `${(100-height)*0.35}%` }}
                    />
                  </div>
                );
              })}
              
              {/* Grid Overlay */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="border-t border-white/5" />
                ))}
              </div>
              
              {/* Animated Value Displays */}
              <div className="absolute top-2 left-2 bg-gradient-to-br from-blue-600/90 to-blue-700/90 backdrop-blur-xl px-5 py-3 rounded-2xl border border-blue-400/30 shadow-2xl shadow-blue-500/30">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-white font-mono drop-shadow-lg">{tps.toFixed(1)}</span>
                  <span className="text-xs text-blue-200 font-bold">tps</span>
                </div>
                <p className="text-[8px] text-blue-200/70 font-mono mt-0.5">TRANSACTIONS/SEC</p>
              </div>
              <div className="absolute top-2 right-2 bg-gradient-to-br from-orange-600/90 to-orange-700/90 backdrop-blur-xl px-5 py-3 rounded-2xl border border-orange-400/30 shadow-2xl shadow-orange-500/30">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-white font-mono drop-shadow-lg">{latency.toFixed(3)}</span>
                  <span className="text-xs text-orange-200 font-bold">s</span>
                </div>
                <p className="text-[8px] text-orange-200/70 font-mono mt-0.5">AVG RESPONSE</p>
              </div>
            </div>

            {/* Component Status */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 relative z-10">
              {['MCI', 'WAS', 'WAS-DB', 'TP', 'TP-DB', 'EAI'].map((name, i) => (
                <div key={i} className="bg-gradient-to-br from-black/40 to-black/20 backdrop-blur-sm p-4 rounded-2xl border border-white/10 text-center hover:border-blue-500/30 transition-all hover:scale-105 group cursor-pointer">
                  <p className="text-[10px] text-slate-400 font-bold mb-3 group-hover:text-blue-400 transition-colors">{name}</p>
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="w-full h-1.5 bg-gradient-to-r from-blue-600 to-blue-400 rounded-full shadow-lg shadow-blue-500/30" />
                    <div className="w-full h-1.5 bg-gradient-to-r from-blue-600/60 to-blue-400/60 rounded-full" />
                    <div className="w-full h-1.5 bg-gradient-to-r from-blue-600/30 to-blue-400/30 rounded-full" />
                  </div>
                  <p className="text-[8px] text-emerald-400 font-mono mt-2 flex items-center justify-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    ACTIVE
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Enhanced Table */}
          <div className="bg-gradient-to-br from-[#11141d]/80 via-[#13161f]/80 to-[#11141d]/80 backdrop-blur-xl rounded-3xl p-7 border border-white/10 shadow-2xl relative overflow-hidden">
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-tl from-purple-600/10 to-transparent rounded-full blur-[150px]" />
            
            <div className="flex justify-between items-center mb-6 relative z-10">
              <h3 className="text-base font-black flex items-center gap-3">
                <div className="bg-blue-600/20 p-2 rounded-xl border border-blue-500/30">
                  <Monitor className="w-5 h-5 text-blue-400" />
                </div>
                <span className="bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">주요 업무별 처리 현황</span>
              </h3>
              <button className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl border border-white/10 transition-all">
                MORE <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            
            <div className="overflow-x-auto relative z-10">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-gradient-to-r from-black/50 to-black/30 text-slate-400 uppercase backdrop-blur-sm">
                  <tr className="border-y border-white/10">
                    <th className="px-5 py-4 first:rounded-l-2xl font-black tracking-wider">업무명</th>
                    <th className="px-5 py-4 font-black tracking-wider">총거래건수</th>
                    <th className="px-5 py-4 font-black tracking-wider">오류비율</th>
                    <th className="px-5 py-4 font-black tracking-wider">TPS</th>
                    <th className="px-5 py-4 last:rounded-r-2xl font-black tracking-wider">E2E시간</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {[
                    { name: '계정', count: '69,265,723', error: '1.6%', errorWidth: '16%', tps: '2777.0', e2e: '0.108s', color: 'text-blue-400', bg: 'from-blue-500/5 to-transparent' },
                    { name: '승인', count: '20,205,823', error: '0.2%', errorWidth: '2%', tps: '829.6', e2e: '0.097s', color: 'text-emerald-400', bg: 'from-emerald-500/5 to-transparent' },
                    { name: '정보', count: '65,328', error: '0.0%', errorWidth: '0%', tps: '1.4', e2e: '0.299s', color: 'text-purple-400', bg: 'from-purple-500/5 to-transparent' },
                  ].map((row, i) => (
                    <tr key={i} className={`hover:bg-gradient-to-r ${row.bg} transition-all cursor-pointer group border-l-4 border-transparent hover:border-${row.color.split('-')[1]}-500`}>
                      <td className={`px-5 py-5 font-black ${row.color} group-hover:scale-105 transition-transform`}>{row.name}</td>
                      <td className="px-5 py-5 font-mono text-slate-300 font-bold">{row.count}</td>
                      <td className="px-5 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-20 h-2 bg-slate-800/50 rounded-full overflow-hidden border border-white/10">
                            <div className="h-full bg-gradient-to-r from-red-600 to-red-400 shadow-lg shadow-red-500/50 transition-all duration-500" style={{ width: row.errorWidth }} />
                          </div>
                          <span className="text-[10px] font-black text-red-400">{row.error}</span>
                        </div>
                      </td>
                      <td className="px-5 py-5 font-mono text-slate-300 font-bold">{row.tps}</td>
                      <td className="px-5 py-5 font-mono text-slate-300 font-bold">{row.e2e}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column - Enhanced */}
        <div className="md:col-span-4 space-y-4">
          
          {/* Node Performance */}
          <div className="bg-gradient-to-br from-[#11141d]/80 via-[#13161f]/80 to-[#11141d]/80 backdrop-blur-xl rounded-3xl p-7 border border-white/10 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-64 h-64 bg-gradient-to-br from-emerald-600/10 to-transparent rounded-full blur-[120px]" />
            
            <h3 className="text-base font-black flex items-center gap-3 mb-6 relative z-10">
              <div className="bg-emerald-600/20 p-2 rounded-xl border border-emerald-500/30">
                <Network className="w-5 h-5 text-emerald-400" />
              </div>
              <span className="bg-gradient-to-r from-white to-emerald-200 bg-clip-text text-transparent">주요 장비별 처리 성능</span>
            </h3>
            
            <div className="grid grid-cols-2 gap-4 relative z-10">
              {['prkjap05', 'prkjap03', 'prkjap01', 'prcorap1'].map((node, i) => (
                <div key={i} className="bg-gradient-to-br from-black/40 to-black/20 backdrop-blur-sm p-4 rounded-2xl border border-white/10 space-y-4 hover:border-emerald-500/30 transition-all hover:scale-105 group cursor-pointer">
                  <p className="text-[10px] text-slate-400 font-mono flex items-center justify-between group-hover:text-emerald-400 transition-colors">
                    <span className="font-black">{node}</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-lg shadow-emerald-500/50" />
                      <span className="text-emerald-400 font-bold">ON</span>
                    </div>
                  </p>
                  
                  <div className="h-24 flex gap-1 items-end bg-black/30 rounded-xl p-2 border border-white/5">
                    {[70, 55, 40, 25, 65, 50].map((h, j) => (
                      <div key={j} className="flex-1 bg-gradient-to-t from-blue-600 to-blue-400 rounded-t shadow-lg shadow-blue-500/30 hover:from-blue-500 hover:to-blue-300 transition-all" style={{ height: `${h}%` }} />
                    ))}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-[9px] font-mono">
                    <div className="bg-blue-500/10 px-2 py-1.5 rounded-lg border border-blue-500/20">
                      <span className="text-slate-500">CPU</span>
                      <span className="text-blue-400 font-bold ml-1">45.2%</span>
                    </div>
                    <div className="bg-purple-500/10 px-2 py-1.5 rounded-lg border border-purple-500/20">
                      <span className="text-slate-500">MEM</span>
                      <span className="text-purple-400 font-bold ml-1">8.0G</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Enhanced Donut Charts */}
          <div className="bg-gradient-to-br from-[#11141d]/80 via-[#13161f]/80 to-[#11141d]/80 backdrop-blur-xl rounded-3xl p-7 border border-white/10 shadow-2xl space-y-8 relative overflow-hidden">
            <div className="absolute bottom-0 right-0 w-64 h-64 bg-gradient-to-tl from-purple-600/10 to-transparent rounded-full blur-[120px]" />
            
            {/* Chart 1 */}
            <div className="space-y-5 relative z-10">
              <h3 className="text-xs font-black text-slate-300 uppercase tracking-[0.15em] flex items-center gap-2">
                <Cpu className="w-4 h-4 text-blue-400" />
                주요 AP별 거래건수 비율
              </h3>
              <div className="flex items-center gap-6">
                <div className="relative w-28 h-28 group">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="56" cy="56" r="40" stroke="currentColor" strokeWidth="14" fill="transparent" className="text-blue-500/10" />
                    <circle cx="56" cy="56" r="40" stroke="url(#blueGradient)" strokeWidth="14" fill="transparent" strokeDasharray="251" strokeDashoffset="50" className="drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                    <circle cx="56" cy="56" r="40" stroke="url(#emeraldGradient)" strokeWidth="14" fill="transparent" strokeDasharray="251" strokeDashoffset="200" className="drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                    <defs>
                      <linearGradient id="blueGradient">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#60a5fa" />
                      </linearGradient>
                      <linearGradient id="emeraldGradient">
                        <stop offset="0%" stopColor="#10b981" />
                        <stop offset="100%" stopColor="#34d399" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-black text-xl text-blue-400 drop-shadow-lg">MCI</span>
                  </div>
                </div>
                <div className="flex-1 space-y-2.5">
                  {[
                    { label: 'MCI (Mobile/Web)', pct: '82%', color: 'blue' },
                    { label: 'EAI (Interface)', pct: '12%', color: 'emerald' },
                    { label: 'OTHERS', pct: '6%', color: 'slate' },
                  ].map((item, i) => (
                    <div key={i} className={`flex justify-between text-[11px] bg-${item.color}-500/5 px-3 py-2 rounded-xl border border-${item.color}-500/20 hover:border-${item.color}-500/40 transition-all cursor-pointer group`}>
                      <span className="text-slate-400 group-hover:text-white transition-colors">{item.label}</span>
                      <span className={`text-${item.color}-400 font-black`}>{item.pct}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-white/10" />

            {/* Chart 2 */}
            <div className="space-y-5 relative z-10">
              <h3 className="text-xs font-black text-slate-300 uppercase tracking-[0.15em] flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-400" />
                주요 AP별 응답시간 비율
              </h3>
              <div className="flex items-center gap-6">
                <div className="relative w-28 h-28">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="56" cy="56" r="40" stroke="currentColor" strokeWidth="14" fill="transparent" className="text-purple-500/10" />
                    <circle cx="56" cy="56" r="40" stroke="url(#purpleGradient)" strokeWidth="14" fill="transparent" strokeDasharray="251" strokeDashoffset="25" className="drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]" />
                    <circle cx="56" cy="56" r="40" stroke="url(#orangeGradient)" strokeWidth="14" fill="transparent" strokeDasharray="251" strokeDashoffset="160" className="drop-shadow-[0_0_10px_rgba(249,115,22,0.5)]" />
                    <defs>
                      <linearGradient id="purpleGradient">
                        <stop offset="0%" stopColor="#a855f7" />
                        <stop offset="100%" stopColor="#c084fc" />
                      </linearGradient>
                      <linearGradient id="orangeGradient">
                        <stop offset="0%" stopColor="#f97316" />
                        <stop offset="100%" stopColor="#fb923c" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-center">
                    <span className="font-black text-base text-purple-400 leading-tight drop-shadow-lg">계정<br/>서버</span>
                  </div>
                </div>
                <div className="flex-1 space-y-2.5">
                  {[
                    { label: 'UNDER 50ms', pct: '94%', color: 'purple' },
                    { label: '50 ~ 200ms', pct: '5.8%', color: 'orange' },
                    { label: 'OVER 1s', pct: '0.2%', color: 'red' },
                  ].map((item, i) => (
                    <div key={i} className={`flex justify-between text-[11px] bg-${item.color}-500/5 px-3 py-2 rounded-xl border border-${item.color}-500/20 hover:border-${item.color}-500/40 transition-all cursor-pointer group`}>
                      <span className="text-slate-400 group-hover:text-white transition-colors">{item.label}</span>
                      <span className={`text-${item.color}-400 font-black`}>{item.pct}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Enhanced Floating Button */}
      <button 
        onClick={() => navigate('/dashboard')}
        className="fixed bottom-8 right-8 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white px-7 py-4 rounded-full shadow-2xl shadow-blue-900/50 font-bold flex items-center gap-2.5 transform active:scale-95 transition-all z-50 border border-blue-400/30 backdrop-blur-sm hover:shadow-blue-500/50 hover:scale-110 group"
      >
        <TrendingUp className="w-5 h-5 group-hover:rotate-12 transition-transform" />
        <span className="text-sm">대시보드로 돌아가기</span>
      </button>
    </div>
  );
}
