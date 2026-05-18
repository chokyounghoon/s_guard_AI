import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useBackNavigation } from '../hooks/useBackNavigation';
import { X, Check, FileText, Mail } from 'lucide-react';

export default function ReportPublishPage() {
  const navigate = useNavigate();
  const goBack = useBackNavigation('/dashboard');

  return (
    <div className="min-h-screen bg-[#0f1421] text-white font-sans flex flex-col pb-24">
      {/* Header */}
      <header className="flex items-center justify-between p-5 sticky top-0 bg-[#0f1421]/90 backdrop-blur-md z-40 border-b border-white/5">
        <button onClick={() => goBack()} className="p-1 rounded-full hover:bg-white/10 transition-colors">
          <X className="w-6 h-6 text-white" />
        </button>
        <h1 className="font-bold text-xl tracking-tight">보고서 전송</h1>
        <div className="w-8" /> {/* Spacer */}
      </header>

      <main className="flex-1 p-6 space-y-10 flex flex-col items-center">
        {/* Success Icon */}
        <div className="mt-4">
            <div className="w-24 h-24 rounded-full bg-blue-600/20 flex items-center justify-center relative">
                <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/40">
                    <Check className="w-10 h-10 text-white stroke-[3px]" />
                </div>
            </div>
        </div>

        {/* Status Message */}
        <div className="text-center space-y-3">
            <h2 className="text-3xl font-bold tracking-tight">보고서 발행이 완료되었습니다.</h2>
            <p className="text-slate-400 text-sm leading-relaxed max-w-[280px] mx-auto">
                생성된 AI 보고서를 상급자에게 전송할 준비가 되었습니다.
            </p>
        </div>

        {/* Recipient Section */}
        <div className="w-full space-y-5">
            <h3 className="text-lg font-bold text-slate-200">상급자 전송</h3>
            
            <div className="space-y-3">
                {/* Recipient 1 */}
                <div className="flex items-center justify-between bg-[#1a1f2e] p-4 rounded-2xl border border-white/5">
                    <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
                            <Check className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-white">팀장</p>
                            <p className="text-xs text-slate-400">김철수 팀장</p>
                        </div>
                    </div>
                    <span className="text-[11px] font-bold text-blue-500 bg-blue-600/10 px-2.5 py-1 rounded-md border border-blue-500/20">승인됨</span>
                </div>

                {/* Recipient 2 */}
                <div className="flex items-center justify-between bg-[#1a1f2e]/50 p-4 rounded-2xl border border-white/5 opacity-80">
                    <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center border border-white/10">
                            <div className="w-5 h-5 rounded-full bg-slate-700" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-white">본부장</p>
                            <p className="text-xs text-slate-400">이영희 본부장</p>
                        </div>
                    </div>
                    <span className="text-[11px] font-medium text-slate-500">전송 예정</span>
                </div>

                {/* Recipient 3 */}
                <div className="flex items-center justify-between bg-[#1a1f2e]/50 p-4 rounded-2xl border border-white/5 opacity-80">
                    <div className="flex items-center space-x-4">
                         <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center border border-white/10">
                            <div className="w-5 h-5 rounded-full bg-slate-700" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-white">상무</p>
                            <p className="text-xs text-slate-400">박지성 상무</p>
                        </div>
                    </div>
                    <span className="text-[11px] font-medium text-slate-500">전송 예정</span>
                </div>
            </div>
        </div>

        {/* Info Box */}
        <div className="w-full bg-[#1a1f2e] rounded-2xl p-5 border border-white/5 space-y-6">
            <div className="flex items-start space-x-4">
                <div className="bg-blue-600/10 p-2 rounded-lg">
                    <FileText className="w-5 h-5 text-blue-500" />
                </div>
                <div className="space-y-1">
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">보고서 제목</p>
                    <p className="text-[13px] font-semibold text-slate-200">[신한카드] SHB02681_보안탐지_분석리포트</p>
                </div>
            </div>
            
            <div className="flex items-start space-x-4">
                <div className="bg-blue-600/10 p-2 rounded-lg">
                    <Mail className="w-5 h-5 text-blue-500" />
                </div>
                <div className="space-y-1">
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">전송 방식</p>
                    <p className="text-[13px] font-semibold text-slate-200">앱 푸시, 이메일 알림</p>
                </div>
            </div>
        </div>

        {/* Buttons */}
        <div className="w-full space-y-3 pt-4">
            <button 
                onClick={() => {
                    alert('정상 등록되었습니다.');
                    navigate('/dashboard');
                }}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white h-14 rounded-2xl font-bold text-lg shadow-xl shadow-blue-900/30 transition-all active:scale-[0.98]"
            >
                최종 전송하기
            </button>
            <button onClick={() => goBack()} className="w-full bg-transparent border border-white/10 text-slate-400 h-14 rounded-2xl font-bold text-lg hover:bg-white/5 transition-all">
                취소
            </button>
        </div>
      </main>
    </div>
  );
}
