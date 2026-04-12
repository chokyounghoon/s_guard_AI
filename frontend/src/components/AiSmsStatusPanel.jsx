import React, { useState, useEffect } from 'react';
import { Brain, MessageSquare, Activity, Shield, CheckCircle2, Clock, PlayCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = window.location.hostname === 'localhost'
  ? 'https://sguardai.khcho0421.workers.dev'
  : 'https://sguardai.khcho0421.workers.dev';

const AiSmsStatusPanel = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    received: 0,
    processing: 0,
    completed: 0
  });

  const [showBriefing, setShowBriefing] = useState(false);
  const [activeRooms, setActiveRooms] = useState([]);

  // 실시간 통계 가져오기 (데모용 Mock 포함)
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/warroom/rooms`);
        if (res.ok) {
          const data = await res.json();
          const rooms = data.rooms || [];
          setActiveRooms(rooms.filter(r => r.status === '처리중' || r.status === 'In Progress'));
          setStats({
            received: rooms.filter(r => r.status === '접수중' || r.status === 'Open').length,
            processing: rooms.filter(r => r.status === '처리중' || r.status === 'In Progress').length,
            completed: rooms.filter(r => r.status === '처리완료' || r.status === 'Completed').length
          });
        }
      } catch (e) {
        console.error("Stats fetch error:", e);
      }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-gradient-to-br from-[#1a1f2e] to-[#11141d] rounded-3xl p-6 border border-white/10 shadow-xl mb-6 relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
      
      <div className="flex justify-between items-center mb-6 relative z-10">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-400" />
          분석 진행 사항 (Analysis Progress)
        </h2>
        <div className="flex gap-2">
            <button 
              onClick={() => setShowBriefing(true)}
              className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1 bg-emerald-500/5 px-2 py-1 rounded-md border border-emerald-500/20"
            >
              실시간 브리핑 <PlayCircle className="w-3 h-3" />
            </button>
            <button 
              onClick={() => navigate('/warroom-management')}
              className="text-[10px] font-bold text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1 bg-blue-500/5 px-2 py-1 rounded-md border border-blue-500/20"
            >
              전체 목록
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
        {/* Left: AI Analysis Status */}
        <div className="bg-[#0f111a]/50 p-5 rounded-2xl border border-white/5 hover:border-blue-500/20 transition-all">
            <div className="flex items-center space-x-2 mb-6">
                <Brain className="w-5 h-5 text-blue-400" />
                <h3 className="text-sm font-bold text-slate-200">AI 분석 실시간 등급</h3>
            </div>
            
            <div className="space-y-6">
                {/* Severity Indicators */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-red-500/5 border border-red-500/20">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-xs text-red-200 font-bold uppercase tracking-wider">Critical</span>
                    </div>
                    <span className="text-sm font-black text-red-400 font-mono">신규감지</span>
                </div>

                <div className="text-[11px] text-slate-400 leading-relaxed bg-[#11141d] p-3 rounded-xl border border-white/5">
                    현재 장애 건에 대해 AI 에이전트들이 분석 리포트를 생성하고 있습니다. <br/>
                    <span className="text-blue-400 font-bold underline cursor-pointer hover:text-blue-300" onClick={() => navigate('/chat')}>[에이전트 토론 전문 보기]</span>
                </div>
            </div>
        </div>

        {/* Right: War-Room Progress Stats */}
        <div className="bg-[#0f111a]/50 p-5 rounded-2xl border border-white/5 hover:border-emerald-500/20 transition-all">
            <div className="flex items-center space-x-2 mb-6">
                <Shield className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-200">War-Room 현황</h3>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-[#11141d] p-3 rounded-xl border border-white/5 flex flex-col items-center group/item hover:bg-blue-500/5 transition-all cursor-pointer" onClick={() => navigate('/warroom-management?status=접수중')}>
                    <Clock className="w-4 h-4 text-blue-400 mb-1 group-hover/item:scale-110 transition-transform" />
                    <span className="text-[10px] text-slate-500 font-medium">접수중</span>
                    <span className="text-xl font-black text-white font-mono">{stats.received}</span>
                </div>
                <div className="bg-[#11141d] p-3 rounded-xl border border-white/5 flex flex-col items-center group/item hover:bg-orange-500/5 transition-all cursor-pointer" onClick={() => setShowBriefing(true)}>
                    <PlayCircle className="w-4 h-4 text-orange-400 mb-1 group-hover/item:scale-110 transition-transform" />
                    <span className="text-[10px] text-slate-500 font-medium">분석중입니다</span>
                    <span className="text-xl font-black text-white font-mono">{stats.processing}</span>
                </div>
                <div className="bg-[#11141d] p-3 rounded-xl border border-white/5 flex flex-col items-center group/item hover:bg-emerald-500/5 transition-all cursor-pointer" onClick={() => navigate('/warroom-management?status=처리완료')}>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mb-1 group-hover/item:scale-110 transition-transform" />
                    <span className="text-[10px] text-slate-500 font-medium">처리완료</span>
                    <span className="text-xl font-black text-white font-mono">{stats.completed}</span>
                </div>
            </div>
        </div>
      </div>

      {/* 실시간 브리핑 팝업 리포트 */}
      {showBriefing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#06080c]/90 backdrop-blur-md" onClick={() => setShowBriefing(false)} />
            <div className="bg-[#11141d] w-full max-w-lg rounded-[2.5rem] border border-white/10 shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[80vh] animate-in slide-in-from-bottom-5 duration-500">
                <div className="p-6 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-emerald-600/20 to-transparent">
                    <div className="flex items-center space-x-3">
                        <div className="bg-emerald-600/20 p-2 rounded-xl border border-emerald-500/30">
                            <Activity className="w-5 h-5 text-emerald-400 animate-pulse" />
                        </div>
                        <div>
                            <h3 className="font-bold text-white uppercase tracking-tight">Active War-Room Status</h3>
                            <p className="text-[10px] text-slate-500 font-mono">실시간 진행 장애 브리핑</p>
                        </div>
                    </div>
                </div>

                <div className="p-8 space-y-6 overflow-y-auto">
                    {activeRooms.length > 0 ? (
                        activeRooms.map(room => (
                            <div key={room.inc_id} className="p-5 bg-black/40 rounded-3xl border border-white/5 space-y-3">
                                <div className="flex justify-between items-start">
                                    <span className="text-[10px] font-mono text-emerald-400/70">{room.code}</span>
                                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 font-bold">진행 중</span>
                                </div>
                                <h4 className="font-bold text-slate-200">{room.title}</h4>
                                <p className="text-[11px] text-slate-500 leading-relaxed italic">"현재 원인 분석 완료 후 네트워크 라우팅 재설정 작업 중입니다. 예상 복구 시간 15분 내외."</p>
                                <div className="flex items-center gap-2 pt-2">
                                    <div className="flex -space-x-2">
                                        {[1, 2, 3].map(i => <div key={i} className="w-6 h-6 rounded-full border border-black bg-slate-800 flex items-center justify-center text-[8px] text-white">P{i}</div>)}
                                    </div>
                                    <span className="text-[9px] text-slate-600">외 5명 참여 중</span>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-20 text-slate-500">
                            <Shield className="w-12 h-12 mx-auto mb-4 opacity-20" />
                            <p className="text-sm">현재 진행 중인 워룸이 없습니다.</p>
                        </div>
                    )}
                </div>

                <div className="p-8 pt-0">
                    <button 
                      className="w-full h-14 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-2xl font-bold transition-all"
                      onClick={() => setShowBriefing(false)}
                    >
                        닫기
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default AiSmsStatusPanel;
