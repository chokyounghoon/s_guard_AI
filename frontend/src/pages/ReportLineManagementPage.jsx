import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Search, Save, Shield, Star, 
  Users, Trash2, TrendingDown, User, Zap, ChevronDown,
  Plus, Settings, AlertCircle, RefreshCw
} from 'lucide-react';
import { SMS_WORKER_URL } from '../config/api';

const getApiUrl = (endpoint) => `${SMS_WORKER_URL}${endpoint}`;

export default function ReportLineManagementPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [availableMembers, setAvailableMembers] = useState([]);
  const [reportLines, setReportLines] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // Default icons/colors mapping by role keyword matching
  const roleStyles = {
    '대표': { icon: Shield, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
    '본부': { icon: Star, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
    '상무': { icon: Star, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
    '전무': { icon: Star, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
    '팀장': { icon: Users, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    '파트장': { icon: Zap, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
    'default': { icon: User, color: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/20' }
  };

  const getStyleForRole = (role) => {
    if (!role) return roleStyles.default;
    for (const [key, style] of Object.entries(roleStyles)) {
      if (role.includes(key)) return style;
    }
    return roleStyles.default;
  };

  useEffect(() => {
    const savedUser = localStorage.getItem('sguard_user');
    if (savedUser) {
      try { setCurrentUser(JSON.parse(savedUser)); } catch (e) {}
    }
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    let userId = currentUser?.employee_id || '';
    if (!userId) {
      const savedUser = localStorage.getItem('sguard_user');
      if (savedUser) {
        try { userId = JSON.parse(savedUser).employee_id; } catch (e) {}
      }
    }
    
    try {
      const [usersRes, linesRes] = await Promise.all([
        fetch(getApiUrl('/api/v1/users/organization')),
        fetch(getApiUrl(`/api/v1/report-lines?user_id=${userId}`))
      ]);
      
      if (usersRes.ok && linesRes.ok) {
        const usersData = await usersRes.json();
        const linesData = await linesRes.json();
        
        setAvailableMembers(usersData.users || []);
        
        // Map saved lines back to user objects for full rendering
        const hydratedLines = (linesData.report_lines || []).map(line => {
          const matchedUser = (usersData.users || []).find(u => u.id === line.user_id) || {};
          return {
            ...line,
            name: matchedUser.name || line.user_name,
            role: matchedUser.role || line.role_name || '결재자',
            honbu: matchedUser.honbu || '',
            team: matchedUser.team || '',
            id: line.user_id // using user_id as unique key for tree
          };
        });
        
        setReportLines(hydratedLines);
      }
    } catch (e) {
      console.error("Failed to load organization data:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const saveReportLines = async () => {
    setIsSaving(true);
    try {
      const payload = reportLines.map((line, index) => ({
        hierarchy_level: index + 1,
        role_name: line.role || '결재자',
        user_id: line.id,
        user_name: line.name
      }));

      const res = await fetch(getApiUrl('/api/v1/report-lines'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          owner_id: currentUser?.employee_id,
          report_lines: payload 
        })
      });

      if (res.ok) {
        alert('보고 라인이 성공적으로 저장되었습니다.');
      } else {
        alert('저장에 실패했습니다.');
      }
    } catch (e) {
      console.error('Save error:', e);
      alert('서버 오류로 인해 저장하지 못했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const addToReportLine = (member) => {
    if (reportLines.some(line => line.id === member.id)) {
      alert('이미 보고 라인에 추가된 대상입니다.');
      return;
    }
    setReportLines(prev => [...prev, member]);
  };

  const removeFromReportLine = (userId) => {
    setReportLines(prev => prev.filter(line => line.id !== userId));
  };
  
  // Custom Reordering via arrows
  const moveUp = (index) => {
    if (index === 0) return;
    setReportLines(prev => {
      const arr = [...prev];
      const temp = arr[index - 1];
      arr[index - 1] = arr[index];
      arr[index] = temp;
      return arr;
    });
  };

  const moveDown = (index) => {
    if (index === reportLines.length - 1) return;
    setReportLines(prev => {
      const arr = [...prev];
      const temp = arr[index + 1];
      arr[index + 1] = arr[index];
      arr[index] = temp;
      return arr;
    });
  };

  const filteredMembers = availableMembers.filter(m => 
    m.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    m.honbu?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.team?.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => {
    if (!searchTerm && currentUser) {
      const aIsMyTeam = a.team === currentUser.team;
      const bIsMyTeam = b.team === currentUser.team;
      if (aIsMyTeam && !bIsMyTeam) return -1;
      if (!aIsMyTeam && bIsMyTeam) return 1;

      const aIsMyHonbu = a.honbu === currentUser.honbu;
      const bIsMyHonbu = b.honbu === currentUser.honbu;
      if (aIsMyHonbu && !bIsMyHonbu) return -1;
      if (!aIsMyHonbu && bIsMyHonbu) return 1;
    }
    return 0;
  });

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
            <h1 className="text-lg font-bold">보고/결재 라인 관리</h1>
            <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">Approval Hierarchy Database</p>
          </div>
        </div>
        <div className="flex space-x-2">
          <button onClick={fetchData} disabled={isLoading} className="p-2 rounded-xl border border-white/10 text-slate-400 hover:text-white transition-colors">
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={saveReportLines} disabled={isSaving} className="bg-purple-600/20 text-purple-400 px-4 rounded-xl hover:bg-purple-600/30 transition-colors border border-purple-500/20 flex items-center space-x-2 font-bold text-sm">
            <Save className="w-4 h-4" />
            <span>{isSaving ? '저장 중...' : '저장하기'}</span>
          </button>
        </div>
      </header>

      <main className="p-5 space-y-8 max-w-2xl mx-auto">
        {/* Organizational Chart Section */}
        <section className="space-y-6">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold text-slate-300 flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-purple-400" />
              장애 알림 결재/통보 라인
            </h2>
            <div className="bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20">
              <span className="text-[9px] font-bold text-purple-400 uppercase tracking-tighter">Dynamic Hierarchy</span>
            </div>
          </div>

          <div className="relative pl-6 sm:pl-8 space-y-4">
            {/* Connection Line */}
            {reportLines.length > 1 && (
              <div className="absolute left-[43px] sm:left-[51px] top-8 bottom-8 w-1 bg-gradient-to-b from-purple-500/70 via-blue-500/50 to-emerald-500/30 rounded-full" />
            )}

            {reportLines.length === 0 && !isLoading && (
              <div className="bg-[#1a1f2e] border border-dashed border-white/20 rounded-3xl p-10 flex flex-col items-center justify-center text-center">
                <AlertCircle className="w-10 h-10 text-slate-500 mb-3" />
                <h3 className="text-sm font-bold text-slate-300">지정된 보고 라인이 없습니다</h3>
                <p className="text-xs text-slate-500 mt-1">아래 조직도 검색에서 인원을 선택하여 추가해주세요.</p>
              </div>
            )}

            {reportLines.map((member, index) => {
              const styles = getStyleForRole(member.role);
              const isFirst = index === 0;
              const isLast = index === reportLines.length - 1;
              const nodeBg = isFirst ? 'bg-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.6)]' : isLast ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'bg-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.5)]';

              return (
                <div key={member.id} className="relative group animate-in slide-in-from-left-4 duration-300">
                  {/* Node Point */}
                  <div className={`absolute left-[-23px] sm:left-[-35px] top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-[3px] border-[#0a0e17] z-10 transition-transform group-hover:scale-125 ${nodeBg}`} />

                  <div className="bg-[#11141d] rounded-3xl border border-white/5 shadow-xl group-hover:border-purple-500/20 transition-all flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 sm:p-5">
                    
                    <div className="flex items-center space-x-4 mb-3 sm:mb-0">
                      <div className="text-center w-6 opacity-30 font-black text-xl italic">{index+1}차</div>
                      <div className={`${styles.bg} ${styles.border} p-3 rounded-2xl border flex items-center justify-center shadow-inner`}>
                        <styles.icon className={`w-5 h-5 ${styles.color}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-white tracking-tight">{member.name}</h3>
                          <span className={`text-[10px] font-black tracking-widest ${styles.color}`}>{member.role}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-slate-400">{member.honbu} {member.team !== member.honbu && member.team}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 self-end sm:self-auto border-t sm:border-none border-white/5 pt-3 sm:pt-0 w-full sm:w-auto justify-end">
                      <button onClick={() => moveUp(index)} disabled={isFirst} className="p-2 rounded-xl bg-white/5 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                        <ChevronDown className="w-4 h-4 rotate-180" />
                      </button>
                      <button onClick={() => moveDown(index)} disabled={isLast} className="p-2 rounded-xl bg-white/5 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <button onClick={() => removeFromReportLine(member.id)} className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors ml-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Member Search Section (Compact) */}
        <section className="bg-[#11141d] rounded-3xl p-6 border border-white/5 relative overflow-hidden mt-8">
          <div className="absolute top-0 right-0 w-40 h-40 bg-purple-500/10 blur-3xl rounded-full" />
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 relative z-10 gap-4">
            <div>
               <h2 className="text-sm font-bold text-slate-300">조직 구성원 추가</h2>
               <p className="text-[10px] text-slate-500 mt-0.5">상단 보고라인 트리에 추가할 인원을 클릭하세요.</p>
            </div>
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                type="text"
                placeholder="이름, 부서 등 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#0a0e17] border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-xs font-semibold focus:outline-none focus:border-purple-500/50 transition-colors"
               />
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-10"><RefreshCw className="w-6 h-6 animate-spin text-slate-500" /></div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 relative z-10 max-h-96 overflow-y-auto pr-1 custom-scrollbar">
              {filteredMembers.map(member => (
                <div 
                  key={member.id} 
                  onClick={() => addToReportLine(member)}
                  className="flex items-center justify-between p-3 bg-[#0a0e17] hover:bg-purple-900/20 rounded-2xl transition-all cursor-pointer group border border-white/5 hover:border-purple-500/30"
                >
                  <div className="flex items-center space-x-3 truncate">
                    <div className="w-10 h-10 rounded-xl bg-slate-800 flex flex-shrink-0 items-center justify-center border border-white/10 group-hover:border-purple-500/30 transition-colors">
                      <div className="text-xs font-bold text-slate-400 group-hover:text-purple-300">{member.name[0]}</div>
                    </div>
                    <div className="truncate">
                      <h4 className="text-xs font-bold text-slate-200 truncate flex items-center gap-1.5">
                        {member.name}
                        {currentUser && member.team === currentUser.team && !searchTerm && (
                           <span className="text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/30">내 소속 부서</span>
                        )}
                        {currentUser && member.honbu === currentUser.honbu && member.team !== currentUser.team && !searchTerm && (
                           <span className="text-[9px] bg-blue-500/10 text-blue-300 px-1.5 py-0.5 rounded border border-blue-500/20">같은 본부</span>
                        )}
                      </h4>
                      <span className="text-[10px] text-slate-500 truncate block">{member.team || member.honbu} {member.role !== 'user' && `| ${member.role}`}</span>
                    </div>
                  </div>
                  <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors flex-shrink-0">
                    <Plus className="w-3.5 h-3.5 text-slate-500 group-hover:text-purple-400" />
                  </div>
                </div>
              ))}
              
              {filteredMembers.length === 0 && (
                <div className="col-span-full py-8 text-center text-slate-500 text-xs">
                  검색 결과가 없습니다.
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

