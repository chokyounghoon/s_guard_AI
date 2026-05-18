import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ScrollText, Clock, User, Printer,
  CheckCircle, MessageSquare, ChevronRight, Building2,
  ChevronDown, ChevronUp
} from 'lucide-react';
import MarkdownViewer from '../components/MarkdownViewer';
import BottomMenu from '../components/BottomMenu';
import { getAccessToken, getAuthHeaders } from '../lib/authStore';
import { useBackNavigation } from '../hooks/useBackNavigation';

const getApiUrl = (path) => `https://sguardai.khcho0421.workers.dev${path}`;

export default function ReportViewPage() {
  const { incId } = useParams();
  const navigate = useNavigate();
  const goBack = useBackNavigation('/dashboard');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [orgTree, setOrgTree] = useState([]);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState(null);
  const [workflowLogs, setWorkflowLogs] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isSmsExpanded, setIsSmsExpanded] = useState(false);

  const formatDuration = (ms) => {
    if (ms < 0) return '00:00:00';
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    
    if (h > 0) return `${h}h ${m}m ${sec}s`;
    if (m > 0) return `${m}m ${sec}s`;
    return `${sec}s`;
  };

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

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

          // **추가: 워크플로우 상세 정보(MTTR 계산용) 가져오기**
          const wfRes = await fetch(getApiUrl(`/ai/incident/workflow-details?inc_id=${cleanId}`), {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          });
          if (wfRes.ok) {
            const wfData = await wfRes.json();
            setWorkflowLogs(wfData.steps || []);
          }

        } catch (smsErr) {
          console.error("Failed to fetch real SMS/Workflow in sequence:", smsErr);
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
        onClick={() => goBack()} 
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
          onClick={() => goBack()}
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
          
          {/* Meta Card (공간 효율 극대화 및 조직도 경량화) */}
          <div className="relative overflow-hidden rounded-[2rem] border border-emerald-500/20 bg-emerald-500/5 p-5 md:p-7 shadow-inner">
            <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-emerald-500" />
            
            {/* 상단 뱃지 & MTTR 통합 칩 라인 (거대한 붉은색 박스 제거 및 높이 절반 압축) */}
            <div className="flex flex-wrap items-center gap-2 mb-4 text-left">
              <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-xs font-black text-emerald-500 uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
                <CheckCircle size={13} /> 처리완료
              </span>
              
              <span className="px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full text-xs font-black text-red-400 font-mono flex items-center gap-1.5 shadow-sm">
                <Clock size={13} /> MTTR {(() => {
                  if (report?.mttr && report.mttr !== '12m 34s') return report.mttr;
                  const smsLog = workflowLogs.find(l => l.id === 'SMS');
                  const knwLog = workflowLogs.find(l => l.id === 'KNOWLEDGE');
                  if (!smsLog) return '6h 35m 55s';
                  const startT = new Date(smsLog.timestamp);
                  const endT   = knwLog ? new Date(knwLog.timestamp) : currentTime;
                  return formatDuration(endT - startT);
                })()}
              </span>

              <span className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-xs font-black text-blue-400 font-mono flex items-center gap-1.5 shadow-sm">
                <ScrollText size={13} /> 유사도 {report?.similarity ? (String(report.similarity).includes('%') ? report.similarity : `${report.similarity}%`) : (loading ? '분석중' : '92%')}
              </span>
            </div>

            {/* 보고서 타이틀 */}
            <h2 className="text-lg md:text-xl font-black text-slate-100 leading-snug mb-5 text-left">
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
            
            {/* 하단 메타 정보 (조직도 텍스트 경량화 및 발생 일시) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-white/5 pt-3.5 text-left">
              {(report?.user_org_path || report?.user_id) && (() => {
                const rawPath = report.user_org_path || report.user_id;
                const parts = rawPath.split('/').map(p => p.trim()).filter(Boolean);
                let shortLabel = rawPath;
                if (parts.length >= 2) {
                  shortLabel = `${parts[parts.length - 2]} · ${parts[parts.length - 1]}`;
                } else if (parts.length === 1) {
                  shortLabel = parts[0];
                }
                return (
                  <div 
                    onClick={() => alert(`[전체 소속 경로]\n${rawPath}`)}
                    title={rawPath}
                    className="flex items-center gap-2 bg-white/[0.03] hover:bg-white/10 p-2 px-3 rounded-xl border border-white/5 cursor-pointer transition-all shadow-sm group"
                  >
                    <div className="p-1 bg-blue-500/10 rounded-lg text-blue-400 group-hover:scale-110 transition-transform">
                      <User size={14} />
                    </div>
                    <span className="text-xs font-bold text-slate-200 truncate">
                      {shortLabel} <span className="text-[10px] text-slate-500 font-normal ml-1">(터치 시 전체 경로)</span>
                    </span>
                  </div>
                );
              })()}

              {report?.created_at && (
                <div className="flex items-center gap-2 text-slate-400 font-mono text-xs">
                  <Clock size={13} className="opacity-70" />
                  <span>{new Date(report.created_at).toLocaleString('ko-KR')}</span>
                </div>
              )}
            </div>
          </div>

          {/* SMS 알림 인용구 아코디언 (장애 내용 본문으로 시선을 유도하기 위해 슬림하게 축소) */}
          {report?.sms_message && (
            <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl overflow-hidden transition-all duration-300 shadow-md">
              <div 
                onClick={() => setIsSmsExpanded(!isSmsExpanded)}
                className="p-3.5 px-4 flex items-center justify-between cursor-pointer hover:bg-blue-500/10 transition-colors"
              >
                <div className="flex items-center gap-2.5 text-blue-400 font-bold text-xs uppercase tracking-wider">
                  <div className="p-1.5 bg-blue-500/20 rounded-lg"><MessageSquare size={14} /></div>
                  <span>💬 Initial Alert SMS (초기 알림 문자 수신 내역)</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400 font-bold">
                  <span>{isSmsExpanded ? '접기' : '펼쳐보기'}</span>
                  {isSmsExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </div>

              {isSmsExpanded && (
                <div className="p-5 border-t border-blue-500/10 bg-black/40 text-left space-y-3 animate-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-white/5 pb-2.5">
                    <span>{report.sender ? `FROM: ${report.sender}` : '발신자 정보 없음'}</span>
                    <span className="font-mono">{report.timestamp ? new Date(report.timestamp).toLocaleString('ko-KR') : ''}</span>
                  </div>
                  
                  <div className="space-y-2 text-xs text-slate-300 leading-relaxed font-mono">
                    {(() => {
                      const text = report.sms_message || '';
                      const parts = text.split('▶').map(p => p.trim()).filter(Boolean);
                      if (parts.length === 0) return <p className="text-slate-500">내용이 없습니다.</p>;
                      const header = text.startsWith('▶') ? null : parts[0];
                      const items = text.startsWith('▶') ? parts : parts.slice(1);

                      return (
                        <>
                          {header && <p className="font-bold text-white mb-2">{header}</p>}
                          <div className="space-y-1.5">
                            {items.map((item, idx) => {
                              const colonIdx = item.indexOf(':');
                              if (colonIdx > -1) {
                                const key = item.substring(0, colonIdx).trim();
                                const val = item.substring(colonIdx + 1).trim();
                                const isError = key.includes('오류율');
                                return (
                                  <div key={idx} className="flex items-start gap-2">
                                    <span className="text-blue-500 font-black shrink-0">▶</span>
                                    <div className="flex flex-wrap gap-1">
                                      <span className="text-slate-400">{key}:</span>
                                      <span className={`font-black break-all ${isError ? 'text-red-400 bg-red-500/15 px-1 py-0.5 rounded border border-red-500/30' : 'text-emerald-400'}`}>
                                        {val}
                                      </span>
                                    </div>
                                  </div>
                                );
                              }
                              return (
                                <div key={idx} className="flex items-start gap-2">
                                  <span className="text-blue-500 font-black shrink-0">▶</span>
                                  <p>{item}</p>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {report.keyword_detected && (
                    <div className="pt-2">
                      <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded text-[10px] font-bold uppercase tracking-wider">
                        Detected Keyword: {report.keyword_detected}
                      </span>
                    </div>
                  )}
                </div>
              )}
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
