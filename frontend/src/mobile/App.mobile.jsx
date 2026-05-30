import React, { useState, useEffect, useRef } from 'react';
import { HashRouter as Router, Routes, Route, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { Toaster } from 'react-hot-toast';

// ── 기존 PC 페이지 전체 그대로 재사용 ───────────────────────────────────────────
import LoginPage              from '../pages/LoginPage';
import SignupPage             from '../pages/SignupPage';
// (DashboardPage 미사용 - 모바일은 MobileDashboard 독립적으로 사용)
import AiReportPage           from '../pages/AiReportPage';
import AiProcessReportPage    from '../pages/AiProcessReportPage';
import AssignmentDetailPage   from '../pages/AssignmentDetailPage';
import ChatPage               from '../pages/ChatPage';
import ChatSummaryPage        from '../pages/ChatSummaryPage';
import ReportPublishPage      from '../pages/ReportPublishPage';
import ActivityPage           from '../pages/ActivityPage';
import ActivityDetailPage     from '../pages/ActivityDetailPage';
import AssignmentsPage        from '../pages/AssignmentsPage';
import OverallStatusPage      from '../pages/OverallStatusPage';
import SearchPage             from '../pages/SearchPage';
import IncidentListPage       from '../pages/IncidentListPage';
import KeywordManagementPage  from '../pages/KeywordManagementPage';
import ReportLineManagementPage from '../pages/ReportLineManagementPage';
import IncidentPushPage       from '../pages/IncidentPushPage';
import KnowledgeBasePage      from '../pages/KnowledgeBasePage';
import UserManagementPage     from '../pages/UserManagementPage';
import OrganizationManagementPage from '../pages/OrganizationManagementPage';
import WarRoomManagementPage  from '../pages/WarRoomManagementPage';
import CodebookManagementPage from '../pages/CodebookManagementPage';
import WorkflowPage           from '../pages/WorkflowPage';
import InboxPage              from '../pages/InboxPage';
import OrbitalCommandPage     from '../pages/OrbitalCommandPage';
import SecurityLogPage        from '../pages/SecurityLogPage';
import ProcessingFlowPage     from '../pages/ProcessingFlowPage';
import MobileRealtimePipelinePage from './pages/MobileRealtimePipelinePage';
import PushDiagnosticPage     from '../pages/PushDiagnosticPage';
import ReportViewPage        from '../pages/ReportViewPage';
import AlertMonitorPage      from '../pages/AlertMonitorPage';
import UserKeywordPage       from '../pages/UserKeywordPage';
import SCallertPage          from '../pages/SCallertPage';
import MobileSCallertPage    from './pages/MobileSCallertPage';
import MobileSecurityFeaturesPage from './pages/MobileSecurityFeaturesPage';
import PermissionManagementPage from '../pages/PermissionManagementPage';
import DeputyManagementPage from '../pages/DeputyManagementPage';
import MobileDeputyManagementPage from './pages/MobileDeputyManagementPage';


// ── 모바일 전용 페이지 (카드 기반, 네이티브 UX) ────────────────────────────────
import MobileDashboard        from './pages/MobileDashboard';
import MobileActivity         from './pages/MobileActivity';
import MobileInbox            from './pages/MobileInbox';
import MobileIncidentPush     from './pages/MobileIncidentPush';
import MobileChat             from './pages/MobileChat';
import MobileLoginPage        from './pages/MobileLoginPage';
import MobileMyAssignments    from './pages/MobileMyAssignments';
import MobileReportSearch     from './pages/MobileReportSearch';
import MobileExpertAdvisor    from './pages/MobileExpertAdvisor';
import MobileAlertMonitor     from './pages/MobileAlertMonitor';
import MobileUserKeywordPage  from './pages/MobileUserKeywordPage';

// ── 기존 PC 공통 컴포넌트 그대로 재사용 ─────────────────────────────────────────
import SMSNotification        from '../components/SMSNotification';
import ErrorBoundary          from '../components/ErrorBoundary';
import ConsentModal           from '../components/ConsentModal';
import BottomMenu             from './components/BottomMenu.mobile';      // 모바일 전용 BottomMenu!
import AIAssistantPanel       from '../components/AIAssistantPanel';
import { CodebookProvider }   from '../context/CodebookContext';
import { PushManager }       from '../lib/pushManager';

// ── Auth Store ────────────────────────────────────────────────────────────────
import {
  getAccessToken, setAccessToken, clearSession,
  getUserProfile, setUserProfile as setStoreUserProfile,
  addAuthListener,
  getGhostToken, setGhostToken, setAllowedPaths, getAllowedPaths,
  isPathAllowed, fetchAndApplyPermissions, getAuthHeaders
} from '../lib/authStore';

// ── PWA Install Button (모바일 전용) ──────────────────────────────────────────
import PWAInstallButton from './components/PWAInstallButton';

import { X, MessageSquare, FileText, CheckCircle, Clock, ChevronRight, User, ShieldAlert } from 'lucide-react';

const API_BASE = 'https://sguardai.khcho0421.workers.dev';

function PermissionDeniedView() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[#07090f] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(239,68,68,0.3)]">
        <ShieldAlert className="w-8 h-8 text-red-500" />
      </div>
      <h2 className="text-xl font-black text-white mb-2">해당 화면의 권한이 없습니다.</h2>
      <p className="text-xs text-slate-400 max-w-xs mb-8 leading-relaxed">
        현재 로그인한 사용자 계정의 권한 등급으로는 이 페이지에 접근할 수 없습니다. 관리자에게 문의해 주세요.
      </p>
      <button
        onClick={() => navigate('/dashboard')}
        className="px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)]"
      >
        대시보드로 돌아가기
      </button>
    </div>
  );
}

// ─── Protected Route ─────────────────────────────────────────────────────────
function ProtectedRoute({ children, isRefreshing, userProfile }) {
  const location = useLocation();
  if (isRefreshing) return null;
  if (!userProfile && !getAccessToken()) {
    return <Navigate to="/" replace />;
  }
  if (!isPathAllowed(location.pathname)) {
    console.warn('[RBAC] Access denied for mobile path:', location.pathname);
    return <PermissionDeniedView />;
  }
  return children;
}

// ─── App Content ──────────────────────────────────────────────────────────────
function AppContent() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const isAuthPage    = location.pathname === '/';
  // 채팅·몰입형 페이지에서는 BottomMenu 숨김 (카카오톡 방식)
  const isImmersivePage = [
    '/chat',
    '/chat-summary',
    '/workflow',
    '/ai-report',
    '/ai-process-report',
    '/report-publish',
    '/chat-summary',
  ].some(p => location.pathname.startsWith(p));

  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [showWarRoomPopup, setShowWarRoomPopup] = useState(false);
  const [hideCompletedWarRooms, setHideCompletedWarRooms] = useState(true);
  const [showReportPopup, setShowReportPopup] = useState(false);
  const [warRooms, setWarRooms] = useState([]);
  const [reportLongPressItem, setReportLongPressItem] = useState(null);
  const reportLongPressTimer = useRef(null);
  const reportTouchStartX = useRef(null);
  const reportTouchStartY = useRef(null);
  const [userProfile, setUserProfile] = useState(
    () => getUserProfile() || JSON.parse(localStorage.getItem('sguard_user') || 'null')
  );
  const [allowedPathsState, setAllowedPathsState] = useState(() => getAllowedPaths());
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [isSessionRefreshed, setIsSessionRefreshed] = useState(false);

  useEffect(() => {
    return addAuthListener(({ userProfile: u, allowedPaths: p }) => {
      setUserProfile(u);
      setAllowedPathsState(p);
    });
  }, []);

  // 🚀 서비스 워커 PUSH_NAVIGATE 이벤트 수신 시 즉시 라우팅
  useEffect(() => {
    const handleSwMessage = (event) => {
      if (event.data && event.data.type === 'PUSH_NAVIGATE' && event.data.url) {
        try {
          const targetPath = new URL(event.data.url, window.location.origin).pathname;
          console.log('[App.mobile] Received PUSH_NAVIGATE to:', targetPath);
          setShowWarRoomPopup(false);
          setShowReportPopup(false);
          setShowAIAssistant(false);
          navigate(targetPath);
        } catch (e) {
          console.error('[App.mobile] PUSH_NAVIGATE routing error:', e);
        }
      }
    };
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
    }
    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      }
    };
  }, [navigate]);

  // 🚀 URL(경로) 이동 시 열려있는 모든 모달/팝업 자동 닫기 (하단 메뉴바 클릭 시 부드러운 화면 전환 보장)
  useEffect(() => {
    setShowWarRoomPopup(false);
    setShowReportPopup(false);
    setShowAIAssistant(false);
  }, [location.pathname]);

  // 🔔 AUTO PUSH SUBSCRIBE: 세션 복원(Silent Refresh) 후 구독 재동기화
  useEffect(() => {
    if (!userProfile || isRefreshing || !isSessionRefreshed) return;
    PushManager.subscribe(API_BASE).then(result => {
      if (result.success) {
        console.log('[Push] Session-restore subscribe success ✅');
      } else if (result.error !== 'Notification permission denied' && result.error !== 'No auth token — login first') {
        console.warn('[Push] Session-restore subscribe failed:', result.error);
      }
    });
  }, [userProfile?.employee_id, isRefreshing]);

  // Silent Refresh (PC App.jsx와 완전히 동일)
  useEffect(() => {
    const checkSession = async () => {
      if (sessionStorage.getItem('s_logged_out') === '1') {
        console.log('[Auth] Logged out flag detected — skipping session restore.');
        setIsRefreshing(false);
        return;
      }
      console.log('[Auth-Debug] Browser Cookie Enabled:', navigator.cookieEnabled);
      try {
        const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'GET',
          credentials: 'include',
        });
        let refreshData = null;
        try { refreshData = await refreshRes.json(); } catch (_) {}

        if (refreshRes.ok && refreshData?.access_token) {
          setAccessToken(refreshData.access_token);
          setStoreUserProfile(refreshData.user);
          if (refreshData.ghost_token) setGhostToken(refreshData.ghost_token);
          if (Array.isArray(refreshData.allowed_paths) && refreshData.allowed_paths.length > 0) {
            setAllowedPaths(refreshData.allowed_paths);
          } else {
            await fetchAndApplyPermissions(refreshData.user?.role);
          }
          setIsSessionRefreshed(true);
          setIsRefreshing(false);
          return;
        }

        const ghostToken = getGhostToken();
        console.log('[Auth-Debug] Local Ghost Token Found:', ghostToken ? 'YES' : 'NO');
        if (ghostToken) {
          const ghostRes = await fetch(`${API_BASE}/auth/refresh`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${ghostToken}` },
          });
          let ghostData = null;
          try { ghostData = await ghostRes.json(); } catch (_) {}
          if (ghostRes.ok && ghostData?.access_token) {
            setAccessToken(ghostData.access_token);
            setStoreUserProfile(ghostData.user);
            if (ghostData.ghost_token) setGhostToken(ghostData.ghost_token);
            if (Array.isArray(ghostData.allowed_paths) && ghostData.allowed_paths.length > 0) {
              setAllowedPaths(ghostData.allowed_paths);
            } else {
              await fetchAndApplyPermissions(ghostData.user?.role);
            }
            setIsSessionRefreshed(true);
            setIsRefreshing(false);
            return;
          }
        }

        // Fallback 2: localStorage 캐시 — allowed_paths 없으므로 직접 fetch
        const cachedUser = localStorage.getItem('sguard_user');
        if (cachedUser && cachedUser !== 'null' && cachedUser !== 'undefined') {
          try {
            const parsed = JSON.parse(cachedUser);
            if (parsed?.employee_id) {
              setStoreUserProfile(parsed);
              await fetchAndApplyPermissions(parsed.role);
              setIsRefreshing(false);
              return;
            }
          } catch (_) { localStorage.removeItem('sguard_user'); }
        }

        setAccessToken(null);
        setStoreUserProfile(null);
        if (!isAuthPage) {
          console.warn('[Session] Restoration failed, redirecting to login');
          navigate('/', { replace: true });
        }
      } catch (e) {
        console.error('[Session-Error]', e);
        // 네트워크 오류 등 예외 상황에서도 캐시로 복원 시도
        const cachedUser2 = localStorage.getItem('sguard_user');
        if (cachedUser2 && cachedUser2 !== 'null') {
          try {
            const parsedUser = JSON.parse(cachedUser2);
            if (parsedUser?.employee_id) {
              setStoreUserProfile(parsedUser);
              await fetchAndApplyPermissions(parsedUser.role);
              setIsRefreshing(false);
              return;
            }
          } catch (_) {}
        }
        setStoreUserProfile(null);
        setAccessToken(null);
      } finally {
        setIsRefreshing(false);
      }
    };
    localStorage.removeItem('sguard_jwt');
    checkSession();
  }, []); // Run only once on app mount

  // 🛡️ Debug: Governance Guard Status
  const debugKey = `${userProfile?.employee_id}_${userProfile?.terms_agreed_at}_${location.pathname}`;
  useEffect(() => {
    if (userProfile && !isAuthPage) {
      console.log(`[Governance-Debug] Page: ${location.pathname}, Terms Agreed At: "${userProfile.terms_agreed_at}", Should Show Modal: ${(!userProfile.terms_agreed_at && !isAuthPage)}`);
    }
  }, [debugKey, isAuthPage]);

  useEffect(() => {
    if (!isRefreshing && userProfile && isAuthPage) {
      console.log('[Auth] Authenticated user detected on login page. Redirecting to dashboard.');
      navigate('/dashboard', { replace: true });
    }
  }, [isRefreshing, userProfile, isAuthPage, navigate]);

  const fetchWarRooms = async () => {
    try {
      const res = await fetch(`${API_BASE}/warroom/rooms?participating=true`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        const rooms = data.rooms || [];
        const uniqueRooms = Array.from(new Map(rooms.map(r => [r.inc_id || r.id, r])).values());
        setWarRooms(uniqueRooms);
      }
    } catch (_) {}
  };

  const pathParts = location.pathname.split('/');
  const currentIncidentId = (pathParts[1] === 'chat' && pathParts[2]) ? pathParts[2] : null;

  // 세션 복원 로딩 화면
  if (isRefreshing) {
    return (
      <div className="min-h-screen bg-[#0a0e17] flex flex-col items-center justify-center space-y-6">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 bg-blue-500/10 rounded-full animate-pulse" />
          </div>
        </div>
        <div className="text-center animate-pulse">
          <p className="text-blue-400 font-bold tracking-widest text-sm uppercase">S-GUARD AI</p>
          <p className="text-slate-500 text-[10px] mt-1 font-mono uppercase">Restoring Secure Session...</p>
        </div>
      </div>
    );
  }

  const PR = ({ children }) => (
    <ProtectedRoute isRefreshing={isRefreshing} userProfile={userProfile}>
      <ErrorBoundary>{children}</ErrorBoundary>
    </ProtectedRoute>
  );

  return (
    <CodebookProvider>
      <Toaster position="top-center" containerStyle={{ zIndex: 999999 }} toastOptions={{ style: { background: '#0f172a', color: '#fff', border: '1px solid rgba(59,130,246,0.2)', fontSize: '14px', borderRadius: '12px' } }} />
      {!isAuthPage && <SMSNotification />}

      <Routes>
        {/* 로그인 + 하단 PWA 설치 버튼 */}
        <Route path="/" element={<LoginPageWithPWA />} />
        <Route path="/signup" element={<SignupPage />} />

        {/* ── 대시보드: PC DashboardPage와 동일한 파일 사용 ── */}
        <Route path="/dashboard"   element={<PR><MobileDashboard allowedPaths={allowedPathsState} onAiClick={() => setShowAIAssistant(true)} /></PR>} />
        <Route path="/activity"    element={<PR><MobileActivity user={userProfile} onAiClick={() => setShowAIAssistant(true)} /></PR>} />
        <Route path="/inbox"       element={<PR><MobileInbox user={userProfile} onAiClick={() => setShowAIAssistant(true)} /></PR>} />
        <Route path="/incident-push" element={<PR><MobileIncidentPush user={userProfile} onAiClick={() => setShowAIAssistant(true)} /></PR>} />
        <Route path="/my-assignments" element={<PR><MobileMyAssignments user={userProfile} onAiClick={() => setShowAIAssistant(true)} /></PR>} />
        <Route path="/expert-advisor/:incidentId?" element={<PR><MobileExpertAdvisor user={userProfile} /></PR>} />
        <Route path="/chat/:incidentId?" element={<PR><ChatPage /></PR>} />

        {/* ── PC 페이지 재사용 (나머지 라우트) ── */}
        <Route path="/ai-report/:incidentId?"  element={<PR><AiReportPage /></PR>} />
        <Route path="/assignment-detail"       element={<PR><AssignmentDetailPage /></PR>} />
        <Route path="/chat-summary/:incidentId" element={<PR><ChatSummaryPage /></PR>} />
        <Route path="/ai-process-report"       element={<PR><AiProcessReportPage /></PR>} />
        <Route path="/report-publish"          element={<PR><ReportPublishPage /></PR>} />
        <Route path="/activity-detail"         element={<PR><ActivityDetailPage /></PR>} />
        <Route path="/assignments"             element={<PR><AssignmentsPage /></PR>} />
        <Route path="/overall-status"          element={<PR><OverallStatusPage /></PR>} />
        <Route path="/search"                  element={<PR><SearchPage /></PR>} />
        <Route path="/mobile-report-search"    element={<PR><MobileReportSearch user={userProfile} onAiClick={() => setShowAIAssistant(true)} /></PR>} />
        <Route path="/incident-list"           element={<PR><IncidentListPage /></PR>} />
        <Route path="/keyword-management"      element={<PR><KeywordManagementPage /></PR>} />
        <Route path="/report-line-management"  element={<PR><ReportLineManagementPage /></PR>} />
        <Route path="/security-logs"           element={<PR><SecurityLogPage /></PR>} />
        <Route path="/security-features"       element={<PR><MobileSecurityFeaturesPage /></PR>} />
        <Route path="/processing-flow"         element={<PR><ProcessingFlowPage /></PR>} />
        <Route path="/push-diagnostic"         element={<PR><PushDiagnosticPage /></PR>} />
        <Route path="/knowledge-base"          element={<PR><KnowledgeBasePage /></PR>} />
        <Route path="/user-management"         element={<PR><UserManagementPage /></PR>} />
        <Route path="/organization-management" element={<PR><OrganizationManagementPage /></PR>} />
        <Route path="/warroom-management"      element={<PR><WarRoomManagementPage /></PR>} />
        <Route path="/codebook-management"     element={<PR><CodebookManagementPage /></PR>} />
        <Route path="/workflow/:inc_id"        element={<PR><WorkflowPage /></PR>} />
        <Route path="/orbital-command"         element={<PR><OrbitalCommandPage /></PR>} />
        <Route path="/report/:incId"           element={<PR><ReportViewPage /></PR>} />
        <Route path="/alert-monitor"           element={<PR><MobileAlertMonitor /></PR>} />
        <Route path="/user-keyword"             element={<PR><MobileUserKeywordPage /></PR>} />
        <Route path="/s-callert"                element={<PR><MobileSCallertPage /></PR>} />
        <Route path="/realtime-pipeline"        element={<PR><MobileRealtimePipelinePage /></PR>} />
        <Route path="/admin/permissions" element={<PR><PermissionManagementPage /></PR>} />
        <Route path="/admin/deputy" element={<PR><MobileDeputyManagementPage /></PR>} />
      </Routes>

      {/* Consent Modal */}
      {userProfile &&
        (userProfile.terms_agreed_at === null ||
         userProfile.terms_agreed_at === undefined ||
         userProfile.terms_agreed_at === '') &&
        !isAuthPage && (
          <ConsentModal userProfile={userProfile} setUserProfile={(u) => { setUserProfile(u); setStoreUserProfile(u); }} />
        )}


      {/* BottomMenu - 채팅방·몰입형 페이지에서는 숨김 */}
      {!isAuthPage && !isImmersivePage && (
        <BottomMenu
          currentPath={location.pathname}
          activePopup={showWarRoomPopup ? 'chat' : showReportPopup ? 'inbox' : null}
          onClosePopups={() => { setShowWarRoomPopup(false); setShowReportPopup(false); }}
          initialOpenMoreMenu={sessionStorage.getItem('console_return_pending') === '1'}
          onWarRoomClick={() => { setShowReportPopup(false); fetchWarRooms(); setShowWarRoomPopup(true); }}
          onReportClick={() => { setShowWarRoomPopup(false); fetchWarRooms(); setShowReportPopup(true); }}
          onAiClick={() => setShowAIAssistant(true)}
          user={userProfile}
          allowedPaths={allowedPathsState}
        />
      )}

      {/* Global War-Room List Popup */}
      {showWarRoomPopup && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center">
          {/* 배경 딤 */}
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowWarRoomPopup(false)} />

          {/* 시트 본체 */}
          <div className="skeuo-card relative z-10 w-full max-w-xl flex flex-col rounded-t-[2rem] border-t border-white/20 overflow-hidden max-h-[78vh] shadow-[0_-15px_50px_rgba(0,0,0,0.95)] animate-slide-in-smooth duration-300"
            style={{ background: 'linear-gradient(180deg, #1e222b 0%, #12151a 100%)' }}>

            {/* 헤더 */}
            <div style={{
              background: '#1c2027',
              padding: '14px 20px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              flexShrink: 0,
            }}>
              <div className="skeuo-pill w-10 h-1.5 rounded-full mb-3.5 mx-auto bg-white/20" />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                    참여 중인 워룸
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <span style={{ width: 6, height: 6, background: '#00e5ff', borderRadius: 99, display: 'inline-block', boxShadow: '0 0 10px #00e5ff', animation: 'pulse 2s infinite' }} />
                    <p style={{ fontSize: 10, color: '#00e5ff', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', textShadow: '0 0 8px rgba(0,229,255,0.4)' }}>
                      Active Channels
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="checkbox"
                      id="hideCompletedMobile"
                      checked={hideCompletedWarRooms}
                      onChange={(e) => setHideCompletedWarRooms(e.target.checked)}
                      style={{ width: 14, height: 14, accentColor: '#00e5ff', cursor: 'pointer' }}
                    />
                    <label htmlFor="hideCompletedMobile" style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, cursor: 'pointer' }}>
                      완료숨김
                    </label>
                  </div>
                  {warRooms.length > 0 && (
                    <div className="skeuo-pill" style={{ background: 'rgba(0,229,255,0.1)', border: '1px solid rgba(0,229,255,0.3)', borderRadius: 99, padding: '4px 10px', fontSize: 11, fontWeight: 900, color: '#00e5ff', boxShadow: '0 0 10px rgba(0,229,255,0.15)' }}>
                      {warRooms.length}건
                    </div>
                  )}
                  <button
                    onClick={() => setShowWarRoomPopup(false)}
                    className="skeuo-btn w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer active:scale-95"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}
                  >
                    <X size={14} color="#64748b" />
                  </button>
                </div>
              </div>
            </div>

            {/* 리스트 */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {warRooms.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', textAlign: 'center' }}>
                  <div style={{ width: 56, height: 56, borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                    <MessageSquare size={24} color="#334155" />
                  </div>
                  <p style={{ color: '#475569', fontSize: 14, fontWeight: 600 }}>진행 중인 War-Room이 없습니다.</p>
                </div>
              ) : warRooms.filter(r => hideCompletedWarRooms ? r.status !== 'Completed' && r.status !== 'CLOSED' && r.status !== '완료' && r.status !== 'INC_003' : true).map((room, index) => {
                const roomId = room.inc_id || room.code || room.id;
                const rawId = String(roomId || '').replace(/^INC-/i, '');
                const isCurrent = String(roomId) === String(currentIncidentId);

                // 년월일시 포맷
                const regDate = room.reg_dt ? new Date(room.reg_dt) : null;
                const dateTimeStr = regDate
                  ? `${regDate.getFullYear()}.${String(regDate.getMonth()+1).padStart(2,'0')}.${String(regDate.getDate()).padStart(2,'0')} ${String(regDate.getHours()).padStart(2,'0')}:${String(regDate.getMinutes()).padStart(2,'0')}`
                  : '';

                // SMS 미리보기 파싱
                const rawTitle = room.title || room.msg || '';
                const pipeIdx = rawTitle.indexOf('|');
                let smsText = room.sms_message || (pipeIdx !== -1 ? rawTitle.slice(pipeIdx + 1).trim() : rawTitle) || '';
                smsText = smsText.replace(/\[Web발신\]/g, '').trim();

                const accentColor = isCurrent ? '#00e5ff' : '#00e5ff';

                return (
                  <div
                    key={`${roomId}-${index}`}
                    onClick={() => { setShowWarRoomPopup(false); navigate(`/chat/${roomId}`); }}
                    className="skeuo-card hover:border-[#00e5ff]/50 active:scale-[0.98] active:translate-y-0.5 transition-all duration-200 group"
                    style={{
                      background: isCurrent
                        ? 'linear-gradient(135deg, rgba(0,229,255,0.2) 0%, rgba(0,229,255,0.05) 100%)'
                        : 'linear-gradient(180deg, rgba(30,35,45,0.8) 0%, rgba(18,21,26,0.95) 100%)',
                      borderTop: '1px solid rgba(255,255,255,0.15)',
                      borderRight: '1px solid rgba(255,255,255,0.06)',
                      borderBottom: '1px solid rgba(0,0,0,0.8)',
                      borderLeft: `1px solid rgba(255,255,255,0.06)`,
                      borderRadius: 20,
                      padding: '18px 16px 18px 20px',
                      cursor: 'pointer',
                      position: 'relative',
                      overflow: 'hidden',
                      minHeight: 110,
                      boxShadow: isCurrent ? '0 8px 24px rgba(0,229,255,0.3), inset 0 1px 0 rgba(255,255,255,0.2)' : '0 6px 18px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1)',
                    }}
                  >
                    {/* 왼쪽 강조 바 */}
                    <div style={{
                      position: 'absolute', top: 0, left: 0, bottom: 0, width: 4,
                      background: isCurrent ? '#00e5ff' : 'rgba(0,229,255,0.5)',
                      borderRadius: '20px 0 0 20px',
                      boxShadow: isCurrent ? '0 0 10px #00e5ff' : 'none'
                    }} />

                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>

                        {/* 1행: 배지 + [장애ID & 년월일시] */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {(() => {
                              const sev = room.severity || room.urgency || 'NORMAL';
                              let color = '#00e5ff', bg = 'rgba(0,229,255,0.1)', border = 'rgba(0,229,255,0.3)';
                              if (sev === 'CRITICAL' || sev === '긴급') { color = '#ff2a2a'; bg = 'rgba(255,42,42,0.15)'; border = '#ff2a2a'; }
                              else if (sev === 'HIGH' || sev === '높음') { color = '#ffb700'; bg = 'rgba(255,183,0,0.15)'; border = '#ffb700'; }
                              else if (sev === 'NORMAL' || sev === '일반') { color = '#00ff88'; bg = 'rgba(0,255,136,0.15)'; border = '#00ff88'; }
                              return (
                                <span className="skeuo-pill" style={{
                                  fontSize: 9, fontWeight: 900, color,
                                  background: bg, border: `1px solid ${border}`,
                                  borderRadius: 6, padding: '2px 8px', letterSpacing: '0.08em',
                                  boxShadow: `0 0 10px ${bg}`
                                }}>{sev === '긴급' ? 'CRITICAL' : sev === '높음' ? 'HIGH' : sev === '일반' ? 'NORMAL' : sev}</span>
                              );
                            })()}
                            {isCurrent && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, fontWeight: 900, color: '#00e5ff', textShadow: '0 0 8px rgba(0,229,255,0.8)' }}>
                                <span style={{ width: 5, height: 5, borderRadius: 99, background: '#00e5ff', boxShadow: '0 0 8px #00e5ff', display: 'inline-block' }} />
                                NOW
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 10, color: '#00e5ff', fontFamily: 'monospace', fontWeight: 900 }}>
                              {rawId}
                            </span>
                            <span style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace', fontWeight: 700 }}>
                              {dateTimeStr}
                            </span>
                          </div>
                        </div>

                        {/* 2행: SMS 2줄 미리보기 */}
                        {smsText && (
                          <p style={{
                            fontSize: 14, color: '#f1f5f9', fontWeight: 500,
                            lineHeight: 1.6, margin: 0,
                            overflow: 'hidden',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                          }} className="group-hover:text-white transition-colors">
                            {smsText}
                          </p>
                        )}
                      </div>

                      {/* 화살표 */}
                      <div className="skeuo-pill" style={{
                        width: 28, height: 28, borderRadius: 10,
                        background: `rgba(0,229,255,0.1)`,
                        border: `1px solid rgba(0,229,255,0.2)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, alignSelf: 'center',
                        boxShadow: '0 0 10px rgba(0,229,255,0.1)'
                      }}>
                        <ChevronRight size={15} color={accentColor} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 닫기 */}
            <div style={{ padding: '12px 16px', paddingBottom: 'calc(16px + env(safe-area-inset-bottom))', borderTop: '1px solid rgba(255,255,255,0.08)', background: '#16191f', flexShrink: 0 }}>
              <button
                onClick={() => setShowWarRoomPopup(false)}
                className="skeuo-btn w-full py-3.5 rounded-xl transition-all active:scale-95 active:translate-y-0.5"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: '#94a3b8', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Report List Popup */}
      {showReportPopup && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center">
          {/* 배경 딤 */}
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowReportPopup(false)} />

          {/* 시트 본체 */}
          <div className="skeuo-card relative z-10 w-full max-w-xl flex flex-col rounded-t-[2rem] border-t border-white/20 overflow-hidden max-h-[78vh] shadow-[0_-15px_50px_rgba(0,0,0,0.95)] animate-slide-in-smooth duration-300"
            style={{ background: 'linear-gradient(180deg, #1e222b 0%, #12151a 100%)' }}>

            {/* 상단 헤더 */}
            <div style={{
              background: '#1c2027',
              padding: '14px 20px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              flexShrink: 0,
            }}>
              {/* 핸들 */}
              <div className="skeuo-pill w-10 h-1.5 rounded-full mb-3.5 mx-auto bg-white/20" />

              <div className="flex items-center justify-between">
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                    리포트 선택
                  </h3>
                  <p style={{ fontSize: 10, color: '#00ff88', fontWeight: 900, letterSpacing: '0.12em', marginTop: 3, textTransform: 'uppercase', textShadow: '0 0 8px rgba(0,255,136,0.4)' }}>
                    완료된 War-Room 목록
                  </p>
                </div>
                {warRooms.length > 0 && (
                  <div className="skeuo-pill" style={{
                    background: 'rgba(0,255,136,0.1)',
                    border: '1px solid rgba(0,255,136,0.3)',
                    borderRadius: 99, padding: '4px 10px',
                    fontSize: 11, fontWeight: 900, color: '#00ff88',
                    boxShadow: '0 0 10px rgba(0,255,136,0.15)'
                  }}>
                    {warRooms.length}건
                  </div>
                )}
              </div>
            </div>

            {/* 리스트 */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {warRooms.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', textAlign: 'center' }}>
                  <div style={{ width: 56, height: 56, borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                    <FileText size={24} color="#334155" />
                  </div>
                  <p style={{ color: '#475569', fontSize: 14, fontWeight: 600 }}>발행된 리포트가 없습니다.</p>
                </div>
              ) : warRooms.map((room, index) => {
                const roomId = room.inc_id || room.id;
                const rawId = String(roomId);

                // 년월일시 포맷
                const regDate = room.reg_dt ? new Date(room.reg_dt) : null;
                const dateTimeStr = regDate
                  ? `${regDate.getFullYear()}.${String(regDate.getMonth()+1).padStart(2,'0')}.${String(regDate.getDate()).padStart(2,'0')} ${String(regDate.getHours()).padStart(2,'0')}:${String(regDate.getMinutes()).padStart(2,'0')}`
                  : '';

                // 제목: warroom_list.title에서 | 이후 내용 추출
                const rawTitle = room.title || room.msg || '';
                const pipeIdx = rawTitle.indexOf('|');
                const msgFromTitle = pipeIdx !== -1 ? rawTitle.substring(pipeIdx + 1).trim() : rawTitle;

                // SMS 미리보기
                const smsPreviewRaw = room.sms_message || msgFromTitle || '';
                const smsPreview = smsPreviewRaw.replace(/\[Web발신\]/g, '').trim() || null;

                const handleLongPressStart = (e) => {
                  reportTouchStartX.current = e.touches[0].clientX;
                  reportTouchStartY.current = e.touches[0].clientY;
                  reportLongPressTimer.current = setTimeout(() => {
                    if (navigator.vibrate) navigator.vibrate(40);
                    setReportLongPressItem({ roomId, title: rawTitle, cleanRoomId: rawId });
                  }, 500);
                };
                const handleLongPressMove = (e) => {
                  const dx = Math.abs(e.touches[0].clientX - reportTouchStartX.current);
                  const dy = Math.abs(e.touches[0].clientY - reportTouchStartY.current);
                  if (dx > 10 || dy > 10) clearTimeout(reportLongPressTimer.current);
                };
                const handleLongPressEnd = () => clearTimeout(reportLongPressTimer.current);

                return (
                  <div
                    key={`${roomId}-${index}`}
                    onClick={() => { setShowReportPopup(false); navigate(`/ai-report/${roomId}`); }}
                    onTouchStart={handleLongPressStart}
                    onTouchMove={handleLongPressMove}
                    onTouchEnd={handleLongPressEnd}
                    className="skeuo-card hover:border-[#00ff88]/50 active:scale-[0.98] active:translate-y-0.5 transition-all duration-200 group"
                    style={{
                      background: 'linear-gradient(180deg, rgba(30,35,45,0.8) 0%, rgba(18,21,26,0.95) 100%)',
                      borderTop: '1px solid rgba(255,255,255,0.15)',
                      borderRight: '1px solid rgba(255,255,255,0.06)',
                      borderBottom: '1px solid rgba(0,0,0,0.8)',
                      borderLeft: `1px solid rgba(255,255,255,0.06)`,
                      borderRadius: 20, padding: '18px 16px 18px 20px',
                      cursor: 'pointer', position: 'relative', overflow: 'hidden',
                      minHeight: 110,
                      display: 'flex',
                      flexDirection: 'column',
                      boxShadow: '0 6px 18px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1)'
                    }}
                  >
                    {/* 왼쪽 강조 바 */}
                    <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 4, background: '#00ff88', borderRadius: '20px 0 0 20px', boxShadow: '0 0 10px #00ff88' }} />

                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, width: '100%' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* 1행: 배지 + [장애ID & 년월일시] */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                          <span className="skeuo-pill" style={{
                            fontSize: 9, fontWeight: 900, color: '#00ff88',
                            background: 'rgba(0,255,136,0.15)', border: '1px solid #00ff88',
                            borderRadius: 6, padding: '2px 8px', letterSpacing: '0.08em',
                            boxShadow: '0 0 10px rgba(0,255,136,0.2)'
                          }}>✓ 완료</span>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 10, color: '#00ff88', fontFamily: 'monospace', fontWeight: 900 }}>
                              {rawId}
                            </span>
                            <span style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace', fontWeight: 700 }}>
                              {dateTimeStr}
                            </span>
                          </div>
                        </div>

                        {/* 2행: SMS 원문 2줄 미리보기 */}
                        {smsPreview && (
                          <p style={{
                            fontSize: 14, color: '#f1f5f9', fontWeight: 500,
                            lineHeight: 1.6, margin: 0,
                            overflow: 'hidden',
                            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                          }} className="group-hover:text-white transition-colors">
                            {smsPreview}
                          </p>
                        )}
                      </div>

                      {/* 화살표 */}
                      <div className="skeuo-pill" style={{
                        width: 28, height: 28, borderRadius: 10,
                        background: 'rgba(0,255,136,0.1)',
                        border: '1px solid rgba(0,255,136,0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, alignSelf: 'center',
                        boxShadow: '0 0 10px rgba(0,255,136,0.1)'
                      }}>
                        <ChevronRight size={15} color="#00ff88" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 닫기 버튼 */}
            <div style={{ padding: '12px 16px', paddingBottom: 'calc(16px + env(safe-area-inset-bottom))', borderTop: '1px solid rgba(255,255,255,0.08)', background: '#16191f', flexShrink: 0 }}>
              <button
                onClick={() => setShowReportPopup(false)}
                className="skeuo-btn w-full py-3.5 rounded-xl transition-all active:scale-95 active:translate-y-0.5"
                style={{
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)',
                  color: '#94a3b8', fontSize: 15, fontWeight: 800, cursor: 'pointer',
                }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 리포트 롱프레스 액션시트 */}
      {reportLongPressItem && (
        <>
          <div
            onClick={() => setReportLongPressItem(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 120, backdropFilter: 'blur(4px)' }}
          />
          <div className="skeuo-card animate-slide-in-smooth duration-300" style={{
            position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 121,
            background: 'linear-gradient(180deg, #1e222b 0%, #12151a 100%)', borderRadius: '24px 24px 0 0',
            borderTop: '1px solid rgba(255,255,255,0.2)',
            padding: '12px 0', paddingBottom: 'calc(24px + env(safe-area-inset-bottom))',
            boxShadow: '0 -15px 50px rgba(0,0,0,0.95)'
          }}>
            <div className="skeuo-pill w-10 h-1.5 rounded-full mb-3.5 mx-auto bg-white/20" />
            <div style={{ padding: '0 20px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <p style={{ fontSize: 10, color: '#00ff88', fontWeight: 900, marginBottom: 3, textShadow: '0 0 8px rgba(0,255,136,0.4)' }}>선택된 리포트</p>
              <p style={{ fontSize: 14, color: '#fff', fontWeight: 900 }}>{reportLongPressItem.title}</p>
              <p style={{ fontSize: 10, color: '#00ff88', fontFamily: 'monospace', marginTop: 3 }}>{reportLongPressItem.cleanRoomId}</p>
            </div>
            <div style={{ marginTop: 8 }}>
              <button
                onClick={() => { setReportLongPressItem(null); setShowReportPopup(false); navigate(`/ai-report/${reportLongPressItem.roomId}`); }}
                style={{ width: '100%', padding: '15px 20px', background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}
                className="hover:bg-white/5 active:scale-95 transition-all"
              >
                <ChevronRight size={20} color="#00ff88" style={{ filter: 'drop-shadow(0 0 8px rgba(0,255,136,0.8))' }} />
                <span style={{ fontSize: 15, color: '#00ff88', fontWeight: 900, textShadow: '0 0 8px rgba(0,255,136,0.4)' }}>리포트 상세보기</span>
              </button>
              <button
                onClick={() => setReportLongPressItem(null)}
                style={{ width: '100%', padding: '15px 20px', background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}
                className="hover:bg-white/5 active:scale-95 transition-all"
              >
                <span style={{ fontSize: 15, color: '#94a3b8', fontWeight: 800 }}>취소</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* AI Assistant */}
      {!isAuthPage && (
        <AIAssistantPanel
          isOpen={showAIAssistant}
          onClose={() => setShowAIAssistant(false)}
          incidentId={currentIncidentId}
          userProfile={userProfile}
        />
      )}
    </CodebookProvider>
  );
}

// 로그인 페이지 + PWA 홈 화면 추가 가이드 버튼
function LoginPageWithPWA() {
  return (
    <div className="relative flex flex-col">
      <LoginPage />
      {/* 화면 하단에 고정 된 PWA 설치 버튼 */}
      <div
        className="fixed left-0 right-0 px-5 z-50"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}
      >
        <PWAInstallButton />
      </div>
    </div>
  );
}

export default function AppMobile() {
  return (
    <Router>
      <GoogleOAuthProvider clientId="368028308466-placeholder.apps.googleusercontent.com">
        <AppContent />
      </GoogleOAuthProvider>
    </Router>
  );
}
