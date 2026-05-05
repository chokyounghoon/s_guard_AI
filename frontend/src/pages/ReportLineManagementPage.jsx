import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBackNavigation } from '../hooks/useBackNavigation';
import {
  ChevronLeft, Search, Save, Shield, Star,
  Users, Trash2, TrendingDown, User, Zap, ChevronUp, ChevronDown,
  Plus, AlertCircle, RefreshCw, Loader2
} from 'lucide-react';
import { SMS_WORKER_URL } from '../config/api';

const getApiUrl = (endpoint) => `${SMS_WORKER_URL}${endpoint}`;

const roleStyles = {
  '대표': { icon: Shield, color: '#a855f7' },
  '본부': { icon: Star,   color: '#60a5fa' },
  '상무': { icon: Star,   color: '#60a5fa' },
  '전무': { icon: Star,   color: '#60a5fa' },
  '팀장': { icon: Users,  color: '#34d399' },
  '파트장':{ icon: Zap,   color: '#fb923c' },
  'default':{ icon: User, color: '#f472b6' },
};

const getStyle = (role) => {
  if (!role) return roleStyles.default;
  for (const [k, v] of Object.entries(roleStyles)) {
    if (role.includes(k)) return v;
  }
  return roleStyles.default;
};

const nodeColors = (index, total) => {
  if (index === 0) return '#a855f7';
  if (index === total - 1) return '#10b981';
  return '#3b82f6';
};

export default function ReportLineManagementPage() {
  const navigate = useNavigate();
  const goBack = useBackNavigation('/dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [availableMembers, setAvailableMembers] = useState([]);
  const [reportLines, setReportLines] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem('sguard_user');
    if (saved) { try { setCurrentUser(JSON.parse(saved)); } catch (e) {} }
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    let userId = '';
    const saved = localStorage.getItem('sguard_user');
    if (saved) { try { userId = JSON.parse(saved).employee_id; } catch (e) {} }
    try {
      const [usersRes, linesRes] = await Promise.all([
        fetch(getApiUrl('/api/v1/users/organization')),
        fetch(getApiUrl(`/api/v1/report-lines?user_id=${userId}`)),
      ]);
      if (usersRes.ok && linesRes.ok) {
        const usersData = await usersRes.json();
        const linesData = await linesRes.json();
        setAvailableMembers(usersData.users || []);
        const hydrated = (linesData.report_lines || []).map(line => {
          const u = (usersData.users || []).find(u => u.id === line.user_id) || {};
          return { ...line, name: u.name || line.user_name, role: u.role || line.role_name || '결재자', honbu: u.honbu || '', team: u.team || '', id: line.user_id };
        });
        setReportLines(hydrated);
      }
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  const saveReportLines = async () => {
    setIsSaving(true);
    try {
      const payload = reportLines.map((l, i) => ({ hierarchy_level: i + 1, role_name: l.role || '결재자', user_id: l.id, user_name: l.name }));
      const res = await fetch(getApiUrl('/api/v1/report-lines'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner_id: currentUser?.employee_id, report_lines: payload }),
      });
      if (!res.ok) alert('저장 실패');
    } catch (e) { alert('서버 오류'); }
    finally { setIsSaving(false); }
  };

  const addMember = (m) => {
    if (reportLines.some(l => l.id === m.id)) return;
    setReportLines(prev => [...prev, m]);
  };
  const removeMember = (id) => setReportLines(prev => prev.filter(l => l.id !== id));
  const moveUp = (i) => {
    if (i === 0) return;
    setReportLines(prev => { const a = [...prev]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; return a; });
  };
  const moveDown = (i) => {
    if (i === reportLines.length - 1) return;
    setReportLines(prev => { const a = [...prev]; [a[i], a[i + 1]] = [a[i + 1], a[i]]; return a; });
  };

  const filtered = availableMembers.filter(m =>
    m.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.honbu?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.team?.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => {
    if (!searchTerm && currentUser) {
      if (a.team === currentUser.team && b.team !== currentUser.team) return -1;
      if (a.team !== currentUser.team && b.team === currentUser.team) return 1;
      if (a.honbu === currentUser.honbu && b.honbu !== currentUser.honbu) return -1;
      if (a.honbu !== currentUser.honbu && b.honbu === currentUser.honbu) return 1;
    }
    return 0;
  });

  return (
    <div style={{
      height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: 'linear-gradient(160deg, #07030f 0%, #0a0714 50%, #060311 100%)',
      fontFamily: "'Pretendard', 'Inter', sans-serif", color: '#cbd5e1',
    }}>

      {/* ── 헤더 ── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px', flexShrink: 0,
        borderBottom: '1px solid rgba(168,85,247,0.1)',
        background: 'rgba(7,3,15,0.9)', backdropFilter: 'blur(20px)',
      }}>
        <button onClick={() => goBack()} style={{
          width: 34, height: 34, borderRadius: 10,
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}>
          <ChevronLeft size={16} color="#64748b" />
        </button>

        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: 16, fontWeight: 900, letterSpacing: '0.04em',
            background: 'linear-gradient(90deg, #a855f7, #60a5fa)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>보고 / 결재 라인</div>
          <div style={{ fontSize: 11, color: '#a855f7', fontWeight: 800, letterSpacing: '0.18em', opacity: 0.6 }}>
            APPROVAL HIERARCHY
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={fetchData} disabled={isLoading} style={{
            width: 34, height: 34, borderRadius: 10,
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}>
            <RefreshCw size={14} color="#64748b" style={{ animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
          <button onClick={saveReportLines} disabled={isSaving} style={{
            height: 34, padding: '0 14px', borderRadius: 10,
            background: isSaving ? 'rgba(168,85,247,0.1)' : 'linear-gradient(135deg, #7c3aed, #a855f7)',
            border: 'none', color: '#fff', fontWeight: 800, fontSize: 12,
            display: 'flex', alignItems: 'center', gap: 5, cursor: isSaving ? 'not-allowed' : 'pointer',
          }}>
            {isSaving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={13} />}
            {isSaving ? '저장 중' : '저장'}
          </button>
        </div>
      </header>

      {/* ── 상단: 보고 라인 트리 ── */}
      <div style={{
        flex: '0 0 auto', maxHeight: '42%',
        display: 'flex', flexDirection: 'column',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        {/* 섹션 타이틀 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px 8px', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <TrendingDown size={13} color="#a855f7" />
            <span style={{ fontSize: 11, fontWeight: 800, color: '#e2e8f0', letterSpacing: '0.04em' }}>알림 결재 / 통보 라인</span>
          </div>
          <span style={{
            fontSize: 12, fontWeight: 800, color: '#a855f7',
            background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)',
            borderRadius: 6, padding: '3px 10px', letterSpacing: '0.06em',
          }}>
            {reportLines.length}명
          </span>
        </div>

        {/* 트리 목록 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 10px' }}>
          {isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 80 }}>
              <Loader2 size={20} color="#475569" style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          ) : reportLines.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 6, height: 80, border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 14,
            }}>
              <AlertCircle size={20} color="#334155" />
              <span style={{ fontSize: 11, color: '#334155', fontWeight: 700 }}>아래에서 구성원을 추가하세요</span>
            </div>
          ) : (
            <div style={{ position: 'relative', paddingLeft: 28 }}>
              {/* 연결선 */}
              {reportLines.length > 1 && (
                <div style={{
                  position: 'absolute', left: 12, top: 20, bottom: 20, width: 2,
                  background: 'linear-gradient(180deg, #a855f7, #3b82f6, #10b981)',
                  borderRadius: 99,
                }} />
              )}

              {reportLines.map((m, i) => {
                const style = getStyle(m.role);
                const Icon = style.icon;
                const col = nodeColors(i, reportLines.length);
                return (
                  <div key={m.id} style={{ position: 'relative', marginBottom: 8 }}>
                    {/* 노드 점 */}
                    <div style={{
                      position: 'absolute', left: -22, top: '50%', transform: 'translateY(-50%)',
                      width: 10, height: 10, borderRadius: '50%',
                      background: col, boxShadow: `0 0 8px ${col}`,
                      border: '2px solid #07030f', zIndex: 2,
                    }} />

                    <div style={{
                      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                      borderRadius: 14, padding: '9px 10px',
                      display: 'flex', alignItems: 'center', gap: 10,
                    }}>
                      {/* 순서 */}
                      <span style={{ fontSize: 10, fontWeight: 900, color: col, fontFamily: 'monospace', width: 18, textAlign: 'center', flexShrink: 0 }}>
                        {i + 1}
                      </span>

                      {/* 아이콘 */}
                      <div style={{
                        width: 32, height: 32, borderRadius: 10,
                        background: `${style.color}15`, border: `1px solid ${style.color}30`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <Icon size={14} color={style.color} />
                      </div>

                      {/* 이름/부서 */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9', lineHeight: 1.2 }}>{m.name}</div>
                        <div style={{ fontSize: 12, color: '#475569', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {m.role} · {m.team || m.honbu}
                        </div>
                      </div>

                      {/* 조작 버튼 */}
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <button onClick={() => moveUp(i)} disabled={i === 0} style={{
                          width: 26, height: 26, borderRadius: 8,
                          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: i === 0 ? 'not-allowed' : 'pointer', opacity: i === 0 ? 0.3 : 1,
                        }}>
                          <ChevronUp size={12} color="#94a3b8" />
                        </button>
                        <button onClick={() => moveDown(i)} disabled={i === reportLines.length - 1} style={{
                          width: 26, height: 26, borderRadius: 8,
                          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: i === reportLines.length - 1 ? 'not-allowed' : 'pointer', opacity: i === reportLines.length - 1 ? 0.3 : 1,
                        }}>
                          <ChevronDown size={12} color="#94a3b8" />
                        </button>
                        <button onClick={() => removeMember(m.id)} style={{
                          width: 26, height: 26, borderRadius: 8,
                          background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                        }}>
                          <Trash2 size={12} color="#f87171" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── 하단: 멤버 검색/추가 ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {/* 검색 바 */}
        <div style={{ padding: '10px 16px 8px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#e2e8f0', letterSpacing: '0.04em' }}>조직 구성원 추가</span>
            <span style={{ fontSize: 10, color: '#475569' }}>· 클릭하여 라인에 추가</span>
          </div>
          <div style={{ position: 'relative' }}>
            <Search size={13} color="#475569" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="이름, 부서 검색..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10, padding: '9px 12px 9px 32px',
                color: '#e2e8f0', fontSize: 12, outline: 'none',
              }}
            />
          </div>
        </div>

        {/* 멤버 목록 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
          {isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
              <Loader2 size={20} color="#475569" style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: '#334155', fontSize: 12 }}>검색 결과 없음</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {filtered.map(m => {
                const isAdded = reportLines.some(l => l.id === m.id);
                const isMyTeam = currentUser && m.team === currentUser.team;
                const isMyHonbu = currentUser && m.honbu === currentUser.honbu && m.team !== currentUser.team;
                return (
                  <div
                    key={m.id}
                    onClick={() => !isAdded && addMember(m)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '9px 10px', borderRadius: 12, cursor: isAdded ? 'default' : 'pointer',
                      background: isAdded ? 'rgba(168,85,247,0.08)' : 'rgba(255,255,255,0.03)',
                      border: isAdded ? '1px solid rgba(168,85,247,0.25)' : '1px solid rgba(255,255,255,0.06)',
                      opacity: isAdded ? 0.6 : 1, transition: 'all 0.15s',
                    }}
                  >
                    {/* 아바타 */}
                    <div style={{
                      width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                      background: isAdded ? 'rgba(168,85,247,0.2)' : 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 900,
                      color: isAdded ? '#a855f7' : '#64748b',
                    }}>
                      {m.name?.[0]}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
                        {m.name}
                        {isMyTeam && !searchTerm && (
                          <span style={{ fontSize: 8, background: 'rgba(168,85,247,0.2)', color: '#c084fc', borderRadius: 4, padding: '1px 4px', flexShrink: 0 }}>내팀</span>
                        )}
                        {isMyHonbu && !searchTerm && (
                          <span style={{ fontSize: 8, background: 'rgba(59,130,246,0.1)', color: '#93c5fd', borderRadius: 4, padding: '1px 4px', flexShrink: 0 }}>본부</span>
                        )}
                      </div>
                      <div style={{ fontSize: 10, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.team || m.honbu}
                      </div>
                    </div>

                    <div style={{
                      width: 22, height: 22, borderRadius: 7, flexShrink: 0,
                      background: isAdded ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.05)',
                      border: isAdded ? '1px solid rgba(168,85,247,0.3)' : '1px solid rgba(255,255,255,0.07)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {isAdded
                        ? <span style={{ fontSize: 10, color: '#a855f7', fontWeight: 900 }}>✓</span>
                        : <Plus size={11} color="#64748b" />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(168,85,247,0.2); border-radius: 99px; }
      `}</style>
    </div>
  );
}
