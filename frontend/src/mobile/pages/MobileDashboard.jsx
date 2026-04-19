import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Bell, ChevronRight, Shield, Zap,
  CheckCircle2, Loader2, Wifi, Activity, Settings
} from 'lucide-react';
import { getAccessToken, getAuthHeaders } from '../../lib/authStore';
import { PushManager } from '../../lib/pushManager';
import PullToRefresh from '../components/PullToRefresh';

const API_BASE = 'https://sguardai.khcho0421.workers.dev';

// 상태 배지 색상 (API 응답의 incident_status 기준)
const STATUS_MAP = {
  '미처리':   { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', label: '미처리' },
  '미확인':   { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', label: '미확인' },
  '처리중':   { color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20',   label: '처리중' },
  '처리완료': { color: 'text-emerald-400',bg: 'bg-emerald-500/10',border: 'border-emerald-500/20',label: '완료'   },
  DEFAULT:    { color: 'text-slate-400',  bg: 'bg-slate-500/10',  border: 'border-slate-500/20',  label: '미확인' },
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
      const res = await fetch(`${API_BASE}/sms/recent?limit=20`, { 
        headers: getAuthHeaders() 
      });
      if (!res.ok) throw new Error('데이터 로드 실패');
      const data = await res.json();
      const list = data.messages || data.items || [];

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
    
    // Check push status
    PushManager.getStatus().then(setPushStatus);

    return () => clearInterval(interval);
  }, [fetchData]);

  const handlePushToggle = async () => {
    setPushLoading(true);
    if (pushStatus.enabled) {
      await PushManager.unsubscribe(API_BASE);
    } else {
      await PushManager.subscribe(API_BASE);
    }
    const newStatus = await PushManager.getStatus();
    setPushStatus(newStatus);
    setPushLoading(false);
  };




  return (
    <PullToRefresh onRefresh={() => fetchData(true)}>
      <div className="flex-1 flex flex-col bg-[#0a0e17] pb-24">

      {/* ── 헤더 ── */}
      <header className="sticky top-0 z-40 bg-[#0a0e17]/95 backdrop-blur-md border-b border-white/5 px-5 pt-4 pb-3">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-500" />
            <span className="font-black text-white text-lg tracking-tight">S-GUARD</span>
            <span className="text-[10px] font-mono text-blue-400/80 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">LIVE</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="p-2 rounded-full hover:bg-white/10 transition-colors active:scale-95"
            >
              <RefreshCw className={`w-4 h-4 text-slate-400 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
              <span className="text-xs font-bold text-blue-400">{user?.name?.[0] || 'U'}</span>
            </div>
          </div>
        </div>
        {user && (
          <p className="text-[11px] text-slate-500 truncate">
            {user.name} · {user.company || user.honbu || ''}
          </p>
        )}
      </header>

      {/* ── 알람 설정 배너 ── */}
      {pushStatus.supported && !pushStatus.enabled && (
        <div className="mx-4 mt-3 p-3 bg-blue-600/10 border border-blue-500/20 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-blue-400" />
            <span className="text-[11px] text-blue-100 font-medium">실시간 장애 알림을 활성화하세요.</span>
          </div>
          <button
            onClick={handlePushToggle}
            disabled={pushLoading}
            className="px-3 py-1 bg-blue-600 text-white text-[10px] font-bold rounded-lg active:scale-95 disabled:opacity-50"
          >
            {pushLoading ? '처리중...' : '알람 켜기'}
          </button>
        </div>
      )}

      {/* ── 통계 카드 ── */}
      <div className="grid grid-cols-2 gap-3 px-4 pt-4 pb-2">
        {[
          { label: '전체 인시던트', value: stats.total, icon: LayoutGrid, color: 'blue' },
          { label: '처리 대기',     value: stats.pending, icon: Clock,       color: 'yellow', alert: stats.pending > 0 },
          { label: '긴급 감지',     value: stats.critical, icon: AlertTriangle, color: 'red', alert: stats.critical > 0 },
          { label: '분석 완료',     value: stats.resolved, icon: CheckCircle2, color: 'emerald' },
        ].map(({ label, value, icon: Icon, color, alert }) => (
          <div
            key={label}
            className={`bg-[#131927] rounded-2xl p-4 border transition-colors ${
              alert ? `border-${color}-500/30 bg-${color}-900/10` : 'border-white/5'
            }`}
          >
            <div className={`w-8 h-8 rounded-xl bg-${color}-500/15 flex items-center justify-center mb-3`}>
              <Icon className={`w-4 h-4 text-${color}-400`} />
            </div>
            <div className={`text-2xl font-black ${alert ? `text-${color}-400` : 'text-white'} leading-none mb-1`}>
              {loading ? <Loader2 className="w-5 h-5 animate-spin opacity-50" /> : value}
            </div>
            <p className="text-[11px] text-slate-500 font-medium">{label}</p>
          </div>
        ))}
      </div>

      {/* ── 인시던트 리스트 ── */}
      <div className="px-4 pb-2">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-300 flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-400" />
            실시간 인시던트
          </h2>
          {lastUpdate && (
            <span className="text-[10px] text-slate-600 font-mono">
              {lastUpdate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-[#131927] border border-white/5 rounded-2xl p-4 animate-pulse">
                <div className="h-3 bg-white/5 rounded-full w-1/3 mb-3" />
                <div className="h-4 bg-white/5 rounded-full w-4/5 mb-2" />
                <div className="h-3 bg-white/5 rounded-full w-1/2" />
              </div>
            ))}
          </div>
        ) : incidents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-600">
            <Wifi className="w-12 h-12 mb-4 opacity-30" />
            <p className="text-sm">수신된 인시던트가 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {incidents.map((item) => {
              const s = STATUS_MAP[item.incident_status] || STATUS_MAP.DEFAULT;
              const isUrgent = item.keyword_detected === 1;
              return (
                <button
                  key={item.inc_id}
                  id={`incident-${item.inc_id}`}
                  onClick={() => navigate(`/chat/${item.inc_id}`)}
                  className={`w-full text-left bg-[#131927] border rounded-2xl p-4 transition-all active:scale-[0.98] group ${
                    isUrgent ? 'border-red-500/20 bg-red-900/5' : 'border-white/5'
                  }`}
                >
                  {/* 상단: 상태 + 시간 */}
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${s.color} ${s.bg} ${s.border}`}>
                      {s.label}
                    </span>
                    <span className="text-[10px] text-slate-600 font-mono">
                      {item.timestamp
                        ? new Date(item.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
                        : ''}
                    </span>
                  </div>

                  {/* 메시지 */}
                  <p className="text-sm text-slate-200 font-medium leading-snug line-clamp-2 mb-2">
                    {item.message}
                  </p>

                  {/* 하단: 메타 + 화살표 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      {item.service_name && (
                        <span className="text-[10px] text-blue-400/80 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/10">
                          {item.service_name}
                        </span>
                      )}
                      {item.error_code && (
                        <span className="text-[10px] text-orange-400/80 bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/10 font-mono">
                          {item.error_code}
                        </span>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 shrink-0 transition-colors" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
      </div>
    </PullToRefresh>
  );
}
