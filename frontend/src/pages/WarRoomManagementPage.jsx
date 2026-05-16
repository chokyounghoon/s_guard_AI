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
  Open:         { label: '진행중', color: '#10b981' },
  'In Progress':{ label: '대응중', color: '#eab308' },
  Completed:    { label: '완료',   color: '#475569' },
};

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso), now = new Date(), s = (now - d) / 1000;
  if (s < 60)    return '방금';
  if (s < 3600)  return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  return d.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
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
  const [filters, setFilters]       = useState({ startDate: '', endDate: '', assignee: '' });
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
      await fetch(`${API_BASE}/warroom/rooms/${room.code}/join`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_name: u.name || '익명' }),
      });
      setTimeout(() => navigate(`/chat/${room.code}`), 500);
    } catch { navigate(`/chat/${room.code}`); }
    finally { setJoining(null); }
  };

  // DB 원본값 또는 정규화된 값 모두 처리
  const isActive = (r) => {
    const s = (r.status || '').toUpperCase();
    return !s || s === 'OPEN' || s === 'IN PROGRESS' || (s !== 'CLOSED' && s !== '최종완료' && s !== 'COMPLETED');
  };
  const isCompleted = (r) => {
    const s = (r.status || '').toUpperCase();
    return s === 'COMPLETED' || s === 'CLOSED' || r.status === '최종완료';
  };
  const normSeverity = (r) => (r.severity || 'NORMAL').toUpperCase();

  const filtered = rooms.filter(r => {
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
    active:    rooms.filter(r => isActive(r)).length,
    critical:  rooms.filter(r => normSeverity(r) === 'CRITICAL').length,
    completed: rooms.filter(r => isCompleted(r)).length,
  };

  return (
    <div style={{
      width: '100%', height: '100%', minHeight: '100dvh', display: 'flex', flexDirection: 'column', overflowY: 'auto',
      background: 'linear-gradient(160deg, #050810 0%, #090c1a 60%, #050810 100%)',
      fontFamily: "'Pretendard', 'Inter', sans-serif", color: '#cbd5e1',
    }}>
      <style>{`
        @keyframes spin  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        input::placeholder { color:#1e293b; }
        input:focus,select:focus { outline:none; border-color:rgba(99,102,241,.4)!important; }
        ::-webkit-scrollbar{width:3px} ::-webkit-scrollbar-thumb{background:rgba(99,102,241,.2);border-radius:99px}
      `}</style>

      {/* ①  헤더 */}
      <header style={{
        flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '13px 16px',
        borderBottom: '1px solid rgba(239,68,68,0.12)',
        background: 'rgba(5,8,16,0.96)', backdropFilter: 'blur(20px)',
      }}>
        <button onClick={() => goBack()} style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}>
          <ChevronLeft size={18} color="#64748b" />
        </button>

        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: 16, fontWeight: 900, letterSpacing: '0.04em',
            background: 'linear-gradient(90deg, #f87171, #fb923c)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>WAR-ROOM 현황</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 1 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', animation: 'pulse 2s ease infinite' }} />
            <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 800, letterSpacing: '0.15em', opacity: 0.7 }}>INCIDENT CHANNELS</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShowFilter(f => !f)}
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: showFilter ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)',
              border: showFilter ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}>
            <Filter size={15} color={showFilter ? '#f87171' : '#64748b'} />
          </button>
          <button onClick={() => fetchRooms()} style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}>
            <RefreshCw size={15} color="#f87171" style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>
      </header>

      {/* ②  통계 3개 */}
      <div style={{
        flexShrink: 0, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)',
        gap: 8, padding: '10px 16px 0',
      }}>
        {[
          { label: '전체',   value: stats.total,     color: '#60a5fa',  Icon: Hash },
          { label: '진행중', value: stats.active,    color: '#10b981',  Icon: Activity },
          { label: '완료',   value: stats.completed, color: '#475569',  Icon: CheckCircle2 },
        ].map(({ label, value, color, Icon }) => (
          <div key={label} style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 14, padding: '10px 8px', textAlign: 'center',
          }}>
            <Icon size={14} color={color} style={{ margin: '0 auto 5px' }} />
            <div style={{ fontSize: 22, fontWeight: 900, color, fontFamily: 'monospace' }}>{value}</div>
            <div style={{ fontSize: 9, color: '#334155', fontWeight: 800, letterSpacing: '0.04em', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ③  검색 */}
      <div style={{ flexShrink: 0, padding: '10px 16px 0', position: 'relative' }}>
        <Search size={15} color="#475569" style={{ position: 'absolute', left: 28, top: '50%', transform: 'translateY(-35%)' }} />
        <input
          type="text" placeholder="코드, 제목, 내용 검색..."
          value={searchQuery} onChange={onSearch}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12, padding: '12px 14px 12px 38px',
            color: '#e2e8f0', fontSize: 15, outline: 'none',
          }}
        />
      </div>

      {/* 필터 패널 */}
      {showFilter && (
        <div style={{
          flexShrink: 0, margin: '8px 16px 0',
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16, padding: '14px',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { label: '시작일', key: 'startDate', type: 'date' },
              { label: '종료일', key: 'endDate',   type: 'date' },
            ].map(f => (
              <div key={f.key}>
                <div style={{ fontSize: 11, color: '#475569', fontWeight: 800, marginBottom: 5 }}>{f.label}</div>
                <input type={f.type} value={filters[f.key]}
                  onChange={e => setFilters(p => ({ ...p, [f.key]: e.target.value }))}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 10, padding: '9px 12px', color: '#e2e8f0', fontSize: 13,
                  }}
                />
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#475569', fontWeight: 800, marginBottom: 5 }}>담당자</div>
            <input type="text" placeholder="이름 입력..." value={filters.assignee}
              onChange={e => setFilters(p => ({ ...p, assignee: e.target.value }))}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10, padding: '9px 12px', color: '#e2e8f0', fontSize: 13,
              }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button onClick={() => { setFilters({ startDate: '', endDate: '', assignee: '' }); setSearchQuery(''); }}
              style={{ padding: '10px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#64748b', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              초기화
            </button>
            <button onClick={() => fetchRooms()}
              style={{ padding: '10px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
              필터 적용
            </button>
          </div>
        </div>
      )}

      {/* ④  탭 + 정렬 */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px 0' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { key: 'all',       label: '전체' },
            { key: 'active',    label: '진행중' },
            { key: 'completed', label: '완료' },
          ].map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
              padding: '8px 14px', borderRadius: 10, cursor: 'pointer',
              fontSize: 13, fontWeight: 800,
              background: activeTab === t.key ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.03)',
              border: activeTab === t.key ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(255,255,255,0.06)',
              color: activeTab === t.key ? '#f87171' : '#475569',
              transition: 'all 0.15s',
            }}>{t.label}</button>
          ))}
        </div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10, padding: '8px 10px', color: '#94a3b8', fontSize: 13, cursor: 'pointer',
        }}>
          <option value="newest">최신순</option>
          <option value="oldest">오래된순</option>
          <option value="severity">중요도순</option>
          <option value="messages">메시지순</option>
        </select>
      </div>

      {/* ⑤  룸 목록 (flex:1 스크롤) */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px 16px 80px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <Loader2 size={24} color="#f87171" style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 150, gap: 8 }}>
            <Zap size={32} color="#1e293b" />
            <span style={{ fontSize: 14, color: '#334155', fontWeight: 700 }}>
              {searchQuery ? `"${searchQuery}" 결과 없음` : 'War-Room이 없습니다'}
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(room => {
              const sev = SEV[normSeverity(room)] || SEV.NORMAL;
              const sts = STS[room.status] || STS.Open;
              const isJoining = joining === room.code;
              return (
                <div key={room.code} style={{
                  borderRadius: 20, padding: '16px',
                  background: `linear-gradient(135deg, ${sev.color}08 0%, rgba(255,255,255,0.02) 100%)`,
                  border: `1px solid ${sev.border}`,
                  position: 'relative', overflow: 'hidden',
                  opacity: isJoining ? 0.7 : 1, transition: 'opacity 0.2s',
                }}>
                  {/* 좌측 심각도 바 */}
                  <div style={{
                    position: 'absolute', top: 0, left: 0, bottom: 0, width: 4,
                    background: sev.color, borderRadius: '20px 0 0 20px',
                  }} />

                  {/* 1행: 코드 + 심각도 + 상태 */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: sev.color, animation: !isCompleted(room) ? 'pulse 2s ease infinite' : 'none' }} />
                      <span style={{ fontSize: 12, color: sev.color, fontFamily: 'monospace', fontWeight: 700 }}>{room.code}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 800, color: sev.color,
                        background: sev.bg, border: `1px solid ${sev.border}`,
                        borderRadius: 6, padding: '2px 8px',
                      }}>{sev.label}</span>
                      {isCompleted(room) && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, color: '#475569',
                          background: 'rgba(71,85,105,0.12)', border: '1px solid rgba(71,85,105,0.2)',
                          borderRadius: 6, padding: '2px 8px',
                        }}>완료</span>
                      )}
                    </div>
                  </div>

                  {/* 2행: 제목 */}
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9', lineHeight: 1.3, marginBottom: 6 }}>
                    {room.title}
                  </div>

                  {/* 3행: 설명 */}
                  {room.description && (
                    <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.5, marginBottom: 8,
                      overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {room.description}
                    </div>
                  )}

                  {/* 4행: 최근 메시지 */}
                  {room.last_message && (
                    <div style={{
                      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
                      borderRadius: 12, padding: '9px 12px', marginBottom: 10,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>
                          {room.last_message_sender || '시스템'}
                        </span>
                        <span style={{ fontSize: 11, color: '#334155', fontFamily: 'monospace' }}>
                          {formatTime(room.last_message_time)}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {room.last_message}
                      </div>
                    </div>
                  )}

                  {/* 5행: 통계 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <MessageSquare size={12} color="#334155" />
                      <span style={{ fontSize: 12, color: '#475569', fontWeight: 700 }}>{room.message_count || 0}개</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Paperclip size={12} color="#334155" />
                      <span style={{ fontSize: 12, color: '#475569', fontWeight: 700 }}>{room.attachment_count || 0}개 첨부</span>
                    </div>
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={12} color="#334155" />
                      <span style={{ fontSize: 12, color: '#334155', fontFamily: 'monospace' }}>{formatTime(room.created_at)}</span>
                    </div>
                  </div>

                  {/* 6행: 액션 버튼 */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <button onClick={() => navigate(`/chat/${room.code}`)} style={{
                      padding: '12px', borderRadius: 12, cursor: 'pointer',
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                      color: '#94a3b8', fontSize: 14, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}>
                      <Eye size={15} /> 상세보기
                    </button>
                    <button
                      onClick={() => room.status === 'Completed' ? navigate(`/chat/${room.code}`) : handleJoin(room)}
                      disabled={isJoining}
                      style={{
                        padding: '12px', borderRadius: 12, cursor: 'pointer',
                        background: room.status === 'Completed' ? 'rgba(71,85,105,0.2)' : sev.bg,
                        border: room.status === 'Completed' ? '1px solid rgba(71,85,105,0.3)' : `1px solid ${sev.border}`,
                        color: room.status === 'Completed' ? '#475569' : sev.color,
                        fontSize: 14, fontWeight: 800,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        transition: 'all 0.15s',
                      }}>
                      {isJoining
                        ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> 입장 중</>
                        : room.status === 'Completed'
                          ? <><Eye size={15} /> 종료(참관)</>
                          : <><LogIn size={15} /> 입장하기</>}
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
