import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, UserPlus, X, Search, Users, 
  ChevronRight, Save, Shield, Star, 
  MoreHorizontal, GripVertical, Trash2,
  TrendingDown, User, Zap, ChevronDown,
  Plus, Settings
} from 'lucide-react';

export default function ReportLineManagementPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  
  const orgChart = [
    { id: 1, role: '대표이사', name: '김성규', level: 'CEO', desc: '최종 승인권자', icon: Shield, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
    { id: 2, role: '부사장', name: '박민우', level: 'VP', desc: '운영 총괄', icon: Star, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
    { id: 3, role: '상무', name: '정우성', level: 'Executive', desc: '전략 기획', icon: Users, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    { id: 4, role: '본부장', name: '최동준', level: 'Division Head', desc: '기술 본부', icon: Zap, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
    { id: 5, role: '팀장', name: '이강인', level: 'Team Leader', desc: '보안 대응팀', icon: User, color: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/20' },
  ];

  const [availableMembers] = useState([
    { id: 101, name: 'Cho Kyounghoon', role: 'Architect', dept: 'System' },
    { id: 102, name: 'Lee Sangmin', role: 'DevOps', dept: 'Infra' },
    { id: 103, name: 'Park Junho', role: 'Engineer', dept: 'System' },
    { id: 104, name: 'Kim Minsoo', role: 'Security Analyst', dept: 'Security' },
    { id: 105, name: 'Kang Daeseong', role: 'Manager', dept: 'Security' },
  ]);

  return (
    <div className="min-h-screen bg-[#0a0e17] text-white font-sans pb-24 relative overflow-x-hidden">
      <div className="fixed top-0 left-0 w-full h-96 bg-purple-900/5 blur-[100px] -z-10 pointer-events-none" />

      {/* Header */}
      <header className="flex justify-between items-center p-5 sticky top-0 bg-[#0f111a]/90 backdrop-blur-md z-50 border-b border-white/5">
        <div className="flex items-center space-x-4">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-lg font-bold">보고 라인 관리</h1>
            <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">Report Approval Hierarchy</p>
          </div>
        </div>
        <button className="bg-purple-600/20 text-purple-400 p-2 rounded-xl hover:bg-purple-600/30 transition-colors border border-purple-500/20">
          <Save className="w-5 h-5" />
        </button>
      </header>

      <main className="p-5 space-y-8">
        {/* Organizational Chart Section */}
        <section className="space-y-6">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold text-slate-300 flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-purple-400" />
              글로벌 보고 조직도
            </h2>
            <div className="bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20">
              <span className="text-[9px] font-bold text-purple-400 uppercase tracking-tighter">Standard hierarchy</span>
            </div>
          </div>

          <div className="relative pl-8 space-y-4">
            {/* Connection Line */}
            <div className="absolute left-[51px] top-6 bottom-6 w-0.5 bg-gradient-to-b from-purple-500/50 via-blue-500/30 to-slate-800 rounded-full" />

            {orgChart.map((member, index) => (
              <div key={member.id} className="relative group">
                {/* Node Point */}
                <div className={`absolute left-[-35px] top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-[#0a0e17] z-10 transition-transform group-hover:scale-125 ${
                   index === 0 ? 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]' :
                   index === orgChart.length - 1 ? 'bg-pink-500' : 'bg-slate-700'
                }`} />

                <div className="bg-[#1a1f2e] rounded-3xl p-5 border border-white/5 shadow-xl flex items-center justify-between group-hover:border-purple-500/20 transition-all active:scale-[0.99] cursor-pointer">
                  <div className="flex items-center space-x-5">
                    <div className={`${member.bg} ${member.border} p-3.5 rounded-2xl border flex items-center justify-center shadow-inner`}>
                      <member.icon className={`w-6 h-6 ${member.color}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-black uppercase tracking-widest ${member.color}`}>{member.level}</span>
                        <h3 className="text-base font-bold text-white tracking-tight">{member.name}</h3>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-bold text-slate-300">{member.role}</span>
                        <span className="text-[10px] text-slate-500 bg-white/5 px-2 py-0.5 rounded-md">{member.desc}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <button className="p-2 rounded-xl bg-white/5 text-slate-500 hover:text-white transition-colors">
                      <Settings className="w-4 h-4" />
                    </button>
                    <ChevronDown className="w-5 h-5 text-slate-700 group-hover:text-slate-400 transition-colors" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Member Search Section (Compact) */}
        <section className="bg-[#11141d] rounded-3xl p-6 border border-white/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 blur-3xl rounded-full" />
          
          <div className="flex items-center justify-between mb-6 relative z-10">
            <div>
               <h2 className="text-sm font-bold text-slate-300">구성원 및 권한 검색</h2>
               <p className="text-[10px] text-slate-500 mt-0.5">조직도에 추가할 내부 구성원을 검색합니다.</p>
            </div>
            <div className="relative w-40">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input 
                type="text"
                placeholder="이름 검색..."
                className="w-full bg-[#0a0e17] border border-white/5 rounded-full py-1.5 pl-9 pr-4 text-[10px] focus:outline-none focus:border-purple-500/30"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 relative z-10">
            {availableMembers.map(member => (
              <div key={member.id} className="flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all cursor-pointer group border border-transparent hover:border-white/10">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center border border-white/5 group-hover:border-purple-500/20">
                    <div className="text-[10px] font-bold text-slate-500 group-hover:text-purple-400">{member.name[0]}</div>
                  </div>
                  <div>
                    <h4 className="text-[11px] font-bold text-slate-200">{member.name}</h4>
                    <span className="text-[9px] text-slate-500">{member.role} | {member.dept}</span>
                  </div>
                </div>
                <Plus className="w-4 h-4 text-slate-700 group-hover:text-purple-400 mr-2" />
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
