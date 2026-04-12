import React from 'react';
import { HashRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
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

import BottomMenu from './components/BottomMenu';
import AIAssistantPanel from './components/AIAssistantPanel';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, MessageSquare, FileText } from 'lucide-react';

import { CodebookProvider } from './context/CodebookContext';

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  
  const isAuthPage = ['/', '/signup'].includes(location.pathname);
  
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [showWarRoomPopup, setShowWarRoomPopup] = useState(false);
  const [showReportPopup, setShowReportPopup] = useState(false);
  const [warRooms, setWarRooms] = useState([]);
  const [userProfile, setUserProfile] = useState(null);

  // Load user profile
  useEffect(() => {
    const savedUser = localStorage.getItem('sguard_user');
    if (savedUser && savedUser !== 'undefined' && savedUser !== 'null') {
      try {
        setUserProfile(JSON.parse(savedUser));
      } catch (e) {
        console.error("User profile parse error", e);
      }
    }
  }, []);

  const fetchWarRooms = async () => {
    try {
      const res = await fetch('https://sguardai.khcho0421.workers.dev/warroom/rooms');
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

  return (
    <>
      <SMSNotification />
      
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/dashboard" element={<ErrorBoundary><DashboardPage /></ErrorBoundary>} />
        <Route path="/ai-report/:incidentId?" element={<AiReportPage />} />
        <Route path="/assignment-detail" element={<AssignmentDetailPage />} />
        <Route path="/chat/:incidentId?" element={<ChatPage />} />
        <Route path="/chat-summary/:incidentId" element={<ChatSummaryPage />} />
        <Route path="/ai-process-report" element={<AiProcessReportPage />} />
        <Route path="/report-publish" element={<ReportPublishPage />} />
        <Route path="/activity" element={<ActivityPage />} />
        <Route path="/activity-detail" element={<ActivityDetailPage />} />
        <Route path="/assignments" element={<AssignmentsPage />} />
        <Route path="/overall-status" element={<OverallStatusPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/incident-list" element={<IncidentListPage />} />
        <Route path="/keyword-management" element={<KeywordManagementPage />} />
        <Route path="/report-line-management" element={<ReportLineManagementPage />} />
        <Route path="/incident-push" element={<IncidentPushPage />} />
        <Route path="/knowledge-base" element={<KnowledgeBasePage />} />
        <Route path="/user-management" element={<UserManagementPage />} />
        <Route path="/organization-management" element={<OrganizationManagementPage />} />
        <Route path="/warroom-management" element={<WarRoomManagementPage />} />
        <Route path="/codebook-management" element={<CodebookManagementPage />} />
         <Route path="/workflow/:inc_id" element={<WorkflowPage />} />
         <Route path="/inbox" element={<InboxPage />} />
      </Routes>

      {/* Global Bottom Navigation */}
      {!isAuthPage && (
        <BottomMenu 
          currentPath={location.pathname.startsWith('/chat') ? '/chat' : location.pathname} 
          onWarRoomClick={handleWarRoomClick}
          onReportClick={handleReportClick}
          onAiClick={() => setShowAIAssistant(true)}
        />
      )}

      {/* Global War-Room List Popup */}
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
                  <div
                    key={roomId}
                    onClick={() => { setShowWarRoomPopup(false); navigate(`/chat/${roomId}`); }}
                    className={`bg-[#11141d] p-4 rounded-2xl border transition-all cursor-pointer group ${roomId === currentIncidentId ? 'border-blue-500/40 bg-blue-900/10' : 'border-white/5 hover:border-blue-500/30'}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded border bg-red-500/20 text-red-500 border-red-500/30">CRITICAL</span>
                      {roomId === currentIncidentId && <span className="text-[9px] text-blue-400 font-bold">● 현재 채팅방</span>}
                    </div>
                    <p className="text-sm font-semibold text-white truncate">{room.msg || room.title || roomId}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{room.reg_dt ? new Date(room.reg_dt).toLocaleString('ko-KR') : ''}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Global Report List Popup */}
      {showReportPopup && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowReportPopup(false)} />
          <div className="bg-[#1a1f2e] w-full max-w-xl rounded-t-[2.5rem] border-t border-white/10 shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[70vh] animate-in slide-in-from-bottom-full duration-500">
            <div className="p-5 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-emerald-600/10 to-transparent">
              <div className="flex items-center space-x-3">
                <div className="bg-emerald-600/20 p-2.5 rounded-xl border border-emerald-500/30">
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
                  <div
                    key={roomId}
                    onClick={() => { setShowReportPopup(false); navigate(`/ai-report/${roomId}`); }}
                    className="bg-[#11141d] p-4 rounded-2xl border border-white/5 hover:border-emerald-500/30 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded border bg-blue-500/20 text-blue-400 border-blue-500/30">COMPLETED</span>
                    </div>
                    <p className="text-sm font-semibold text-white truncate">{room.msg || room.title || roomId}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{room.reg_dt ? new Date(room.reg_dt).toLocaleString('ko-KR') : ''}</p>
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
    </>
  );
}

function App() {
  console.log('App Loaded - Version: Dashboard-Rearrange-v1');
  return (
    <Router>
      <GoogleOAuthProvider clientId="368028308466-placeholder.apps.googleusercontent.com">
        <CodebookProvider>
          <AppContent />
        </CodebookProvider>
      </GoogleOAuthProvider>
    </Router>
  );
}

export default App;

