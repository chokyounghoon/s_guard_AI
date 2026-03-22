import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Share2, Sparkles, AlertCircle, Settings, Clock, CheckCircle2, Download, Send, MessageSquare, User, Check, ChevronRight, X, FileText, Search, TrendingUp } from 'lucide-react';
import SimilarIncidentCard from '../components/SimilarIncidentCard';

const API_BASE_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:8000'
  : 'https://api.chokerslab.store';

export default function AiReportPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const incidentId = location.state?.incidentId || 'INC-8823';

  const [memo, setMemo] = useState('');
  const [modalStep, setModalStep] = useState(null); // 'generating', 'preview', 'selection', or null
  const [selectedLines, setSelectedLines] = useState([]);
  const [showSimilarIncidents, setShowSimilarIncidents] = useState(false);
  
  const [reportData, setReportData] = useState({
    who: '',
    when: '',
    where: '',
    what: '',
    why: '',
    how: '',
    report_text: ''
  });

  const [isLoading, setIsLoading] = useState(false);

  // SSE typewriter state (streaming chunks -> char-by-char render)
  const reportQueueRef = useRef('');
  const reportTypingTimerRef = useRef(null);
  const reportAbortRef = useRef(null);

  const stopReportTypewriter = () => {
    if (reportTypingTimerRef.current) {
      clearInterval(reportTypingTimerRef.current);
      reportTypingTimerRef.current = null;
    }
    reportQueueRef.current = '';
  };

  const enqueueReportText = (text) => {
    if (!text) return;
    reportQueueRef.current += text;
    if (reportTypingTimerRef.current) return;

    reportTypingTimerRef.current = setInterval(() => {
      if (!reportQueueRef.current.length) {
        clearInterval(reportTypingTimerRef.current);
        reportTypingTimerRef.current = null;
        return;
      }
      const nextChar = reportQueueRef.current[0];
      reportQueueRef.current = reportQueueRef.current.slice(1);
      setReportData(prev => ({ ...prev, report_text: (prev.report_text || '') + nextChar }));
    }, 18);
  };

  // Mock Similar Incidents Data
  const similarIncidents = [
    {
      incidentId: "INC-2025-11-15",
      timestamp: "2025-11-15 14:32:00",
      title: "DB Connection Pool 고갈로 인한 서비스 지연",
      description: "대량 트래픽으로 DB Connection이 Max(200)에 도달하여 신규 요청 처리 불가 상태 발생. 응답 시간 150ms → 3500ms로 급증.",
      similarity: 95,
      resolution: "Connection Pool Size를 200→500으로 증설 및 Timeout 설정 최적화 (30s → 10s). 쿼리 최적화로 평균 응답 시간 180ms 달성.",
      resolutionTime: "23분",
      tags: ["DB", "Connection Pool", "Performance", "Timeout"]
    },
    {
      incidentId: "INC-2025-09-22",
      timestamp: "2025-09-22 09:15:00",
      title: "배치 프로세스 무한 루프로 CPU 100% 도달",
      description: "야간 배치 작업(batch_processor_v2) 실행 중 특정 데이터 처리 로직에서 무한 루프 발생. CPU 사용률 92% 이상 유지.",
      similarity: 88,
      resolution: "문제 코드 라인 식별 후 루프 탈출 조건 추가. 배치 작업 타임아웃 설정 강화 (무제한 → 120s). 모니터링 알림 규칙 추가.",
      resolutionTime: "1시간 15분",
      tags: ["Batch", "CPU", "Infinite Loop", "Memory Leak"]
    },
    {
      incidentId: "INC-2025-08-10",
      timestamp: "2025-08-10 16:45:00",
      title: "API Gateway Rate Limiting 미설정으로 DDoS 공격 영향",
      description: "특정 API 엔드포인트(/api/v2/search)에 대한 비정상 트래픽 급증 (초당 15,000 요청). Rate Limiting이 설정되지 않아 전체 서비스 영향.",
      similarity: 72,
      resolution: "API Gateway에 Rate Limiting 적용 (초당 100 요청). IP 기반 블랙리스트 추가. WAF 규칙 강화.",
      resolutionTime: "45분",
      tags: ["API", "Security", "DDoS", "Rate Limiting"]
    },
    {
      incidentId: "INC-2025-07-05",
      timestamp: "2025-07-05 11:20:00",
      title: "Redis 메모리 부족으로 캐싱 실패",
      description: "Redis 인스턴스의 메모리 사용률이 95%를 초과하여 캐싱 기능 중단. 데이터베이스 부하 급증으로 응답 시간 지연.",
      similarity: 68,
      resolution: "Redis 메모리 증설 (8GB → 16GB). TTL 정책 최적화 및 불필요한 캐시 데이터 정리. Eviction Policy 재설정.",
      resolutionTime: "2시간 10분",
      tags: ["Redis", "Cache", "Memory", "Performance"]
    }
  ];

  const reportingLines = [
    { id: 'leader', role: '팀장', name: '김철수 팀장', desc: '직속 상급자' },
    { id: 'director', role: '본부장', name: '이영희 본부장', desc: '부서 책임자' },
    { id: 'exec', role: '상무', name: '박지성 상무', desc: '사업부 임원' },
  ];

  const fetchAiReport = async () => {
    setModalStep('generating');
    try {
      // cancel previous stream if any
      if (reportAbortRef.current) reportAbortRef.current.abort();
      const controller = new AbortController();
      reportAbortRef.current = controller;

      stopReportTypewriter();
      setReportData(prev => ({ ...prev, report_text: '' }));

      const res = await fetch(`${API_BASE_URL}/ai/generate-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incident_id: incidentId }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE events split by blank line
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const evt of events) {
          const lines = evt.split('\n');
          for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            const dataStr = line.slice(5).trim();
            if (!dataStr) continue;
            if (dataStr === '[DONE]') {
              setModalStep('preview');
              stopReportTypewriter();
              return;
            }

            try {
              const data = JSON.parse(dataStr);
              if (data.error) {
                setReportData(prev => ({ ...prev, report_text: 'AI 분석이 지연되고 있습니다' }));
                setModalStep('preview');
                stopReportTypewriter();
                return;
              }
              if (data.answer) enqueueReportText(data.answer);
              if (data.final_report) {
                setReportData(prev => ({ ...prev, ...data.final_report, report_text: prev.report_text || '' }));
              }
            } catch (e) {
              // ignore non-JSON chunks
            }
          }
        }
      }

      setModalStep('preview');
    } catch (err) {
      console.error('Fetch report failed', err);
      setReportData(prev => ({ ...prev, report_text: 'AI 분석이 지연되고 있습니다' }));
      setModalStep('preview');
    }
  };

  useEffect(() => {
    return () => {
      try { if (reportAbortRef.current) reportAbortRef.current.abort(); } catch {}
      stopReportTypewriter();
    };
  }, []);

  const handleFinalSubmit = async () => {
    try {
      // Mapping reportData to ReportBroadcastRequest schema
      const broadcastPayload = {
        incident_id: incidentId,
        report_content: `
          [6W1H 분석 결과]
          Who: ${reportData.who}
          When: ${reportData.when}
          Where: ${reportData.where}
          What: ${reportData.what}
          Why: ${reportData.why}
          How: ${reportData.how}
          
          [상세 내용]
          ${reportData.report_text}
          
          [처리자 메모]
          ${memo}
        `,
        recipient_emails: selectedLines.map(lineId => {
          const line = reportingLines.find(l => l.id === lineId);
          // Mocking email addresses for the selected reporting lines
          return `${lineId}@sguard-internal.com`;
        })
      };

      const res = await fetch(`${API_BASE_URL}/ai/report/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(broadcastPayload),
      });

      if (res.ok) {
        alert(`${selectedLines.length}명의 상급자에게 보고서가 전파되었으며 지식베이스(RAG) 학습이 완료되었습니다.`);
        navigate('/dashboard');
      } else {
        alert('보고서 전파 중 오류가 발생했습니다.');
      }
    } catch (err) {
      console.error('Final submit failed', err);
      alert('서버와의 통신에 실패했습니다.');
    }
  };

  const toggleLine = (id) => {
    setSelectedLines(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="min-h-screen bg-[#0a0d14] text-white font-sans flex flex-col pb-24">
      {/* Header */}
      <header className="flex items-center justify-between p-5 sticky top-0 bg-[#0a0d14]/80 backdrop-blur-lg z-50 border-b border-white/5">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-white/5 transition-colors">
          <ArrowLeft className="w-6 h-6 text-slate-400" />
        </button>
        <div className="flex flex-col items-center">
            <div className="flex items-center space-x-2 mb-0.5">
                <span className="bg-red-500/20 text-red-500 text-[10px] font-black px-1.5 py-0.5 rounded border border-red-500/30 uppercase tracking-tighter">Critical</span>
                <span className="text-[11px] text-slate-500 font-mono tracking-tighter">SHB02681</span>
            </div>
            <h1 className="font-bold text-base tracking-tight text-slate-200 truncate max-w-[200px]">
                [신한카드] SHB02681 은행고객종합정...
            </h1>
        </div>
        <button className="p-2 rounded-full hover:bg-white/5 transition-colors">
          <Share2 className="w-6 h-6 text-slate-400" />
        </button>
      </header>

      <main className="flex-1 px-5 py-2 space-y-8 overflow-y-auto">
        {/* AI 분석 요약 */}
        <section className="space-y-4">
            <div className="flex items-center space-x-2 text-blue-400">
                <Sparkles className="w-5 h-5 fill-blue-400/20" />
                <h2 className="text-lg font-bold">AI 분석 요약</h2>
            </div>
            <div className="bg-[#161b2a] rounded-2xl p-6 border border-white/5 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl -z-0" />
                <p className="text-[15px] leading-relaxed text-slate-300 relative z-10 whitespace-pre-wrap">
                    {reportData.report_text || "보고서가 생성되지 않았습니다."}
                </p>
            </div>
        </section>

        {/* 6W1H 상세 분석 (Post-Mortem) */}
        <section className="space-y-4">
            <div className="flex items-center space-x-2 text-blue-400">
                <AlertCircle className="w-5 h-5" />
                <h2 className="text-lg font-bold">6W1H 상세 분석</h2>
            </div>
            <div className="bg-[#161b2a] rounded-2xl p-6 border border-white/5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Who (대상/담당)</span>
                    <p className="text-sm text-slate-200">{reportData.who || "-"}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">When (일시)</span>
                    <p className="text-sm text-slate-200">{reportData.when || "-"}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Where (위치/시스템)</span>
                    <p className="text-sm text-slate-200">{reportData.where || "-"}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">What (현상)</span>
                    <p className="text-sm text-slate-200">{reportData.what || "-"}</p>
                  </div>
                </div>
                <div className="space-y-1 pt-2 border-t border-white/5">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Why (원인)</span>
                  <p className="text-sm text-slate-200">{reportData.why || "-"}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">How (조치)</span>
                  <p className="text-sm text-slate-200">{reportData.how || "-"}</p>
                </div>
            </div>
        </section>

        {/* 처리자 메모 영역 */}
        <section className="space-y-4 pb-20">
            <div className="flex items-center space-x-2 text-blue-400">
                <MessageSquare className="w-5 h-5" />
                <h2 className="text-lg font-bold">처리자 메모 (Dify 학습 데이터 추가)</h2>
            </div>
            <div className="bg-[#161b2a] rounded-2xl p-4 border border-white/5 shadow-inner">
                <textarea 
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="장애 처리 과정에 대한 추가 코멘트를 입력하세요 (이 내용은 지식베이스 학습에 포함됩니다)..."
                  className="w-full h-32 bg-transparent text-slate-300 text-sm outline-none resize-none placeholder:text-slate-600 leading-relaxed"
                />
            </div>
        </section>
      </main>

      {/* Unified Multi-step Modal */}
      {modalStep && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-[#06080c]/95 backdrop-blur-md" onClick={() => modalStep !== 'generating' && setModalStep(null)} />
          
          {modalStep === 'generating' ? (
             <div className="relative z-10 flex flex-col items-center justify-center space-y-8 animate-in zoom-in-95 duration-500">
                <div className="relative">
                    <div className="w-24 h-24 rounded-full border-4 border-blue-500/30 border-t-blue-500 animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Sparkles className="w-10 h-10 text-blue-400 animate-pulse" />
                    </div>
                </div>
                <div className="text-center space-y-2">
                    <h3 className="text-2xl font-bold text-white tracking-tight">AI Report Generating...</h3>
                    <p className="text-slate-400 animate-pulse">Dify Cloud 엔진이 분석 중입니다...</p>
                </div>
             </div>
          ) : (
          <div className="bg-[#0f1219] w-full max-w-lg rounded-[2.5rem] border border-white/10 shadow-[0_0_50px_-12px_rgba(37,99,235,0.3)] relative z-10 overflow-hidden flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-blue-600/10 to-transparent">
              <div className="flex items-center space-x-3">
                <div className="bg-blue-600/20 p-2 rounded-xl border border-blue-500/30">
                  <FileText className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">
                    {modalStep === 'preview' ? '보고 내용 최종 확인' : '보고 대상 선정'}
                  </h3>
                  <p className="text-[10px] text-slate-500 font-mono">
                    {modalStep === 'preview' ? 'STEP 1: 리포트 검토' : 'STEP 2: 수신자 확인'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setModalStep(null)}
                className="p-2 rounded-full hover:bg-white/5 transition-colors group"
              >
                <X className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
              {modalStep === 'preview' ? (
                /* Step 1: Detailed Preview Content */
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                  <div className="bg-[#161b24] p-6 rounded-3xl border border-white/5 space-y-4">
                    <div className="pb-4 border-b border-white/5">
                      <h4 className="text-lg font-bold text-blue-400 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5" /> 6W1H 요약
                      </h4>
                    </div>
                    <div className="space-y-3">
                      <div><span className="text-[10px] text-slate-500 block uppercase">Who</span> <p className="text-sm text-slate-300">{reportData.who}</p></div>
                      <div><span className="text-[10px] text-slate-500 block uppercase">When</span> <p className="text-sm text-slate-300">{reportData.when}</p></div>
                      <div><span className="text-[10px] text-slate-500 block uppercase">Where</span> <p className="text-sm text-slate-300">{reportData.where}</p></div>
                      <div><span className="text-[10px] text-slate-500 block uppercase">What</span> <p className="text-sm text-slate-300">{reportData.what}</p></div>
                      <div><span className="text-[10px] text-slate-500 block uppercase">Why</span> <p className="text-sm text-slate-300">{reportData.why}</p></div>
                      <div><span className="text-[10px] text-slate-500 block uppercase">How</span> <p className="text-sm text-slate-300">{reportData.how}</p></div>
                    </div>
                  </div>
                  {memo && (
                    <div className="bg-blue-600/10 p-4 rounded-2xl border border-blue-500/20 italic text-sm text-blue-200">
                      "{memo}"
                    </div>
                  )}
                </div>
              ) : (
                /* Step 2: Recipient Selection Content */
                <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
                  <div className="text-center space-y-2">
                    <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-2 border border-blue-500/30">
                      <Send className="w-7 h-7 text-blue-400" />
                    </div>
                    <p className="text-sm text-slate-400">보고서를 전송할 상급자를 선택해주세요.</p>
                  </div>

                  <div className="space-y-3">
                    {reportingLines.map((line) => (
                      <div 
                        key={line.id}
                        onClick={() => toggleLine(line.id)}
                        className={`flex items-center justify-between p-5 rounded-3xl border transition-all cursor-pointer ${
                          selectedLines.includes(line.id) 
                            ? 'bg-blue-600/10 border-blue-500 shadow-xl shadow-blue-900/20' 
                            : 'bg-[#161b2a]/50 border-white/5 hover:border-white/10'
                        }`}
                      >
                        <div className="flex items-center space-x-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                             selectedLines.includes(line.id) ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
                          }`}>
                            <User className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-200 text-sm">{line.role} {line.name}</p>
                            <p className="text-[11px] text-slate-500 italic">{line.desc}</p>
                          </div>
                        </div>
                        <div className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all ${
                          selectedLines.includes(line.id) ? 'bg-blue-600 border-blue-400 scale-110' : 'border-slate-700'
                        }`}>
                          {selectedLines.includes(line.id) && <Check className="w-4 h-4 text-white" />}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-8 border-t border-white/5 bg-[#0a0d14] flex space-x-4">
              <button 
                onClick={() => modalStep === 'preview' ? setModalStep(null) : setModalStep('preview')}
                className="flex-1 bg-slate-800 hover:bg-slate-700 h-16 rounded-[1.25rem] font-bold text-slate-300 transition-all border border-white/10 active:scale-95 text-sm"
              >
                {modalStep === 'preview' ? '닫기' : '이전으로'}
              </button>
              <button 
                onClick={() => {
                  if (modalStep === 'preview') {
                    setModalStep('selection');
                  } else if (selectedLines.length > 0) {
                    handleFinalSubmit();
                  }
                }}
                disabled={modalStep === 'selection' && selectedLines.length === 0}
                className={`flex-[1.8] h-16 rounded-[1.25rem] font-bold text-white transition-all flex items-center justify-center space-x-3 active:scale-95 text-sm shadow-lg ${
                  modalStep === 'selection' && selectedLines.length === 0
                    ? 'bg-slate-800 opacity-50 cursor-not-allowed text-slate-500' 
                    : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-blue-600/20'
                }`}
              >
                <span>{modalStep === 'preview' ? '확인 및 보고라인 선택' : `보고서 최종 전송 (${selectedLines.length}명)`}</span>
                {modalStep === 'preview' ? <ChevronRight className="w-5 h-5" /> : <Send className="w-5 h-5" />}
              </button>
            </div>
          </div>
          )}
        </div>
      )}

      {/* Footer Buttons */}
      <footer className="fixed bottom-0 left-0 w-full p-5 bg-gradient-to-t from-[#0a0d14] via-[#0a0d14] to-transparent pt-10 flex space-x-3 pointer-events-auto z-50">
        <button 
          onClick={() => navigate(`/chat/${incidentId}`)}
          className="flex-1 bg-slate-800 hover:bg-slate-700 h-14 rounded-xl flex items-center justify-center space-x-2 transition-all active:scale-[0.98] border border-white/5"
        >
            <MessageSquare className="w-5 h-5 text-slate-300" />
            <span className="font-bold text-slate-300">War-Room 바로가기</span>
        </button>
        <button 
            onClick={fetchAiReport}
            className="flex-[1.2] bg-blue-600 hover:bg-blue-500 h-14 rounded-xl flex items-center justify-center space-x-2 transition-all active:scale-[0.98] shadow-lg shadow-blue-600/20 text-white"
        >
            <Sparkles className="w-5 h-5" />
            <span className="font-bold">보고서 생성 및 보고</span>
        </button>
      </footer>
    </div>
  );
}
