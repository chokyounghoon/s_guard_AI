import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, Search, SlidersHorizontal, Clock, User, ChevronRight, Home, MessageSquare, Activity, MoreHorizontal } from 'lucide-react';

export default function AssignmentsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('전체');

  const tabs = ['전체', '중요도: CRITICAL', '상태: 처리 중', '신규'];

  const assignments = [
    {
      id: 1,
      severity: 'CRITICAL',
      code: 'SHB02681',
      time: '21:52:51',
      title: '[신한카드] 2026/01/22/21:52:51 SHB02681 은행고객종합정보 비즈니스오류 임계치 초과',
      description: 'Error Code: ERR_LIMIT_EXCEEDED. 고객 승급 거래 정상 처리 시간 분실. 현재 5분동안 오류 비...',
      assignee: '나진수 책임',
      status: '전수회',
      statusAction: '처리하기',
      statusColor: 'text-blue-500',
      bgColor: 'bg-red-900/20',
      borderColor: 'border-red-500/30'
    },
    {
      id: 2,
      severity: 'HIGH',
      code: 'SYS04921',
      time: '20:15:33',
      title: '[신한카드] SHB04921 시스템 대시보드 리소스 과다 점유 발견',
      description: 'CPU Usage > 95% sustained for 10 minutes....',
      assignee: '나진수 책임',
      status: '처리 중',
      statusColor: 'text-orange-500',
      bgColor: 'bg-orange-900/20',
      borderColor: 'border-orange-500/30'
    },
    {
      id: 3,
      severity: 'MEDIUM',
      code: 'NET01152',
      time: '18:40:02',
      title: '[공통기반] NET01152 백업 회선 전환 이벤트 발생',
      description: 'Primary link failover initiated. Switching to...',
      assignee: '나진수 책임',
      status: '완료됨',
      statusColor: 'text-slate-500',
      bgColor: 'bg-slate-900/20',
      borderColor: 'border-slate-500/30'
    }
  ];

  return (
    <div className="min-h-screen bg-[#0f1421] text-white font-sans flex flex-col pb-24">
      {/* Header */}
      <header className="flex items-center justify-between p-5 sticky top-0 bg-[#0f1421]/90 backdrop-blur-md z-40 border-b border-white/5">
        <h1 className="text-2xl font-bold tracking-tight">나의 할당 내역</h1>
        <div className="flex items-center space-x-3">
          <button className="p-2 rounded-full hover:bg-white/10 transition-colors relative">
            <Bell className="w-5 h-5 text-slate-400" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full"></span>
          </button>
          <button className="p-2 rounded-full hover:bg-white/10 transition-colors">
            <SlidersHorizontal className="w-5 h-5 text-slate-400" />
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
              className="w-full bg-slate-800/40 border border-white/5 rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-slate-500"
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
                  : 'bg-slate-800/40 text-slate-400 hover:bg-slate-800'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Assignment List */}
        <div className="space-y-3 px-5">
          {assignments.map((assignment) => (
            <div
              key={assignment.id}
              onClick={() => navigate('/assignment-detail')}
              className={`${assignment.bgColor} border ${assignment.borderColor} rounded-2xl p-5 space-y-4 hover:bg-opacity-30 transition-all cursor-pointer`}
            >
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    assignment.severity === 'CRITICAL' ? 'bg-red-500 text-white' :
                    assignment.severity === 'HIGH' ? 'bg-orange-500 text-white' :
                    'bg-yellow-600 text-white'
                  }`}>
                    {assignment.severity}
                  </span>
                  <span className="text-slate-400 text-xs font-medium">{assignment.code}</span>
                </div>
                <div className="flex items-center space-x-1 text-slate-500">
                  <Clock className="w-3 h-3" />
                  <span className="text-xs">{assignment.time}</span>
                </div>
              </div>

              {/* Title */}
              <h3 className="text-[15px] font-bold leading-snug text-white">
                {assignment.title}
              </h3>

              {/* Description */}
              <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                {assignment.description}
              </p>

              {/* Footer */}
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center">
                    <User className="w-4 h-4 text-slate-400" />
                  </div>
                  <span className="text-xs text-slate-300">{assignment.assignee}</span>
                </div>
                <button className={`text-xs font-bold ${assignment.statusColor} flex items-center space-x-1 hover:underline`}>
                  <span>{assignment.statusAction || assignment.status}</span>
                  {assignment.statusAction && <ChevronRight className="w-3 h-3" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Navigation */}
      <nav className="fixed bottom-0 left-0 w-full bg-[#0f1421] border-t border-white/5 px-6 py-3 flex justify-between items-center z-50 pb-safe">
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
