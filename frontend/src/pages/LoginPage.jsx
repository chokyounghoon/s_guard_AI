import React, { useState, useEffect, useRef } from 'react';
import {
  AlertCircle, ArrowLeft, RotateCcw,
  CheckCircle, Check, Eye, EyeOff, Mail, KeyRound, UserCheck, Download, Lock, ChevronRight, BookOpen, X, ShieldAlert, Apple
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { setAccessToken, setUserProfile as setStoreUserProfile, setGhostToken } from '../lib/authStore';

const API_BASE = 'https://sguardai.khcho0421.workers.dev';

const S = { A: 'A', B: 'B', C1: 'C1', C2: 'C2', RESET_A: 'RESET_A', RESET_B: 'RESET_B' };

/* ── OTP 6칸 (Aggressive Focus Lock + Memoized) ── */
const OtpBoxes = React.memo(({ value, onChange, disabled }) => {
  const inputRef = useRef(null);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? '');

  // 🔒 강제 포커스 유지 로직
  const forceFocus = () => {
    if (disabled) return;
    if (document.activeElement !== inputRef.current) {
      inputRef.current?.focus();
    }
  };

  // 타이핑 시마다 포커스 상태 강제 확인
  React.useLayoutEffect(() => {
    forceFocus();
  }, [value, disabled]);

  const handleChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    onChange(val);
  };

  const handleBlur = () => {
    if (disabled) return;
    // 브라우저가 포커스를 빼앗으려 할 때 다음 프레임에서 즉시 탈환
    requestAnimationFrame(forceFocus);
  };

  return (
    <div 
      onClick={forceFocus}
      style={{ position: 'relative', width: 270, margin: '0 auto', height: 56, cursor: 'text' }}
    >
      {/* 🔑 실제로 타이핑을 받는 네이티브 입력창 */}
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        maxLength={6}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
        autoFocus
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          opacity: 1,           // 0이면 일부 브라우저에서 포커스 제외됨
          color: 'transparent', // 글자만 투명하게
          background: 'transparent',
          caretColor: 'transparent',
          border: 'none', outline: 'none',
          padding: 0, margin: 0, zIndex: 10,
          fontSize: 18,         // 16px 이상이어야 iOS 줌인 방지
          WebkitTapHighlightColor: 'transparent'
        }}
      />

      {/* 👁️ 시각적 레이어 (배경) */}
      <div style={{
        display: 'flex', gap: 7, justifyContent: 'center', width: '100%', height: '100%',
        pointerEvents: 'none', position: 'absolute', top: 0, left: 0
      }}>
        {[0, 1, 2, 3, 4, 5].map(i => {
          const isFilled = digits[i] !== '';
          const isCurrent = i === value.length && !disabled;
          return (
            <div
              key={i}
              style={{
                width: 40, height: 56,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28, fontWeight: 900,
                color: '#60a5fa',
                background: isFilled ? 'rgba(96,165,250,0.18)' : 'rgba(255,255,255,0.03)',
                border: isCurrent
                  ? '2.5px solid #60a5fa'
                  : isFilled
                  ? '2px solid rgba(96,165,250,0.7)'
                  : '1.5px solid rgba(255,255,255,0.12)',
                borderRadius: 12,
                boxShadow: isCurrent ? '0 0 15px rgba(96,165,250,0.4)' : 'none',
                textShadow: isFilled ? '0 0 12px rgba(96,165,250,0.6)' : 'none',
                transition: 'all 0.1s ease',
                flexShrink: 0
              }}
            >
              {digits[i] || (isCurrent ? (
                <span style={{ 
                  width: 2, height: 26, background: '#60a5fa', borderRadius: 2,
                  animation: 'blink 1s step-end infinite' 
                }} />
              ) : null)}
            </div>
          );
        })}
      </div>
    </div>
  );
});



/* ── 타이머 ── */
function Timer({ timerKey, secs, onExpire }) {
  const [left, setLeft] = useState(secs);
  useEffect(() => {
    setLeft(secs);
    const t = setInterval(() => setLeft(p => { if(p<=1){clearInterval(t);onExpire();return 0;} return p-1; }), 1000);
    return () => clearInterval(t);
  }, [timerKey, secs]);
  const m = String(Math.floor(left/60)).padStart(2,'0');
  const s = String(left%60).padStart(2,'0');
  return <span style={{ fontFamily:'monospace', fontWeight:700, fontSize:14, color: left<60?'#f87171':'#3b82f6' }}>{m}:{s}</span>;
}

/* ── 비밀번호 강도 ── */
function PwStrength({ pw }) {
  if(!pw) return null;
  const scores = [pw.length>=8, /[A-Z]/.test(pw), /[0-9]/.test(pw), /[^A-Za-z0-9]/.test(pw)];
  const n = scores.filter(Boolean).length;
  const cols = ['#ef4444','#f97316','#eab308','#22c55e'];
  const labels = ['약함','보통','좋음','강함'];
  return (
    <div style={{ marginTop:4 }}>
      <div style={{ display:'flex', gap:4, marginBottom:4 }}>
        {scores.map((ok,i) => <div key={i} style={{ flex:1, height:3, borderRadius:9999, background: ok?cols[n-1]:'rgba(255,255,255,0.08)', transition:'all .4s' }} />)}
      </div>
      <p style={{ fontSize:11, color:'rgba(255,255,255,0.35)' }}>강도: <span style={{ fontWeight:600, color: n<2?'#ef4444':n<4?'#eab308':'#22c55e' }}>{labels[n-1]||labels[0]}</span></p>
    </div>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();

  const [state, setState]             = useState(S.A);
  const [employeeId, setEmployeeId]   = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [otp, setOtp]                 = useState('');
  const [otpExpired, setOtpExpired]   = useState(false);
  const [resendCnt, setResendCnt]     = useState(0);
  const [timerKey, setTimerKey]       = useState(0);
  const [pw, setPw]                   = useState('');
  const [pwConf, setPwConf]           = useState('');
  const [showPw, setShowPw]           = useState(false);
  const [showManual, setShowManual]   = useState(false);
  const [isNewUser, setIsNewUser]     = useState(false);
  const [consent1, setConsent1]       = useState(false); // 개인정보 수집/이용 동의
  const [consent2, setConsent2]       = useState(false); // 개인정보 제3자 제공 동의 (AI)
  const [showLegal, setShowLegal]     = useState(null);  // 'p1' or 'ai'
  const [isMobileView, setIsMobileView] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobileView(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('sguard_saved_empid');
    if(saved) setEmployeeId(saved);

    // 🔒 로그인 페이지에서는 바운스 차단 (스크롤은 자동 허용)
    document.body.style.overflowX = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    document.body.style.height = 'auto';

    return () => {
      document.body.style.overflowX = '';
      document.body.style.overscrollBehavior = '';
      document.body.style.height = '';
    };
  }, []);

  const clearErr = () => setError('');

  /* ── API ── */
  const handleInit = async (e) => {
    e?.preventDefault();
    if(!employeeId.trim()){ setError('사번을 입력해 주세요.'); return; }
    setLoading(true); clearErr(); setPw(''); setPwConf(''); setOtp('');
    try {
      const res  = await fetch(`${API_BASE}/auth/init`, { 
        method:'POST', 
        headers:{'Content-Type':'application/json'}, 
        body:JSON.stringify({ 
          employee_id: employeeId.trim(),
          check_only: true // 1단계에서는 확인만 진행
        }) 
      });
      const data = await res.json();
      if(!res.ok){ setError(data.detail||'오류가 발생했습니다.'); return; }
      setMaskedEmail(data.masked_email);
      const isNew = data.mode==='PRE_REGISTERED';
      setIsNewUser(isNew);
      
      localStorage.setItem('sguard_saved_empid', employeeId.trim());
      setState(isNew ? S.B : S.C1);
    } catch { setError('서버에 연결할 수 없습니다.'); }
    finally { setLoading(false); }
  };

  const handleRequestReset = async () => {
    if(!employeeId.trim()){ setError('사번을 입력해 주세요.'); return; }
    setLoading(true); clearErr();
    try {
      const res = await fetch(`${API_BASE}/auth/reset/request`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ employee_id: employeeId.trim() }) });
      const data = await res.json();
      if(!res.ok) {
        setError(data.detail || '요청에 실패했습니다.');
        setLoading(false);
        return;
      }
      setMaskedEmail(data.masked_email);
      setState(S.RESET_B);
    } catch { setError('서버 연결 실패'); }
    finally { setLoading(false); }
  };

  const handleVerifyReset = async () => {
    if(otp.length < 6){ setError('인증번호를 입력하세요.'); return; }
    if(pw.length < 8){ setError('비밀번호는 8자 이상이어야 합니다.'); return; }
    if(pw !== pwConf){ setError('비밀번호가 일치하지 않습니다.'); return; }
    
    setLoading(true); clearErr();
    try {
      const res = await fetch(`${API_BASE}/auth/reset/verify`, { 
        method:'POST', 
        headers:{'Content-Type':'application/json'}, 
        body:JSON.stringify({ 
          employee_id: employeeId.trim(), 
          code: otp,
          password: pw 
        }) 
      });
      const data = await res.json();
      if(!res.ok){ setError(data.detail || '인증 실패'); return; }
      
      alert('비밀번호가 성공적으로 변경되었습니다.');
      // 리셋 성공시 자동 로그인 처리 (백엔드에서 토큰을 준다면 가능, 현재는 다시 로그인으로 보냄)
      if (data.access_token) {
        setAccessToken(data.access_token);
        setStoreUserProfile(data.user);
        setGhostToken(data.ghost_token); // 👻 Ghost Token 저장
        
        console.log('[Login] Success - Tokens stored. Redirecting...');
        navigate('/dashboard');
      } else {
        setState(S.A);
      }
    } catch { setError('서버 연결 실패'); }
    finally { setLoading(false); }
  };

  const handlePasswordNext = async (e) => {
    e?.preventDefault();
    if(!pw){ setError('비밀번호를 입력해 주세요.'); return; }
    
    setLoading(true); clearErr();
    try {
      // 2단계에서 실제 비밀번호를 검증하고 OTP 메일을 발송하도록 변경
      const res = await fetch(`${API_BASE}/auth/init`, { 
        method:'POST', 
        headers:{'Content-Type':'application/json'}, 
        body:JSON.stringify({ 
          employee_id: employeeId.trim(),
          password: pw,
          check_only: false // 실제 OTP 발송 요청
        }) 
      });
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.detail || '인증번호 발송에 실패했습니다.');
        return;
      }
      
      // 메일 발송 성공 시 타이머 시작 및 3단계 진입
      setMaskedEmail(data.masked_email);
      setOtpExpired(false); setOtp(''); setResendCnt(0); setTimerKey(k=>k+1);
      setState(S.C2);
    } catch { 
      setError('서버 연결 실패'); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleResend = async () => {
    if(resendCnt>=3){ setError('재발송 횟수(3회)를 초과했습니다.'); return; }
    setLoading(true); clearErr();
    try {
      const res = await fetch(`${API_BASE}/auth/init`, { 
        method:'POST', 
        headers:{'Content-Type':'application/json'}, 
        body:JSON.stringify({ 
          employee_id: employeeId.trim(),
          password: !state?.startsWith?.('RESET') ? pw : undefined,
          check_only: false
        }) 
      });
      if(res.ok){ setOtpExpired(false); setOtp(''); setResendCnt(p=>p+1); setTimerKey(k=>k+1); }
      else {
        const data = await res.json();
        setError(data.detail || `재발송 실패 (Status: ${res.status})`);
      }
    } catch (err) { 
      console.error('[Resend-Error]', err);
      setError(`서버에 연결할 수 없습니다. (${err.message})`); 
    }
    finally { setLoading(false); }
  };

  const handleVerify = async (e) => {
    e?.preventDefault();
    if(otp.length<6){ setError('6자리 인증번호를 모두 입력해 주세요.'); return; }
    if(state===S.B){ if(pw.length<8){ setError('비밀번호는 8자 이상이어야 합니다.'); return; } if(pw!==pwConf){ setError('비밀번호가 일치하지 않습니다.'); return; } }
    setLoading(true); clearErr();
    try {
      const payload = { 
        employee_id: employeeId.trim(), 
        otp, 
        password:pw, 
        mode: isNewUser ? 'PRE_REGISTERED' : 'ACTIVE',
        consent_personal_info: consent1,
        consent_third_party_ai: consent2
      };
      console.log('[Auth-Debug] Verifying with payload:', { ...payload, password: payload.password?'***':'(empty)' });
      
      const res  = await fetch(`${API_BASE}/auth/verify`, { 
        method:'POST', 
        headers:{'Content-Type':'application/json'}, 
        body:JSON.stringify(payload) 
      });
      
      const data = await res.json();
      if(!res.ok){
        setError(`[${res.status}] ${data.detail || '인증 실패'}`);
        if (data.code === 'SUSPENDED' || data.code === 'ACCOUNT_SUSPENDED') {
          setError('보안 정책에 의해 사용이 중지된 계정입니다. 관리자에게 문의하세요.');
        } else if (data.code === 'REGISTRATION_REQUIRED' || (res.status === 403 && data.code === 'PRE_REGISTERED')) {
          setError('최초 가입 인증이 필요합니다. 사번 인증부터 다시 진행해 주세요.');
          setTimeout(() => setState(S.A), 2000);
        } else if(data.code==='OTP_EXPIRED') {
          setError('인증번호가 만료되었습니다. 재발송해 주세요.');
        } else if(data.code==='OTP_MISMATCH') {
          setError('인증번호가 올바르지 않습니다.');
        } else if(data.code==='WRONG_PASSWORD') {
          setError('비밀번호가 올바르지 않습니다.');
        } else {
          setError(data.detail||'인증에 실패했습니다.');
        }
        return;
      }
      // 🧹 Clean Slate: Prevent legacy token pollution
      // NOTE: ghost_token을 먼저 저장한 후 clear하면 안 되므로 clear는 최소화
      localStorage.removeItem('sguard_jwt');
      localStorage.removeItem('sguard_legacy_token');
      
      // 🔒 JWT Access Token 저장 (access_token 우선 — data.token은 레거시 평문이라 JWT 검증 실패)
      const jwt = data.access_token || data.token;
      if (jwt) {
        setAccessToken(jwt);
        console.log('[Auth-Debug] Access Token (JWT) stored:', jwt.startsWith('eyJ') ? 'Valid JWT ✅' : '⚠️ Not a JWT — may fail validation');
      }
      
      // 👻 Ghost Token (Refresh Token) 저장
      if (data.ghost_token) {
        console.log('[Auth-Debug] Ghost Token Received:', data.ghost_token.substring(0, 8) + '...');
        setGhostToken(data.ghost_token);
      } else {
        console.warn('[Auth-Debug] Ghost Token NOT received from server. Refresh might fail.');
      }
      
      setStoreUserProfile(data.user || data);
      navigate('/dashboard');
    } catch (err) { 
      console.error('[Verify-Error]', err);
      setError(`서버에 연결할 수 없습니다. (${err.message})`); 
    }
    finally { setLoading(false); }
  };

  const inputStyle = {
    width:'100%', padding:'14px 48px 14px 16px',
    background:'rgba(255,255,255,0.05)',
    border:'1.5px solid rgba(255,255,255,0.12)',
    borderRadius:12, color:'white', fontSize:15,
    fontFamily:'inherit', outline:'none', boxSizing:'border-box',
    transition:'border-color .2s, box-shadow .2s',
  };

  const primaryBtn = {
    width:'100%', padding:'15px',
    background: loading ? 'rgba(0,70,255,0.5)' : 'linear-gradient(135deg,#0046FF 0%,#1a5aff 100%)',
    border:'none', borderRadius:14, color:'white',
    fontSize:15, fontWeight:700, fontFamily:'inherit',
    cursor: loading ? 'not-allowed' : 'pointer',
    display:'flex', alignItems:'center', justifyContent:'center', gap:8,
    boxShadow:'0 4px 20px rgba(0,70,255,0.4)',
    transition:'all .2s', letterSpacing:'0.01em',
  };

  const emeraldBtn = {
    ...primaryBtn,
    background: loading ? 'rgba(5,150,105,0.5)' : 'linear-gradient(135deg,#059669 0%,#10b981 100%)',
    boxShadow:'0 4px 20px rgba(5,150,105,0.4)',
  };

  const ErrorBox = ({ msg }) => !msg ? null : (
    <div style={{ display:'flex', gap:8, alignItems:'flex-start', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.25)', borderRadius:12, padding:'12px 14px' }}>
      <AlertCircle size={15} color="#f87171" style={{ flexShrink:0, marginTop:1 }} />
      <p style={{ color:'#f87171', fontSize:13, margin:0, lineHeight:1.5 }}>{msg}</p>
    </div>
  );

  const BackBtn = ({ to, label='이전' }) => (
    <button type="button"
      onClick={() => { 
        setState(to); clearErr(); setPw(''); setPwConf(''); setOtp(''); 
        setConsent1(false); setConsent2(false);
      }}
      style={{ display:'flex', alignItems:'center', gap:4, color:'rgba(255,255,255,0.4)', fontSize:13, background:'none', border:'none', cursor:'pointer', padding:'4px 0', fontFamily:'inherit' }}>
      <ArrowLeft size={14} />{label}
    </button>
  );

  const OtpSection = ({ isNew }) => (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div style={{ textAlign:'center', background:'rgba(59,130,246,0.07)', border:'1px solid rgba(59,130,246,0.15)', borderRadius:12, padding:'12px 16px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, marginBottom:4 }}>
          <Mail size={13} color="#60a5fa" />
          <span style={{ color:'#93c5fd', fontSize:12, fontWeight:600 }}>{maskedEmail}</span>
        </div>
        <p style={{ color:'rgba(255,255,255,0.45)', fontSize:12, margin:0 }}>위 이메일로 발송된 6자리 인증번호를 입력해 주세요.</p>
      </div>
      <OtpBoxes value={otp} onChange={v=>{ setOtp(v); clearErr(); }} disabled={loading||otpExpired} />
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ color:'rgba(255,255,255,0.35)', fontSize:12 }}>유효시간</span>
          {otpExpired
            ? <span style={{ color:'#f87171', fontSize:13, fontWeight:700 }}>만료됨</span>
            : <Timer timerKey={timerKey} secs={600} onExpire={()=>setOtpExpired(true)} />
          }
        </div>
        <button type="button" onClick={state?.startsWith?.('RESET') ? handleRequestReset : handleResend} disabled={loading||resendCnt>=3}
          style={{ display:'flex', alignItems:'center', gap:4, color: resendCnt>=3?'rgba(255,255,255,0.2)':'#60a5fa', fontSize:12, background:'none', border:'none', cursor: resendCnt>=3?'not-allowed':'pointer', fontFamily:'inherit', fontWeight:500 }}>
          <RotateCcw size={12} />재발송{resendCnt>0&&` (${resendCnt}/3)`}
        </button>
      </div>
      <BackBtn 
        to={state?.startsWith?.('RESET') ? S.RESET_A : (isNewUser ? S.B : S.C1)} 
        label={state?.startsWith?.('RESET') || isNewUser ? '비밀번호 재설정' : '비밀번호 재입력'} 
      />
    </div>
  );

  const LegalModal = ({ type, onClose }) => {
    const content = type === 'p1' ? {
      title: '개인정보 수집 및 이용 동의',
      body: `신한금융그룹 S-Guard AI 플랫폼은 원활한 서비스 제공을 위해 아래와 같이 개인정보를 수집 및 이용합니다.\n\n1. 수집 항목: 성명, 사원번호, 소속 부서, 회사 메일 주소, 시스템 접속 로그\n2. 수집 및 이용 목적: 사용자 식별 및 권한 관리, 보안 정책 준수 확인, 맞춤형 AI 서비스 제공\n3. 보유 및 이용 기간: 사용자 퇴직 시 또는 서비스 종료 시까지 (관계 법령에 따라 보관이 필요한 경우 해당 기간까지 보관)\n4. 동의 거부 권리: 본 동의를 거부하실 수 있으나, 거부 시 시스템 이용이 제한됩니다.`
    } : {
      title: '개인정보 제3자 제공 동의 (AI 서비스)',
      body: `AI 가속 분석 및 고도화된 보안 인사이트 제공을 위해 아래와 같이 외부 전문 서비스에 데이터를 제공합니다.\n\n1. 제공받는 자: Dify.ai, OpenAI, Inc.\n2. 제공 목적: 침해사고 데이터의 AI 분석, 보안 리포트 자동 생성 및 요약\n3. 제공 항목: 사용자가 입력한 프롬프트(질의), 업로드한 파일 내용, 분석 대상 사고 정보\n4. 보유 및 이용 기간: 목적 달성 후 즉시 파기 또는 해당 서비스의 데이터 처리 정책에 따름\n5. 주의사항: 입력된 데이터는 비식별화 과정을 거치거나 보안 전용 API를 통해 처리되나, 중요한 민감 정보 입력 시 주의가 필요합니다.`
    };

    return (
      <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:20 }} onClick={onClose}>
        <div style={{ background:'#0f172a', border:'1px solid rgba(255,255,255,0.1)', borderRadius:20, maxWidth:480, width:'100%', padding:28, animation:'fadeUp .3s ease', position:'relative' }} onClick={e=>e.stopPropagation()}>
          <button onClick={onClose} style={{ position:'absolute', top:20, right:20, background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer' }}><X size={20}/></button>
          <h3 style={{ color:'white', fontSize:18, fontWeight:700, marginBottom:16 }}>{content.title}</h3>
          <div style={{ color:'rgba(255,255,255,0.7)', fontSize:13, lineHeight:1.7, whiteSpace:'pre-wrap', maxHeight:400, overflowY:'auto', paddingRight:8 }}>
            {content.body}
          </div>
          <button onClick={onClose} style={{ width:'100%', marginTop:24, padding:14, borderRadius:12, background:'rgba(255,255,255,0.06)', border:'none', color:'white', fontWeight:600, cursor:'pointer' }}>확인</button>
        </div>
      </div>
    );
  };

  const ManualModal = ({ onClose }) => (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', backdropFilter:'blur(12px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:20 }} onClick={onClose}>
      <div style={{ 
        background:'#0f172a', border:'1px solid rgba(59,130,246,0.3)', borderRadius:28, maxWidth:480, width:'100%', 
        padding:32, animation:'fadeUp .3s ease', position:'relative',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 40px rgba(59, 130, 246, 0.1)'
      }} onClick={e=>e.stopPropagation()}>
        <button onClick={onClose} style={{ position:'absolute', top:24, right:24, background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer' }}><X size={20}/></button>
        
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:24 }}>
          <div style={{ background:'rgba(59,130,246,0.2)', padding:10, borderRadius:12 }}>
            <Download size={22} color="#60a5fa" />
          </div>
          <h3 style={{ color:'white', fontSize:22, fontWeight:800, margin:0 }}>Android 설치 매뉴얼</h3>
        </div>

        <div style={{ maxHeight:'60vh', overflowY:'auto', paddingRight:8, display:'flex', flexDirection:'column', gap:28 }}>
          <div>
            <h4 style={{ color:'#60a5fa', fontSize:14, fontWeight:700, marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ background:'#60a5fa', color:'#0f172a', width:18, height:18, borderRadius:4, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11 }}>1</span>
              Play 프로텍트 설정 진입
            </h4>
            <ul style={{ color:'rgba(255,255,255,0.7)', fontSize:13, lineHeight:1.8, paddingLeft:20, margin:0 }}>
              <li>Google Play 스토어 앱을 실행합니다.</li>
              <li>우측 상단의 <span style={{ color:'white', fontWeight:600 }}>프로필 아이콘(내 계정)</span>을 탭합니다.</li>
              <li>메뉴 목록 중 <span style={{ color:'white', fontWeight:600 }}>Play 프로텍트</span>를 선택합니다.</li>
            </ul>
          </div>

          <div>
            <h4 style={{ color:'#60a5fa', fontSize:14, fontWeight:700, marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ background:'#60a5fa', color:'#0f172a', width:18, height:18, borderRadius:4, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11 }}>2</span>
              실시간 검사 비활성화
            </h4>
            <ul style={{ color:'rgba(255,255,255,0.7)', fontSize:13, lineHeight:1.8, paddingLeft:20, margin:0 }}>
              <li>화면 우측 상단의 <span style={{ color:'white', fontWeight:600 }}>톱니바퀴(설정)</span> 아이콘을 클릭합니다.</li>
              <li><span style={{ color:'#f87171', fontWeight:600 }}>Play 프로텍트로 앱 검사</span> 스위치를 끕니다.</li>
              <li>확인 팝업 창에서 <span style={{ color:'white', fontWeight:600 }}>종료</span> 버튼을 누릅니다.</li>
              <li style={{ fontSize:12, color:'rgba(255,255,255,0.45)' }}>* 유해 앱 감지 기능 개선 항목도 함께 비활성화를 권장합니다.</li>
            </ul>
          </div>

          <div>
            <h4 style={{ color:'#10b981', fontSize:14, fontWeight:700, marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ background:'#10b981', color:'#0f172a', width:18, height:18, borderRadius:4, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11 }}>3</span>
              앱 설치 및 복구
            </h4>
            <ul style={{ color:'rgba(255,255,255,0.7)', fontSize:13, lineHeight:1.8, paddingLeft:20, margin:0 }}>
              <li>하단의 <span style={{ color:'white', fontWeight:600 }}>APK 다운로드 시작</span> 버튼을 클릭하여 설치합니다.</li>
              <li>설치 완료 후 반드시 다시 Play 프로텍트 설정으로 돌아가 <span style={{ color:'#10b981', fontWeight:600 }}>앱 검사</span>를 활성화(켜기) 상태로 되돌려 주세요.</li>
            </ul>
          </div>
        </div>

        <div style={{ marginTop:32 }}>
          <button 
            onClick={() => { window.location.href = '/sguard-bridge_v1.0.apk'; onClose(); }}
            style={{ ...primaryBtn, padding:'16px' }}
          >
            <Download size={18} />
            <span>APK 다운로드 시작</span>
          </button>
          <p style={{ textAlign:'center', color:'rgba(255,255,255,0.3)', fontSize:11, marginTop:16 }}>
            보안 정책에 따라 설치 파일은 사내 네트워크에서만 다운로드 가능할 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  );

  const SubmitBtn = ({ label, color='blue', disabled:dis }) => (
    <button type="submit" disabled={loading||dis}
      style={{ ...(color==='emerald'?emeraldBtn:primaryBtn), opacity: dis&&!loading?0.5:1 }}>
      {loading
        ? <><span style={{ width:16, height:16, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%', display:'inline-block', animation:'spin .7s linear infinite' }} /><span>처리 중...</span></>
        : <><span>{label}</span>{!loading&&<ChevronRight size={16}/>}</>
      }
    </button>
  );

  const stepInfo = state===S.A ? 0 : (state===S.B || state===S.C1) ? 1 : 2;
  const stepLabels = ['사번 확인','비밀번호','OTP 인증'];

  // 모바일 뷰이면서 사번 입력 단계가 아닐 때만 축소 모드 적용
  const isShrink = isMobileView && state !== S.A;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Noto+Sans+KR:wght@400;500;700;900&display=swap');
        * { box-sizing: border-box; margin:0; padding:0; }
        body { margin:0; background:#05091a; }
        @keyframes spin { to { transform:rotate(360deg); } }
        @keyframes fadeUp {
          from { opacity:0; transform:translateY(18px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes shimmerLoop {
          0% { background-position: -150% center; }
          100% { background-position: 150% center; }
        }
        @keyframes glowPulse {
          0%, 100% { filter: drop-shadow(0 0 2px rgba(96,165,250,0.3)); opacity: 0.8; }
          50% { filter: drop-shadow(0 0 8px rgba(96,165,250,0.6)); opacity: 1; }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .keyword-loop-container {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0;
          background: linear-gradient(90deg, 
            rgba(0,70,255,0.05) 0%, 
            rgba(0,70,255,0.15) 25%, 
            rgba(0,70,255,0.05) 50%, 
            rgba(0,70,255,0.15) 75%, 
            rgba(0,70,255,0.05) 100%
          );
          background-size: 200% auto;
          padding: 8px 18px;
          border-radius: 20px;
          width: fit-content;
          margin: 0 auto;
          border: 1px solid rgba(147,197,253,0.15);
          animation: shimmerLoop 4s linear infinite;
          box-shadow: 0 4px 15px rgba(0,0,0,0.2);
          backdrop-filter: blur(4px);
        }
        .keyword-item {
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.1em;
          color: #93c5fd;
          text-shadow: 0 0 10px rgba(0,70,255,0.2);
          white-space: nowrap;
        }
        .keyword-arrow {
          color: #60a5fa;
          font-size: 10px;
          margin: 0 6px;
          display: flex;
          align-items: center;
          font-weight: 900;
          white-space: nowrap;
          animation: glowPulse 2s ease-in-out infinite;
        }
        .header-section {
          background: linear-gradient(160deg, #001550 0%, #0030cc 40%, #0046FF 70%, #1a5aff 100%);
          position: relative;
          overflow: hidden;
          flex-shrink: 0;
          text-align: center;
        }
        .header-section::before {
          content:'';
          position:absolute; inset:0;
          background-image:
            radial-gradient(ellipse at 75% 15%, rgba(255,255,255,0.12) 0%, transparent 55%),
            radial-gradient(ellipse at 15% 85%, rgba(0,0,0,0.2) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 110%, rgba(0,0,60,0.3) 0%, transparent 60%);
        }
        .header-section::after {
          content:'';
          position:absolute; bottom:-1px; left:0; right:0;
          height:44px;
          background:#05091a;
          border-radius: 36px 36px 0 0;
        }
        .header-nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 20px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          margin-bottom: 24px;
        }
        .card-section {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          max-width: 480px;
          margin: 0 auto;
          width: 100%;
        }
        .step-bar {
          display:flex;
          align-items:center;
          margin-bottom: 16px;
        }
        .step-item {
          display:flex;
          flex-direction:column;
          align-items:center;
          gap:4px;
          flex:1;
        }
        .step-circle {
          width:28px; height:28px;
          border-radius:50%;
          display:flex;
          align-items:center;
          justify-content:center;
          font-size:11px;
          font-weight:700;
          transition: all .3s;
        }
        .step-connector {
          flex:1;
          height:2px;
          background: rgba(255,255,255,0.08);
          margin-bottom:14px;
          transition: background .3s;
        }
        .step-connector.done { background: rgba(0,70,255,0.5); }
        .form-section-label {
          font-size:11px;
          font-weight:600;
          letter-spacing:0.1em;
          text-transform:uppercase;
          color:rgba(255,255,255,0.3);
          margin-bottom:10px;
        }
        .input-wrap { position:relative; }
        .input-icon { position:absolute; right:14px; top:50%; transform:translateY(-50%); }
        .login-bg {
          min-height: 100vh;
          min-height: 100dvh;
          background: #05091a;
          font-family: 'Inter','Noto Sans KR',sans-serif;
          display: flex;
          flex-direction: column;
          overflow-x: hidden;
        }
      `}</style>

      <div className="login-bg">
        <div className="header-section" style={{ padding: isShrink ? '14px 0 12px' : '32px 0' }}>
          <div style={{ position:'relative', zIndex:1 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap: isShrink ? 4 : 6, marginBottom: isShrink ? 0 : 10 }}>
              <div style={{ width: isShrink ? 28 : 72, height: isShrink ? 34 : 86, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg viewBox="0 0 40 48" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ position:'absolute', width:'100%', height:'100%', filter:'drop-shadow(0 6px 16px rgba(0,0,0,0.4))' }}>
                  <path d="M20 2L4 10V24C4 35 12 44 20 48C28 44 36 35 36 24V10L20 2Z" fill="rgba(255,255,255,0.06)" stroke="url(#glassOutline)" strokeWidth="1.2" strokeLinejoin="round" />
                  <path d="M20 2L4 10V24C4 35 12 44 20 48V2Z" fill="rgba(255,255,255,0.05)" />
                  <defs>
                    <linearGradient id="glassOutline" x1="20" y1="0" x2="20" y2="48" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="rgba(255,255,255,0.95)" />
                      <stop offset="40%" stopColor="rgba(255,255,255,0.1)" />
                      <stop offset="100%" stopColor="rgba(255,255,255,0.6)" />
                    </linearGradient>
                  </defs>
                </svg>
                <span style={{ color:'white', fontSize: isShrink ? 20 : 54, fontWeight:900, fontFamily:"'Inter', sans-serif", position:'relative', zIndex:3, marginTop: isShrink ? -2 : -6, textShadow:'0 4px 8px rgba(0,0,0,0.6)' }}>S</span>
              </div>
              <h1 style={{ color: '#ffffff', fontSize: isShrink ? 20 : 54, fontWeight: 900, letterSpacing: '0.07em', lineHeight: 1, textShadow: '0 2px 4px rgba(0,0,0,0.4)', fontFamily: "'Inter', sans-serif", margin: 0 }}>GUARD</h1>
            </div>

            {/* 🛡️ 다이내믹 피드백 루프 - 축소 모드일 때 자동 숨김 */}
            {!isShrink && (
              <>
                <p style={{ color:'rgba(255,255,255,0.8)', fontSize:12, fontWeight:500, letterSpacing:'0.02em', marginBottom:14, fontStyle:'italic', textShadow:'0 2px 10px rgba(0,70,255,0.3)' }}>
                  "Knowledge Today, Foresight Tomorrow"
                </p>
                <div className="keyword-loop-container">
                  {['DETECTION','DIAGNOSIS','MITIGATION','FORESIGHT'].map((w, i) => (
                    <React.Fragment key={w}>
                      {i > 0 && (
                        <span className="keyword-arrow">→</span>
                      )}
                      <span className="keyword-item">{w}</span>
                    </React.Fragment>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="card-section" style={{ padding: isShrink ? '0 24px 40px' : '16px 24px 40px' }}>
          {state !== S.B && state !== S.RESET_A && state !== S.RESET_B && (
            <div className="step-bar" style={{ animation:'fadeUp .3s ease' }}>
              {stepLabels.map((label,idx) => (
                <React.Fragment key={idx}>
                  {idx>0 && <div className={`step-connector ${stepInfo>=idx?'done':''}`} />}
                  <div className="step-item">
                    <div className="step-circle" style={{
                      background: stepInfo>idx ? 'rgba(0,70,255,0.25)' : stepInfo===idx ? '#0046FF' : 'rgba(255,255,255,0.06)',
                      color: stepInfo>idx ? '#60a5fa' : stepInfo===idx ? 'white' : 'rgba(255,255,255,0.2)',
                      border: stepInfo===idx ? '2px solid #0046FF' : stepInfo>idx ? '1px solid rgba(0,70,255,0.3)' : '1px solid rgba(255,255,255,0.08)',
                      boxShadow: stepInfo===idx ? '0 0 0 4px rgba(0,70,255,0.15)' : 'none',
                    }}>
                      {stepInfo>idx ? '✓' : idx+1}
                    </div>
                    <span style={{ fontSize:10, color: stepInfo>=idx?'rgba(255,255,255,0.5)':'rgba(255,255,255,0.2)', textAlign:'center' }}>{label}</span>
                  </div>
                </React.Fragment>
              ))}
            </div>
          )}

          {state === S.A && (
            <form onSubmit={handleInit} style={{ display:'flex', flexDirection:'column', gap:14, animation:'fadeUp .3s ease' }}>
              <div>
                <p className="form-section-label">사원번호</p>
                <div className="input-wrap">
                  <input
                    type="text" value={employeeId} autoFocus
                    onChange={e => { setEmployeeId(e.target.value); clearErr(); }}
                    placeholder="사원번호를 입력하세요"
                    className="login-field"
                    style={inputStyle}
                  />
                  <div className="input-icon">
                    <UserCheck size={17} color="rgba(255,255,255,0.2)" />
                  </div>
                </div>
              </div>
              <ErrorBox msg={error} />
              <SubmitBtn label="로그인" />
              
              <div style={{ display:'flex', gap:8, marginTop:8 }}>
                <button type="button" onClick={() => setShowManual(true)}
                  style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'9px 12px', borderRadius:10, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.4)', fontSize:11, cursor:'pointer' }}>
                  <Download size={12} />Android APK
                </button>
                <button type="button" onClick={() => window.alert('iOS 단축어 배포 준비 중입니다.')}
                  style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'9px 12px', borderRadius:10, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.4)', fontSize:11, cursor:'pointer' }}>
                  <Apple size={12} />iOS 단축어
                </button>
              </div>

              <div style={{ marginTop:4, padding:'12px 14px', background:'rgba(0,70,255,0.05)', border:'1px solid rgba(0,70,255,0.12)', borderRadius:12 }}>
                <p style={{ display:'flex', alignItems:'center', gap:6, color:'rgba(255,255,255,0.25)', fontSize:10.5, lineHeight:1.5 }}>
                  <Lock size={10} style={{ flexShrink:0 }} />
                  본 시스템은 신한임직원및 협력사 전용입니다. 보안 수칙을 준수해 주세요.
                </p>
              </div>

              <button type="button" onClick={() => setState(S.RESET_A)} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.3)', fontSize:12, textDecoration:'underline', cursor:'pointer', marginTop:8 }}>비밀번호를 분실하셨나요?</button>
            </form>
          )}

          {state === S.B && (
            <form onSubmit={handlePasswordNext} style={{ display:'flex', flexDirection:'column', gap:16, animation:'fadeUp .3s ease' }}>
              <div style={{ textAlign:'center', marginBottom:4 }}>
                <h2 style={{ color:'white', fontSize:18, fontWeight:700, marginBottom:4 }}>비밀번호 설정</h2>
                <p style={{ color:'rgba(255,255,255,0.4)', fontSize:13 }}>신규 사용자를 위한 비밀번호를 설정해 주세요.</p>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <p className="form-section-label">신규 비밀번호 설정</p>
                <div className="input-wrap">
                  <input type={showPw?'text':'password'} value={pw} autoFocus
                    onChange={e=>{ setPw(e.target.value); clearErr(); }}
                    placeholder="비밀번호 (8자 이상)" className="login-field" style={inputStyle} />
                  <button type="button" tabIndex={-1} className="input-icon"
                    onClick={()=>setShowPw(p=>!p)}
                    style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.3)' }}>
                    {showPw?<EyeOff size={17}/>:<Eye size={17}/>}
                  </button>
                </div>
                <PwStrength pw={pw} />
                <div className="input-wrap">
                  <input type={showPw?'text':'password'} value={pwConf}
                    onChange={e=>{ setPwConf(e.target.value); clearErr(); }}
                    placeholder="비밀번호 확인" className="login-field" style={inputStyle} />
                </div>
              </div>
              <div style={{ padding:'14px', background:'rgba(255,255,255,0.03)', borderRadius:12, border:'1px solid rgba(255,255,255,0.06)', display:'flex', flexDirection:'column', gap:10 }}>
                <div style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
                  <div style={{ width:18, height:18, borderRadius:4, border:'1.5px solid #3b82f6', background: consent1?'#3b82f6':'none', display:'flex', alignItems:'center', justifyContent:'center', marginTop:2, transition:'all .2s', cursor:'pointer' }} onClick={() => setConsent1(!consent1)}>
                    {consent1 && <Check size={12} color="white" strokeWidth={4} />}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <p style={{ color:'rgba(255,255,255,0.8)', fontSize:12, fontWeight:500, margin:0 }}>[필수] 개인정보 수집 및 이용 동의</p>
                      <button type="button" onClick={()=>setShowLegal('p1')} style={{ background:'none', border:'none', color:'#60a5fa', fontSize:11, cursor:'pointer', padding:0 }}>전문보기</button>
                    </div>
                    <p style={{ color:'rgba(255,255,255,0.4)', fontSize:11, marginTop:2 }}>성명, 사번, 이메일 주소의 수집 및 이용에 동의합니다.</p>
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
                  <div style={{ width:18, height:18, borderRadius:4, border:'1.5px solid #3b82f6', background: consent2?'#3b82f6':'none', display:'flex', alignItems:'center', justifyContent:'center', marginTop:2, transition:'all .2s', cursor:'pointer' }} onClick={() => setConsent2(!consent2)}>
                    {consent2 && <Check size={12} color="white" strokeWidth={4} />}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <p style={{ color:'rgba(255,255,255,0.8)', fontSize:12, fontWeight:500, margin:0 }}>[필수] 개인정보 제3자 제공 동의 (AI)</p>
                      <button type="button" onClick={()=>setShowLegal('ai')} style={{ background:'none', border:'none', color:'#60a5fa', fontSize:11, cursor:'pointer', padding:0 }}>전문보기</button>
                    </div>
                    <p style={{ color:'rgba(255,255,255,0.4)', fontSize:11, marginTop:2 }}>입력한 데이터가 분석을 위해 외부 AI 서비스(OpenAI/Dify)로 전송됨에 동의합니다.</p>
                  </div>
                </div>
              </div>

              <ErrorBox msg={error} />
              <SubmitBtn label="인증번호 받기" color="emerald" disabled={pw.length<8||pw!==pwConf||!consent1||!consent2} />
              <BackBtn to={S.A} label="사번 재입력" />
            </form>
          )}

          {state === S.C1 && (
            <form onSubmit={handlePasswordNext} style={{ display:'flex', flexDirection:'column', gap:16, animation:'fadeUp .3s ease' }}>
              <div style={{ textAlign:'center', marginBottom:4 }}>
                <h2 style={{ color:'white', fontSize:18, fontWeight:700, marginBottom:4 }}>비밀번호 확인</h2>
                <p style={{ color:'rgba(255,255,255,0.4)', fontSize:13 }}>{maskedEmail}으로 OTP가 발송됩니다.</p>
              </div>
              <div>
                <p className="form-section-label">비밀번호</p>
                <div className="input-wrap">
                  <input type={showPw?'text':'password'} value={pw} autoFocus
                    onChange={e=>{ setPw(e.target.value); clearErr(); }}
                    placeholder="비밀번호를 입력하세요" className="login-field" style={inputStyle} />
                  <button type="button" tabIndex={-1} className="input-icon"
                    onClick={()=>setShowPw(p=>!p)}
                    style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.3)' }}>
                    {showPw?<EyeOff size={17}/>:<Eye size={17}/>}
                  </button>
                </div>
              </div>
              <ErrorBox msg={error} />
              <SubmitBtn label="인증번호 받기" />
              <BackBtn to={S.A} label="사번 재입력" />
            </form>
          )}

          {state === S.C2 && (
            <form onSubmit={handleVerify} style={{ display:'flex', flexDirection:'column', gap:14, animation:'fadeUp .3s ease' }}>
              <div style={{ textAlign:'center', marginBottom:4 }}>
                <h2 style={{ color:'white', fontSize:18, fontWeight:700, marginBottom:4 }}>OTP 최종 인증</h2>
              </div>
              <OtpSection isNew={false} />
              <div style={{ display:'flex', justifyContent:'flex-end', padding:'0 4px', marginTop:-4 }}>
                <button type="button" onClick={() => { setState(S.RESET_A); clearErr(); setOtp(''); setPw(''); setPwConf(''); }}
                  style={{ background:'none', border:'none', color:'#f87171', fontSize:12, fontWeight:600, cursor:'pointer', textDecoration:'underline', textUnderlineOffset:4 }}>
                  비밀번호 초기화
                </button>
              </div>
              <ErrorBox msg={error} />
              <SubmitBtn label="로그인" disabled={otp.length<6||otpExpired} />
            </form>
          )}

          {state === S.RESET_A && (
            <div style={{ animation:'fadeUp .3s ease' }}>
              <h2 style={{ color:'white', fontSize:18, fontWeight:700, marginBottom:12 }}>비밀번호 초기화</h2>
              <p style={{ color:'rgba(255,255,255,0.4)', fontSize:13, marginBottom:16 }}>가입 시 등록된 메일로 임시 비밀번호를 발송합니다.</p>
              <input type="text" placeholder="사번을 입력해 주세요" value={employeeId} onChange={e=>setEmployeeId(e.target.value)} className="login-field" style={{...inputStyle, marginBottom:12}} />
              <ErrorBox msg={error} />
              <div style={{ display:'flex', gap:8, marginTop:4 }}>
                <button onClick={()=>setState(S.A)} style={{ flex:1, padding:14, borderRadius:12, background:'rgba(255,255,255,0.05)', border:'none', color:'white', cursor:'pointer' }}>취소</button>
                <button onClick={handleRequestReset} disabled={loading} style={{ flex:2, padding:14, borderRadius:12, background:'linear-gradient(135deg, #059669 0%, #10b981 100%)', border:'none', color:'white', cursor:'pointer', fontWeight:600 }}>인증코드 발송</button>
              </div>
            </div>
          )}

          {state === S.RESET_B && (
            <div style={{ animation:'fadeUp .3s ease', display:'flex', flexDirection:'column', gap:16 }}>
              <div style={{ textAlign:'center' }}>
                <h2 style={{ color:'white', fontSize:20, fontWeight:700, marginBottom:8 }}>본인 확인 및 비밀번호 재설정</h2>
              </div>
              <OtpSection />
              
              <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', paddingTop:16, display:'flex', flexDirection:'column', gap:10 }}>
                <p className="form-section-label">새 비밀번호 설정</p>
                <div className="input-wrap">
                  <input type={showPw?'text':'password'} value={pw}
                    onChange={e=>{ setPw(e.target.value); clearErr(); }}
                    placeholder="신규 비밀번호 (8자 이상)" className="login-field" style={inputStyle} />
                  <button type="button" tabIndex={-1} className="input-icon"
                    onClick={()=>setShowPw(p=>!p)}
                    style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.3)' }}>
                    {showPw?<EyeOff size={17}/>:<Eye size={17}/>}
                  </button>
                </div>
                <PwStrength pw={pw} />
                <div className="input-wrap">
                  <input type={showPw?'text':'password'} value={pwConf}
                    onChange={e=>{ setPwConf(e.target.value); clearErr(); }}
                    placeholder="비밀번호 확인" className="login-field" style={inputStyle} />
                </div>
              </div>

              <ErrorBox msg={error} />
              <button onClick={handleVerifyReset} disabled={loading||otpExpired||otp.length<6||pw.length<8||pw!==pwConf} 
                style={{ 
                  width:'100%', padding:14, borderRadius:12, 
                  background:(loading||otpExpired||otp.length<6||pw.length<8||pw!==pwConf)? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)', 
                  border:'none', color:'white', cursor:'pointer', fontWeight:600, marginTop:8,
                  transition:'all 0.3s ease'
                }}>
                {loading ? '처리 중...' : '비밀번호 변경 및 완료'}
              </button>
            </div>
          )}

          <div style={{ marginTop:'auto', paddingTop:32, textAlign:'center' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:7, marginBottom:6 }}>
              <div style={{ width:18, height:18, borderRadius:'50%', overflow:'hidden', flexShrink:0 }}>
                <img src="/shinhan_logo.png" alt="신한DS" style={{ width:18, height:18, objectFit:'cover', display:'block', opacity:0.35 }} />
              </div>
              <span style={{ color:'rgba(255,255,255,0.22)', fontSize:11, fontWeight:600, letterSpacing:'0.05em' }}>신한DS</span>
            </div>
            <p style={{ color:'rgba(255,255,255,0.13)', fontSize:10, letterSpacing:'0.04em' }}>© 2026 Shinhan DS Corp. · S-GUARD AI Security Operations</p>
          </div>
        </div>
      </div>
      {showLegal && <LegalModal type={showLegal} onClose={() => setShowLegal(null)} />}
      {showManual && <ManualModal onClose={() => setShowManual(false)} />}
    </>
  );
}
