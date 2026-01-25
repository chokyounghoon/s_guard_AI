import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Calendar, SlidersHorizontal, CheckCircle2, ChevronRight, User, Home, MessageSquare, Activity, MoreHorizontal } from 'lucide-react';

export default function ActivityPage() {
  const navigate = useNavigate();

  const activities = [
    {
      date: '오늘 - 2024년 5월 22일',
      items: [
        {
          id: 1,
          time: '14:30 완료',
          title: '[신한카드] SHB02681 은행고객종합정보 시스템 보안탐지 분석 보고',
          status: '대표이사 보고 완료',
          team: '보안 관제 B팀',
          type: 'AI 리포트'
        },
        {
          id: 2,
          time: '11:15 완료',
          title: '[금융] KRX-092 외부 IP 대량 접속 시도 대응 리포트',
          status: 'CISO 보고 완료',
          team: 'SOC 팀',
          type: 'AI 리포트'
        }
      ]
    },
    {
      date: '어제 - 2024년 5월 21일',
      items: [
        {
          id: 3,
          time: '17:40 완료',
          title: '[내부] ADMIN 계정 비정상 로그인 탐지 및 계정 잠금 처리',
          status: '부서장 보고 완료',
          team: '인프라 보안',
          type: 'AI 리포트'
        },
        {
          id: 4,
          time: '14:02 완료',
          title: '[카드] 가맹점 결제 데이터 이상 트래픽 정밀 분석 결과',
          status: '대표이사 보고 완료',
          team: '데이터 보안팀',
          type: 'AI 리포트'
        }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-[#0f1421] text-white font-sans flex flex-col pb-24">
      {/* Header */}
      <header className="flex items-center justify-between p-5 sticky top-0 bg-[#0f1421]/90 backdrop-blur-md z-40">
        <h1 className="text-2xl font-bold tracking-tight">활동 내역</h1>
        <div className="w-9 h-9 bg-slate-800 rounded-full flex items-center justify-center border border-white/5">
          <User className="w-5 h-5 text-slate-400" />
        </div>
      </header>

      <main className="flex-1 space-y-2">
        {/* Search & Filters */}
        <div className="px-5 pb-4 flex items-center space-x-3">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              type="text" 
              placeholder="활동 내역 검색" 
              className="w-full bg-slate-800/40 border border-white/5 rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-slate-500"
            />
          </div>
          <button className="p-3 bg-slate-800/40 rounded-xl border border-white/5">
            <Calendar className="w-5 h-5 text-slate-400" />
          </button>
          <button className="p-3 bg-slate-800/40 rounded-xl border border-white/5">
            <SlidersHorizontal className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {activities.map((section, idx) => (
          <div key={idx}>
            {/* Date Divider */}
            <div className="bg-slate-900/50 px-5 py-2 border-y border-white/5">
                <span className="text-xs font-semibold text-slate-400">{section.date}</span>
            </div>

            {/* List Items */}
            <div className="divide-y divide-white/5">
              {section.items.map((item) => (
                <div 
                  key={item.id} 
                  onClick={() => navigate('/activity-detail')}
                  className="p-5 flex items-start space-x-4 hover:bg-white/5 transition-colors cursor-pointer group"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-600/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-6 h-6 text-blue-500" />
                  </div>
                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="bg-blue-600/20 text-blue-400 text-[10px] font-bold px-1.5 py-0.5 rounded border border-blue-500/20 uppercase tracking-tighter">
                        {item.type}
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium">{item.time}</span>
                    </div>
                    <h4 className="text-[15px] font-bold text-slate-100 leading-snug break-all line-clamp-2">
                       {item.title}
                    </h4>
                    <p className="text-xs text-slate-500">
                      <span className="text-blue-500 font-medium">{item.status}</span>
                      <span className="mx-2 text-slate-700">|</span>
                      <span>{item.team}</span>
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-slate-400 mt-5 transition-colors" />
                </div>
              ))}
            </div>
          </div>
        ))}
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
