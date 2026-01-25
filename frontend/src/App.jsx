import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import AiReportPage from './pages/AiReportPage';
import AssignmentDetailPage from './pages/AssignmentDetailPage';
import ChatPage from './pages/ChatPage';
import ReportPublishPage from './pages/ReportPublishPage';
import ActivityPage from './pages/ActivityPage';
import ActivityDetailPage from './pages/ActivityDetailPage';





function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/ai-report" element={<AiReportPage />} />
        <Route path="/assignment-detail" element={<AssignmentDetailPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/report-publish" element={<ReportPublishPage />} />
        <Route path="/activity" element={<ActivityPage />} />
        <Route path="/activity-detail" element={<ActivityDetailPage />} />




      </Routes>
    </Router>
  );
}

export default App;
