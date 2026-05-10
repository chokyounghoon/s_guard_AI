import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Inbox as InboxIcon, AlertTriangle, Info, Bell,
  ChevronRight, CheckCircle2, MailOpen, RefreshCw, Hash, Bot,
  MessageSquare
} from 'lucide-react';
import { getAccessToken, getAuthHeaders } from '../../lib/authStore';
import PullToRefresh from '../components/PullToRefresh';

const API_BASE = 'https://sguardai.khcho0421.workers.dev';

const URGENCY_MAP = {
  CRITICAL: { label: '긴급', color: '#f87171', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)', icon: AlertTriangle },
  HIGH:     { label: '높음', color: '#fb923c', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.25)', icon: AlertTriangle },
  NORMAL:   { label: '일반', color: '#60a5fa', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.25)', icon: Bell },
  LOW:      { label: '낮음', color: '#94a3b8', bg: 'rgba(148,163,184,0.06)', border: 'rgba(148,163,184,0.15)', icon: Info },
};

const stripMarkdown = (str = '') =>
  str
    .replace(/\*\*([^*]*)\*\*/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/#{1,6}\s*/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

// 제목에서 장애 ID 이후 내용 제거 (콜론 기준 앞부분만 표시)
// 예: "[인시던트 보고서] 20260423084406535: 🕐 ..." → "[인시던트 보고서] 20260423084406535"
const cleanTitle = (title = '', item = {}) => {
  const colonIdx = title.indexOf(':');
  const baseTitle = colonIdx !== -1 ? title.substring(0, colonIdx).trim() : title.trim();
  
  let org = '상담';
  if (item.sender_org_path) {
    const parts = item.sender_org_path.trim().split(/\s+/);
    org = parts[parts.length - 1];
  }
  
  if (baseTitle.includes('보고서') || item.type === 'REPORT') {
    return `[${org} 장애 완료 보고서]`;
  }
  return `[${org}] ${baseTitle}`;
};

export default function MobileInbox({ user, onAiClick }) {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const [swipedId, setSwipedId] = useState(null);
  const [longPressItem, setLongPressItem] = useState(null); // 롱프레스 컨텍스트 메뉴
  const longPressTimer = useRef(null);

  const fetchInbox = async () => {
    setLoading(true);
    try {
      const userId = user?.employee_id || user?.id;
      const url = userId
        ? `${API_BASE}/inbox?user_id=${userId}`
        : `${API_BASE}/inbox`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`인박스 로드 실패: ${res.status}`);
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
    if (item.inc_id) {
      const cleanId = String(item.inc_id);
      navigate(item.type === 'REPORT' ? `/report/${cleanId}` : `/chat/${cleanId}`);
    }
  };

  const onTouchStart = (e, item) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    // 롱프레스 타이머 시작 (500ms)
    longPressTimer.current = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(40); // 진동 피드백
      setLongPressItem(item);
    }, 500);
  };

  const onTouchMove = (e) => {
    // 손가락이 많이 움직이면 롱프레스 취소
    const dx = Math.abs(e.touches[0].clientX - touchStartX.current);
    const dy = Math.abs(e.touches[0].clientY - touchStartY.current);
    if (dx > 10 || dy > 10) clearTimeout(longPressTimer.current);
  };

  const onTouchEnd = (e, id) => {
    clearTimeout(longPressTimer.current);
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (diff > 60) setSwipedId(prev => (prev === id ? null : id));
    else if (diff < -40) setSwipedId(null);
  };

  const filtered = items.filter(i => {
    if (activeFilter === 'UNREAD') return !i.is_read;
    if (activeFilter === 'CRITICAL') return i.urgency === 'CRITICAL' || i.urgency === 'HIGH';
    return true;
  });

  const FILTERS = [
    { key: 'ALL',      label: `전체 ${items.length}` },
    { key: 'UNREAD',   label: `안읽음 ${unreadCount}` },
    { key: 'CRITICAL', label: '긴급' },
  ];

  return (
    <PullToRefresh onRefresh={fetchInbox}>
      <div style={{ minHeight: '100dvh', background: '#0a0c12', paddingBottom: 100 }}>

        {/* 헤더 */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 50,
          background: 'rgba(10,12,18,0.96)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          padding: '16px 20px 12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <InboxIcon size={20} color="#60a5fa" />
              <span style={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>나의 레포트 수신함</span>
              {unreadCount > 0 && (
                <span style={{
                  background: '#2563eb', color: '#fff',
                  fontSize: 10, fontWeight: 800,
                  borderRadius: 99, padding: '2px 7px',
                }}>
                  {unreadCount}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {onAiClick && (
                <button
                  onClick={onAiClick}
                  style={{ padding: 8, borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}
                >
                  <Bot size={16} color="#a855f7" style={{ filter: 'drop-shadow(0 0 6px rgba(168,85,247,0.4))' }} />
                </button>
              )}
              <button
                onClick={fetchInbox}
                style={{ padding: 8, borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}
              >
                <RefreshCw size={16} color="#94a3b8" style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
              </button>
            </div>
          </div>

          {/* 필터 */}
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
            {FILTERS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveFilter(key)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 99,
                  fontSize: 12,
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  border: 'none',
                  cursor: 'pointer',
                  background: activeFilter === key ? '#2563eb' : 'rgba(255,255,255,0.06)',
                  color: activeFilter === key ? '#fff' : '#64748b',
                  transition: 'all 0.15s',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 리스트 */}
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loading && items.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
              <div style={{ width: 32, height: 32, border: '3px solid rgba(59,130,246,0.2)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0', color: '#475569' }}>
              <MailOpen size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
              <p style={{ fontSize: 14 }}>알림이 없습니다.</p>
            </div>
          ) : filtered.map((item) => {
            const u = URGENCY_MAP[item.urgency] || URGENCY_MAP.NORMAL;
            const Icon = u.icon;
            const isSwiped = swipedId === item.id;

            // 표시할 문자 본문: received_messages에서 조인된 sms_message 우선
            const bodyText = item.sms_message || item.content || item.preview || null;

            return (
              <div
                key={item.id}
                style={{ position: 'relative', overflow: 'hidden', borderRadius: 20 }}
                onTouchStart={(e) => onTouchStart(e, item)}
                onTouchMove={onTouchMove}
                onTouchEnd={(e) => onTouchEnd(e, item.id)}
              >
                {/* 스와이프 읽음 버튼 */}
                <div style={{
                  position: 'absolute', right: 0, top: 0, bottom: 0,
                  width: isSwiped ? 80 : 0,
                  background: '#2563eb',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden',
                  transition: 'width 0.25s ease',
                  borderRadius: '0 20px 20px 0',
                }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); markRead(item.id); setSwipedId(null); }}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer', background: 'none', border: 'none' }}
                  >
                    <CheckCircle2 size={22} color="#fff" />
                    <span style={{ color: '#fff', fontSize: 9, fontWeight: 800 }}>읽음</span>
                  </button>
                </div>

                {/* 카드 */}
                <button
                  onClick={() => handleItemClick(item)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: !item.is_read ? u.bg : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${!item.is_read ? u.border : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: 20,
                    padding: '16px',
                    cursor: 'pointer',
                    transform: isSwiped ? 'translateX(-72px)' : 'translateX(0)',
                    transition: 'transform 0.25s ease',
                    position: 'relative',
                    zIndex: 1,
                  }}
                >
                  {/* 제목 + 수신일자 */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: bodyText ? 10 : 0 }}>
                    <p style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: !item.is_read ? '#fff' : '#64748b',
                      lineHeight: 1.4,
                      flex: 1,
                      minWidth: 0,
                    }}>
                      {!item.is_read && (
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6', display: 'inline-block', marginRight: 6, verticalAlign: 'middle', flexShrink: 0 }} />
                      )}
                      {cleanTitle(item.title, item)}
                    </p>
                    {item.created_at && (() => {
                      const d = new Date(item.created_at.replace(' ', 'T'));
                      const pad = n => String(n).padStart(2, '0');
                      const fmt = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
                      return (
                        <span style={{ fontSize: 10, color: '#475569', fontFamily: 'monospace', whiteSpace: 'nowrap', paddingTop: 2, flexShrink: 0 }}>
                          {fmt}
                        </span>
                      );
                    })()}
                  </div>

                  {/* 문자 본문 - received_messages에서 조인된 내용 */}
                  {bodyText && (
                    <div style={{
                      background: 'rgba(0,0,0,0.25)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 12,
                      padding: '10px 12px',
                      marginBottom: 10,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                        <MessageSquare size={11} color="#60a5fa" />
                        <span style={{ fontSize: 10, color: '#60a5fa', fontWeight: 700 }}>문자 본문</span>
                      </div>
                      <p style={{
                        fontSize: 13,
                        color: '#cbd5e1',
                        lineHeight: 1.6,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                        display: '-webkit-box',
                        WebkitLineClamp: 5,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}>
                        {stripMarkdown(bodyText)}
                      </p>
                    </div>
                  )}

                  {/* 하단: 더보기 */}
                  {item.inc_id && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 3 }}>
                      <span style={{ fontSize: 11, color: u.color, fontWeight: 700 }}>
                        {item.type === 'REPORT' ? '리포트 보기' : 'War-Room 열기'}
                      </span>
                      <ChevronRight size={13} color={u.color} />
                    </div>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* 롱프레스 바텀시트 */}
        {longPressItem && (
          <>
            {/* 배경 딤 */}
            <div
              onClick={() => setLongPressItem(null)}
              style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
                zIndex: 100, backdropFilter: 'blur(4px)',
              }}
            />
            {/* 액션 시트 */}
            <div style={{
              position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 101,
              background: '#141820',
              borderRadius: '24px 24px 0 0',
              border: '1px solid rgba(255,255,255,0.08)',
              padding: '12px 0 40px',
            }}>
              {/* 핸들 */}
              <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 99, margin: '0 auto 16px' }} />

              {/* 선택된 항목 제목 */}
              <div style={{ padding: '0 20px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <p style={{ fontSize: 11, color: '#64748b', fontWeight: 700, marginBottom: 2 }}>선택된 항목</p>
                <p style={{ fontSize: 14, color: '#fff', fontWeight: 800 }}>{cleanTitle(longPressItem.title)}</p>
              </div>

              {/* 액션 목록 */}
              <div style={{ marginTop: 8 }}>
                {!longPressItem.is_read && (
                  <button
                    onClick={() => { markRead(longPressItem.id); setLongPressItem(null); }}
                    style={{
                      width: '100%', padding: '16px 20px', background: 'none', border: 'none',
                      display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer',
                    }}
                  >
                    <CheckCircle2 size={20} color="#60a5fa" />
                    <span style={{ fontSize: 15, color: '#e2e8f0', fontWeight: 600 }}>읽음으로 표시</span>
                  </button>
                )}
                {longPressItem.inc_id && (
                  <button
                    onClick={() => { handleItemClick(longPressItem); setLongPressItem(null); }}
                    style={{
                      width: '100%', padding: '16px 20px', background: 'none', border: 'none',
                      display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer',
                    }}
                  >
                    <ChevronRight size={20} color="#34d399" />
                    <span style={{ fontSize: 15, color: '#e2e8f0', fontWeight: 600 }}>
                      {longPressItem.type === 'REPORT' ? '리포트 상세보기' : 'War-Room 열기'}
                    </span>
                  </button>
                )}
                <button
                  onClick={() => setLongPressItem(null)}
                  style={{
                    width: '100%', padding: '16px 20px', background: 'none', border: 'none',
                    display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: 15, color: '#475569', fontWeight: 600 }}>취소</span>
                </button>
              </div>
            </div>
          </>
        )}

        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </PullToRefresh>
  );
}
