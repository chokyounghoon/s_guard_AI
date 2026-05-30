import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBackNavigation } from '../hooks/useBackNavigation';
import {
  Shield, Zap, Database, MessageSquare, Users, CheckCircle2,
  BarChart3, Clock, Sparkles, Activity, FileSearch, Brain,
  Target, Rocket, Heart, Medal, ChevronLeft, Loader2, RefreshCw
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

// 탭 목록
const TABS = ['개요', 'MTTA 분석', '카테고리', '기여자', '피드'];

export default function OverallStatusPage() {
  const navigate = useNavigate();
  const goBack = useBackNavigation('/dashboard');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [tab, setTab] = useState(0);
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
      label: '평균 인지 소요시간',
      sub: `주간: ${stats.incidents.dayMtta || 0}m / 야간: ${stats.incidents.nightMtta || 0}m`,
      value: stats.incidents.mtta > 0 ? `${stats.incidents.mtta}m` : '-',
      icon: Clock,
      color: '#a855f7',
      formula: 'AVG(WARROOM - SMS_RECV)',
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
    { label: '대응 중', value: Math.max(0, stats.incidents.total - stats.incidents.resolved), icon: Activity, color: '#a78bfa' },
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
        flexShrink: 0, display: 'flex', padding: '10px 16px 0', gap: 6, overflowX: 'auto', WebkitOverflowScrolling: 'touch',
      }}>
        {TABS.map((t, i) => (
          <button key={i} onClick={() => setTab(i)} style={{
            flexShrink: 0, padding: '10px 14px', borderRadius: 12,
            fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap',
            background: tab === i ? 'rgba(129,140,248,0.12)' : 'rgba(255,255,255,0.03)',
            border: tab === i ? '1px solid rgba(129,140,248,0.3)' : '1px solid rgba(255,255,255,0.06)',
            color: tab === i ? '#818cf8' : '#475569',
            cursor: 'pointer', transition: 'all 0.15s',
          }}>{t}</button>
        ))}
      </div>

      {/* ③  콘텐츠 영역 */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 16px 80px', WebkitOverflowScrolling: 'touch' }}>

        {/* === 탭 0: 개요 === */}
        {tab === 0 && (
          <>
            {/* KPI 2열 그리드 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
              {KPI.map((k, i) => {
                const Icon = k.icon;
                return (
                  <div key={i} style={{
                    borderRadius: 14, padding: '10px 10px',
                    background: `linear-gradient(135deg, ${k.color}0d 0%, rgba(255,255,255,0.02) 100%)`,
                    border: `1px solid ${k.color}25`,
                    position: 'relative', overflow: 'hidden',
                  }}>
                    {/* 배경 아이콘 */}
                    <div style={{ position: 'absolute', right: 4, top: 4, opacity: 0.07 }}>
                      <Icon size={32} color={k.color} />
                    </div>
                    <div style={{
                      width: 24, height: 24, borderRadius: 6, marginBottom: 4,
                      background: `${k.color}18`, border: `1px solid ${k.color}30`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon size={12} color={k.color} />
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#f1f5f9', fontFamily: 'monospace', lineHeight: 1 }}>
                      {k.value}
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', marginTop: 4, lineHeight: 1.2 }}>
                      {k.label}
                    </div>
                    <div style={{ fontSize: 9, color: '#334155', marginTop: 2, fontWeight: 700 }}>{k.sub}</div>
                    <div style={{
                      marginTop: 4, fontSize: 8, fontFamily: 'monospace', color: k.color,
                      background: `${k.color}10`, border: `1px solid ${k.color}20`,
                      borderRadius: 4, padding: '2px 4px', display: 'inline-block', opacity: 0.8,
                    }}>{k.formula}</div>
                  </div>
                );
              })}
            </div>

            {/* 인시던트 생애주기 플로우 */}
            <div style={{
              borderRadius: 14, padding: '10px',
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Activity size={14} color="#818cf8" />
                <span style={{ fontSize: 12, fontWeight: 800, color: '#e2e8f0' }}>인시던트 생애주기</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {FLOW.map((f, i) => {
                  const Icon = f.icon;
                  return (
                    <React.Fragment key={i}>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: 10,
                          background: `${f.color}15`, border: `1px solid ${f.color}30`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          ...(i === 4 ? { animation: 'glow 2s ease infinite' } : {}),
                        }}>
                          <Icon size={16} color={f.color} />
                        </div>
                        <span style={{ fontSize: 15, fontWeight: 900, color: f.color, fontFamily: 'monospace' }}>
                          {f.value}
                        </span>
                        <span style={{ fontSize: 8, color: '#334155', fontWeight: 700, textAlign: 'center', lineHeight: 1.1, wordBreak: 'keep-all' }}>
                          {f.label}
                        </span>
                      </div>
                      {i < FLOW.length - 1 && (
                        <div style={{ width: 8, height: 1, background: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* === 탭 1: MTTA 분석 === */}
        {tab === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Clock size={16} color="#a855f7" />
              <span style={{ fontSize: 14, fontWeight: 800, color: '#e2e8f0' }}>일자별 MTTA (주/야간)</span>
              <span style={{
                fontSize: 11, color: '#a855f7', fontWeight: 800,
                background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)',
                borderRadius: 6, padding: '1px 8px',
              }}>Performance</span>
            </div>
            
            {/* 기간 검색 필터 */}
            <div style={{ 
              display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8,
              background: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)'
            }}>
              <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 6 }}>
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={e => setStartDate(e.target.value)}
                  style={{ 
                    flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
                    color: '#e2e8f0', borderRadius: 8, padding: '6px 8px', fontSize: 12, outline: 'none'
                  }}
                />
                <span style={{ color: '#64748b', fontSize: 12 }}>~</span>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={e => setEndDate(e.target.value)}
                  style={{ 
                    flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
                    color: '#e2e8f0', borderRadius: 8, padding: '6px 8px', fontSize: 12, outline: 'none'
                  }}
                />
              </div>
              <button 
                onClick={() => fetchData(true, startDate, endDate)}
                disabled={refreshing}
                style={{
                  background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)', color: '#c084fc',
                  padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: refreshing ? 'not-allowed' : 'pointer',
                  opacity: refreshing ? 0.7 : 1
                }}
              >
                {refreshing ? '처리중...' : '조회'}
              </button>
            </div>
            {stats.incidents.mttaList && stats.incidents.mttaList.length > 0 ? stats.incidents.mttaList.map((m, i) => (
              <div key={i} style={{
                borderRadius: 16, padding: '14px 16px',
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
              }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#e2e8f0', marginBottom: 12 }}>
                  {m.date}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{
                    background: 'rgba(250,204,21,0.05)', border: '1px solid rgba(250,204,21,0.1)',
                    borderRadius: 10, padding: '10px',
                  }}>
                    <div style={{ fontSize: 11, color: '#fbbf24', fontWeight: 700, marginBottom: 4 }}>주간 (09~18시)</div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
                      <span style={{ fontSize: 22, fontWeight: 900, color: '#fde68a', fontFamily: 'monospace', lineHeight: 1 }}>{m.dayMtta}</span>
                      <span style={{ fontSize: 11, color: '#64748b', fontWeight: 700, marginBottom: 2 }}>분</span>
                    </div>
                    <div style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>{m.dayCount}건 처리</div>
                  </div>
                  <div style={{
                    background: 'rgba(129,140,248,0.05)', border: '1px solid rgba(129,140,248,0.1)',
                    borderRadius: 10, padding: '10px',
                  }}>
                    <div style={{ fontSize: 11, color: '#818cf8', fontWeight: 700, marginBottom: 4 }}>야간 (18~09시)</div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
                      <span style={{ fontSize: 22, fontWeight: 900, color: '#c7d2fe', fontFamily: 'monospace', lineHeight: 1 }}>{m.nightMtta}</span>
                      <span style={{ fontSize: 11, color: '#64748b', fontWeight: 700, marginBottom: 2 }}>분</span>
                    </div>
                    <div style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>{m.nightCount}건 처리</div>
                  </div>
                </div>
              </div>
            )) : (
              <div style={{ textAlign: 'center', padding: 40, fontSize: 13, color: '#334155' }}>MTTA 데이터 없음</div>
            )}
          </div>
        )}

        {/* === 탭 2: 카테고리 === */}
        {tab === 2 && (
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

        {/* === 탭 3: 기여자 === */}
        {tab === 3 && (
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
            {/* 계산식 */}
            <div style={{
              display: 'flex', gap: 6, flexWrap: 'wrap',
              padding: '8px 12px', borderRadius: 10, marginBottom: 4,
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
            }}>
              <span style={{ fontSize: 10, color: '#64748b', fontWeight: 700 }}>SCORE =</span>
              <span style={{ fontSize: 10, color: '#f472b6', fontWeight: 800 }}>전파 × 50pt</span>
              <span style={{ fontSize: 10, color: '#475569' }}>+</span>
              <span style={{ fontSize: 10, color: '#34d399', fontWeight: 800 }}>KB × 30pt</span>
              <span style={{ fontSize: 10, color: '#475569' }}>+</span>
              <span style={{ fontSize: 10, color: '#60a5fa', fontWeight: 800 }}>참여건 × 20pt</span>
              <span style={{ fontSize: 10, color: '#334155', marginLeft: 4 }}>│ MTTA: 주간 1분·야간 5분 내 달성건</span>
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
                      {user.full_org}
                    </div>
                    <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                      <span style={{ fontSize: 11, color: '#f472b6', fontWeight: 700 }}>전파: {user.warroom_count}</span>
                      <span style={{ fontSize: 11, color: '#a855f7', fontWeight: 700 }}>MTTA: {user.mtta_fast_count}</span>
                      <span style={{ fontSize: 11, color: '#34d399', fontWeight: 700 }}>KB: {user.kb_count}</span>
                      <span style={{ fontSize: 11, color: '#60a5fa', fontWeight: 700 }}>참여건: {user.chat_count}</span>
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

        {/* === 탭 4: 피드 === */}
        {tab === 4 && (
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
