import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, MessageSquare, Activity, Search, MoreHorizontal, Users, User, Network, Shield, FileText, Bot, BookOpen, Inbox, Cpu, Layers, BellDot, Keyboard, Bell, Phone, UserCircle, ShieldCheck, Lock } from 'lucide-react';
import { getUserProfile, getAllowedPaths, addAuthListener } from '../../lib/authStore';
import { toast } from 'react-hot-toast';

export default function BottomMenu({ currentPath, activePopup, onClosePopups, onWarRoomClick, onReportClick, onAiClick, showAiPulse = true, user, initialOpenMoreMenu, allowedPaths: _ignored }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // authStore 직접 구독
  const [liveAllowedPaths, setLiveAllowedPaths] = useState(() => getAllowedPaths());
  useEffect(() => {
    const remove = addAuthListener(({ allowedPaths: newPaths }) => {
      setLiveAllowedPaths(newPaths);
    });
    return remove;
  }, []);

  const checkAllowed = (path) => {
    if (!path || path === '/dashboard' || path === '/realtime-pipeline') return true;
    const u = getUserProfile();
    if (u && (u.role === 'SUPER_ADMIN' || u.role === 'ADMIN' || u.role === 'super_admin' || u.role === 'admin' || u.is_admin === 1)) return true;
    if (liveAllowedPaths === null || liveAllowedPaths === undefined) return true;
    if (!Array.isArray(liveAllowedPaths)) return true;
    if (liveAllowedPaths.length === 0) return false;
    return liveAllowedPaths.some(p => path === p || path.startsWith(p + '/'));
  };

  useEffect(() => {
    const isDashboard = currentPath === '/dashboard' || currentPath === '/';
    const pending = sessionStorage.getItem('console_return_pending') === '1';
    if (isDashboard && (initialOpenMoreMenu || location.state?.openMoreMenu || pending)) {
      setShowMoreMenu(true);
      sessionStorage.removeItem('console_return_pending');
      window.history.replaceState({}, '');
    } else {
      setShowMoreMenu(false);
    }
  }, [currentPath, location.state, initialOpenMoreMenu]);


  return (
    <>
      {/* Skeuomorphic Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-[250] bg-[#121212]/95 backdrop-blur-md border-t border-white/20 shadow-[0_-8px_30px_rgba(0,0,0,0.8)] flex justify-around items-center px-2 pt-3 pb-[env(safe-area-inset-bottom,12px)] print:hidden">
        {[
          { id: 'home', label: '홈', icon: Home, path: '/dashboard' },
          { id: 'chat', label: 'WAR-ROOM', icon: MessageSquare, path: '/chat', action: onWarRoomClick },
          { id: 'inbox', label: 'Report', icon: FileText, path: '/inbox', action: onReportClick },
          { id: 'my', label: 'MY', icon: User, path: '/my-assignments' },
          { id: 'more', label: '더보기', icon: MoreHorizontal, action: () => setShowMoreMenu(true) },
        ].map((item) => {
          const effectiveTab = showMoreMenu ? 'more' : activePopup ? activePopup : null;
          const isActive = effectiveTab
            ? item.id === effectiveTab
            : (currentPath === item.path || (item.path && currentPath?.startsWith(item.path)));
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => {
                setShowMoreMenu(false);
                if (onClosePopups && item.id !== 'chat' && item.id !== 'inbox') {
                  onClosePopups();
                }
                if (item.action) {
                  item.action();
                } else if (item.path) {
                  navigate(item.path);
                }
              }}
              className={`flex flex-col items-center gap-1.5 px-2.5 py-1.5 rounded-2xl transition-all duration-300 relative min-w-[56px] active:scale-95 active:translate-y-0.5 ${
                isActive ? 'skeuo-pill bg-[#00e5ff]/15 scale-105 shadow-[0_4px_20px_rgba(0,229,255,0.25)] border border-[#00e5ff]/40' : 'hover:bg-white/5 opacity-70 hover:opacity-100 border border-transparent'
              }`}
            >
              {isActive && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[#00e5ff] rounded-full shadow-[0_0_12px_rgba(0,229,255,1)]" />
              )}
              <div className="relative">
                <Icon className={`w-5 h-5 transition-all duration-300 ${isActive ? 'text-[#00e5ff] drop-shadow-[0_0_8px_rgba(0,229,255,0.8)]' : 'text-slate-400'}`} />
                {item.isAi && showAiPulse && (
                  <span className="absolute -top-1.5 -right-1.5 w-2.5 h-2.5 bg-[#ff2a2a] rounded-full border-2 border-[#121212] animate-pulse shadow-[0_0_8px_rgba(255,42,42,0.8)]" />
                )}
              </div>
              <span className={`text-[9px] font-black tracking-widest leading-none uppercase whitespace-nowrap ${isActive ? 'text-[#00e5ff]' : 'text-slate-500'}`}>
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
          <div className="skeuo-card w-full max-w-xl rounded-t-[2.5rem] border-t border-white/20 shadow-[0_-15px_50px_rgba(0,0,0,0.95)] relative z-10 overflow-hidden flex flex-col animate-slide-in-smooth duration-500"
            style={{ background: 'linear-gradient(180deg, #1e222b 0%, #12151a 100%)', maxHeight: '85vh' }}>

            {/* 헤더 */}
            <div className="pt-6 pb-6 px-6 flex flex-col items-center relative" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-[#00e5ff]/10 blur-[60px] rounded-full pointer-events-none" />
              <div className="skeuo-pill w-12 h-1.5 rounded-full mb-5 bg-white/20" />
              <h3 className="text-xl font-black text-white tracking-tight">System Console</h3>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] mt-2 text-[#00e5ff] leading-none text-shadow-[0_0_8px_rgba(0,229,255,0.5)]" style={{ paddingBottom: '8px' }}>Management & Intelligence</p>
            </div>

            {/* Manual Entry - 전체 너비 강조 버튼 */}
            <div style={{ padding: '16px 20px 8px' }}>
              <div
                onClick={() => {
                  setShowMoreMenu(false);
                  sessionStorage.setItem('console_return_pending', '1');
                  navigate('/incident-push', { state: { from: 'system-console' } });
                }}
                className="skeuo-card transition-all active:scale-[0.98] active:translate-y-0.5"
                style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  padding: '18px 20px',
                  background: 'linear-gradient(135deg, rgba(0,255,136,0.2) 0%, rgba(0,255,136,0.05) 100%)',
                  border: '1px solid #00ff88',
                  borderRadius: 20, cursor: 'pointer',
                  position: 'relative', overflow: 'hidden',
                  boxShadow: '0 12px 32px rgba(0,0,0,0.8), 0 0 25px rgba(0,255,136,0.25), inset 0 1px 0 rgba(255,255,255,0.2)'
                }}
              >
                <div style={{
                  position: 'absolute', top: 0, left: 0, bottom: 0, width: 4,
                  background: 'linear-gradient(180deg, #00ff88, #00b359)',
                }} />
                <div style={{
                  width: 44, height: 44, borderRadius: 14,
                  background: 'rgba(0,255,136,0.2)', border: '1px solid rgba(0,255,136,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  boxShadow: 'inset 0 0 10px rgba(0,255,136,0.2)'
                }}>
                  <MessageSquare size={20} color="#00ff88" style={{ filter: 'drop-shadow(0 0 8px rgba(0,255,136,0.8))' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 900, color: '#f8fafc', letterSpacing: '0.01em' }}>Manual Entry</div>
                  <div style={{ fontSize: 10, color: '#00ff88', fontWeight: 800, letterSpacing: '0.08em', opacity: 0.9, textShadow: '0 0 8px rgba(0,255,136,0.4)' }}>INCIDENT INJECTION · 장애 수동 접수</div>
                </div>
                <div style={{
                  width: 32, height: 32, borderRadius: 10,
                  background: 'rgba(0,255,136,0.15)', border: '1px solid rgba(0,255,136,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <span style={{ fontSize: 16, color: '#00ff88', fontWeight: 900 }}>›</span>
                </div>
              </div>
            </div>

            {/* 그리드: 2열 (전체 시스템 콘솔 메뉴 복구) */}
            <div className="flex-1 overflow-y-auto p-5" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
              {[
                { label: 'Pipeline\nTracker', sub: '실시간 파이프라인', icon: Layers, path: '/realtime-pipeline', color: '#00ff88' },
                { label: 'Personal\nKW', sub: '개인 키워드', icon: Keyboard, path: '/user-keyword', color: '#00e5ff' },
                { label: 'Deputy\nMgmt', sub: '대직자 관리', icon: UserCircle, path: '/admin/deputy', color: '#00ff88' },
                { label: 'Architecture\n& Comm', sub: '기술 명세', icon: Cpu, path: '/processing-flow', color: '#a855f7' },
                { label: 'Security\nFramework', sub: '보안 체계', icon: ShieldCheck, path: '/security-features', color: '#10b981' },
                { label: 'RBAC\nSetting', sub: '권한 관리', icon: ShieldCheck, path: '/admin/permissions', color: '#a855f7', adminOnly: true },
                { label: 'Report\nLine', sub: '결재선 관리', icon: Users, path: '/report-line-management', color: '#ffb700' },
                { label: 'Accounts', sub: '계정 관리', icon: User, path: '/user-management', color: '#00e5ff' },
                { label: 'Security\nLogs', sub: '보안 로그', icon: Shield, path: '/security-logs', color: '#ff2a2a', adminOnly: true },
                { label: 'Organization', sub: '조직 관리', icon: Network, path: '/organization-management', color: '#00ff88' },
                { label: 'Knowledge\nBase', sub: '지식 베이스', icon: FileText, path: '/knowledge-base', color: '#00e5ff' },
                { label: 'Global\nStats', sub: '전체 현황', icon: Activity, path: '/overall-status', color: '#ffb700' },
                { label: 'War-Room\nHub', sub: '워룸 관리', icon: Shield, path: '/warroom-management', color: '#ff2a2a' },
                { label: 'Codebook', sub: '코드북 관리', icon: BookOpen, path: '/codebook-management', color: '#ffb700' },
                { label: 'Data\nFlow', sub: '데이터 흐름', icon: Layers, path: '/processing-flow', color: '#00e5ff', adminOnly: true },
                { label: 'Push\nDiagnostic', sub: '푸시 진단', icon: Bell, path: '/push-diagnostic', color: '#ffb700' },
                { label: 'AI Report', sub: 'AI 리포트', icon: FileText, path: '/ai-report', color: '#00e5ff' },
                { label: 'Report\nSearch', sub: '리포트 검색', icon: Search, path: '/mobile-report-search', color: '#00ff88' },
                { label: 'S-Callert', sub: '상황전파', icon: Phone, path: '/s-callert', color: '#ffb700', adminOnly: true },
              ].filter(m => !m.adminOnly || user?.is_admin === 1 || user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'super_admin').map((item) => {
                const Icon = item.icon;
                const allowed = checkAllowed(item.path);
                return (
                  <div
                    key={item.label}
                    onClick={() => {
                      if (!allowed) {
                        toast.error('해당 화면의 권한이 없습니다.');
                        return;
                      }
                      setShowMoreMenu(false);
                      if (item.action) {
                        item.action();
                      } else {
                        sessionStorage.setItem('console_return_pending', '1');
                        navigate(item.path, { state: { from: 'system-console' } });
                      }
                    }}
                    style={{
                      background: 'linear-gradient(180deg, rgba(30,35,45,0.85) 0%, rgba(18,21,26,0.95) 100%)',
                      borderTop: '1px solid rgba(255,255,255,0.15)',
                      borderRight: '1px solid rgba(255,255,255,0.06)',
                      borderBottom: '1px solid rgba(0,0,0,0.8)',
                      borderLeft: `1px solid rgba(255,255,255,0.06)`,
                      borderRadius: 20,
                      padding: '14px 10px 12px',
                      cursor: !allowed ? 'not-allowed' : 'pointer',
                      opacity: !allowed ? 0.35 : 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      gap: 8,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.15)'
                    }}
                    className="skeuo-card hover:border-[#00e5ff]/40 active:scale-95 active:translate-y-0.5 group transition-all duration-200"
                  >
                    {!allowed && <Lock className="w-3.5 h-3.5 text-red-500 absolute top-2.5 right-2.5" />}
                    <div style={{
                      width: 40, height: 40, borderRadius: 14,
                      background: `linear-gradient(135deg, ${item.color}25 0%, ${item.color}08 100%)`,
                      border: `1px solid ${item.color}50`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.2), 0 0 12px ${item.color}25`
                    }}>
                      <Icon size={18} color={item.color} style={{ filter: `drop-shadow(0 0 6px ${item.color}80)` }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 900, color: '#f1f5f9', lineHeight: 1.2, whiteSpace: 'pre-line', letterSpacing: '-0.01em' }} className="group-hover:text-[#00e5ff] transition-colors">
                      {item.label}
                    </span>
                    <span style={{ fontSize: 9, fontWeight: 800, color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase', lineHeight: 1.2 }}>
                      {item.sub}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* 닫기 */}
            <div style={{ padding: '12px 16px', paddingBottom: 'calc(12px + env(safe-area-inset-bottom))', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <button
                onClick={() => setShowMoreMenu(false)}
                className="skeuo-btn w-full py-3.5 rounded-xl transition-all active:scale-95 active:translate-y-0.5"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#94a3b8', fontSize: 13, fontWeight: 800, cursor: 'pointer', letterSpacing: '0.06em' }}
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
