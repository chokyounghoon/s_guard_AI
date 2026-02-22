import React from 'react';
import { X, Brain, TrendingUp, AlertTriangle, CheckCircle, Zap, Activity } from 'lucide-react';

export default function AIInsightModal({ insight, onClose }) {
  if (!insight) return null;

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high': return 'text-red-400 bg-red-500/10 border-red-500/30';
      case 'medium': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
      case 'low': return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
      default: return 'text-slate-400 bg-slate-500/10 border-slate-500/30';
    }
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case '장애': return AlertTriangle;
      case '성능': return TrendingUp;
      case '보안': return Zap;
      default: return Activity;
    }
  };

  const CategoryIcon = getCategoryIcon(insight.category);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#0f111a]/90 backdrop-blur-md" onClick={onClose}></div>
      
      <div className="relative w-full max-w-3xl bg-gradient-to-b from-[#1a1f2e] to-[#0f111a] border border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-scale-up max-h-[90vh] overflow-y-auto">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-purple-500 to-cyan-400"></div>
        
        {/* Header */}
        <div className="sticky top-0 bg-[#1a1f2e]/95 backdrop-blur-sm border-b border-white/10 p-6 z-10">
          <div className="flex justify-between items-start">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-br from-blue-600 to-purple-600 p-3 rounded-2xl shadow-lg">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                  <span>AI 예측 분석 상세</span>
                  <span className={`text-xs px-3 py-1 rounded-full border ${getSeverityColor(insight.severity)}`}>
                    {insight.severity === 'high' ? '높음' : insight.severity === 'medium' ? '보통' : '낮음'}
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">Prediction ID: {insight.predictionId}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* AI Reasoning Section */}
          <div className="bg-gradient-to-br from-blue-900/20 to-purple-900/20 border border-blue-500/20 rounded-2xl p-6">
            <div className="flex items-center space-x-2 mb-4">
              <CategoryIcon className="w-5 h-5 text-blue-400" />
              <h3 className="text-sm font-bold text-blue-400 uppercase tracking-wider">AI 분석 결과</h3>
            </div>
            <p className="text-white leading-relaxed text-sm">
              {insight.aiReasoning}
            </p>
          </div>

          {/* Metrics Visualization */}
          {insight.relatedMetrics && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-2">
                <Activity className="w-4 h-4" />
                <span>관련 메트릭</span>
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <MetricCard label="CPU" value={insight.relatedMetrics.cpu} unit="%" color="blue" />
                <MetricCard label="Memory" value={insight.relatedMetrics.memory} unit="%" color="purple" />
                <MetricCard label="Disk I/O" value={insight.relatedMetrics.diskIO} unit="%" color="cyan" />
              </div>
            </div>
          )}

          {/* Recommended Actions */}
          {insight.recommendedActions && insight.recommendedActions.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-2">
                <CheckCircle className="w-4 h-4" />
                <span>권장 조치 사항</span>
              </h3>
              <div className="space-y-2">
                {insight.recommendedActions.map((action, index) => (
                  <div key={index} className="bg-[#11141d] border border-white/5 rounded-xl p-4 hover:border-blue-500/30 transition-all group">
                    <div className="flex items-start space-x-3">
                      <div className="bg-blue-600/20 text-blue-400 w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 group-hover:bg-blue-600/30 transition-colors">
                        {index + 1}
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed">{action}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Confidence & Similar Cases */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-green-900/20 to-emerald-900/20 border border-green-500/20 rounded-2xl p-5 text-center">
              <div className="text-xs text-green-400 font-bold uppercase tracking-wider mb-2">신뢰도</div>
              <div className="text-3xl font-bold text-white mb-1">{insight.confidence}%</div>
              <div className="text-[10px] text-slate-400">High Confidence</div>
            </div>
            <div className="bg-gradient-to-br from-purple-900/20 to-pink-900/20 border border-purple-500/20 rounded-2xl p-5 text-center">
              <div className="text-xs text-purple-400 font-bold uppercase tracking-wider mb-2">유사 사례</div>
              <div className="text-3xl font-bold text-white mb-1">{insight.similarCases}</div>
              <div className="text-[10px] text-slate-400">Past Incidents</div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex space-x-3 mt-8">
            <button 
              onClick={onClose}
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-900/40 transition-all transform active:scale-[0.98]"
            >
              조치 시작하기
            </button>
            <button 
              onClick={onClose}
              className="px-6 bg-white/5 hover:bg-white/10 text-slate-400 font-medium py-4 rounded-xl transition-all"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, unit, color }) {
  const getColorClasses = (color) => {
    switch (color) {
      case 'blue': return 'from-blue-900/30 to-blue-900/10 border-blue-500/30 text-blue-400';
      case 'purple': return 'from-purple-900/30 to-purple-900/10 border-purple-500/30 text-purple-400';
      case 'cyan': return 'from-cyan-900/30 to-cyan-900/10 border-cyan-500/30 text-cyan-400';
      default: return 'from-slate-900/30 to-slate-900/10 border-slate-500/30 text-slate-400';
    }
  };

  return (
    <div className={`bg-gradient-to-br border rounded-xl p-4 ${getColorClasses(color)}`}>
      <div className="text-[10px] font-bold uppercase tracking-wider mb-2 opacity-70">{label}</div>
      <div className="text-2xl font-bold">
        {value}<span className="text-sm ml-1">{unit}</span>
      </div>
    </div>
  );
}
