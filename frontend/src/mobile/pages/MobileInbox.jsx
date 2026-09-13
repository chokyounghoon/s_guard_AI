import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight, CheckCircle2, RefreshCw, Bot,
  AlertTriangle, FileBadge, MessageSquare, Send,
  LayoutGrid, Mail, BrainCircuit, Inbox as InboxIcon,
  Radio, Eye, X, Trash2
} from 'lucide-react';
import { getAccessToken, getAuthHeaders } from '../../lib/authStore';
import { useTheme } from '../../context/ThemeContext';
import PullToRefresh from '../components/PullToRefresh';

const API_BASE = 'https://sguardai.khcho0421.workers.dev';

const stripMarkdown = (str = '') =>
  str.replace(/\*\*([^*]*)\*\*/g, '$1').replace(/\*([^*\n]+)\*/g, '$1')
     .replace(/#{1,6}\s*/g, '').replace(/\n{3,}/g, '\n\n').trim();

const TABS = [
  { key: 'ALL',      label: 'All',      icon: LayoutGrid },
  { key: 'REPORTS',  label: 'Reports',  icon: FileBadge },
  { key: 'MESSAGES', label: 'Messages', icon: Mail },
  { key: 'SENT',     label: 'Sent',     icon: Send },
  { key: 'UNREAD',   label: 'Unread',   icon: Radio },
];

function getTypeStyle(item) {
  if (item.type === 'REPORT') {
    const isCrit = (item.urgency === 'CRITICAL') || (item.title || '').includes('긴급');
    return isCrit
      ? { accent: '#ef4444', bg: 'rgba(239,68,68,0.07)', border: 'rgba(239,68,68,0.22)', label: 'CRITICAL', icon: AlertTriangle }
      : { accent: '#10b981', bg: 'rgba(16,185,129,0.07)', border: 'rgba(16,185,129,0.22)', label: 'AI REPORT', icon: FileBadge };
  }
  return { accent: '#6366f1', bg: 'rgba(99,102,241,0.07)', border: 'rgba(99,102,241,0.2)', label: 'MESSAGE', icon: MessageSquare };
}

export default function MobileInbox({ user, onAiClick }) {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL');
  const [swipedId, setSwipedId] = useState(null);
  const [contextItem, setContextItem] = useState(null);
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const longPressTimer = useRef(null);

  const fetchInbox = async () => {
    setLoading(true);
    try {
      const userId = user?.employee_id || user?.id;
      const url = userId ? `${API_BASE}/inbox?user_id=${userId}` : `${API_BASE}/inbox`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : (data.items || data.results || []));
    } catch (e) { console.error('[MobileInbox]', e); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (user) fetchInbox(); }, [user]);

  const markRead = async (id) => {
    try {
      await fetch(`${API_BASE}/inbox/${id}/read`, { method: 'PATCH', headers: getAuthHeaders() });
      setItems(prev => prev.map(i => i.id === id ? { ...i, is_read: 1 } : i));
    } catch (_) {}
  };

  const handleOpen = (item) => {
    if (!item.is_read) markRead(item.id);
    if (item.inc_id) {
      const id = String(item.inc_id).replace(/^INC-/i, '');
      navigate(item.type === 'REPORT' ? `/ai-report/${id}` : `/chat/${id}`);
    }
  };

  const handleAiReport = (item) => {
    const id = String(item.inc_id || '').replace(/^INC-/i, '');
    if (id) navigate(`/ai-report/${id}`);
  };

  const onTouchStart = (e, item) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    longPressTimer.current = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(40);
      setContextItem(item);
    }, 500);
  };

  const onTouchMove = (e) => {
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

  const unreadCount = items.filter(i => !i.is_read).length;
  const reportsCount = items.filter(i => i.type === 'REPORT' && i.folder === 'INBOX').length;

  const filtered = items.filter(i => {
    if (activeTab === 'REPORTS') return i.type === 'REPORT' && i.folder === 'INBOX';
    if (activeTab === 'MESSAGES') return i.type === 'MESSAGE';
    if (activeTab === 'SENT') return i.folder === 'SENT';
    if (activeTab === 'UNREAD') return !i.is_read;
    return true;
  }).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  return (
    <PullToRefresh onRefresh={fetchInbox}>
      <div style={{ minHeight: '100dvh', background: isLight ? '#f1f5f9' : '#060810', paddingBottom: 100, transition: 'background 0.2s ease' }}>

        {/* ─── STICKY HEADER ─────────────────────────────────── */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 50,
          background: isLight ? 'rgba(255, 255, 255, 0.94)' : 'linear-gradient(160deg, #0b0e1a 0%, #0d1020 100%)',
          backdropFilter: 'blur(20px)',
          borderBottom: isLight ? '1px solid #e2e8f0' : 'rgba(255,255,255,0.06)',
          padding: '16px 18px 12px',
          boxShadow: isLight ? '0 1px 4px rgba(0,0,0,0.04)' : 'none',
        }}>
          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20, fontWeight: 900, color: isLight ? '#0f172a' : '#fff', letterSpacing: '-0.02em' }}>
                  Incident{' '}
                  <span style={{ background: 'linear-gradient(90deg,#818cf8,#6366f1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    Reports
                  </span>
                </span>
                {unreadCount > 0 && (
                  <span style={{ background: '#f59e0b', color: '#000', fontSize: 9, fontWeight: 900, borderRadius: 99, padding: '2px 7px', letterSpacing: '0.05em' }}>
                    {unreadCount} NEW
                  </span>
                )}
              </div>
              <p style={{ fontSize: 10, color: '#6366f1', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 2 }}>
                {user?.name} · {user?.team_name || '운영팀'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {onAiClick && (
                <button onClick={onAiClick} style={{ padding: 9, borderRadius: 12, background: isLight ? 'rgba(168,85,247,0.12)' : 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.25)', cursor: 'pointer' }}>
                  <Bot size={16} color="#a855f7" />
                </button>
              )}
              <button onClick={fetchInbox} style={{ padding: 9, borderRadius: 12, background: isLight ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', cursor: 'pointer' }}>
                <RefreshCw size={16} color="#6366f1" style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
              </button>
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
            {[
              { label: 'Total',   val: items.length,  color: '#6366f1' },
              { label: 'Unread',  val: unreadCount,    color: '#f59e0b' },
              { label: 'Reports', val: reportsCount,   color: '#10b981' },
            ].map(s => (
              <div key={s.label} style={{
                background: isLight ? '#ffffff' : `${s.color}0d`,
                border: isLight ? `1px solid #e2e8f0` : `1px solid ${s.color}25`,
                borderRadius: 14, padding: '8px 10px', textAlign: 'center',
                boxShadow: isLight ? '0 1px 3px rgba(0,0,0,0.03)' : 'none',
              }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: s.color, lineHeight: 1.1 }}>{s.val}</div>
                <div style={{ fontSize: 9, color: isLight ? '#64748b' : '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 2 }}>
            {TABS.map(tab => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '6px 13px', borderRadius: 99,
                    fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap',
                    border: 'none', cursor: 'pointer', flexShrink: 0,
                    background: isActive ? '#6366f1' : (isLight ? '#e2e8f0' : 'rgba(255,255,255,0.05)'),
                    color: isActive ? '#fff' : (isLight ? '#475569' : '#64748b'),
                    boxShadow: isActive ? '0 0 14px rgba(99,102,241,0.35)' : 'none',
                    transition: 'all 0.15s',
                  }}
                >
                  <tab.icon size={12} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── LIST ─────────────────────────────────────────── */}
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loading && items.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 14 }}>
              <div style={{ width: 32, height: 32, border: '3px solid rgba(99,102,241,0.2)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <span style={{ fontSize: 11, color: isLight ? '#64748b' : '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Syncing Feed...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0', color: isLight ? '#94a3b8' : '#334155' }}>
              <InboxIcon size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
              <p style={{ fontSize: 14, fontWeight: 700, color: isLight ? '#64748b' : '#475569' }}>No incidents found</p>
              <p style={{ fontSize: 12, color: isLight ? '#94a3b8' : '#334155', marginTop: 4 }}>새로운 리포트가 도착하면 여기에 표시됩니다</p>
            </div>
          ) : filtered.map((item) => {
            const t = getTypeStyle(item);
            const Icon = t.icon;
            const isSwiped = swipedId === item.id;
            const body = item.sms_message || item.preview || item.content || null;
            const timeStr = item.created_at
              ? new Date(item.created_at.replace(' ', 'T')).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
              : '';

            return (
              <div
                key={item.id}
                style={{ position: 'relative', overflow: 'hidden', borderRadius: 20 }}
                onTouchStart={e => onTouchStart(e, item)}
                onTouchMove={onTouchMove}
                onTouchEnd={e => onTouchEnd(e, item.id)}
              >
                {/* Swipe action */}
                <div style={{
                  position: 'absolute', right: 0, top: 0, bottom: 0,
                  width: isSwiped ? 80 : 0,
                  background: '#6366f1',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden', transition: 'width 0.22s ease',
                  borderRadius: '0 20px 20px 0',
                }}>
                  <button
                    onClick={e => { e.stopPropagation(); markRead(item.id); setSwipedId(null); }}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer', background: 'none', border: 'none' }}
                  >
                    <CheckCircle2 size={22} color="#fff" />
                    <span style={{ color: '#fff', fontSize: 9, fontWeight: 800 }}>Read</span>
                  </button>
                </div>

                {/* Card */}
                <div
                  onClick={() => { if (!isSwiped) handleOpen(item); else setSwipedId(null); }}
                  style={{
                    textAlign: 'left',
                    background: !item.is_read
                      ? (isLight ? '#ffffff' : `linear-gradient(135deg, ${t.bg} 0%, rgba(8,10,18,0.95) 70%)`)
                      : (isLight ? '#ffffff' : 'rgba(13,15,22,0.9)'),
                    border: `1px solid ${isLight ? '#e2e8f0' : (!item.is_read ? t.border : 'rgba(255,255,255,0.05)')}`,
                    borderLeft: `3px solid ${!item.is_read ? t.accent : (isLight ? '#cbd5e1' : 'rgba(255,255,255,0.06)')}`,
                    borderRadius: 20,
                    padding: '14px 14px 14px 13px',
                    cursor: 'pointer',
                    transform: isSwiped ? 'translateX(-72px)' : 'translateX(0)',
                    transition: 'transform 0.22s ease',
                    position: 'relative', zIndex: 1,
                    boxShadow: isLight ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
                  }}
                >
                  {/* Row 1: type badge + time */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 8, background: `${t.accent}18`, border: `1px solid ${t.accent}30` }}>
                        <Icon size={10} color={t.accent} />
                        <span style={{ fontSize: 9, fontWeight: 900, color: t.accent, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t.label}</span>
                      </div>
                      {!item.is_read && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, fontWeight: 900, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 6, padding: '2px 7px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          <span style={{ width: 5, height: 5, background: '#f59e0b', borderRadius: '50%', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
                          NEW
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 9, color: isLight ? '#64748b' : '#475569', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{timeStr}</span>
                  </div>

                  {/* Row 2: title */}
                  <p style={{ fontSize: 14, fontWeight: 800, color: !item.is_read ? (isLight ? '#0f172a' : '#fff') : (isLight ? '#475569' : '#64748b'), lineHeight: 1.4, marginBottom: 6 }}>
                    {item.title || `INC-${item.inc_id}`}
                  </p>

                  {/* Row 3: body preview */}
                  {body && (
                    <div style={{ background: isLight ? '#f8fafc' : 'rgba(0,0,0,0.25)', border: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.07)'}`, borderRadius: 10, padding: '8px 10px', marginBottom: 10 }}>
                      <p style={{ fontSize: 12, color: isLight ? '#334155' : '#94a3b8', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {stripMarkdown(body)}
                      </p>
                    </div>
                  )}

                  {/* Row 4: sender + actions */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: `1px solid ${isLight ? '#f1f5f9' : 'rgba(255,255,255,0.05)'}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.06)', border: `1px solid ${isLight ? '#cbd5e1' : 'rgba(255,255,255,0.08)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900, color: isLight ? '#475569' : '#64748b' }}>
                        {(item.sender_name || 'S').charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontSize: 11, color: isLight ? '#334155' : '#475569', fontWeight: 700 }}>{item.sender_name || 'System'}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {item.inc_id && (
                        <button
                          onClick={e => { e.stopPropagation(); handleAiReport(item); }}
                          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 10, background: isLight ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.28)', cursor: 'pointer' }}
                        >
                          <BrainCircuit size={11} color="#6366f1" />
                          <span style={{ fontSize: 10, fontWeight: 800, color: '#6366f1' }}>AI</span>
                        </button>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 800, color: t.accent }}>
                        <Eye size={12} />
                        {item.type === 'REPORT' ? 'Report' : 'Open'}
                        <ChevronRight size={12} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ─── CONTEXT BOTTOM SHEET ──────────────────────────── */}
        {contextItem && (
          <>
            <div onClick={() => setContextItem(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 350, backdropFilter: 'blur(6px)' }} />
            <div style={{
              position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 351,
              background: isLight ? '#ffffff' : '#0d0f18',
              borderRadius: '24px 24px 0 0',
              border: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)'}`,
              borderBottom: 'none',
              padding: '12px 0 44px',
              boxShadow: isLight ? '0 -10px 40px rgba(0,0,0,0.1)' : '0 -20px 50px rgba(0,0,0,0.7)',
            }}>
              <div style={{ width: 36, height: 4, background: isLight ? '#cbd5e1' : 'rgba(255,255,255,0.12)', borderRadius: 99, margin: '0 auto 16px' }} />
              
              <div style={{ padding: '0 20px 14px', borderBottom: `1px solid ${isLight ? '#f1f5f9' : 'rgba(255,255,255,0.06)'}` }}>
                <p style={{ fontSize: 10, color: '#6366f1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Selected Item</p>
                <p style={{ fontSize: 14, color: isLight ? '#0f172a' : '#fff', fontWeight: 800, lineHeight: 1.4 }}>{contextItem.title || `INC-${contextItem.inc_id}`}</p>
              </div>

              <div style={{ marginTop: 6 }}>
                {!contextItem.is_read && (
                  <button onClick={() => { markRead(contextItem.id); setContextItem(null); }} style={actionBtnStyle}>
                    <CheckCircle2 size={20} color="#10b981" />
                    <span style={{ fontSize: 15, color: isLight ? '#0f172a' : '#e2e8f0', fontWeight: 700 }}>Mark as Read</span>
                  </button>
                )}
                {contextItem.inc_id && (
                  <>
                    <button onClick={() => { handleOpen(contextItem); setContextItem(null); }} style={actionBtnStyle}>
                      <Eye size={20} color="#6366f1" />
                      <span style={{ fontSize: 15, color: isLight ? '#0f172a' : '#e2e8f0', fontWeight: 700 }}>
                        {contextItem.type === 'REPORT' ? 'View Report' : 'Open War-Room'}
                      </span>
                    </button>
                    <button onClick={() => { handleAiReport(contextItem); setContextItem(null); }} style={actionBtnStyle}>
                      <BrainCircuit size={20} color="#6366f1" />
                      <span style={{ fontSize: 15, color: isLight ? '#0f172a' : '#e2e8f0', fontWeight: 700 }}>AI Analysis</span>
                    </button>
                  </>
                )}
                <button onClick={() => setContextItem(null)} style={{ ...actionBtnStyle, marginTop: 8, borderTop: `1px solid ${isLight ? '#f1f5f9' : 'rgba(255,255,255,0.06)'}`, paddingTop: 20 }}>
                  <X size={20} color={isLight ? '#64748b' : '#475569'} />
                  <span style={{ fontSize: 15, color: isLight ? '#64748b' : '#475569', fontWeight: 700 }}>Cancel</span>
                </button>
              </div>
            </div>
          </>
        )}

        <style>{`
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        `}</style>
      </div>
    </PullToRefresh>
  );
}

const actionBtnStyle = {
  width: '100%', padding: '16px 20px', background: 'none', border: 'none',
  display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer',
};
