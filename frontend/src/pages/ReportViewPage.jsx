import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ScrollText, Clock, User, Printer,
  CheckCircle, MessageSquare, ChevronRight, Building2
} from 'lucide-react';
import MarkdownViewer from '../components/MarkdownViewer';
import BottomMenu from '../components/BottomMenu';

const getApiUrl = (path) => `https://sguardai.khcho0421.workers.dev${path}`;

export default function ReportViewPage() {
  const { incId } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [orgTree, setOrgTree] = useState([]);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState(null);

  const getAccessToken = () => {
    try {
      return localStorage.getItem('sguard_access_token');
    } catch (e) {
      return null;
    }
  };

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch(getApiUrl(`/reports/${incId}`));
        if (!res.ok) throw new Error('보고서를 찾을 수 없습니다');
        const data = await res.json();
        
        let reportData = data.report || {};

        try {
          const token = getAccessToken();
          const cleanId = String(incId || '').replace(/^INC-/i, '');
          
          let smsRes = await fetch(getApiUrl(`/sms/${cleanId}`), {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          });
          
          if (!smsRes.ok) {
            smsRes = await fetch(getApiUrl(`/sms/${incId}`), {
              headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
          }

          if (smsRes.ok) {
            const smsData = await smsRes.json();
            if (smsData) {
              reportData = { ...reportData, ...smsData };
              if (smsData.message) {
                reportData.sms_message = smsData.message;
              }
            }
          }
        } catch (smsErr) {
          console.error("Failed to fetch real SMS in sequence:", smsErr);
        }

        setReport(reportData);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    const fetchOrg_ = async () => {
      try {
        const token = getAccessToken();
        const res = await fetch(getApiUrl('/org/tree'), {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (res.ok) {
          const data = await res.json();
          setOrgTree(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        console.error("Failed to fetch org tree:", e);
      }
    };

    const fetchUsers_ = async () => {
      try {
        const token = getAccessToken();
        const res = await fetch(getApiUrl('/users'), {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (res.ok) {
          const data = await res.json();
          setUsers(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        console.error("Failed to fetch users:", e);
      }
    };

    if (incId) {
      fetch_();
      fetchOrg_();
      fetchUsers_();
    }
  }, [incId]);

  const cleanId = String(incId || '').replace(/^INC-/i, '');
  const cleanTitle = (t) => (t || '').split(':')[0].trim();

  if (loading) return (
    <div className="min-h-screen bg-[#090c14] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">리포트 로딩중...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-[#090c14] flex flex-col items-center justify-center gap-6 p-6">
      <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
        <ScrollText className="w-8 h-8 text-slate-700" />
      </div>
      <p className="text-slate-500 text-sm font-bold">{error}</p>
      <button 
        onClick={() => navigate(-1)} 
        className="px-8 py-3 rounded-2xl bg-blue-600 text-white text-sm font-bold active:scale-95 transition-all shadow-lg shadow-blue-600/20"
      >
        돌아가기
      </button>
    </div>
  );

  return (
    <div className="h-screen bg-[#090c14] text-white flex flex-col overflow-hidden">
      {/* Header */}
      <header className="shrink-0 flex items-center gap-4 px-6 h-20 bg-[#090c14]/80 backdrop-blur-2xl border-b border-white/5 z-50">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center active:scale-95 transition-all"
        >
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </button>

        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest leading-none mb-1">
            Incident Report
          </p>
          <p className="text-[11px] text-slate-500 font-mono font-bold truncate">
            {cleanId}
          </p>
        </div>

        <button
          onClick={() => window.print()}
          className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center active:scale-95 transition-all"
          title="인쇄"
        >
          <Printer className="w-5 h-5 text-slate-500" />
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto custom-scrollbar pb-36">
        <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
          
          {/* Meta Card */}
          <div className="relative overflow-hidden rounded-[2rem] border border-emerald-500/20 bg-emerald-500/5 p-6 md:p-8">
            <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-emerald-500" />
            
            <div className="flex items-center justify-between mb-6">
              <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[10px] font-black text-emerald-500 uppercase tracking-widest">
                처리완료
              </span>
              <span className="text-[11px] font-black text-slate-500 font-mono tracking-tight">
                유사도 {report?.similarity ? (String(report.similarity).includes('%') ? report.similarity : `${report.similarity}%`) : '98.5%'}
              </span>
            </div>

            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8">
              <h2 className="text-xl md:text-2xl font-black text-slate-100 leading-tight">
                {(() => {
                  const writer = users.find(u => 
                    String(u.user_id) === String(report?.user_id) || 
                    String(u.id) === String(report?.user_id) ||
                    (report?.user_id && String(u.name) === String(report.user_id))
                  );
                  const userSubpartCode = writer?.subpart || writer?.org_code || writer?.dept_code;

                  const findOrgNameByCode = (nodes, code) => {
                    if (!nodes || !code) return null;
                    for (const node of nodes) {
                      if (String(node.code) === String(code)) return node.name;
                      if (node.children) {
                        const found = findOrgNameByCode(node.children, code);
                        if (found) return found;
                      }
                    }
                    return null;
                  };

                  const orgName = findOrgNameByCode(orgTree, userSubpartCode);
                  if (orgName) return `[${orgName} 장애 완료 보고서]`;

                  const fallbackCode = report?.subpart_code || report?.subpart || report?.dept_code || report?.org_code;
                  const fallbackOrgName = findOrgNameByCode(orgTree, fallbackCode);
                  if (fallbackOrgName) return `[${fallbackOrgName} 장애 완료 보고서]`;

                  return cleanTitle(report?.title || `[인시던트 보고서] ${cleanId}`);
                })()}
              </h2>
              
              <div className="shrink-0 flex flex-col items-end px-4 py-2 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500">
                <span className="text-[9px] font-black uppercase tracking-widest opacity-50 mb-0.5">MTTR</span>
                <span className="text-lg font-black font-mono leading-none">{report?.mttr || '12m 34s'}</span>
              </div>
            </div>

            <div className="space-y-3">
              {(report?.user_org_path || report?.user_id) && (
                <div className="flex items-center gap-3 text-slate-400">
                  <div className="p-1.5 bg-white/5 rounded-lg border border-white/5">
                    <Building2 className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-bold leading-tight truncate">
                    {report.user_org_path || report.user_id}
                  </span>
                </div>
              )}
              {report?.created_at && (
                <div className="flex items-center gap-3 text-slate-500">
                  <div className="p-1.5 bg-white/5 rounded-lg border border-white/5">
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-bold font-mono">
                    {new Date(report.created_at).toLocaleString('ko-KR')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Original SMS Timeline Item */}
          {report?.sms_message && (
            <div className="relative group">
              {/* Timeline Connector - Adjusted to be more subtle and aligned with card edge */}
              <div className="absolute -left-3 top-10 bottom-[-24px] w-[1px] bg-gradient-to-b from-blue-500/30 to-transparent hidden md:block" />
              
              <div className="relative overflow-hidden rounded-[2rem] border border-blue-500/20 bg-blue-500/5 p-6 md:p-8 transition-all hover:bg-blue-500/10">
                {/* Internal Timeline Dot Indicator */}
                <div className="absolute top-8 left-0 w-1.5 h-10 bg-blue-500 rounded-r-full shadow-[0_0_15px_rgba(59,130,246,0.5)]" />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-blue-500/20 rounded-lg">
                      <MessageSquare className="w-4 h-4 text-blue-400" />
                    </div>
                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">Initial Alert SMS</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {report.sender && (
                      <span className="text-[10px] text-slate-500 font-bold bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
                        FROM: {report.sender}
                      </span>
                    )}
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Clock className="w-3 h-3 opacity-50" />
                      <span className="text-[10px] font-bold font-mono">
                        {report.timestamp ? new Date(report.timestamp).toLocaleString('ko-KR') : '시간 정보 없음'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-black/40 rounded-2xl border border-white/5 p-5 relative overflow-hidden">
                  {/* Glass highlight effect */}
                  <div className="absolute -top-10 -right-10 w-24 h-24 bg-blue-500/10 blur-3xl rounded-full" />
                  
                  <div className="space-y-2.5">
                    {(() => {
                      const text = report.sms_message || '';
                      // ▶ 기호로 분리하되, 첫 번째 조각은 제목/헤더로 취급
                      const parts = text.split('▶').map(p => p.trim()).filter(Boolean);
                      if (parts.length === 0) return <p className="text-[12px] text-slate-400">데이터 없음</p>;

                      const header = text.startsWith('▶') ? null : parts[0];
                      const items = text.startsWith('▶') ? parts : parts.slice(1);

                      return (
                        <>
                          {header && (
                            <div className="pb-3 mb-3 border-b border-white/5">
                              <p className="text-[13px] font-black text-white leading-relaxed">
                                {header}
                              </p>
                            </div>
                          )}
                          <div className="space-y-2">
                            {items.map((item, idx) => {
                              const colonIdx = item.indexOf(':');
                              if (colonIdx > -1) {
                                const key = item.substring(0, colonIdx).trim();
                                const val = item.substring(colonIdx + 1).trim();
                                return (
                                  <div key={idx} className="flex items-start gap-2 group/item">
                                    <span className="text-blue-500 font-black mt-0.5 shrink-0 text-[10px]">▶</span>
                                    <div className="flex flex-wrap items-baseline gap-x-2">
                                      <span className="text-[11px] font-bold text-slate-400 shrink-0">{key} :</span>
                                      <span className={`text-[12px] font-black break-all ${
                                        key.includes('현재오류율') || key.includes('오류율') 
                                          ? 'text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-md border border-red-500/20 shadow-[0_0_8px_rgba(239,68,68,0.3)]' 
                                          : 'text-emerald-400'
                                      }`}>
                                        {val}
                                      </span>
                                    </div>
                                  </div>
                                );
                              }
                              return (
                                <div key={idx} className="flex items-start gap-2">
                                  <span className="text-blue-500 font-black mt-0.5 shrink-0 text-[10px]">▶</span>
                                  <p className="text-[12px] text-slate-300 leading-relaxed">{item}</p>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
                
                {report.keyword_detected && (
                  <div className="mt-4 flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-[9px] font-black text-blue-400 uppercase tracking-widest">
                      Detected Keyword: {report.keyword_detected}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Report Body */}
          <div className="rounded-[2.5rem] border border-white/5 bg-white/[0.03] p-6 md:p-8">
            {report?.content ? (() => {
              const lines = report.content.split('\n');
              return (
                <div className="space-y-4">
                  {lines.map((line, idx) => {
                    if (line.trim() === '') return null;

                    // **N. 제목** → 굵은 번호 제목
                    const boldTitleMatch = line.match(/^\*\*(\d+)\.\s+(.+?)\*\*$/);
                    if (boldTitleMatch) {
                      return (
                        <div key={idx} className="pt-4 first:pt-0">
                          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-blue-500/20">
                            <span className="w-7 h-7 flex items-center justify-center rounded-lg bg-blue-600/20 text-blue-400 text-sm font-black shrink-0">
                              {boldTitleMatch[1]}
                            </span>
                            <h3 className="text-sm font-black text-white tracking-tight">{boldTitleMatch[2]}</h3>
                          </div>
                        </div>
                      );
                    }

                    // - 항목 라인
                    const bulletMatch = line.match(/^-\s+(.+)$/);
                    if (bulletMatch) {
                      const content = bulletMatch[1];
                      const colonIdx = content.indexOf(': ');
                      if (colonIdx > -1) {
                        const key = content.substring(0, colonIdx);
                        const val = content.substring(colonIdx + 2);
                        return (
                          <div key={idx} className="flex gap-2 text-sm pl-2 leading-relaxed -mt-2">
                            <span className="text-blue-400 shrink-0">•</span>
                            <span>
                              <span className="text-slate-300 font-semibold">{key}:</span>
                              <span className="text-slate-400"> {val}</span>
                            </span>
                          </div>
                        );
                      }
                      return (
                        <div key={idx} className="flex gap-2 text-sm pl-2 leading-relaxed text-slate-400 -mt-2">
                          <span className="text-blue-400 shrink-0">•</span>
                          <span>{content}</span>
                        </div>
                      );
                    }

                    return (
                      <p key={idx} className="text-sm text-slate-400 leading-relaxed pl-2">{line}</p>
                    );
                  })}
                </div>
              );
            })() : (
              <div className="py-20 flex flex-col items-center justify-center text-slate-600 gap-3">
                <ScrollText className="w-12 h-12 opacity-20" />
                <p className="text-sm font-bold">보고서 내용이 없습니다.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      <BottomMenu />
    </div>
  );
}
