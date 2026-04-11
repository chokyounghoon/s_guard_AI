import React, { useState, useEffect } from 'react';
import { Search, Plus, Filter, FileText, Image as ImageIcon, Link as LinkIcon, Trash2, Edit3, X, ChevronRight, BookOpen, Tag, Calendar, User, ArrowLeft, Sparkles, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API_BASE = 'https://sguardai.khcho0421.workers.dev';

export default function KnowledgeBasePage() {
  const navigate = useNavigate();
  const [knowledge, setKnowledge] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: 'GENERAL',
    inc_id: '',
    file_url: '',
    file_type: 'text',
    tags: ''
  });

  const categories = ['all', 'SECURITY', 'DB', 'DEVOPS', 'INFRA', 'GENERAL'];

  useEffect(() => {
    fetchKnowledge();
  }, []);

  const fetchKnowledge = async (query = '') => {
    setLoading(true);
    try {
      const url = query.trim() 
        ? `${API_BASE}/ai/knowledge/search?q=${encodeURIComponent(query)}`
        : `${API_BASE}/ai/knowledge`;
        
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setKnowledge(data.results || []);
      }
    } catch (err) {
      console.error("Fetch knowledge error:", err);
      alert("AI 지식 베이스 조회 중 요류가 발생했습니다. 페이지를 새로고침합니다.");
      window.location.reload();
    } finally {
      setLoading(false);
    }
  };

  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      fetchKnowledge(searchTerm);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/ai/knowledge/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingEntry ? { ...formData, id: editingEntry.id } : formData)
      });
      if (res.ok) {
        setShowAddModal(false);
        setEditingEntry(null);
        setFormData({ title: '', content: '', category: 'GENERAL', inc_id: '', file_url: '', file_type: 'text', tags: '' });
        fetchKnowledge();
      }
    } catch (err) {
      console.error("Save knowledge error:", err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`${API_BASE}/ai/knowledge/${id}`, { method: 'DELETE' });
      if (res.ok) fetchKnowledge();
    } catch (err) {
      console.error("Delete knowledge error:", err);
    }
  };

  const filteredKnowledge = knowledge.filter(k => {
    const matchesSearch = (k.title || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (k.content || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (k.tags || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || k.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-[#0f1219] text-white p-6 pb-24">
      {/* Header Area */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/dashboard')}
            className="p-2 rounded-full hover:bg-white/5 text-slate-400 transition-all active:scale-90"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-blue-500" />
              Universal Knowledge Base
            </h1>
            <p className="text-slate-400 text-sm mt-1">지능형 관제 시스템 통합 지식 창고</p>
          </div>
        </div>
        
        <button 
          onClick={() => {
            setEditingEntry(null);
            setFormData({ title: '', content: '', category: 'GENERAL', inc_id: '', file_url: '', file_type: 'text', tags: '' });
            setShowAddModal(true);
          }}
          className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-blue-500/20"
        >
          <Plus className="w-5 h-5" />
          신규 지식 등록
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="max-w-7xl mx-auto bg-[#1a1f2e] border border-white/5 rounded-2xl p-4 mb-8 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input 
            type="text" 
            placeholder="지식 제안, 태그, 본문 내용 검색... (Enter 시 시맨틱 검색)" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleSearchKeyPress}
            className="w-full bg-[#0f1219] border border-white/10 rounded-xl py-2.5 pl-11 pr-4 text-sm focus:outline-none focus:border-blue-500 transition-all"
          />
          {searchTerm && (
            <button 
              onClick={() => { setSearchTerm(''); fetchKnowledge(''); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-white/10 text-slate-500"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
          <Filter className="w-4 h-4 text-slate-500 shrink-0 mr-1" />
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                selectedCategory === cat ? 'bg-blue-500 text-white' : 'bg-[#0f1219] text-slate-400 border border-white/5 hover:border-white/20'
              }`}
            >
              {cat.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Knowledge List Grid */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array(6).fill(0).map((_, i) => (
            <div key={i} className="h-64 bg-[#1a1f2e] rounded-2xl animate-pulse border border-white/5" />
          ))
        ) : filteredKnowledge.length > 0 ? (
          filteredKnowledge.map(item => (
            <div key={item.id} className="group bg-[#1a1f2e] border border-white/5 rounded-2xl overflow-hidden hover:border-blue-500/30 transition-all flex flex-col h-full shadow-lg">
              {/* Card Meta Header */}
              <div className="p-4 flex items-center justify-between border-b border-white/5">
                <span className="bg-blue-500/20 text-blue-400 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter">
                  {item.category}
                </span>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      setEditingEntry(item);
                      setFormData({ ...item });
                      setShowAddModal(true);
                    }}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500 hover:text-blue-400 transition-all"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleDelete(item.id)}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500 hover:text-red-400 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-5 flex-1 cursor-pointer">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="text-lg font-bold group-hover:text-blue-400 transition-colors leading-tight flex-1">
                    {item.title}
                  </h3>
                  {item.score !== undefined && item.score !== null && !isNaN(item.score) && (
                    <div className="shrink-0 bg-blue-500/20 border border-blue-500/30 rounded-lg px-2 py-1 flex items-center gap-1.5 shadow-lg shadow-blue-500/10">
                      <Zap className="w-3 h-3 text-blue-400 fill-blue-400/20" />
                      <span className="text-[10px] font-black text-blue-400 font-mono">
                        {Math.max(0, Math.min(100, Math.round(item.score * 100)))}% 유사도
                      </span>
                    </div>
                  )}
                </div>
                <p className="text-slate-400 text-sm line-clamp-3 leading-relaxed mb-4">
                  {item.content}
                </p>
                
                {item.reason && (
                  <div className="mb-4 bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 animate-in fade-in slide-in-from-left-2 duration-500">
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="w-3 h-3 text-blue-400" />
                      <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Matching Rationale</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed italic">
                      "{item.reason}"
                    </p>
                  </div>
                )}

                {/* Multimodal Preview Placeholder */}
                {item.file_url ? (
                  <div className="bg-[#0f1219] rounded-xl p-3 flex items-center gap-3 border border-white/5 mb-4 group-hover:border-blue-500/20 transition-all">
                    {item.file_type?.includes('image') ? <ImageIcon className="w-5 h-5 text-emerald-400" /> : <FileText className="w-5 h-5 text-orange-400" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-slate-500 uppercase font-black">Attached {item.file_type}</p>
                      <a href={item.file_url} target="_blank" rel="noreferrer" className="text-xs text-blue-400 truncate block hover:underline" onClick={(e) => e.stopPropagation()}>
                        {item.file_url.split('/').pop()}
                      </a>
                    </div>
                  </div>
                ) : null}

                {/* Tags */}
                <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5 mt-4">
                  {(item.tags || '').split(',').filter(t => t.trim()).map(tag => (
                    <span key={tag} className="text-[9px] text-slate-500 bg-white/5 px-2 py-0.5 rounded flex items-center gap-1">
                      <Tag className="w-2 h-2" />
                      {tag.trim()}
                    </span>
                  ))}
                </div>
              </div>

              {/* Card Footer Footer Info */}
              <div className="px-5 py-3 bg-[#11141d] flex items-center justify-between text-[10px] text-slate-500">
                <div className="flex items-center gap-2">
                  <User className="w-3 h-3" />
                  <span>{item.reg_id}</span>
                </div>
                <div className="flex items-center gap-2 font-mono">
                  <Calendar className="w-3 h-3" />
                  <span>{new Date(item.reg_dt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-20 flex flex-col items-center justify-center opacity-40">
            <Search className="w-16 h-16 mb-4 text-slate-600" />
            <p className="text-lg font-bold">지식 데이터가 없습니다.</p>
            <p className="text-sm">신규 지식을 등록하여 팀과 공유해보세요.</p>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className="relative w-full max-w-2xl bg-[#1a1f2e] border border-white/10 rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-blue-600/10 to-transparent">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-500" />
                {editingEntry ? '지식 정보 수정' : '신규 지식 등록'}
              </h2>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-2 rounded-full hover:bg-white/10 text-slate-400 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 ml-1">지식 제목</label>
                  <input 
                    required
                    type="text" 
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    placeholder="지식 제목을 입력하세요"
                    className="w-full bg-[#0f1219] border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-blue-500 transition-all text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 ml-1">카테고리</label>
                  <select 
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    className="w-full bg-[#0f1219] border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-blue-500 transition-all text-white appearance-none"
                  >
                    {categories.filter(c => c !== 'all').map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 ml-1">상세 내용</label>
                <textarea 
                  required
                  rows={4}
                  value={formData.content}
                  onChange={(e) => setFormData({...formData, content: e.target.value})}
                  placeholder="지식의 상세 내용을 설명해주세요..."
                  className="w-full bg-[#0f1219] border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-blue-500 transition-all text-white resize-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 ml-1">파일 URL (Optional)</label>
                  <input 
                    type="text" 
                    value={formData.file_url}
                    onChange={(e) => setFormData({...formData, file_url: e.target.value})}
                    placeholder="https://..."
                    className="w-full bg-[#0f1219] border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-blue-500 transition-all text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 ml-1">파일 형식</label>
                  <select 
                    value={formData.file_type}
                    onChange={(e) => setFormData({...formData, file_type: e.target.value})}
                    className="w-full bg-[#0f1219] border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-blue-500 transition-all text-white appearance-none"
                  >
                    <option value="text">TEXT</option>
                    <option value="image">IMAGE</option>
                    <option value="pdf">PDF</option>
                    <option value="pptx">PPTX/DOC</option>
                    <option value="link">LINK</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 ml-1">관련 인시던트 ID</label>
                  <input 
                    type="text" 
                    value={formData.inc_id}
                    onChange={(e) => setFormData({...formData, inc_id: e.target.value})}
                    placeholder="INC-..."
                    className="w-full bg-[#0f1219] border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-blue-500 transition-all text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 ml-1">태그 (콤마 구분)</label>
                  <input 
                    type="text" 
                    value={formData.tags}
                    onChange={(e) => setFormData({...formData, tags: e.target.value})}
                    placeholder="db, manual, critical"
                    className="w-full bg-[#0f1219] border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-blue-500 transition-all text-white"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-xl transition-all"
                >
                  취소
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98]"
                >
                  {editingEntry ? '수정 완료' : '등록 완료'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
