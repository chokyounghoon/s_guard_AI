import React, { useState, useEffect } from 'react';
import { Loader2, Zap, Database, BrainCircuit } from 'lucide-react';

export default function AIThinkingIndicator() {
  const [step, setStep] = useState(0);
  const steps = [
    { text: '인텐트 분석 및 문맥 파악 중...', icon: <BrainCircuit className="w-3.5 h-3.5 text-blue-400 animate-pulse" /> },
    { text: '지식 창고 및 과거 장애 이력 대조...', icon: <Database className="w-3.5 h-3.5 text-purple-400 animate-pulse" /> },
    { text: '최적의 해결 방안 추론 중...', icon: <Zap className="w-3.5 h-3.5 text-yellow-400 animate-pulse" /> }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setStep(prev => (prev === steps.length - 1 ? prev : prev + 1));
    }, 2500);
    return () => clearInterval(timer);
  }, [steps.length]);

  return (
    <div className="flex items-start space-x-3 mb-4 animate-in fade-in slide-in-from-left-4 duration-500">
      <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-[1px] shrink-0 shadow-lg shadow-purple-900/30">
        <div className="w-full h-full bg-[#1e2330] rounded-2xl flex items-center justify-center relative overflow-hidden">
          <Loader2 className="w-5 h-5 text-purple-300 animate-spin absolute z-10" />
          <div className="w-full h-full bg-gradient-to-tr from-purple-500/20 to-blue-500/20 animate-pulse absolute"></div>
        </div>
      </div>

      <div className="flex flex-col space-y-1.5 min-w-0 max-w-[85%]">
        <span className="text-[11px] font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400 tracking-wide">
          S-AUTOPILOT AI 추론 중
        </span>
        
        <div className="bg-slate-800/80 border border-white/5 rounded-2xl rounded-tl-none px-4 py-3 backdrop-blur-md shadow-sm">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-full bg-slate-900/80 shadow-inner">
              {steps[step].icon}
            </div>
            <span className="text-sm font-medium text-slate-300 truncate" style={{ animation: 'fadeIn 0.5s ease-in-out' }}>
              {steps[step].text}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
