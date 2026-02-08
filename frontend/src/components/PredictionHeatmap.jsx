import React from 'react';

// 🛡️ Safety: Pure UI Component with Embedded SVGs
export default function PredictionHeatmap() {
  // Simulated Data (Future Prediction)
  // Current Time: 14:32 (Scenario Base)
  const timelineData = [
    { time: '14:32', label: 'Now', risk: 10, status: 'safe' },
    { time: '14:45', label: '+15m', risk: 85, status: 'warning' },
    { time: '15:00', label: '+30m', risk: 92, status: 'critical' },
    { time: '15:15', label: '+45m', risk: 99, status: 'outage' },
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case 'safe': return 'bg-emerald-500';
      case 'warning': return 'bg-yellow-500';
      case 'critical': return 'bg-orange-500';
      case 'outage': return 'bg-red-600 animate-pulse';
      default: return 'bg-slate-700';
    }
  };

  const getStatusText = (status) => {
     switch (status) {
      case 'safe': return 'text-emerald-400';
      case 'warning': return 'text-yellow-400';
      case 'critical': return 'text-orange-400';
      case 'outage': return 'text-red-500 font-bold';
      default: return 'text-slate-400';
    }
  };

  return (
    <div className="w-full bg-slate-900/80 border-b border-white/10 p-4 relative overflow-hidden">
        {/* Background Gradient for Atmosphere */}
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-900/10 via-yellow-900/10 to-red-900/20 pointer-events-none" />

        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
            {/* Header / Title */}
            <div className="flex items-center space-x-3 min-w-[200px]">
                <div className="p-2 bg-slate-800 rounded-lg border border-white/5 shadow-sm">
                    {/* Icon: Line Chart + Future Clock */}
                    <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                </div>
                <div>
                    <h3 className="text-sm font-bold text-white tracking-wide">AI PREDICTION</h3>
                    <p className="text-[10px] text-slate-400">Future Risk Analysis (1h)</p>
                </div>
            </div>

            {/* Timeline Visualization */}
            <div className="flex-1 w-full flex items-center gap-2">
                {timelineData.map((slot, index) => (
                    <div key={index} className="flex-1 flex flex-col items-center group relative">
                         {/* Connection Line (except first) */}
                         {index > 0 && (
                            <div className="absolute top-1/2 -left-1/2 w-full h-[2px] bg-slate-800 -z-10" />
                         )}

                         {/* Node */}
                         <div className={`w-full max-w-[120px] p-2 rounded-xl border border-white/5 bg-slate-950/50 hover:bg-slate-800 transition-all cursor-default flex flex-col items-center gap-1 ${index === 3 ? 'border-red-500/30 shadow-[0_0_15px_rgba(220,38,38,0.2)]' : ''}`}>
                            <div className="text-[10px] font-mono text-slate-500">{slot.time}</div>
                            
                            {/* Bar / Indicator */}
                            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full ${getStatusColor(slot.status)} transition-all duration-1000`} 
                                    style={{ width: `${slot.risk}%` }}
                                />
                            </div>

                            <div className={`text-[10px] font-bold ${getStatusText(slot.status)}`}>
                                {slot.risk}% {slot.status === 'outage' ? 'CRITICAL' : 'Risk'}
                            </div>
                         </div>
                         
                         {/* Tooltip / Message (Static for visibility) */}
                         {slot.status === 'outage' && (
                             <div className="absolute -bottom-8 bg-red-900/90 text-red-200 text-[10px] px-2 py-1 rounded border border-red-500/30 whitespace-nowrap animate-bounce">
                                 ⚠️ Service Outage Predicted
                             </div>
                         )}
                    </div>
                ))}
            </div>

            {/* Summary Action */}
            <div className="hidden md:block">
                 <button className="px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 text-xs rounded-lg border border-purple-500/30 transition-colors flex items-center gap-2">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    View Details
                 </button>
            </div>
        </div>
    </div>
  );
}
