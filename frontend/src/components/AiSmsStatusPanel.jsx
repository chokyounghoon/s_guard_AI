import React from 'react';
import { Brain, MessageSquare, UserCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AiSmsStatusPanel = () => {
  const navigate = useNavigate();

  return (
    <div className="bg-[#1a1f2e] rounded-3xl p-6 border border-white/5 shadow-xl mb-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-blue-400" />
          나의 Autopilot 확인요청 현황
        </h2>
        <div className="flex bg-[#11141d] rounded-lg p-1 border border-white/5">
            {['오늘', '이번주', '이번달', '일자지정'].map((tab, idx) => (
                <button 
                    key={tab}
                    className={`px-3 py-1 text-xs rounded-md transition-colors ${
                        tab === '이번주' 
                        ? 'bg-blue-600 text-white font-bold' 
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                    {tab}
                </button>
            ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* AI Request Column */}
        <div>
            <div className="flex items-center space-x-2 mb-6">
                <Brain className="w-5 h-5 text-blue-400" />
                <h3 className="text-sm font-bold text-slate-200">AI Request</h3>
            </div>
            
            <div className="space-y-6">
                {/* Critical */}
                <div 
                    onClick={() => navigate('/assignments?tab=중요도: CRITICAL')}
                    className="cursor-pointer group"
                >
                    <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-slate-400 group-hover:text-white transition-colors">Critical</span>
                        <span className={`text-red-500 font-bold group-hover:scale-110 transition-transform ${0 >= 1 ? 'underline decoration-red-500/50 underline-offset-4' : ''}`}>0</span>
                    </div>
                    <div className="h-2 bg-[#11141d] rounded-full overflow-hidden">
                        <div className="h-full bg-red-500 rounded-full group-hover:brightness-110 transition-all" style={{ width: '0%' }}></div>
                    </div>
                </div>

                {/* Major */}
                <div 
                    onClick={() => navigate('/assignments?tab=전체')}
                    className="cursor-pointer group"
                >
                    <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-slate-400 group-hover:text-white transition-colors">Major</span>
                        <span className={`text-orange-400 font-bold group-hover:scale-110 transition-transform ${1 >= 1 ? 'underline decoration-orange-400/50 underline-offset-4' : ''}`}>1</span>
                    </div>
                    <div className="h-2 bg-[#11141d] rounded-full overflow-hidden">
                        <div className="h-full bg-orange-500 rounded-full group-hover:brightness-110 transition-all" style={{ width: '20%' }}></div>
                    </div>
                </div>

                {/* Normal */}
                <div 
                    onClick={() => navigate('/assignments?tab=전체')}
                    className="cursor-pointer group"
                >
                    <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-slate-400 group-hover:text-white transition-colors">Normal</span>
                        <span className={`text-emerald-400 font-bold group-hover:scale-110 transition-transform ${24 >= 1 ? 'underline decoration-emerald-400/50 underline-offset-4' : ''}`}>24</span>
                    </div>
                    <div className="h-2 bg-[#11141d] rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full group-hover:brightness-110 transition-all" style={{ width: '65%' }}></div>
                    </div>
                </div>
            </div>
        </div>

        {/* SMS Request Column */}
        <div>
            <div className="flex items-center space-x-2 mb-6">
                <MessageSquare className="w-5 h-5 text-purple-400" />
                <h3 className="text-sm font-bold text-slate-200">SMS Request</h3>
            </div>
            
            <div className="space-y-6">
                {/* Unconfirmed */}
                <div 
                    onClick={() => navigate('/assignments?tab=상태: 대기')}
                    className="cursor-pointer group"
                >
                    <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-slate-400 group-hover:text-white transition-colors">미확인</span>
                        <span className={`text-red-400 font-bold group-hover:scale-110 transition-transform ${12 >= 1 ? 'underline decoration-red-400/50 underline-offset-4' : ''}`}>12</span>
                    </div>
                    <div className="h-2 bg-[#11141d] rounded-full overflow-hidden">
                        <div className="h-full bg-red-500 rounded-full group-hover:brightness-110 transition-all" style={{ width: '40%' }}></div>
                    </div>
                </div>

                {/* Processing */}
                <div 
                    onClick={() => navigate('/assignments?tab=상태: 처리중')}
                    className="cursor-pointer group"
                >
                    <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-slate-400 group-hover:text-white transition-colors">처리중</span>
                        <span className={`text-orange-400 font-bold group-hover:scale-110 transition-transform ${8 >= 1 ? 'underline decoration-orange-400/50 underline-offset-4' : ''}`}>8</span>
                    </div>
                    <div className="h-2 bg-[#11141d] rounded-full overflow-hidden">
                        <div className="h-full bg-orange-500 rounded-full group-hover:brightness-110 transition-all" style={{ width: '25%' }}></div>
                    </div>
                </div>

                {/* Completed */}
                <div 
                    onClick={() => navigate('/assignments?tab=상태: 완료')}
                    className="cursor-pointer group"
                >
                    <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-slate-400 group-hover:text-white transition-colors">확인 완료</span>
                        <span className={`text-blue-400 font-bold group-hover:scale-110 transition-transform ${156 >= 1 ? 'underline decoration-blue-400/50 underline-offset-4' : ''}`}>156</span>
                    </div>
                    <div className="h-2 bg-[#11141d] rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full group-hover:brightness-110 transition-all" style={{ width: '85%' }}></div>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default AiSmsStatusPanel;
