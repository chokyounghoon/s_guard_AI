import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, Search, SlidersHorizontal, Clock, User, ChevronRight, Home, MessageSquare, Activity, MoreHorizontal, AlertCircle } from 'lucide-react';

export default function AssignmentsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('전체');
  const [assignments, setAssignments] = useState([]);

  // localStorage에서 할당 내역 불러오기
  useEffect(() => {
    const saved = localStorage.getItem('sguard_assignments');
    if (saved) {
      try {
        setAssignments(JSON.parse(saved));
      } catch (e) {
        console.error('데이터 로드 실패:', e);
      }
    }
  }, []);

  const tabs = ['전체', '중요도: CRITICAL', '상태: 대기', '신규'];

  // 필터링 로직 (탭 선택 시)
  const filteredAssignments = assignments.filter(item => {
    if (activeTab === '전체') return true;
    if (activeTab === '중요도: CRITICAL') return item.severity === 'CRITICAL';
    if (activeTab === '상태: 대기') return true; // 현재는 모두 대기 상태로 가정
    if (activeTab === '신규') return true;
    return true;
  });

  return (
    <div className="min-h-screen bg-[#0f111a] text-white font-sans flex flex-col pb-24">
      {/* Header */}
      <header className="flex items-center justify-between p-5 sticky top-0 bg-[#0f111a]/90 backdrop-blur-md z-40 border-b border-white/5">
        <div className="flex items-center space-x-3">
            <button onClick={() => navigate(-1)} className="p-1 rounded-full hover:bg-white/10 transition-colors">
                <ArrowLeft className="w-6 h-6 text-white" />
            </button>
            <h1 className="text-xl font-bold tracking-tight">나의 할당 내역</h1>
        </div>
        <div className="flex items-center space-x-3">
          <button className="p-2 rounded-full hover:bg-white/10 transition-colors relative">
            <Bell className="w-5 h-5 text-slate-400" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full"></span>
          </button>
        </div>
      </header>

      <main className="flex-1 space-y-4">
        {/* Search Bar */}
        <div className="px-5 pt-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              type="text" 
              placeholder="이슈 ID, 타이틀 검색" 
              className="w-full bg-[#1a1f2e] border border-white/5 rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-slate-500"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="px-5 flex space-x-2 overflow-x-auto pb-2 scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                activeTab === tab
                  ? 'bg-blue-600 text-white'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Assignment List */}
        <div className="space-y-3 px-5 pt-2">
          {filteredAssignments.length > 0 ? (
            filteredAssignments.map((assignment) => (
                <div
                  key={assignment.id}
                  onClick={() => navigate('/assignment-detail')}
                  className={`${assignment.bgColor || 'bg-[#1a1f2e]'} border ${assignment.borderColor || 'border-white/5'} rounded-2xl p-5 space-y-4 hover:border-white/20 transition-all cursor-pointer group shadow-lg`}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${
                        assignment.severity === 'CRITICAL' 
                          ? 'bg-red-500/20 text-red-500 border-red-500/30' 
                          : 'bg-blue-500/20 text-blue-500 border-blue-500/30'
                      }`}>
                        {assignment.severity}
                      </span>
                      <span className="text-slate-500 text-xs font-mono">{assignment.code}</span>
                    </div>
                    <div className="flex items-center space-x-1 text-slate-500">
                      <Clock className="w-3 h-3" />
                      <span className="text-[10px] font-mono">{assignment.time}</span>
                    </div>
                  </div>
    
                  {/* Title & Content */}
                  <div className="space-y-2">
                    <h3 className="text-[15px] font-bold leading-snug text-white group-hover:text-blue-400 transition-colors">
                        {assignment.title}
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                        발신: {assignment.sender}
                    </p>
                  </div>
    
                  {/* Footer */}
                  <div className="flex items-center justify-between pt-2 border-t border-white/5 mt-2">
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center">
                        <User className="w-4 h-4 text-slate-500" />
                      </div>
                      <span className="text-[11px] text-slate-400">나진수 책임 (배정됨)</span>
                    </div>
                    <button className="text-xs font-bold text-blue-500 flex items-center space-x-1 hover:text-white transition-colors">
                      <span>분석 리포트</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
          ) : (
            <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
                <div className="bg-white/5 p-6 rounded-full">
                    <AlertCircle className="w-12 h-12 text-slate-600" />
                </div>
                <div className="space-y-1">
                    <p className="text-slate-300 font-bold">할당된 내역이 없습니다</p>
                    <p className="text-xs text-slate-500">수신된 SMS 장애 메시지가 이곳에 표시됩니다.</p>
                </div>
                <button 
                    onClick={() => navigate('/dashboard')}
                    className="mt-4 px-6 py-2 bg-blue-600/20 text-blue-400 border border-blue-500/20 rounded-xl text-sm font-bold hover:bg-blue-600 hover:text-white transition-all"
                >
                    대시보드로 돌아가기
                </button>
            </div>
          )}
        </div>
      </main>

      {/* Navigation */}
      <nav className="fixed bottom-0 left-0 w-full bg-[#0f111a]/95 backdrop-blur-lg border-t border-white/5 px-6 py-3 flex justify-between items-center z-50 pb-safe">
        <div className="flex flex-col items-center space-y-1 text-slate-500 hover:text-white transition-colors cursor-pointer" onClick={() => navigate('/dashboard')}>
            <Home className="w-6 h-6" />
            <span className="text-[10px] font-medium">홈</span>
        </div>
        <div className="flex flex-col items-center space-y-1 text-slate-500 hover:text-white transition-colors cursor-pointer" onClick={() => navigate('/chat')}>
            <MessageSquare className="w-6 h-6" />
            <span className="text-[10px] font-medium">War-Room</span>
        </div>
        <div className="flex flex-col items-center space-y-1 text-blue-500 transition-colors cursor-pointer">
            <Activity className="w-6 h-6 fill-current" />
            <span className="text-[10px] font-medium">활동</span>
        </div>
        <div className="flex flex-col items-center space-y-1 text-slate-500 hover:text-white transition-colors cursor-pointer">
            <Search className="w-6 h-6" />
            <span className="text-[10px] font-medium">검색</span>
        </div>
        <div className="flex flex-col items-center space-y-1 text-slate-500 hover:text-white transition-colors cursor-pointer">
            <MoreHorizontal className="w-6 h-6" />
            <span className="text-[10px] font-medium">더보기</span>
        </div>
      </nav>
    </div>
  );
}
