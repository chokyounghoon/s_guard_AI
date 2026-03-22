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
import ReportPublishPage from './pages/ReportPublishPage';
import ActivityPage from './pages/ActivityPage';
import ActivityDetailPage from './pages/ActivityDetailPage';
import AssignmentsPage from './pages/AssignmentsPage';
import SMSNotification from './components/SMSNotification';
import AiChatWidget from './components/AiChatWidget';
import ErrorBoundary from './components/ErrorBoundary';
import OverallStatusPage from './pages/OverallStatusPage';
import SearchPage from './pages/SearchPage';
import IncidentListPage from './pages/IncidentListPage';
import KeywordManagementPage from './pages/KeywordManagementPage';
import ReportLineManagementPage from './pages/ReportLineManagementPage';
import SmsTestPage from './pages/SmsTestPage';
import KnowledgeBasePage from './pages/KnowledgeBasePage';
import UserManagementPage from './pages/UserManagementPage';
import OrganizationManagementPage from './pages/OrganizationManagementPage';
import WarRoomManagementPage from './pages/WarRoomManagementPage';

// 로그인/회원가입 페이지에서는 AiChatWidget 숨김
function AppContent() {
  const location = useLocation();
  const hideWidget = ['/', '/signup'].includes(location.pathname);

  return (
    <>
      <SMSNotification />
      {!hideWidget && <AiChatWidget />}
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/dashboard" element={<ErrorBoundary><DashboardPage /></ErrorBoundary>} />
        <Route path="/ai-report" element={<AiReportPage />} />
        <Route path="/assignment-detail" element={<AssignmentDetailPage />} />
        <Route path="/chat/:incidentId?" element={<ChatPage />} />
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
        <Route path="/sms-test" element={<SmsTestPage />} />
        <Route path="/knowledge-base" element={<KnowledgeBasePage />} />
        <Route path="/user-management" element={<UserManagementPage />} />
        <Route path="/organization-management" element={<OrganizationManagementPage />} />
        <Route path="/warroom-management" element={<WarRoomManagementPage />} />
      </Routes>
    </>
  );
}

function App() {
  console.log('App Loaded - Version: Fix-Chat-Crash-v2');
  return (
    <Router>
      <GoogleOAuthProvider clientId="368028308466-placeholder.apps.googleusercontent.com">
        <AppContent />
      </GoogleOAuthProvider>
    </Router>
  );
}

export default App;

