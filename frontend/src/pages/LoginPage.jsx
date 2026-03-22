import React, { useState, useEffect } from 'react';
import { Shield, Eye, EyeOff, AtSign, LogIn, UserPlus, AlertCircle, Save, KeyRound, Copy, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// ────────────────────────────────────────────────
// Validation helpers
// ────────────────────────────────────────────────
const isValidEmailOrId = (v) => {
    const s = v.trim();
    if (!s) return false;
    // 이메일 형식 또는 사번 형식 (일반적으로 숫자/문자 조합)
    // 여기서는 단순히 값이 있는지만 체크하거나, 사번의 특정 규칙이 있다면 추가 가능
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) || /^[0-9a-zA-Z-]{4,}$/.test(s);
};

function validate(email, password) {
    const errors = {};
    if (!email.trim()) {
        errors.email = '이메일 또는 사번을 입력해 주세요.';
    } else if (!isValidEmailOrId(email)) {
        errors.email = '올바른 형식(이메일 또는 사번)이 아닙니다.';
    }
    if (!password) {
        errors.password = '비밀번호를 입력해 주세요.';
    } else if (password.length < 4) {
        errors.password = '비밀번호는 4자 이상이어야 합니다.';
    }
    return errors;
}

export default function LoginPage() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [saveId, setSaveId] = useState(false);
    const [showPw, setShowPw] = useState(false);
    const [loading, setLoading] = useState(false);
    const [fieldErrors, setFieldErrors] = useState({});
    const [serverError, setServerError] = useState('');
    const [userNotFound, setUserNotFound] = useState(false);

    // ── 비밀번호 찾기 상태 ──
    const [showReset, setShowReset] = useState(false);
    const [resetStep, setResetStep] = useState('INIT'); // INIT, VERIFY, RESULT
    const [resetEmail, setResetEmail] = useState('');
    const [resetEmployeeId, setResetEmployeeId] = useState('');
    const [resetCode, setResetCode] = useState('');
    const [resetLoading, setResetLoading] = useState(false);
    const [resetResult, setResetResult] = useState(null); // { temp_password, name, email }
    const [resetError, setResetError] = useState('');
    const [copied, setCopied] = useState(false);

    const handleResetRequest = async () => {
        if (!resetEmail.trim()) { setResetError('이메일을 입력해 주세요.'); return; }
        if (!resetEmployeeId.trim()) { setResetError('사번을 입력해 주세요.'); return; }
        setResetLoading(true);
        setResetError('');
        try {
            const res = await fetch(`${API_BASE}/auth/request-reset-code`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    email: resetEmail.trim(), 
                    employee_id: resetEmployeeId.trim() 
                }),
            });
            const data = await res.json();
            if (!res.ok) { setResetError(data.detail || '실패했습니다.'); return; }
            alert(data.message); // DEMO 용: 코드를 화면에 보여줌
            setResetStep('VERIFY');
        } catch {
            setResetError('서버에 연결할 수 없습니다.');
        } finally {
            setResetLoading(false);
        }
    };

    const handleVerifyCode = async () => {
        if (!resetCode.trim()) { setResetError('인증 코드를 입력해 주세요.'); return; }
        setResetLoading(true);
        setResetError('');
        try {
            const res = await fetch(`${API_BASE}/auth/verify-reset-code`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    email: resetEmail.trim(), 
                    employee_id: resetEmployeeId.trim(),
                    code: resetCode.trim()
                }),
            });
            const data = await res.json();
            if (!res.ok) { setResetError(data.detail || '인증에 실패했습니다.'); return; }
            setResetResult(data);
            setResetStep('RESULT');
        } catch {
            setResetError('서버에 연결할 수 없습니다.');
        } finally {
            setResetLoading(false);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(resetResult.temp_password);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const closeReset = () => {
        setShowReset(false);
        setResetStep('INIT');
        setResetEmail('');
        setResetEmployeeId('');
        setResetCode('');
        setResetResult(null);
        setResetError('');
    };

    // 저장된 아이디 복원
    useEffect(() => {
        const saved = localStorage.getItem('sguard_saved_email');
        if (saved) {
            setEmail(saved);
            setSaveId(true);
        }
    }, []);

    const API_BASE = 'https://sguardai.khcho0421.workers.dev';

    // ── real-time validation on blur ──
    const handleEmailBlur = () => {
        if (email && !isValidEmailOrId(email)) {
            setFieldErrors(prev => ({ ...prev, email: '올바른 형식(이메일 또는 사번)이 아닙니다.' }));
        } else {
            setFieldErrors(prev => { const e = { ...prev }; delete e.email; return e; });
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setServerError('');
        setUserNotFound(false);

        // ── client-side validation ──
        const errors = validate(email, password);
        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            return;
        }
        setFieldErrors({});
        setLoading(true);

        try {
            const res = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim(), password }),
            });
            const data = await res.json();

            if (res.status === 401) {
                // Wrong password – server message
                setServerError(data.detail || '이메일(사번) 또는 비밀번호가 올바르지 않습니다.');
                return;
            }
            if (res.status === 404 || (data.detail && data.detail.includes('등록'))) {
                // User does not exist → guide to signup
                setUserNotFound(true);
                return;
            }
            if (!res.ok) {
                setServerError(data.detail || '로그인 중 오류가 발생했습니다.');
                return;
            }

            // 아이디 저장 처리
            if (saveId) {
                localStorage.setItem('sguard_saved_email', email.trim());
            } else {
                localStorage.removeItem('sguard_saved_email');
            }

            localStorage.setItem('sguard_token', data.token);
            localStorage.setItem('sguard_user', JSON.stringify(data));
            navigate('/dashboard');
        } catch {
            setServerError('서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.');
        } finally {
            setLoading(false);
        }
    };

    const inputBase = (hasError) =>
        `w-full bg-[#1a1f2e] border rounded-xl py-4 pl-5 pr-12 text-sm placeholder-slate-500 focus:outline-none transition-all text-white shadow-inner ${hasError
            ? 'border-red-500/70 focus:border-red-500 focus:ring-1 focus:ring-red-500'
            : 'border-blue-500/30 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
        }`;

    return (
        <div className="min-h-screen font-sans flex flex-col bg-[#0f111a] text-white relative overflow-hidden">

            {/* Background Pattern */}
            <div className="absolute inset-0 z-0 opacity-20"
                style={{ backgroundImage: 'radial-gradient(circle, #3b82f6 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
            <div className="absolute inset-0 z-0 bg-gradient-to-b from-blue-900/10 via-transparent to-blue-900/20 pointer-events-none" />
            <div className="absolute -top-[20%] -left-[20%] w-[70%] h-[70%] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />

            {/* Top Bar */}
            <div className="relative z-10 p-6 flex items-center">
                <button onClick={() => navigate('/')} className="flex items-center hover:opacity-80 transition-opacity">
                    <div className="bg-blue-600 p-1.5 rounded-lg mr-3 shadow-[0_0_15px_rgba(37,99,235,0.5)]">
                        <Shield className="w-4 h-4 text-white fill-current" />
                    </div>
                    <span className="font-bold text-lg tracking-wide">S-Guard AI</span>
                </button>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center px-6 relative z-10 w-full max-w-md mx-auto">

                {/* Icon */}
                <div className="mb-8 relative">
                    <div className="w-24 h-24 bg-blue-900/20 rounded-3xl flex items-center justify-center border border-blue-500/20 shadow-[0_0_30px_rgba(37,99,235,0.1)]">
                        <Shield className="w-10 h-10 text-blue-500 fill-blue-500/20" />
                    </div>
                    <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full -z-10" />
                </div>

                {/* Headline */}
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-bold mb-3 text-white tracking-tight">Secure Login</h1>
                    <p className="text-slate-400 text-sm">AI Agent 기반 지능형 장애 예방 및 통합 관리 시스템</p>
                </div>

                {/* ── User Not Found Banner ── */}
                {userNotFound && (
                    <div className="w-full mb-6 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col gap-3">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
                            <div>
                                <p className="text-amber-300 font-semibold text-sm">등록된 사용자가 없습니다</p>
                                <p className="text-amber-400/80 text-xs mt-0.5">
                                    <span className="font-medium">{email}</span> 로 등록된 계정을 찾을 수 없습니다.<br />
                                    회원가입을 진행해 주세요.
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => navigate('/signup')}
                            className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-bold py-3 rounded-xl transition-all text-sm active:scale-[0.98]"
                        >
                            <UserPlus className="w-4 h-4" />
                            회원가입 하러 가기
                        </button>
                        <button
                            onClick={() => setUserNotFound(false)}
                            className="text-xs text-slate-500 hover:text-slate-300 transition-colors text-center"
                        >
                            다른 계정으로 로그인
                        </button>
                    </div>
                )}

                {/* ── Form ── */}
                {!userNotFound && (
                    <form onSubmit={handleLogin} className="w-full space-y-5" noValidate>

                        {/* Email or ID */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-slate-300 ml-1">이메일 또는 사번</label>
                            <div className="relative group">
                                <input
                                    type="text"
                                    value={email}
                                    onChange={(e) => { setEmail(e.target.value); setFieldErrors(prev => { const x = { ...prev }; delete x.email; return x; }); }}
                                    onBlur={handleEmailBlur}
                                    placeholder="이메일 주소 또는 사번 입력"
                                    autoComplete="username"
                                    className={inputBase(!!fieldErrors.email)}
                                />
                                <LogIn className={`absolute right-4 top-4 w-5 h-5 transition-colors ${fieldErrors.email ? 'text-red-400' : 'text-slate-500 group-focus-within:text-blue-400'}`} />
                            </div>
                            {fieldErrors.email && (
                                <p className="text-red-400 text-xs ml-1 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />{fieldErrors.email}
                                </p>
                            )}
                        </div>

                        {/* Password */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-slate-300 ml-1">비밀번호 (Password)</label>
                            <div className="relative group">
                                <input
                                    type={showPw ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => { setPassword(e.target.value); setFieldErrors(prev => { const x = { ...prev }; delete x.password; return x; }); }}
                                    placeholder="비밀번호를 입력하세요"
                                    autoComplete="current-password"
                                    className={inputBase(!!fieldErrors.password)}
                                />
                                <button
                                    type="button"
                                    tabIndex={-1}
                                    onClick={() => setShowPw(!showPw)}
                                    className={`absolute right-4 top-4 transition-colors ${fieldErrors.password ? 'text-red-400 hover:text-red-300' : 'text-slate-500 hover:text-white'}`}
                                >
                                    {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                            {fieldErrors.password && (
                                <p className="text-red-400 text-xs ml-1 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />{fieldErrors.password}
                                </p>
                            )}
                        </div>

                        {/* 아이디 저장 + 비밀번호 찾기 */}
                        <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2 cursor-pointer select-none group">
                                <div
                                    onClick={() => setSaveId(!saveId)}
                                    className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${saveId
                                        ? 'bg-blue-600 border-blue-600'
                                        : 'border-slate-500 group-hover:border-blue-400'
                                        }`}
                                >
                                    {saveId && (
                                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8">
                                            <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    )}
                                </div>
                                <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors">아이디 저장</span>
                            </label>
                            <button
                                type="button"
                                onClick={() => setShowReset(true)}
                                className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                            >
                                <KeyRound className="w-3 h-3" />
                                비밀번호를 잊으셨나요?
                            </button>
                        </div>

                        {serverError && (
                            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                                <p className="text-red-400 text-sm">{serverError}</p>
                            </div>
                        )}

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold py-4 rounded-xl flex items-center justify-center space-x-2 shadow-[0_4px_20px_rgba(37,99,235,0.4)] hover:shadow-[0_6px_25px_rgba(37,99,235,0.5)] transition-all transform active:scale-[0.98] mt-2"
                        >
                            {loading
                                ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />인증 중...</span>
                                : <><span>로그인</span><LogIn className="w-5 h-5 ml-1" /></>
                            }
                        </button>
                    </form>
                )}

                {/* Sign up link */}
                {!userNotFound && (
                    <div className="mt-8 text-center text-sm text-slate-400">
                        계정이 없으신가요?{' '}
                        <span onClick={() => navigate('/signup')} className="text-blue-400 font-semibold cursor-pointer hover:text-blue-300 transition-colors">
                            회원가입
                        </span>
                    </div>
                )}

            </div>

            <div className="relative z-10 py-8 w-full flex items-center justify-center opacity-40">
                <div className="h-[1px] w-12 bg-slate-500" />
                <span className="mx-4 text-[10px] tracking-[0.2em] font-medium text-slate-400 uppercase">End-to-End Encryption</span>
                <div className="h-[1px] w-12 bg-slate-500" />
            </div>

            {/* ── 비밀번호 찾기 모달 ── */}
            {showReset && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={!resetResult ? closeReset : undefined} />
                    <div className="relative z-10 w-full max-w-md bg-gradient-to-b from-[#1a1f2e] to-[#0f111a] border border-white/10 rounded-3xl shadow-2xl p-6 animate-scale-up">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-cyan-400 rounded-t-3xl" />

                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-2">
                                <div className="bg-blue-600/20 p-2 rounded-xl border border-blue-500/20">
                                    <KeyRound className="w-5 h-5 text-blue-400" />
                                </div>
                                <h2 className="text-white font-bold text-lg">비밀번호 초기화</h2>
                            </div>
                            <button onClick={closeReset} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-slate-400 hover:text-white">
                                ×
                            </button>
                        </div>

                        {resetStep === 'INIT' && (
                            <>
                                <p className="text-slate-400 text-sm mb-4">본인 확인을 위해 등록하신 이메일과 사번을 인증해 주세요.</p>
                                <div className="space-y-3 mb-4">
                                    <input
                                        type="email"
                                        value={resetEmail}
                                        onChange={e => { setResetEmail(e.target.value); setResetError(''); }}
                                        placeholder="이메일 주소 입력"
                                        className="w-full bg-[#0f111a] border border-blue-500/20 rounded-xl py-3.5 px-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                    />
                                    <input
                                        type="text"
                                        value={resetEmployeeId}
                                        onChange={e => { setResetEmployeeId(e.target.value); setResetError(''); }}
                                        onKeyDown={e => e.key === 'Enter' && handleResetRequest()}
                                        placeholder="사번(Employee ID) 입력"
                                        className="w-full bg-[#0f111a] border border-blue-500/20 rounded-xl py-3.5 px-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>
                                {resetError && (
                                    <p className="text-red-400 text-xs mb-3 flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" />{resetError}
                                    </p>
                                )}
                                <button
                                    onClick={handleResetRequest}
                                    disabled={resetLoading}
                                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2"
                                >
                                    {resetLoading
                                        ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        : <><KeyRound className="w-4 h-4" />인증 코드 발송 요청</>}
                                </button>
                            </>
                        )}

                        {resetStep === 'VERIFY' && (
                            <>
                                <p className="text-slate-400 text-sm mb-4">입력하신 이메일로 발송된 6자리 인증 코드를 입력해 주세요.</p>
                                <input
                                    type="text"
                                    maxLength={6}
                                    value={resetCode}
                                    onChange={e => { setResetCode(e.target.value); setResetError(''); }}
                                    onKeyDown={e => e.key === 'Enter' && handleVerifyCode()}
                                    placeholder="인증 코드 6자리"
                                    className="w-full bg-[#0f111a] border border-blue-500/20 rounded-xl py-4 px-4 text-center text-lg tracking-[0.5em] font-bold text-blue-400 placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 mb-4"
                                />
                                {resetError && (
                                    <p className="text-red-400 text-xs mb-3 flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" />{resetError}
                                    </p>
                                )}
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setResetStep('INIT')}
                                        className="flex-1 bg-white/5 hover:bg-white/10 text-slate-300 font-bold py-3.5 rounded-xl transition-all"
                                    >
                                        이전으로
                                    </button>
                                    <button
                                        onClick={handleVerifyCode}
                                        disabled={resetLoading}
                                        className="flex-[2] bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2"
                                    >
                                        {resetLoading
                                            ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            : <span>인증 확인</span>}
                                    </button>
                                </div>
                            </>
                        )}

                        {resetStep === 'RESULT' && (
                            <>
                                <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4 mb-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <CheckCircle className="w-4 h-4 text-green-400" />
                                        <span className="text-green-400 font-semibold text-sm">임시 비밀번호 발급 완료</span>
                                    </div>
                                    <p className="text-slate-300 text-sm mb-1">
                                        <span className="font-semibold text-white">{resetResult.name}</span>님의 임시 비밀번호:
                                    </p>
                                    <div className="flex items-center gap-2 mt-2">
                                        <code className="flex-1 bg-[#0f111a] border border-slate-700 rounded-lg px-3 py-2 text-blue-300 font-mono text-sm tracking-wider">
                                            {resetResult.temp_password}
                                        </code>
                                        <button
                                            onClick={handleCopy}
                                            className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                                            title="복사"
                                        >
                                            {copied ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-slate-300" />}
                                        </button>
                                    </div>
                                </div>
                                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 mb-4">
                                    <p className="text-amber-400 text-xs">⚠️ 위 임시 비밀번호로 로그인 후 대시보드에서 새 비밀번호로 다시 설정해 주세요.</p>
                                </div>
                                <button
                                    onClick={closeReset}
                                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl transition-all"
                                >
                                    로그인 화면으로
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
