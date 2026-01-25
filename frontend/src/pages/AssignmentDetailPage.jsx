import React from 'react';
import { ArrowLeft, MoreVertical, Server, Clock, AlertCircle, Copy, Sparkles, MessageSquare, FileText, Play, Home, CheckSquare, BarChart2, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AssignmentDetailPage() {
  const navigate = useNavigate();

  const handleCopyLog = () => {
    const logText = `Error: Connection timed out at port 8080.\nCaused by: java.net.ConnectException: Connection refused\nat com.sguard.core.Net.connect(SourceFile:120)\nat com.sguard.service.Auth.login(Auth.java:45)\nat com.sguard.main.Process.run(Process.java:88)\n... 12 more\nTimestamp: 2023-10-25 13:42:05.112 UTC`;
    navigator.clipboard.writeText(logText);
    alert('로그가 복사되었습니다.');
  };

  return (
    <div className="min-h-screen bg-[#0f111a] text-white font-sans pb-24 relative overflow-x-hidden">
      
      {/* Header */}
      <header className="flex justify-between items-center p-4 sticky top-0 bg-[#0f111a]/80 backdrop-blur-md z-50 border-b border-white/5">
        <button onClick={() => navigate(-1)} className="p-1 rounded-full hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-6 h-6 text-white" />
        </button>
        <span className="font-bold text-lg tracking-wide">할당 내역 상세</span>
        <button className="p-1 rounded-full hover:bg-white/10 transition-colors">
            <MoreVertical className="w-6 h-6 text-white" />
        </button>
      </header>

      <main className="p-4 space-y-6">

        {/* Incident Card */}
        <div className="bg-[#1a1f2e] rounded-3xl p-6 border border-white/5 shadow-lg relative overflow-hidden">
            <div className="flex justify-between items-start mb-2">
                <div>
                   <span className="text-slate-400 text-xs font-medium">Incident ID</span>
                   <h1 className="text-3xl font-bold mt-1 text-white tracking-tight">INC-8823</h1>
                </div>
                <div className="flex items-center space-x-1.5 bg-red-900/30 border border-red-500/30 px-3 py-1 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                    <span className="text-red-500 text-xs font-bold tracking-wide">CRITICAL</span>
                </div>
            </div>
            
            <div className="flex items-center space-x-6 mt-6">
                <div className="flex items-center space-x-2 text-slate-400">
                    <Server className="w-4 h-4" />
                    <span className="text-sm">Server-02</span>
                </div>
                <div className="flex items-center space-x-2 text-slate-400">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm">15분 전</span>
                </div>
            </div>
        </div>

        {/* Error Log Section */}
        <div>
            <div className="flex justify-between items-center mb-3 px-1">
                <div className="flex items-center space-x-2">
                    <div className="bg-red-500 rounded-full p-0.5">
                        <AlertCircle className="w-5 h-5 text-[#0f111a] fill-current" />
                    </div>
                    <h2 className="font-bold text-lg">메시지 오류 내용</h2>
                </div>
                <button 
                  onClick={handleCopyLog}
                  className="flex items-center space-x-1.5 bg-[#1a1f2e] hover:bg-[#252a3d] border border-white/10 px-3 py-1.5 rounded-lg transition-colors"
                >
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs text-slate-300">로그 복사</span>
                </button>
            </div>

            <div className="bg-[#0d0f14] rounded-xl border border-white/10 overflow-hidden font-mono text-xs leading-relaxed shadow-inner">
                {/* Terminal Header */}
                <div className="flex items-center space-x-2 bg-[#1a1f2e] px-4 py-2 border-b border-white/5">
                    <div className="flex space-x-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                    </div>
                    <span className="text-slate-500 text-[10px] ml-2">system.log</span>
                </div>
                {/* Terminal Content */}
                <div className="p-4 text-slate-300 space-y-1">
                    <p>
                        <span className="text-red-400 font-bold">Error:</span> Connection timed out at port 8080.
                    </p>
                    <p className="pl-4">
                        <span className="text-yellow-200">Caused by:</span> <span className="text-yellow-400">java.net.ConnectException</span>: Connection refused
                    </p>
                    <p className="pl-8 text-slate-500">at com.sguard.core.Net.connect(SourceFile:120)</p>
                    <p className="pl-8 text-slate-500">at com.sguard.service.Auth.login(Auth.java:45)</p>
                    <p className="pl-8 text-slate-500">at com.sguard.main.Process.run(Process.java:88)</p>
                    <p className="pl-8 text-slate-600">... 12 more</p>
                    <p className="text-slate-600 mt-2 pt-2 border-t border-white/5">
                        Timestamp: 2023-10-25 13:42:05.112 UTC
                    </p>
                </div>
            </div>
        </div>

        {/* AI Analysis Result */}
        <div className="bg-[#1a1f2e] rounded-2xl p-5 border border-blue-500/20 relative overflow-hidden">
             {/* Gradient Shine */}
             <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-2xl -z-0 rounded-full pointer-events-none" />
             
             <div className="flex items-start space-x-4 relative z-10">
                <div className="bg-blue-600/20 p-2.5 rounded-xl">
                    <Sparkles className="w-6 h-6 text-blue-400 fill-blue-400/20" />
                </div>
                <div className="flex-1">
                    <h3 className="font-bold text-lg mb-2 text-white">AI 분석 결과</h3>
                    <p className="text-sm text-slate-300 leading-relaxed">
                        데이터베이스 <strong className="text-white">연결 풀(Connection Pool)이 초과</strong>되어 응답이 지연되고 있습니다. 현재 활성 세션이 한계치인 500개에 도달했습니다.
                    </p>
                </div>
             </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-3 pt-2">
            <button 
                onClick={() => navigate('/chat')}
                className="flex-1 h-14 bg-[#1a1f2e] hover:bg-[#252a3d] border border-white/10 rounded-xl transition-colors flex items-center justify-center space-x-2"
            >
                <MessageSquare className="w-5 h-5 text-slate-300" />
                <span className="font-bold text-slate-200">War-Room</span>
            </button>

            <button 
                onClick={() => navigate('/ai-report')}
                className="w-32 h-14 bg-blue-600 hover:bg-blue-500 rounded-xl flex items-center justify-center space-x-2 shadow-lg shadow-blue-900/40 transition-all active:scale-[0.98]"
            >
                <Play className="w-5 h-5 text-white fill-current" />
                <span className="font-bold text-white text-sm">처리 완료</span>
            </button>
        </div>

      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 w-full bg-[#0f111a] border-t border-white/10 px-6 py-3 flex justify-between items-center z-50 pb-safe">
        <div className="flex flex-col items-center space-y-1 text-slate-500 hover:text-white transition-colors cursor-pointer" onClick={() => navigate('/dashboard')}>
            <Home className="w-6 h-6" />
            <span className="text-[10px] font-medium">홈</span>
        </div>
        <div className="flex flex-col items-center space-y-1 text-blue-500 relative cursor-pointer">
            <div className="relative">
                <CheckSquare className="w-6 h-6" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full border border-[#0f111a]"></span>
            </div>
            <span className="text-[10px] font-medium">내 할당</span>
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
