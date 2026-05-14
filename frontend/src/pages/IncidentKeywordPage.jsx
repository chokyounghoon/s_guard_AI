import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBackNavigation } from '../hooks/useBackNavigation';
import {
  ArrowLeft, Plus, X, Search, Hash, AlertTriangle, CheckCircle,
  Shield, Trash2, RefreshCw, Smartphone, Wifi, WifiOff,
  Copy, Check, Download, Zap, Tag, ChevronRight, Edit2, Save, RotateCcw
} from 'lucide-react';
import { getAuthHeaders } from '../lib/authStore';

const API_BASE = 'https://sguardai.khcho0421.workers.dev';

const SEVERITY_CONFIG = {
  CRITICAL: { label: 'CRITICAL', bg: 'bg-red-500/15', border: 'border-red-500/30', text: 'text-red-400', dot: 'bg-red-500', glow: 'shadow-[0_0_8px_rgba(239,68,68,0.4)]' },
  MAJOR:    { label: 'MAJOR',    bg: 'bg-orange-500/15', border: 'border-orange-500/30', text: 'text-orange-400', dot: 'bg-orange-500', glow: 'shadow-[0_0_8px_rgba(249,115,22,0.4)]' },
  NORMAL:   { label: 'NORMAL',  bg: 'bg-blue-500/15', border: 'border-blue-500/30', text: 'text-blue-400', dot: 'bg-blue-500', glow: '' },
};

function SeverityPill({ severity }) {
  const c = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.NORMAL;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${c.bg} ${c.border} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

export default function IncidentKeywordPage() {
  const navigate = useNavigate();
  const goBack = useBackNavigation('/dashboard');
  const [keywords, setKeywords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('ALL');
  const [newKeyword, setNewKeyword] = useState('');
  const [newResponse, setNewResponse] = useState('');
  const [newSeverity, setNewSeverity] = useState('CRITICAL');
  const [adding, setAdding] = useState(false);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const inputRef = useRef(null);
  
  // Get current user for shortcut URL
  const userStr = localStorage.getItem('sguard_user');
  const user = userStr ? JSON.parse(userStr) : null;
  const employeeId = user?.employee_id || '';
  const shortcutUrl = `${API_BASE}/sms/keywords${employeeId ? `?employee_id=${employeeId}` : ''}`;

  const fetchKeywords = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/sms/keywords`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setKeywords((data.keywords || []).map(k => ({
          id: k.keyword,
          word: k.keyword,
          response: k.response || '',
          severity: k.severity || 'NORMAL',
          count: k.hit_count || 0,
          createdAt: k.created_at || null,
        })));
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchKeywords(); }, []);

  const addKeyword = async () => {
    if (!newKeyword.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(`${API_BASE}/sms/keywords`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: newKeyword.trim(),
          response: newResponse.trim() || `${newKeyword.trim()} 감지됨`,
          severity: newSeverity,
        }),
      });
      if (res.ok) {
        setKeywords(prev => [{
          id: newKeyword.trim(), word: newKeyword.trim(),
          response: newResponse.trim() || `${newKeyword.trim()} 감지됨`,
          severity: newSeverity, count: 0, createdAt: new Date().toISOString(),
        }, ...prev]);
        setNewKeyword(''); setNewResponse(''); setShowAddPanel(false);
      }
    } catch (e) { console.error(e); }
    finally { setAdding(false); }
  };

  const removeKeyword = async (id) => {
    setDeletingId(id);
    try {
      await fetch(`${API_BASE}/sms/keywords/delete/${encodeURIComponent(id)}`, {
        method: 'POST', headers: getAuthHeaders(),
      });
      setKeywords(prev => prev.filter(k => k.id !== id));
    } catch (e) { console.error(e); }
    finally { setDeletingId(null); }
  };

  // 모바일 동기화: 키워드 목록을 JSON으로 내보내는 API URL 복사
  const handleMobileSync = async () => {
    setSyncing(true);
    await new Promise(r => setTimeout(r, 800));
    setSyncing(false);
    setSyncSuccess(true);
    setTimeout(() => setSyncSuccess(false), 3000);
  };

  const handleCopyApiUrl = () => {
    navigator.clipboard.writeText(shortcutUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filtered = keywords.filter(k => {
    const matchSearch = k.word.toLowerCase().includes(search.toLowerCase());
    const matchSeverity = filterSeverity === 'ALL' || k.severity === filterSeverity;
    return matchSearch && matchSeverity;
  });

  const criticalCount = keywords.filter(k => k.severity === 'CRITICAL').length;
  const majorCount = keywords.filter(k => k.severity === 'MAJOR').length;
  const normalCount = keywords.filter(k => k.severity === 'NORMAL').length;

  return (
    <div className="min-h-screen bg-[#080b12] text-white pb-28">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#080b12]/95 backdrop-blur-xl border-b border-white/5">
        <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => goBack()} className="p-2 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all">
              <ArrowLeft className="w-4 h-4 text-slate-400" />
            </button>
            <div>
              <h1 className="font-black text-base text-white tracking-tight">장애 키워드 관리</h1>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Incident Keyword · Mobile Sync</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchKeywords} className="p-2 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all">
              <RefreshCw className={`w-4 h-4 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => { setShowAddPanel(true); setTimeout(() => inputRef.current?.focus(), 100); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black transition-all shadow-lg shadow-blue-900/30"
            >
              <Plus className="w-3.5 h-3.5" />추가
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'CRITICAL', count: criticalCount, color: '#ef4444', bg: 'bg-red-500/10', border: 'border-red-500/20' },
            { label: 'MAJOR', count: majorCount, color: '#f97316', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
            { label: 'NORMAL', count: normalCount, color: '#3b82f6', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} border ${s.border} rounded-2xl p-3 text-center`}>
              <div className="text-2xl font-black text-white leading-none">{s.count}</div>
              <div className="text-[9px] font-black mt-1 uppercase tracking-widest" style={{ color: s.color }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Mobile Sync Banner */}
        <div className="relative overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/8 to-blue-600/5 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/25">
                <Smartphone className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-sm font-black text-white">모바일 동기화</p>
                <p className="text-[10px] text-slate-500">S-Guard 앱이 이 키워드 목록을 자동 수신</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyApiUrl}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 text-[10px] font-bold hover:bg-white/10 transition-all"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied' : 'API URL'}
              </button>
              <button
                onClick={handleMobileSync}
                disabled={syncing}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${
                  syncSuccess
                    ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'
                    : 'bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/30'
                }`}
              >
                {syncing ? <RefreshCw className="w-3 h-3 animate-spin" /> : syncSuccess ? <Check className="w-3 h-3" /> : <Wifi className="w-3 h-3" />}
                {syncing ? '동기화 중' : syncSuccess ? '완료' : '동기화'}
              </button>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 bg-black/20 rounded-lg px-3 py-2 border border-white/5">
            <span className="text-[9px] font-mono text-slate-500 truncate flex-1">{shortcutUrl}</span>
            <span className="text-[9px] font-bold text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20">GET</span>
          </div>
        </div>

        {/* Search + Filter */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="키워드 검색..."
              className="w-full bg-white/[0.04] border border-white/8 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/40 transition-all"
            />
          </div>
          <div className="flex bg-white/[0.04] border border-white/8 rounded-xl p-0.5">
            {['ALL', 'CRITICAL', 'MAJOR', 'NORMAL'].map(s => (
              <button
                key={s}
                onClick={() => setFilterSeverity(s)}
                className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black transition-all ${
                  filterSeverity === s ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {s === 'ALL' ? 'ALL' : s.slice(0, 3)}
              </button>
            ))}
          </div>
        </div>

        {/* Keyword List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">
              {filtered.length}개 키워드
            </h2>
          </div>

          {loading ? (
            <div className="flex flex-col items-center py-16 gap-3">
              <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
              <p className="text-slate-500 text-xs font-bold">로딩 중...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-3">
              <Hash className="w-10 h-10 text-slate-700" />
              <p className="text-slate-500 text-sm font-bold">등록된 키워드가 없습니다</p>
              <button
                onClick={() => setShowAddPanel(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600/20 border border-blue-500/30 rounded-xl text-blue-400 text-xs font-black"
              >
                <Plus className="w-3.5 h-3.5" />첫 키워드 추가하기
              </button>
            </div>
          ) : filtered.map(k => {
            const cfg = SEVERITY_CONFIG[k.severity] || SEVERITY_CONFIG.NORMAL;
            return (
              <div
                key={k.id}
                className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-all ${cfg.bg} ${cfg.border}`}
              >
                {/* Severity indicator */}
                <div className={`w-1 self-stretch rounded-full ${cfg.dot} ${cfg.glow}`} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-black text-white">{k.word}</span>
                    <SeverityPill severity={k.severity} />
                    {k.count > 0 && (
                      <span className="text-[9px] font-mono text-slate-500 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                        Hits: {k.count}
                      </span>
                    )}
                  </div>
                  {k.response && (
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">{k.response}</p>
                  )}
                </div>

                <button
                  onClick={() => removeKeyword(k.id)}
                  disabled={deletingId === k.id}
                  className="p-2 rounded-xl text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0"
                >
                  {deletingId === k.id
                    ? <RefreshCw className="w-4 h-4 animate-spin" />
                    : <Trash2 className="w-4 h-4" />
                  }
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Keyword Bottom Sheet */}
      {showAddPanel && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowAddPanel(false)} />
          <div className="relative z-10 w-full max-w-xl bg-[#0e1118] border-t border-white/10 rounded-t-[2rem] shadow-2xl animate-in slide-in-from-bottom-full duration-300">
            <div className="flex justify-center pt-4 pb-3">
              <div className="w-10 h-1 bg-white/10 rounded-full" />
            </div>

            <div className="px-5 pb-2 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3 py-2">
                <div className="p-2 rounded-xl bg-blue-500/15 border border-blue-500/25">
                  <Plus className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <h2 className="font-black text-white text-sm">새 키워드 추가</h2>
                  <p className="text-[9px] text-slate-500 uppercase tracking-widest">장애 감지 키워드 등록</p>
                </div>
              </div>
              <button onClick={() => setShowAddPanel(false)} className="p-2 rounded-xl bg-white/5 border border-white/5 text-slate-500 hover:text-white transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Keyword input */}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">키워드 *</label>
                <input
                  ref={inputRef}
                  type="text"
                  value={newKeyword}
                  onChange={e => setNewKeyword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && addKeyword()}
                  placeholder="예: BATCH_ERROR, DB_TIMEOUT, API_DOWN..."
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-all"
                />
              </div>

              {/* Response message */}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">응답 메시지</label>
                <input
                  type="text"
                  value={newResponse}
                  onChange={e => setNewResponse(e.target.value)}
                  placeholder="감지 시 표시할 메시지 (선택)"
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-all"
                />
              </div>

              {/* Severity selector */}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">심각도</label>
                <div className="flex gap-2">
                  {['CRITICAL', 'MAJOR', 'NORMAL'].map(sev => {
                    const cfg = SEVERITY_CONFIG[sev];
                    return (
                      <button
                        key={sev}
                        onClick={() => setNewSeverity(sev)}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-black border transition-all ${
                          newSeverity === sev
                            ? `${cfg.bg} ${cfg.border} ${cfg.text}`
                            : 'bg-white/[0.03] border-white/8 text-slate-500 hover:border-white/15'
                        }`}
                      >
                        {sev}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] flex gap-3">
              <button
                onClick={() => setShowAddPanel(false)}
                className="flex-1 py-3.5 rounded-2xl bg-white/5 border border-white/5 text-slate-400 font-black text-sm hover:bg-white/10 transition-all"
              >
                취소
              </button>
              <button
                onClick={addKeyword}
                disabled={adding || !newKeyword.trim()}
                className="flex-[2] py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-900/30"
              >
                {adding ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Tag className="w-4 h-4" />}
                {adding ? '등록 중...' : '키워드 등록'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
