import React from 'react';
import { AlertTriangle, CheckCircle2, XCircle, ArrowRight, Zap } from 'lucide-react';

export default function EmergencyActionModal({ isOpen, onClose, onApprove, actionDetails }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#1a1f2e] border border-red-500/30 rounded-2xl w-full max-w-lg shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-300">
        
        {/* Background Effects */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-orange-500 to-red-500 animate-pulse"></div>
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-red-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="p-6">
          <div className="flex items-start space-x-4">
            <div className="p-3 bg-red-500/20 rounded-xl border border-red-500/30 animate-bounce">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            
            <div className="flex-1">
              <h2 className="text-xl font-bold text-white mb-1">긴급 조치 승인 요청</h2>
              <p className="text-sm text-slate-400 mb-4">
                S-Autopilot AI 리더가 시스템 안정화를 위해 다음과 같은 긴급 조치를 제안했습니다.
              </p>

              {/* Action Details Card */}
              <div className="bg-[#0f1421] rounded-xl border border-white/10 p-4 mb-6">
                <div className="flex items-center justify-between mb-3 pb-3 border-b border-white/5">
                   <span className="text-xs text-slate-500 uppercase tracking-wider">Action Type</span>
                   <span className="text-xs font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">CRITICAL MAINTENANCE</span>
                </div>
                
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-400">대상 서버</span>
                        <span className="text-sm font-mono text-white">WAS-Cluster-03</span>
                    </div>
                     <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-400">작업 내용</span>
                        <span className="text-sm font-bold text-white flex items-center">
                            <Zap className="w-3 h-3 text-yellow-400 mr-1.5" />
                            Force Restart (Graceful)
                        </span>
                    </div>
                     <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-400">예상 다운타임</span>
                        <span className="text-sm font-mono text-green-400">~3.2s</span>
                    </div>
                </div>
              </div>

              {/* Impact Analysis */}
               <div className="mb-6">
                   <h4 className="text-xs font-bold text-slate-500 mb-2">예상 효과</h4>
                   <div className="flex items-center space-x-2 text-xs text-slate-300">
                       <CheckCircle2 className="w-4 h-4 text-green-500" />
                       <span>DB Connection Pool 반환 (0% -&gt; 100%)</span>
                   </div>
                   <div className="flex items-center space-x-2 text-xs text-slate-300 mt-1">
                       <CheckCircle2 className="w-4 h-4 text-green-500" />
                       <span>응답 시간 정상화 (3500ms -&gt; 150ms)</span>
                   </div>
               </div>

              <div className="flex space-x-3">
                <button 
                  onClick={onClose}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium transition-colors border border-white/5"
                >
                  나중에 하기
                </button>
                <button 
                  onClick={onApprove}
                  className="flex-[2] py-3 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white rounded-xl font-bold shadow-lg shadow-red-900/40 transition-all flex items-center justify-center group"
                >
                  <span>승인 및 즉시 실행</span>
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
