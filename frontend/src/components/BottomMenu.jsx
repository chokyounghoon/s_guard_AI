import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, MessageSquare, Activity, Search, MoreHorizontal, Users, User, Network, Shield, FileText, Bot, BookOpen, Inbox, Cpu, Layers, BellDot, Hash, Keyboard, Bell } from 'lucide-react';

export default function BottomMenu({ currentPath, onWarRoomClick, onReportClick, onAiClick, showAiPulse = true, user, initialOpenMoreMenu }) {
  const navigate = useNavigate();
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  React.useEffect(() => {
    if (initialOpenMoreMenu) setShowMoreMenu(true);
  }, [initialOpenMoreMenu]);

  return (
    <>
      {/* Flat Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#0f1219]/95 backdrop-blur-md border-t border-white/10 flex justify-around items-center px-2 pt-3 pb-[env(safe-area-inset-bottom,12px)] print:hidden">
        {[
          { id: 'home', label: '홈', icon: Home, path: '/dashboard' },
          { id: 'chat', label: 'War-Room', icon: MessageSquare, path: '/chat', action: onWarRoomClick },
          { id: 'inbox', label: 'Report', icon: FileText, path: '/inbox' },
          { id: 'my', label: 'MY', icon: User, path: '/my-assignments' },
          { id: 'more', label: '더보기', icon: MoreHorizontal, action: () => setShowMoreMenu(true) },
        ].map((item) => {
          const isActive = currentPath === item.path || (item.path && currentPath?.startsWith(item.path));
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => item.action ? item.action() : navigate(item.path)}
              className={`flex flex-col items-center gap-1 px-2 py-1 rounded-xl transition-all duration-200 relative min-w-[48px] ${
                isActive ? 'text-blue-400' : 'text-slate-500'
              }`}
            >
              {isActive && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-blue-400 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
              )}
              <div className="relative">
                <Icon className={`w-5 h-5 transition-all duration-200 ${isActive ? 'drop-shadow-[0_0_6px_rgba(59,130,246,0.6)]' : ''}`} />
                {item.isAi && showAiPulse && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-purple-500 rounded-full border border-[#0f111a] animate-pulse" />
                )}
              </div>
              <span className={`text-[9px] font-bold tracking-tight leading-none ${isActive ? 'text-blue-400' : 'text-slate-600'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* More Menu Popup */}
      {showMoreMenu && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowMoreMenu(false)} />
          <div className="w-full max-w-xl rounded-t-[2rem] border-t border-white/10 shadow-2xl relative z-10 overflow-hidden flex flex-col"
            style={{ background: '#0e1118', maxHeight: '85vh' }}>

            {/* 헤더 */}
            <div className="pt-4 pb-3 px-6 flex flex-col items-center" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="w-10 h-1 rounded-full mb-4" style={{ background: 'rgba(255,255,255,0.1)' }} />
              <h3 className="text-lg font-black text-white tracking-tight">System Console</h3>
              <p className="text-[9px] font-black uppercase tracking-[0.25em] mt-0.5" style={{ color: '#3b82f6' }}>Management & Intelligence</p>
            </div>

            {/* Manual Entry - 전체 너비 강조 버튼 */}
            <div style={{ padding: '4px 16px 0' }}>
              <div
                onClick={() => { setShowMoreMenu(false); navigate('/incident-push', { state: { from: 'system-console' } }); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 18px',
                  background: 'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(5,150,105,0.06) 100%)',
                  border: '1px solid rgba(16,185,129,0.25)',
                  borderRadius: 16, cursor: 'pointer',
                  position: 'relative', overflow: 'hidden',
                }}
              >
                <div style={{
                  position: 'absolute', top: 0, left: 0, bottom: 0, width: 3,
                  background: 'linear-gradient(180deg, #10b981, #059669)',
                  borderRadius: '16px 0 0 16px',
                }} />
                <div style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <MessageSquare size={18} color="#10b981" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 900, color: '#e2e8f0', letterSpacing: '0.01em' }}>Manual Entry</div>
                  <div style={{ fontSize: 10, color: '#10b981', fontWeight: 700, letterSpacing: '0.06em', opacity: 0.8 }}>INCIDENT INJECTION · 장애 수동 접수</div>
                </div>
                <div style={{
                  width: 28, height: 28, borderRadius: 9,
                  background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <span style={{ fontSize: 14, color: '#10b981', fontWeight: 900 }}>›</span>
                </div>
              </div>
            </div>

            {/* 그리드: 2열 (Manual Entry 제외) */}
            <div className="flex-1 overflow-y-auto p-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {[
                { label: 'Orbital\nCommand', sub: 'RAG Control', icon: Cpu, path: '/orbital-command', color: '#06b6d4' },
                { label: 'Alert\nMonitor', sub: '임계치 분류', icon: BellDot, path: '/alert-monitor', color: '#ef4444' },
                { label: 'Incident\nKeyword', sub: 'Global Match', icon: Hash, path: '/incident-keyword', color: '#22d3ee' },
                { label: 'Personal\nKeyword', sub: 'My Watchlist', icon: Keyboard, path: '/user-keyword', color: '#06b6d4' },
                { label: 'Report\nLine', sub: 'Approval', icon: Users, path: '/report-line-management', color: '#a855f7' },
                { label: 'Accounts', sub: 'Security Admin', icon: User, path: '/user-management', color: '#3b82f6' },
                { label: 'Security\nLogs', sub: 'Audit Trails', icon: Shield, path: '/security-logs', color: '#6366f1', adminOnly: true },
                { label: 'Organization', sub: 'Org Hierarchy', icon: Network, path: '/organization-management', color: '#10b981' },
                { label: 'Knowledge\nBase', sub: 'RAG Docs', icon: FileText, path: '/knowledge-base', color: '#0ea5e9' },
                { label: 'Global\nStats', sub: 'Metrics', icon: Activity, path: '/overall-status', color: '#f97316' },
                { label: 'War-Room\nHub', sub: 'Channels', icon: Shield, path: '/warroom-management', color: '#ef4444' },
                { label: 'Codebook', sub: 'Metadata', icon: BookOpen, path: '/codebook-management', color: '#eab308' },
                { label: 'Data\nFlow', sub: 'DFD', icon: Layers, path: '/processing-flow', color: '#3b82f6', adminOnly: true },
                { label: 'Push\nDiagnostic', sub: 'Notification', icon: Bell, path: '/push-diagnostic', color: '#f59e0b' },
                { label: 'AI\nReport', sub: '장애 분석서', icon: FileText, action: onReportClick, color: '#3b82f6' },
                { label: 'AI Report\n(Detail)', sub: '분석서 상세', icon: FileText, path: '/ai-report', color: '#6366f1' },
                { label: 'Report\nSearch', sub: '통합 검색', icon: Search, path: '/mobile-report-search', color: '#10b981' },
              ].filter(m => !m.adminOnly || user?.is_admin === 1 || user?.role === 'admin').map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    onClick={() => { setShowMoreMenu(false); item.action ? item.action() : navigate(item.path, { state: { from: 'system-console' } }); }}
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      borderRadius: 16,
                      padding: '14px 8px 12px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      gap: 6,
                      transition: 'background 0.2s',
                    }}
                  >
                    <div style={{
                      width: 40, height: 40, borderRadius: 12,
                      background: `${item.color}18`,
                      border: `1px solid ${item.color}30`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <Icon size={18} color={item.color} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#e2e8f0', lineHeight: 1.3, whiteSpace: 'pre-line' }}>
                      {item.label}
                    </span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: '#475569', letterSpacing: '0.04em', textTransform: 'uppercase', lineHeight: 1.2 }}>
                      {item.sub}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* 닫기 */}
            <div style={{ padding: '12px 16px', paddingBottom: 'calc(12px + env(safe-area-inset-bottom))', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <button
                onClick={() => setShowMoreMenu(false)}
                style={{ width: '100%', padding: '13px', borderRadius: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#64748b', fontSize: 13, fontWeight: 800, cursor: 'pointer', letterSpacing: '0.06em' }}
              >
                CLOSE CONSOLE
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
