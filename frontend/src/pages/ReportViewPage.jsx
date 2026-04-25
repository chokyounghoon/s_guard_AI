import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Calendar, User, Printer } from 'lucide-react';
import MarkdownViewer from '../components/MarkdownViewer';
import BottomMenu from '../components/BottomMenu';

const getApiUrl = (path) => `https://sguardai.khcho0421.workers.dev${path}`;

export default function ReportViewPage() {
  const { incId } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch(getApiUrl(`/reports/${incId}`));
        if (!res.ok) throw new Error('보고서를 찾을 수 없습니다');
        const data = await res.json();
        setReport(data.report);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    if (incId) fetch_();
  }, [incId]);

  const cleanId = String(incId || '').replace(/^INC-/i, '');

  if (loading) return (
    <div className="min-h-screen bg-[#0f1421] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">보고서 로딩 중...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-[#0f1421] flex items-center justify-center">
      <div className="text-center">
        <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400 text-sm">{error}</p>
        <button onClick={() => navigate(-1)} className="mt-4 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm">
          돌아가기
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0f1421] text-white font-sans pb-28">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-[#0f1421]/90 backdrop-blur-md border-b border-white/5 z-50 print:hidden">
        <div className="flex items-center gap-2 px-3 py-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-white/10 transition-all active:scale-95 shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xs font-black tracking-wider uppercase text-emerald-400 truncate">Incident Report</h1>
            <p className="text-[9px] text-slate-500 font-mono truncate">{cleanId}</p>
          </div>
          <button
            onClick={() => window.print()}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all active:scale-95"
            title="인쇄"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="pt-16 px-3 max-w-2xl mx-auto">
        {/* Report Meta Card */}
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 mb-4 mt-2">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
              <FileText className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-black text-white truncate">{report?.title || `[인시던트 보고서] ${cleanId}`}</h2>
              <div className="flex items-center gap-3 mt-1">
                {report?.user_id && (
                  <span className="flex items-center gap-1 text-[10px] text-slate-500">
                    <User className="w-3 h-3" /> {report.user_id}
                  </span>
                )}
                {report?.created_at && (
                  <span className="flex items-center gap-1 text-[10px] text-slate-500">
                    <Calendar className="w-3 h-3" />
                    {new Date(report.created_at).toLocaleString('ko-KR')}
                  </span>
                )}
              </div>
              <div className="mt-1.5">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-black text-emerald-400 uppercase">
                  ✅ 처리완료
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Report Content */}
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
          {report?.content ? (
            <MarkdownViewer text={report.content} />
          ) : (
            <p className="text-slate-500 text-sm text-center py-8">보고서 내용이 없습니다.</p>
          )}
        </div>
      </div>

      <BottomMenu />
    </div>
  );
}
