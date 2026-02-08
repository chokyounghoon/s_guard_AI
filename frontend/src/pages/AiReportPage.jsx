import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Share2, Sparkles, AlertCircle, Settings, Clock, CheckCircle2, Download, Send, MessageSquare, User, Check, ChevronRight, X, FileText, Search, TrendingUp } from 'lucide-react';
import SimilarIncidentCard from '../components/SimilarIncidentCard';

export default function AiReportPage() {
  const navigate = useNavigate();
  const [memo, setMemo] = useState('');
  const [modalStep, setModalStep] = useState(null); // 'preview', 'selection', or null
  const [selectedLines, setSelectedLines] = useState([]);
  const [showSimilarIncidents, setShowSimilarIncidents] = useState(false);

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
                <p className="text-[15px] leading-relaxed text-slate-300 relative z-10">
                    본 장애는 <span className="text-blue-400 font-bold">송금 처리 로직의 임계치 설정 오류</span>로 인해 발생하였습니다. 특정 시간대 트래픽 급증 시, 사전에 설정된 안전 임계값을 초과하는 요청들이 거부되면서 대규모 거래 중단 현상이 발생한 것으로 분석됩니다.
                </p>
            </div>
        </section>

        {/* 근본 원인 분석 */}
        <section className="space-y-4">
            <div className="flex items-center space-x-2 text-blue-400">
                <AlertCircle className="w-5 h-5" />
                <h2 className="text-lg font-bold">근본 원인 분석</h2>
            </div>
            <div className="bg-[#161b2a] rounded-2xl p-6 border border-white/5 space-y-6">
                <div className="flex items-start space-x-4">
                    <div className="bg-red-500/10 p-2.5 rounded-xl mt-1">
                        <AlertCircle className="w-5 h-5 text-red-500" />
                    </div>
                    <div className="space-y-1.5">
                        <span className="text-xs text-slate-500 font-medium">에러 코드</span>
                        <div className="bg-red-900/20 text-red-400 px-3 py-1.5 rounded-lg border border-red-500/20 text-sm font-bold font-mono inline-block">
                            ERR_LIMIT_EXCEEDED
                        </div>
                    </div>
                </div>
                <div className="flex items-start space-x-4">
                    <div className="bg-blue-500/10 p-2.5 rounded-xl mt-1">
                        <Settings className="w-5 h-5 text-blue-500" />
                    </div>
                    <div className="space-y-1.5">
                        <span className="text-xs text-slate-500 font-medium">분석 내용</span>
                        <p className="text-sm text-slate-300 leading-relaxed">
                            구성 파일(<span className="text-blue-400 font-mono">config-v2.yaml</span>) 내의 트래픽 제어 파라미터가 구형 서버 기준으로 고정되어 있어, 신규 클라우드 인프라의 확장성을 반영하지 못함.
                        </p>
                    </div>
                </div>
            </div>
        </section>

        {/* 장애 대응 타임라인 */}
        <section className="space-y-4">
            <div className="flex items-center space-x-2 text-blue-400">
                <Clock className="w-5 h-5" />
                <h2 className="text-lg font-bold">장애 대응 타임라인</h2>
            </div>
            <div className="relative ml-2 pl-6 border-l border-white/5 space-y-8 py-2">
                <div className="relative">
                    <div className="absolute -left-[31px] top-1.5 w-2.5 h-2.5 rounded-full bg-red-500 ring-4 ring-[#0a0d14]" />
                    <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-red-500">14:02 - 장애 발생 및 감지</span>
                            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono ml-auto">오후 08:25:00</span>
                        </div>
                        <p className="text-sm text-slate-400">시스템 대시보드 내 송금 실패율 15% 도달</p>
                    </div>
                </div>
                <div className="relative">
                    <div className="absolute -left-[31px] top-1.5 w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-[#0a0d14]" />
                    <div className="space-y-1">
                        <span className="text-xs font-bold text-blue-500">14:05 - AI 분석 및 채팅 시작</span>
                        <p className="text-sm text-slate-400">S-Guard AI가 장애 로그 수집 및 분석 착수</p>
                    </div>
                </div>
                <div className="relative">
                    <div className="absolute -left-[31px] top-1.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-[#0a0d14]" />
                    <div className="space-y-1">
                        <span className="text-xs font-bold text-emerald-500">14:15 - 조치 완료</span>
                        <p className="text-sm text-slate-400">임계값 긴급 상향 패치 및 서비스 정상화</p>
                    </div>
                </div>
            </div>
        </section>

        {/* AI 추천 조치 */}
        <section className="space-y-4 pb-6">
            <div className="flex items-center space-x-2 text-blue-400">
                <Sparkles className="w-5 h-5" />
                <h2 className="text-lg font-bold">AI 추천 조치</h2>
            </div>
            <div className="space-y-3">
                <div className="bg-[#161b2a] p-4 rounded-xl border border-white/5 flex items-center space-x-3 group hover:border-blue-500/30 transition-colors">
                    <div className="bg-blue-500/20 p-2 rounded-lg">
                        <CheckCircle2 className="w-5 h-5 text-blue-400" />
                    </div>
                    <span className="text-sm text-slate-200 font-medium">다이내믹 임계치(Dynamic Threshold) 시스템 도입</span>
                </div>
                <div className="bg-[#161b2a] p-4 rounded-xl border border-white/5 flex items-center space-x-3 group hover:border-blue-500/30 transition-colors">
                    <div className="bg-blue-500/20 p-2 rounded-lg">
                        <CheckCircle2 className="w-5 h-5 text-blue-400" />
                    </div>
                    <span className="text-sm text-slate-200 font-medium">인프라 사양 연동형 설정 자동 업데이트 적용</span>
                </div>
            </div>
        </section>

        {/* 유사 장애 이력 검색 (RAG-based) */}
        <section className="space-y-4 pb-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-purple-400">
                    <TrendingUp className="w-5 h-5" />
                    <h2 className="text-lg font-bold">과거 유사 장애 이력</h2>
                </div>
                <button
                    onClick={() => setShowSimilarIncidents(!showSimilarIncidents)}
                    className="px-4 py-2 bg-purple-600/20 hover:bg-purple-600 text-purple-400 hover:text-white border border-purple-500/30 hover:border-purple-500 rounded-xl text-xs font-bold transition-all flex items-center space-x-2"
                >
                    <Search className="w-4 h-4" />
                    <span>{showSimilarIncidents ? '검색 결과 숨기기' : '유사 장애 검색'}</span>
                </button>
            </div>

            {showSimilarIncidents && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 border border-purple-500/20 rounded-2xl p-4">
                        <p className="text-xs text-purple-300 leading-relaxed">
                            <span className="font-bold">AI 분석:</span> 현재 장애와 유사한 과거 사례 {similarIncidents.length}건을 발견했습니다. 
                            유사도가 높은 순서대로 정렬되어 있으며, 각 사례의 조치 방법을 참고하실 수 있습니다.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {similarIncidents.map((incident, index) => (
                            <SimilarIncidentCard 
                                key={index}
                                incident={incident}
                                onApply={(incident) => {
                                    setMemo(prev => prev + `\n\n[유사 사례 ${incident.incidentId} 조치 방법 적용]\n${incident.resolution}`);
                                    alert(`조치 방법이 처리자 메모에 추가되었습니다.`);
                                }}
                            />
                        ))}
                    </div>
                </div>
            )}
        </section>

        {/* 처리자 메모 영역 */}
        <section className="space-y-4 pb-20">
            <div className="flex items-center space-x-2 text-blue-400">
                <MessageSquare className="w-5 h-5" />
                <h2 className="text-lg font-bold">처리자 메모</h2>
            </div>
            <div className="bg-[#161b2a] rounded-2xl p-4 border border-white/5 shadow-inner">
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
                    <div className="h-6 overflow-hidden relative">
                         <div className="animate-slide-up-fade text-slate-400 text-sm font-mono">
                            <p className="animate-pulse">Analyzing System Logs...</p>
                            <p className="animate-pulse delay-75">Summarizing Root Causes...</p>
                            <p className="animate-pulse delay-150">Drafting Executive Summary...</p>
                         </div>
                    </div>
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
                <div className="space-y-10 animate-in slide-in-from-right-4 duration-500">
                  {/* Report Cover Style Title */}
                  <div className="text-center space-y-2 border-b border-white/5 pb-8">
                    <div className="inline-block bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20 mb-2">
                      <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Incident Report</span>
                    </div>
                    <h4 className="text-2xl font-bold text-slate-100 tracking-tight leading-tight">
                      [신한카드] SHB02681<br/>보안탐지 분석 리포트
                    </h4>
                    <div className="flex items-center justify-center space-x-4 pt-2">
                      <div className="flex items-center space-x-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-xs text-slate-500">2026-02-07 18:45</span>
                      </div>
                      <div className="w-1 h-1 rounded-full bg-slate-700" />
                      <span className="text-xs text-slate-500 font-medium tracking-tight">AI Engine v4.2</span>
                    </div>
                  </div>

                  {/* AI Summary Section */}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Sparkles className="w-4 h-4 text-blue-400" />
                      <h5 className="text-sm font-bold text-slate-200">AI 분석 요약</h5>
                    </div>
                    <div className="bg-[#161b24] p-5 rounded-3xl border border-white/5 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 blur-3xl rounded-full" />
                      <p className="text-[13px] text-slate-300 leading-relaxed relative z-10">
                        본 장애는 <span className="text-blue-400 font-semibold underline decoration-blue-500/30 underline-offset-4">송금 처리 로직의 임계치 설정 오류</span>로 인해 발생하였습니다. 특정 시간대 트래픽 급증 시 요청이 거부되면서 서비스 지연이 발생한 것으로 분석됩니다.
                      </p>
                    </div>
                  </div>

                  {/* Root Cause Section */}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <AlertCircle className="w-4 h-4 text-blue-400" />
                      <h5 className="text-sm font-bold text-slate-200">근본 원인 및 진단</h5>
                    </div>
                    <div className="bg-[#161b24]/50 p-5 rounded-3xl border border-white/5 space-y-5">
                      <div className="flex items-start space-x-4">
                        <div className="bg-red-500/10 p-2 rounded-lg mt-0.5">
                          <AlertCircle className="w-4 h-4 text-red-500" />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-500 font-bold uppercase">에러 코드</span>
                          <p className="text-xs font-mono text-red-400 font-bold">ERR_LIMIT_EXCEEDED</p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-4">
                        <div className="bg-blue-500/10 p-2 rounded-lg mt-0.5">
                          <Settings className="w-4 h-4 text-blue-400" />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-500 font-bold uppercase">분석 내용</span>
                          <p className="text-[12px] text-slate-300 leading-relaxed">
                            구성 파일(<span className="text-blue-400 font-mono">config-v2.yaml</span>) 내의 트래픽 제어 파라미터가 구형 서버 기준으로 고정되어 있음.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Timeline Section */}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Clock className="w-4 h-4 text-blue-400" />
                      <h5 className="text-sm font-bold text-slate-200">장애 대응 타임라인</h5>
                    </div>
                    <div className="relative ml-2 pl-5 border-l border-white/10 space-y-6 py-1">
                      <div className="relative">
                        <div className="absolute -left-[25.5px] top-1 w-2 h-2 rounded-full bg-red-500 ring-4 ring-[#0f1219]" />
                        <div className="space-y-0.5">
                          <span className="text-[11px] font-bold text-red-500">14:02 - 장애 발생 및 감지</span>
                          <p className="text-[11px] text-slate-400">송금 실패율 15% 도달</p>
                        </div>
                      </div>
                      <div className="relative">
                        <div className="absolute -left-[25.5px] top-1 w-2 h-2 rounded-full bg-blue-500 ring-4 ring-[#0f1219]" />
                        <div className="space-y-0.5">
                          <span className="text-[11px] font-bold text-blue-500">14:05 - AI 분석 및 채팅 시작</span>
                          <p className="text-[11px] text-slate-400">로그 수집 및 분석 착수</p>
                        </div>
                      </div>
                      <div className="relative">
                        <div className="absolute -left-[25.5px] top-1 w-2 h-2 rounded-full bg-emerald-500 ring-4 ring-[#0f1219]" />
                        <div className="space-y-0.5">
                          <span className="text-[11px] font-bold text-emerald-500">14:15 - 조치 완료</span>
                          <p className="text-[11px] text-slate-400">임계값 긴급 상향 패치 완료</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* AI Recommendations Section */}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Sparkles className="w-4 h-4 text-blue-400" />
                      <h5 className="text-sm font-bold text-slate-200">AI 추천 조치</h5>
                    </div>
                    <div className="space-y-2.5">
                      <div className="bg-[#161b24]/50 p-4 rounded-2xl border border-white/5 flex items-center space-x-3">
                        <div className="bg-blue-500/20 p-1.5 rounded-lg">
                          <CheckCircle2 className="w-4 h-4 text-blue-400" />
                        </div>
                        <span className="text-[12px] text-slate-300 font-medium">다이내믹 임계치 시스템 도입</span>
                      </div>
                      <div className="bg-[#161b24]/50 p-4 rounded-2xl border border-white/5 flex items-center space-x-3">
                        <div className="bg-blue-500/20 p-1.5 rounded-lg">
                          <CheckCircle2 className="w-4 h-4 text-blue-400" />
                        </div>
                        <span className="text-[12px] text-slate-300 font-medium">인프라 사양 연동형 설정 업데이트</span>
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

                  <div className="bg-slate-900/40 p-5 rounded-3xl border border-white/5 space-y-3">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block border-b border-white/5 pb-2 mb-1">전송 채널 (자동 설정)</span>
                    <div className="flex gap-2">
                      <div className="bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20">
                        <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">S-Guard App (Push)</span>
                      </div>
                      <div className="bg-blue-500/10 px-3 py-1 rounded-lg border border-blue-500/20">
                        <span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">Corporate Mail</span>
                      </div>
                    </div>
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
          onClick={() => navigate('/chat')}
          className="flex-1 bg-slate-800 hover:bg-slate-700 h-14 rounded-xl flex items-center justify-center space-x-2 transition-all active:scale-[0.98] border border-white/5"
        >
            <MessageSquare className="w-5 h-5 text-slate-300" />
            <span className="font-bold text-slate-300">War-Room 바로가기</span>
        </button>
        <button 
            onClick={() => {
                setModalStep('generating');
                setTimeout(() => {
                    setModalStep('preview');
                }, 3000);
            }}
            className="flex-[1.2] bg-blue-600 hover:bg-blue-500 h-14 rounded-xl flex items-center justify-center space-x-2 transition-all active:scale-[0.98] shadow-lg shadow-blue-600/20 text-white"
        >
            <Sparkles className="w-5 h-5" />
            <span className="font-bold">보고서 생성 및 보고</span>
        </button>
      </footer>
    </div>
  );
}
