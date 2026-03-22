import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowLeft, Share2, Sparkles, AlertCircle, MessageSquare,
  FileText, Paperclip, Clock, Users, CheckCircle2, Send, User, Check, ChevronRight, X,
  Database, Shield, Server, Bot, Activity, RefreshCw, Loader
} from 'lucide-react';

const API_BASE_URL = 'https://sguardai.khcho0421.workers.dev';

const mdComponents = {
  h1: ({children}) => <h1 className="text-lg font-black text-white mt-4 mb-2 border-b border-white/10 pb-1">{children}</h1>,
  h2: ({children}) => <h2 className="text-sm font-bold text-blue-300 mt-4 mb-2 uppercase tracking-wide">{children}</h2>,
  h3: ({children}) => <h3 className="text-sm font-bold text-slate-200 mt-3 mb-1">{children}</h3>,
  p:  ({children}) => <p className="text-[13px] text-slate-300 leading-relaxed mb-2">{children}</p>,
  strong: ({children}) => <strong className="text-white font-bold">{children}</strong>,
  em: ({children}) => <em className="text-slate-400 italic">{children}</em>,
  blockquote: ({children}) => <blockquote className="border-l-2 border-blue-500/50 pl-3 my-2 text-slate-400 italic text-[12px]">{children}</blockquote>,
  code: ({inline, children}) => inline
    ? <code className="bg-slate-800 text-emerald-400 text-[11px] px-1.5 py-0.5 rounded font-mono">{children}</code>
    : <pre className="bg-slate-900 border border-white/5 rounded-xl p-3 my-2 overflow-x-auto text-[11px] text-emerald-300 font-mono whitespace-pre-wrap">{children}</pre>,
  ul: ({children}) => <ul className="list-disc list-inside space-y-1 my-2 text-[13px] text-slate-300">{children}</ul>,
  ol: ({children}) => <ol className="list-decimal list-inside space-y-1 my-2 text-[13px] text-slate-300">{children}</ol>,
  li: ({children}) => <li className="leading-relaxed">{children}</li>,
  hr: () => <hr className="border-white/10 my-3" />,
  table: ({children}) => <div className="overflow-x-auto my-3"><table className="w-full text-[12px] border-collapse">{children}</table></div>,
  thead: ({children}) => <thead>{children}</thead>,
  th: ({children}) => <th className="border border-white/10 bg-slate-800 px-3 py-1.5 text-left font-bold text-slate-200">{children}</th>,
  td: ({children}) => <td className="border border-white/10 px-3 py-1.5 text-slate-300">{children}</td>,
  tr: ({children}) => <tr className="even:bg-slate-900/30">{children}</tr>,
};

function MarkdownBlock({ text }) {
  if (!text) return <span className="text-slate-500">-</span>;
  return (
    <div className="text-[13px]">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{text}</ReactMarkdown>
    </div>
  );
}

const severityColors = {
  CRITICAL: 'bg-red-500/20 text-red-400 border-red-500/40',
  HIGH:     'bg-orange-500/20 text-orange-400 border-orange-500/40',
  NORMAL:   'bg-blue-500/20 text-blue-400 border-blue-500/40',
  INFO:     'bg-slate-500/20 text-slate-400 border-slate-500/40',
};

const agentColors = {
  Security: { bg: 'bg-red-500/15', border: 'border-red-500/30', text: 'text-red-400', icon: Shield },
  DB:       { bg: 'bg-purple-500/15', border: 'border-purple-500/30', text: 'text-purple-400', icon: Database },
  DevOps:   { bg: 'bg-green-500/15', border: 'border-green-500/30', text: 'text-green-400', icon: Server },
  Leader:   { bg: 'bg-amber-500/15', border: 'border-amber-500/30', text: 'text-amber-400', icon: Bot },
};

export default function AiReportPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const incidentId = location.state?.incidentId;

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [memo, setMemo] = useState('');
  const [modalStep, setModalStep] = useState(null);
  const [selectedLines, setSelectedLines] = useState([]);
  const [activeTab, setActiveTab] = useState('summary');
  // Dify AI report generation
  const [aiGenText, setAiGenText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const generateAiReport = async () => {
    if (!incidentId) return;
    if (genAbortRef.current) genAbortRef.current.abort();
    const controller = new AbortController();
    genAbortRef.current = controller;
    setAiGenText('');
    setIsGenerating(true);
    setActiveTab('ai_report');
    try {
      // Allow frontend to optionally strip INC- before sending
      const reqId = incidentId.startsWith('INC-') ? incidentId.slice(4) : incidentId;
      const res = await fetch(`${API_BASE_URL}/ai/generate-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incident_id: reqId }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        
        // Extract all complete 'data: ...\n\n' blocks
        let newlineIdx;
        while ((newlineIdx = buf.indexOf('\n\n')) >= 0) {
          const block = buf.slice(0, newlineIdx).trim();
          buf = buf.slice(newlineIdx + 2);
          
          if (!block) continue;
          
          const lines = block.split('\n');
          for (const line of lines) {
            if (line.startsWith('data:')) {
              const d = line.slice(5).trim();
              if (d === '[DONE]') { setIsGenerating(false); return; }
              try {
                const obj = JSON.parse(d);
                if (obj.answer) {
                  setAiGenText(prev => prev + obj.answer);
                }
              } catch (e) {
                console.error("Parse error on chunk:", d, e);
              }
            }
          }
        }
      }
    } catch (e) {
      if (e.name !== 'AbortError') setAiGenText(prev => prev + '\n\n⚠️ 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => () => { if (genAbortRef.current) genAbortRef.current.abort(); }, []);

  const reportingLines = [
    { id: 'leader',   role: '팀장',  name: '직속 팀장', desc: '직속 상급자' },
    { id: 'director', role: '본부장', name: '부서 본부장', desc: '부서 책임자' },
    { id: 'exec',     role: '상무',  name: '사업부 상무', desc: '사업부 임원' },
  ];

  useEffect(() => {
    if (!incidentId) {
      setError('장애 ID가 없습니다. 채팅방에서 다시 접근해주세요.');
      setLoading(false);
      return;
    }
    const fetchReport = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/warroom/report/${incidentId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setReport(data);
      } catch (e) {
        setError(`데이터 로드 실패: ${e.message}`);
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [incidentId]);

  const toggleLine = (id) => {
    setSelectedLines(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleFinalSubmit = async () => {
    try {
      await fetch(`${API_BASE_URL}/ai/report/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: report?.title || incidentId,
          content: `[6W1H]\nWho: ${report?.who}\nWhen: ${report?.when}\nWhere: ${report?.where}\nWhat: ${report?.what}\nWhy: ${report?.why}\nHow: ${report?.how}\n\n[메모]\n${memo}`,
        }),
      });
      alert(`보고서가 전파되었으며 지식DB 학습이 시작되었습니다.`);
      navigate('/dashboard');
    } catch {
      alert('전송에 실패했습니다.');
    }
  };

  const tabs = [
    { id: 'summary',   label: 'AI 분석 요약' },
    { id: '6w1h',      label: '6W1H 분석' },
    { id: 'agents',    label: 'Agent 로그' },
    { id: 'chat',      label: '채팅 기록' },
    { id: 'files',     label: '첨부파일' },
    { id: 'ai_report', label: '✨ AI 종합보고서' },
  ];

  const sev = report?.severity || 'NORMAL';
  const sevClass = severityColors[sev] || severityColors.NORMAL;

  return (
    <div className="min-h-screen bg-[#0a0d14] text-white font-sans flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 sticky top-0 bg-[#0a0d14]/90 backdrop-blur-lg z-50 border-b border-white/5">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-white/5 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </button>
        <div className="flex flex-col items-center flex-1 mx-3">
          {report ? (
            <>
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`text-[10px] font-black px-2 py-0.5 rounded border uppercase tracking-tighter ${sevClass}`}>
                  {sev}
                </span>
                <span className="text-[11px] text-slate-500 font-mono">{incidentId?.slice(-10)}</span>
              </div>
              <h1 className="font-bold text-sm text-slate-200 truncate max-w-[220px] text-center">
                {report.title}
              </h1>
            </>
          ) : (
            <span className="text-sm text-slate-400">장애 보고서</span>
          )}
        </div>
        <button className="p-2 rounded-full hover:bg-white/5 transition-colors">
          <Share2 className="w-5 h-5 text-slate-400" />
        </button>
      </header>

      {/* Stats Bar */}
      {report && (
        <div className="flex items-center justify-around px-4 py-2 bg-[#0f1421] border-b border-white/5 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            <span>{report.created_at?.slice(0, 16) || '-'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
            <span>채팅 {report.message_count}건</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Paperclip className="w-3.5 h-3.5 text-purple-400" />
            <span>첨부 {report.attachment_count}건</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-amber-400" />
            <span>{report.duration_min}분 소요</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-white/5 bg-[#0a0d14] sticky top-[57px] z-40">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2.5 text-xs font-bold whitespace-nowrap transition-all border-b-2 ${
              activeTab === t.id
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <main className="flex-1 px-4 py-4 mb-28 overflow-y-auto">
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-400">
            <div className="w-10 h-10 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            <span className="text-sm">데이터 로드 중...</span>
          </div>
        )}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">{error}</div>
        )}
        {report && !loading && (
          <>
            {/* ── AI 분석 요약 ── */}
            {activeTab === 'summary' && (
              <div className="space-y-4 animate-in fade-in duration-300">
                {/* S-Autopilot Insight */}
                {report.autopilot_insight && (
                  <section className="bg-[#0f1421] rounded-2xl border border-blue-500/10 overflow-hidden">
                    <div className="px-4 py-2.5 flex items-center gap-2 border-b border-white/5 bg-blue-500/5">
                      <Sparkles className="w-4 h-4 text-blue-400" />
                      <span className="text-xs font-bold text-blue-400">S-Autopilot Insight</span>
                    </div>
                    <div className="p-4">
                      <MarkdownBlock text={report.autopilot_insight} />
                    </div>
                  </section>
                )}
                {/* Leader Summary */}
                {report.leader_summary && (
                  <section className="bg-[#0f1421] rounded-2xl border border-amber-500/10 overflow-hidden">
                    <div className="px-4 py-2.5 flex items-center gap-2 border-b border-white/5 bg-amber-500/5">
                      <Bot className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-bold text-amber-400">Leader Agent 종합 요약</span>
                    </div>
                    <div className="p-4">
                      <MarkdownBlock text={report.leader_summary} />
                    </div>
                  </section>
                )}
                {!report.autopilot_insight && !report.leader_summary && (
                  <div className="text-center py-10 text-slate-500 text-sm">분석 데이터가 없습니다.</div>
                )}

                {/* Memo */}
                <section className="bg-[#0f1421] rounded-2xl border border-white/5 overflow-hidden">
                  <div className="px-4 py-2.5 flex items-center gap-2 border-b border-white/5">
                    <MessageSquare className="w-4 h-4 text-slate-400" />
                    <span className="text-xs font-bold text-slate-400">처리자 메모 (지식DB 학습 데이터)</span>
                  </div>
                  <div className="p-4">
                    <textarea
                      value={memo}
                      onChange={e => setMemo(e.target.value)}
                      placeholder="장애 처리 과정에 대한 추가 코멘트를 입력하세요..."
                      className="w-full h-28 bg-transparent text-slate-300 text-sm outline-none resize-none placeholder:text-slate-600 leading-relaxed"
                    />
                  </div>
                </section>
              </div>
            )}

            {/* ── 6W1H ── */}
            {activeTab === '6w1h' && (
              <div className="space-y-3 animate-in fade-in duration-300">
                {[
                  { label: 'WHO (담당자)', value: report.who, color: 'text-blue-400' },
                  { label: 'WHEN (발생 일시)', value: report.when, color: 'text-purple-400' },
                  { label: 'WHERE (대상 시스템)', value: report.where, color: 'text-teal-400' },
                  { label: 'WHAT (장애 현상)', value: report.what, color: 'text-yellow-400' },
                  { label: 'WHY (원인 분석)', value: report.why, color: 'text-red-400', wide: true },
                  { label: 'HOW (조치 방법)', value: report.how, color: 'text-emerald-400', wide: true },
                ].map(item => (
                  <div key={item.label} className="bg-[#0f1421] rounded-xl p-4 border border-white/5">
                    <span className={`text-[10px] font-black uppercase tracking-wider ${item.color}`}>{item.label}</span>
                    <div className="mt-1.5">
                      <MarkdownBlock text={item.value} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Agent 로그 ── */}
            {activeTab === 'agents' && (
              <div className="space-y-3 animate-in fade-in duration-300">
                {(report.agent_logs || []).length === 0 && (
                  <div className="text-center py-10 text-slate-500 text-sm">에이전트 로그가 없습니다.</div>
                )}
                {(report.agent_logs || []).map((log, i) => {
                  const cfg = agentColors[log.agent_role] || agentColors.Leader;
                  const Icon = cfg.icon;
                  return (
                    <div key={i} className={`rounded-xl border p-4 ${cfg.bg} ${cfg.border}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className={`w-4 h-4 ${cfg.text}`} />
                        <span className={`text-xs font-bold ${cfg.text}`}>{log.agent_role} Agent</span>
                        <span className="ml-auto text-[10px] text-slate-500">{log.reg_dt?.slice(0, 16)}</span>
                      </div>
                      <MarkdownBlock text={log.content} />
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── 채팅 기록 ── */}
            {activeTab === 'chat' && (
              <div className="space-y-2 animate-in fade-in duration-300">
                {(report.chat_logs || []).length === 0 && (
                  <div className="text-center py-10 text-slate-500 text-sm">채팅 기록이 없습니다.</div>
                )}
                {(report.chat_logs || []).map((msg, i) => (
                  <div key={i} className={`flex gap-2.5 ${msg.type === 'me' ? 'flex-row-reverse' : ''}`}>
                    <div className="w-7 h-7 rounded-lg bg-slate-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                      {(msg.sender || '?').slice(0, 2)}
                    </div>
                    <div className={`max-w-[75%] ${msg.type === 'me' ? 'items-end' : 'items-start'} flex flex-col`}>
                      <span className="text-[10px] text-slate-500 mb-0.5">{msg.sender} · {msg.timestamp?.slice(11, 16)}</span>
                      <div className={`px-3 py-2 rounded-xl text-xs leading-relaxed ${
                        msg.type === 'system' ? 'bg-slate-800/50 text-slate-400 italic' :
                        msg.type === 'me' ? 'bg-blue-600 text-white' : 'bg-[#1a2035] text-slate-200'
                      }`}>
                        {msg.text}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── 첨부파일 ── */}
            {activeTab === 'files' && (
              <div className="space-y-2 animate-in fade-in duration-300">
                {(report.attachments || []).length === 0 && (
                  <div className="text-center py-10 text-slate-500 text-sm">첨부파일이 없습니다.</div>
                )}
                {(report.attachments || []).map((att, i) => (
                  <a
                    key={i}
                    href={`${API_BASE_URL}${att.url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 bg-[#0f1421] rounded-xl p-4 border border-white/5 hover:border-blue-500/30 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-lg bg-blue-500/15 border border-blue-500/20 flex items-center justify-center shrink-0">
                      <Paperclip className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-200 truncate">{att.original_name}</p>
                      <p className="text-[10px] text-slate-500">{att.uploaded_by} · {att.timestamp?.slice(0, 16)}</p>
                    </div>
                    <span className="text-[10px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20 shrink-0">다운로드</span>
                  </a>
                ))}
              </div>
            )}

            {/* ── AI 종합보고서 ── */}
            {activeTab === 'ai_report' && (
              <div className="space-y-4 animate-in fade-in duration-300">
                {!aiGenText && !isGenerating && (
                  <div className="flex flex-col items-center justify-center py-16 gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center">
                      <Sparkles className="w-8 h-8 text-blue-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-slate-300 font-semibold">AI 종합 보고서 생성</p>
                      <p className="text-slate-500 text-sm mt-1">채팅 기록, 에이전트 분석, AI Insight를<br/>모두 참조하여 보고서를 생성합니다.</p>
                    </div>
                    <button
                      onClick={generateAiReport}
                      disabled={!report}
                      className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white text-sm font-bold rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-blue-900/30 active:scale-95"
                    >
                      <Sparkles className="w-4 h-4" />
                      보고서 생성 시작
                    </button>
                  </div>
                )}
                {isGenerating && !aiGenText && (
                  <div className="flex flex-col items-center justify-center py-16 gap-4 text-slate-400">
                    <div className="w-10 h-10 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                    <p className="text-sm">Dify AI가 분석 및 보고서 작성 중...</p>
                  </div>
                )}
                {aiGenText && (
                  <section className="bg-[#0f1421] rounded-2xl border border-blue-500/10 overflow-hidden">
                    <div className="px-4 py-2.5 flex items-center justify-between border-b border-white/5 bg-blue-500/5">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-blue-400" />
                        <span className="text-xs font-bold text-blue-400">AI 종합 장애 보고서 (Dify 생성)</span>
                        {isGenerating && <Loader className="w-3 h-3 text-blue-400 animate-spin ml-1" />}
                      </div>
                      <button
                        onClick={generateAiReport}
                        disabled={isGenerating}
                        className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors disabled:opacity-40"
                      >
                        <RefreshCw className="w-3 h-3" /> 재생성
                      </button>
                    </div>
                    <div className="p-4">
                      <MarkdownBlock text={aiGenText} />
                      {isGenerating && <span className="inline-block w-1.5 h-4 bg-blue-400 animate-pulse align-middle ml-0.5" />}
                    </div>
                  </section>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* Modal */}
      {modalStep && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => modalStep !== 'generating' && setModalStep(null)} />
          <div className="relative z-10 w-full max-w-lg bg-[#0f1219] rounded-t-3xl border border-white/10 overflow-hidden max-h-[80vh] flex flex-col">
            <div className="p-5 border-b border-white/5 flex items-center justify-between">
              <h3 className="font-bold text-white">
                {modalStep === 'preview' ? '📋 보고서 최종 확인' : '📤 보고 대상 선정'}
              </h3>
              <button onClick={() => setModalStep(null)} className="p-1.5 rounded-full hover:bg-white/10">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {modalStep === 'preview' ? (
                <div className="space-y-3 text-sm">
                  {[
                    { k: 'WHO', v: report?.who }, { k: 'WHEN', v: report?.when },
                    { k: 'WHERE', v: report?.where }, { k: 'WHAT', v: report?.what },
                    { k: 'WHY', v: report?.why }, { k: 'HOW', v: report?.how },
                  ].map(({ k, v }) => (
                    <div key={k} className="bg-[#161b24] rounded-xl p-3 border border-white/5">
                      <span className="text-[10px] text-slate-500 uppercase font-bold">{k}</span>
                      <p className="text-slate-300 mt-0.5 text-xs truncate">{v || '-'}</p>
                    </div>
                  ))}
                  {memo && <div className="bg-blue-500/10 rounded-xl p-3 border border-blue-500/20 text-blue-200 text-xs italic">"{memo}"</div>}
                </div>
              ) : (
                <div className="space-y-3">
                  {reportingLines.map(line => (
                    <div
                      key={line.id}
                      onClick={() => toggleLine(line.id)}
                      className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${
                        selectedLines.includes(line.id) ? 'bg-blue-600/10 border-blue-500' : 'bg-[#161b2a]/50 border-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selectedLines.includes(line.id) ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                          <User className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-sm text-slate-200">{line.role} {line.name}</p>
                          <p className="text-[10px] text-slate-500">{line.desc}</p>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${selectedLines.includes(line.id) ? 'bg-blue-600 border-blue-400' : 'border-slate-600'}`}>
                        {selectedLines.includes(line.id) && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-white/5 flex gap-3">
              <button
                onClick={() => modalStep === 'preview' ? setModalStep(null) : setModalStep('preview')}
                className="flex-1 h-12 rounded-2xl bg-slate-800 text-slate-300 text-sm font-bold hover:bg-slate-700 transition-all border border-white/5"
              >
                {modalStep === 'preview' ? '닫기' : '이전'}
              </button>
              <button
                onClick={() => modalStep === 'preview' ? setModalStep('selection') : (selectedLines.length > 0 && handleFinalSubmit())}
                disabled={modalStep === 'selection' && selectedLines.length === 0}
                className="flex-[1.5] h-12 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 text-white text-sm font-bold flex items-center justify-center gap-2 hover:from-blue-500 hover:to-blue-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {modalStep === 'preview' ? (<><span>보고라인 선택</span><ChevronRight className="w-4 h-4" /></>) : (<><span>최종 전송 ({selectedLines.length}명)</span><Send className="w-4 h-4" /></>)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 w-full p-4 bg-gradient-to-t from-[#0a0d14] to-transparent pt-8 flex gap-3 z-50">
        <button
          onClick={() => navigate(`/chat/${incidentId}`)}
          className="flex-1 h-13 bg-slate-800 hover:bg-slate-700 rounded-xl flex items-center justify-center gap-2 transition-all border border-white/5 py-3"
        >
          <MessageSquare className="w-4 h-4 text-slate-300" />
          <span className="font-bold text-slate-300 text-sm">War-Room 바로가기</span>
        </button>
        <button
          onClick={() => report && setModalStep('preview')}
          disabled={!report}
          className="flex-[1.2] h-13 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-900/20 text-white disabled:opacity-40 py-3"
        >
          <Send className="w-4 h-4" />
          <span className="font-bold text-sm">보고서 전송 및 지식DB 저장</span>
        </button>
      </footer>
    </div>
  );
}
