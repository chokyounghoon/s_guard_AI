import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useBackNavigation } from '../hooks/useBackNavigation';
import {
  ArrowLeft, Search, User, Shield, RefreshCw,
  Trash2, Mail, Phone, Building2,
  ChevronRight, Key, MoreHorizontal, MoreVertical, UserCheck, UserX,
  LayoutDashboard, List as ListIcon, X, Star, Edit3, CheckCircle2, Hash, Activity, Eye
} from 'lucide-react';
import { getAccessToken, getUserProfile, getAuthHeaders } from '../lib/authStore';
import { SMS_WORKER_URL } from '../config/api';
import { maskName, maskEmail, maskPhone } from '../utils/maskingUtils';

export default function UserManagementPage() {
  const navigate = useNavigate();
  const goBack = useBackNavigation('/dashboard');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [roles, setRoles] = useState([]);
  
  // My Profile State
  const [myProfile, setMyProfile] = useState(null);
  const [myProfileLoading, setMyProfileLoading] = useState(true);

  // Organization Edit State
  const [orgTree, setOrgTree] = useState([]);
  const [isOrgModalOpen, setIsOrgModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [tempUserDetail, setTempUserDetail] = useState({ 
    org1: '', org2: '', org3: '', org4: '', org5: '',
    email: '', phone: '', os_type: 'android'
  });
  
  // New User Registration State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '', employee_id: '', email: '', phone: '', os_type: 'android', role: 'viewer', password: '',
    org1: '', org2: '', org3: '', org4: '', org5: ''
  });
  
  // Action Bottom Sheet State
  const [actionTargetUser, setActionTargetUser] = useState(null);

  const API_BASE = 'https://sguardai.khcho0421.workers.dev';

  // 🔑 내 프로필 불러오기 (authStore → API 순서로 조회)
  const fetchMyProfile = async () => {
    setMyProfileLoading(true);
    try {
      const token = getAccessToken();
      const stored = getUserProfile();
      
      // authStore에서 먼저 읽기
      if (stored?.employee_id) {
        setMyProfile(stored);
      }
      
      // API로 최신 정보 가져오기
      if (stored?.employee_id && token) {
        const res = await fetch(`${API_BASE}/users/${stored.employee_id}`, {
        headers: getAuthHeaders()
      });
        if (res.ok) {
          const data = await res.json();
          setMyProfile(data.user || data);
        }
      }
    } catch (e) {
      console.error('[MyProfile] Fetch failed:', e);
    } finally {
      setMyProfileLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const res = await fetch(`${API_BASE}/rbac/roles`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setRoles(data.roles || []);
      }
    } catch (e) { console.error('[Roles] Fetch failed:', e); }
  };

  const fetchUsers = () => {
    setLoading(true);
    fetch(`${API_BASE}/users`, {
      headers: getAuthHeaders()
    })
      .then(r => {
        if (!r.ok) throw new Error('데이터를 불러오지 못했습니다.');
        return r.json();
      })
      .then(data => setUsers(Array.isArray(data) ? data : []))
      .catch(err => {
        console.error(err);
        setUsers([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchMyProfile();
    fetchUsers();
    fetchRoles();
    fetch(`${API_BASE}/org/tree`, {
      headers: getAuthHeaders()
    })
      .then(r => {
        if (!r.ok) throw new Error('조직도 데이터를 불러오지 못했습니다.');
        return r.json();
      })
      .then(data => setOrgTree(data || []))
      .catch(console.error);
  }, []);

  const handleResetPassword = async (userId) => {
    const newPass = prompt('초기화할 비밀번호를 입력하세요:');
    if (!newPass) return;

    try {
      const res = await fetch(`${API_BASE}/users/${userId}/reset-password`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ new_password: newPass })
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        alert(`비밀번호 초기화 실패: ${error.detail || '서버 오류'}`);
      } else {
        alert('비밀번호가 초기화되었습니다.');
        setActionTargetUser(null);
      }
    } catch (e) {
      console.error(e);
      alert('비밀번호 초기화 중 오류가 발생했습니다.');
    }
  };

  const handleToggleStatus = async (user) => {
    // 🛡️ 상태 머신 연동: ACTIVE ↔ SUSPENDED 전환
    const nextStatus = user.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
    const confirmMsg = nextStatus === 'SUSPENDED' 
      ? `[보안경고] ${user.name}님의 계정을 차단(SUSPENDED)하시겠습니까?\n차단 즉시 모든 시스템 접근이 거부됩니다.`
      : `${user.name}님의 계정을 다시 활성화(ACTIVE)하시겠습니까?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await fetch(`${API_BASE}/users/${user.employee_id}/status`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ status: nextStatus })
      });
      if (res.ok) {
        alert(`${nextStatus === 'SUSPENDED' ? '차단' : '활성화'} 처리가 완료되었습니다.`);
        setActionTargetUser(null);
        fetchUsers();
      } else {
        const error = await res.json().catch(() => ({}));
        alert(`상태 변경 실패: ${error.detail || '서버 오류'}`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateRole = async (userId, newRole) => {
    try {
      const res = await fetch(`${API_BASE}/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ role: newRole })
      });
      if (res.ok) {
        alert(`권한이 ${newRole.toUpperCase()}(으)로 변경되었습니다.`);
        setActionTargetUser(null);
        fetchUsers();
      } else {
        const error = await res.json().catch(() => ({}));
        alert(`권한 변경 실패: ${error.detail || '서버 오류'}`);
      }
    } catch (e) { console.error(e); }
  };

  // Depth-aware node finder (synced depth tracking)
  const findNodeInTree = (nodes, target, targetDepth = null, currentDepth = 1) => {
    if (!target || !nodes || nodes.length === 0) return null;
    const norm = String(target).trim().toLowerCase();
    
    // 1st Priority: Match at current level (Code or Name)
    for (const node of nodes) {
      const match = (node.code && String(node.code).trim().toLowerCase() === norm) || 
                    (String(node.name).trim().toLowerCase() === norm);
      
      if (match) {
        if (targetDepth === null || currentDepth === targetDepth) return node;
      }
    }
    
    // 2nd Priority: Recurse into children
    for (const node of nodes) {
      if (node.children?.length) {
        const found = findNodeInTree(node.children, target, targetDepth, currentDepth + 1);
        if (found) return found;
      }
    }
    return null;
  };

  // Finds a node and its full ancestral path
  const findNodeAndPath = (nodes, target, targetDepth = null, currentPath = []) => {
    if (!target || !nodes || nodes.length === 0) return null;
    const norm = String(target).trim().toLowerCase();
    
    for (const node of nodes) {
      const codePath = [...currentPath, node.code || node.name];
      const match = (node.code && String(node.code).trim().toLowerCase() === norm) || 
                    (String(node.name).trim().toLowerCase() === norm);
      
      // If we found the target (optionally checking depth)
      if (match && (targetDepth === null || currentPath.length + 1 === targetDepth)) {
        return { node, path: codePath };
      }
      
      // Search in children
      if (node.children?.length) {
        const found = findNodeAndPath(node.children, target, targetDepth, codePath);
        if (found) return found;
      }
    }
    return null;
  };

  const handleOpenOrgModal = (user) => {
    setEditingUser(user);
    
    // Direct 1:1 Pre-population (Matches the User Database Schema)
    setTempUserDetail({
      org1: user.company_code || user.company || '',
      org2: user.honbu_code || user.honbu || '',
      org3: user.team_code || user.team || '',
      org4: user.part_code || user.part || '',
      org5: user.subpart_code || user.subpart || '',
      email: user.email || '',
      phone: user.phone || '',
      os_type: user.os_type || 'android'
    });
    setIsOrgModalOpen(true);
  };

  const handleSaveOrg = async () => {
    if (!editingUser) return;
    
    // Map UI dropdowns exactly back to the database fields
    const payload = {
      company: tempUserDetail.org1 || null,
      honbu:   tempUserDetail.org2 || null,
      team:    tempUserDetail.org3 || null,
      part:    tempUserDetail.org4 || null,
      subpart: tempUserDetail.org5 || null,
      email:   tempUserDetail.email || null,
      phone:   tempUserDetail.phone || null,
      os_type: tempUserDetail.os_type || null
    };

    try {
      const res = await fetch(`${API_BASE}/users/${editingUser.employee_id}/org`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setIsOrgModalOpen(false);
        fetchUsers();
        alert('소속 정보가 성공적으로 변경되었습니다.');
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`소속 변경 실패: ${err.detail || '서버 오류가 발생했습니다.'}`);
      }
    } catch (e) {
      console.error(e);
      alert('오류가 발생했습니다.');
    }
  };

  const handleCreateUser = async () => {
    if (!newUser.name || !newUser.employee_id || !newUser.email) {
      alert('이름, 사번, 이메일은 필수 입력 항목입니다.');
      return;
    }

    const payload = {
      name: newUser.name,
      employee_id: newUser.employee_id,
      email: newUser.email,
      phone: newUser.phone,
      os_type: newUser.os_type,
      role: newUser.role,
      password: newUser.password || null,
      company: newUser.org1 || null,
      honbu: newUser.org2 || null,
      team: newUser.org3 || null,
      part: newUser.org4 || null,
      subpart: newUser.org5 || null
    };

    try {
      const token = getAccessToken();
      const res = await fetch(`${API_BASE}/admin/users`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setIsAddModalOpen(false);
        setNewUser({
          name: '', employee_id: '', email: '', phone: '', os_type: 'android', role: 'viewer', password: '',
          org1: '', org2: '', org3: '', org4: '', org5: ''
        });
        fetchUsers();
        alert('사용자가 등록되었습니다.');
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`등록 실패: ${err.detail || '서버 오류가 발생했습니다.'}`);
      }
    } catch (e) {
      console.error(e);
      alert('오류가 발생했습니다.');
    }
  };

  const handleDeleteUser = async (user) => {
    if (user.employee_id === 'admin') {
      alert('기본 관리자 계정은 삭제할 수 없습니다.');
      return;
    }

    if (!window.confirm(`[영구 삭제 경고] ${user.name}님의 모든 계정 정보가 시스템에서 영구적으로 삭제됩니다.\n정말로 삭제하시겠습니까?`)) {
      return;
    }

    try {
      const token = getAccessToken();
      const res = await fetch(`${API_BASE}/users/${user.employee_id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        fetchUsers();
        alert('사용자가 삭제되었습니다.');
        setActionTargetUser(null);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`삭제 실패: ${err.detail || '서버 오류가 발생했습니다.'}`);
      }
    } catch (e) {
      console.error(e);
      alert('오류가 발생했습니다.');
    }
  };

  // Depth-independent node filtering for cascading dropdowns
  const getSubNodes = (childDepth, parentCode) => {
    if (childDepth === 1) return orgTree;
    if (!parentCode) return [];
    // Find the parent node anywhere in the tree and return its children
    const parentNode = findNodeInTree(orgTree, parentCode);
    return parentNode ? (parentNode.children || []) : [];
  };

  const filteredUsers = users.filter(u =>
    (u.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.employee_id && u.employee_id.includes(search))
  );

  const activeCount    = users.filter(u => u.status === 'ACTIVE').length;
  const suspendCount   = users.filter(u => u.status === 'SUSPENDED').length;
  const pendingCount   = users.filter(u => u.status === 'PRE_REGISTERED').length;

  return (
    <div className="min-h-screen bg-[#08091200] text-white font-sans pb-24 relative overflow-x-hidden" style={{ background: 'linear-gradient(160deg, #05080f 0%, #090c1a 60%, #05080f 100%)' }} translate="no">
      <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-indigo-600/8 blur-[140px] rounded-full -z-10 pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-[400px] h-[400px] bg-violet-600/8 blur-[120px] rounded-full -z-10 pointer-events-none" />

      {/* ── 헤더 ── */}
      <header className="sticky top-0 z-50 backdrop-blur-2xl border-b" style={{ background: 'rgba(5,8,15,0.94)', borderColor: 'rgba(129,140,248,0.1)' }}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">

          {/* 좌측: 뒤로 + 타이틀 */}
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => goBack()} style={{ width:36, height:36, borderRadius:10, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
              <ArrowLeft className="w-4 h-4 text-slate-400" />
            </button>
            <div className="min-w-0 flex flex-col justify-center">
              <h1 className="text-base font-black tracking-tight truncate whitespace-nowrap" style={{ background:'linear-gradient(90deg,#f1f5f9,#818cf8)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>계정 관리</h1>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] truncate whitespace-nowrap" style={{ color:'rgba(129,140,248,0.55)' }}>Account Management</p>
            </div>
          </div>

          {/* 우측: 뷰 전환 + 등록 + 새로고침 */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div style={{ display:'flex', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:10, padding:3, gap:2 }}>
              <button onClick={() => setViewMode('grid')} style={{ padding:'6px 8px', borderRadius:8, background: viewMode==='grid' ? 'rgba(129,140,248,0.15)' : 'transparent', border: viewMode==='grid' ? '1px solid rgba(129,140,248,0.3)' : '1px solid transparent', cursor:'pointer', display:'flex', alignItems:'center' }}>
                <LayoutDashboard className="w-3.5 h-3.5" style={{ color: viewMode==='grid' ? '#818cf8' : '#475569' }} />
              </button>
              <button onClick={() => setViewMode('list')} style={{ padding:'6px 8px', borderRadius:8, background: viewMode==='list' ? 'rgba(129,140,248,0.15)' : 'transparent', border: viewMode==='list' ? '1px solid rgba(129,140,248,0.3)' : '1px solid transparent', cursor:'pointer', display:'flex', alignItems:'center' }}>
                <ListIcon className="w-3.5 h-3.5" style={{ color: viewMode==='list' ? '#818cf8' : '#475569' }} />
              </button>
            </div>
            <button onClick={() => setIsAddModalOpen(true)} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:10, background:'linear-gradient(135deg,#4f46e5,#818cf8)', border:'none', color:'#fff', fontSize:13, fontWeight:800, cursor:'pointer', boxShadow:'0 4px 20px rgba(129,140,248,0.25)' }}>
              <UserCheck className="w-3.5 h-3.5" />
              <span>사용자 등록</span>
            </button>
            <button onClick={fetchUsers} style={{ width:36, height:36, borderRadius:10, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
              <RefreshCw className={`w-4 h-4 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* ── 통계 칩 행 ── */}
        <div className="max-w-7xl mx-auto px-4 pb-3 flex items-center gap-2">
          {[
            { label:'전체', value: users.length,    color:'#818cf8' },
            { label:'정상', value: activeCount,      color:'#10b981' },
            { label:'대기', value: pendingCount,     color:'#eab308' },
            { label:'차단', value: suspendCount,     color:'#f87171' },
          ].map(s => (
            <div key={s.label} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 12px', borderRadius:99, background:`${s.color}10`, border:`1px solid ${s.color}28` }}>
              <span style={{ fontSize:14, fontWeight:900, color:s.color, fontFamily:'monospace' }}>{s.value}</span>
              <span style={{ fontSize:11, fontWeight:700, color: s.color, opacity:0.7 }}>{s.label}</span>
            </div>
          ))}
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-5 pb-36 space-y-8">
        {/* 검색창 */}
        <section>
          <div className="relative group">
            <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
              <Search className="w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
            </div>
            <input
              type="text"
              placeholder="이름, 이메일, 사번으로 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl py-3.5 pl-12 pr-5 text-sm focus:outline-none transition-all"
              style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', color:'#e2e8f0' }}
            />
          </div>
        </section>

        {/* User List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
             <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-500 rounded-full animate-spin" />
             <p className="text-sm text-slate-500 animate-pulse">사용자 데이터를 불러오는 중...</p>
          </div>
        ) : (
          <div className={`${viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6' : 'flex flex-col gap-4'}`}>
            {filteredUsers.map((user) => (
              <div
                key={user.employee_id || user.id}
                onClick={() => handleOpenOrgModal(user)}
                className={`bg-[#1a1f2e] rounded-3xl border border-white/5 overflow-hidden group hover:border-blue-500/30 transition-all shadow-xl hover:shadow-2xl relative cursor-pointer p-5 sm:p-6 flex ${viewMode === 'grid' ? 'flex-col items-center text-center' : 'items-start gap-4 sm:gap-6'}`}
              >
                {!user.is_active && <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] z-10 pointer-events-none" />}

                {/* Avatar / Icon - 그리드 모드에서만 표시 */}
                {viewMode === 'grid' && (
                  <div className="shrink-0 relative w-16 h-16 mb-4">
                    <div className="w-full h-full rounded-2xl flex items-center justify-center bg-gradient-to-br from-blue-600/20 to-purple-600/20 text-blue-400 border border-white/5 shadow-lg group-hover:scale-105 transition-all">
                      {user.profile_picture ? (
                        <img src={user.profile_picture} alt={user.name} className="w-full h-full rounded-2xl object-cover" />
                      ) : (
                        <User className="w-8 h-8" />
                      )}
                    </div>
                    {user.is_active && (
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-[3px] border-[#1a1f2e] shadow-lg animate-pulse" />
                    )}
                  </div>
                )}

                {/* Info Container */}
                {viewMode === 'list' ? (
                  <div className="flex-1 min-w-0 flex flex-col justify-center py-1">
                    {/* 1줄 */}
                    <div className="flex items-center gap-2 pr-10 mb-1.5">
                      <span className="text-base font-bold text-white flex items-center gap-1.5">
                        <span className="text-slate-500">[</span>
                        <span className="text-sm">{user.status === 'ACTIVE' ? '🟢' : user.status === 'PRE_REGISTERED' ? '🟡' : '🔴'}</span>
                        <span className="group-hover:text-blue-400 transition-colors tracking-tight">{maskName(user.name)}</span>
                        <span className="text-slate-500">]</span>
                      </span>
                      <span className="text-[12px] font-bold text-indigo-400 uppercase tracking-wider ml-1">{user.role || 'USER'}</span>
                      <span className="text-[12px] font-mono text-slate-400 ml-1 tracking-tight">ID: {user.employee_id}</span>
                    </div>
                    {/* 2줄 */}
                    <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap truncate">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="text-sm">🏢</span>
                        <span className="font-bold text-slate-300 whitespace-nowrap">{user.company_name || user.company || '신한DS'}</span>
                        {(user.honbu_name || user.team_name || user.part_name || user.subpart_name) && (
                          <>
                            <span className="text-slate-600 mx-0.5">·</span>
                            <span className="truncate">{[user.honbu_name, user.team_name, user.part_name, user.subpart_name].filter(Boolean).join(' > ')}</span>
                          </>
                        )}
                      </span>
                      <span className="text-slate-600 shrink-0">|</span>
                      <span className="flex items-center gap-1.5 shrink-0">
                        <span className="text-sm">📱</span>
                        <span className="uppercase text-slate-300 font-bold tracking-tight">{user.os_type || 'ANDROID'}</span>
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 min-w-0 space-y-2.5 w-full">
                    {/* 1줄: 이름 + 상태배지 + OS기종배지 */}
                    <div className="flex items-center gap-2 flex-wrap justify-center">
                      <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-blue-400 transition-colors truncate">
                        {maskName(user.name)}
                      </h3>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${user.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : user.status === 'PRE_REGISTERED' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
                        {user.status === 'ACTIVE' ? '정상 🟢' : user.status === 'PRE_REGISTERED' ? '가입대기 🟡' : '사용중지 🔴'}
                      </span>
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md border ${user.os_type === 'ios' ? 'bg-slate-500/10 border-slate-500/20 text-slate-400' : 'bg-green-500/10 border-green-500/20 text-green-400'}`}>
                        {user.os_type?.toUpperCase() || 'AND'}
                      </span>
                    </div>

                    {/* 2줄: 권한 및 사번 */}
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 flex-wrap justify-center">
                      <span className="flex items-center gap-1.5 text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                        <Shield className="w-3.5 h-3.5" />
                        <span>{user.role?.toUpperCase() || 'USER'}</span>
                      </span>
                      <span className="text-slate-500">|</span>
                      <span className="font-mono text-slate-400">ID: #{user.employee_id}</span>
                    </div>

                    {/* 3줄: 이메일 & 전화번호 */}
                    <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap justify-center">
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="truncate max-w-[180px] sm:max-w-none">{maskEmail(user.email)}</span>
                      </div>
                      {user.phone && (
                        <>
                          <span className="text-slate-600 hidden sm:inline">•</span>
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span>{maskPhone(user.phone)}</span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* 4줄: 소속 정보 칩 */}
                    {(user.company_name || user.company || user.honbu_name || user.team_name || user.part_name || user.subpart_name) && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-white/5 px-3 py-1.5 rounded-xl border border-white/5 mt-1 max-w-full overflow-hidden justify-center">
                        <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <div className="truncate flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-300">{user.company_name || user.company || '신한DS'}</span>
                          {[user.honbu_name, user.team_name, user.part_name, user.subpart_name].filter(Boolean).map((n, idx) => (
                            <React.Fragment key={idx}>
                              <span className="text-slate-600 font-normal">&gt;</span>
                              <span className="text-slate-400">{n}</span>
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── 우측 상단 케밥 버튼 (액션 메뉴 호출) ── */}
                <button
                  onClick={(e) => { e.stopPropagation(); setActionTargetUser(user); }}
                  className="absolute top-4 right-4 w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 text-slate-400 hover:text-white transition-all z-20 shadow-lg active:scale-95"
                  title="액션 및 관리 메뉴"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {filteredUsers.length === 0 && !loading && (
          <div className="text-center py-36 space-y-6 bg-[#1a1f2e]/30 rounded-[40px] border border-dashed border-white/5">
             <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-10 h-10 text-slate-700" />
             </div>
             <div>
                <p className="text-xl font-bold text-slate-400">일치하는 사용자가 없습니다.</p>
                <p className="text-sm text-slate-600 mt-2">검색어를 다시 확인해 주세요.</p>
             </div>
             <button onClick={() => setSearch('')} className="text-blue-400 text-sm font-bold hover:underline">검색어 초기화</button>
          </div>
        )}

        {/* ── 사용자 액션 관리 바텀 시트 / 모달 ── */}
        {actionTargetUser && createPortal(
          <div className="fixed inset-0 z-[400] flex items-end sm:items-center justify-center p-0 sm:p-6 animate-in fade-in duration-200">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setActionTargetUser(null)} />
            <div className="relative w-full max-w-md bg-[#11141d] border-t sm:border border-white/10 sm:rounded-[32px] rounded-t-[32px] p-6 sm:p-8 shadow-2xl space-y-6 animate-in slide-in-from-bottom duration-300 max-h-[85vh] overflow-y-auto custom-scrollbar">
              <div className="w-12 h-1 bg-white/10 rounded-full mx-auto sm:hidden mb-2" />
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600/20 to-purple-600/20 flex items-center justify-center text-blue-400 font-bold border border-white/5 shadow-md">
                    {actionTargetUser.profile_picture ? (
                      <img src={actionTargetUser.profile_picture} alt={actionTargetUser.name} className="w-full h-full rounded-2xl object-cover" />
                    ) : (
                      <User className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{maskName(actionTargetUser.name)}</h3>
                    <p className="text-xs font-mono text-slate-500">ID: #{actionTargetUser.employee_id}</p>
                  </div>
                </div>
                <button onClick={() => setActionTargetUser(null)} className="p-2 rounded-full hover:bg-white/5 text-slate-500 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-blue-400 uppercase tracking-widest block mb-2 px-1">권한 변경</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(roles.length > 0 ? roles : [{role_code:'admin', role_name:'ADMIN'}, {role_code:'analyst', role_name:'ANALYST'}, {role_code:'viewer', role_name:'VIEWER'}]).map(r => (
                      <button
                        key={r.role_code}
                        onClick={() => handleUpdateRole(actionTargetUser.employee_id, r.role_code.toLowerCase())}
                        className={`py-3 rounded-2xl border text-xs font-black transition-all flex flex-col items-center gap-1 ${
                          String(actionTargetUser.role).toLowerCase() === String(r.role_code).toLowerCase()
                            ? 'bg-blue-600/20 border-blue-500 text-blue-400 shadow-lg shadow-blue-500/10'
                            : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <Shield className="w-4 h-4" />
                        <span>{r.role_name || r.role_code}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border-t border-white/5 pt-4 space-y-2.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1 px-1">계정 보안 및 상태 관리</label>
                  <button
                    onClick={() => handleResetPassword(actionTargetUser.employee_id)}
                    className="w-full py-3.5 px-4 rounded-2xl bg-white/5 border border-white/5 hover:border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 transition-all font-bold text-sm flex items-center justify-between group shadow-md"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-yellow-500/10 text-yellow-400 group-hover:scale-110 transition-transform">
                        <Key className="w-4 h-4" />
                      </div>
                      <span>비밀번호 초기화 (PW Reset)</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:translate-x-1 transition-transform" />
                  </button>

                  <button
                    onClick={() => handleToggleStatus(actionTargetUser)}
                    className={`w-full py-3.5 px-4 rounded-2xl border transition-all font-bold text-sm flex items-center justify-between group shadow-md ${
                      actionTargetUser.status === 'ACTIVE' || actionTargetUser.status === 'PRE_REGISTERED'
                        ? 'bg-red-500/5 border-red-500/10 hover:border-red-500/30 text-red-400 hover:bg-red-500/10'
                        : 'bg-emerald-500/5 border-emerald-500/10 hover:border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl group-hover:scale-110 transition-transform ${actionTargetUser.status === 'ACTIVE' || actionTargetUser.status === 'PRE_REGISTERED' ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                        {actionTargetUser.status === 'ACTIVE' || actionTargetUser.status === 'PRE_REGISTERED' ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                      </div>
                      <span>{actionTargetUser.status === 'ACTIVE' || actionTargetUser.status === 'PRE_REGISTERED' ? '계정 즉시 차단 (SUSPEND)' : '계정 차단 해제 (ACTIVE)'}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>

                <div className="border-t border-white/5 pt-4">
                  <button
                    onClick={() => handleDeleteUser(actionTargetUser)}
                    className="w-full py-3.5 px-4 rounded-2xl bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-all font-bold text-sm flex items-center justify-between group shadow-md"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-red-500/20 text-red-400 group-hover:scale-110 transition-transform">
                        <Trash2 className="w-4 h-4" />
                      </div>
                      <span>계정 영구 삭제 (Delete Account)</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-red-500/50 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>

              <button
                onClick={() => setActionTargetUser(null)}
                className="w-full py-4 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all font-bold border border-white/5"
              >
                닫기
              </button>
            </div>
          </div>,
          document.body
        )}
      </main>

      {/* Organization Selection Modal */}
      {isOrgModalOpen && createPortal(
        <div className="fixed inset-0 z-[350] flex items-center justify-center p-4 sm:p-6">
           <div className="absolute inset-0 bg-[#05070a]/80 backdrop-blur-md" onClick={() => setIsOrgModalOpen(false)} />
           <div className="relative w-full max-w-xl bg-[#11141d] border border-white/10 rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 my-auto max-h-[85vh] flex flex-col">
              <div className="h-2 shrink-0 bg-gradient-to-r from-blue-600 to-purple-600" />
              <div className="p-6 sm:p-8 overflow-y-auto custom-scrollbar flex-1 pb-12">
                 <div className="mb-8">
                    <h2 className="text-2xl font-bold text-white">사용자 정보 및 소속 변경</h2>
                    <p className="text-slate-500 text-sm mt-1">{editingUser?.name}님의 상세 정보와 소속 조직을 변경합니다.</p>
                 </div>

                 <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 mb-4">
                       <Input label="이메일" value={tempUserDetail.email} onChange={(v) => setTempUserDetail({...tempUserDetail, email: v})} />
                       <Input label="전화번호" value={tempUserDetail.phone} onChange={(v) => setTempUserDetail({...tempUserDetail, phone: v})} />
                    </div>
                    <div className="mb-6">
                       <label className="text-[10px] text-slate-500 font-bold ml-2 uppercase tracking-wider">휴대폰 기종 (Push 알림용)</label>
                       <div className="flex gap-2 mt-1.5">
                          {['android', 'ios'].map(os => (
                            <button
                              key={os}
                              onClick={() => setTempUserDetail({...tempUserDetail, os_type: os})}
                              className={`flex-1 py-3 rounded-xl border text-xs font-black transition-all ${
                                tempUserDetail.os_type === os 
                                  ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/30' 
                                  : 'bg-white/5 border-white/10 text-slate-500 hover:text-slate-300'
                              }`}
                            >
                              {os === 'android' ? 'Android' : 'iOS (iPhone)'}
                            </button>
                          ))}
                       </div>
                    </div>

                    <div className="border-t border-white/5 pt-6 space-y-4">
                       <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest px-1">조직 소속 설정</h3>
                       {/* Level 1: 전사/회사 */}
                       <Dropdown 
                         label="회사" 
                         value={tempUserDetail.org1} 
                         options={orgTree} 
                         onChange={(val) => setTempUserDetail({ ...tempUserDetail, org1: val, org2: '', org3: '', org4: '', org5: '' })}
                       />
                       {/* Level 2: 부문/실 */}
                       <Dropdown 
                         label="부문/실" 
                         value={tempUserDetail.org2} 
                         options={getSubNodes(2, tempUserDetail.org1)} 
                         disabled={!tempUserDetail.org1}
                         onChange={(val) => setTempUserDetail({...tempUserDetail, org2: val, org3: '', org4: '', org5: ''})}
                       />
                       {/* Level 3: 본부 */}
                       <Dropdown 
                         label="본부/부서" 
                         value={tempUserDetail.org3} 
                         options={getSubNodes(3, tempUserDetail.org2)} 
                         disabled={!tempUserDetail.org2}
                         onChange={(val) => setTempUserDetail({...tempUserDetail, org3: val, org4: '', org5: ''})}
                       />
                       {/* Level 4: 팀 */}
                       <Dropdown 
                         label="팀" 
                         value={tempUserDetail.org4} 
                         options={getSubNodes(4, tempUserDetail.org3)} 
                         disabled={!tempUserDetail.org3}
                         onChange={(val) => setTempUserDetail({...tempUserDetail, org4: val, org5: ''})}
                       />
                       {/* Level 5: 파트 */}
                       <Dropdown 
                         label="파트" 
                         value={tempUserDetail.org5} 
                         options={getSubNodes(5, tempUserDetail.org4)} 
                         disabled={!tempUserDetail.org4}
                         onChange={(val) => setTempUserDetail({...tempUserDetail, org5: val})}
                       />
                    </div>
                 </div>

                 <div className="mt-10 flex gap-3">
                    <button 
                      onClick={() => setIsOrgModalOpen(false)}
                      className="flex-1 py-4 rounded-2xl bg-white/5 text-slate-400 font-bold hover:bg-white/10 transition-all border border-white/5"
                    >
                      취소
                    </button>
                    <button 
                      onClick={handleSaveOrg}
                      className="flex-[2] py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold hover:from-blue-500 hover:to-blue-400 transition-all shadow-lg shadow-blue-600/20 active:scale-95"
                    >
                      변경 내용 저장
                    </button>
                 </div>
              </div>
           </div>
        </div>,
        document.body
      )}
 
      {/* User Registration Modal */}
      {isAddModalOpen && createPortal(
        <div className="fixed inset-0 z-[350] flex items-center justify-center p-4 sm:p-6">
           <div className="absolute inset-0 bg-[#05070a]/90 backdrop-blur-md" onClick={() => setIsAddModalOpen(false)} />
           <div className="relative w-full max-w-2xl bg-[#11141d] border border-white/10 rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 my-auto max-h-[85vh] flex flex-col">
              <div className="h-2 shrink-0 bg-gradient-to-r from-blue-600 via-blue-400 to-emerald-500" />
              <div className="p-6 sm:p-8 overflow-y-auto custom-scrollbar flex-1 pb-12">
                 <div className="mb-8 flex justify-between items-start">
                    <div>
                       <h2 className="text-3xl font-bold text-white tracking-tight">신규 사용자 등록</h2>
                       <p className="text-slate-500 text-sm mt-2">시스템 접근 권한을 가진 신규 사용자를 생성합니다.</p>
                    </div>
                    <button onClick={() => setIsAddModalOpen(false)} className="p-2 rounded-full hover:bg-white/5 text-slate-500"><X /></button>
                 </div>
 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-white/5">
                    <div className="space-y-4">
                       <h3 className="text-xs font-bold text-blue-400 uppercase tracking-[0.2em] mb-4">기본 정보</h3>
                       <Input label="이름" value={newUser.name} onChange={(v) => setNewUser({...newUser, name: v})} placeholder="홍길동" required />
                       <Input label="사번 (ID)" value={newUser.employee_id} onChange={(v) => setNewUser({...newUser, employee_id: v})} placeholder="240001" required />
                       <Input label="이메일" value={newUser.email} onChange={(v) => setNewUser({...newUser, email: v})} placeholder="gdhong@shinhan.com" required />
                       <Input label="전화번호" value={newUser.phone} onChange={(v) => setNewUser({...newUser, phone: v})} placeholder="010-1234-5678" />
                    </div>
                    <div className="space-y-4">
                       <h3 className="text-xs font-bold text-purple-400 uppercase tracking-[0.2em] mb-4">계정 및 권한</h3>
                       <div className="space-y-1.5">
                          <label className="text-[10px] text-slate-500 font-bold ml-2 uppercase">권한 설정</label>
                          <select 
                            value={newUser.role}
                            onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                            className="w-full bg-[#0a0e17] border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-slate-200"
                          >
                              {roles.length > 0 ? roles.map(r => (
                                <option key={r.role_code} value={r.role_code.toLowerCase()}>{r.role_name} ({r.role_code})</option>
                              )) : (
                                <>
                                  <option value="viewer">VIEWER (조회 전용)</option>
                                  <option value="analyst">ANALYST (분석가)</option>
                                  <option value="admin">ADMIN (관리자)</option>
                                </>
                              )}
                          </select>
                       </div>
                       <Input 
                         label="초기 비밀번호" 
                         type="password"
                         value={newUser.password} 
                         onChange={(v) => setNewUser({...newUser, password: v})} 
                         placeholder="미입력 시 가입대기 상태로 생성됨" 
                       />
                       <div className="space-y-1.5">
                          <label className="text-[10px] text-slate-500 font-bold ml-2 uppercase tracking-wider">휴대폰 기종</label>
                          <div className="flex gap-2">
                             {['android', 'ios'].map(os => (
                               <button
                                 key={os}
                                 onClick={() => setNewUser({...newUser, os_type: os})}
                                 className={`flex-1 py-3 rounded-2xl border text-xs font-black transition-all ${
                                   newUser.os_type === os 
                                     ? 'bg-blue-600 border-blue-500 text-white' 
                                     : 'bg-white/5 border-white/10 text-slate-500'
                                 }`}
                               >
                                 {os === 'android' ? 'Android' : 'iOS'}
                               </button>
                             ))}
                          </div>
                       </div>
                       <p className="text-[10px] text-slate-600 px-2 leading-relaxed">
                          * 비밀번호 미입력 시, 해당 사용자는 첫 로그인 시 '사번 인증 및 OTP' 절차를 거쳐 직접 비밀번호를 설정해야 합니다.
                       </p>
                    </div>
                 </div>
 
                 <div className="mt-8 space-y-6">
                    <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-[0.2em]">소속 정보 선택</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <Dropdown label="회사" value={newUser.org1} options={orgTree} onChange={(v) => setNewUser({...newUser, org1: v, org2: '', org3: '', org4: '', org5: ''})} />
                       <Dropdown label="부문/실" value={newUser.org2} options={getSubNodes(2, newUser.org1)} disabled={!newUser.org1} onChange={(v) => setNewUser({...newUser, org2: v, org3: '', org4: '', org5: ''})} />
                       <Dropdown label="본부" value={newUser.org3} options={getSubNodes(3, newUser.org2)} disabled={!newUser.org2} onChange={(v) => setNewUser({...newUser, org3: v, org4: '', org5: ''})} />
                       <Dropdown label="팀" value={newUser.org4} options={getSubNodes(4, newUser.org3)} disabled={!newUser.org3} onChange={(v) => setNewUser({...newUser, org4: v, org5: ''})} />
                       <Dropdown label="파트" value={newUser.org5} options={getSubNodes(5, newUser.org4)} disabled={!newUser.org4} onChange={(v) => setNewUser({...newUser, org5: v})} />
                    </div>
                 </div>
 
                 <div className="mt-12 flex gap-4">
                    <button 
                      onClick={() => setIsAddModalOpen(false)}
                      className="flex-1 py-4 rounded-2xl bg-white/5 text-slate-400 font-bold hover:bg-white/10 transition-all border border-white/5"
                    >
                      취소
                    </button>
                    <button 
                      onClick={handleCreateUser}
                      className="flex-[2] py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold hover:shadow-lg hover:shadow-blue-600/30 transition-all active:scale-95"
                    >
                      사용자 생성 완료
                    </button>
                  </div>
               </div>
            </div>
         </div>,
         document.body
      )}
    </div>
  );
}

// Internal Modal components
function Dropdown({ label, value, options, onChange, disabled }) {
  return (
    <div className="space-y-1.5">
       <label className="text-[10px] text-slate-500 font-bold ml-2 uppercase tracking-wider">{label}</label>
       <select 
         value={value}
         disabled={disabled || options.length === 0}
         onChange={(e) => onChange(e.target.value)}
         className="w-full bg-[#0a0e17] border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 appearance-none disabled:opacity-30 disabled:cursor-not-allowed transition-all"
       >
         <option value="">{options.length === 0 ? '해당 항목 없음' : `${label} 선택 안함`}</option>
         {options.map(opt => (
           <option key={opt.id} value={opt.code || opt.name}>
             {opt.name}
           </option>
         ))}
       </select>
    </div>
  );
}
 
function Input({ label, value, onChange, placeholder, type = 'text', required }) {
  return (
    <div className="space-y-1.5">
       <label className="text-[10px] text-slate-500 font-bold ml-2 uppercase">
          {label} {required && <span className="text-red-500">*</span>}
       </label>
       <input
         type={type}
         value={value}
         onChange={(e) => onChange(e.target.value)}
         placeholder={placeholder}
         className="w-full bg-[#0a0e17] border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
       />
    </div>
  );
}
