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
    <div className="min-h-screen bg-[#060a12] flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden">
      {/* 배경 글로우 */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[300px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[200px] h-[200px] bg-indigo-600/8 blur-[100px] rounded-full pointer-events-none" />

      {/* 로고 */}
      <div className="flex flex-col items-center mb-10 z-10">
        <div className="w-16 h-16 bg-blue-600/20 rounded-2xl border border-blue-500/30 flex items-center justify-center mb-4 shadow-xl shadow-blue-900/30">
          <Shield className="w-9 h-9 text-blue-400" />
        </div>
        <h1 className="text-2xl font-black text-white tracking-tight">S-GUARD AI</h1>
        <p className="text-xs text-slate-500 mt-1 font-mono tracking-widest uppercase">Security Intelligence Platform</p>
      </div>

      {/* 카드 */}
      <div className="w-full max-w-sm bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-7 shadow-2xl shadow-black/50 z-10">

        {/* 스텝 인디케이터 */}
        <div className="flex items-center gap-2 mb-7">
          {['id', 'otp', 'password'].map((s, i) => (
            <React.Fragment key={s}>
              <div className={`w-2 h-2 rounded-full transition-all duration-300 ${
                s === step ? 'bg-blue-500 w-4' : 
                ['id', 'otp', 'password'].indexOf(step) > i ? 'bg-blue-700' : 'bg-white/10'
              }`} />
              {i < 2 && <div className="flex-1 h-px bg-white/10" />}
            </React.Fragment>
          ))}
        </div>

        {/* Step 1: 사번 입력 */}
        {step === 'id' && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-bold text-white mb-1">사번 입력</h2>
              <p className="text-xs text-slate-400">등록된 사번으로 인증을 시작합니다.</p>
            </div>
            <div className="relative">
              <SmartphoneNfc className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                id="login-emp-id"
                type="text"
                value={empId}
                onChange={(e) => setEmpId(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, handleInitAuth)}
                placeholder="사번 (예: 1234567)"
                className="w-full bg-black/40 border border-white/10 rounded-xl py-4 pl-11 pr-4 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all font-mono"
                autoFocus
              />
            </div>
          </div>
        )}

        {/* Step 2: OTP 인증 */}
        {step === 'otp' && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-bold text-white mb-1">이메일 인증</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                <span className="text-blue-400 font-semibold">{maskedEmail}</span>로<br />
                발송된 6자리 코드를 입력하세요.
              </p>
            </div>
            <div className="relative">
              <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                id="login-otp"
                type="text"
                inputMode="numeric"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(e) => handleKeyDown(e, handleVerifyOtp)}
                placeholder="인증 코드 6자리"
                className="w-full bg-black/40 border border-white/10 rounded-xl py-4 pl-11 pr-4 text-white text-lg tracking-[0.3em] placeholder:text-slate-600 placeholder:tracking-normal placeholder:text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all font-mono text-center"
                autoFocus
                maxLength={6}
              />
            </div>
            <button onClick={() => setStep('id')} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
              ← 사번 다시 입력
            </button>
          </div>
        )}

        {/* Step 3: 비밀번호 */}
        {step === 'password' && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-bold text-white mb-1">
                {isNewUser ? '비밀번호 설정' : '비밀번호 입력'}
              </h2>
              <p className="text-xs text-slate-400">
                {isNewUser ? '처음 사용하시는 경우 비밀번호를 설정합니다.' : '계정 비밀번호를 입력해 주세요.'}
              </p>
            </div>
            <div className="relative">
              <input
                id="login-password"
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, handleLogin)}
                placeholder="비밀번호"
                className="w-full bg-black/40 border border-white/10 rounded-xl py-4 pl-5 pr-12 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        {/* 에러 메시지 */}
        {error && (
          <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
            <p className="text-xs text-red-400 leading-relaxed">{error}</p>
          </div>
        )}

        {/* CTA 버튼 */}
        <button
          id="login-cta-btn"
          onClick={step === 'id' ? handleInitAuth : step === 'otp' ? handleVerifyOtp : handleLogin}
          disabled={loading}
          className="w-full mt-6 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-xl shadow-blue-900/40"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <span>{step === 'id' ? '인증 코드 받기' : step === 'otp' ? '코드 확인' : '로그인'}</span>
              <ChevronRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>

      {/* 📱 PWA 홈 화면 설치 버튼 */}
      <div className="w-full max-w-sm z-10 mt-4 space-y-3">
        <PWAInstallButton />
        <button
          onClick={() => { window.location.href = '/sguard-bridge.apk?v=' + Date.now(); }}
          className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl border border-white/5 bg-white/5 hover:bg-white/10 active:scale-[0.98] transition-all group"
        >
          <Download className="w-4 h-4 text-slate-400 group-hover:scale-110 transition-transform" />
          <span className="text-sm font-semibold text-slate-300">Android APK 다운로드</span>
        </button>
      </div>

    </div>
  );
}
