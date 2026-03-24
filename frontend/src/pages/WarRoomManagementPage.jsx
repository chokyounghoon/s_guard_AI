import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Search, Plus, AlertTriangle, Shield, BarChart2, Clock,
  MessageSquare, Users, LogIn, Filter, X, RefreshCw, FileText,
  Image, Paperclip, ChevronDown, Zap, CheckCircle2, AlertCircle,
  Hash, Activity, Eye
} from 'lucide-react';

const getApiUrl = (path) => {
  const base = window.location.hostname === 'localhost'
    ? 'https://sguardai.khcho0421.workers.dev'
    : 'https://sguardai.khcho0421.workers.dev';
  return `${base}${path}`;
};

const SEVERITY_CONFIG = {
  CRITICAL: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/40', icon: AlertTriangle, dot: 'bg-red-500' },
  MAJOR:    { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/40', icon: AlertCircle, dot: 'bg-orange-500' },
  NORMAL:   { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/40', icon: Shield, dot: 'bg-blue-500' },
};

const STATUS_CONFIG = {
  Open:        { label: '진행중', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  'In Progress': { label: '대응중', color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
  Completed:   { label: '완료', color: 'text-slate-400', bg: 'bg-slate-700/50' },
};

function formatTime(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return '방금';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return d.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
}

function WarRoomCard({ room, onJoin, onView }) {
  const sev = SEVERITY_CONFIG[room.severity] || SEVERITY_CONFIG.NORMAL;
  const sts = STATUS_CONFIG[room.status] || STATUS_CONFIG.Open;
  const SevIcon = sev.icon;

  return (
    <div className={`bg-[#11141d] rounded-3xl border ${sev.border} hover:border-opacity-70 transition-all duration-300 overflow-hidden group relative`}>
      {/* Severity glow effect */}
      <div className={`absolute inset-0 ${sev.bg} opacity-0 group-hover:opacity-30 transition-opacity duration-300 pointer-events-none`} />

      <div className="p-5 relative">
        {/* Header row */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className={`relative flex-shrink-0`}>
              <div className={`w-2.5 h-2.5 rounded-full ${sev.dot} animate-pulse`} />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-100 text-sm truncate pr-2 group-hover:text-white transition-colors">
                {room.title}
              </h3>
              <span className={`text-[10px] font-mono ${sev.text}`}>{room.code}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className={`text-[9px] font-black px-2 py-1 rounded-lg border ${sev.bg} ${sev.text} ${sev.border} uppercase`}>
              {room.severity}
            </span>
            <span className={`text-[9px] px-1.5 py-1 rounded-lg ${sts.bg} ${sts.color} font-bold`}>
              {sts.label}
            </span>
          </div>
        </div>

        {/* Description */}
        {room.description && (
          <p className="text-xs text-slate-400 mb-3 line-clamp-2 leading-relaxed">
            {room.description}
          </p>
        )}

        {/* Last message */}
        {room.last_message && (
          <div className="bg-white/5 rounded-xl px-3 py-2 mb-3 border border-white/5">
            <div className="flex items-center gap-1.5 mb-1">
              <MessageSquare className="w-3 h-3 text-slate-500" />
              <span className="text-[10px] text-slate-500 font-medium">{room.last_message_sender || '시스템'}</span>
              <span className="text-[9px] text-slate-600 ml-auto">{formatTime(room.last_message_time)}</span>
            </div>
            <p className="text-xs text-slate-400 truncate">{room.last_message}</p>
          </div>
        )}

        {/* Stats row */}
        <div className="flex items-center gap-3 text-[10px] text-slate-500 mb-4">
          <span className="flex items-center gap-1">
            <MessageSquare className="w-3 h-3" />
            {room.message_count || 0}개 메시지
          </span>
          <span className="flex items-center gap-1">
            <Paperclip className="w-3 h-3" />
            {room.attachment_count || 0}개 첨부
          </span>
          <span className="flex items-center gap-1 ml-auto">
            <Clock className="w-3 h-3" />
            {formatTime(room.created_at)}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => onView(room.code)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white/5 text-slate-400 text-xs font-bold hover:bg-white/10 hover:text-white transition-all"
          >
            <Eye className="w-3.5 h-3.5" />
            상세보기
          </button>
          <button
            onClick={() => {
              if (room.status === 'Completed') onView(room.code);
              else onJoin(room);
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
              room.status === 'Completed'
                ? 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                : `${sev.bg} ${sev.text} border ${sev.border} hover:opacity-90 active:scale-[0.98]`
            }`}
          >
            {room.status === 'Completed' ? (
              <>
                <Eye className="w-3.5 h-3.5" />
                종료(참관)
              </>
            ) : (
              <>
                <LogIn className="w-3.5 h-3.5" />
                입장하기
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WarRoomManagementPage() {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [joining, setJoining] = useState(null);
  const [joinSuccess, setJoinSuccess] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  
  // Advanced Filter states
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    assignee: '',
    division: '',
    team: ''
  });
  
  const searchTimer = useRef(null);

  const fetchRooms = useCallback(async (queryOverride = null) => {
    setLoading(true);
    try {
      const qVal = queryOverride !== null ? queryOverride : searchQuery;
      let params = new URLSearchParams();
      
      if (qVal && qVal.trim()) params.append('q', qVal.trim());
      if (activeTab === 'active') params.append('status', 'Open');
      else if (activeTab === 'completed') params.append('status', 'Completed');
      
      if (filters.startDate) params.append('start_date', filters.startDate);
      if (filters.endDate) params.append('end_date', filters.endDate);
      if (filters.assignee) params.append('assigned_to', filters.assignee);
      // NOTE: division/team filters would need a common location in IncidentDB OR a join (currently filtered by assignee string for simplicity or description)
      
      const res = await fetch(getApiUrl(`/warroom/rooms?${params.toString()}`));
      if (res.ok) {
        const data = await res.json();
        setRooms(data.rooms || []);
      }
    } catch (err) {
      console.error('Failed to fetch War-Rooms', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchQuery, filters]);

  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => fetchRooms(val), 400);
  };

  const handleJoin = async (room) => {
    setJoining(room.code);
    try {
      const userStr = localStorage.getItem('sguard_user');
      const user = userStr ? JSON.parse(userStr) : { name: '익명' };
      await fetch(getApiUrl(`/warroom/rooms/${room.code}/join`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_name: user.name || '익명' })
      });
      setJoinSuccess(room.code);
      setTimeout(() => {
        navigate(`/chat/${room.code}`);
      }, 800);
    } catch (err) {
      console.error('Join failed', err);
      navigate(`/chat/${room.code}`);
    } finally {
      setJoining(null);
    }
  };

  const handleView = (code) => navigate(`/chat/${code}`);

  const filteredRooms = rooms.filter(r => {
    if (activeTab === 'active') return r.status === 'Open' || r.status === 'In Progress';
    if (activeTab === 'completed') return r.status === 'Completed';
    return true;
  }).sort((a, b) => {
    if (sortBy === 'newest') return new Date(b.created_at) - new Date(a.created_at);
    if (sortBy === 'oldest') return new Date(a.created_at) - new Date(b.created_at);
    if (sortBy === 'messages') return (b.message_count || 0) - (a.message_count || 0);
    if (sortBy === 'severity') {
      const order = { CRITICAL: 0, MAJOR: 1, NORMAL: 2 };
      return (order[a.severity] || 2) - (order[b.severity] || 2);
    }
    return 0;
  });

  const stats = {
    total: rooms.length,
    active: rooms.filter(r => r.status === 'Open' || r.status === 'In Progress').length,
    critical: rooms.filter(r => r.severity === 'CRITICAL').length,
    completed: rooms.filter(r => r.status === 'Completed').length,
  };

  return (
    <div className="min-h-screen bg-[#0a0d14] text-white font-sans pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0a0d14]/95 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center justify-between px-5 py-4">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="text-center">
            <h1 className="font-black text-base tracking-tight">WAR-ROOM 현황</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-[3px]">Incident Management</p>
          </div>
          <button
            onClick={() => fetchRooms(searchQuery)}
            className="p-2 rounded-xl hover:bg-white/10 transition-colors text-slate-400 hover:text-white"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Search & Filters */}
        <div className="px-5 pb-4 space-y-4">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="코드, 제목, 내용 검색..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="w-full bg-white/5 border border-white/5 rounded-2xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:border-blue-500/50 transition-all"
              />
            </div>
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`p-3 rounded-2xl border transition-all ${showFilters ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'}`}
            >
              <Filter className="w-5 h-5" />
            </button>
          </div>

          {/* Advanced Filter Panel */}
          {showFilters && (
            <div className="bg-[#11141d] rounded-3xl border border-white/10 p-5 space-y-4 animate-in slide-in-from-top-4 duration-300">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">시작일</label>
                  <input 
                    type="date" 
                    value={filters.startDate}
                    onChange={(e) => setFilters(prev => ({...prev, startDate: e.target.value}))}
                    className="w-full bg-white/5 border border-white/5 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-blue-500/30"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">종료일</label>
                  <input 
                    type="date" 
                    value={filters.endDate}
                    onChange={(e) => setFilters(prev => ({...prev, endDate: e.target.value}))}
                    className="w-full bg-white/5 border border-white/5 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-blue-500/30"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">담당자</label>
                <input 
                  type="text" 
                  placeholder="담당자 이름 입력..."
                  value={filters.assignee}
                  onChange={(e) => setFilters(prev => ({...prev, assignee: e.target.value}))}
                  className="w-full bg-white/5 border border-white/5 rounded-xl py-2.5 px-3 text-xs focus:outline-none focus:border-blue-500/30"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">본부</label>
                  <select 
                    value={filters.division}
                    onChange={(e) => setFilters(prev => ({...prev, division: e.target.value}))}
                    className="w-full bg-white/5 border border-white/5 rounded-xl py-2.5 px-3 text-xs focus:outline-none focus:border-blue-500/30 text-slate-300"
                  >
                    <option value="">전체 본부</option>
                    <option value="IT">IT 본부</option>
                    <option value="SECURITY">보안 본부</option>
                    <option value="INFRA">인프라 본부</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">팀</label>
                  <select 
                    value={filters.team}
                    onChange={(e) => setFilters(prev => ({...prev, team: e.target.value}))}
                    className="w-full bg-white/5 border border-white/5 rounded-xl py-2.5 px-3 text-xs focus:outline-none focus:border-blue-500/30 text-slate-300"
                  >
                    <option value="">전체 팀</option>
                    <option value="DEV_1">개발 1팀</option>
                    <option value="DEV_2">개발 2팀</option>
                    <option value="CERT">보안관제팀</option>
                    <option value="PLATFORM">플랫폼팀</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button 
                  onClick={() => {
                    setFilters({ startDate: '', endDate: '', assignee: '', division: '', team: '' });
                    setSearchQuery('');
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 text-slate-400 text-xs font-bold hover:bg-white/10"
                >
                  초기화
                </button>
                <button 
                  onClick={() => fetchRooms()}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-500 shadow-lg shadow-blue-900/20"
                >
                  필터 적용
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Stats Bar */}
      <div className="px-5 py-4 grid grid-cols-4 gap-3">
        {[
          { label: '전체', value: stats.total, color: 'text-blue-400', icon: Hash },
          { label: '진행중', value: stats.active, color: 'text-emerald-400', icon: Activity },
          { label: 'CRITICAL', value: stats.critical, color: 'text-red-400', icon: AlertTriangle },
          { label: '완료', value: stats.completed, color: 'text-slate-400', icon: CheckCircle2 },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="bg-[#11141d] rounded-2xl p-3 border border-white/5 text-center">
            <Icon className={`w-4 h-4 ${color} mx-auto mb-1`} />
            <div className={`text-xl font-black ${color}`}>{value}</div>
            <div className="text-[9px] text-slate-600 uppercase tracking-wider">{label}</div>
          </div>
        ))}
      </div>

      {/* Tab + Sort */}
      <div className="px-5 flex items-center justify-between mb-4">
        <div className="flex bg-[#11141d] rounded-2xl p-1 border border-white/5">
          {[
            { key: 'all', label: '전체' },
            { key: 'active', label: '진행중' },
            { key: 'completed', label: '완료' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === key
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-slate-500 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 bg-[#11141d] rounded-2xl px-3 py-2 border border-white/5">
          <Filter className="w-3 h-3 text-slate-500" />
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="bg-transparent text-xs text-slate-400 focus:outline-none appearance-none"
          >
            <option value="newest">최신순</option>
            <option value="oldest">오래된순</option>
            <option value="severity">중요도순</option>
            <option value="messages">메시지순</option>
          </select>
          <ChevronDown className="w-3 h-3 text-slate-500" />
        </div>
      </div>

      {/* Room List */}
      <div className="px-5 space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="w-12 h-12 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-500 text-sm">War-Room 데이터 로딩 중...</p>
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="w-20 h-20 bg-slate-800 rounded-3xl flex items-center justify-center">
              <Zap className="w-10 h-10 text-slate-600" />
            </div>
            <div className="text-center">
              <p className="text-slate-400 font-bold">War-Room이 없습니다</p>
              <p className="text-slate-600 text-sm mt-1">
                {searchQuery ? `"${searchQuery}" 검색 결과가 없습니다` : '아직 개설된 War-Room이 없습니다'}
              </p>
            </div>
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); fetchRooms(); }}
                className="px-4 py-2 bg-blue-600/20 text-blue-400 rounded-xl text-sm border border-blue-500/30 hover:bg-blue-600/30 transition-colors"
              >
                검색 초기화
              </button>
            )}
          </div>
        ) : (
          filteredRooms.map(room => (
            <div key={room.code} className="relative">
              {joinSuccess === room.code && (
                <div className="absolute inset-0 z-10 bg-emerald-500/20 rounded-3xl border border-emerald-500/40 flex items-center justify-center backdrop-blur-sm">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold">
                    {/* {Icon && <Icon className="w-4 h-4" />} */}
                    입장 중...
                  </div>
                </div>
              )}
              {joining === room.code && (
                <div className="absolute inset-0 z-10 bg-blue-500/10 rounded-3xl flex items-center justify-center backdrop-blur-sm">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              <WarRoomCard room={room} onJoin={handleJoin} onView={handleView} />
            </div>
          ))
        )}
      </div>

      {/* Floating count */}
      {!loading && filteredRooms.length > 0 && (
        <div className="fixed bottom-20 right-5 bg-[#11141d] border border-white/10 rounded-full px-3 py-1.5 text-[10px] text-slate-400 shadow-xl">
          {filteredRooms.length}개 War-Room
        </div>
      )}
    </div>
  );
}
