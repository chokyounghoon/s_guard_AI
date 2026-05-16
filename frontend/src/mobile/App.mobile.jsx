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
import PushDiagnosticPage     from '../pages/PushDiagnosticPage';
import ReportViewPage        from '../pages/ReportViewPage';
import AlertMonitorPage      from '../pages/AlertMonitorPage';
import IncidentKeywordPage   from '../pages/IncidentKeywordPage';
import UserKeywordPage       from '../pages/UserKeywordPage';
import SCallertPage          from '../pages/SCallertPage';
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
// ── Auth Store ────────────────────────────────────────────────────────────────
import {
  getAccessToken, setAccessToken, clearSession,
  getUserProfile, setUserProfile as setStoreUserProfile,
  addAuthListener,
  getGhostToken, setGhostToken, getAuthHeaders,
  isPathAllowed, setAllowedPaths
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
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [isSessionRefreshed, setIsSessionRefreshed] = useState(false);

  useEffect(() => {
    return addAuthListener(({ userProfile: u }) => setUserProfile(u));
  }, []);

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
          if ('allowed_paths' in refreshData) setAllowedPaths(refreshData.allowed_paths);
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
            if ('allowed_paths' in ghostData) setAllowedPaths(ghostData.allowed_paths);
            setIsSessionRefreshed(true);
            setIsRefreshing(false);
            return;
          }
        }

        const cachedUser = localStorage.getItem('sguard_user');
        if (cachedUser && cachedUser !== 'null' && cachedUser !== 'undefined') {
          try {
            const parsed = JSON.parse(cachedUser);
            if (parsed?.employee_id) {
              setStoreUserProfile(parsed);
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
      } finally {
        setIsRefreshing(false);
      }
    };
    localStorage.removeItem('sguard_jwt');
    checkSession();
  }, [navigate, isAuthPage]);

  // 🛡️ Debug: Governance Guard Status
  useEffect(() => {
    if (userProfile && !isAuthPage) {
      console.log(`[Governance-Debug] Page: ${location.pathname}, Terms Agreed At: "${userProfile.terms_agreed_at}", Should Show Modal: ${(!userProfile.terms_agreed_at && !isAuthPage)}`);
    }
  }, [userProfile, location.pathname, isAuthPage]);

  useEffect(() => {
    if (!isRefreshing && userProfile && isAuthPage) {
      console.log('[Auth] Authenticated user detected on login page. Redirecting to dashboard.');
      navigate('/dashboard', { replace: true });
    }
  }, [isRefreshing, userProfile, isAuthPage, navigate]);

  const fetchWarRooms = async () => {
    try {
      const res = await fetch(`${API_BASE}/warroom/rooms`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setWarRooms(data.rooms || []);
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
      <Toaster position="top-center" toastOptions={{ style: { background: '#0f172a', color: '#fff', border: '1px solid rgba(59,130,246,0.2)', fontSize: '14px', borderRadius: '12px' } }} />
      {!isAuthPage && <SMSNotification />}

      <Routes>
        {/* 로그인 + 하단 PWA 설치 버튼 */}
        <Route path="/" element={<LoginPageWithPWA />} />
        <Route path="/signup" element={<SignupPage />} />

        {/* ── 대시보드: PC DashboardPage와 동일한 파일 사용 ── */}
        <Route path="/dashboard"   element={<PR><MobileDashboard onAiClick={() => setShowAIAssistant(true)} /></PR>} />
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
        <Route path="/incident-keyword"         element={<PR><IncidentKeywordPage /></PR>} />
        <Route path="/user-keyword"             element={<PR><MobileUserKeywordPage /></PR>} />
        <Route path="/s-callert"                element={<PR><SCallertPage /></PR>} />
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
          onWarRoomClick={() => { fetchWarRooms(); setShowWarRoomPopup(true); }}
          onReportClick={() => { fetchWarRooms(); setShowReportPopup(true); }}
          onAiClick={() => setShowAIAssistant(true)}
          user={userProfile}
        />
      )}

      {/* Global War-Room List Popup */}
      {showWarRoomPopup && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center">
          {/* 배경 딤 */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowWarRoomPopup(false)} />

          {/* 시트 본체 */}
          <div className="relative z-10 w-full max-w-xl flex flex-col rounded-t-[2rem] overflow-hidden max-h-[78vh]"
            style={{ background: '#0e1118', borderTop: '1px solid rgba(255,255,255,0.08)' }}>

            {/* 헤더 */}
            <div style={{
              background: 'linear-gradient(160deg, rgba(10,20,50,1) 0%, rgba(10,14,24,1) 100%)',
              padding: '14px 20px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              flexShrink: 0,
            }}>
              <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.12)', borderRadius: 99, margin: '0 auto 14px' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                    참여 중인 워룸
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <span style={{ width: 6, height: 6, background: '#3b82f6', borderRadius: 99, display: 'inline-block', boxShadow: '0 0 6px #3b82f6', animation: 'pulse 2s infinite' }} />
                    <p style={{ fontSize: 10, color: '#3b82f6', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
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
                      style={{ width: 14, height: 14, accentColor: '#3b82f6', cursor: 'pointer' }}
                    />
                    <label htmlFor="hideCompletedMobile" style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, cursor: 'pointer' }}>
                      완료숨김
                    </label>
                  </div>
                  {warRooms.length > 0 && (
                    <div style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 99, padding: '4px 10px', fontSize: 11, fontWeight: 800, color: '#3b82f6' }}>
                      {warRooms.length}건
                    </div>
                  )}
                  <button
                    onClick={() => setShowWarRoomPopup(false)}
                    style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  >
                    <X size={14} color="#64748b" />
                  </button>
                </div>
              </div>
            </div>

            {/* 리스트 */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {warRooms.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', textAlign: 'center' }}>
                  <div style={{ width: 56, height: 56, borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                    <MessageSquare size={24} color="#334155" />
                  </div>
                  <p style={{ color: '#475569', fontSize: 14, fontWeight: 600 }}>진행 중인 War-Room이 없습니다.</p>
                </div>
              ) : warRooms.filter(r => hideCompletedWarRooms ? r.status !== 'Completed' && r.status !== 'CLOSED' && r.status !== '완료' : true).map((room) => {
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

                const accentColor = isCurrent ? '#60a5fa' : '#3b82f6';

                return (
                  <div
                    key={roomId}
                    onClick={() => { setShowWarRoomPopup(false); navigate(`/chat/${roomId}`); }}
                    style={{
                      background: isCurrent
                        ? 'linear-gradient(135deg, rgba(59,130,246,0.18) 0%, rgba(37,99,235,0.08) 100%)'
                        : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${isCurrent ? 'rgba(96,165,250,0.4)' : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: 20,
                      padding: '18px 16px 18px 20px',
                      cursor: 'pointer',
                      position: 'relative',
                      overflow: 'hidden',
                      minHeight: 110,
                      boxShadow: isCurrent ? '0 0 20px rgba(59,130,246,0.12)' : 'none',
                    }}
                  >
                    {/* 왼쪽 강조 바 */}
                    <div style={{
                      position: 'absolute', top: 0, left: 0, bottom: 0, width: 4,
                      background: isCurrent
                        ? 'linear-gradient(180deg, #60a5fa 0%, #3b82f6 100%)'
                        : 'linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%)',
                      borderRadius: '20px 0 0 20px',
                    }} />

                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>

                        {/* 1행: 배지 + [장애ID & 년월일시] */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {(() => {
                              const sev = room.severity || room.urgency || 'NORMAL';
                              let color = '#60a5fa', bg = 'rgba(59,130,246,0.15)', border = 'rgba(59,130,246,0.3)';
                              if (sev === 'CRITICAL' || sev === '긴급') { color = '#f87171'; bg = 'rgba(248,113,113,0.15)'; border = 'rgba(248,113,113,0.3)'; }
                              else if (sev === 'HIGH' || sev === '높음') { color = '#fb923c'; bg = 'rgba(249,115,22,0.15)'; border = 'rgba(249,115,22,0.3)'; }
                              return (
                                <span style={{
                                  fontSize: 9, fontWeight: 900, color,
                                  background: bg, border: `1px solid ${border}`,
                                  borderRadius: 6, padding: '2px 8px', letterSpacing: '0.08em'
                                }}>{sev === '긴급' ? 'CRITICAL' : sev === '높음' ? 'HIGH' : sev === '일반' ? 'NORMAL' : sev}</span>
                              );
                            })()}
                            {isCurrent && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, fontWeight: 900, color: '#60a5fa' }}>
                                <span style={{ width: 5, height: 5, borderRadius: 99, background: '#60a5fa', boxShadow: '0 0 8px #60a5fa', display: 'inline-block' }} />
                                NOW
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 10, color: '#475569', fontFamily: 'monospace', fontWeight: 700 }}>
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
                          }}>
                            {smsText}
                          </p>
                        )}
                      </div>

                      {/* 화살표 */}
                      <div style={{
                        width: 28, height: 28, borderRadius: 10,
                        background: `rgba(59,130,246,0.1)`,
                        border: `1px solid rgba(59,130,246,0.15)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, alignSelf: 'center',
                      }}>
                        <ChevronRight size={15} color={accentColor} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 닫기 */}
            <div style={{ padding: '12px 16px', paddingBottom: 'calc(16px + env(safe-area-inset-bottom))', borderTop: '1px solid rgba(255,255,255,0.06)', background: '#0e1118', flexShrink: 0 }}>
              <button
                onClick={() => setShowWarRoomPopup(false)}
                style={{ width: '100%', padding: '14px', borderRadius: 14, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#64748b', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
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
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowReportPopup(false)} />

          {/* 시트 본체 */}
          <div className="relative z-10 w-full max-w-xl flex flex-col rounded-t-[2rem] overflow-hidden max-h-[78vh]"
            style={{ background: '#0e1118', borderTop: '1px solid rgba(255,255,255,0.08)' }}>

            {/* 상단 헤더 */}
            <div style={{
              background: 'linear-gradient(160deg, rgba(16,24,48,1) 0%, rgba(10,14,24,1) 100%)',
              padding: '14px 20px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              flexShrink: 0,
            }}>
              {/* 핸들 */}
              <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.12)', borderRadius: 99, margin: '0 auto 14px' }} />

              <div className="flex items-center justify-between">
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                    리포트 선택
                  </h3>
                  <p style={{ fontSize: 10, color: '#10b981', fontWeight: 800, letterSpacing: '0.12em', marginTop: 3, textTransform: 'uppercase' }}>
                    완료된 War-Room 목록
                  </p>
                </div>
                {warRooms.length > 0 && (
                  <div style={{
                    background: 'rgba(16,185,129,0.1)',
                    border: '1px solid rgba(16,185,129,0.25)',
                    borderRadius: 99, padding: '4px 10px',
                    fontSize: 11, fontWeight: 800, color: '#10b981',
                  }}>
                    {warRooms.length}건
                  </div>
                )}
              </div>
            </div>

            {/* 리스트 */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {warRooms.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', textAlign: 'center' }}>
                  <div style={{ width: 56, height: 56, borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                    <FileText size={24} color="#334155" />
                  </div>
                  <p style={{ color: '#475569', fontSize: 14, fontWeight: 600 }}>발행된 리포트가 없습니다.</p>
                </div>
              ) : warRooms.map((room) => {
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
                    key={roomId}
                    onClick={() => { setShowReportPopup(false); navigate(`/ai-report/${roomId}`); }}
                    onTouchStart={handleLongPressStart}
                    onTouchMove={handleLongPressMove}
                    onTouchEnd={handleLongPressEnd}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 20, padding: '18px 16px 18px 20px',
                      cursor: 'pointer', position: 'relative', overflow: 'hidden',
                      marginBottom: 12,
                      minHeight: 110,
                      display: 'flex',
                      flexDirection: 'column'
                    }}
                  >
                    {/* 왼쪽 강조 바 */}
                    <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 4, background: '#10b981', borderRadius: '20px 0 0 20px' }} />

                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, width: '100%' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* 1행: 배지 + [장애ID & 년월일시] */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                          <span style={{
                            fontSize: 9, fontWeight: 900, color: '#10b981',
                            background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)',
                            borderRadius: 6, padding: '2px 8px', letterSpacing: '0.08em',
                          }}>✓ 완료</span>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 10, color: '#475569', fontFamily: 'monospace', fontWeight: 700 }}>
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
                          }}>
                            {smsPreview}
                          </p>
                        )}
                      </div>

                      {/* 화살표 */}
                      <div style={{
                        width: 28, height: 28, borderRadius: 10,
                        background: 'rgba(16,185,129,0.08)',
                        border: '1px solid rgba(16,185,129,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, alignSelf: 'center',
                      }}>
                        <ChevronRight size={15} color="#10b981" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 닫기 버튼 */}
            <div style={{ padding: '12px 16px', paddingBottom: 'calc(16px + env(safe-area-inset-bottom))', borderTop: '1px solid rgba(255,255,255,0.06)', background: '#0e1118', flexShrink: 0 }}>
              <button
                onClick={() => setShowReportPopup(false)}
                style={{
                  width: '100%', padding: '14px', borderRadius: 14,
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                  color: '#64748b', fontSize: 15, fontWeight: 700, cursor: 'pointer',
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
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 120, backdropFilter: 'blur(4px)' }}
          />
          <div style={{
            position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 121,
            background: '#141820', borderRadius: '24px 24px 0 0',
            border: '1px solid rgba(255,255,255,0.08)',
            padding: '12px 0', paddingBottom: 'calc(24px + env(safe-area-inset-bottom))',
          }}>
            <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.12)', borderRadius: 99, margin: '0 auto 14px' }} />
            <div style={{ padding: '0 20px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <p style={{ fontSize: 10, color: '#475569', fontWeight: 700, marginBottom: 3 }}>선택된 리포트</p>
              <p style={{ fontSize: 14, color: '#fff', fontWeight: 800 }}>{reportLongPressItem.title}</p>
              <p style={{ fontSize: 10, color: '#334155', fontFamily: 'monospace', marginTop: 3 }}>{reportLongPressItem.cleanRoomId}</p>
            </div>
            <div style={{ marginTop: 8 }}>
              <button
                onClick={() => { setReportLongPressItem(null); setShowReportPopup(false); navigate(`/ai-report/${reportLongPressItem.roomId}`); }}
                style={{ width: '100%', padding: '15px 20px', background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}
              >
                <ChevronRight size={20} color="#10b981" />
                <span style={{ fontSize: 15, color: '#e2e8f0', fontWeight: 600 }}>리포트 상세보기</span>
              </button>
              <button
                onClick={() => setReportLongPressItem(null)}
                style={{ width: '100%', padding: '15px 20px', background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}
              >
                <span style={{ fontSize: 15, color: '#475569', fontWeight: 600 }}>취소</span>
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
