import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Send, AlertTriangle, CheckCircle, Loader2, ChevronLeft,
  Mic, Square, Image as ImageIcon, Terminal, X
} from 'lucide-react';
import { getAccessToken, getUserProfile, getAuthHeaders } from '../../lib/authStore';

const API_BASE = 'https://sguardai.khcho0421.workers.dev';

export default function MobileIncidentPush({ user }) {
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [result, setResult] = useState(null);
  const [images, setImages] = useState([]);
  const [converting, setConverting] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  const fileRef = useRef(null);
  const recognitionRef = useRef(null);

  // user props가 늦게 올 수도 있으니 authStore에서도 fallback
  const profile = user || getUserProfile();
  const employeeId = profile?.employee_id || '';
  const sender = profile?.phone || profile?.mobile || '';

  // STT 토글
  const toggleSTT = () => {
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('이 브라우저는 음성 인식을 지원하지 않습니다.'); return; }
    const rec = new SR();
    rec.lang = 'ko-KR'; rec.interimResults = true; rec.continuous = true;
    rec.onstart = () => setIsListening(true);
    rec.onresult = (e) => {
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
      }
      if (final) setMessage(prev => prev ? `${prev} ${final}` : final);
    };
    rec.onend = () => setIsListening(false);
    rec.onerror = () => setIsListening(false);
    recognitionRef.current = rec;
    rec.start();
  };

  // 이미지 → AI OCR → 텍스트
  const handleImage = async (e) => {
    const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/')).slice(0, 3);
    if (!files.length) return;
    setConverting(true);
    for (const file of files) {
      const id = Math.random().toString(36).slice(2);
      const objectUrl = URL.createObjectURL(file);
      setImages(prev => [...prev, { id, name: file.name, status: 'loading', url: objectUrl }]);
      try {
        const form = new FormData();
        form.append('file', file);
        const res = await fetch(`${API_BASE}/sms/convert-multimodal`, {
          method: 'POST',
          body: form,
          headers: getAuthHeaders({ 'Content-Type': null }),
        });
        if (!res.ok) throw new Error('변환 실패');

        // SSE 스트리밍 응답 파싱
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = '', acc = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split('\n'); buf = lines.pop() || '';
          for (const line of lines) {
            if (line.startsWith('data:')) {
              try {
                const d = JSON.parse(line.slice(5).trim());
                if (d.event === 'message' || d.event === 'agent_message') acc += d.answer || '';
              } catch (_) {}
            }
          }
        }
        const cleaned = acc.replace(/\[(?:Web발신|신한카드)\]\s*/g, '').trim();
        if (cleaned) setMessage(prev => prev ? `${prev}\n\n${cleaned}` : cleaned);
        setImages(prev => prev.map(img => img.id === id ? { ...img, status: 'success' } : img));
      } catch (err) {
        setImages(prev => prev.map(img => img.id === id ? { ...img, status: 'error' } : img));
      }
    }
    setConverting(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  // 장애 접수 제출
  const handleSubmit = async () => {
    if (!message.trim()) return;
    setSending(true); setResult(null);
    try {
      const res = await fetch(`${API_BASE}/sms/receive`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          sender: sender || '00-0000-0000',
          message: message.trim(),
          employee_id: employeeId,
          channel: 'MANUAL',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.detail || '접수 실패');
      setResult({
        type: 'success',
        text: `접수 완료! 인시던트 ID: ${data.incident_id || data.inc_id || '-'}`,
        incId: data.incident_id || data.inc_id,
      });
      setMessage('');
      setImages([]);
      // 2초 후 대시보드 이동
      setTimeout(() => navigate('/dashboard'), 2000);
    } catch (e) {
      setResult({ type: 'error', text: e.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0a0e17] pb-24 overflow-y-auto">

      {/* 헤더 */}
      <header className="sticky top-0 z-40 bg-[#0a0e17]/95 backdrop-blur-md border-b border-white/5 px-4 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-white/10 transition-colors active:scale-90">
            <ChevronLeft className="w-5 h-5 text-slate-300" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-blue-400" />
              <h1 className="font-black text-white text-lg">장애 접수</h1>
            </div>
            <p className="text-[11px] text-slate-500">Incident Push · 수동 접수</p>
          </div>
        </div>
      </header>

      <div className="px-4 pt-5 space-y-5">

        {/* 발신자 자동 정보 */}
        <div className="bg-[#131927] border border-white/5 rounded-2xl p-4">
          <p className="text-[11px] text-slate-500 mb-2 font-medium uppercase tracking-wider">발신자 정보 (자동 입력)</p>
          <div className="flex gap-4">
            <div className="flex-1">
              <p className="text-[10px] text-slate-500 mb-1">사번</p>
              <p className="text-sm font-mono text-slate-300">{employeeId || '—'}</p>
            </div>
            <div className="flex-1">
              <p className="text-[10px] text-slate-500 mb-1">발신 번호</p>
              <p className="text-sm font-mono text-slate-300">{sender || '시스템 기본'}</p>
            </div>
          </div>
        </div>

        {/* AI 보조 입력 도구 */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">AI 보조 입력</p>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => fileRef.current.click()} disabled={converting}
              className="flex items-center justify-center gap-2 bg-white/5 border border-white/10 rounded-2xl py-4 text-sm text-slate-300 hover:bg-white/10 active:scale-95 transition-all disabled:opacity-50">
              {converting
                ? <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                : <ImageIcon className="w-4 h-4 text-indigo-400" />}
              <span>{converting ? 'AI 분석 중...' : '이미지 OCR'}</span>
            </button>
            <button onClick={toggleSTT}
              className={`flex items-center justify-center gap-2 border rounded-2xl py-4 text-sm transition-all active:scale-95 ${
                isListening
                  ? 'bg-red-500/20 border-red-500/40 text-red-400'
                  : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
              }`}>
              {isListening ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4 text-blue-400" />}
              <span>{isListening ? '중단하기' : '음성 입력'}</span>
            </button>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImage} />
          </div>

          {/* 이미지 썸네일 */}
          {images.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {images.map(img => (
                <div key={img.id} className="relative w-14 h-14">
                  <img src={img.url} className="w-full h-full object-cover rounded-xl border border-white/10" alt={img.name} />
                  {img.status === 'loading' && (
                    <div className="absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center">
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                    </div>
                  )}
                  {img.status === 'success' && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                  <button onClick={() => setImages(p => p.filter(i => i.id !== img.id))}
                    className="absolute -top-1 -left-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                    <X className="w-2.5 h-2.5 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {isListening && (
            <div className="flex items-center gap-2 px-1">
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              <span className="text-xs text-red-400">음성 인식 중... 말씀해 주세요.</span>
            </div>
          )}
        </div>

        {/* 장애 내용 입력 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">장애 상세 내용</p>
            {message && (
              <button onClick={() => setMessage('')} className="text-[10px] text-red-400/70 hover:text-red-400">
                초기화
              </button>
            )}
          </div>
          <div className="relative">
            <textarea value={message} onChange={(e) => setMessage(e.target.value)}
              placeholder="예: 센터 네트워크 장비 L3 고용량 트래픽으로 인한 간헐적 지연 발생..."
              rows={7}
              className="w-full bg-[#131927] border border-white/10 rounded-2xl p-4 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/30 focus:ring-1 focus:ring-blue-500/10 transition-all resize-none leading-relaxed" />
            {message && (
              <div className="absolute bottom-3 right-3 text-[10px] text-slate-600 font-mono">{message.length}자</div>
            )}
          </div>
        </div>

        {/* 결과 메시지 */}
        {result && (
          <div className={`rounded-2xl p-4 flex items-start gap-3 ${
            result.type === 'success'
              ? 'bg-green-500/10 border border-green-500/20'
              : 'bg-red-500/10 border border-red-500/20'
          }`}>
            {result.type === 'success'
              ? <CheckCircle className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
              : <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />}
            <p className={`text-sm font-medium ${result.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
              {result.text}
            </p>
          </div>
        )}

        {/* 제출 버튼 */}
        <button id="mobile-incident-submit" onClick={handleSubmit}
          disabled={sending || !message.trim()}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-5 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-xl shadow-blue-900/30">
          {sending
            ? <><Loader2 className="w-5 h-5 animate-spin" /><span>접수 중...</span></>
            : <><Send className="w-5 h-5" /><span>장애 상황 접수하기</span></>}
        </button>

        {/* 입력 가이드 */}
        {showGuide && (
          <div className="bg-blue-900/10 border border-blue-500/20 rounded-2xl p-4 relative">
            <button onClick={() => setShowGuide(false)} className="absolute top-3 right-3 text-slate-600 hover:text-slate-400">
              <X className="w-4 h-4" />
            </button>
            <p className="text-xs font-bold text-blue-400 mb-2">💡 입력 가이드</p>
            <ul className="text-[11px] text-slate-400 space-y-1 leading-relaxed">
              <li>• <b>이미지 OCR</b>: 화면 캡처 / 로그 사진 → AI가 자동 텍스트 변환</li>
              <li>• <b>음성 입력</b>: 현장 상황 음성으로 말하면 실시간 텍스트 변환</li>
              <li>• 접수 후 AI가 자동 분석하고 전문가 에이전트를 호출합니다</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
