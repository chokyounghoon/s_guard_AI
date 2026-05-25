import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBackNavigation } from '../hooks/useBackNavigation';
import {
  ChevronLeft, Search, AlertTriangle, Shield, Clock,
  MessageSquare, Users, LogIn, Filter, X, RefreshCw,
  Paperclip, Zap, CheckCircle2, AlertCircle,
  Hash, Activity, Eye, Loader2
} from 'lucide-react';
import { getAuthHeaders } from '../lib/authStore';

const API_BASE = 'https://sguardai.khcho0421.workers.dev';

const SEV = {
  CRITICAL: { color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.25)', label: 'CRITICAL' },
  MAJOR:    { color: '#fb923c', bg: 'rgba(251,146,60,0.1)',  border: 'rgba(251,146,60,0.25)',  label: 'MAJOR' },
  NORMAL:   { color: '#60a5fa', bg: 'rgba(96,165,250,0.1)',  border: 'rgba(96,165,250,0.25)',  label: 'NORMAL' },
};
const STS = {
  Open:         { label: '접수중', color: '#3b82f6' },
  'In Progress':{ label: '대응중', color: '#eab308' },
  Active:       { label: '대응중', color: '#eab308' },
  Completed:    { label: '완료',   color: '#475569' },
  INC_001:      { label: '접수중', color: '#3b82f6' },
  INC_002:      { label: '진행중', color: '#10b981' },
  INC_003:      { label: '완료',   color: '#475569' },
  최종완료:      { label: '완료',   color: '#475569' },
  처리완료:      { label: '완료',   color: '#475569' },
};

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso), now = new Date(), s = (now - d) / 1000;
  if (s < 60)    return '방금';
  if (s < 3600)  return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  return d.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
}

function getDefaultDates() {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 1);
  const fmt = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  return { startDate: fmt(start), endDate: fmt(end) };
}

export default function WarRoomManagementPage() {
  const navigate = useNavigate();
  const goBack = useBackNavigation('/dashboard');
  const [rooms, setRooms]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab]   = useState('active');
  const [sortBy, setSortBy]         = useState('newest');
  const [joining, setJoining]       = useState(null);
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters]       = useState(() => ({ ...getDefaultDates(), assignee: '' }));
  const timer = useRef(null);

  const fetchRooms = useCallback(async (q = searchQuery) => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (q?.trim()) p.append('q', q.trim());
      // status 필터는 API에 전달하지 않음
      // → Production Worker가 DB 실제값(CLOSED/최종완료)을 처리 못하므로
      // → 항상 전체 조회 후 클라이언트의 isActive/isCompleted로 탭 필터링
      if (filters.startDate) p.append('start_date', filters.startDate);
      if (filters.endDate)   p.append('end_date',   filters.endDate);
      if (filters.assignee)  p.append('assigned_to', filters.assignee);
      const res = await fetch(`${API_BASE}/warroom/rooms?${p}`, { headers: getAuthHeaders() });
      if (res.ok) { const d = await res.json(); setRooms(d.rooms || []); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [searchQuery, filters]);

  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  const onSearch = (e) => {
    const v = e.target.value; setSearchQuery(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => fetchRooms(v), 400);
  };

  const handleJoin = async (room) => {
    setJoining(room.code);
    try {
      const u = JSON.parse(localStorage.getItem('sguard_user') || '{}');
      await fetch(`${API_BASE}/warroom/join`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incident_id: room.code,
          user_id: u.employee_id || 'SYSTEM',
          name: u.name || '익명'
        }),
      });
      setTimeout(() => navigate(`/chat/${room.code}`), 500);
    } catch { navigate(`/chat/${room.code}`); }
    finally { setJoining(null); }
  };

  const handleOpenWarRoom = async (room) => {
    setJoining(room.code);
    try {
      const u = JSON.parse(localStorage.getItem('sguard_user') || '{}');
      // 워룸 개설 API 호출
      await fetch(`${API_BASE}/ai/warroom/open`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inc_id: room.code,
          title: room.title || room.code,
          creator_id: u.employee_id || 'SYSTEM',
          severity: room.severity || 'NORMAL',
          leader_summary: room.description || ''
        }),
      });
      // 개설 후 바로 입장 처리
      await handleJoin(room);
    } catch {
      navigate(`/chat/${room.code}`);
    } finally {
      setJoining(null);
    }
  };

  // DB 원본값 또는 정규화된 값 모두 처리
  const isCompleted = (r) => {
    const s = (r.status || '').toUpperCase();
    return s === 'COMPLETED' || s === 'CLOSED' || s === '최종완료' || s === '처리완료' || s === 'INC_003';
  };
  const isOpen = (r) => {
    const s = (r.status || '').toUpperCase();
    return !s || s === 'OPEN' || s === 'INC_001' || s === '접수' || s === '접수중';
  };
  const isActive = (r) => {
    return !isOpen(r) && !isCompleted(r);
  };
  const normSeverity = (r) => (r.severity || 'NORMAL').toUpperCase();

  const filtered = rooms.filter(r => {
    if (activeTab === 'open')      return isOpen(r);
    if (activeTab === 'active')    return isActive(r);
    if (activeTab === 'completed') return isCompleted(r);
    return true;
  }).sort((a, b) => {
    const da = new Date(b.reg_dt || b.created_at || 0);
    const db2 = new Date(a.reg_dt || a.created_at || 0);
    if (sortBy === 'newest')   return new Date(b.reg_dt || b.created_at || 0) - new Date(a.reg_dt || a.created_at || 0);
    if (sortBy === 'oldest')   return new Date(a.reg_dt || a.created_at || 0) - new Date(b.reg_dt || b.created_at || 0);
    if (sortBy === 'messages') return (b.message_count || 0) - (a.message_count || 0);
    if (sortBy === 'severity') return ({ CRITICAL: 0, MAJOR: 1, NORMAL: 2 }[normSeverity(a)] ?? 2) - ({ CRITICAL: 0, MAJOR: 1, NORMAL: 2 }[normSeverity(b)] ?? 2);
    return 0;
  });

  const stats = {
    total:     rooms.length,
    open:      rooms.filter(r => isOpen(r)).length,
    active:    rooms.filter(r => isActive(r)).length,
    critical:  rooms.filter(r => normSeverity(r) === 'CRITICAL').length,
    completed: rooms.filter(r => isCompleted(r)).length,
  };

  return (
    <div className="w-full h-full min-h-[100dvh] flex flex-col overflow-y-auto bg-gradient-to-br from-[#050810] via-[#090c1a] to-[#050810] font-['Pretendard','Inter',sans-serif] text-slate-300">
      <style>{`
        input::placeholder { color: #1e293b; }
        ::-webkit-scrollbar { width: 3px; } 
        ::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.2); border-radius: 99px; }
      `}</style>

      {/* ① 헤더 */}
      <header className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#050810]/95 backdrop-blur-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <button onClick={() => goBack()} className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center cursor-pointer hover:bg-white/10 transition-colors z-10">
          <ChevronLeft size={18} className="text-slate-400" />
        </button>

        <div className="text-center z-10">
          <div className="text-base font-black tracking-widest bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">WAR-ROOM 현황</div>
          <div className="flex items-center justify-center gap-1.5 mt-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_#ef4444]" />
            <span className="text-[10px] text-red-500 font-extrabold tracking-widest opacity-80">INCIDENT CHANNELS</span>
          </div>
        </div>

        <div className="flex gap-2 z-10">
          <button onClick={() => setShowFilter(f => !f)} className={`w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer transition-colors ${showFilter ? 'bg-red-500/15 border border-red-500/30 text-red-400' : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10'}`}>
            <Filter size={15} />
          </button>
          <button onClick={() => fetchRooms()} className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center cursor-pointer hover:bg-red-500/20 transition-colors text-red-400">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {/* ② 통계 4개 */}
      <div className="shrink-0 grid grid-cols-4 gap-2 px-4 pt-4">
        {[
          { label: '전체',   value: stats.total,     color: 'text-blue-400',   bg: 'bg-blue-500/10',     Icon: Hash },
          { label: '접수중', value: stats.open,      color: 'text-blue-500',   bg: 'bg-blue-600/10',     Icon: AlertCircle },
          { label: '진행중', value: stats.active,    color: 'text-emerald-400',bg: 'bg-emerald-500/10',  Icon: Activity },
          { label: '완료',   value: stats.completed, color: 'text-slate-400',  bg: 'bg-slate-500/10',    Icon: CheckCircle2 },
        ].map(({ label, value, color, bg, Icon }) => (
          <div key={label} className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-2.5 text-center flex flex-col items-center justify-center backdrop-blur-md shadow-xl">
            <div className={`p-1.5 rounded-lg ${bg} mb-1.5`}>
              <Icon size={12} className={color} />
            </div>
            <div className={`text-xl font-black font-mono tracking-tight ${color}`}>{value}</div>
            <div className="text-[9px] font-black text-slate-500 tracking-wider mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* ③ 검색 */}
      <div className="shrink-0 px-4 pt-4 relative">
        <Search size={15} className="absolute left-8 top-1/2 -translate-y-1/2 text-slate-500 mt-2" />
        <input
          type="text" placeholder="코드, 제목, 내용 검색..."
          value={searchQuery} onChange={onSearch}
          className="w-full bg-black/40 border border-white/10 rounded-2xl py-3 pl-11 pr-4 text-slate-200 text-sm focus:outline-none focus:border-red-500/50 focus:bg-white/[0.05] transition-all placeholder-slate-600 shadow-inner"
        />
      </div>

      {/* 필터 패널 */}
      {showFilter && (
        <div className="shrink-0 mx-4 mt-3 bg-white/[0.02] border border-white/10 rounded-2xl p-4 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: '시작일', key: 'startDate', type: 'date' },
              { label: '종료일', key: 'endDate',   type: 'date' },
            ].map(f => (
              <div key={f.key}>
                <div className="text-[10px] font-black text-slate-500 tracking-wider mb-1.5">{f.label}</div>
                <input type={f.type} value={filters[f.key]} style={{colorScheme: 'dark'}}
                  onChange={e => setFilters(p => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-red-500/50 transition-all"
                />
              </div>
            ))}
          </div>
          <div>
            <div className="text-[10px] font-black text-slate-500 tracking-wider mb-1.5">담당자</div>
            <input type="text" placeholder="이름 입력..." value={filters.assignee}
              onChange={e => setFilters(p => ({ ...p, assignee: e.target.value }))}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-red-500/50 transition-all"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 mt-1">
            <button onClick={() => { setFilters({ ...getDefaultDates(), assignee: '' }); setSearchQuery(''); }}
              className="py-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-400 text-xs font-black hover:bg-white/10 transition-colors">
              초기화
            </button>
            <button onClick={() => fetchRooms()}
              className="py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-black hover:bg-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.15)] transition-all">
              필터 적용
            </button>
          </div>
        </div>
      )}

      {/* ④ 탭 + 정렬 */}
      <div className="shrink-0 flex items-center justify-between px-4 pt-4">
        <div className="flex gap-1.5 bg-white/[0.02] p-1 rounded-2xl border border-white/5">
          {[
            { key: 'all',       label: '전체' },
            { key: 'open',      label: '접수중' },
            { key: 'active',    label: '진행중' },
            { key: 'completed', label: '완료' },
          ].map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} 
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${activeTab === t.key ? 'bg-red-500/20 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.2)]' : 'text-slate-500 hover:text-slate-300'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} 
          className="bg-black/40 border border-white/10 rounded-xl px-2.5 py-1.5 text-slate-400 text-xs font-bold focus:outline-none cursor-pointer">
          <option value="newest">최신순</option>
          <option value="oldest">오래된순</option>
          <option value="severity">중요도순</option>
          <option value="messages">메시지순</option>
        </select>
      </div>

      {/* ⑤ 룸 목록 */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-4 pb-24 custom-scrollbar">
        {loading ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 size={24} className="text-red-400 animate-spin opacity-50" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3 opacity-50">
            <Zap size={32} className="text-slate-600" />
            <span className="text-sm font-black text-slate-500 tracking-tight">
              {searchQuery ? `"${searchQuery}" 검색 결과가 없습니다` : '등록된 War-Room이 없습니다'}
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-3.5">
            {filtered.map((room, index) => {
              const sev = SEV[normSeverity(room)] || SEV.NORMAL;
              const isComp = isCompleted(room);
              const isOp = isOpen(room);
              const sts = isComp ? STS.Completed : (isOp ? STS.Open : STS.Active);
              const isJoining = joining === room.code;
              
              return (
                <div key={`${room.code}-${index}`} 
                  className={`rounded-[1.25rem] p-4 relative overflow-hidden backdrop-blur-md transition-all duration-300 ${isJoining ? 'opacity-50 scale-[0.98]' : 'hover:scale-[1.01]'}`}
                  style={{
                    background: `linear-gradient(135deg, ${sev.color}15 0%, rgba(255,255,255,0.02) 100%)`,
                    border: `1px solid ${sev.border}`
                  }}>
                  {/* 좌측 심각도 바 */}
                  <div className="absolute top-0 left-0 bottom-0 w-1 rounded-l-[1.25rem]" style={{ background: sev.color }} />

                  {/* 1행: 코드 + 상태 */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${!isComp ? 'animate-pulse' : ''}`} style={{ background: sev.color, boxShadow: `0 0 8px ${sev.color}` }} />
                      <span className="text-xs font-black font-mono tracking-wider" style={{ color: sev.color }}>{room.code}</span>
                    </div>
                    <div className="flex gap-2 items-center">
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-lg border" style={{ color: sts.color, background: `${sts.color}15`, borderColor: `${sts.color}40` }}>
                        {sts.label}
                      </span>
                      {isComp && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-lg border border-slate-500/30 bg-slate-500/10 text-slate-400">
                          종료됨
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 2행: 제목 */}
                  <div className="text-[15px] font-black text-slate-100 leading-snug mb-1.5 tracking-tight">
                    {room.title}
                  </div>

                  {/* 3행: 설명 */}
                  {room.description && (
                    <div className="text-xs text-slate-400 leading-relaxed mb-3 line-clamp-2">
                      {room.description}
                    </div>
                  )}

                  {/* 4행: 최근 메시지 */}
                  {!isOp && room.last_message && (
                    <div className="bg-black/20 border border-white/5 rounded-xl p-2.5 mb-3 backdrop-blur-sm">
                      <div className="flex justify-between mb-1.5">
                        <span className="text-[10px] font-black text-slate-500">{room.last_message_sender || '시스템'}</span>
                        <span className="text-[10px] font-mono text-slate-500">{formatTime(room.last_message_time)}</span>
                      </div>
                      <div className="text-[11px] text-slate-300 truncate font-medium">
                        {room.last_message}
                      </div>
                    </div>
                  )}

                  {/* 5행: 통계 */}
                  <div className="flex items-center gap-3 mb-3.5">
                    {!isOp ? (
                      <>
                        <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-lg">
                          <MessageSquare size={10} className="text-slate-400" />
                          <span className="text-[10px] font-black text-slate-300">{room.message_count || 0}</span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-lg">
                          <Paperclip size={10} className="text-slate-400" />
                          <span className="text-[10px] font-black text-slate-300">{room.attachment_count || 0}</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-1.5 bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-500/20">
                        <AlertCircle size={10} className="text-blue-400" />
                        <span className="text-[10px] font-black text-blue-400">워룸 개설 대기중</span>
                      </div>
                    )}
                    <div className="ml-auto flex items-center gap-1.5 opacity-60">
                      <Clock size={10} className="text-slate-400" />
                      <span className="text-[10px] font-mono text-slate-400">{formatTime(room.created_at)}</span>
                    </div>
                  </div>

                  {/* 6행: 액션 버튼 */}
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <button onClick={() => navigate(`/chat/${room.code}`)} 
                      className="py-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-xs font-black flex items-center justify-center gap-1.5 hover:bg-white/10 transition-colors">
                      <Eye size={14} /> 상세보기
                    </button>
                    <button
                      onClick={() => isComp ? navigate(`/chat/${room.code}`) : (isOp ? handleOpenWarRoom(room) : handleJoin(room))}
                      disabled={isJoining}
                      className="py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-lg active:scale-95"
                      style={{
                        background: isComp ? 'rgba(71,85,105,0.2)' : (isOp ? 'rgba(59,130,246,0.15)' : sev.bg),
                        border: isComp ? '1px solid rgba(71,85,105,0.3)' : (isOp ? '1px solid rgba(59,130,246,0.3)' : `1px solid ${sev.border}`),
                        color: isComp ? '#94a3b8' : (isOp ? '#60a5fa' : sev.color),
                        boxShadow: isComp ? 'none' : (isOp ? '0 0 15px rgba(59,130,246,0.2)' : `0 0 15px ${sev.color}40`)
                      }}>
                      {isJoining
                        ? <><Loader2 size={14} className="animate-spin" /> 처리 중</>
                        : isComp
                          ? <><Eye size={14} /> 종료(참관)</>
                          : isOp
                            ? <><Zap size={14} /> 워룸 개설</>
                            : <><LogIn size={14} /> 입장하기</>}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
