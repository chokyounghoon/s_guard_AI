import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Phone, Menu, Plus, Send, Home, MessageSquare, BarChart2, Settings, Info, AlertTriangle, ChevronDown, ChevronUp, Users, LogOut, FileText, UserPlus, Bot, Sparkles, Zap, X, Database, Paperclip, Image as ImgIcon, Shield, Server, User, Terminal, CheckCircle } from 'lucide-react';
import AIChatBubble from '../components/AIChatBubble';
import AIThinkingIndicator from '../components/AIThinkingIndicator';
import ServerStatusChart from '../components/chat/ServerStatusChart';

export default function ChatPage() {
  const navigate = useNavigate();
  const [isLogExpanded, setIsLogExpanded] = useState(true);
  const [showPhoneList, setShowPhoneList] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [aiMessages, setAiMessages] = useState([]);
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
  const [warRooms, setWarRooms] = useState([]);
  const [showWipToast, setShowWipToast] = useState(false);
  const fileInputRef = useRef(null);

  const participants = [
    { name: '정도현 팀장', role: 'Team Leader', phone: '010-1234-5678' },
    { name: '시스템 어드민', role: 'Admin', phone: '010-9876-5432' },
    { name: '최광훈 담당', role: 'Developer', phone: '010-5555-5555' },
    { name: '이수민 매니저', role: 'Manager', phone: '010-1111-2222' },
    { name: '김철수 사원', role: 'Staff', phone: '010-3333-4444' },
    { name: '박영희 대리', role: 'Assistant', phone: '010-7777-8888' },
  ];

  // Main Chat State
  const [mainMessages, setMainMessages] = useState([]);
  const [mainInput, setMainInput] = useState('');
  const { incidentId: paramId } = useParams();
  const incidentId = paramId || 'INC-8823';
  
  const [currentUser, setCurrentUser] = useState({ name: '이수민 매니저', role: 'Manager' });
  const [aiAnalysisMessage, setAiAnalysisMessage] = useState(null);

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
    const userStr = localStorage.getItem('sguard_user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user.name) {
          setCurrentUser({
            name: user.name,
            role: user.role || 'Manager'
          });
        }
      } catch(e) {}
    }
  }, []);

  const getApiUrl = (endpoint) => {
    const apiBase = window.location.hostname === 'localhost' 
      ? 'https://sguardai.khcho0421.workers.dev' 
      : 'https://sguardai.khcho0421.workers.dev';
    return `${apiBase}${endpoint}`;
  };

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

  // Load chat history on mount or when incidentId changes
  useEffect(() => {
    const fetchChatHistory = async () => {
      try {
        const res = await fetch(getApiUrl(`/warroom/chat/${incidentId}`));
          if (res.ok) {
            const data = await res.json();
            setRoomTitle(data.title || incidentId);
            setRoomDescription(data.description || '');
            setRoomStatus(data.status || 'Open');
            const loadedMessages = data.messages.map(msg => ({
            id: msg.inc_id,
            type: msg.type === 'me' || msg.sender === currentUser.name ? 'me' : 
                 (msg.type === 'system' ? 'system' : 
                 (msg.type === 'ai_analysis' ? 'ai_analysis' : 'other')),
            sender: msg.sender,
            role: msg.role,
            initials: msg.sender ? msg.sender : 'SY',
            color: msg.type === 'ai_analysis' ? 'bg-purple-600' : 'bg-slate-700',
            text: msg.text,
            time: new Date(msg.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
            icon: msg.type === 'system' ? Info : (msg.type === 'ai_analysis' ? Sparkles : null)
          }));
          setMainMessages(loadedMessages);
          
          // Leader Agent 내용을 AI ANALYSIS SUMMARY 배너에 표시
          if (data.leader_summary) {
            setAiAnalysisMessage({ type: 'ai_analysis', text: data.leader_summary });
          } else {
            // Fallback: any ai_analysis message in history
            const analysis = loadedMessages.find(m => m.type === 'ai_analysis');
            if (analysis) setAiAnalysisMessage(analysis);
          }
        }
      } catch (err) {
        console.error("Failed to load chat history", err);
      }
    };
    fetchChatHistory();
  }, [incidentId]);

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
          time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
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

  const handleSendMessage = async () => {
    const hasText = mainInput.trim();
    const hasFiles = selectedFiles.length > 0;
    
    if (!hasText && !hasFiles) return;
    if (uploadingFile) return;

    setUploadingFile(true);
    const apiBase = 'https://sguardai.khcho0421.workers.dev';
    
    try {
      // 1. Upload files first if any
      if (hasFiles) {
        const userStr = localStorage.getItem('sguard_user');
        const user = userStr ? JSON.parse(userStr) : { name: '익명' };
        const uploadedFiles = [];

        for (const fileObj of selectedFiles) {
          const formData = new FormData();
          formData.append('file', fileObj.file);
          formData.append('incident_id', incidentId);
          formData.append('uploaded_by', user.name || '익명');
          const uploadRes = await fetch(`${apiBase}/warroom/upload`, { method: 'POST', body: formData });
          if (uploadRes.ok) {
            const uploadData = await uploadRes.json();
            uploadedFiles.push({ ...fileObj, url: uploadData.url, seq: uploadData.seq });
          }
        }

        // Optimistically add file messages to chat
        if (uploadedFiles.length > 0) {
          const now = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
          const fileMsgs = uploadedFiles.map((f, idx) => ({
            id: `file_${Date.now()}_${idx}`,
            type: 'me',
            sender: user.name || '익명',
            initials: (user.name || '익명').substring(0, 2),
            color: 'bg-slate-700',
            text: null,
            fileAttachment: {
              name: f.name || f.file?.name,
              url: `https://sguardai.khcho0421.workers.dev${f.url}`,
              type: f.file?.type || 'application/octet-stream'
            },
            time: now,
            icon: null
          }));
          setMainMessages(prev => [...prev, ...fileMsgs]);
        }
        setSelectedFiles([]);
      }

      // 2. Send text message if any
      if (hasText) {
        await saveChatToDb({
          incident_id: incidentId,
          sender: currentUser.name,
          role: currentUser.role,
          type: 'me',
          text: mainInput
        });
        setMainInput('');
      }

      // 3. Re-fetch chat history once to ensure everything is in order
      const res = await fetch(`${apiBase}/warroom/chat/${incidentId}`);
      if (res.ok) {
        const data = await res.json();
        const loadedMessages = data.messages.map(msg => ({
          id: msg.inc_id,
          type: msg.type === 'me' || msg.sender === currentUser.name ? 'me' : 
              (msg.type === 'system' ? 'system' : 
              (msg.type === 'ai_analysis' ? 'ai_analysis' : 'other')),
          sender: msg.sender,
          role: msg.role,
          initials: msg.sender ? msg.sender.substring(0, 2) : 'SY',
          color: msg.type === 'ai_analysis' ? 'bg-purple-600' : 'bg-slate-700',
          text: msg.text,
          time: new Date(msg.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
          icon: msg.type === 'system' ? Info : (msg.type === 'ai_analysis' ? Sparkles : null)
        }));

        // Merge with attachments from DB
        const attRes = await fetch(`${apiBase}/warroom/attachments/${incidentId}`);
        const attData = attRes.ok ? await attRes.json() : { attachments: [] };
        const attMsgs = (attData.attachments || []).map(att => ({
          id: `att_${att.seq}`,
          type: currentUser.name === att.uploaded_by ? 'me' : 'other',
          sender: att.uploaded_by,
          initials: att.uploaded_by ? att.uploaded_by.substring(0, 2) : '??',
          color: 'bg-slate-700',
          text: null,
          fileAttachment: {
            name: att.original_name,
            url: `https://sguardai.khcho0421.workers.dev${att.url}`,
            type: att.file_type
          },
          time: att.timestamp ? new Date(att.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '',
          icon: null
        }));

        const combined = [...loadedMessages, ...attMsgs].sort((a, b) => a.id < b.id ? -1 : 1);
        setMainMessages(combined);
        const analysis = loadedMessages.find(m => m.type === 'ai_analysis');
        if (analysis) setAiAnalysisMessage(analysis);
      }
    } catch (err) {
      console.error("Failed to send message/files", err);
    } finally {
      setUploadingFile(false);
    }
  };

  const [resolveSuccess, setResolveSuccess] = useState(false);

  const handleResolveIncident = () => {
    navigate('/ai-report', { state: { incidentId } });
  };

  return (
    <div className="min-h-screen bg-[#0f1421] text-white font-sans flex flex-col pb-20 relative">
      {/* Header */}
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
            onClick={handleResolveIncident}
            className="flex items-center px-3 py-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-bold hover:bg-emerald-500/30 transition-colors animate-pulse"
          >
            Resolve
          </button>
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
                            <Phone className="w-4 h-4 text-green-500" />
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

      {/* 성공 토스트 알림바 */}
      {resolveSuccess && (
        <div className="bg-gradient-to-r from-emerald-600/20 to-blue-600/20 border-b border-emerald-500/30 p-3 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
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


      {/* Persistent AI Analysis / Error Log Banner (Collapsible) */}
      <div className="bg-slate-900/80 border-b border-white/5 backdrop-blur-md z-30 sticky top-[73px]">
        <div className="px-4 py-2">
            <div 
                onClick={() => setIsLogExpanded(!isLogExpanded)}
                className="flex items-center justify-between cursor-pointer group"
            >
                <div className="flex items-center space-x-2">
                    {aiAnalysisMessage ? (
                      <>
                        <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
                        <span className="text-xs font-bold text-purple-300">✨ AI Autopilot 분석 리포트 고정</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse" />
                        <span className="text-xs font-bold text-red-400">🚨 현재 발생 중인 장애 (Ongoing Issue)</span>
                      </>
                    )}
                </div>
                <div className="flex items-center gap-1">
                  {aiAnalysisMessage && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMainInput(prev => prev ? prev + '\n\n' + aiAnalysisMessage.text : aiAnalysisMessage.text);
                      }}
                      title="채팅창에 붙여넣기"
                      className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-bold hover:bg-purple-500/30 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      채팅에 붙여넣기
                    </button>
                  )}
                  <button className="p-1 rounded-full group-hover:bg-white/10 transition-colors">
                      {isLogExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </button>
                </div>
            </div>
            
            {isLogExpanded && (
                <div className={`rounded-lg border overflow-hidden mt-2 mb-1 animate-in slide-in-from-top-2 duration-200 ${aiAnalysisMessage ? 'bg-purple-900/10 border-purple-500/30 shadow-lg shadow-purple-900/20' : 'bg-red-900/10 border-red-500/20'}`}>
                    <div className={`${aiAnalysisMessage ? 'bg-purple-500/10 border-purple-500/10' : 'bg-red-900/10 border-red-500/10'} px-3 py-1.5 border-b flex justify-between items-center`}>
                      <span className={`text-[10px] font-mono ${aiAnalysisMessage ? 'text-purple-300' : 'text-red-300'}`}>
                        {aiAnalysisMessage ? 'AI ANALYSIS SUMMARY' : 'INCIDENT DESCRIPTION'}
                      </span>
                      <span className={`text-[10px] opacity-70 ${aiAnalysisMessage ? 'text-purple-400' : 'text-red-400'}`}>Live Update</span>
                    </div>
                    <div className="p-3 text-[12px] leading-relaxed">
                      {aiAnalysisMessage ? (
                        <div className={`text-slate-200 whitespace-pre-wrap transition-all duration-300 ${!showFullAnalysis ? 'line-clamp-3' : ''}`}>
                          {aiAnalysisMessage.text}
                        </div>
                      ) : (
                        <div className="text-slate-300 italic">
                          {roomDescription || '장애 내용을 포함한 SMS 원문 또는 AI 분석 내용을 기다리고 있습니다...'}
                        </div>
                      )}
                    </div>
                    {aiAnalysisMessage && (
                      <div className="px-3 pb-2 flex justify-end">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setShowFullAnalysis(!showFullAnalysis); }}
                          className="text-[10px] text-purple-400 font-bold uppercase tracking-wider hover:text-purple-300 flex items-center gap-1"
                        >
                          {showFullAnalysis ? (
                            <>Collapse <ChevronUp className="w-3 h-3" /></>
                          ) : (
                            <>Show Full Analysis <ChevronDown className="w-3 h-3" /></>
                          )}
                        </button>
                      </div>
                    )}
                </div>
            )}
        </div>
      </div>

      {/* Chat Area */}
      <main className="flex-1 p-4 space-y-6 overflow-y-auto pb-40">

        {mainMessages.filter(msg => msg.type !== 'ai_analysis').map((msg) => (
          <div key={msg.inc_id || msg.id}>
            {msg.type === 'other' && (
              <div className="flex items-start space-x-3 mb-4">
                <div className={`px-2 py-1 h-10 min-w-[40px] rounded-xl ${msg.color} flex items-center justify-center font-bold text-xs shrink-0 whitespace-nowrap`}>
                  {msg.initials}
                </div>
                <div className="flex flex-col space-y-1">
                  <span className="text-xs text-slate-400 font-medium">{msg.sender}</span>
                  <div className="flex items-end space-x-2">
                    <div className="bg-slate-800/80 rounded-2xl rounded-tl-none px-4 py-2.5 max-w-[280px] text-[15px] leading-relaxed whitespace-pre-wrap">
                      {msg.fileAttachment ? (
                        <a href={msg.fileAttachment.url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 text-blue-400 hover:text-blue-300 underline text-xs">
                          <Paperclip className="w-3 h-3 shrink-0" />
                          {msg.fileAttachment.name}
                        </a>
                      ) : renderMessageContent(msg.text, false)}
                    </div>
                    <span className="text-[10px] text-slate-500 pb-1">{msg.time}</span>
                  </div>
                </div>
              </div>
            )}

            {msg.type === 'me' && (
              <div className="flex flex-col items-end space-y-1 mb-4">
                <div className="flex items-end space-x-2">
                  <span className="text-[10px] text-slate-500 pb-1">{msg.time}</span>
                  <div className="bg-blue-600 rounded-2xl rounded-tr-none px-4 py-3 max-w-[280px] text-[15px] leading-relaxed shadow-lg shadow-blue-900/20 whitespace-pre-wrap">
                    {msg.fileAttachment ? (
                      <a href={msg.fileAttachment.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 text-blue-100 hover:text-white underline text-xs">
                        <Paperclip className="w-3 h-3 shrink-0" />
                        {msg.fileAttachment.name}
                      </a>
                    ) : renderMessageContent(msg.text, true)}
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
          </div>
        </div>
      )}

      <div className="px-4 pb-2 bg-[#0f1421]">
        {roomStatus === 'Completed' ? (
          <div className="w-full py-3.5 rounded-xl bg-slate-700 text-slate-500 text-sm font-bold flex items-center justify-center gap-2 cursor-not-allowed">
            <CheckCircle className="w-4 h-4" />
            이미 해결된 장애입니다
          </div>
        ) : (
          <div className="flex gap-2">
            {/* Button 1: Simple close (WIP) */}
            <button
              onClick={() => {
                setShowWipToast(true);
                setTimeout(() => setShowWipToast(false), 2500);
              }}
              className="flex-1 py-3 rounded-xl bg-slate-700/80 border border-white/10 text-slate-300 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-slate-600/80 transition-all active:scale-[0.97]"
            >
              <CheckCircle className="w-4 h-4 text-slate-400" />
              장애완료만 처리<br/>(보고불필요)
            </button>
            {/* Button 2: Full report flow */}
            <button
              onClick={handleResolveIncident}
              className="flex-1 py-3 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-900/30 hover:from-emerald-500 hover:to-teal-600 transition-all active:scale-[0.97]"
            >
              <FileText className="w-4 h-4" />
              완료 및 REPORT·<br/>지식DB생성 진행
            </button>
          </div>
        )}
        {/* 구현중 toast */}
        {showWipToast && (
          <div className="mt-2 w-full text-center text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-lg py-2 animate-in fade-in duration-300">
            ⚙️ 해당 기능은 현재 구현 중입니다.
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-3 bg-[#0f1421] border-t border-white/5 flex flex-col mb-[70px] space-y-2">
        {roomStatus === 'Completed' ? (
          <div className="bg-slate-900/50 rounded-2xl py-4 px-5 border border-white/5 flex items-center justify-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="w-2 h-2 rounded-full bg-slate-500 animate-pulse" />
            <span className="text-sm text-slate-500 font-medium">이 War-Room은 종료되었습니다. (읽기 전용)</span>
          </div>
        ) : (
          <>
           {/* File preview */}
           {selectedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
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
          {/* Hidden file input */}
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
            title="파일/이미지 첨부"
          >
            <Paperclip className="w-5 h-5 text-slate-400" />
          </button>
          <div className="flex-1 relative">
            <input
              type="text"
              value={mainInput}
              onChange={(e) => setMainInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="메시지를 입력하세요..."
              className="w-full bg-slate-800/60 rounded-full py-2.5 px-5 text-[15px] border border-white/5 focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-slate-500"
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
