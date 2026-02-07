import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
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







function App() {
  return (
    <Router>
      <SMSNotification />
      <AiChatWidget />
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/ai-report" element={<AiReportPage />} />
        <Route path="/assignment-detail" element={<AssignmentDetailPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/ai-process-report" element={<AiProcessReportPage />} />
        <Route path="/report-publish" element={<ReportPublishPage />} />
        <Route path="/activity" element={<ActivityPage />} />
        <Route path="/activity-detail" element={<ActivityDetailPage />} />
        <Route path="/assignments" element={<AssignmentsPage />} />





      </Routes>
    </Router>
  );
}

export default App;
