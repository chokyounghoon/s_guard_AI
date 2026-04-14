import React, { useState, useEffect, useRef } from 'react';
import {
  Shield, AlertCircle, ArrowRight, RotateCcw,
  CheckCircle, Eye, EyeOff, Mail, KeyRound, UserCheck, Download
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API_BASE = 'https://sguardai.khcho0421.workers.dev';

// ─────────────────────────────────────────────
// 상태 정의
// A  : 사번 입력 (auth/init 호출)
// B  : 신규(PRE_REGISTERED) — OTP + 비밀번호 설정 (auth/verify)
// C1 : 기존(ACTIVE) — 비밀번호 입력
// C2 : 기존(ACTIVE) — OTP 입력 후 최종 인증 (auth/verify)
// ─────────────────────────────────────────────
const S = { A: 'A', B: 'B', C1: 'C1', C2: 'C2' };

// ── OTP 6칸 입력 ──
function OtpBoxes({ value, onChange, disabled }) {
  const refs = useRef([]);
  const pad  = (value + '      ').slice(0, 6).split('');

  const set = (i, ch) => {
    const arr = pad.map(d => d.trim());
    arr[i] = ch.replace(/\D/g, '').slice(-1);
    onChange(arr.join('').replace(/ /g, ''));
  };

  return (
    <div className="flex gap-2 justify-center"
      onPaste={e => {
        const p = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        onChange(p);
        refs.current[Math.min(p.length, 5)]?.focus();
        e.preventDefault();
      }}>
      {[0,1,2,3,4,5].map(i => (
        <input key={i} ref={el => refs.current[i] = el}
          type="text" inputMode="numeric" maxLength={1}
          value={pad[i].trim()} disabled={disabled}
          onChange={e => {
            const digit = e.target.value.replace(/\D/g, '').slice(-1);
            set(i, digit);
            if (digit && i < 5) refs.current[i + 1]?.focus();
          }}
          onKeyDown={e => {
            if (e.key === 'Backspace' && !pad[i].trim() && i > 0) refs.current[i - 1]?.focus();
          }}
          className="w-11 h-13 text-center text-xl font-bold bg-[#1a1f2e] border-2 border-blue-500/30 rounded-xl text-blue-300 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition-all disabled:opacity-50 caret-transparent"
          style={{ height: '52px' }}
        />
      ))}
    </div>
  );
}

// ── 카운트다운 타이머 ──
function Timer({ timerKey, secs, onExpire }) {
  const [left, setLeft] = useState(secs);
  useEffect(() => {
    setLeft(secs);
    const t = setInterval(() => setLeft(p => {
      if (p <= 1) { clearInterval(t); onExpire(); return 0; }
      return p - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [timerKey, secs]);
  const m = String(Math.floor(left / 60)).padStart(2,'0');
  const s = String(left % 60).padStart(2,'0');
  return <span className={`font-mono font-bold text-sm ${left < 60 ? 'text-red-400' : 'text-sky-400'}`}>{m}:{s}</span>;
}

// ── 비밀번호 강도 바 ──
function PwStrength({ pw }) {
  if (!pw) return null;
  const scores = [pw.length >= 8, /[A-Z]/.test(pw), /[0-9]/.test(pw), /[^A-Za-z0-9]/.test(pw)];
  const n = scores.filter(Boolean).length;
  const colors = ['bg-red-500','bg-orange-400','bg-yellow-400','bg-emerald-400'];
  const labels = ['약함','보통','좋음','강함'];
  return (
    <div className="space-y-1">
      <div className="flex gap-1">
        {scores.map((ok, i) => (
          <div key={i} className={`flex-1 h-1 rounded-full transition-all duration-500 ${ok ? colors[n-1] : 'bg-slate-700'}`} />
        ))}
      </div>
      <p className="text-xs text-slate-500">강도: <span className={`font-semibold ${n < 2 ? 'text-red-400' : n < 4 ? 'text-yellow-400' : 'text-emerald-400'}`}>{labels[n-1]||labels[0]}</span></p>
    </div>
  );
}

// ─────────────────────────────────────────────
// 메인 로그인 컴포넌트
// ─────────────────────────────────────────────
export default function LoginPage() {
  const navigate = useNavigate();

  // 공통 상태
  const [state, setState]           = useState(S.A);
  const [employeeId, setEmployeeId] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  // OTP
  const [otp, setOtp]               = useState('');
  const [otpExpired, setOtpExpired] = useState(false);
  const [resendCnt, setResendCnt]   = useState(0);
  const [timerKey, setTimerKey]     = useState(0);

  // 비밀번호
  const [pw, setPw]         = useState('');
  const [pwConf, setPwConf] = useState('');
  const [showPw, setShowPw] = useState(false);

  // 사번 자동 복원
  useEffect(() => {
    const saved = localStorage.getItem('sguard_saved_empid');
    if (saved) setEmployeeId(saved);
  }, []);

  const clearErr = () => setError('');

  const inputCls = `w-full bg-[#1a1f2e] border border-blue-500/30 rounded-xl py-4 pl-5 pr-12
    text-sm placeholder-slate-500 focus:outline-none focus:border-blue-400
    focus:ring-1 focus:ring-blue-400/40 transition-all text-white`;

  // ─── STEP A: 사번 입력 → POST /auth/init ───
  const handleInit = async (e) => {
    e?.preventDefault();
    if (!employeeId.trim()) { setError('사번을 입력해 주세요.'); return; }
    setLoading(true); clearErr();
    try {
      const res  = await fetch(`${API_BASE}/auth/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: employeeId.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || '오류가 발생했습니다.'); return; }

      setMaskedEmail(data.masked_email);
      setOtpExpired(false); setOtp(''); setResendCnt(0); setTimerKey(k => k + 1);
      localStorage.setItem('sguard_saved_empid', employeeId.trim());

      // 신규(PRE_REGISTERED) → B, 기존(ACTIVE) → C1
      setState(data.mode === 'PRE_REGISTERED' ? S.B : S.C1);
    } catch {
      setError('서버에 연결할 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  // ─── STEP C1: 비밀번호 입력 후 OTP 화면으로 ───
  const handlePasswordNext = (e) => {
    e?.preventDefault();
    if (!pw) { setError('비밀번호를 입력해 주세요.'); return; }
    clearErr();
    setState(S.C2);
  };

  // ─── OTP 재발송 ───
  const handleResend = async () => {
    if (resendCnt >= 3) { setError('재발송 횟수(3회)를 초과했습니다.'); return; }
    setLoading(true); clearErr();
    try {
      const res = await fetch(`${API_BASE}/auth/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: employeeId.trim() }),
      });
      if (res.ok) {
        setOtpExpired(false); setOtp('');
        setResendCnt(p => p + 1); setTimerKey(k => k + 1);
      } else {
        setError('재발송에 실패했습니다.');
      }
    } catch {
      setError('서버에 연결할 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  // ─── STEP B / C2 → POST /auth/verify ───
  // Body: { employee_id, otp, password, mode }
  // 성공 시 서버가 8시간 JWT HttpOnly 쿠키 설정 + 사용자 정보 JSON 반환
  const handleVerify = async (e) => {
    e?.preventDefault();
    if (otp.length < 6) { setError('6자리 인증번호를 모두 입력해 주세요.'); return; }

    // 신규: 비밀번호 유효성
    if (state === S.B) {
      if (pw.length < 8) { setError('비밀번호는 8자 이상이어야 합니다.'); return; }
      if (pw !== pwConf) { setError('비밀번호가 일치하지 않습니다.'); return; }
    }

    setLoading(true); clearErr();
    try {
      const res  = await fetch(`${API_BASE}/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: employeeId.trim(),
          otp,
          password: pw,
          mode: state === S.B ? 'PRE_REGISTERED' : 'ACTIVE',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'OTP_EXPIRED')     setError('인증번호가 만료되었습니다. 재발송해 주세요.');
        else if (data.code === 'OTP_MISMATCH')   setError('인증번호가 올바르지 않습니다.');
        else if (data.code === 'WRONG_PASSWORD') setError('비밀번호가 올바르지 않습니다. 다시 확인해 주세요.');
        else setError(data.detail || '인증에 실패했습니다.');
        return;
      }
      // 로컬 스토리지 저장 (하위 호환 토큰 + 전체 사용자 정보)
      localStorage.setItem('sguard_token', data.token);
      localStorage.setItem('sguard_user',  JSON.stringify(data));
      navigate('/dashboard');
    } catch {
      setError('서버에 연결할 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────
  // 공통 UI 컴포넌트
  // ─────────────────────────────────────────────
  const ErrorBox = ({ msg }) => msg ? (
    <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
      <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
      <p className="text-red-400 text-sm">{msg}</p>
    </div>
  ) : null;

  const BackBtn = ({ to, label = '이전' }) => (
    <button type="button"
      onClick={() => { setState(to); clearErr(); setPw(''); setOtp(''); }}
      className="text-sm text-slate-400 hover:text-slate-300 flex items-center gap-1 transition-colors mt-1">
      <ArrowRight className="w-4 h-4 rotate-180" />{label}
    </button>
  );

  // OTP 섹션 (B, C2 공통)
  const OtpSection = ({ isNew }) => (
    <div className="space-y-5">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 bg-sky-500/10 border border-sky-500/20 rounded-full px-3 py-1.5 mb-3">
          <Mail className="w-3.5 h-3.5 text-sky-400" />
          <span className="text-sky-300 text-xs font-medium">{maskedEmail} 으로 발송됨</span>
        </div>
        <p className="text-slate-400 text-sm">이메일로 받은 6자리 인증번호를 입력해 주세요.</p>
      </div>
      <OtpBoxes value={otp} onChange={v => { setOtp(v); clearErr(); }} disabled={loading || otpExpired} />
      <div className="flex items-center justify-between px-1">
        <span className="text-slate-500 text-sm">남은 시간</span>
        {otpExpired
          ? <span className="text-red-400 text-sm font-semibold">만료됨</span>
          : <Timer timerKey={timerKey} secs={300} onExpire={() => setOtpExpired(true)} />
        }
      </div>
      <div className="flex justify-between items-center">
        <BackBtn to={isNew ? S.A : S.C1} label={isNew ? '사번 재입력' : '비밀번호 재입력'} />
        <button type="button" onClick={handleResend} disabled={loading || resendCnt >= 3}
          className="text-sm text-sky-400 hover:text-sky-300 flex items-center gap-1 transition-colors disabled:opacity-40">
          <RotateCcw className="w-3.5 h-3.5" />재발송 {resendCnt > 0 && `(${resendCnt}/3)`}
        </button>
      </div>
    </div>
  );

  const SubmitBtn = ({ label, color = 'blue', disabled: dis }) => (
    <button type="submit" disabled={loading || dis}
      className={`w-full font-bold py-4 rounded-xl flex items-center justify-center gap-2
        transition-all active:scale-[0.98] disabled:opacity-50
        ${color === 'emerald'
          ? 'bg-emerald-600 hover:bg-emerald-500 shadow-[0_4px_20px_rgba(5,150,105,0.4)]'
          : 'bg-blue-600 hover:bg-blue-500 shadow-[0_4px_20px_rgba(37,99,235,0.4)]'
        } text-white`}>
      {loading
        ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>처리 중...</span></>
        : <span>{label}</span>
      }
    </button>
  );

  // ─────────────────────────────────────────────
  // 렌더
  // ─────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-[#0f111a] text-white relative overflow-hidden font-sans">

      {/* 배경 그리드 + 광선 */}
      <div className="absolute inset-0 opacity-20 pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(circle, #3b82f6 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      <div className="absolute -top-1/4 -left-1/4 w-3/4 h-3/4 bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute -bottom-1/6 -right-1/6 w-1/2 h-1/2 bg-cyan-600/5 blur-[100px] rounded-full pointer-events-none" />

      {/* 로고 */}
      <div className="relative z-10 p-6">
        <div className="flex items-center">
          <div className="bg-blue-600 p-1.5 rounded-lg mr-3 shadow-[0_0_15px_rgba(37,99,235,0.5)]">
            <Shield className="w-4 h-4 text-white fill-current" />
          </div>
          <span className="font-bold text-lg tracking-wide">S-Guard AI</span>
        </div>
      </div>

      {/* 카드 영역 */}
      <div className="flex-1 flex items-center justify-center px-5 relative z-10 pb-10">
        <div className="w-full max-w-sm">

          {/* 아이콘 + 타이틀 */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative mb-4">
              <div className="w-20 h-20 bg-blue-900/20 rounded-3xl flex items-center justify-center border border-blue-500/20 shadow-[0_0_40px_rgba(37,99,235,0.12)] transition-all duration-500">
                {state === S.A  && <Shield className="w-9 h-9 text-blue-400 fill-blue-400/20" />}
                {state === S.B  && <UserCheck className="w-9 h-9 text-emerald-400" />}
                {state === S.C1 && <KeyRound className="w-9 h-9 text-blue-400" />}
                {state === S.C2 && <Mail className="w-9 h-9 text-sky-400" />}
              </div>
              <div className="absolute inset-0 bg-blue-500/10 blur-2xl rounded-full -z-10" />
            </div>

            <h1 className="text-2xl font-bold text-white text-center transition-all duration-300">
              {state === S.A  && 'S-Guard AI 로그인'}
              {state === S.B  && '최초 접속 인증'}
              {state === S.C1 && '비밀번호 입력'}
              {state === S.C2 && 'OTP 최종 인증'}
            </h1>
            <p className="text-slate-400 text-sm text-center mt-1.5">
              {state === S.A  && 'AI Agent 기반 지능형 장애 통합 관리'}
              {state === S.B  && `${maskedEmail} 으로 인증번호가 발송되었습니다.`}
              {state === S.C1 && (
                <><span className="font-medium text-white">{maskedEmail}</span> 으로 OTP 발송 완료 — 비밀번호를 입력해 주세요.</>
              )}
              {state === S.C2 && '비밀번호 확인 완료 — OTP로 최종 인증합니다.'}
            </p>
          </div>

          {/* ── 상태 A: 사번 입력 ── */}
          {state === S.A && (
            <form onSubmit={handleInit} className="space-y-4">
              <div className="relative">
                <input
                  id="employee-id-input"
                  type="text" value={employeeId} autoFocus autoComplete="username"
                  onChange={e => { setEmployeeId(e.target.value); clearErr(); }}
                  placeholder="사번 입력 (예: S01838)"
                  className={inputCls}
                />
                <Shield className="absolute right-4 top-4 w-5 h-5 text-slate-500" />
              </div>
              <ErrorBox msg={error} />
              <SubmitBtn label="인증번호 받기" disabled={!employeeId.trim()} />
              <div className="pt-2 flex justify-center">
                <a href="/sguard-bridge_v1.0.apk" download
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600/10 border border-blue-500/20 text-xs text-blue-400 hover:bg-blue-600/20 transition-all">
                  <Download className="w-3.5 h-3.5" />S-Guard Android APK
                </a>
              </div>
            </form>
          )}

          {/* ── 상태 B: 신규(PRE_REGISTERED) — OTP + 비밀번호 설정 ── */}
          {state === S.B && (
            <form onSubmit={handleVerify} className="space-y-5">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
                <p className="text-emerald-400 text-xs font-medium">🎉 최초 로그인입니다. OTP 인증 후 비밀번호를 설정해 주세요.</p>
              </div>

              <OtpSection isNew={true} />

              <div className="border-t border-white/5 pt-4 space-y-3">
                <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">신규 비밀번호 설정</p>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} value={pw}
                    onChange={e => { setPw(e.target.value); clearErr(); }}
                    placeholder="비밀번호 (8자 이상)" className={inputCls} />
                  <button type="button" tabIndex={-1}
                    onClick={() => setShowPw(p => !p)}
                    className="absolute right-4 top-4 text-slate-500 hover:text-white transition-colors">
                    {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <PwStrength pw={pw} />
                <input type={showPw ? 'text' : 'password'} value={pwConf}
                  onChange={e => { setPwConf(e.target.value); clearErr(); }}
                  placeholder="비밀번호 확인" className={inputCls} />
                {pwConf && pw !== pwConf && <p className="text-red-400 text-xs">비밀번호가 일치하지 않습니다.</p>}
              </div>

              <ErrorBox msg={error} />
              <SubmitBtn label="인증 완료 및 로그인" color="emerald"
                disabled={otp.length < 6 || pw.length < 8 || pw !== pwConf || otpExpired} />
            </form>
          )}

          {/* ── 상태 C1: 기존(ACTIVE) — 비밀번호 먼저 입력 ── */}
          {state === S.C1 && (
            <form onSubmit={handlePasswordNext} className="space-y-4">
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} value={pw} autoFocus
                  onChange={e => { setPw(e.target.value); clearErr(); }}
                  placeholder="비밀번호를 입력하세요"
                  autoComplete="current-password" className={inputCls} />
                <button type="button" tabIndex={-1}
                  onClick={() => setShowPw(p => !p)}
                  className="absolute right-4 top-4 text-slate-500 hover:text-white transition-colors">
                  {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <ErrorBox msg={error} />
              <SubmitBtn label="다음 — OTP 확인" disabled={!pw} />
              <BackBtn to={S.A} label="사번 재입력" />
            </form>
          )}

          {/* ── 상태 C2: 기존(ACTIVE) — OTP 최종 인증 ── */}
          {state === S.C2 && (
            <form onSubmit={handleVerify} className="space-y-5">
              <div className="bg-slate-800/60 border border-white/10 rounded-xl px-4 py-3 flex items-center gap-3">
                <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                <p className="text-slate-300 text-sm">비밀번호 확인 완료. OTP로 최종 인증해 주세요.</p>
              </div>

              <OtpSection isNew={false} />

              <ErrorBox msg={error} />
              <SubmitBtn label="로그인" disabled={otp.length < 6 || otpExpired} />
            </form>
          )}

        </div>
      </div>

      {/* 하단 암호화 뱃지 */}
      <div className="relative z-10 py-6 flex items-center justify-center opacity-25">
        <div className="h-px w-8 bg-slate-500" />
        <span className="mx-3 text-[9px] tracking-[0.2em] text-slate-400 uppercase">End-to-End Encryption</span>
        <div className="h-px w-8 bg-slate-500" />
      </div>
    </div>
  );
}
