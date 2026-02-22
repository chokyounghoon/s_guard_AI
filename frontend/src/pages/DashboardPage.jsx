import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Server, AlertTriangle, CheckCircle, Clock, Search, Bell, Menu, User, ChevronRight, Zap, Shield, Database, Sparkles, MessageSquare, Brain, MoreHorizontal, RefreshCw, Info, X, BarChart2, Hash, Users, LogIn, AlertCircle, Home } from 'lucide-react';
import AgentDiscussionPanel from '../components/AgentDiscussionPanel';
import EmergencyActionModal from '../components/EmergencyActionModal';
import AiInsightPanel from '../components/AiInsightPanel';
import AiSmsStatusPanel from '../components/AiSmsStatusPanel';
import AiPredictionPanel from '../components/AiPredictionPanel';
import ErrorBoundary from '../components/ErrorBoundary';
import AIInsightModal from '../components/AIInsightModal';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [showAgentPanel, setShowAgentPanel] = useState(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [agentMessages, setAgentMessages] = useState([]);
  const [systemStatus, setSystemStatus] = useState('normal'); // normal, critical, recovering
  const [messages, setMessages] = useState([]); // For top-banner messages
  const [allNotifications, setAllNotifications] = useState([]); // For notification drawer
  const [showNotifications, setShowNotifications] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('week');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [aiInsights, setAiInsights] = useState({});
  const [selectedInsight, setSelectedInsight] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showWarRoomPopup, setShowWarRoomPopup] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [smsMessages, setSmsMessages] = useState([]);
  const [deletedSmsIds, setDeletedSmsIds] = useState(new Set());
  const [isSmsPanelCollapsed, setIsSmsPanelCollapsed] = useState(false);
  const [predictionCounts, setPredictionCounts] = useState({ critical: 0, server: 0, security: 0, report: 0 });

  // Initialize data from localStorage
  useEffect(() => {
    const savedUser = localStorage.getItem('sguard_user');
    if (savedUser) {
        setUserProfile(JSON.parse(savedUser));
    } else {
        setShowProfileModal(true);
    }

    const savedCollapsed = localStorage.getItem('sguard_sms_collapsed');
    if (savedCollapsed) {
        setIsSmsPanelCollapsed(JSON.parse(savedCollapsed));
    }
  }, []);

  // SMS 메시지 폴링 (5초마다)
  useEffect(() => {
    fetchSMSMessages();
    const interval = setInterval(fetchSMSMessages, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchSMSMessages = async () => {
    try {
      // Cloudflare Workers API 사용
      const apiUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:8000/sms/recent?limit=3'
        : 'https://api.chokerslab.store/sms/recent?limit=3';
      
      const response = await fetch(apiUrl);
      if (response.ok) {
        const data = await response.json();
        // 삭제된 항목은 필터링하여 상태 업데이트
        setSmsMessages((data.messages || []).filter(msg => !deletedSmsIds.has(msg.id)));
      }
    } catch (error) {
      console.error('SMS 메시지 로드 실패:', error);
    }
  };

  const toggleSmsPanel = () => {
    const newState = !isSmsPanelCollapsed;
    setIsSmsPanelCollapsed(newState);
    localStorage.setItem('sguard_sms_collapsed', JSON.stringify(newState));
  };

  const deleteSMSMessage = async (e, id) => {
    e.stopPropagation();
    try {
      const apiUrl = window.location.hostname === 'localhost' 
        ? `http://localhost:8000/sms/${id}`
        : `https://api.chokerslab.store/sms/${id}`;
      
      const response = await fetch(apiUrl, { method: 'DELETE' });
      if (response.ok) {
        // 즉시 화면에서 제거하기 위한 로컬 상태 업데이트
        setDeletedSmsIds(prev => {
          const newSet = new Set(prev);
          newSet.add(id);
          return newSet;
        });
        setSmsMessages(prev => prev.filter(msg => msg.id !== id));
      }
    } catch (error) {
      console.error('SMS 메시지 삭제 실패:', error);
    }
  };


  // Dummy data for recent assignments
  const recentAssignments = [
    {
      id: 'INC-8823',
      title: 'Payment Gateway Timeout',
      sender: 'AI Autopilot',
      time: '18:45',
      severity: 'CRITICAL',
      code: 'PG-001',
      assignmentType: 'AI',
      bgColor: 'bg-red-500/5',
      borderColor: 'border-red-500/10',
    },
    {
      id: 'SMS-1234',
      title: '서버 CPU 사용량 급증 알림',
      sender: '김철수',
      time: '14:30',
      severity: 'MAJOR',
      code: 'SRV-002',
      assignmentType: 'SMS',
      bgColor: 'bg-orange-500/5',
      borderColor: 'border-orange-500/10',
    },
    {
      id: 'AI-5678',
      title: '데이터베이스 연결 오류 감지',
      sender: 'AI Autopilot',
      time: '10:00',
      severity: 'NORMAL',
      code: 'DB-003',
      assignmentType: 'AI',
      bgColor: 'bg-blue-500/5',
      borderColor: 'border-blue-500/10',
    },
  ];

  const totalAssignedCount = recentAssignments.length;

  // Dummy data for status cards
  const statusCards = [
    { id: 'critical', label: 'Critical', val: 0, icon: AlertTriangle, color: 'bg-red-500/20', text: 'text-red-400', bar: 'bg-red-500', borderColor: 'border-red-500/30' },
    { id: 'major', label: 'Major', val: 1, icon: Shield, color: 'bg-orange-500/20', text: 'text-orange-400', bar: 'bg-orange-500', borderColor: 'border-orange-500/30' },
    { id: 'normal', label: 'Normal', val: 24, icon: CheckCircle, color: 'bg-emerald-500/20', text: 'text-emerald-400', bar: 'bg-emerald-500', borderColor: 'border-emerald-500/30' },
    { id: 'info', label: 'Info', val: 156, icon: Info, color: 'bg-blue-500/20', text: 'text-blue-400', bar: 'bg-blue-500', borderColor: 'border-blue-500/30' },
  ];

  // Real-time metrics simulation
  const [metrics, setMetrics] = useState({
    cpu: 45,
    memory: 52,
    requests: 240,
    errorRate: 0.1
  });

  // Demo Trigger Handler (Secret Key: 'd')
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'd' && !showAgentPanel) {
        startDemoScenario();
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showAgentPanel]);

  // Metric Simulation Loop
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(prev => {
        if (systemStatus === 'critical') {
          return {
            cpu: Math.min(98, prev.cpu + Math.random() * 5),
            memory: Math.min(95, prev.memory + Math.random() * 3),
            requests: Math.min(3000, prev.requests + Math.random() * 100),
            errorRate: Math.min(15, prev.errorRate + Math.random() * 2)
          };
        } else if (systemStatus === 'recovering') {
          return {
            cpu: Math.max(45, prev.cpu - 5),
            memory: Math.max(52, prev.memory - 3),
            requests: Math.max(240, prev.requests - 50),
            errorRate: Math.max(0.1, prev.errorRate - 1)
          };
        } else {
          // Normal fluctuation
          return {
            cpu: 40 + Math.random() * 20,
            memory: 50 + Math.random() * 15,
            requests: 200 + Math.random() * 100,
            errorRate: Math.random() * 0.5
          };
        }
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [systemStatus]);

  const startDemoScenario = () => {
    setSystemStatus('critical');
    setShowAgentPanel(true);
    
    // Agent Coversation Sequence
    const sequence = [
      { role: 'Security', text: '⚠️ 비정상적인 트래픽 급증 감지! IP 평판 조회 중...', delay: 1000 },
      { role: 'Security', text: '✅ 보안이슈로 발생한 장애 수신은 아님, 보안 이슈 없음', delay: 3000 },
      { role: 'DB', text: '🚨 DB 커넥션 풀 급격히 포화 중! (사용률 92%(문자))', delay: 5000 },
      { role: 'DB', text: '🔍 원인 규명 중... `orders` 테이블에서 슬로우 쿼리 발견. 인덱스 누락 의심됨.', delay: 7000 },
      { role: 'DevOps', text: '🔥 WAS-03 CPU 부하 임계치 초과 (95%). 애플리케이션 응답 지연 발생.', delay: 9000 },
      { role: 'DevOps', text: '비정상 인스턴스 재시작 및 DB 풀 플러시 승인 요청.', delay: 11000 },
      { role: 'Leader', text: '상황 분석 중... 보안 이상 무. DB 병목 확인됨. 인프라 상태 위급.', delay: 13000 },
      { role: 'Leader', text: '💡 결정: 서비스 복구를 위해 WAS-Cluster-03 즉시 재기동 제안.', delay: 15000 },
    ];

    let currentStep = 0;
    
    const runSequence = () => {
      if (currentStep < sequence.length) {
        const step = sequence[currentStep];
        setTimeout(() => {
          setAgentMessages(prev => [...prev, step]);
          currentStep++;
          runSequence();
        }, step.delay - (currentStep > 0 ? sequence[currentStep-1].delay : 0));
      } else {
        setTimeout(() => {
            setShowEmergencyModal(true);
        }, 2000);
      }
    };

    runSequence();
  };

  const handleApproveAction = () => {
    setShowEmergencyModal(false);
    setSystemStatus('recovering');
    setAgentMessages(prev => [...prev, { role: 'Leader', text: '✅ 조치 승인됨. 재기동 스크립트 실행 중...', delay: 0 }]);
    
    setTimeout(() => {
       setAgentMessages(prev => [...prev, { role: 'DevOps', text: '🚀 WAS-03 재기동 완료.', delay: 0 }]);
    }, 2000);

    setTimeout(() => {
       setAgentMessages(prev => [...prev, { role: 'Leader', text: '🎉 시스템 안정화 확인. 사후 분석(Post-Mortem) 보고서 생성 중...', delay: 0 }]);
       setSystemStatus('normal');
       // Auto close panel delay
       setTimeout(() => setShowAgentPanel(false), 5000);
    }, 4000);
  };

  const dismissMessage = (id) => {
    setMessages(messages.filter(msg => msg.id !== id));
  };

  // Modal State
  const [showInsightModal, setShowInsightModal] = useState(false);
  const [selectedInsightData, setSelectedInsightData] = useState(null);

  // Mock Data for AI Prediction Modal (from screenshot)
  const demoInsightData = {
    predictionId: 'PRED-2024-001',
    severity: 'high',
    category: '장애',
    aiReasoning: '평소 화요일 오전 08:00~09:00 CPU 사용률은 45% 수준이나, 현재 92%로 급증하였습니다. 배치 프로세스 (batch_processor_v2)의 무한 루프가 의심되며, 메모리 누수(Memory Leak) 패턴도 함께 감지되었습니다. 과거 유사 사례 분석 결과, 이러한 패턴은 평균 15분 이내에 서비스 중단으로 이어질 확률이 높습니다.',
    relatedMetrics: {
      cpu: 92,
      memory: 78,
      diskIO: 65
    },
    recommendedActions: [
      '배치 프로세스 즉시 재시작 (service restart batch_processor_v2)',
      '로그 파일 확인하여 루프 원인 파악 (/var/log/batch_errors.log)',
      '메모리 덤프 생성 후 누수 지점 분석',
      '임시 조치: 프로세스 타임아웃 설정 강화 (timeout 300s -> 120s)'
    ],
    confidence: 95,
    similarCases: 37
  };

  const handleShowInsight = (type) => {
    // In a real app, we would fetch data based on type using the API
    // For now, we use the demo data matching the screenshot
    setSelectedInsightData(demoInsightData);
    setShowInsightModal(true);
  };

  const handleLogReceived = (log, counts) => {
    // Example: Add log to notifications or process it
    if (counts) {
      setPredictionCounts(counts);
    }
    console.log("Log received in Dashboard:", log);
    setAllNotifications(prev => [{ id: Date.now(), title: log.title || 'AI Log', content: log.message || log.text, type: 'AI', severity: log.severity, time: new Date().toLocaleTimeString() }, ...prev]);
    // Optionally show a temporary message in the top banner for critical logs
    if (log.severity === 'CRITICAL') {
      setMessages(prev => [...prev, { id: Date.now(), type: 'error', text: log.message }]);
    }
  };

  const renderProfileModal = () => {
    if (!showProfileModal) return null;

    const currentProfile = userProfile || { name: 'Guest User', email: 'guest@s-guard.ai', picture: null, dept: '', team: '' };
    
    return (
      <ProfileModalContent 
        profile={currentProfile} 
        onClose={() => setShowProfileModal(false)}
        onSave={(updated) => {
          setUserProfile(updated);
          localStorage.setItem('sguard_user', JSON.stringify(updated));
          setShowProfileModal(false);
        }}
        navigate={navigate}
      />
    );
  };

  return (
    <div className="min-h-screen bg-[#0f1421] text-white font-sans overflow-x-hidden relative">
      {/* Top Navigation */}
      <nav className="flex justify-between items-center p-4 bg-[#0f1421] border-b border-white/10 sticky top-0 z-30">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center font-bold text-lg shadow-lg shadow-blue-900/50">S</div>
          <span className="text-lg font-bold tracking-tight">S-Guard <span className="text-blue-500">AI</span></span>
        </div>
        <div className="flex items-center space-x-4">
          <div className="relative group">
            <Search className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors cursor-pointer" />
          </div>
          <div className="relative group">
            <Bell 
              className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors cursor-pointer" 
              onClick={() => setShowNotifications(true)}
            />
            {allNotifications.length > 0 && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            )}
          </div>
          <div 
            className="flex items-center space-x-3 cursor-pointer hover:bg-white/5 p-1 px-2 rounded-xl transition-colors group"
            onClick={() => setShowProfileModal(true)}
          >
            {userProfile && (
            <span className="text-xs font-bold text-slate-300 hidden sm:inline-block group-hover:text-blue-400">
                {userProfile.name}
            </span>
            )}
            <div className="w-8 h-8 bg-slate-700/50 rounded-full flex items-center justify-center border border-white/10 overflow-hidden ring-2 ring-blue-500/20 group-hover:ring-blue-500/50 transition-all">
                {userProfile?.picture ? (
                <img src={userProfile.picture} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                <User className="w-5 h-5 text-slate-300 group-hover:text-blue-400" />
                )}
            </div>
          </div>
        </div>
      </nav>

      {/* Top Banner Messages */}
      {messages.length > 0 && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md p-4 space-y-2">
          {messages.map(msg => (
            <div 
              key={msg.id} 
              className={`flex items-center justify-between p-3 rounded-xl shadow-lg animate-in fade-in slide-in-from-top-2 duration-300
                ${msg.type === 'error' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'}
              `}
            >
              <p className="text-sm font-medium">{msg.text}</p>
              <button
                onClick={() => dismissMessage(msg.id)}
                className="ml-2 p-1 rounded-full hover:bg-white/20 transition-colors shrink-0"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Notification Drawer Panel */}
      {showNotifications && (
        <div className="fixed inset-0 z-[110] flex justify-end animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowNotifications(false)} />
          <div className="w-full max-w-sm bg-[#1a1f2e] h-full shadow-2xl relative z-10 animate-in slide-in-from-right duration-500 flex flex-col border-l border-white/10">
            <div className="p-6 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-blue-600/10 to-transparent">
              <div className="flex items-center gap-3">
                <div className="bg-blue-600/20 p-2 rounded-xl">
                  <Bell className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg">알림 센터</h3>
                  <p className="text-[10px] text-slate-500 font-mono uppercase">Notification Center</p>
                </div>
              </div>
              <button 
                onClick={() => setShowNotifications(false)}
                className="p-2 rounded-full hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {allNotifications.length > 0 ? (
                allNotifications.map((n) => (
                  <div 
                    key={n.id}
                    onClick={() => {
                      setShowNotifications(false);
                      navigate(n.type === 'SMS' ? '/chat' : '/assignment-detail?status=Open');
                    }}
                    className={`p-4 rounded-2xl border ${n.severity === 'CRITICAL' ? 'bg-red-500/5 border-red-500/10' : 'bg-[#11141d] border-white/5'} hover:border-blue-500/30 transition-all cursor-pointer group active:scale-[0.98]`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        {n.type === 'AI' ? (
                          <Brain className="w-3.5 h-3.5 text-blue-400" />
                        ) : (
                          <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
                        )}
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${n.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-500' : 'bg-blue-500/20 text-blue-400'}`}>
                          {n.type}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">{n.time}</span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-200 mb-1 group-hover:text-blue-400 transition-colors line-clamp-1">{n.title}</h4>
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">{n.content}</p>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-center space-y-4 opacity-50">
                  <Bell className="w-12 h-12 text-slate-600" />
                  <div>
                    <p className="text-sm font-bold text-slate-400">새로운 알림이 없습니다.</p>
                    <p className="text-[10px] text-slate-500">실시간으로 수집되는 정보를 기다리고 있습니다.</p>
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-white/5">
              <button 
                onClick={() => {
                  setAllNotifications([]);
                  setShowNotifications(false);
                }}
                className="w-full py-3 rounded-xl bg-slate-800 text-slate-400 text-xs font-bold hover:bg-slate-700 transition-colors"
              >
                모든 알림 지우기
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="p-6 max-w-7xl mx-auto pb-24">
        {/* Header Section */}
        <div>
        </div>

        {/* 실시간 SMS 수신 내역 패널 (접기/펼치기 가능) */}
        {smsMessages.length > 0 && (
          <div className="bg-[#1a1f2e] rounded-3xl border border-white/5 shadow-xl mb-6 overflow-hidden transition-all duration-300">
            <div 
              onClick={toggleSmsPanel}
              className="p-6 flex justify-between items-center cursor-pointer hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="bg-blue-600/20 p-2 rounded-xl">
                  <MessageSquare className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg">실시간 SMS 수신 내역</h3>
                  <p className="text-[10px] text-slate-500 font-mono uppercase">REAL-TIME SMS MONITORING</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center space-x-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono tracking-wider">LIVE</span>
                </div>
                <div className={`transition-transform duration-300 ${isSmsPanelCollapsed ? '' : 'rotate-180'}`}>
                  <ChevronRight className="w-5 h-5 text-slate-400 rotate-90" />
                </div>
              </div>
            </div>

            <div className={`transition-all duration-500 ease-in-out overflow-hidden ${isSmsPanelCollapsed ? 'max-h-0' : 'max-h-[1000px] border-t border-white/5'}`}>
              <div className="p-6 space-y-4">
                {smsMessages.filter(msg => !deletedSmsIds.has(msg.id)).map((msg) => (
                  <div key={msg.id} className="bg-[#11141d] rounded-2xl p-4 border border-white/5 flex items-start justify-between group hover:border-blue-500/30 transition-all">
                    <div className="flex items-start space-x-3 flex-1">
                      <div className="w-10 h-10 rounded-full bg-blue-600/10 flex items-center justify-center shrink-0">
                        {msg.keyword_detected ? (
                          <AlertCircle className="w-6 h-6 text-yellow-300" />
                        ) : (
                          <Info className="w-6 h-6 text-blue-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center space-x-2">
                            <h4 className="font-bold text-white text-sm">SMS 수신</h4>
                            {msg.keyword_detected && (
                              <span className="bg-yellow-400/20 text-yellow-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-yellow-400/30">
                                키워드 감지
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-xs text-slate-400 mb-1">발신: {msg.sender}</p>
                        <p className="text-sm text-slate-200 leading-snug">{msg.message}</p>
                      </div>
                      <button 
                        onClick={(e) => deleteSMSMessage(e, msg.id)}
                        className="ml-2 p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-red-400 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                        title="삭제"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* AI Autopilot Insight Panel */}
        <React.Suspense fallback={<div className="h-48 bg-gray-900 rounded-3xl animate-pulse"></div>}>
            <ErrorBoundary>
                <AiInsightPanel onLogReceived={handleLogReceived} onShowDetail={handleShowInsight} />
            </ErrorBoundary>
        </React.Suspense>

        {/* AI Autopilot Prediction Panel (Standalone) */}
        <AiPredictionPanel counts={predictionCounts} onShowDetail={handleShowInsight} />

        {/* AI Insight Modal */}
        {showInsightModal && (
            <AIInsightModal 
                insight={selectedInsightData} 
                onClose={() => setShowInsightModal(false)} 
            />
        )}

        {/* AI/SMS Status Panel */}
        <AiSmsStatusPanel />



        {/* Main Content Areas */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Alerts List */}
          <div className="lg:col-span-1 bg-[#1a1f2e] rounded-2xl p-6 border border-white/5">
            <h3 className="font-bold mb-4 flex items-center">
              <Activity className="w-4 h-4 mr-2 text-blue-400" />
              Live Incident Stream
            </h3>
            <div className="space-y-4">
              {systemStatus === 'critical' && (
                  <div onClick={startDemoScenario} className="cursor-pointer transition-transform hover:scale-[1.01] active:scale-[0.99]">
                    <AlertItem 
                        title="High Latency detected on WAS-03" 
                        time="Now" 
                        severity="critical"
                        desc="Response time exceeded threshold (2000ms > 500ms)"
                    />
                  </div>
              )}
              <div onClick={startDemoScenario} className="cursor-pointer transition-transform hover:scale-[1.01] active:scale-[0.99]">
                <AlertItem 
                    title="API Gateway Latency Spike" 
                    time="2m ago" 
                    severity="warning"
                    desc="Intermittent latency observed in region ap-northeast-2"
                />
              </div>
              <AlertItem 
                title="Database Backup Completed" 
                time="1h ago" 
                severity="info"
                desc="Daily incremental backup finished successfully (12.4GB)"
              />
              <AlertItem 
                title="New Deployment: Frontend v2.4" 
                time="3h ago" 
                severity="success"
                desc="Successfully deployed by CI/CD pipeline #8821"
              />
            </div>
          </div>

          {/* Quick Actions / Assignment / Agent Panel */}
          <div className="lg:col-span-2 space-y-6">
            {showAgentPanel ? (
                 <AgentDiscussionPanel 
                    messages={agentMessages} 
                    isVisible={true}
                    embedded={true}
                    onClose={() => setShowAgentPanel(false)} 
                />
            ) : (
                <div className="bg-[#1a1f2e] rounded-2xl p-6 border border-white/5 h-full">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold flex items-center">
                            <Shield className="w-4 h-4 mr-2 text-purple-400" />
                            AI War-Room Situation Log
                        </h3>
                        <span className="text-[10px] text-slate-500 bg-white/5 px-2 py-0.5 rounded">승인 대기: 1건</span>
                    </div>
                    
                    <div className="space-y-3">
                        {/* Demo Trigger Item */}
                        <div onClick={startDemoScenario} className="bg-[#11141d] p-4 rounded-xl border border-red-500/20 cursor-pointer hover:bg-[#1a1f2e] hover:border-red-500/50 transition-all group relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[10px] font-bold text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">CRITICAL</span>
                                <span className="text-[10px] text-slate-500">Just now</span>
                            </div>
                            <h4 className="font-bold text-sm text-slate-200 mb-1 group-hover:text-red-400 transition-colors">WAS-03 Response Latency</h4>
                            <p className="text-xs text-slate-500 mb-2 line-clamp-1">CPU load &gt; 95%, DB Conn saturation.</p>
                            <div className="flex justify-end">
                                <span className="text-[10px] text-blue-400 font-bold flex items-center group-hover:underline">
                                    승인 필요 <ChevronRight className="w-3 h-3 ml-0.5" />
                                </span>
                            </div>
                        </div>

                        {/* Static Item */}
                        <div className="bg-[#11141d] p-4 rounded-xl border border-white/5 opacity-60 hover:opacity-100 transition-opacity">
                            <div className="absolute top-0 left-0 w-1 h-full bg-orange-500"></div>
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[10px] font-bold text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20">MAJOR</span>
                                <span className="text-[10px] text-slate-500">2h ago</span>
                            </div>
                            <h4 className="font-bold text-sm text-slate-300 mb-1">API Gateway Latency</h4>
                            <p className="text-xs text-slate-500 line-clamp-1">Intermittent packet loss in region ap-ne-2.</p>
                        </div>
                    </div>
                </div>
            )}
          </div>
        </div>

        {/* Section 3: My Confirmation History & Recent List */}
         <div className="bg-[#1a1f2e] rounded-3xl p-6 border border-white/5 shadow-xl mt-6">
            <div className="flex justify-between items-center mb-5">
                 <div className="flex items-center space-x-2">
                    <User className="w-5 h-5 text-blue-500" />
                    <h2 className="font-bold text-lg">나의 Autopilot 확인요청 현황</h2>
                 </div>
                <span className="text-[10px] text-slate-400">실시간 업데이트</span>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-4 gap-4 mb-6">
                {/* Total */}
                <div 
                    onClick={() => navigate('/assignments?tab=전체')}
                    className="bg-[#11141d] p-5 rounded-2xl border border-white/5 relative cursor-pointer hover:bg-[#252b41] transition-all hover:scale-[1.02] active:scale-95"
                >
                    <p className="text-xs text-slate-400 mb-2 font-medium">총건</p>
                    <span className="text-4xl font-bold text-white transition-all duration-500">{totalAssignedCount}</span>
                    <div className="absolute bottom-4 right-4 bg-slate-700/20 p-2 rounded-xl">
                        <MoreHorizontal className="w-5 h-5 text-slate-500 fill-current" />
                    </div>
                </div>

                {/* Unconfirmed (Red) */}
                <div 
                    onClick={() => navigate('/assignments?tab=상태: 대기')}
                    className="bg-[#11141d] p-5 rounded-2xl border border-white/5 relative cursor-pointer hover:bg-[#2e1a1a] transition-all hover:scale-[1.02] active:scale-95"
                >
                    <p className="text-xs text-slate-400 mb-2 font-medium">미확인</p>
                    <span className="text-4xl font-bold text-red-400">0</span>
                    <div className="absolute bottom-4 right-4 bg-red-600/20 p-2 rounded-xl">
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                    </div>
                    {/* Pulsing Dot for Attention */}
                    <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-ping" />
                </div>

                {/* Processing (Orange) */}
                <div 
                    onClick={() => navigate('/assignments?tab=상태: 처리중')}
                    className="bg-[#11141d] p-5 rounded-2xl border border-white/5 relative cursor-pointer hover:bg-[#2e231a] transition-colors"
                >
                    <p className="text-xs text-slate-400 mb-2 font-medium">처리중</p>
                    <span className="text-4xl font-bold text-orange-400">2</span>
                    <div className="absolute bottom-4 right-4 bg-orange-600/20 p-2 rounded-xl">
                        <RefreshCw className="w-5 h-5 text-orange-500" />
                    </div>
                </div>

                {/* Completed (Blue) */}
                <div 
                    onClick={() => navigate('/assignments?tab=상태: 완료')}
                    className="bg-[#11141d] p-5 rounded-2xl border border-white/5 relative cursor-pointer hover:bg-[#1a1f2e] transition-colors"
                >
                    <p className="text-xs text-slate-400 mb-2 font-medium">처리완료</p>
                    <span className="text-4xl font-bold text-blue-400">3</span>
                    <div className="absolute bottom-4 right-4 bg-blue-600/20 p-2 rounded-xl">
                        <CheckCircle className="w-5 h-5 text-blue-500" />
                    </div>
                </div>
            </div>

            {/* Recent List Header */}
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-white">최근 할당 리스트 ({recentAssignments.length})</h3>
                <button 
                    onClick={() => navigate('/assignments')}
                    className="text-[11px] text-blue-500 font-medium hover:text-blue-400 flex items-center"
                >
                    전체보기 <ChevronRight className="w-3 h-3 ml-0.5" />
                </button>
            </div>

            {/* List Items - Dynamic */}
            <div className="space-y-3">
                {recentAssignments.length > 0 ? (
                    recentAssignments.slice(0, 3).map((item) => (
                        <div 
                            key={item.id}
                            onClick={() => navigate('/assignment-detail?status=Open')}
                            className={`${item.bgColor} p-4 rounded-2xl border ${item.borderColor} relative group hover:border-white/10 transition-colors cursor-pointer`}
                        >
                            <div className="flex items-start space-x-3">
                                <div className={`${item.severity === 'CRITICAL' ? 'bg-red-500/10' : 'bg-blue-500/10'} p-2 rounded-full mt-0.5`}>
                                    <AlertCircle className={`w-5 h-5 ${item.severity === 'CRITICAL' ? 'text-red-500' : 'text-blue-500'}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="flex items-center gap-2 max-w-[70%]">
                                          <span className={`text-[8px] font-black px-1 py-0.5 rounded border flex-shrink-0 ${
                                            item.assignmentType === 'AI' 
                                              ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' 
                                              : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                                          }`}>
                                            {item.assignmentType || 'AI'}
                                          </span>
                                          <h4 className="text-sm font-bold text-white truncate">{item.title}</h4>
                                        </div>
                                        <span className="text-[10px] text-slate-500 font-mono">{item.time}</span>
                                    </div>
                                    <p className="text-xs text-slate-300 leading-snug mb-2">
                                        발신: {item.sender}
                                    </p>
                                    <div className="flex items-center justify-between">
                                        <span className={`${item.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-500 border-red-500/30' : 'bg-blue-500/20 text-blue-500 border-blue-500/30'} text-[10px] font-bold px-2 py-0.5 rounded border`}>
                                            {item.severity}
                                        </span>
                                        <span className="text-[10px] text-slate-500">{item.code}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="bg-[#11141d] p-8 rounded-2xl border border-white/5 text-center">
                        <Info className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                        <p className="text-sm text-slate-400">최근 할당 내역이 없습니다</p>
                        <p className="text-xs text-slate-500 mt-1">SMS 메시지가 수신되면 자동으로 추가됩니다</p>
                    </div>
                )}
            </div>
          </div>
      </div>

       {/* AI Agent Demo Components - Emergency Modal Only (Panel is now embedded) */}
       <EmergencyActionModal 
         isOpen={showEmergencyModal}
         onClose={() => setShowEmergencyModal(false)}
         onApprove={handleApproveAction}
       />
       
       {renderProfileModal()}
       <AIInsightModal insight={selectedInsight} onClose={() => setSelectedInsight(null)} />

       {/* War Room Chat List Popup */}
       {showWarRoomPopup && (
         <div className="fixed inset-0 z-[100] flex items-end justify-center animate-in fade-in duration-300">
           <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowWarRoomPopup(false)} />
           
           <div className="bg-[#1a1f2e] w-full max-w-xl rounded-t-[2.5rem] border-t border-white/10 shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[80vh] animate-in slide-in-from-bottom-full duration-500">
             {/* Header */}
             <div className="p-6 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-blue-600/10 to-transparent">
               <div className="flex items-center space-x-3">
                 <div className="bg-blue-600/20 p-2.5 rounded-xl border border-blue-500/30">
                   <MessageSquare className="w-5 h-5 text-blue-400" />
                 </div>
                 <div>
                   <h3 className="font-bold text-lg text-white">참여 중인 War-Room</h3>
                   <p className="text-[10px] text-slate-500 font-mono">ACTIVE CHANNELS (2)</p>
                 </div>
               </div>
               <button 
                 onClick={() => setShowWarRoomPopup(false)}
                 className="p-2 rounded-full hover:bg-white/5 transition-colors group"
               >
                 <X className="w-5 h-5 text-slate-500 group-hover:text-white" />
               </button>
             </div>
 
             {/* Chat Room List */}
             <div className="flex-1 overflow-y-auto p-5 space-y-3 custom-scrollbar">
               {[
                 { 
                   id: 1, 
                   title: '[신한카드] SHB02681 은행고객종합...', 
                   lastMsg: 'AI 분석 결과 트래픽 임계치 설정 오류가 확인되었습니다.', 
                   time: '18:45', 
                   participants: 5,
                   severity: 'CRITICAL',
                   unread: true
                 },
                 { 
                   id: 2, 
                   title: 'INC-8823 서버 타임아웃 대응', 
                   lastMsg: 'DB Connection Pool 증설 작업이 완료되었습니다.', 
                   time: '14:30', 
                   participants: 3,
                   severity: 'MAJOR',
                   unread: false
                 }
               ].map((room) => (
                 <div 
                   key={room.id}
                   onClick={() => {
                     setShowWarRoomPopup(false);
                     navigate('/chat');
                   }}
                   className="bg-[#11141d] p-4 rounded-2xl border border-white/5 hover:border-blue-500/30 transition-all cursor-pointer group relative overflow-hidden active:scale-[0.98]"
                 >
                   <div className="flex items-start justify-between mb-2">
                     <div className="flex items-center gap-2">
                       <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${
                         room.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-500 border-red-500/30' : 'bg-orange-500/20 text-orange-500 border-orange-500/30'
                       }`}>
                         {room.severity}
                       </span>
                       <span className="text-[10px] text-slate-500 font-mono">ROOM #{room.id}</span>
                     </div>
                     <span className="text-[10px] text-slate-500">{room.time}</span>
                   </div>
                   
                   <h4 className="font-bold text-slate-200 mb-1 group-hover:text-blue-400 transition-colors truncate">
                     {room.title}
                   </h4>
                   <p className="text-xs text-slate-400 truncate mb-3">{room.lastMsg}</p>
                   
                   <div className="flex items-center justify-between">
                     <div className="flex -space-x-2">
                       {[1, 2, 3].map(i => (
                         <div key={i} className="w-6 h-6 rounded-full bg-slate-800 border-2 border-[#11141d] flex items-center justify-center">
                           <User className="w-3 h-3 text-slate-400" />
                         </div>
                       ))}
                       <div className="w-6 h-6 rounded-full bg-blue-600/20 border-2 border-[#11141d] flex items-center justify-center">
                         <span className="text-[8px] font-bold text-blue-400">+{room.participants - 3}</span>
                       </div>
                     </div>
                     {room.unread && (
                       <div className="bg-blue-600 text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">NEW</div>
                     )}
                   </div>
                 </div>
               ))}
             </div>
 
             {/* Bottom Safe Area */}
             <div className="pb-8 px-6 pt-2">
               <button 
                 onClick={() => navigate('/assignments')}
                 className="w-full py-4 rounded-2xl bg-slate-800 text-slate-400 font-bold text-sm hover:bg-slate-700 transition-colors"
               >
                 전체 히스토리 보기
               </button>
             </div>
           </div>
         </div>
       )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 w-full bg-[#0f111a] border-t border-white/10 px-6 py-3 flex justify-between items-center z-50 pb-safe">
        <div className="flex flex-col items-center space-y-1 text-blue-500 cursor-pointer" onClick={() => navigate('/dashboard')}>
            <Home className="w-6 h-6 fill-current" />
            <span className="text-[10px] font-medium">홈</span>
        </div>
        <div 
          className="flex flex-col items-center space-y-1 text-slate-500 hover:text-white transition-colors cursor-pointer" 
          onClick={() => setShowWarRoomPopup(true)}
        >
            <MessageSquare className="w-6 h-6" />
            <span className="text-[10px] font-medium">War-Room</span>
        </div>
        <div className="flex flex-col items-center space-y-1 text-slate-500 hover:text-white transition-colors cursor-pointer" onClick={() => navigate('/activity')}>
            <BarChart2 className="w-6 h-6" />
            <span className="text-[10px] font-medium">활동</span>
        </div>
        <div className="flex flex-col items-center space-y-1 text-slate-500 hover:text-white transition-colors cursor-pointer" onClick={() => navigate('/search')}>
            <Search className="w-6 h-6" />
            <span className="text-[10px] font-medium">검색</span>
        </div>
        <div 
          className="flex flex-col items-center space-y-1 text-slate-500 hover:text-white transition-colors cursor-pointer"
          onClick={() => setShowMoreMenu(true)}
        >
            <MoreHorizontal className="w-6 h-6" />
            <span className="text-[10px] font-medium">더보기</span>
        </div>
      </nav>

       {/* More Menu Popup */}
       {showMoreMenu && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowMoreMenu(false)} />
          <div className="w-full bg-[#1a1f2e] rounded-t-[40px] border-t border-white/10 shadow-2xl relative z-10 animate-in slide-in-from-bottom duration-500 overflow-hidden">
            <div className="p-8 pb-4">
              <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-8" />
              <h3 className="text-xl font-bold text-white mb-2 text-center">시스템 관리 설정</h3>
              <p className="text-xs text-slate-500 text-center mb-10 uppercase tracking-[4px]">System Operations</p>
              
              <div className="grid grid-cols-2 gap-4">
                <div 
                  onClick={() => {
                    setShowMoreMenu(false);
                    navigate('/keyword-management');
                  }}
                  className="bg-[#11141d] p-6 rounded-3xl border border-white/5 hover:border-blue-500/30 transition-all cursor-pointer group flex flex-col items-center text-center space-y-4"
                >
                  <div className="bg-blue-600/20 p-4 rounded-2xl group-hover:scale-110 transition-transform">
                    <Hash className="w-8 h-8 text-blue-400" />
                  </div>
                  <div>
                    <span className="block font-bold text-slate-200">할당 키워드 관리</span>
                    <span className="text-[10px] text-slate-500 mt-1 block">Critical Alert Keywords</span>
                  </div>
                </div>

                <div 
                  onClick={() => {
                    setShowMoreMenu(false);
                    navigate('/report-line-management');
                  }}
                  className="bg-[#11141d] p-6 rounded-3xl border border-white/5 hover:border-purple-500/30 transition-all cursor-pointer group flex flex-col items-center text-center space-y-4"
                >
                  <div className="bg-purple-600/20 p-4 rounded-2xl group-hover:scale-110 transition-transform">
                    <Users className="w-8 h-8 text-purple-400" />
                  </div>
                  <div>
                    <span className="block font-bold text-slate-200">보고 라인 관리</span>
                    <span className="text-[10px] text-slate-500 mt-1 block">Approval Hierarchy</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-8 pt-4 pb-12">
               <button 
                 onClick={() => setShowMoreMenu(false)}
                 className="w-full py-4 rounded-2xl bg-white/5 text-slate-400 font-bold hover:bg-white/10 transition-colors"
               >
                 닫기
               </button>
             </div>
           </div>
         </div>
       )}

    </div>
  );
}

function MetricCard({ title, value, subValue, trend, trendUp, icon: Icon, color }) {
  const colorClasses = {
    blue: "text-blue-400 bg-blue-500/10",
    purple: "text-purple-400 bg-purple-500/10",
    green: "text-emerald-400 bg-emerald-500/10",
    emerald: "text-emerald-400 bg-emerald-500/10",
    red: "text-red-400 bg-red-500/10",
    yellow: "text-yellow-400 bg-yellow-500/10",
  };

  return (
    <div className="bg-[#1a1f2e] p-5 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
      <div className="flex justify-between items-start mb-2">
        <div className={`p-2 rounded-lg ${colorClasses[color]} mb-2`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${trendUp ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'}`}>
            {trend}
          </span>
        )}
      </div>
      <div>
        <h4 className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">{title}</h4>
        <div className="flex items-baseline space-x-2">
           <span className="text-xl font-bold text-white">{value}</span>
           {subValue && <span className="text-xs text-slate-500">{subValue}</span>}
        </div>
      </div>
    </div>
  );
}

function AlertItem({ title, time, severity, desc }) {
  const sevColor = {
    critical: "bg-red-500",
    warning: "bg-yellow-500",
    info: "bg-blue-500",
    success: "bg-green-500"
  };

  return (
    <div className="flex items-start space-x-4 p-4 rounded-xl bg-slate-900/30 border border-white/5 hover:bg-slate-800/50 transition-colors group cursor-pointer">
      <div className={`w-1.5 h-1.5 mt-2 rounded-full ${sevColor[severity]} shadow-[0_0_8px_rgba(var(--color-primary),0.6)]`}></div>
      <div className="flex-1">
        <div className="flex justify-between items-start mb-1">
          <h4 className="font-bold text-sm text-slate-200 group-hover:text-white transition-colors">{title}</h4>
          <span className="text-xs text-slate-500 whitespace-nowrap ml-2">{time}</span>
        </div>
         <p className="text-xs text-slate-400 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function ProfileModalContent({ profile, onClose, onSave, navigate }) {
  const [tempDept, setTempDept] = useState(profile.dept || '');
  const [tempTeam, setTempTeam] = useState(profile.team || '');

  const handleSave = () => {
    if (!tempDept.trim() || !tempTeam.trim()) {
      alert('소속과 팀 정보는 필수 입력 사항입니다.');
      return;
    }

    onSave({
      ...profile,
      dept: tempDept,
      team: tempTeam
    });
    alert('프로필 정보가 저장되었습니다.');
  };

  const handleLogout = () => {
    if (window.confirm('로그아웃 하시겠습니까?')) {
      localStorage.removeItem('sguard_user');
      navigate('/');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#0f111a]/80 backdrop-blur-sm" onClick={() => {
        if (profile.dept && profile.team) onClose();
      }}></div>
      
      <div className="relative w-full max-w-md bg-gradient-to-b from-[#1a1f2e] to-[#0f111a] border border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-scale-up">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-cyan-400"></div>
        
        <div className="p-8">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-xl font-bold text-white flex items-center space-x-2">
              <User className="w-5 h-5 text-blue-400" />
              <span>회원 정보 관리</span>
            </h2>
            {profile.dept && profile.team && (
              <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            )}
          </div>

          <div className="flex flex-col items-center mb-8">
            <div className="w-24 h-24 rounded-full bg-slate-800 border-4 border-blue-500/20 overflow-hidden mb-4 shadow-xl">
              {profile.picture ? (
                <img src={profile.picture} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="w-12 h-12 text-slate-500" />
                </div>
              )}
            </div>
            <h3 className="text-lg font-bold text-white">{profile.name}</h3>
            <p className="text-xs text-slate-400">{profile.email}</p>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">소속 (Department) *</label>
              <div className="relative group">
                <input 
                  type="text" 
                  value={tempDept}
                  onChange={(e) => setTempDept(e.target.value)}
                  placeholder="예: 보안운영본부"
                  className="w-full bg-[#0f111a] border border-white/10 rounded-xl py-3 pl-4 pr-10 text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-white"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">팀 (Team) *</label>
              <div className="relative group">
                <input 
                  type="text" 
                  value={tempTeam}
                  onChange={(e) => setTempTeam(e.target.value)}
                  placeholder="예: AI관제팀"
                  className="w-full bg-[#0f111a] border border-white/10 rounded-xl py-3 pl-4 pr-10 text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-white"
                />
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col space-y-3">
            <button 
              onClick={handleSave}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-900/40 transition-all transform active:scale-[0.98]"
            >
              저장하기 (Save)
            </button>
            <button 
              onClick={handleLogout}
              className="w-full bg-white/5 hover:bg-red-500/10 text-slate-400 hover:text-red-400 font-medium py-3 rounded-xl transition-all flex items-center justify-center space-x-1"
            >
              <LogIn className="w-4 h-4 rotate-180" />
              <span>Logout</span>
            </button>
          </div>
          
          {(!profile.dept || !profile.team) && (
            <p className="text-[10px] text-yellow-500/70 text-center mt-4">
              * 서비스 이용을 위해 소속과 팀 정보를 먼저 입력해 주세요.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
