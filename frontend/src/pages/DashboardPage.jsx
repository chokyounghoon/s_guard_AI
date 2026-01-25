import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Label } from 'recharts';
import { Bell, User, Monitor, RefreshCw, CheckCircle, ClipboardList, MessageSquare, Search, MoreHorizontal, Home, Zap, Shield, CheckSquare, BarChart2, Settings, AlertTriangle, Info, AlertCircle, ChevronRight, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const completionData = [
  { name: 'Completed', value: 85, color: '#3B82F6' }, // Blue
  { name: 'Remaining', value: 15, color: '#1a1f2e' }, // Dark background
];

export default function DashboardPage() {
  const navigate = useNavigate();
  const [smsMessages, setSmsMessages] = useState([]);

  // SMS 메시지 폴링 (5초마다)
  useEffect(() => {
    // 초기 로드
    fetchSMSMessages();
    
    // 5초마다 새 메시지 확인
    const interval = setInterval(fetchSMSMessages, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchSMSMessages = async () => {
    try {
      // 프로덕션에서는 실제 API URL 사용
      const apiUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:8000/sms/recent?limit=3'
        : 'https://your-backend-api.com/sms/recent?limit=3';
      
      const response = await fetch(apiUrl);
      if (response.ok) {
        const data = await response.json();
        setSmsMessages(data.messages || []);
      }
    } catch (error) {
      console.error('SMS 메시지 로드 실패:', error);
      // 에러 시 목 데이터 사용 (데모용)
      setSmsMessages([
        {
          id: 1,
          sender: '010-1234-5678',
          message: 'CRITICAL: 서버 장애 발생 - DB 연결 실패',
          timestamp: new Date().toISOString(),
          keyword_detected: true,
          response_message: '긴급 장애가 감지되었습니다. 즉시 War-Room을 통해 확인해주세요.',
          read: false
        }
      ]);
    }
  };

  const dismissMessage = (id) => {
    setSmsMessages(prev => prev.filter(msg => msg.id !== id));
  };

  return (
    <div className="min-h-screen bg-[#0f111a] text-white font-sans pb-24 relative overflow-x-hidden">
        
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
                          <span>자동 응답: {msg.response_message}</span>
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
                    className="bg-[#11141d] p-5 rounded-2xl border border-white/5 relative cursor-pointer hover:bg-[#1a1f2e] transition-colors"
                >
                    <p className="text-xs text-slate-400 mb-2 font-medium">할당됨</p>
                    <span className="text-4xl font-bold text-white">5</span>
                    <div className="absolute bottom-4 right-4 bg-blue-600/20 p-2 rounded-xl">
                        <MoreHorizontal className="w-5 h-5 text-blue-500 fill-current" />
                    </div>
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
                <h3 className="text-sm font-bold text-white">최근 할당 리스트</h3>
                <button className="text-[11px] text-blue-500 font-medium hover:text-blue-400 flex items-center">
                    전체보기 <ChevronRight className="w-3 h-3 ml-0.5" />
                </button>
            </div>

            {/* List Items */}
            <div className="space-y-3">
                {/* Item 1 - Critical */}
                <div 
                    onClick={() => navigate('/assignment-detail')}
                    className="bg-[#11141d] p-4 rounded-2xl border border-white/5 relative group hover:border-white/10 transition-colors cursor-pointer"
                >
                    <div className="flex items-start space-x-3">
                         <div className="bg-red-500/10 p-2 rounded-full mt-0.5">
                            <AlertCircle className="w-5 h-5 text-red-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start mb-1">
                                <h4 className="text-sm font-bold text-white truncate max-w-[80%]">[신한카드] 2026/01/22/21:52:51</h4>
                                <span className="text-[10px] text-slate-500 font-mono">21:52:51</span>
                            </div>
                            <p className="text-xs text-slate-300 leading-snug mb-2 line-clamp-2">
                                SHB02681 은행고객종합정보 비즈니스오류 임계치 초과
                            </p>
                            <div className="flex items-center justify-between">
                                <span className="bg-red-500/20 text-red-500 text-[10px] font-bold px-2 py-0.5 rounded border border-red-500/30">Critical</span>
                                <span className="text-[10px] text-slate-500">SHB02681</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Item 2 - Warning */}
                <div 
                    onClick={() => navigate('/assignment-detail')}
                    className="bg-[#11141d] p-4 rounded-2xl border border-white/5 relative group hover:border-white/10 transition-colors cursor-pointer"
                >
                    <div className="flex items-start space-x-3">
                         <div className="bg-amber-500/10 p-2 rounded-full mt-0.5">
                            <AlertTriangle className="w-5 h-5 text-amber-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                             <div className="flex justify-between items-center mb-1">
                                <h4 className="text-sm font-bold text-white">DB 커넥션 풀 임계치 초과</h4>
                                <span className="bg-amber-500/20 text-amber-500 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-500/30">높음</span>
                            </div>
                            <div className="flex justify-between items-center text-[11px] text-slate-500">
                                <span>Node-DB-01 Warning</span>
                                <span className="font-mono">09:15 AM</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Item 3 - Info */}
                <div 
                    onClick={() => navigate('/assignment-detail')}
                    className="bg-[#11141d] p-4 rounded-2xl border border-white/5 relative group hover:border-white/10 transition-colors cursor-pointer"
                >
                    <div className="flex items-start space-x-3">
                         <div className="bg-blue-500/10 p-2 rounded-full mt-0.5">
                            <Info className="w-5 h-5 text-blue-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                             <div className="flex justify-between items-center mb-1">
                                <h4 className="text-sm font-bold text-white">이미지 서버 동기화 지연</h4>
                                <span className="bg-blue-500/20 text-blue-500 text-[10px] font-bold px-2 py-0.5 rounded border border-blue-500/30">보통</span>
                            </div>
                            <div className="flex justify-between items-center text-[11px] text-slate-500">
                                <span>CDN-KR-04 Latency</span>
                                <span className="font-mono">08:30 AM</span>
                            </div>
                        </div>
                    </div>
                </div>

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
