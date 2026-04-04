import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Phone, Menu, Plus, Send, Home, MessageSquare, BarChart, BarChart2, Settings, Info, AlertTriangle, ChevronDown, ChevronUp, Users, LogOut, FileText, UserPlus, Bot, Sparkles, Zap, X, Database, Paperclip, Image as ImgIcon, Shield, Server, User, Terminal, CheckCircle, Smile, Hash, Network, Megaphone, Star } from 'lucide-react';
import AIChatBubble from '../components/AIChatBubble';
import AIThinkingIndicator from '../components/AIThinkingIndicator';
import ServerStatusChart from '../components/chat/ServerStatusChart';
import MarkdownViewer from '../components/MarkdownViewer';

const agentColors = {
  Security: { bg: 'bg-red-500/15', border: 'border-red-500/30', text: 'text-red-400', icon: Shield },
  DB:       { bg: 'bg-purple-500/15', border: 'border-purple-500/30', text: 'text-purple-400', icon: Database },
  DevOps:   { bg: 'bg-green-500/15', border: 'border-green-500/30', text: 'text-green-400', icon: Server },
  Leader:   { bg: 'bg-amber-500/15', border: 'border-amber-500/30', text: 'text-amber-400', icon: Bot },
};

// API URL helper: /ai/ endpoints go to local FastAPI, others to Cloudflare Worker
const getApiUrl = (endpoint) => {
  const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (isLocalDev && endpoint.startsWith('/ai/')) {
    return `http://127.0.0.1:8000${endpoint}`;
  }
  return 'https://sguardai.khcho0421.workers.dev' + endpoint;
};

// 한국 시간(KST) 포맷팅 헬퍼
const formatKst = (dateInput) => {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return dateInput;

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');

  return `${yyyy}년 ${mm}월 ${dd}일 ${hh}:${min}:${ss}`;
};

export default function ChatPage() {
  const navigate = useNavigate();
  const [isLogExpanded, setIsLogExpanded] = useState(true);
  const [showPhoneList, setShowPhoneList] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [aiMessages, setAiMessages] = useState([]);
  const [activeAiTab, setActiveAiTab] = useState('chat'); // 'chat' or 'timeline'
  const [userInput, setUserInput] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [showFullAnalysis, setShowFullAnalysis] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [roomTitle, setRoomTitle] = useState('');
  const [roomDescription, setRoomDescription] = useState('');
  const [roomStatus, setRoomStatus] = useState('Open');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]); // Array of { name, url, type, file }
  const [showWarRoomPopup, setShowWarRoomPopup] = useState(false);
  const [showAgentInsights, setShowAgentInsights] = useState(true);
  const [showAnalysisSummary, setShowAnalysisSummary] = useState(true);
  const [warRooms, setWarRooms] = useState([]);
  const [showWipToast, setShowWipToast] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [participants, setParticipants] = useState([]);
  const [showParticipantDropdown, setShowParticipantDropdown] = useState(false);
  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);


  // Main Chat State
  const [mainMessages, setMainMessages] = useState([]);
  const [mainInput, setMainInput] = useState('');
  const { incidentId: paramId } = useParams();
  const incidentId = paramId || 'INC-8823';
  
  const [currentUser, setCurrentUser] = useState({ 
    employee_id: 'EMP-1234', // Local mock ID for initial state
    name: '이수민 매니저', 
    role: 'Manager' 
  });

  const [relatedData, setRelatedData] = useState({ history: [], reports: [] });

  useEffect(() => {
    const userStr = localStorage.getItem('sguard_user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setCurrentUser({
          employee_id: user.employee_id || user.id || 'EMP-1234',
          name: user.name || '이수민 매니저',
          role: user.role || 'Manager'
        });
      } catch (e) { console.error("User parse error", e); }
    }
  }, []);

  // Fetch related history based on room title/description (with AbortController)
  useEffect(() => {
    const controller = new AbortController();
    if (roomTitle || roomDescription) {
      const q = (roomTitle + " " + roomDescription).substring(0, 100);
      fetch(getApiUrl(`/ai/related-history?q=${encodeURIComponent(q)}`), { signal: controller.signal })
        .then(res => res.ok ? res.json() : { history: [], reports: [] })
        .then(data => setRelatedData(data || { history: [], reports: [] }))
        .catch(err => {
          if (err.name === 'AbortError') return;
          console.warn("Related history fetch error (suppressed):", err);
          setRelatedData({ history: [], reports: [] });
        });
    }
    return () => controller.abort();
  }, [roomTitle, roomDescription]);


  // Load chat history (reusable for polling)
  const fetchChatHistory = React.useCallback(async (isAutoPoll = false) => {
    if (!isAutoPoll) setIsLoading(true);
    try {
      const res = await fetch(getApiUrl(`/warroom/chat/${incidentId}`));
      if (res.ok) {
        const data = await res.json();
        setRoomTitle(data.title || incidentId);
        setRoomDescription(data.description || '');
        setRoomStatus(data.status || 'Open');
        
        const loadedMessages = data.messages.map(msg => ({
          id: `${msg.inc_id}_${msg.seq}`,
          seq: msg.seq,
          type: msg.type === 'me' || msg.sender === currentUser.name ? 'me' : 
               (msg.type === 'system' ? 'system' : 
               (msg.type === 'ai_analysis' ? 'ai_analysis' : 'other')),
          sender: msg.sender,
          role: msg.role,
          initials: msg.sender ? msg.sender[0] : 'SY',
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
        }));

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
      console.error("Failed to load chat history", err);
    } finally {
      if (!isAutoPoll) {
        setIsLoading(false);
      }
    }
  }, [incidentId, currentUser.name]);

  const fetchParticipants = React.useCallback(async () => {
    try {
      const res = await fetch(getApiUrl(`/warroom/participants/${incidentId}`));
      if (res.ok) {
        const data = await res.json();
        setParticipants(data.participants || []);
      }
    } catch (e) {
      console.error('Failed to fetch participants', e);
    }
  }, [incidentId]);

  const [aiAnalysisMessage, setAiAnalysisMessage] = useState(null);
  
  // Real-time State (DO/WS)
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [remoteTyping, setRemoteTyping] = useState({}); // { user_id: { name, is_typing } }
  const [replyTo, setReplyTo] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDMModal, setShowDMModal] = useState(false);
  const [dmTargetUser, setDmTargetUser] = useState(null);
  const [dmHistory, setDmHistory] = useState([]);
  const [dmInput, setDmInput] = useState('');
  const [activeReactionMsg, setActiveReactionMsg] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [pinnedMessage, setPinnedMessage] = useState(null);
  const [showPinned, setShowPinned] = useState(true);
  
  const wsRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // AI Assistant SSE streaming + typewriter
  const aiAbortRef = useRef(null);
  const aiTypingTimerRef = useRef(null);
  const aiQueueRef = useRef('');

  const stopAiTypewriter = () => {
    if (aiTypingTimerRef.current) {
      clearInterval(aiTypingTimerRef.current);
      aiTypingTimerRef.current = null;
    }
    aiQueueRef.current = '';
  };

  useEffect(() => {
    // When messages load, mark those with read_count > 0 as read (if not from us)
    if (mainMessages.length > 0 && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      mainMessages.forEach(msg => {
        if (msg.read_count > 0 && msg.sender !== currentUser.name) {
          wsRef.current.send(JSON.stringify({
            type: "MARK_READ",
            incident_id: incidentId,
            seq: msg.seq,
            user_id: currentUser.employee_id
          }));
        }
      });
    }
  }, [mainMessages.length, currentUser.name, currentUser.employee_id, incidentId]);



  // Fetch active War-Rooms for the popup list
  const fetchWarRooms = async () => {
    try {
      const res = await fetch(getApiUrl('/warroom/rooms'));
      if (res.ok) {
        const data = await res.json();
        setWarRooms(data.rooms || []);
      }
    } catch (e) {
      console.error('Failed to fetch war rooms', e);
    }
  };

  const handleWarRoomNavClick = () => {
    fetchWarRooms();
    setShowWarRoomPopup(prev => !prev);
  };


  // WebSocket Connection Logic
  useEffect(() => {
    let socket;
    let reconnectTimer;
    let isMounted = true;

    const connect = () => {
      if (!isMounted) return;
      
      const wsUrl = `wss://sguardai.khcho0421.workers.dev/warroom/ws/${incidentId}`;
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
            name: currentUser.name
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
                  type: data.sender === currentUser.name ? 'me' : 'other',
                  sender: data.sender,
                  role: data.role,
                  initials: data.sender ? data.sender[0] : 'U',
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
                return [...prev, newMessage];
              });
              if (data.sender !== currentUser.name && wsRef.current?.readyState === WebSocket.OPEN) {
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
              if (data.announcement) setPinnedMessage(data.announcement);
              break;
            case 'ANNOUNCEMENT_UPDATE':
              setPinnedMessage(data.announcement);
              setShowPinned(true);
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
            case 'DM_NOTIFICATION':
              if (data.receiver_id === currentUser.employee_id) {
                setNotifications(prev => [...prev, { id: Date.now(), type: 'DM', from: data.sender_name, message: data.message }]);
                if (showDMModal && dmTargetUser?.employee_id === data.sender_id) fetchDMHistory(data.sender_id);
              }
              break;
            case 'READ_UPDATE':
              setMainMessages(prev => prev.map(m => (m.seq === data.seq) ? { ...m, read_count: Math.max(0, (m.read_count || 1) - 1) } : m));
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
        console.error("WebSocket error:", err);
      };
    };

    connect();

    return () => {
      isMounted = false;
      clearTimeout(reconnectTimer);
      if (socket) {
        // Prevent "closed before connection established" error
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
          socket.close();
        }
      }
    };
  }, [incidentId, currentUser.name, currentUser.employee_id]);

  const handleSetAnnouncement = (msg) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "SET_ANNOUNCEMENT",
        incident_id: incidentId,
        seq: msg.seq,
        sender: msg.sender,
        text: msg.text
      }));
    }
  };

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
      const res = await fetch(getApiUrl(`/warroom/ai-search?q=${encodeURIComponent(query)}`));
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results || []);
      }
    } catch (e) {
      console.error('AI Search failed', e);
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
        headers: { 'Content-Type': 'application/json' },
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
          time: formatKst(new Date())
        };
        setMainMessages(prev => [...prev, newMessage]);
        if (newMessage.type === 'ai_analysis') setAiAnalysisMessage(newMessage);
      }
    } catch (err) {
      console.error("Failed to save chat", err);
    }
  };

  const handleCall = (phoneNumber) => {
    window.location.href = `tel:${phoneNumber}`;
    setShowPhoneList(false);
  };

  // AI Assistant Logic
  const quickActions = [
    { id: 'status', label: '현재 서버 상태 알려줘', icon: BarChart2 },
    { id: 'error', label: '이 에러 원인 분석해줘', icon: AlertTriangle },
    { id: 'history', label: '유사 장애 이력 찾아줘', icon: FileText },
    { id: 'action', label: '조치 방법 추천해줘', icon: Zap }
  ];

  const handleAIMessage = async (message) => {
    if (!message.trim()) return;

    // Add user message
    const userMessage = {
      type: 'user',
      text: message,
      timestamp: new Date()
    };
    
    setAiMessages(prev => [...prev, userMessage]);
    setUserInput('');
    setIsAiThinking(true);

    try {
      // cancel previous AI request
      if (aiAbortRef.current) aiAbortRef.current.abort();
      const controller = new AbortController();
      aiAbortRef.current = controller;

      stopAiTypewriter();

      // create placeholder AI message to stream into
      const aiMsgId = Date.now() + Math.random();
      setAiMessages(prev => [...prev, { id: aiMsgId, type: 'ai', text: '', timestamp: new Date() }]);

      const apiResponse = await fetch(getApiUrl('/ai/chat'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: message }),
        signal: controller.signal,
      });
      
      if (!apiResponse.ok || !apiResponse.body) throw new Error(`API Error: ${apiResponse.status}`);

      const reader = apiResponse.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const enqueue = (text) => {
        if (!text) return;
        aiQueueRef.current += text;
        if (aiTypingTimerRef.current) return;
        aiTypingTimerRef.current = setInterval(() => {
          if (!aiQueueRef.current.length) {
            clearInterval(aiTypingTimerRef.current);
            aiTypingTimerRef.current = null;
            return;
          }
          const ch = aiQueueRef.current[0];
          aiQueueRef.current = aiQueueRef.current.slice(1);
          setAiMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: (m.text || '') + ch } : m));
        }, 18);
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const evt of events) {
          const lines = evt.split('\n');
          for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            const dataStr = line.slice(5).trim();
            if (!dataStr) continue;
            if (dataStr === '[DONE]') {
              return;
            }
            try {
              const data = JSON.parse(dataStr);
              if (data.error) {
                setAiMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: 'AI 분석이 지연되고 있습니다' } : m));
                stopAiTypewriter();
                return;
              }
              if (data.answer) enqueue(data.answer);
            } catch (e) {}
          }
        }
      }
    } catch (error) {
      console.error("Failed to connect to AI backend:", error);
      setAiMessages(prev => [...prev, { type: 'ai', text: "AI 분석이 지연되고 있습니다", timestamp: new Date() }]);
    } finally {
      setIsAiThinking(false);
    }
  };

  const handleQuickAction = (action) => {
    handleAIMessage(action.label);
  };

  const handleCopyMessage = (text) => {
    navigator.clipboard.writeText(text);
    alert('메시지가 클립보드에 복사되었습니다.');
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
    setShowAIAssistant(false);
  };

  const renderMessageContent = (text, isMe = false) => {
    if (typeof text === 'string' && text.includes('[첨부파일]')) {
      // Find the start of the tag if there's other text (though backend currently sends it alone)
      const tagIndex = text.indexOf('[첨부파일]');
      const tagContent = text.substring(tagIndex + 6).trim();
      const parts = tagContent.split('|');
      
      if (parts.length >= 3) {
        const [filename, url, type] = parts;
        const apiBase = 'https://sguardai.khcho0421.workers.dev';
        const fullUrl = url.startsWith('http') ? url : `${apiBase}${url}`;
        
        if (type.startsWith('image/')) {
          return (
            <div className="flex flex-col space-y-2 py-1">
              <div className={`text-[10px] flex items-center gap-1 mb-0.5 ${isMe ? 'text-blue-100/80' : 'text-slate-400/80'}`}>
                <ImgIcon className="w-3 h-3" />
                이미지 첨부됨
              </div>
              <img 
                src={fullUrl} 
                alt={filename} 
                className="max-w-full rounded-lg border border-white/10 hover:opacity-90 cursor-pointer transition-opacity shadow-sm" 
                onClick={() => window.open(fullUrl, '_blank')}
              />
              <span className={`text-[10px] truncate pt-1 ${isMe ? 'text-blue-200' : 'text-slate-500'}`}>{filename}</span>
            </div>
          );
        } else {
          return (
            <div 
              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all group ${
                isMe ? 'bg-white/10 border-white/10 hover:bg-white/20' : 'bg-black/20 border-white/5 hover:bg-black/30'
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
    return text;
  };

  const renderAttachment = (attachment, isMe) => {
    if (!attachment) return null;
    const { name, url, type } = attachment;
    
    if (type && type.startsWith('image/')) {
      return (
        <div className="flex flex-col space-y-2 py-1 max-w-full">
          <div className={`text-[10px] flex items-center gap-1 mb-0.5 ${isMe ? 'text-blue-100/80' : 'text-slate-400/80'}`}>
            <ImgIcon className="w-3 h-3" />
            이미지
          </div>
          <img 
            src={url} 
            alt={name} 
            className="max-w-full rounded-lg border border-white/10 hover:opacity-90 cursor-pointer transition-opacity shadow-sm" 
            onClick={() => window.open(url, '_blank')}
          />
          <span className={`text-[10px] truncate pt-0.5 ${isMe ? 'text-blue-200' : 'text-slate-500'}`}>{name}</span>
        </div>
      );
    }
    
    return (
      <div 
        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all group ${
          isMe ? 'bg-white/10 border-white/10 hover:bg-white/20' : 'bg-black/20 border-white/5 hover:bg-black/30'
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
          const uploadRes = await fetch(`${apiBase}/warroom/upload`, { method: 'POST', body: formData });
          if (uploadRes.ok) {
            const uploadData = await uploadRes.json();
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({
                type: "CHAT_SEND",
                incident_id: incidentId,
                sender: currentUser.name,
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
            sender: currentUser.name,
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

  const handleResolveOnly = async () => {
    if (!window.confirm('보고서 생성 없이 장애를 즉시 완료 처리하시겠습니까? (통계에 반영됩니다)')) return;
    try {
      const res = await fetch(getApiUrl('/warroom/resolve-only'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      const res = await fetch(getApiUrl(`/warroom/dm/${otherId}?my_id=${currentUser.employee_id}`));
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
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
      <div className="fixed inset-0 z-[100] bg-[#0f1421] flex flex-col items-center justify-center space-y-6">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-blue-400 animate-pulse" />
        </div>
        <div className="flex flex-col items-center space-y-2">
          <h2 className="text-xl font-black text-white tracking-widest uppercase">Initializing War-Room</h2>
          <div className="flex items-center space-x-2 text-slate-500 font-mono text-xs">
            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
            <span>데이터를 안전하게 불러오는 중... 조회를 잠시만 기다려주세요</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-[#0f1421] text-white font-sans flex flex-col relative">
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

      <header className="flex justify-between items-center p-4 sticky top-0 bg-[#0f1421]/90 backdrop-blur-md z-50 border-b border-white/5">
        <div className="flex items-center space-x-3">
          <button onClick={() => navigate(-1)} className="p-1 rounded-full hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <div className="flex flex-col">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-lg">
                {roomTitle || (incidentId?.startsWith('INC-') ? incidentId : `INC-${incidentId}`)}
              </span>
              <span className="bg-red-500/20 text-red-500 text-[10px] font-bold px-2 py-0.5 rounded border border-red-500/30 uppercase tracking-tighter">
                CRITICAL
              </span>
            </div>
            {roomDescription && (
              <span className="text-slate-400 text-[11px] truncate max-w-[200px]">{roomDescription}</span>
            )}
            <span className="text-slate-500 text-[10px]">장애 협업 채팅방 ({participants.length}명)</span>
          </div>
        </div>
        <div className="flex items-center space-x-4 relative">
          <button 
            onClick={() => {
              if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: "SUMMARY_REQUEST", incident_id: incidentId }));
                alert('AI 요약을 요청했습니다. 잠시만 기다려주세요.');
              }
            }}
            className="flex items-center px-3 py-1.5 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-lg text-xs font-bold hover:bg-purple-500/30 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5 animate-pulse" />
            AI 요약 요청
          </button>
          <button 
            onClick={() => navigate(`/chat-summary/${incidentId}`)}
            className="flex items-center px-3 py-1.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-bold hover:bg-blue-500/30 transition-colors"
          >
            <FileText className="w-3.5 h-3.5 mr-1.5" />
            채팅 요약
          </button>
          <button 
            onClick={handleResolveIncident}
            className="flex items-center px-3 py-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-bold hover:bg-emerald-500/30 transition-colors animate-pulse"
          >
            Resolve
          </button>
          <div className="relative">
            <button 
              className="p-2 rounded-full hover:bg-white/10 transition-colors relative flex items-center justify-center" 
              onClick={() => setShowParticipantDropdown(!showParticipantDropdown)}
              title="참여 사용자 목록"
            >
              <Users className="w-5 h-5 text-white" />
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold border border-[#0f1421]">
                {participants.length}
              </span>
            </button>

            {/* Participants Dropdown */}
            {showParticipantDropdown && (
              <div className="absolute top-12 right-0 w-64 bg-[#1a1f2e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-[100] animate-in slide-in-from-top-2 duration-200">
                <div className="p-3 border-b border-white/5 bg-[#11141d] flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">현재 참여자 ({participants.length})</span>
                  <button onClick={() => setShowParticipantDropdown(false)}><X className="w-3 h-3 text-slate-500" /></button>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {participants.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500">참여자가 없습니다.</div>
                  ) : (
                    participants.map((person, index) => (
                      <div key={index} className="flex items-center space-x-3 p-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-xs font-bold border border-white/5">
                          {person.name?.[0] || 'U'}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5 text-left">
                            <span className="text-sm font-bold text-white truncate">{person.name}</span>
                            <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20">{person.position || '담당'}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 truncate text-left">{person.company || '신한DS'} / {person.role || '협업자'}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="p-2 bg-[#11141d] border-t border-white/5">
                  <button 
                    onClick={() => alert('사용자 초대 대화상자가 열립니다.')}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[11px] font-bold transition-colors shadow-lg shadow-blue-900/20"
                  >
                    참여자 초대하기
                  </button>
                </div>
              </div>
            )}
          </div>

          <button className="p-2 rounded-full hover:bg-white/10 transition-colors relative" onClick={() => setShowPhoneList(!showPhoneList)}>
            <Phone className="w-5 h-5 text-white" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full border border-[#0f1421]"></span>
          </button>
          <button className="p-2 rounded-full hover:bg-white/10 transition-colors" onClick={() => setShowMenu(!showMenu)}>
            <Menu className="w-5 h-5 text-white" />
          </button>

          {/* Phone List Dropdown */}
          {showPhoneList && (
            <div className="absolute top-12 right-12 w-64 bg-[#1a1f2e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50">
                <div className="p-3 border-b border-white/5 bg-[#11141d]">
                    <span className="text-xs font-bold text-slate-300">통화 대상 선택</span>
                </div>
                <div className="max-h-60 overflow-y-auto">
                    {participants.map((person, index) => (
                        <div key={index} onClick={() => handleCall(person.phone)} className="flex items-center justify-between p-3 hover:bg-white/5 cursor-pointer transition-colors border-b border-white/5 last:border-0">
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
            <div className="absolute top-12 right-0 w-48 bg-[#1a1f2e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50">
                <div 
                    onClick={() => { alert('사용자 초대 기능이 실행됩니다.'); setShowMenu(false); }}
                    className="flex items-center space-x-3 p-3 hover:bg-white/5 cursor-pointer transition-colors border-b border-white/5"
                >
                    <UserPlus className="w-4 h-4 text-blue-400" />
                    <span className="text-sm text-slate-200">초대하기</span>
                </div>
              <div 
                onClick={() => { if(confirm('대화방을 나가시겠습니까?')) navigate('/dashboard'); }}
                className="flex items-center space-x-3 p-3 hover:bg-red-500/10 cursor-pointer transition-colors"
              >
                <LogOut className="w-4 h-4 text-red-400" />
                <span className="text-sm text-red-400">나가기</span>
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Sidebar */}
        <div className={`hidden lg:flex flex-col w-[380px] bg-[#0f1421] border-r border-white/5 transition-all duration-300 overflow-hidden shrink-0 ${!isLogExpanded ? 'w-0 border-none' : ''}`}>
          <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar relative">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" />
                <span className="text-[10px] font-black text-slate-500 tracking-widest uppercase">Expert Panel</span>
              </div>
            </div>
            <div className="space-y-3">
              {participants.map((person, index) => (
                <div key={index} className="flex items-center space-x-3 p-3 bg-white/5 rounded-2xl border border-white/5 hover:border-blue-500/30 transition-all cursor-pointer group">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-xs font-bold border border-white/5 group-hover:scale-105 transition-transform text-center">
                    {person.name?.[0] || 'U'}
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-left">
                      <span className="text-sm font-bold text-white truncate">{person.name}</span>
                      <span className="text-[9px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20">{person.position || '담당'}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 truncate text-left">{person.company || '신한DS'} / {person.role || '협업자'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Chat Column */}
        <div className="flex-1 flex flex-col h-full overflow-hidden relative">
          
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

          {/* [S-AutoPilot Insight] Area */}
          <div className="bg-[#0f1421]/95 border-b border-white/10 backdrop-blur-xl z-20 shadow-2xl shrink-0">
            <style>{`
              @keyframes sguard-twinkle {
                0%, 100% { text-shadow: 0 0 4px rgba(59, 130, 246, 0.4); color: #fff; }
                50% { text-shadow: 0 0 15px rgba(59, 130, 246, 0.9), 0 0 20px rgba(59, 130, 246, 0.4); color: #60a5fa; transform: scale(1.05); }
              }
              .animate-sguard-twinkle {
                animation: sguard-twinkle 1.5s ease-in-out infinite;
                display: inline-block;
              }
            `}</style>
            <div className="px-5 py-4">
                <div 
                    onClick={() => setIsLogExpanded(!isLogExpanded)}
                    className="flex items-center justify-between cursor-pointer group mb-1"
                >
                    <div className="flex items-center space-x-2.5">
                        <div className="bg-gradient-to-br from-purple-600 to-blue-600 p-2 rounded-xl shadow-lg shadow-purple-900/30">
                          <Sparkles className="w-4 h-4 text-white animate-pulse" />
                        </div>
                        <div>
                          <h2 className="text-sm font-black text-white tracking-tight uppercase">[S-AutoPilot Insight]</h2>
                          <p className="text-[10px] text-slate-500 font-bold tracking-widest">REAL-TIME INTELLIGENCE COMMAND</p>
                        </div>
                    </div>
                    <button className="p-2 rounded-full hover:bg-white/10 transition-all border border-white/5 hover:border-white/20">
                        {isLogExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </button>
                </div>
                
                {isLogExpanded && (
                    <div className="mt-4 space-y-4 animate-in slide-in-from-top-4 duration-300">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 flex flex-col items-center justify-center space-y-1 group hover:border-blue-500/30 transition-all flex-1 text-center">
                            <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider">대응 전문가진</span>
                            <div className="flex flex-wrap items-center justify-center gap-2">
                              <User className="w-4 h-4 text-blue-400" />
                              <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
                                {participants.length > 0 ? (
                                    participants.map((p, i) => (
                                        <span key={p.id || i} className="text-sm font-black animate-sguard-twinkle tracking-tighter">
                                            {p.name}{i < participants.length - 1 ? ',' : ''}
                                        </span>
                                    ))
                                ) : (
                                    <span className="text-sm font-black animate-sguard-twinkle tracking-tighter">
                                        {currentUser.name}
                                    </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 flex flex-col items-center justify-center space-y-1 text-center">
                            <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider">현재 처리 상태</span>
                            <div className="flex items-center gap-2 text-emerald-400 justify-center">
                              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                              <span className="text-base font-black tracking-tight">{roomStatus || 'Open'}</span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-purple-900/10 border border-purple-500/30 rounded-[1.5rem] overflow-hidden shadow-xl shadow-purple-900/10">
                            <button 
                              onClick={() => setShowAnalysisSummary(!showAnalysisSummary)}
                              className="w-full bg-purple-500/10 px-4 py-2 border-b border-purple-500/20 flex justify-between items-center group transition-colors hover:bg-purple-500/20"
                            >
                              <div className="flex items-center gap-2">
                                <Sparkles className={`w-3 h-3 ${showAnalysisSummary ? 'text-purple-400' : 'text-slate-500'}`} />
                                <span className={`text-[10px] font-black tracking-widest ${showAnalysisSummary ? 'text-purple-400' : 'text-slate-500'}`}>AI ANALYSIS SUMMARY</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {showAnalysisSummary ? (
                                  <>
                                    <span className="flex h-2 w-2 relative">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
                                    </span>
                                    <ChevronUp className="w-3.5 h-3.5 text-slate-500 group-hover:text-purple-400 transition-colors" />
                                  </>
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5 text-slate-500 group-hover:text-purple-400 transition-colors" />
                                )}
                              </div>
                            </button>

                            {showAnalysisSummary && (
                              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="p-4 text-[13px] leading-relaxed relative border-b border-purple-500/10 text-left">
                                  <div className={`text-slate-200 transition-all duration-300 ${!showFullAnalysis ? 'max-h-24 overflow-hidden' : ''}`}>
                                    <MarkdownViewer text={aiAnalysisMessage?.text || roomDescription || '장애 내용을 포함한 실시간 지식 분석을 기다리고 있습니다...'} />
                                  </div>
                                  {(aiAnalysisMessage?.text || roomDescription) && (
                                    <button 
                                      onClick={() => setShowFullAnalysis(!showFullAnalysis)}
                                      className="mt-3 text-[10px] text-purple-400 font-black uppercase tracking-wider hover:text-purple-300 flex items-center gap-1"
                                    >
                                      {showFullAnalysis ? "Collapse" : "Show Full Insight"}
                                    </button>
                                  )}
                                </div>
                                
                                {/* ── Agent Intelligence Logs (Collapsible) ── */}
                                <div className="p-4 space-y-3 bg-black/20 text-left">
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setShowAgentInsights(!showAgentInsights);
                                    }}
                                    className="flex items-center justify-between w-full group"
                                  >
                                    <div className="flex items-center gap-2">
                                      <Bot className={`w-3.5 h-3.5 ${showAgentInsights ? 'text-purple-400' : 'text-slate-500'}`} />
                                      <span className={`text-[10px] font-black uppercase tracking-widest ${showAgentInsights ? 'text-purple-400' : 'text-slate-500'}`}>Agent Insights</span>
                                      {!showAgentInsights && mainMessages.filter(m => m.type === 'ai_analysis' && m.role !== 'Leader').length > 0 && (
                                        <span className="flex h-1.5 w-1.5 rounded-full bg-purple-500 animate-pulse ml-1"></span>
                                      )}
                                    </div>
                                    {showAgentInsights ? (
                                      <ChevronUp className="w-3.5 h-3.5 text-slate-500 group-hover:text-purple-400 transition-colors" />
                                    ) : (
                                      <ChevronDown className="w-3.5 h-3.5 text-slate-500 group-hover:text-purple-400 transition-colors" />
                                    )}
                                  </button>
                                  
                                  {showAgentInsights && (
                                    <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1 animate-in fade-in slide-in-from-top-2 duration-300 custom-scrollbar">
                                      {mainMessages
                                        .filter(m => m.type === 'ai_analysis' && m.role !== 'Leader')
                                        .map((log, i) => {
                                          const cfg = agentColors[log.role] || agentColors.Leader;
                                          const Icon = cfg.icon;
                                          return (
                                            <div key={i} className={`rounded-xl border p-3 ${cfg.bg} ${cfg.border} animate-in slide-in-from-right-2 duration-300 text-left`}>
                                              <div className="flex items-center gap-2 mb-1.5">
                                                <Icon className={`w-3.5 h-3.5 ${cfg.text}`} />
                                                <span className={`text-[11px] font-bold ${cfg.text}`}>{log.role} Agent</span>
                                                <span className="ml-auto text-[9px] text-slate-500">{log.time}</span>
                                              </div>
                                              <div className="text-[12px] text-slate-300 leading-normal">
                                                <MarkdownViewer text={log.text} />
                                              </div>
                                            </div>
                                          );
                                        })}
                                      
                                      {mainMessages.filter(m => m.type === 'ai_analysis' && m.role !== 'Leader').length === 0 && (
                                        <p className="text-[11px] text-slate-600 italic py-2">대기 중인 에이전트 로그가 없습니다.</p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="bg-blue-900/10 border border-blue-500/20 rounded-2xl p-4 space-y-3">
                            <div className="flex items-center gap-2 mb-1">
                              <MessageSquare className="w-4 h-4 text-blue-400" />
                              <span className="text-[11px] font-black text-blue-400 tracking-tight text-left">관련 워룸 히스토리</span>
                            </div>
                            <div className="space-y-2">
                              {relatedData?.history?.slice(0, 3).map((h, i) => (
                                <div key={i} onClick={() => h.id !== incidentId && navigate(`/chat/${h.id}`)} className="p-2.5 bg-black/20 rounded-xl border border-white/5 hover:border-blue-500/30 transition-all cursor-pointer group">
                                  <p className="text-[11px] font-bold text-slate-200 truncate group-hover:text-blue-300 text-left">{h.title || h.id}</p>
                                </div>
                              ))}
                              {(!relatedData?.history || relatedData.history.length === 0) && (
                                <p className="text-[10px] text-slate-600 italic text-left">검색된 유사 워룸이 없습니다</p>
                              )}
                            </div>
                          </div>

                          <div className="bg-emerald-900/10 border border-emerald-500/20 rounded-2xl p-4 space-y-3">
                            <div className="flex items-center gap-2 mb-1">
                              <FileText className="w-4 h-4 text-emerald-400" />
                              <span className="text-[11px] font-black text-emerald-400 tracking-tight text-left">관련 지식 보고서</span>
                            </div>
                            <div className="space-y-2">
                              {relatedData?.reports?.slice(0, 3).map((r, i) => (
                                <div key={i} onClick={() => window.open(r.url, '_blank')} className="p-2.5 bg-black/20 rounded-xl border border-white/5 hover:border-emerald-500/30 transition-all cursor-pointer group">
                                  <p className="text-[11px] font-bold text-slate-200 truncate group-hover:text-emerald-300 text-left">{r.title}</p>
                                </div>
                              ))}
                              {(!relatedData?.reports || relatedData.reports.length === 0) && (
                                <p className="text-[10px] text-slate-600 italic text-left">연동된 지식 자산이 없습니다</p>
                              )}
                            </div>
                          </div>
                        </div>
                    </div>
                )}
            </div>
          </div>

          {/* Chat Messages Area (THE ONLY SCROLLABLE PART) */}
          <main ref={scrollRef} className="flex-1 p-4 space-y-6 overflow-y-auto relative custom-scrollbar pb-10">
        
        {/* Pinned Announcement Bar */}
        {pinnedMessage && showPinned && (
          <div className="sticky top-0 z-40 mb-4 animate-in slide-in-from-top-4 duration-300">
            <div className="bg-[#1e2538]/95 backdrop-blur-md border border-blue-500/30 rounded-2xl p-3 shadow-xl shadow-blue-900/20 flex items-center justify-between group">
              <div 
                className="flex items-center gap-3 flex-1 cursor-pointer overflow-hidden"
                onClick={() => {
                  const el = document.getElementById(`msg-seq-${pinnedMessage.seq}`);
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
              >
                <div className="bg-blue-500/20 p-2 rounded-xl">
                  <Megaphone className="w-4 h-4 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Announcement</span>
                    <span className="text-[9px] text-slate-500">• {pinnedMessage.sender}</span>
                  </div>
                  <p className="text-sm text-slate-200 truncate font-medium">{pinnedMessage.text}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowPinned(false)}
                className="p-1.5 hover:bg-white/5 rounded-full text-slate-500 transition-colors"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {!showPinned && pinnedMessage && (
          <button 
            onClick={() => setShowPinned(true)}
            className="sticky top-0 z-40 mb-4 ml-auto block bg-blue-600/20 border border-blue-500/30 p-1.5 rounded-full text-blue-400 hover:bg-blue-600/30 transition-all shadow-lg"
          >
            <Megaphone className="w-4 h-4" />
          </button>
        )}

        {/* 상단 하드코딩 안내 메시지 (DB 저장 없이 UI에만 표시) */}
        <div className="flex flex-col items-center justify-center py-4 mb-6 animate-in fade-in slide-in-from-top-1 duration-700">
          <div className="bg-blue-600/10 border border-blue-500/20 rounded-2xl px-6 py-3 flex items-center gap-3 shadow-lg shadow-blue-900/5">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
              <Info className="w-4 h-4 text-blue-400" />
            </div>
            <div className="flex flex-col">
              <p className="text-[13px] font-bold text-blue-100 leading-tight">War-Room 채팅방이 생성되었습니다.</p>
              <p className="text-[11px] text-blue-400/80 mt-0.5">모든 대화 내용은 장애 해결 시 AI 학습에 사용됩니다.</p>
            </div>
          </div>
          <div className="w-px h-8 bg-gradient-to-b from-blue-500/20 to-transparent mt-2" />
        </div>

        {mainMessages.filter(msg => msg.type !== 'ai_analysis').map((msg) => (
          <div key={msg.inc_id || msg.id} id={`msg-seq-${msg.seq}`}>
            {msg.type === 'other' && (
              <div className="flex items-start space-x-3 mb-4 group">
                <div className={`px-2 py-1 h-10 min-w-[40px] rounded-xl ${msg.color} flex items-center justify-center font-bold text-xs shrink-0 whitespace-nowrap`}>
                  {msg.initials}
                </div>
                <div className="flex flex-col space-y-1">
                  <span className="text-xs text-slate-400 font-medium">{msg.sender}</span>
                  <div className="flex items-end space-x-2 relative group/bubble">
                    <div className="bg-slate-800/80 rounded-2xl rounded-tl-none px-4 py-2.5 max-w-[280px] text-[15px] leading-relaxed whitespace-pre-wrap relative group/bubble">
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
                        <div className="flex flex-wrap gap-1 mt-1.5 pt-1 border-t border-white/5">
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
                    <div className="flex flex-col items-center">
                      {msg.is_key_event && <Star className="w-3 h-3 text-yellow-500 fill-current mb-0.5 animate-in zoom-in-0" title="Key Event" />}
                      {msg.read_count > 0 && <span className="text-[10px] text-yellow-500 font-bold leading-none mb-0.5">1</span>}
                      <span className="text-[10px] text-slate-500 pb-1">{msg.time}</span>
                    </div>
                    {/* Reply & Reaction Actions */}
                    <div className="absolute right-[-100px] top-1/2 -translate-y-1/2 flex items-center space-x-1 opacity-0 group-hover/bubble:opacity-100 transition-all">
                      <button 
                        onClick={() => handleSetAnnouncement(msg)}
                        className="p-1.5 hover:bg-white/10 rounded-full text-slate-500 hover:text-blue-400"
                        title="공지로 고정"
                      >
                        <Megaphone className="w-4 h-4" />
                      </button>
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

                    {/* Emoji Picker Popover */}
                    {activeReactionMsg === msg.seq && (
                      <div className="absolute top-[-45px] left-0 bg-[#1a2033] border border-white/10 rounded-full p-1 shadow-2xl flex items-center space-x-1 z-[60] animate-in zoom-in-95 duration-200">
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

            {msg.type === 'me' && (
              <div className="flex flex-col items-end space-y-1 mb-4 group">
                <div className="flex items-end space-x-2">
                  <div className="flex flex-col items-center">
                    {msg.is_key_event && <Star className="w-3 h-3 text-yellow-500 fill-current mb-0.5 animate-in zoom-in-0" title="Key Event" />}
                    {msg.read_count > 0 && <span className="text-[10px] text-yellow-500 font-bold leading-none mb-0.5">1</span>}
                    <span className="text-[10px] text-slate-500 pb-1">{msg.time}</span>
                  </div>
                  <div className="relative group/bubble">
                    <div className="bg-blue-600 rounded-2xl rounded-tr-none px-4 py-3 max-w-[280px] text-[15px] leading-relaxed shadow-lg shadow-blue-900/20 whitespace-pre-wrap relative">
                      {msg.parent_seq && (
                        <div className="mb-2 p-2 bg-black/10 rounded-lg text-[11px] border-l-2 border-white/20 opacity-80 cursor-alias text-left" onClick={() => {
                          const el = document.getElementById(`msg-seq-${msg.parent_seq}`);
                          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }}>
                          <span className="font-bold block text-blue-100">
                            Reply to {mainMessages.find(m => m.seq === msg.parent_seq)?.sender || 'Original'}
                          </span>
                          <span className="truncate block italic text-blue-100/70">
                            {mainMessages.find(m => m.seq === msg.parent_seq)?.text || '원본 메시지를 찾을 수 없습니다'}
                          </span>
                        </div>
                      )}
                      {msg.fileAttachment ? renderAttachment(msg.fileAttachment, true) : renderMessageContent(msg.text, true)}
                      
                      {/* Reaction Badges (me) */}
                      {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5 pt-1 border-t border-white/10">
                          {Object.entries(msg.reactions).map(([emoji, users]) => (
                            users.length > 0 && (
                              <button 
                                key={emoji} 
                                onClick={() => handleAddReaction(msg.seq, emoji)}
                                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] border transition-all ${users.includes(currentUser.employee_id) ? 'bg-white/20 border-white/40 text-blue-100' : 'bg-black/20 border-white/10 text-blue-100'}`}
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
                    <div className="absolute left-[-100px] top-1/2 -translate-y-1/2 flex items-center space-x-1 opacity-0 group-hover/bubble:opacity-100 transition-all">
                      <button 
                        onClick={() => setReplyTo(msg)}
                        className="p-1.5 hover:bg-white/10 rounded-full text-slate-500 hover:text-blue-400"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setActiveReactionMsg(activeReactionMsg === msg.seq ? null : msg.seq)}
                        className="p-1.5 hover:bg-white/10 rounded-full text-slate-500 hover:text-yellow-500"
                      >
                        <Smile className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleToggleBookmark(msg)}
                        className={`p-1.5 hover:bg-white/10 rounded-full transition-colors ${msg.is_key_event ? 'text-yellow-500' : 'text-slate-500 hover:text-yellow-500'}`}
                        title="타임라인 등록"
                      >
                        <Star className={`w-4 h-4 ${msg.is_key_event ? 'fill-current' : ''}`} />
                      </button>
                      <button 
                        onClick={() => handleSetAnnouncement(msg)}
                        className="p-1.5 hover:bg-white/10 rounded-full text-slate-500 hover:text-blue-400"
                        title="공지로 고정"
                      >
                        <Megaphone className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Emoji Picker Popover (me) */}
                    {activeReactionMsg === msg.seq && (
                      <div className="absolute top-[-45px] right-0 bg-[#1a2033] border border-white/10 rounded-full p-1 shadow-2xl flex items-center space-x-1 z-[60] animate-in zoom-in-95 duration-200">
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
              <div className="flex justify-center mt-8 mb-8">
                <div className="bg-slate-800/30 border border-white/5 rounded-xl px-4 py-2.5 flex items-center space-x-3 max-w-[320px]">
                  <div className="p-1.5 bg-blue-500/20 rounded-full">
                     <msg.icon className="w-4 h-4 text-blue-400" />
                  </div>
                  <p className="text-[13px] text-slate-300" dangerouslySetInnerHTML={{ __html: msg.text }} />
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
                      {/* Name */}
                      <span className={`text-[11px] mb-1.5 px-1 font-bold tracking-wide ${roleTextClass}`}>
                        {msg.role} Agent
                      </span>
                      
                      {/* Bubble and Time */}
                      <div className={`flex items-end gap-2 ${isLeader ? 'flex-row-reverse' : 'flex-row'}`}>
                        {/* Bubble */}
                        <div className={`p-3.5 text-[13px] leading-relaxed shadow-lg whitespace-pre-wrap break-words ${
                          isLeader 
                            ? 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-2xl rounded-tr-sm border border-purple-500/30' 
                            : 'bg-slate-800 text-slate-200 rounded-2xl rounded-tl-sm border border-white/5 shadow-black/20'
                        }`}>
                          {msg.text}
                        </div>
                        {/* Time */}
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
        ))}
      </main>
    
      {/* AI Assistant Panel */}
      {showAIAssistant && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={() => setShowAIAssistant(false)}>
          <div 
            className="absolute right-0 top-0 h-full w-full max-w-md bg-[#0f1421] border-l border-white/10 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* AI Panel Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-gradient-to-r from-purple-900/20 to-blue-900/20">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-lg">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white">AI Assistant</h3>
                  <p className="text-[10px] text-slate-400">S-Autopilot 실시간 분석</p>
                </div>
              </div>
              <button
                onClick={() => setShowAIAssistant(false)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* AI Panel Tabs */}
            <div className="flex border-b border-white/5 bg-[#0a0d14]">
              <button 
                onClick={() => setActiveAiTab('chat')}
                className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 ${activeAiTab === 'chat' ? 'text-purple-400 border-purple-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
              >
                AI 어시스턴트
              </button>
              <button 
                onClick={() => setActiveAiTab('timeline')}
                className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 ${activeAiTab === 'timeline' ? 'text-yellow-400 border-yellow-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
              >
                핵심 타임라인
              </button>
              <button 
                onClick={() => setActiveAiTab('search')}
                className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 ${activeAiTab === 'search' ? 'text-cyan-400 border-cyan-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
              >
                지능형 검색
              </button>
            </div>

            {activeAiTab === 'chat' && (
              <>
                {/* Quick Actions */}
                {aiMessages.length === 0 && (
                  <div className="p-4 space-y-3 border-b border-white/5">
                    <p className="text-xs text-slate-400 mb-2">💡 빠른 질문</p>
                    <div className="grid grid-cols-2 gap-2">
                      {quickActions.map((action) => (
                        <button
                          key={action.id}
                          onClick={() => handleQuickAction(action)}
                          className="flex items-center space-x-2 p-3 bg-gradient-to-br from-slate-800/60 to-slate-900/60 hover:from-purple-900/30 hover:to-blue-900/30 border border-white/5 hover:border-purple-500/30 rounded-xl text-left transition-all group"
                        >
                          <action.icon className="w-4 h-4 text-purple-400 group-hover:text-purple-300 flex-shrink-0" />
                          <span className="text-[11px] text-slate-300 leading-tight">{action.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI Chat Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                  {aiMessages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600/20 to-blue-600/20 flex items-center justify-center border border-purple-500/20">
                        <Bot className="w-8 h-8 text-purple-400" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white mb-1">AI와 대화를 시작하세요</h4>
                        <p className="text-xs text-slate-400 leading-relaxed max-w-xs">
                          서버 상태, 에러 원인, 조치 방법 등<br/>무엇이든 물어보세요!
                        </p>
                      </div>
                    </div>
                  )}

                  {aiMessages.map((msg, index) => (
                    <div key={index}>
                      {msg.type === 'user' ? (
                        <div className="flex flex-col items-end space-y-1">
                          <div className="bg-blue-600 rounded-2xl rounded-tr-none px-4 py-3 max-w-[85%] text-sm leading-relaxed shadow-lg shadow-blue-900/20">
                            {msg.text}
                          </div>
                          <span className="text-[10px] text-slate-500">
                            {msg.timestamp.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ) : (
                        <>
                          <AIChatBubble 
                            message={msg}
                            onCopy={handleCopyMessage}
                            onShare={handleShareToTeam}
                          />
                          {msg.metrics && (
                            <div className="ml-10 max-w-[85%] mt-2 animate-fade-in-up">
                                <ServerStatusChart />
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}

                  {isAiThinking && <AIThinkingIndicator />}
                </div>

                {/* AI Input Area */}
                <div className="p-3 border-t border-white/10 bg-[#0a0d14]">
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAIMessage(userInput)}
                      placeholder="AI에게 질문하세요..."
                      className="flex-1 bg-slate-800/60 rounded-full py-2.5 px-4 text-sm border border-white/5 focus:outline-none focus:border-purple-500/50 transition-all placeholder:text-slate-500"
                    />
                    <button
                      onClick={() => handleAIMessage(userInput)}
                      disabled={!userInput.trim()}
                      className="p-2.5 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white shadow-lg shadow-purple-900/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </>
            )}

            {activeAiTab === 'timeline' && (
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div className="flex flex-col space-y-1 mb-6">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Star className="w-4 h-4 text-yellow-500 fill-current" />
                    장애 조치 핵심 타임라인
                  </h4>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest">KEY EVENTS FOR INCIDENT REPORT</p>
                </div>

                {mainMessages.filter(m => m.is_key_event).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center opacity-50">
                    <div className="w-12 h-12 rounded-full border border-dashed border-white/20 flex items-center justify-center mb-4">
                      <Star className="w-6 h-6 text-slate-600" />
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      북마크된 중요 사건이 없습니다.<br/>메시지의 별 아이콘을 눌러 등록하세요.
                    </p>
                  </div>
                ) : (
                  <div className="relative pl-3 border-l border-white/5 space-y-6">
                    {mainMessages.filter(m => m.is_key_event).map((event, idx) => (
                      <div key={idx} className="relative group">
                        <div className="absolute -left-[17px] top-1.5 w-2 h-2 rounded-full bg-yellow-500 shadow-lg shadow-yellow-900/50" />
                        <div 
                          className="bg-slate-800/40 border border-white/5 hover:border-yellow-500/30 rounded-xl p-3 transition-all cursor-pointer group"
                          onClick={() => {
                            const el = document.getElementById(`msg-seq-${event.seq}`);
                            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }}
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-bold text-yellow-500">{event.time}</span>
                            <span className="text-[9px] text-slate-500">@{event.sender}</span>
                          </div>
                          <p className="text-[12px] text-slate-200 leading-relaxed">{event.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="mt-8 p-4 rounded-2xl bg-gradient-to-br from-blue-600/10 to-purple-600/10 border border-white/10">
                  <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
                    💡 타임라인에 등록된 이벤트들은 장애 완료 시 **자동으로 사후 보고서(Post-mortem)**의 일지로 변환됩니다.
                  </p>
                  <button className="w-full py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[11px] font-bold transition-colors">
                    전체 타임라인 복사하기
                  </button>
                </div>
              </div>
            )}

            {activeAiTab === 'search' && (
              <div className="flex-1 flex flex-col min-h-0 bg-[#0a0d14]">
                <div className="p-4 border-b border-white/5 space-y-3">
                  <div className="flex flex-col space-y-1 mb-1">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                       <Zap className="w-4 h-4 text-cyan-400 fill-current" />
                       과거 장애 지능형 검색
                    </h4>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest">AI SEMANTIC SEARCH ACROSS WARROOMS</p>
                  </div>
                  <div className="relative">
                    <input 
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAISearch(searchQuery)}
                      placeholder="자연어로 물어보세요 (예: DB 데드락 조치법)"
                      className="w-full bg-slate-800/80 border border-white/10 rounded-xl py-3 pl-4 pr-12 text-sm focus:outline-none focus:border-cyan-500 transition-all placeholder:text-slate-600"
                    />
                    <button 
                       onClick={() => handleAISearch(searchQuery)}
                       className="absolute right-2 top-2 p-1.5 rounded-lg bg-cyan-600/20 text-cyan-400 hover:bg-cyan-600/40 transition-all"
                    >
                       <Zap className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {isSearching ? (
                    <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                      <Zap className="w-8 h-8 text-cyan-600 mb-4 animate-bounce" />
                      <p className="text-xs text-slate-500 italic">의미론적 유사도 분석 중...</p>
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center opacity-30">
                      <Database className="w-12 h-12 text-slate-600 mb-4" />
                      <p className="text-xs text-slate-500">검색 결과가 없습니다.</p>
                    </div>
                  ) : (
                    <div className="space-y-4 pb-10">
                      {searchResults.map((res, idx) => (
                        <div 
                           key={idx} 
                           className="bg-slate-800/40 border border-white/5 hover:border-cyan-500/30 rounded-2xl p-4 transition-all cursor-pointer group hover:bg-cyan-900/5"
                           onClick={() => handleWarpToMessage(res.incident_id, res.seq)}
                        >
                          <div className="flex justify-between items-start mb-3">
                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold ${
                              res.score > 0.8 ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-700/50 text-slate-400'
                            }`}>
                              {res.label}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">INC-{res.incident_id}</span>
                          </div>
                          <p className="text-[13px] text-slate-200 leading-relaxed mb-3 line-clamp-3">
                             {res.text}
                          </p>
                          <div className="flex justify-between items-center text-[10px] text-slate-500 border-t border-white/5 pt-3">
                             <div className="flex items-center gap-2">
                               <div className="w-5 h-5 rounded-md bg-slate-700 flex items-center justify-center text-white text-[8px]">
                                 {res.sender ? res.sender[0] : 'S'}
                               </div>
                               <span>@{res.sender}</span>
                             </div>
                             <div className="flex items-center gap-1 text-cyan-500 font-bold group-hover:translate-x-1 transition-transform">
                               이동하기 <ArrowLeft className="w-3 h-3 rotate-180" />
                             </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="px-4 pb-2 bg-[#0f1421]">
        {roomStatus === 'CLOSED' ? (
          <div className="w-full py-4 rounded-2xl bg-slate-900/50 border border-white/5 text-slate-500 text-sm font-bold flex items-center justify-center gap-3 animate-in fade-in duration-500">
            <div className="w-2 h-2 rounded-full bg-slate-500 animate-pulse" />
            이 War-Room은 종료되었습니다. (읽기 전용)
          </div>
        ) : (
          <div className="flex gap-3">
            {/* Button 1: Resolve Only */}
            <button
              onClick={handleResolveOnly}
              className="flex-1 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-white/10 text-slate-300 text-[13px] font-black flex items-center justify-center gap-2 transition-all active:scale-[0.97] group"
            >
              <CheckCircle className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-colors" />
              장애완료만 처리<br/><span className="text-[10px] opacity-60 font-normal">(보고서 제외)</span>
            </button>
            {/* Button 2: Resolve & Report */}
            <button
              onClick={handleResolveIncident}
              className="flex-[1.8] py-3.5 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white text-[13px] font-black flex items-center justify-center gap-2 shadow-xl shadow-emerald-950/40 hover:from-emerald-500 hover:to-teal-600 transition-all active:scale-[0.97] group"
            >
              <FileText className="w-5 h-5 group-hover:animate-bounce" />
              완료 및 REPORT·지식DB 생성
            </button>
          </div>
        )}
      </div>

          {/* Typing Indicator & Input Area (Now sticky/fixed at the bottom of the column) */}
          <div className="shrink-0 bg-[#0f1421] border-t border-white/5 pb-[70px] z-30">
            {Object.values(remoteTyping).some(u => u.is_typing) && (
              <div className="px-5 py-1.5 flex items-center gap-2 animate-pulse bg-black/10">
                <div className="flex -space-x-1">
                  {Object.entries(remoteTyping).filter(([_, u]) => u.is_typing).map(([id, u]) => (
                    <div key={id} className="w-5 h-5 rounded-full bg-slate-700 border border-[#0f1421] flex items-center justify-center text-[8px] font-bold">
                      {u.name?.[0]}
                    </div>
                  ))}
                </div>
                <span className="text-[10px] text-slate-400">
                  {Object.values(remoteTyping).filter(u => u.is_typing).map(u => u.name).join(', ')}님이 입력 중...
                </span>
              </div>
            )}

            <div className="p-3 flex flex-col space-y-2">
              {roomStatus === 'CLOSED' ? (
                <div className="bg-slate-900/50 rounded-2xl py-4 px-5 border border-white/5 flex items-center justify-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <div className="w-2 h-2 rounded-full bg-slate-500 animate-pulse" />
                  <span className="text-sm text-slate-500 font-medium">이 War-Room은 종료되었습니다. (읽기 전용)</span>
                </div>
              ) : (
                <>
                  {/* File preview */}
                  {selectedFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2 p-1">
                      {selectedFiles.map((file, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-slate-800/80 rounded-xl px-2 py-1.5 border border-white/10 group animate-in zoom-in-95 duration-200">
                          {file.type.startsWith('image/') ? (
                            <img src={file.localUrl} alt={file.name} className="w-8 h-8 rounded-lg object-cover" />
                          ) : (
                            <FileText className="w-6 h-6 text-blue-400" />
                          )}
                          <span className="text-[10px] text-slate-300 max-w-[80px] truncate">{file.name}</span>
                          <button 
                            onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))} 
                            className="text-slate-500 hover:text-white p-0.5"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center space-x-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
                      className="hidden"
                      onChange={(e) => {
                        const files = Array.from(e.target.files);
                        if (files.length === 0) return;
                        const newFiles = files.map(file => ({
                          name: file.name,
                          type: file.type,
                          localUrl: URL.createObjectURL(file),
                          file: file
                        }));
                        setSelectedFiles(prev => [...prev, ...newFiles]);
                        e.target.value = '';
                      }}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2.5 rounded-full bg-slate-800/60 hover:bg-slate-700 transition-colors"
                    >
                      <Paperclip className="w-5 h-5 text-slate-400" />
                    </button>
                    <div className="flex-1 relative">
                      {replyTo && (
                        <div className="absolute bottom-full left-0 w-full bg-[#1e2538] border border-white/5 rounded-t-xl p-2 mb-[-1px] flex justify-between items-center text-[11px] animate-in slide-in-from-bottom-2">
                          <div className="flex items-center gap-2 text-slate-300 truncate">
                            <span className="font-bold text-blue-400">@{replyTo.sender}</span>
                            <span className="truncate opacity-70">{replyTo.text}</span>
                          </div>
                          <button onClick={() => setReplyTo(null)}><X className="w-3.5 h-3.5 text-slate-500" /></button>
                        </div>
                      )}
                      <input
                        type="text"
                        disabled={roomStatus === 'CLOSED'}
                        value={mainInput}
                        onChange={(e) => {
                          setMainInput(e.target.value);
                          handleTyping();
                        }}
                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder={roomStatus === 'CLOSED' ? "종료된 워룸은 입력할 수 없습니다" : "메시지를 입력하세요..."}
                        className={`w-full bg-slate-800/60 py-2.5 px-5 text-[15px] border border-white/5 focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-slate-500 ${replyTo ? 'rounded-b-2xl' : 'rounded-full'}`}
                      />
                      <button
                        onClick={handleSendMessage}
                        disabled={(!mainInput.trim() && selectedFiles.length === 0) || uploadingFile}
                        className="absolute right-1 top-1 p-1.5 rounded-full bg-blue-600 text-white shadow-lg shadow-blue-900/40 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {uploadingFile ? (
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Send className="w-5 h-5 fill-current" />
                        )}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Direct Message (Note) Modal */}
      {showDMModal && dmTargetUser && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowDMModal(false)} />
          <div className="bg-[#1a1f2e] w-full max-w-lg rounded-[2rem] border border-white/10 shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-300">
            <div className="p-5 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-blue-600/10 to-transparent">
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
            
            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#0f1421]/50">
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

            <div className="p-4 border-t border-white/5 bg-[#1a1f2e]">
              <div className="relative">
                <textarea
                  value={dmInput}
                  onChange={(e) => setDmInput(e.target.value)}
                  onKeyPress={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendDM(); }}}
                  placeholder="쪽지를 입력하세요..."
                  className="w-full bg-[#0f1421] border border-white/10 rounded-2xl py-3 px-4 pr-12 text-sm focus:outline-none focus:border-blue-500/50 resize-none min-h-[80px]"
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

      {/* War-Room List Popup */}
      {showWarRoomPopup && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center animate-in fade-in duration-300">
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
                    className={`bg-[#11141d] p-4 rounded-2xl border transition-all cursor-pointer group ${roomId === incidentId ? 'border-blue-500/40 bg-blue-900/10' : 'border-white/5 hover:border-blue-500/30'}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded border bg-red-500/20 text-red-500 border-red-500/30">CRITICAL</span>
                      {roomId === incidentId && <span className="text-[9px] text-blue-400 font-bold">● 현재 채팅방</span>}
                    </div>
                    <p className="text-sm font-semibold text-white truncate">{room.title || roomId}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{room.reg_dt ? new Date(room.reg_dt).toLocaleString('ko-KR') : ''}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="fixed bottom-0 left-0 w-full bg-[#0f1421] border-t border-white/5 px-6 py-3 flex justify-between items-center z-50 pb-safe">
        <div className="flex flex-col items-center space-y-1 text-slate-500 hover:text-white transition-colors cursor-pointer" onClick={() => navigate('/dashboard')}>
            <Home className="w-6 h-6" />
            <span className="text-[10px] font-medium">홈</span>
        </div>
        <div className="flex flex-col items-center space-y-1 text-blue-500 relative cursor-pointer" onClick={handleWarRoomNavClick}>
            <div className="relative">
                <MessageSquare className="w-6 h-6" />
                {warRooms.length > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#0f1421]"></span>}
            </div>
            <span className="text-[10px] font-medium">War-Room</span>
        </div>

        <div className="flex flex-col items-center space-y-1 text-slate-500 hover:text-white transition-colors cursor-pointer" onClick={() => navigate('/overall-status')}>
            <BarChart2 className="w-6 h-6" />
            <span className="text-[10px] font-medium">통계</span>
        </div>
        
        {/* AI Assistant Nav Button */}
        <div 
          className={`flex flex-col items-center space-y-1 transition-colors cursor-pointer ${
            showAIAssistant ? 'text-purple-400' : 'text-slate-500 hover:text-purple-400'
          }`}
          onClick={() => setShowAIAssistant(!showAIAssistant)}
        >
            <div className="relative">
              <Bot className="w-6 h-6" />
              {!showAIAssistant && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-purple-500 rounded-full border-2 border-[#0f1421] animate-pulse"></span>
              )}
            </div>
            <span className="text-[10px] font-medium">AI</span>
        </div>
        
        <div className="flex flex-col items-center space-y-1 text-slate-500 hover:text-white transition-colors cursor-pointer" onClick={() => setShowMoreMenu(true)}>
            <Settings className="w-6 h-6" />
            <span className="text-[10px] font-medium">설정</span>
        </div>
      </nav>

      {/* More Menu Popup (Settings) */}
      {showMoreMenu && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowMoreMenu(false)} />
          <div className="w-full bg-[#1a1f2e] rounded-t-[40px] border-t border-white/10 shadow-2xl relative z-10 animate-in slide-in-from-bottom duration-500 overflow-hidden max-h-[90vh] overflow-y-auto pb-safe">
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
                  className="bg-[#11141d] p-4 sm:p-6 rounded-3xl border border-white/5 hover:border-blue-500/30 transition-all cursor-pointer group flex flex-col items-center text-center space-y-3 sm:space-y-4"
                >
                  <div className="bg-blue-600/20 p-3 sm:p-4 rounded-2xl group-hover:scale-110 transition-transform">
                    <Hash className="w-6 h-6 sm:w-8 sm:h-8 text-blue-400" />
                  </div>
                  <div>
                    <span className="block font-bold text-slate-200 text-sm sm:text-base">할당 키워드 관리</span>
                    <span className="text-[9px] sm:text-[10px] text-slate-500 mt-1 block">Critical Alert Keywords</span>
                  </div>
                </div>

                <div
                  onClick={() => {
                    setShowMoreMenu(false);
                    navigate('/report-line-management');
                  }}
                  className="bg-[#11141d] p-4 sm:p-6 rounded-3xl border border-white/5 hover:border-purple-500/30 transition-all cursor-pointer group flex flex-col items-center text-center space-y-3 sm:space-y-4"
                >
                  <div className="bg-purple-600/20 p-3 sm:p-4 rounded-2xl group-hover:scale-110 transition-transform">
                    <Users className="w-6 h-6 sm:w-8 sm:h-8 text-purple-400" />
                  </div>
                  <div>
                    <span className="block font-bold text-slate-200 text-sm sm:text-base">보고 라인 관리</span>
                    <span className="text-[9px] sm:text-[10px] text-slate-500 mt-1 block">Approval Hierarchy</span>
                  </div>
                </div>

                <div
                  onClick={() => {
                    setShowMoreMenu(false);
                    navigate('/sms-test');
                  }}
                  className="bg-[#11141d] p-4 sm:p-6 rounded-3xl border border-white/5 hover:border-green-500/30 transition-all cursor-pointer group flex flex-col items-center text-center space-y-3 sm:space-y-4"
                >
                  <div className="bg-green-600/20 p-3 sm:p-4 rounded-2xl group-hover:scale-110 transition-transform">
                    <MessageSquare className="w-6 h-6 sm:w-8 sm:h-8 text-green-400" />
                  </div>
                  <div>
                    <span className="block font-bold text-slate-200 text-sm sm:text-base">수동 장애 접수</span>
                    <span className="text-[9px] sm:text-[10px] text-slate-500 mt-1 block">Manual Incident Submission</span>
                  </div>
                </div>
                <div
                  onClick={() => {
                    setShowMoreMenu(false);
                    navigate('/user-management');
                  }}
                  className="bg-[#11141d] p-4 sm:p-6 rounded-3xl border border-white/5 hover:border-blue-500/30 transition-all cursor-pointer group flex flex-col items-center text-center space-y-3 sm:space-y-4"
                >
                  <div className="bg-blue-600/20 p-3 sm:p-4 rounded-2xl group-hover:scale-110 transition-transform">
                    <User className="w-6 h-6 sm:w-8 sm:h-8 text-blue-400" />
                  </div>
                  <div>
                    <span className="block font-bold text-slate-200 text-sm sm:text-base">사용자 계정 관리</span>
                    <span className="text-[9px] sm:text-[10px] text-slate-500 mt-1 block">Account & Security Admin</span>
                  </div>
                </div>
                <div
                  onClick={() => {
                    setShowMoreMenu(false);
                    navigate('/organization-management');
                  }}
                  className="bg-[#11141d] p-4 sm:p-6 rounded-3xl border border-white/5 hover:border-emerald-500/30 transition-all cursor-pointer group flex flex-col items-center text-center space-y-3 sm:space-y-4"
                >
                  <div className="bg-emerald-600/20 p-3 sm:p-4 rounded-2xl group-hover:scale-110 transition-transform">
                    <Network className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-400" />
                  </div>
                  <div>
                    <span className="block font-bold text-slate-200 text-sm sm:text-base">부서/조직도 관리</span>
                    <span className="text-[9px] sm:text-[10px] text-slate-500 mt-1 block">Org Hierarchy Tree Admin</span>
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
