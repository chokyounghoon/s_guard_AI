import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Eye, EyeOff, Loader2, ChevronRight, KeyRound, SmartphoneNfc, Download } from 'lucide-react';
import {
  setAccessToken,
  setUserProfile as setStoreUserProfile,
  setGhostToken
} from '../../lib/authStore';
import PWAInstallButton from '../components/PWAInstallButton';

const API_BASE = 'https://sguardai.khcho0421.workers.dev';

// 스텝: 'id' → 'otp' → 'password'
export default function MobileLoginPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState('id');
  const [empId, setEmpId] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1: 사번 입력 → OTP 발송
  const handleInitAuth = async () => {
    if (!empId.trim()) return setError('사번을 입력해 주세요.');
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API_BASE}/auth/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: empId.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || '인증 초기화 실패');
      setMaskedEmail(data.masked_email || '');
      setIsNewUser(data.is_new_user || false);
      setStep('otp');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: OTP 인증
  const handleVerifyOtp = async () => {
    if (!otp.trim()) return setError('인증 코드를 입력해 주세요.');
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API_BASE}/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: empId.trim(), otp: otp.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'OTP 인증 실패');
      setStep('password');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 3: 비밀번호 입력 → 로그인
  const handleLogin = async () => {
    if (!password.trim()) return setError('비밀번호를 입력해 주세요.');
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: empId.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || '로그인 실패');
      setAccessToken(data.access_token);
      setStoreUserProfile(data.user);
      if (data.ghost_token) setGhostToken(data.ghost_token);
      navigate('/dashboard', { replace: true });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e, action) => {
    if (e.key === 'Enter') action();
  };

  return (
    <div className="min-h-screen bg-[#060a12] flex flex-col items-center px-6 py-20 relative overflow-hidden">
      {/* 배경 글로우 */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-blue-600/10 blur-[180px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[300px] h-[300px] bg-indigo-600/5 blur-[120px] rounded-full pointer-events-none" />

      {/* 로고 영역 (상단 제목: S-GUARD) */}
      <div className="flex flex-col items-center mb-24 z-10 animate-fade-in-up">
        <div className="relative mb-8">
          <div className="w-24 h-28 relative flex items-center justify-center">
            <svg viewBox="0 0 40 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="absolute w-full h-full filter drop-shadow-[0_15px_30px_rgba(0,0,0,0.6)]">
              <path d="M20 2L4 10V24C4 35 12 44 20 48C28 44 36 35 36 24V10L20 2Z" fill="rgba(255,255,255,0.06)" stroke="url(#glassOutline)" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M20 2L4 10V24C4 35 12 44 20 48V2Z" fill="rgba(255,255,255,0.05)" />
              <defs>
                <linearGradient id="glassOutline" x1="20" y1="0" x2="20" y2="48" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.95)" />
                  <stop offset="40%" stopColor="rgba(255,255,255,0.1)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0.6)" />
                </linearGradient>
              </defs>
            </svg>
            <span className="text-5xl font-black text-white relative z-10 -mt-2 tracking-tighter drop-shadow-2xl">S</span>
          </div>
        </div>
        <h1 className="text-5xl font-black text-white tracking-[0.05em] leading-none mb-6">S-GUARD</h1>
        <div className="keyword-loop-container scale-90 opacity-80">
          <p className="text-[10px] text-blue-400 font-black uppercase tracking-[0.3em] italic text-center">"Knowledge Today, Foresight Tomorrow"</p>
        </div>
      </div>

      {/* 메인 카드 영역 (아래로 대폭 내림) */}
      <div className="w-full max-w-sm glass-card rounded-[3rem] p-8 shadow-[0_30px_60px_rgba(0,0,0,0.5)] z-10 animate-fade-in-up" style={{ animationDelay: '100ms' }}>

        {/* 스텝 인디케이터 */}
        <div className="flex items-center justify-between mb-10 px-2">
          {['사번 확인', '비밀번호', 'OTP 인증'].map((label, i) => {
            const steps = ['id', 'otp', 'password'];
            const currentIdx = steps.indexOf(step);
            const isDone = currentIdx > i;
            const isCurrent = currentIdx === i;
            
            return (
              <div key={label} className="flex flex-col items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-black transition-all duration-500 border ${
                  isCurrent ? 'bg-blue-600 border-blue-400 text-white shadow-[0_0_20px_rgba(59,130,246,0.6)] scale-110' : 
                  isDone ? 'bg-blue-900/30 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/10 text-slate-600'
                }`}>
                  {isDone ? '✓' : i + 1}
                </div>
                <span className={`text-[10px] font-bold tracking-tight ${isCurrent ? 'text-blue-400' : 'text-slate-600'}`}>{label}</span>
              </div>
            );
          })}
        </div>

        {/* Step 1: 사번 입력 */}
        {step === 'id' && (
          <div className="space-y-6">
            <div className="relative group">
              <SmartphoneNfc className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
              <input
                id="login-emp-id"
                type="text"
                value={empId}
                onChange={(e) => setEmpId(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, handleInitAuth)}
                placeholder="사번을 입력하세요"
                className="w-full bg-black/40 border border-white/10 rounded-2xl py-4.5 pl-12 pr-4 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 transition-all font-mono"
                autoFocus
              />
            </div>
          </div>
        )}

        {/* Step 2: OTP 인증 */}
        {step === 'otp' && (
          <div className="space-y-6">
            <div className="bg-blue-600/10 border border-blue-500/20 rounded-2xl p-4 text-center">
              <p className="text-[11px] text-slate-500 mb-1 font-bold">인증 코드가 전송되었습니다</p>
              <p className="text-xs text-blue-400 font-black font-mono tracking-wider">{maskedEmail}</p>
            </div>
            <div className="relative group">
              <KeyRound className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
              <input
                id="login-otp"
                type="text"
                inputMode="numeric"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(e) => handleKeyDown(e, handleVerifyOtp)}
                placeholder="6자리 코드 입력"
                className="w-full bg-black/40 border border-white/10 rounded-2xl py-4.5 pl-12 pr-4 text-white text-lg tracking-[0.4em] placeholder:text-slate-600 placeholder:tracking-normal placeholder:text-sm focus:outline-none focus:border-blue-500/50 transition-all font-mono text-center"
                autoFocus
                maxLength={6}
              />
            </div>
          </div>
        )}

        {/* Step 3: 비밀번호 */}
        {step === 'password' && (
          <div className="space-y-6">
            <div className="relative group">
              <input
                id="login-password"
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, handleLogin)}
                placeholder="비밀번호"
                className="w-full bg-black/40 border border-white/10 rounded-2xl py-4.5 pl-5 pr-12 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 transition-all"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
              >
                {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
        )}

        {/* 에러 메시지 */}
        {error && (
          <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-2xl p-4 animate-shake">
            <p className="text-[11px] text-red-400 text-center font-black leading-relaxed">{error}</p>
          </div>
        )}

        {/* CTA 버튼 */}
        <button
          id="login-cta-btn"
          onClick={step === 'id' ? handleInitAuth : step === 'otp' ? handleVerifyOtp : handleLogin}
          disabled={loading}
          className="w-full mt-10 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black py-4.5 rounded-[1.25rem] flex items-center justify-center gap-2 transition-all active-scale shadow-[0_20px_40px_rgba(59,130,246,0.5)]"
        >
          {loading ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <>
              <span className="text-sm font-black tracking-tight">{step === 'id' ? '사번 확인' : step === 'otp' ? '인증 완료' : '로그인'}</span>
              <ChevronRight className="w-5 h-5" />
            </>
          )}
        </button>

        {/* 🛡️ s-bridge 설치 표시 (로그인 버튼 아래) */}
        <div className="mt-8 flex flex-col items-center">
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-white/5 border border-white/5 shadow-inner">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.8)]" />
            <span className="text-[10px] font-black text-slate-400 tracking-tighter uppercase">Security s-bridge Integrated</span>
          </div>
        </div>
      </div>

      {/* 하단 설치 및 다운로드 영역 */}
      <div className="w-full max-w-sm z-10 mt-12 space-y-5 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
        <div className="flex flex-col items-center mb-2">
          <h3 className="text-sm font-black text-slate-400 tracking-tight">s-bridge 설치</h3>
          <div className="w-8 h-1 bg-blue-600/30 rounded-full mt-1" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => { window.location.href = '/s-bridge.apk?v=' + Date.now(); }}
            className="flex flex-col items-center gap-3 p-5 rounded-[2.5rem] bg-white/5 border border-white/5 active-scale group shadow-xl"
          >
            <div className="p-3 rounded-2xl bg-blue-600/10 border border-blue-500/20 group-hover:scale-110 transition-transform shadow-lg">
              <Download className="w-6 h-6 text-blue-400" />
            </div>
            <span className="text-[12px] font-black text-slate-300">Android s-bridge</span>
          </button>
          
          <button
            onClick={() => { window.open('https://www.icloud.com/shortcuts/placeholder', '_blank'); }}
            className="flex flex-col items-center gap-3 p-5 rounded-[2rem] bg-white/5 border border-white/5 active-scale group shadow-xl"
          >
            <div className="p-3 rounded-2xl bg-purple-600/10 border border-purple-500/20 group-hover:scale-110 transition-transform shadow-lg">
              <SmartphoneNfc className="w-6 h-6 text-purple-400" />
            </div>
            <span className="text-[12px] font-black text-slate-300">iOS s-bridge</span>
          </button>
        </div>
        
        <div className="text-center pt-4">
          <p className="text-[11px] text-slate-600 font-black tracking-widest opacity-60">© 2026 SHINHAN DS CORP. S-GUARD OPERATIONS</p>
        </div>
      </div>

    </div>
  );
}
