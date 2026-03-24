import React, { useState, useRef } from 'react';
import { Send, AlertTriangle, CheckCircle, Terminal, Image as ImageIcon, Mic, Loader2, Clipboard, ArrowRight } from 'lucide-react';

const SmsTestPage = () => {
    const [sender, setSender] = useState('1544-7000');
    const [message, setMessage] = useState('');
    const [logs, setLogs] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isConverting, setIsConverting] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const fileInputRef = useRef(null);
    const recognitionRef = useRef(null);

    const predefinedMessages = [
        { label: 'DB Connection Error', text: 'payment API timeout 및 database connection pool error 발생' },
        { label: 'Network Timeout', text: 'gateway 504 timeout error in user service' },
        { label: 'CPU Overload', text: 'CRITICAL: batch server CPU utilization reached 99%' }
    ];

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
    const getApiUrl = (path) => {
        const hostname = window.location.hostname;
        
        // '/sms/receive' and '/sms/convert-multimodal' must hit the Python Backend for AI processing
        if (path.startsWith('/sms/')) {
            return `http://${hostname}:8000${path}`;
        }

        const protocol = window.location.protocol;
        const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
        
        if (isLocal) {
            return `https://sguardai.khcho0421.workers.dev${path}`;
        }
        
        if (protocol === 'https:') {
            return `https://sguardai.khcho0421.workers.dev${path}`;
        }
        
        return `http://${hostname}:8000${path}`;
    };

    const handleFileUpload = async (e) => {
        let file = e.target.files[0];
        if (!file) return;

        if (file.type.includes('image')) {
            setIsConverting(true);
            setLogs(prev => [{
                time: new Date().toLocaleTimeString(),
                type: 'ai',
                text: `[단계 1/2] 이미지 최적화 중: ${file.name}`
            }, ...prev]);

            try {
                // 클라이언트 사이드 압축 적용
                file = await compressImage(file);
                
                setLogs(prev => [{
                    time: new Date().toLocaleTimeString(),
                    type: 'ai',
                    text: `[단계 2/2] AI 분석 요청 중 (크기: ${(file.size / 1024).toFixed(1)}KB)`
                }, ...prev]);

                const formData = new FormData();
                formData.append('file', file);

                const response = await fetch(getApiUrl('/sms/convert-multimodal'), {
                    method: 'POST',
                    body: formData,
                });

                if (!response.ok) throw new Error('변환 실패');
                const data = await response.json();
                console.log('DEBUG: OCR Response Data:', data);
                
                if (data.converted_text) {
                    setMessage(prev => prev ? `${prev}\n\n${data.converted_text}` : data.converted_text);
                } else {
                    console.warn('DEBUG: No converted_text in response');
                }
                
                setLogs(prev => [{
                    time: new Date().toLocaleTimeString(),
                    type: 'ai',
                    text: `[AI 이미지 인식 완료] ${file.name} 추출 성공: "${data.converted_text?.substring(0, 30)}..."`
                }, ...prev]);
            } catch (error) {
                setLogs(prev => [{
                    time: new Date().toLocaleTimeString(),
                    type: 'error',
                    text: `[AI 분석 실패] ${error.message}`
                }, ...prev]);
            } finally {
                setIsConverting(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        } else {
            setLogs(prev => [{
                time: new Date().toLocaleTimeString(),
                type: 'request',
                text: '[안내] 실시간 음성 인식(StT) 버튼을 사용해 보세요.'
            }, ...prev]);
        }
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
            const payload = { sender, message };
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
                setMessage('');
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
        <div className="min-h-screen bg-[#0a0c14] text-white p-6 md:p-12 font-sans selection:bg-blue-500/30">
            {/* Background Gradients */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full"></div>
            </div>

            <div className="max-w-6xl mx-auto relative z-10 space-y-10">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/10 pb-8">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-blue-500/20 rounded-lg border border-blue-500/30">
                                <Terminal className="w-6 h-6 text-blue-400" />
                            </div>
                            <span className="text-blue-400 font-mono text-sm tracking-widest uppercase">Manual Incident Entry</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white via-white to-white/40 bg-clip-text text-transparent">
                            S-Guard 장애 수동 접수
                        </h1>
                        <p className="text-slate-400 mt-4 text-lg max-w-2xl leading-relaxed">
                            자동 감지되지 않은 특이 장애 상황을 수동으로 접수합니다. 
                            <span className="text-blue-400/80"> 이미지(OCR) 및 음성(STT) AI 분석</span> 기능을 통해 현장 상황을 빠르게 텍스트로 전환할 수 있습니다.
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-full text-xs font-mono text-slate-400 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                            SYSTEM ACTIVE
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Entry Form - 7 Cols */}
                    <div className="lg:col-span-12 xl:col-span-8 space-y-6">
                        <div className="bg-[#151926]/60 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl shadow-black/50">
                            <div className="p-1 bg-gradient-to-r from-blue-500/20 via-indigo-500/20 to-transparent"></div>
                            <div className="p-8">
                                <form onSubmit={handleSend} className="space-y-8">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-sm font-semibold text-slate-300 ml-1">발신 번호 (Sender)</label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={sender}
                                                    onChange={(e) => setSender(e.target.value)}
                                                    className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all font-mono"
                                                />
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-bold uppercase tracking-tighter">System Default</div>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
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
                                                />
                                            </div>
                                        </div>
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
                                                rows="10"
                                                placeholder="예: 센터 네트워크 장비 L3 고용량 트래픽으로 인한 간헐적 지연 발생..."
                                                className="w-full bg-black/40 border border-white/10 rounded-2xl p-6 text-white text-lg focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all resize-none leading-relaxed placeholder:text-white/10"
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
                                        className="w-full relative group overflow-hidden bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-5 px-6 rounded-2xl flex items-center justify-center transition-all shadow-2xl shadow-blue-900/40 active:scale-[0.98]"
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

                        {/* Presets */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {predefinedMessages.map((preset, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setMessage(preset.text)}
                                    className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-5 text-left transition-all group hover:border-blue-500/50"
                                >
                                    <div className="flex items-center justify-between mb-3 text-blue-400 font-bold text-sm">
                                        {preset.label}
                                        <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                                    </div>
                                    <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed">{preset.text}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Logs - 4 Cols */}
                    <div className="lg:col-span-12 xl:col-span-4 flex flex-col h-full space-y-4">
                        <div className="bg-[#151926]/40 backdrop-blur-xl border border-white/5 rounded-3xl p-8 flex flex-col h-[740px] shadow-xl">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold flex items-center">
                                    <Clipboard className="w-5 h-5 mr-3 text-green-400" />
                                    접수 처리 로그
                                </h2>
                                <div className="text-[10px] font-mono text-slate-500 bg-white/5 px-2 py-1 rounded">LIVE FEED</div>
                            </div>

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

                            <div className="mt-6 pt-6 border-t border-white/5">
                                <a
                                    href="/#/dashboard"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="group w-full bg-white/5 hover:bg-white/10 py-3 rounded-xl text-slate-400 hover:text-white text-sm font-medium flex items-center justify-center gap-2 transition-all border border-white/5 hover:border-white/20"
                                >
                                    실시간 대시보드 모니터링
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style jsx>{`
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

export default SmsTestPage;
