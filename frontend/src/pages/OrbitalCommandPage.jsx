import React, { useState, useEffect } from 'react';
import { RefreshCw, Zap, Search, Compass, CheckCircle2, Loader2, Database, ShieldAlert, SlidersHorizontal, ChevronLeft, TrendingUp } from 'lucide-react';
import { toast, Toaster } from 'react-hot-toast';
import { getAuthHeaders } from '../lib/authStore';
import { useNavigate } from 'react-router-dom';

export default function OrbitalCommandPage() {
  const navigate = useNavigate();
  const [threshold, setThreshold] = useState(0.80);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [stats, setStats] = useState({ total: 0, success: 0, pending: 0 });
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [sandboxQuery, setSandboxQuery] = useState('');
  const [sandboxResults, setSandboxResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSandbox, setShowSandbox] = useState(false);

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
    fetch('https://sguardai.khcho0421.workers.dev/sms/settings', { headers: getAuthHeaders() })
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
      if (res.ok) toast.success(`임계값 ${newVal.toFixed(2)} 적용 완료`);
    } catch (e) {
      toast.error('설정 저장 오류');
    }
  };

  const handleSliderChange = (e) => {
    const val = parseFloat(e.target.value);
    setThreshold(val);
    saveThreshold(val);
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch('https://sguardai.khcho0421.workers.dev/ai/knowledge/sync-pending', {
        method: 'POST', headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setSyncResult({ type: 'success', msg: `✓ ${data.successCount}건 동기화 완료 (총 ${data.processed} 처리)` });
        toast.success('Vectorize 동기화 완료');
        fetchStats();
      } else {
        setSyncResult({ type: 'error', msg: `✕ ${data.error}` });
      }
    } catch (e) {
      setSyncResult({ type: 'error', msg: '네트워크 오류 발생' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSandboxSearch = async () => {
    if (!sandboxQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(
        `https://sguardai.khcho0421.workers.dev/ai/knowledge/search?q=${encodeURIComponent(sandboxQuery)}&threshold=0.0`,
        { headers: getAuthHeaders() }
      );
      const data = await res.json();
      setSandboxResults(data.results || []);
    } catch (e) {
      toast.error('검색 중 오류 발생');
      setSandboxResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const syncPct = stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0;
  const radius = 28;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (syncPct / 100) * circ;

  const thresholdColor = threshold >= 0.9 ? '#10b981' : threshold >= 0.8 ? '#eab308' : '#f97316';

  return (
    <div style={{
      height: '100dvh',
      background: 'linear-gradient(160deg, #020917 0%, #070d1f 50%, #020917 100%)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      fontFamily: "'Pretendard', 'Inter', sans-serif",
      color: '#cbd5e1',
    }}>
      <Toaster position="top-center" toastOptions={{
        style: { background: '#0f172a', color: '#fff', border: '1px solid rgba(6,182,212,0.2)', fontSize: 12 }
      }} />

      {/* ── 헤더 ── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px 12px',
        borderBottom: '1px solid rgba(6,182,212,0.1)',
        background: 'rgba(2,9,23,0.8)',
        backdropFilter: 'blur(20px)',
        flexShrink: 0,
      }}>
        <button onClick={() => navigate(-1)} style={{
          width: 34, height: 34, borderRadius: 10,
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
        }}>
          <ChevronLeft size={16} color="#64748b" />
        </button>

        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: 16, fontWeight: 900, letterSpacing: '0.06em',
            background: 'linear-gradient(90deg, #06b6d4, #818cf8)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
          }}>ORBITAL COMMAND</div>
          <div style={{ fontSize: 11, color: '#06b6d4', fontWeight: 800, letterSpacing: '0.2em', opacity: 0.6 }}>
            ZERO-G RAG CONTROL
          </div>
        </div>

        <div style={{
          width: 34, height: 34, borderRadius: 10,
          background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Compass size={16} color="#06b6d4" style={{ animation: 'spin 8s linear infinite' }} />
        </div>
      </header>

      {/* ── 메인 콘텐츠 ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '12px 16px', gap: 12, overflow: 'hidden' }}>

        {/* ── 섹션 1: 상태 게이지 + SYNC 버튼 ── */}
        <div style={{
          background: 'rgba(79,70,229,0.06)',
          border: '1px solid rgba(79,70,229,0.15)',
          borderRadius: 20, padding: '14px 16px',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* 원형 게이지 */}
            <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
              <svg width="72" height="72" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="36" cy="36" r={radius} stroke="rgba(255,255,255,0.06)" strokeWidth="5" fill="transparent" />
                <circle
                  cx="36" cy="36" r={radius}
                  stroke="url(#cyanGrad)" strokeWidth="5" fill="transparent"
                  strokeDasharray={circ}
                  strokeDashoffset={isNaN(offset) ? circ : offset}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 1s ease-out' }}
                />
                <defs>
                  <linearGradient id="cyanGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#06b6d4" />
                    <stop offset="100%" stopColor="#818cf8" />
                  </linearGradient>
                </defs>
              </svg>
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column'
              }}>
                <span style={{ fontSize: 15, fontWeight: 900, color: '#fff' }}>
                  {isStatsLoading ? '…' : `${syncPct}%`}
                </span>
              </div>
            </div>

            {/* 수치 */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <RefreshCw size={12} color="#818cf8" />
                <span style={{ fontSize: 10, fontWeight: 800, color: '#818cf8', letterSpacing: '0.08em' }}>GLOBAL SYNC ENGINE</span>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {[
                  { label: 'Total', val: stats.total, color: '#94a3b8' },
                  { label: 'Synced', val: stats.success, color: '#06b6d4' },
                  { label: 'Pending', val: stats.pending, color: '#f87171' },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 900, color: s.color, fontFamily: 'monospace' }}>{isStatsLoading ? '-' : s.val}</div>
                    <div style={{ fontSize: 8, color: '#475569', fontWeight: 700, letterSpacing: '0.04em' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 동기화 진행 바 */}
          {isSyncing && (
            <div style={{ height: 2, background: 'rgba(255,255,255,0.05)', borderRadius: 99, overflow: 'hidden', marginTop: 10 }}>
              <div style={{ height: '100%', background: 'linear-gradient(90deg, #06b6d4, #818cf8)', animation: 'pulse 1s ease-in-out infinite' }} />
            </div>
          )}

          {/* SYNC 버튼 */}
          <button
            onClick={handleSync}
            disabled={isSyncing || stats.pending === 0}
            style={{
              marginTop: 12, width: '100%', padding: '14px',
              borderRadius: 12, fontWeight: 800, fontSize: 15,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              cursor: isSyncing || stats.pending === 0 ? 'not-allowed' : 'pointer',
              background: isSyncing ? 'rgba(79,70,229,0.2)'
                : stats.pending === 0 ? 'rgba(255,255,255,0.04)'
                : 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
              border: stats.pending === 0 ? '1px solid rgba(255,255,255,0.08)' : 'none',
              color: stats.pending === 0 && !isSyncing ? '#475569' : '#fff',
              boxShadow: stats.pending > 0 && !isSyncing ? '0 0 20px rgba(79,70,229,0.3)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            {isSyncing ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> 벡터라이징 중...</>
              : stats.pending === 0 ? <><CheckCircle2 size={14} /> 모든 데이터 동기화 완료</>
              : <><Zap size={14} /> SYNC NOW — {stats.pending}건 대기 중</>}
          </button>

          {syncResult && (
            <div style={{
              marginTop: 8, textAlign: 'center', fontSize: 11, fontFamily: 'monospace', fontWeight: 700,
              color: syncResult.type === 'success' ? '#10b981' : '#f87171'
            }}>
              {syncResult.msg}
            </div>
          )}
        </div>

        {/* ── 섹션 2: Threshold Controller ── */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 20, padding: '14px 16px',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <SlidersHorizontal size={18} color="#94a3b8" />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#e2e8f0', letterSpacing: '0.05em' }}>THRESHOLD CONTROLLER</div>
                <div style={{ fontSize: 11, color: '#475569', fontFamily: 'monospace' }}>Similarity Cutoff (0.00 – 1.00)</div>
              </div>
            </div>
            <div style={{
              padding: '4px 14px', borderRadius: 8,
              background: `${thresholdColor}18`, border: `1px solid ${thresholdColor}40`,
            }}>
              <span style={{ fontSize: 28, fontWeight: 900, color: thresholdColor, fontFamily: 'monospace' }}>
                {threshold.toFixed(2)}
              </span>
            </div>
          </div>

          <input
            type="range" min="0.00" max="1.00" step="0.01"
            value={threshold}
            onChange={handleSliderChange}
            style={{ width: '100%', accentColor: thresholdColor, cursor: 'pointer', height: 4 }}
          />

          <div style={{ position: 'relative', height: 20, marginTop: 6 }}>
            {[
              { label: '0.00', pct: 0,   color: '#64748b', align: 'left' },
              { label: '0.80 STD',  pct: 80,  color: '#eab308', align: 'center' },
              { label: '0.90 STRICT', pct: 90,  color: '#10b981', align: 'center' },
              { label: '1.00', pct: 100, color: '#64748b', align: 'right' },
            ].map(t => (
              <span key={t.label} style={{
                position: 'absolute',
                left: `${t.pct}%`,
                transform: t.pct === 0 ? 'translateX(0)' : t.pct === 100 ? 'translateX(-100%)' : 'translateX(-50%)',
                fontSize: 8, fontFamily: 'monospace', fontWeight: 700, color: t.color,
                whiteSpace: 'nowrap',
              }}>
                {t.label}
              </span>
            ))}
          </div>

          <div style={{
            marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            fontSize: 9, fontFamily: 'monospace', color: '#334155', fontWeight: 600,
            background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)'
          }}>
            <Database size={10} /> 변경 시 KV Storage에 실시간 반영
          </div>
        </div>

        {/* ── 섹션 3: Similarity Sandbox ── */}
        <div style={{
          background: 'rgba(6,182,212,0.04)',
          border: '1px solid rgba(6,182,212,0.12)',
          borderRadius: 20,
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          ...(showSandbox ? { flex: 1, minHeight: 0 } : { flexShrink: 0 }),
        }}>
          {/* 샌드박스 헤더 */}
          <button
            onClick={() => setShowSandbox(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '13px 16px', cursor: 'pointer', background: 'transparent', border: 'none', width: '100%',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 30, height: 30, borderRadius: 10,
                background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Search size={14} color="#06b6d4" />
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#e2e8f0', letterSpacing: '0.05em' }}>SIMILARITY SANDBOX</div>
                <div style={{ fontSize: 9, color: '#475569', fontFamily: 'monospace' }}>Vector Search Test Bench</div>
              </div>
            </div>
            <div style={{
              width: 22, height: 22, borderRadius: 6,
              background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transform: showSandbox ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s',
            }}>
              <TrendingUp size={11} color="#06b6d4" />
            </div>
          </button>

          {showSandbox && (
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '0 16px 14px' }}>
              {/* 입력 */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input
                  type="text"
                  value={sandboxQuery}
                  onChange={e => setSandboxQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSandboxSearch()}
                  placeholder="증상 입력... (e.g. Connection Error)"
                  style={{
                    flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(6,182,212,0.2)',
                    borderRadius: 10, padding: '9px 12px', color: '#e2e8f0', fontSize: 12,
                    outline: 'none', fontFamily: 'monospace',
                  }}
                />
                <button
                  onClick={handleSandboxSearch}
                  disabled={isSearching}
                  style={{
                    padding: '9px 16px', borderRadius: 10,
                    background: 'linear-gradient(135deg, #0891b2, #06b6d4)',
                    border: 'none', color: '#fff', fontWeight: 800, fontSize: 12,
                    cursor: isSearching ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  {isSearching ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : 'TEST'}
                </button>
              </div>

              {/* 결과 스크롤 영역 */}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {sandboxResults.length === 0 && !isSearching ? (
                  <div style={{
                    height: '100%', minHeight: 80, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: 6,
                    border: '1px dashed rgba(255,255,255,0.06)', borderRadius: 12,
                  }}>
                    <ShieldAlert size={22} color="#334155" />
                    <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#334155', letterSpacing: '0.1em' }}>AWAITING QUERY INJECTION</span>
                  </div>
                ) : sandboxResults.map((res, i) => {
                  const below = res.score < threshold;
                  const col = res.score >= 0.9 ? '#10b981' : res.score >= 0.8 ? '#eab308' : '#f87171';
                  return (
                    <div key={i} style={{
                      background: 'rgba(0,0,0,0.3)', border: `1px solid ${col}30`,
                      borderRadius: 12, padding: '10px 12px', marginBottom: 8,
                      display: 'flex', gap: 10,
                      opacity: below ? 0.35 : 1, filter: below ? 'blur(1px)' : 'none',
                      transition: 'all 0.2s',
                    }}>
                      <div style={{
                        width: 48, flexShrink: 0, borderRadius: 8,
                        background: `${col}12`, border: `1px solid ${col}30`,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4px 0'
                      }}>
                        <span style={{ fontSize: 12, fontWeight: 900, color: col, fontFamily: 'monospace' }}>{res.score.toFixed(2)}</span>
                        <span style={{ fontSize: 7, color: col, opacity: 0.7, fontFamily: 'monospace' }}>SCORE</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#e2e8f0', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {res.title}
                        </div>
                        <div style={{ fontSize: 10, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {res.content}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        input[type=range]::-webkit-slider-thumb { width:18px; height:18px; border-radius:50%; cursor:pointer; }
      `}</style>
    </div>
  );
}
