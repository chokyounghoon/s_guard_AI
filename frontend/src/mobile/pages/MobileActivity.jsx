import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, ChevronLeft, RefreshCw, CheckCircle2,
  ChevronRight, Loader2, Search, CalendarDays, Bot
} from 'lucide-react';
import { getAccessToken } from '../../lib/authStore';
import PullToRefresh from '../components/PullToRefresh';

const API_BASE = 'https://sguardai.khcho0421.workers.dev';

const formatTime = (ts) => {
  if (!ts) return '';
  const d = new Date(ts.replace ? ts.replace(' ', 'T') : ts);
  return isNaN(d) ? '' : d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
};

const formatDate = (ts) => {
  if (!ts) return '';
  const d = new Date(ts.replace ? ts.replace(' ', 'T') : ts);
  if (isNaN(d)) return '';
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  let label = d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
  if (d.toDateString() === today.toDateString()) label = `오늘 · ${label}`;
  else if (d.toDateString() === yesterday.toDateString()) label = `어제 · ${label}`;
  return label;
};

export default function MobileActivity({ user, onAiClick }) {
  const navigate = useNavigate();
  const [rawLogs, setRawLogs] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchLogs = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/activity-logs?limit=50`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('로드 실패');
      const data = await res.json();
      const logs = data.logs || [];
      setRawLogs(logs);
      buildSections(logs);
    } catch (e) {
      console.error('[MobileActivity]', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const buildSections = (logs) => {
    const grouped = {};
    logs.forEach(log => {
      const label = formatDate(log.created_at) || '날짜 미상';
      if (!grouped[label]) grouped[label] = [];
      grouped[label].push({
        id: log.id || log.inc_id || Math.random().toString(36),
        time: formatTime(log.created_at),
        title: log.incident_title || log.action || '장애 처리',
        action: log.action || '완료',
        team: log.user_name || log.team || '시스템',
        type: log.report_type || 'AI 리포트',
        incId: log.inc_id,
      });
    });
    setSections(Object.entries(grouped).map(([date, items]) => ({ date, items })));
  };

  useEffect(() => { fetchLogs(); }, []);

  // 검색 필터
  useEffect(() => {
    if (!searchQuery) { buildSections(rawLogs); return; }
    const q = searchQuery.toLowerCase();
    const filtered = rawLogs.filter(log =>
      (log.incident_title || '').toLowerCase().includes(q) ||
      (log.action || '').toLowerCase().includes(q) ||
      (log.user_name || '').toLowerCase().includes(q)
    );
    buildSections(filtered);
  }, [searchQuery, rawLogs]);

  return (
    <PullToRefresh onRefresh={() => fetchLogs(true)}>
      <div className="flex flex-col bg-[#0a0e17] pb-24 min-h-full">

      {/* 헤더 */}
      <header className="sticky top-0 z-40 bg-[#0a0e17]/95 backdrop-blur-md border-b border-white/5 px-4 pt-4 pb-3">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-white/10 transition-colors active:scale-90">
            <ChevronLeft className="w-5 h-5 text-slate-300" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-400" />
              <h1 className="font-black text-white text-lg">장애 처리 현황</h1>
            </div>
            <p className="text-[11px] text-slate-500">최근 50건 처리 내역</p>
          </div>
          {onAiClick && (
            <button onClick={onAiClick} className="p-2 rounded-full hover:bg-white/10 transition-colors">
              <Bot className="w-4 h-4 text-purple-400 drop-shadow-[0_0_6px_rgba(168,85,247,0.4)]" />
            </button>
          )}
          <button onClick={() => fetchLogs(true)} disabled={refreshing}
            className="p-2 rounded-full hover:bg-white/10 transition-colors">
            <RefreshCw className={`w-4 h-4 text-slate-400 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* 검색 */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input type="text" value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="장애명, 담당자로 검색..."
            className="w-full bg-[#131927] border border-white/10 rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/30 transition-all" />
        </div>
      </header>

      {/* 리스트 */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500/30 mb-4" />
          <p className="text-sm text-slate-600">처리 내역 로드 중...</p>
        </div>
      ) : sections.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-600">
          <CalendarDays className="w-12 h-12 mb-4 opacity-30" />
          <p className="text-sm">{searchQuery ? '검색 결과가 없습니다.' : '처리 내역이 없습니다.'}</p>
        </div>
      ) : sections.map(({ date, items }) => (
        <div key={date}>
          {/* 날짜 구분 */}
          <div className="sticky top-[113px] z-30 bg-[#0d1117]/90 backdrop-blur-sm px-4 py-2 border-b border-white/5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{date}</span>
          </div>

          <div className="divide-y divide-white/5">
            {items.map((item) => (
              <button key={item.id} id={`activity-${item.id}`}
                onClick={() => {
                  if (!item.incId) return;
                  const cleanId = String(item.incId).replace('INC-', '');
                  // 타입이 AI 리포트이거나 이미 완료된 건인 경우 리포트 페이지로 이동
                  if (item.type === 'AI 리포트' || item.action === '완료') {
                    navigate(`/report/${cleanId}`);
                  } else {
                    navigate(`/chat/${cleanId}`);
                  }
                }}
                className="w-full text-left px-4 py-4 flex items-start gap-4 hover:bg-white/5 active:bg-white/10 transition-colors group">
                <div className="w-10 h-10 rounded-full bg-blue-600/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold bg-blue-600/20 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded uppercase">
                      {item.type}
                    </span>
                    <span className="text-[10px] text-slate-500">{item.time} 완료</span>
                  </div>
                  <h4 className="text-sm font-semibold text-slate-200 leading-snug line-clamp-2">{item.title}</h4>
                  <p className="text-xs text-slate-500">
                    <span className="text-blue-500 font-medium">{item.action}</span>
                    <span className="mx-2 text-slate-700">|</span>
                    <span>{item.team}</span>
                  </p>
                </div>
                {item.incId && (
                  <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 mt-3 shrink-0 transition-colors" />
                )}
              </button>
            ))}
          </div>
        </div>
      ))}
      </div>
    </PullToRefresh>
  );
}
