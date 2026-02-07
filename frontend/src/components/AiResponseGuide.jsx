import React, { useState } from 'react';
import { Sparkles, Database, ArrowRight, Play, CheckCircle, AlertTriangle } from 'lucide-react';

export default function AiResponseGuide() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [actionStatus, setActionStatus] = useState('idle'); // idle, executing, done

  const [analysisData, setAnalysisData] = useState(null);

  // API URL 설정
  const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:8000'
    : 'https://api.chokerslab.store';

  React.useEffect(() => {
    const fetchAnalysis = async () => {
      try {
        // 데모용 Incident ID (실제로는 props로 받아야 함)
        const demoId = 'incident-critical-001'; 
        const response = await fetch(`${API_BASE_URL}/ai/analysis/${demoId}`);
        if (response.ok) {
          const data = await response.json();
          setAnalysisData(data);
        }
      } catch (error) {
        console.error('AI Analysis Fetch Error:', error);
      }
    };
    
    fetchAnalysis();
  }, []);

  const handleAction = () => {
    setActionStatus('executing');
    setTimeout(() => {
      setActionStatus('done');
    }, 2000);
  };

  if (!analysisData) return (
    <div className="animate-pulse bg-[#1e293b] rounded-2xl p-5 h-48 border border-white/5 flex items-center justify-center">
        <div className="flex flex-col items-center">
            <Sparkles className="w-8 h-8 text-blue-500 animate-spin mb-2" />
            <span className="text-sm text-slate-400">AI 분석 데이터 로딩 중...</span>
        </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* AI Analysis Card */}
      <div className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] rounded-2xl p-5 border border-blue-500/30 relative overflow-hidden shadow-lg group">
        
        {/* Decorative background */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none group-hover:bg-blue-600/20 transition-colors duration-500" />
        
        <div className="flex items-start space-x-4 relative z-10">
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-3 rounded-xl shadow-lg shadow-blue-500/30 shrink-0">
            <Sparkles className="w-6 h-6 text-white animate-pulse-slow" />
          </div>
          
          <div className="flex-1">
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="font-bold text-lg text-white flex items-center gap-2">
                    AI Root Cause Analysis
                    <span className="bg-blue-500/20 text-blue-300 text-[10px] px-2 py-0.5 rounded border border-blue-500/30 font-mono">v2.4</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">S-Autopilot Brain (RAG Engine)</p>
                </div>
                <div className="text-right">
                    <div className="text-2xl font-bold text-emerald-400">{analysisData.similarity_score}%</div>
                    <div className="text-[10px] text-slate-400">유사도 매칭</div>
                </div>
            </div>

            <div className="mt-4 bg-[#0a0c10]/80 rounded-xl p-4 border border-white/5 backdrop-blur-sm">
                <div className="flex items-start gap-3 mb-3 pb-3 border-b border-white/5">
                    <Database className="w-4 h-4 text-slate-400 mt-0.5" />
                    <div>
                        <p className="text-sm text-slate-300">
                            <span className="text-blue-400 font-bold">{analysisData.similar_case.date}</span> 발생한 
                            <span className="text-white font-bold bg-white/10 px-1 ml-1 rounded">{analysisData.similar_case.issue_id}</span>와 패턴이 일치합니다.
                        </p>
                    </div>
                </div>
                
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-slate-300">
                        <ArrowRight className="w-3 h-3 text-blue-500" />
                        <span>원인: {analysisData.similar_case.description}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-300">
                        <ArrowRight className="w-3 h-3 text-blue-500" />
                        <span>영향: {analysisData.impact}</span>
                    </div>
                </div>
            </div>

            {/* Recommendation Action */}
            <div className="mt-4">
                <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-400" />
                    AI 권장 조치 가이드
                </h4>
                
                <div className="bg-white/5 rounded-xl p-1 pr-2 flex items-center justify-between border border-white/10 hover:border-blue-500/50 transition-colors">
                    <div className="flex items-center gap-3 px-3 py-2">
                        <div className="bg-[#0f111a] px-2 py-1 rounded text-xs font-mono text-orange-300 border border-orange-500/30">
                            {analysisData.recommendation.action}
                        </div>
                        <span className="text-sm text-slate-200">{analysisData.recommendation.description}</span>
                    </div>
                    
                    <button 
                        onClick={handleAction}
                        disabled={actionStatus !== 'idle'}
                        className={`
                            px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all
                            ${actionStatus === 'idle' 
                                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/40' 
                                : actionStatus === 'executing'
                                ? 'bg-slate-600 text-slate-300 cursor-wait'
                                : 'bg-emerald-600 text-white cursor-default'}
                        `}
                    >
                        {actionStatus === 'idle' && (
                            <>
                                <Play className="w-4 h-4 fill-current" />
                                실행
                            </>
                        )}
                        {actionStatus === 'executing' && (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                처리 중...
                            </>
                        )}
                        {actionStatus === 'done' && (
                            <>
                                <CheckCircle className="w-4 h-4" />
                                조치 완료
                            </>
                        )}
                    </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-2 pl-1">
                    * 자동화된 스크립트가 안전하게 실행됩니다. (승인 필요)
                </p>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
