import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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

/* ── Status Badge ─────────────────────────────────────────────── */
function StatusBadge({ status }) {
  const isComplete = status === 'Completed' || status === '처리완료';
  const isProgress = status === '처리중' || status === 'In Progress';
  return (
    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border tracking-wide ${
      isComplete ? 'bg-emerald-500/12 text-emerald-400 border-emerald-500/25' :
      isProgress ? 'bg-blue-500/12 text-blue-400 border-blue-500/25' :
                   'bg-amber-500/12 text-amber-400 border-amber-500/25'
    }`}>
      {status || '완료'}
    </span>
  );
}

/* ── Report Card (grid item) ──────────────────────────────────── */
function ReportCard({ report, onClick }) {
  const isComplete = report.status === 'Completed' || report.status === '처리완료';
  const accent = isComplete ? '#10b981' : '#3b82f6';
  const date = report.created_at
    ? new Date(report.created_at).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })
    : '';

  return (
    <div
      onClick={onClick}
      style={{
        background: 'rgba(255,255,255,0.025)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 16, overflow: 'hidden', cursor: 'pointer',
        transition: 'all 0.2s',
        boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
        display: 'flex', flexDirection: 'column',
      }}
      onTouchStart={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
      onTouchEnd={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
    >
      {/* accent top bar */}
      <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${accent}80, transparent)`, flexShrink: 0 }} />

      <div style={{ padding: '12px 12px 10px', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* status + date */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
          <StatusBadge status={report.status} />
          {date && (
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace' }}>{date}</span>
          )}
        </div>

        {/* title */}
        <h3 style={{
          fontSize: 12, fontWeight: 800, color: '#fff',
          lineHeight: 1.45, flex: 1,
          display: '-webkit-box', WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {report.title}
        </h3>
        {report.report_title && (
          <div className="text-[10px] text-emerald-500/80 font-bold truncate">
            📝 {report.report_title}
          </div>
        )}

        {/* inc_id */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>
            {report.code || report.inc_id}
          </span>
          <ChevronRight size={12} color={`${accent}80`} />
        </div>
      </div>
    </div>
  );
}

/* ── Skeleton ─────────────────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.025)',
      border: '1px solid rgba(255,255,255,0.05)',
      borderRadius: 16, overflow: 'hidden', height: 130,
    }}>
      <div style={{ height: 2, background: 'rgba(255,255,255,0.05)' }} />
      <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ width: '50%', height: 14, background: 'rgba(255,255,255,0.06)', borderRadius: 6, animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ width: '100%', height: 10, background: 'rgba(255,255,255,0.04)', borderRadius: 6, animation: 'pulse 1.5s ease-in-out infinite 0.1s' }} />
        <div style={{ width: '80%', height: 10, background: 'rgba(255,255,255,0.04)', borderRadius: 6, animation: 'pulse 1.5s ease-in-out infinite 0.2s' }} />
        <div style={{ width: '35%', height: 8, background: 'rgba(255,255,255,0.03)', borderRadius: 6, marginTop: 4, animation: 'pulse 1.5s ease-in-out infinite 0.3s' }} />
      </div>
    </div>
  );
}

/* ── Main ─────────────────────────────────────────────────────── */
export default function MobileReportSearch() {
  const navigate = useNavigate();

  const getLocalDate = (date) => {
    const offset = date.getTimezoneOffset() * 60000;
    const localDate = new Date(date.getTime() - offset);
    return localDate.toISOString().split('T')[0];
  };
  const today        = () => getLocalDate(new Date());
  const oneYearAgo   = () => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return getLocalDate(d); };

  const [keyword,   setKeyword]   = useState('');
  const [startDate, setStartDate] = useState(oneYearAgo());
  const [endDate,   setEndDate]   = useState(today());
  const [orgName,   setOrgName]   = useState('');
  const [orgCode,   setOrgCode]   = useState('');
  const [assignee,  setAssignee]  = useState('');
  const [showOrg,   setShowOrg]   = useState(false);

  const [reports,  setReports]  = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = useCallback(async () => {
    setLoading(true); setSearched(true);
    try {
      const p = new URLSearchParams();
      if (keyword.trim()) p.append('keyword', keyword.trim());
      if (keyword.trim() && /^\d+$/.test(keyword.trim())) p.append('inc_id', keyword.trim());
      if (startDate) p.append('startDate', startDate);
      if (endDate)   p.append('endDate', endDate);
      if (orgCode)   p.append('orgCode', orgCode);
      if (orgName.trim() && !orgCode) p.append('orgName', orgName.trim());
      if (assignee.trim()) p.append('assignee', assignee.trim());
      // 보고서 검색 페이지이므로 보고서가 있는 항목만 필터링하거나 우선적으로 보여주기 위해 파라미터 전달 가능
      // (현재 백엔드 incidents 엔드포인트는 has_report 정보를 반환함)
      p.append('limit', '100');

      const res  = await fetch(`${API_BASE}/incidents?${p.toString()}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.incidents || []);
      // 보고서 검색 페이지이므로 보고서가 있는 항목만 필터링 (사용자 요구사항에 따라 조절 가능)
      const filtered = list.filter(r => r.has_report === 1 || r.status === 'Completed' || r.status === '처리완료');
      setReports(filtered);
    } catch (err) {
      console.error('[MobileReportSearch]', err);
    } finally {
      setLoading(false);
    }
  }, [keyword, startDate, endDate, orgCode, orgName, assignee]);

  useEffect(() => { handleSearch(); }, []); // eslint-disable-line

  const clearOrg = () => { setOrgName(''); setOrgCode(''); };

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex', flexDirection: 'column',
      background: 'radial-gradient(ellipse 130% 80% at 50% 0%, #0d1528 0%, #080e1a 50%, #050a15 100%)',
      color: '#fff',
      fontFamily: "'Inter', 'Noto Sans KR', sans-serif",
      overflowY: 'auto',
    }}>

      {/* ── Sticky Header ─────────────────────────────────────── */}
      <div style={{
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        paddingTop: 'env(safe-area-inset-top)',
        background: 'rgba(8,14,26,0.92)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        zIndex: 50,
      }}>
        {/* Title bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px 10px' }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}
          >
            <ArrowLeft size={15} color="#94a3b8" />
          </button>
          <div>
            <h1 style={{ fontSize: 15, fontWeight: 900, letterSpacing: '-0.01em', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
              <FileText size={14} color="#10b981" />
              AI Report Search
            </h1>
            <p style={{ fontSize: 9, color: '#10b981', fontWeight: 700, letterSpacing: '0.12em', margin: 0, textTransform: 'uppercase' }}>
              장애 보고서 통합 검색
            </p>
          </div>
        </div>

        {/* Search form */}
        <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 7 }}>

          {/* Keyword */}
          <div style={{
            display: 'flex', alignItems: 'center',
            background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12, overflow: 'hidden',
          }}>
            <div style={{ padding: '0 10px 0 12px' }}><Search size={13} color="rgba(16,185,129,0.6)" /></div>
            <input
              type="text" placeholder="제목 · ID 키워드 검색"
              value={keyword} onChange={e => setKeyword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', padding: '9px 0', fontSize: 12, color: '#fff', fontFamily: 'inherit' }}
            />
            {keyword && (
              <button onClick={() => setKeyword('')} style={{ padding: '0 10px', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <X size={12} color="#64748b" />
              </button>
            )}
          </div>

          {/* Org + Assignee 2-col */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
            {/* Org */}
            <div style={{
              display: 'flex', alignItems: 'center',
              background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12, overflow: 'hidden',
            }}>
              <div style={{ padding: '0 8px 0 10px' }}><Briefcase size={12} color="#64748b" /></div>
              <input
                type="text" placeholder="조직명"
                value={orgName} onChange={e => { setOrgName(e.target.value); setOrgCode(''); }}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', padding: '9px 0', fontSize: 11, color: '#fff', fontFamily: 'inherit', minWidth: 0 }}
              />
              {orgName ? (
                <button onClick={clearOrg} style={{ padding: '0 8px', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                  <X size={11} color="#64748b" />
                </button>
              ) : (
                <button
                  onClick={() => setShowOrg(true)}
                  style={{ padding: '0 8px', background: 'transparent', borderLeft: '1px solid rgba(255,255,255,0.07)', cursor: 'pointer', display: 'flex', alignItems: 'center', height: '100%' }}
                >
                  <ChevronDown size={13} color="#10b981" />
                </button>
              )}
            </div>
            {/* Assignee */}
            <div style={{
              display: 'flex', alignItems: 'center',
              background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12, overflow: 'hidden',
            }}>
              <div style={{ padding: '0 8px 0 10px' }}><User size={12} color="#64748b" /></div>
              <input
                type="text" placeholder="작성자/사번"
                value={assignee} onChange={e => setAssignee(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', padding: '9px 4px 9px 0', fontSize: 11, color: '#fff', fontFamily: 'inherit', minWidth: 0 }}
              />
            </div>
          </div>

          {/* Date range */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12, padding: '0 10px', height: 38,
          }}>
            <Calendar size={12} color="#64748b" style={{ flexShrink: 0 }} />
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 11, color: '#fff', minWidth: 0, colorScheme: 'dark', fontFamily: 'inherit' }} />
            <span style={{ fontSize: 10, color: '#334155', flexShrink: 0 }}>→</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 11, color: '#fff', minWidth: 0, colorScheme: 'dark', fontFamily: 'inherit' }} />
            {(startDate || endDate) && (
              <button onClick={() => { setStartDate(''); setEndDate(''); }}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', flexShrink: 0, padding: 0 }}>
                <X size={11} color="#64748b" />
              </button>
            )}
          </div>

          {/* Search button */}
          <button
            onClick={handleSearch} disabled={loading}
            style={{
              width: '100%', padding: '10px', borderRadius: 12, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
              background: loading ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #059669, #0d9488)',
              color: loading ? 'rgba(255,255,255,0.3)' : '#fff',
              fontSize: 13, fontWeight: 800, letterSpacing: '0.02em',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              boxShadow: loading ? 'none' : '0 4px 16px rgba(5,150,105,0.3)',
              transition: 'all 0.2s',
            }}
          >
            {loading
              ? <><div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> 조회 중...</>
              : <><Filter size={13} /> 조회하기</>
            }
          </button>
        </div>
      </div>

      {/* ── Results Container ─────────────────────────────────── */}
      <div style={{ WebkitOverflowScrolling: 'touch' }}>
        <div style={{ padding: '12px 12px calc(80px + env(safe-area-inset-bottom))' }}>

          {/* result count */}
          {searched && !loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>
                검색 결과 <strong style={{ color: '#10b981' }}>{reports.length}</strong>건
              </span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.04)', padding: '3px 8px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.07)' }}>
                최신순
              </span>
            </div>
          )}

          {/* 2-grid results */}
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[1,2,3,4,5,6].map(i => <SkeletonCard key={i} />)}
            </div>
          ) : reports.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {reports.map(r => (
                <ReportCard
                  key={r.code || r.inc_id}
                  report={r}
                  onClick={() => navigate(`/report/${(r.code || r.inc_id || '').replace('INC-', '')}`)}
                />
              ))}
            </div>
          ) : searched ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '48px 20px',
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 20,
            }}>
              <FileText size={36} color="rgba(255,255,255,0.12)" style={{ marginBottom: 12 }} />
              <p style={{ fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.4)', margin: '0 0 4px' }}>검색 결과가 없습니다</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', margin: 0 }}>조건을 변경해 다시 조회해 보세요</p>
            </div>
          ) : null}
        </div>
      </div>

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
