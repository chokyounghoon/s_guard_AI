import React from 'react';

export default function AIThinkingIndicator() {
  return (
    <div className="flex items-start space-x-3 animate-in fade-in slide-in-from-left-4 duration-300">
      {/* AI Avatar */}
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center font-bold text-sm shrink-0 shadow-lg shadow-purple-900/40 animate-pulse">
        <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" fill="currentColor" />
        </svg>
      </div>

      <div className="flex flex-col space-y-2">
        <span className="text-xs text-purple-400 font-bold">S-Autopilot AI</span>
        
        {/* Thinking Bubble */}
        <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 border border-purple-500/20 rounded-2xl rounded-tl-none px-4 py-3 shadow-xl backdrop-blur-sm">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-slate-400">AI가 분석 중</span>
            <div className="flex space-x-1">
              <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
