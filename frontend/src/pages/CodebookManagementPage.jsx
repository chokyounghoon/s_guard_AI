import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCodebook } from '../context/CodebookContext';
import {
  ArrowLeft, Plus, Search, BookOpen, 
  Trash2, Save, Filter, Edit2, CheckCircle2, XCircle,
  Layers, ChevronRight, MoreVertical
} from 'lucide-react';

export default function CodebookManagementPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const { allCodes: codes, isLoading: loading, refreshCodes } = useCodebook();
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCode, setEditingCode] = useState(null);
  
  // Form State
  const [formData, setFormData] = useState({
    category: '',
    code: '',
    name: '',
    sort_order: 0,
    is_active: true,
    description: ''
  });

  const API_BASE = 'https://sguardai.khcho0421.workers.dev';


  const categories = ['ALL', ...new Set(codes.map(c => c.category))];

  const handleSubmit = async (e) => {
    e.preventDefault();
    const method = editingCode ? 'PUT' : 'POST';
    const url = editingCode ? `${API_BASE}/sms/codebook/${editingCode.id}` : `${API_BASE}/sms/codebook`;

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        setShowAddModal(false);
        setEditingCode(null);
        setFormData({ category: '', code: '', name: '', sort_order: 0, is_active: true, description: '' });
        refreshCodes();
      }
    } catch (e) {
      console.error('Save code error:', e);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`${API_BASE}/sms/codebook/${id}`, { method: 'DELETE' });
      if (res.ok) refreshCodes();
    } catch (e) {
      console.error('Delete code error:', e);
    }
  };

  const openEdit = (item) => {
    setEditingCode(item);
    setFormData({
      category: item.category,
      code: item.code,
      name: item.name,
      sort_order: item.sort_order,
      is_active: item.is_active === 1,
      description: item.description || ''
    });
    setShowAddModal(true);
  };

  const filteredCodes = codes.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) || 
                          c.code.toLowerCase().includes(search.toLowerCase()) ||
                          c.category.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'ALL' || c.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-[#0a0e17] text-white font-sans pb-24 relative overflow-x-hidden">
      {/* Background Effects */}
      <div className="fixed top-0 left-0 w-full h-full -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-600/10 blur-[120px] rounded-full" />
      </div>

      {/* Header */}
      <header className="flex justify-between items-center p-6 sticky top-0 bg-[#0f111a]/80 backdrop-blur-xl z-40 border-b border-white/5">
        <div className="flex items-center space-x-5">
          <button onClick={() => navigate(-1)} className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 transition-all border border-white/5">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">코드북 관리</h1>
            <p className="text-[10px] text-slate-500 font-mono uppercase tracking-[3px] mt-0.5">Common Code Management</p>
          </div>
        </div>
        <button 
          onClick={() => {
            setEditingCode(null);
            setFormData({ category: '', code: '', name: '', sort_order: 0, is_active: true, description: '' });
            setShowAddModal(true);
          }}
          className="bg-blue-600 hover:bg-blue-500 text-white p-3 rounded-2xl transition-all shadow-lg shadow-blue-900/40 active:scale-95 border border-blue-400/20"
        >
          <Plus className="w-5 h-5" />
        </button>
      </header>

      <main className="p-6 space-y-8 max-w-5xl mx-auto">
        {/* Search & Filter Bar */}
        <section className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
            <input
              type="text"
              placeholder="코드명, 코드값, 카테고리 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#161b2c] border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
            <Filter className="w-4 h-4 text-slate-500 shrink-0 ml-2" />
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                  selectedCategory === cat 
                  ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-900/30' 
                  : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </section>

        {/* Stats Summary */}
        <section className="grid grid-cols-3 gap-4">
          <div className="bg-[#11141d]/50 backdrop-blur-md rounded-3xl p-5 border border-white/5">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Total Codes</p>
            <p className="text-2xl font-black text-white">{codes.length}</p>
          </div>
          <div className="bg-[#11141d]/50 backdrop-blur-md rounded-3xl p-5 border border-white/5">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Categories</p>
            <p className="text-2xl font-black text-blue-400">{categories.length - 1}</p>
          </div>
          <div className="bg-[#11141d]/50 backdrop-blur-md rounded-3xl p-5 border border-white/5">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Active</p>
            <p className="text-2xl font-black text-emerald-400">{codes.filter(c => c.is_active).length}</p>
          </div>
        </section>

        {/* Code List */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-sm font-bold text-slate-300 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-400" />
              코드 목록
            </h2>
            <span className="text-[10px] text-slate-500 font-mono">RESULTS: {filteredCodes.length}</span>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
              <p className="text-slate-500 text-sm animate-pulse">데이터 로딩 중...</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredCodes.map((item) => (
                <div
                  key={item.id}
                  className="bg-[#11141d]/60 backdrop-blur-sm p-5 rounded-3xl border border-white/5 flex items-center justify-between group hover:border-blue-500/30 hover:bg-[#161b2c] transition-all"
                >
                  <div className="flex items-center space-x-5">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                      item.is_active ? 'bg-blue-600/10' : 'bg-slate-600/10'
                    }`}>
                      <BookOpen className={`w-6 h-6 ${item.is_active ? 'text-blue-400' : 'text-slate-600'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-black text-blue-500/80 tracking-widest uppercase">{item.category}</span>
                        <ChevronRight className="w-3 h-3 text-slate-700" />
                        <span className="text-[10px] font-mono text-slate-500">{item.code}</span>
                      </div>
                      <h3 className="text-base font-bold text-slate-200 mt-0.5">{item.name}</h3>
                      {item.description && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-1">{item.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="flex flex-col items-end mr-4">
                      <span className="text-[10px] text-slate-600 font-mono">Order: {item.sort_order}</span>
                      <div className="flex items-center gap-1.5 mt-1">
                        {item.is_active ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            <span className="text-[9px] font-bold text-emerald-500/80">ACTIVE</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 text-slate-600" />
                            <span className="text-[9px] font-bold text-slate-600">INACTIVE</span>
                          </>
                        )}
                      </div>
                    </div>
                    <button 
                      onClick={() => openEdit(item)}
                      className="p-3 rounded-xl text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(item.id)}
                      className="p-3 rounded-xl text-slate-500 hover:text-red-500 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              {filteredCodes.length === 0 && (
                <div className="text-center py-24 bg-[#11141d]/30 rounded-[40px] border border-dashed border-white/5 mt-4">
                  <div className="bg-slate-800/20 w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <Search className="w-8 h-8 text-slate-700" />
                  </div>
                  <h3 className="text-slate-400 font-bold">검색 결과가 없습니다</h3>
                  <p className="text-slate-600 text-sm mt-1">다른 키워드나 필터를 사용해 보세요.</p>
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowAddModal(false)} />
          <div className="bg-[#1a1f2e] w-full max-w-lg rounded-[40px] border border-white/10 shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-white/5 bg-gradient-to-br from-blue-600/10 to-transparent">
              <h2 className="text-2xl font-bold text-white mb-1">
                {editingCode ? '코드 정보 수정' : '새 코드 추가'}
              </h2>
              <p className="text-xs text-slate-500 uppercase tracking-widest font-mono">
                {editingCode ? `ID: ${editingCode.id}` : 'Create New Common Code'}
              </p>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">카테고리</label>
                  <input
                    required
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value.toUpperCase()})}
                    placeholder="e.g. POSITION"
                    className="w-full bg-[#11141d] border border-white/10 rounded-2xl py-3 px-4 text-sm focus:outline-none focus:border-blue-500/50"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">코드값</label>
                  <input
                    required
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({...formData, code: e.target.value})}
                    placeholder="e.g. POS_001"
                    className="w-full bg-[#11141d] border border-white/10 rounded-2xl py-3 px-4 text-sm focus:outline-none focus:border-blue-500/50"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">코드명</label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="표시될 이름을 입력하세요"
                  className="w-full bg-[#11141d] border border-white/10 rounded-2xl py-3 px-4 text-sm focus:outline-none focus:border-blue-500/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">정렬 순서</label>
                  <input
                    type="number"
                    value={formData.sort_order}
                    onChange={(e) => setFormData({...formData, sort_order: parseInt(e.target.value)})}
                    className="w-full bg-[#11141d] border border-white/10 rounded-2xl py-3 px-4 text-sm focus:outline-none focus:border-blue-500/50"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">상태</label>
                  <div className="flex p-1 bg-[#11141d] rounded-2xl border border-white/5 h-[46px]">
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, is_active: true})}
                      className={`flex-1 rounded-xl text-[10px] font-bold transition-all ${
                        formData.is_active ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40' : 'text-slate-500'
                      }`}
                    >
                      사용함
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, is_active: false})}
                      className={`flex-1 rounded-xl text-[10px] font-bold transition-all ${
                        !formData.is_active ? 'bg-red-600 text-white shadow-lg shadow-red-900/40' : 'text-slate-500'
                      }`}
                    >
                      사용안함
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">설명</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="코드에 대한 간단한 설명을 입력하세요"
                  rows="3"
                  className="w-full bg-[#11141d] border border-white/10 rounded-2xl py-3 px-4 text-sm focus:outline-none focus:border-blue-500/50 resize-none"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-4 rounded-2xl bg-white/5 text-slate-400 font-bold hover:bg-white/10 transition-all border border-white/5"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 py-4 rounded-2xl bg-blue-600 text-white font-bold hover:bg-blue-500 transition-all shadow-xl shadow-blue-900/40 active:scale-[0.98]"
                >
                  {editingCode ? '수정 완료' : '저장하기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
