import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, Plus, Filter, FileText, Image as ImageIcon, Link as LinkIcon, Trash2, Edit3, X, ChevronRight, BookOpen, Tag, Calendar, User, ArrowLeft, Sparkles, Zap, LayoutDashboard, List, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useBackNavigation } from '../hooks/useBackNavigation';
import { getAuthHeaders } from '../lib/authStore';

const API_BASE = 'https://sguardai.khcho0421.workers.dev';

export default function KnowledgeBasePage() {
  const navigate = useNavigate();
  const goBack = useBackNavigation('/dashboard');
  const [knowledge, setKnowledge] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [detailEntry, setDetailEntry] = useState(null); // 상세 보기 모달
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
  const [confirmModal, setConfirmModal] = useState({ show: false, id: null });
  
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: 'GENERAL',
    tags: '',
    file: null
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'

  const showToast = (message, type = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'info' }), 3000);
  };

  const getDefaultStartDate = () => {
    const d = new Date(); d.setDate(d.getDate() - 7);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T00:00`;
  };
  const getDefaultEndDate = () => {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T23:59`;
  };

  const [startDate, setStartDate] = useState(() => getDefaultStartDate());
  const [endDate, setEndDate] = useState(() => getDefaultEndDate());
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  const categories = ['all', 'SECURITY', 'DB', 'DEVOPS', 'INFRA', 'GENERAL'];

  useEffect(() => {
    fetchKnowledge();
  }, []);

  const fetchKnowledge = async (query = '') => {
    setLoading(true);
    try {
      const url = query.trim() 
        ? `https://sguardai.khcho0421.workers.dev/ai/knowledge/search?q=${encodeURIComponent(query)}`
        : `https://sguardai.khcho0421.workers.dev/ai/knowledge`;
        
      const res = await fetch(url, { 
        headers: getAuthHeaders(),
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setKnowledge(data.results || []);
      }
    } catch (err) {
      console.error("Fetch knowledge error:", err);
      showToast("AI 지식 베이스 조회 중 요류가 발생했습니다.", "error");
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
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    try {
      const savedUser = JSON.parse(localStorage.getItem('sguard_user') || '{}');
      const userId = savedUser.employee_id || 'sguard-system';

      let fileId = null;
      let sguardcontent = [];

      // 1. Upload file if exists
      if (formData.file) {
        const formDataUpload = new FormData();
        formDataUpload.append('file', formData.file);
        formDataUpload.append('user', userId);
        
        const uploadRes = await fetch(`${API_BASE}/ai/dify/knowledge/upload`, {
          method: 'POST',
          headers: getAuthHeaders({}),
          body: formDataUpload
        });
        
        if (!uploadRes.ok) throw new Error('파일 업로드 실패 (Dify 연동)');
        const uploadData = await uploadRes.json();
        if (!uploadData.id) throw new Error('업로드 ID를 받을 수 없습니다.');
        fileId = uploadData.id;
        
        const type = formData.file.type.startsWith('image/') ? 'image' : 'document';
        sguardcontent = [{
          type: type,
          transfer_method: 'local_file',
          upload_file_id: fileId
        }];
      }

      // 2. Prepare sguardlog
      const sguardlog = `[지식 제목]: ${formData.title}\n[카테고리]: ${formData.category}\n[태그]: ${formData.tags || '없음'}\n\n[상세 내용]:\n${formData.content}`;

      // 3. Call Dify Workflow
      const payload = {
        inputs: {
          sguardlog: sguardlog,
          sguardcontent: sguardcontent
        },
        response_mode: 'blocking',
        user: userId
      };

      const workflowRes = await fetch(`${API_BASE}/ai/dify/knowledge/workflow`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload)
      });

      if (!workflowRes.ok) throw new Error('Dify 지식 등록 워크플로우 실패');
      
      // 4. Save to our own Local DB for proper title/content indexing 
      const localSaveRes = await fetch(`${API_BASE}/ai/knowledge/save`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...formData,
          id: editingEntry ? editingEntry.id : undefined,
          user_id: userId
        })
      });
      
      setShowAddModal(false);
      setEditingEntry(null);
      setFormData({ title: '', content: '', category: 'GENERAL', tags: '', file: null });
      
      showToast('지식이 성공적으로 등록되었습니다.', 'success');
      fetchKnowledge();
      
    } catch (err) {
      console.error("Save knowledge error:", err);
      showToast('등록 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!confirmModal.id) return;
    try {
      const res = await fetch(`${API_BASE}/ai/knowledge/${confirmModal.id}`, { 
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        showToast('성공적으로 삭제되었습니다.', 'success');
        fetchKnowledge();
      }
    } catch (err) {
      console.error("Delete knowledge error:", err);
      showToast('삭제 중 오류가 발생했습니다.', 'error');
    } finally {
      setConfirmModal({ show: false, id: null });
    }
  };

  const filteredKnowledge = knowledge.filter(k => {
    const matchesSearch = (k.title || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (k.content || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (k.tags || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || k.category === selectedCategory;
    
    let matchesDate = true;
    if (k.reg_dt) {
      const itemTime = new Date(k.reg_dt.replace(' ', 'T')).getTime();
      const startTime = startDate ? new Date(startDate).getTime() : 0;
      const endTime = endDate ? new Date(endDate).getTime() : Infinity;
      if (!isNaN(itemTime)) {
        matchesDate = itemTime >= startTime && itemTime <= endTime;
      }
    }
    
    return matchesSearch && matchesCategory && matchesDate;
  });

  return (
    <div className="min-h-full bg-[#050505] text-white font-sans flex flex-col pb-10 relative">
      {/* Background Glows */}
      <div className="absolute top-0 left-0 w-[50%] h-[50%] bg-blue-600/20 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute top-[20%] right-0 w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full pointer-events-none" />

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 relative z-10 pt-8">
        
        {/* Header Banner Area */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 relative z-40">
          <div className="flex flex-col gap-2">
            <button 
              type="button"
              onClick={() => goBack()}
              className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-400 transition-all mb-2 cursor-pointer z-50"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 md:gap-4">
              <div className="shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <BookOpen className="w-5 h-5 md:w-6 md:h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 truncate">
                  Universal Knowledge Base
                </h1>
                <p className="text-slate-400 text-[11px] md:text-sm mt-0.5 md:mt-1 font-medium truncate">지능형 관제 시스템 통합 지식 창고</p>
              </div>
            </div>
          </div>
          
          <button 
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setEditingEntry(null);
              setFormData({ title: '', content: '', category: 'GENERAL', tags: '', file: null });
              setShowAddModal(true);
            }}
            className="group relative px-6 py-3 bg-blue-600 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(37,99,235,0.4)] overflow-hidden cursor-pointer z-50"
          >
            <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] pointer-events-none" />
            <Plus className="w-5 h-5 relative z-10 pointer-events-none" />
            <span className="relative z-10 pointer-events-none">신규 지식 등록</span>
          </button>
        </div>

        {/* Floating Search & Filter Bar */}
        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-4 mb-10 shadow-2xl relative z-20">
          <div className="flex flex-col lg:flex-row gap-4 items-center">
            
            {/* Search Input */}
            <div className="flex-1 w-full relative group">
              <div className="absolute inset-0 bg-blue-500/10 rounded-2xl blur-md opacity-0 group-focus-within:opacity-100 transition-opacity" />
              <div className="relative flex items-center bg-black/40 border border-white/10 rounded-2xl px-4 py-3 focus-within:border-blue-500/50 transition-colors">
                <Search className="w-5 h-5 text-slate-500 mr-3" />
                <input 
                  type="text" 
                  placeholder="지식 제목, 태그, 본문 내용 검색... (Enter 시 시맨틱 검색)" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={handleSearchKeyPress}
                  className="w-full bg-transparent text-sm focus:outline-none text-white placeholder-slate-500"
                />
                {searchTerm && (
                  <button onClick={() => { setSearchTerm(''); fetchKnowledge(''); }} className="p-1 hover:bg-white/10 rounded-full ml-2">
                    <X className="w-4 h-4 text-slate-400" />
                  </button>
                )}
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex items-center gap-3 w-full lg:w-auto overflow-x-auto scrollbar-hide pb-2 lg:pb-0">
              <button
                onClick={() => setShowFilterPanel(prev => !prev)}
                className={`shrink-0 px-5 py-3 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer border ${
                  showFilterPanel 
                    ? 'bg-blue-500/20 text-blue-400 border-blue-500/40 shadow-[0_0_15px_rgba(59,130,246,0.2)]' 
                    : 'bg-black/40 text-slate-400 border-white/10 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Filter className={`w-4 h-4 ${showFilterPanel ? 'text-blue-400' : 'text-slate-500'}`} />
                <span>상세 조건 {startDate || endDate ? '(1)' : ''}</span>
              </button>

              <button
                onClick={() => fetchKnowledge(searchTerm)}
                disabled={loading}
                title="데이터 재조회"
                className="shrink-0 p-3 rounded-2xl bg-black/40 border border-white/10 hover:bg-white/5 text-slate-400 hover:text-blue-400 transition-all cursor-pointer"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>

              <div className="w-px h-8 bg-white/10 mx-1 shrink-0" />

              {/* View Toggle */}
              <div className="flex bg-black/40 rounded-xl p-1 border border-white/10 shrink-0">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-500 hover:text-white'}`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-500 hover:text-white'}`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Categories */}
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/5 overflow-x-auto scrollbar-hide">
            <Tag className="w-4 h-4 text-slate-500 shrink-0 mr-2" />
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-[11px] font-black tracking-wider transition-all whitespace-nowrap cursor-pointer border ${
                  selectedCategory === cat 
                    ? 'bg-blue-500/20 text-blue-400 border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.2)]' 
                    : 'bg-transparent text-slate-400 border-transparent hover:bg-white/5'
                }`}
              >
                {cat.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Expandable Filter Panel */}
        {showFilterPanel && (
          <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-3xl p-6 mb-10 animate-in fade-in slide-in-from-top-4 duration-300 shadow-2xl relative z-10 -mt-6">
            <div className="flex items-center gap-2 font-bold text-sm text-slate-200 mb-6">
              <Calendar className="w-4 h-4 text-blue-500" />
              <span>조회 기간 설정</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 ml-1">시작 일시</label>
                <input 
                  type="datetime-local" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)} 
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50 [color-scheme:dark]" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 ml-1">종료 일시</label>
                <input 
                  type="datetime-local" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)} 
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50 [color-scheme:dark]" 
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/5">
              <div className="flex flex-wrap gap-2">
                <button 
                  onClick={() => {
                    const d = new Date(); d.setDate(d.getDate() - 7);
                    const pad = n => String(n).padStart(2, '0');
                    setStartDate(`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T00:00`);
                    setEndDate(`${new Date().getFullYear()}-${pad(new Date().getMonth()+1)}-${pad(new Date().getDate())}T23:59`);
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 font-bold text-xs hover:bg-blue-500/30 transition-all"
                >
                  최근 7일
                </button>
                <button 
                  onClick={() => {
                    const d = new Date(); d.setMonth(d.getMonth() - 1);
                    const pad = n => String(n).padStart(2, '0');
                    setStartDate(`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T00:00`);
                    setEndDate(`${new Date().getFullYear()}-${pad(new Date().getMonth()+1)}-${pad(new Date().getDate())}T23:59`);
                  }}
                  className="px-4 py-2 rounded-xl bg-white/5 text-slate-300 border border-white/10 font-bold text-xs hover:bg-white/10 transition-all"
                >
                  최근 1개월
                </button>
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={() => { setStartDate(''); setEndDate(''); }}
                  className="px-5 py-2 rounded-xl bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 font-bold text-xs transition-all"
                >
                  기간 초기화
                </button>
                <button 
                  onClick={() => setShowFilterPanel(false)}
                  className="px-5 py-2 rounded-xl bg-white/10 text-white hover:bg-white/20 font-bold text-xs transition-all"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Knowledge List Render */}
      <div className={`max-w-7xl mx-auto ${viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'flex flex-col gap-4'}`}>
        {loading ? (
          Array(6).fill(0).map((_, i) => (
            <div key={i} className="h-64 bg-white/5 rounded-3xl animate-pulse border border-white/10" />
          ))
        ) : filteredKnowledge.length > 0 ? (
          filteredKnowledge.map(item => (
            viewMode === 'grid' ? (
            <div key={item.id} 
              onClick={() => setDetailEntry(item)}
              className="group relative bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl overflow-hidden hover:bg-white/10 hover:border-blue-500/50 hover:shadow-[0_0_30px_rgba(37,99,235,0.15)] transition-all duration-300 flex flex-col h-full cursor-pointer">
              
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />

              {/* Card Meta Header */}
              <div className="p-5 flex items-center justify-between border-b border-white/5 relative z-10">
                <span className="bg-blue-500/20 text-blue-400 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-inner shadow-blue-500/20">
                  {item.category}
                </span>
                <div className="flex gap-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingEntry(item);
                      setFormData({ ...item, file: null });
                      setShowAddModal(true);
                    }}
                    className="p-2 rounded-xl hover:bg-blue-500/20 text-slate-400 hover:text-blue-400 transition-all border border-transparent hover:border-blue-500/30 bg-black/40"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmModal({ show: true, id: item.id });
                    }}
                    className="p-2 rounded-xl hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-all border border-transparent hover:border-red-500/30 bg-black/40"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-6 flex-1 relative z-10">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h3 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors leading-tight flex-1">
                    {item.title}
                  </h3>
                  {item.score !== undefined && item.score !== null && !isNaN(item.score) && (
                    <div className="shrink-0 bg-blue-500/10 border border-blue-500/20 rounded-xl px-2.5 py-1.5 flex items-center gap-1.5 backdrop-blur-md">
                      <Zap className="w-3 h-3 text-blue-400 fill-blue-400/20" />
                      <span className="text-[10px] font-black text-blue-400 font-mono">
                        {Math.max(0, Math.min(100, Math.round(item.score * 100)))}% 일치
                      </span>
                    </div>
                  )}
                </div>
                <p className="text-slate-400 text-sm line-clamp-3 leading-relaxed mb-5 font-medium">
                  {item.content}
                </p>
                
                {item.reason && (
                  <div className="mb-5 bg-blue-500/5 border border-blue-500/10 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Sparkles className="w-3 h-3 text-blue-400" />
                      <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">AI Rationale</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed italic opacity-80">
                      "{item.reason}"
                    </p>
                  </div>
                )}

                {/* Multimodal Preview Placeholder */}
                {item.file_url && (
                  <div className="bg-black/20 rounded-2xl p-3.5 flex items-center gap-3 border border-white/5 mb-5 group-hover:border-white/10 transition-all backdrop-blur-sm">
                    {item.file_type?.includes('image') ? <ImageIcon className="w-5 h-5 text-emerald-400" /> : <FileText className="w-5 h-5 text-orange-400" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Attached</p>
                      <span className="text-xs text-blue-400 truncate block font-medium group-hover:underline">
                        {item.file_url.split('/').pop()}
                      </span>
                    </div>
                  </div>
                )}

                {/* Tags */}
                <div className="flex flex-wrap gap-2 pt-4 border-t border-white/5 mt-auto">
                  {(item.tags || '').split(',').filter(t => t.trim()).map(tag => (
                    <span key={tag} className="text-[10px] font-bold text-slate-400 bg-black/40 px-2.5 py-1 rounded-lg flex items-center gap-1 border border-white/5">
                      <Tag className="w-2.5 h-2.5" />
                      {tag.trim()}
                    </span>
                  ))}
                </div>
              </div>

              {/* Card Footer Footer Info */}
              <div className="px-6 py-4 bg-black/20 border-t border-white/5 flex items-center justify-between text-[11px] font-medium text-slate-500 relative z-10 backdrop-blur-md">
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5" />
                  <span>{item.reg_id}</span>
                </div>
                <div className="flex items-center gap-2 font-mono">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{new Date(item.reg_dt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
            ) : (
              // List View Card
              <div key={item.id} 
                onClick={() => setDetailEntry(item)}
                className="group relative bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-5 flex flex-col md:flex-row md:items-center gap-5 hover:bg-white/10 hover:border-blue-500/50 hover:shadow-[0_0_30px_rgba(37,99,235,0.15)] transition-all duration-300 cursor-pointer overflow-hidden">
                
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                <div className="flex-1 min-w-0 flex flex-col md:flex-row md:items-center gap-5 relative z-10">
                  <div className="shrink-0 w-28">
                    <span className="bg-blue-500/20 text-blue-400 text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest shadow-inner shadow-blue-500/20">
                      {item.category}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1.5">
                      <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors truncate">
                        {item.title}
                      </h3>
                      {item.score !== undefined && item.score !== null && !isNaN(item.score) && (
                        <div className="shrink-0 bg-blue-500/10 border border-blue-500/20 rounded-lg px-2 py-0.5 flex items-center gap-1">
                          <Zap className="w-2.5 h-2.5 text-blue-400" />
                          <span className="text-[10px] font-black text-blue-400 font-mono">{Math.round(item.score * 100)}%</span>
                        </div>
                      )}
                    </div>
                    <p className="text-slate-400 text-sm truncate font-medium">
                      {item.content}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1.5 w-full md:w-48 mt-3 md:mt-0">
                    {(item.tags || '').split(',').filter(t => t.trim()).slice(0, 3).map(tag => (
                      <span key={tag} className="text-[10px] font-bold text-slate-400 bg-black/40 px-2 py-1 rounded-lg border border-white/5 truncate max-w-[80px]">
                        {tag.trim()}
                      </span>
                    ))}
                  </div>
                </div>
                
                <div className="shrink-0 flex items-center justify-between md:justify-end gap-5 md:border-l md:border-white/10 md:pl-6 min-w-0 md:min-w-[160px] mt-4 md:mt-0 pt-4 md:pt-0 border-t border-white/10 md:border-t-0 relative z-10">
                  <div className="flex flex-col items-start md:items-end gap-1.5 text-[11px] font-medium text-slate-500">
                    <div className="flex items-center gap-1.5 font-mono">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{new Date(item.reg_dt).toLocaleDateString()}</span>
                    </div>
                    {item.file_url && (
                      <div className="flex items-center gap-1.5 text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">
                        <LinkIcon className="w-3 h-3" />
                        <span className="font-bold">첨부됨</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingEntry(item);
                        setFormData({ ...item, file: null });
                        setShowAddModal(true);
                      }}
                      className="p-2 rounded-xl hover:bg-blue-500/20 text-slate-400 hover:text-blue-400 transition-all border border-transparent hover:border-blue-500/30 bg-black/40"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmModal({ show: true, id: item.id });
                      }}
                      className="p-2 rounded-xl hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-all border border-transparent hover:border-red-500/30 bg-black/40"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )
          ))
        ) : (
          <div className="col-span-full py-24 flex flex-col items-center justify-center opacity-60">
            <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mb-6 border border-white/10 shadow-[0_0_30px_rgba(255,255,255,0.05)]">
              <Search className="w-8 h-8 text-slate-500" />
            </div>
            <p className="text-xl font-bold text-white mb-2">지식 데이터가 없습니다</p>
            <p className="text-sm text-slate-400 font-medium">신규 지식을 등록하여 팀과 인텔리전스를 공유해보세요.</p>
          </div>
        )}
      </div>
      </main>

      {/* Add/Edit Modal */}
      {showAddModal && createPortal(
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 overflow-y-auto">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className="relative w-full max-w-2xl bg-black/60 backdrop-blur-2xl border border-white/10 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/5">
              <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                <Plus className="w-5 h-5 text-blue-500" />
                {editingEntry ? '지식 정보 수정' : '신규 지식 등록'}
              </h2>
              <button 
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-2 rounded-full hover:bg-white/10 text-slate-400 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 ml-1">지식 제목</label>
                  <input 
                    required
                    type="text" 
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    placeholder="지식 제목을 입력하세요"
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-blue-500/50 transition-all text-white placeholder-slate-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 ml-1">카테고리</label>
                  <select 
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-blue-500/50 transition-all text-white appearance-none"
                  >
                    {categories.filter(c => c !== 'all').map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 ml-1">상세 내용</label>
                <textarea 
                  required
                  rows={4}
                  value={formData.content}
                  onChange={(e) => setFormData({...formData, content: e.target.value})}
                  placeholder="지식의 상세 내용을 설명해주세요..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-blue-500/50 transition-all text-white resize-none placeholder-slate-500 custom-scrollbar"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2 flex flex-col justify-end">
                  <label className="text-xs font-bold text-slate-400 ml-1">첨부 파일 (선택)</label>
                  <label className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-sm hover:border-blue-500/50 transition-all text-slate-400 cursor-pointer flex items-center justify-between group">
                    <span className="truncate flex-1 group-hover:text-blue-400 transition-colors">{formData.file ? formData.file.name : '증적 자료 업로드 (이미지/문서)'}</span>
                    <input 
                      type="file" 
                      className="hidden"
                      onChange={(e) => setFormData({...formData, file: e.target.files[0]})}
                    />
                  </label>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 ml-1">태그 (콤마 구분)</label>
                  <input 
                    type="text" 
                    value={formData.tags}
                    onChange={(e) => setFormData({...formData, tags: e.target.value})}
                    placeholder="db, incident, manual"
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-blue-500/50 transition-all text-white placeholder-slate-500"
                  />
                </div>
              </div>

              <div className="pt-6 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-3.5 rounded-xl transition-all"
                >
                  취소
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className={`flex-1 ${isSubmitting ? 'bg-blue-800 cursor-not-allowed opacity-70' : 'bg-blue-600 hover:bg-blue-500 hover:shadow-[0_0_20px_rgba(37,99,235,0.4)]'} text-white font-bold py-3.5 rounded-xl transition-all active:scale-[0.98]`}
                >
                  {isSubmitting ? '데이터를 전송하는 중...' : (editingEntry ? '수정 완료' : '등록 완료')}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Detail View Modal */}
      {detailEntry && createPortal(
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 overflow-y-auto">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setDetailEntry(null)} />
          <div className="relative w-full max-w-3xl bg-black/60 backdrop-blur-2xl border border-white/10 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-white/10 flex items-start justify-between bg-white/5">
              <div>
                <span className="bg-blue-500/20 text-blue-400 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest mb-4 inline-block shadow-inner shadow-blue-500/20">
                  {detailEntry.category}
                </span>
                <h2 className="text-2xl font-bold text-white leading-tight pr-8">
                  {detailEntry.title}
                </h2>
              </div>
              <button 
                type="button"
                onClick={() => setDetailEntry(null)}
                className="p-2 rounded-full hover:bg-white/10 text-slate-400 transition-all absolute top-6 right-6"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-6">
              <div className="bg-black/40 border border-white/10 rounded-2xl p-6 shadow-inner">
                <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-400" /> 상세 내용
                </h3>
                <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap font-mono">
                  {detailEntry.content}
                </div>
              </div>

              {detailEntry.file_url && (
                <div className="bg-black/40 border border-white/10 rounded-2xl p-6 shadow-inner">
                  <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
                    <LinkIcon className="w-4 h-4 text-emerald-400" /> 증적 자료
                  </h3>
                  <a href={detailEntry.file_url} target="_blank" rel="noreferrer" className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-xl hover:border-blue-500/50 hover:bg-white/10 transition-all group">
                    {detailEntry.file_type?.includes('image') ? <ImageIcon className="w-10 h-10 text-emerald-400" /> : <FileText className="w-10 h-10 text-orange-400" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-200 group-hover:text-blue-400 transition-colors truncate mb-1">
                        {detailEntry.file_url.split('/').pop()}
                      </p>
                      <p className="text-[11px] text-slate-500 font-medium">클릭하여 새 창에서 열기</p>
                    </div>
                  </a>
                </div>
              )}
            </div>

            <div className="p-5 border-t border-white/10 bg-white/5 flex items-center justify-between">
              <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
                <div className="flex items-center gap-1.5"><User className="w-4 h-4" /> {detailEntry.reg_id}</div>
                <div className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> {new Date(detailEntry.reg_dt).toLocaleString()}</div>
              </div>
              <button 
                type="button"
                onClick={() => setDetailEntry(null)}
                className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold text-sm transition-all"
              >
                닫기
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Confirm Delete Modal */}
      {confirmModal.show && createPortal(
        <div className="fixed inset-0 z-[410] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setConfirmModal({ show: false, id: null })} />
          <div className="relative bg-black/60 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-[0_0_50px_rgba(0,0,0,0.5)] max-w-sm w-full animate-in zoom-in-95 duration-200 text-center">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
              <Trash2 className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">지식 삭제</h3>
            <p className="text-slate-400 text-sm mb-8 font-medium">정말 이 지식 데이터를 삭제하시겠습니까?<br/>이 작업은 되돌릴 수 없습니다.</p>
            <div className="flex gap-3">
              <button 
                type="button"
                onClick={() => setConfirmModal({ show: false, id: null })}
                className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold text-sm transition-all"
              >
                취소
              </button>
              <button 
                type="button"
                onClick={confirmDelete}
                className="flex-1 px-4 py-3 bg-red-500/20 hover:bg-red-500 hover:shadow-[0_0_20px_rgba(239,68,68,0.4)] text-red-400 hover:text-white border border-red-500/30 hover:border-red-500 rounded-xl font-bold text-sm transition-all"
              >
                삭제 진행
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Toast Notification */}
      {toast.show && createPortal(
        <div className="fixed bottom-6 right-6 z-[420] animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl ${
            toast.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
            toast.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
            'bg-blue-500/10 border-blue-500/20 text-blue-400'
          }`}>
            {toast.type === 'success' ? <Zap className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
            <span className="text-sm font-bold">{toast.message}</span>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
