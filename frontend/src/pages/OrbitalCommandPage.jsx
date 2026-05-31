import React, { useState, useEffect } from 'react';
import { RefreshCw, Zap, Search, Compass, CheckCircle2, Loader2, Database, ShieldAlert, SlidersHorizontal, ChevronLeft, TrendingUp, FileText, BrainCircuit, Activity } from 'lucide-react';
import { toast, Toaster } from 'react-hot-toast';
import { getAuthHeaders } from '../lib/authStore';
import { useNavigate } from 'react-router-dom';
import { useBackNavigation } from '../hooks/useBackNavigation';
import { useResizable } from '../hooks/useResizable';
import AlertMonitorPage from './AlertMonitorPage';

export default function OrbitalCommandPage() {
  const navigate = useNavigate();
  const goBack = useBackNavigation('/dashboard');
  const [threshold, setThreshold] = useState(0.80);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [stats, setStats] = useState({ total: 0, success: 0, pending: 0 });
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [sandboxQuery, setSandboxQuery] = useState('');
  const [sandboxResults, setSandboxResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSandbox, setShowSandbox] = useState(false);
  const { widths, startDrag, isDragging } = useResizable([40, 60], 'orbital-command-widths');

  const fetchStats = async () => {
    try {
      const res = await fetch('https://sguardai.khcho0421.workers.dev/ai/knowledge/sync-status', {
        headers: getAuthHeaders(),
        credentials: 'include'
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
          const adminThresh = data.settings.find(s => s.key === 'similarity_threshold_admin')?.value;
          if (adminThresh) setThreshold(parseFloat(adminThresh));
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
        body: JSON.stringify({ key: 'similarity_threshold_admin', value: String(newVal) })
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
      console.log('[Sandbox] Starting search for:', sandboxQuery);
      
      const searchUrl = `https://sguardai.khcho0421.workers.dev/ai/knowledge/search?q=${encodeURIComponent(sandboxQuery)}&threshold=0.0`;
      const authHeaders = getAuthHeaders();
      
      console.log('[Sandbox] Auth check:', authHeaders.Authorization ? 'Token Present ✅' : 'Token Missing ❌');

      const res = await fetch(searchUrl, { 
        headers: authHeaders,
        credentials: 'include' // 🔑 쿠키 기반 세션 유지를 위해 필수
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error('[Sandbox] API error:', res.status, errText);
        
        if (res.status === 401) {
          toast.error('인증 세션이 만료되었습니다. 다시 로그인해 주세요.');
        } else {
          toast.error(`검색 실패 (HTTP ${res.status})`);
        }
        setSandboxResults([]);
        return;
      }

      const data = await res.json();
      console.log('[Sandbox] Received data:', data);
      
      const results = data.results || [];
      setSandboxResults(results);
      
      if (results.length === 0) {
        toast('검색 결과가 없습니다', { icon: '🔍' });
      } else {
        toast.success(`${results.length}건의 유사 항목을 찾았습니다.`);
      }
    } catch (e) {
      console.error('[Sandbox] Fatal fetch error:', e);
      toast.error('네트워크 오류가 발생했습니다. 서버 연결을 확인하세요.');
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

      {/* ── 헤더 ── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px 12px',
        borderBottom: '1px solid rgba(6,182,212,0.1)',
        background: 'rgba(2,9,23,0.8)',
        backdropFilter: 'blur(20px)',
        flexShrink: 0,
      }}>
        <button onClick={() => goBack()} style={{
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

      {/* ── 스크롤 가능한 본문 (모바일) / 고정된 풀스크린 (PC) ── */}
      <div className={`flex-1 flex flex-col lg:flex-row p-3 lg:p-4 overflow-y-auto lg:overflow-hidden hide-scrollbar ${isDragging ? 'select-none' : ''}`}
        style={{ paddingBottom: 'calc(120px + env(safe-area-inset-bottom))', WebkitOverflowScrolling: 'touch' }}
      >
        {/* ── 1열: 상태 게이지 + Threshold + Sandbox ── */}
        <div style={{ flex: `0 0 ${widths[0]}%`, minWidth: '300px' }} className="flex flex-col gap-3 lg:h-full lg:pr-3 lg:overflow-y-auto hide-scrollbar">

        {/* ── 섹션 1: 상태 게이지 + SYNC 버튼 ── */}
        <div style={{
          background: 'rgba(79,70,229,0.06)',
          border: '1px solid rgba(79,70,229,0.15)',
          borderRadius: 20, padding: '16px',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
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
              </svg>
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column'
              }}>
                <span style={{ fontSize: 16, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em' }}>
                  {isStatsLoading ? '…' : `${syncPct}%`}
                </span>
              </div>
            </div>

            {/* 수치 */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <RefreshCw size={12} color="#818cf8" />
                <span style={{ fontSize: 10, fontWeight: 800, color: '#818cf8', letterSpacing: '0.1em' }}>SYNC ENGINE STATUS</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingRight: 4 }}>
                {[
                  { label: 'CORPUS', val: stats.total, color: '#94a3b8' },
                  { label: 'VECTORIZED', val: stats.success, color: '#06b6d4' },
                  { label: 'QUEUE', val: stats.pending, color: '#f87171' },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 900, color: s.color, fontFamily: 'monospace', lineHeight: 1 }}>{isStatsLoading ? '-' : s.val}</div>
                    <div style={{ fontSize: 8, color: '#475569', fontWeight: 800, letterSpacing: '0.02em', marginTop: 4 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 동기화 진행 바 */}
          {isSyncing && (
            <div style={{ height: 2, background: 'rgba(255,255,255,0.05)', borderRadius: 99, overflow: 'hidden', marginTop: 12 }}>
              <div style={{ height: '100%', background: 'linear-gradient(90deg, #06b6d4, #818cf8)', animation: 'pulse 1s ease-in-out infinite' }} />
            </div>
          )}

          {/* SYNC 버튼 */}
          <button
            onClick={handleSync}
            disabled={isSyncing || stats.pending === 0}
            style={{
              marginTop: 16, width: '100%', padding: '14px',
              borderRadius: 12, fontWeight: 800, fontSize: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
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
            {isSyncing ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> PROCESSING VECTOR...</>
              : stats.pending === 0 ? <><CheckCircle2 size={16} /> ALL KNOWLEDGE VECTORIZED</>
              : <><Zap size={16} /> SYNC {stats.pending} ITEMS NOW</>}
          </button>
        </div>

        {/* ── 섹션 2: Threshold Controller ── */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 20, padding: '16px',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 12,
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
              <SlidersHorizontal size={18} color="#94a3b8" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#e2e8f0', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>THRESHOLD CONTROLLER</div>
              <div style={{ fontSize: 10, color: '#475569', fontFamily: 'monospace' }}>RAG Similarity Cutoff</div>
            </div>
            <div style={{
              padding: '6px 12px', borderRadius: 10, minWidth: 64, textAlign: 'center',
              background: `${thresholdColor}15`, border: `1px solid ${thresholdColor}30`,
            }}>
              <span style={{ fontSize: 22, fontWeight: 900, color: thresholdColor, fontFamily: 'monospace', lineHeight: 1 }}>
                {threshold.toFixed(2)}
              </span>
            </div>
          </div>

          <div style={{ padding: '0 4px' }}>
            <input
              type="range" min="0.00" max="1.00" step="0.01"
              value={threshold}
              onChange={handleSliderChange}
              style={{ width: '100%', accentColor: thresholdColor, cursor: 'pointer', height: 6, marginBottom: 8 }}
            />

            <div style={{ position: 'relative', height: 16 }}>
              {[
                { label: '0.00', pct: 0,   color: '#475569' },
                { label: '0.80 STD',  pct: 80,  color: '#eab308' },
                { label: '0.90 STRICT', pct: 90,  color: '#10b981' },
                { label: '1.00', pct: 100, color: '#475569' },
              ].map(t => (
                <span key={t.label} style={{
                  position: 'absolute',
                  left: `${t.pct}%`,
                  transform: t.pct === 0 ? 'none' : t.pct === 100 ? 'translateX(-100%)' : 'translateX(-50%)',
                  fontSize: 7, fontFamily: 'monospace', fontWeight: 800, color: t.color,
                  whiteSpace: 'nowrap',
                }}>
                  {t.label}
                </span>
              ))}
            </div>
          </div>

          <div style={{
            marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            fontSize: 9, fontFamily: 'monospace', color: '#475569', fontWeight: 700,
            background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.03)'
          }}>
            <Database size={10} /> PERSISTED TO EDGE KV IN REAL-TIME
          </div>
        </div>

        {/* ── 섹션 3: Similarity Sandbox ── */}
        <div style={{
          background: 'rgba(6,182,212,0.04)',
          border: '1px solid rgba(6,182,212,0.12)',
          borderRadius: 20,
          overflow: 'hidden',
          flex: 1, // Changed from flexShrink: 0
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* 샌드박스 헤더 */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '13px 16px',
          }}>
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
              padding: '3px 8px', borderRadius: 6,
              background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)',
              fontSize: 8, fontWeight: 800, color: '#06b6d4', fontFamily: 'monospace', letterSpacing: '0.05em'
            }}>
              LIVE
            </div>
          </div>

          {/* 항상 펼쳐진 본문 */}
          <div style={{ display: 'flex', flexDirection: 'column', padding: '0 16px 16px', flex: 1, minHeight: 0 }}>
            {/* 입력 영역 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <TrendingUp size={12} color="#06b6d4" />
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#06b6d4', letterSpacing: '0.05em' }}>QUERY PARAMETER</span>
                </div>
                <button
                  onClick={handleSandboxSearch}
                  disabled={isSearching}
                  style={{
                    padding: '8px 16px', borderRadius: 10,
                    background: 'linear-gradient(135deg, #0891b2, #06b6d4)',
                    border: 'none', color: '#fff', fontWeight: 800, fontSize: 11,
                    cursor: isSearching ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                    whiteSpace: 'nowrap', transition: 'all 0.2s',
                    boxShadow: '0 4px 12px rgba(8,145,178,0.3)',
                  }}
                >
                  {isSearching
                    ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                    : <><Zap size={12} /> 유사도 근거 분석</>}
                </button>
              </div>
              
              <textarea
                id="sandbox-query-input"
                value={sandboxQuery}
                onChange={e => {
                  setSandboxQuery(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = e.target.scrollHeight + 'px';
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSandboxSearch();
                  }
                }}
                placeholder="장애 증상 또는 전문 코드 입력..."
                style={{
                  width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(6,182,212,0.2)',
                  borderRadius: 12, color: '#e2e8f0', fontSize: 13,
                  outline: 'none', fontFamily: 'monospace', resize: 'none',
                  minHeight: '60px', maxHeight: '300px', lineHeight: '1.6',
                  textAlign: 'left', boxSizing: 'border-box',
                  padding: '12px',
                }}
                rows={1}
              />
            </div>

            {/* 결과 목록 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, overflowY: 'auto' }} className="custom-scrollbar">
              {sandboxResults.length === 0 && !isSearching ? (
                <div style={{
                  flex: 1, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 10,
                  border: '1px dashed rgba(255,255,255,0.06)', borderRadius: 16,
                  background: 'rgba(255,255,255,0.01)', minHeight: 120,
                }}>
                  <ShieldAlert size={28} color="#334155" />
                  <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#475569', letterSpacing: '0.15em', fontWeight: 700 }}>AWAITING QUERY INJECTION</span>
                </div>
              ) : sandboxResults.map((res, i) => {
                const below = res.score < threshold;
                const col = res.score >= 0.9 ? '#10b981' : res.score >= 0.8 ? '#eab308' : '#f87171';
                return (
                  <div key={i} style={{
                    background: 'rgba(0,0,0,0.35)', border: `1px solid ${col}25`,
                    borderRadius: 16, padding: '16px',
                    display: 'flex', flexDirection: 'column', gap: 12,
                    opacity: below ? 0.4 : 1, filter: below ? 'blur(0.5px)' : 'none',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    position: 'relative', overflow: 'hidden'
                  }}>
                    {/* 상단 헤더 영역 (스코어 + 리포트 버튼) */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ 
                          padding: '4px 8px', borderRadius: 8, background: `${col}15`, border: `1px solid ${col}30`,
                          display: 'flex', alignItems: 'center', gap: 4
                        }}>
                          <span style={{ fontSize: 12, fontWeight: 900, color: col, fontFamily: 'monospace' }}>{res.score.toFixed(2)}</span>
                          <span style={{ fontSize: 8, fontWeight: 800, color: col, opacity: 0.8 }}>SCORE</span>
                        </div>
                        <div style={{ height: 12, width: 1, background: 'rgba(255,255,255,0.1)' }} />
                        <span style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', letterSpacing: '0.05em' }}>SIMILARITY MATCH</span>
                      </div>

                      {res.inc_id && (
                        <button
                          onClick={() => navigate(`/report/${res.inc_id}`)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px',
                            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 8, color: '#94a3b8', fontSize: 10, fontWeight: 700,
                            cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0
                          }}
                          onMouseOver={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                          onMouseOut={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                        >
                          <FileText size={12} /> 장애보고서
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#f1f5f9', lineHeight: '1.4' }}>
                        {res.title}
                      </div>
                      
                      <div style={{ fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', lineHeight: '1.5' }}>
                        {res.content}
                      </div>

                      {res.reason && (
                        <div style={{
                          marginTop: 4, fontSize: 10, color: col, background: `${col}08`,
                          padding: '10px 12px', borderRadius: 10, border: `1px solid ${col}15`,
                          fontStyle: 'italic', display: 'flex', alignItems: 'flex-start', gap: 8,
                          whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: '1.5'
                        }}>
                          <BrainCircuit size={12} style={{ flexShrink: 0, marginTop: 2, opacity: 0.8 }} /> 
                          <span><strong>AI 분석 근거:</strong> {res.reason}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        </div>

        {/* ── Drag Handle (PC Only) ── */}
        <div 
          className="hidden lg:flex w-2 cursor-col-resize hover:bg-[#06b6d4]/20 items-center justify-center transition-colors group relative z-10 shrink-0"
          onMouseDown={(e) => { e.preventDefault(); startDrag(0); }}
        >
          <div className="w-0.5 h-12 bg-slate-700 group-hover:bg-[#06b6d4] transition-colors rounded-full" />
        </div>
        
        {/* ── 2열: Alert Monitor Engine ── */}
        <div style={{ flex: `1 1 0%`, minWidth: 0 }} className="flex flex-col gap-3 lg:h-full lg:pl-3 lg:overflow-y-auto hide-scrollbar mt-3 lg:mt-0">
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 20,
          overflow: 'hidden',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: '500px'
        }}>
          {/* 헤더 */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '13px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)',
            background: 'rgba(0,0,0,0.2)',
            flexShrink: 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 30, height: 30, borderRadius: 10,
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Activity size={14} color="#818cf8" />
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#e2e8f0', letterSpacing: '0.05em' }}>3-TIER SEVERITY ENGINE</div>
                <div style={{ fontSize: 9, color: '#475569', fontFamily: 'monospace' }}>Global Alert Thresholds</div>
              </div>
            </div>
          </div>
          
          {/* Embedded AlertMonitorPage */}
          <div style={{ position: 'relative', width: '100%', flex: 1, minHeight: 0 }}>
            <AlertMonitorPage embedded={true} />
          </div>
        </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        input[type=range]::-webkit-slider-thumb { width:18px; height:18px; border-radius:50%; cursor:pointer; }
        
        #sandbox-query-input {
          padding-left: 8px !important;
          padding-right: 8px !important;
          padding-top: 10px !important;
          padding-bottom: 10px !important;
          text-indent: 0 !important;
        }
      `}</style>
    </div>
  );
}
