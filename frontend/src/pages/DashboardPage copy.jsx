import React, { useState, useEffect, useRef } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Label } from 'recharts';
import { Bell, User, Monitor, RefreshCw, CheckCircle, ClipboardList, MessageSquare, Search, MoreHorizontal, Home, Zap, Shield, CheckSquare, BarChart2, Settings, AlertTriangle, Info, AlertCircle, ChevronRight, X, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const completionData = [
  { name: 'Completed', value: 85, color: '#3B82F6' }, // Blue
  { name: 'Remaining', value: 15, color: '#1a1f2e' }, // Dark background
];

export default function DashboardPage() {
  const navigate = useNavigate();
  const [smsMessages, setSmsMessages] = useState([]);
  const [recentAssignments, setRecentAssignments] = useState([]);
  const [dismissedIds, setDismissedIds] = useState([]);
  const [totalAssignedCount, setTotalAssignedCount] = useState(0);
  const dismissedIdsRef = useRef([]);

  // 초기 로드 시 localStorage에서 데이터 불러오기
  useEffect(() => {
    // 할당 내역 로드
    const savedAssignments = localStorage.getItem('sguard_assignments');
    if (savedAssignments) {
      try {
        setRecentAssignments(JSON.parse(savedAssignments));
      } catch (e) {
        console.error('할당 내역 로드 실패:', e);
      }
    }

    // 닫은 메시지 ID 로드
    const savedDismissed = localStorage.getItem('sguard_dismissed_ids');
    if (savedDismissed) {
      try {
        const ids = JSON.parse(savedDismissed);
        setDismissedIds(ids);
        dismissedIdsRef.current = ids;
      } catch (e) {
        console.error('닫은 메시지 로드 실패:', e);
      }
    }

    // 총 할당 건수 로드
    const savedCount = localStorage.getItem('sguard_total_count');
    if (savedCount) {
      setTotalAssignedCount(parseInt(savedCount));
    } else {
      setTotalAssignedCount(5); 
    }
  }, []);

  // SMS 메시지 폴링 (5초마다)
  useEffect(() => {
    fetchSMSMessages();
    const interval = setInterval(fetchSMSMessages, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchSMSMessages = async () => {
    try {
      // Cloudflare Workers API 사용
      const apiUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:8000/sms/recent?limit=3'
        : 'https://api.chokerslab.store/sms/recent?limit=3';
      
      const response = await fetch(apiUrl);
      if (response.ok) {
        const data = await response.json();
        const messages = data.messages || [];
        
        // 닫지 않은 메시지만 필터링하여 상단 알림에 표시
        const filteredMessages = messages.filter(msg => !dismissedIdsRef.current.includes(msg.id));
        setSmsMessages(filteredMessages);
        
        // SMS를 할당 리스트에 추가 (할당 리스트는 닫기 여부와 상관없이 누적)
        if (messages.length > 0) {
          addToAssignments(messages);
        }
      }
    } catch (error) {
      console.error('SMS 메시지 로드 실패:', error);
    }
  };

  const addToAssignments = (messages) => {
    setRecentAssignments(prev => {
      const existingIds = new Set(prev.map(a => a.smsId));
      const newItems = messages
        .filter(msg => !existingIds.has(msg.id))
        .map(msg => ({
          smsId: msg.id,
          id: `sms-${msg.id}-${Date.now()}`,
          severity: msg.keyword_detected ? 'CRITICAL' : 'MEDIUM',
          code: `SMS${String(msg.id).padStart(5, '0')}`,
          time: new Date(msg.timestamp).toLocaleTimeString('ko-KR', { 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit'
          }),
          title: msg.message,
          sender: msg.sender,
          timestamp: msg.timestamp,
          bgColor: msg.keyword_detected ? 'bg-red-900/10' : 'bg-blue-900/10',
          borderColor: msg.keyword_detected ? 'border-red-500/20' : 'border-blue-500/20'
        }));
      
      if (newItems.length > 0) {
        const updated = [...newItems, ...prev].slice(0, 10);
        localStorage.setItem('sguard_assignments', JSON.stringify(updated));
        
        // 총 할당 건수 업데이트
        setTotalAssignedCount(current => {
          const newCount = current + newItems.length;
          localStorage.setItem('sguard_total_count', newCount.toString());
          return newCount;
        });
        
        return updated;
      }
      return prev;
    });
  };

  const dismissMessage = (id) => {
    setSmsMessages(prev => prev.filter(msg => msg.id !== id));
    
    // 닫은 메시지 ID를 저장
    const updated = [...dismissedIdsRef.current, id];
    dismissedIdsRef.current = updated;
    setDismissedIds(updated);
    localStorage.setItem('sguard_dismissed_ids', JSON.stringify(updated));
  };

  return (
    <div className="min-h-screen bg-[#0a0e17] text-white font-sans pb-24 relative overflow-x-hidden">
        
       {/* Background Glows */}
       <div className="fixed top-0 left-0 w-full h-96 bg-blue-900/5 blur-[100px] -z-10 pointer-events-none" />

      {/* Header */}
      <header className="flex justify-between items-center p-5 sticky top-0 bg-[#0f111a]/90 backdrop-blur-md z-50 border-b border-white/5">
        <div className="flex items-center space-x-2">
            <div className="bg-blue-600 p-1.5 rounded-lg shadow-lg shadow-blue-900/50">
                <Shield className="w-4 h-4 text-white fill-current" />
            </div>
            <span className="font-bold text-lg tracking-wide">S-Guard AI</span>
        </div>
        <div className="flex items-center space-x-4">
            <div className="relative">
                <Bell className="w-6 h-6 text-slate-400" />
                {smsMessages.length > 0 && (
                  <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-[#0f111a]"></span>
                )}
            </div>
            <div className="w-8 h-8 bg-slate-700/50 rounded-full flex items-center justify-center border border-white/10">
                <User className="w-5 h-5 text-slate-300" />
            </div>
        </div>
      </header>

      {/* SMS 알림 영역 */}
      {smsMessages.length > 0 && (
        <div className="px-5 pt-4 space-y-3">
          {smsMessages.map((msg) => (
            <div
              key={msg.id}
              className="bg-gradient-to-r from-blue-600 to-blue-500 rounded-2xl p-4 shadow-xl shadow-blue-900/50 border border-blue-400/30 animate-slide-down"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3 flex-1">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                    {msg.keyword_detected ? (
                      <AlertCircle className="w-6 h-6 text-yellow-300" />
                    ) : (
                      <Info className="w-6 h-6 text-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="font-bold text-white text-sm">SMS 수신</h3>
                      {msg.keyword_detected && (
                        <span className="bg-yellow-400 text-yellow-900 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          키워드 감지
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-blue-100 mb-1">
                      발신: {msg.sender}
                    </p>
                    <p className="text-sm text-white font-medium leading-snug">
                      {msg.message}
                    </p>
                    {msg.response_message && (
                      <div className="mt-2 bg-white/10 rounded-lg p-2 border border-white/20">
                        <p className="text-xs text-blue-100 flex items-center space-x-1">
                          <CheckCircle className="w-3 h-3" />
                          {(() => {
                            if (msg.response_message.includes('AI 분석을 시작합니다.')) {
                              const parts = msg.response_message.split('AI 분석을 시작합니다.');
                              return (
                                <span>
                                  자동 응답: {parts[0]}
                                  <span 
                                    onClick={(e) => { e.stopPropagation(); navigate('/ai-report'); }}
                                    className="underline decoration-yellow-400/50 underline-offset-4 cursor-pointer font-bold text-yellow-300 hover:text-white transition-colors animate-pulse"
                                  >
                                    AI 분석을 시작합니다.
                                  </span>
                                  {parts[1]}
                                </span>
                              );
                            } else if (msg.response_message.includes('War-Room')) {
                              const parts = msg.response_message.split('War-Room');
                              return (
                                <span>
                                  자동 응답: {parts[0]}
                                  <span 
                                    onClick={(e) => { e.stopPropagation(); navigate('/chat'); }}
                                    className="underline decoration-blue-400/50 underline-offset-4 cursor-pointer font-bold text-blue-300 hover:text-white transition-colors animate-pulse"
                                  >
                                    War-Room
                                  </span>
                                  {parts[1]}
                                </span>
                              );
                            } else {
                              return <span>자동 응답: {msg.response_message}</span>;
                            }
                          })()}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => dismissMessage(msg.id)}
                  className="ml-2 p-1 rounded-full hover:bg-white/20 transition-colors shrink-0"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <main className="p-5 space-y-5">
        
        {/* Section 1: Integration Status (4 Cards) - Moved to top */}
        <div className="bg-[#1a1f2e] rounded-3xl p-6 border border-white/5 shadow-xl">
            <div className="flex justify-between items-center mb-4">
                <h2 className="font-bold text-lg">통합 처리 현황</h2>
                <span className="text-[10px] bg-slate-700/50 px-3 py-1.5 rounded-full text-slate-300 font-medium">전체 기관</span>
            </div>

            <div className="grid grid-cols-4 gap-3">
                {[
                    { label: '접수', val: 128, icon: Monitor, color: 'bg-slate-700', text: 'text-slate-400', bar: 'bg-slate-500' },
                    { label: '처리중', val: 39, icon: RefreshCw, color: 'bg-blue-900/50', text: 'text-blue-400', bar: 'bg-blue-500' },
                    { label: '완료', val: 89, icon: CheckCircle, color: 'bg-emerald-900/50', text: 'text-emerald-400', bar: 'bg-emerald-500' },
                    { label: '리포트', val: 85, icon: ClipboardList, color: 'bg-purple-900/50', text: 'text-purple-400', bar: 'bg-purple-500' },
                ].map((stat, idx) => (
                    <div key={idx} className="bg-[#11141d] rounded-2xl p-3 flex flex-col items-center justify-between h-36 relative overflow-hidden border border-white/5 group hover:border-white/10 transition-colors">
                        <span className="text-[10px] text-slate-400 mb-2 font-medium">{stat.label}</span>
                        <div className={`p-2.5 rounded-full ${stat.color} mb-1 group-hover:scale-110 transition-transform`}>
                            <stat.icon className={`w-5 h-5 ${stat.text}`} />
                        </div>
                        <span className="text-xl font-bold">{stat.val}</span>
                        <div className={`absolute bottom-0 left-0 w-full h-[3px] ${stat.bar}`} />
                    </div>
                ))}
            </div>
        </div>
        
        {/* Section 2: My Processing Status (Donut) */}
        <div className="bg-[#1a1f2e] rounded-3xl p-6 border border-white/5 shadow-xl relative overflow-hidden">
            <div className="flex justify-between items-center mb-6">
                <h2 className="font-bold text-lg">나의 처리 현황</h2>
                <span className="text-[10px] bg-slate-700/50 px-3 py-1.5 rounded-full text-slate-300 font-medium">이번 주</span>
            </div>
            
            <div className="h-48 relative flex items-center justify-center mb-6">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={completionData}
                            innerRadius={65}
                            outerRadius={85}
                            startAngle={90}
                            endAngle={-270}
                            dataKey="value"
                            stroke="none"
                        >
                            <Cell key="completed" fill="#3B82F6" cornerRadius={10} />
                            <Cell key="remaining" fill="#11141d" />
                            <Label 
                                value="85%" 
                                position="center" 
                                className="fill-white text-4xl font-bold"
                            />
                             <Label 
                                value="완료율" 
                                position="center" 
                                dy={25}
                                className="fill-slate-400 text-xs font-medium"
                            />
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-3 gap-4 border-t border-white/5 pt-4">
                <div className="text-center">
                    <p className="text-xs text-slate-400 mb-1">완료</p>
                    <p className="text-lg font-bold text-white">34건</p>
                </div>
                <div className="text-center border-l border-white/5">
                    <p className="text-xs text-slate-400 mb-1">대기</p>
                    <p className="text-lg font-bold text-white">6건</p>
                </div>
                <div className="text-center border-l border-white/5">
                    <p className="text-xs text-slate-400 mb-1">평균시간</p>
                    <p className="text-lg font-bold text-white">25분</p>
                </div>
            </div>
        </div>

         {/* Section 3: My Assignments & Recent List */}
         <div className="bg-[#1a1f2e] rounded-3xl p-6 border border-white/5 shadow-xl">
            <div className="flex justify-between items-center mb-5">
                 <div className="flex items-center space-x-2">
                    <User className="w-5 h-5 text-blue-500" />
                    <h2 className="font-bold text-lg">나의 할당 내역</h2>
                 </div>
                <span className="text-[10px] text-slate-400">실시간 업데이트</span>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <div 
                    onClick={() => navigate('/assignments')}
                    className="bg-[#11141d] p-5 rounded-2xl border border-white/5 relative cursor-pointer hover:bg-[#252b41] transition-all hover:scale-[1.02] active:scale-95"
                >
                    <p className="text-xs text-slate-400 mb-2 font-medium">할당됨</p>
                    <span className="text-4xl font-bold text-white transition-all duration-500">{totalAssignedCount}</span>
                    <div className="absolute bottom-4 right-4 bg-blue-600/20 p-2 rounded-xl">
                        <MoreHorizontal className="w-5 h-5 text-blue-500 fill-current" />
                    </div>
                    {/* 실시간 업데이트 링 애니메이션 (새 메시지 수신 시) */}
                    <div className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full animate-ping" />
                </div>
                <div 
                    onClick={() => navigate('/assignments')}
                    className="bg-[#11141d] p-5 rounded-2xl border border-white/5 relative cursor-pointer hover:bg-[#1a1f2e] transition-colors"
                >
                    <p className="text-xs text-slate-400 mb-2 font-medium">처리중</p>
                    <span className="text-4xl font-bold text-emerald-400">2</span>
                    <div className="absolute bottom-4 right-4 bg-emerald-600/20 p-2 rounded-xl">
                        <RefreshCw className="w-5 h-5 text-emerald-500" />
                    </div>
                </div>
                <div 
                    onClick={() => navigate('/assignments')}
                    className="bg-[#11141d] p-5 rounded-2xl border border-white/5 relative cursor-pointer hover:bg-[#1a1f2e] transition-colors"
                >
                    <p className="text-xs text-slate-400 mb-2 font-medium">처리완료</p>
                    <span className="text-4xl font-bold text-blue-400">3</span>
                    <div className="absolute bottom-4 right-4 bg-blue-600/20 p-2 rounded-xl">
                        <CheckCircle className="w-5 h-5 text-blue-500" />
                    </div>
                </div>
            </div>

            {/* Recent List Header */}
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-white">최근 할당 리스트 ({recentAssignments.length})</h3>
                <button 
                    onClick={() => navigate('/assignments')}
                    className="text-[11px] text-blue-500 font-medium hover:text-blue-400 flex items-center"
                >
                    전체보기 <ChevronRight className="w-3 h-3 ml-0.5" />
                </button>
            </div>

            {/* List Items - Dynamic */}
            <div className="space-y-3">
                {recentAssignments.length > 0 ? (
                    recentAssignments.slice(0, 3).map((item) => (
                        <div 
                            key={item.id}
                            onClick={() => navigate('/assignment-detail')}
                            className={`${item.bgColor} p-4 rounded-2xl border ${item.borderColor} relative group hover:border-white/10 transition-colors cursor-pointer`}
                        >
                            <div className="flex items-start space-x-3">
                                <div className={`${item.severity === 'CRITICAL' ? 'bg-red-500/10' : 'bg-blue-500/10'} p-2 rounded-full mt-0.5`}>
                                    <AlertCircle className={`w-5 h-5 ${item.severity === 'CRITICAL' ? 'text-red-500' : 'text-blue-500'}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start mb-1">
                                        <h4 className="text-sm font-bold text-white truncate max-w-[70%]">{item.title}</h4>
                                        <span className="text-[10px] text-slate-500 font-mono">{item.time}</span>
                                    </div>
                                    <p className="text-xs text-slate-300 leading-snug mb-2">
                                        발신: {item.sender}
                                    </p>
                                    <div className="flex items-center justify-between">
                                        <span className={`${item.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-500 border-red-500/30' : 'bg-blue-500/20 text-blue-500 border-blue-500/30'} text-[10px] font-bold px-2 py-0.5 rounded border`}>
                                            {item.severity}
                                        </span>
                                        <span className="text-[10px] text-slate-500">{item.code}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="bg-[#11141d] p-8 rounded-2xl border border-white/5 text-center">
                        <Info className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                        <p className="text-sm text-slate-400">최근 할당 내역이 없습니다</p>
                        <p className="text-xs text-slate-500 mt-1">SMS 메시지가 수신되면 자동으로 추가됩니다</p>
                    </div>
                )}
            </div>
          </div>

        {/* Section 4: AI Analysis Report Banner - NEW */}
        <div 
          onClick={() => navigate('/ai-report')}
          className="bg-gradient-to-r from-blue-600 to-blue-500 rounded-3xl p-5 shadow-xl shadow-blue-900/30 border border-blue-400/30 relative overflow-hidden cursor-pointer group hover:scale-[1.02] transition-all active:scale-[0.98]"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-2xl rounded-full -mr-10 -mt-10" />
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center space-x-4">
              <div className="bg-white/20 p-2.5 rounded-2xl">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-base text-white">AI 분석 리포트</h2>
                <p className="text-xs text-blue-100 mt-0.5">비정상적인 IP 대역 접근 탐지 및 대응 권고</p>
              </div>
            </div>
            <button className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl text-xs font-bold text-white transition-colors">
              확인
            </button>
          </div>
        </div>

      </main>


      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 w-full bg-[#0f111a] border-t border-white/10 px-6 py-3 flex justify-between items-center z-50 pb-safe">
        <div className="flex flex-col items-center space-y-1 text-blue-500 cursor-pointer">
            <Home className="w-6 h-6 fill-current" />
            <span className="text-[10px] font-medium">홈</span>
        </div>
        <div className="flex flex-col items-center space-y-1 text-slate-500 hover:text-white transition-colors cursor-pointer" onClick={() => navigate('/chat')}>
            <MessageSquare className="w-6 h-6" />
            <span className="text-[10px] font-medium">War-Room</span>
        </div>
        <div className="flex flex-col items-center space-y-1 text-slate-500 hover:text-white transition-colors cursor-pointer" onClick={() => navigate('/activity')}>
            <BarChart2 className="w-6 h-6" />
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
