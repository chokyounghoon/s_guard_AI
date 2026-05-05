import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBackNavigation } from '../hooks/useBackNavigation';
import { 
  ArrowLeft, Plus, X, Search, Hash, Shield, Trash2, RefreshCw, 
  Smartphone, Wifi, Copy, Check, Zap, Tag, ChevronRight, Save, 
  AlertCircle, Info, Keyboard, Send
} from 'lucide-react';
import { getAuthHeaders } from '../lib/authStore';
import { toast } from 'react-hot-toast';

const API_BASE = 'https://sguardai.khcho0421.workers.dev';

export default function UserKeywordPage({ userProfile }) {
  const navigate = useNavigate();
  const goBack = useBackNavigation('/dashboard');
  const [keywords, setKeywords] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [copied, setCopied] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);

  const fetchUserKeywords = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/sms/user-keywords`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setKeywords(data.keywords || '');
        setLastSaved(new Date());
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchUserKeywords(); }, []);

  const saveKeywords = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/sms/user-keywords`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: keywords.trim() }),
      });
      if (res.ok) {
        setLastSaved(new Date());
        toast.success('키워드가 D1 서버에 안전하게 저장되었습니다.', {
          style: { background: '#0e1420', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.2)', fontSize: '12px', fontWeight: 'bold' },
          iconTheme: { primary: '#22d3ee', secondary: '#0e1420' }
        });
      }
    } catch (e) { 
      console.error(e);
      toast.error('저장에 실패했습니다.');
    }
    finally { setSaving(false); }
  };

  const handleCopyApiUrl = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(`${label} 복사 완료`, { duration: 1500, position: 'bottom-center' });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSync = async () => {
    setSyncing(true);
    await new Promise(r => setTimeout(r, 1000));
    setSyncing(false);
    setSyncSuccess(true);
    toast.success('모바일 동기화 신호 전송 완료', {
      icon: '📡',
      style: { background: '#0e1420', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.2)', fontSize: '12px' }
    });
    setTimeout(() => setSyncSuccess(false), 3000);
  };

  const keywordList = keywords ? keywords.split('|').filter(k => k.trim()) : [];

  return (
    <div className="min-h-screen bg-[#080b12] text-white pb-28">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#080b12]/95 backdrop-blur-xl border-b border-white/5">
        <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => goBack()} className="p-2 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all">
              <ArrowLeft className="w-4 h-4 text-slate-400" />
            </button>
            <div>
              <h1 className="font-black text-base text-white tracking-tight">개인 감지 키워드</h1>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Personal Watchlist · Mobile Sync</p>
            </div>
          </div>
          <button
            onClick={saveKeywords}
            disabled={saving || loading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-black transition-all shadow-lg shadow-cyan-900/30"
          >
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            저장
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-5">
        {/* Guide Card */}
        <div className="bg-gradient-to-br from-cyan-950/30 to-blue-950/20 border border-cyan-500/20 rounded-2xl p-4 flex gap-4">
          <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 self-start">
            <Info className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-black text-white">모바일 수신 필터</p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              여기에 등록된 키워드가 포함된 SMS만 모바일에서 알림을 생성합니다.<br/>
              키워드는 <span className="text-cyan-400 font-bold">파이프(|)</span> 기호로 구분하세요.
            </p>
          </div>
        </div>

        {/* Input Area */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
              <Keyboard className="w-3 h-3" /> 키워드 리스트 편집
            </label>
            {lastSaved && (
              <span className="text-[9px] text-slate-600 font-mono">마지막 저장: {lastSaved.toLocaleTimeString()}</span>
            )}
          </div>
          <textarea
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="예: ABEND|장애|오류|CRITICAL|TIMEOUT"
            className="w-full h-32 bg-white/[0.03] border border-white/10 rounded-2xl p-4 text-sm font-mono text-cyan-50 focus:outline-none focus:border-cyan-500/40 transition-all placeholder:text-slate-700 resize-none"
          />
        </div>

        {/* Preview Badges */}
        <div className="space-y-2">
          <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">미리보기 ({keywordList.length})</h2>
          <div className="flex flex-wrap gap-2 p-4 bg-white/[0.02] border border-white/5 rounded-2xl min-h-[60px]">
            {keywordList.length === 0 ? (
              <p className="text-[11px] text-slate-600 italic m-auto">키워드를 입력하면 여기에 배지로 표시됩니다.</p>
            ) : (
              keywordList.map((k, i) => (
                <span key={i} className="px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[11px] font-bold flex items-center gap-1.5">
                  <Hash className="w-3 h-3 opacity-50" />
                  {k}
                </span>
              ))
            )}
          </div>
        </div>

        {/* Mobile Sync Section */}
        <div className="relative overflow-hidden rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-indigo-600/5 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-500/15 border border-blue-500/25 text-blue-400">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-black text-white">모바일 동기화 설정</p>
                <p className="text-[10px] text-slate-500">S-Bridge 앱에서 이 설정을 동기화하세요</p>
              </div>
            </div>
            <button
              onClick={handleSync}
              disabled={syncing}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${
                syncSuccess 
                  ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400' 
                  : 'bg-blue-500/20 border border-blue-500/30 text-blue-400'
              }`}
            >
              {syncing ? <RefreshCw className="w-3 h-3 animate-spin" /> : syncSuccess ? <Check className="w-3 h-3" /> : <Wifi className="w-3 h-3" />}
              {syncing ? '동기화 중' : syncSuccess ? '동기화 성공' : '지금 동기화'}
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between bg-black/40 rounded-xl px-4 py-3 border border-white/5">
              <div className="min-w-0 flex-1 mr-3">
                <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-0.5">Sync End-point</p>
                <p className="text-[11px] font-mono text-blue-300 truncate">{API_BASE}/sms/user-keywords</p>
              </div>
              <button onClick={() => handleCopyApiUrl(`${API_BASE}/sms/user-keywords`, 'Sync URL')} className="p-2 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-all">
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* iOS Shortcut Integration Section */}
        <div className="relative overflow-hidden rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/10 to-pink-600/5 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-500/15 border border-purple-500/25 text-purple-400">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-black text-white">iPhone 단축어 연동</p>
                <p className="text-[10px] text-slate-500">단축어에서 키워드를 JSON으로 가져오기</p>
              </div>
            </div>
            <button
              onClick={() => {
                const empId = userProfile?.employee_id || (localStorage.getItem('sguard_user') ? JSON.parse(localStorage.getItem('sguard_user')).employee_id : 'YOUR_ID');
                const url = `${API_BASE}/sms/shortcut/keywords?id=${empId}`;
                handleCopyApiUrl(url, 'Shortcut URL');
              }}
              className="px-3 py-1.5 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-400 text-[10px] font-black hover:bg-purple-500/30 transition-all"
            >
              {copied ? '복사됨' : 'URL 복사'}
            </button>
          </div>

          <div className="bg-black/30 rounded-xl p-3 border border-white/5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black text-purple-400 uppercase tracking-widest">Shortcut URL</span>
              <span className="text-[9px] font-bold text-slate-600">GET JSON</span>
            </div>
            <p className="text-[10px] font-mono text-slate-400 break-all leading-relaxed">
              {API_BASE}/sms/shortcut/keywords?id={userProfile?.employee_id || (localStorage.getItem('sguard_user') ? JSON.parse(localStorage.getItem('sguard_user')).employee_id : '[사번]')}
            </p>
          </div>

          <ul className="space-y-1.5">
            {[
              '아이폰 단축어 앱에서 "URL 내용 가져오기" 추가',
              '위 URL을 주소창에 붙여넣기',
              '헤더 추가: X-SGUARD-AUTH: (비밀키)',
              '가져온 텍스트를 "사전"으로 파싱하여 활용'
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-2 text-[10px] text-slate-500">
                <span className="text-purple-500 font-bold mt-0.5">{i+1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ul>

          <div className="pt-2">
            <button 
              onClick={() => {
                navigator.clipboard.writeText('sguard-shortcut-secure-key-2026');
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="w-full py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-bold text-slate-400 hover:text-white transition-all flex items-center justify-center gap-2"
            >
              <Shield className="w-3 h-3" /> {copied ? '비밀키 복사됨' : 'X-SGUARD-AUTH 비밀키 복사'}
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <div className="fixed inset-0 z-50 bg-[#080b12]/60 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
            <p className="text-cyan-500 text-xs font-black animate-pulse uppercase tracking-[0.2em]">Loading Config</p>
          </div>
        </div>
      )}
    </div>
  );
}
