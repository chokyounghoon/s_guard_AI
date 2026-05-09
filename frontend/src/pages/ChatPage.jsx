import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Phone, Menu, Plus, Send, Home, MessageSquare, BarChart, BarChart2, Settings, Info, AlertTriangle, ChevronDown, ChevronUp, Users, LogOut, FileText, UserPlus, Bot, Sparkles, Zap, X, Database, Paperclip, Image as ImgIcon, Shield, Server, User, Terminal, CheckCircle, CheckCircle2, Smile, Hash, Network, Megaphone, Star, UserX, Search, ChevronRight } from 'lucide-react';
import AIChatBubble from '../components/AIChatBubble';
import AIThinkingIndicator from '../components/AIThinkingIndicator';
import { getAccessToken, getAuthHeaders } from '../lib/authStore';
import ServerStatusChart from '../components/chat/ServerStatusChart';
import MarkdownViewer from '../components/MarkdownViewer';

const agentColors = {
  Security: { bg: 'bg-red-500/15', border: 'border-red-500/30', text: 'text-red-400', icon: Shield },
  DB:       { bg: 'bg-purple-500/15', border: 'border-purple-500/30', text: 'text-purple-400', icon: Database },
  DevOps:   { bg: 'bg-green-500/15', border: 'border-green-500/30', text: 'text-green-400', icon: Server },
  Leader:   { bg: 'bg-amber-500/15', border: 'border-amber-500/30', text: 'text-amber-400', icon: Bot },
};

// API URL helper: /ai/ endpoints go to local FastAPI, others to Cloudflare Worker
// API URL helper: /ai/ endpoints go to local FastAPI (if dev), others to Cloudflare Worker
const getApiUrl = (endpoint, isWs = false) => {
  // 🚀 WebSocket connections should ALWAYS go directly to the Cloudflare Worker
  // because the Durable Object state and real-time logic are hosted there.
  if (isWs) {
    const workerWsBase = 'wss://sguardai.khcho0421.workers.dev';
    return `${workerWsBase}${endpoint}`;
  }

  const useLocalApi = false; 
  if (useLocalApi) {
    return `http://127.0.0.1:8000${endpoint}`;
  }

  // 🚀 AI 스트리밍 성능 최적화: Vite Proxy를 거치지 않고 Worker로 직접 호출합니다.
  let baseHost = 'sguardai.khcho0421.workers.dev';
  return `https://${baseHost}${endpoint}`;
};

// 한국 시간(KST) 포맷팅 헬퍼
const formatKst = (dateInput) => {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return dateInput;

  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');

  return `${hh}:${min}:${ss}`;
};

export default function ChatPage() {
  const navigate = useNavigate();
  const [isLogExpanded, setIsLogExpanded] = useState(true);
  const [showPhoneList, setShowPhoneList] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showFullAnalysis, setShowFullAnalysis] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [roomTitle, setRoomTitle] = useState('');
  const [roomDescription, setRoomDescription] = useState('');
  const [roomStatus, setRoomStatus] = useState('Open');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]); // Array of { name, url, type, file }
  const [showAgentInsights, setShowAgentInsights] = useState(true);
  const [showAnalysisSummary, setShowAnalysisSummary] = useState(false);
  const [showWipToast, setShowWipToast] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [participants, setParticipants] = useState([]);
  const [showParticipantDropdown, setShowParticipantDropdown] = useState(false);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);
  const longPressTimer = useRef(null);
  const markedReadSeqs = useRef(new Set()); // ✅ 이미 MARK_READ 보낸 seq 추적
  const [longPressMsg, setLongPressMsg] = useState(null); // 길게 누른 메시지
  const [showAiPanel, setShowAiPanel] = useState(false);  // AI Summary 패널 (헤더 버튼)
  const [summaryLockOwner, setSummaryLockOwner] = useState(null);

  const isResolved = ['CLOSED', '최종완료', '처리완료', 'Completed', '완료'].includes(roomStatus);


  // Main Chat State
  const [mainMessages, setMainMessages] = useState([]);
  const [mainInput, setMainInput] = useState('');
  const { incidentId: paramId } = useParams();
  const incidentId = paramId || 'INC-8823';
  const [activityLogs, setActivityLogs] = useState([]);
  const [analysisSummary, setAnalysisSummary] = useState('');
  
  const [currentUser, setCurrentUser] = useState({ 
    employee_id: 'EMP-1234', // Local mock ID for initial state
    name: '이수민 매니저', 
    role: 'Manager' 
  });
  const [assignees, setAssignees] = useState([]);


  useEffect(() => {
    const userStr = localStorage.getItem('sguard_user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setCurrentUser({
          employee_id: user.employee_id || user.id || 'EMP-1234',
          name: user.name || '이수민 매니저',
          role: user.role || 'Manager',
          org_code: user.org_code || user.team_code || user.honbu_code || null,
          team_name: user.team_name || user.team || user.honbu || ''
        });
      } catch (e) { console.error("User parse error", e); }
    }
  }, []);

  // 🚀 AI Summary Lock Polling
  useEffect(() => {
    if (!incidentId) return;
    const checkLock = async () => {
      try {
        const res = await fetch(getApiUrl(`/ai/summarize/lock/${incidentId}`), {
          headers: getAuthHeaders()
        });
        if (res.ok) {
          const data = await res.json();
          setSummaryLockOwner(data.locked ? data.owner : null);
        }
      } catch (e) {}
    };
    checkLock();
    const timer = setInterval(checkLock, 5000);
    return () => clearInterval(timer);
  }, [incidentId]);



  // Load chat history (reusable for polling)
  const fetchChatHistory = React.useCallback(async (isAutoPoll = false) => {
    if (!isAutoPoll) setIsLoading(true);
    const normId = String(incidentId).replace('INC-', '');
    try {
      const res = await fetch(getApiUrl(`/warroom/chat/${normId}`), {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setRoomTitle(data.title || incidentId);
        setRoomDescription(data.sms_body || data.description || '');  // 원본 SMS 우선
        setRoomStatus(data.status || 'Open');
        
        const loadedMessages = data.messages.map(msg => {
          const displayName = msg.sender_name || msg.name || msg.sender;
          return {
            id: msg.inc_id || `${msg.incident_id}_${msg.seq}`,
            seq: msg.seq,
            type: msg.type === 'me'
                   || msg.sender === currentUser.employee_id
                   || msg.sender === currentUser.name
                   || msg.sender_name === currentUser.name
                 ? 'me'
                 : (msg.type === 'system' ? 'system'
                 : (msg.type === 'ai_analysis' ? 'ai_analysis' : 'other')),
            sender: displayName,
            sender_id: msg.sender,
            role: msg.role,
            initials: displayName ? displayName[0] : 'SY',
          color: msg.type === 'ai_analysis' ? 'bg-purple-600' : 'bg-slate-700',
          text: msg.text,
          time: formatKst(msg.timestamp),
          timestamp: msg.timestamp,
          read_count: msg.read_count || 0,
          reactions: (() => {
            if (typeof msg.reactions === 'object' && msg.reactions !== null) return msg.reactions;
            try { return JSON.parse(msg.reactions || '{}'); } catch (e) { return {}; }
          })(),
          parent_seq: msg.parent_seq,
          is_key_event: !!msg.is_key_event,
            icon: msg.type === 'system' ? Info : (msg.type === 'ai_analysis' ? Sparkles : null)
          };
        });

        setMainMessages(prev => {
          // Only update state if data actually changed to avoid unnecessary re-renders
          const isSame = prev.length === loadedMessages.length && 
                         prev.every((msg, idx) => msg.id === loadedMessages[idx].id && msg.text === loadedMessages[idx].text);
          if (isSame) return prev;
          return loadedMessages;
        });
        
        if (data.leader_summary) {
          setAiAnalysisMessage({ type: 'ai_analysis', text: data.leader_summary });
        } else {
          const analysis = loadedMessages.find(m => m.type === 'ai_analysis');
          if (analysis) setAiAnalysisMessage(analysis);
        }
      }
    } catch (err) {
      console.error("Failed to fetch chat history", err);
    } finally {
      if (!isAutoPoll) {
        setIsLoading(false);
      }
    }
  }, [incidentId, currentUser.employee_id, currentUser.name]);

  const fetchWorkflowDetails = React.useCallback(async () => {
    try {
      const flowUrl = getApiUrl(`/ai/incident/workflow-details?inc_id=${incidentId}`);
      const res = await fetch(flowUrl, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setAssignees(data.assignees || []);
      }
    } catch (err) {
      console.error("Failed to fetch workflow details", err);
    }
  }, [incidentId]);

  useEffect(() => {
    fetchWorkflowDetails();
    // Refresh workflow details every 30 seconds
    const timer = setInterval(fetchWorkflowDetails, 30000);
    return () => clearInterval(timer);
  }, [fetchWorkflowDetails]);

  const fetchParticipants = React.useCallback(async () => {
    const normId = String(incidentId).replace('INC-', '');
    try {
      const res = await fetch(getApiUrl(`/warroom/participants/${normId}`), {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setParticipants(data.participants || []);
      }
    } catch (e) {
      console.error('Failed to fetch participants', e);
    }
  }, [incidentId]);

  const fetchActivityLogs = React.useCallback(async () => {
    const normId = String(incidentId).replace('INC-', '');
    try {
      const res = await fetch(getApiUrl(`/activity-logs?inc_id=${normId}`), {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setActivityLogs(data.logs || []);
      }
    } catch (e) {
      console.error('Failed to fetch activity logs', e);
    }
  }, [incidentId]);

  const [aiAnalysisMessage, setAiAnalysisMessage] = useState(null);

  const fetchAnalysisSummary = React.useCallback(async () => {
    try {
      const normId = incidentId.replace('INC-', '');
      // /warroom/report/:id 가 autopilot_insight, leader_summary 등을 반환
      const res = await fetch(getApiUrl(`/warroom/report/${normId}`), {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        const content = data.leader_summary || data.autopilot_insight || data.ai_analysis || '';
        setAnalysisSummary(content);
        // aiAnalysisMessage 도 함께 세팅
        if (content && !aiAnalysisMessage) {
          setAiAnalysisMessage({ type: 'ai_analysis', text: content });
        }
      }
    } catch (e) {
      console.error('Failed to fetch analysis summary', e);
    }
  }, [incidentId]);


  // Real-time State (DO/WS)
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [remoteTyping, setRemoteTyping] = useState({}); // { user_id: { name, is_typing } }
  const [replyTo, setReplyTo] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDMModal, setShowDMModal] = useState(false);
  const [dmTargetUser, setDmTargetUser] = useState(null);
  const [dmHistory, setDmHistory] = useState([]);
  const [dmInput, setDmInput] = useState('');
  const [activeReactionMsg, setActiveReactionMsg] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [showFullDesc, setShowFullDesc] = useState(false);
  const descPressTimer = React.useRef(null);
  
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [orgTree, setOrgTree] = useState([]);
  const [selectedOrgId, setSelectedOrgId] = useState(null);
  const [inviteSearchQuery, setInviteSearchQuery] = useState('');
  const [inviteSearchResults, setInviteSearchResults] = useState([]);
  const [isInviting, setIsInviting] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  
  const wsRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const fetchOrgTree = async () => {
    try {
      const res = await fetch(getApiUrl('/org/tree'), {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setOrgTree(data || []);
      }
    } catch (e) { console.error('Failed to fetch org tree', e); }
  };

  const searchUsers = async (q = '', orgCode = null) => {
    try {
      let url = getApiUrl('/users');
      const params = new URLSearchParams();
      if (q) params.append('q', q);
      if (orgCode) params.append('orgCode', orgCode);
      if (params.toString()) url += `?${params.toString()}`;
      
      const res = await fetch(url, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setInviteSearchResults(data || []);
      }
    } catch (e) { console.error('Failed to search users', e); }
  };

  const inviteUser = async (user) => {
    setIsInviting(true);
    try {
      const res = await fetch(getApiUrl('/warroom/join'), {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          incident_id: incidentId,
          user_id: user.employee_id,
          name: user.name,
          inviter_name: currentUser.name
        })
      });
      if (res.ok) {
        await Promise.all([fetchParticipants(), fetchWorkflowDetails(), fetchChatHistory(true)]);
        setToastMessage(`✅ ${user.name}님을 워룸에 초대했습니다`);
        setTimeout(() => setToastMessage(''), 3000);
        setShowInviteModal(false);

        // ✅ 초대한 사람에게 푸시 알림 전송 (채팅방 딥링크 포함)
        try {
          await fetch(getApiUrl('/push/notify'), {
            method: 'POST',
            headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
              target_user_id: user.employee_id,
              title: `[${incidentId}] 워룸 초대`,
              body: `${currentUser.name}님이 채팅방에 초대했습니다.`,
              url: `/chat/${incidentId}`,
              inc_id: incidentId,
              tag: `invite-${incidentId}`,
              priority: 50
            })
          });
        } catch (pe) {
          console.warn('Push notification to invited user failed:', pe);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        setToastMessage(`❌ 초대 실패: ${err.message || res.status}`);
        setTimeout(() => setToastMessage(''), 3000);
      }
    } catch (e) {
      console.error('Invitation failed', e);
      setToastMessage('❌ 네트워크 오류로 초대에 실패했습니다');
      setTimeout(() => setToastMessage(''), 3000);
    } finally {
      setIsInviting(false);
    }
  };



  useEffect(() => {
    if (showInviteModal) {
      fetchOrgTree();
      // Ensure we have some results even if org_code is missing
      if (currentUser.org_code) {
        setSelectedOrgId(currentUser.org_code);
        searchUsers('', currentUser.org_code);
      } else {
        searchUsers('', null);
      }
    }
  }, [showInviteModal, currentUser.org_code]);

  // AI Assistant SSE streaming + typewriter
  // Post Chat Logic

  useEffect(() => {
    // When messages load, mark OTHER people's messages with unread count as read — but only ONCE per seq
    if (mainMessages.length > 0 && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      mainMessages.forEach(msg => {
        if (
          msg.read_count > 0 &&
          msg.type !== 'me' &&
          msg.seq &&
          !markedReadSeqs.current.has(msg.seq) // ✅ 이미 보낸 seq는 다시 보내지 않음
        ) {
          markedReadSeqs.current.add(msg.seq);
          wsRef.current.send(JSON.stringify({
            type: "MARK_READ",
            incident_id: incidentId,
            seq: msg.seq,
            user_id: currentUser.employee_id
          }));
        }
      });
    }
  }, [mainMessages.length, currentUser.employee_id, incidentId]);


  useEffect(() => {
    fetchParticipants();
    fetchActivityLogs();
    fetchAnalysisSummary();
  }, [fetchParticipants, fetchActivityLogs, fetchAnalysisSummary, incidentId]);

  // WebSocket Connection Logic
  useEffect(() => {
    let socket;
    let reconnectTimer;
    let isMounted = true;

    const connect = () => {
      if (!isMounted || !incidentId || !currentUser.employee_id) {
        console.warn("[WS] Skipping connection - missing ID or user profile.");
        return;
      }
      
      const wsUrl = getApiUrl(`/warroom/ws/${incidentId}`, true);
      console.log(`[WS] Connecting to WebSocket: ${wsUrl}`);
      socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        if (!isMounted) {
          socket.close();
          return;
        }
        console.log("WebSocket connected");
        if (currentUser.employee_id) {
          socket.send(JSON.stringify({
            type: "JOIN",
            user_id: currentUser.employee_id,
            name: currentUser.name,
            incident_id: incidentId
          }));
        }
      };

      socket.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const data = JSON.parse(event.data);
          // ... (same cases as before)
          switch (data.type) {
            case 'CHAT_MESSAGE':
              setMainMessages(prev => {
                const exists = prev.some(m => m.id === data.msg_id || (m.temp_id && m.temp_id === data.temp_id));
                if (exists) return prev;
                const newMessage = {
                  id: data.msg_id,
                  seq: data.seq,
                  type: data.sender === currentUser.employee_id || data.sender === currentUser.name ? 'me' : 'other',
                  sender: data.sender_name || data.name || data.sender,
                  role: data.role,
                  initials: (data.sender_name || data.sender)?.[0] || 'U',
                  color: 'bg-slate-700',
                  text: data.text,
                  time: formatKst(data.timestamp),
                  timestamp: data.timestamp,
                  read_count: data.read_count || 0,
                  reactions: (() => {
                    if (typeof data.reactions === 'object' && data.reactions !== null) return data.reactions;
                    try { return JSON.parse(data.reactions || '{}'); } catch (e) { return {}; }
                  })()
                };
                // ✅ 타인 메시지 수신 시 참여자 뱃지 깜박임 트리거
                if (newMessage.type === 'other') setHasNewMessage(true);
                return [...prev, newMessage];
              });
              if (data.sender !== currentUser.employee_id && data.sender !== currentUser.name && data.seq && wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                  type: "MARK_READ", incident_id: incidentId, seq: data.seq, user_id: currentUser.employee_id
                }));
              }
              break;
            case 'TYPING':
              setRemoteTyping(prev => ({ ...prev, [data.user_id]: { name: data.name, is_typing: data.is_typing } }));
              break;
            case 'ONLINE_LIST':
              setOnlineUsers(data.users);
              break;
            case 'BOOKMARK_UPDATE':
              setMainMessages(prev => prev.map(m => (m.seq === data.seq) ? { ...m, is_key_event: data.is_key_event } : m));
              break;
            case 'PRESENCE_IN':
              setOnlineUsers(prev => {
                if (prev.some(u => u.user_id === data.user_id)) return prev;
                return [...prev, { user_id: data.user_id, name: data.name }];
              });
              break;
            case 'REACTION_UPDATE':
              setMainMessages(prev => prev.map(m => (m.seq === data.seq) ? { ...m, reactions: data.reactions } : m));
              break;
              if (data.receiver_id === currentUser.employee_id) {
                const fromName = data.sender_name || data.name || data.sender;
                setNotifications(prev => [...prev, { id: Date.now(), type: 'DM', from: fromName, message: data.message }]);
                if (showDMModal && dmTargetUser?.employee_id === data.sender_id) fetchDMHistory(data.sender_id);
              }
              break;
            case 'READ_UPDATE':
              setMainMessages(prev => prev.map(m => (m.seq === data.seq) ? { ...m, read_count: data.read_count !== undefined ? data.read_count : Math.max(0, (m.read_count || 1) - 1) } : m));
              break;
            case 'PRESENCE_OUT':
              setOnlineUsers(prev => prev.filter(u => u.user_id !== data.user_id));
              setRemoteTyping(prev => { const next = { ...prev }; delete next[data.user_id]; return next; });
              break;
            case 'AI_SUMMARY':
              setMainMessages(prev => {
                const aiMsgId = `ai_summary_${Date.now()}`;
                const newMessage = {
                  id: aiMsgId, type: 'ai_analysis', sender: 'AI Analyst', role: 'AI', initials: 'AI', color: 'bg-purple-600',
                  text: `📊 **실시간 상황 요약**\n\n${data.summary}`,
                  time: formatKst(new Date()), icon: Sparkles
                };
                return [...prev, newMessage];
              });
              break;
            case 'ERROR': console.error("WS Error:", data.message); break;
            default: console.log("WS Event:", data);
          }
        } catch (e) {
          console.error("WS Message Error:", e);
        }
      };

      socket.onclose = () => {
        if (!isMounted) return;
        console.log("WebSocket closed, reconnecting...");
        reconnectTimer = setTimeout(connect, 3000);
      };

      socket.onerror = (err) => {
        // 🔇 묵시적 종료나 이미 닫힌 상태에서의 에러는 무시하여 로그 정리
        if (!isMounted || socket.readyState === WebSocket.CLOSED) return;
        
        console.error("WebSocket error details:", {
          url: wsUrl,
          readyState: socket.readyState,
          event: err
        });
      };
    };

    // ⚡ 페이지 진입 직후 세션 안정화를 위해 500ms 지연 후 연결
    const initialTimer = setTimeout(connect, 500);

    return () => {
      isMounted = false;
      clearTimeout(initialTimer);
      clearTimeout(reconnectTimer);
      if (socket) {
        // Prevent "closed before connection established" error
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
          socket.close();
        }
      }
    };
  }, [incidentId, currentUser.name, currentUser.employee_id]);


  const handleToggleBookmark = (msg) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "TOGGLE_BOOKMARK",
        incident_id: incidentId,
        seq: msg.seq,
        is_key_event: !msg.is_key_event
      }));
    }
  };

  const handleAISearch = async (query) => {
    if (!query.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(getApiUrl(`/warroom/ai-search?q=${encodeURIComponent(query)}`), {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results || []);
      }
    } catch (e) {
      console.error('AI Search failed', e);
      alert("AI 검색 엔진 조회 중 오류가 발생했습니다. 시스템 안정화를 위해 페이지를 새로고침합니다.");
      window.location.reload();
    } finally {
      setIsSearching(false);
    }
  };

  // Warp/Jump to message function
  const handleWarpToMessage = (target_incident_id, seq) => {
    // Standardize IDs: strip 'INC-' if present
    const currentId = incidentId.replace('INC-', '');
    const cleanTargetId = String(target_incident_id).replace('INC-', '');

    if (cleanTargetId !== currentId) {
      if (window.confirm(`다른 장애방(INC-${target_incident_id})의 메시지입니다. 해당 방으로 이동하시겠습니까?`)) {
        navigate(`/warroom/chat/INC-${cleanTargetId}`);
      }
      return;
    }
    
    // In current room
    const el = document.getElementById(`msg-seq-${seq}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('animate-pulse-gold');
      setTimeout(() => el.classList.remove('animate-pulse-gold'), 3000);
    }
  };

  // Handle polling for participants (less frequent now)
  useEffect(() => {
    fetchChatHistory(false);
    fetchParticipants();

    const pollInterval = setInterval(() => {
      // Periodic sync just in case WS missed something
      fetchParticipants();
    }, 10000); 

    return () => clearInterval(pollInterval);
  }, [fetchChatHistory, fetchParticipants, incidentId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [mainMessages]);

  const saveChatToDb = async (messageData) => {
    try {
      const res = await fetch(getApiUrl('/warroom/chat'), {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(messageData)
      });
      if (res.ok) {
        const saved = await res.json();
        const newMessage = {
          id: saved.inc_id || Date.now(),
          type: messageData.type === 'me' ? 'me' : (messageData.type === 'system' ? 'system' : 'other'),
          sender: messageData.sender,
          role: messageData.role,
          initials: messageData.sender,
          color: messageData.type === 'system' ? 'bg-indigo-600' : 'bg-slate-700',
          text: messageData.text,
          time: formatKst(new Date()),
          seq: saved.seq,
          read_count: saved.read_count !== undefined ? saved.read_count : Math.max(0, participants.length - 1)
        };
        setMainMessages(prev => [...prev, newMessage]);
        if (newMessage.type === 'ai_analysis') setAiAnalysisMessage(newMessage);
      }
    } catch (err) {
      console.error("Failed to save chat", err);
    }
  };

  const handleCall = (phoneNumber) => {
    if (!phoneNumber) {
      alert("등록된 전화번호가 없습니다.");
      return;
    }
    window.location.href = `tel:${phoneNumber}`;
    setShowPhoneList(false);
  };

  const handleShareToTeam = (text) => {
    const shareText = `[AI Analysis Shared]\n\n${text}`;
    saveChatToDb({
      incident_id: incidentId,
      sender: currentUser.name,
      role: currentUser.role,
      type: 'me',
      text: shareText
    });
  };

  // ── 코드블록 자동 감지 & 하이라이팅 ────────────────────────────
  const renderCodeBlock = (code, lang = '') => (
    <div className="sguard-code-block my-1.5">
      {lang && (
        <div className="sguard-code-lang">{lang.toUpperCase() || 'CODE'}</div>
      )}
      <pre className="sguard-code-pre"><code>{code}</code></pre>
    </div>
  );

  // 서버 로그 / SQL 패턴 감지
  const isServerLog = (text) => {
    if (typeof text !== 'string') return false;
    const logPatterns = [
      /^\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}:\d{2}/m,  // 타임스탬프
      /\[(ERROR|WARN|INFO|DEBUG|FATAL|CRIT)\]/i,
      /^(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|WITH)\s/im,
      /^(nginx|apache|tomcat|mysql|postgresql|redis|docker|kubectl)/im,
      /Exception:|StackTrace:|at\s+[\w.]+\([\w.]+:\d+\)/m,
      /HTTP\/[12]\.[01]\s+\d{3}/,
    ];
    return logPatterns.some(p => p.test(text));
  };

  const renderMessageContent = (text, isMe = false) => {
    if (typeof text === 'string' && text.includes('[첨부파일]')) {
      const tagIndex = text.indexOf('[첨부파일]');
      const tagContent = text.substring(tagIndex + 6).trim();
      const parts = tagContent.split('|');
      
      if (parts.length >= 3) {
        const [filename, url, type] = parts;
        const apiBase = 'https://sguardai.khcho0421.workers.dev';
        const fullUrl = url.startsWith('http') ? url : `${apiBase}${url}`;
        
        if (type.startsWith('image/')) {
          return (
            <img
              src={fullUrl}
              alt={filename}
              className="cursor-pointer hover:opacity-90 transition-opacity block"
              style={{ maxWidth: '100%', maxHeight: 300, objectFit: 'cover', borderRadius: 12, display: 'block' }}
              onClick={() => window.open(fullUrl, '_blank')}
            />
          );
        } else {
          return (
            <div 
              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all group ${
                isMe ? 'bg-white/10 border-white/10 hover:bg-white/20' : 'bg-black/20 border-[#242424] hover:bg-black/30'
              }`}
              onClick={() => window.open(fullUrl, '_blank')}
            >
              <div className={`p-2.5 rounded-xl transition-colors ${isMe ? 'bg-white/20 group-hover:bg-white/30' : 'bg-blue-600/20 group-hover:bg-blue-600/30'}`}>
                <FileText className={`w-5 h-5 ${isMe ? 'text-white' : 'text-blue-400'}`} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className={`text-xs font-bold truncate pr-2 ${isMe ? 'text-white' : 'text-slate-200'}`}>{filename}</span>
                <span className={`text-[9px] uppercase font-mono tracking-wider mt-0.5 ${isMe ? 'text-blue-200' : 'text-slate-500'}`}>{type.split('/')[1] || 'FILE'} 형식</span>
              </div>
            </div>
          );
        }
      }
    }

    // ── 코드블록 / 서버로그 자동 감지 ────────────────────────────
    if (typeof text === 'string') {
      // 1. 백틱 코드블록 (```lang\ncode\n```)
      const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
      if (codeBlockRegex.test(text)) {
        const parts = [];
        let lastIndex = 0;
        let match;
        codeBlockRegex.lastIndex = 0;
        while ((match = codeBlockRegex.exec(text)) !== null) {
          if (match.index > lastIndex) {
            const before = text.slice(lastIndex, match.index);
            if (before.trim()) parts.push(<span key={`txt-${lastIndex}`} className="whitespace-pre-wrap">{before}</span>);
          }
          parts.push(renderCodeBlock(match[2].trim(), match[1]));
          lastIndex = match.index + match[0].length;
        }
        if (lastIndex < text.length) {
          const after = text.slice(lastIndex);
          if (after.trim()) parts.push(<span key={`txt-end`} className="whitespace-pre-wrap">{after}</span>);
        }
        return <>{parts}</>;
      }

      // 2. 서버 로그 / SQL 패턴 — 전체 메시지를 코드박스로
      if (isServerLog(text)) {
        const lang = /^(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|WITH)\s/im.test(text) ? 'SQL'
                   : /^(docker|kubectl)/im.test(text) ? 'SHELL'
                   : /Exception:|StackTrace:/m.test(text) ? 'TRACE'
                   : 'LOG';
        return renderCodeBlock(text, lang);
      }

      // 3. 인라인 코드 (`code`)
      if (text.includes('`')) {
        const parts = text.split(/(`[^`]+`)/g).map((part, i) =>
          part.startsWith('`') && part.endsWith('`')
            ? <code key={i} className="sguard-inline-code">{part.slice(1, -1)}</code>
            : <span key={i} className="whitespace-pre-wrap">{part}</span>
        );
        return <>{parts}</>;
      }
    }

    return text;
  };

  const renderAttachment = (attachment, isMe) => {
    if (!attachment) return null;
    const { name, url, type } = attachment;
    
    if (type && type.startsWith('image/')) {
      return (
        <img
          src={url}
          alt={name}
          className="block cursor-pointer hover:opacity-90 transition-opacity w-full"
          style={{ maxHeight: 300, objectFit: 'cover', display: 'block' }}
          onClick={() => window.open(url, '_blank')}
        />
      );
    }
    
    return (
      <div 
        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all group ${
          isMe ? 'bg-white/10 border-white/10 hover:bg-white/20' : 'bg-black/20 border-[#242424] hover:bg-black/30'
        }`}
        onClick={() => window.open(url, '_blank')}
      >
        <div className={`p-2.5 rounded-xl transition-colors ${isMe ? 'bg-white/20 group-hover:bg-white/30' : 'bg-blue-600/20 group-hover:bg-blue-600/30'}`}>
          <FileText className={`w-5 h-5 ${isMe ? 'text-white' : 'text-blue-400'}`} />
        </div>
        <div className="flex flex-col min-w-0">
          <span className={`text-xs font-bold truncate pr-2 ${isMe ? 'text-white' : 'text-slate-200'}`}>{name}</span>
          <span className={`text-[9px] uppercase font-mono tracking-wider mt-0.5 ${isMe ? 'text-blue-200' : 'text-slate-500'}`}>{type?.split('/')[1] || 'FILE'} 형식</span>
        </div>
      </div>
    );
  };

  const handleTyping = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    
    // Clear existing timeout
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    // Send TYPING_START
    wsRef.current.send(JSON.stringify({
      type: "TYPING_START",
      user_id: currentUser.employee_id,
      name: currentUser.name
    }));

    // Set timeout to send TYPING_STOP
    typingTimeoutRef.current = setTimeout(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: "TYPING_STOP",
          user_id: currentUser.employee_id,
          name: currentUser.name
        }));
      }
    }, 2000);
  };

  const handleSendMessage = async () => {
    const hasText = mainInput.trim();
    const hasFiles = selectedFiles.length > 0;
    
    if (!hasText && !hasFiles) return;
    if (uploadingFile) return;

    setUploadingFile(true);
    
    try {
      if (hasFiles) {
        const apiBase = 'https://sguardai.khcho0421.workers.dev';
        for (const fileObj of selectedFiles) {
          const formData = new FormData();
          formData.append('file', fileObj.file);
          formData.append('incident_id', incidentId);
          formData.append('uploaded_by', currentUser.name || '익명');
          const uploadRes = await fetch(`${apiBase}/warroom/upload`, { 
            method: 'POST', 
            headers: getAuthHeaders({ 'Content-Type': null }), // Let browser set multipart boundary
            body: formData 
          });
          if (uploadRes.ok) {
            const uploadData = await uploadRes.json();
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({
                type: "CHAT_SEND",
                incident_id: incidentId,
                sender: currentUser.employee_id,
                name: currentUser.name,
                role: currentUser.role,
                msg_type: "file",
                text: `[첨부파일] ${fileObj.file.name}|${uploadData.url}|${fileObj.file.type}`
              }));
            }
          }
        }
        setSelectedFiles([]);
      }

      if (hasText) {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: "CHAT_SEND",
            incident_id: incidentId,
            sender: currentUser.employee_id,
            name: currentUser.name,
            role: currentUser.role,
            msg_type: "user",
            text: mainInput,
            reply_to: replyTo?.seq
          }));
          
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          wsRef.current.send(JSON.stringify({
            type: "TYPING_STOP",
            user_id: currentUser.employee_id,
            name: currentUser.name
          }));
        } else {
          await saveChatToDb({
            incident_id: incidentId,
            sender: currentUser.name,
            role: currentUser.role,
            type: 'me',
            text: mainInput
          });
        }
        setMainInput('');
        setReplyTo(null);
      }
    } catch (err) {
      console.error("Failed to send message/files", err);
    } finally {
      setUploadingFile(false);
    }
  };

  const handleLeaveRoom = async () => {
    if (!window.confirm('대화방을 나가시겠습니까? 참여자 목록에서 제외됩니다.')) return;
    
    try {
      const res = await fetch(getApiUrl('/warroom/leave'), {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          user_id: currentUser.employee_id,
          inc_id: incidentId
        })
      });
      
      if (res.ok) {
        navigate('/dashboard');
      } else {
        console.error("Failed to leave room");
        // Still navigate away to not block the user, or show alert? 
        // User just said "delete when leaving", so better satisfy the delete.
        navigate('/dashboard');
      }
    } catch (err) {
      console.error("Leave room error:", err);
      navigate('/dashboard');
    }
  };

  const handleResolveOnly = async () => {
    if (!window.confirm('보고서 생성 없이 장애를 즉시 완료 처리하시겠습니까? (통계에 반영됩니다)')) return;
    try {
      const res = await fetch(getApiUrl('/warroom/resolve-only'), {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ inc_id: incidentId, user_id: currentUser.employee_id })
      });
      if (res.ok) {
        alert('장애가 처리 완료되었습니다.');
        setRoomStatus('CLOSED');
        fetchChatHistory();
      }
    } catch (err) {
      console.error("Resolve only error:", err);
    }
  };

  const fetchDMHistory = async (otherId) => {
    try {
      const res = await fetch(getApiUrl(`/warroom/dm/${otherId}?my_id=${currentUser.employee_id}`), {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setDmHistory(data);
      }
    } catch (e) { console.error("DM fetch error", e); }
  };

  const handleSendDM = async () => {
    if (!dmInput.trim() || !dmTargetUser) return;
    try {
      const res = await fetch(getApiUrl('/warroom/dm'), {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          sender_id: currentUser.employee_id,
          receiver_id: dmTargetUser.employee_id,
          message: dmInput
        })
      });
      if (res.ok) {
        // Broadast via WS for real-time notification
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: "DM_SEND",
            sender_id: currentUser.employee_id,
            sender_name: currentUser.name,
            receiver_id: dmTargetUser.employee_id,
            message: dmInput
          }));
        }
        setDmInput('');
        fetchDMHistory(dmTargetUser.employee_id);
      }
    } catch (e) { console.error("DM send error", e); }
  };

  const handleAddReaction = (msgSeq, emoji) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "ADD_REACTION",
        incident_id: incidentId,
        seq: msgSeq,
        user_id: currentUser.employee_id,
        emoji: emoji
      }));
    }
    setActiveReactionMsg(null);
  };

  const [resolveSuccess, setResolveSuccess] = useState(false);

  const handleResolveIncident = async () => {
    try {
      // 1. Mark as Resolved in DB
      await fetch(getApiUrl('/warroom/resolve'), {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ incident_id: incidentId })
      });
      // 2. Success - Navigate to AI Report Page (as per user request to restore legacy behavior)
      navigate(`/ai-report`, { state: { incidentId } });
    } catch (e) {
      console.error("Resolve error", e);
      alert('장애 처리 중 오류가 발생했습니다.');
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[100] bg-[#080c18] flex items-center justify-center overflow-hidden">
        <style>{`
          @keyframes orbit1 { from { transform: rotate(0deg) translateX(52px) rotate(0deg); } to { transform: rotate(360deg) translateX(52px) rotate(-360deg); } }
          @keyframes orbit2 { from { transform: rotate(120deg) translateX(72px) rotate(-120deg); } to { transform: rotate(480deg) translateX(72px) rotate(-480deg); } }
          @keyframes orbit3 { from { transform: rotate(240deg) translateX(90px) rotate(-240deg); } to { transform: rotate(600deg) translateX(90px) rotate(-600deg); } }
          @keyframes scanLine { 0%,100% { top:0%; opacity:0; } 10% { opacity:1; } 90% { opacity:1; } 99% { top:100%; opacity:1; } }
          @keyframes glowPulse { 0%,100% { box-shadow:0 0 40px 10px rgba(59,130,246,0.3); } 50% { box-shadow:0 0 80px 20px rgba(99,102,241,0.5); } }
          @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
          .orbit-dot-1 { animation: orbit1 2s linear infinite; }
          .orbit-dot-2 { animation: orbit2 3s linear infinite; }
          .orbit-dot-3 { animation: orbit3 4s linear infinite; }
          .glow-orb   { animation: glowPulse 2.5s ease-in-out infinite; }
          .scan-line  { animation: scanLine 2.5s ease-in-out infinite; }
          .fade-up-1  { animation: fadeUp 0.5s ease forwards 0.1s; opacity:0; }
          .fade-up-2  { animation: fadeUp 0.5s ease forwards 0.4s; opacity:0; }
          .fade-up-3  { animation: fadeUp 0.5s ease forwards 0.7s; opacity:0; }
        `}</style>

        {/* 배경 그라디언트 */}
        <div className="absolute inset-0" style={{background:'radial-gradient(ellipse at 50% 50%, rgba(30,58,138,0.25) 0%, transparent 70%)'}} />

        <div className="relative flex flex-col items-center gap-6">
          {/* 오브 영역 */}
          <div className="relative flex items-center justify-center" style={{width:160,height:160}}>
            <div className="absolute w-36 h-36 rounded-full border border-blue-500/10" />
            <div className="absolute w-28 h-28 rounded-full border border-blue-500/15 animate-spin" style={{animationDuration:'8s'}} />
            <div className="absolute w-20 h-20 rounded-full border border-indigo-500/20 animate-spin" style={{animationDuration:'5s',animationDirection:'reverse'}} />
            <div className="absolute w-20 h-20 rounded-full overflow-hidden">
              <div className="scan-line absolute w-full h-0.5 bg-gradient-to-r from-transparent via-blue-400/60 to-transparent" />
            </div>
            <div className="absolute w-0 h-0 flex items-center justify-center">
              <div className="orbit-dot-1 w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_2px_rgba(96,165,250,0.8)]" />
            </div>
            <div className="absolute w-0 h-0 flex items-center justify-center">
              <div className="orbit-dot-2 w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_6px_2px_rgba(129,140,248,0.8)]" />
            </div>
            <div className="absolute w-0 h-0 flex items-center justify-center">
              <div className="orbit-dot-3 w-1 h-1 rounded-full bg-cyan-400 shadow-[0_0_5px_2px_rgba(34,211,238,0.8)]" />
            </div>
            <div className="glow-orb w-16 h-16 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-2xl">
              <Sparkles className="w-7 h-7 text-white animate-pulse" />
            </div>
          </div>

          {/* 텍스트 */}
          <div className="flex flex-col items-center gap-3 text-center fade-up-1">
            <div className="flex items-center gap-2 px-4 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full">
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
              <span className="text-[10px] font-black text-blue-400 tracking-[0.2em] uppercase">S-Guard AI</span>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">WarRoom 초기화중</h2>
            <p className="text-sm text-slate-500">장애 협업 데이터를 불러오고 있습니다</p>
          </div>

          {/* 프로그레스 바 */}
          <div className="w-56 fade-up-2">
            <div className="h-0.5 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-blue-600 via-indigo-500 to-blue-600 animate-pulse" style={{width:'65%'}} />
            </div>
          </div>

          {/* 시스템 항목 */}
          <div className="flex flex-col gap-2 fade-up-3">
            {[
              { label: 'WebSocket 연결', done: true },
              { label: '채팅 기록 로드', done: true },
              { label: 'AI 분석 동기화', done: false },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px]">
                <div className={`w-1 h-1 rounded-full ${item.done ? 'bg-emerald-400' : 'bg-blue-400 animate-pulse'}`} />
                <span className={item.done ? 'text-slate-400' : 'text-blue-300'}>{item.label}</span>
                {item.done && <span className="text-emerald-500 ml-auto text-[10px]">✓</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-[#191919] text-white font-sans flex flex-col relative">
      {/* Header */}
      {/* DM Notifications Toast */}
      <div className="fixed top-20 right-4 z-[150] flex flex-col items-end space-y-2 pointer-events-none">
        {notifications.map(notif => (
          <div 
            key={notif.id} 
            className="w-72 bg-blue-600/90 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl border border-white/20 animate-in slide-in-from-right-full duration-500 pointer-events-auto cursor-pointer"
            onClick={() => {
              // Open modal for this user
              // fetchDMHistory(notif.sender_id);
              setNotifications(prev => prev.filter(n => n.id !== notif.id));
            }}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center space-x-2">
                <MessageSquare className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">New Private Note</span>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); setNotifications(prev => prev.filter(n => n.id !== notif.id)); }}
                className="opacity-50 hover:opacity-100"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            <p className="text-xs font-bold mb-1">{notif.from}님</p>
            <p className="text-[11px] opacity-90 truncate">{notif.message}</p>
          </div>
        ))}
      </div>

      <header className="flex justify-between items-center px-3 py-1.5 sticky top-0 bg-[#191919]/90 backdrop-blur-md z-50 border-b border-[#242424]">
        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
          <button onClick={() => navigate(-1)} className="p-1 rounded-full hover:bg-white/10 transition-colors shrink-0">
            <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </button>
          <div className="flex flex-col min-w-0 flex-1 pr-2">
            {/* 장애 ID */}
            <span className="font-bold text-sm sm:text-base truncate text-white">
              {incidentId?.replace('INC-', '')}
            </span>
            {/* SMS 내용 2줄 말줄임 + 롱프레스 */}
            {roomDescription && (
              <span
                className="text-slate-400 text-[10px] leading-tight select-none cursor-pointer"
                style={{display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden'}}
                onTouchStart={() => { descPressTimer.current = setTimeout(() => setShowFullDesc(true), 500); }}
                onTouchEnd={() => clearTimeout(descPressTimer.current)}
                onMouseDown={() => { descPressTimer.current = setTimeout(() => setShowFullDesc(true), 500); }}
                onMouseUp={() => clearTimeout(descPressTimer.current)}
                onContextMenu={e => { e.preventDefault(); setShowFullDesc(true); }}
              >
                {roomDescription}
              </span>
            )}
          </div>
        </div>
        
        {(() => {
          const isAdmin = currentUser?.role && (currentUser.role.includes('관리자') || currentUser.role.toLowerCase().includes('admin'));
          // WAR-ROOM 배정자가 아예 없거나(초기 상태), 배정자 중 본인이 포함되어 있거나, 관리자이거나
          const isAssignedToMe = assignees.length === 0 || assignees.some(a => String(a.user_id) === String(currentUser.employee_id)) || isAdmin;
          
          return (
            <div className="flex items-center space-x-2 sm:space-x-3 relative ml-auto justify-end">
              {/* WAR-ROOM 분석 버튼 (명칭 변경) */}
              <button
                onClick={() => {
                  if (isResolved || !isAssignedToMe || summaryLockOwner) return;
                  navigate(`/chat-summary/${incidentId}`);
                }}
                disabled={isResolved || !isAssignedToMe || !!summaryLockOwner}
                className={`flex items-center px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg text-xs font-extrabold transition-all duration-300 ${
                  isResolved || !isAssignedToMe || summaryLockOwner
                    ? 'bg-slate-800 text-slate-500 border border-[#242424] cursor-not-allowed opacity-60'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border border-blue-400/50 shadow-[0_0_12px_rgba(59,130,246,0.5)] hover:shadow-[0_0_20px_rgba(59,130,246,0.8)] hover:scale-105'
                }`}
              >
                <Sparkles className={`w-3.5 h-3.5 mr-1 ${(isResolved || !isAssignedToMe || summaryLockOwner) ? 'text-slate-600' : 'animate-pulse'}`} />
                <span className="whitespace-nowrap">
                  {summaryLockOwner ? `분석 중 (${summaryLockOwner})` : 'W/R 분석'}
                </span>
              </button>

              {/* Moved Status Indicator */}
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-xs font-black tracking-tight text-emerald-400 uppercase">{roomStatus || 'Open'}</span>
              </div>
                {/* 참여자 아이콘 및 숫자 */}
                <button
                  onClick={() => { setShowParticipantDropdown(!showParticipantDropdown); setHasNewMessage(false); }}
                  title="참여 사용자 목록"
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-full border transition-all active:scale-95 ${
                    hasNewMessage
                      ? 'bg-yellow-500/20 border-yellow-500/50 animate-pulse shadow-lg shadow-yellow-500/20'
                      : 'bg-white/5 hover:bg-white/10 border-white/5'
                  }`}
                >
                  <User className={`w-3.5 h-3.5 ${hasNewMessage ? 'text-yellow-400' : 'text-slate-300'}`} />
                  <span className={`text-[11px] font-semibold leading-none ${hasNewMessage ? 'text-yellow-400' : 'text-slate-300'}`}>
                    +{assignees.length + participants.filter(p => !assignees.some(a => a.name === p.name || a.name === p.sender)).length || 0}
                  </span>
                </button>

          <button className="p-2 rounded-full hover:bg-white/10 transition-colors relative" onClick={() => setShowPhoneList(!showPhoneList)}>
            <Phone className="w-4.5 h-4.5 text-slate-300" />
          </button>
          <button className="p-2 rounded-full hover:bg-white/10 transition-colors" onClick={() => setShowMenu(!showMenu)}>
            <Menu className="w-5 h-5 text-white" />
          </button>

          {/* Phone List Dropdown */}
          {showPhoneList && (
            <div className="absolute top-12 right-12 w-64 bg-[#242424] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50">
                <div className="p-3 border-b border-[#242424] bg-[#1e1e1e] flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-300">통화 대상 선택</span>
                    <button onClick={() => setShowPhoneList(false)} className="text-slate-500 hover:text-white transition-colors p-1">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="max-h-60 overflow-y-auto">
                    {participants.map((person, index) => (
                        <div key={index} onClick={() => handleCall(person.phone)} className="flex items-center justify-between p-3 hover:bg-white/5 cursor-pointer transition-colors border-b border-[#242424] last:border-0">
                            <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold">
                                    {person.name[0]}
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm text-white">{person.name}</span>
                                    <span className="text-[10px] text-slate-500">{person.role}</span>
                                </div>
                            </div>
                            <div className="flex items-center space-x-2">
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setDmTargetUser(person);
                                        setShowDMModal(true);
                                        fetchDMHistory(person.employee_id);
                                    }}
                                    className="p-1.5 hover:bg-blue-500/20 rounded-lg transition-colors group/dm"
                                    title="쪽지 보내기"
                                >
                                    <MessageSquare className="w-4 h-4 text-slate-400 group-hover/dm:text-blue-400" />
                                </button>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleCall(person.phone); }}
                                    className="p-1.5 hover:bg-green-500/20 rounded-lg transition-colors group/phone"
                                    title="전화 걸기"
                                >
                                    <Phone className="w-4 h-4 text-slate-400 group-hover/phone:text-green-500" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
          )}

          {/* Menu Dropdown */}
          {showMenu && (
            <div className="absolute top-12 right-0 w-48 bg-[#242424] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50">
                <div 
                    onClick={() => { if (!isResolved) { setShowMenu(false); setShowInviteModal(true); } }}
                    className={`flex items-center space-x-3 p-3 transition-colors border-b border-[#242424] ${isResolved ? 'opacity-50 cursor-not-allowed bg-black/10' : 'hover:bg-white/5 cursor-pointer'}`}
                >
                    <UserPlus className={`w-4 h-4 ${isResolved ? 'text-slate-600' : 'text-blue-400'}`} />
                    <span className={`text-sm ${isResolved ? 'text-slate-500' : 'text-slate-200'}`}>초대하기 {isResolved && '(종료됨)'}</span>
                </div>
              <div 
                onClick={handleLeaveRoom}
                className="flex items-center space-x-3 p-3 hover:bg-red-500/10 cursor-pointer transition-colors"
              >
                <LogOut className="w-4 h-4 text-red-400" />
                <span className="text-sm text-red-400">나가기</span>
              </div>
            </div>
          )}
            </div>
          );
        })()}
      </header>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <>
          {/* 성공 토스트 알림바 (Inside Chat Column) */}
          {resolveSuccess && (
            <div className="bg-gradient-to-r from-emerald-600/20 to-blue-600/20 border-b border-emerald-500/30 p-3 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 shrink-0">
              <div className="flex items-center gap-2">
                <div className="bg-emerald-500/20 p-1.5 rounded-full">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                </div>
                <p className="text-sm text-emerald-100 font-medium">장애가 해결되었으며, 대화 내역이 AI RAG 모델에 학습되었습니다.</p>
              </div>
              <button
                onClick={() => navigate('/knowledge-base')}
                className="shrink-0 flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-500/20 active:scale-95"
              >
                <Database className="w-4 h-4" />
                학습된 내역 확인하기
              </button>
            </div>
          )}



          {/* AI Analysis Summary 슬라이드 패널 (헤더 버튼으로 열고 닫기) */}
          {showAiPanel && (
            <div className="bg-[#12172a]/98 border-b border-purple-500/20 backdrop-blur-xl z-20 shrink-0 animate-in slide-in-from-top-4 duration-300">
              <div className="px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="bg-gradient-to-br from-purple-600 to-blue-600 p-1.5 rounded-lg">
                      <Sparkles className="w-3 h-3 text-white animate-pulse" />
                    </div>
                    <span className="text-[11px] font-black text-purple-300 uppercase tracking-widest">AI Analysis Summary</span>
                  </div>
                  <button onClick={() => setShowAiPanel(false)} className="p-1 rounded-full hover:bg-white/10 transition-colors">
                    <X className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
                <div className="max-h-40 overflow-y-auto pr-1" style={{scrollbarWidth:'thin',scrollbarColor:'rgba(255,255,255,0.1) transparent'}}>
                  <div className="text-[13px] text-slate-300 leading-relaxed">
                    <MarkdownViewer text={aiAnalysisMessage?.text || analysisSummary || roomDescription || '장애 내용을 포함한 실시간 지식 분석을 기다리고 있습니다...'} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Chat Messages Area (THE ONLY SCROLLABLE PART) */}
          <main ref={scrollRef} className="flex-1 p-4 space-y-1 overflow-y-auto relative custom-scrollbar pb-10">
        


        {mainMessages.filter(msg => msg.type !== 'ai_analysis').map((msg, idx, arr) => {
          // ── 렌더 시점 나/타인 재판별 (msg.type에 의존하지 않음) ──
          const isMe = msg.type === 'me'
            || String(msg.sender_id ?? '').trim() === String(currentUser.employee_id ?? '').trim()
            || String(msg.sender_id ?? '').trim() === String(currentUser.name ?? '').trim()
            || String(msg.sender ?? '').trim() === String(currentUser.name ?? '').trim();

          const prevMsg = arr[idx - 1];
          const prevIsMe = prevMsg && (
            prevMsg.type === 'me'
            || String(prevMsg.sender_id ?? '').trim() === String(currentUser.employee_id ?? '').trim()
            || String(prevMsg.sender ?? '').trim() === String(currentUser.name ?? '').trim()
          );
          const isContinuous = prevMsg &&
            prevIsMe === isMe &&
            prevMsg.sender === msg.sender &&
            msg.type !== 'system';
          return (
          <div key={msg.inc_id || msg.id} id={`msg-seq-${msg.seq}`}>
            {!isMe && msg.type !== 'system' && (
              <div className="flex items-start space-x-3 mb-1 group">
                {/* 연속 메시지: 아바타 자리만 차지, 아이콘 숨김 */}
                {isContinuous ? (
                  <div className="min-w-[40px] shrink-0" />
                ) : (
                  <div className={`px-2 py-1 h-10 min-w-[40px] rounded-xl ${msg.color} flex items-center justify-center font-bold text-xs shrink-0 whitespace-nowrap`}>
                    {msg.initials}
                  </div>
                )}
                <div className="flex flex-col space-y-1">
                  {/* 연속 메시지: 이름 숨김 */}
                  {!isContinuous && (
                    <span className="text-xs text-slate-400 font-medium">{msg.sender}</span>
                  )}
                  <div className="flex items-end space-x-2 relative group/bubble">
                  <div
                    className={(() => {
                      const isImgText = msg.text?.includes('[첨부파일]') && msg.text?.includes('image/');
                      return isImgText ? '' : 'bg-[#333333] rounded-2xl rounded-tl-none px-3.5 py-1.5 max-w-[280px] text-[15px] leading-relaxed whitespace-pre-wrap relative group/bubble';
                    })()}
                    style={msg.text?.includes('[첨부파일]') && msg.text?.includes('image/') ? { maxWidth: 'calc(66vw)', overflow: 'hidden', borderRadius: '4px 16px 16px 16px' } : {}}
                    onContextMenu={(e) => { e.preventDefault(); setLongPressMsg(msg); }}
                    onTouchStart={() => { longPressTimer.current = setTimeout(() => setLongPressMsg(msg), 500); }}
                    onTouchEnd={() => clearTimeout(longPressTimer.current)}
                    onTouchMove={() => clearTimeout(longPressTimer.current)}
                  >
                      {msg.parent_seq && (
                        <div className="mb-2 p-2 bg-black/10 rounded-lg text-[11px] border-l-2 border-white/20 opacity-80 cursor-alias" onClick={() => {
                          const el = document.getElementById(`msg-seq-${msg.parent_seq}`);
                          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }}>
                          <span className="font-bold block text-slate-400">
                            Reply to {mainMessages.find(m => m.seq === msg.parent_seq)?.sender || 'Original'}
                          </span>
                          <span className="truncate block italic text-slate-300/70">
                            {mainMessages.find(m => m.seq === msg.parent_seq)?.text || '원본 메시지를 찾을 수 없습니다'}
                          </span>
                        </div>
                      )}
                      {msg.fileAttachment ? renderAttachment(msg.fileAttachment, false) : renderMessageContent(msg.text, false)}
                      
                      {/* Reaction Badges */}
                      {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5 pt-1 border-t border-[#242424]">
                          {Object.entries(msg.reactions).map(([emoji, users]) => (
                            users.length > 0 && (
                              <button 
                                key={emoji} 
                                onClick={() => handleAddReaction(msg.seq, emoji)}
                                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] border transition-all ${users.includes(currentUser.employee_id) ? 'bg-blue-500/20 border-blue-500/40 text-blue-400' : 'bg-slate-700/50 border-white/10 text-slate-400'}`}
                              >
                                <span>{emoji}</span>
                                <span className="font-bold">{users.length}</span>
                              </button>
                            )
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-center justify-end pb-1">
                      {msg.is_key_event && <Star className="w-3 h-3 text-yellow-500 fill-current mb-0.5 animate-in zoom-in-0" title="Key Event" />}
                      {msg.read_count > 0 && (
                        <span className="text-[12px] text-[#FAE100] font-black leading-none mb-1 drop-shadow-sm">{msg.read_count}</span>
                      )}
                      <span className="text-[10px] text-slate-500 shrink-0 whitespace-nowrap">{msg.time}</span>
                    </div>
                    {/* Reply & Reaction Actions */}
                    {!isResolved && (
                      <div className="absolute right-[-100px] top-1/2 -translate-y-1/2 flex items-center space-x-1 opacity-0 group-hover/bubble:opacity-100 transition-all">
                        <button 
                          onClick={() => handleToggleBookmark(msg)}
                          className={`p-1.5 hover:bg-white/10 rounded-full transition-colors ${msg.is_key_event ? 'text-yellow-500' : 'text-slate-500 hover:text-yellow-500'}`}
                          title="타임라인 등록"
                        >
                          <Star className={`w-4 h-4 ${msg.is_key_event ? 'fill-current' : ''}`} />
                        </button>
                        <button 
                          onClick={() => setActiveReactionMsg(activeReactionMsg === msg.seq ? null : msg.seq)}
                          className="p-1.5 hover:bg-white/10 rounded-full text-slate-500 hover:text-yellow-500"
                        >
                          <Smile className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setReplyTo(msg)}
                          className="p-1.5 hover:bg-white/10 rounded-full text-slate-500 hover:text-blue-400"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {/* Emoji Picker Popover */}
                    {activeReactionMsg === msg.seq && (
                      <div className="absolute top-[-45px] left-0 bg-[#333333] border border-white/10 rounded-full p-1 shadow-2xl flex items-center space-x-1 z-[60] animate-in zoom-in-95 duration-200">
                        {['👍', '🚨', '✅', '🙏', '💡'].map(emoji => (
                          <button 
                            key={emoji}
                            onClick={() => handleAddReaction(msg.seq, emoji)}
                            className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors text-lg"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {isMe && (
              <div className="flex flex-col items-end space-y-1 mb-1 group">
                <div className="flex items-end space-x-2">
                  <div className="flex flex-col items-center justify-end pb-1">
                    {msg.is_key_event && <Star className="w-3 h-3 text-yellow-500 fill-current mb-0.5 animate-in zoom-in-0" title="Key Event" />}
                    {msg.read_count > 0 && (
                      <span className="text-[12px] text-[#FAE100] font-black leading-none mb-1 drop-shadow-sm">{msg.read_count}</span>
                    )}
                    <span className="text-[10px] text-slate-500 shrink-0 whitespace-nowrap">{msg.time}</span>
                  </div>
                  <div className="relative group/bubble">
                    <div
                      className={(() => {
                        const isImgText = msg.text?.includes('[첨부파일]') && msg.text?.includes('image/');
                        return isImgText ? '' : 'bg-[#00236e] rounded-2xl rounded-tr-none px-3.5 py-1.5 max-w-[280px] text-[15px] leading-relaxed shadow-lg whitespace-pre-wrap relative text-white';
                      })()}
                      style={msg.text?.includes('[첨부파일]') && msg.text?.includes('image/') ? { maxWidth: 'calc(66vw)', overflow: 'hidden', borderRadius: '16px 4px 16px 16px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' } : {}}
                      onContextMenu={(e) => { e.preventDefault(); setLongPressMsg(msg); }}
                      onTouchStart={() => { longPressTimer.current = setTimeout(() => setLongPressMsg(msg), 500); }}
                      onTouchEnd={() => clearTimeout(longPressTimer.current)}
                      onTouchMove={() => clearTimeout(longPressTimer.current)}
                    >
                      {msg.parent_seq && (
                        <div className="mb-2 p-2 bg-black/10 rounded-lg text-[11px] border-l-2 border-black/30 opacity-80 cursor-alias text-left" onClick={() => {
                          const el = document.getElementById(`msg-seq-${msg.parent_seq}`);
                          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }}>
                          <span className="font-bold block text-black/70">
                            Reply to {mainMessages.find(m => m.seq === msg.parent_seq)?.sender || 'Original'}
                          </span>
                          <span className="truncate block italic text-black/50">
                            {mainMessages.find(m => m.seq === msg.parent_seq)?.text || '원본 메시지를 찾을 수 없습니다'}
                          </span>
                        </div>
                      )}
                      {msg.fileAttachment ? renderAttachment(msg.fileAttachment, true) : renderMessageContent(msg.text, true)}
                      
                      {/* Reaction Badges (me) */}
                      {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5 pt-1 border-t border-black/10">
                          {Object.entries(msg.reactions).map(([emoji, users]) => (
                            users.length > 0 && (
                              <button 
                                key={emoji} 
                                onClick={() => handleAddReaction(msg.seq, emoji)}
                                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] border transition-all ${users.includes(currentUser.employee_id) ? 'bg-black/10 border-black/10 text-black' : 'bg-black/5 border-black/5 text-black'}`}
                              >
                                <span>{emoji}</span>
                                <span className="font-bold">{users.length}</span>
                              </button>
                            )
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Reply & Reaction Actions (me) */}
                    {!isResolved && (
                      <div className="absolute left-[-100px] top-1/2 -translate-y-1/2 flex items-center space-x-1 opacity-0 group-hover/bubble:opacity-100 transition-all">
                        <button 
                          onClick={() => setReplyTo(msg)}
                          className="p-1.5 hover:bg-white/10 rounded-full text-slate-500 hover:text-blue-400"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <button 
                          className="p-1.5 hover:bg-white/10 rounded-full text-slate-500 hover:text-blue-400"
                          title="공지로 고정"
                        >
                          <Megaphone className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {/* Emoji Picker Popover (me) */}
                    {activeReactionMsg === msg.seq && (
                      <div className="absolute top-[-45px] right-0 bg-[#333333] border border-white/10 rounded-full p-1 shadow-2xl flex items-center space-x-1 z-[60] animate-in zoom-in-95 duration-200">
                        {['👍', '🚨', '✅', '🙏', '💡'].map(emoji => (
                          <button 
                            key={emoji}
                            onClick={() => handleAddReaction(msg.seq, emoji)}
                            className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors text-lg"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {msg.type === 'system' && (
              <div className="flex justify-center my-3">
                <div className="bg-[#1a1a1a] rounded-full px-4 py-1.5 max-w-[280px]">
                  <p className="text-[12px] text-center whitespace-pre-wrap" style={{color:'#777777'}} dangerouslySetInnerHTML={{ __html: msg.text }} />
                </div>
              </div>
            )}

            {msg.type === 'ai_analysis' && (() => {
              const isLeader = msg.role === 'Leader';
              const roleColors = {
                'Security': 'bg-red-500/20 text-red-400 border-red-500/30',
                'DB': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
                'DevOps': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
                'Leader': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
                'default': 'bg-slate-700 text-slate-300 border-white/10'
              };
              const roleColorClass = roleColors[msg.role] || roleColors['default'];
              const roleTextClass = msg.role === 'Security' ? 'text-red-400' :
                                    msg.role === 'DB' ? 'text-yellow-400' :
                                    msg.role === 'DevOps' ? 'text-blue-400' :
                                    msg.role === 'Leader' ? 'text-purple-400' : 'text-slate-400';
              
              const Icon = msg.role === 'Security' ? Shield :
                           msg.role === 'DB' ? Database :
                           msg.role === 'DevOps' ? Server :
                           msg.role === 'Leader' ? User : Terminal;

              return (
                <div className={`flex w-full animate-in fade-in slide-in-from-bottom-2 duration-300 mt-6 mb-6 ${isLeader ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex max-w-[90%] ${isLeader ? 'flex-row-reverse' : 'flex-row'} items-start gap-2.5`}>
                    
                    {/* Avatar */}
                    <div className="shrink-0 mt-1 shadow-md">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${roleColorClass}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                    </div>
                      {/* Message Content */}
                      <div className={`flex flex-col ${isLeader ? 'items-end' : 'items-start'}`}>
                        <span className={`text-[11px] mb-1.5 px-1 font-bold tracking-wide ${roleTextClass}`}>
                          {msg.role} Agent
                        </span>
                        <div className={`flex items-end gap-2 ${isLeader ? 'flex-row-reverse' : 'flex-row'}`}>
                          <div className={`p-3.5 text-[13px] leading-relaxed shadow-lg whitespace-pre-wrap break-words ${
                            isLeader
                              ? 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-2xl rounded-tr-sm border border-purple-500/30'
                              : 'bg-[#242424] text-slate-200 rounded-2xl rounded-tl-sm border border-[#1a1a1a]'
                          }`}>
                            {msg.text}
                          </div>
                          <span className="text-[10px] text-slate-500 shrink-0 mb-1 font-mono tracking-tighter">
                            {msg.time}
                          </span>
                        </div>
                      </div>
                  </div>
                </div>
              );
            })()}
          </div>
        ); })}
          </main>

          <div className="px-4 pb-0 bg-[#191919]" />

          {/* ── 입력 영역 ── */}
          <div className="shrink-0 bg-[#191919] border-t border-[#242424] z-30" style={{paddingBottom:'env(safe-area-inset-bottom)'}}>
            {/* 타이핑 인디케이터 */}
            {Object.values(remoteTyping).some(u => u.is_typing) && (
              <div className="px-4 py-1.5 flex items-center gap-2 animate-pulse">
                <div className="flex -space-x-1">
                  {Object.entries(remoteTyping).filter(([_, u]) => u.is_typing).map(([id, u]) => (
                    <div key={id} className="w-5 h-5 rounded-full bg-[#333333] border border-[#191919] flex items-center justify-center text-[8px] font-bold">
                      {u.name?.[0]}
                    </div>
                  ))}
                </div>
                <span className="text-[10px] text-slate-500">
                  {Object.values(remoteTyping).filter(u => u.is_typing).map(u => u.name).join(', ')}님이 입력 중...
                </span>
              </div>
            )}

            <div className="px-1 py-0 flex flex-col gap-0.5">
              {isResolved ? (
                <div className="rounded-2xl py-3 px-5 border border-[#242424] bg-[#1e1e1e] flex items-center justify-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-slate-500 animate-pulse" />
                  <span className="text-sm text-slate-500 font-medium">이 War-Room은 종료되었습니다. (읽기 전용)</span>
                </div>
              ) : (
                <>
                  {/* 파일 미리보기 (이미지: 즉시전송 버튼) */}
                  {selectedFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2 px-1">
                      {selectedFiles.map((file, idx) => (
                        <div key={idx} className="relative group animate-in zoom-in-95 duration-200">
                          {file.type.startsWith('image/') ? (
                            <>
                              <img src={file.localUrl} alt={file.name}
                                className="w-16 h-16 rounded-xl object-cover border border-white/10" />
                              <button
                                onClick={handleSendMessage}
                                className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity">
                                <Send className="w-5 h-5 text-white" />
                              </button>
                            </>
                          ) : (
                            <div className="flex items-center gap-2 bg-slate-800/80 rounded-xl px-2.5 py-2 border border-white/10">
                              <FileText className="w-5 h-5 text-blue-400 shrink-0" />
                              <span className="text-[10px] text-slate-300 max-w-[80px] truncate">{file.name}</span>
                            </div>
                          )}
                          <button
                            onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))}
                            className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-slate-900 border border-white/20 flex items-center justify-center">
                            <X className="w-2.5 h-2.5 text-slate-400" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 이모지 피커 팝업 */}
                  {showEmojiPicker && (
                    <div className="bg-[#1a2035] border border-white/10 rounded-2xl p-3 shadow-2xl"
                      style={{maxHeight:200, overflowY:'auto'}}>
                      <div className="grid grid-cols-8 gap-1">
                        {['😊','😂','🥰','😎','🤔','😅','🙏','👍','👏','🔥','💯','⚡','✅','❌','⚠️','📌',
                          '🚨','🛡️','💻','📊','📈','🔴','🟡','🟢','🔵','⭕','💬','📋','🔧','🔍','📡','🗂️',
                          '😭','😤','🤦','👀','💪','🎯','🚀','💡','📢','🔔','🔕','☑️','❗','❓','💥','🆘'].map(emoji => (
                          <button key={emoji}
                            className="text-xl hover:bg-white/10 rounded-lg p-1 transition-colors active:scale-90"
                            onClick={() => { setMainInput(p => p + emoji); textareaRef.current?.focus(); }}>
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 입력 바 */}
                  <div className="flex items-end gap-1 max-w-5xl mx-auto w-full">
                    {/* 파일 첨부 (외부) */}
                    <input ref={fileInputRef} type="file" multiple
                      accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
                      className="hidden"
                      onChange={(e) => {
                        const files = Array.from(e.target.files);
                        if (!files.length) return;
                        setSelectedFiles(prev => [...prev, ...files.map(f => ({
                          name: f.name, type: f.type,
                          localUrl: URL.createObjectURL(f), file: f
                        }))]);
                        e.target.value = '';
                      }} />
                    <button onClick={() => fileInputRef.current?.click()}
                      className="flex items-center justify-center rounded-full bg-[#2A2A2A] border border-white/10 hover:bg-[#333333] active:scale-90 transition-all flex-none mb-0.5 shadow-sm"
                      style={{ width: 36, height: 36, minWidth: 36, minHeight: 36 }}
                    >
                      <Plus className="w-6 h-6 text-slate-200" />
                    </button>

                    {/* 입력 필드 컨테이너 (pill 형태) */}
                    <div className="flex-1 relative">
                      {/* 답장 미리보기 */}
                      {replyTo && (
                        <div className="absolute bottom-full left-0 w-full bg-[#1e2538] border border-white/8 rounded-t-2xl px-3 py-1.5 mb-[-1px] flex justify-between items-center text-[11px]">
                          <div className="flex items-center gap-2 text-slate-300 truncate">
                            <span className="font-bold text-blue-400">@{replyTo.sender}</span>
                            <span className="truncate opacity-70">{replyTo.text}</span>
                          </div>
                          <button onClick={() => setReplyTo(null)}><X className="w-3.5 h-3.5 text-slate-500" /></button>
                        </div>
                      )}

                      {/* pill 입력창 (수직 중앙 정렬: items-center) */}
                      <div className={`flex items-center bg-[#2A2A2A] border border-white/10 focus-within:border-blue-500/50 transition-all px-1 ${replyTo ? 'rounded-b-[18px] rounded-t-none' : 'rounded-[18px]'}`} style={{ minHeight: 36 }}>
                        {/* textarea */}
                        <textarea ref={textareaRef} id="main-chat-input" rows={1}
                          disabled={roomStatus === 'CLOSED' || roomStatus === 'Completed' || roomStatus === '처리완료' || roomStatus === '완료' || roomStatus === '최종완료'}
                          value={mainInput}
                          onChange={(e) => {
                            setMainInput(e.target.value); handleTyping();
                            e.target.style.height = 'auto';
                            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault(); handleSendMessage();
                              if (textareaRef.current) textareaRef.current.style.height = '24px';
                            }
                          }}
                          onFocus={() => setShowEmojiPicker(false)}
                          placeholder={(roomStatus === 'CLOSED' || roomStatus === 'Completed' || roomStatus === '처리완료' || roomStatus === '완료' || roomStatus === '최종완료') ? '종료된 워룸은 입력할 수 없습니다' : '메시지를 입력하세요...'}
                          className="flex-1 bg-transparent py-[7px] pl-3 pr-1 text-[14px] text-white focus:outline-none placeholder:text-[#666666] resize-none overflow-y-auto leading-tight"
                          style={{ minHeight: 32, maxHeight: 120 }}
                        />

                        {/* 이모지 버튼 (전송 버튼 좌측) */}
                        <button onClick={() => setShowEmojiPicker(p => !p)}
                          className={`flex items-center justify-center w-8 h-8 mx-0.5 rounded-full transition-all active:scale-90 text-2xl leading-none shrink-0 ${showEmojiPicker ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}>
                          😊
                        </button>
                      </div>
                    </div>

                    {/* 전송 버튼 (36px 시원한 사이즈) */}
                    <button onClick={handleSendMessage}
                      disabled={(!mainInput.trim() && selectedFiles.length === 0) || uploadingFile}
                      className={`flex items-center justify-center rounded-full transition-all active:scale-95 flex-none shadow-lg mb-0.5
                        ${(!mainInput.trim() && selectedFiles.length === 0) || uploadingFile
                          ? 'bg-slate-800 text-slate-600 opacity-50 cursor-not-allowed'
                          : 'bg-blue-600 text-white shadow-blue-900/40 hover:bg-blue-500 hover:scale-105'
                        }`}
                      style={{ width: 36, height: 36, minWidth: 36, minHeight: 36 }}
                    >
                      {uploadingFile
                        ? <div className="w-5 h-5 border-2 border-white/30 border-t-transparent rounded-full animate-spin" />
                        : <Send className="w-5 h-5 fill-current" />}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      </div>

      {/* ── 참여자 바텀시트 (최상위 fixed) ── */}
      {showParticipantDropdown && (() => {
        // 실제 메시지를 보낸 사람 목록 (이름 기준)
        const senders = new Set(
          (mainMessages||[])
            .filter(m => m.type !== 'system' && m.type !== 'ai_analysis' && m.sender)
            .map(m => m.sender)
        );

        const guestParticipants = (participants||[]).filter(
          p => !(assignees||[]).some(a => a.user_id === p.employee_id || a.name === p.name || a.name === p.sender)
        );
        const enrichedAssignees = (assignees||[]).map(asgn => ({
          ...asgn,
          isOnline: senders.has(asgn.name),
          isGuest: false,
        }));
        const enrichedGuests = guestParticipants.map(p => ({
          name: p.name, team_name: p.company, part_name: p.role,
          isOnline: senders.has(p.name) || senders.has(p.sender),
          isGuest: true, status: '참관',
        }));

        const allPeople = [...enrichedAssignees, ...enrichedGuests];
        const onlineList  = allPeople.filter(p => p.isOnline);
        const offlineList = allPeople.filter(p => !p.isOnline);

        const PersonRow = ({ person, idx, isOnline: isOnl }) => {
          const displayStatus = (isResolved && person.status === '처리중') ? '처리완료' : person.status;
          const avatarGrad = 'from-[#2A2A2A] to-[#222]';
          const orgParts = [
            person.company_name || person.company || '신한DS',
            person.honbu_name || person.honbu,
            person.team_name  || person.team,
            person.part_name  || person.part || (person.isGuest ? '참관자' : null),
            person.subpart_name || person.subpart,
          ].filter(Boolean);
          const orgLabel = orgParts.join(' · ');

          return (
            <div className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03] ${!isOnl ? 'opacity-55' : ''}`}>
              <div className="relative shrink-0">
                {isOnl && (
                  <span className="absolute inset-0 rounded-2xl bg-emerald-500/20 animate-ping" style={{animationDuration:'2s'}} />
                )}
                <div className={`relative w-10 h-10 rounded-2xl bg-gradient-to-br ${avatarGrad} flex items-center justify-center text-[13px] font-black text-white border border-white/5`}>
                  {person.name?.[0] || 'U'}
                </div>
                <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#242424] ${isOnl ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-[#3a3a3a]'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className={`text-[14px] font-bold truncate ${isOnl ? 'text-white' : 'text-slate-500'}`}>{person.name}</p>
                  {person.isGuest && <span className="text-[9px] bg-slate-700/80 text-slate-400 px-1.5 py-0.5 rounded-md font-bold">Guest</span>}
                </div>
                <p className="text-[11px] text-slate-500 truncate mt-0.5">{orgLabel}</p>
              </div>
              <div className="shrink-0">
                {isOnl ? (
                  <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-400/25 px-2.5 py-1.5 rounded-xl">
                    <span className="relative flex w-2 h-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full w-2 h-2 bg-emerald-500" />
                    </span>
                    <span className="text-[10px] font-bold text-emerald-400 tracking-wide">채팅중</span>
                  </div>
                ) : (
                  <>
                    {displayStatus === '처리중' && (
                      <div className="flex items-center gap-1 bg-orange-500/10 border border-orange-400/20 px-2 py-1 rounded-xl">
                        <Zap className="w-3 h-3 text-orange-400" />
                        <span className="text-[10px] font-bold text-orange-400">처리중</span>
                      </div>
                    )}
                    {displayStatus === '처리완료' && (
                      <div className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-400/20 px-2 py-1 rounded-xl">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span className="text-[10px] font-bold text-emerald-400">완료</span>
                      </div>
                    )}
                    {(displayStatus === '미참여' || !displayStatus) && (
                      <span className="text-[10px] font-medium text-[#555] tracking-wide">오프라인</span>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        };


        return (
          <div
            className="fixed inset-0 z-[500] flex items-end justify-center"
            onClick={() => setShowParticipantDropdown(false)}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div
              className="relative w-full max-w-lg bg-[#242424] rounded-t-3xl shadow-2xl overflow-hidden"
              style={{animation:'slideUp 0.28s cubic-bezier(0.32,0.72,0,1)'}}
              onClick={e => e.stopPropagation()}
            >
              <style>{`@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
              {/* 핸들 */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-white/20 rounded-full" />
              </div>
              {/* 헤더 */}
              <div className="px-5 pt-2 pb-3 flex items-center justify-between border-b border-[#242424]">
                <div>
                  <p className="text-base font-black text-white tracking-tight">참여자 목록</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {onlineList.length}명 채팅중 · 총 {allPeople.length}명
                  </p>
                </div>
                <button onClick={() => setShowParticipantDropdown(false)} className="p-2 rounded-full hover:bg-white/10 transition-colors">
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>
              {/* 리스트 */}
              <div className="overflow-y-auto" style={{maxHeight:'55vh',scrollbarWidth:'thin',scrollbarColor:'rgba(255,255,255,0.08) transparent'}}>
                {/* 채팅 참여중 */}
                <div className="px-5 pt-3 pb-1.5 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">채팅 참여중 {onlineList.length}명</span>
                </div>
                {onlineList.length > 0
                  ? onlineList.map((p, i) => <PersonRow key={`on-${i}`} person={p} idx={i} isOnline={true} />)
                  : <p className="px-5 py-3 text-[12px] text-slate-600 italic">현재 채팅중인 인원이 없습니다</p>
                }
                {/* 채팅 미참여 */}
                {offlineList.length > 0 && (
                  <>
                    <div className="mx-5 my-2 border-t border-[#242424]" />
                    <div className="px-5 pb-1.5 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-slate-600" />
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">채팅 미참여 {offlineList.length}명</span>
                    </div>
                    {offlineList.map((p, i) => <PersonRow key={`off-${i}`} person={p} idx={i} isOnline={false} />)}
                  </>
                )}
                {allPeople.length === 0 && (
                  <div className="py-12 text-center">
                    <Users className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                    <p className="text-sm text-slate-600">참여 데이터가 없습니다</p>
                  </div>
                )}
                <div className="h-3" />
              </div>
              {/* 초대 버튼 */}
              <div className="px-5 py-3 border-t border-[#242424] bg-[#191919]" style={{paddingBottom:'calc(env(safe-area-inset-bottom) + 12px)'}}>
                <button
                  onClick={() => { setShowParticipantDropdown(false); if (!isResolved) setShowInviteModal(true); }}
                  disabled={isResolved}
                  className={`w-full py-3 rounded-2xl text-[14px] font-bold transition-all ${isResolved ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white shadow-lg shadow-blue-900/30'}`}
                >
                  {isResolved ? '초대 불가 (종료됨)' : '+ 참여자 초대'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── 글로벌 토스트 (초대 결과 등) ── */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[600] pointer-events-none">
          <div className="bg-[#1e1e1e] border border-white/10 text-white text-[13px] font-bold px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2 whitespace-nowrap animate-in slide-in-from-top-3 duration-300">
            {toastMessage}
          </div>
        </div>
      )}

      {showFullDesc && roomDescription && (

        <div
          className="fixed inset-0 z-[210] flex items-end justify-center"
          onClick={() => setShowFullDesc(false)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-lg bg-[#1a2035] rounded-t-3xl border-t border-white/10 shadow-2xl animate-in slide-in-from-bottom-4 duration-300 pb-10"
            onClick={e => e.stopPropagation()}
          >
            {/* 핸들 */}
            <div className="flex justify-center pt-3 pb-4">
              <div className="w-10 h-1 bg-white/20 rounded-full" />
            </div>
            {/* 제목 */}
            <div className="px-5 mb-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">장애 ID</p>
                <p className="text-base font-black text-white">{incidentId?.replace('INC-', '')}</p>
              </div>
              <button onClick={() => setShowFullDesc(false)} className="p-2 rounded-full hover:bg-white/10">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            {/* 구분선 */}
            <div className="mx-5 h-px bg-white/5 mb-3" />
            {/* 문자 전체 내용 */}
            <div className="px-5 max-h-[50vh] overflow-y-auto" style={{scrollbarWidth:'thin',scrollbarColor:'rgba(255,255,255,0.08) transparent'}}>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-2">수신 문자 내용</p>
              <p className="text-[14px] text-slate-200 leading-relaxed whitespace-pre-wrap break-all">{roomDescription}</p>
            </div>
          </div>
        </div>
      )}

      {/* 🗨️ 길게 누르기 바텀시트 (카톡 스타일) */}
      {longPressMsg && (
        <div
          className="fixed inset-0 z-[200] flex items-end justify-center"
          onClick={() => setLongPressMsg(null)}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-lg bg-[#1a2035] rounded-t-3xl border-t border-white/10 shadow-2xl animate-in slide-in-from-bottom-4 duration-300 pb-safe"
            onClick={e => e.stopPropagation()}
          >
            {/* 핸들 */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-white/20 rounded-full" />
            </div>

            {/* 메시지 내용 상단 표시 */}
            <div className="mx-4 mb-3 px-4 py-3 bg-[#191919] rounded-2xl border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                  {longPressMsg.initials || longPressMsg.sender?.[0] || 'U'}
                </div>
                <span className="text-[12px] font-bold text-slate-300">{longPressMsg.sender}</span>
                <span className="text-[10px] text-slate-500 ml-auto">{longPressMsg.time}</span>
              </div>
              <div className="max-h-32 overflow-y-auto" style={{scrollbarWidth:'thin',scrollbarColor:'rgba(255,255,255,0.08) transparent'}}>
                <p className="text-[14px] text-white leading-relaxed break-all whitespace-pre-wrap">{longPressMsg.text}</p>
              </div>
            </div>

            {/* 이모지 리액션 바 */}
            <div className="flex justify-around px-6 py-3 border-y border-[#242424]">
              {['👍', '❤️', '😂', '🚨', '✅', '🙏', '💡', '😮'].map(emoji => (
                <button
                  key={emoji}
                  onClick={() => { handleAddReaction(longPressMsg.seq, emoji); setLongPressMsg(null); }}
                  className="flex flex-col items-center gap-1 active:scale-125 transition-transform"
                >
                  <span className="text-2xl">{emoji}</span>
                </button>
              ))}
            </div>

            {/* 액션 목록 */}
            <div className="divide-y divide-white/5">
              <button
                onClick={() => { setReplyTo(longPressMsg); setLongPressMsg(null); }}
                className="w-full flex items-center gap-4 px-6 py-3.5 hover:bg-white/5 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-full bg-blue-500/15 flex items-center justify-center">
                  <Plus className="w-4 h-4 text-blue-400" />
                </div>
                <span className="text-[15px] text-white font-medium">답장</span>
              </button>
              <button
                onClick={() => { handleToggleBookmark(longPressMsg); setLongPressMsg(null); }}
                className="w-full flex items-center gap-4 px-6 py-3.5 hover:bg-white/5 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-full bg-yellow-500/15 flex items-center justify-center">
                  <Star className={`w-4 h-4 ${longPressMsg.is_key_event ? 'text-yellow-400 fill-current' : 'text-yellow-400'}`} />
                </div>
                <span className="text-[15px] text-white font-medium">{longPressMsg.is_key_event ? '타임라인 해제' : '타임라인 등록'}</span>
              </button>
              <button
                onClick={() => setLongPressMsg(null)}
                className="w-full flex items-center gap-4 px-6 py-3.5 hover:bg-white/5 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-full bg-slate-700/50 flex items-center justify-center">
                  <X className="w-4 h-4 text-slate-400" />
                </div>
                <span className="text-[15px] text-slate-400 font-medium">취소</span>
              </button>
            </div>
            <div className="h-6" /> {/* safe area padding */}
          </div>
        </div>
      )}

      {/* Member Invitation Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowInviteModal(false)} />
          <div
            className="relative z-10 w-full flex flex-col animate-in slide-in-from-bottom-4 duration-300"
            style={{ maxWidth: 540, height: '90vh', backgroundColor: '#1a1a1a', borderRadius: '24px 24px 0 0', overflow: 'hidden' }}
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#3a3a3a' }} />
            </div>

            {/* Header */}
            <div className="px-5 pt-2 pb-4 shrink-0" style={{ borderBottom: '1px solid #2a2a2a' }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5" style={{ color: '#00236e' }} />
                  <h2 className="text-lg font-black text-white">대응 팀원 초대</h2>
                </div>
                <button
                  onClick={() => setShowInviteModal(false)}
                  style={{ padding: '6px', borderRadius: 12, backgroundColor: '#2a2a2a' }}
                >
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              {/* Search */}
              <div style={{ position: 'relative' }}>
                <Search style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: '#666' }} />
                <input
                  type="text"
                  placeholder="이름, 사번으로 검색..."
                  value={inviteSearchQuery}
                  onChange={(e) => {
                    setInviteSearchQuery(e.target.value);
                    searchUsers(e.target.value, selectedOrgId);
                  }}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    backgroundColor: '#242424', border: '1px solid #333',
                    borderRadius: 14, padding: '11px 16px 11px 40px',
                    color: '#fff', fontSize: 14, outline: 'none',
                    WebkitAppearance: 'none', appearance: 'none',
                    maxWidth: '100%'
                  }}
                />
              </div>

              {/* Tabs */}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => { setSelectedOrgId(null); searchUsers(inviteSearchQuery, null); }}
                  style={{
                    flex: 1, padding: '7px 0', borderRadius: 10, fontSize: 12, fontWeight: 700,
                    backgroundColor: !selectedOrgId ? '#00236e' : '#2a2a2a',
                    color: !selectedOrgId ? '#fff' : '#888',
                    border: 'none', cursor: 'pointer'
                  }}
                >
                  전체
                </button>
                {orgTree.slice(0, 1).map(top => (
                  top.children?.slice(0, 4).map(child => (
                    <button
                      key={child.code}
                      onClick={() => { setSelectedOrgId(child.code); searchUsers(inviteSearchQuery, child.code); }}
                      style={{
                        flex: 1, padding: '7px 4px', borderRadius: 10, fontSize: 11, fontWeight: 700,
                        backgroundColor: selectedOrgId === child.code ? '#00236e' : '#2a2a2a',
                        color: selectedOrgId === child.code ? '#fff' : '#888',
                        border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                      }}
                    >
                      {child.name?.replace(/^신한/, '')}
                    </button>
                  ))
                ))}
              </div>
            </div>

            {/* User List */}
            <div className="flex-1 overflow-y-auto" style={{ padding: '12px 16px' }}>
              {inviteSearchResults.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {inviteSearchResults
                    .filter(u => !participants.some(p => p.employee_id === u.employee_id))
                    .map(user => (
                      <div
                        key={user.employee_id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          backgroundColor: '#242424', borderRadius: 16,
                          padding: '12px 14px', border: '1px solid #333'
                        }}
                      >
                        {/* Avatar */}
                        <div style={{
                          width: 42, height: 42, borderRadius: 14, flexShrink: 0,
                          backgroundColor: '#333', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#FAE100'
                        }}>
                          {user.name?.[0] || 'U'}
                        </div>
                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: '#fff', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {user.name}
                          </div>
                          <div style={{ fontSize: 11, color: '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {[user.team_name, user.part_name || user.position].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                        {/* Invite button */}
                        <button
                          disabled={isInviting}
                          onClick={() => inviteUser(user)}
                          style={{
                            padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 800,
                            backgroundColor: '#FAE100', color: '#000', border: 'none',
                            cursor: isInviting ? 'not-allowed' : 'pointer',
                            opacity: isInviting ? 0.5 : 1, flexShrink: 0
                          }}
                        >
                          {isInviting ? '...' : '초대'}
                        </button>
                      </div>
                    ))}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, paddingTop: 40 }}>
                  <UserX style={{ width: 40, height: 40, color: '#444' }} />
                  <p style={{ color: '#666', fontSize: 14, textAlign: 'center' }}>
                    {inviteSearchQuery ? '검색 결과가 없습니다' : '이름이나 사번을 입력하세요'}
                  </p>
                  {inviteSearchQuery && (
                    <button
                      onClick={() => { setInviteSearchQuery(''); searchUsers('', selectedOrgId); }}
                      style={{ color: '#FAE100', fontSize: 12, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      검색 초기화
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Org tree - collapsible section at bottom */}
            <details style={{ padding: '0 16px 12px', borderTop: '1px solid #2a2a2a' }}>
              <summary style={{ padding: '12px 0', color: '#888', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Network style={{ width: 14, height: 14 }} />
                조직도로 찾기
              </summary>
              <div style={{ maxHeight: 200, overflowY: 'auto', paddingTop: 8 }}>
                <OrgTreeNodes
                  nodes={orgTree}
                  onNodeClick={(node) => {
                    setSelectedOrgId(node.code);
                    searchUsers(inviteSearchQuery, node.code);
                  }}
                  selectedId={selectedOrgId}
                />
              </div>
            </details>
          </div>
        </div>
      )}


      {/* Direct Message (Note) Modal */}
      {showDMModal && dmTargetUser && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowDMModal(false)} />
          <div className="bg-[#242424] w-full max-w-lg rounded-[2rem] border border-white/10 shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-300">
            <div className="p-5 border-b border-[#242424] flex items-center justify-between bg-gradient-to-r from-blue-600/10 to-transparent">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center font-bold text-blue-400">
                  {dmTargetUser.name[0]}
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">{dmTargetUser.name}님과의 쪽지</h3>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest">{dmTargetUser.role} • PRIVATE CHANNEL</p>
                </div>
              </div>
              <button onClick={() => setShowDMModal(false)} className="p-2 rounded-full hover:bg-white/5 transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#191919]/50">
              {dmHistory.length === 0 ? (
                <div className="text-center py-10">
                  <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                    <MessageSquare className="w-8 h-8 text-slate-600" />
                  </div>
                  <p className="text-sm text-slate-500">대화 내역이 없습니다.<br/>첫 쪽지를 보내보세요.</p>
                </div>
              ) : (
                dmHistory.map((dm) => (
                  <div key={dm.id} className={`flex ${dm.sender_id === currentUser.employee_id ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${dm.sender_id === currentUser.employee_id ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-800 text-slate-100 rounded-tl-none'}`}>
                      {dm.message}
                      <div className={`text-[9px] mt-1 opacity-50 ${dm.sender_id === currentUser.employee_id ? 'text-right' : 'text-left'}`}>
                        {new Date(dm.created_at).toLocaleTimeString().slice(0, 5)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-[#242424] bg-[#242424]">
              <div className="relative">
                <textarea
                  value={dmInput}
                  onChange={(e) => setDmInput(e.target.value)}
                  onKeyPress={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendDM(); }}}
                  placeholder="쪽지를 입력하세요..."
                  className="w-full bg-[#191919] border border-white/10 rounded-2xl py-0.5 px-4 pr-12 text-sm focus:outline-none focus:border-blue-500/50 resize-none min-h-[28px] h-[28px] flex items-center"
                />
                <button 
                  onClick={handleSendDM}
                  disabled={!dmInput.trim()}
                  className="absolute right-3 bottom-3 p-2 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-900/40 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-500 transition-all"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
           </div>
         </div>
       )}

      <style>{`
        #main-chat-input {
          padding-left: 8px !important;
          text-indent: 0 !important;
        }
      `}</style>
    </div>
  );
}

// Internal Orchart Node Component
function OrgTreeNodes({ nodes, onNodeClick, selectedId, level = 0 }) {
  const [expanded, setExpanded] = useState({});

  // Helper to check if a node or its descendants match the selectedId
  const containsSelected = useCallback((node, targetId) => {
    if (node.code === targetId) return true;
    if (node.children) {
      return node.children.some(child => containsSelected(child, targetId));
    }
    return false;
  }, []);

  // Auto-expand parents of selected node
  useEffect(() => {
    if (selectedId && nodes) {
      const newExpanded = { ...expanded };
      let changed = false;
      
      nodes.forEach(node => {
        if (node.children && node.children.length > 0) {
          const hasSelectedChild = node.children.some(child => containsSelected(child, selectedId));
          if (hasSelectedChild && !expanded[node.code]) {
            newExpanded[node.code] = true;
            changed = true;
          }
        }
      });
      
      if (changed) setExpanded(newExpanded);
    }
  }, [selectedId, nodes, containsSelected]);

  const toggleExpand = (code, e) => {
    e.stopPropagation();
    setExpanded(prev => ({ ...prev, [code]: !prev[code] }));
  };

  if (!nodes || nodes.length === 0) return null;

  return (
    <ul className={`space-y-1 ${level > 0 ? 'ml-4 border-l border-[#242424] pl-2' : ''}`}>
      {nodes.map(node => (
        <li key={node.code}>
          <div 
            onClick={() => onNodeClick(node)}
            className={`flex items-center gap-2 p-2 rounded-xl transition-all cursor-pointer group ${
              selectedId === node.code ? 'bg-blue-600/20 text-blue-400' : 'hover:bg-white/5 text-slate-400 hover:text-slate-200'
            }`}
          >
            {node.children && node.children.length > 0 ? (
              <button 
                onClick={(e) => toggleExpand(node.code, e)}
                className="p-1 hover:bg-white/10 rounded-lg transition-colors"
              >
                {expanded[node.code] ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
            ) : (
              <div className="w-4 ml-2" />
            )}
            <span className={`text-[13px] truncate ${selectedId === node.code ? 'font-black' : 'font-medium'}`}>
              {node.name}
            </span>
            {selectedId === node.code && <div className="w-2 h-2 rounded-full bg-blue-500 ml-auto shadow-lg shadow-blue-500/50" />}
          </div>
          {expanded[node.code] && node.children && (
            <OrgTreeNodes 
              nodes={node.children} 
              onNodeClick={onNodeClick} 
              selectedId={selectedId} 
              level={level + 1} 
            />
          )}
        </li>
      ))}
    </ul>
  );
}
