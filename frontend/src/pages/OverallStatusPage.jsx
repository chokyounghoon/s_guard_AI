import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBackNavigation } from '../hooks/useBackNavigation';
import {
  Shield, Zap, Database, MessageSquare, Users, CheckCircle2,
  BarChart3, Clock, Sparkles, Activity, FileSearch, Brain,
  Target, Rocket, Heart, Medal, ChevronLeft, Loader2, RefreshCw
} from 'lucide-react';

const API_BASE = 'https://sguardai.khcho0421.workers.dev';

const EMPTY_STATS = {
  incidents: { total: 0, resolved: 0, rate: 0, integrity: 0, mttr: 0 },
  knowledge: { total: 0, growth: '0' },
  warrooms: { active: 0 },
  categories: [],
  topContributors: [],
  recentFeed: [],
};

// 탭 목록
const TABS = ['개요', '카테고리', '기여자', '피드'];

export default function OverallStatusPage() {
  const navigate = useNavigate();
  const goBack = useBackNavigation('/dashboard');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [tab, setTab] = useState(0);
  const [now, setNow] = useState(new Date());

  const fetchData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch(`${API_BASE}/ai/governance/stats`);
      if (res.ok) setStats(await res.json() || EMPTY_STATS);
    } catch (e) { console.warn(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => {
    fetchData();
    const iv = setInterval(() => { fetchData(); setNow(new Date()); }, 15000);
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => { clearInterval(iv); clearInterval(tick); };
  }, []);

  const KPI = [
    {
      label: '자산화 성공률',
      sub: 'Fidelity Index',
      value: `${stats.incidents.integrity}%`,
      icon: Shield,
      color: '#10b981',
      formula: 'KB_COUNT / TOTAL_INC × 100',
    },
    {
      label: '평균 복구 소요시간',
      sub: 'MTTR (인지→지식화)',
      value: stats.incidents.mttr > 0 ? `${stats.incidents.mttr}m` : '-',
      icon: Rocket,
      color: '#60a5fa',
      formula: 'AVG(KB_REG - SMS_RECV)',
    },
    {
      label: '이번달 KB 증가',
      sub: '전월 대비 지식 성장률',
      value: stats.knowledge.growth || '-',
      icon: Heart,
      color: '#f87171',
      formula: 'THIS_MONTH / LAST_MONTH',
    },
    {
      label: '전사 조치 지수',
      sub: 'High Intelligence',
      value: `${stats.incidents.rate}%`,
      icon: Zap,
      color: '#fb923c',
      formula: 'RESOLVED / TOTAL × 100',
    },
  ];

  const FLOW = [
    { label: 'SMS 수신', value: stats.incidents.total, icon: MessageSquare, color: '#f87171' },
    { label: '전문가 배정', value: stats.warrooms?.assignedUsers ?? stats.warrooms.active, icon: Users, color: '#60a5fa' },
    { label: '대응 중', value: stats.warrooms.active, icon: Activity, color: '#a78bfa' },
    { label: '조치 완료', value: stats.incidents.resolved, icon: CheckCircle2, color: '#fb923c' },
    { label: '지식 자산', value: stats.knowledge.total, icon: Database, color: '#a78bfa' },
  ];

  if (loading) {
    return (
      <div style={{
        height: '100dvh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(160deg, #04060f, #080c1c)',
        gap: 16,
      }}>
        <Loader2 size={36} color="#818cf8" style={{ animation: 'spin 1s linear infinite' }} />
        <div style={{ fontSize: 14, fontWeight: 800, color: '#475569', letterSpacing: '0.1em' }}>
          SYNCING DREAM ANALYTICS...
        </div>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <div style={{
      height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: 'linear-gradient(160deg, #04060f 0%, #080c1c 60%, #04060f 100%)',
      fontFamily: "'Pretendard', 'Inter', sans-serif", color: '#cbd5e1',
    }}>
      <style>{`
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes glow { 0%,100%{box-shadow:0 0 12px rgba(129,140,248,0.3)} 50%{box-shadow:0 0 28px rgba(129,140,248,0.6)} }
        ::-webkit-scrollbar{width:3px} ::-webkit-scrollbar-thumb{background:rgba(129,140,248,0.2);border-radius:99px}
      `}</style>

      {/* ①  헤더 */}
      <header style={{
        flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '13px 16px',
        borderBottom: '1px solid rgba(129,140,248,0.12)',
        background: 'rgba(4,6,15,0.96)', backdropFilter: 'blur(20px)',
      }}>
        <button onClick={() => goBack()} style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}>
          <ChevronLeft size={18} color="#64748b" />
        </button>

        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: 16, fontWeight: 900, letterSpacing: '0.04em',
            background: 'linear-gradient(90deg, #818cf8, #a78bfa, #f472b6)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>Global Stats</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 1 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#818cf8', animation: 'pulse 2s ease infinite' }} />
            <span style={{ fontSize: 10, color: '#6366f1', fontWeight: 800, letterSpacing: '0.15em', opacity: 0.7 }}>DREAM MODE LIVE</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            padding: '5px 10px', borderRadius: 10,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          }}>
            <span style={{ fontSize: 12, color: '#475569', fontFamily: 'monospace', fontWeight: 700 }}>
              {now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
          <button onClick={() => fetchData(true)} style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'rgba(129,140,248,0.08)', border: '1px solid rgba(129,140,248,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}>
            <RefreshCw size={15} color="#818cf8" style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>
      </header>

      {/* ②  탭 */}
      <div style={{
        flexShrink: 0, display: 'flex', padding: '10px 16px 0', gap: 6,
      }}>
        {TABS.map((t, i) => (
          <button key={i} onClick={() => setTab(i)} style={{
            flex: 1, padding: '10px 4px', borderRadius: 12,
            fontSize: 13, fontWeight: 800,
            background: tab === i ? 'rgba(129,140,248,0.12)' : 'rgba(255,255,255,0.03)',
            border: tab === i ? '1px solid rgba(129,140,248,0.3)' : '1px solid rgba(255,255,255,0.06)',
            color: tab === i ? '#818cf8' : '#475569',
            cursor: 'pointer', transition: 'all 0.15s',
          }}>{t}</button>
        ))}
      </div>

      {/* ③  콘텐츠 영역 */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 16px 20px' }}>

        {/* === 탭 0: 개요 === */}
        {tab === 0 && (
          <>
            {/* KPI 2열 그리드 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              {KPI.map((k, i) => {
                const Icon = k.icon;
                return (
                  <div key={i} style={{
                    borderRadius: 20, padding: '18px 16px',
                    background: `linear-gradient(135deg, ${k.color}0d 0%, rgba(255,255,255,0.02) 100%)`,
                    border: `1px solid ${k.color}25`,
                    position: 'relative', overflow: 'hidden',
                  }}>
                    {/* 배경 아이콘 */}
                    <div style={{ position: 'absolute', right: 10, top: 10, opacity: 0.07 }}>
                      <Icon size={48} color={k.color} />
                    </div>
                    <div style={{
                      width: 36, height: 36, borderRadius: 11, marginBottom: 10,
                      background: `${k.color}18`, border: `1px solid ${k.color}30`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon size={18} color={k.color} />
                    </div>
                    <div style={{ fontSize: 34, fontWeight: 900, color: '#f1f5f9', fontFamily: 'monospace', lineHeight: 1 }}>
                      {k.value}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#94a3b8', marginTop: 6, lineHeight: 1.3 }}>
                      {k.label}
                    </div>
                    <div style={{ fontSize: 11, color: '#334155', marginTop: 4, fontWeight: 700 }}>{k.sub}</div>
                    <div style={{
                      marginTop: 10, fontSize: 10, fontFamily: 'monospace', color: k.color,
                      background: `${k.color}10`, border: `1px solid ${k.color}20`,
                      borderRadius: 6, padding: '3px 7px', display: 'inline-block', opacity: 0.8,
                    }}>{k.formula}</div>
                  </div>
                );
              })}
            </div>

            {/* 인시던트 생애주기 플로우 */}
            <div style={{
              borderRadius: 20, padding: '16px',
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Activity size={16} color="#818cf8" />
                <span style={{ fontSize: 14, fontWeight: 800, color: '#e2e8f0' }}>인시던트 생애주기</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {FLOW.map((f, i) => {
                  const Icon = f.icon;
                  return (
                    <React.Fragment key={i}>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                        <div style={{
                          width: 44, height: 44, borderRadius: 14,
                          background: `${f.color}15`, border: `1px solid ${f.color}30`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          ...(i === 4 ? { animation: 'glow 2s ease infinite' } : {}),
                        }}>
                          <Icon size={18} color={f.color} />
                        </div>
                        <span style={{ fontSize: 18, fontWeight: 900, color: f.color, fontFamily: 'monospace' }}>
                          {f.value}
                        </span>
                        <span style={{ fontSize: 9, color: '#334155', fontWeight: 700, textAlign: 'center', lineHeight: 1.2 }}>
                          {f.label}
                        </span>
                      </div>
                      {i < FLOW.length - 1 && (
                        <div style={{ width: 12, height: 1, background: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* === 탭 1: 카테고리 === */}
        {tab === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <BarChart3 size={16} color="#34d399" />
              <span style={{ fontSize: 14, fontWeight: 800, color: '#e2e8f0' }}>인텔리전스 카테고리 밀도</span>
              <span style={{
                fontSize: 12, color: '#34d399', fontWeight: 700,
                background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)',
                borderRadius: 6, padding: '1px 8px',
              }}>{stats.knowledge.total} Assets</span>
            </div>
            {stats.categories.length > 0 ? stats.categories.map((cat, i) => {
              const pct = Math.min(100, (cat.c / (stats.knowledge.total || 1)) * 100);
              const hue = (i * 47) % 360;
              const clr = `hsl(${hue}, 70%, 60%)`;
              return (
                <div key={i} style={{
                  borderRadius: 16, padding: '14px 16px',
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: '#e2e8f0' }}>
                      {cat.category || '기타'}
                    </span>
                    <span style={{
                      fontSize: 13, fontWeight: 800, color: clr,
                      background: `${clr}18`, border: `1px solid ${clr}30`,
                      borderRadius: 7, padding: '2px 10px',
                    }}>{cat.c}</span>
                  </div>
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${pct}%`,
                      background: `linear-gradient(90deg, ${clr}90, ${clr})`,
                      borderRadius: 99, transition: 'width 1s ease',
                    }} />
                  </div>
                  <div style={{ marginTop: 6, fontSize: 11, color: '#334155', fontWeight: 700, fontFamily: 'monospace' }}>
                    {pct.toFixed(1)}% of total
                  </div>
                </div>
              );
            }) : (
              <div style={{ textAlign: 'center', padding: 40, fontSize: 13, color: '#334155' }}>카테고리 데이터 없음</div>
            )}
          </div>
        )}

        {/* === 탭 2: 기여자 === */}
        {tab === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Medal size={16} color="#eab308" />
              <span style={{ fontSize: 14, fontWeight: 800, color: '#e2e8f0' }}>전문가 시너지 기여도</span>
              <span style={{
                fontSize: 11, color: '#eab308', fontWeight: 800,
                background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.2)',
                borderRadius: 6, padding: '1px 8px',
              }}>Honor Board</span>
            </div>
            {stats.topContributors.length > 0 ? stats.topContributors.map((user, i) => {
              const isTop = i === 0;
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  borderRadius: 18, padding: '14px 16px',
                  background: isTop ? 'rgba(234,179,8,0.07)' : 'rgba(255,255,255,0.03)',
                  border: isTop ? '1px solid rgba(234,179,8,0.25)' : '1px solid rgba(255,255,255,0.07)',
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 14, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: isTop ? 20 : 18, fontWeight: 900,
                    background: isTop ? 'rgba(234,179,8,0.15)' : 'rgba(255,255,255,0.05)',
                    border: isTop ? '2px solid rgba(234,179,8,0.4)' : '1px solid rgba(255,255,255,0.1)',
                    color: isTop ? '#fbbf24' : '#475569',
                  }}>
                    {isTop ? '🥇' : `${i + 1}`}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: isTop ? '#fde68a' : '#e2e8f0', marginBottom: 3 }}>
                      @{user.name}
                    </div>
                    <div style={{ fontSize: 12, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {user.team} · {user.role}
                    </div>
                    <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                      <span style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>배정: {user.assigned_count}</span>
                      <span style={{ fontSize: 11, color: '#34d399', fontWeight: 700 }}>KB: {user.kb_count}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{
                      fontSize: 26, fontWeight: 900, fontFamily: 'monospace',
                      color: isTop ? '#fbbf24' : '#94a3b8',
                    }}>{user.synergy_score}</div>
                    <div style={{ fontSize: 10, color: '#334155', fontWeight: 700 }}>SCORE</div>
                  </div>
                </div>
              );
            }) : (
              <div style={{ textAlign: 'center', padding: 40, fontSize: 13, color: '#334155' }}>기여자 데이터 없음</div>
            )}
          </div>
        )}

        {/* === 탭 3: 피드 === */}
        {tab === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <FileSearch size={16} color="#60a5fa" />
              <span style={{ fontSize: 14, fontWeight: 800, color: '#e2e8f0' }}>실시간 인텔리전스 피드</span>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#60a5fa', animation: 'pulse 2s ease infinite' }} />
            </div>
            {stats.recentFeed.length > 0 ? stats.recentFeed.map((item, i) => (
              <div key={i} style={{
                borderRadius: 18, padding: '14px 16px',
                background: i === 0 ? 'rgba(96,165,250,0.07)' : 'rgba(255,255,255,0.03)',
                border: i === 0 ? '1px solid rgba(96,165,250,0.2)' : '1px solid rgba(255,255,255,0.07)',
                position: 'relative', overflow: 'hidden',
              }}>
                {i === 0 && (
                  <div style={{
                    position: 'absolute', top: 0, left: 0, bottom: 0, width: 3,
                    background: 'linear-gradient(180deg, #60a5fa, #818cf8)',
                    borderRadius: '18px 0 0 18px',
                  }} />
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 800, color: '#60a5fa',
                    background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)',
                    borderRadius: 6, padding: '2px 8px',
                  }}>
                    {item.category || '기타'} · APPROVED
                  </span>
                  <span style={{ fontSize: 11, color: '#334155', fontFamily: 'monospace', fontWeight: 700 }}>
                    {(item.reg_dt || '').substring(5, 16)}
                  </span>
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#f1f5f9', lineHeight: 1.4, marginBottom: 8 }}>
                  {item.title}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Brain size={12} color="#475569" />
                  <span style={{ fontSize: 12, color: '#475569', fontWeight: 700 }}>
                    @{item.reg_name || 'SYSTEM'}
                  </span>
                  <span style={{ fontSize: 11, color: '#1e293b', fontWeight: 700, marginLeft: 4 }}>· RAG Synced ✦</span>
                </div>
              </div>
            )) : (
              <div style={{ textAlign: 'center', padding: 40, fontSize: 13, color: '#334155' }}>피드 데이터 없음</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
