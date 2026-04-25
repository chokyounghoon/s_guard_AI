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
  Clock
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

  return (
    <div className="min-h-screen bg-[#0a0c14] text-slate-200 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-b from-blue-900/20 to-transparent pt-12 pb-6 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <button onClick={() => navigate(-1)} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-slate-400 hover:text-white transition-all">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="p-2 bg-blue-600/20 rounded-xl border border-blue-500/30">
                <Inbox className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h1 className="text-xl font-black text-white tracking-tight">메시지함</h1>
                <p className="text-slate-500 text-xs">쪽지 및 보고서 알림</p>
              </div>
            </div>
            <div className="flex items-center bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 hover:border-blue-500/30 transition-all group">
              <Search className="w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="검색..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-transparent border-none focus:outline-none ml-2 text-sm placeholder:text-slate-600 w-32"
              />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 p-1 bg-white/5 rounded-xl border border-white/10 w-fit">
            {[
              { id: 'all', label: '전체', icon: Hash },
              { id: 'message', label: '쪽지', icon: MessageSquare },
              { id: 'received_report', label: '받은 보고서', icon: FileText },
              { id: 'sent_report', label: '보낸 보고서', icon: Send }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === tab.id ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:text-slate-200'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.id === 'all' && messages.some(m => !m.is_read) && (
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Message List */}
      <div className="max-w-4xl mx-auto px-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <div className="w-10 h-10 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
            <p className="text-slate-500 text-sm">불러오는 중...</p>
          </div>
        ) : filteredMessages.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1 mb-2 text-[9px] font-black text-slate-500 uppercase tracking-widest">
              <span>LISTING {filteredMessages.length} ITEMS</span>
              <div className="flex gap-3">
                <button className="flex items-center hover:text-slate-200 transition-colors">
                  <Filter className="w-3 h-3 mr-1" /> FILTER
                </button>
                <button className="flex items-center hover:text-slate-200 transition-colors">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> READ ALL
                </button>
              </div>
            </div>

            {filteredMessages.map(msg => (
              <div
                key={msg.id}
                onClick={() => handleOpen(msg)}
                className={`group relative bg-[#11141d] rounded-2xl border transition-all cursor-pointer overflow-hidden ${
                  !msg.is_read
                    ? 'border-blue-500/30 bg-blue-900/5 hover:border-blue-500/50'
                    : 'border-white/5 hover:border-white/20'
                }`}
              >
                {!msg.is_read && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-l-2xl" />}
                <div className="p-4 flex items-start gap-3">
                  <div className={`p-2.5 rounded-xl shrink-0 ${
                    msg.type === 'MESSAGE' ? 'bg-purple-600/10 text-purple-400' : 'bg-emerald-600/10 text-emerald-400'
                  }`}>
                    {msg.type === 'MESSAGE' ? <MessageSquare className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-black text-slate-200">{msg.sender_name || 'System'}</span>
                      <span className="text-[9px] text-slate-500">
                        {msg.created_at ? new Date(msg.created_at).toLocaleString('ko-KR') : ''}
                      </span>
                    </div>
                    <h3 className={`text-sm font-bold truncate mb-0.5 ${!msg.is_read ? 'text-white' : 'text-slate-400'}`}>
                      {msg.title}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-1">
                      {stripMarkdown(msg.preview || msg.content)}
                    </p>
                  </div>
                  <div className="flex flex-col items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={e => { e.stopPropagation(); handleDelete(msg.id); }}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/10 hover:text-red-400 text-slate-400 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 text-center opacity-40">
            <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4">
              <Inbox className="w-8 h-8 text-slate-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-400">메시지함이 비어 있습니다</h3>
            <p className="text-slate-500 text-sm mt-1">새로운 소식이 오면 여기에 표시됩니다.</p>
          </div>
        )}
      </div>

      {/* ─── 디테일 모달 (슬라이드업) ─── */}
      {selectedMsg && (
        <div className="fixed inset-0 z-[200] flex items-end">
          {/* 배경 딤 */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSelectedMsg(null)} />

          {/* 모달 패널 */}
          <div className="relative w-full max-h-[90vh] bg-[#0f1219] rounded-t-3xl border-t border-white/10 flex flex-col animate-in slide-in-from-bottom duration-300 z-10">
            {/* 모달 핸들 */}
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/5 shrink-0">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-xl ${selectedMsg.type === 'REPORT' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-purple-500/10 text-purple-400'}`}>
                  {selectedMsg.type === 'REPORT' ? <FileText className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                </div>
                <div>
                  <p className="text-xs font-black text-white truncate max-w-[220px]">{selectedMsg.title}</p>
                  <p className="text-[9px] text-slate-500 font-mono">
                    {selectedMsg.sender_name} · {selectedMsg.created_at ? new Date(selectedMsg.created_at).toLocaleString('ko-KR') : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => setSelectedMsg(null)} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 모달 컨텐츠 */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {selectedMsg.type === 'REPORT' && selectedMsg.content ? (
                <MarkdownViewer text={selectedMsg.content} />
              ) : (
                <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                  {selectedMsg.content || selectedMsg.preview || '내용 없음'}
                </p>
              )}
            </div>

            {/* 모달 하단 액션 */}
            <div className="shrink-0 px-4 pb-8 pt-3 border-t border-white/5 flex gap-2">
              <button
                onClick={() => handleDelete(selectedMsg.id)}
                className="flex-1 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-black hover:bg-red-500/20 transition-all flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" /> 삭제
              </button>
              <button
                onClick={() => setSelectedMsg(null)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-xs font-black hover:bg-white/10 transition-all"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
