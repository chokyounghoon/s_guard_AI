import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brain, ArrowLeft, Database, FileText, Clock, RefreshCw, Search, ChevronDown, ChevronUp, Zap, Book, Server } from 'lucide-react';

const API_BASE_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:8000'
  : 'https://api.chokerslab.store';

const SOURCE_LABEL = {
  war_room_chat: { label: 'War-Room 대화 학습', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30', icon: '💬' },
  auto_generated_report: { label: 'AI 자동 보고서', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30', icon: '🤖' },
  kaggle_itsm: { label: 'Kaggle ITSM 데이터', color: 'bg-green-500/20 text-green-300 border-green-500/30', icon: '📊' },
  synthetic_data: { label: '합성 학습 데이터', color: 'bg-orange-500/20 text-orange-300 border-orange-500/30', icon: '🔬' },
};

function SourceBadge({ source }) {
  const cfg = SOURCE_LABEL[source] || { label: source || '기타', color: 'bg-slate-500/20 text-slate-300 border-slate-500/30', icon: '📁' };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${cfg.color}`}>
      <span>{cfg.icon}</span>{cfg.label}
    </span>
  );
}

function EntryCard({ entry }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="bg-[#11141d] rounded-2xl border border-white/5 hover:border-blue-500/20 transition-all">
      <div
        className="p-4 flex items-start justify-between cursor-pointer"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="bg-blue-600/10 p-2 rounded-xl shrink-0 mt-0.5">
            <FileText className="w-4 h-4 text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <SourceBadge source={entry.source} />
              {entry.incident_id && (
                <span className="text-[10px] font-mono text-slate-500">#{entry.incident_id}</span>
              )}
            </div>
            <p className="text-sm text-slate-200 font-medium leading-snug line-clamp-2">{entry.title}</p>
            {entry.ingested_at && (
              <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3" /> {entry.ingested_at}
              </p>
            )}
          </div>
        </div>
        <div className="shrink-0 ml-3 mt-1">
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </div>
      </div>
      {expanded && (
        <div className="px-4 pb-4 border-t border-white/5 pt-3">
          <pre className="text-xs text-slate-300 bg-[#0a0c10] rounded-xl p-4 overflow-x-auto leading-relaxed whitespace-pre-wrap font-mono border border-white/5">
            {entry.preview}
          </pre>
          <p className="text-[9px] text-slate-600 mt-2 font-mono">ID: {entry.inc_id}</p>
        </div>
      )}
    </div>
  );
}

export default function KnowledgeBasePage() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filterSource, setFilterSource] = useState('all');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE_URL}/knowledge/list?limit=100`);
        if (!res.ok) throw new Error(`API Error ${res.status}`);
        const data = await res.json();
        setEntries(data.entries || []);
        setTotal(data.total || 0);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [refreshKey]);

  const sources = ['all', ...new Set(entries.map(e => e.source).filter(Boolean))];

  const filtered = entries.filter(e => {
    const matchSearch = !search || e.title?.toLowerCase().includes(search.toLowerCase()) || e.preview?.toLowerCase().includes(search.toLowerCase());
    const matchSource = filterSource === 'all' || e.source === filterSource;
    return matchSearch && matchSource;
  });

  const stats = {
    total,
    warRoom: entries.filter(e => e.source === 'war_room_chat').length,
    reports: entries.filter(e => e.source === 'auto_generated_report').length,
    other: entries.filter(e => !['war_room_chat', 'auto_generated_report'].includes(e.source)).length,
  };

  return (
    <div className="min-h-screen bg-[#0f1421] text-white font-sans">
      {/* 헤더 */}
      <nav className="flex items-center justify-between p-4 border-b border-white/10 sticky top-0 bg-[#0f1421]/90 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl hover:bg-white/5 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          <div className="bg-blue-600/20 p-2 rounded-xl border border-blue-500/30">
            <Brain className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="font-bold text-white">RAG Knowledge Base</h1>
            <p className="text-[10px] text-slate-500 font-mono uppercase">AI 학습 내역 조회</p>
          </div>
        </div>
        <button
          onClick={() => setRefreshKey(k => k + 1)}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-xs font-medium text-slate-300 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          새로고침
        </button>
      </nav>

      <div className="max-w-3xl mx-auto p-4 pb-24 space-y-5">

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: '총 학습 건', value: stats.total, icon: Database, color: 'text-blue-400', bg: 'bg-blue-500/10' },
            { label: 'War-Room', value: stats.warRoom, icon: Zap, color: 'text-purple-400', bg: 'bg-purple-500/10' },
            { label: 'AI 보고서', value: stats.reports, icon: Book, color: 'text-green-400', bg: 'bg-green-500/10' },
            { label: '기타 데이터', value: stats.other, icon: Server, color: 'text-orange-400', bg: 'bg-orange-500/10' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="bg-[#1a1f2e] rounded-2xl p-4 border border-white/5">
              <div className={`${bg} p-2 rounded-xl w-fit mb-2`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* 검색 + 필터 */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="제목 또는 내용으로 검색..."
              className="w-full bg-[#1a1f2e] border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
            />
          </div>
          <select
            value={filterSource}
            onChange={e => setFilterSource(e.target.value)}
            className="bg-[#1a1f2e] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-blue-500/50"
          >
            {sources.map(s => (
              <option key={s} value={s}>{s === 'all' ? '전체 소스' : (SOURCE_LABEL[s]?.label || s)}</option>
            ))}
          </select>
        </div>

        {/* 결과 */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-[#1a1f2e] rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-center">
            <p className="text-red-400 font-bold mb-1">API 연결 오류</p>
            <p className="text-red-300/60 text-sm">{error}</p>
            <p className="text-slate-500 text-xs mt-2">백엔드 서버가 실행 중인지 확인해주세요.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-[#1a1f2e] rounded-2xl p-10 text-center border border-white/5">
            <Brain className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 font-bold">학습된 데이터가 없습니다</p>
            <p className="text-slate-500 text-sm mt-1">War-Room에서 장애를 해결(Resolve)하면 이곳에 기록됩니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-slate-500 font-mono">{filtered.length}개 항목 표시</p>
            {filtered.map(entry => <EntryCard key={entry.inc_id} entry={entry} />)}
          </div>
        )}
      </div>
    </div>
  );
}
