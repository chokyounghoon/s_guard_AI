import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Share2, Sparkles, AlertCircle, Settings, Clock, CheckCircle2, Download, Send } from 'lucide-react';

export default function AiReportPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0a0d14] text-white font-sans flex flex-col pb-24">
      {/* Header */}
      <header className="flex items-center justify-between p-5 sticky top-0 bg-[#0a0d14]/80 backdrop-blur-lg z-50">
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

      <main className="flex-1 px-5 py-2 space-y-8">
        
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
                {/* Error Code */}
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

                {/* Analysis detail */}
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
                {/* Timeline item 1 */}
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
                {/* Timeline item 2 */}
                <div className="relative">
                    <div className="absolute -left-[31px] top-1.5 w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-[#0a0d14]" />
                    <div className="space-y-1">
                        <span className="text-xs font-bold text-blue-500">14:05 - AI 분석 및 채팅 시작</span>
                        <p className="text-sm text-slate-400">S-Guard AI가 장애 로그 수집 및 분석 착수</p>
                    </div>
                </div>
                {/* Timeline item 3 */}
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
        <section className="space-y-4 pb-12">
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
      </main>

      {/* Footer Buttons */}
      <footer className="fixed bottom-0 left-0 w-full p-5 bg-gradient-to-t from-[#0a0d14] via-[#0a0d14] to-transparent pt-10 flex space-x-3 pointer-events-auto z-50">
        <button className="flex-1 bg-slate-800 hover:bg-slate-700 h-14 rounded-xl flex items-center justify-center space-x-2 transition-all active:scale-[0.98] border border-white/5">
            <Download className="w-5 h-5 text-slate-300" />
            <span className="font-bold text-slate-300">리포트 다운로드</span>
        </button>
        <button 
            onClick={() => {
                alert('상급자에게 리포트가 전송되었습니다.');
                navigate('/dashboard');
            }}
            className="flex-[1.2] bg-blue-600 hover:bg-blue-500 h-14 rounded-xl flex items-center justify-center space-x-2 transition-all active:scale-[0.98] shadow-lg shadow-blue-600/20 text-white"
        >
            <Send className="w-5 h-5" />
            <span className="font-bold">상급자 전송하기</span>
        </button>
      </footer>
    </div>
  );
}
