import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, Menu, Plus, Send, Home, MessageSquare, BarChart2, Settings, Info } from 'lucide-react';

export default function ChatPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0f1421] text-white font-sans flex flex-col pb-20">
      {/* Header */}
      <header className="flex justify-between items-center p-4 sticky top-0 bg-[#0f1421]/90 backdrop-blur-md z-40 border-b border-white/5">
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
            <span className="text-slate-400 text-xs">장애 협업 채팅방 (6명)</span>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <button className="p-1.5 rounded-full hover:bg-white/10 transition-colors">
            <Phone className="w-5 h-5 text-slate-300" />
          </button>
          <button className="p-1.5 rounded-full hover:bg-white/10 transition-colors">
            <Menu className="w-5 h-5 text-slate-300" />
          </button>
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 p-4 space-y-6 overflow-y-auto">
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

        {/* Message: Admin */}
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
              
              {/* Log Block */}
              <div className="bg-[#0d0f14] rounded-xl border border-white/5 overflow-hidden w-[280px] mt-1">
                <div className="bg-white/5 px-3 py-1.5 border-b border-white/5 flex justify-between items-center">
                  <span className="text-[10px] text-slate-500 font-mono">system_err.log</span>
                </div>
                <div className="p-3 text-[11px] font-mono leading-relaxed">
                  <p className="text-red-400"><span className="font-bold">Error:</span> Connection timed out at port 8080.</p>
                  <p className="text-yellow-200 mt-1"><span className="font-bold text-yellow-500">Caused by:</span> java.net.ConnectException: Connection refused</p>
                </div>
              </div>

              <div className="flex items-end space-x-2">
                <div className="bg-slate-800/80 rounded-2xl px-4 py-2.5 max-w-[280px] text-[15px] leading-relaxed">
                  DB Connection Pool 초과로 보입니다. 유휴 세션 정리가 필요해 보입니다.
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

      {/* Input Area */}
      <div className="p-3 bg-[#0f1421] border-t border-white/5 flex items-center space-x-3">
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
