import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, RefreshCw, Save, Sparkles, Hash, Tag,
  Smartphone, Copy, Check, Zap, Clock, Search, Send, CheckCircle2
} from 'lucide-react';
import { getAuthHeaders, getUserProfile } from '../../lib/authStore';
import { useBackNavigation } from '../../hooks/useBackNavigation';
import { toast } from 'react-hot-toast';

const API_BASE = 'https://sguardai.khcho0421.workers.dev';

export default function MobileUserKeywordPage() {
  const navigate = useNavigate();
  const goBack = useBackNavigation('/dashboard');
  const [keywords, setKeywords] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [copied, setCopied] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [saveComplete, setSaveComplete] = useState(false);
  const progressTimer = useRef(null);
  const [testId, setTestId] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  const DEFAULT_KEYWORDS = "IN USED FILE|DELAY|임계치|ERROR|테스트|Z FILE EXITS|Z FILE|임계|ABEND|장애|오류|에러";

  const fetchUserKeywords = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/sms/user-keywords`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        // DB에 저장된 내용이 없거나 빈 문자열이면 디폴트 표시
        const kw = data.keywords ? data.keywords.trim() : '';
        setKeywords(kw || DEFAULT_KEYWORDS);
      } else {
        // API 오류(401, 500 등) → 디폴트 표시
        setKeywords(DEFAULT_KEYWORDS);
      }
      setLastSaved(new Date());
    } catch (e) { 
      console.error(e);
      // 네트워크 오류 → 디폴트 표시
      setKeywords(DEFAULT_KEYWORDS);
    }
    finally { setLoading(false); }
  };

  useEffect(() => { 
    fetchUserKeywords(); 
    const profile = getUserProfile();
    if (profile?.employee_id) {
      setTestId(profile.employee_id);
    }
  }, []);

  const runProgressBar = () => {
    setSaveProgress(0);
    setSaveComplete(false);
    let p = 0;
    clearInterval(progressTimer.current);
    progressTimer.current = setInterval(() => {
      p += Math.random() * 15 + 5;
      if (p >= 90) { p = 90; clearInterval(progressTimer.current); }
      setSaveProgress(p);
    }, 100);
  };

  const finishProgressBar = (success) => {
    clearInterval(progressTimer.current);
    setSaveProgress(100);
    if (success) {
      setTimeout(() => {
        setSaveComplete(true);
        setTimeout(() => {
          setSaveComplete(false);
          setSaveProgress(0);
        }, 2000);
      }, 300);
    } else {
      setTimeout(() => setSaveProgress(0), 500);
    }
  };

  const saveKeywords = async () => {
    setSaving(true);
    runProgressBar();
    try {
      const res = await fetch(`${API_BASE}/sms/user-keywords`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: keywords.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setLastSaved(new Date());
        finishProgressBar(true);
        toast.success(`설정이 클라우드에 저장되었습니다.`);
      } else {
        finishProgressBar(false);
        toast.error('저장에 실패했습니다.');
      }
    } catch (e) { 
      console.error(e);
      finishProgressBar(false);
      toast.error('저장에 실패했습니다.');
    }
    finally { setSaving(false); }
  };

  const handleCopyApiUrl = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(`${label} 복사 완료`);
    setTimeout(() => setCopied(false), 2000);
  };

  const keywordList = keywords ? keywords.split('|').map(k => k.trim()).filter(Boolean) : [];

  const handleTestKeywords = async () => {
    if (!testId) return;
    console.log(`[Mobile-Keyword-Test] Starting verification for employee_id: ${testId}`);
    setTesting(true);
    try {
      const url = `${API_BASE}/sms/keywords?employee_id=${testId}`;
      console.log(`[Mobile-Keyword-Test] Fetching URL: ${url}`);
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setTestResult(data);
        toast.success('검증 완료');
      } else {
        toast.error('검증 실패');
      }
    } catch (e) {
      console.error(e);
      toast.error('오류 발생');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }} className="min-h-screen bg-[#07090f] text-white pb-28">
      <header className="sticky top-0 z-50 bg-[#07090f]/95 backdrop-blur-xl border-b border-white/5 px-4 py-4">
        <div className="flex items-center gap-3">
          <button onClick={() => goBack()} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-slate-400 active:scale-90 flex-shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-white">개인 감지 키워드</h1>
            <p className="text-xs text-slate-500">Personal Watchlist · SMS Filter</p>
          </div>
          <button onClick={saveKeywords} disabled={saving || loading}
            className="px-4 py-2 rounded-xl bg-cyan-600 text-white text-sm font-bold flex items-center gap-1.5 disabled:opacity-50 active:scale-95 flex-shrink-0">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            저장
          </button>
        </div>
        <div className="mt-3 h-0.5 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-cyan-500 transition-all duration-300" style={{ width: `${saveProgress}%`, opacity: saveProgress > 0 ? 1 : 0 }} />
        </div>
      </header>

      <main className="px-4 py-5 space-y-5">
        {/* Guide Banner */}
        <div className="bg-cyan-600/10 border border-cyan-500/20 rounded-2xl p-4 flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-white">지능형 수신 필터링</p>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              등록된 키워드가 포함된 SMS만 알림을 생성합니다.<br />
              구분자는 <span className="text-cyan-400 font-bold">파이프(|)</span>를 사용하세요.
            </p>
          </div>
        </div>

        {/* Input */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-bold text-slate-400">키워드 편집</span>
            {lastSaved && (
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <Clock className="w-3 h-3" />{lastSaved.toLocaleTimeString()}
              </div>
            )}
          </div>
          <textarea
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="예: ABEND|장애|오류|CRITICAL"
            className="w-full h-36 bg-white/3 border border-white/10 rounded-2xl p-4 text-sm font-mono text-cyan-50 focus:outline-none focus:border-cyan-500/40 transition-all placeholder:text-slate-700 resize-none"
          />
        </div>

        {/* Tags Preview */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-bold text-slate-400">미리보기</span>
            <span className="text-xs text-cyan-400 font-bold bg-cyan-400/10 px-2 py-0.5 rounded-lg">{keywordList.length}개</span>
          </div>
          <div className="flex flex-wrap gap-2 p-4 bg-white/[0.02] border border-white/5 rounded-2xl min-h-[80px]">
            {keywordList.length === 0 ? (
              <div className="m-auto text-center opacity-30">
                <Tag className="w-6 h-6 mx-auto text-slate-600 mb-1" />
                <p className="text-xs text-slate-500">입력된 키워드가 없습니다</p>
              </div>
            ) : (
              keywordList.map((k, i) => (
                <span key={i} className="px-3 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-bold flex items-center gap-1.5">
                  <Hash className="w-3 h-3 opacity-50" />{k}
                </span>
              ))
            )}
          </div>
        </div>

        {/* Integration */}
        <div className="space-y-3">
          <span className="text-sm font-bold text-slate-400">연동 설정</span>
          <div className="bg-blue-600/10 border border-blue-500/20 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 flex-shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white">모바일 동기화</p>
              <p className="text-xs text-slate-500 truncate">{API_BASE}/sms/user-keywords</p>
            </div>
            <button onClick={() => handleCopyApiUrl(`${API_BASE}/sms/user-keywords`, '동기화 URL')} className="p-2.5 rounded-xl bg-white/5 text-slate-400 active:bg-blue-600 active:text-white flex-shrink-0">
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          <div className="bg-purple-600/10 border border-purple-500/20 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400 flex-shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white">iPhone 단축어</p>
              <p className="text-xs text-slate-500">Auth: sguard-shortcut-secure-key-2026</p>
            </div>
            <button
              onClick={() => {
                const profile = getUserProfile();
                handleCopyApiUrl(`${API_BASE}/sms/keywords?employee_id=${profile?.employee_id || 'YOUR_ID'}`, '단축어 URL');
              }}
              className="p-2.5 rounded-xl bg-white/5 text-slate-400 active:bg-purple-600 active:text-white flex-shrink-0"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Keyword Validation Section */}
        <div className="pt-6 border-t border-white/5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">키워드 검증 테스트</p>
              <p className="text-xs text-slate-500">사번별 API 응답을 직접 확인하세요</p>
            </div>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={testId}
                onChange={(e) => setTestId(e.target.value)}
                placeholder="사번 입력..."
                className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-9 pr-3 text-xs font-mono text-white focus:outline-none focus:border-emerald-500/40"
              />
            </div>
            <button
              onClick={handleTestKeywords}
              disabled={testing || !testId}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 active:scale-95 disabled:opacity-30"
            >
              {testing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              검증
            </button>
          </div>

          {testResult && (
            <div className="bg-black/40 rounded-2xl border border-emerald-500/20 overflow-hidden animate-in">
              <div className="px-4 py-2 bg-emerald-500/10 border-b border-emerald-500/20 flex justify-between items-center">
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">API Response</span>
              </div>
              <div className="p-4 overflow-x-auto">
                <pre className="text-[11px] font-mono text-emerald-200/70 whitespace-pre-wrap">
                  {JSON.stringify(testResult, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </main>

      {loading && createPortal(
        <div className="fixed inset-0 z-[1000] bg-[#05070a]/80 backdrop-blur-md flex items-center justify-center pointer-events-auto" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh' }}>
          <div className="flex flex-col items-center justify-center gap-4 m-auto">
            <div className="relative w-12 h-12 shadow-[0_0_15px_rgba(6,182,212,0.5)] rounded-full">
              <div className="absolute inset-0 border-4 border-cyan-500/20 rounded-full" />
              <div className="absolute inset-0 border-4 border-t-cyan-500 rounded-full animate-spin" />
            </div>
            <p className="text-cyan-400 text-[11px] font-black uppercase tracking-[0.3em] animate-pulse">Encrypting</p>
          </div>
        </div>,
        document.body
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .animate-in { animation: zoomIn 0.2s ease-out forwards; }
        @keyframes zoomIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      `}} />
    </div>
  );
}
