import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Edit3, Trash2, Building2, GitMerge, Users, Save, X, Network, Search, Command
} from 'lucide-react';

export default function OrganizationManagementPage() {
  const navigate = useNavigate();
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [selectedDepth1, setSelectedDepth1] = useState(null);
  const [selectedDepth2, setSelectedDepth2] = useState(null);
  const [selectedDepth3, setSelectedDepth3] = useState(null);
  const [selectedDepth4, setSelectedDepth4] = useState(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' | 'edit'
  const [modalData, setModalData] = useState({ id: null, name: '', code: '', parentId: null, depth: 1 });

  const API_BASE = 'https://sguardai.khcho0421.workers.dev';

  const fetchTree = () => {
    setLoading(true);
    fetch(`${API_BASE}/org/tree`)
      .then(r => r.json())
      .then(data => {
        setTree(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTree();
  }, []);

  const handleOpenAddModal = (parentId, depth) => {
    setModalMode('add');
    setModalData({ id: null, name: '', code: '', parentId, depth });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (node) => {
    setModalMode('edit');
    setModalData({ id: node.id, name: node.name, code: node.code || '', parentId: node.parent_id, depth: node.depth });
    setIsModalOpen(true);
  };

  const handleSaveNode = async () => {
    if (!modalData.name) {
      alert('조직명을 입력하세요.');
      return;
    }

    try {
      if (modalMode === 'add') {
        const res = await fetch(`${API_BASE}/org/nodes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: modalData.name,
            code: modalData.code,
            parent_id: modalData.parentId,
            depth: modalData.depth,
            sort_order: 0
          })
        });
        if (res.ok) fetchTree();
      } else {
        const res = await fetch(`${API_BASE}/org/nodes/${modalData.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: modalData.name, code: modalData.code })
        });
        if (res.ok) fetchTree();
      }
      setIsModalOpen(false);
    } catch (e) { console.error(e); }
  };

  const handleDeleteNode = async (nodeId) => {
    if (!window.confirm('정말 삭제하시겠습니까? 하위 조직이 모두 삭제됩니다.')) return;
    try {
      const res = await fetch(`${API_BASE}/org/nodes/${nodeId}`, { method: 'DELETE' });
      if (res.ok) {
        if (nodeId === selectedDepth1) {
          setSelectedDepth1(null);
          setSelectedDepth2(null);
          setSelectedDepth3(null);
          setSelectedDepth4(null);
        }
        if (nodeId === selectedDepth2) {
          setSelectedDepth2(null);
          setSelectedDepth3(null);
          setSelectedDepth4(null);
        }
        if (nodeId === selectedDepth3) {
          setSelectedDepth3(null);
          setSelectedDepth4(null);
        }
        if (nodeId === selectedDepth4) {
          setSelectedDepth4(null);
        }
        fetchTree();
      }
    } catch (e) { console.error(e); }
  };

  // Helper to find nodes
  const depth1Nodes = tree;
  const depth2Nodes = selectedDepth1 ? tree.find(n => n.id === selectedDepth1)?.children || [] : [];
  const depth3Nodes = selectedDepth2 ? depth2Nodes.find(n => n.id === selectedDepth2)?.children || [] : [];
  const depth4Nodes = selectedDepth3 ? depth3Nodes.find(n => n.id === selectedDepth3)?.children || [] : [];

  // Filter by search if needed (simply filtering names for now)
  const filterNodes = (nodes) => {
    if (!search) return nodes;
    return nodes.filter(n => n.name.toLowerCase().includes(search.toLowerCase()) || (n.code && n.code.toLowerCase().includes(search.toLowerCase())));
  };

  const renderList = (nodes, depth, selectedId, onSelect, icon, bgColor, borderColor) => {
    const filtered = filterNodes(nodes);
    return (
      <div className={`flex flex-col h-[600px] border ${borderColor} ${bgColor} rounded-[32px] overflow-hidden shadow-xl`}>
        <div className="p-5 border-b border-white/5 flex items-center justify-between bg-black/20">
          <div className="flex items-center gap-2">
            {icon}
            <h3 className="font-bold text-white tracking-wide">
              {depth === 1 ? '부문/실' : depth === 2 ? '본부' : depth === 3 ? '팀' : '파트'}
            </h3>
          </div>
          <button
            onClick={() => handleOpenAddModal(
              depth === 1 ? null : 
              depth === 2 ? selectedDepth1 : 
              depth === 3 ? selectedDepth2 : selectedDepth3, 
              depth
            )}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
            title="추가"
            disabled={depth > 1 && !(
              depth === 2 ? selectedDepth1 : 
              depth === 3 ? selectedDepth2 : selectedDepth3
            )}
          >
            <Plus className="w-4 h-4 text-white" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
          {filtered.length === 0 ? (
             <div className="flex items-center justify-center h-full text-slate-500 text-sm">목록이 없습니다.</div>
          ) : (
             filtered.map(node => (
               <div
                 key={node.id}
                 onClick={() => onSelect(node.id)}
                 className={`group flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all border
                   ${selectedId === node.id 
                      ? 'bg-blue-600/20 border-blue-500/50 shadow-lg shadow-blue-900/20' 
                      : 'bg-white/5 border-transparent hover:bg-white/10 hover:border-white/10'}`}
               >
                  <div className="flex-1 min-w-0">
                     <p className={`font-bold truncate ${selectedId === node.id ? 'text-blue-400' : 'text-slate-200'}`}>
                        {node.name}
                     </p>
                     {node.code && (
                       <div className="flex items-center gap-1 mt-1">
                         <Command className="w-3 h-3 text-slate-500" />
                         <p className="text-[10px] text-slate-400 font-mono tracking-wider">{node.code}</p>
                       </div>
                     )}
                  </div>
                  <div className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${selectedId === node.id ? 'opacity-100' : ''}`}>
                    <button
                       onClick={(e) => { e.stopPropagation(); handleOpenEditModal(node); }}
                       className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-all"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                       onClick={(e) => { e.stopPropagation(); handleDeleteNode(node.id); }}
                       className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
               </div>
             ))
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0a0e17] text-white font-sans pb-24 relative overflow-x-hidden">
      {/* Background Decor */}
      <div className="fixed top-0 left-0 w-full h-96 bg-blue-600/5 blur-[120px] rounded-full -z-10" />
      <div className="fixed bottom-0 right-0 w-full h-96 bg-purple-600/5 blur-[120px] rounded-full -z-10" />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0f111a]/80 backdrop-blur-xl border-b border-white/5 p-5">
        <div className="flex items-center justify-between max-w-[1400px] mx-auto w-full">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 transition-all border border-white/5"
            >
              <ArrowLeft className="w-5 h-5 text-slate-400" />
            </button>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent flex items-center gap-2">
                 <GitMerge className="w-5 h-5 text-blue-500" /> 조직 구조 관리
              </h1>
              <p className="text-[10px] text-slate-500 font-mono tracking-[0.2em] uppercase mt-0.5">3-Depth Org Structure Admin</p>
            </div>
          </div>
          
          <div className="relative group w-64 hidden sm:block">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
              <input
                type="text"
                placeholder="조직명 / 코드 검색..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#1a1f2e] border border-white/5 rounded-[16px] py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-blue-500/40 transition-all"
              />
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto p-5 space-y-8">
        {loading ? (
             <div className="flex flex-col items-center justify-center py-32 space-y-4">
                <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-500 rounded-full animate-spin" />
                <p className="text-sm text-slate-500 animate-pulse">조직도를 불러오는 중입니다...</p>
             </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
             {/* Depth 1: 부문/실 */}
             {renderList(depth1Nodes, 1, selectedDepth1, (id) => {
               setSelectedDepth1(id);
               setSelectedDepth2(null);
               setSelectedDepth3(null);
               setSelectedDepth4(null);
             }, <Building2 className="w-5 h-5 text-blue-400" />, 'bg-[#121623]', 'border-blue-500/10')}

             {/* Depth 2: 본부 */}
             {renderList(depth2Nodes, 2, selectedDepth2, (id) => {
               setSelectedDepth2(id);
               setSelectedDepth3(null);
               setSelectedDepth4(null);
             }, <Network className="w-5 h-5 text-purple-400" />, 'bg-[#151928]', 'border-purple-500/10')}

             {/* Depth 3: 팀 */}
             {renderList(depth3Nodes, 3, selectedDepth3, (id) => {
               setSelectedDepth3(id);
               setSelectedDepth4(null);
             }, <Users className="w-5 h-5 text-emerald-400" />, 'bg-[#181d2f]', 'border-emerald-500/10')}

             {/* Depth 4: 파트 */}
             {renderList(depth4Nodes, 4, selectedDepth4, (id) => {
               setSelectedDepth4(id);
             }, <Network className="w-5 h-5 text-indigo-400" />, 'bg-[#1a1f33]', 'border-indigo-500/10')}
          </div>
        )}
      </main>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="bg-[#1a1f2e] border border-white/10 rounded-[32px] p-8 max-w-md w-full relative z-10 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-8 text-white">
              <h2 className="text-2xl font-bold tracking-tight">
                {modalMode === 'add' ? '조직 추가' : '조직 수정'}
                <span className="block text-xs text-slate-500 font-mono tracking-widest uppercase mt-1">Org Management</span>
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">조직명 (Name)</label>
                <input
                  type="text"
                  autoFocus
                  placeholder="예: 경영기획본부"
                  className="w-full bg-black/20 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                  value={modalData.name}
                  onChange={(e) => setModalData({ ...modalData, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">조직 코드 (Code)</label>
                <input
                  type="text"
                  placeholder="예: ORG-001 (선택사항)"
                  className="w-full bg-black/20 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-colors font-mono"
                  value={modalData.code}
                  onChange={(e) => setModalData({ ...modalData, code: e.target.value })}
                />
              </div>

              <div className="pt-4">
                <button
                  onClick={handleSaveNode}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl py-4 flex items-center justify-center gap-2 shadow-xl shadow-blue-900/30 transition-all active:scale-[0.98]"
                >
                  <Save className="w-5 h-5" />
                  저장하기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
