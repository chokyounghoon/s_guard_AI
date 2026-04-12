import React, { useState } from 'react';
import { UserCheck, Calendar, Clock, PlayCircle, CheckCircle2, ChevronRight } from 'lucide-react';

const AiPredictionPanel = ({ counts, onShowDetail }) => {
  const [activeTab, setActiveTab] = useState('assigned');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const tabs = [
    { id: 'assigned', label: '할당됨', icon: Clock, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
    { id: 'processing', label: '분석중입니다', icon: PlayCircle, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
    { id: 'completed', label: '처리완료', icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  ];

  return (
    <div className="bg-gradient-to-br from-[#1a1f2e] to-[#11141d] rounded-3xl p-6 border border-white/10 shadow-xl mb-6 relative overflow-hidden group">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-600/20 border border-blue-500/30">
            <UserCheck className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">나의 처리 현황 (My Tasks)</h2>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest">Personal Task Management</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-[#0f111a] p-1.5 rounded-xl border border-white/5">
          <Calendar className="w-4 h-4 text-slate-500 ml-1" />
          <input 
            type="date" 
            value={date} 
            onChange={(e) => setDate(e.target.value)}
            className="bg-transparent text-xs text-slate-300 outline-none border-none focus:ring-0 cursor-pointer"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border transition-all duration-300 ${
              activeTab === tab.id 
                ? `${tab.bg} ${tab.border} ${tab.color} shadow-lg scale-[1.02]` 
                : 'bg-white/5 border-transparent text-slate-500 hover:bg-white/10'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span className="text-xs font-bold">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Task List (Mock/Summary) */}
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div 
            key={i}
            className="bg-[#0f111a]/50 p-4 rounded-2xl border border-white/5 hover:border-white/10 transition-all flex items-center justify-between group/item cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className={`w-1.5 h-10 rounded-full ${activeTab === 'assigned' ? 'bg-blue-500' : activeTab === 'processing' ? 'bg-orange-500' : 'bg-emerald-500'}`} />
              <div>
                <div className="text-xs font-bold text-slate-200 mb-1">
                  {i === 1 ? '[L4_Switch] Traffic Spike 감지' : '[Redis] Connection Timeout 발생'}
                </div>
                <div className="flex items-center gap-3 text-[10px] text-slate-500">
                  <span className="bg-white/5 px-2 py-0.5 rounded border border-white/5">ID: 20260321112000{i}</span>
                  <span>{date} 10:2{i}</span>
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-600 group-hover/item:text-white transition-colors group-hover/item:translate-x-1 duration-300" />
          </div>
        ))}
      </div>
      
      <button className="w-full mt-6 py-3 rounded-2xl border border-white/5 text-[11px] font-bold text-slate-500 hover:text-white hover:bg-white/5 transition-all">
        전체 내역 보기
      </button>
    </div>
  );
};

export default AiPredictionPanel;
