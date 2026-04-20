import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';

// ── 기존 PC 페이지 전체 그대로 재사용 ───────────────────────────────────────────
import LoginPage              from '../pages/LoginPage';
import DashboardPage          from '../pages/DashboardPage';
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

// ── 모바일 전용 페이지 (카드 기반, 네이티브 UX) ────────────────────────────────
import MobileDashboard        from './pages/MobileDashboard';
import MobileActivity         from './pages/MobileActivity';
import MobileInbox            from './pages/MobileInbox';
import MobileIncidentPush     from './pages/MobileIncidentPush';
import MobileChat             from './pages/MobileChat';

// ── 기존 PC 공통 컴포넌트 그대로 재사용 ─────────────────────────────────────────
import SMSNotification        from '../components/SMSNotification';
import ErrorBoundary          from '../components/ErrorBoundary';
import ConsentModal           from '../components/ConsentModal';
import BottomMenu             from '../components/BottomMenu';      // PC BottomMenu 그대로!
import AIAssistantPanel       from '../components/AIAssistantPanel';
import { CodebookProvider }   from '../context/CodebookContext';

// ── Auth Store ────────────────────────────────────────────────────────────────
import {
  getAccessToken, setAccessToken, clearSession,
  getUserProfile, setUserProfile as setStoreUserProfile,
  addAuthListener,
  getGhostToken, setGhostToken, getAuthHeaders,
} from '../lib/authStore';

// ── PWA Install Button (모바일 전용) ──────────────────────────────────────────
import PWAInstallButton from './components/PWAInstallButton';

import { X, MessageSquare, FileText } from 'lucide-react';

const API_BASE = 'https://sguardai.khcho0421.workers.dev';

// ─── Protected Route ─────────────────────────────────────────────────────────
function ProtectedRoute({ children, isRefreshing, userProfile }) {
  if (isRefreshing) return null;
  if (!userProfile && !getAccessToken()) {
    return <Navigate to="/" replace />;
  }
  return children;
}

// ─── App Content ──────────────────────────────────────────────────────────────
function AppContent() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const isAuthPage = location.pathname === '/';

  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [showWarRoomPopup, setShowWarRoomPopup] = useState(false);
  const [showReportPopup, setShowReportPopup] = useState(false);
  const [warRooms, setWarRooms] = useState([]);
  const [userProfile, setUserProfile] = useState(
    () => getUserProfile() || JSON.parse(localStorage.getItem('sguard_user') || 'null')
  );
  const [isRefreshing, setIsRefreshing] = useState(true);

  // Auth listener
  useEffect(() => {
    return addAuthListener(({ userProfile: u }) => setUserProfile(u));
  }, []);

  // Silent Refresh (PC App.jsx와 완전히 동일)
  useEffect(() => {
    const checkSession = async () => {
      if (sessionStorage.getItem('s_logged_out') === '1') {
        setIsRefreshing(false);
        return;
      }
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
          setIsRefreshing(false);
          return;
        }

        const ghostToken = getGhostToken();
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
        if (!isAuthPage) navigate('/', { replace: true });
      } catch (e) {
        const cachedUser = localStorage.getItem('sguard_user');
        if (cachedUser && cachedUser !== 'null') {
          try {
            const parsed = JSON.parse(cachedUser);
            if (parsed?.employee_id) { setStoreUserProfile(parsed); setIsRefreshing(false); return; }
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
  }, []);

  // 로그인 상태에서 로그인 페이지 접근 시 대시보드로
  useEffect(() => {
    if (!isRefreshing && userProfile && isAuthPage) {
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
      {!isAuthPage && <SMSNotification />}

      <Routes>
        {/* 로그인 + 하단 PWA 설치 버튼 */}
        <Route path="/" element={<LoginPageWithPWA />} />

        {/* ── 대시보드: 모바일 전용 MobileDashboard 사용 ── */}
        <Route path="/dashboard"   element={<PR><MobileDashboard user={userProfile} /></PR>} />
        <Route path="/activity"    element={<PR><MobileActivity user={userProfile} /></PR>} />
        <Route path="/inbox"       element={<PR><MobileInbox user={userProfile} /></PR>} />
        <Route path="/incident-push" element={<PR><MobileIncidentPush user={userProfile} /></PR>} />
        <Route path="/chat/:incidentId?" element={<PR><MobileChat user={userProfile} /></PR>} />

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
        <Route path="/incident-list"           element={<PR><IncidentListPage /></PR>} />
        <Route path="/keyword-management"      element={<PR><KeywordManagementPage /></PR>} />
        <Route path="/report-line-management"  element={<PR><ReportLineManagementPage /></PR>} />
        <Route path="/security-logs"           element={<PR><SecurityLogPage /></PR>} />
        <Route path="/processing-flow"         element={<PR><ProcessingFlowPage /></PR>} />
        <Route path="/knowledge-base"          element={<PR><KnowledgeBasePage /></PR>} />
        <Route path="/user-management"         element={<PR><UserManagementPage /></PR>} />
        <Route path="/organization-management" element={<PR><OrganizationManagementPage /></PR>} />
        <Route path="/warroom-management"      element={<PR><WarRoomManagementPage /></PR>} />
        <Route path="/codebook-management"     element={<PR><CodebookManagementPage /></PR>} />
        <Route path="/workflow/:inc_id"        element={<PR><WorkflowPage /></PR>} />
        <Route path="/orbital-command"         element={<PR><OrbitalCommandPage /></PR>} />
      </Routes>

      {/* Consent Modal */}
      {userProfile &&
        (userProfile.terms_agreed_at === null ||
         userProfile.terms_agreed_at === undefined ||
         userProfile.terms_agreed_at === '') &&
        !isAuthPage && (
          <ConsentModal userProfile={userProfile} setUserProfile={setUserProfile} />
        )}


      {/* BottomMenu - PC와 완전히 동일 */}
      {!isAuthPage && (
        <BottomMenu
          currentPath={location.pathname}
          onWarRoomClick={() => { fetchWarRooms(); setShowWarRoomPopup(true); }}
          onReportClick={() => { fetchWarRooms(); setShowReportPopup(true); }}
          onAiClick={() => setShowAIAssistant(true)}
          user={userProfile}
        />
      )}

      {/* War-Room 리스트 팝업 - PC와 동일 */}
      {showWarRoomPopup && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowWarRoomPopup(false)} />
          <div className="bg-[#1a1f2e] w-full max-w-xl rounded-t-[2.5rem] border-t border-white/10 shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[70vh] animate-in slide-in-from-bottom-full duration-500">
            <div className="p-5 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-blue-600/10 to-transparent">
              <div className="flex items-center space-x-3">
                <div className="bg-blue-600/20 p-2.5 rounded-xl border border-blue-500/30">
                  <MessageSquare className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">참여 중인 War-Room</h3>
                  <p className="text-[10px] text-slate-500 font-mono">ACTIVE CHANNELS ({warRooms.length})</p>
                </div>
              </div>
              <button onClick={() => setShowWarRoomPopup(false)} className="p-2 rounded-full hover:bg-white/5 transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {warRooms.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm">진행 중인 War-Room이 없습니다.</div>
              ) : warRooms.map((room) => {
                const roomId = room.inc_id || room.id;
                return (
                  <div key={roomId}
                    onClick={() => { setShowWarRoomPopup(false); navigate(`/chat/${roomId}`); }}
                    className={`bg-[#11141d] p-4 rounded-2xl border transition-all cursor-pointer group ${roomId === currentIncidentId ? 'border-blue-500/40 bg-blue-900/10' : 'border-white/5 hover:border-blue-500/30'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded border bg-red-500/20 text-red-500 border-red-500/30">CRITICAL</span>
                      {roomId === currentIncidentId && <span className="text-[9px] text-blue-400 font-bold">● 현재 채팅방</span>}
                    </div>
                    <p className="text-sm font-semibold text-white truncate" title={room.msg || room.title || roomId}>{room.msg || room.title || roomId}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{room.reg_dt ? new Date(room.reg_dt).toLocaleString('ko-KR') : ''}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Report 팝업 - PC와 동일 */}
      {showReportPopup && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowReportPopup(false)} />
          <div className="bg-[#1a1f2e] w-full max-w-xl rounded-t-[2.5rem] border-t border-white/10 shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[70vh] animate-in slide-in-from-bottom-full duration-500">
            <div className="p-5 border-b border-white/5 flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-500/20 rounded-2xl">
                  <FileText className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">장애 보고서 선택</h3>
                  <p className="text-[10px] text-slate-500 font-mono">AVAILABLE REPORTS ({warRooms.length})</p>
                </div>
              </div>
              <button onClick={() => setShowReportPopup(false)} className="p-2 rounded-full hover:bg-white/5 transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {warRooms.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm">리포트 가능한 장애 건이 없습니다.</div>
              ) : warRooms.map((room) => {
                const roomId = room.inc_id || room.id;
                return (
                  <div key={roomId}
                    onClick={() => { setShowReportPopup(false); navigate(`/ai-report/${roomId}`); }}
                    className="bg-[#11141d] p-4 rounded-2xl border border-white/5 hover:border-emerald-500/30 transition-all cursor-pointer group">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded border bg-blue-500/20 text-blue-400 border-blue-500/30">COMPLETED</span>
                    </div>
                    <p className="text-sm font-semibold text-white truncate" title={room.msg || room.title || roomId}>{room.msg || room.title || roomId}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{room.reg_dt ? new Date(room.reg_dt).toLocaleString('ko-KR') : ''}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
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
