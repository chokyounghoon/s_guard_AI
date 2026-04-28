import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Search, Calendar, User, Briefcase, 
  Filter, FileText, ChevronRight, Activity, X, ChevronDown
} from 'lucide-react';
import { getAuthHeaders } from '../../lib/authStore';

const API_BASE = 'https://sguardai.khcho0421.workers.dev';

// 조직 트리를 평탄화해서 목록으로 만들기
function flattenTree(nodes, depth = 0, result = []) {
  for (const node of nodes) {
    result.push({ ...node, depth });
    if (node.children?.length) flattenTree(node.children, depth + 1, result);
  }
  return result;
}

// 조직 선택 팝업
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

  const filtered = q
    ? orgs.filter(o => o.name?.includes(q))
    : orgs;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col" style={{ background: 'rgba(0,0,0,0.75)' }}>
      {/* 바텀 시트 */}
      <div className="mt-auto bg-[#0f1219] rounded-t-3xl border-t border-white/10 flex flex-col max-h-[70vh]">
        {/* 핸들 */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 pb-3 pt-1 border-b border-white/10">
          <p className="text-sm font-black text-white">조직 선택</p>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
        {/* 검색 */}
        <div className="px-4 py-2.5 border-b border-white/5">
          <div className="flex items-center bg-black/50 border border-white/10 rounded-lg px-3">
            <Search className="w-3.5 h-3.5 text-slate-500 mr-2 shrink-0" />
            <input
              autoFocus
              type="text"
              placeholder="조직명 검색..."
              value={q}
              onChange={e => setQ(e.target.value)}
              className="w-full bg-transparent py-2 text-xs text-white placeholder-slate-600 focus:outline-none"
            />
          </div>
        </div>
        {/* 목록 */}
        <div className="overflow-y-auto flex-1 px-2 py-2">
          {loadingOrgs ? (
            <div className="py-8 flex justify-center">
              <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-xs text-slate-500 py-8">검색 결과 없음</p>
          ) : (
            filtered.map(org => (
              <button
                key={org.id || org.code}
                onClick={() => { onSelect(org.name, org.code); onClose(); }}
                className="w-full text-left flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-white/5 active:bg-white/10 transition-colors"
              >
                <span className="text-slate-600 text-[10px] w-4 shrink-0">
                  {'└'.repeat(org.depth)}
                </span>
                <span className={`text-xs font-bold ${org.depth === 0 ? 'text-emerald-400' : org.depth === 1 ? 'text-sky-400' : org.depth === 2 ? 'text-violet-400' : 'text-slate-300'}`}>
                  {org.name}
                </span>
                {org.code && (
                  <span className="ml-auto text-[9px] text-slate-600 font-mono shrink-0">{org.code}</span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function MobileReportSearch() {
  const navigate = useNavigate();
  
  const getTodayStr = () => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  };

  const getOneYearAgoStr = () => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().split('T')[0];
  };

  const [keyword, setKeyword] = useState('');
  const [startDate, setStartDate] = useState(getOneYearAgoStr());
  const [endDate, setEndDate] = useState(getTodayStr());
  const [orgName, setOrgName] = useState('');   // 표시용 이름
  const [orgCode, setOrgCode] = useState('');   // 실제 검색용 코드
  const [assignee, setAssignee] = useState('');
  const [showOrgPicker, setShowOrgPicker] = useState(false);

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = useCallback(async () => {
    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams();
      // keyword는 inc_id(번호) 또는 제목/설명으로 검색
      if (keyword.trim()) params.append('keyword', keyword.trim());
      if (keyword.trim() && /^\d+$/.test(keyword.trim())) params.append('inc_id', keyword.trim());
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (orgCode) params.append('orgCode', orgCode);
      if (orgName.trim() && !orgCode) params.append('orgName', orgName.trim());
      if (assignee.trim()) params.append('assignee', assignee.trim());
      params.append('limit', '50');

      const res = await fetch(`${API_BASE}/incidents?${params.toString()}`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      // /incidents 는 {incidents:[]} 또는 [] 형태 모두 처리
      const list = Array.isArray(data) ? data : (data.incidents || []);
      setReports(list);
    } catch (err) {
      console.error('[MobileReportSearch] search error:', err);
    } finally {
      setLoading(false);
    }
  }, [keyword, startDate, endDate, orgCode, assignee]);

  // 초기 로드 (전체 조회)
  useEffect(() => { handleSearch(); }, []); // eslint-disable-line

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  const clearOrg = () => { setOrgName(''); setOrgCode(''); };

  return (
    <div className="min-h-screen bg-[#06080c] text-slate-200 pb-24 font-sans">
      {/* 헤더 */}
      <header className="sticky top-0 z-50 bg-[#0f1219]/90 backdrop-blur-md border-b border-white/10 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-white/10">
          <ArrowLeft className="w-5 h-5 text-slate-300" />
        </button>
        <div>
          <h1 className="text-base font-black text-white tracking-tight flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-400" />
            AI Report Search
          </h1>
          <p className="text-[10px] text-emerald-500 font-bold tracking-widest uppercase">
            장애 보고서 통합 검색
          </p>
        </div>
      </header>

      <main className="p-4 space-y-3">

        {/* ── 검색 폼 카드 ── */}
        <div className="relative p-[1px] rounded-xl overflow-hidden shadow-lg">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 via-transparent to-teal-500/10" />
          <div className="relative bg-[#0b0e14]/95 backdrop-blur-xl p-3 rounded-xl border border-white/5 flex flex-col gap-2">

            {/* 키워드 */}
            <div className="flex items-center bg-black/50 border border-white/10 rounded-lg overflow-hidden focus-within:border-emerald-500/40 transition-colors">
              <div className="pl-3 pr-2 py-[9px]">
                <Search className="w-3.5 h-3.5 text-emerald-400/60" />
              </div>
              <input
                type="text"
                placeholder="제목·ID 키워드 검색"
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full bg-transparent py-[9px] pr-3 text-xs text-white placeholder-slate-600 focus:outline-none"
              />
              {keyword && (
                <button onClick={() => setKeyword('')} className="pr-2.5">
                  <X className="w-3.5 h-3.5 text-slate-500" />
                </button>
              )}
            </div>

            {/* 조직 + 작성자 (한 줄) */}
            <div className="grid grid-cols-2 gap-2">
              {/* 조직 */}
              <div className="flex items-center bg-black/50 border border-white/10 rounded-lg overflow-hidden focus-within:border-emerald-500/40 transition-colors">
                <div className="pl-2.5 pr-1.5 py-[9px]">
                  <Briefcase className="w-3.5 h-3.5 text-slate-500" />
                </div>
                <input
                  type="text"
                  placeholder="조직명"
                  value={orgName}
                  onChange={e => { setOrgName(e.target.value); setOrgCode(''); }}
                  onKeyDown={handleKeyDown}
                  className="w-full bg-transparent py-[9px] text-xs text-white placeholder-slate-600 focus:outline-none"
                />
                {orgName ? (
                  <button onClick={clearOrg} className="pr-2 text-slate-500 hover:text-red-400 transition-colors shrink-0">
                    <X className="w-3 h-3" />
                  </button>
                ) : (
                  <button
                    onClick={() => setShowOrgPicker(true)}
                    className="pr-2.5 pl-1.5 py-2 border-l border-white/10 text-emerald-500 hover:text-emerald-400 shrink-0 transition-colors"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {/* 작성자 */}
              <div className="flex items-center bg-black/50 border border-white/10 rounded-lg overflow-hidden focus-within:border-emerald-500/40 transition-colors">
                <div className="pl-2.5 pr-1.5 py-[9px]">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                </div>
                <input
                  type="text"
                  placeholder="작성자/사번"
                  value={assignee}
                  onChange={e => setAssignee(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full bg-transparent py-[9px] pr-2 text-xs text-white placeholder-slate-600 focus:outline-none"
                />
              </div>
            </div>

            {/* 날짜 From → To (한 줄) */}
            <div className="flex items-center gap-2 bg-black/50 border border-white/10 rounded-lg px-3 py-[9px]">
              <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="flex-1 bg-transparent text-[11px] text-white focus:outline-none min-w-0"
                style={{ colorScheme: 'dark' }}
              />
              <span className="text-slate-600 text-xs shrink-0">→</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="flex-1 bg-transparent text-[11px] text-white focus:outline-none min-w-0"
                style={{ colorScheme: 'dark' }}
              />
              {(startDate || endDate) && (
                <button onClick={() => { setStartDate(''); setEndDate(''); }} className="text-slate-500 hover:text-red-400 ml-1 shrink-0">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* 검색 버튼 */}
            <button
              onClick={handleSearch}
              disabled={loading}
              className="w-full relative overflow-hidden rounded-lg active:scale-95 transition-all"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-teal-500" />
              <div className="relative flex items-center justify-center gap-1.5 py-2.5 text-white font-bold text-[13px]">
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Filter className="w-3.5 h-3.5" />
                    조회하기
                  </>
                )}
              </div>
            </button>

          </div>
        </div>

        {/* 결과 수 */}
        {searched && !loading && (
          <div className="flex items-center justify-between px-0.5">
            <span className="text-xs font-bold text-slate-400">
              검색 결과 <strong className="text-emerald-400">{reports.length}</strong>건
            </span>
            <span className="text-[10px] text-slate-500 bg-white/5 px-2 py-1 rounded-full">최신순</span>
          </div>
        )}

        {/* 결과 리스트 */}
        <div className="space-y-2.5">
          {loading ? (
            [1,2,3].map(i => (
              <div key={i} className="bg-[#11141d] p-4 rounded-xl border border-white/5 h-24 animate-pulse flex flex-col justify-between">
                <div className="w-2/3 h-3.5 bg-white/10 rounded" />
                <div className="w-full h-2.5 bg-white/5 rounded" />
                <div className="w-1/3 h-2.5 bg-white/5 rounded" />
              </div>
            ))
          ) : reports.length > 0 ? (
            reports.map(report => (
              <div
                key={report.code || report.inc_id}
                onClick={() => navigate(`/report/${(report.code || report.inc_id || '').replace('INC-', '')}`)}
                className="bg-[#11141d] p-4 rounded-xl border border-white/5 active:bg-white/5 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between mb-1.5 gap-3">
                  <h3 className="text-sm font-bold text-white leading-snug line-clamp-2 flex-1">
                    {report.title}
                  </h3>
                  <span className={`shrink-0 text-[10px] font-black px-2 py-0.5 rounded-full border ${
                    report.status === 'Completed' || report.status === '처리완료'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                  }`}>
                    {report.status || '완료'}
                  </span>
                </div>
                {report.description && (
                  <p className="text-[11px] text-slate-400 line-clamp-1 mb-2 leading-relaxed">
                    {report.description}
                  </p>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-[10px] text-slate-600 font-mono flex items-center gap-1">
                      <Activity className="w-3 h-3" />
                      {report.code || report.inc_id}
                    </span>
                    {report.created_at && (
                      <span className="text-[10px] text-slate-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-600" />
                        {new Date(report.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-emerald-500/40" />
                </div>
              </div>
            ))
          ) : searched ? (
            <div className="text-center py-14 bg-[#11141d] rounded-xl border border-white/5">
              <FileText className="w-10 h-10 text-slate-600 mx-auto mb-2.5 opacity-50" />
              <p className="text-slate-400 text-sm font-bold">검색 결과가 없습니다</p>
              <p className="text-slate-500 text-xs mt-1">조건을 변경해 다시 조회해 보세요</p>
            </div>
          ) : null}
        </div>
      </main>

      {/* 조직 선택 팝업 */}
      {showOrgPicker && (
        <OrgPickerModal
          onSelect={(name, code) => { setOrgName(name); setOrgCode(code); }}
          onClose={() => setShowOrgPicker(false)}
        />
      )}
    </div>
  );
}
