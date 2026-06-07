import React, { useState, useRef } from 'react';
import { Send, AlertTriangle, CheckCircle, Terminal, Image as ImageIcon, Mic, Loader2, Clipboard, ArrowRight, SlidersHorizontal, ChevronDown, ChevronUp, UserCircle, ArrowLeft, Shield, Phone, X, Activity, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useBackNavigation } from '../hooks/useBackNavigation';
import { getAuthHeaders } from '../lib/authStore';

const IncidentPushPage = () => {
    const navigate = useNavigate();
    const goBack = useBackNavigation('/dashboard');
    const [sender, setSender] = useState('');
    const [employeeId, setEmployeeId] = useState('');
    const [message, setMessage] = useState('');
    const setMessageWithRef = (val) => {
        const newVal = typeof val === 'function' ? val(messageRef.current) : val;
        messageRef.current = newVal;
        setMessage(newVal);
    };
    // KST 시간 가져오기
    const getKstNow = () => {
        const d = new Date();
        const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
        return kst.toISOString().slice(0, 16).replace('T', ' ');
    };

    const [advanced, setAdvanced] = useState({
        channel: 'MANUAL',
        if_id: '',
        service_code: '',
        service_name: '',
        biz_system: '',
        error_code: '',
        occurrence_count: '',
        occurrence_node: '',
        error_message: '',
        occurrence_time: getKstNow()
    });
    const [receivers, setReceivers] = useState(Array(20).fill(''));
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [logs, setLogs] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isConverting, setIsConverting] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [uploadedImages, setUploadedImages] = useState([]);
    const [userProfile, setUserProfile] = useState(null);
    const [isProfileExpanded, setIsProfileExpanded] = useState(false);
    const [showSenderInfo, setShowSenderInfo] = useState(false);
    const [showLogs, setShowLogs] = useState(false);
    const fileInputRef = useRef(null);
    const recognitionRef = useRef(null);
    const messageRef = useRef('');

    const getApiUrl = (path) => {
        const workerUrl = 'https://sguardai.khcho0421.workers.dev';
        return `${workerUrl}${path}`;
    };

    React.useEffect(() => {
        const savedUser = localStorage.getItem('sguard_user');
        if (savedUser) {
            try {
                const user = JSON.parse(savedUser);
                if (user.employee_id) {
                    setEmployeeId(user.employee_id);
                }
                if (user.name) setUserProfile(user);

                // ① sguard_user에 phone이 있으면 바로 사용 (API 호출 불필요)
                if (user.phone) {
                    setSender(user.phone);
                } else if (user.employee_id) {
                    // ② phone 없으면 /users/:id API로 fallback (인증 헤더 포함)
                    fetch(getApiUrl(`/users/${user.employee_id}`), {
                        headers: getAuthHeaders()
                    })
                        .then(res => res.ok ? res.json() : null)
                        .then(dbUser => {
                            if (!dbUser) return;
                            if (dbUser.phone) setSender(dbUser.phone);
                            if (dbUser.name && !user.name) setUserProfile(dbUser);
                        })
                        .catch(err => console.error('Failed to fetch user info:', err));
                }
            } catch (e) {
                console.error('Failed to parse saved user', e);
            }
        }
    }, []);



    const toggleSTT = () => {
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setLogs(prev => [{
                time: new Date().toLocaleTimeString(),
                type: 'error',
                text: '[STT 실패] 이 브라우저는 음성 인식을 지원하지 않습니다.'
            }, ...prev]);
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'ko-KR';
        recognition.interimResults = true;
        recognition.continuous = true;

        recognition.onstart = () => {
            setIsListening(true);
            recognition.baseText = messageRef.current;
            setLogs(prev => [{
                time: new Date().toLocaleTimeString(),
                type: 'ai',
                text: '[음성 인식 시작] 말씀해 주세요...'
            }, ...prev]);
        };

        recognition.onresult = (event) => {
            let finalTranscript = '';
            let interimTranscript = '';

            for (let i = 0; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript + ' ';
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            const updatedMessage = recognition.baseText 
                ? `${recognition.baseText}\n${finalTranscript}${interimTranscript}`.trim()
                : `${finalTranscript}${interimTranscript}`.trim();
                
            setMessageWithRef(updatedMessage);
        };

        recognition.onerror = (event) => {
            console.error('STT Error:', event.error);
            setIsListening(false);
            setLogs(prev => [{
                time: new Date().toLocaleTimeString(),
                type: 'error',
                text: `[음성 인식 오류] ${event.error}`
            }, ...prev]);
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
    };

    const compressImage = (file) => {
        return new Promise((resolve) => {
            // 5초 후에는 무조건 원본 파일로 진행하도록 타임아웃 설정
            const timeout = setTimeout(() => {
                console.warn('Compression timeout, using original file');
                resolve(file);
            }, 5000);

            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    const max_size = 1200;

                    if (width > height) {
                        if (width > max_size) {
                            height *= max_size / width;
                            width = max_size;
                        }
                    } else {
                        if (height > max_size) {
                            width *= max_size / height;
                            height = max_size;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    canvas.toBlob((blob) => {
                        clearTimeout(timeout);
                        if (!blob) {
                            resolve(file); // 실패 시 원본
                        } else {
                            resolve(new File([blob], file.name, { type: 'image/jpeg' }));
                        }
                    }, 'image/jpeg', 0.85);
                };
                img.onerror = () => {
                    clearTimeout(timeout);
                    resolve(file);
                };
                img.src = event.target.result;
            };
            reader.onerror = () => {
                clearTimeout(timeout);
                resolve(file);
            };
            reader.readAsDataURL(file);
        });
    };
    const handleFileUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        const maxFiles = 5;
        // Limit processing to remaining slots if they upload sequentially
        // For simplicity, we just take the first 5 selected files if they upload multiple
        const filesToProcess = files.slice(0, maxFiles);

        if (files.length > maxFiles) {
            setLogs(prev => [{
                time: new Date().toLocaleTimeString(),
                type: 'error',
                text: `최대 ${maxFiles}개의 이미지만 첨부할 수 있습니다. 처음 ${maxFiles}개만 업로드됩니다.`
            }, ...prev]);
        }

        const newUploads = filesToProcess.filter(f => f.type.includes('image')).map(file => {
            return {
                file,
                info: {
                    id: Math.random().toString(36).substr(2, 9),
                    name: file.name,
                    size: (file.size / 1024).toFixed(1) + ' KB',
                    url: URL.createObjectURL(file),
                    status: 'converting'
                }
            };
        });

        if (!newUploads.length) {
            setLogs(prev => [{ time: new Date().toLocaleTimeString(), type: 'request', text: '[안내] 이미지 파일이 아닙니다.' }, ...prev]);
            return;
        }

        setUploadedImages(prev => {
            const combined = [...prev, ...newUploads.map(u => u.info)];
            return combined.slice(-5); // Keep max 5 across multiple uploads
        });
        
        setIsConverting(true);

        for (const upload of newUploads) {
            setLogs(prev => [{ time: new Date().toLocaleTimeString(), type: 'ai', text: `[최적화 및 AI 분석 중] ${upload.info.name}` }, ...prev]);

            try {
                const compressedFile = await compressImage(upload.file);
                const formData = new FormData();
                formData.append('file', compressedFile);

                const response = await fetch(getApiUrl('/sms/convert-multimodal'), { 
                    method: 'POST', 
                    headers: getAuthHeaders({ 'Content-Type': null }),
                    body: formData 
                });
                
                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || '변환 실패');
                }

                // Handle SSE Stream for OCR
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                // Track where this specific image's analysis started — use ref to get latest value
                const baseBeforeThisImage = messageRef.current;
                let accumulatedText = "";
                let buffer = "";

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    // Retain the last incomplete line in the buffer
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (trimmed.startsWith('data:')) {
                            try {
                                const dataStr = trimmed.slice(5).trim();
                                if (dataStr === '[DONE]') continue;
                                
                                const data = JSON.parse(dataStr);
                                // DEBUG: 실제 Dify 이벤트 형식 확인 (브라우저 콘솔에서 확인하세요)
                                console.log('[OCR SSE]', data.event, JSON.stringify(data).substring(0, 200));

                                // 이벤트 타입 무관하게 가능한 모든 필드에서 텍스트 추출
                                const token =
                                    data.answer ||
                                    data.delta?.text ||
                                    data.data?.text ||
                                    data.text ||
                                    "";

                                if (token) {
                                    accumulatedText += token;
                                    const cleanedText = accumulatedText.replace(/\[(?:Web발신|신한카드)\]\s*/g, '').trim();
                                    const updatedMessage = baseBeforeThisImage ? `${baseBeforeThisImage}\n\n${cleanedText}` : cleanedText;
                                    setMessageWithRef(updatedMessage);
                                }
                            } catch (e) {
                                // Silent catch for incomplete JSON chunks
                            }
                        }
                    }
                }

                // 스트림 종료 후 남은 buffer 처리
                if (buffer.trim().startsWith('data:')) {
                    try {
                        const dataStr = buffer.trim().slice(5).trim();
                        if (dataStr && dataStr !== '[DONE]') {
                            const data = JSON.parse(dataStr);
                            const token = data.answer || data.delta?.text || data.data?.text || data.text || "";
                            if (token) {
                                accumulatedText += token;
                                const cleanedText = accumulatedText.replace(/\[(?:Web발신|신한카드)\]\s*/g, '').trim();
                                const updatedMessage = baseBeforeThisImage ? `${baseBeforeThisImage}\n\n${cleanedText}` : cleanedText;
                                setMessageWithRef(updatedMessage);
                            }
                        }
                    } catch (e) {}
                }

                if (!accumulatedText) {
                    throw new Error('OCR 결과가 없습니다. 브라우저 콘솔에서 [OCR SSE] 로그를 확인해 주세요.');
                }

                setUploadedImages(prev => prev.map(img => img.id === upload.info.id ? { ...img, status: 'success' } : img));
                setLogs(prev => [{ time: new Date().toLocaleTimeString(), type: 'ai', text: `[AI 이미지 인식 완료] ${upload.info.name} 추출 성공` }, ...prev]);

            } catch (error) {
                setUploadedImages(prev => prev.map(img => img.id === upload.info.id ? { ...img, status: 'error' } : img));
                setLogs(prev => [{ time: new Date().toLocaleTimeString(), type: 'error', text: `[AI 분석 실패] ${upload.info.name}: ${error.message}` }, ...prev]);
            }
        }

        setIsConverting(false);

        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const parseSmsMessage = (text) => {
        if (!text) return {};
        const result = {};
        console.group('[S-GUARD] SMS Parsing Diagnostic');
        
        try {
            const extract = (label, key) => {
                // Support nested brackets - match until the LAST ] before a new marker or end of text
                const regex = new RegExp(`▶\\s*${label}\\s*:\\s*\\[([\\s\\S]+?)\\](?=\\s*(?:▶|$))`, 'iu');
                const match = text.match(regex);
                if (match) {
                    result[key] = match[1].trim();
                    console.log(`Parsed ${label} ->`, result[key]);
                } else {
                    // Fallback for missing closing bracket
                    const fallbackRegex = new RegExp(`▶\\s*${label}\\s*:\\s*\\[([^\\]\\n\\r]+)`, 'iu');
                    const fbMatch = text.match(fallbackRegex);
                    if (fbMatch) {
                        result[key] = fbMatch[1].trim();
                        console.log(`Parsed ${label} (Fallback) ->`, result[key]);
                    }
                }
            };

            ['채널', 'IF아이디', '서비스코드', '서비스명', '업무시스템', '에러코드', '발생건수', '발생노드', '에러메시지', '발생시각'].forEach(label => {
                const keyMap = {
                    '채널': 'channel', 'IF아이디': 'if_id', '서비스코드': 'service_code', 
                    '서비스명': 'service_name', '업무시스템': 'biz_system', '에러코드': 'error_code',
                    '발생건수': 'occurrence_count', '발생노드': 'occurrence_node', 
                    '에러메시지': 'error_message', '발생시각': 'occurrence_time'
                };
                extract(label, keyMap[label]);
            });

            // Receivers parsing
            const receiverRegex = /▶\s*메시지 수신자\s*:\s*\[\s*([^%\n\r\[\]]+)|▶\s*메시지 수신자\s*:\s*\[\s*([^\]]+)\]/i;
            const receiverMatch = text.match(receiverRegex);
            const rawContent = receiverMatch ? (receiverMatch[1] || receiverMatch[2] || '').trim() : '';
            
            if (rawContent) {
                const names = rawContent.split(/[,，\s]+/).map(n => n.replace(/\s+/g, '').trim()).filter(Boolean);
                console.log('Parsed Receivers ->', names);
                names.forEach((name, i) => {
                    if (i < 20) result[`receiver_${i + 1}`] = name;
                });
            }
        } catch (e) {
            console.error('Parsing Error:', e);
        }
        
        console.groupEnd();
        return result;
    };

    const handleSend = async (e) => {
        e?.preventDefault();
        if (!message.trim()) return;

        setIsLoading(true);
        const newLog = {
            time: new Date().toLocaleTimeString(),
            type: 'request',
            text: `장애 접수 중... (${message.substring(0, 20)}...)`
        };
        setLogs(prev => [newLog, ...prev]);

        try {
            // 1. Auto-parse message content for structured fields
            const parsedFields = parseSmsMessage(message);
            const hasParsed = Object.keys(parsedFields).length > 0;

            if (hasParsed) {
                setLogs(prev => [{
                    time: new Date().toLocaleTimeString(),
                    type: 'ai',
                    text: `[자동 파싱 완료] ${Object.keys(parsedFields).length}개 필드 추출됨 (수신인 등)`
                }, ...prev]);
            }

            // 2. Combine manual advanced fields and manually entered receivers
            const receiverPayload = {};
            receivers.forEach((r, i) => {
                if (r.trim()) receiverPayload[`receiver_${i + 1}`] = r.trim();
            });

            // 3. Construct payload with precedence: Parsed > Manual Advanced > Manual Receivers
            const payload = { 
                sender: sender || '',  // 실제 등록 전화번호 사용 (channel='MANUAL'로 대시보드 구분)
                message, 
                employee_id: employeeId,
                ...advanced,
                ...receiverPayload,
                ...parsedFields // Automatic parsing takes priority
            };

            const response = await fetch(getApiUrl('/sms/receive'), {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (response.ok) {
                setLogs(prev => [{
                    time: new Date().toLocaleTimeString(),
                    type: 'success',
                    text: `접수 성공! ${data.incident_id ? `(인시던트 ID: ${data.incident_id})` : '(API 접수 완료)'} - 1.5초 후 대시보드로 이동합니다.`
                }, ...prev]);
                
                setTimeout(() => {
                    navigate('/dashboard');
                }, 1500);
            } else {
                throw new Error(data.error || '접수 실패');
            }
        } catch (error) {
            setLogs(prev => [{
                time: new Date().toLocaleTimeString(),
                type: 'error',
                text: `접수 실패: ${error.message}`
            }, ...prev]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="h-full bg-[#040712] text-white p-4 lg:p-6 font-sans selection:bg-blue-500/30 overflow-y-auto relative custom-scrollbar">
            {/* 🌌 Premium Ambient Background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-600/10 blur-[150px] rounded-full animate-pulse" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-indigo-600/10 blur-[150px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
            </div>

            <div className="max-w-7xl mx-auto relative z-10">
                {/* ── Header Area ──────────────────────────── */}
                <header className="flex flex-col md:flex-row md:items-end justify-between mb-4 gap-4">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <button 
                                onClick={() => goBack()} 
                                className="group w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:border-white/20 transition-all active:scale-90"
                            >
                                <ArrowLeft className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
                            </button>
                            <div className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center gap-2">
                                <Terminal className="w-3.5 h-3.5 text-blue-400" />
                                <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">Manual Input System</span>
                            </div>
                        </div>
                        <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-none">
                            <span className="block text-white">S-GUARD</span>
                            <span className="block bg-gradient-to-r from-blue-400 via-indigo-400 to-white/40 bg-clip-text text-transparent italic">
                                Incident Push
                            </span>
                        </h1>
                    </div>

                    <div className="hidden lg:block max-w-sm text-right">
                        <p className="text-sm font-medium text-slate-400 leading-relaxed">
                            시스템에서 자동으로 감지되지 않은 특이 장애 상황을 수동으로 접수합니다. 
                            <span className="text-blue-400 font-bold ml-1">AI 멀티모달</span> 분석 기능을 활용하여 정밀한 상황 전파가 가능합니다.
                        </p>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* ── Entry Form Section (8 Cols) ─────────── */}
                    <div className="lg:col-span-8 space-y-8">
                        {/* 👤 Sender Profile Card */}
                        <div className="bg-white/[0.02] backdrop-blur-3xl border border-white/5 rounded-3xl p-4 flex items-center justify-between shadow-2xl group transition-all hover:bg-white/[0.04]">
                            <div className="flex items-center gap-5">
                                <div className="relative">
                                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                                        <UserCircle className="w-8 h-8 text-white" />
                                    </div>
                                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-green-500 border-4 border-[#040712] animate-pulse" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-white flex items-center gap-2">
                                        {userProfile?.name || 'Authorized User'}
                                        <span className="text-[10px] font-bold text-slate-500 font-mono">[{employeeId}]</span>
                                    </h3>
                                    <div className="flex items-center gap-3 mt-1 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                                        <span className="flex items-center gap-1.5"><Shield className="w-3 h-3 text-blue-500" /> {userProfile?.role || 'Operator'}</span>
                                        <span className="w-1 h-1 rounded-full bg-white/10" />
                                        <span className="flex items-center gap-1.5"><Phone className="w-3 h-3 text-indigo-500" /> {sender}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="hidden sm:block text-right">
                                <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] mb-1">Status</p>
                                <div className="px-3 py-1 rounded-lg bg-green-500/10 border border-green-500/20 text-[10px] font-black text-green-400">
                                    VERIFIED
                                </div>
                            </div>
                        </div>

                        {/* ⌨️ Main Input Area */}
                        <div className="bg-[#0c1020]/60 backdrop-blur-3xl border border-white/5 rounded-[3rem] overflow-hidden shadow-2xl relative">
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/[0.03] to-transparent pointer-events-none" />
                            
                            <div className="p-6 space-y-6">
                                {/* AI Tools Container */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between px-2">
                                        <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.25em]">AI Multi-modal Inputs</h4>
                                        {isConverting && (
                                            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20">
                                                <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                                                <span className="text-[10px] font-black text-blue-400 uppercase">Analyzing...</span>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current.click()}
                                            disabled={isConverting}
                                            className="group relative h-20 bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 rounded-2xl flex items-center justify-center gap-4 transition-all hover:border-blue-500/30 overflow-hidden"
                                        >
                                            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                <ImageIcon className="w-6 h-6 text-blue-400" />
                                            </div>
                                            <div className="text-left">
                                                <span className="block text-base font-black text-white">이미지 OCR 분석</span>
                                                <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Upload Screenshots</span>
                                            </div>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={toggleSTT}
                                            className={`group relative h-20 border rounded-2xl flex items-center justify-center gap-4 transition-all overflow-hidden ${
                                                isListening 
                                                ? 'bg-red-500/10 border-red-500/40 shadow-[0_0_30px_rgba(239,68,68,0.15)]' 
                                                : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/5 hover:border-indigo-500/30'
                                            }`}
                                        >
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${isListening ? 'bg-red-500 animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.4)]' : 'bg-indigo-500/10 group-hover:scale-110'}`}>
                                                <Mic className={`w-6 h-6 ${isListening ? 'text-white' : 'text-indigo-400'}`} />
                                            </div>
                                            <div className="text-left">
                                                <span className="block text-base font-black text-white">{isListening ? '음성 인식 중...' : '음성 STT 입력'}</span>
                                                <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Voice to Text</span>
                                            </div>
                                        </button>
                                        
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleFileUpload}
                                            className="hidden"
                                            accept="image/*"
                                            multiple
                                        />
                                    </div>

                                    {/* Image List */}
                                    {uploadedImages.length > 0 && (
                                        <div className="flex flex-wrap gap-4 mt-6">
                                            {uploadedImages.map(img => (
                                                <div key={img.id} className="relative group w-28 h-28 rounded-3xl overflow-hidden border border-white/10 bg-black shadow-2xl transition-all hover:scale-105 active:scale-95">
                                                    <img src={img.url} alt="Preview" className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                                                    <div className="absolute bottom-3 left-3 right-3">
                                                        <div className="h-1 rounded-full w-full overflow-hidden bg-white/10">
                                                            <div className={`h-full transition-all duration-1000 ${img.status === 'success' ? 'bg-green-500 w-full' : img.status === 'converting' ? 'bg-blue-500 w-1/2 animate-pulse' : 'bg-red-500 w-full'}`} />
                                                        </div>
                                                    </div>
                                                    <button 
                                                        type="button" 
                                                        onClick={() => setUploadedImages(prev => prev.filter(i => i.id !== img.id))}
                                                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white/40 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all border border-white/10"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Textarea Field */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between px-2">
                                        <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.25em]">Incident Details</h4>
                                        <button onClick={() => setMessageWithRef('')} className="text-[10px] font-black text-slate-600 hover:text-white transition-colors uppercase">Clear All</button>
                                    </div>
                                    <div className="relative group">
                                        <textarea
                                            value={message}
                                            onChange={(e) => setMessageWithRef(e.target.value)}
                                            rows="6"
                                            placeholder="장애 상황을 입력하거나 이미지/음성을 활용해 주세요..."
                                            className="w-full bg-black/40 border border-white/5 rounded-3xl p-6 text-lg font-medium text-white focus:outline-none focus:border-blue-500/40 transition-all resize-none leading-relaxed placeholder:text-slate-800 custom-scrollbar"
                                            required
                                        />
                                        <div className="absolute bottom-8 right-10 flex items-center gap-3">
                                            <div className="px-4 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black text-slate-500 tracking-widest uppercase">
                                                {message.length} <span className="text-slate-700">Chars</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                    <button
                                    onClick={handleSend}
                                    disabled={isLoading || !message.trim()}
                                    className="w-full h-20 relative group overflow-hidden bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:grayscale text-white rounded-[1.5rem] flex items-center justify-center transition-all shadow-[0_30px_60px_rgba(37,99,235,0.25)] active:scale-95"
                                >
                                    {isLoading ? (
                                        <div className="flex items-center gap-5">
                                            <Loader2 className="w-8 h-8 animate-spin" />
                                            <span className="text-2xl font-black italic tracking-tighter">TRANSMITTING...</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-5">
                                            <span className="text-2xl font-black italic tracking-tighter uppercase">Push to S-GUARD Fleet</span>
                                            <Send className="w-7 h-7 group-hover:translate-x-3 group-hover:-translate-y-3 transition-transform" />
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_2.5s_infinite]" />
                                </button>
                            </div>
                        </div>


                    </div>

                    {/* ── Real-time Status Section (4 Cols) ───── */}
                    <div className="lg:col-span-4 space-y-6">
                        <div className="bg-[#0c1020]/40 backdrop-blur-3xl border border-white/5 rounded-3xl p-6 flex flex-col h-[520px] shadow-2xl relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/[0.03] to-transparent pointer-events-none" />
                            
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h3 className="text-xl font-black text-white flex items-center gap-3">
                                        <Clipboard className="w-5 h-5 text-emerald-400" />
                                        Process Logs
                                    </h3>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1.5">Live Feed Activity</p>
                                </div>
                                <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shadow-lg">
                                    <Activity size={22} className="text-emerald-500 animate-pulse" />
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-5 pr-2">
                                {logs.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-20">
                                        <div className="w-20 h-20 rounded-full border-4 border-dashed border-white/10 flex items-center justify-center animate-spin-slow">
                                            <Terminal size={32} />
                                        </div>
                                        <p className="text-[12px] font-black uppercase tracking-[0.3em]">System Idling...</p>
                                    </div>
                                ) : (
                                    logs.map((log, idx) => (
                                        <div 
                                            key={idx} 
                                            className={`group p-5 rounded-[1.5rem] border transition-all animate-in slide-in-from-right-8 duration-700 ${
                                                log.type === 'error' ? 'bg-red-500/10 border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.05)]' :
                                                log.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.1)]' :
                                                log.type === 'ai' ? 'bg-blue-500/10 border-blue-500/20 border-dashed' :
                                                'bg-white/[0.04] border-white/5'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-1.5 h-1.5 rounded-full ${
                                                        log.type === 'error' ? 'bg-red-500 animate-pulse' :
                                                        log.type === 'success' ? 'bg-emerald-500' :
                                                        log.type === 'ai' ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]' :
                                                        'bg-slate-500'
                                                    }`} />
                                                    <span className={`text-[10px] font-black uppercase tracking-widest ${
                                                        log.type === 'error' ? 'text-red-400' :
                                                        log.type === 'success' ? 'text-emerald-400' :
                                                        log.type === 'ai' ? 'text-blue-400' :
                                                        'text-slate-500'
                                                    }`}>
                                                        {log.type}
                                                    </span>
                                                </div>
                                                <span className="text-[10px] font-mono font-bold text-slate-600">{log.time}</span>
                                            </div>
                                            <p className={`text-xs leading-relaxed font-bold tracking-tight ${
                                                log.type === 'error' ? 'text-red-300' :
                                                log.type === 'ai' ? 'text-blue-200 italic' :
                                                'text-slate-300'
                                            }`}>
                                                {log.text}
                                            </p>
                                        </div>
                                    ))
                                )}
                            </div>
                            
                            {/* Terminal-like Status Footer */}
                            <div className="mt-8 pt-8 border-t border-white/5">
                                <div className="flex items-center justify-between text-[10px] font-black font-mono">
                                    <div className="flex items-center gap-3">
                                        <span className="text-slate-600 uppercase">Gateway</span>
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                    </div>
                                    <span className="text-slate-500">v2.4.0-STABLE</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Custom Animations & Styles */}
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
                .animate-spin-slow {
                    animation: spin 12s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 5px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.1);
                }
            `}} />
        </div>
    );
};

export default IncidentPushPage;
