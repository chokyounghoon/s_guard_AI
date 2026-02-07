import React, { useState, useEffect, useRef } from 'react';
import { Bell, User, Monitor, RefreshCw, CheckCircle, ClipboardList, MessageSquare, Search, MoreHorizontal, Home, Zap, Shield, CheckSquare, BarChart2, Settings, AlertTriangle, Info, AlertCircle, ChevronRight, X, Sparkles, Server, Brain, Calendar, Hash, Users, LogIn } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AiInsightPanel from '../components/AiInsightPanel';
import ErrorBoundary from '../components/ErrorBoundary';
import AIInsightModal from '../components/AIInsightModal';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [smsMessages, setSmsMessages] = useState([]);
  const [recentAssignments, setRecentAssignments] = useState([]);
  const [dismissedIds, setDismissedIds] = useState([]);
  const [totalAssignedCount, setTotalAssignedCount] = useState(0);
  const [showWarRoomPopup, setShowWarRoomPopup] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('week'); // 'today', 'week', 'month', 'custom'
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedInsight, setSelectedInsight] = useState(null);
  const [allNotifications, setAllNotifications] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const dismissedIdsRef = useRef([]);

  // 초기 로드 시 localStorage에서 데이터 불러오기
  useEffect(() => {
    // 유저 정보 로드
    const savedUser = localStorage.getItem('sguard_user');
    if (savedUser) {
      try {
        const profile = JSON.parse(savedUser);
        setUserProfile(profile);
        
        // 소속이나 팀 정보가 없으면 모달 강제 표시 (온보딩)
        if (!profile.dept || !profile.team) {
          setShowProfileModal(true);
        }
      } catch (e) {
        console.error('유저 정보 로드 실패:', e);
      }
    } else {
      // 정보가 아예 없으면 기본 모달 표시 (게스트 포함)
      setShowProfileModal(true);
    }
    // 할당 내역 로드
    const savedAssignments = localStorage.getItem('sguard_assignments');
    if (savedAssignments) {
      try {
        setRecentAssignments(JSON.parse(savedAssignments));
      } catch (e) {
        console.error('할당 내역 로드 실패:', e);
      }
    }

    // 닫은 메시지 ID 로드
    const savedDismissed = localStorage.getItem('sguard_dismissed_ids');
    if (savedDismissed) {
      try {
        const ids = JSON.parse(savedDismissed);
        setDismissedIds(ids);
        dismissedIdsRef.current = ids;
      } catch (e) {
        console.error('닫은 메시지 로드 실패:', e);
      }
    }

    // 총 할당 건수 로드
    const savedCount = localStorage.getItem('sguard_total_count');
    if (savedCount) {
      setTotalAssignedCount(parseInt(savedCount));
    } else {
      setTotalAssignedCount(5); 
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
        const messages = data.messages || [];
        
        // 닫지 않은 메시지만 필터링하여 상단 알림에 표시
        const filteredMessages = messages.filter(msg => !dismissedIdsRef.current.includes(msg.id));
        setSmsMessages(filteredMessages);
        
        // SMS를 할당 리스트에 추가 (할당 리스트는 닫기 여부와 상관없이 누적)
        if (messages.length > 0) {
          addToAssignments(messages);
          
          // 알림 목록에도 추가 (새로 들어온 것만 중복 체크 후)
          setAllNotifications(prev => {
            const existingIds = new Set(prev.filter(n => n.type === 'SMS').map(n => n.id));
            const newSms = messages
              .filter(m => !existingIds.has(m.id))
              .map(m => ({
                id: m.id,
                type: 'SMS',
                title: '새로운 SMS 알림',
                content: m.message,
                time: new Date(m.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
                timestamp: m.timestamp,
                severity: m.keyword_detected ? 'CRITICAL' : 'NORMAL',
                isRead: false
              }));
            
            if (newSms.length > 0) {
              setUnreadCount(curr => curr + newSms.length);
              return [...newSms, ...prev].slice(0, 50);
            }
            return prev;
          });
        }
      }
    } catch (error) {
      console.error('SMS 메시지 로드 실패:', error);
    }
  };

  const addToAssignments = (messages) => {
    setRecentAssignments(prev => {
      const existingIds = new Set(prev.map(a => a.smsId));
      const newItems = messages
        .filter(msg => !existingIds.has(msg.id))
        .map(msg => ({
          smsId: msg.id,
          id: `sms-${msg.id}-${Date.now()}`,
          severity: msg.keyword_detected ? 'CRITICAL' : 'MEDIUM',
          code: `SMS${String(msg.id).padStart(5, '0')}`,
          time: new Date(msg.timestamp).toLocaleTimeString('ko-KR', { 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit'
          }),
          title: msg.message,
          sender: msg.sender,
          timestamp: msg.timestamp,
          assignmentType: 'SMS',
          bgColor: msg.keyword_detected ? 'bg-red-900/10' : 'bg-blue-900/10',
          borderColor: msg.keyword_detected ? 'border-red-500/20' : 'border-blue-500/20'
        }));
      
      if (newItems.length > 0) {
        const updated = [...newItems, ...prev].slice(0, 10);
        localStorage.setItem('sguard_assignments', JSON.stringify(updated));
        
        // 총 할당 건수 업데이트
        setTotalAssignedCount(current => {
          const newCount = current + newItems.length;
          localStorage.setItem('sguard_total_count', newCount.toString());
          return newCount;
        });
        
        return updated;
      }
      return prev;
    });
  };

  const dismissMessage = (id) => {
    setSmsMessages(prev => prev.filter(msg => msg.id !== id));
    
    // 닫은 메시지 ID를 저장
    const updated = [...dismissedIdsRef.current, id];
    dismissedIdsRef.current = updated;
    setDismissedIds(updated);
    localStorage.setItem('sguard_dismissed_ids', JSON.stringify(updated));
  };

  console.log('DashboardPage Rendering...', { smsMessages, recentAssignments, currentDismissed: dismissedIdsRef.current });


  const [predictionLogs, setPredictionLogs] = useState({
    critical: [],
    server: [],
    security: [],
    report: []
  });

  const [predictionStats, setPredictionStats] = useState({
    critical: 0,
    server: 0,
    security: 0,
    report: 0
  });

  const [selectedCategory, setSelectedCategory] = useState(null);

  const handleLogReceived = (log) => {
    if (!log || !log.category) return;

    setPredictionStats(prev => ({
        ...prev,
        [log.category]: prev[log.category] + 1
    }));

    setPredictionLogs(prev => ({
        ...prev,
        [log.category]: [log, ...prev[log.category]].slice(0, 50) // Keep last 50
    }));

    // 알림 목록에 추가
    setAllNotifications(prev => {
      const newNotif = {
        id: `ai-${Date.now()}`,
        type: 'AI',
        title: `AI 예측: ${log.category.toUpperCase()}`,
        content: log.text,
        time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        timestamp: Date.now(),
        severity: log.severity === 'critical' ? 'CRITICAL' : 'INFO',
        isRead: false
      };
      setUnreadCount(curr => curr + 1);
      return [newNotif, ...prev].slice(0, 50);
    });
  };

  // Mock AI Insights Data for each prediction category
  const aiInsights = {
    critical: {
      predictionId: "PRED-2024-001",
      category: "장애",
      severity: "high",
      aiReasoning: "평소 화요일 오전 08:00~09:00 CPU 사용률은 45% 수준이나, 현재 92%로 급증하였습니다. 배치 프로세스(batch_processor_v2)의 무한 루프가 의심되며, 메모리 누수(Memory Leak) 패턴도 함께 감지되었습니다. 과거 유사 사례 분석 결과, 이러한 패턴은 평균 15분 이내에 서비스 중단으로 이어질 확률이 높습니다.",
      relatedMetrics: {
        cpu: 92,
        memory: 78,
        diskIO: 65
      },
      recommendedActions: [
        "배치 프로세스 즉시 재시작 (service restart batch_processor_v2)",
        "로그 파일 확인하여 루프 원인 파악 (/var/log/batch_errors.log)",
        "메모리 덤프 생성 후 누수 지점 분석",
        "임시 조치: 프로세스 타임아웃 설정 강화 (timeout 300s → 120s)"
      ],
      confidence: 95,
      similarCases: 37
    },
    server: {
      predictionId: "PRED-2024-002",
      category: "성능",
      severity: "medium",
      aiReasoning: "웹 서버(nginx) 응답 시간이 평소 150ms에서 950ms로 증가했습니다. DB Connection Pool 사용률이 85%에 도달하여 병목 현상이 발생 중입니다. 트래픽 패턴 분석 결과, 특정 API 엔드포인트(/api/v2/analytics)의 요청이 급증하고 있으며, 해당 쿼리의 인덱스 누락이 원인으로 추정됩니다.",
      relatedMetrics: {
        cpu: 68,
        memory: 72,
        diskIO: 58
      },
      recommendedActions: [
        "DB Connection Pool 크기 임시 증설 (200 → 400)",
        "문제 API 엔드포인트에 Rate Limiting 적용",
        "느린 쿼리 로그 확인 및 인덱스 추가 검토",
        "캐싱 레이어 추가 고려 (Redis)"
      ],
      confidence: 88,
      similarCases: 52
    },
    security: {
      predictionId: "PRED-2024-003",
      category: "보안",
      severity: "high",
      aiReasoning: "최근 1시간 동안 동일 IP 대역(203.142.*.*)에서 로그인 실패 시도가 347건 감지되었습니다. Brute Force Attack 패턴으로 판단되며, 공격 대상 계정은 관리자 권한 계정(admin, root, sysadmin)입니다. 현재 방화벽 룰이 이 패턴을 차단하지 못하고 있어 즉각 조치가 필요합니다.",
      relatedMetrics: {
        cpu: 45,
        memory: 52,
        diskIO: 38
      },
      recommendedActions: [
        "해당 IP 대역 즉시 차단 (iptables -A INPUT -s 203.142.0.0/16 -j DROP)",
        "계정 잠금 정책 강화 (5회 실패 시 30분 잠금)",
        "MFA(Multi-Factor Authentication) 강제 적용 검토",
        "보안 팀에 긴급 알림 전송"
      ],
      confidence: 97,
      similarCases: 23
    },
    report: {
      predictionId: "PRED-2024-004",
      category: "성능",
      severity: "low",
      aiReasoning: "지난 7일간의 시스템 메트릭을 분석한 결과, 야간 시간대(02:00~04:00) 디스크 I/O가 평소 대비 30% 증가하는 트렌드가 발견되었습니다. 백업 프로세스와 배치 작업이 겹치면서 발생하는 것으로 보이며, 현재는 서비스에 영향이 없으나 트래픽 증가 시 병목 가능성이 있습니다.",
      relatedMetrics: {
        cpu: 32,
        memory: 48,
        diskIO: 71
      },
      recommendedActions: [
        "백업 스케줄 조정 (02:00 → 01:00)",
        "배치 작업 우선순위 재조정",
        "SSD로 스토리지 업그레이드 검토",
        "모니터링 알림 임계값 설정 (Disk I/O > 80%)"
      ],
      confidence: 82,
      similarCases: 61
    }
  };

  const statusCards = [
    { 
        id: 'critical', 
        label: 'Critical Error 예측됨', 
        val: predictionStats.critical, 
        icon: AlertTriangle, 
        color: 'bg-red-900/50', 
        text: 'text-red-400', 
        bar: 'bg-red-500',
        borderColor: 'border-red-500/30'
    },
    { 
        id: 'server', 
        label: '서버오류 예측됨', 
        val: predictionStats.server, 
        icon: Server, 
        color: 'bg-orange-900/50', 
        text: 'text-orange-400', 
        bar: 'bg-orange-500',
        borderColor: 'border-orange-500/30'
    },
    { 
        id: 'security', 
        label: '보안이슈 감지', 
        val: predictionStats.security, 
        icon: Shield, 
        color: 'bg-blue-900/50', 
        text: 'text-blue-400', 
        bar: 'bg-blue-500',
        borderColor: 'border-blue-500/30'
    },
    { 
        id: 'report', 
        label: '예측 분석 레포트', 
        val: predictionStats.report, 
        icon: ClipboardList, 
        color: 'bg-purple-900/50', 
        text: 'text-purple-400', 
        bar: 'bg-purple-500',
        borderColor: 'border-purple-500/30'
    },
  ];

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
    <div className="min-h-screen bg-[#0a0e17] text-white font-sans pb-24 relative overflow-x-hidden">
        
       {/* Background Glows */}
       <div className="fixed top-0 left-0 w-full h-96 bg-blue-900/5 blur-[100px] -z-10 pointer-events-none" />

       {/* Detail Modal */}
       {selectedCategory && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setSelectedCategory(null)}>
            <div className="bg-[#1a1f2e] w-full max-w-2xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden animate-scale-up" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b border-white/10 flex justify-between items-center bg-[#11141d]">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        {statusCards.find(c => c.id === selectedCategory)?.icon && 
                            React.createElement(statusCards.find(c => c.id === selectedCategory).icon, { className: `w-5 h-5 ${statusCards.find(c => c.id === selectedCategory).text}` })}
                        {statusCards.find(c => c.id === selectedCategory)?.label}
                         - 상세 목록
                    </h3>
                    <button onClick={() => setSelectedCategory(null)} className="p-1 rounded-full hover:bg-white/10">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>
                <div className="p-0 max-h-[60vh] overflow-y-auto">
                    {predictionLogs[selectedCategory].length > 0 ? (
                        <div className="divide-y divide-white/5">
                            {predictionLogs[selectedCategory].map((log, idx) => (
                                <div key={idx} className="p-4 hover:bg-white/5 cursor-pointer transition-colors" onClick={() => navigate('/assignment-detail')}>
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                                                log.severity === 'critical' ? 'bg-red-500/20 text-red-500 border-red-500/30' :
                                                log.severity === 'high' ? 'bg-orange-500/20 text-orange-500 border-orange-500/30' :
                                                log.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30' :
                                                'bg-blue-500/20 text-blue-500 border-blue-500/30'
                                            }`}>
                                                {log.severity.toUpperCase()}
                                            </span>
                                            <span className="text-xs text-slate-500 font-mono">{log.id || 'N/A'}</span>
                                        </div>
                                        <span className="text-[10px] text-slate-500">Just now</span>
                                    </div>
                                    <p className="text-sm font-bold text-slate-200 mb-1">{log.text}</p>
                                    <p className="text-xs text-slate-400">{log.detail || '상세 내용 없음'}</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-10 text-center text-slate-500">
                            <Info className="w-10 h-10 mx-auto mb-3 opacity-50" />
                            <p>아직 수집된 로그가 없습니다.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
       )}

      {/* Header */}
      <header className="flex justify-between items-center p-5 sticky top-0 bg-[#0f111a]/90 backdrop-blur-md z-50 border-b border-white/5">
        <div className="flex items-center space-x-2">
            <div className="bg-blue-600 p-1.5 rounded-lg shadow-lg shadow-blue-900/50">
                <Shield className="w-4 h-4 text-white fill-current" />
            </div>
            <span className="font-bold text-lg tracking-wide">S-Guard AI</span>
        </div>
        <div className="flex items-center space-x-4">
            <div 
              className="relative p-1 hover:bg-white/10 rounded-full cursor-pointer transition-colors"
              onClick={() => {
                setShowNotifications(!showNotifications);
                setUnreadCount(0);
                setAllNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
              }}
            >
                <Bell className={`w-6 h-6 ${unreadCount > 0 ? 'text-blue-400 animate-bounce-subtle' : 'text-slate-400'}`} />
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-[9px] font-bold flex items-center justify-center rounded-full border-2 border-[#0f111a] text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
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
      </header>

      {/* SMS 알림 영역 */}
      {smsMessages.length > 0 && (
        <div className="px-5 pt-4 space-y-3">
          {smsMessages.map((msg) => (
            <div
              key={msg.id}
              className="bg-gradient-to-r from-blue-600 to-blue-500 rounded-2xl p-4 shadow-xl shadow-blue-900/50 border border-blue-400/30 animate-slide-down"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3 flex-1">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                    {msg.keyword_detected ? (
                      <AlertCircle className="w-6 h-6 text-yellow-300" />
                    ) : (
                      <Info className="w-6 h-6 text-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="font-bold text-white text-sm">SMS 수신</h3>
                      {msg.keyword_detected && (
                        <span className="bg-yellow-400 text-yellow-900 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          키워드 감지
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-blue-100 mb-1">
                      발신: {msg.sender}
                    </p>
                    <p className="text-sm text-white font-medium leading-snug">
                      {msg.message}
                    </p>
                    {msg.response_message && (
                      <div className="mt-2 bg-white/10 rounded-lg p-2 border border-white/20">
                        <p className="text-xs text-blue-100 flex items-center space-x-1">
                          <CheckCircle className="w-3 h-3" />
                          {(() => {
                            if (msg.response_message.includes('AI 분석을 시작합니다.')) {
                              const parts = msg.response_message.split('AI 분석을 시작합니다.');
                              return (
                                <span>
                                  자동 응답: {parts[0]}
                                  <span 
                                    onClick={(e) => { e.stopPropagation(); navigate('/assignments'); }}
                                    className="underline decoration-blue-400/50 underline-offset-4 cursor-pointer font-bold text-blue-300 hover:text-white transition-colors animate-pulse"
                                  >
                                    장애등록및 War-Room 생성이 완료 되었습니다.
                                  </span>
                                  {parts[1]}
                                </span>
                              );
                            } else if (msg.response_message.includes('War-Room')) {
                              const parts = msg.response_message.split('War-Room');
                              return (
                                <span>
                                  자동 응답: {parts[0]}
                                  <span 
                                    onClick={(e) => { e.stopPropagation(); navigate('/chat'); }}
                                    className="underline decoration-blue-400/50 underline-offset-4 cursor-pointer font-bold text-blue-300 hover:text-white transition-colors animate-pulse"
                                  >
                                    War-Room
                                  </span>
                                  {parts[1]}
                                </span>
                              );
                            } else {
                              return <span>자동 응답: {msg.response_message}</span>;
                            }
                          })()}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => dismissMessage(msg.id)}
                  className="ml-2 p-1 rounded-full hover:bg-white/20 transition-colors shrink-0"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
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

      <main className="p-5 space-y-5">
        
        {/* NEW: AI Autopilot Insight Panel */}
        <React.Suspense fallback={<div className="h-48 bg-gray-900 rounded-3xl animate-pulse"></div>}>
            <ErrorBoundary>
                <AiInsightPanel onLogReceived={handleLogReceived} />
            </ErrorBoundary>
        </React.Suspense>

        {/* Section 1: Autopilot Prediction Status (Redesigned) - Moved to Top */}
        <div className="bg-[#1a1f2e] rounded-3xl p-6 border border-white/5 shadow-xl">
            <div className="flex justify-between items-center mb-4">
                <h2 className="font-bold text-lg flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-blue-400" />
                    Autopilot 예측현황
                </h2>
                <div className="flex items-center space-x-2">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">REALTIME</span>
                </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
                {statusCards.map((stat, idx) => (
                    <div 
                        key={idx} 
                        onClick={() => setSelectedInsight(aiInsights[stat.id])}
                        className={`
                            bg-[#11141d] rounded-2xl p-3 flex flex-col items-center justify-between h-36 relative overflow-hidden 
                            border border-white/5 group hover:border-blue-500/40 transition-all cursor-pointer hover:scale-[1.02] active:scale-95
                        `}
                    >
                        <span className="text-[10px] text-slate-400 mb-2 font-medium text-center leading-tight">{stat.label}</span>
                        <div className={`p-2.5 rounded-full ${stat.color} mb-1 group-hover:scale-110 transition-transform ${stat.borderColor} border`}>
                            <stat.icon className={`w-5 h-5 ${stat.text}`} />
                        </div>
                        <span className={`text-2xl font-bold ${stat.text}`}>{stat.val}</span>
                        <div className={`absolute bottom-0 left-0 w-full h-[3px] ${stat.bar}`} />
                        
                        {/* Glow Effect */}
                        <div className={`absolute -bottom-10 -right-10 w-24 h-24 ${stat.bar} opacity-10 blur-2xl rounded-full`} />
                    </div>
                ))}
            </div>
        </div>
        
        {/* Section 2: My AI / SMS Request Status (Bar Charts) */}
        <div className="bg-[#1a1f2e] rounded-3xl p-6 border border-white/5 shadow-xl relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <h2 className="font-bold text-lg">나의 AI / SMS 확인요청 현황</h2>
                
                <div className="flex flex-col items-end space-y-3">
                  {/* Period Selection (Radio-style buttons) */}
                  <div className="flex bg-[#11141d] p-1 rounded-xl border border-white/5 overflow-hidden">
                      {[
                          { id: 'today', label: '오늘' },
                          { id: 'week', label: '이번주' },
                          { id: 'month', label: '이번달' },
                          { id: 'custom', label: '일자지정' },
                      ].map((period) => (
                          <button
                              key={period.id}
                              onClick={() => setSelectedPeriod(period.id)}
                              className={`
                                  px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all
                                  ${selectedPeriod === period.id 
                                      ? 'bg-blue-600 text-white shadow-lg' 
                                      : 'text-slate-500 hover:text-slate-300'}
                              `}
                          >
                              {period.label}
                          </button>
                      ))}
                  </div>

                  {/* Custom Date Inputs (Visible only if 'custom' is selected) */}
                  {selectedPeriod === 'custom' && (
                      <div className="flex items-center space-x-2 animate-in fade-in slide-in-from-right-2 duration-300">
                          <div className="relative">
                            <input 
                                type="date" 
                                value={dateRange.from}
                                onChange={(e) => setDateRange({...dateRange, from: e.target.value})}
                                className="bg-[#11141d] border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
                            />
                          </div>
                          <span className="text-slate-500 text-[10px]">~</span>
                          <div className="relative">
                            <input 
                                type="date" 
                                value={dateRange.to}
                                onChange={(e) => setDateRange({...dateRange, to: e.target.value})}
                                className="bg-[#11141d] border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
                            />
                          </div>
                      </div>
                  )}
                </div>
            </div>
            
            <div className="grid grid-cols-2 gap-8">
                {/* AI Request Column */}
                <div>
                     <div className="flex items-center space-x-2 mb-4">
                        <Brain className="w-4 h-4 text-blue-400" />
                        <h3 className="text-sm font-bold text-slate-300">AI Request</h3>
                     </div>
                     <div className="space-y-3">
                        {/* Critical (0) - Red */}
                        <div>
                            <div className="flex justify-between text-[10px] mb-1">
                                <span className="text-slate-400">Critical</span>
                                <span className="text-red-400 font-bold">0</span>
                            </div>
                            <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
                                <div className="h-full bg-red-500 w-0" />
                            </div>
                        </div>
                        {/* Major (1) - Orange */}
                        <div>
                            <div className="flex justify-between text-[10px] mb-1">
                                <span className="text-slate-400">Major</span>
                                <span 
                                  onClick={() => navigate('/incident-list?type=AI&category=Major')}
                                  className="text-orange-400 font-bold underline cursor-pointer hover:text-orange-300 transition-colors"
                                >
                                  1
                                </span>
                            </div>
                            <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
                                <div className="h-full bg-orange-500 w-[15%]" />
                            </div>
                        </div>
                        {/* Normal (24) - Emerald */}
                        <div>
                            <div className="flex justify-between text-[10px] mb-1">
                                <span className="text-slate-400">Normal</span>
                                <span 
                                  onClick={() => navigate('/incident-list?type=AI&category=Normal')}
                                  className="text-emerald-400 font-bold underline cursor-pointer hover:text-emerald-300 transition-colors"
                                >
                                  24
                                </span>
                            </div>
                            <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 w-[60%]" />
                            </div>
                        </div>
                     </div>
                </div>

                {/* SMS Request Column */}
                <div>
                    <div className="flex items-center space-x-2 mb-4">
                        <MessageSquare className="w-4 h-4 text-purple-400" />
                        <h3 className="text-sm font-bold text-slate-300">SMS Request</h3>
                     </div>
                     <div className="space-y-3">
                        {/* Unconfirmed (12) - Red */}
                        <div>
                            <div className="flex justify-between text-[10px] mb-1">
                                <span className="text-slate-400">미확인</span>
                                <span 
                                  onClick={() => navigate('/incident-list?type=SMS&category=Unconfirmed')}
                                  className="text-red-400 font-bold underline cursor-pointer hover:text-red-300 transition-colors"
                                >
                                  12
                                </span>
                            </div>
                            <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
                                <div className="h-full bg-red-500 w-[45%]" />
                            </div>
                        </div>
                        {/* Processing (8) - Orange */}
                        <div>
                            <div className="flex justify-between text-[10px] mb-1">
                                <span className="text-slate-400">처리중</span>
                                <span 
                                  onClick={() => navigate('/incident-list?type=SMS&category=Processing')}
                                  className="text-orange-400 font-bold underline cursor-pointer hover:text-orange-300 transition-colors"
                                >
                                  8
                                </span>
                            </div>
                            <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
                                <div className="h-full bg-orange-500 w-[20%]" />
                            </div>
                        </div>
                        {/* Completed (156) - Blue */}
                        <div>
                            <div className="flex justify-between text-[10px] mb-1">
                                <span className="text-slate-400">확인 완료</span>
                                <span 
                                  onClick={() => navigate('/incident-list?type=SMS&category=Completed')}
                                  className="text-blue-400 font-bold underline cursor-pointer hover:text-blue-300 transition-colors"
                                >
                                  156
                                </span>
                            </div>
                            <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 w-full" />
                            </div>
                        </div>
                     </div>
                </div>
            </div>
        </div>

         {/* Section 3: My Confirmation History & Recent List */}
         <div className="bg-[#1a1f2e] rounded-3xl p-6 border border-white/5 shadow-xl">
            <div className="flex justify-between items-center mb-5">
                 <div className="flex items-center space-x-2">
                    <User className="w-5 h-5 text-blue-500" />
                    <h2 className="font-bold text-lg">나의 확인 내역</h2>
                 </div>
                <span className="text-[10px] text-slate-400">실시간 업데이트</span>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-4 gap-4 mb-6">
                {/* Total */}
                <div 
                    onClick={() => navigate('/assignments')}
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
                    onClick={() => navigate('/assignments')}
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
                    onClick={() => navigate('/assignments')}
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
                    onClick={() => navigate('/assignments')}
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

        {/* Section 4: Overall Status Banner */}
        <div 
          onClick={() => navigate('/overall-status')}
          className="bg-gradient-to-r from-blue-600 to-blue-500 rounded-3xl p-5 shadow-xl shadow-blue-900/30 border border-blue-400/30 relative overflow-hidden cursor-pointer group hover:scale-[1.02] transition-all active:scale-[0.98]"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-2xl rounded-full -mr-10 -mt-10" />
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center space-x-4">
              <div className="bg-white/20 p-2.5 rounded-2xl">
                <BarChart2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-base text-white">전체 시스템 현황</h2>
                <p className="text-xs text-blue-100 mt-0.5">주요 시스템의 트랜잭션 및 장애 처리 상태를 실시간으로 모니터링합니다.</p>
              </div>
            </div>
            <button className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl text-xs font-bold text-white transition-colors">
              확인
            </button>
          </div>
        </div>

      </main>


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

       {renderProfileModal()}
       <AIInsightModal insight={selectedInsight} onClose={() => setSelectedInsight(null)} />
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
