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
  
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: 'GENERAL',
    tags: '',
    file: null
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'

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
        ? `${API_BASE}/ai/knowledge/search?q=${encodeURIComponent(query)}`
        : `${API_BASE}/ai/knowledge`;
        
      const res = await fetch(url, { headers: getAuthHeaders() });
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
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    try {
      // DIFY GOVERNANCE KEY
      const DIFY_API_KEY = "app-QHxJQTBSKJlTw2gVeGgTk915";
      const DIFY_API_BASE = "https://api.dify.ai/v1";
      const savedUser = JSON.parse(localStorage.getItem('sguard_user') || '{}');
      const userId = savedUser.employee_id || 'sguard-system';

      let fileId = null;
      let sguardcontent = [];

      // 1. Upload file if exists
      if (formData.file) {
        const formDataUpload = new FormData();
        formDataUpload.append('file', formData.file);
        formDataUpload.append('user', userId);
        
        const uploadRes = await fetch(`${DIFY_API_BASE}/files/upload`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${DIFY_API_KEY}`
          },
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
      const sguardlog = `[지식 제목]: ${formData.title}
[카테고리]: ${formData.category}
[태그]: ${formData.tags || '없음'}

[상세 내용]:
${formData.content}`;

      // 3. Call Dify Workflow
      const payload = {
        inputs: {
          sguardlog: sguardlog,
          sguardcontent: sguardcontent
        },
        response_mode: 'blocking',
        user: userId
      };

      const workflowRes = await fetch(`${DIFY_API_BASE}/workflows/run`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DIFY_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!workflowRes.ok) throw new Error('Dify 지식 등록 워크플로우 실패');
      
      const result = await workflowRes.json();
      console.log('Dify Workflow Result:', result);
      
      // 4. Save to our own Local DB for proper title/content indexing 
      // (This guarantees the exact Title and Content are inserted since Dify workflow might have mapping issues)
      const localSaveRes = await fetch(`${API_BASE}/ai/knowledge/save`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...formData, // Has title, content, category, tags
          id: editingEntry ? editingEntry.id : undefined,
          user_id: userId
        })
      });
      if (!localSaveRes.ok) {
        console.warn('Local save failed, but Dify might have succeeded');
      }

      setShowAddModal(false);
      setEditingEntry(null);
      setFormData({ title: '', content: '', category: 'GENERAL', tags: '', file: null });
      
      alert('지식이 AI 데이터베이스에 성공적으로 등록되었습니다.');
      // Refresh local list
      fetchKnowledge();
      
    } catch (err) {
      console.error("Save knowledge error:", err);
      alert('등록 중 오류가 발생했습니다: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`${API_BASE}/ai/knowledge/${id}`, { 
        method: 'DELETE',
        headers: getAuthHeaders()
      });
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
    <div className="min-h-screen bg-[#0f1219] text-white p-6 pb-24">
      {/* Header Area */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => goBack()}
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
            setFormData({ title: '', content: '', category: 'GENERAL', tags: '', file: null });
            setShowAddModal(true);
          }}
          className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-blue-500/20"
        >
          <Plus className="w-5 h-5" />
          신규 지식 등록
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="max-w-7xl mx-auto bg-[#1a1f2e] border border-white/5 rounded-2xl p-4 mb-8 flex flex-col gap-4 shadow-xl">
        {/* 1행: 검색 + 필터 토글 + 카테고리 + 보기모드 */}
        <div className="flex flex-col md:flex-row gap-3 items-center">
          <div className="flex-1 w-full relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              type="text" 
              placeholder="지식 제목, 태그, 본문 내용 검색... (Enter 시 시맨틱 검색)" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleSearchKeyPress}
              className="w-full bg-[#0f1219] border border-white/10 rounded-xl py-2.5 pl-11 pr-4 text-sm focus:outline-none focus:border-blue-500 transition-all text-white"
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
          
          {/* 필터 토글 & 재조회 버튼 (WarRoom 스타일) */}
          <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
            <button
              onClick={() => setShowFilterPanel(prev => !prev)}
              className={`flex-1 md:flex-none px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                showFilterPanel 
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40 shadow-lg shadow-blue-500/10' 
                  : 'bg-[#0f1219] text-slate-400 border border-white/5 hover:border-white/20 hover:text-white'
              }`}
            >
              <Filter className={`w-4 h-4 ${showFilterPanel ? 'text-blue-400' : 'text-slate-500'}`} />
              <span>상세 조건 필터 {startDate || endDate ? '(1)' : ''}</span>
            </button>
            <button
              onClick={() => fetchKnowledge(searchTerm)}
              disabled={loading}
              title="데이터 재조회"
              className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 text-blue-400 transition-all cursor-pointer shadow-sm active:scale-95 flex items-center justify-center"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          
          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
            <Filter className="w-4 h-4 text-slate-500 shrink-0 mr-1 hidden md:block" />
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  selectedCategory === cat ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-[#0f1219] text-slate-400 border border-white/5 hover:border-white/20'
                }`}
              >
                {cat.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4 border-l border-white/5 pl-4 ml-2 hidden md:flex">
            <div className="flex bg-[#0f1219] rounded-lg p-1 border border-white/5">
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md transition-all cursor-pointer ${viewMode === 'list' ? 'bg-blue-500/20 text-blue-400' : 'text-slate-500 hover:text-white'}`}
                title="리스트 보기"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md transition-all cursor-pointer ${viewMode === 'grid' ? 'bg-blue-500/20 text-blue-400' : 'text-slate-500 hover:text-white'}`}
                title="그리드 보기"
              >
                <LayoutDashboard className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* 상세 필터 패널 (WarRoom 스타일) */}
        {showFilterPanel && (
          <div className="bg-[#0f1219]/90 border border-blue-500/30 rounded-2xl p-5 animate-in fade-in slide-in-from-top-2 duration-200 mt-2 shadow-2xl">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/5">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-200">
                <Calendar className="w-4 h-4 text-blue-500" />
                <span>등록 일시 상세 조회 조건</span>
              </div>
              <span className="text-[10px] text-blue-400 font-mono bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/20 font-black tracking-wider">
                DATE RANGE FILTER
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
              <div className="bg-[#1a1f2e] border border-white/5 rounded-xl p-3.5 shadow-inner">
                <label className="text-xs font-bold text-slate-400 block mb-2">시작 일시 (From)</label>
                <input 
                  type="datetime-local" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)} 
                  className="w-full bg-transparent text-white font-mono focus:outline-none text-sm [color-scheme:dark] cursor-pointer" 
                />
              </div>
              <div className="bg-[#1a1f2e] border border-white/5 rounded-xl p-3.5 shadow-inner">
                <label className="text-xs font-bold text-slate-400 block mb-2">종료 일시 (To)</label>
                <input 
                  type="datetime-local" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)} 
                  className="w-full bg-transparent text-white font-mono focus:outline-none text-sm [color-scheme:dark] cursor-pointer" 
                />
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-4 border-t border-white/5">
              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <span className="text-xs text-slate-500 font-bold mr-1 hidden md:inline">간편 기간 :</span>
                <button 
                  onClick={() => {
                    const d = new Date(); d.setDate(d.getDate() - 7);
                    const pad = n => String(n).padStart(2, '0');
                    setStartDate(`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T00:00`);
                    setEndDate(`${new Date().getFullYear()}-${pad(new Date().getMonth()+1)}-${pad(new Date().getDate())}T23:59`);
                  }}
                  className="flex-1 md:flex-none px-3 py-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 font-bold text-xs hover:bg-blue-500/30 transition-all shadow-sm cursor-pointer"
                >
                  최근 7일 (기본)
                </button>
                <button 
                  onClick={() => {
                    const d = new Date(); d.setMonth(d.getMonth() - 1);
                    const pad = n => String(n).padStart(2, '0');
                    setStartDate(`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T00:00`);
                    setEndDate(`${new Date().getFullYear()}-${pad(new Date().getMonth()+1)}-${pad(new Date().getDate())}T23:59`);
                  }}
                  className="flex-1 md:flex-none px-3 py-2 rounded-xl bg-[#1a1f2e] text-slate-300 border border-white/5 font-bold text-xs hover:bg-white/10 transition-all cursor-pointer"
                >
                  최근 1개월
                </button>
                <button 
                  onClick={() => {
                    const d = new Date(); d.setMonth(d.getMonth() - 3);
                    const pad = n => String(n).padStart(2, '0');
                    setStartDate(`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T00:00`);
                    setEndDate(`${new Date().getFullYear()}-${pad(new Date().getMonth()+1)}-${pad(new Date().getDate())}T23:59`);
                  }}
                  className="flex-1 md:flex-none px-3 py-2 rounded-xl bg-[#1a1f2e] text-slate-300 border border-white/5 font-bold text-xs hover:bg-white/10 transition-all cursor-pointer"
                >
                  최근 3개월
                </button>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <button 
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                  }}
                  className="flex-1 md:flex-none px-4 py-2 rounded-xl bg-[#1a1f2e] text-slate-400 border border-white/5 font-bold text-xs hover:bg-white/10 hover:text-white transition-all cursor-pointer"
                >
                  초기화 (전체 기간)
                </button>
                <button 
                  onClick={() => setShowFilterPanel(false)}
                  className="flex-1 md:flex-none px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all shadow-lg shadow-blue-600/20 cursor-pointer"
                >
                  필터 패널 닫기
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Knowledge List Render */}
      <div className={`max-w-7xl mx-auto ${viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'flex flex-col gap-4'}`}>
        {loading ? (
          Array(6).fill(0).map((_, i) => (
            <div key={i} className="h-64 bg-[#1a1f2e] rounded-2xl animate-pulse border border-white/5" />
          ))
        ) : filteredKnowledge.length > 0 ? (
          filteredKnowledge.map(item => (
            viewMode === 'grid' ? (
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
                      setFormData({ ...item, file: null });
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
            ) : (
              // List View Card
              <div key={item.id} className="group bg-[#1a1f2e] border border-white/5 rounded-2xl p-4 flex flex-col md:flex-row md:items-center gap-4 hover:border-blue-500/30 transition-all shadow-lg">
                <div className="flex-1 min-w-0 flex flex-col md:flex-row md:items-center gap-4">
                  <div className="shrink-0 w-28">
                    <span className="bg-blue-500/20 text-blue-400 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter">
                      {item.category}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-base font-bold group-hover:text-blue-400 transition-colors truncate">
                        {item.title}
                      </h3>
                      {item.score !== undefined && item.score !== null && !isNaN(item.score) && (
                        <div className="shrink-0 bg-blue-500/20 border border-blue-500/30 rounded-md px-1.5 py-0.5 flex items-center gap-1">
                          <Zap className="w-2.5 h-2.5 text-blue-400" />
                          <span className="text-[9px] font-black text-blue-400">{Math.round(item.score * 100)}%</span>
                        </div>
                      )}
                    </div>
                    <p className="text-slate-400 text-xs truncate">
                      {item.content}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1 w-full md:w-48 mt-2 md:mt-0">
                    {(item.tags || '').split(',').filter(t => t.trim()).slice(0, 3).map(tag => (
                      <span key={tag} className="text-[9px] text-slate-500 bg-white/5 px-1.5 py-0.5 rounded truncate max-w-[80px]">
                        {tag.trim()}
                      </span>
                    ))}
                  </div>
                </div>
                
                <div className="shrink-0 flex items-center justify-between md:justify-end gap-4 md:border-l md:border-white/5 md:pl-6 min-w-0 md:min-w-[140px] mt-3 md:mt-0 pt-3 md:pt-0 border-t border-white/5 md:border-t-0">
                  <div className="flex flex-col items-start md:items-end gap-1 text-[10px] text-slate-500">
                    <div className="flex items-center gap-1.5 font-mono">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(item.reg_dt).toLocaleDateString()}</span>
                    </div>
                    {item.file_url && (
                      <div className="flex items-center gap-1.5 text-blue-400">
                        <LinkIcon className="w-3 h-3" />
                        <span>첨부됨</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1.5">
                    <button 
                      onClick={() => {
                        setEditingEntry(item);
                        setFormData({ ...item, file: null });
                        setShowAddModal(true);
                      }}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500 hover:text-blue-400 transition-all border border-white/5 bg-[#0f1219]"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => handleDelete(item.id)}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500 hover:text-red-400 transition-all border border-white/5 bg-[#0f1219]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )
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
      {showAddModal && createPortal(
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
                <div className="space-y-1.5 flex flex-col justify-end">
                  <label className="text-xs font-bold text-slate-400 ml-1">첨부 파일 (선택)</label>
                  <label className="w-full bg-[#0f1219] border border-white/10 rounded-xl py-3 px-4 text-sm hover:border-blue-500 transition-all text-slate-300 cursor-pointer flex items-center justify-between">
                    <span className="truncate flex-1">{formData.file ? formData.file.name : '증적 자료 업로드 (이미지/문서)'}</span>
                    <input 
                      type="file" 
                      className="hidden"
                      onChange={(e) => setFormData({...formData, file: e.target.files[0]})}
                    />
                  </label>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 ml-1">태그 (콤마 구분)</label>
                  <input 
                    type="text" 
                    value={formData.tags}
                    onChange={(e) => setFormData({...formData, tags: e.target.value})}
                    placeholder="db, incident, manual"
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
                  disabled={isSubmitting}
                  className={`flex-1 ${isSubmitting ? 'bg-blue-800 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500'} text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98]`}
                >
                  {isSubmitting ? '데이터를 전송하는 중...' : (editingEntry ? '수정 완료' : '등록 완료')}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
