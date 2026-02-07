import React, { useState, useEffect } from 'react';
import { Brain, Sparkles, Activity, Cpu } from 'lucide-react';

// API URL 설정
const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:8000'
  : 'https://api.chokerslab.store';

export default function AiInsightPanel({ onLogReceived }) {
  const [insightData, setInsightData] = useState({
    status: 'active',
    learning_data_size: '12.5 TB',
    accuracy: '0%',
    current_log: { type: 'info', text: 'AI 엔진 연결 중...' }
  });
  
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(true);

  const fetchInsight_API = async () => {
    try {
      const API_URL = window.location.hostname === 'localhost' 
        ? 'http://localhost:8000/ai/insight'
        : 'https://api.chokerslab.store/ai/insight';
        
      const response = await fetch(API_URL);
      if (response.ok) {
        const data = await response.json();
        setInsightData(data);
        
        // 부모 컴포넌트로 로그 데이터 전달 (대시보드 카운팅용)
        if (onLogReceived && data.current_log) {
          onLogReceived(data.current_log);
        }
        
        return data.current_log.text;
      }
    } catch (error) {
      console.error("AI Insight 로드 실패:", error);
      return null;
    }
  };

  useEffect(() => {
    let charIndex = 0;
    
    const startTypingCycle = async () => {
      // 1. 데이터 가져오기
      setIsTyping(true);
      setDisplayedText('');
      
      const logText = await fetchInsight_API() || '분석 데이터 대기 중...';
      
      // 2. 타이핑 효과
      const typingInterval = setInterval(() => {
        if (charIndex <= logText.length) {
          setDisplayedText(logText.slice(0, charIndex));
          charIndex++;
        } else {
          clearInterval(typingInterval);
          setIsTyping(false);
          
          // 3. 다음 주기로 넘어가기 전 대기 (5초 후 갱신)
          setTimeout(() => {
            charIndex = 0;
            startTypingCycle();
          }, 5000);
        }
      }, 50);
    };

    startTypingCycle();

    return () => {}; // Cleanup logic if needed
  }, []); // Run once on mount, loop internally

  const currentLog = insightData.current_log || { type: 'info' };

  return (
    <div className="bg-gradient-to-br from-[#1a1f2e] to-[#11141d] rounded-3xl p-6 border border-blue-500/20 shadow-xl relative overflow-hidden group">
      {/* 배경 장식 */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
      
      <div className="flex items-start justify-between mb-4 relative z-10">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-600/20 p-2.5 rounded-xl border border-blue-500/30">
            <Brain className="w-6 h-6 text-blue-400 animate-pulse" />
          </div>
          <div>
            <h2 className="font-bold text-lg text-white flex items-center gap-2">
              S-Autopilot Insight
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
            </h2>
            <p className="text-xs text-slate-400">실시간 인공지능 분석 스트림</p>
          </div>
        </div>
        
        {/* 상태 뱃지 */}
        <div className="flex items-center space-x-2">
           <div className="bg-[#0f111a] px-3 py-1.5 rounded-lg border border-white/5 flex items-center space-x-2">
             <Activity className="w-3 h-3 text-emerald-500" />
             <span className="text-xs text-slate-300 font-mono">LIVE</span>
           </div>
        </div>
      </div>

      {/* 터미널 뷰 영역 */}
      <div className="bg-[#0a0c10] rounded-xl p-4 border border-white/5 font-mono text-sm h-28 flex items-center relative shadow-inner">
        {/* 스캔 라인 효과 */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-500/5 to-transparent h-full w-full pointer-events-none animate-scanline" />
        
        <div className="w-full">
           <div className="flex items-start space-x-2">
             <span className="text-blue-500 mt-0.5">❯</span>
             <p className={`
               ${currentLog.type === 'insight' ? 'text-yellow-300 font-bold' : 
                 currentLog.type === 'warning' ? 'text-orange-400' : 
                 currentLog.type === 'success' ? 'text-emerald-400' : 'text-blue-200'}
             `}>
               {displayedText}
               <span className="animate-blink inline-block w-2 h-4 bg-blue-500/50 align-middle ml-1"></span>
             </p>
           </div>
        </div>
      </div>
      
      {/* 하단 지표 */}

      
    </div>
  );
}
