import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  MessageSquare, FileText, Search, Trash2,
  Send, ArrowLeft, X, Clock, ChevronRight,
  Sparkles, RefreshCw, AlertTriangle, BrainCircuit,
  Inbox, LayoutGrid, Radio, FileBadge, Shield,
  TrendingUp, Zap, Eye, Mail
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import MarkdownViewer from '../components/MarkdownViewer';
import { useBackNavigation } from '../hooks/useBackNavigation';
import { useTheme } from '../context/ThemeContext';

const stripMarkdown = (str = '') =>
  str
    .replace(/\*\*([^*]*)\*\*/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/#{1,6}\s*/g, '')
    .replace(/\n+/g, ' ')
    .trim();

const TABS = [
  { id: 'all',             label: 'All',      sublabel: '전체',   icon: LayoutGrid },
  { id: 'received_report', label: 'Reports',  sublabel: '수신',   icon: FileBadge },
  { id: 'message',         label: 'Messages', sublabel: '쪽지',   icon: Mail },
  { id: 'sent_report',     label: 'Sent',     sublabel: '발행',   icon: Send },
];

function TypeBadge({ type, title, isLight = false }) {
  if (type === 'REPORT') {
    const isCrit = title?.includes('긴급') || title?.includes('CRITICAL');
    return isCrit
      ? { accent: '#ef4444', accentBg: isLight ? '#fef2f2' : 'rgba(239,68,68,0.08)', label: 'CRITICAL', icon: AlertTriangle, glow: isLight ? '0 1px 3px rgba(0,0,0,0.05)' : '0 0 20px rgba(239,68,68,0.2)' }
      : { accent: isLight ? '#059669' : '#10b981', accentBg: isLight ? '#ecfdf5' : 'rgba(16,185,129,0.08)', label: 'AI REPORT', icon: FileBadge, glow: isLight ? '0 1px 3px rgba(0,0,0,0.05)' : '0 0 20px rgba(16,185,129,0.15)' };
  }
  return { accent: isLight ? '#4f46e5' : '#6366f1', accentBg: isLight ? '#eef2ff' : 'rgba(99,102,241,0.08)', label: 'MESSAGE', icon: MessageSquare, glow: isLight ? '0 1px 3px rgba(0,0,0,0.05)' : '0 0 20px rgba(99,102,241,0.1)' };
}

export default function InboxPage() {
  const { isLight } = useTheme();
  const navigate = useNavigate();
  const goBack = useBackNavigation('/dashboard');
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  const [selectedMsg, setSelectedMsg] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem('sguard_user');
    if (saved) setUserProfile(JSON.parse(saved));
  }, []);

  const fetchInbox = async () => {
    if (!userProfile?.employee_id) return;
    setLoading(true);
    try {
      const folder = activeTab === 'sent_report' ? 'SENT' : 'INBOX';
      const res = await fetch(`https://sguardai.khcho0421.workers.dev/inbox?user_id=${userProfile.employee_id}&folder=${folder}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(Array.isArray(data) ? data : (data.items || []));
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchInbox(); }, [userProfile, activeTab]);

  const handleMarkAsRead = async (id) => {
    try {
      const res = await fetch(`https://sguardai.khcho0421.workers.dev/inbox/${id}/read`, { method: 'PATCH' });
      if (res.ok) setMessages(prev => prev.map(m => m.id === id ? { ...m, is_read: 1 } : m));
    } catch (e) {}
  };

  const handleDelete = async (id) => {
    if (!window.confirm('이 항목을 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`https://sguardai.khcho0421.workers.dev/inbox/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setMessages(prev => prev.filter(m => m.id !== id));
        if (selectedMsg?.id === id) setSelectedMsg(null);
      }
    } catch (e) {}
  };

  const handleOpen = (msg) => {
    if (!msg.is_read) handleMarkAsRead(msg.id);
    if (msg.type === 'REPORT') {
      const cleanId = String(msg.inc_id).replace(/^INC-/i, '');
      navigate(`/ai-report/${cleanId}`);
      return;
    }
    setSelectedMsg(msg);
  };

  const filteredMessages = messages
    .filter(msg => {
      const q = searchQuery.toLowerCase();
      const match = (msg.title || '').toLowerCase().includes(q) || (msg.sender_name || '').toLowerCase().includes(q);
      if (activeTab === 'all') return match;
      if (activeTab === 'message') return match && msg.type === 'MESSAGE';
      if (activeTab === 'received_report') return match && msg.type === 'REPORT' && msg.folder === 'INBOX';
      if (activeTab === 'sent_report') return match && msg.type === 'REPORT' && msg.folder === 'SENT';
      return match;
    })
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  const unread = messages.filter(m => !m.is_read).length;
  const reports = messages.filter(m => m.type === 'REPORT').length;

  return (
    <div className={`h-screen font-sans flex flex-col overflow-hidden transition-colors ${
      isLight ? 'bg-[#F8FAFC] text-slate-900' : 'bg-[#060810] text-slate-200'
    }`}>
      
      {/* ── HEADER ─────────────────────────────────────────── */}
      <header 
        className={`shrink-0 relative overflow-hidden transition-colors ${
          isLight ? 'bg-white border-b border-slate-200/90 shadow-xs' : ''
        }`} 
        style={isLight ? {} : { background: 'linear-gradient(160deg, #0b0e1a 0%, #0d1020 60%, #07090e 100%)' }}
      >
        {/* ambient glow */}
        {!isLight && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-[-30%] right-[-5%] w-72 h-72 rounded-full" style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)' }} />
            <div className="absolute bottom-[-20%] left-[-5%] w-56 h-56 rounded-full" style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)' }} />
          </div>
        )}

        <div className="relative z-10 px-5 pt-8 pb-5 flex flex-col gap-5">
          
          {/* top row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => goBack()} 
                className={`p-2.5 rounded-2xl border active:scale-95 transition-all ${
                  isLight ? 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200' : 'bg-white/5 border-white/10 text-slate-400'
                }`}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className={`text-[22px] font-black tracking-tight leading-none ${
                    isLight ? 'text-slate-900' : 'text-white'
                  }`}>
                    Incident <span style={{ background: 'linear-gradient(90deg,#6366f1,#4f46e5)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Reports</span>
                  </h1>
                </div>
                <p className="text-[10px] font-bold mt-1 tracking-[0.15em] uppercase text-indigo-600">
                  {userProfile?.name}&nbsp;·&nbsp;{userProfile?.team_name || '운영팀'}
                </p>
              </div>
            </div>

            <button
              onClick={fetchInbox}
              className={`p-3 rounded-2xl border active:scale-95 transition-all ${
                isLight ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100' : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
              }`}
            >
              <RefreshCw className={`w-4.5 h-4.5 ${isLight ? 'text-indigo-600' : 'text-indigo-400'} ${loading ? 'animate-spin' : ''}`} style={{ width: 18, height: 18 }} />
            </button>
          </div>

          {/* stats row */}
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { label: 'Total',   val: messages.length, icon: LayoutGrid, color: '#6366f1', lightBg: 'bg-indigo-50/90', lightBorder: 'border-indigo-200', lightText: 'text-indigo-700' },
              { label: 'Unread',  val: unread,           icon: Radio,       color: '#d97706', lightBg: 'bg-amber-50/90',  lightBorder: 'border-amber-200',  lightText: 'text-amber-800' },
              { label: 'Reports', val: reports,           icon: FileBadge,   color: '#059669', lightBg: 'bg-emerald-50/90', lightBorder: 'border-emerald-200', lightText: 'text-emerald-800' },
            ].map(s => (
              <div 
                key={s.label} 
                className={`rounded-2xl border p-3 flex flex-col gap-0.5 items-center text-center transition-all ${
                  isLight ? `${s.lightBg} ${s.lightBorder} shadow-xs` : 'border'
                }`} 
                style={isLight ? {} : { background: `${s.color}0d`, borderColor: `${s.color}25` }}
              >
                <s.icon style={{ width: 14, height: 14, color: s.color }} />
                <span className={`text-[18px] font-black leading-tight ${isLight ? s.lightText : ''}`} style={isLight ? {} : { color: s.color }}>
                  {s.val}
                </span>
                <span className={`text-[9px] font-black uppercase tracking-widest ${isLight ? 'text-slate-600' : 'text-slate-500'}`}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>

          {/* search */}
          <div className="relative">
            <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${
              isLight ? 'text-slate-400' : 'text-slate-600'
            }`} />
            <input
              type="text"
              placeholder="Search by title or sender..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className={`w-full rounded-2xl py-3 pl-11 pr-4 text-sm transition-all focus:outline-none ${
                isLight 
                  ? 'bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 shadow-xs' 
                  : 'text-white placeholder:text-slate-600 focus:outline-none'
              }`}
              style={isLight ? {} : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)' }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className={`absolute right-4 top-1/2 -translate-y-1/2 ${
                isLight ? 'text-slate-400 hover:text-slate-700' : 'text-slate-500 hover:text-white'
              }`}>
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {TABS.map(tab => {
              const isActive = activeTab === tab.id;
              const count = tab.id === 'all' ? messages.length
                : tab.id === 'received_report' ? messages.filter(m => m.type === 'REPORT' && m.folder === 'INBOX').length
                : tab.id === 'message' ? messages.filter(m => m.type === 'MESSAGE').length
                : messages.filter(m => m.folder === 'SENT').length;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 shrink-0 px-4 py-2 rounded-2xl text-xs font-black whitespace-nowrap border transition-all active:scale-95 ${
                    isActive 
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-200' 
                      : isLight 
                        ? 'bg-slate-100 hover:bg-slate-200/80 border-slate-200 text-slate-700 font-bold' 
                        : 'bg-white/[0.04] border-white/[0.06] text-slate-400'
                  }`}
                >
                  <tab.icon className="w-3 h-3" />
                  {tab.label}
                  {count > 0 && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${
                      isActive 
                        ? 'bg-black/20 text-white' 
                        : isLight 
                          ? 'bg-indigo-100 text-indigo-700 font-black' 
                          : 'bg-indigo-500/20 text-indigo-400'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* ── FEED ───────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto px-4 pt-4 pb-28 space-y-3">
        {loading && messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-10 h-10 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Syncing Incident Feed...</p>
          </div>
        ) : filteredMessages.length > 0 ? (
          filteredMessages.map((msg) => {
            const t = TypeBadge({ type: msg.type, title: msg.title, isLight });
            const Icon = t.icon;
            const timeStr = msg.created_at
              ? new Date(msg.created_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
              : '';
            return (
              <div
                key={msg.id}
                onClick={() => handleOpen(msg)}
                className={`group relative rounded-[1.75rem] overflow-hidden cursor-pointer transition-all active:scale-[0.98] border ${
                  isLight 
                    ? 'bg-white hover:bg-slate-50/90 border-slate-200/90 shadow-sm hover:shadow-md' 
                    : ''
                }`}
                style={isLight ? {
                  borderLeft: `4px solid ${t.accent}`
                } : {
                  background: msg.is_read
                    ? 'rgba(13,15,22,0.9)'
                    : `linear-gradient(135deg, ${t.accentBg} 0%, rgba(10,12,20,0.95) 70%)`,
                  border: `1px solid ${msg.is_read ? 'rgba(255,255,255,0.05)' : t.accent + '30'}`,
                  boxShadow: msg.is_read ? 'none' : t.glow,
                }}
              >
                {/* Left accent bar in dark mode */}
                {!isLight && (
                  <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-full" style={{ background: msg.is_read ? 'rgba(255,255,255,0.07)' : t.accent }} />
                )}

                <div className="pl-5 pr-4 py-4">
                  {/* Row 1: badges + time */}
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                      <div 
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${
                          isLight ? 'bg-slate-50 border-slate-200 font-bold' : ''
                        }`} 
                        style={isLight ? {} : { background: t.accent + '18', border: `1px solid ${t.accent}30` }}
                      >
                        <Icon style={{ width: 11, height: 11, color: t.accent }} />
                        <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: t.accent }}>{t.label}</span>
                      </div>
                      {!msg.is_read && (
                        <span className={`flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                          isLight 
                            ? 'bg-amber-50 text-amber-800 border-amber-200 font-bold' 
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}>
                          <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse inline-block" />
                          NEW
                        </span>
                      )}
                    </div>
                    <span className={`text-[10px] font-mono ${isLight ? 'text-slate-500 font-semibold' : 'text-slate-500'}`}>{timeStr}</span>
                  </div>

                  {/* Row 2: title - NEVER DARK-ON-DARK OR WHITE-ON-WHITE! */}
                  <h3 className={`text-[14px] font-black leading-snug line-clamp-2 mb-1.5 ${
                    isLight 
                      ? (msg.is_read ? 'text-slate-700 font-extrabold' : 'text-slate-900') 
                      : (msg.is_read ? 'text-slate-400' : 'text-white')
                  }`}>
                    {msg.title}
                  </h3>

                  {/* Row 3: preview */}
                  <p className={`text-[12px] leading-relaxed line-clamp-2 mb-3 ${
                    isLight ? 'text-slate-600 font-medium' : 'text-slate-400'
                  }`}>
                    {stripMarkdown(msg.preview || msg.content) || 'No preview available'}
                  </p>

                  {/* Row 4: sender + actions */}
                  <div className={`flex items-center justify-between pt-3 border-t ${
                    isLight ? 'border-slate-100' : 'border-white/5'
                  }`}>
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border ${
                        isLight ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-white/5 text-slate-400 border-white/10'
                      }`}>
                        {(msg.sender_name || 'S').charAt(0).toUpperCase()}
                      </div>
                      <span className={`text-[11px] font-bold ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>
                        {msg.sender_name || 'System'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {msg.inc_id && (
                        <button
                          id={`ai-report-btn-${msg.id}`}
                          onClick={e => {
                            e.stopPropagation();
                            navigate(`/ai-report/${String(msg.inc_id).replace(/^INC-/i, '')}`);
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black transition-all active:scale-95 border ${
                            isLight 
                              ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200 font-bold shadow-xs' 
                              : 'bg-indigo-500/12 hover:bg-indigo-500/25 text-indigo-300 border-indigo-500/30'
                          }`}
                        >
                          <BrainCircuit style={{ width: 11, height: 11 }} />
                          AI Analysis
                        </button>
                      )}
                      <div className={`flex items-center gap-1 text-[11px] font-black ${
                        isLight ? 'text-emerald-700 font-bold' : ''
                      }`} style={isLight ? {} : { color: t.accent }}>
                        <Eye style={{ width: 12, height: 12 }} />
                        {msg.type === 'REPORT' ? 'View Report' : 'Open'}
                        <ChevronRight style={{ width: 12, height: 12 }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className={`w-20 h-20 rounded-[2.5rem] flex items-center justify-center mb-6 border ${
              isLight ? 'bg-indigo-50 border-indigo-100' : 'bg-indigo-500/10 border-indigo-500/20'
            }`}>
              <Inbox className={`w-9 h-9 ${isLight ? 'text-indigo-400' : 'text-indigo-900'}`} />
            </div>
            <h3 className={`text-lg font-black ${isLight ? 'text-slate-700' : 'text-slate-500'}`}>No incidents found</h3>
            <p className={`text-xs mt-2 max-w-[200px] mx-auto leading-relaxed ${isLight ? 'text-slate-500' : 'text-slate-600'}`}>
              {searchQuery ? `"${searchQuery}"에 해당하는 항목이 없습니다.` : 'New reports and alerts will appear here'}
            </p>
          </div>
        )}
      </main>

      {/* ── DETAIL MODAL ───────────────────────────────────── */}
      {selectedMsg && createPortal(
        <div className="fixed inset-0 z-[200] flex items-end">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setSelectedMsg(null)} />
          <div className={`relative w-full max-h-[92vh] rounded-t-[2.5rem] flex flex-col z-10 border border-b-0 ${
            isLight 
              ? 'bg-white border-slate-200 text-slate-900 shadow-2xl' 
              : 'bg-[#0d0f18] border-white/10 text-white shadow-2xl'
          }`}>
            {/* Handle */}
            <div className={`w-10 h-1 rounded-full mx-auto mt-3 mb-4 ${
              isLight ? 'bg-slate-300' : 'bg-white/10'
            }`} />
            
            {/* Modal Header */}
            <div className={`px-6 pb-4 flex items-center justify-between border-b ${
              isLight ? 'border-slate-200 bg-slate-50/70' : 'border-white/5'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-2xl border ${
                  selectedMsg.type === 'REPORT' 
                    ? (isLight ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400')
                    : (isLight ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400')
                }`}>
                  {selectedMsg.type === 'REPORT'
                    ? <FileBadge style={{ width: 20, height: 20 }} />
                    : <MessageSquare style={{ width: 20, height: 20 }} />
                  }
                </div>
                <div>
                  <h3 className={`text-[15px] font-black leading-tight line-clamp-1 ${
                    isLight ? 'text-slate-900' : 'text-white'
                  }`}>{selectedMsg.title}</h3>
                  <p className={`text-[10px] font-bold mt-0.5 uppercase tracking-widest ${
                    isLight ? 'text-slate-500' : 'text-slate-500'
                  }`}>
                    {selectedMsg.sender_name}&nbsp;·&nbsp;{selectedMsg.created_at ? new Date(selectedMsg.created_at).toLocaleString('ko-KR') : ''}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedMsg(null)} className={`p-2 rounded-full transition-all ${
                isLight ? 'bg-slate-100 text-slate-600 hover:text-slate-900' : 'bg-white/5 text-slate-500 hover:text-white'
              }`}>
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {selectedMsg.type === 'REPORT' && selectedMsg.content ? (
                <MarkdownViewer text={selectedMsg.content} />
              ) : (
                <div className={`p-5 rounded-2xl border ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/[0.03] border-white/[0.06]'
                }`}>
                  <p className={`text-[14px] leading-relaxed whitespace-pre-wrap ${
                    isLight ? 'text-slate-800' : 'text-slate-200'
                  }`}>
                    {selectedMsg.content || selectedMsg.preview || 'No content'}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className={`p-5 pb-10 flex gap-3 border-t ${
              isLight ? 'border-slate-200 bg-slate-50/80' : 'border-white/5 bg-[#0d0f18]/80 backdrop-blur-md'
            }`}>
              <button
                onClick={() => handleDelete(selectedMsg.id)}
                className={`flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl text-sm font-black active:scale-95 transition-all border ${
                  isLight ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100' : 'bg-red-500/10 text-red-400 border-red-500/20'
                }`}
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
              {selectedMsg.inc_id && (
                <button
                  onClick={() => { navigate(`/ai-report/${String(selectedMsg.inc_id).replace(/^INC-/i, '')}`); setSelectedMsg(null); }}
                  className={`flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl text-sm font-black active:scale-95 transition-all border ${
                    isLight ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100' : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                  }`}
                >
                  <BrainCircuit className="w-4 h-4" />
                  AI Analysis
                </button>
              )}
              <button
                onClick={() => setSelectedMsg(null)}
                className="flex-1 py-3.5 rounded-2xl text-sm font-black active:scale-95 transition-all text-white shadow-sm"
                style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}
              >
                Done
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
