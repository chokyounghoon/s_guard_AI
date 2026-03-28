import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Bell, Search, SlidersHorizontal, Clock, User, ChevronRight, AlertCircle } from 'lucide-react';
import BottomMenu from '../components/BottomMenu';

export default function AssignmentsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const initialTab = queryParams.get('tab') || '전체';

  const [activeTab, setActiveTab] = useState(initialTab);
  const [assignments, setAssignments] = useState([]);
  const [userProfile, setUserProfile] = useState(null);

  const API_BASE = 'https://sguardai.khcho0421.workers.dev';

  useEffect(() => {
    const savedUser = localStorage.getItem('sguard_user');
    if (savedUser) {
      setUserProfile(JSON.parse(savedUser));
    }
  }, []);

  // Fetch real incidents from backend specifically for the user
  useEffect(() => {
    if (!userProfile?.id) return;
    
    // Default 1 month window for the assignment list page
    const toDate = new Date().toISOString().split('T')[0];
    const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    fetch(`${API_BASE}/ai/incident/my-assignments?user_id=${userProfile.id}&from=${fromDate}&to=${toDate}`)
      .then(r => r.json())
      .then(data => {
        const mapped = (data.assignments || []).map(inc => ({
          id: inc.inc_id,
          code: inc.inc_id.startsWith('INC-') ? inc.inc_id : `INC-${inc.inc_id}`,
          assignmentType: 'SMS',
          severity: inc.severity || 'NORMAL',
          status: inc.status || '미확인',
          title: inc.message || '상공 발생',
          sender: inc.sender,
          time: inc.assigned_at ? new Date(inc.assigned_at).toLocaleString('ko-KR') : '',
          received_count: inc.received_count || 1,
          assignees: inc.assignees || '담당자 미지정',
          inc_id: inc.inc_id,
          bgColor: inc.status === '미확인' ? 'bg-red-900/10' : 
                   inc.status === '처리중' ? 'bg-orange-900/10' : 'bg-emerald-900/10',
          borderColor: inc.status === '미확인' ? 'border-red-500/20' : 
                       inc.status === '처리중' ? 'border-orange-500/20' : 'border-emerald-500/20',
        }));
        setAssignments(mapped);
      })
      .catch(console.error);
  }, [userProfile]);

  // URL 파라미터가 변경될 때 탭 업데이트
  useEffect(() => {
    if (queryParams.get('tab')) {
      setActiveTab(queryParams.get('tab'));
    }
  }, [location.search]);

  const tabs = ['전체', '미확인', '처리중', '처리완료'];

  // 필터링 로직 (탭 선택 시)
  const filteredAssignments = assignments.filter(item => {
    const cleanTab = activeTab.replace('상태: ', '');
    if (cleanTab === '전체') return true;
    return item.status === cleanTab;
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
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${activeTab === tab
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
                onClick={() => navigate(`/chat/${String(assignment.inc_id).replace('INC-', '')}`)}
                className={`p-6 rounded-3xl border ${assignment.borderColor} ${assignment.bgColor} relative overflow-hidden group transition-all duration-500 shadow-lg cursor-pointer hover:border-blue-500/50 hover:bg-blue-500/5 active:scale-[0.98]`}
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${assignment.severity === 'CRITICAL'
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
                  <div className="flex items-center gap-2">
                    <span className={`text-[8px] font-black px-1 py-0.5 rounded border flex-shrink-0 ${assignment.assignmentType === 'AI'
                        ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                        : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                      }`}>
                      {assignment.assignmentType || 'AI'}
                    </span>
                    <h3 className="text-[15px] font-bold leading-snug text-white group-hover:text-blue-400 transition-colors">
                      {assignment.title}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed flex items-center justify-between">
                    <span>발신: {assignment.sender}</span>
                    {assignment.received_count > 1 && (
                      <span className="bg-blue-500/10 text-blue-400 text-[10px] px-2 py-0.5 rounded-full border border-blue-500/20 font-bold">
                        +{assignment.received_count - 1} 중복
                      </span>
                    )}
                  </p>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-white/5 mt-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center">
                    <User className="w-4 h-4 text-slate-500" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-500 uppercase font-black spacing-tighter opacity-70">Assignees</span>
                      <span className="text-[11px] text-slate-200 font-bold">{assignment.assignees}</span>
                    </div>
                  </div>
                  {assignment.status === '처리완료' ? (
                    <button 
                      onClick={(e) => { e.stopPropagation(); navigate('/ai-report'); }}
                      className="text-xs font-bold text-emerald-500 flex items-center space-x-1 hover:text-white transition-colors bg-emerald-500/5 px-3 py-1.5 rounded-lg border border-emerald-500/20"
                    >
                      <span>분석 리포트</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  ) : (
                    <button 
                      onClick={(e) => { e.stopPropagation(); navigate(`/workflow/${assignment.inc_id}`); }}
                      className="text-xs font-bold text-blue-500 flex items-center space-x-1 hover:text-white transition-colors bg-blue-500/5 px-3 py-1.5 rounded-lg border border-blue-500/20"
                    >
                      <span>인시던트 처리 흐름</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  )}
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
      <BottomMenu currentPath="/assignments" />
    </div>
  );
}
