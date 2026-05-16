import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Calendar, ChevronUp, ChevronDown, ChevronRight,
  AlertCircle, Zap, Bot, RefreshCw, ClipboardList, Info, FileText, Activity
} from 'lucide-react';
import { getAuthHeaders } from '../../lib/authStore';

const API_BASE = 'https://sguardai.khcho0421.workers.dev';

export default function MobileMyAssignments({ user, onAiClick }) {
  const navigate = useNavigate();
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

  const getStatusName = (status) => {
    if (!status) return '미확인';
    const s = String(status).toUpperCase();
    if (s === 'INC_001') return '미확인';
    if (s === 'INC_002') return '분석중';
    if (s === 'INC_003') return '처리완료';
    return status;
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
    <div className="min-h-screen bg-[#0a0c12] text-slate-200 pb-24 font-['Pretendard']">
      {/* 헤더 */}
      <div className="sticky top-0 z-50 bg-[#0a0c12]/95 backdrop-blur-xl border-bottom border-white/5 px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <User className="w-5 h-5 text-blue-500" />
          <h2 className="font-bold text-lg text-white">나의 할당 및 처리 현황</h2>
        </div>
        <div className="flex items-center gap-2">
          {onAiClick && (
            <div 
              className="p-2 rounded-xl hover:bg-white/5 transition-all cursor-pointer group flex items-center justify-center"
              onClick={onAiClick}
              title="AI Assistant"
            >
              <Bot className="w-5 h-5 text-purple-400 group-hover:text-purple-300 transition-all drop-shadow-[0_0_6px_rgba(168,85,247,0.4)]" />
            </div>
          )}
          <div 
            className={`p-2 rounded-xl hover:bg-white/5 transition-all cursor-pointer group ${refreshing ? 'opacity-50' : ''}`}
            onClick={() => fetchMyAssignments(true)}
            title="데이터 새로고침"
          >
            <RefreshCw className={`w-5 h-5 text-slate-400 group-hover:text-blue-400 transition-all ${refreshing ? 'animate-spin text-blue-500' : ''}`} />
          </div>
        </div>
      </div>

      {/* 컨텐츠 */}
      <div className="px-4 py-2">
        {/* 기간 필터 */}
        <div className="flex items-center justify-between bg-slate-900/50 p-3 rounded-2xl border border-white/5 mb-6">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span className="text-xs text-slate-400 font-medium">조회 기간</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={assignmentDateRange.from}
              onChange={(e) => setAssignmentDateRange(prev => ({ ...prev, from: e.target.value }))}
              className="bg-transparent border border-white/10 rounded-lg px-2 py-1 text-xs text-slate-300 outline-none"
            />
            <span className="text-slate-600">~</span>
            <input
              type="date"
              value={assignmentDateRange.to}
              onChange={(e) => setAssignmentDateRange(prev => ({ ...prev, to: e.target.value }))}
              className="bg-transparent border border-white/10 rounded-lg px-2 py-1 text-xs text-slate-300 outline-none"
            />
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          {/* Total */}
          <div 
            onClick={() => setActiveFilter('ALL')}
            className={`bg-gradient-to-br from-[#1a1c24] to-[#11141d] p-3 rounded-2xl border relative overflow-hidden shadow-lg cursor-pointer transition-all ${activeFilter === 'ALL' ? 'border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'border-white/5'}`}
          >
            <p className="text-[7px] text-slate-500 mb-1 font-black uppercase tracking-widest truncate">Total</p>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-xl font-black text-white font-mono tracking-tighter">{totalAssignedCount}</span>
            </div>
          </div>

          {/* Unconfirmed */}
          <div 
            onClick={() => setActiveFilter('NEW')}
            className={`bg-gradient-to-br from-[#1a1c24] to-[#11141d] p-3 rounded-2xl border relative overflow-hidden cursor-pointer transition-all ${activeFilter === 'NEW' ? 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : myAssignments.filter(a => ['미확인', '미처리', '대기', 'INC_001'].includes(a.status)).length > 0 ? 'border-red-500/20 shadow-[0_0_30px_rgba(239,68,68,0.1)]' : 'border-white/5'}`}
          >
            <p className="text-[7px] text-red-500/60 font-black uppercase tracking-widest truncate">New</p>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-xl font-black text-red-500 font-mono tracking-tighter">{myAssignments.filter(a => ['미확인', '미처리', '대기', 'INC_001'].includes(a.status)).length}</span>
            </div>
          </div>

          {/* Processing */}
          <div 
            onClick={() => setActiveFilter('ACTIVE')}
            className={`bg-gradient-to-br from-[#1a1c24] to-[#11141d] p-3 rounded-2xl border relative overflow-hidden cursor-pointer transition-all ${activeFilter === 'ACTIVE' ? 'border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.3)]' : myAssignments.filter(a => ['처리중', '진행중', 'IN_PROGRESS', 'INC_002'].includes(a.status)).length > 0 ? 'border-orange-500/20 shadow-[0_0_30px_rgba(249,115,22,0.1)]' : 'border-white/5'}`}
          >
            <p className="text-[7px] text-orange-500/60 font-black uppercase tracking-widest truncate">Active</p>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-xl font-black text-orange-500 font-mono tracking-tighter">{myAssignments.filter(a => ['처리중', '진행중', 'IN_PROGRESS', 'INC_002'].includes(a.status)).length}</span>
            </div>
          </div>

          {/* Completed */}
          <div 
            onClick={() => setActiveFilter('DONE')}
            className={`bg-gradient-to-br from-[#1a1c24] to-[#11141d] p-3 rounded-2xl border relative overflow-hidden shadow-lg cursor-pointer transition-all ${activeFilter === 'DONE' ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'border-white/5'}`}
          >
            <p className="text-[7px] text-emerald-500/60 mb-1 font-black uppercase tracking-widest truncate">Done</p>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-xl font-black text-emerald-500 font-mono tracking-tighter">{myAssignments.filter(a => ['처리완료', '종료', 'CLOSED', 'INC_003'].includes(a.status)).length}</span>
            </div>
          </div>
        </div>

        {/* Recent List Header */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-bold text-white">
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
                  className={`p-4 rounded-2xl border relative cursor-pointer transition-all
                    ${isItemSelected
                      ? 'bg-blue-500/10 border-blue-500/50 shadow-[0_0_16px_rgba(59,130,246,0.2)]'
                      : isUnconfirmed ? 'bg-red-500/5 border-red-500/10' :
                        isActive ? 'bg-orange-500/5 border-orange-500/10' :
                        'bg-emerald-500/5 border-emerald-500/10'}`}
                  onClick={() => setSelectedIncidentIdFlow(item.inc_id)}
                >
                  {/* 상단: 아이콘 + 제목 */}
                  <div className="flex items-start gap-2 mb-2">
                    <div className={`${
                      isUnconfirmed ? 'bg-red-500/10' :
                      isActive ? 'bg-orange-500/10' :
                      'bg-emerald-500/10'
                    } p-1.5 rounded-full shrink-0 mt-0.5`}>
                      <AlertCircle className={`w-4 h-4 ${
                        isUnconfirmed ? 'text-red-500' :
                        isActive ? 'text-orange-500' :
                        'text-emerald-500'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4
                        className={`text-sm font-bold leading-snug select-none transition-all duration-300 ${
                          isItemSelected ? 'text-blue-300' : 'text-white'
                        } ${expandedAssignments.has(item.inc_id) ? 'break-words' : 'line-clamp-2'}`}
                        onTouchStart={() => { pressTimerRef.current = setTimeout(() => { setExpandedAssignments(prev => { const next = new Set(prev); if (next.has(item.inc_id)) next.delete(item.inc_id); else next.add(item.inc_id); return next; }); }, 600); }}
                        onTouchEnd={() => clearTimeout(pressTimerRef.current)}
                      >
                        {item.message || '장애 발생'}
                      </h4>
                      {!expandedAssignments.has(item.inc_id) && (
                        <span className="text-[9px] text-slate-600 mt-0.5 block">꾹 누르면 전체 보기</span>
                      )}
                    </div>
                  </div>

                  {/* 뱃지 영역 */}
                  <div className="flex flex-wrap items-center gap-1.5 mb-3">
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded border bg-blue-500/20 text-blue-400 border-blue-500/30">SMS</span>
                    
                    {Number(item.received_count || 1) >= 2 && (
                      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-gradient-to-r from-blue-600/20 to-indigo-500/20 border border-blue-500/30">
                        <span className="text-[9px] font-black font-mono text-blue-400">{Number(item.occurrence_count) > 0 ? Number(item.occurrence_count) : (Number(item.received_count) || 1)}</span>
                        <span className="text-[7px] font-bold text-blue-500/60 uppercase">Event</span>
                      </div>
                    )}
                    
                    {Number(item.keyword_detected || 0) > 0 && (
                      <span className="bg-yellow-400/20 text-yellow-400 text-[9px] font-black px-1.5 py-0.5 rounded-full border border-yellow-400/30 flex items-center gap-1">
                        <Zap className="w-2 h-2" />감지 ({item.keyword_detected})
                      </span>
                    )}
                    
                    {Number(item.is_analyzed) >= 1 && (
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded border bg-blue-500/20 text-blue-400 border-blue-500/30">ANL_COMPLETE</span>
                    )}
                    
                    {(item.similarity_score !== undefined && item.similarity_score !== null) ? (
                      <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-[8px] font-black uppercase w-fit ${
                        item.similarity_score >= 0.8 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                      }`}>
                        <Zap className="w-2 h-2" />
                        Match {(item.similarity_score * 100).toFixed(1)}%
                      </div>
                    ) : Number(item.is_analyzed) >= 1 ? (
                      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded border text-[8px] font-black uppercase w-fit bg-slate-500/10 text-slate-500 border-white/10">
                        <Zap className="w-2 h-2" />
                        No Match
                      </div>
                    ) : null}
                    
                    {isActive && Number(item.is_analyzed) < 1 && (
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded border bg-yellow-500/20 text-yellow-400 border-yellow-500/30 animate-pulse">분석 중</span>
                    )}
                  </div>

                  {/* 하단: 상태 + 날짜 */}
                  <div className="flex items-center justify-between mt-1 mb-3">
                    <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1.5
                      ${isUnconfirmed ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                        isActive ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
                        'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'}`}>
                      <div className={`w-1 h-1 rounded-full ${
                        isUnconfirmed ? 'bg-red-400' :
                        isActive ? 'bg-orange-400' : 'bg-emerald-400'
                      }`} />
                      {getStatusName(item.status)}
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">{formatYYMMDD(item.assigned_at)}</span>
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
                      isItemSelected
                        ? 'bg-blue-600/20 border-blue-500/40 text-blue-300'
                        : 'bg-blue-600/10 border-blue-500/20 text-blue-400'
                    }`}
                  >
                    { (['처리완료', '조치완료', 'INC_003'].includes(item.status)) ? (
                      <>
                        <FileText className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-bold font-mono tracking-tight text-emerald-400">VIEW REPORT</span>
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
            <div className="bg-[#11141d] p-8 rounded-2xl border border-white/5 text-center">
              <Info className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-400">최근 할당 내역이 없습니다</p>
              <p className="text-xs text-slate-500 mt-1">SMS 메시지를 분석하면 자동으로 할당됩니다</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
