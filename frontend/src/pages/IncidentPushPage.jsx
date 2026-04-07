import React, { useState, useRef } from 'react';
import { Send, AlertTriangle, CheckCircle, Terminal, Image as ImageIcon, Mic, Loader2, Clipboard, ArrowRight, SlidersHorizontal, ChevronDown, ChevronUp, UserCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const IncidentPushPage = () => {
    const navigate = useNavigate();
    const [sender, setSender] = useState('');
    const [employeeId, setEmployeeId] = useState('');
    const [message, setMessage] = useState('');
    const [advanced, setAdvanced] = useState({
        channel: '',
        if_id: '',
        service_code: '',
        service_name: '',
        biz_system: '',
        error_code: '',
        occurrence_count: '',
        occurrence_node: '',
        error_message: '',
        occurrence_time: new Date().toISOString().slice(0, 16) // Default to now
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
                    fetch(getApiUrl(`/users/${user.employee_id}`))
                        .then(res => res.json())
                        .then(dbUser => {
                            if (dbUser.phone) setSender(dbUser.phone);
                            if (dbUser.name) setUserProfile(dbUser);
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
            setLogs(prev => [{
                time: new Date().toLocaleTimeString(),
                type: 'ai',
                text: '[음성 인식 시작] 말씀해 주세요...'
            }, ...prev]);
        };

        recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            if (finalTranscript) {
                setMessage(prev => prev ? `${prev} ${finalTranscript}` : finalTranscript);
            }
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

                const response = await fetch(getApiUrl('/sms/convert-multimodal'), { method: 'POST', body: formData });
                const data = await response.json();
                
                if (!response.ok) throw new Error(data.error || '변환 실패');

                if (data.converted_text) {
                    let cleanedText = data.converted_text.replace(/\[(?:Web발신|신한카드)\]\s*/g, '').trim();
                    setMessage(prev => prev ? `${prev}\n\n${cleanedText}` : cleanedText);
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
                sender, 
                message, 
                employee_id: employeeId,
                ...advanced,
                ...receiverPayload,
                ...parsedFields // Automatic parsing takes priority
            };

            const response = await fetch(getApiUrl('/sms/receive'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (response.ok) {
                setLogs(prev => [{
                    time: new Date().toLocaleTimeString(),
                    type: 'success',
                    text: `접수 성공! ${data.incident_id ? `(인시던트 ID: ${data.incident_id})` : '(API 접수 완료)'}`
                }, ...prev]);
                // setMessage(''); // Keep message for reference
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
        <div className="min-h-screen bg-[#0a0c14] text-white p-4 sm:p-6 md:p-12 pb-24 font-sans selection:bg-blue-500/30 overflow-x-hidden">
            {/* Background Gradients */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full"></div>
            </div>

            <div className="max-w-6xl mx-auto relative z-10 space-y-10">
                {/* Header Section */}
                <div className="flex flex-col border-b border-white/10 pb-8">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-blue-500/20 rounded-lg border border-blue-500/30">
                                <Terminal className="w-6 h-6 text-blue-400" />
                            </div>
                            <span className="text-blue-400 font-mono text-sm tracking-widest uppercase">Incident Push (Direct Entry)</span>
                        </div>
                        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight flex items-center gap-4 flex-wrap">
                            <span className="bg-gradient-to-r from-white via-white to-white/40 bg-clip-text text-transparent">
                                S-GUARD 장애 접수
                            </span>
                            <div className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] sm:text-xs font-mono text-slate-400 flex items-center gap-2 shrink-0 mt-1 sm:mt-0">
                                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                                SYSTEM ACTIVE
                            </div>
                        </h1>
                        <p className="text-slate-400 mt-4 text-sm sm:text-base md:text-lg max-w-2xl leading-relaxed">
                            자동 감지되지 않은 특이 장애 상황을 수동으로 접수합니다. 
                            <span className="text-blue-400/80"> 이미지(OCR) 및 음성(STT) AI 분석</span> 기능을 통해 현장 상황을 빠르게 텍스트로 전환할 수 있습니다.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Entry Form - 7 Cols */}
                    <div className="lg:col-span-12 xl:col-span-8 space-y-6">
                        <div className="bg-[#151926]/60 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl shadow-black/50">
                            <div className="p-1 bg-gradient-to-r from-blue-500/20 via-indigo-500/20 to-transparent"></div>
                            <div className="p-4 sm:p-8">
                                <form onSubmit={handleSend} className="space-y-8">
                                    <div className="border border-white/10 bg-white/5 rounded-2xl overflow-hidden shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]">
                                        <button 
                                            type="button"
                                            onClick={() => setShowSenderInfo(!showSenderInfo)}
                                            className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors focus:outline-none"
                                        >
                                            <div className="flex items-center gap-2">
                                                <UserCircle className="w-5 h-5 text-indigo-400" />
                                                <span className="text-sm font-bold text-slate-200">발신자 기본 정보 (Sender Info)</span>
                                            </div>
                                            {showSenderInfo ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                                        </button>
                                        
                                        <div className={`transition-all duration-500 ease-in-out origin-top ${showSenderInfo ? 'max-h-[500px] opacity-100 scale-y-100' : 'max-h-0 opacity-0 scale-y-0 overflow-hidden hidden'}`}>
                                            <div className="p-5 border-t border-white/5 grid grid-cols-1 md:grid-cols-2 gap-6 bg-black/20">
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between ml-1 mb-2">
                                                        <label className="text-sm font-semibold text-slate-300">발신 사번 (Employee ID)</label>
                                                        {userProfile && (
                                                            <div className="flex flex-col items-end">
                                                                <button 
                                                                    type="button"
                                                                    onClick={() => setIsProfileExpanded(!isProfileExpanded)}
                                                                    className={`text-[9px] sm:text-[10px] text-blue-400 bg-blue-500/10 px-2 py-0.5 border border-blue-500/20 text-left transition-all ${isProfileExpanded ? 'rounded-lg whitespace-normal break-words w-[200px] sm:w-[400px] relative z-10 shadow-lg' : 'rounded-full truncate max-w-[150px] sm:max-w-[400px]'}`}
                                                                >
                                                                    {userProfile.name} {userProfile.role ? `(${userProfile.role})` : ''} - {userProfile.company || ''} {userProfile.honbu ? `> ${userProfile.honbu}` : ''} {userProfile.team ? `> ${userProfile.team}` : ''} {userProfile.part ? `> ${userProfile.part}` : ''}
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            value={employeeId}
                                                            readOnly
                                                            placeholder="사번 입력 (예: 1234567)"
                                                            className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-slate-400 cursor-not-allowed focus:outline-none transition-all font-mono"
                                                        />
                                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Auto Filled</div>
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-semibold text-slate-300 ml-1">발신 번호 (Sender)</label>
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            value={sender}
                                                            readOnly
                                                            className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-slate-400 cursor-not-allowed focus:outline-none transition-all font-mono"
                                                        />
                                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-bold uppercase tracking-tighter">System Default</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2 md:col-span-2">
                                            <label className="text-sm font-semibold text-slate-300 ml-1 flex justify-between">
                                                AI 멀티모달 인식 (Image/Audio)
                                                {isConverting && <span className="text-blue-400 animate-pulse flex items-center gap-1 text-[11px]"><Loader2 className="w-3 h-3 animate-spin"/> AI 분석 중...</span>}
                                            </label>
                                            <div className="flex gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => fileInputRef.current.click()}
                                                    disabled={isConverting}
                                                    className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-3 flex items-center justify-center gap-2 transition-all group"
                                                >
                                                    <ImageIcon className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform" />
                                                    <span className="text-sm font-medium">이미지 업로드</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={toggleSTT}
                                                    className={`flex-1 border rounded-xl p-3 flex items-center justify-center gap-2 transition-all group relative overflow-hidden ${
                                                        isListening 
                                                        ? 'bg-red-500/20 border-red-500/50 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.3)]' 
                                                        : 'bg-white/5 hover:bg-white/10 border-white/10 text-white'
                                                    }`}
                                                >
                                                    {isListening && (
                                                        <div className="absolute inset-0 bg-red-500/10 animate-pulse pointer-events-none"></div>
                                                    )}
                                                    <Mic className={`w-5 h-5 transition-transform ${isListening ? 'scale-110' : 'group-hover:scale-110'}`} />
                                                    <span className="text-sm font-medium">
                                                        {isListening ? '인식 중...' : '음성 인식'}
                                                    </span>
                                                </button>
                                                <input
                                                    type="file"
                                                    ref={fileInputRef}
                                                    onChange={handleFileUpload}
                                                    className="hidden"
                                                    accept="image/*,audio/*"
                                                    multiple
                                                />
                                            </div>
                                            
                                            {/* Image Preview Area */}
                                            {uploadedImages.length > 0 && (
                                                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                    {uploadedImages.map(img => (
                                                        <div key={img.id} className="p-3 bg-white/5 border border-white/10 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2 relative group">
                                                            <div className="w-12 h-12 rounded-lg overflow-hidden border border-white/10 shrink-0 bg-black/50">
                                                                <img src={img.url} alt="Preview" className="w-full h-full object-cover" />
                                                            </div>
                                                            <div className="flex-1 overflow-hidden">
                                                                <div className="flex justify-between items-start">
                                                                    <h4 className="text-xs font-semibold text-slate-200 truncate pr-4">{img.name}</h4>
                                                                    <button 
                                                                        type="button" 
                                                                        onClick={() => setUploadedImages(prev => prev.filter(i => i.id !== img.id))}
                                                                        className="absolute top-2 right-2 p-1 text-slate-500 hover:text-red-400 transition-colors leading-none text-base opacity-0 group-hover:opacity-100"
                                                                    >
                                                                        &times;
                                                                    </button>
                                                                </div>
                                                                <p className="text-[10px] text-slate-400 mt-0.5">{img.size}</p>
                                                                {img.status === 'converting' ? (
                                                                    <p className="text-[10px] text-blue-400 mt-1 animate-pulse flex items-center gap-1">
                                                                        <Loader2 className="w-3 h-3 animate-spin"/> 분석 중...
                                                                    </p>
                                                                ) : img.status === 'success' ? (
                                                                    <p className="text-[10px] text-green-400 mt-1 flex items-center gap-1">
                                                                        <CheckCircle className="w-3 h-3"/> 완료
                                                                    </p>
                                                                ) : (
                                                                    <p className="text-[10px] text-red-400 mt-1 flex items-center gap-1">
                                                                        <AlertTriangle className="w-3 h-3"/> 실패
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Advanced Toggle Removed as per request */}

                                        {showAdvanced && (
                                            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-white/5 rounded-2xl border border-white/5 animate-in fade-in slide-in-from-top-2">
                                                <div className="space-y-2">
                                                    <label className="text-xs font-semibold text-slate-400">채널 (Channel)</label>
                                                    <input type="text" value={advanced.channel} onChange={(e) => setAdvanced({...advanced, channel: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm focus:ring-1 focus:ring-blue-500/40 outline-none" placeholder="예: APP, WEB" />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-xs font-semibold text-slate-400">IF아이디 (IF ID)</label>
                                                    <input type="text" value={advanced.if_id} onChange={(e) => setAdvanced({...advanced, if_id: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm focus:ring-1 focus:ring-blue-500/40 outline-none" />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-xs font-semibold text-slate-400">서비스코드 (Service Code)</label>
                                                    <input type="text" value={advanced.service_code} onChange={(e) => setAdvanced({...advanced, service_code: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm focus:ring-1 focus:ring-blue-500/40 outline-none" />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-xs font-semibold text-slate-400">서비스명 (Service Name)</label>
                                                    <input type="text" value={advanced.service_name} onChange={(e) => setAdvanced({...advanced, service_name: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm focus:ring-1 focus:ring-blue-500/40 outline-none" />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-xs font-semibold text-slate-400">업무시스템 (Business System)</label>
                                                    <input type="text" value={advanced.biz_system} onChange={(e) => setAdvanced({...advanced, biz_system: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm focus:ring-1 focus:ring-blue-500/40 outline-none" />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-xs font-semibold text-slate-400">에러코드 (Error Code)</label>
                                                    <input type="text" value={advanced.error_code} onChange={(e) => setAdvanced({...advanced, error_code: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm focus:ring-1 focus:ring-blue-500/40 outline-none" />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-xs font-semibold text-slate-400">발생건수 (Count)</label>
                                                    <input type="text" value={advanced.occurrence_count} onChange={(e) => setAdvanced({...advanced, occurrence_count: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm focus:ring-1 focus:ring-blue-500/40 outline-none" placeholder="예: 5건" />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-xs font-semibold text-slate-400">발생노드 (Node)</label>
                                                    <input type="text" value={advanced.occurrence_node} onChange={(e) => setAdvanced({...advanced, occurrence_node: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm focus:ring-1 focus:ring-blue-500/40 outline-none" />
                                                </div>
                                                <div className="space-y-2 md:col-span-2">
                                                    <label className="text-xs font-semibold text-slate-400">에러메세지 (Error Message)</label>
                                                    <input type="text" value={advanced.error_message} onChange={(e) => setAdvanced({...advanced, error_message: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm focus:ring-1 focus:ring-blue-500/40 outline-none" />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-xs font-semibold text-slate-400">발생시각 (Occurrence Time)</label>
                                                    <input type="datetime-local" value={advanced.occurrence_time} onChange={(e) => setAdvanced({...advanced, occurrence_time: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm focus:ring-1 focus:ring-blue-500/40 outline-none" />
                                                </div>

                                                {/* Receivers Grid */}
                                                <div className="md:col-span-2 mt-4 space-y-4">
                                                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest border-b border-white/5 pb-2">메시지 수신자 목록 (1~20)</h4>
                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                        {receivers.map((r, i) => (
                                                            <div key={i} className="space-y-1">
                                                                <label className="text-[10px] text-slate-500 ml-1">수신자 {i + 1}</label>
                                                                <input 
                                                                    type="text" 
                                                                    value={r} 
                                                                    onChange={(e) => {
                                                                        const newRec = [...receivers];
                                                                        newRec[i] = e.target.value;
                                                                        setReceivers(newRec);
                                                                    }}
                                                                    placeholder="전화번호/사번"
                                                                    className="w-full bg-black/30 border border-white/5 rounded-lg p-2 text-xs outline-none focus:border-blue-500/30 transition-all font-mono"
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-300 ml-1 flex justify-between">
                                            상세 장애 내용 (Message)
                                            <span className="text-[11px] text-slate-500 font-mono tracking-widest uppercase">Incident Details</span>
                                        </label>
                                        <div className="relative">
                                            <textarea
                                                value={message}
                                                onChange={(e) => setMessage(e.target.value)}
                                                rows="8"
                                                placeholder="예: 센터 네트워크 장비 L3 고용량 트래픽으로 인한 간헐적 지연 발생..."
                                                className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 sm:p-6 text-white text-base sm:text-lg focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all resize-none leading-relaxed placeholder:text-white/10 font-sans"
                                                required
                                            />
                                            {message && (
                                                <button
                                                    type="button"
                                                    onClick={() => setMessage('')}
                                                    className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-slate-500 transition-colors"
                                                >
                                                    초기화
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isLoading || !message.trim()}
                                        className="w-full relative group overflow-hidden bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 sm:py-5 px-6 rounded-2xl flex items-center justify-center transition-all shadow-2xl shadow-blue-900/40 active:scale-[0.98]"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite] transition-transform"></div>
                                        {isLoading ? (
                                            <div className="flex items-center gap-3">
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                <span>인시던트 등록 중...</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-3">
                                                <span className="text-lg">장애 상황 접수하기</span>
                                                <Send className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                                            </div>
                                        )}
                                    </button>
                                </form>
                            </div>
                        </div>


                    </div>

                    {/* Logs - 4 Cols */}
                    <div className="lg:col-span-12 xl:col-span-4 flex flex-col h-full space-y-4">
                        <div className={`bg-[#151926]/40 backdrop-blur-xl border border-white/5 rounded-3xl p-6 sm:p-8 flex flex-col shadow-xl transition-all duration-500 overflow-hidden ${showLogs ? 'h-[500px] xl:h-[740px]' : 'h-auto'}`}>
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold flex items-center">
                                    <Clipboard className="w-5 h-5 mr-3 text-green-400" />
                                    접수 처리 로그
                                </h2>
                                <div className="flex items-center gap-3">
                                    <div className="text-[10px] font-mono text-slate-500 bg-white/5 px-2 py-1 rounded">LIVE FEED</div>
                                    <button 
                                        type="button" 
                                        onClick={() => setShowLogs(!showLogs)} 
                                        className="p-1 hover:bg-white/10 rounded transition-colors focus:outline-none"
                                    >
                                        {showLogs ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                                    </button>
                                </div>
                            </div>

                            <div className={`transition-all duration-500 flex flex-col flex-1 ease-in-out ${showLogs ? 'mt-6 opacity-100' : 'h-0 mt-0 opacity-0 overflow-hidden hidden'}`}>
                                <div className="flex-1 bg-black/60 rounded-2xl p-6 overflow-y-auto font-mono text-sm space-y-4 custom-scrollbar">
                                {logs.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-600 opacity-50 space-y-3">
                                        <div className="w-12 h-12 rounded-full border-2 border-dashed border-slate-700 flex items-center justify-center">
                                            <Loader2 className="w-6 h-6 animate-pulse" />
                                        </div>
                                        <p>접수 대기 중...</p>
                                    </div>
                                ) : (
                                    logs.map((log, idx) => (
                                        <div key={idx} className="flex gap-4 group">
                                            <div className="flex flex-col items-center gap-1">
                                                <div className={`w-2 h-2 rounded-full mt-1.5 
                                                    ${log.type === 'error' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : ''}
                                                    ${log.type === 'success' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : ''}
                                                    ${log.type === 'request' ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]' : ''}
                                                    ${log.type === 'ai' ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]' : ''}
                                                `}></div>
                                                <div className="w-[1px] h-full bg-white/5 group-last:bg-transparent"></div>
                                            </div>
                                            <div className="pb-6">
                                                <div className="text-slate-500 text-[10px] mb-1 font-bold">{log.time}</div>
                                                <div className={`leading-relaxed break-all
                                                    ${log.type === 'error' ? 'text-red-400' : ''}
                                                    ${log.type === 'success' ? 'text-green-400' : ''}
                                                    ${log.type === 'request' ? 'text-blue-300' : ''}
                                                    ${log.type === 'ai' ? 'text-indigo-300 italic' : 'text-slate-300'}
                                                `}>
                                                    {log.text}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                                </div>
                            </div>

                            <div className={`pt-6 border-t border-white/5 ${showLogs ? 'mt-6' : 'mt-4'}`}>
                                <button
                                    type="button"
                                    onClick={() => navigate('/dashboard')}
                                    className="group w-full bg-white/5 hover:bg-white/10 py-3 rounded-xl text-slate-400 hover:text-white text-sm font-medium flex items-center justify-center gap-2 transition-all border border-white/5 hover:border-white/20"
                                >
                                    메인 홈으로 이동
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes shimmer {
                    100% { transform: translateX(100%); }
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.2);
                }
            `}</style>
        </div>
    );
};

export default IncidentPushPage;
