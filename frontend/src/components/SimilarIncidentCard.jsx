import React from 'react';
import { Clock, CheckCircle, TrendingUp, Copy, ArrowRight } from 'lucide-react';

export default function SimilarIncidentCard({ incident, onApply }) {
  const getSimilarityColor = (similarity) => {
    if (similarity >= 90) return 'text-green-400 bg-green-500/10 border-green-500/30';
    if (similarity >= 75) return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
    if (similarity >= 60) return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
    return 'text-slate-400 bg-slate-500/10 border-slate-500/30';
  };

  return (
    <div className="bg-[#11141d] border border-white/5 rounded-2xl p-5 hover:border-blue-500/30 transition-all group">
      {/* Header with Similarity Score */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <span className="text-[10px] text-slate-500 font-mono">{incident.incidentId}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-bold ${getSimilarityColor(incident.similarity)}`}>
              {incident.similarity}% 유사
            </span>
          </div>
          <h3 className="text-sm font-bold text-white leading-snug group-hover:text-blue-400 transition-colors">
            {incident.title}
          </h3>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-slate-400 leading-relaxed mb-4">
        {incident.description}
      </p>

      {/* Metadata Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-[#1a1f2e] rounded-xl p-3 border border-white/5">
          <div className="flex items-center space-x-2 mb-1">
            <Clock className="w-3 h-3 text-blue-400" />
            <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">발생 일시</span>
          </div>
          <p className="text-xs text-white font-medium">{incident.timestamp}</p>
        </div>
        <div className="bg-[#1a1f2e] rounded-xl p-3 border border-white/5">
          <div className="flex items-center space-x-2 mb-1">
            <TrendingUp className="w-3 h-3 text-emerald-400" />
            <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">해결 시간</span>
          </div>
          <p className="text-xs text-emerald-400 font-bold">{incident.resolutionTime}</p>
        </div>
      </div>

      {/* Resolution */}
      <div className="bg-gradient-to-br from-blue-900/20 to-purple-900/20 border border-blue-500/20 rounded-xl p-4 mb-4">
        <div className="flex items-center space-x-2 mb-2">
          <CheckCircle className="w-4 h-4 text-blue-400" />
          <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">적용된 조치</span>
        </div>
        <p className="text-xs text-white leading-relaxed">
          {incident.resolution}
        </p>
      </div>

      {/* Tags */}
      {incident.tags && incident.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {incident.tags.map((tag, index) => (
            <span 
              key={index}
              className="text-[9px] px-2 py-1 bg-white/5 text-slate-400 rounded-md border border-white/10 font-medium"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Action Button */}
      <button
        onClick={() => onApply && onApply(incident)}
        className="w-full bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 hover:border-blue-500 font-bold py-3 rounded-xl transition-all flex items-center justify-center space-x-2 group/btn"
      >
        <Copy className="w-4 h-4" />
        <span className="text-xs">이 조치 방법 적용하기</span>
        <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
      </button>
    </div>
  );
}
