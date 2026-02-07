import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Clock, FileText, Share2, Download, ChevronRight, Zap, Shield, AlertTriangle, X, Sparkles, User, Check, MessageSquare } from 'lucide-react';

export default function AiProcessReportPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [memo, setMemo] = useState('');
  const [modalStep, setModalStep] = useState(null); // 'preview', 'selection', or null
  const [selectedLines, setSelectedLines] = useState([]);

  const reportingLines = [
    { id: 'leader', role: '팀장', name: '김철수 팀장', desc: '직속 상급자' },
    { id: 'director', role: '본부장', name: '이영희 본부장', desc: '부서 책임자' },
    { id: 'exec', role: '상무', name: '박지성 상무', desc: '사업부 임원' },
  ];

  useEffect(() => {
    // Simulate report generation delay
    const timer = setTimeout(() => {
      setLoading(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const toggleLine = (id) => {
    setSelectedLines(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1421] text-white flex flex-col items-center justify-center space-y-6">
        <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
            <div className="absolute top-0 left-0 w-16 h-16 flex items-center justify-center">
                <Zap className="w-6 h-6 text-blue-400 animate-pulse" />
            </div>
        </div>
        <p className="text-lg font-medium text-blue-400 animate-pulse">AI가 대화 내용을 분석중입니다...</p>
        <p className="text-xs text-slate-500">장애 원인 및 처리 과정을 정리하고 있습니다.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1421] text-white font-sans flex flex-col pb-safe">
      {/* Header */}
      <header className="flex items-center p-4 sticky top-0 bg-[#0f1421]/90 backdrop-blur-md z-40 border-b border-white/5">
        <button onClick={() => navigate(-1)} className="p-1 rounded-full hover:bg-white/10 transition-colors mr-3">
          <ArrowLeft className="w-6 h-6 text-white" />
        </button>
        <span className="font-bold text-lg">AI 처리 분석 보고서</span>
      </header>

      <main className="flex-1 p-5 space-y-6 overflow-y-auto">
        {/* Summary Card */}
        <div className="bg-gradient-to-br from-blue-900/20 to-slate-900/40 rounded-3xl p-6 border border-blue-500/20 shadow-lg">
            <div className="flex items-start justify-between mb-4">
                <div>
                    <h2 className="text-xl font-bold text-white mb-1">INC-8823 장애 리포트</h2>
                    <p className="text-xs text-slate-400">2023년 10월 25일 14:00 생성됨</p>
                </div>
                <div className="bg-green-500/20 px-3 py-1 rounded-full border border-green-500/30 flex items-center space-x-1">
                    <CheckCircle className="w-3 h-3 text-green-400" />
                    <span className="text-xs font-bold text-green-400">조치 완료</span>
                </div>
            </div>
            
            <div className="space-y-4">
                <div className="bg-[#0f1421]/50 rounded-xl p-4 border border-white/5">
                    <h3 className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">이슈 요약 (Issue Summary)</h3>
                    <p className="text-sm text-slate-200 leading-relaxed">
                        Server-02에서 포트 8080 타임아웃 오류 발생. DB Connection Pool 고갈로 인한 연결 거부 현상 확인.
                    </p>
                </div>
            </div>
        </div>

        {/* Timeline Analysis */}
        <div className="space-y-4">
            <h3 className="text-lg font-bold flex items-center space-x-2">
                <Clock className="w-5 h-5 text-blue-400" />
                <span>처리 과정 타임라인</span>
            </h3>
            
            <div className="relative pl-6 border-l-2 border-slate-800 space-y-8 ml-2">
                {/* Step 1 */}
                <div className="relative">
                    <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-red-500 ring-4 ring-[#0f1421]"></div>
                    <div className="bg-[#1a1f2e] rounded-2xl p-4 border border-white/5">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-sm font-bold text-white">장애 감지 및 전파</span>
                            <span className="text-xs text-slate-500">13:42</span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            정도현 팀장이 Server-02 타임아웃 이슈 최초 공유.
                        </p>
                    </div>
                </div>

                {/* Step 2 */}
                <div className="relative">
                    <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-orange-500 ring-4 ring-[#0f1421]"></div>
                    <div className="bg-[#1a1f2e] rounded-2xl p-4 border border-white/5">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-sm font-bold text-white">원인 분석</span>
                            <span className="text-xs text-slate-500">13:45</span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            시스템 어드민이 로그 분석 수행. <span className="text-orange-400">java.net.ConnectException</span> 확인 및 DB Pool 이슈 진단.
                        </p>
                        <div className="mt-2 bg-black/30 rounded p-2 text-[10px] font-mono text-slate-300 border border-white/5">
                            Caused by: Connection refused
                        </div>
                    </div>
                </div>

                {/* Step 3 */}
                <div className="relative">
                    <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-blue-500 ring-4 ring-[#0f1421]"></div>
                    <div className="bg-[#1a1f2e] rounded-2xl p-4 border border-white/5">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-sm font-bold text-white">조치 시행</span>
                            <span className="text-xs text-slate-500">13:46</span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            담당자가 유휴 세션 초기화 작업 수행 및 모니터링 시작.
                        </p>
                    </div>
                </div>
            </div>
        </div>

        {/* AI Recommendations */}
        <div className="space-y-3 pt-2">
            <h3 className="text-lg font-bold flex items-center space-x-2">
                <Shield className="w-5 h-5 text-purple-400" />
                <span>AI 개선 권고안</span>
            </h3>
            <div className="bg-purple-900/10 rounded-2xl p-4 border border-purple-500/20">
                <ul className="space-y-3">
                    <li className="flex items-start space-x-2">
                        <div className="mt-0.5 w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0"></div>
                        <span className="text-xs text-slate-300">DB Connection Pool 최대치를 현재 100에서 200으로 증설 검토 필요.</span>
                    </li>
                    <li className="flex items-start space-x-2">
                        <div className="mt-0.5 w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0"></div>
                        <span className="text-xs text-slate-300">HikariCP 타임아웃 설정을 30초에서 15초로 단축하여 빠른 실패 유도.</span>
                    </li>
                </ul>
            </div>
        </div>
        {/* Operator Memo Section */}
        <section className="space-y-4 pb-20">
            <div className="flex items-center space-x-2 text-blue-400">
                <MessageSquare className="w-5 h-5" />
                <h2 className="text-lg font-bold">처리자 메모</h2>
            </div>
            <div className="bg-[#1a1f2e] rounded-2xl p-4 border border-white/5 shadow-inner">
                <textarea 
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="장애 처리 과정에 대한 추가 코멘트를 입력하세요..."
                  className="w-full h-32 bg-transparent text-slate-300 text-sm outline-none resize-none placeholder:text-slate-600 leading-relaxed"
                />
            </div>
        </section>
      </main>

      {/* Unified Multi-step Modal */}
      {modalStep && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-[#06080c]/95 backdrop-blur-md" onClick={() => setModalStep(null)} />
          
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
                <div className="space-y-10 animate-in slide-in-from-right-4 duration-500">
                  {/* Report Cover Style Title */}
                  <div className="text-center space-y-2 border-b border-white/5 pb-8">
                    <div className="inline-block bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20 mb-2">
                      <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Process Analysis Report</span>
                    </div>
                    <h4 className="text-2xl font-bold text-slate-100 tracking-tight leading-tight">
                      INC-8823 장애 분석 리포트<br/>생성 보고
                    </h4>
                    <div className="flex items-center justify-center space-x-4 pt-2">
                      <div className="flex items-center space-x-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-xs text-slate-500">2023-10-25 14:00</span>
                      </div>
                      <div className="w-1 h-1 rounded-full bg-slate-700" />
                      <span className="text-xs text-slate-500 font-medium tracking-tight">AI Engine v4.2</span>
                    </div>
                  </div>

                  {/* Summary Section */}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Sparkles className="w-4 h-4 text-blue-400" />
                      <h5 className="text-sm font-bold text-slate-200">이슈 요약</h5>
                    </div>
                    <div className="bg-[#161b24] p-5 rounded-3xl border border-white/5 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 blur-3xl rounded-full" />
                      <p className="text-[13px] text-slate-300 leading-relaxed relative z-10">
                        Server-02에서 포트 8080 타임아웃 오류 발생. <span className="text-blue-400 font-semibold underline decoration-blue-500/30 underline-offset-4">DB Connection Pool 고갈</span>로 인한 연결 거부 현상이 발생한 것으로 분석되었습니다.
                      </p>
                    </div>
                  </div>

                  {/* Timeline Section */}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Clock className="w-4 h-4 text-blue-400" />
                      <h5 className="text-sm font-bold text-slate-200">처리 과정 타임라인</h5>
                    </div>
                    <div className="relative ml-2 pl-5 border-l border-white/10 space-y-6 py-1">
                      <div className="relative">
                        <div className="absolute -left-[25.5px] top-1 w-2 h-2 rounded-full bg-red-500 ring-4 ring-[#0f1219]" />
                        <div className="space-y-0.5">
                          <span className="text-[11px] font-bold text-red-500">13:42 - 장애 감지 및 전파</span>
                          <p className="text-[11px] text-slate-400">정도현 팀장이 타임아웃 이슈 최초 공유</p>
                        </div>
                      </div>
                      <div className="relative">
                        <div className="absolute -left-[25.5px] top-1 w-2 h-2 rounded-full bg-orange-500 ring-4 ring-[#0f1219]" />
                        <div className="space-y-0.5">
                          <span className="text-[11px] font-bold text-orange-500">13:45 - 원인 분석</span>
                          <p className="text-[11px] text-slate-400">로그 분석 결과 DB Pool 이슈 진단</p>
                        </div>
                      </div>
                      <div className="relative">
                        <div className="absolute -left-[25.5px] top-1 w-2 h-2 rounded-full bg-blue-500 ring-4 ring-[#0f1219]" />
                        <div className="space-y-0.5">
                          <span className="text-[11px] font-bold text-blue-500">13:46 - 조치 시행</span>
                          <p className="text-[11px] text-slate-400">유휴 세션 초기화 작업 수행 완료</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* AI Recommendations Section */}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Shield className="w-4 h-4 text-purple-400" />
                      <h5 className="text-sm font-bold text-slate-200">AI 개선 권고안</h5>
                    </div>
                    <div className="space-y-2.5">
                      <div className="bg-[#161b24]/50 p-4 rounded-2xl border border-white/5 flex items-center space-x-3">
                        <div className="bg-purple-500/20 p-1.5 rounded-lg">
                          <CheckCircle className="w-4 h-4 text-purple-400" />
                        </div>
                        <span className="text-[12px] text-slate-300 font-medium">DB Connection Pool 증설 검토</span>
                      </div>
                      <div className="bg-[#161b24]/50 p-4 rounded-2xl border border-white/5 flex items-center space-x-3">
                        <div className="bg-purple-500/20 p-1.5 rounded-lg">
                          <CheckCircle className="w-4 h-4 text-purple-400" />
                        </div>
                        <span className="text-[12px] text-slate-300 font-medium">HikariCP 타임아웃 설정 최적화</span>
                      </div>
                    </div>
                  </div>

                  {/* Memo Section */}
                  {memo && (
                    <div className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <MessageSquare className="w-4 h-4 text-blue-400" />
                        <h5 className="text-sm font-bold text-slate-200">처리자 의견 (Additional Remarks)</h5>
                      </div>
                      <div className="bg-blue-600/10 p-5 rounded-3xl border border-blue-500/20 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                          <MessageSquare className="w-12 h-12 text-blue-400" />
                        </div>
                        <p className="text-[13px] text-blue-100 leading-relaxed font-medium italic">
                          "{memo}"
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Section: Channels */}
                  <div className="bg-slate-900/50 rounded-3xl p-5 border border-white/5 flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">전송 채널</span>
                    <div className="flex space-x-2">
                      <div className="bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20">
                        <span className="text-[10px] text-emerald-400 font-bold tracking-tighter uppercase">Push Notification</span>
                      </div>
                      <div className="bg-blue-500/10 px-3 py-1 rounded-lg border border-blue-500/20">
                        <span className="text-[10px] text-blue-400 font-bold tracking-tighter uppercase">Corporate Email</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Step 2: Recipient Selection Content */
                <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
                  <div className="text-center space-y-2">
                    <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-2 border border-blue-500/30">
                      <CheckCircle className="w-7 h-7 text-blue-400" />
                    </div>
                    <p className="text-sm text-slate-400">분석 보고서를 전송할 상급자를 선택해주세요.</p>
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
                    alert(`${selectedLines.length}명의 상급자에게 보고서가 전송되었습니다.\n완료 처리되었습니다.`);
                    navigate('/dashboard');
                  }
                }}
                disabled={modalStep === 'selection' && selectedLines.length === 0}
                className={`flex-[1.8] h-16 rounded-[1.25rem] font-bold text-white transition-all flex items-center justify-center space-x-3 active:scale-95 text-sm shadow-lg ${
                  modalStep === 'selection' && selectedLines.length === 0
                    ? 'bg-slate-800 opacity-50 cursor-not-allowed text-slate-500' 
                    : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-blue-600/20'
                }`}
              >
                <span>{modalStep === 'preview' ? '확인 및 보고라인 선택' : '보고서 최종 전송'}</span>
                {modalStep === 'preview' ? <ChevronRight className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Footer */}
      <div className="p-5 bg-gradient-to-t from-[#0f1421] to-transparent pt-10 sticky bottom-0">
        <button 
            onClick={() => setModalStep('preview')}
            className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl text-base hover:bg-blue-500 active:scale-[0.98] transition-all flex items-center justify-center space-x-3 shadow-lg shadow-blue-900/40"
        >
            <FileText className="w-5 h-5" />
            <span>분석 보고서 확인 및 전송</span>
        </button>
      </div>
    </div>
  );
}
