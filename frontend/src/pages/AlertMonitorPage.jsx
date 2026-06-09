import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBackNavigation } from '../hooks/useBackNavigation';
import { ArrowLeft, AlertTriangle, CheckCircle, Compass, BarChart3, TrendingUp, Zap, Shield } from 'lucide-react';
import { getAuthHeaders } from '../lib/authStore';
import { Toaster, toast } from 'react-hot-toast';

const API_BASE = 'https://sguardai.khcho0421.workers.dev';

const DEFAULT_THRESHOLDS = {
  critical: { errorCount: 10, errorRate: 50 },
  major:    { errorCount: 3,  errorRate: 25 },
};

const SC = {
  CRITICAL: { color: '#f87171', glow: 'rgba(248,113,113,0.4)',  bg: 'rgba(248,113,113,0.06)', border: 'rgba(248,113,113,0.28)' },
  MAJOR:    { color: '#fb923c', glow: 'rgba(251,146,60,0.28)',   bg: 'rgba(251,146,60,0.05)',  border: 'rgba(251,146,60,0.22)' },
  NORMAL:   { color: '#34d399', glow: 'rgba(52,211,153,0.2)',   bg: 'rgba(52,211,153,0.04)',  border: 'rgba(52,211,153,0.18)' },
};

/* ── 등급별 원형 게이지 (건수 기반 상대 크기) ── */
function SeverityOrb({ level, count, maxCount, label }) {
  const cfg = SC[level];
  const minSize = 60, maxSize = 110;
  const size = maxCount > 0 ? minSize + Math.round((count / maxCount) * (maxSize - minSize)) : minSize;
  const r = (size - 8) / 2, circ = 2 * Math.PI * r;
  const pct = maxCount > 0 ? count / maxCount : 0;
  const offset = circ * (1 - pct);

  return (
    <div className="flex flex-col items-center gap-2" style={{ flex: 1, minWidth: 0 }}>
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        {/* 배경 글로우 */}
        <div style={{
          position: 'absolute', width: size * 0.9, height: size * 0.9, borderRadius: '50%',
          background: `radial-gradient(circle, ${cfg.glow} 0%, transparent 70%)`,
          transition: 'all 0.8s ease'
        }} />
        <svg width={size} height={size} className="-rotate-90" style={{ position: 'absolute', transition: 'all 0.8s ease' }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={5} />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={cfg.color} strokeWidth={5}
            strokeDasharray={circ} strokeDashoffset={isNaN(offset) ? circ : offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s ease-out', filter: `drop-shadow(0 0 8px ${cfg.color})` }} />
        </svg>
        <div className="absolute flex flex-col items-center justify-center">
          <span className="font-black text-white leading-none" style={{ fontSize: size > 90 ? 28 : size > 70 ? 20 : 14 }}>{count}</span>
          <span className="font-black uppercase tracking-widest" style={{ fontSize: 7, color: cfg.color, opacity: 0.8 }}>건</span>
        </div>
      </div>
      {/* 등급 레이블 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 99, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.color, boxShadow: `0 0 6px ${cfg.color}`, display: 'inline-block', animation: level === 'CRITICAL' ? 'blink 1.5s infinite' : 'none' }} />
        <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.18em', color: cfg.color }}>{label}</span>
      </div>
    </div>
  );
}

/* ── 슬라이더 행 ── */
function SliderRow({ icon: Icon, label, value, min, max, step, unit, isSim, color, onChange, desc }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5" style={{ color: 'rgba(148,163,184,0.7)' }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
        </div>
        <div style={{ padding: '4px 10px', borderRadius: 8, background: `${color}14`, border: `1px solid ${color}30` }}>
          <span style={{ fontSize: 15, fontWeight: 900, fontFamily: 'monospace', color }}>{isSim ? value.toFixed(2) : value}</span>
          <span style={{ fontSize: 9, color: '#64748b', marginLeft: 2 }}>{unit}</span>
        </div>
      </div>

      {/* 커스텀 슬라이더 트랙 */}
      <div style={{ position: 'relative', height: 20, display: 'flex', alignItems: 'center' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, height: 6, borderRadius: 99, background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ position: 'absolute', left: 0, width: `${pct}%`, height: 6, borderRadius: 99, background: `linear-gradient(90deg, ${color}50, ${color})`, boxShadow: `0 0 10px ${color}60`, transition: 'width 0.15s' }} />
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{ position: 'absolute', width: '100%', opacity: 0, cursor: 'pointer', height: 20 }} />
        {/* 핸들 */}
        <div style={{
          position: 'absolute', left: `calc(${pct}% - 9px)`,
          width: 18, height: 18, borderRadius: '50%',
          background: color, border: '3px solid #020917',
          boxShadow: `0 0 12px ${color}`, transition: 'left 0.15s',
          pointerEvents: 'none'
        }} />
      </div>

      {/* 눈금 */}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 8, fontFamily: 'monospace', color: '#334155', fontWeight: 700 }}>{isSim ? min.toFixed(2) : min}{unit}</span>
        <span style={{ fontSize: 8, fontFamily: 'monospace', color: '#334155', fontWeight: 700 }}>{isSim ? ((min + max) / 2).toFixed(2) : (min + max) / 2}{unit}</span>
        <span style={{ fontSize: 8, fontFamily: 'monospace', color: '#334155', fontWeight: 700 }}>{isSim ? max.toFixed(2) : max}{unit}</span>
      </div>

      <p style={{ fontSize: 8, color: '#475569', lineHeight: 1.4 }}>{desc}</p>
    </div>
  );
}

/* ── 임계치 블록 ── */
function ThresholdBlock({ tier, title, subtitle, icon: Icon, color, bg, border, values, sliders, onChange }) {
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 24, padding: '18px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ width: 38, height: 38, borderRadius: 12, background: `${color}14`, border: `1px solid ${color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon style={{ width: 18, height: 18, color }} />
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 900, color, letterSpacing: '0.14em', textTransform: 'uppercase' }}>{title}</div>
          <div style={{ fontSize: 9, color: '#475569', fontWeight: 600, marginTop: 1 }}>{subtitle}</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {sliders.map(s => (
          <SliderRow key={s.id} {...s} color={color} value={values[s.id]} onChange={val => onChange(s.id, val)} />
        ))}
      </div>
    </div>
  );
}

/* ── 메인 ── */
export default function AlertMonitorPage({ embedded = false }) {
  const navigate = useNavigate();
  const goBack = useBackNavigation('/dashboard');
  const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS);
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    // 이전 버전 데이터 정리
    localStorage.removeItem('sguard_alert_thresholds_v2');

    // 1. DB에서 먼저 로드 (system_config 우선)
    fetch(`${API_BASE}/sms/settings`, { headers: getAuthHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.settings) return;
        const s = data.settings;
        const get = (key, def) => {
          const found = s.find(x => x.key === key);
          return found ? parseFloat(found.value) : def;
        };
        const dbThresholds = {
          critical: {
            errorCount: get('alert_critical_error_count', DEFAULT_THRESHOLDS.critical.errorCount),
            errorRate:  get('alert_critical_error_rate',  DEFAULT_THRESHOLDS.critical.errorRate),
          },
          major: {
            errorCount: get('alert_major_error_count', DEFAULT_THRESHOLDS.major.errorCount),
            errorRate:  get('alert_major_error_rate',  DEFAULT_THRESHOLDS.major.errorRate),
          },
        };
        setThresholds(dbThresholds);
        localStorage.setItem('sguard_alert_thresholds_v3', JSON.stringify(dbThresholds));
      })
      .catch(() => {
        // DB 로드 실패 시 localStorage fallback
        const saved = localStorage.getItem('sguard_alert_thresholds_v3');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            setThresholds({
              critical: { ...DEFAULT_THRESHOLDS.critical, ...(parsed.critical || {}) },
              major:    { ...DEFAULT_THRESHOLDS.major,    ...(parsed.major    || {}) },
            });
          } catch { /* 파싱 실패 시 기본값 유지 */ }
        }
      });

    fetchIncidents();
    const iv = setInterval(fetchIncidents, 10000);
    return () => clearInterval(iv);
  }, []);

  const saveSetting = (key, value, tier) => {
    fetch(`${API_BASE}/sms/settings`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value: String(value) })
    })
    .then(res => {
      if (res.ok) {
        toast.success(`${tier.toUpperCase()} 임계치가 정상적으로 수정되었습니다.`, {
          style: { background: '#0f172a', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }
        });
      }
    })
    .catch(e => console.error('[AlertMonitor] Setting save failed:', e));
  };

  const fetchIncidents = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`${API_BASE}/sms/recent?limit=200`, { headers: getAuthHeaders() });
      if (res.ok) { const d = await res.json(); setIncidents(d.messages || []); setLastUpdated(new Date()); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); setTimeout(() => setIsRefreshing(false), 800); }
  };

  const setTierVal = (tier, key, val) => {
    const updated = { ...thresholds, [tier]: { ...thresholds[tier], [key]: val } };
    setThresholds(updated);
    localStorage.setItem('sguard_alert_thresholds_v3', JSON.stringify(updated));
    // DB 저장 (system_config)
    const dbKeyMap = {
      critical: { errorCount: 'alert_critical_error_count', errorRate: 'alert_critical_error_rate' },
      major:    { errorCount: 'alert_major_error_count',    errorRate: 'alert_major_error_rate' },
    };
    saveSetting(dbKeyMap[tier][key], val, tier);
  };

  /* 지표 계산 */
  const totalCount = incidents.length;
  const unresolved = incidents.filter(m => m.incident_status !== 'INC_003').length;
  const errorRate = totalCount > 0 ? Math.round((unresolved / totalCount) * 100) : 0;

  /* 3단계 판정 — 각 영역 OR 조건
     CRITICAL : 개별 오류건수 >= CRITICAL 설정치  OR  시스템 오류율 >= CRITICAL 설정치
     MAJOR    : 개별 오류건수 >= MAJOR 설정치     OR  시스템 오류율 >= MAJOR 설정치
     NORMAL   : CRITICAL·MAJOR 조건 모두 미해당 (기본값)              */
  const classify = (inc) => {
    // 개별 인시던트의 중복 수신 횟수(received_count)와 시스템 전체 오류율(errorRate)을 함께 평가합니다.
    const currentCount = Number(inc.received_count) || Number(inc.occurrence_count) || 1;

    // 1순위: CRITICAL
    if (currentCount >= thresholds.critical.errorCount || errorRate >= thresholds.critical.errorRate) return 'CRITICAL';
    // 2순위: MAJOR
    if (currentCount >= thresholds.major.errorCount    || errorRate >= thresholds.major.errorRate)    return 'MAJOR';
    
    return 'NORMAL';
  };

  const evaluated  = incidents.map(inc => ({ ...inc, severity: classify(inc) }));
  const critList   = evaluated.filter(i => i.severity === 'CRITICAL');
  const majorList  = evaluated.filter(i => i.severity === 'MAJOR');
  const normalList = evaluated.filter(i => i.severity === 'NORMAL');
  const maxCount   = Math.max(critList.length, majorList.length, normalList.length, 1);

  const overallSev =
    critList.length > 0 ? 'CRITICAL' :
    majorList.length > 0 ? 'MAJOR' : 'NORMAL';

  const SLIDERS = [
    { id: 'errorCount', label: '오류 건수', icon: BarChart3,  min: 1, max: 100, step: 1, unit: '건', isSim: false, desc: '개별 장애 발생(중복) 건수 기준' },
    { id: 'errorRate',  label: '오류율',    icon: TrendingUp, min: 0, max: 100, step: 5, unit: '%',  isSim: false, desc: '시스템 전체 미처리 장애 비율 기준' },
  ];

  return (
    <div style={
      embedded
        ? { width: '100%', height: '100%', minHeight: '300px', display: 'flex', flexDirection: 'column', fontFamily: "'Pretendard','Inter',sans-serif", overflow: 'hidden' }
        : { height: '100%', background: 'linear-gradient(160deg,#020917 0%,#070d1f 50%,#020917 100%)', fontFamily: "'Pretendard','Inter',sans-serif", overflow: 'hidden', display: 'flex', flexDirection: 'column' }
    } className="text-slate-300">

      {/* HEADER */}
      {!embedded && (
        <header style={{ background: 'rgba(2,9,23,0.88)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(6,182,212,0.08)' }}
          className="sticky top-0 z-50 flex items-center justify-between px-4 py-3 flex-shrink-0">
        <button onClick={() => goBack()}
          style={{ width: 36, height: 36, borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ArrowLeft style={{ width: 16, height: 16, color: '#64748b' }} />
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: '0.18em', textTransform: 'uppercase', background: 'linear-gradient(90deg,#06b6d4,#818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Orbital Monitor
          </div>
          <div style={{ fontSize: 8, fontWeight: 900, letterSpacing: '0.35em', textTransform: 'uppercase', color: 'rgba(6,182,212,0.45)', marginTop: 2 }}>
            3-Tier Severity Engine
          </div>
        </div>
        <button onClick={fetchIncidents}
          style={{ width: 36, height: 36, borderRadius: 12, background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Compass style={{ width: 16, height: 16, color: '#06b6d4', animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
        </button>
      </header>
      )}

      {/* ── 2-COLUMN GRID BODY ── */}
      <div style={{ flex: 1, overflow: 'hidden', padding: '12px', display: 'grid', gridTemplateColumns: '45% 55%', gridTemplateRows: '1fr', gap: 12, minHeight: 0 }}>

        {/* ── LEFT: 3-ORB STATUS HUD ── */}
        <div style={{
          background: `radial-gradient(ellipse at 50% -20%, ${SC[overallSev].glow} 0%, transparent 65%), rgba(255,255,255,0.02)`,
          border: `1px solid ${SC[overallSev].border}`,
          borderRadius: 24,
          padding: '16px 14px',
          transition: 'all 0.7s ease',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0
        }}>
          {/* 스캔라인 */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${SC[overallSev].color}, transparent)`, animation: 'slideX 4s linear infinite', opacity: 0.4 }} />

          <p style={{ fontSize: 8, fontWeight: 900, color: 'rgba(100,116,139,0.6)', letterSpacing: '0.3em', textTransform: 'uppercase', textAlign: 'center', marginBottom: 8 }}>
            Operational Status
          </p>

          {/* 현재 등급 배지 */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 99, background: SC[overallSev].bg, border: `1px solid ${SC[overallSev].border}`, boxShadow: `0 0 20px ${SC[overallSev].glow}` }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: SC[overallSev].color, boxShadow: `0 0 10px ${SC[overallSev].color}`, animation: 'blink 1.5s infinite' }} />
              <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.22em', color: SC[overallSev].color }}>{overallSev}</span>
            </div>
          </div>

          {/* 3개 ORB — flex:1 로 남은 공간 채움 */}
          <div style={{ flex: 1, display: 'flex', justifyContent: 'space-around', alignItems: 'center', gap: 4 }}>
            {loading ? (
              <div style={{ textAlign: 'center', opacity: 0.3 }}>
                <div style={{ width: 24, height: 24, border: '2px solid #06b6d4', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
              </div>
            ) : (
              <>
                <SeverityOrb level="CRITICAL" count={critList.length}  maxCount={maxCount} label="CRITICAL" />
                <SeverityOrb level="MAJOR"    count={majorList.length} maxCount={maxCount} label="MAJOR" />
                <SeverityOrb level="NORMAL"   count={normalList.length} maxCount={maxCount} label="NORMAL" />
              </>
            )}
          </div>

          {/* 요약 수치 바 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: 12, paddingTop: 12 }}>
            {[
              { label: '전체', value: totalCount, unit: '건', color: '#94a3b8' },
              { label: '오류율', value: errorRate, unit: '%', color: errorRate >= thresholds.critical.errorRate ? SC.CRITICAL.color : errorRate >= thresholds.major.errorRate ? SC.MAJOR.color : SC.NORMAL.color },
              { label: '미처리', value: unresolved, unit: '건', color: unresolved > 0 ? SC.MAJOR.color : SC.NORMAL.color },
            ].map(item => (
              <div key={item.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: item.color, fontFamily: 'monospace', lineHeight: 1 }}>{item.value}<span style={{ fontSize: 9, marginLeft: 1, opacity: 0.7 }}>{item.unit}</span></div>
                <div style={{ fontSize: 8, fontWeight: 700, color: '#475569', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 3 }}>{item.label}</div>
              </div>
            ))}
          </div>

          {lastUpdated && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
              <span style={{ fontSize: 8, fontFamily: 'monospace', color: 'rgba(71,85,105,0.5)', fontWeight: 700 }}>SYNC {lastUpdated.toLocaleTimeString()}</span>
            </div>
          )}
        </div>

        {/* ── RIGHT: 임계치 설정 + 판정 우선순위 ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', minHeight: 0 }} className="pb-10 custom-scrollbar">

          {/* ── CRITICAL 임계치 ── */}
          <ThresholdBlock
            tier="critical" title="CRITICAL 임계치" subtitle="이 값 이상이면 CRITICAL 판정"
            icon={AlertTriangle} color={SC.CRITICAL.color}
            bg="rgba(248,113,113,0.03)" border="rgba(248,113,113,0.2)"
            values={thresholds.critical} sliders={SLIDERS}
            onChange={(key, val) => setTierVal('critical', key, val)}
          />

          {/* ── MAJOR 임계치 ── */}
          <ThresholdBlock
            tier="major" title="MAJOR 임계치" subtitle="CRITICAL 미만, NORMAL 초과 구간"
            icon={Zap} color={SC.MAJOR.color}
            bg="rgba(251,146,60,0.03)" border="rgba(251,146,60,0.18)"
            values={thresholds.major} sliders={SLIDERS}
            onChange={(key, val) => setTierVal('major', key, val)}
          />

          {/* 판정 로직 안내 */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <Shield style={{ width: 14, height: 14, color: '#334155', flexShrink: 0, marginTop: 1 }} />
            <div>
              <p style={{ fontSize: 9, fontWeight: 900, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 6 }}>판정 우선순위</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[
                  { level: 'CRITICAL', rule: 'CRITICAL 설정치 이상 → 최우선 판정', color: SC.CRITICAL.color },
                  { level: 'MAJOR',    rule: 'MAJOR 설정치 이상, CRITICAL 미만', color: SC.MAJOR.color },
                  { level: 'NORMAL',   rule: 'CRITICAL·MAJOR 미해당 → 자동 분류', color: SC.NORMAL.color },
                ].map(({ level, rule, color }) => (
                  <div key={level} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, boxShadow: `0 0 5px ${color}`, flexShrink: 0 }} />
                    <span style={{ fontSize: 9, fontWeight: 700, color, letterSpacing: '0.1em', minWidth: 58 }}>{level}</span>
                    <span style={{ fontSize: 9, color: '#475569' }}>{rule}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>

      <style>{`
        @keyframes slideX  { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }
        @keyframes blink   { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes spin    { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}
