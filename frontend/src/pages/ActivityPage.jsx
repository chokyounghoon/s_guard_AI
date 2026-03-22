import React, { useState, useEffect } from 'react';

import { useNavigate } from 'react-router-dom';
import { Search, Calendar, SlidersHorizontal, CheckCircle2, ChevronRight, User, ArrowLeft } from 'lucide-react';
import BottomMenu from '../components/BottomMenu';

export default function ActivityPage() {
  const navigate = useNavigate();

  const [activities, setActivities] = useState([]);
  const API_BASE = 'http://localhost:8000';

  useEffect(() => {
    fetch(`${API_BASE}/activity-logs?limit=50`)
      .then(r => r.json())
      .then(data => {
        // Group logs by date
        const grouped = {};
        (data.logs || []).forEach(log => {
          const dateObj = log.created_at ? new Date(log.created_at) : new Date();
          const today = new Date();
          const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
          let dateLabel = dateObj.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
          if (dateObj.toDateString() === today.toDateString()) dateLabel = '오늘 - ' + dateLabel;
          else if (dateObj.toDateString() === yesterday.toDateString()) dateLabel = '어제 - ' + dateLabel;
          if (!grouped[dateLabel]) grouped[dateLabel] = [];
          grouped[dateLabel].push({
            id: log.inc_id,
            time: dateObj.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) + ' 완료',
            title: log.incident_title || log.action,
            status: log.action,
            team: log.team || '시스템',
            type: log.report_type || 'AI 리포트',
          });
        });
        setActivities(Object.entries(grouped).map(([date, items]) => ({ date, items })));
      })
      .catch(console.error);
  }, []);

  return (
    <div className="min-h-screen bg-[#0f1421] text-white font-sans flex flex-col pb-24">
      {/* Header */}
      <header className="flex items-center justify-between p-5 sticky top-0 bg-[#0f1421]/90 backdrop-blur-md z-40">
        <div className="flex items-center space-x-4">
          <button onClick={() => navigate(-1)} className="p-1 rounded-full hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <h1 className="text-2xl font-bold tracking-tight">활동 내역</h1>
        </div>
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

      {/* Floating Back Button */}
      <div className="fixed bottom-24 left-0 w-full px-5 z-40 pointer-events-none">
        <button
          onClick={() => navigate(-1)}
          className="w-full bg-slate-800/80 backdrop-blur-md border border-white/10 h-14 rounded-2xl flex items-center justify-center space-x-2 transition-all active:scale-[0.98] shadow-2xl pointer-events-auto"
        >
          <ArrowLeft className="w-5 h-5 text-slate-300" />
          <span className="font-bold text-slate-300">이전으로 돌아가기</span>
        </button>
      </div>

      {/* Navigation */}
      <BottomMenu currentPath="/activity" />
    </div>
  );
}
