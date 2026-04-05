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
  
  // Organization Edit State
  const [orgTree, setOrgTree] = useState([]);
  const [isOrgModalOpen, setIsOrgModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [tempOrgs, setTempOrgs] = useState({ org1: '', org2: '', org3: '', org4: '', org5: '' });

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
    fetch(`${API_BASE}/org/tree`)
      .then(r => r.json())
      .then(data => setOrgTree(data))
      .catch(console.error);
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
      if (!res.ok) {
        const error = await res.json();
        console.error(`실패: ${error.detail}`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleStatus = async (user) => {
    try {
      const res = await fetch(`${API_BASE}/users/${user.employee_id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: user.is_active ? 0 : 1 })
      });
      if (res.ok) {
        fetchUsers();
      } else {
        console.error('상태 변경 처리에 실패했습니다.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateRole = async (userId, newRole) => {
    try {
      const res = await fetch(`${API_BASE}/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      });
      if (res.ok) {
        fetchUsers();
      } else {
        console.error('권한 변경에 실패했습니다.');
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
    setTempOrgs({
      org1: user.company_code || user.company || '',
      org2: user.honbu_code || user.honbu || '',
      org3: user.team_code || user.team || '',
      org4: user.part_code || user.part || '',
      org5: user.subpart_code || user.subpart || ''
    });
    setIsOrgModalOpen(true);
  };

  const handleSaveOrg = async () => {
    if (!editingUser) return;
    
    // Map UI dropdowns (org1-5) exactly back to the database fields
    const payload = {
      company: tempOrgs.org1 || null,
      honbu:   tempOrgs.org2 || null,
      team:    tempOrgs.org3 || null,
      part:    tempOrgs.org4 || null,
      subpart: tempOrgs.org5 || null
    };

    try {
      const res = await fetch(`${API_BASE}/users/${editingUser.employee_id}/org`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setIsOrgModalOpen(false);
        fetchUsers();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`소속 변경 실패: ${err.detail || '서버 오류가 발생했습니다.'}`);
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

  return (
    <div className="min-h-screen bg-[#0a0e17] text-white font-sans pb-24 relative overflow-x-hidden" translate="no">
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
              <span><ArrowLeft className="w-5 h-5 text-slate-400" /></span>
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
                  <span><LayoutGrid className="w-4 h-4" /></span>
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-slate-500 hover:text-white'}`}
                >
                  <span><ListIcon className="w-4 h-4" /></span>
                </button>
             </div>
             <button
               onClick={fetchUsers}
               className="p-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all text-slate-400"
             >
                <span><RefreshCw className="w-5 h-5" /></span>
             </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-5 space-y-8">
        {/* Search and Stats */}
        <section className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1 group">
            <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
              <span><Search className="w-5 h-5 text-slate-500 group-focus-within:text-blue-400 transition-colors" /></span>
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
                <span><User className="w-5 h-5 text-blue-400" /></span>
             </div>
             <div>
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">전체 사용자</p>
                <p className="text-xl font-bold font-mono tracking-tighter"><span>{users.length}</span></p>
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
                key={user.employee_id || user.id}
                className={`bg-[#1a1f2e] rounded-3xl border border-white/5 overflow-hidden group hover:border-white/10 transition-all shadow-xl hover:shadow-2xl relative
                  ${viewMode === 'list' ? 'flex items-center p-4 gap-6' : 'p-6 flex flex-col items-center text-center'}`}
              >
                {!user.is_active && <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] z-10 pointer-events-none" />}

                {/* Avatar / Icon */}
                <div className={`shrink-0 relative ${viewMode === 'list' ? 'w-12 h-12' : 'w-16 h-16 mb-4'}`}>
                  <div className={`w-full h-full rounded-2xl flex items-center justify-center transition-all group-hover:scale-110 shadow-lg ${user.is_active ? 'bg-gradient-to-br from-blue-600/20 to-purple-600/20 text-blue-400' : 'bg-slate-800 text-slate-500'}`}>
                    <span><User className={viewMode === 'list' ? 'w-6 h-6' : 'w-8 h-8'} /></span>
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
                    <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors truncate"><span>{user.name}</span></h3>
                    <div className={`flex items-center gap-2 mt-1 ${viewMode === 'grid' ? 'justify-center' : ''}`}>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${user.role === 'admin' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                         <span>{user.role?.toUpperCase() || 'USER'}</span>
                      </span>
                      {user.employee_id && <span className="text-[10px] text-slate-500 font-mono">#<span>{user.employee_id}</span></span>}
                    </div>
                  </div>

                  <div className={`${viewMode === 'grid' ? 'space-y-3 mb-8' : 'col-span-1 space-y-1'}`}>
                    <div className={`flex items-center gap-3 text-slate-400 group/item ${viewMode === 'grid' ? 'justify-center' : ''}`}>
                       <span><Mail className="w-4 h-4 text-slate-600 group-hover/item:text-blue-400 transition-colors" /></span>
                       <span className="text-xs truncate"><span>{user.email}</span></span>
                    </div>
                    {user.phone && (
                      <div className={`flex items-center gap-3 text-slate-400 group/item ${viewMode === 'grid' ? 'justify-center' : ''}`}>
                         <span><Phone className="w-4 h-4 text-slate-600 group-hover/item:text-blue-400 transition-colors" /></span>
                         <span className="text-xs"><span>{user.phone}</span></span>
                      </div>
                    )}
                    {(user.company_name || user.honbu_name || user.team_name || user.part_name || user.subpart_name) && (
                       <div className={`flex flex-col gap-1 text-slate-400 group/item border-b border-white/5 pb-2 mb-2 ${viewMode === 'grid' ? 'items-center' : ''}`}>
                          <div className="flex items-center gap-2">
                             <span><Building2 className="w-3.5 h-3.5 text-slate-600 group-hover/item:text-blue-400 transition-colors" /></span>
                             <span className="text-[10px] font-bold text-slate-500 truncate">
                                <span>{user.company_name || user.company || '-'}</span>
                             </span>
                          </div>
                          <div className="text-[10px] leading-relaxed text-slate-400 break-all px-6 flex flex-wrap gap-1">
                            {[
                              user.honbu_name,
                              user.team_name,
                              user.part_name,
                              user.subpart_name
                            ]
                              .filter(Boolean)
                              .map((name, idx, arr) => (
                                <React.Fragment key={`${user.employee_id}-org-${idx}`}>
                                  <span>{name}</span>
                                  {idx < arr.length - 1 && <span className="text-slate-600 mx-0.5">&gt;</span>}
                                </React.Fragment>
                              ))}
                          </div>
                       </div>
                    )}
                    <button 
                      onClick={() => handleOpenOrgModal(user)}
                      className={`text-[10px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 mx-auto py-1 px-2 rounded-lg hover:bg-blue-400/10 transition-all ${viewMode === 'list' ? 'ml-0' : ''}`}
                    >
                      <span><RefreshCw className="w-3 h-3" /></span> 소속 정보 수정
                    </button>
                  </div>

                  {/* Actions Area */}
                  <div className={`${viewMode === 'grid' ? 'grid grid-cols-1 gap-2 p-1 relative z-20' : 'col-span-2 flex justify-end gap-2 p-1 relative z-20'}`}>
                    <div className="flex gap-2">
                       <div className="relative group/role flex-1">
                          <button className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 border border-white/5 hover:border-blue-500/30 text-[11px] font-bold transition-all">
                             <span><Shield className="w-3.5 h-3.5" /></span> 권한
                          </button>
                          <div className="absolute bottom-full left-0 w-full mb-1 bg-[#1a1f2e] border border-white/10 rounded-2xl overflow-hidden shadow-2xl opacity-0 group-hover/role:opacity-100 transition-all pointer-events-none group-hover/role:pointer-events-auto origin-bottom">
                             {['admin', 'analyst', 'viewer'].map(role => (
                               <button
                                 key={role}
                                 onClick={() => handleUpdateRole(user.employee_id, role)}
                                 className={`w-full text-left px-5 py-3 text-xs hover:bg-blue-600/10 transition-colors ${user.role === role ? 'text-blue-400 font-bold' : 'text-slate-400'}`}
                               >
                                 <span>{role.toUpperCase()}</span>
                               </button>
                             ))}
                          </div>
                       </div>
                       <button
                         onClick={() => handleResetPassword(user.employee_id)}
                         className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 border border-white/5 hover:border-yellow-500/30 text-[11px] font-bold transition-all"
                       >
                         <span><Key className="w-3.5 h-3.5" /></span> PW 초기화
                       </button>
                    </div>
                    <button
                      onClick={() => handleToggleStatus(user)}
                      className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all text-[11px] font-bold border ${user.is_active ? 'bg-red-500/5 border-red-500/10 hover:border-red-500/30 text-red-500' : 'bg-green-500/5 border-green-500/10 hover:border-green-500/30 text-green-500'}`}
                    >
                      <span>{user.is_active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}</span>
                      <span>{user.is_active ? '계정 비활성화' : '계정 활성화'}</span>
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

      {/* Organization Selection Modal */}
      {isOrgModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
           <div className="absolute inset-0 bg-[#05070a]/80 backdrop-blur-md" onClick={() => setIsOrgModalOpen(false)} />
           <div className="relative w-full max-w-xl bg-[#11141d] border border-white/10 rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="h-2 bg-gradient-to-r from-blue-600 to-purple-600" />
              <div className="p-8">
                 <div className="mb-8">
                    <h2 className="text-2xl font-bold text-white">소속 조직 변경</h2>
                    <p className="text-slate-500 text-sm mt-1">{editingUser?.name}님의 소속 조직을 계층별로 선택하세요.</p>
                 </div>

                 <div className="space-y-4">
                    {/* Level 1: 전사/회사 */}
                    <Dropdown 
                      label="회사" 
                      value={tempOrgs.org1} 
                      options={orgTree} 
                      onChange={(val) => setTempOrgs({ org1: val, org2: '', org3: '', org4: '', org5: '' })}
                    />
                    {/* Level 2: 부문/실 */}
                    <Dropdown 
                      label="부문/실" 
                      value={tempOrgs.org2} 
                      options={getSubNodes(2, tempOrgs.org1)} 
                      disabled={!tempOrgs.org1}
                      onChange={(val) => setTempOrgs({...tempOrgs, org2: val, org3: '', org4: '', org5: ''})}
                    />
                    {/* Level 3: 본부 */}
                    <Dropdown 
                      label="본부/부서" 
                      value={tempOrgs.org3} 
                      options={getSubNodes(3, tempOrgs.org2)} 
                      disabled={!tempOrgs.org2}
                      onChange={(val) => setTempOrgs({...tempOrgs, org3: val, org4: '', org5: ''})}
                    />
                    {/* Level 4: 팀 */}
                    <Dropdown 
                      label="팀" 
                      value={tempOrgs.org4} 
                      options={getSubNodes(4, tempOrgs.org3)} 
                      disabled={!tempOrgs.org3}
                      onChange={(val) => setTempOrgs({...tempOrgs, org4: val, org5: ''})}
                    />
                    {/* Level 5: 파트 */}
                    <Dropdown 
                      label="파트" 
                      value={tempOrgs.org5} 
                      options={getSubNodes(5, tempOrgs.org4)} 
                      disabled={!tempOrgs.org4}
                      onChange={(val) => setTempOrgs({...tempOrgs, org5: val})}
                    />
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
        </div>
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
