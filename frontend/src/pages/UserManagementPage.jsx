import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Search, User, Shield, RefreshCw,
  Trash2, Mail, Phone, Building2,
  ChevronRight, Key, MoreHorizontal, UserCheck, UserX,
  LayoutGrid, List as ListIcon
} from 'lucide-react';

export default function UserManagementPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'

  const API_BASE = 'https://sguardai.khcho0421.workers.dev';

  const fetchUsers = () => {
    setLoading(true);
    fetch(`${API_BASE}/users`)
      .then(r => r.json())
      .then(data => setUsers(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleResetPassword = async (userId) => {
    const newPass = prompt('초기화할 비밀번호를 입력하세요:');
    if (!newPass) return;

    try {
      const res = await fetch(`${API_BASE}/users/${userId}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_password: newPass })
      });
      if (res.ok) {
        alert('비밀번호가 초기화되었습니다.');
      } else {
        const error = await res.json();
        alert(`실패: ${error.detail}`);
      }
    } catch (e) {
      console.error(e);
      alert('오류가 발생했습니다.');
    }
  };

  const handleToggleStatus = async (userId) => {
    try {
      const res = await fetch(`${API_BASE}/users/${userId}/status`, { method: 'PATCH' });
      if (res.ok) fetchUsers();
    } catch (e) { console.error(e); }
  };

  const handleUpdateRole = async (userId, newRole) => {
    try {
      const res = await fetch(`${API_BASE}/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      });
      if (res.ok) fetchUsers();
    } catch (e) { console.error(e); }
  };

  const filteredUsers = users.filter(u =>
    (u.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.employee_id && u.employee_id.includes(search))
  );

  return (
    <div className="min-h-screen bg-[#0a0e17] text-white font-sans pb-24 relative overflow-x-hidden">
      {/* Background Decor */}
      <div className="fixed top-0 left-1/4 w-[500px] h-[500px] bg-blue-600/10 blur-[120px] rounded-full -z-10 animate-pulse" />
      <div className="fixed bottom-0 right-1/4 w-[400px] h-[400px] bg-purple-600/10 blur-[100px] rounded-full -z-10" />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0f111a]/80 backdrop-blur-xl border-b border-white/5 p-5">
        <div className="flex items-center justify-between max-w-7xl mx-auto w-full">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 transition-all border border-white/5 shadow-lg active:scale-95"
            >
              <ArrowLeft className="w-5 h-5 text-slate-400" />
            </button>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">사용자 계정 관리</h1>
              <p className="text-[10px] text-slate-500 font-mono tracking-[0.2em] uppercase mt-0.5">User Identity Management Service</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
             <div className="bg-[#11141d] p-1 rounded-xl border border-white/5 flex">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-slate-500 hover:text-white'}`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-slate-500 hover:text-white'}`}
                >
                  <ListIcon className="w-4 h-4" />
                </button>
             </div>
             <button
               onClick={fetchUsers}
               className="p-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all text-slate-400"
             >
                <RefreshCw className="w-5 h-5" />
             </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-5 space-y-8">
        {/* Search and Stats */}
        <section className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1 group">
            <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
              <Search className="w-5 h-5 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
            </div>
            <input
              type="text"
              placeholder="이름, 이메일, 사번으로 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#1a1f2e] border border-white/5 rounded-[24px] py-4 pl-14 pr-6 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/40 transition-all shadow-2xl"
            />
          </div>
          <div className="bg-[#1a1f2e] border border-white/5 rounded-3xl px-6 py-4 flex items-center gap-4 shadow-xl shrink-0">
             <div className="bg-blue-600/20 p-2.5 rounded-xl">
                <User className="w-5 h-5 text-blue-400" />
             </div>
             <div>
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">전체 사용자</p>
                <p className="text-xl font-bold font-mono tracking-tighter">{users.length}</p>
             </div>
          </div>
        </section>

        {/* User List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
             <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-500 rounded-full animate-spin" />
             <p className="text-sm text-slate-500 animate-pulse">사용자 데이터를 불러오는 중...</p>
          </div>
        ) : (
          <div className={`${viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6' : 'flex flex-col gap-3'}`}>
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                className={`bg-[#1a1f2e] rounded-3xl border border-white/5 overflow-hidden group hover:border-white/10 transition-all shadow-xl hover:shadow-2xl relative
                  ${viewMode === 'list' ? 'flex items-center p-4 gap-6' : 'p-6 flex flex-col items-center text-center'}`}
              >
                {!user.is_active && <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] z-10 pointer-events-none" />}

                {/* Avatar / Icon */}
                <div className={`shrink-0 relative ${viewMode === 'list' ? 'w-12 h-12' : 'w-16 h-16 mb-4'}`}>
                  <div className={`w-full h-full rounded-2xl flex items-center justify-center transition-all group-hover:scale-110 shadow-lg ${user.is_active ? 'bg-gradient-to-br from-blue-600/20 to-purple-600/20 text-blue-400' : 'bg-slate-800 text-slate-500'}`}>
                    <User className={viewMode === 'list' ? 'w-6 h-6' : 'w-8 h-8'} />
                  </div>
                  {user.is_active && (
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-4 border-[#1a1f2e] flex items-center justify-center shadow-lg">
                      <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                    </div>
                  )}
                </div>

                {/* Info Container */}
                <div className={`${viewMode === 'grid' ? 'w-full' : 'flex-1 grid grid-cols-4 items-center gap-4'}`}>
                  <div className={viewMode === 'list' ? 'col-span-1' : 'mb-6'}>
                    <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors truncate">{user.name}</h3>
                    <div className={`flex items-center gap-2 mt-1 ${viewMode === 'grid' ? 'justify-center' : ''}`}>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${user.role === 'admin' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                         {user.role?.toUpperCase() || 'USER'}
                      </span>
                      {user.employee_id && <span className="text-[10px] text-slate-500 font-mono">#{user.employee_id}</span>}
                    </div>
                  </div>

                  <div className={`${viewMode === 'grid' ? 'space-y-3 mb-8' : 'col-span-1 space-y-1'}`}>
                    <div className={`flex items-center gap-3 text-slate-400 group/item ${viewMode === 'grid' ? 'justify-center' : ''}`}>
                       <Mail className="w-4 h-4 text-slate-600 group-hover/item:text-blue-400 transition-colors" />
                       <span className="text-xs truncate">{user.email}</span>
                    </div>
                    {user.phone && (
                      <div className={`flex items-center gap-3 text-slate-400 group/item ${viewMode === 'grid' ? 'justify-center' : ''}`}>
                         <Phone className="w-4 h-4 text-slate-600 group-hover/item:text-blue-400 transition-colors" />
                         <span className="text-xs">{user.phone}</span>
                      </div>
                    )}
                    {(user.company || user.team) && (
                       <div className={`flex items-center gap-3 text-slate-400 group/item ${viewMode === 'grid' ? 'justify-center' : ''}`}>
                          <Building2 className="w-4 h-4 text-slate-600 group-hover/item:text-blue-400 transition-colors" />
                          <span className="text-xs truncate">{user.company} {user.team ? `/ ${user.team}` : ''}</span>
                       </div>
                    )}
                  </div>

                  {/* Actions Area */}
                  <div className={`${viewMode === 'grid' ? 'grid grid-cols-1 gap-2 p-1 relative z-20' : 'col-span-2 flex justify-end gap-2 p-1 relative z-20'}`}>
                    <div className="flex gap-2">
                       <div className="relative group/role flex-1">
                          <button className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 border border-white/5 hover:border-blue-500/30 text-[11px] font-bold transition-all">
                             <Shield className="w-3.5 h-3.5" /> 권한
                          </button>
                          <div className="absolute bottom-full left-0 w-full mb-2 bg-[#1a1f2e] border border-white/10 rounded-2xl overflow-hidden shadow-2xl opacity-0 translate-y-2 group-hover/role:opacity-100 group-hover/role:translate-y-0 transition-all pointer-events-none group-hover/role:pointer-events-auto">
                             {['admin', 'analyst', 'viewer'].map(role => (
                               <button
                                 key={role}
                                 onClick={() => handleUpdateRole(user.id, role)}
                                 className={`w-full text-left px-5 py-3 text-xs hover:bg-blue-600/10 transition-colors ${user.role === role ? 'text-blue-400 font-bold' : 'text-slate-400'}`}
                               >
                                 {role.toUpperCase()}
                               </button>
                             ))}
                          </div>
                       </div>
                       <button
                         onClick={() => handleResetPassword(user.id)}
                         className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 border border-white/5 hover:border-yellow-500/30 text-[11px] font-bold transition-all"
                       >
                         <Key className="w-3.5 h-3.5" /> PW 초기화
                       </button>
                    </div>
                    <button
                      onClick={() => handleToggleStatus(user.id)}
                      className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all text-[11px] font-bold border ${user.is_active ? 'bg-red-500/5 border-red-500/10 hover:border-red-500/30 text-red-500' : 'bg-green-500/5 border-green-500/10 hover:border-green-500/30 text-green-500'}`}
                    >
                      {user.is_active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                      {user.is_active ? '계정 비활성화' : '계정 활성화'}
                    </button>
                  </div>
                </div>
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
      </main>
    </div>
  );
}
