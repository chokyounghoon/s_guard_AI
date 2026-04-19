import React, { useState, useEffect } from 'react';
import { RefreshCw, Zap, ServerCrash, Search, Compass, CheckCircle2, XCircle, Loader2, Database, ShieldAlert, SlidersHorizontal } from 'lucide-react';
import { toast, Toaster } from 'react-hot-toast';
import { getAuthHeaders } from '../lib/authStore';

export default function OrbitalCommandPage() {
  const [threshold, setThreshold] = useState(0.80);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  
  const [stats, setStats] = useState({ total: 0, success: 0, pending: 0 });
  const [isStatsLoading, setIsStatsLoading] = useState(true);

  const [sandboxQuery, setSandboxQuery] = useState('');
  const [sandboxResults, setSandboxResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const fetchStats = async () => {
    try {
      const res = await fetch('https://sguardai.khcho0421.workers.dev/ai/knowledge/sync-status', {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      setStats({ total: data.total, success: data.success, pending: data.pending });
    } catch (e) {
      console.error('Failed to fetch stats', e);
    } finally {
      setIsStatsLoading(false);
    }
  };

  useEffect(() => {
    // 🚀 Unified API Integration
    fetch('https://sguardai.khcho0421.workers.dev/sms/settings', {
      headers: getAuthHeaders()
    })
      .then(r => r.json())
      .then(data => { 
        if (data.success) {
          const tech = data.settings.find(s => s.key === 'similarity_threshold_technical')?.value;
          if (tech) setThreshold(parseFloat(tech));
        }
      })
      .catch(e => console.error('Failed to fetch threshold', e));
      
    fetchStats();
  }, []);

  const saveThreshold = async (newVal) => {
    try {
      const res = await fetch('https://sguardai.khcho0421.workers.dev/sms/settings', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ key: 'similarity_threshold_technical', value: String(newVal) })
      });
      if (res.ok) {
        toast.success(`임해값이 ${newVal.toFixed(2)}로 통합 DB에 즉시 적용되었습니다.`);
      }
    } catch (e) {
      toast.error('설정 저장 중 오류가 발생했습니다.');
    }
  };

  const handleSliderChange = (e) => {
    const val = parseFloat(e.target.value);
    setThreshold(val);
    saveThreshold(val); // 즉시 반영
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch('https://sguardai.khcho0421.workers.dev/ai/knowledge/sync-pending', { 
        method: 'POST',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setSyncResult({ type: 'success', msg: `동기화 완료: ${data.successCount}건 성공 (총 ${data.processed} 처리)` });
        toast.success('Vectorize 통신 완료');
        fetchStats();
      } else {
        setSyncResult({ type: 'error', msg: `동기화 오류: ${data.error}` });
      }
    } catch (e) {
      setSyncResult({ type: 'error', msg: `네트워크 오류 발생` });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSandboxSearch = async () => {
    if (!sandboxQuery.trim()) return;
    setIsSearching(true);
    try {
      // Sandbox 조회 시 threshold 0으로 보내어 전체 스코어를 받아오고 프론트에서 필터/블러 처리
      const res = await fetch(`https://sguardai.khcho0421.workers.dev/ai/knowledge/search?q=${encodeURIComponent(sandboxQuery)}&threshold=0.0`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.results) {
        setSandboxResults(data.results);
      } else {
        setSandboxResults([]);
      }
    } catch (e) {
      toast.error('검색 중 오류 발생');
      setSandboxResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const syncPercentage = stats.total > 0 ? (stats.success / stats.total) * 100 : 0;
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (syncPercentage / 100) * circumference;

  return (
    <div className="min-h-screen bg-[#020617] text-slate-300 pb-24 font-pretendard selection:bg-cyan-500/30 selection:text-cyan-200">
      <Toaster position="top-center" toastOptions={{ 
        style: { background: '#0f172a', color: '#fff', border: '1px solid rgba(6,182,212,0.2)' } 
      }}/>
      
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#020617]/90 backdrop-blur-2xl border-b border-cyan-500/10 py-5 px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-cyan-950/50 p-3 rounded-2xl border border-cyan-500/30 relative overflow-hidden group">
            <Compass className="w-6 h-6 text-cyan-400 relative z-10 animate-[spin_8s_linear_infinite]" />
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-cyan-500/20 to-transparent"></div>
          </div>
          <div>
            <h1 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400 tracking-tight flex items-center gap-2">
              ORBITAL COMMAND <span className="text-white">WAR-ROOM</span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">ZERO-G</span>
            </h1>
            <p className="text-[10px] font-mono text-cyan-500/50 tracking-widest uppercase">Linear RAG Control Panel</p>
          </div>
        </div>
      </header>

      <main className="p-6 max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-500">
        
        {/* Module A: Global Sync Engine */}
        <section className="bg-slate-900/50 border border-indigo-500/10 rounded-3xl p-6 relative overflow-hidden shadow-2xl backdrop-blur-sm">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[100px] rounded-full pointer-events-none"></div>
          
          <div className="flex items-start justify-between mb-8 relative z-10">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20"><RefreshCw className="w-5 h-5 text-indigo-400" /></div>
                <h2 className="text-lg font-bold text-slate-100 tracking-wide uppercase">Global Sync Engine</h2>
              </div>
              <p className="text-xs text-slate-500 font-mono">D1 ↔ Vectorize 768-dim Synchronization</p>
            </div>
            
            {/* Circular Gauge */}
            <div className="relative flex items-center justify-center w-24 h-24">
              <svg className="transform -rotate-90 w-24 h-24">
                <circle cx="48" cy="48" r={radius} stroke="currentColor" strokeWidth="6" fill="transparent" className="text-slate-800" />
                <circle 
                  cx="48" cy="48" r={radius} stroke="currentColor" strokeWidth="6" fill="transparent" 
                  strokeDasharray={circumference} strokeDashoffset={isNaN(strokeDashoffset) ? circumference : strokeDashoffset}
                  className="text-cyan-400 transition-all duration-1000 ease-out" 
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-lg font-black text-white">{isStatsLoading ? '...' : Math.round(syncPercentage)}%</span>
              </div>
            </div>
          </div>

          <div className="space-y-4 relative z-10">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-400">Total D1 Records: <span className="text-white font-bold">{stats.total}</span></span>
              <span className="text-cyan-400">Vectorized: <span className="font-bold">{stats.success}</span></span>
              <span className="text-red-400">Pending/Fail: <span className="font-bold">{stats.pending}</span></span>
            </div>
            
            {/* Visual Progress Bar during Sync */}
            <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
              <div className={`h-full bg-gradient-to-r from-cyan-500 to-indigo-500 transition-all duration-300 ${isSyncing ? 'w-full animate-pulse' : 'w-0'}`}></div>
            </div>

            <button 
              onClick={handleSync}
              disabled={isSyncing || stats.pending === 0}
              className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all duration-200
                ${isSyncing ? 'bg-indigo-600/30 text-white/50 cursor-not-allowed' : 
                  stats.pending === 0 ? 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed border' : 
                  'bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:scale-[1.01]'}`}
            >
              {isSyncing ? <><Loader2 className="w-5 h-5 animate-spin" /> 벡터라이징 진행 중...</> : 
               stats.pending === 0 ? <><CheckCircle2 className="w-5 h-5" /> 모든 데이터 동기화 완료</> :
               <><Zap className="w-5 h-5" /> SYNC NOW</>}
            </button>
            
            {syncResult && (
              <div className={`text-center text-[10px] font-mono ${syncResult.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                {syncResult.msg}
              </div>
            )}
          </div>
        </section>

        {/* Module B: Similarity Sandbox */}
        <section className="bg-slate-900/50 border border-cyan-500/10 rounded-3xl p-6 relative shadow-2xl backdrop-blur-sm z-20">
          <div className="flex items-center gap-3 mb-6">
             <div className="p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/20"><Search className="w-5 h-5 text-cyan-400" /></div>
            <h2 className="text-lg font-bold text-slate-100 tracking-wide uppercase">Similarity Sandbox</h2>
          </div>
          
          <div className="relative mb-8 group">
            <input 
              type="text" 
              value={sandboxQuery}
              onChange={(e) => setSandboxQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSandboxSearch()}
              placeholder="System failure symptoms...? (e.g. Connection Error)"
              className="w-full bg-[#020617] border border-cyan-900 hover:border-cyan-700 rounded-2xl py-5 pl-6 pr-32 text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 transition-all font-mono text-sm shadow-[0_0_15px_rgba(6,182,212,0.05)]"
            />
            <button 
              onClick={handleSandboxSearch}
              disabled={isSearching}
              className="absolute right-2 top-2 bottom-2 bg-cyan-600 hover:bg-cyan-500 text-white px-6 rounded-xl font-bold transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'TEST'}
            </button>
          </div>

          <div className="space-y-4">
            {sandboxResults.length === 0 && !isSearching && (
              <div className="h-32 flex flex-col items-center justify-center text-slate-600 border border-dashed border-slate-800 rounded-2xl">
                <ShieldAlert className="w-8 h-8 mb-2 opacity-20" />
                <span className="text-xs font-mono uppercase tracking-widest">Awaiting Query Injection</span>
              </div>
            )}
            
            {sandboxResults.map((res, i) => {
              const isBelowThreshold = res.score < threshold;
              
              // Color coding based heavily on score
              let scoreColorCode = 'text-red-400 bg-red-400/10 border-red-500/30';
              let edgeColor = 'border-red-500/20';
              
              if (res.score >= 0.9) {
                scoreColorCode = 'text-green-400 bg-green-400/10 border-green-500/30';
                edgeColor = 'border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.1)]';
              } else if (res.score >= 0.8) {
                scoreColorCode = 'text-yellow-400 bg-yellow-400/10 border-yellow-500/30';
                edgeColor = 'border-yellow-500/40';
              }

              return (
                <div key={i} className={`bg-[#020617] border ${edgeColor} rounded-2xl p-5 flex gap-5 transition-all duration-300
                  ${isBelowThreshold ? 'opacity-40 blur-[1px] grayscale-[0.8]' : 'grayscale-0'}
                  hover:blur-none hover:opacity-100`}>
                  
                  <div className={`flex flex-col items-center justify-center shrink-0 w-20 rounded-xl border py-3 ${scoreColorCode}`}>
                    <span className="text-xl font-black">{res.score.toFixed(3)}</span>
                    <span className="text-[9px] font-mono uppercase opacity-70 mt-1">Score</span>
                  </div>
                  
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono uppercase border border-slate-700">
                        {res.category || 'General'}
                      </span>
                      <span className="text-[9px] text-slate-500 font-mono uppercase truncate flex-1 text-right">
                        Mapping: {res.id ? `ID-${res.id}` : `INC-${res.inc_id}`}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-200 mb-1 truncate">{res.title}</h3>
                    <p className="text-xs text-slate-500 line-clamp-1">{res.content}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Module C: Orbital Threshold Controller */}
        <section className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 relative overflow-hidden backdrop-blur-sm z-10">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-800 rounded-lg border border-slate-700"><SlidersHorizontal className="w-5 h-5 text-slate-300" /></div>
              <div>
                <h2 className="text-sm font-bold text-slate-200 tracking-wide uppercase">Threshold Controller</h2>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">Similarity Cutoff (0.00 - 1.00)</p>
              </div>
            </div>
            
            <div className="bg-[#020617] px-4 py-2 rounded-xl border border-cyan-500/30">
               <span className="font-black text-2xl text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400 font-mono">
                 {threshold.toFixed(2)}
               </span>
            </div>
          </div>

          <div className="relative pt-4 pb-2">
            <input 
              type="range" 
              min="0.00" max="1.00" step="0.01" 
              value={threshold}
              onChange={handleSliderChange}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500 hover:accent-cyan-400 drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]"
            />
            {/* 📏 Precision Merged Scale Labels */}
            <div className="relative h-6 mt-3 text-[10px] font-mono text-slate-500 font-bold">
               <span className="absolute left-0 -translate-x-0">0.00 (ALL)</span>
               <span className="absolute left-[80%] -translate-x-1/2 text-yellow-500">0.80 (STANDARD)</span>
               <span className="absolute left-[90%] -translate-x-1/2 text-green-500">0.90 (STRICT)</span>
               <span className="absolute right-0 translate-x-0">1.00</span>
            </div>
          </div>
          
          <div className="mt-4 text-[10px] text-slate-500 flex items-center justify-center gap-1 font-mono uppercase bg-[#020617] p-2 rounded-lg border border-slate-800">
             <Database className="w-3 h-3" /> 변경 시 KV Storage에 실시간으로 반영됩니다.
          </div>
        </section>
      </main>
    </div>
  );
}
