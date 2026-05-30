import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBackNavigation } from '../../hooks/useBackNavigation';
import { ArrowLeft, AlertTriangle, CheckCircle, Compass, BarChart3, TrendingUp, Zap, Shield } from 'lucide-react';
import { getAuthHeaders } from '../../lib/authStore';
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

/* ── 등급별 원형 게이지 ── */
function SeverityOrb({ level, count, maxCount, label }) {
  const cfg = SC[level];
  const minSize = 50, maxSize = 90;
  const size = maxCount > 0 ? minSize + Math.round((count / maxCount) * (maxSize - minSize)) : minSize;
  const r = (size - 8) / 2, circ = 2 * Math.PI * r;
  const pct = maxCount > 0 ? count / maxCount : 0;
  const offset = circ * (1 - pct);

  return (
    <div className="flex flex-col items-center gap-2" style={{ flex: 1, minWidth: 0 }}>
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
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
          <span className="font-black text-white leading-none" style={{ fontSize: size > 70 ? 20 : 14 }}>{count}</span>
          <span className="font-black uppercase tracking-widest" style={{ fontSize: 7, color: cfg.color, opacity: 0.8 }}>건</span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 8px', borderRadius: 99, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
        <span style={{ width: 4, height: 4, borderRadius: '50%', background: cfg.color, boxShadow: `0 0 6px ${cfg.color}`, display: 'inline-block', animation: level === 'CRITICAL' ? 'blink 1.5s infinite' : 'none' }} />
        <span style={{ fontSize: 8, fontWeight: 900, letterSpacing: '0.1em', color: cfg.color }}>{label}</span>
      </div>
    </div>
  );
}

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
      <div style={{ position: 'relative', height: 20, display: 'flex', alignItems: 'center' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, height: 6, borderRadius: 99, background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ position: 'absolute', left: 0, width: `${pct}%`, height: 6, borderRadius: 99, background: `linear-gradient(90deg, ${color}50, ${color})`, boxShadow: `0 0 10px ${color}60`, transition: 'width 0.15s' }} />
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{ position: 'absolute', width: '100%', opacity: 0, cursor: 'pointer', height: 20 }} />
        <div style={{
          position: 'absolute', left: `calc(${pct}% - 9px)`,
          width: 18, height: 18, borderRadius: '50%',
          background: color, border: '3px solid #020917',
          boxShadow: `0 0 12px ${color}`, transition: 'left 0.15s',
          pointerEvents: 'none'
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 8, fontFamily: 'monospace', color: '#334155', fontWeight: 700 }}>{isSim ? min.toFixed(2) : min}{unit}</span>
        <span style={{ fontSize: 8, fontFamily: 'monospace', color: '#334155', fontWeight: 700 }}>{isSim ? max.toFixed(2) : max}{unit}</span>
      </div>
    </div>
  );
}

function ThresholdBlock({ tier, title, subtitle, icon: Icon, color, bg, border, values, sliders, onChange }) {
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 24, padding: '20px 16px' }}>
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

export default function MobileAlertMonitor() {
  const navigate = useNavigate();
  const goBack = useBackNavigation('/dashboard');
  const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS);
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
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
      });

    fetchIncidents();
    const iv = setInterval(fetchIncidents, 10000);
    return () => clearInterval(iv);
  }, []);

  const saveSetting = (key, value) => {
    fetch(`${API_BASE}/sms/settings`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value: String(value) })
    }).catch(e => console.error('[AlertMonitor] Setting save failed:', e));
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
    const dbKeyMap = {
      critical: { errorCount: 'alert_critical_error_count', errorRate: 'alert_critical_error_rate' },
      major:    { errorCount: 'alert_major_error_count',    errorRate: 'alert_major_error_rate' },
    };
    saveSetting(dbKeyMap[tier][key], val);
  };

  const totalCount = incidents.length;
  const unresolved = incidents.filter(m => m.incident_status !== 'INC_003').length;
  const errorRate = totalCount > 0 ? Math.round((unresolved / totalCount) * 100) : 0;

  const classify = (inc) => {
    const vol = Number(inc.received_count) || 1;
    if (vol >= thresholds.critical.errorCount || errorRate >= thresholds.critical.errorRate) return 'CRITICAL';
    if (vol >= thresholds.major.errorCount    || errorRate >= thresholds.major.errorRate)    return 'MAJOR';
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
    { id: 'errorCount', label: '오류 건수', icon: BarChart3,  min: 1, max: 100, step: 1, unit: '건', isSim: false, desc: '동일 건 수신 횟수' },
    { id: 'errorRate',  label: '오류율',    icon: TrendingUp, min: 0, max: 100, step: 5, unit: '%',  isSim: false, desc: '미처리 비율' },
  ];

  return (
    <div style={{ height: '100%', background: '#020917', fontFamily: "Pretendard, sans-serif", display: 'flex', flexDirection: 'column' }} className="text-slate-300">

      <header style={{ background: 'rgba(2,9,23,0.9)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
        className="sticky top-0 z-50 flex items-center justify-between px-4 py-3 flex-shrink-0">
        <button onClick={() => goBack()}
          style={{ width: 36, height: 36, borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ArrowLeft style={{ width: 16, height: 16, color: '#64748b' }} />
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#06b6d4' }}>Orbital Monitor</div>
          <div style={{ fontSize: 8, fontWeight: 900, letterSpacing: '0.3em', color: 'rgba(6,182,212,0.4)', marginTop: 2 }}>Mobile v1.0</div>
        </div>
        <button onClick={fetchIncidents}
          style={{ width: 36, height: 36, borderRadius: 12, background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Compass style={{ width: 16, height: 16, color: '#06b6d4', animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
        </button>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 100 }}>
        
        {/* ── STATUS HUD ── */}
        <div style={{
          background: `radial-gradient(ellipse at 50% -20%, ${SC[overallSev].glow} 0%, transparent 65%), rgba(255,255,255,0.02)`,
          border: `1px solid ${SC[overallSev].border}`,
          borderRadius: 28,
          padding: '24px 16px',
          transition: 'all 0.7s ease',
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 99, background: SC[overallSev].bg, border: `1px solid ${SC[overallSev].border}`, boxShadow: `0 0 20px ${SC[overallSev].glow}` }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: SC[overallSev].color, boxShadow: `0 0 10px ${SC[overallSev].color}`, animation: 'blink 1.5s infinite' }} />
              <span style={{ fontSize: 14, fontWeight: 900, letterSpacing: '0.2em', color: SC[overallSev].color }}>{overallSev}</span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 24 }}>
            <SeverityOrb level="CRITICAL" count={critList.length}  maxCount={maxCount} label="CRITICAL" />
            <SeverityOrb level="MAJOR"    count={majorList.length} maxCount={maxCount} label="MAJOR" />
            <SeverityOrb level="NORMAL"   count={normalList.length} maxCount={maxCount} label="NORMAL" />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 20 }}>
            {[
              { label: '전체', value: totalCount, unit: '건', color: '#94a3b8' },
              { label: '오류율', value: errorRate, unit: '%', color: errorRate >= thresholds.critical.errorRate ? SC.CRITICAL.color : SC.NORMAL.color },
              { label: '미처리', value: unresolved, unit: '건', color: unresolved > 0 ? SC.MAJOR.color : SC.NORMAL.color },
            ].map(item => (
              <div key={item.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 900, color: item.color, fontFamily: 'monospace' }}>{item.value}<span style={{ fontSize: 10, marginLeft: 2 }}>{item.unit}</span></div>
                <div style={{ fontSize: 9, fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginTop: 4 }}>{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── SETTINGS ── */}
        <ThresholdBlock
          tier="critical" title="CRITICAL THRESHOLD" subtitle="위험 임계치 설정"
          icon={AlertTriangle} color={SC.CRITICAL.color}
          bg="rgba(248,113,113,0.03)" border="rgba(248,113,113,0.2)"
          values={thresholds.critical} sliders={SLIDERS}
          onChange={(key, val) => setTierVal('critical', key, val)}
        />

        <ThresholdBlock
          tier="major" title="MAJOR THRESHOLD" subtitle="경고 임계치 설정"
          icon={Zap} color={SC.MAJOR.color}
          bg="rgba(251,146,60,0.03)" border="rgba(251,146,60,0.18)"
          values={thresholds.major} sliders={SLIDERS}
          onChange={(key, val) => setTierVal('major', key, val)}
        />

        {/* LOGIC INFO */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 24, padding: '16px', display: 'flex', gap: 12 }}>
          <Shield style={{ width: 16, height: 16, color: '#334155', flexShrink: 0, marginTop: 2 }} />
          <div>
            <p style={{ fontSize: 10, fontWeight: 900, color: '#475569', textTransform: 'uppercase', marginBottom: 8 }}>우선순위 로직</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { level: 'CRITICAL', rule: '위험 수치 도달 시 최우선 판정', color: SC.CRITICAL.color },
                { level: 'MAJOR',    rule: '경고 수치 도달 시 판정', color: SC.MAJOR.color },
              ].map(({ level, rule, color }) => (
                <div key={level} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
                  <span style={{ fontSize: 10, fontWeight: 800, color }}>{level}</span>
                  <span style={{ fontSize: 10, color: '#475569' }}>{rule}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}
