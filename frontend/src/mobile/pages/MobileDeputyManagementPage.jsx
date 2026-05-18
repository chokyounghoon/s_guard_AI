import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Users, ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, Search, Shield, Building2, UserCircle, Network, ChevronRight, X, MapPin, Loader2 } from 'lucide-react';
import { getAuthHeaders, getUserProfile } from '../../lib/authStore';
import { useBackNavigation } from '../../hooks/useBackNavigation';
import { toast } from 'react-hot-toast';

const API_BASE = 'https://sguardai.khcho0421.workers.dev';

export default function MobileDeputyManagementPage() {
  const navigate = useNavigate();
  const goBack = useBackNavigation('/dashboard');
  const [myProfile, setMyProfile] = useState(null);
  const [substitutes, setSubstitutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalTab, setModalTab] = useState('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [orgTree, setOrgTree] = useState([]);
  const [expandedNodes, setExpandedNodes] = useState(new Set());

  useEffect(() => {
    const profile = getUserProfile();
    if (profile) {
      setMyProfile(profile);
      fetchSubstitutes(profile.employee_id);
      fetchOrgTree();
      fetchAllUsers();
    } else { navigate('/'); }
  }, []);

  const fetchSubstitutes = async (userId) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/rbac/substitutes/${userId}`, { headers: getAuthHeaders() });
      if (res.ok) { const d = await res.json(); setSubstitutes(d.substitutes || []); }
    } catch (e) { toast.error('불러오기 실패'); }
    finally { setLoading(false); }
  };

  const fetchOrgTree = async () => {
    try {
      const res = await fetch(`${API_BASE}/org/tree`, { headers: getAuthHeaders() });
      if (res.ok) { const d = await res.json(); setOrgTree(d || []); }
    } catch (e) { console.error(e); }
  };

  const fetchAllUsers = async () => {
    try {
      const res = await fetch(`${API_BASE}/users`, { headers: getAuthHeaders() });
      if (res.ok) { const d = await res.json(); setAllUsers(Array.isArray(d) ? d : []); }
    } catch (e) { console.error(e); }
  };

  const handleSearch = (value) => {
    setSearchQuery(value);
    if (!value.trim()) { setSearchResults([]); return; }
    const q = value.toLowerCase();
    setSearchResults(
      allUsers.filter(u =>
        ((u.name || '').toLowerCase().includes(q) || (u.employee_id || '').toLowerCase().includes(q)) &&
        u.employee_id !== myProfile?.employee_id &&
        !substitutes.some(s => s.deputy_id === u.employee_id)
      )
    );
  };

  const handleUserClick = (user) => {
    const t = user.employee_id ? user : {
      ...user, employee_id: user.deputy_id, name: user.deputy_name,
      company: user.deputy_company, honbu: user.deputy_honbu,
      team: user.deputy_team, part: user.deputy_part, subpart: user.deputy_subpart,
    };
    setSelectedUser(t);
    const exp = new Set();
    [t.company, t.honbu, t.team, t.part, t.subpart].filter(Boolean).forEach(c => exp.add(c));
    setExpandedNodes(exp);
    setModalTab('org');
    setShowModal(true);
  };

  const addDeputy = async (user) => {
    try {
      const res = await fetch(`${API_BASE}/rbac/substitutes`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: myProfile.employee_id, deputy_id: user.employee_id, priority: substitutes.length + 1 })
      });
      if (res.ok) { toast.success(`${user.name}님 추가됨`); closeModal(); fetchSubstitutes(myProfile.employee_id); }
    } catch (e) { toast.error('추가 실패'); }
  };

  const closeModal = () => {
    setShowModal(false); setSearchQuery(''); setSearchResults([]);
    setSelectedUser(null); setExpandedNodes(new Set()); setModalTab('search');
  };

  useEffect(() => {
    // 🚀 자동 등록 로직: 대직자 목록이 비어있을 때 동일 부서원 자동 추가
    if (!loading && substitutes.length === 0 && allUsers.length > 0 && myProfile) {
      handleAutoRegistration();
    }
  }, [loading, substitutes.length, allUsers.length, myProfile]);

  const handleAutoRegistration = async () => {
    const mySubpart = myProfile.subpart;
    const myTeamCode = myProfile.team_code || myProfile.team;
    const userId = myProfile.employee_id;
    if (!mySubpart && !myTeamCode) return;

    let sameDeptUsers = [];
    if (mySubpart) {
      sameDeptUsers = allUsers.filter(u => u.subpart === mySubpart);
    }
    if (sameDeptUsers.length === 0 && myTeamCode) {
      sameDeptUsers = allUsers.filter(u => u.team_code === myTeamCode || u.team === myTeamCode);
    }

    // 나 자신 제외
    sameDeptUsers = sameDeptUsers.filter(u => u.employee_id !== userId);

    if (sameDeptUsers.length > 0) {
      const tid = toast.loading(`${sameDeptUsers.length}명의 팀원을 대직자로 자동 등록 중...`);
      try {
        const promises = sameDeptUsers.map((u, i) => 
          fetch(`${API_BASE}/rbac/substitutes`, {
            method: 'POST',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              user_id: userId, 
              deputy_id: u.employee_id, 
              priority: i + 1 
            })
          })
        );
        await Promise.all(promises);
        toast.success('동일 부서 인원이 대직자로 자동 등록되었습니다.', { id: tid });
        fetchSubstitutes(userId);
      } catch (e) {
        toast.error('자동 등록 실패', { id: tid });
      }
    }
  };

  const removeDeputy = async (id) => {
    if (!window.confirm('삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`${API_BASE}/rbac/substitutes/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (res.ok) { toast.success('삭제됨'); fetchSubstitutes(myProfile.employee_id); }
    } catch (e) { toast.error('삭제 실패'); }
  };

  const movePriority = async (index, dir) => {
    const items = [...substitutes];
    const ti = index + dir;
    if (ti < 0 || ti >= items.length) return;
    [items[index], items[ti]] = [items[ti], items[index]];
    setSubstitutes(items);
    try {
      await fetch(`${API_BASE}/rbac/substitutes/reorder`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: myProfile.employee_id, items: items.map((x, i) => ({ id: x.id, priority: i + 1 })) })
      });
    } catch (e) { toast.error('순서 저장 실패'); fetchSubstitutes(myProfile.employee_id); }
  };

  const userOrgCodes = selectedUser
    ? [selectedUser.company, selectedUser.honbu, selectedUser.team, selectedUser.part, selectedUser.subpart].filter(Boolean)
    : [];

  const toggleNode = (code) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  };

  const renderNode = (node, depth = 0) => {
    const expanded = expandedNodes.has(node.code);
    const hl = userOrgCodes.includes(node.code);
    const deepest = selectedUser && (selectedUser.subpart || selectedUser.part || selectedUser.team || selectedUser.honbu || selectedUser.company) === node.code;
    const hasKids = node.children?.length > 0;
    // 들여쓰기 최대 4단계로 제한 (화면 밖으로 밀리는 문제 방지)
    const indent = Math.min(depth, 4) * 12;
    return (
      <div key={node.code}>
        <div onClick={() => toggleNode(node.code)} style={{ paddingLeft: `${indent + 8}px` }}
          className={`flex items-center gap-2 py-3 pr-2 rounded-xl cursor-pointer transition-all overflow-hidden ${hl ? 'bg-blue-600/15 border border-blue-500/25' : 'hover:bg-white/5'}`}>
          <span className="w-4 flex-shrink-0">
            {hasKids ? (expanded ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-600" />) : <span className="block w-1.5 h-1.5 rounded-full bg-slate-700 mx-auto" />}
          </span>
          <Network className={`w-4 h-4 flex-shrink-0 ${hl ? 'text-blue-400' : 'text-slate-600'}`} />
          <span className={`text-sm font-semibold flex-1 min-w-0 truncate ${hl ? 'text-blue-200' : 'text-slate-300'}`}>{node.name}</span>
          {hl && <MapPin className="w-3 h-3 text-blue-400 animate-pulse flex-shrink-0" />}
        </div>
        {expanded && deepest && selectedUser && (
          <div style={{ marginLeft: `${indent + 8}px`, marginRight: '8px' }} className="my-2">
            <div className="p-3 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
                <UserCircle className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white truncate">{selectedUser.name}</div>
                <div className="text-xs text-blue-400/70 truncate">{selectedUser.employee_id}</div>
              </div>
            </div>
          </div>
        )}
        {expanded && hasKids && (
          <div style={{ borderLeft: '1px solid rgba(255,255,255,0.05)', marginLeft: `${indent + 16}px` }}>
            {node.children.map(c => renderNode(c, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }} className="flex flex-col bg-[#07090f] text-white min-h-screen pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#07090f]/95 backdrop-blur-xl border-b border-white/5 px-4 py-4 flex items-center gap-3">
        <button onClick={() => goBack()} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-slate-400 active:scale-90 transition-all flex-shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-white">대직자 관리</h1>
          <p className="text-xs text-slate-500">Deputy Management</p>
        </div>
        <button onClick={() => { fetchAllUsers(); setShowModal(true); }} className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg active:scale-90 flex-shrink-0">
          <Plus className="w-5 h-5" />
        </button>
      </header>

      <main className="flex-1 px-4 py-5 space-y-5">
        {/* Info Banner */}
        <div className="bg-blue-600/10 border border-blue-500/20 rounded-2xl p-4 flex items-center gap-3">
          <Shield className="w-5 h-5 text-blue-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-white">지능형 자동 위임</p>
            <p className="text-xs text-slate-400 mt-0.5">대직 순위에 따라 권한이 자동 위임됩니다.</p>
          </div>
        </div>

        {/* Header Row */}
        <div className="flex justify-between items-center">
          <span className="text-sm font-bold text-slate-400">대직 순위 목록</span>
          <span className="text-xs text-blue-400 font-bold bg-blue-400/10 px-2 py-1 rounded-lg">총 {substitutes.length}명</span>
        </div>

        {/* List */}
        {loading ? (
          <div className="py-16 flex justify-center"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>
        ) : substitutes.length === 0 ? (
          <div onClick={() => { fetchAllUsers(); setShowModal(true); }} className="py-14 flex flex-col items-center gap-4 border border-dashed border-white/10 rounded-2xl cursor-pointer">
            <Users className="w-10 h-10 text-slate-700" />
            <p className="text-sm text-slate-500">등록된 대직자가 없습니다</p>
            <p className="text-xs text-blue-500 font-bold">+ 대직자 추가</p>
          </div>
        ) : (
          <div className="space-y-3">
            {substitutes.map((item, idx) => (
              <div key={item.id} onClick={() => handleUserClick(item)} className="bg-white/3 border border-white/8 rounded-2xl p-4 flex items-center gap-3 active:bg-white/5 transition-all cursor-pointer">
                <div className="w-11 h-11 rounded-xl bg-blue-600 flex flex-col items-center justify-center flex-shrink-0">
                  <span className="text-[9px] text-white/60 font-bold leading-none">순위</span>
                  <span className="text-lg font-black text-white leading-none">{idx + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white truncate">{item.deputy_name}</span>
                    <span className="text-[10px] text-slate-500 font-mono bg-white/5 px-1.5 py-0.5 rounded flex-shrink-0">{item.deputy_id}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
                    <Building2 className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{[item.deputy_team, item.deputy_part, item.deputy_subpart].filter(Boolean).join(' · ')}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1 flex-shrink-0">
                  <button disabled={idx === 0} onClick={e => { e.stopPropagation(); movePriority(idx, -1); }} className="p-1.5 rounded-lg bg-white/5 text-slate-500 disabled:opacity-20 active:bg-blue-600 active:text-white">
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button disabled={idx === substitutes.length - 1} onClick={e => { e.stopPropagation(); movePriority(idx, 1); }} className="p-1.5 rounded-lg bg-white/5 text-slate-500 disabled:opacity-20 active:bg-blue-600 active:text-white">
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
                <button onClick={e => { e.stopPropagation(); removeDeputy(item.id); }} className="p-2 rounded-xl text-red-500/30 active:text-red-500 active:bg-red-500/10 flex-shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal */}
      {showModal && createPortal(
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#07090f' }}>
          {/* Modal Header */}
          <div className="px-4 pt-12 pb-4 border-b border-white/5 flex items-center gap-3 flex-shrink-0">
            <button onClick={closeModal} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-slate-400 flex-shrink-0">
              <X className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-white">대직자 추가</h2>
              <p className="text-xs text-slate-500">검색하거나 조직도에서 선택하세요</p>
            </div>
            {selectedUser ? (
               <button onClick={() => addDeputy(selectedUser)} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold flex items-center gap-1 flex-shrink-0 active:scale-95 shadow-lg shadow-blue-600/20">
                 <Plus className="w-3 h-3" />추가
               </button>
            ) : (
               <div className="px-4 py-2 rounded-xl bg-white/5 text-slate-500 text-xs font-bold flex items-center gap-1 flex-shrink-0 opacity-50 cursor-not-allowed">
                 <Plus className="w-3 h-3" />추가
               </div>
            )}
          </div>

          {/* Search Bar */}
          <div className="px-4 py-3 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              {allUsers.length === 0 && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400 animate-spin" />}
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                placeholder="이름 또는 사번 입력..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-11 pr-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          {/* Tabs */}
          <div className="px-4 pb-3 flex-shrink-0">
            <div className="flex gap-2 p-1 bg-white/5 rounded-xl">
              {[{ id: 'search', label: '이름 검색', icon: Search }, { id: 'org', label: '조직도', icon: Network }].map(tab => {
                const Icon = tab.icon;
                return (
                  <button key={tab.id} onClick={() => setModalTab(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition-all ${modalTab === tab.id ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>
                    <Icon className="w-3.5 h-3.5" />{tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-4 pb-8">
            {modalTab === 'search' && (
              <div className="space-y-2">
                {allUsers.length === 0 ? (
                  <div className="py-16 flex flex-col items-center gap-3"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /><p className="text-xs text-slate-500">사용자 목록 로딩 중...</p></div>
                ) : searchResults.length > 0 ? searchResults.map(user => (
                  <div key={user.employee_id} onClick={() => handleUserClick(user)} className="p-4 rounded-2xl bg-white/3 border border-white/8 flex items-center gap-3 active:bg-white/5 cursor-pointer">
                    <div className="w-10 h-10 rounded-xl bg-blue-600/15 flex items-center justify-center flex-shrink-0">
                      <UserCircle className="w-6 h-6 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-white">{user.name} <span className="text-xs text-slate-500 font-normal">#{user.employee_id}</span></div>
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        {[user.company_name || user.company, user.team_name || user.team, user.part_name || user.part].filter(Boolean).map((s, i) => (
                          <span key={i} className="text-[10px] text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">{s}</span>
                        ))}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-600 flex-shrink-0" />
                  </div>
                )) : searchQuery ? (
                  <div className="py-16 text-center text-sm text-slate-500">검색 결과가 없습니다.</div>
                ) : (
                  <div className="py-16 flex flex-col items-center gap-3 opacity-40">
                    <Search className="w-10 h-10 text-slate-700" />
                    <p className="text-sm text-slate-500">이름 또는 사번을 입력하세요</p>
                  </div>
                )}
              </div>
            )}

            {modalTab === 'org' && (
              <div>
                <div className="bg-black/20 rounded-2xl p-3 space-y-0.5 mt-2">
                  {orgTree.length > 0 ? orgTree.map(n => renderNode(n)) : (
                    <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 text-blue-500 animate-spin" /></div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
