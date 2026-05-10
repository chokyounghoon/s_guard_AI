import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Send, AlertTriangle, CheckCircle, Loader2, ChevronLeft,
  Mic, Square, Image as ImageIcon, Zap, ClipboardList,
  Clock, RefreshCw, ChevronRight, Bot
} from 'lucide-react';
import { getUserProfile, getAuthHeaders } from '../../lib/authStore';

const API_BASE = 'https://sguardai.khcho0421.workers.dev';

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso), now = new Date(), s = (now - d) / 1000;
  if (s < 60)    return '방금';
  if (s < 3600)  return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  return d.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
}

const STATUS_COLOR = {
  '처리완료': '#10b981',
  '처리중':   '#eab308',
  '미처리':   '#f87171',
  '미참여':   '#475569',
};

export default function MobileIncidentPush({ user, onAiClick }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState('push'); // 'push' | 'log'

  // ─── Push 탭 State ───
  const [message, setMessage]     = useState('');
  const [sending, setSending]     = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [result, setResult]       = useState(null);
  const [images, setImages]       = useState([]);
  const [converting, setConverting] = useState(false);
  const fileRef    = useRef(null);
  const recognitionRef = useRef(null);

  // ─── Log 탭 State ───
  const [logs, setLogs]         = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const profile    = user || getUserProfile();
  const employeeId = profile?.employee_id || '';
  const sender     = profile?.phone || profile?.mobile || '';

  // ── 로그 조회 ──
  const fetchLogs = useCallback(async () => {
    if (!employeeId) return;
    setLogsLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/ai/incident/my-assignments?user_id=${encodeURIComponent(employeeId)}`,
        { headers: getAuthHeaders() }
      );
      if (res.ok) {
        const data = await res.json();
        setLogs(data.assignments || []);
      }
    } catch (e) { console.warn(e); }
    finally { setLogsLoading(false); }
  }, [employeeId]);

  useEffect(() => {
    if (tab === 'log') fetchLogs();
  }, [tab, fetchLogs]);

  // ── STT ──
  const toggleSTT = () => {
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('이 브라우저는 음성 인식을 지원하지 않습니다.'); return; }
    const rec = new SR();
    rec.lang = 'ko-KR'; rec.interimResults = true; rec.continuous = true;
    rec.onstart  = () => setIsListening(true);
    rec.onresult = (e) => {
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++)
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
      if (final) setMessage(prev => prev ? `${prev} ${final}` : final);
    };
    rec.onend  = () => setIsListening(false);
    rec.onerror = () => setIsListening(false);
    recognitionRef.current = rec;
    rec.start();
  };

  // ── OCR ──
  const handleImage = async (e) => {
    const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/')).slice(0, 3);
    if (!files.length) return;
    setConverting(true);
    for (const file of files) {
      const id = Math.random().toString(36).slice(2);
      setImages(prev => [...prev, { id, name: file.name, status: 'loading' }]);
      try {
        const form = new FormData();
        form.append('file', file);
        const res = await fetch(`${API_BASE}/sms/convert-multimodal`, {
          method: 'POST', body: form,
          headers: getAuthHeaders({ 'Content-Type': null }),
        });
        if (!res.ok) throw new Error('변환 실패');
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
              try { const d = JSON.parse(line.slice(5).trim()); if (d.event === 'message' || d.event === 'agent_message') acc += d.answer || ''; } catch (_) {}
            }
          }
        }
        const cleaned = acc.replace(/\[(?:Web발신|신한카드)\]\s*/g, '').trim();
        if (cleaned) setMessage(prev => prev ? `${prev}\n\n${cleaned}` : cleaned);
        setImages(prev => prev.map(img => img.id === id ? { ...img, status: 'success' } : img));
      } catch {
        setImages(prev => prev.map(img => img.id === id ? { ...img, status: 'error' } : img));
      }
    }
    setConverting(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  // ── 접수 ──
  const handleSubmit = async () => {
    if (!message.trim()) return;
    setSending(true); setResult(null);
    try {
      const res = await fetch(`${API_BASE}/sms/receive`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ sender: sender || '00-0000-0000', message: message.trim(), employee_id: employeeId, channel: 'MANUAL' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.detail || '접수 실패');
      setResult({ type: 'success', text: '접수 완료', incId: data.incident_id || data.inc_id });
      setMessage(''); setImages([]);
      setTimeout(() => navigate('/dashboard'), 2000);
    } catch (e) {
      setResult({ type: 'error', text: e.message });
    } finally {
      setSending(false);
    }
  };

  const canSubmit = !sending && message.trim().length > 0;

  return (
    <div style={{
      height: '100dvh', display: 'flex', flexDirection: 'column',
      background: 'linear-gradient(160deg, #030a18 0%, #060d1e 60%, #030a18 100%)',
      fontFamily: "'Pretendard', 'Inter', sans-serif", color: '#cbd5e1',
    }}>
      <style>{`
        @keyframes spin  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.3} }
        textarea::placeholder { color:#2d3748; }
        textarea:focus { border-color:rgba(16,185,129,.35)!important; box-shadow:0 0 0 3px rgba(16,185,129,.06); }
        input::placeholder { color:#1e293b; }
        ::-webkit-scrollbar{width:3px} ::-webkit-scrollbar-thumb{background:rgba(16,185,129,.2);border-radius:99px}
      `}</style>

      {/* ①  헤더 */}
      <header style={{
        flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '13px 16px',
        borderBottom: '1px solid rgba(16,185,129,0.12)',
        background: 'rgba(3,10,24,0.96)', backdropFilter: 'blur(20px)',
      }}>
        <button onClick={() => navigate(-1)} style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}>
          <ChevronLeft size={18} color="#64748b" />
        </button>

        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: 16, fontWeight: 900, letterSpacing: '0.04em',
            background: 'linear-gradient(90deg,#10b981,#34d399)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>장애 수동 접수</div>
          <div style={{ fontSize: 11, color: '#10b981', fontWeight: 800, letterSpacing: '0.15em', opacity: 0.6 }}>
            MANUAL ENTRY · INCIDENT PUSH
          </div>
        </div>

        {onAiClick ? (
          <button onClick={onAiClick} style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}>
            <Bot size={18} color="#a855f7" style={{ filter: 'drop-shadow(0 0 6px rgba(168,85,247,0.4))' }} />
          </button>
        ) : (
          <div style={{ width: 36 }} />
        )}
      </header>

      {/* ②  탭 */}
      <div style={{ flexShrink: 0, display: 'flex', gap: 8, padding: '10px 16px 0' }}>
        {[
          { key: 'push', label: '장애 접수', Icon: Zap },
          { key: 'log',  label: '접수 로그', Icon: ClipboardList },
        ].map(({ key, label, Icon }) => (
          <button key={key} onClick={() => setTab(key)} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '11px', borderRadius: 12, cursor: 'pointer',
            fontSize: 14, fontWeight: 800,
            background: tab === key ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.03)',
            border: tab === key ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255,255,255,0.06)',
            color: tab === key ? '#10b981' : '#475569',
            transition: 'all 0.15s',
          }}>
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* ===== PUSH 탭 ===== */}
      {tab === 'push' && (
        <>
          {/* 발신자 정보 */}
          <div style={{ flexShrink: 0, display: 'flex', gap: 8, padding: '10px 16px 0' }}>
            {[
              { label: '발신자', value: profile?.name || employeeId || '알 수 없음' },
              { label: '사번',   value: employeeId || '-' },
              { label: '채널',   value: 'MANUAL' },
            ].map(item => (
              <div key={item.label} style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: '#475569', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 3 }}>{item.label}</div>
                <div style={{ fontSize: 14, color: '#94a3b8', fontFamily: 'monospace', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          {/* AI 보조 입력 */}
          <div style={{ flexShrink: 0, padding: '10px 16px 0' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#64748b', letterSpacing: '0.06em', marginBottom: 8 }}>AI 보조 입력</div>
            <input type="file" accept="image/*" multiple ref={fileRef} onChange={handleImage} style={{ display: 'none' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button onClick={() => fileRef.current.click()} disabled={converting} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '13px', borderRadius: 12,
                background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
                color: '#818cf8', fontWeight: 700, fontSize: 15, cursor: converting ? 'not-allowed' : 'pointer',
                opacity: converting ? 0.6 : 1,
              }}>
                {converting ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <ImageIcon size={14} />}
                {converting ? '분석 중...' : 'OCR 분석'}
              </button>
              <button onClick={toggleSTT} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '13px', borderRadius: 12,
                background: isListening ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.05)',
                border: isListening ? '1px solid rgba(239,68,68,0.35)' : '1px solid rgba(255,255,255,0.08)',
                color: isListening ? '#f87171' : '#94a3b8',
                fontWeight: 700, fontSize: 15, cursor: 'pointer',
              }}>
                {isListening ? <Square size={14} /> : <Mic size={14} />}
                {isListening ? '중단하기' : '음성 입력'}
              </button>
            </div>
          </div>

          {/* 텍스트 영역 */}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '10px 16px 0' }}>
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#64748b', letterSpacing: '0.06em' }}>장애 상세 내용</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {message && <span style={{ fontSize: 13, color: '#334155', fontFamily: 'monospace' }}>{message.length}자</span>}
                {message && (
                  <button onClick={() => setMessage('')} style={{ fontSize: 13, color: '#f87171', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    초기화
                  </button>
                )}
              </div>
            </div>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="예: 센터 네트워크 장비 L3 고용량 트래픽으로 인한 간헐적 지연 발생..."
              style={{
                flex: 1, width: '100%', boxSizing: 'border-box', resize: 'none',
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 14, padding: '12px 14px',
                color: '#f1f5f9', fontSize: 16, lineHeight: 1.7, outline: 'none',
                fontFamily: "'Pretendard', 'Inter', sans-serif",
                transition: 'border-color 0.2s, box-shadow 0.2s',
              }}
            />
          </div>

          {/* 결과 + 전송 버튼 */}
          <div style={{
            flexShrink: 0, padding: '10px 16px',
            paddingBottom: 'calc(80px + env(safe-area-inset-bottom))',
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            {result && (
              <div style={{
                borderRadius: 12, padding: '10px 14px',
                display: 'flex', alignItems: 'flex-start', gap: 10,
                background: result.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                border: `1px solid ${result.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
              }}>
                {result.type === 'success'
                  ? <CheckCircle size={16} color="#10b981" style={{ flexShrink: 0, marginTop: 1 }} />
                  : <AlertTriangle size={16} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />}
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: result.type === 'success' ? '#10b981' : '#f87171' }}>
                    {result.text}
                  </div>
                  {result.incId && (
                    <div style={{ fontSize: 13, color: '#475569', fontFamily: 'monospace', marginTop: 3 }}>
                      INC-{result.incId} · 2초 후 대시보드로 이동합니다
                    </div>
                  )}
                </div>
              </div>
            )}

            <button
              id="mobile-incident-submit"
              onClick={handleSubmit}
              disabled={!canSubmit}
              style={{
                width: '100%', padding: '17px',
                borderRadius: 14, fontWeight: 900, fontSize: 17,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                background: canSubmit
                  ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)'
                  : 'rgba(255,255,255,0.05)',
                border: canSubmit ? 'none' : '1px solid rgba(255,255,255,0.08)',
                color: canSubmit ? '#fff' : '#334155',
                boxShadow: canSubmit ? '0 0 30px rgba(16,185,129,0.3)' : 'none',
                transition: 'all 0.2s',
              }}>
              {sending
                ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> 접수 처리 중...</>
                : <><Send size={18} /> 장애 접수 전송</>}
            </button>
          </div>
        </>
      )}

      {/* ===== LOG 탭 ===== */}
      {tab === 'log' && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {/* 로그 헤더 */}
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ClipboardList size={16} color="#10b981" />
              <span style={{ fontSize: 14, fontWeight: 800, color: '#e2e8f0' }}>내 접수 로그</span>
              <span style={{
                fontSize: 12, color: '#10b981', fontWeight: 700,
                background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)',
                borderRadius: 6, padding: '1px 8px',
              }}>{logs.length}건</span>
            </div>
            <button onClick={fetchLogs} style={{
              width: 32, height: 32, borderRadius: 9,
              background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}>
              <RefreshCw size={14} color="#10b981" style={{ animation: logsLoading ? 'spin 1s linear infinite' : 'none' }} />
            </button>
          </div>

          {/* 로그 목록 */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px 16px', paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}>
            {logsLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 120 }}>
                <Loader2 size={24} color="#10b981" style={{ animation: 'spin 1s linear infinite' }} />
              </div>
            ) : logs.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 150, gap: 8 }}>
                <ClipboardList size={32} color="#1e293b" />
                <span style={{ fontSize: 14, color: '#334155', fontWeight: 700 }}>접수 로그가 없습니다</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {logs.map((log, i) => {
                  const stColor = STATUS_COLOR[log.status] || '#475569';
                  const incId = log.inc_id || log.id;
                  return (
                    <div key={i} onClick={() => navigate(`/dashboard`)} style={{
                      borderRadius: 18, padding: '14px 16px', cursor: 'pointer',
                      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                      position: 'relative', overflow: 'hidden',
                      transition: 'border-color 0.15s',
                    }}>
                      {/* 상단 좌측 색상 바 */}
                      <div style={{
                        position: 'absolute', top: 0, left: 0, bottom: 0, width: 3,
                        background: stColor, borderRadius: '18px 0 0 18px',
                      }} />

                      {/* 1행: 인시던트 ID + 상태 + 시각 */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{
                          fontSize: 13, fontWeight: 800, fontFamily: 'monospace', color: '#818cf8',
                          background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.2)',
                          borderRadius: 6, padding: '2px 8px',
                        }}>INC-{String(incId)}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            fontSize: 12, fontWeight: 800, color: stColor,
                            background: `${stColor}15`, borderRadius: 6, padding: '2px 8px',
                          }}>{log.status || '미처리'}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Clock size={11} color="#334155" />
                            <span style={{ fontSize: 11, color: '#334155', fontFamily: 'monospace' }}>
                              {formatTime(log.assigned_at || log.message_at)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 2행: 메시지 내용 */}
                      {log.message && (
                        <div style={{
                          fontSize: 14, color: '#94a3b8', lineHeight: 1.5, marginBottom: 8,
                          overflow: 'hidden', display: '-webkit-box',
                          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                        }}>
                          {log.message}
                        </div>
                      )}

                      {/* 3행: 발신자 + 채팅 수 */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, color: '#475569', fontWeight: 700 }}>
                          {log.sender || log.sms_sender || '수동접수'}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {log.chat_count > 0 && (
                            <span style={{ fontSize: 12, color: '#10b981', fontWeight: 700 }}>
                              💬 {log.chat_count}
                            </span>
                          )}
                          <ChevronRight size={14} color="#334155" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
