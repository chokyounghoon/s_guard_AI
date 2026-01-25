import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Clock, CheckCircle2, RefreshCw, ShieldCheck, Database } from 'lucide-react';

export default function AiReportPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0f1421] text-white font-sans flex flex-col pb-32">
      {/* Header */}
      <header className="flex items-center p-5 sticky top-0 bg-[#0f1421]/90 backdrop-blur-md z-40 border-b border-white/5">
        <button onClick={() => navigate(-1)} className="p-1 rounded-full hover:bg-white/10 transition-colors mr-4">
          <ArrowLeft className="w-6 h-6 text-white" />
        </button>
        <h1 className="font-bold text-xl tracking-tight flex-1 text-center pr-10">AI 자동 생성 리포트</h1>
      </header>

      <main className="flex-1 p-5 space-y-8">
        {/* Analysis Status */}
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <div className="relative">
               <div className="w-8 h-8 rounded-lg bg-blue-600/20 flex items-center justify-center">
                  <Database className="w-5 h-5 text-blue-500 fill-blue-500/20" />
               </div>
               <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full animate-ping opacity-75" />
            </div>
            <p className="text-[17px] font-medium text-slate-200">AI가 채팅 내용을 분석 중입니다...</p>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex-1 h-3 bg-slate-800 rounded-full overflow-hidden">
               <div className="h-full bg-blue-600 rounded-full w-[82%] relative">
                  <div className="absolute top-0 right-0 w-4 h-full bg-white/30 skew-x-12 animate-pulse" />
               </div>
            </div>
            <span className="text-blue-400 font-bold text-lg">82%</span>
          </div>
        </div>

        {/* Key Issue Summary Box */}
        <div className="bg-[#1a1f2e] rounded-3xl p-6 border border-white/5 shadow-2xl relative overflow-hidden group">
            {/* Ambient background glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl -z-0" />
            
            <div className="flex items-center space-x-2.5 mb-5">
                <div className="bg-blue-500/10 p-2 rounded-xl">
                   <Sparkles className="w-6 h-6 text-blue-400 fill-blue-400/10" />
                </div>
                <h2 className="text-xl font-bold">핵심 이슈 요약</h2>
            </div>
            
            <div className="space-y-4">
                <p className="text-[15px] leading-relaxed text-slate-300">
                  오후 2시경 발생한 <span className="text-blue-400 font-bold underline underline-offset-4 decoration-blue-500/30">DB 서버 과부하</span>로 인해 전체 결제 시스템에서 약 15분간 간헐적 지연이 발생했습니다. 초기 감지는 모니터링 알람을 통해 이루어졌으며, 트래픽 우회 처리를 통해 14:15분경 서비스가 정상화되었습니다.
                </p>
                
                <div className="h-px bg-white/5 my-6" />

                {/* Incident Timeline */}
                <div className="space-y-6">
                    <div className="flex items-center space-x-3">
                        <Clock className="w-5 h-5 text-slate-500" />
                        <h3 className="font-bold text-slate-200">장애 타임라인</h3>
                    </div>
                    
                    <div className="relative ml-2.5 pl-6 border-l border-slate-700 space-y-8 pb-2">
                        {/* Timeline Item 1 */}
                        <div className="relative">
                            <div className="absolute -left-[31px] top-1.5 w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-[#1a1f2e]" />
                            <div className="space-y-1">
                                <span className="text-xs font-bold text-blue-500">14:02</span>
                                <p className="text-sm text-slate-300">DB Connection Pool 임계치 초과 알람 발생</p>
                            </div>
                        </div>
                        {/* Timeline Item 2 */}
                        <div className="relative">
                            <div className="absolute -left-[31px] top-1.5 w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-[#1a1f2e]" />
                            <div className="space-y-1">
                                <span className="text-xs font-bold text-blue-500">14:07</span>
                                <p className="text-sm text-slate-300">데브옵스팀 이슈 확인 및 분석 착수</p>
                            </div>
                        </div>
                        {/* Timeline Item 3 */}
                        <div className="relative">
                            <div className="absolute -left-[31px] top-1.5 w-2.5 h-2.5 rounded-full bg-slate-600 ring-4 ring-[#1a1f2e]" />
                            <div className="space-y-1">
                                <span className="text-xs font-bold text-slate-500">14:15</span>
                                <p className="text-sm text-slate-400">읽기 전용 DB 분산을 통한 부하 완화 조치</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="h-px bg-white/5 my-6" />

                {/* Major Actions */}
                <div className="space-y-6">
                    <div className="flex items-center space-x-3">
                         <div className="bg-blue-600/20 p-1.5 rounded-lg">
                            <CheckCircle2 className="w-5 h-5 text-blue-400" />
                         </div>
                        <h3 className="font-bold text-slate-200 uppercase tracking-wide">주요 조치 사항</h3>
                    </div>
                    
                    <ul className="space-y-4 ml-1">
                        <li className="flex items-center space-x-3">
                            <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                                <CheckCircle2 className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-sm text-slate-200">실시간 트래픽 모니터링 대시보드 강화</span>
                        </li>
                        <li className="flex items-center space-x-3">
                            <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                                <CheckCircle2 className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-sm text-slate-200">DB 인스턴스 스케일 아웃 및 쿼리 최적화</span>
                        </li>
                        <li className="flex items-center space-x-3 opacity-60">
                            <div className="w-6 h-6 rounded-full border-2 border-slate-700 flex items-center justify-center shrink-0" />
                            <span className="text-sm text-slate-400">로그 보존 정책 확대 적용</span>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
      </main>

      {/* Floating Action Buttons */}
      <div className="fixed bottom-8 left-0 w-full px-5 flex items-center space-x-3 z-50">
        <button className="flex items-center justify-center space-x-2 bg-slate-800/80 backdrop-blur-md border border-white/10 px-6 h-16 rounded-2xl hover:bg-slate-700 transition-all active:scale-95 shadow-xl">
            <RefreshCw className="w-5 h-5 text-slate-300" />
            <span className="font-bold text-slate-200">다시 생성</span>
        </button>
        <button 
            onClick={() => navigate('/report-publish')}
            className="flex-1 flex items-center justify-center space-x-3 bg-blue-600 hover:bg-blue-500 h-16 rounded-2xl transition-all active:scale-[0.98] shadow-2xl shadow-blue-900/50"
        >
            <ShieldCheck className="w-6 h-6 text-white" />
            <span className="font-bold text-lg text-white">검토 및 발행</span>
        </button>
      </div>

    </div>
  );
}
