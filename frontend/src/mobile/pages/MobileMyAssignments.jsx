import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Calendar, ChevronUp, ChevronDown, ChevronRight,
  AlertCircle, Zap, Bot, RefreshCw, ClipboardList, Info, FileText, Activity
} from 'lucide-react';
import { getAuthHeaders } from '../../lib/authStore';
import { useCodebook } from '../../context/CodebookContext';
import { useTheme } from '../../context/ThemeContext';
import { extractCleanErrorCount } from '../../utils/maskingUtils';

const API_BASE = 'https://sguardai.khcho0421.workers.dev';

export default function MobileMyAssignments({ user, onAiClick }) {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const { allCodes } = useCodebook();
  const [myAssignments, setMyAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedAssignments, setExpandedAssignments] = useState(new Set());
  const [selectedIncidentIdFlow, setSelectedIncidentIdFlow] = useState(null);
  const pressTimerRef = useRef(null);
  const [activeFilter, setActiveFilter] = useState('ALL');

  const getKstDate = (daysAgo = 0) => {
    const d = new Date();
    const kstOffset = 9 * 60 * 60 * 1000;
    const kstDate = new Date(d.getTime() + kstOffset - (daysAgo * 24 * 60 * 60 * 1000));
    return kstDate.toISOString().split('T')[0];
  };

  const [assignmentDateRange, setAssignmentDateRange] = useState({
    from: getKstDate(7),
    to: getKstDate(0)
  });

  const formatYYMMDD = (dateStr) => {
    if (!dateStr) return '';
    let d = typeof dateStr === 'string' && !dateStr.includes('T') && !dateStr.includes('Z')
      ? new Date(dateStr.replace(' ', 'T'))
      : new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${yy}/${mm}/${dd} ${hh}:${mi}:${ss}`;
  };

  const getStatusName = (code) => {
    if (!code) return '미확인';
    const norm = String(code).toUpperCase().trim();
    const found = allCodes?.find(c => c.category === 'INCIDENT_STATUS' && (c.code.toUpperCase() === norm || c.name.toUpperCase() === norm));
    if (found) return found.name;
    if (norm === 'INC_001' || norm === 'OPEN' || norm === '미확인' || norm === '대기') return '미확인';
    if (norm === 'INC_002' || norm === 'PROGRESS' || norm === '분석중' || norm === '처리중' || norm === '진행중') return '분석중';
    if (norm === 'INC_003' || norm === 'CLOSED' || norm === '처리완료' || norm === '조치완료') return '처리완료';
    return code;
  };

  const fetchMyAssignments = async (isRefresh = false) => {
    if (!user?.employee_id) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/ai/incident/my-assignments?user_id=${user.employee_id}&from=${assignmentDateRange.from}&to=${assignmentDateRange.to}`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        const mapped = (data.assignments || []).map(inc => ({
          ...inc,
          inc_id: String(inc.inc_id)
        }));
        setMyAssignments(mapped);
      }
    } catch (err) {
      console.error("Failed to fetch assignments:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user) fetchMyAssignments();
  }, [user, assignmentDateRange]);

  const totalAssignedCount = myAssignments.length;

  return (
    <div className={`min-h-screen pb-24 font-['Pretendard'] transition-colors duration-200 ${isLight ? 'bg-[#f1f5f9] text-slate-800' : 'bg-[#0a0c12] text-slate-200'}`}>
      {/* 헤더 */}
      <div className={`sticky top-0 z-50 backdrop-blur-xl border-b px-5 py-4 flex items-center justify-between ${isLight ? 'bg-white/95 border-slate-200 shadow-sm' : 'bg-[#0a0c12]/95 border-white/5'}`}>
        <div className="flex items-center gap-2">
          <User className="w-5 h-5 text-blue-500" />
          <h2 className={`font-bold text-lg ${isLight ? 'text-slate-900' : 'text-white'}`}>나의 할당 및 처리 현황</h2>
        </div>
        <div className="flex items-center gap-2">
          {onAiClick && (
            <div 
              className={`p-2 rounded-xl transition-all cursor-pointer group flex items-center justify-center ${isLight ? 'hover:bg-slate-100' : 'hover:bg-white/5'}`}
              onClick={onAiClick}
              title="AI Assistant"
            >
              <Bot className="w-5 h-5 text-purple-500 group-hover:text-purple-600 transition-all drop-shadow-[0_0_6px_rgba(168,85,247,0.4)]" />
            </div>
          )}
          <div 
            className={`p-2 rounded-xl transition-all cursor-pointer group ${isLight ? 'hover:bg-slate-100' : 'hover:bg-white/5'} ${refreshing ? 'opacity-50' : ''}`}
            onClick={() => fetchMyAssignments(true)}
            title="데이터 새로고침"
          >
            <RefreshCw className={`w-5 h-5 ${isLight ? 'text-slate-500 group-hover:text-blue-600' : 'text-slate-400 group-hover:text-blue-400'} transition-all ${refreshing ? 'animate-spin text-blue-500' : ''}`} />
          </div>
        </div>
      </div>

      {/* 컨텐츠 */}
      <div className="px-4 py-2">
        {/* 기간 필터 */}
        <div className={`flex items-center justify-between p-3 rounded-2xl border mb-6 ${isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900/50 border-white/5'}`}>
          <div className="flex items-center gap-2">
            <Calendar className={`w-4 h-4 ${isLight ? 'text-slate-500' : 'text-slate-500'}`} />
            <span className={`text-xs font-medium ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>조회 기간</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={assignmentDateRange.from}
              onChange={(e) => setAssignmentDateRange(prev => ({ ...prev, from: e.target.value }))}
              className={`bg-transparent border rounded-lg px-2 py-1 text-xs outline-none ${isLight ? 'border-slate-300 text-slate-800' : 'border-white/10 text-slate-300'}`}
            />
            <span className={isLight ? 'text-slate-400' : 'text-slate-600'}>~</span>
            <input
              type="date"
              value={assignmentDateRange.to}
              onChange={(e) => setAssignmentDateRange(prev => ({ ...prev, to: e.target.value }))}
              className={`bg-transparent border rounded-lg px-2 py-1 text-xs outline-none ${isLight ? 'border-slate-300 text-slate-800' : 'border-white/10 text-slate-300'}`}
            />
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          {/* Total */}
          <div 
            onClick={() => setActiveFilter('ALL')}
            className={`p-3 rounded-2xl border relative overflow-hidden shadow-sm cursor-pointer transition-all ${
              isLight
                ? (activeFilter === 'ALL' ? 'bg-blue-50/80 border-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.2)]' : 'bg-white border-slate-200')
                : (activeFilter === 'ALL' ? 'bg-gradient-to-br from-[#1a1c24] to-[#11141d] border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'bg-gradient-to-br from-[#1a1c24] to-[#11141d] border-white/5')
            }`}
          >
            <p className={`text-[7px] mb-1 font-black uppercase tracking-widest truncate ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>Total</p>
            <div className="flex items-baseline gap-1 mb-1">
              <span className={`text-xl font-black font-mono tracking-tighter ${isLight ? 'text-slate-900' : 'text-white'}`}>{totalAssignedCount}</span>
            </div>
          </div>

          {/* Unconfirmed */}
          <div 
            onClick={() => setActiveFilter('NEW')}
            className={`p-3 rounded-2xl border relative overflow-hidden cursor-pointer transition-all ${
              isLight
                ? (activeFilter === 'NEW' ? 'bg-red-50/80 border-red-500 shadow-[0_0_12px_rgba(239,68,68,0.2)]' : 'bg-white border-slate-200')
                : (activeFilter === 'NEW' ? 'bg-gradient-to-br from-[#1a1c24] to-[#11141d] border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'bg-gradient-to-br from-[#1a1c24] to-[#11141d] border-white/5')
            }`}
          >
            <p className="text-[7px] text-red-500 font-black uppercase tracking-widest truncate">New</p>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-xl font-black text-red-500 font-mono tracking-tighter">{myAssignments.filter(a => ['미확인', '미처리', '대기', 'INC_001'].includes(a.status)).length}</span>
            </div>
          </div>

          {/* Processing */}
          <div 
            onClick={() => setActiveFilter('ACTIVE')}
            className={`p-3 rounded-2xl border relative overflow-hidden cursor-pointer transition-all ${
              isLight
                ? (activeFilter === 'ACTIVE' ? 'bg-orange-50/80 border-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.2)]' : 'bg-white border-slate-200')
                : (activeFilter === 'ACTIVE' ? 'bg-gradient-to-br from-[#1a1c24] to-[#11141d] border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.3)]' : 'bg-gradient-to-br from-[#1a1c24] to-[#11141d] border-white/5')
            }`}
          >
            <p className="text-[7px] text-orange-500 font-black uppercase tracking-widest truncate">Active</p>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-xl font-black text-orange-500 font-mono tracking-tighter">{myAssignments.filter(a => ['처리중', '진행중', 'IN_PROGRESS', 'INC_002'].includes(a.status)).length}</span>
            </div>
          </div>

          {/* Completed */}
          <div 
            onClick={() => setActiveFilter('DONE')}
            className={`p-3 rounded-2xl border relative overflow-hidden cursor-pointer transition-all ${
              isLight
                ? (activeFilter === 'DONE' ? 'bg-emerald-50/80 border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.2)]' : 'bg-white border-slate-200')
                : (activeFilter === 'DONE' ? 'bg-gradient-to-br from-[#1a1c24] to-[#11141d] border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-gradient-to-br from-[#1a1c24] to-[#11141d] border-white/5')
            }`}
          >
            <p className="text-[7px] text-emerald-500 mb-1 font-black uppercase tracking-widest truncate">Done</p>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-xl font-black text-emerald-500 font-mono tracking-tighter">{myAssignments.filter(a => ['처리완료', '종료', 'CLOSED', 'INC_003'].includes(a.status)).length}</span>
            </div>
          </div>
        </div>

        {/* Recent List Header */}
        <div className="flex justify-between items-center mb-4">
          <h3 className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
            {activeFilter === 'ALL' ? '전체' : activeFilter === 'NEW' ? '신규' : activeFilter === 'ACTIVE' ? '진행중' : '완료'} 할당 리스트 ({myAssignments.filter(item => {
              if (activeFilter === 'NEW') return ['미확인', '미처리', '대기', 'INC_001'].includes(item.status);
              if (activeFilter === 'ACTIVE') return ['처리중', '진행중', 'IN_PROGRESS', 'INC_002'].includes(item.status);
              if (activeFilter === 'DONE') return ['처리완료', '종료', 'CLOSED', 'INC_003'].includes(item.status);
              return true;
            }).length})
          </h3>
        </div>

        {/* List Items */}
        <div className="space-y-3">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
            </div>
          ) : myAssignments.filter(item => {
            if (activeFilter === 'NEW') return ['미확인', '미처리', '대기', 'INC_001'].includes(item.status);
            if (activeFilter === 'ACTIVE') return ['처리중', '진행중', 'IN_PROGRESS', 'INC_002'].includes(item.status);
            if (activeFilter === 'DONE') return ['처리완료', '종료', 'CLOSED', 'INC_003'].includes(item.status);
            return true;
          }).length > 0 ? (
            myAssignments.filter(item => {
              if (activeFilter === 'NEW') return ['미확인', '미처리', '대기', 'INC_001'].includes(item.status);
              if (activeFilter === 'ACTIVE') return ['처리중', '진행중', 'IN_PROGRESS', 'INC_002'].includes(item.status);
              if (activeFilter === 'DONE') return ['처리완료', '종료', 'CLOSED', 'INC_003'].includes(item.status);
              return true;
            }).map((item) => {
              const isItemSelected = String(selectedIncidentIdFlow) === String(item.inc_id);
              const isUnconfirmed = ['미확인', '미처리', '대기', 'INC_001'].includes(item.status);
              const isActive = ['처리중', '진행중', 'IN_PROGRESS', 'INC_002'].includes(item.status);

              return (
                <div
                  key={`assign-${item.id || item.inc_id}`}
                  className={`p-4 rounded-2xl border relative cursor-pointer transition-all ${
                    isLight
                      ? (isItemSelected
                          ? 'bg-blue-50/90 border-blue-400 shadow-md'
                          : isUnconfirmed ? 'bg-white border-red-200 shadow-sm'
                          : isActive ? 'bg-white border-orange-200 shadow-sm'
                          : 'bg-white border-slate-200 shadow-sm')
                      : (isItemSelected
                          ? 'bg-blue-500/10 border-blue-500/50 shadow-[0_0_16px_rgba(59,130,246,0.2)]'
                          : isUnconfirmed ? 'bg-red-500/5 border-red-500/10'
                          : isActive ? 'bg-orange-500/5 border-orange-500/10'
                          : 'bg-emerald-500/5 border-emerald-500/10')
                  }`}
                  onClick={() => setSelectedIncidentIdFlow(item.inc_id)}
                >
                  {/* 상단: 아이콘 + 제목 */}
                  <div className="flex items-start gap-2 mb-2">
                    <div className={`${
                      isUnconfirmed ? (isLight ? 'bg-red-100 text-red-600' : 'bg-red-500/10') :
                      isActive ? (isLight ? 'bg-orange-100 text-orange-600' : 'bg-orange-500/10') :
                      (isLight ? 'bg-emerald-100 text-emerald-600' : 'bg-emerald-500/10')
                    } p-1.5 rounded-full shrink-0 mt-0.5`}>
                      <AlertCircle className={`w-4 h-4 ${
                        isUnconfirmed ? (isLight ? 'text-red-600' : 'text-red-500') :
                        isActive ? (isLight ? 'text-orange-600' : 'text-orange-500') :
                        (isLight ? 'text-emerald-600' : 'text-emerald-500')
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4
                        className={`text-sm font-bold leading-snug select-none transition-all duration-300 ${
                          isItemSelected
                            ? (isLight ? 'text-blue-700' : 'text-blue-300')
                            : (isLight ? 'text-slate-900' : 'text-white')
                        } ${expandedAssignments.has(item.inc_id) ? 'break-words' : 'line-clamp-2'}`}
                        onTouchStart={() => { pressTimerRef.current = setTimeout(() => { setExpandedAssignments(prev => { const next = new Set(prev); if (next.has(item.inc_id)) next.delete(item.inc_id); else next.add(item.inc_id); return next; }); }, 600); }}
                        onTouchEnd={() => clearTimeout(pressTimerRef.current)}
                      >
                        {item.message || '장애 발생'}
                      </h4>
                      {!expandedAssignments.has(item.inc_id) && (
                        <span className={`text-[9px] mt-0.5 block ${isLight ? 'text-slate-400' : 'text-slate-600'}`}>꾹 누르면 전체 보기</span>
                      )}
                    </div>
                  </div>

                  {/* 뱃지 영역 */}
                  <div className="flex flex-wrap items-center gap-1.5 mb-3">
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${isLight ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-blue-500/20 text-blue-400 border-blue-500/30'}`}>SMS</span>
                    
                    {Number(item.received_count || 1) >= 2 && (
                      <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded border ${isLight ? 'bg-indigo-50 border-indigo-200' : 'bg-gradient-to-r from-blue-600/20 to-indigo-500/20 border-blue-500/30'}`}>
                        <span className={`text-[9px] font-black font-mono ${isLight ? 'text-indigo-600' : 'text-blue-400'}`}>{extractCleanErrorCount(item)}</span>
                        <span className={`text-[7px] font-bold uppercase ${isLight ? 'text-indigo-400' : 'text-blue-500/60'}`}>Event</span>
                      </div>
                    )}
                    
                    {Number(item.keyword_detected || 0) > 0 && (
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full border flex items-center gap-1 ${isLight ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-yellow-400/20 text-yellow-400 border-yellow-400/30'}`}>
                        <Zap className="w-2 h-2" />감지 ({item.keyword_detected})
                      </span>
                    )}
                    
                    {Number(item.is_analyzed) >= 1 && (
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${isLight ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-blue-500/20 text-blue-400 border-blue-500/30'}`}>ANL_COMPLETE</span>
                    )}
                    
                    {(item.similarity_score !== undefined && item.similarity_score !== null) ? (
                      <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-[8px] font-black uppercase w-fit ${
                        item.similarity_score >= 0.8
                          ? (isLight ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20')
                          : (isLight ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-blue-500/10 text-blue-400 border-blue-500/20')
                      }`}>
                        <Zap className="w-2 h-2" />
                        Match {(item.similarity_score * 100).toFixed(1)}%
                      </div>
                    ) : Number(item.is_analyzed) >= 1 ? (
                      <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-[8px] font-black uppercase w-fit ${isLight ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-slate-500/10 text-slate-500 border-white/10'}`}>
                        <Zap className="w-2 h-2" />
                        No Match
                      </div>
                    ) : null}
                    
                    {isActive && Number(item.is_analyzed) < 1 && (
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border animate-pulse ${isLight ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'}`}>분석 중</span>
                    )}
                  </div>

                  {/* 하단: 상태 + 날짜 */}
                  <div className="flex items-center justify-between mt-1 mb-3">
                    <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1.5 ${
                      isUnconfirmed
                        ? (isLight ? 'bg-red-50 text-red-600 border-red-200' : 'bg-red-500/20 text-red-400 border-red-500/30')
                        : isActive
                        ? (isLight ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-orange-500/20 text-orange-400 border-orange-500/30')
                        : (isLight ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30')
                    }`}>
                      <div className={`w-1 h-1 rounded-full ${
                        isUnconfirmed ? 'bg-red-500' :
                        isActive ? 'bg-orange-500' : 'bg-emerald-500'
                      }`} />
                      {getStatusName(item.status)}
                    </div>
                    <span className={`text-[10px] font-mono ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>{formatYYMMDD(item.assigned_at)}</span>
                  </div>

                  {/* WAR-ROOM / REPORT 버튼 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isUnconfirmed) { alert("해당 워룸이 존재하지 않습니다."); return; }
                      const cleanId = String(item.inc_id);
                      if (['처리완료', '조치완료', 'INC_003'].includes(item.status)) {
                        navigate(`/report/${cleanId}`);
                      } else {
                        navigate(`/chat/${cleanId}`);
                      }
                    }}
                    className={`w-full p-3 rounded-xl border transition-all flex items-center justify-center gap-2 ${
                      isLight
                        ? (isItemSelected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                            : 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100')
                        : (isItemSelected
                            ? 'bg-blue-600/20 border-blue-500/40 text-blue-300'
                            : 'bg-blue-600/10 border-blue-500/20 text-blue-400')
                    }`}
                  >
                    { (['처리완료', '조치완료', 'INC_003'].includes(item.status)) ? (
                      <>
                        <FileText className={`w-4 h-4 ${isLight && isItemSelected ? 'text-white' : isLight ? 'text-emerald-600' : 'text-emerald-400'}`} />
                        <span className={`text-xs font-bold font-mono tracking-tight ${isLight && isItemSelected ? 'text-white' : isLight ? 'text-emerald-600' : 'text-emerald-400'}`}>VIEW REPORT</span>
                      </>
                    ) : (
                      <>
                        <Activity className="w-4 h-4" />
                        <span className="text-xs font-bold font-mono tracking-tight">GO TO WAR-ROOM</span>
                      </>
                    )}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              );
            })
          ) : (
            <div className={`p-8 rounded-2xl border text-center ${isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#11141d] border-white/5'}`}>
              <Info className={`w-12 h-12 mx-auto mb-3 ${isLight ? 'text-slate-400' : 'text-slate-600'}`} />
              <p className={`text-sm ${isLight ? 'text-slate-700 font-bold' : 'text-slate-400'}`}>최근 할당 내역이 없습니다</p>
              <p className={`text-xs mt-1 ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>SMS 메시지를 분석하면 자동으로 할당됩니다</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
