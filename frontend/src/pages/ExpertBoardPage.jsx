import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBackNavigation } from '../hooks/useBackNavigation';
import {
  Medal, ChevronLeft, Loader2, RefreshCw, Trophy,
  MessageSquare, Database, Users, Zap, Crown, Star
} from 'lucide-react';

const API_BASE = 'https://sguardai.khcho0421.workers.dev';

const RANK_STYLES = [
  { icon: '🥇', bg: 'bg-amber-500/20', border: 'border-amber-500/40', text: 'text-amber-400', glow: '0 0 20px rgba(245,158,11,0.25)', barFrom: 'rgba(245,158,11,0.25)', barTo: 'rgba(245,158,11,0.05)' },
  { icon: '🥈', bg: 'bg-slate-400/20', border: 'border-slate-400/40', text: 'text-slate-300', glow: '0 0 15px rgba(148,163,184,0.2)', barFrom: 'rgba(148,163,184,0.15)', barTo: 'rgba(148,163,184,0.03)' },
  { icon: '🥉', bg: 'bg-orange-600/20', border: 'border-orange-600/40', text: 'text-orange-400', glow: '0 0 12px rgba(234,88,12,0.2)', barFrom: 'rgba(234,88,12,0.18)', barTo: 'rgba(234,88,12,0.03)' },
];

export default function ExpertBoardPage() {
  const navigate = useNavigate();
  const goBack = useBackNavigation('/realtime-pipeline');
  const [contributors, setContributors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch(`${API_BASE}/ai/governance/stats`);
      if (res.ok) {
        const data = await res.json();
        setContributors(data.topContributors || []);
      }
    } catch (e) { console.warn(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => {
    fetchData();
    const iv = setInterval(() => fetchData(), 30000);
    return () => clearInterval(iv);
  }, []);

  const maxScore = contributors[0]?.synergy_score || 1;

  return (
    <div className="h-full w-full bg-zinc-950 text-slate-300 font-sans flex flex-col overflow-hidden relative">
      {/* Background */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-orange-500/5 blur-[120px] rounded-full pointer-events-none" />

      {/* Header */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 md:px-6 py-3 border-b border-white/5 bg-zinc-950/90 backdrop-blur-md z-10 gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => goBack()}
            className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all flex items-center justify-center cursor-pointer active:scale-95"
          >
            <ChevronLeft className="w-4 h-4 text-slate-400" />
          </button>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-500/10 rounded-lg border border-amber-500/20">
              <Trophy className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h1 className="text-sm font-black text-amber-400">전문가 기여도 Honor Board</h1>
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">S-GUARD Expert Contribution Ranking</p>
            </div>
          </div>
        </div>
        <button
          onClick={() => fetchData(true)}
          className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-400 transition-all flex items-center justify-center"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </header>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 pb-24">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
            <span className="text-xs font-bold text-slate-500">기여도 데이터 로딩 중...</span>
          </div>
        ) : contributors.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm font-bold text-slate-500">
            기여자 데이터가 없습니다
          </div>
        ) : (
          <div className="max-w-2xl mx-auto flex flex-col gap-3">

            {/* Top 3 Podium */}
            {contributors.length >= 3 && (
              <div className="grid grid-cols-3 gap-3 mb-2">
                {[contributors[1], contributors[0], contributors[2]].map((user, podiumIdx) => {
                  const realIdx = podiumIdx === 0 ? 1 : podiumIdx === 1 ? 0 : 2;
                  const style = RANK_STYLES[realIdx];
                  const heights = ['h-28', 'h-36', 'h-24'];
                  return (
                    <div
                      key={realIdx}
                      className={`rounded-2xl p-3 border ${style.border} ${style.bg} flex flex-col items-center justify-end gap-1 ${heights[podiumIdx]} relative overflow-hidden`}
                      style={{ boxShadow: style.glow }}
                    >
                      <div className="text-2xl mb-1">{style.icon}</div>
                      <div className={`text-xs font-black truncate w-full text-center ${style.text}`}>@{user?.name}</div>
                      <div className={`text-base font-black font-mono ${style.text}`}>
                        {user?.synergy_score?.toLocaleString()}
                      </div>
                      <div className="text-[8px] font-bold text-slate-500">SCORE</div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Score Legend */}
            <div className="flex items-center gap-4 px-2 py-2 rounded-xl bg-white/3 border border-white/5 text-[9px] font-bold mb-1">
              <span className="text-slate-500">점수 산정:</span>
              <span className="text-pink-400">전파 × 50점</span>
              <span className="text-emerald-400">KB 등록 × 30점</span>
              <span className="text-blue-400">워룸 참여 × 10점</span>
            </div>

            {/* Full Ranked List */}
            {contributors.map((user, i) => {
              const style = i < 3 ? RANK_STYLES[i] : null;
              const pct = Math.max(6, (user.synergy_score / maxScore) * 100);
              return (
                <div
                  key={i}
                  className={`flex items-center gap-3 rounded-2xl p-3 relative overflow-hidden border transition-all ${
                    i < 3
                      ? `${style.border} hover:opacity-90`
                      : 'border-white/5 hover:border-white/10'
                  }`}
                  style={i < 3 ? { boxShadow: style.glow } : {}}
                >
                  {/* Progress BG */}
                  <div
                    className="absolute inset-y-0 left-0 transition-all duration-700"
                    style={{
                      width: `${pct}%`,
                      background: i < 3
                        ? `linear-gradient(90deg, ${style.barFrom}, ${style.barTo})`
                        : 'rgba(255,255,255,0.02)'
                    }}
                  />

                  {/* Rank Badge */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black shrink-0 relative z-10 text-sm
                    ${i < 3 ? `${style.bg} border-2 ${style.border} ${style.text}` : 'bg-white/5 border border-white/10 text-slate-400'}`}
                  >
                    {i < 3 ? style.icon : i + 1}
                  </div>

                  {/* User Info */}
                  <div className="flex-1 min-w-0 relative z-10">
                    <div className={`text-xs font-black truncate mb-0.5 ${i < 3 ? style.text : 'text-slate-200'}`}>
                      @{user.name}
                    </div>
                    <div className="text-[9px] font-bold text-slate-500 truncate mb-1.5">{user.full_org}</div>
                    <div className="flex gap-3">
                      <span className="flex items-center gap-1 text-[9px] font-bold text-pink-400">
                        <MessageSquare className="w-2.5 h-2.5" /> 전파:{user.warroom_count}
                      </span>
                      <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-400">
                        <Database className="w-2.5 h-2.5" /> KB:{user.kb_count}
                      </span>
                      <span className="flex items-center gap-1 text-[9px] font-bold text-blue-400">
                        <Users className="w-2.5 h-2.5" /> 참여:{user.chat_count}
                      </span>
                    </div>
                  </div>

                  {/* Score */}
                  <div className="text-right shrink-0 relative z-10">
                    <div className={`text-xl font-black font-mono leading-none ${i < 3 ? style.text : 'text-slate-300'}`}>
                      {user.synergy_score?.toLocaleString()}
                    </div>
                    <div className="text-[8px] font-bold text-slate-500 mt-1">SCORE</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
