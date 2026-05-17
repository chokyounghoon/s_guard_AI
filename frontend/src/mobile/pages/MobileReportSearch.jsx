import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Search, Calendar, User, Briefcase,
  Filter, FileText, ChevronRight, Activity, X,
  ChevronDown, AlertTriangle, CheckCircle2, Clock,
  ShieldAlert, Zap
} from 'lucide-react';
import { getAuthHeaders } from '../../lib/authStore';
import { SMS_WORKER_URL as API_BASE } from '../../config/api';

function flattenTree(nodes, depth = 0, result = []) {
  for (const node of nodes) {
    result.push({ ...node, depth });
    if (node.children?.length) flattenTree(node.children, depth + 1, result);
  }
  return result;
}

/* ── Org Picker ──────────────────────────────────────────────── */
function OrgPickerModal({ onSelect, onClose }) {
  const [orgs, setOrgs] = useState([]);
  const [q, setQ] = useState('');
  const [loadingOrgs, setLoadingOrgs] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/org/tree`, { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(tree => setOrgs(flattenTree(Array.isArray(tree) ? tree : [])))
      .catch(() => {})
      .finally(() => setLoadingOrgs(false));
  }, []);

  const filtered = q ? orgs.filter(o => o.name?.includes(q)) : orgs;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
      <div className="mt-auto rounded-t-3xl border-t border-white/10 flex flex-col max-h-[72vh]"
        style={{ background: 'linear-gradient(180deg, #0d1117 0%, #080c14 100%)' }}>
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>
        <div className="flex items-center justify-between px-4 pb-3 pt-1 border-b border-white/8">
          <p className="text-sm font-black text-white tracking-tight">조직 선택</p>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
        <div className="px-4 py-2.5 border-b border-white/5">
          <div className="flex items-center bg-black/50 border border-white/10 rounded-xl px-3 focus-within:border-emerald-500/40 transition-colors">
            <Search className="w-3.5 h-3.5 text-emerald-400/60 mr-2 shrink-0" />
            <input
              autoFocus type="text" placeholder="조직명 검색..."
              value={q} onChange={e => setQ(e.target.value)}
              className="w-full bg-transparent py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none"
            />
          </div>
        </div>
        <div className="overflow-y-auto flex-1 px-2 py-2">
          {loadingOrgs ? (
            <div className="py-10 flex justify-center">
              <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-xs text-slate-500 py-10">검색 결과 없음</p>
          ) : filtered.map(org => (
            <button
              key={org.id || org.code}
              onClick={() => { onSelect(org.name, org.code); onClose(); }}
              className="w-full text-left flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-white/5 active:bg-white/10 transition-colors"
            >
              <span className="text-slate-700 text-[10px] w-4 shrink-0">{'└'.repeat(org.depth)}</span>
              <span className={`text-xs font-bold ${
                org.depth === 0 ? 'text-emerald-400' :
                org.depth === 1 ? 'text-sky-400' :
                org.depth === 2 ? 'text-violet-400' : 'text-slate-300'
              }`}>{org.name}</span>
              {org.code && <span className="ml-auto text-[9px] text-slate-600 font-mono shrink-0">{org.code}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status, severity }) {
  const isComplete = status === 'Completed' || status === '처리완료' || status === 'CLOSED';
  const sev = (severity || 'INFO').toUpperCase();
  const sevColor = sev === 'CRITICAL' ? '#ff2a2a' : sev === 'MAJOR' || sev === 'WARNING' ? '#ffb700' : '#00e5ff';
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-black px-2 py-0.5 rounded border" style={{ color: sevColor, borderColor: `${sevColor}50`, background: `${sevColor}15` }}>
        {sev}
      </span>
      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${isComplete ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-blue-500/10 border-blue-500/30 text-blue-400'}`}>
        {status || '완료'}
      </span>
    </div>
  );
}

/* ── Report Card (1-column list item) ────────────────────────── */
function ReportCard({ report, onClick }) {
  const sev = (report.severity || 'INFO').toUpperCase();
  const sevColor = sev === 'CRITICAL' ? '#ff2a2a' : sev === 'MAJOR' || sev === 'WARNING' ? '#ffb700' : '#00e5ff';
  const date = report.created_at ? new Date(report.created_at).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div
      onClick={onClick}
      className="skeuo-card p-4 bg-[#12151a] hover:bg-[#1a1f26] border border-white/10 rounded-2xl transition-all duration-300 flex flex-col gap-2.5 relative overflow-hidden group active:scale-[0.98] shadow-xl cursor-pointer"
    >
      <div className="absolute top-0 left-0 bottom-0 w-1.5" style={{ background: sevColor, boxShadow: `0 0 10px ${sevColor}` }} />
      
      <div className="flex items-center justify-between pl-2">
        <StatusBadge status={report.status} severity={report.severity} />
        <span className="text-[10px] font-mono text-slate-400">{date}</span>
      </div>

      <div className="pl-2 pr-1">
        <h3 className="text-sm font-black text-white leading-snug break-words line-clamp-3">
          {report.title || 'Untitled Incident'}
        </h3>
        {report.report_title && (
          <p className="text-xs font-bold text-emerald-400 mt-1.5 flex items-center gap-1.5 truncate bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
            <FileText size={12} className="shrink-0 text-emerald-400" />
            {report.report_title}
          </p>
        )}
        {report.raw_message && !report.report_title && (
          <p className="text-xs text-slate-300 font-normal mt-1.5 line-clamp-2 leading-relaxed">
            {report.raw_message}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between pt-2.5 border-t border-white/5 pl-2 mt-1">
        <span className="text-[10px] text-slate-500 font-mono tracking-tighter truncate max-w-[220px]">
          ID: {report.code || report.inc_id}
        </span>
        <div className="flex items-center gap-0.5 text-[11px] font-bold text-[#00e5ff] group-hover:translate-x-1 transition-transform shrink-0">
          <span>상세 보기</span>
          <ChevronRight size={14} />
        </div>
      </div>
    </div>
  );
}

/* ── Skeleton ─────────────────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div className="skeuo-card p-4 bg-[#12151a] border border-white/5 rounded-2xl flex flex-col gap-3 h-28 animate-pulse">
      <div className="flex justify-between items-center pl-2">
        <div className="w-20 h-4 bg-white/10 rounded" />
        <div className="w-16 h-3 bg-white/5 rounded" />
      </div>
      <div className="pl-2 space-y-2 mt-1">
        <div className="w-5/6 h-4 bg-white/10 rounded" />
        <div className="w-2/3 h-4 bg-white/10 rounded" />
      </div>
    </div>
  );
}

/* ── Main ─────────────────────────────────────────────────────── */
export default function MobileReportSearch() {
  const navigate = useNavigate();
  const location = useLocation();

  const getLocalDate = (date) => {
    const offset = date.getTimezoneOffset() * 60000;
    const localDate = new Date(date.getTime() - offset);
    return localDate.toISOString().split('T')[0];
  };
  const today        = () => getLocalDate(new Date());
  const oneYearAgo   = () => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return getLocalDate(d); };

  const [keyword,   setKeyword]   = useState(location.state?.keyword || '');
  const [startDate, setStartDate] = useState(oneYearAgo());
  const [endDate,   setEndDate]   = useState(today());
  const [orgName,   setOrgName]   = useState('');
  const [orgCode,   setOrgCode]   = useState('');
  const [assignee,  setAssignee]  = useState('');
  const [showOrg,   setShowOrg]   = useState(false);
  const [showFilterSheet, setShowFilterSheet] = useState(false);

  const [reports,  setReports]  = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = useCallback(async () => {
    setLoading(true); setSearched(true);
    try {
      const p = new URLSearchParams();
      if (keyword.trim()) p.append('keyword', keyword.trim());
      if (startDate) p.append('startDate', startDate);
      if (endDate)   p.append('endDate', endDate);
      if (orgCode)   p.append('orgCode', orgCode);
      if (orgName.trim() && !orgCode) p.append('orgName', orgName.trim());
      if (assignee.trim()) p.append('assignee', assignee.trim());
      p.append('limit', '100');

      const res  = await fetch(`${API_BASE}/incidents?${p.toString()}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.incidents || []);
      const filtered = list.filter(r => {
        const st = String(r.status || '').toUpperCase();
        const isResolved = st.includes('완료') || st.includes('COMPLETED') || st === 'INC_003' || st === 'CLOSED' || st === '정상' || st === 'GOVERNED';
        return r.has_report === 1 || isResolved || Boolean(r.report_title);
      });
      setReports(filtered);
    } catch (err) {
      console.error('[MobileReportSearch]', err);
    } finally {
      setLoading(false);
    }
  }, [keyword, startDate, endDate, orgCode, orgName, assignee]);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch();
    }, 250);
    return () => clearTimeout(timer);
  }, [keyword, startDate, endDate, orgCode, orgName, assignee, handleSearch]);

  const clearOrg = () => { setOrgName(''); setOrgCode(''); };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[#0a0e17] text-white font-sans select-none overflow-y-auto">
      {/* ── Sticky Header (Slim 1-line + Quick Search) ───────────── */}
      <div className="sticky top-0 z-50 bg-[#0d1117]/90 backdrop-blur-md border-b border-white/10 px-4 py-3 flex flex-col gap-2.5">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-colors">
            <ArrowLeft size={16} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-black text-white flex items-center gap-1.5">
              <FileText size={16} className="text-[#00e5ff]" />
              보고서 통합 검색
            </h1>
            <p className="text-[10px] text-slate-400 truncate flex items-center gap-1.5 font-mono mt-0.5">
              <span className="text-emerald-400 font-bold">[{orgName || '전체 부서'}]</span>
              <span>{startDate.substring(2).replace(/-/g, '.')} ~ {endDate.substring(2).replace(/-/g, '.')}</span>
            </p>
          </div>
          <button
            onClick={() => setShowFilterSheet(true)}
            className="skeuo-btn flex items-center gap-1.5 px-3 py-2 bg-[#00e5ff]/15 border border-[#00e5ff]/40 rounded-xl text-xs font-black text-[#00e5ff] shadow-[0_0_12px_rgba(0,229,255,0.2)] active:scale-95 transition-all cursor-pointer"
          >
            <Filter size={14} />
            <span>상세 필터</span>
            {(orgName || assignee || keyword) && <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-ping" />}
          </button>
        </div>

        {/* 빠른 검색 바 */}
        <div className="flex items-center bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 focus-within:border-[#00e5ff]/50 transition-colors">
          <Search size={14} className="text-slate-400 mr-2 shrink-0" />
          <input
            type="text" placeholder="제목 · ID · 발신자 키워드 검색"
            value={keyword} onChange={e => setKeyword(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSearch();
              }
            }}
            className="w-full bg-transparent py-1 text-xs text-white placeholder-slate-500 focus:outline-none"
          />
          {keyword && (
            <button onClick={() => { setKeyword(''); setTimeout(() => handleSearch(), 0); }} className="p-1 hover:opacity-80">
              <X size={12} className="text-slate-400" />
            </button>
          )}
        </div>
      </div>


      {/* ── Results Container (1-Column List View) ─────────────── */}
      <div className="px-4 py-4 flex flex-col gap-3.5 pb-28">
        {searched && !loading && (
          <div className="flex items-center justify-between px-1 mb-1">
            <span className="text-xs font-bold text-slate-400">
              검색 결과 <strong className="text-[#00e5ff]">{reports.length}</strong>건
            </span>
            <span className="text-[10px] text-slate-400 bg-white/5 px-2.5 py-1 rounded-full border border-white/10 font-mono">
              최신순 정렬
            </span>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col gap-3">
            {[1,2,3,4,5].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : reports.length > 0 ? (
          <div className="flex flex-col gap-3.5">
            {reports.map(r => (
              <ReportCard
                key={r.code || r.inc_id}
                report={r}
                onClick={() => navigate(`/report/${(r.code || r.inc_id || '')}`)}
              />
            ))}
          </div>
        ) : searched ? (
          <div className="flex flex-col items-center justify-center p-12 bg-white/5 border border-white/10 rounded-2xl text-center my-8">
            <FileText size={36} className="text-slate-600 mb-3" />
            <p className="text-sm font-black text-slate-300 mb-1">검색 결과가 없습니다</p>
            <p className="text-xs text-slate-500">상단 필터 버튼을 눌러 조건을 변경해 보세요</p>
          </div>
        ) : null}
      </div>

      {/* ── Bottom Sheet Modal (상세 검색 필터) ────────────────── */}
      {showFilterSheet && (
        <div className="fixed inset-0 z-[150] flex flex-col justify-end bg-black/75 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setShowFilterSheet(false)}>
          <div className="bg-[#12151a] border-t border-white/10 rounded-t-3xl p-6 shadow-2xl flex flex-col gap-4 animate-in slide-in-from-bottom duration-300 max-h-[85vh] overflow-y-auto select-none" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-1" />
            
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <Filter size={18} className="text-[#00e5ff]" />상세 검색 필터
              </h2>
              <button onClick={() => setShowFilterSheet(false)} className="p-1.5 rounded-full bg-white/5 text-slate-400 hover:text-white transition-colors cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-col gap-4 text-left">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-400 flex items-center gap-1.5 ml-1">
                  <Briefcase size={14} className="text-indigo-400" />조직 선택
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text" placeholder="조직명 직접 입력"
                    value={orgName} onChange={e => { setOrgName(e.target.value); setOrgCode(''); }}
                    className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#00e5ff]/50"
                  />
                  {orgName ? (
                    <button onClick={clearOrg} className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-slate-400 hover:text-white">
                      <X size={14} />
                    </button>
                  ) : (
                    <button onClick={() => setShowOrg(true)} className="px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-slate-300 flex items-center gap-1 hover:bg-white/10 cursor-pointer">
                      <ChevronDown size={14} />조직도
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-400 flex items-center gap-1.5 ml-1">
                  <User size={14} className="text-purple-400" />담당자 및 사번
                </label>
                <input
                  type="text" placeholder="담당자 이름 또는 사번"
                  value={assignee} onChange={e => setAssignee(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#00e5ff]/50"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-400 flex items-center gap-1.5 ml-1">
                  <Calendar size={14} className="text-emerald-400" />조회 기간 (시작일 ~ 종료일)
                </label>
                <div className="flex items-center gap-2">
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white" style={{ colorScheme: 'dark' }} />
                  <span className="text-slate-500 font-bold">~</span>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white" style={{ colorScheme: 'dark' }} />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-4 border-t border-white/10 mt-2">
              <button onClick={() => { setKeyword(''); setOrgName(''); setOrgCode(''); setAssignee(''); }} className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-slate-400 hover:text-white cursor-pointer">
                초기화
              </button>
              <button onClick={() => { handleSearch(); setShowFilterSheet(false); }} className="flex-1 py-3.5 bg-gradient-to-r from-[#00e5ff] to-[#00ff88] text-black font-black text-sm rounded-xl shadow-[0_0_20px_rgba(0,229,255,0.4)] flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer">
                <Search size={16} />적용 및 조회하기
              </button>
            </div>
          </div>
        </div>
      )}

      {showOrg && (
        <OrgPickerModal
          onSelect={(name, code) => { setOrgName(name); setOrgCode(code); }}
          onClose={() => setShowOrg(false)}
        />
      )}


      <style>{`
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.4); opacity:0.5; }
      `}</style>
    </div>
  );
}
