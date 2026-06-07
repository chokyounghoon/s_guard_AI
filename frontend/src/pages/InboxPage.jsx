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

function TypeBadge({ type, title }) {
  if (type === 'REPORT') {
    const isCrit = title?.includes('긴급') || title?.includes('CRITICAL');
    return isCrit
      ? { accent: '#ef4444', accentBg: 'rgba(239,68,68,0.08)', label: 'CRITICAL', icon: AlertTriangle, glow: '0 0 20px rgba(239,68,68,0.2)' }
      : { accent: '#10b981', accentBg: 'rgba(16,185,129,0.08)', label: 'AI REPORT', icon: FileBadge, glow: '0 0 20px rgba(16,185,129,0.15)' };
  }
  return { accent: '#6366f1', accentBg: 'rgba(99,102,241,0.08)', label: 'MESSAGE', icon: MessageSquare, glow: '0 0 20px rgba(99,102,241,0.1)' };
}

export default function InboxPage() {
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
    <div className="h-screen bg-[#060810] text-slate-200 font-sans flex flex-col overflow-hidden">
      
      {/* ── HEADER ─────────────────────────────────────────── */}
      <header className="shrink-0 relative overflow-hidden" style={{ background: 'linear-gradient(160deg, #0b0e1a 0%, #0d1020 60%, #07090e 100%)' }}>
        {/* ambient glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-30%] right-[-5%] w-72 h-72 rounded-full" style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)' }} />
          <div className="absolute bottom-[-20%] left-[-5%] w-56 h-56 rounded-full" style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)' }} />
        </div>

        <div className="relative z-10 px-5 pt-10 pb-5 flex flex-col gap-5">
          
          {/* top row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => goBack()} className="p-2.5 rounded-2xl bg-white/5 border border-white/10 text-slate-400 active:scale-95 transition-all">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-[22px] font-black text-white tracking-tight leading-none">
                    Incident <span style={{ background: 'linear-gradient(90deg,#818cf8,#6366f1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Reports</span>
                  </h1>
                </div>
                <p className="text-[10px] font-bold mt-1 tracking-[0.15em] uppercase" style={{ color: '#6366f1' }}>
                  {userProfile?.name}&nbsp;·&nbsp;{userProfile?.team_name || '운영팀'}
                </p>
              </div>
            </div>

            <button
              onClick={fetchInbox}
              className="p-3 rounded-2xl border active:scale-95 transition-all"
              style={{ background: 'rgba(99,102,241,0.1)', borderColor: 'rgba(99,102,241,0.3)' }}
            >
              <RefreshCw className={`w-4.5 h-4.5 text-indigo-400 ${loading ? 'animate-spin' : ''}`} style={{ width: 18, height: 18 }} />
            </button>
          </div>

          {/* stats row */}
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { label: 'Total',   val: messages.length, icon: LayoutGrid, color: '#6366f1' },
              { label: 'Unread',  val: unread,           icon: Radio,       color: '#f59e0b' },
              { label: 'Reports', val: reports,           icon: FileBadge,   color: '#10b981' },
            ].map(s => (
              <div key={s.label} className="rounded-2xl border p-3 flex flex-col gap-0.5 items-center text-center" style={{ background: `${s.color}0d`, borderColor: `${s.color}25` }}>
                <s.icon style={{ width: 14, height: 14, color: s.color }} />
                <span className="text-[18px] font-black leading-tight" style={{ color: s.color }}>{s.val}</span>
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">{s.label}</span>
              </div>
            ))}
          </div>

          {/* search */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by title or sender..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl py-3 pl-11 pr-4 text-sm text-white placeholder:text-slate-600 focus:outline-none transition-all"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)' }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
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
                  className="flex items-center gap-1.5 shrink-0 px-4 py-2 rounded-2xl text-xs font-black whitespace-nowrap border transition-all active:scale-95"
                  style={isActive
                    ? { background: 'rgba(99,102,241,1)', borderColor: '#818cf8', color: '#fff', boxShadow: '0 0 20px rgba(99,102,241,0.4)' }
                    : { background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.06)', color: '#64748b' }
                  }
                >
                  <tab.icon className="w-3 h-3" />
                  {tab.label}
                  {count > 0 && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-black" style={{ background: isActive ? 'rgba(0,0,0,0.3)' : 'rgba(99,102,241,0.2)', color: isActive ? '#fff' : '#818cf8' }}>
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
          filteredMessages.map((msg, idx) => {
            const t = TypeBadge({ type: msg.type, title: msg.title });
            const Icon = t.icon;
            const timeStr = msg.created_at
              ? new Date(msg.created_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
              : '';
            return (
              <div
                key={msg.id}
                onClick={() => handleOpen(msg)}
                className="group relative rounded-[1.75rem] overflow-hidden cursor-pointer transition-all active:scale-[0.98]"
                style={{
                  background: msg.is_read
                    ? 'rgba(13,15,22,0.9)'
                    : `linear-gradient(135deg, ${t.accentBg} 0%, rgba(10,12,20,0.95) 70%)`,
                  border: `1px solid ${msg.is_read ? 'rgba(255,255,255,0.05)' : t.accent + '30'}`,
                  boxShadow: msg.is_read ? 'none' : t.glow,
                }}
              >
                {/* Left accent bar */}
                <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-full" style={{ background: msg.is_read ? 'rgba(255,255,255,0.07)' : t.accent }} />

                <div className="pl-5 pr-4 py-4">
                  {/* Row 1: badges + time */}
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: t.accent + '18', border: `1px solid ${t.accent}30` }}>
                        <Icon style={{ width: 11, height: 11, color: t.accent }} />
                        <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: t.accent }}>{t.label}</span>
                      </div>
                      {!msg.is_read && (
                        <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' }}>
                          <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse inline-block" />
          NEW
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-slate-600">{timeStr}</span>
                  </div>

                  {/* Row 2: title */}
                  <h3 className={`text-[14px] font-black leading-snug line-clamp-2 mb-1.5 ${msg.is_read ? 'text-slate-400' : 'text-white'}`}>
                    {msg.title}
                  </h3>

                  {/* Row 3: preview */}
                  <p className="text-[12px] text-slate-600 leading-relaxed line-clamp-2 mb-3">
                    {stripMarkdown(msg.preview || msg.content) || 'No preview available'}
                  </p>

                  {/* Row 4: sender + actions */}
                  <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-slate-500 border" style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.08)' }}>
                        {(msg.sender_name || 'S').charAt(0).toUpperCase()}
                      </div>
                      <span className="text-[11px] text-slate-500 font-bold">{msg.sender_name || 'System'}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {msg.inc_id && (
                        <button
                          id={`ai-report-btn-${msg.id}`}
                          onClick={e => {
                            e.stopPropagation();
                            navigate(`/ai-report/${String(msg.inc_id).replace(/^INC-/i, '')}`);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black transition-all active:scale-95"
                          style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8' }}
                        >
                          <BrainCircuit style={{ width: 11, height: 11 }} />
                          AI Analysis
                        </button>
                      )}
                      <div className="flex items-center gap-1 text-[11px] font-black" style={{ color: t.accent }}>
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
            <div className="w-20 h-20 rounded-[2.5rem] flex items-center justify-center mb-6" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}>
              <Inbox className="w-9 h-9 text-indigo-900" />
            </div>
            <h3 className="text-lg font-black text-slate-500">No incidents found</h3>
            <p className="text-slate-600 text-xs mt-2 max-w-[200px] mx-auto leading-relaxed">
              {searchQuery ? `"${searchQuery}"에 해당하는 항목이 없습니다.` : 'New reports and alerts will appear here'}
            </p>
          </div>
        )}
      </main>

      {/* ── DETAIL MODAL ───────────────────────────────────── */}
      {selectedMsg && createPortal(
        <div className="fixed inset-0 z-[200] flex items-end">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setSelectedMsg(null)} />
          <div className="relative w-full max-h-[92vh] rounded-t-[2.5rem] flex flex-col z-10" style={{ background: '#0d0f18', border: '1px solid rgba(255,255,255,0.08)', borderBottom: 'none', boxShadow: '0 -20px 60px rgba(0,0,0,0.8)' }}>
            {/* Handle */}
            <div className="w-10 h-1 rounded-full mx-auto mt-3 mb-4" style={{ background: 'rgba(255,255,255,0.12)' }} />
            
            {/* Modal Header */}
            <div className="px-6 pb-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl" style={{ background: selectedMsg.type === 'REPORT' ? 'rgba(16,185,129,0.1)' : 'rgba(99,102,241,0.1)', border: `1px solid ${selectedMsg.type === 'REPORT' ? 'rgba(16,185,129,0.25)' : 'rgba(99,102,241,0.25)'}` }}>
                  {selectedMsg.type === 'REPORT'
                    ? <FileBadge style={{ width: 20, height: 20, color: '#10b981' }} />
                    : <MessageSquare style={{ width: 20, height: 20, color: '#818cf8' }} />
                  }
                </div>
                <div>
                  <h3 className="text-[15px] font-black text-white leading-tight line-clamp-1">{selectedMsg.title}</h3>
                  <p className="text-[10px] font-bold mt-0.5 uppercase tracking-widest text-slate-500">
                    {selectedMsg.sender_name}&nbsp;·&nbsp;{selectedMsg.created_at ? new Date(selectedMsg.created_at).toLocaleString('ko-KR') : ''}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedMsg(null)} className="p-2 rounded-full text-slate-500 hover:text-white transition-all" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {selectedMsg.type === 'REPORT' && selectedMsg.content ? (
                <MarkdownViewer text={selectedMsg.content} />
              ) : (
                <div className="p-5 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-slate-200 text-[14px] leading-relaxed whitespace-pre-wrap">
                    {selectedMsg.content || selectedMsg.preview || 'No content'}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-5 pb-10 flex gap-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(13,15,24,0.8)', backdropFilter: 'blur(12px)' }}>
              <button
                onClick={() => handleDelete(selectedMsg.id)}
                className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl text-sm font-black active:scale-95 transition-all"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
              {selectedMsg.inc_id && (
                <button
                  onClick={() => { navigate(`/ai-report/${String(selectedMsg.inc_id).replace(/^INC-/i, '')}`); setSelectedMsg(null); }}
                  className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl text-sm font-black active:scale-95 transition-all"
                  style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.35)', color: '#818cf8' }}
                >
                  <BrainCircuit className="w-4 h-4" />
                  AI Analysis
                </button>
              )}
              <button
                onClick={() => setSelectedMsg(null)}
                className="flex-1 py-3.5 rounded-2xl text-sm font-black active:scale-95 transition-all text-white"
                style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', boxShadow: '0 0 20px rgba(99,102,241,0.3)' }}
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
