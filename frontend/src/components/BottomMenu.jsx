import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, MessageSquare, Activity, Search, MoreHorizontal, Users, User, Network, Shield, FileText, Bot, BookOpen, Inbox } from 'lucide-react';

export default function BottomMenu({ currentPath, onWarRoomClick, onReportClick, onAiClick, showAiPulse = true }) {
  const navigate = useNavigate();
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  return (
    <>
      <nav className="fixed bottom-0 left-0 w-full bg-[#0f111a] border-t border-white/10 px-6 py-3 flex justify-between items-center z-50 pb-safe">
        <div
          className={`flex flex-col items-center space-y-1 cursor-pointer transition-colors ${currentPath === '/dashboard' ? 'text-blue-500' : 'text-slate-500 hover:text-white'}`}
          onClick={() => navigate('/dashboard')}
        >
          <Home className={`w-6 h-6 ${currentPath === '/dashboard' ? 'fill-current' : ''}`} />
          <span className="text-[10px] font-medium">홈</span>
        </div>
        
        <div
          className={`flex flex-col items-center space-y-1 cursor-pointer transition-colors ${currentPath === '/chat' ? 'text-blue-500' : 'text-slate-500 hover:text-white'}`}
          onClick={() => {
            if (onWarRoomClick) {
              onWarRoomClick();
            } else {
              navigate('/chat');
            }
          }}
        >
          <MessageSquare className={`w-6 h-6 ${currentPath === '/chat' ? 'fill-current' : ''}`} />
          <span className="text-[10px] font-medium">War-Room</span>
        </div>
        
        <div
          className={`flex flex-col items-center space-y-1 cursor-pointer transition-colors ${currentPath.startsWith('/ai-report') ? 'text-blue-500' : 'text-slate-500 hover:text-white'}`}
          onClick={() => {
            if (onReportClick) {
              onReportClick();
            } else {
              navigate('/report-publish');
            }
          }}
        >
          <FileText className={`w-6 h-6 ${currentPath.startsWith('/ai-report') ? 'fill-current' : ''}`} />
          <span className="text-[10px] font-medium">Report</span>
        </div>

        <div
          className={`flex flex-col items-center space-y-1 cursor-pointer transition-colors ${currentPath === '/inbox' ? 'text-blue-500' : 'text-slate-500 hover:text-white'}`}
          onClick={() => navigate('/inbox')}
        >
          <Inbox className={`w-6 h-6 ${currentPath === '/inbox' ? 'fill-current' : ''}`} />
          <span className="text-[10px] font-medium">메시지함</span>
        </div>
        
        <div
          className={`flex flex-col items-center space-y-1 cursor-pointer transition-colors ${currentPath === '/search' ? 'text-blue-500' : 'text-slate-500 hover:text-white'}`}
          onClick={() => navigate('/search')}
        >
          <Search className={`w-6 h-6 ${currentPath === '/search' ? 'fill-current' : ''}`} />
          <span className="text-[10px] font-medium">검색</span>
        </div>

        {/* AI Assistant Nav Button */}
        <div 
          className="flex flex-col items-center space-y-1 text-slate-500 hover:text-purple-400 transition-colors cursor-pointer"
          onClick={onAiClick}
        >
            <div className="relative">
              <Bot className="w-6 h-6" />
              {showAiPulse && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-purple-500 rounded-full border-2 border-[#0f111a] animate-pulse"></span>
              )}
            </div>
            <span className="text-[10px] font-medium">AI</span>
        </div>
        
        <div
          className="flex flex-col items-center space-y-1 text-slate-500 hover:text-white transition-colors cursor-pointer"
          onClick={() => setShowMoreMenu(true)}
        >
          <MoreHorizontal className="w-6 h-6" />
          <span className="text-[10px] font-medium">더보기</span>
        </div>
      </nav>

      {/* More Menu Popup */}
      {showMoreMenu && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowMoreMenu(false)} />
          <div className="w-full bg-[#1a1f2e] rounded-t-[40px] border-t border-white/10 shadow-2xl relative z-10 animate-in slide-in-from-bottom duration-500 overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="p-8 pb-4">
              <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-8" />
              <h3 className="text-xl font-bold text-white mb-2 text-center">시스템 관리 설정</h3>
              <p className="text-xs text-slate-500 text-center mb-10 uppercase tracking-[4px]">System Operations</p>

              <div className="grid grid-cols-2 gap-4">

                <div
                  onClick={() => {
                    setShowMoreMenu(false);
                    navigate('/report-line-management');
                  }}
                  className="bg-[#11141d] p-4 sm:p-6 rounded-3xl border border-white/5 hover:border-purple-500/30 transition-all cursor-pointer group flex flex-col items-center text-center space-y-3 sm:space-y-4"
                >
                  <div className="bg-purple-600/20 p-3 sm:p-4 rounded-2xl group-hover:scale-110 transition-transform">
                    <Users className="w-6 h-6 sm:w-8 sm:h-8 text-purple-400" />
                  </div>
                  <div>
                    <span className="block font-bold text-slate-200 text-sm sm:text-base">보고 라인 관리</span>
                    <span className="text-[9px] sm:text-[10px] text-slate-500 mt-1 block">Approval Hierarchy</span>
                  </div>
                </div>

                <div
                  onClick={() => {
                    setShowMoreMenu(false);
                    navigate('/incident-push');
                  }}
                  className="bg-[#11141d] p-4 sm:p-6 rounded-3xl border border-white/5 hover:border-green-500/30 transition-all cursor-pointer group flex flex-col items-center text-center space-y-3 sm:space-y-4"
                >
                  <div className="bg-green-600/20 p-3 sm:p-4 rounded-2xl group-hover:scale-110 transition-transform">
                    <MessageSquare className="w-6 h-6 sm:w-8 sm:h-8 text-green-400" />
                  </div>
                  <div>
                    <span className="block font-bold text-slate-200 text-sm sm:text-base">장애 수동 접수</span>
                    <span className="text-[9px] sm:text-[10px] text-slate-500 mt-1 block">Manual Incident Entry & Testing</span>
                  </div>
                </div>
                <div
                  onClick={() => {
                    setShowMoreMenu(false);
                    navigate('/user-management');
                  }}
                  className="bg-[#11141d] p-4 sm:p-6 rounded-3xl border border-white/5 hover:border-blue-500/30 transition-all cursor-pointer group flex flex-col items-center text-center space-y-3 sm:space-y-4"
                >
                  <div className="bg-blue-600/20 p-3 sm:p-4 rounded-2xl group-hover:scale-110 transition-transform">
                    <User className="w-6 h-6 sm:w-8 sm:h-8 text-blue-400" />
                  </div>
                  <div>
                    <span className="block font-bold text-slate-200 text-sm sm:text-base">사용자 계정 관리</span>
                    <span className="text-[9px] sm:text-[10px] text-slate-500 mt-1 block">Account & Security Admin</span>
                  </div>
                </div>
                <div
                  onClick={() => {
                    setShowMoreMenu(false);
                    navigate('/organization-management');
                  }}
                  className="bg-[#11141d] p-4 sm:p-6 rounded-3xl border border-white/5 hover:border-emerald-500/30 transition-all cursor-pointer group flex flex-col items-center text-center space-y-3 sm:space-y-4"
                >
                  <div className="bg-emerald-600/20 p-3 sm:p-4 rounded-2xl group-hover:scale-110 transition-transform">
                    <Network className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-400" />
                  </div>
                  <div>
                    <span className="block font-bold text-slate-200 text-sm sm:text-base">부서/조직도 관리</span>
                    <span className="text-[9px] sm:text-[10px] text-slate-500 mt-1 block">Org Hierarchy Tree Admin</span>
                  </div>
                </div>
                <div
                  onClick={() => {
                    setShowMoreMenu(false);
                    navigate('/knowledge-base');
                  }}
                  className="bg-[#11141d] p-4 sm:p-6 rounded-3xl border border-white/5 hover:border-blue-500/30 transition-all cursor-pointer group flex flex-col items-center text-center space-y-3 sm:space-y-4"
                >
                  <div className="bg-blue-600/20 p-3 sm:p-4 rounded-2xl group-hover:scale-110 transition-transform">
                    <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-blue-400" />
                  </div>
                  <div>
                    <span className="block font-bold text-slate-200 text-sm sm:text-base">지식 관리</span>
                    <span className="text-[9px] sm:text-[10px] text-slate-500 mt-1 block">RAG Knowledge Management</span>
                  </div>
                </div>
                <div
                  onClick={() => {
                    setShowMoreMenu(false);
                    navigate('/overall-status');
                  }}
                  className="bg-[#11141d] p-4 sm:p-6 rounded-3xl border border-white/5 hover:border-orange-500/30 transition-all cursor-pointer group flex flex-col items-center text-center space-y-3 sm:space-y-4"
                >
                  <div className="bg-orange-600/20 p-3 sm:p-4 rounded-2xl group-hover:scale-110 transition-transform">
                    <Activity className="w-6 h-6 sm:w-8 sm:h-8 text-orange-400" />
                  </div>
                  <div>
                    <span className="block font-bold text-slate-200 text-sm sm:text-base">전체 장애 통계</span>
                    <span className="text-[9px] sm:text-[10px] text-slate-500 mt-1 block">Global Error Statistics</span>
                  </div>
                </div>
                <div
                  onClick={() => {
                    setShowMoreMenu(false);
                    navigate('/warroom-management');
                  }}
                  className="bg-[#11141d] p-4 sm:p-6 rounded-3xl border border-white/5 hover:border-red-500/30 transition-all cursor-pointer group flex flex-col items-center text-center space-y-3 sm:space-y-4"
                >
                  <div className="bg-red-600/20 p-3 sm:p-4 rounded-2xl group-hover:scale-110 transition-transform">
                    <Shield className="w-6 h-6 sm:w-8 sm:h-8 text-red-400" />
                  </div>
                  <div>
                    <span className="block font-bold text-slate-200 text-sm sm:text-base">WAR-ROOM 현황</span>
                    <span className="text-[9px] sm:text-[10px] text-slate-500 mt-1 block">Incident War-Room Hub</span>
                  </div>
                </div>
                
                <div
                  onClick={() => {
                    setShowMoreMenu(false);
                    navigate('/activity');
                  }}
                  className="bg-[#11141d] p-4 sm:p-6 rounded-3xl border border-white/5 hover:border-cyan-500/30 transition-all cursor-pointer group flex flex-col items-center text-center space-y-3 sm:space-y-4"
                >
                  <div className="bg-cyan-600/20 p-3 sm:p-4 rounded-2xl group-hover:scale-110 transition-transform">
                    <Activity className="w-6 h-6 sm:w-8 sm:h-8 text-cyan-400" />
                  </div>
                  <div>
                    <span className="block font-bold text-slate-200 text-sm sm:text-base">사용자 활동 기록</span>
                    <span className="text-[9px] sm:text-[10px] text-slate-500 mt-1 block">System Activity Logs</span>
                  </div>
                </div>

                <div
                  onClick={() => {
                    setShowMoreMenu(false);
                    navigate('/codebook-management');
                  }}
                  className="bg-[#11141d] p-4 sm:p-6 rounded-3xl border border-white/5 hover:border-yellow-500/30 transition-all cursor-pointer group flex flex-col items-center text-center space-y-3 sm:space-y-4"
                >
                  <div className="bg-yellow-600/20 p-3 sm:p-4 rounded-2xl group-hover:scale-110 transition-transform">
                    <BookOpen className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-400" />
                  </div>
                  <div>
                    <span className="block font-bold text-slate-200 text-sm sm:text-base">코드북 관리</span>
                    <span className="text-[9px] sm:text-[10px] text-slate-500 mt-1 block">Common Codebook Admin</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8 pt-4 pb-12">
              <button
                onClick={() => setShowMoreMenu(false)}
                className="w-full py-4 rounded-2xl bg-white/5 text-slate-400 font-bold hover:bg-white/10 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
