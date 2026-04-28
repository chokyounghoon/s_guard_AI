import React, { useState, useEffect } from 'react';
import { 
  Inbox, 
  MessageSquare, 
  FileText, 
  Search, 
  Trash2, 
  CheckCircle2, 
  Filter,
  MoreVertical,
  Send,
  ArrowLeft,
  X,
  Hash,
  Clock,
  ChevronRight,
  Sparkles,
  Bell,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import MarkdownViewer from '../components/MarkdownViewer';

// ** 등 마크다운 심볼 제거 유틸
const stripMarkdown = (str = '') =>
  str
    .replace(/\*\*([^*]*)\*\*/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/#{1,6}\s*/g, '')
    .replace(/\n+/g, ' ')
    .trim();

export default function InboxPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  const [selectedMsg, setSelectedMsg] = useState(null); // 디테일 모달

  useEffect(() => {
    const savedUser = localStorage.getItem('sguard_user');
    if (savedUser) setUserProfile(JSON.parse(savedUser));
  }, []);

  const fetchInbox = async () => {
    if (!userProfile?.employee_id) return;
    setLoading(true);
    try {
      const folderParam = activeTab === 'sent_report' ? 'SENT' : 'INBOX';
      const res = await fetch(`https://sguardai.khcho0421.workers.dev/inbox?user_id=${userProfile.employee_id}&folder=${folderParam}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(Array.isArray(data) ? data : (data.items || []));
      }
    } catch (e) {
      console.error('Failed to fetch inbox', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInbox(); }, [userProfile, activeTab]);

  const handleMarkAsRead = async (id) => {
    try {
      const res = await fetch(`https://sguardai.khcho0421.workers.dev/inbox/${id}/read`, { method: 'PATCH' });
      if (res.ok) setMessages(prev => prev.map(m => m.id === id ? { ...m, is_read: 1 } : m));
    } catch (e) {}
  };

  const handleDelete = async (id) => {
    if (!window.confirm('이 메시지를 삭제하시겠습니까?')) return;
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
    
    // REPORT 타입은 즉시 리포트 상세 페이지로 이동
    if (msg.type === 'REPORT') {
      const cleanId = String(msg.inc_id).replace(/^INC-/i, '');
      navigate(`/report/${cleanId}`);
      return;
    }
    
    // MESSAGE 타입이나 기타는 슬라이드업 모달로 표시
    setSelectedMsg(msg);
  };

  const filteredMessages = messages.filter(msg => {
    const matchesSearch =
      (msg.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (msg.sender_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    if (activeTab === 'all') return matchesSearch;
    if (activeTab === 'message') return matchesSearch && msg.type === 'MESSAGE';
    if (activeTab === 'received_report') return matchesSearch && msg.type === 'REPORT' && msg.folder === 'INBOX';
    if (activeTab === 'sent_report') return matchesSearch && msg.type === 'REPORT' && msg.folder === 'SENT';
    return matchesSearch;
  });

  const getMsgTypeStyles = (type, title) => {
    if (type === 'REPORT') {
      if (title.includes('긴급') || title.includes('CRITICAL')) return {
        bg: 'from-red-500/20 to-red-600/5',
        border: 'border-red-500/30',
        text: 'text-red-400',
        icon: AlertTriangle,
        tag: '긴급 보고서'
      };
      return {
        bg: 'from-emerald-500/20 to-emerald-600/5',
        border: 'border-emerald-500/30',
        text: 'text-emerald-400',
        icon: FileText,
        tag: 'AI 리포트'
      };
    }
    return {
      bg: 'from-blue-500/20 to-blue-600/5',
      border: 'border-blue-500/30',
      text: 'text-blue-400',
      icon: MessageSquare,
      tag: '쪽지'
    };
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-200 pb-28 font-sans">
      {/* Immersive Header */}
      <header className="relative pt-10 pb-20 px-6 overflow-hidden">
        {/* Background Blobs */}
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-blue-600/20 blur-[100px] rounded-full" />
          <div className="absolute bottom-0 left-[-10%] w-48 h-48 bg-purple-600/10 blur-[80px] rounded-full" />
        </div>

        <div className="relative z-10 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center shadow-lg shadow-blue-900/40 border border-white/10">
                <Inbox className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white tracking-tight">받은사건함</h1>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    {userProfile?.name} · {userProfile?.team_name || '운영팀'}
                  </p>
                </div>
              </div>
            </div>
            <button 
              onClick={fetchInbox}
              className="p-3 rounded-2xl bg-white/5 border border-white/10 text-slate-400 active:scale-95 transition-all"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Search Bar - Modern Style */}
          <div className="relative group">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <Search className="w-4 h-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
            </div>
            <input
              type="text"
              placeholder="사건번호, 발신자 검색..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-[1.25rem] py-3.5 pl-11 pr-4 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 focus:bg-white/10 transition-all backdrop-blur-md shadow-inner"
            />
          </div>

          {/* Tab Menu - Pill Style */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
            {[
              { id: 'all', label: '전체', icon: Hash },
              { id: 'received_report', label: '리포트', icon: Sparkles },
              { id: 'message', label: '쪽지', icon: MessageSquare },
              { id: 'sent_report', label: '발행', icon: Send }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black whitespace-nowrap border transition-all active:scale-95 ${
                  activeTab === tab.id 
                    ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-900/40' 
                    : 'bg-[#151926]/80 border-white/5 text-slate-500 backdrop-blur-md'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
                {tab.id === 'all' && messages.filter(m => !m.is_read).length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-[8px] rounded-full text-white">
                    {messages.filter(m => !m.is_read).length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Message Feed Area */}
      <main className="px-6 -mt-10 relative z-20 space-y-4">
        {loading && messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-500 rounded-full animate-spin" />
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest animate-pulse">Synchronizing 피드...</p>
          </div>
        ) : filteredMessages.length > 0 ? (
          [...filteredMessages]
            .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
            .map((msg, idx, arr) => {
              const style = getMsgTypeStyles(msg.type, msg.title);
              const Icon = style.icon;
              const seqNo = arr.length - idx;
              return (
                <div
                  key={msg.id}
                  onClick={() => handleOpen(msg)}
                  className={`group relative bg-gradient-to-br ${style.bg} rounded-[2.5rem] border ${style.border} p-6 shadow-2xl backdrop-blur-xl transition-all active:scale-[0.97] hover:border-white/20 ${!msg.is_read ? 'ring-1 ring-blue-500/20' : 'opacity-80'}`}
                >
                  {!msg.is_read && (
                    <div className="absolute top-6 right-6">
                      <span className="flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                      </span>
                    </div>
                  )}

                  <div className="flex items-start gap-4">
                    <div className={`p-4 rounded-[1.25rem] bg-black/40 border border-white/5 shadow-inner ${style.text}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-black text-slate-400 bg-slate-800/80 border border-slate-700/50 px-2.5 py-0.5 rounded-lg font-mono">
                          No.{seqNo}
                        </span>
                        <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-lg border border-current/20 bg-current/10 ${style.text} uppercase tracking-tighter`}>
                          {style.tag}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono font-bold">
                          {msg.created_at ? new Date(msg.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>

                    <h3 className={`text-[16px] font-black mb-1.5 tracking-tight leading-snug line-clamp-2 ${!msg.is_read ? 'text-white' : 'text-slate-400'}`}>
                      {msg.title}
                    </h3>

                    <p className="text-[13px] text-slate-500 font-medium leading-relaxed line-clamp-2 mb-4">
                      {stripMarkdown(msg.preview || msg.content)}
                    </p>

                    <div className="flex items-center justify-between border-t border-white/5 pt-4">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center border border-white/10">
                          <Hash className="w-2.5 h-2.5 text-slate-500" />
                        </div>
                        <span className="text-[11px] text-slate-400 font-bold">{msg.sender_name || 'System'}</span>
                      </div>
                      <div className={`flex items-center gap-1.5 text-[11px] font-black ${style.text}`}>
                        {msg.type === 'REPORT' ? '리포트 확인' : '상세보기'}
                        <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-20 h-20 rounded-[2.5rem] bg-white/5 border border-white/10 flex items-center justify-center mb-6">
              <Inbox className="w-10 h-10 text-slate-700" />
            </div>
            <h3 className="text-xl font-black text-slate-400">사건함이 비어있습니다.</h3>
            <p className="text-slate-500 text-sm mt-2 max-w-[200px] mx-auto leading-relaxed">새로운 보고서나 알림이 도착하면 여기에 표시됩니다.</p>
          </div>
        )}
      </main>

      {/* Detail Slide-up Modal */}
      {selectedMsg && (
        <div className="fixed inset-0 z-[200] flex items-end">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setSelectedMsg(null)} />
          <div className="relative w-full max-h-[92vh] bg-[#0d0f14] rounded-t-[3rem] border-t border-white/10 flex flex-col animate-in slide-in-from-bottom duration-500 z-10 shadow-[0_-20px_50px_rgba(0,0,0,0.8)]">
            {/* Modal Handle */}
            <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto my-4 shrink-0" />
            
            <div className="px-6 pb-4 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-2xl ${selectedMsg.type === 'REPORT' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'}`}>
                  {selectedMsg.type === 'REPORT' ? <FileText className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
                </div>
                <div>
                  <h3 className="text-lg font-black text-white leading-tight">{selectedMsg.title}</h3>
                  <p className="text-[11px] text-slate-500 font-bold mt-0.5 uppercase tracking-widest">
                    {selectedMsg.sender_name} · {selectedMsg.created_at ? new Date(selectedMsg.created_at).toLocaleString('ko-KR') : ''}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedMsg(null)} className="p-2 bg-white/5 rounded-full text-slate-500 hover:text-white transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              {selectedMsg.type === 'REPORT' && selectedMsg.content ? (
                <MarkdownViewer text={selectedMsg.content} />
              ) : (
                <div className="bg-white/5 rounded-3xl p-6 border border-white/5">
                  <p className="text-slate-200 text-[15px] leading-relaxed whitespace-pre-wrap font-medium">
                    {selectedMsg.content || selectedMsg.preview || '내용 없음'}
                  </p>
                </div>
              )}
            </div>

            <div className="p-6 pb-10 border-t border-white/5 bg-[#0d0f14]/80 backdrop-blur-md flex gap-3">
              <button
                onClick={() => handleDelete(selectedMsg.id)}
                className="flex-1 py-4 rounded-[1.25rem] bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-black active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" /> 삭제하기
              </button>
              <button
                onClick={() => setSelectedMsg(null)}
                className="flex-[2] py-4 rounded-[1.25rem] bg-blue-600 text-white text-sm font-black shadow-lg shadow-blue-900/40 active:scale-95 transition-all"
              >
                확인 완료
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
