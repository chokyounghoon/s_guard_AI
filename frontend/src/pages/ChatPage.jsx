import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, Menu, Plus, Send, Home, MessageSquare, BarChart2, Settings, Info, AlertTriangle, ChevronDown, ChevronUp, Users, LogOut, FileText, UserPlus } from 'lucide-react';

export default function ChatPage() {
  const navigate = useNavigate();
  const [isLogExpanded, setIsLogExpanded] = useState(true);
  const [showPhoneList, setShowPhoneList] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const participants = [
    { name: '정도현 팀장', role: 'Team Leader', phone: '010-1234-5678' },
    { name: '시스템 어드민', role: 'Admin', phone: '010-9876-5432' },
    { name: '최광훈 담당', role: 'Developer', phone: '010-5555-5555' },
    { name: '이수민 매니저', role: 'Manager', phone: '010-1111-2222' },
    { name: '김철수 사원', role: 'Staff', phone: '010-3333-4444' },
    { name: '박영희 대리', role: 'Assistant', phone: '010-7777-8888' },
  ];

  const handleCall = (phoneNumber) => {
    window.location.href = `tel:${phoneNumber}`;
    setShowPhoneList(false);
  };

  return (
    <div className="min-h-screen bg-[#0f1421] text-white font-sans flex flex-col pb-20 relative">
      {/* Header */}
      <header className="flex justify-between items-center p-4 sticky top-0 bg-[#0f1421]/90 backdrop-blur-md z-50 border-b border-white/5">
        <div className="flex items-center space-x-3">
          <button onClick={() => navigate(-1)} className="p-1 rounded-full hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <div className="flex flex-col">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-lg">INC-8823</span>
              <span className="bg-red-500/20 text-red-500 text-[10px] font-bold px-2 py-0.5 rounded border border-red-500/30 uppercase tracking-tighter">
                CRITICAL
              </span>
            </div>
            <span className="text-slate-400 text-xs">장애 협업 채팅방 ({participants.length}명)</span>
          </div>
        </div>
        <div className="flex items-center space-x-4 relative">
          <button 
            onClick={() => { setShowPhoneList(!showPhoneList); setShowMenu(false); }}
            className={`p-1.5 rounded-full transition-colors ${showPhoneList ? 'bg-blue-500/20 text-blue-400' : 'hover:bg-white/10 text-slate-300'}`}
          >
            <Phone className="w-5 h-5" />
          </button>
          
          {/* Phone List Dropdown */}
          {showPhoneList && (
            <div className="absolute top-12 right-0 w-64 bg-[#1a1f2e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50">
                <div className="p-3 border-b border-white/5 bg-[#11141d]">
                    <span className="text-xs font-bold text-slate-300">통화 대상 선택</span>
                </div>
                <div className="max-h-60 overflow-y-auto">
                    {participants.map((person, index) => (
                        <div key={index} onClick={() => handleCall(person.phone)} className="flex items-center justify-between p-3 hover:bg-white/5 cursor-pointer transition-colors border-b border-white/5 last:border-0">
                            <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold">
                                    {person.name[0]}
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm text-white">{person.name}</span>
                                    <span className="text-[10px] text-slate-500">{person.role}</span>
                                </div>
                            </div>
                            <Phone className="w-4 h-4 text-green-500" />
                        </div>
                    ))}
                </div>
            </div>
          )}

          <button 
            onClick={() => { setShowMenu(!showMenu); setShowPhoneList(false); }}
            className={`p-1.5 rounded-full transition-colors ${showMenu ? 'bg-blue-500/20 text-blue-400' : 'hover:bg-white/10 text-slate-300'}`}
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Menu Dropdown */}
          {showMenu && (
            <div className="absolute top-12 right-0 w-48 bg-[#1a1f2e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50">
                <div 
                    onClick={() => { alert('사용자 초대 기능이 실행됩니다.'); setShowMenu(false); }}
                    className="flex items-center space-x-3 p-3 hover:bg-white/5 cursor-pointer transition-colors border-b border-white/5"
                >
                    <UserPlus className="w-4 h-4 text-blue-400" />
                    <span className="text-sm text-slate-200">초대하기</span>
                </div>
                <div 
                    onClick={() => { if(confirm('대화방을 나가시겠습니까?')) navigate('/dashboard'); }}
                    className="flex items-center space-x-3 p-3 hover:bg-red-500/10 cursor-pointer transition-colors"
                >
                    <LogOut className="w-4 h-4 text-red-400" />
                    <span className="text-sm text-red-400">나가기</span>
                </div>
            </div>
          )}
        </div>
      </header>

      {/* Persistent Error Log Banner (Collapsible) */}
      <div className="bg-red-950/10 border-b border-red-500/10 backdrop-blur-sm z-30 sticky top-[73px]">
        <div className="px-4 py-2">
            <div 
                onClick={() => setIsLogExpanded(!isLogExpanded)}
                className="flex items-center justify-between cursor-pointer group"
            >
                <div className="flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse" />
                    <span className="text-xs font-bold text-red-400">🚨 현재 발생 중인 장애 (Ongoing Issue)</span>
                </div>
                <button className="p-1 rounded-full group-hover:bg-red-500/10 transition-colors">
                    {isLogExpanded ? <ChevronUp className="w-4 h-4 text-red-400" /> : <ChevronDown className="w-4 h-4 text-red-400" />}
                </button>
            </div>
            
            {isLogExpanded && (
                <div className="bg-[#0d0f14] rounded-lg border border-red-500/20 overflow-hidden mt-2 mb-1 animate-in slide-in-from-top-2 duration-200">
                    <div className="bg-red-900/10 px-3 py-1.5 border-b border-red-500/10 flex justify-between items-center">
                    <span className="text-[10px] text-red-300 font-mono">system_err.log</span>
                    <span className="text-[10px] text-red-400/70">Live Stream</span>
                    </div>
                    <div className="p-3 text-[11px] font-mono leading-relaxed">
                    <p className="text-red-400"><span className="font-bold">Error:</span> Connection timed out at port 8080.</p>
                    <p className="text-yellow-200/80 mt-1"><span className="font-bold text-yellow-500">Caused by:</span> java.net.ConnectException: Connection refused</p>
                    </div>
                </div>
            )}
        </div>
      </div>

      {/* Chat Area */}
      <main className="flex-1 p-4 space-y-6 overflow-y-auto pb-40">
        {/* Date Divider */}
        <div className="flex justify-center my-4">
          <div className="bg-slate-800/40 text-slate-400 text-[11px] px-4 py-1 rounded-full">
            2023년 10월 25일 수요일
          </div>
        </div>

        {/* Message: Team Leader */}
        <div className="flex items-start space-x-3">
          <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center font-bold text-sm shrink-0">
            JD
          </div>
          <div className="flex flex-col space-y-1">
            <span className="text-xs text-slate-400 font-medium">정도현 팀장</span>
            <div className="flex items-end space-x-2">
              <div className="bg-slate-800/80 rounded-2xl rounded-tl-none px-4 py-2.5 max-w-[280px] text-[15px] leading-relaxed">
                현재 Server-02에서 포트 8080 타임아웃 오류가 발생했습니다. 확인 가능하신 분 있나요?
              </div>
              <span className="text-[10px] text-slate-500 pb-1">13:42</span>
            </div>
          </div>
        </div>

        {/* Message: Admin (With Log Snippet) */}
        <div className="flex items-start space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-900/40 flex items-center justify-center font-bold text-sm text-blue-400 shrink-0 border border-blue-500/20">
            SA
          </div>
          <div className="flex flex-col space-y-1">
            <span className="text-xs text-slate-400 font-medium">시스템 어드민</span>
            <div className="flex flex-col space-y-2">
              <div className="bg-slate-800/80 rounded-2xl rounded-tl-none px-4 py-3 max-w-[280px] text-[15px] leading-relaxed">
                네, 로그 확인 결과 아래와 같은 오류가 발생하고 있습니다.
              </div>
              {/* Note: In-chat log block removed/simplified since it's now in the header, keeping it simple here as reference to header */}
              <div className="flex items-end space-x-2">
                <div className="bg-slate-800/80 rounded-2xl px-4 py-2.5 max-w-[280px] text-[15px] leading-relaxed">
                    상단 로그 배너를 참고해주세요. DB Connection Pool 이슈로 보입니다.
                </div>
                <span className="text-[10px] text-slate-500 pb-1">13:45</span>
              </div>
            </div>
          </div>
        </div>

        {/* Message: My Message */}
        <div className="flex flex-col items-end space-y-1">
          <div className="flex items-end space-x-2">
            <span className="text-[10px] text-slate-500 pb-1">13:46</span>
            <div className="bg-blue-600 rounded-2xl rounded-tr-none px-4 py-3 max-w-[280px] text-[15px] leading-relaxed shadow-lg shadow-blue-900/20">
              제가 지금 유휴 세션 초기화 작업 진행하겠습니다. 작업 완료 후 보고 드리겠습니다.
            </div>
          </div>
        </div>

        {/* System Message */}
        <div className="flex justify-center mt-8">
          <div className="bg-slate-800/30 border border-white/5 rounded-xl px-4 py-2.5 flex items-center space-x-3 max-w-[320px]">
            <div className="p-1.5 bg-blue-500/20 rounded-full">
               <Info className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-[13px] text-slate-300">
               사용자가 <span className="text-blue-400 font-semibold underline underline-offset-4 decoration-blue-500/40">임시 복구 작업</span>을 시작했습니다.
            </p>
          </div>
        </div>
      </main>
    
      {/* New Analysis Action Bar */}
      <div className="px-4 pb-2 bg-[#0f1421]">
        <button 
            onClick={() => navigate('/ai-process-report')}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-900/30 flex items-center justify-center space-x-2 transition-all active:scale-[0.98]"
        >
            <Settings className="w-5 h-5 animate-spin-slow" />
            <span>AI 처리 분석 및 결과 보고서 생성</span>
        </button>
      </div>

      {/* Input Area */}
      <div className="p-3 bg-[#0f1421] border-t border-white/5 flex items-center space-x-3 mb-[70px]">
        <button className="p-2.5 rounded-full bg-slate-800/60 hover:bg-slate-700 transition-colors">
          <Plus className="w-6 h-6 text-slate-400" />
        </button>
        <div className="flex-1 relative">
           <input 
             type="text" 
             placeholder="메시지를 입력하세요..." 
             className="w-full bg-slate-800/60 rounded-full py-2.5 px-5 text-[15px] border border-white/5 focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-slate-500"
           />
           <button className="absolute right-1 top-1 p-1.5 rounded-full bg-blue-600 text-white shadow-lg shadow-blue-900/40">
              <Send className="w-5 h-5 fill-current" />
           </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="fixed bottom-0 left-0 w-full bg-[#0f1421] border-t border-white/5 px-6 py-3 flex justify-between items-center z-50 pb-safe">
        <div className="flex flex-col items-center space-y-1 text-slate-500 hover:text-white transition-colors cursor-pointer" onClick={() => navigate('/dashboard')}>
            <Home className="w-6 h-6" />
            <span className="text-[10px] font-medium">홈</span>
        </div>
        <div className="flex flex-col items-center space-y-1 text-blue-500 relative cursor-pointer" onClick={() => navigate('/chat')}>
            <div className="relative">
                <MessageSquare className="w-6 h-6" />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#0f1421]"></span>
            </div>
            <span className="text-[10px] font-medium">War-Room</span>
        </div>

        <div className="flex flex-col items-center space-y-1 text-slate-500 hover:text-white transition-colors cursor-pointer">
            <BarChart2 className="w-6 h-6" />
            <span className="text-[10px] font-medium">통계</span>
        </div>
        <div className="flex flex-col items-center space-y-1 text-slate-500 hover:text-white transition-colors cursor-pointer">
            <Settings className="w-6 h-6" />
            <span className="text-[10px] font-medium">설정</span>
        </div>
      </nav>
    </div>
  );
}
