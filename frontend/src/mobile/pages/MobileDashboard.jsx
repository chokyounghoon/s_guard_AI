import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Bell, ChevronRight, Shield, Zap,
  CheckCircle2, Loader2, Wifi, Activity, Settings, RefreshCw,
  LayoutDashboard, Timer, Flame, Target, MoreHorizontal
} from 'lucide-react';
import { getAccessToken, getAuthHeaders } from '../../lib/authStore';
import { PushManager } from '../../lib/pushManager';
import PullToRefresh from '../components/PullToRefresh';

const API_BASE = 'https://sguardai.khcho0421.workers.dev';

// ── 커스텀 롱 프레스 훅 (모바일 크롬 최적화) ──
const useLongPress = (onLongPress, onClick, { delay = 500 } = {}) => {
  const [longPressTriggered, setLongPressTriggered] = useState(false);
  const timerRef = useRef();
  const targetRef = useRef();

  const start = useCallback((event) => {
    if (event.target) {
      targetRef.current = event.target;
    }
    setLongPressTriggered(false);
    timerRef.current = setTimeout(() => {
      onLongPress(event);
      setLongPressTriggered(true);
    }, delay);
  }, [onLongPress, delay]);

  const stop = useCallback((event) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    if (!longPressTriggered && onClick) {
      onClick(event);
    }
    setLongPressTriggered(false);
  }, [onClick, longPressTriggered]);

  return {
    onMouseDown: e => start(e),
    onTouchStart: e => start(e),
    onMouseUp: e => stop(e),
    onMouseLeave: e => stop(e),
    onTouchEnd: e => stop(e),
  };
};

const STATUS_MAP = {
  '미처리':   { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.2)', label: '미처리' },
  '미확인':   { color: '#fb923c', bg: 'rgba(251,146,60,0.1)', border: 'rgba(251,146,60,0.2)', label: '미확인' },
  '처리중':   { color: '#60a5fa', bg: 'rgba(96,165,250,0.1)', border: 'rgba(96,165,250,0.2)', label: '처리중' },
  '처리완료': { color: '#34d399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.2)', label: '완료'   },
  DEFAULT:    { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.2)', label: '미확인' },
};

export default function MobileDashboard({ user }) {
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, critical: 0, resolved: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [pushStatus, setPushStatus] = useState({ supported: false, enabled: false });
  const [pushLoading, setPushLoading] = useState(false);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/sms/recent?limit=50`, { 
        headers: getAuthHeaders() 
      });
      if (!res.ok) throw new Error('데이터 로드 실패');
      const data = await res.json();
      const list = data.messages || [];

      setIncidents(list);
      setStats({
        total: list.length,
        pending: list.filter(i => i.incident_status === '미처리' || i.incident_status === '미확인').length,
        critical: list.filter(i => i.keyword_detected === 1).length,
        resolved: list.filter(i => i.incident_status === '처리완료').length,
      });
      setLastUpdate(new Date());
    } catch (e) {
      console.error('[MobileDashboard]', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 30000);
    PushManager.getStatus().then(setPushStatus);
    return () => clearInterval(interval);
  }, [fetchData]);

  // ── 인시던트 항목 클릭/롱프레스 처리 ──
  const handleIncidentClick = (item) => {
    const cleanId = String(item.inc_id).replace('INC-', '');
    // 처리완료 상태인 경우 리포트 페이지로 이동
    if (item.incident_status === '처리완료') {
      navigate(`/report/${cleanId}`);
    } else {
      navigate(`/chat/${cleanId}`);
    }
  };
  const handleIncidentLongPress = (item) => {
    if (navigator.vibrate) navigator.vibrate(50); // 햅틱 피드백
    window.alert(`인시던트 상세정보\nID: ${item.inc_id}\n상태: ${item.incident_status}\n서비스: ${item.service_name || 'N/A'}`);
  };

  return (
    <PullToRefresh onRefresh={() => fetchData(true)}>
      <div className="flex-1 flex flex-col bg-[#060a12] min-h-screen pb-24 relative overflow-hidden">
        {/* 배경 글로우 */}
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-600/5 blur-[120px] rounded-full -mr-48 -mt-48 pointer-events-none" />

        {/* 헤더: 모바일 최적화 높이 및 폰트 */}
        <header className="sticky top-0 z-40 bg-[#060a12]/80 backdrop-blur-xl border-b border-white/5 px-5 pt-6 pb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="font-black text-white text-xl tracking-tighter leading-none mb-1">S-GUARD AI</h1>
              <p className="text-[9px] font-black text-blue-400/50 tracking-[0.15em] uppercase italic leading-none">Active Surveillance</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => fetchData(true)} className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center active:scale-95 transition-transform">
                <RefreshCw className={`w-3.5 h-3.5 text-slate-300 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 p-[1px]">
                <div className="w-full h-full rounded-[7px] bg-[#0a0e17] flex items-center justify-center text-xs font-black text-white">
                  {user?.name?.[0] || 'U'}
                </div>
              </div>
            </div>
          </div>
          {user && (
            <div className="flex items-center gap-2 px-0.5 opacity-50">
              <div className="w-1 h-1 rounded-full bg-blue-500" />
              <p className="text-[10px] text-slate-300 font-bold tracking-tight">
                {user.name} <span className="mx-1 opacity-20">|</span> {user.company || 'Security Ops'}
              </p>
            </div>
          )}
        </header>

        {/* 통계: 패딩 및 폰트 조정 */}
        <div className="grid grid-cols-2 gap-3.5 px-5 pt-6">
          {[
            { label: 'Total Logs', value: stats.total, icon: LayoutDashboard, color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
            { label: 'Pending',    value: stats.pending, icon: Timer, color: '#f97316', bg: 'rgba(249,115,22,0.1)', alert: stats.pending > 0 },
            { label: 'Critical',   value: stats.critical, icon: Flame, color: '#ef4444', bg: 'rgba(239,68,68,0.1)', alert: stats.critical > 0 },
            { label: 'AI Analyzed',value: stats.resolved, icon: Target, color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
          ].map((s, idx) => (
            <div key={s.label} className="glass-card rounded-[2rem] p-5 relative overflow-hidden animate-fade-in-up" style={{ animationDelay: `${idx * 80}ms` }}>
              <div className="absolute top-0 right-0 w-16 h-16 opacity-15 -mr-8 -mt-8 blur-xl rounded-full" style={{ background: s.color }} />
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-4 border border-white/5" style={{ background: s.bg }}>
                <s.icon className="w-4 h-4" style={{ color: s.color }} />
              </div>
              <div className="text-2xl font-black text-white tracking-tighter mb-0.5 font-mono">
                {loading ? <Loader2 className="w-5 h-5 animate-spin opacity-20" /> : s.value}
              </div>
              <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">{s.label}</p>
              {s.alert && <div className="absolute top-5 right-5 w-1.5 h-1.5 rounded-full animate-ping" style={{ background: s.color }} />}
            </div>
          ))}
        </div>

        {/* 리스트: 롱프레스 적용 및 폰트 최적화 */}
        <div className="flex-1 px-5 mt-8">
          <div className="flex items-center justify-between mb-5 px-0.5">
            <div className="flex items-center gap-2.5">
              <div className="w-0.5 h-5 bg-blue-600 rounded-full" />
              <h2 className="text-lg font-black text-white tracking-tight">Surveillance Logs</h2>
            </div>
          </div>

          {loading ? (
            <div className="space-y-3.5">
              {[1, 2, 3].map(i => <div key={i} className="h-28 glass-card rounded-[2rem] animate-pulse" />)}
            </div>
          ) : incidents.length === 0 ? (
            <div className="py-16 text-center glass-card rounded-[2.5rem] border-dashed border-white/5">
              <Wifi className="w-10 h-10 text-slate-800 mx-auto mb-3" />
              <p className="text-xs font-black text-slate-600 uppercase tracking-widest">Everything is Secure</p>
            </div>
          ) : (
            <div className="space-y-3.5 pb-10">
              {incidents.map((item, idx) => {
                const s = STATUS_MAP[item.incident_status] || STATUS_MAP.DEFAULT;
                const isUrgent = item.keyword_detected === 1;
                
                // 롱프레스 훅 사용
                const longPressProps = useLongPress(
                  () => handleIncidentLongPress(item),
                  () => handleIncidentClick(item)
                );

                return (
                  <div
                    key={item.inc_id}
                    {...longPressProps}
                    onContextMenu={(e) => e.preventDefault()} // 기본 메뉴 방지
                    className={`w-full text-left glass-card rounded-[2rem] p-5 active:scale-[0.98] transition-all group relative overflow-hidden animate-fade-in-up ${isUrgent ? 'border-red-600/20' : ''}`}
                    style={{ animationDelay: `${(idx % 8) * 40}ms` }}
                  >
                    {isUrgent && <div className="absolute top-0 left-0 w-1 h-full bg-red-600/50" />}
                    <div className="flex items-center justify-between mb-3.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] font-black px-2 py-1 rounded-lg border uppercase tracking-wider" style={{ color: s.color, background: s.bg, borderColor: s.border }}>{s.label}</span>
                        {isUrgent && <span className="text-[8px] font-black px-2 py-1 rounded-lg bg-red-600 text-white uppercase tracking-wider">Urgent</span>}
                      </div>
                      <span className="text-[9px] text-slate-500 font-bold font-mono">
                        {item.timestamp ? new Date(item.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                    <p className="text-[14px] text-slate-100 font-bold leading-snug line-clamp-2 mb-4 pr-2 tracking-tight group-active:text-blue-400 transition-colors">{item.message}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 overflow-hidden">
                        {item.service_name && (
                          <div className="px-2 py-0.5 rounded-md bg-white/5 border border-white/5 flex items-center gap-1.5 shrink-0">
                            <Activity className="w-2.5 h-2.5 text-blue-500" />
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tight truncate max-w-[80px]">{item.service_name}</span>
                          </div>
                        )}
                        {item.error_code && (
                          <div className="px-2 py-0.5 rounded-md bg-orange-500/10 border border-orange-500/10 flex items-center gap-1.5 shrink-0">
                            <Zap className="w-2.5 h-2.5 text-orange-500" />
                            <span className="text-[9px] text-orange-400 font-mono font-bold tracking-tight">{item.error_code}</span>
                          </div>
                        )}
                      </div>
                      <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center group-active:bg-blue-600/20 transition-all">
                        <ChevronRight className="w-4 h-4 text-slate-600 group-active:text-blue-400" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </PullToRefresh>
  );
}
