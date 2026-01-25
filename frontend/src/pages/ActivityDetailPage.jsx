import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MoreVertical, ShieldCheck, Sparkles, AlertTriangle, ListChecks, History, User, FileDown, Share2, Home, MessageSquare, Activity, Search, MoreHorizontal } from 'lucide-react';
import { BarChart, Bar, Cell, XAxis, YAxis, ResponsiveContainer, ReferenceLine } from 'recharts';

const chartData = [
  { time: '01:00', value: 30 },
  { time: '02:00', value: 45 },
  { time: '03:00', value: 85 },
  { time: '04:00', value: 55 },
  { time: '05:00', value: 25 },
];

export default function ActivityDetailPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0f1421] text-white font-sans flex flex-col pb-32">
      {/* Header */}
      <header className="flex items-start p-5 sticky top-0 bg-[#0f1421]/90 backdrop-blur-md z-40 space-x-4">
        <button onClick={() => navigate(-1)} className="mt-1 p-1 rounded-full hover:bg-white/10 transition-colors">
          <ArrowLeft className="w-6 h-6 text-white" />
        </button>
        <h1 className="font-bold text-lg leading-tight flex-1">
          [신한카드] SHB02681 은행고객종합정보 시스템 보안탐지 분석 보고
        </h1>
      </header>

      <main className="flex-1 p-5 space-y-8">
        {/* Top Status Card */}
        <div className="bg-blue-600/10 border border-blue-500/20 rounded-2xl p-5 flex items-center justify-between">
            <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-full bg-blue-600/20 flex items-center justify-center">
                    <ShieldCheck className="w-7 h-7 text-blue-500" />
                </div>
                <div>
                    <h2 className="text-blue-400 font-bold">대표이사 보고 완료</h2>
                    <p className="text-xs text-slate-500 mt-0.5">2024년 5월 22일 15:45</p>
                </div>
            </div>
            <MoreVertical className="w-5 h-5 text-slate-500" />
        </div>

        {/* AI Summary Section */}
        <div className="space-y-4">
            <div className="flex items-center space-x-2.5">
                <Sparkles className="w-5 h-5 text-blue-400 fill-blue-400/10" />
                <h3 className="font-bold text-lg">AI 요약</h3>
            </div>
            <div className="bg-[#1a1f2e] rounded-2xl p-5 border border-white/5 line-height-relaxed">
                <p className="text-[15px] text-slate-300 leading-relaxed">
                    본 리포트는 SHB02681 시스템에서 감지된 비정상적인 데이터 접근 시도에 대한 분석 결과를 담고 있습니다. 
                    <span className="text-blue-400 font-medium"> 내부 관리자 계정의 탈취 가능성</span>이 확인되었으나, 실시간 탐지 시스템의 즉각적인 대응으로 
                    <strong className="text-white"> 고객 정보 유출은 발생하지 않았음</strong>을 확인하였습니다.
                </p>
            </div>
        </div>

        {/* Cause & Impact Section */}
        <div className="space-y-4">
            <div className="flex items-center space-x-2.5">
                <AlertTriangle className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-lg">장애 원인 및 영향</h3>
            </div>
            <div className="bg-[#1a1f2e] rounded-2xl p-6 border border-white/5 space-y-6">
                <ul className="space-y-4">
                    <li className="flex items-start space-x-3 text-sm text-slate-300">
                        <span className="w-1 h-1 rounded-full bg-blue-500 mt-2 shrink-0"></span>
                        <span>피싱 메일을 통한 내부망 관리자 단말기 악성코드 감염</span>
                    </li>
                    <li className="flex items-start space-x-3 text-sm text-slate-300">
                        <span className="w-1 h-1 rounded-full bg-blue-500 mt-2 shrink-0"></span>
                        <span>비정상 시간대(02:15) 대량의 SQL Query 실행 시도</span>
                    </li>
                </ul>
                
                {/* Micro Chart */}
                <div className="h-40 relative">
                     <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] font-bold text-blue-500 uppercase tracking-widest">Peak</span>
                     <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                            <XAxis 
                                dataKey="time" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{fill: '#4b5563', fontSize: 10}} 
                                dy={10}
                            />
                            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={index === 2 ? '#3b82f6' : '#2b3548'} />
                                ))}
                            </Bar>
                        </BarChart>
                     </ResponsiveContainer>
                </div>
            </div>
        </div>

        {/* Action Details Section */}
        <div className="space-y-4">
            <div className="flex items-center space-x-2.5">
                <ListChecks className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-lg">조치 내역</h3>
            </div>
            <div className="space-y-8 relative pl-5 py-2">
                {/* Timeline Line */}
                <div className="absolute left-[3px] top-6 bottom-6 w-[1.5px] bg-slate-700"></div>
                
                <div className="relative">
                    <div className="absolute -left-[20px] top-1.5 w-2 h-2 rounded-full bg-blue-500 ring-4 ring-[#0f1421]"></div>
                    <div className="space-y-1">
                        <span className="text-[11px] text-slate-500 font-medium">14:20</span>
                        <p className="text-sm font-bold text-slate-200">해당 관리자 계정 즉시 잠금 및 세션 강제 종료</p>
                    </div>
                </div>

                <div className="relative">
                    <div className="absolute -left-[20px] top-1.5 w-2 h-2 rounded-full bg-blue-500 ring-4 ring-[#0f1421]"></div>
                    <div className="space-y-1">
                        <span className="text-[11px] text-slate-500 font-medium">14:35</span>
                        <p className="text-sm font-bold text-slate-200">침입 IP 대역 방화벽 블랙리스트 등록</p>
                    </div>
                </div>

                <div className="relative">
                    <div className="absolute -left-[20px] top-1.5 w-2 h-2 rounded-full bg-blue-500 ring-4 ring-[#0f1421]"></div>
                    <div className="space-y-1">
                        <span className="text-[11px] text-slate-500 font-medium">15:10</span>
                        <p className="text-sm font-bold text-slate-200">전사 관리자 비밀번호 변경 및 2FA 강화 공지</p>
                    </div>
                </div>
            </div>
        </div>

        {/* Report History Section */}
        <div className="space-y-4">
            <div className="flex items-center space-x-2.5">
                <History className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-lg">보고 이력</h3>
            </div>
            <div className="bg-[#1a1f2e] rounded-2xl border border-white/5 overflow-hidden divide-y divide-white/5">
                {/* History Item 1 */}
                <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center">
                            <User className="w-5 h-5 text-slate-400" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-100">보안팀장 승인</p>
                            <p className="text-xs text-slate-500">김철수 팀장</p>
                        </div>
                    </div>
                    <span className="text-[11px] text-blue-500 font-medium">14:45 완료</span>
                </div>
                {/* History Item 2 */}
                <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center">
                            <User className="w-5 h-5 text-slate-400" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-100">본부장 승인</p>
                            <p className="text-xs text-slate-500">이영희 본부장</p>
                        </div>
                    </div>
                    <span className="text-[11px] text-blue-500 font-medium">15:15 완료</span>
                </div>
                {/* History Item 3 */}
                <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center">
                            <ShieldCheck className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-blue-500">대표이사 최종 보고</p>
                            <p className="text-xs text-slate-500">박지성 대표이사</p>
                        </div>
                    </div>
                    <span className="text-[11px] text-blue-500 font-bold">15:45 완료</span>
                </div>
            </div>
        </div>
      </main>

      {/* Floating Action Buttons */}
      <div className="fixed bottom-8 left-0 w-full px-5 flex items-center space-x-3 z-50">
        <button className="flex-1 flex items-center justify-center space-x-2 bg-[#1a1f2e] border border-white/10 h-16 rounded-2xl hover:bg-slate-800 transition-all active:scale-95 shadow-xl">
            <FileDown className="w-5 h-5 text-slate-200" />
            <span className="font-bold text-slate-200">PDF 다운로드</span>
        </button>
        <button className="flex-1 flex items-center justify-center space-x-3 bg-blue-600 hover:bg-blue-500 h-16 rounded-2xl transition-all active:scale-[0.98] shadow-2xl shadow-blue-900/50">
            <Share2 className="w-5 h-5 text-white fill-current" />
            <span className="font-bold text-lg text-white">공유하기</span>
        </button>
      </div>

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
        <div className="flex flex-col items-center space-y-1 text-blue-500 transition-colors cursor-pointer" onClick={() => navigate('/activity')}>
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
