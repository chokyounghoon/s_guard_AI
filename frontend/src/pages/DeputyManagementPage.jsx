import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown,
  Search, Shield, Building2, UserCircle, Network,
  ChevronRight, X, MapPin, Loader2
} from 'lucide-react';
import { getAuthHeaders, getUserProfile } from '../lib/authStore';
import { toast } from 'react-hot-toast';

const API_BASE = 'https://sguardai.khcho0421.workers.dev';

export default function DeputyManagementPage() {
  const navigate = useNavigate();
  const [myProfile, setMyProfile] = useState(null);
  const [substitutes, setSubstitutes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalTab, setModalTab] = useState('search'); // 'search' | 'org'

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Org Tree State
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [orgTree, setOrgTree] = useState([]);
  const [expandedNodes, setExpandedNodes] = useState(new Set());

  const debounceTimer = useRef(null);

  useEffect(() => {
    const profile = getUserProfile();
    if (profile) {
      setMyProfile(profile);
      fetchSubstitutes(profile.employee_id);
      fetchOrgTree();
      fetchAllUsers();
    } else {
      navigate('/login');
    }
  }, []);

  const fetchSubstitutes = async (userId) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/rbac/substitutes/${userId}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setSubstitutes(data.substitutes || []);
      }
    } catch (e) {
      toast.error('대직자 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const fetchOrgTree = async () => {
    try {
      const res = await fetch(`${API_BASE}/org/tree`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setOrgTree(data || []);
      }
    } catch (e) { console.error(e); }
  };

  const fetchAllUsers = async () => {
    try {
      const res = await fetch(`${API_BASE}/users`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setAllUsers(Array.isArray(data) ? data : []);
      }
    } catch (e) { console.error(e); }
  };

  // 실시간 라이크 검색 (클라이언트 사이드 필터링으로 안정성 확보)
  const handleSearchInput = (value) => {
    setSearchQuery(value);
    if (!value.trim()) { setSearchResults([]); return; }
    
    setSearching(true);
    const q = value.toLowerCase();
    const filtered = allUsers.filter(u =>
      (u.name || '').toLowerCase().includes(q) ||
      (u.employee_id || '').toLowerCase().includes(q)
    ).filter(u => 
      u.employee_id !== myProfile?.employee_id &&
      !substitutes.some(s => s.deputy_id === u.employee_id)
    );
    setSearchResults(filtered);
    setSearching(false);
  };

  // 사람 선택 → 조직도 탭으로 이동하며 위치 하이라이트
  const handleUserClick = (user) => {
    // substitute 데이터 형태와 user 데이터 형태의 차이 보정
    const targetUser = user.employee_id ? user : {
      ...user,
      employee_id: user.deputy_id,
      name: user.deputy_name,
      company: user.deputy_company || user.company,
      honbu: user.deputy_honbu || user.honbu,
      team: user.deputy_team || user.team,
      part: user.deputy_part || user.part,
      subpart: user.deputy_subpart || user.subpart,
    };

    setSelectedUser(targetUser);
    // 해당 유저의 조직 노드 자동 펼치기
    const toExpand = new Set();
    [targetUser.company, targetUser.honbu, targetUser.team, targetUser.part, targetUser.subpart]
      .filter(Boolean)
      .forEach(code => toExpand.add(code));
    setExpandedNodes(toExpand);
    setModalTab('org');
    setShowModal(true);
  };

  const addDeputy = async (user) => {
    const nextPriority = substitutes.length + 1;
    try {
      const res = await fetch(`${API_BASE}/rbac/substitutes`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: myProfile.employee_id, deputy_id: user.employee_id, priority: nextPriority })
      });
      if (res.ok) {
        toast.success(`${user.name}님이 ${nextPriority}순위 대직자로 추가되었습니다.`);
        closeModal();
        fetchSubstitutes(myProfile.employee_id);
      }
    } catch (e) { toast.error('추가 실패'); }
  };

  const openAddModal = () => {
    fetchAllUsers(); // 최신 사용자 목록 동기화
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSearchQuery('');
    setSearchResults([]);
    setSelectedUser(null);
    setExpandedNodes(new Set());
    setModalTab('search');
  };

  const removeDeputy = async (id) => {
    if (!window.confirm('대직자를 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`${API_BASE}/rbac/substitutes/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (res.ok) { toast.success('삭제되었습니다.'); fetchSubstitutes(myProfile.employee_id); }
    } catch (e) { toast.error('삭제 실패'); }
  };

  const movePriority = async (index, direction) => {
    const newItems = [...substitutes];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newItems.length) return;
    [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];
    const reordered = newItems.map((item, idx) => ({ id: item.id, priority: idx + 1 }));
    setSubstitutes(newItems);
    try {
      await fetch(`${API_BASE}/rbac/substitutes/reorder`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: myProfile.employee_id, items: reordered })
      });
    } catch (e) {
      toast.error('순서 변경 저장 실패');
      fetchSubstitutes(myProfile.employee_id);
    }
  };

  // 조직도 노드 관련 헬퍼
  const userOrgCodes = selectedUser
    ? [selectedUser.company, selectedUser.honbu, selectedUser.team, selectedUser.part, selectedUser.subpart].filter(Boolean)
    : [];
  const isHighlighted = (code) => userOrgCodes.includes(code);
  const isDeepestNode = (code) => {
    if (!selectedUser) return false;
    const deepest = selectedUser.subpart || selectedUser.part || selectedUser.team || selectedUser.honbu || selectedUser.company;
    return deepest === code;
  };

  const toggleNode = (code) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  };

  const renderOrgNode = (node, depth = 0) => {
    const isExpanded = expandedNodes.has(node.code);
    const highlighted = isHighlighted(node.code);
    const isLeaf = isDeepestNode(node.code);
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={node.code}>
        <div
          onClick={() => toggleNode(node.code)}
          className={`flex items-center gap-2 py-2.5 px-3 rounded-xl cursor-pointer transition-all ${
            highlighted
              ? 'bg-blue-600/20 border border-blue-500/30 text-blue-300'
              : 'hover:bg-white/5 text-slate-500'
          }`}
          style={{ marginLeft: `${depth * 14}px` }}
        >
          <span className="w-4 flex-shrink-0 flex items-center justify-center">
            {hasChildren
              ? isExpanded
                ? <ChevronDown className="w-3.5 h-3.5" />
                : <ChevronRight className="w-3.5 h-3.5" />
              : <span className="w-1.5 h-1.5 rounded-full bg-white/10 block" />
            }
          </span>
          <Network className={`w-3.5 h-3.5 flex-shrink-0 ${highlighted ? 'text-blue-400' : 'opacity-20'}`} />
          <span className={`text-[11px] font-bold flex-1 leading-tight ${highlighted ? 'text-blue-200' : ''}`}>{node.name}</span>
          {highlighted && <MapPin className="w-3 h-3 text-blue-400 animate-pulse flex-shrink-0" />}
        </div>

        {/* 가장 깊은 노드에서 선택된 사람 카드 표시 */}
        {isExpanded && isLeaf && selectedUser && (
          <div
            style={{ marginLeft: `${(depth + 1) * 14 + 4}px` }}
            className="my-1.5 mr-2"
          >
            <div className="p-3 rounded-2xl bg-gradient-to-r from-blue-600/25 to-indigo-600/15 border border-blue-500/40 shadow-lg">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
                  <UserCircle className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-black text-blue-200">{selectedUser.name}</div>
                  <div className="text-[9px] text-blue-400/70">{selectedUser.employee_id}</div>
                </div>
                <button
                  onClick={() => addDeputy(selectedUser)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black transition-all active:scale-95"
                >
                  <Plus className="w-3 h-3" />추가
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 자식 노드 재귀 렌더링 */}
        {isExpanded && hasChildren && (
          <div>{node.children.map(child => renderOrgNode(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  // ─────────────────────────────── RENDER ───────────────────────────────
  return (
    <div className="flex flex-col bg-[#07090f] text-white min-h-screen pb-28">

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 bg-[#07090f]/90 backdrop-blur-xl border-b border-white/5 px-5 py-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-white/5 text-slate-400">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-black text-white">대직자 관리</h1>
          <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">Deputy Priority Management</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 text-white text-[11px] font-black shadow-lg shadow-blue-600/25 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />대직자 추가
        </button>
      </header>

      {/* ── Main ── */}
      <main className="flex-1 px-4 py-5 space-y-5">

        {/* Info Banner */}
        <div className="bg-gradient-to-br from-blue-600/10 to-indigo-600/8 border border-blue-500/20 rounded-3xl p-4 flex items-start gap-3">
          <div className="p-2.5 rounded-2xl bg-blue-500/20 text-blue-400 flex-shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-[11px] font-black text-blue-300">지능형 대직 자동 할당</h2>
            <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
              부재 시 대직 순위에 따라 권한 및 워룸 참여가 자동으로 위임됩니다.
            </p>
          </div>
        </div>

        {/* Priority List Header */}
        <div className="flex justify-between items-center px-1">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">대직 순위 목록</span>
          <span className="text-[10px] text-blue-400 font-black bg-blue-400/10 px-2.5 py-1 rounded-full border border-blue-400/20">
            총 {substitutes.length}명
          </span>
        </div>

        {/* List */}
        {loading ? (
          <div className="py-16 flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <p className="text-[10px] text-slate-500">불러오는 중...</p>
          </div>
        ) : substitutes.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-5 bg-white/3 border border-dashed border-white/8 rounded-[28px]">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
              <Users className="w-8 h-8 text-slate-700" />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-slate-500">지정된 대직자가 없습니다</p>
              <p className="text-[10px] text-slate-700 mt-1.5">'대직자 추가' 버튼을 눌러 지정하세요</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {substitutes.map((item, index) => (
              <div 
                key={item.id} 
                onClick={() => handleUserClick(item)}
                className="group bg-[#11141d] border border-white/5 rounded-3xl p-4 flex items-center gap-3 transition-all hover:border-blue-500/20 cursor-pointer"
              >
                {/* 순위 배지 */}
                <div className="flex-shrink-0 w-11 h-11 rounded-2xl bg-[#07090f] flex flex-col items-center justify-center border border-white/5">
                  <span className="text-[8px] text-slate-600 font-black">순위</span>
                  <span className="text-base font-black text-blue-400 leading-tight">{index + 1}</span>
                </div>

                {/* 정보 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-black text-white">{item.deputy_name}</span>
                    <span className="text-[9px] text-slate-500 bg-white/5 px-1.5 py-0.5 rounded-md font-mono">{item.deputy_id}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-[9px] text-slate-500">
                    <Building2 className="w-2.5 h-2.5 flex-shrink-0" />
                    <span className="truncate">
                      {[item.deputy_team, item.deputy_part, item.deputy_subpart].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                </div>

                {/* 순서 조절 */}
                <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                  <button disabled={index === 0} onClick={() => movePriority(index, -1)}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-blue-600/20 hover:text-blue-400 disabled:opacity-20 transition-all">
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button disabled={index === substitutes.length - 1} onClick={() => movePriority(index, 1)}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-blue-600/20 hover:text-blue-400 disabled:opacity-20 transition-all">
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* 삭제 */}
                <button onClick={() => removeDeputy(item.id)}
                  className="p-2.5 rounded-2xl text-red-500/25 hover:text-red-500 hover:bg-red-500/10 transition-all">
                  <Trash2 className="w-4.5 h-4.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ═══════════════════════ MODAL (Bottom Sheet) ═══════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 z-[200] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={closeModal} />

          <div className="relative w-full bg-[#0d1117] rounded-t-[32px] border-t border-white/8 shadow-2xl flex flex-col"
            style={{ maxHeight: '90vh' }}>

            {/* Pull bar */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-white/10 rounded-full" />
            </div>

            {/* Modal Header */}
            <div className="px-5 pt-3 pb-4 flex items-center justify-between border-b border-white/5">
              <div>
                <h2 className="text-base font-black text-white">대직자 추가</h2>
                <p className="text-[9px] text-slate-500 mt-0.5">검색 후 조직도에서 위치를 확인하세요</p>
              </div>
              <button onClick={closeModal} className="p-2 rounded-full hover:bg-white/5 text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="px-5 pt-3 pb-0">
              <div className="flex gap-1.5 p-1 bg-white/5 rounded-2xl">
                {[
                  { id: 'search', label: '이름 검색', icon: Search },
                  { id: 'org', label: '조직도 보기', icon: Network },
                ].map(tab => {
                  const Icon = tab.icon;
                  return (
                    <button key={tab.id} onClick={() => setModalTab(tab.id)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-black transition-all ${
                        modalTab === tab.id
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}>
                      <Icon className="w-3.5 h-3.5" />{tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── 검색 탭 ── */}
            {modalTab === 'search' && (
              <div className="flex flex-col flex-1 overflow-hidden px-5 pt-4 pb-6" style={{ minHeight: 0 }}>
                {/* 실시간 검색창 */}
                <div className="relative mb-4">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  {searching && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400 animate-spin" />}
                  <input
                    autoFocus
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearchInput(e.target.value)}
                    placeholder="이름 또는 사번 입력 시 자동 검색…"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-11 pr-11 text-sm focus:outline-none focus:border-blue-500 transition-all text-white placeholder-slate-600"
                  />
                </div>

                {/* 검색 결과 */}
                <div className="flex-1 overflow-y-auto space-y-2.5 custom-scrollbar pb-2">
                  {searchResults.length > 0 ? searchResults.map(user => (
                    <div
                      key={user.employee_id}
                      onClick={() => handleUserClick(user)}
                      className="w-full p-4 rounded-2xl bg-[#11141d] border border-white/5 hover:border-blue-500/30 hover:bg-[#141825] cursor-pointer transition-all active:scale-[0.98]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-blue-600/15 flex items-center justify-center text-blue-400 flex-shrink-0">
                          <UserCircle className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-black text-white leading-tight">
                            {user.name}
                            <span className="ml-1.5 text-[10px] text-slate-500 font-mono font-normal">({user.employee_id})</span>
                          </div>
                          {/* 전체 조직 경로: company > honbu > team > part > subpart */}
                          <div className="flex items-center flex-wrap gap-1 mt-1.5">
                            {[
                              user.company_name || user.company,
                              user.honbu_name   || user.honbu,
                              user.team_name    || user.team,
                              user.part_name    || user.part,
                              user.subpart_name || user.subpart,
                            ].filter(Boolean).map((seg, i, arr) => (
                              <React.Fragment key={i}>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${
                                  i === arr.length - 1
                                    ? 'bg-blue-500/15 border-blue-500/25 text-blue-400'
                                    : 'bg-white/5 border-white/5 text-slate-500'
                                }`}>{seg}</span>
                                {i < arr.length - 1 && (
                                  <ChevronRight className="w-2 h-2 text-slate-700 flex-shrink-0" />
                                )}
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-[9px] text-blue-400 font-black flex-shrink-0">
                          <Network className="w-3.5 h-3.5" />
                          <span>조직도</span>
                          <ChevronRight className="w-3 h-3" />
                        </div>
                      </div>
                    </div>
                  )) : searchQuery && !searching ? (
                    <div className="py-14 text-center text-slate-600 text-xs">검색 결과가 없습니다.</div>
                  ) : (
                    <div className="py-14 text-center space-y-2">
                      <Search className="w-8 h-8 text-slate-700 mx-auto" />
                      <p className="text-slate-600 text-[10px]">이름 또는 사번을 입력하면<br/>자동으로 검색됩니다</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── 조직도 탭 ── */}
            {modalTab === 'org' && (
              <div className="flex flex-col flex-1 overflow-hidden px-5 pt-4 pb-6" style={{ minHeight: 0 }}>

                {/* 선택된 유저 배너 */}
                {selectedUser ? (
                  <div className="mb-4 p-3.5 rounded-2xl bg-blue-600/12 border border-blue-500/25 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
                        <UserCircle className="w-5 h-5 text-white" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-black text-blue-200 truncate">{selectedUser.name}</div>
                        <div className="text-[9px] text-blue-400/70">조직도에서 위치 확인 중</div>
                      </div>
                    </div>
                    <button
                      onClick={() => addDeputy(selectedUser)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black transition-all active:scale-95 flex-shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />추가
                    </button>
                  </div>
                ) : (
                  <div className="mb-4 p-3 rounded-2xl bg-white/3 border border-white/5 text-center text-[10px] text-slate-600">
                    검색 탭에서 사람을 선택하면 조직도에서 위치를 확인할 수 있습니다
                  </div>
                )}

                {/* 조직도 트리 */}
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-0.5 bg-black/25 rounded-3xl p-4">
                  {orgTree.length > 0 ? (
                    orgTree.map(node => renderOrgNode(node))
                  ) : (
                    <div className="py-12 flex justify-center">
                      <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
