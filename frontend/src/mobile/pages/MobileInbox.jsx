import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Inbox as InboxIcon, AlertTriangle, Info, Bell,
  ChevronRight, CheckCircle2, Loader2, MailOpen, RefreshCw
} from 'lucide-react';
import { getAccessToken, getAuthHeaders } from '../../lib/authStore';
import PullToRefresh from '../components/PullToRefresh';

const API_BASE = 'https://sguardai.khcho0421.workers.dev';

// /inbox API는 inbox_items 배열을 직접 반환
// { id, user_id, title, preview, type, urgency, is_read, inc_id, created_at, folder }
const URGENCY_MAP = {
  CRITICAL: { label: '긴급', color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/20',    icon: AlertTriangle },
  HIGH:     { label: '높음', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', icon: AlertTriangle },
  NORMAL:   { label: '일반', color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/10',   icon: Bell },
  LOW:      { label: '낮음', color: 'text-slate-400',  bg: 'bg-slate-500/10',  border: 'border-slate-500/10',  icon: Info },
};

export default function MobileInbox({ user }) {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const touchStartX = useRef(null);
  const [swipedId, setSwipedId] = useState(null);

  const fetchInbox = async () => {
    setLoading(true);
    try {
      const token = getAccessToken();
      const userId = user?.employee_id || user?.id;
      // user가 없더라도 일단 호출 (인터셉터가 JWT로 처리하므로 백엔드에서 user_id를 주입함)
      const url = userId 
        ? `${API_BASE}/inbox?user_id=${userId}`
        : `${API_BASE}/inbox`;

      const res = await fetch(url, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(`인박스 로드 실패: ${res.status}`);

      // API는 배열을 직접 반환
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.items || data.results || []);
      setItems(list);
      setUnreadCount(list.filter(i => !i.is_read).length);
    } catch (e) {
      console.error('[MobileInbox]', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (user) fetchInbox(); }, [user]);

  const markRead = async (id) => {
    try {
      const token = getAccessToken();
      await fetch(`${API_BASE}/inbox/${id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      setItems(prev => prev.map(i => i.id === id ? { ...i, is_read: 1 } : i));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (_) {}
  };

  const handleItemClick = (item) => {
    if (!item.is_read) markRead(item.id);
    if (item.inc_id) navigate(`/chat/${item.inc_id}`);
  };

  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e, id) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (diff > 60) setSwipedId(prev => (prev === id ? null : id));
    else if (diff < -40) setSwipedId(null);
  };

  const filtered = items.filter(i => {
    if (activeFilter === 'UNREAD') return !i.is_read;
    if (activeFilter === 'CRITICAL') return i.urgency === 'CRITICAL' || i.urgency === 'HIGH';
    return true;
  });

  return (
    <PullToRefresh onRefresh={fetchInbox}>
      <div className="flex-1 flex flex-col bg-[#0a0e17] pb-24">

      {/* 헤더 */}
      <header className="sticky top-0 z-40 bg-[#0a0e17]/95 backdrop-blur-md border-b border-white/5 fluid-px pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <InboxIcon className="w-5 h-5 text-blue-400" />
              <h1 className="font-black text-white text-lg">받은사건함</h1>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold bg-blue-600 text-white rounded-full px-2 py-0.5">{unreadCount}</span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {user?.name || ''} · {user?.honbu_name || user?.company || ''}
            </p>
          </div>
          <button onClick={fetchInbox} className="p-2 rounded-full hover:bg-white/10 transition-colors">
            <RefreshCw className={`w-4 h-4 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* 필터 탭 */}
        <div className="flex gap-2 mt-3">
          {[
            { key: 'ALL',      label: `전체 (${items.length})` },
            { key: 'UNREAD',   label: `안읽음${unreadCount > 0 ? ` (${unreadCount})` : ''}` },
            { key: 'CRITICAL', label: '긴급' },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setActiveFilter(key)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all ${
                activeFilter === key ? 'bg-blue-600 text-white' : 'bg-white/5 text-slate-400 border border-white/10'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* 리스트 */}
      <div className="fluid-px pt-3 space-y-2">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500/40" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-600">
            <MailOpen className="w-12 h-12 mb-4 opacity-30" />
            <p className="text-sm">{activeFilter === 'UNREAD' ? '읽지 않은 알림이 없습니다.' : '알림이 없습니다.'}</p>
          </div>
        ) : filtered.map((item) => {
          const u = URGENCY_MAP[item.urgency] || URGENCY_MAP.NORMAL;
          const Icon = u.icon;
          const isSwiped = swipedId === item.id;
          return (
            <div key={item.id} className="relative overflow-hidden rounded-2xl"
              onTouchStart={onTouchStart}
              onTouchEnd={(e) => onTouchEnd(e, item.id)}>
              {/* 스와이프 읽음 버튼 */}
              <div className={`absolute right-0 top-0 bottom-0 flex items-center justify-center bg-blue-600/80 rounded-r-2xl transition-all duration-200 ${isSwiped ? 'w-20' : 'w-0 overflow-hidden'}`}>
                <button onClick={() => { markRead(item.id); setSwipedId(null); }}
                  className="flex flex-col items-center gap-1">
                  <CheckCircle2 className="w-5 h-5 text-white" />
                  <span className="text-[9px] text-white font-bold">읽음</span>
                </button>
              </div>

              {/* 카드 */}
              <button onClick={() => handleItemClick(item)}
                style={{ transform: isSwiped ? 'translateX(-72px)' : 'translateX(0)', transition: 'transform 0.2s ease' }}
                className={`w-full text-left p-4 rounded-2xl transition-colors active:scale-[0.99] ${
                  !item.is_read ? 'bg-[#131927] border border-blue-500/15' : 'bg-[#0f1320] border border-white/5'
                }`}>
                <div className="flex gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${u.bg} border ${u.border}`}>
                    <Icon className={`w-5 h-5 ${u.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[10px] font-bold ${u.color}`}>{u.label}</span>
                      <span className="text-[10px] text-slate-600 font-mono">
                        {item.created_at
                          ? new Date(item.created_at.replace(' ', 'T'))
                              .toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                          : ''}
                      </span>
                    </div>
                    <p className={`text-sm font-semibold leading-snug truncate ${!item.is_read ? 'text-white' : 'text-slate-400'}`}>
                      {item.title}
                    </p>
                    {item.preview && (
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{item.preview}</p>
                    )}
                  </div>
                  {!item.is_read && <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1" />}
                </div>
                {item.inc_id && (
                  <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-blue-400/70">
                    <span>War-Room 열기</span>
                    <ChevronRight className="w-3 h-3" />
                  </div>
                )}
              </button>
            </div>
          );
        })}
      </div>
      </div>
    </PullToRefresh>
  );
}
