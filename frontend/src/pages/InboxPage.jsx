import React, { useState, useEffect } from 'react';
import { 
  Inbox, 
  MessageSquare, 
  FileText, 
  ChevronRight, 
  Search, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Hash,
  Filter,
  MoreVertical,
  Send,
  ArrowLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function InboxPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);

  // Load user profile
  useEffect(() => {
    const savedUser = localStorage.getItem('sguard_user');
    if (savedUser) {
      setUserProfile(JSON.parse(savedUser));
    }
  }, []);

  const fetchInbox = async () => {
    if (!userProfile?.employee_id) return;
    
    setLoading(true);
    try {
      let folderParam = 'INBOX';
      if (activeTab === 'sent_report') folderParam = 'SENT';
      
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

  useEffect(() => {
    fetchInbox();
  }, [userProfile, activeTab]);

  const handleMarkAsRead = async (id) => {
    try {
      const res = await fetch(`https://sguardai.khcho0421.workers.dev/inbox/${id}/read`, {
        method: 'PATCH'
      });
      if (res.ok) {
        setMessages(prev => prev.map(m => m.id === id ? { ...m, is_read: 1 } : m));
      }
    } catch (e) {
      console.error('Failed to mark as read', e);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('이 메시지를 삭제하시겠습니까?')) return;
    
    try {
      const res = await fetch(`https://sguardai.khcho0421.workers.dev/inbox/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setMessages(prev => prev.filter(m => m.id !== id));
      }
    } catch (e) {
      console.error('Failed to delete item', e);
    }
  };

  const filteredMessages = messages.filter(msg => {
    const matchesSearch = (msg.title || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (msg.sender_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeTab === 'all') return matchesSearch;
    if (activeTab === 'message') return matchesSearch && msg.type === 'MESSAGE';
    if (activeTab === 'received_report') return matchesSearch && msg.type === 'REPORT' && msg.folder === 'INBOX';
    if (activeTab === 'sent_report') return matchesSearch && msg.type === 'REPORT' && msg.folder === 'SENT';
    
    return matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#0a0c14] text-slate-200 pb-24">
      {/* Header Section */}
      <div className="bg-gradient-to-b from-blue-900/20 to-transparent pt-12 pb-8 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => navigate(-1)}
                className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 text-slate-400 hover:text-white transition-all mr-2"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="p-3 bg-blue-600/20 rounded-2xl border border-blue-500/30">
                <Inbox className="w-8 h-8 text-blue-400" />
              </div>
              <div>
                <h1 className="text-3xl font-black text-white tracking-tight">메시지함</h1>
                <p className="text-slate-500 text-sm font-medium mt-1">쪽지 및 보고서 알림을 확인하세요</p>
              </div>
            </div>
            <div className="flex items-center bg-white/5 border border-white/10 rounded-2xl px-4 py-2 hover:border-blue-500/30 transition-all group">
              <Search className="w-5 h-5 text-slate-500 group-hover:text-blue-400 transition-colors" />
              <input 
                type="text" 
                placeholder="검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none focus:outline-none ml-3 text-sm placeholder:text-slate-600 w-48"
              />
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center p-1.5 bg-white/5 rounded-2xl w-fit border border-white/10 space-x-1">
            {[
              { id: 'all', label: '전체', icon: Hash },
              { id: 'message', label: '쪽지', icon: MessageSquare },
              { id: 'received_report', label: '받은 보고서', icon: FileText },
              { id: 'sent_report', label: '보낸 보고서', icon: Send }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-6 py-2 rounded-xl text-sm font-bold transition-all ${
                  activeTab === tab.id 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' 
                    : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.id === 'all' && messages.some(m => !m.is_read) && (
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full ml-1" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Message List Area */}
      <div className="max-w-4xl mx-auto px-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <div className="w-12 h-12 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
            <p className="text-slate-500 font-medium">데이터를 불러오는 중...</p>
          </div>
        ) : filteredMessages.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-2 mb-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
              <span>LISTING {filteredMessages.length} ITEMS</span>
              <div className="flex items-center space-x-4">
                <button className="flex items-center hover:text-slate-200 transition-colors">
                  <Filter className="w-3 h-3 mr-1" /> FILTER
                </button>
                <button className="flex items-center hover:text-slate-200 transition-colors">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> READ ALL
                </button>
              </div>
            </div>

            {filteredMessages.map((msg) => (
              <div 
                key={msg.id}
                onClick={() => {
                  if (!msg.is_read) handleMarkAsRead(msg.id);
                  if (msg.type === 'REPORT' && msg.inc_id) {
                    navigate(`/chat-summary/${msg.inc_id}`);
                  }
                }}
                className={`group relative bg-[#11141d] rounded-[1.5rem] border transition-all cursor-pointer overflow-hidden ${
                  !msg.is_read 
                    ? 'border-blue-500/30 bg-blue-900/5 hover:border-blue-500/50 hover:bg-blue-900/10' 
                    : 'border-white/5 hover:border-white/20'
                }`}
              >
                {!msg.is_read && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />
                )}
                
                <div className="p-5 flex items-start gap-4">
                  <div className={`p-3 rounded-2xl ${
                    msg.type === 'MESSAGE' ? 'bg-purple-600/10 text-purple-400' : 'bg-emerald-600/10 text-emerald-400'
                  }`}>
                    {msg.type === 'MESSAGE' ? <MessageSquare className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-black text-slate-200 tracking-tight">{msg.sender_name || 'System'}</span>
                        <span className="text-[10px] text-slate-500">●</span>
                        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-tighter">
                          {msg.created_at ? new Date(msg.created_at).toLocaleString('ko-KR') : ''}
                        </span>
                      </div>
                      {msg.urgency === 'CRITICAL' && (
                        <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 text-[8px] font-black border border-red-500/30 uppercase animate-pulse">URGENT</span>
                      )}
                    </div>
                    <h3 className={`text-base font-bold truncate mb-1 ${!msg.is_read ? 'text-white' : 'text-slate-400'}`}>
                      {msg.title}
                    </h3>
                    <p className="text-sm text-slate-500 line-clamp-1">
                      {msg.preview || msg.content}
                    </p>
                  </div>

                  <div className="flex flex-col items-center space-y-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDelete(msg.id); }}
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); }}
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 text-center opacity-40">
            <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mb-6">
              <Inbox className="w-10 h-10 text-slate-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-400">메시지함이 비어 있습니다</h3>
            <p className="text-slate-500 mt-2">새로운 소식이 오면 여기에 표시됩니다.</p>
          </div>
        )}
      </div>

      {/* Quick Action Floating Button (Mobile Style) */}
      <div className="fixed right-6 bottom-28 z-40">
        <button className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-900/50 hover:scale-110 active:scale-95 transition-all">
          <MessageSquare className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}
