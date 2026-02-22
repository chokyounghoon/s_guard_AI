import React from 'react';
import { AlertTriangle, Server, Shield, FileText, Sparkles } from 'lucide-react';

const AiPredictionPanel = ({ onShowDetail }) => {
  const predictions = [
    {
      id: 'critical',
      label: 'Critical Error 예측됨',
      count: 0,
      icon: AlertTriangle,
      color: 'red',
      borderColor: 'border-b-red-500',
      iconBg: 'bg-red-500/10',
      iconColor: 'text-red-500'
    },
    {
      id: 'server',
      label: '서버오류 예측됨',
      count: 1,
      icon: Server,
      color: 'orange',
      borderColor: 'border-b-orange-500',
      iconBg: 'bg-orange-500/10',
      iconColor: 'text-orange-500'
    },
    {
      id: 'security',
      label: '보안이슈 감지',
      count: 1,
      icon: Shield,
      color: 'blue',
      borderColor: 'border-b-blue-500',
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-500'
    },
    {
      id: 'report',
      label: '예측 분석 레포트',
      count: 0,
      icon: FileText,
      color: 'purple',
      borderColor: 'border-b-purple-500',
      iconBg: 'bg-purple-500/10',
      iconColor: 'text-purple-500'
    }
  ];

  return (
    <div className="bg-[#1a1f2e] rounded-3xl p-6 border border-white/5 shadow-xl mb-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-400" />
          Autopilot 예측현황
        </h3>
        <div className="flex items-center space-x-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-[10px] text-slate-400 font-mono tracking-wider">REALTIME</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {predictions.map((p) => (
          <div 
            key={p.id}
            onClick={() => onShowDetail && onShowDetail(p.id)}
            className={`bg-[#0f111a] p-5 rounded-2xl border border-white/5 border-b-2 ${p.borderColor} flex flex-col items-center justify-center relative group hover:bg-[#1a2336] transition-all cursor-pointer active:scale-95 hover:shadow-lg hover:shadow-${p.color}-500/10`}
          >
            <div className="w-full flex justify-center mb-3">
              <span className={`text-[12px] font-bold px-2 py-0.5 rounded bg-${p.color}-500/10 text-${p.color}-400 border border-${p.color}-500/20 whitespace-nowrap uppercase tracking-wider`}>
                {p.label}
              </span>
            </div>
            <div className={`w-14 h-14 rounded-2xl ${p.iconBg} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-inner`}>
              <p.icon className={`w-7 h-7 ${p.iconColor}`} />
            </div>
            <span className={`text-3xl font-black text-white font-mono ${p.count >= 1 ? `underline decoration-${p.color}-500/50 underline-offset-8` : ''}`}>
              {p.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AiPredictionPanel;
