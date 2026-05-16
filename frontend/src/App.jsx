import React from 'react';
import { HashRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { Toaster } from 'react-hot-toast';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';

import DashboardPage from './pages/DashboardPage';
import AiReportPage from './pages/AiReportPage';
import AiProcessReportPage from './pages/AiProcessReportPage';
import AssignmentDetailPage from './pages/AssignmentDetailPage';
import ChatPage from './pages/ChatPage';
import ChatSummaryPage from './pages/ChatSummaryPage';
import ReportPublishPage from './pages/ReportPublishPage';
import ActivityPage from './pages/ActivityPage';
import ActivityDetailPage from './pages/ActivityDetailPage';
import AssignmentsPage from './pages/AssignmentsPage';
import SMSNotification from './components/SMSNotification';
import ErrorBoundary from './components/ErrorBoundary';
import OverallStatusPage from './pages/OverallStatusPage';
import SearchPage from './pages/SearchPage';
import IncidentListPage from './pages/IncidentListPage';
import KeywordManagementPage from './pages/KeywordManagementPage';
import ReportLineManagementPage from './pages/ReportLineManagementPage';
import IncidentPushPage from './pages/IncidentPushPage';
import KnowledgeBasePage from './pages/KnowledgeBasePage';
import UserManagementPage from './pages/UserManagementPage';
import OrganizationManagementPage from './pages/OrganizationManagementPage';
import WarRoomManagementPage from './pages/WarRoomManagementPage';
import CodebookManagementPage from './pages/CodebookManagementPage';
import WorkflowPage from './pages/WorkflowPage';
import InboxPage from './pages/InboxPage';
import ReportViewPage from './pages/ReportViewPage';
import OrbitalCommandPage from './pages/OrbitalCommandPage';
import SecurityLogPage from './pages/SecurityLogPage';
import ProcessingFlowPage from './pages/ProcessingFlowPage';
import PushDiagnosticPage from './pages/PushDiagnosticPage';
import AlertMonitorPage from './pages/AlertMonitorPage';
import IncidentKeywordPage from './pages/IncidentKeywordPage';
import UserKeywordPage from './pages/UserKeywordPage';
import PermissionManagementPage from './pages/PermissionManagementPage';
import DeputyManagementPage from './pages/DeputyManagementPage';
import SCallertPage from './pages/SCallertPage';
import ConsentModal from './components/ConsentModal';
import PCPageModal from './components/PCPageModal';

// ── 모바일 최적화 페이지 (PC에서도 사용 — 사이즈만 다름) ──
import MobileActivity     from './mobile/pages/MobileActivity';
import MobileInbox        from './mobile/pages/MobileInbox';
import MobileIncidentPush from './mobile/pages/MobileIncidentPush';

import BottomMenu from './components/BottomMenu';
import AIAssistantPanel from './components/AIAssistantPanel';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, MessageSquare, FileText, CheckCircle, Clock, ChevronRight, User } from 'lucide-react';

import { CodebookProvider } from './context/CodebookContext';

import { Navigate } from 'react-router-dom';
import { setAccessToken, getAccessToken, setUserProfile as setStoreUserProfile, getUserProfile, addAuthListener, getGhostToken, setGhostToken, setAllowedPaths, isPathAllowed } from './lib/authStore';
import { PushManager } from './lib/pushManager';

// 🔒 인증된 사용자만 접근할 수 있도록 보호하는 컴포넌트 (Navigation Guard)
// 🔒 Protected Route: Waits for session refresh to complete before redirecting
function ProtectedRoute({ children, isRefreshing, userProfile }) {
  const location = useLocation();
  const accessToken = getAccessToken();

  if (isRefreshing) return null;

  if (!userProfile && !accessToken) {
    console.log('[Auth] Protected route blocked - No valid session found.');
    return <Navigate to="/" replace />;
  }

  // 🔐 RBAC: 현재 경로가 사용자 역할에서 허용되지 않으면 대시보드로 리다이렉트
  if (!isPathAllowed(location.pathname)) {
    console.warn('[RBAC] Access denied for path:', location.pathname);
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  
  const isAuthPage = location.pathname === '/';
  
  // 🌐 API Configuration
  const apiBase = 'https://sguardai.khcho0421.workers.dev';

  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [showWarRoomPopup, setShowWarRoomPopup] = useState(false);
  const [showReportPopup, setShowReportPopup] = useState(false);
  const [warRooms, setWarRooms] = useState([]);
  const [hideCompletedWarRooms, setHideCompletedWarRooms] = useState(true);
  const [userProfile, setUserProfile] = useState(() => getUserProfile() || JSON.parse(localStorage.getItem('sguard_user') || 'null'));
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [isSessionRefreshed, setIsSessionRefreshed] = useState(false);

  // 📱 iOS 크롬 강제 실행 및 앱스토어 안내 폴백 로직
  useEffect(() => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(userAgent);
    const isChrome = /crios/.test(userAgent);
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    if (isIOS && !isChrome && !isLocal) {
      const fullPath = window.location.host + window.location.pathname + window.location.search + window.location.hash;
      const scheme = window.location.protocol === 'https:' ? `googlechromes://${fullPath}` : `googlechrome://${fullPath}`;
      const appStoreUrl = "https://apps.apple.com/kr/app/google-chrome/id535886823";

      console.log('[Redirect] Redirecting iOS user to Google Chrome:', scheme);
      window.location.href = scheme;

      const timer = setTimeout(() => {
        if (window.confirm("안전하고 원활한 S-Guard 이용을 위해 Google Chrome 앱 설치가 필요합니다.\n앱스토어로 이동하시겠습니까?")) {
          window.location.href = appStoreUrl;
        }
      }, 2500);

      const handleVisibilityChange = () => {
        if (document.hidden) {
          clearTimeout(timer);
        }
      };
      document.addEventListener("visibilitychange", handleVisibilityChange);

      return () => {
        clearTimeout(timer);
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      };
    }
  }, []);

  // 🛡️ Sync with Auth Store
  useEffect(() => {
    const removeListener = addAuthListener(({ userProfile: newUser }) => {
      setUserProfile(newUser);
    });
    return () => removeListener();
  }, []);

  // 🔔 AUTO PUSH SUBSCRIBE: 세션 복원(Silent Refresh) 후 구독 재동기화
  useEffect(() => {
    if (!userProfile || isRefreshing || !isSessionRefreshed) return;
    // 토큰이 없어도 시도 — PushManager 내에서 gracefully 처리
    PushManager.subscribe(apiBase).then(result => {
      if (result.success) {
        console.log('[Push] Session-restore subscribe success ✅');
      } else if (result.error !== 'Notification permission denied' && result.error !== 'No auth token — login first') {
        console.warn('[Push] Session-restore subscribe failed:', result.error);
      }
    });
  }, [userProfile?.employee_id, isRefreshing]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load user profile & 실시간 세션 검증 + 🔄 Silent Refresh
  useEffect(() => {
    const checkSession = async () => {
      // 🚫 로그아웃 직후 → 세션 복원 건너뜀 (Ghost Token / localStorage 재복원 방지)
      if (sessionStorage.getItem('s_logged_out') === '1') {
        console.log('[Auth] Logged out flag detected — skipping session restore.');
        setIsRefreshing(false);
        return;
      }

      console.log('[Auth-Debug] Browser Cookie Enabled:', navigator.cookieEnabled);
      try {
        // 1. Silent Refresh 먼저 시도 (HttpOnly 쿠키 사용)
        const refreshRes = await fetch(`${apiBase}/auth/refresh`, {
          method: 'GET',
          credentials: 'include' // 🛡️ 보안: Cross-Origin 요청 시 쿠키 전송 필수
        });

        // 🔑 응답 body를 미리 파싱하여 중복 소비 방지
        let refreshData = null;
        try { refreshData = await refreshRes.json(); } catch (_) {}

        if (refreshRes.ok && refreshData?.access_token) {
          setAccessToken(refreshData.access_token);
          setStoreUserProfile(refreshData.user);
          if (refreshData.ghost_token) setGhostToken(refreshData.ghost_token);
          if ('allowed_paths' in refreshData) setAllowedPaths(refreshData.allowed_paths);
          setIsSessionRefreshed(true);
          setIsRefreshing(false);
          return;
        }

        // 👻 Fallback 1: Ghost Token Strategy (LocalStorage)
        const ghostToken = getGhostToken();
        console.log('[Auth-Debug] Local Ghost Token Found:', ghostToken ? 'YES' : 'NO');
        console.log('[Auth-Debug] Cookie Refresh Failed:', refreshData?.code || 'UNKNOWN');
        
        if (ghostToken) {
          console.log('[Auth] Attempting Ghost Token recovery...');
          const ghostRes = await fetch(`${apiBase}/auth/refresh`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${ghostToken}`
            }
          });

          let ghostData = null;
          try { ghostData = await ghostRes.json(); } catch (_) {}

          if (ghostRes.ok && ghostData?.access_token) {
            console.log('[Auth] Ghost Token recovery successful!');
            setAccessToken(ghostData.access_token);
            setStoreUserProfile(ghostData.user);
            if (ghostData.ghost_token) setGhostToken(ghostData.ghost_token);
            if ('allowed_paths' in ghostData) setAllowedPaths(ghostData.allowed_paths);
            setIsSessionRefreshed(true);
            setIsRefreshing(false);
            return;
          } else {
            console.warn('[Auth] Ghost Token recovery failed:', ghostData?.code || 'UNKNOWN');
          }
        }

        // 👻 Fallback 2: localStorage 캐시 사용 (새로고침 시 세션 유지)
        // Ghost Token / Cookie 모두 실패해도, 로컬 캐시가 있으면 임시 세션 유지
        // (Access Token은 없지만 사용자는 인증된 상태로 간주 — API 호출 시 재인증 처리)
        const cachedUser = localStorage.getItem('sguard_user');
        if (cachedUser && cachedUser !== 'null' && cachedUser !== 'undefined') {
          try {
            const parsedUser = JSON.parse(cachedUser);
            if (parsedUser?.employee_id) {
              console.warn('[Auth] Using localStorage cache to maintain session. Ghost Token expired or missing.');
              setStoreUserProfile(parsedUser);
              // Access token is null — interceptor's short-circuit will handle re-auth gracefully
              setIsRefreshing(false);
              return;
            }
          } catch (_) {
            localStorage.removeItem('sguard_user');
          }
        }

        // 3. 완전히 세션 정보가 없을 때만 로그인으로 이동
        setAccessToken(null);
        setStoreUserProfile(null);
        
        if (!isAuthPage) {
          const errCode = refreshData?.code || 'UNKNOWN_ERROR';
          console.warn('[Auth] Session restoration failed completely. Redirecting to login:', errCode);
          navigate('/', { replace: true });
        }
      } catch (e) {
        console.error('Session check failed', e);
        // 네트워크 오류 등 예외 상황에서도 캐시로 복원 시도
        const cachedUser = localStorage.getItem('sguard_user');
        if (cachedUser && cachedUser !== 'null') {
          try {
            const parsedUser = JSON.parse(cachedUser);
            if (parsedUser?.employee_id) {
              setStoreUserProfile(parsedUser);
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

    // Cleanup legacy tokens if any
    localStorage.removeItem('sguard_jwt');

    checkSession();
  }, []); // Run only once on app mount

  // 🛡️ Debug: Governance Guard Status
  useEffect(() => {
    if (userProfile && !isAuthPage) {
      console.log(`[Governance-Debug] Page: ${location.pathname}, Terms Agreed At: "${userProfile.terms_agreed_at}", Should Show Modal: ${(!userProfile.terms_agreed_at && !isAuthPage)}`);
    }
  }, [userProfile, location.pathname, isAuthPage]);

  // 🔄 Authenticated User Auto-Redirect: 로그인된 상태에서 로그인 페이지 접근 시 대시보드로 이동
  useEffect(() => {
    if (!isRefreshing && userProfile && isAuthPage) {
      console.log('[Auth] Authenticated user detected on login page. Redirecting to dashboard.');
      navigate('/dashboard', { replace: true });
    }
  }, [isRefreshing, userProfile, isAuthPage, navigate]);

  const fetchWarRooms = async () => {
    try {
      const res = await fetch(`${apiBase}/warroom/rooms`);
      if (res.ok) {
        const data = await res.json();
        setWarRooms(data.rooms || []);
      }
    } catch (e) {
      console.error('Failed to fetch war rooms', e);
    }
  };

  const handleWarRoomClick = () => {
    fetchWarRooms();
    setShowWarRoomPopup(true);
  };

  const handleReportClick = () => {
    fetchWarRooms();
    setShowReportPopup(true);
  };

  // Extract incidentId from path if in /chat/:id
  const pathParts = location.pathname.split('/');
  const currentIncidentId = (pathParts[1] === 'chat' && pathParts[2]) ? pathParts[2] : null;

  // 🔒 Initialization Lock: Do not render UI until session check is complete
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

  return (
    <CodebookProvider>
      <Toaster position="top-center" toastOptions={{ style: { background: '#0f172a', color: '#fff', border: '1px solid rgba(59,130,246,0.2)', fontSize: '14px', borderRadius: '12px' } }} />
      {!isAuthPage && <SMSNotification />}
      
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        {/* 🔒 Protected Routes: 인증 필수 */}
        {/* 대시보드는 항상 렌더링 (모달 배경) */}
        <Route path="/dashboard" element={<ProtectedRoute isRefreshing={isRefreshing} userProfile={userProfile}><ErrorBoundary><DashboardPage onAiClick={() => setShowAIAssistant(true)} /></ErrorBoundary></ProtectedRoute>} />
        <Route path="/activity"      element={<ProtectedRoute isRefreshing={isRefreshing} userProfile={userProfile}><PCPageModal><ActivityPage /></PCPageModal></ProtectedRoute>} />
        <Route path="/inbox"         element={<ProtectedRoute isRefreshing={isRefreshing} userProfile={userProfile}><PCPageModal><InboxPage /></PCPageModal></ProtectedRoute>} />
        <Route path="/incident-push" element={<ProtectedRoute isRefreshing={isRefreshing} userProfile={userProfile}><PCPageModal><IncidentPushPage /></PCPageModal></ProtectedRoute>} />
        <Route path="/ai-report/:incidentId?"  element={<ProtectedRoute isRefreshing={isRefreshing} userProfile={userProfile}><PCPageModal><AiReportPage /></PCPageModal></ProtectedRoute>} />
        <Route path="/assignment-detail"       element={<ProtectedRoute isRefreshing={isRefreshing} userProfile={userProfile}><PCPageModal><AssignmentDetailPage /></PCPageModal></ProtectedRoute>} />
        <Route path="/chat/:incidentId?"       element={<ProtectedRoute isRefreshing={isRefreshing} userProfile={userProfile}><PCPageModal><ChatPage /></PCPageModal></ProtectedRoute>} />
        <Route path="/chat-summary/:incidentId" element={<ProtectedRoute isRefreshing={isRefreshing} userProfile={userProfile}><PCPageModal><ChatSummaryPage /></PCPageModal></ProtectedRoute>} />
        <Route path="/ai-process-report"       element={<ProtectedRoute isRefreshing={isRefreshing} userProfile={userProfile}><PCPageModal><AiProcessReportPage /></PCPageModal></ProtectedRoute>} />
        <Route path="/report-publish"          element={<ProtectedRoute isRefreshing={isRefreshing} userProfile={userProfile}><PCPageModal><ReportPublishPage /></PCPageModal></ProtectedRoute>} />
        <Route path="/activity-detail"         element={<ProtectedRoute isRefreshing={isRefreshing} userProfile={userProfile}><PCPageModal><ActivityDetailPage /></PCPageModal></ProtectedRoute>} />
        <Route path="/assignments"             element={<ProtectedRoute isRefreshing={isRefreshing} userProfile={userProfile}><PCPageModal><AssignmentsPage /></PCPageModal></ProtectedRoute>} />
        <Route path="/my-assignments"           element={<ProtectedRoute isRefreshing={isRefreshing} userProfile={userProfile}><PCPageModal><AssignmentsPage /></PCPageModal></ProtectedRoute>} />
        <Route path="/overall-status"          element={<ProtectedRoute isRefreshing={isRefreshing} userProfile={userProfile}><PCPageModal><OverallStatusPage /></PCPageModal></ProtectedRoute>} />
        <Route path="/search"                  element={<ProtectedRoute isRefreshing={isRefreshing} userProfile={userProfile}><PCPageModal><SearchPage /></PCPageModal></ProtectedRoute>} />
        <Route path="/mobile-report-search"    element={<ProtectedRoute isRefreshing={isRefreshing} userProfile={userProfile}><PCPageModal><SearchPage /></PCPageModal></ProtectedRoute>} />
        <Route path="/incident-list"           element={<ProtectedRoute isRefreshing={isRefreshing} userProfile={userProfile}><PCPageModal><IncidentListPage /></PCPageModal></ProtectedRoute>} />
        <Route path="/keyword-management"      element={<ProtectedRoute isRefreshing={isRefreshing} userProfile={userProfile}><PCPageModal><KeywordManagementPage /></PCPageModal></ProtectedRoute>} />
        <Route path="/report-line-management"  element={<ProtectedRoute isRefreshing={isRefreshing} userProfile={userProfile}><PCPageModal><ReportLineManagementPage /></PCPageModal></ProtectedRoute>} />
        <Route path="/security-logs"           element={<ProtectedRoute isRefreshing={isRefreshing} userProfile={userProfile}><PCPageModal><SecurityLogPage /></PCPageModal></ProtectedRoute>} />
        <Route path="/processing-flow"         element={<ProtectedRoute isRefreshing={isRefreshing} userProfile={userProfile}><PCPageModal><ProcessingFlowPage /></PCPageModal></ProtectedRoute>} />
        <Route path="/push-diagnostic"         element={<ProtectedRoute isRefreshing={isRefreshing} userProfile={userProfile}><PCPageModal><PushDiagnosticPage /></PCPageModal></ProtectedRoute>} />
        <Route path="/knowledge-base"          element={<ProtectedRoute isRefreshing={isRefreshing} userProfile={userProfile}><PCPageModal><KnowledgeBasePage /></PCPageModal></ProtectedRoute>} />
        <Route path="/user-management"         element={<ProtectedRoute isRefreshing={isRefreshing} userProfile={userProfile}><PCPageModal><UserManagementPage /></PCPageModal></ProtectedRoute>} />
        <Route path="/organization-management" element={<ProtectedRoute isRefreshing={isRefreshing} userProfile={userProfile}><PCPageModal><OrganizationManagementPage /></PCPageModal></ProtectedRoute>} />
        <Route path="/warroom-management"      element={<ProtectedRoute isRefreshing={isRefreshing} userProfile={userProfile}><PCPageModal><WarRoomManagementPage /></PCPageModal></ProtectedRoute>} />
        <Route path="/admin/permissions"       element={<ProtectedRoute isRefreshing={isRefreshing} userProfile={userProfile}><PCPageModal><PermissionManagementPage /></PCPageModal></ProtectedRoute>} />
        <Route path="/admin/deputy"            element={<ProtectedRoute isRefreshing={isRefreshing} userProfile={userProfile}><PCPageModal><DeputyManagementPage /></PCPageModal></ProtectedRoute>} />
        <Route path="/codebook-management"     element={<ProtectedRoute isRefreshing={isRefreshing} userProfile={userProfile}><PCPageModal><CodebookManagementPage /></PCPageModal></ProtectedRoute>} />
        <Route path="/workflow/:inc_id"        element={<ProtectedRoute isRefreshing={isRefreshing} userProfile={userProfile}><PCPageModal><WorkflowPage /></PCPageModal></ProtectedRoute>} />
        <Route path="/report/:incId"           element={<ProtectedRoute isRefreshing={isRefreshing} userProfile={userProfile}><PCPageModal><ReportViewPage /></PCPageModal></ProtectedRoute>} />
        <Route path="/orbital-command"         element={<ProtectedRoute isRefreshing={isRefreshing} userProfile={userProfile}><PCPageModal><OrbitalCommandPage /></PCPageModal></ProtectedRoute>} />
        <Route path="/alert-monitor"           element={<ProtectedRoute isRefreshing={isRefreshing} userProfile={userProfile}><PCPageModal><AlertMonitorPage /></PCPageModal></ProtectedRoute>} />
        <Route path="/incident-keyword"         element={<ProtectedRoute isRefreshing={isRefreshing} userProfile={userProfile}><PCPageModal><IncidentKeywordPage /></PCPageModal></ProtectedRoute>} />
        <Route path="/user-keyword"             element={<ProtectedRoute isRefreshing={isRefreshing} userProfile={userProfile}><PCPageModal><UserKeywordPage /></PCPageModal></ProtectedRoute>} />
        <Route path="/s-callert"                element={<ProtectedRoute isRefreshing={isRefreshing} userProfile={userProfile}><PCPageModal><SCallertPage /></PCPageModal></ProtectedRoute>} />
      </Routes>

      {/* ⚖️ Governance & Mandatory Consent Guard */}
      {userProfile && (userProfile.terms_agreed_at === null || userProfile.terms_agreed_at === undefined || userProfile.terms_agreed_at === '') && !isAuthPage && (
        <ConsentModal userProfile={userProfile} setUserProfile={setUserProfile} />
      )}


      {/* Global Bottom Navigation */}
      {!isAuthPage && (
        <BottomMenu 
          currentPath={location.pathname} 
          onWarRoomClick={handleWarRoomClick}
          onReportClick={handleReportClick}
          onAiClick={() => setShowAIAssistant(true)}
          user={userProfile}
        />
      )}

      {/* Global War-Room List Popup */}
      {showWarRoomPopup && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 lg:p-10 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowWarRoomPopup(false)} />
          <div className="bg-[#0f1219]/95 w-full max-w-5xl rounded-[2.5rem] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative z-10 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300 pb-safe">
            {/* Top Bar matching PCPageModal feel */}
            <div className="flex justify-center pt-3 pb-1 lg:hidden">
              <div className="w-12 h-1.5 bg-white/10 rounded-full" />
            </div>
            
            <div className="px-6 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="bg-blue-600/20 p-3 rounded-2xl border border-blue-500/30 shadow-[0_0_15px_rgba(37,99,235,0.2)]">
                  <MessageSquare className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-black text-xl text-white tracking-tight">참여 중인 워룸</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Active Channels ({warRooms.length})</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    id="hideCompletedWarRoomsApp"
                    checked={hideCompletedWarRooms}
                    onChange={(e) => setHideCompletedWarRooms(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-white/20 bg-black/50 checked:bg-blue-500 checked:border-blue-500 transition-all cursor-pointer"
                  />
                  <label htmlFor="hideCompletedWarRoomsApp" className="text-xs font-bold text-slate-400 cursor-pointer select-none hover:text-white transition-colors">
                    완료숨김
                  </label>
                </div>
                <button onClick={() => setShowWarRoomPopup(false)} className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors border border-white/5">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-max">
              {warRooms.length === 0 ? (
                <div className="col-span-full text-center py-20">
                  <div className="bg-white/5 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/5">
                    <MessageSquare className="w-8 h-8 text-slate-700" />
                  </div>
                  <p className="text-slate-500 text-sm font-bold">진행 중인 War-Room이 없습니다.</p>
                </div>
              ) : warRooms.filter(r => hideCompletedWarRooms ? r.status !== 'Completed' && r.status !== 'CLOSED' : true).map((room) => {
                const roomId = room.inc_id || room.id;
                const isCurrent = roomId === currentIncidentId;
                return (
                  <div
                    key={roomId}
                    onClick={() => { setShowWarRoomPopup(false); navigate(`/chat/${roomId}`); }}
                    className={`p-5 rounded-[2rem] border transition-all cursor-pointer group relative overflow-hidden active:scale-[0.98] h-full flex flex-col justify-between ${
                      isCurrent 
                        ? 'bg-blue-600/10 border-blue-500/40 shadow-[0_0_20px_rgba(37,99,235,0.1)]' 
                        : 'bg-[#1a1f2e]/40 border-white/5 hover:border-blue-500/30 hover:bg-[#1a1f2e]/60'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black px-2 py-0.5 rounded border bg-red-500/20 text-red-500 border-red-500/30 tracking-tighter">CRITICAL</span>
                          {isCurrent && <span className="text-[10px] text-blue-400 font-black tracking-tight flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
                            NOW
                          </span>}
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono font-bold">{room.reg_dt ? new Date(room.reg_dt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                      </div>
                      <p className="text-[15px] font-bold text-white group-hover:text-blue-400 transition-colors line-clamp-2 pr-4 mb-3">{room.msg || room.title || roomId}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-2 opacity-60">
                      <div className="w-4 h-4 rounded-full bg-slate-800 flex items-center justify-center">
                        <User className="w-2.5 h-2.5 text-slate-500" />
                      </div>
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">{roomId}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Global Report List Popup */}
      {showReportPopup && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowReportPopup(false)} />
          <div className="bg-[#0f1219] w-full max-w-md rounded-[2.5rem] border border-white/10 shadow-2xl relative z-10 animate-in zoom-in-95 duration-300 overflow-hidden max-h-[80vh] flex flex-col">
            
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-emerald-600/10 to-transparent">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-500/20 p-2 rounded-xl border border-emerald-500/30">
                  <FileText className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-black text-lg text-white tracking-tight">Report Selection</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Active War-Rooms</p>
                </div>
              </div>
              <button 
                onClick={() => setShowReportPopup(false)}
                className="p-2 rounded-full hover:bg-white/5 transition-colors group"
              >
                <X className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {warRooms.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center px-6">
                  <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4 border border-white/5">
                    <FileText className="w-8 h-8 text-slate-700" />
                  </div>
                  <p className="text-slate-400 font-bold text-sm">발행된 리포트가 없습니다.</p>
                </div>
              ) : warRooms.map((room) => {
                const roomId = room.inc_id || room.id;
                return (
                  <div
                    key={roomId}
                    onClick={() => { setShowReportPopup(false); navigate(`/ai-report/${roomId}`); }}
                    className="group bg-white/[0.02] p-4 rounded-2xl border border-white/5 hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-all cursor-pointer relative overflow-hidden active:scale-[0.98]"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="bg-emerald-500/10 text-emerald-400 text-[9px] font-black px-2 py-0.5 rounded-md border border-emerald-500/20 tracking-tighter">
                        COMPLETED
                      </div>
                      <span className="text-[10px] text-slate-600 font-mono font-bold">{roomId}</span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-200 group-hover:text-emerald-400 transition-colors line-clamp-1">{room.msg || room.title || roomId}</h4>
                    <div className="flex items-center justify-between mt-3 text-[10px] text-slate-500">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {room.reg_dt ? new Date(room.reg_dt).toLocaleDateString() : ''}
                      </div>
                      <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all text-emerald-500" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Global AI Assistant Panel */}
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

function App() {
  console.log('App Loaded - Version: Dashboard-Rearrange-v1');
  return (
    <Router>
      <GoogleOAuthProvider clientId="368028308466-placeholder.apps.googleusercontent.com">
        <AppContent />
      </GoogleOAuthProvider>
    </Router>
  );
}

export default App;

