import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, MessageSquare, Activity, Search, MoreHorizontal, Users, User, Network, Shield, FileText, Bot, BookOpen, Inbox, Cpu, Layers, BellDot, Hash, Keyboard, Bell, Phone } from 'lucide-react';

export default function BottomMenu({ currentPath, onWarRoomClick, onReportClick, onAiClick, showAiPulse = true, user, initialOpenMoreMenu }) {
  const navigate = useNavigate();
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  React.useEffect(() => {
    if (initialOpenMoreMenu) setShowMoreMenu(true);
  }, [initialOpenMoreMenu]);

  return (
    <>
      {/* Flat Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-[250] bg-[#0f1219]/95 backdrop-blur-md border-t border-white/10 flex justify-around items-center px-2 pt-3 pb-[env(safe-area-inset-bottom,12px)] print:hidden">
        {[
          { id: 'home', label: '홈', icon: Home, path: '/dashboard' },
          { id: 'chat', label: 'WAR-ROOM', icon: MessageSquare, path: '/chat', action: onWarRoomClick },
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
              className={`flex flex-col items-center gap-1.5 px-2 py-1.5 rounded-2xl transition-all duration-300 relative min-w-[56px] ${
                isActive ? 'bg-blue-500/10 scale-105' : 'hover:bg-white/5 opacity-70 hover:opacity-100'
              }`}
            >
              {isActive && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-400 rounded-full shadow-[0_0_12px_rgba(59,130,246,1)]" />
              )}
              <div className="relative">
                <Icon className={`w-5 h-5 transition-all duration-300 ${isActive ? 'text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]' : 'text-slate-400'}`} />
                {item.isAi && showAiPulse && (
                  <span className="absolute -top-1.5 -right-1.5 w-2.5 h-2.5 bg-purple-500 rounded-full border-2 border-[#0f1219] animate-pulse shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
                )}
              </div>
              <span className={`text-[9px] font-black tracking-widest leading-none uppercase whitespace-nowrap ${isActive ? 'text-blue-400' : 'text-slate-500'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* More Menu Popup */}
      {showMoreMenu && (
        <div className="fixed inset-0 z-[260] flex items-end justify-center">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowMoreMenu(false)} />
          <div className="w-full max-w-xl rounded-t-[2.5rem] border-t border-white/10 shadow-2xl relative z-10 overflow-hidden flex flex-col animate-in slide-in-from-bottom-full duration-500"
            style={{ background: '#0e1118', maxHeight: '85vh' }}>

            {/* 헤더 */}
            <div className="pt-6 pb-6 px-6 flex flex-col items-center relative" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-blue-600/10 blur-[60px] rounded-full pointer-events-none" />
              <div className="w-12 h-1.5 rounded-full mb-5 bg-white/10" />
              <h3 className="text-xl font-black text-white tracking-tight">System Console</h3>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] mt-2 text-blue-500 leading-none" style={{ paddingBottom: '8px' }}>Management & Intelligence</p>
            </div>

            {/* Manual Entry - 전체 너비 강조 버튼 */}
            <div style={{ padding: '16px 20px 8px' }}>
              <div
                onClick={() => {
                  setShowMoreMenu(false);
                  sessionStorage.setItem('console_return_pending', '1');
                  navigate('/incident-push', { state: { from: 'system-console' } });
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  padding: '18px 20px',
                  background: 'linear-gradient(135deg, rgba(16,185,129,0.18) 0%, rgba(5,150,105,0.08) 100%)',
                  border: '1px solid rgba(16,185,129,0.3)',
                  borderRadius: 20, cursor: 'pointer',
                  position: 'relative', overflow: 'hidden',
                  boxShadow: '0 8px 24px -6px rgba(0,0,0,0.4), 0 0 12px rgba(16,185,129,0.1)'
                }}
              >
                <div style={{
                  position: 'absolute', top: 0, left: 0, bottom: 0, width: 4,
                  background: 'linear-gradient(180deg, #10b981, #059669)',
                }} />
                <div style={{
                  width: 44, height: 44, borderRadius: 14,
                  background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  boxShadow: 'inset 0 0 10px rgba(16,185,129,0.2)'
                }}>
                  <MessageSquare size={20} color="#10b981" style={{ filter: 'drop-shadow(0 0 8px rgba(16,185,129,0.6))' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 900, color: '#f8fafc', letterSpacing: '0.01em' }}>Manual Entry</div>
                  <div style={{ fontSize: 10, color: '#10b981', fontWeight: 800, letterSpacing: '0.08em', opacity: 0.9 }}>INCIDENT INJECTION · 장애 수동 접수</div>
                </div>
                <div style={{
                  width: 32, height: 32, borderRadius: 10,
                  background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <span style={{ fontSize: 16, color: '#10b981', fontWeight: 900 }}>›</span>
                </div>
              </div>
            </div>

            {/* 그리드: 2열 (전체 시스템 콘솔 메뉴 복구) */}
            <div className="flex-1 overflow-y-auto p-5" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
              {[
                { label: 'Incident\nKW', sub: '장애 키워드', icon: Hash, path: '/incident-keyword', color: '#22d3ee' },
                { label: 'Personal\nKW', sub: '개인 키워드', icon: Keyboard, path: '/user-keyword', color: '#06b6d4' },
                { label: 'Report\nLine', sub: '결재선 관리', icon: Users, path: '/report-line-management', color: '#a855f7' },
                { label: 'Accounts', sub: '계정 관리', icon: User, path: '/user-management', color: '#3b82f6' },
                { label: 'Security\nLogs', sub: '보안 로그', icon: Shield, path: '/security-logs', color: '#6366f1', adminOnly: true },
                { label: 'Organization', sub: '조직 관리', icon: Network, path: '/organization-management', color: '#10b981' },
                { label: 'Knowledge\nBase', sub: '지식 베이스', icon: FileText, path: '/knowledge-base', color: '#0ea5e9' },
                { label: 'Global\nStats', sub: '전체 현황', icon: Activity, path: '/overall-status', color: '#f97316' },
                { label: 'War-Room\nHub', sub: '워룸 관리', icon: Shield, path: '/warroom-management', color: '#ef4444' },
                { label: 'Codebook', sub: '코드북 관리', icon: BookOpen, path: '/codebook-management', color: '#eab308' },
                { label: 'Data\nFlow', sub: '데이터 흐름', icon: Layers, path: '/processing-flow', color: '#3b82f6', adminOnly: true },
                { label: 'Push\nDiagnostic', sub: '푸시 진단', icon: Bell, path: '/push-diagnostic', color: '#f59e0b' },
                { label: 'AI Report', sub: 'AI 리포트', icon: FileText, path: '/ai-report', color: '#3b82f6' },
                { label: 'Report\nSearch', sub: '리포트 검색', icon: Search, path: '/mobile-report-search', color: '#10b981' },
                { label: 'S-Callert', sub: '상황전파', icon: Phone, path: '/s-callert', color: '#fb923c', adminOnly: true },
              ].filter(m => !m.adminOnly || user?.is_admin === 1 || user?.role === 'admin').map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    onClick={() => {
                      setShowMoreMenu(false);
                      if (item.action) {
                        item.action();
                      } else {
                        // 콘솔 복귀 플래그: navigate(-1)로 돌아오면 콘솔 자동 재오픈
                        sessionStorage.setItem('console_return_pending', '1');
                        navigate(item.path, { state: { from: 'system-console' } });
                      }
                    }}
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: 18,
                      padding: '12px 8px 10px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      gap: 6,
                      transition: 'all 0.3s ease',
                      boxShadow: '0 4px 15px -5px rgba(0,0,0,0.3)'
                    }}
                    className="hover:bg-white/5 active:scale-95 group"
                  >
                    <div style={{
                      width: 38, height: 38, borderRadius: 12,
                      background: `linear-gradient(135deg, ${item.color}25 0%, ${item.color}08 100%)`,
                      border: `1px solid ${item.color}40`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                      boxShadow: `0 0 12px ${item.color}15`
                    }}>
                      <Icon size={17} color={item.color} style={{ filter: `drop-shadow(0 0 6px ${item.color}60)` }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 900, color: '#f1f5f9', lineHeight: 1.2, whiteSpace: 'pre-line', letterSpacing: '-0.01em' }}>
                      {item.label}
                    </span>
                    <span style={{ fontSize: 8.5, fontWeight: 800, color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase', lineHeight: 1.2 }}>
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
