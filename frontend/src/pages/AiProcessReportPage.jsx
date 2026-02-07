import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Clock, FileText, Share2, Download, ChevronRight, Zap, Shield, AlertTriangle } from 'lucide-react';

export default function AiProcessReportPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate report generation delay
    const timer = setTimeout(() => {
      setLoading(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

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
      </main>

      {/* Action Footer */}
      <div className="p-5 bg-[#0f1421] border-t border-white/5">
        <button 
            onClick={() => navigate('/dashboard')}
            className="w-full bg-white text-black font-bold py-3.5 rounded-xl text-sm hover:bg-slate-200 transition-colors flex items-center justify-center space-x-2"
        >
            <FileText className="w-4 h-4" />
            <span>보고서 전송 및 종료</span>
        </button>
      </div>
    </div>
  );
}
