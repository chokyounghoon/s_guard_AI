import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCodebook } from '../context/CodebookContext';
import { ChevronLeft, Plus, Search, BookOpen, Trash2, Edit2, CheckCircle2, XCircle, Layers, Loader2, X } from 'lucide-react';

const EMPTY_FORM = { category: '', code: '', name: '', sort_order: 0, is_active: true, description: '' };
const API_BASE = 'https://sguardai.khcho0421.workers.dev';

export default function CodebookManagementPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const { allCodes: codes, isLoading: loading, refreshCodes } = useCodebook();
  const [selectedCat, setSelectedCat] = useState('ALL');
  const [showModal, setShowModal] = useState(false);
  const [editingCode, setEditingCode] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const cats = ['ALL', ...new Set(codes.map(c => c.category))];

  const openAdd = () => { setEditingCode(null); setForm(EMPTY_FORM); setShowModal(true); };
  const openEdit = (item) => {
    setEditingCode(item);
    setForm({ category: item.category, code: item.code, name: item.name, sort_order: item.sort_order, is_active: item.is_active === 1, description: item.description || '' });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const method = editingCode ? 'PUT' : 'POST';
    const url = editingCode ? `${API_BASE}/sms/codebook/${editingCode.id}` : `${API_BASE}/sms/codebook`;
    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (res.ok) { setShowModal(false); refreshCodes(); }
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    try { const res = await fetch(`${API_BASE}/sms/codebook/${id}`, { method: 'DELETE' }); if (res.ok) refreshCodes(); } catch (e) { console.error(e); }
  };

  const filtered = codes.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q) || c.category.toLowerCase().includes(q);
    return matchSearch && (selectedCat === 'ALL' || c.category === selectedCat);
  });

  const stats = [
    { label: 'Total', value: codes.length, color: '#818cf8' },
    { label: 'Categories', value: cats.length - 1, color: '#60a5fa' },
    { label: 'Active', value: codes.filter(c => c.is_active).length, color: '#34d399' },
  ];

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'linear-gradient(160deg,#05080f,#090c1a)', fontFamily: "'Pretendard','Inter',sans-serif", color: '#cbd5e1' }}>
      <style>{`
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        input::placeholder,textarea::placeholder{color:#1e293b}
        input:focus,textarea:focus,select:focus{outline:none;border-color:rgba(129,140,248,.4)!important}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:rgba(129,140,248,.2);border-radius:99px}
      `}</style>

      {/* 헤더 */}
      <header style={{ flexShrink:0, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'13px 16px', borderBottom:'1px solid rgba(129,140,248,.12)', background:'rgba(5,8,15,.96)', backdropFilter:'blur(20px)' }}>
        <button onClick={() => navigate(-1)} style={{ width:36, height:36, borderRadius:10, background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.08)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
          <ChevronLeft size={18} color="#64748b" />
        </button>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:16, fontWeight:900, background:'linear-gradient(90deg,#818cf8,#a78bfa)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>코드북 관리</div>
          <div style={{ fontSize:10, color:'#6366f1', fontWeight:800, letterSpacing:'0.12em', opacity:.7 }}>COMMON CODE MANAGEMENT</div>
        </div>
        <button onClick={openAdd} style={{ width:36, height:36, borderRadius:10, background:'rgba(129,140,248,.12)', border:'1px solid rgba(129,140,248,.25)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
          <Plus size={18} color="#818cf8" />
        </button>
      </header>

      {/* 통계 */}
      <div style={{ flexShrink:0, display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, padding:'10px 16px 0' }}>
        {stats.map(s => (
          <div key={s.label} style={{ background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.07)', borderRadius:14, padding:'10px', textAlign:'center' }}>
            <div style={{ fontSize:24, fontWeight:900, color:s.color, fontFamily:'monospace' }}>{s.value}</div>
            <div style={{ fontSize:10, color:'#334155', fontWeight:800, marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* 검색 */}
      <div style={{ flexShrink:0, position:'relative', padding:'10px 16px 0' }}>
        <Search size={14} color="#475569" style={{ position:'absolute', left:28, top:'50%', transform:'translateY(-35%)' }} />
        <input type="text" placeholder="코드명, 코드값, 카테고리 검색..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ width:'100%', boxSizing:'border-box', background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.08)', borderRadius:12, padding:'11px 14px 11px 36px', color:'#e2e8f0', fontSize:14 }} />
      </div>

      {/* 카테고리 필터 */}
      <div style={{ flexShrink:0, display:'flex', gap:6, padding:'8px 16px 0', overflowX:'auto', scrollbarWidth:'none' }}>
        {cats.map(cat => (
          <button key={cat} onClick={() => setSelectedCat(cat)} style={{
            flexShrink:0, padding:'7px 14px', borderRadius:10, cursor:'pointer', fontSize:13, fontWeight:800, whiteSpace:'nowrap',
            background: selectedCat === cat ? 'rgba(129,140,248,.12)' : 'rgba(255,255,255,.03)',
            border: selectedCat === cat ? '1px solid rgba(129,140,248,.3)' : '1px solid rgba(255,255,255,.06)',
            color: selectedCat === cat ? '#818cf8' : '#475569',
          }}>{cat}</button>
        ))}
      </div>

      {/* 목록 */}
      <div style={{ flex:1, minHeight:0, overflowY:'auto', padding:'10px 16px 16px', display:'flex', flexDirection:'column', gap:8 }}>
        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:100 }}>
            <Loader2 size={22} color="#818cf8" style={{ animation:'spin 1s linear infinite' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:40, fontSize:14, color:'#334155' }}>검색 결과 없음</div>
        ) : filtered.map(item => (
          <div key={item.id} style={{ borderRadius:18, padding:'14px 16px', background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.07)', display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ width:44, height:44, borderRadius:13, background: item.is_active ? 'rgba(129,140,248,.1)' : 'rgba(71,85,105,.1)', border:`1px solid ${item.is_active ? 'rgba(129,140,248,.2)' : 'rgba(71,85,105,.2)'}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <BookOpen size={18} color={item.is_active ? '#818cf8' : '#475569'} />
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
                <span style={{ fontSize:11, fontWeight:800, color:'#818cf8', background:'rgba(129,140,248,.1)', border:'1px solid rgba(129,140,248,.2)', borderRadius:5, padding:'1px 7px' }}>{item.category}</span>
                <span style={{ fontSize:11, fontFamily:'monospace', color:'#475569' }}>{item.code}</span>
              </div>
              <div style={{ fontSize:15, fontWeight:800, color:'#f1f5f9', marginBottom:2 }}>{item.name}</div>
              {item.description && <div style={{ fontSize:12, color:'#475569', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.description}</div>}
              <div style={{ marginTop:4, display:'flex', alignItems:'center', gap:5 }}>
                {item.is_active ? <CheckCircle2 size={12} color="#10b981" /> : <XCircle size={12} color="#475569" />}
                <span style={{ fontSize:11, color: item.is_active ? '#10b981' : '#475569', fontWeight:700 }}>{item.is_active ? 'ACTIVE' : 'INACTIVE'}</span>
                <span style={{ fontSize:11, color:'#334155', marginLeft:8 }}>순서 {item.sort_order}</span>
              </div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:6, flexShrink:0 }}>
              <button onClick={() => openEdit(item)} style={{ width:34, height:34, borderRadius:10, background:'rgba(129,140,248,.08)', border:'1px solid rgba(129,140,248,.2)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                <Edit2 size={14} color="#818cf8" />
              </button>
              <button onClick={() => handleDelete(item.id)} style={{ width:34, height:34, borderRadius:10, background:'rgba(239,68,68,.06)', border:'1px solid rgba(239,68,68,.15)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                <Trash2 size={14} color="#ef4444" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 모달 */}
      {showModal && (
        <div style={{ position:'fixed', inset:0, zIndex:200, display:'flex', alignItems:'flex-end' }}>
          <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,.6)', backdropFilter:'blur(8px)' }} onClick={() => setShowModal(false)} />
          <div style={{ position:'relative', width:'100%', background:'#0e1120', borderRadius:'24px 24px 0 0', border:'1px solid rgba(255,255,255,.1)', padding:'20px 20px 36px', maxHeight:'85dvh', overflowY:'auto' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
              <div>
                <div style={{ fontSize:18, fontWeight:900, color:'#f1f5f9' }}>{editingCode ? '코드 수정' : '코드 추가'}</div>
                <div style={{ fontSize:11, color:'#475569' }}>{editingCode ? `ID: ${editingCode.id}` : 'New Common Code'}</div>
              </div>
              <button onClick={() => setShowModal(false)} style={{ width:34, height:34, borderRadius:10, background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.08)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                <X size={16} color="#64748b" />
              </button>
            </div>
            <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                {[{ label:'카테고리 *', key:'category', ph:'POSITION', upper:true }, { label:'코드값 *', key:'code', ph:'POS_001' }].map(f => (
                  <div key={f.key}>
                    <div style={{ fontSize:11, color:'#475569', fontWeight:800, marginBottom:5 }}>{f.label}</div>
                    <input required type="text" placeholder={f.ph} value={form[f.key]} onChange={e => setForm({...form, [f.key]: f.upper ? e.target.value.toUpperCase() : e.target.value})}
                      style={{ width:'100%', boxSizing:'border-box', background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.1)', borderRadius:10, padding:'10px 12px', color:'#e2e8f0', fontSize:14 }} />
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize:11, color:'#475569', fontWeight:800, marginBottom:5 }}>코드명 *</div>
                <input required type="text" placeholder="표시될 이름" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                  style={{ width:'100%', boxSizing:'border-box', background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.1)', borderRadius:10, padding:'10px 12px', color:'#e2e8f0', fontSize:14 }} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div>
                  <div style={{ fontSize:11, color:'#475569', fontWeight:800, marginBottom:5 }}>정렬 순서</div>
                  <input type="number" value={form.sort_order} onChange={e => setForm({...form, sort_order: parseInt(e.target.value)||0})}
                    style={{ width:'100%', boxSizing:'border-box', background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.1)', borderRadius:10, padding:'10px 12px', color:'#e2e8f0', fontSize:14 }} />
                </div>
                <div>
                  <div style={{ fontSize:11, color:'#475569', fontWeight:800, marginBottom:5 }}>상태</div>
                  <div style={{ display:'flex', gap:6 }}>
                    {[{ label:'사용', val:true, color:'#10b981' }, { label:'미사용', val:false, color:'#ef4444' }].map(b => (
                      <button key={b.label} type="button" onClick={() => setForm({...form, is_active: b.val})} style={{
                        flex:1, padding:'10px 0', borderRadius:10, cursor:'pointer', fontSize:13, fontWeight:800,
                        background: form.is_active === b.val ? `${b.color}18` : 'rgba(255,255,255,.04)',
                        border: form.is_active === b.val ? `1px solid ${b.color}40` : '1px solid rgba(255,255,255,.08)',
                        color: form.is_active === b.val ? b.color : '#475569',
                      }}>{b.label}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <div style={{ fontSize:11, color:'#475569', fontWeight:800, marginBottom:5 }}>설명</div>
                <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={2} placeholder="간단한 설명..."
                  style={{ width:'100%', boxSizing:'border-box', background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.1)', borderRadius:10, padding:'10px 12px', color:'#e2e8f0', fontSize:14, resize:'none' }} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr', gap:10, marginTop:4 }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ padding:'14px', borderRadius:12, background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.08)', color:'#64748b', fontSize:14, fontWeight:700, cursor:'pointer' }}>취소</button>
                <button type="submit" style={{ padding:'14px', borderRadius:12, background:'linear-gradient(135deg,#4f46e5,#818cf8)', border:'none', color:'#fff', fontSize:14, fontWeight:800, cursor:'pointer' }}>{editingCode ? '수정 완료' : '저장하기'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
