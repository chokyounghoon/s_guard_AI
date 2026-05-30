import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBackNavigation } from '../hooks/useBackNavigation';
import { ChevronLeft, Trash2, AlertTriangle, ShieldAlert, CheckCircle2, ServerCrash, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getAccessToken, getAuthHeaders } from '../lib/authStore';

const apiBase = 'https://sguardai.khcho0421.workers.dev';

export default function AdminIncidentCleanupPage() {
  const navigate = useNavigate();
  const goBack = useBackNavigation('/dashboard');
  
  const [incId, setIncId] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [recentIncidents, setRecentIncidents] = useState([]);
  
  React.useEffect(() => {
    fetch(`${apiBase}/sms/recent?limit=50`, { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          const sorted = data.sort((a, b) => new Date(b.reg_dt) - new Date(a.reg_dt)).slice(0, 50);
          setRecentIncidents(sorted);
        }
      })
      .catch(console.error);
  }, []);

  const handleDelete = async () => {
    if (!incId.trim()) {
      toast.error('장애 ID를 입력해주세요.');
      return;
    }
    
    setIsDeleting(true);
    try {
      const rawId = incId.trim().replace(/^INC-/i, '');
      const prefixedId = `INC-${rawId}`;

      // 1. Delete raw ID
      const res1 = await fetch(`${apiBase}/admin/incident-cleanup/${rawId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      
      let errorMsg = null;
      if (!res1.ok) {
        const err = await res1.json().catch(() => ({}));
        errorMsg = `[RawID] ${res1.status} - ${err.error || 'Error'}`;
      }
      
      // 2. Delete prefixed ID
      const res2 = await fetch(`${apiBase}/admin/incident-cleanup/${prefixedId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      
      if (!res2.ok) {
        const err = await res2.json().catch(() => ({}));
        errorMsg = (errorMsg ? errorMsg + ' / ' : '') + `[Prefixed] ${res2.status} - ${err.error || 'Error'}`;
      }
      
      // 3. Fallback / Additional Guarantee
      // 방금 배포된 통합 클린업 API가 D1 트랜잭션/타입 이슈로 작동하지 않을 경우를 대비하여
      // 기존에 확실히 동작하던 단일 삭제 API도 백그라운드에서 한 번 더 찔러줍니다.
      await fetch(`${apiBase}/sms/${rawId}`, { method: 'DELETE', headers: getAuthHeaders() }).catch(() => {});
      await fetch(`${apiBase}/sms/${prefixedId}`, { method: 'DELETE', headers: getAuthHeaders() }).catch(() => {});
      
      if (errorMsg && !res1.ok && !res2.ok) {
        throw new Error(errorMsg);
      }
      
      toast.success(`[${prefixedId}] 데이터 삭제 시도 완료. (새로고침 요망)`);
      setIncId('');
      setShowConfirm(false);
      setRecentIncidents(prev => prev.filter(x => x.inc_id !== rawId && x.inc_id !== prefixedId));
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(`삭제 실패: ${error.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050810] text-slate-200 font-sans flex flex-col relative overflow-hidden">
      {/* Background Alerts */}
      <div className="fixed top-0 left-0 w-full h-[400px] bg-red-500/5 rounded-b-[100%] blur-[100px] -z-10 pointer-events-none" />

      {/* 헤더 */}
      <header className="sticky top-0 z-50 bg-[#070b14]/80 backdrop-blur-xl border-b border-red-500/20 px-4 py-3 flex items-center justify-between shadow-[0_4px_30px_rgba(239,68,68,0.1)]">
        <button onClick={() => goBack()} className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-center active:scale-95 transition-all text-slate-300">
          <ChevronLeft size={20} />
        </button>
        <div className="text-center">
          <div className="text-[15px] font-black tracking-tight text-red-500 flex items-center gap-2 justify-center">
            <Trash2 size={16} /> DATA CLEANUP
          </div>
          <div className="text-[9px] font-black tracking-[0.2em] text-red-500/60 mt-0.5">ADMIN ONLY CONSOLE</div>
        </div>
        <div className="w-9 h-9 flex items-center justify-center">
          <ShieldAlert size={18} className="text-red-500" />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-6">
        
        <div className="mb-8">
          <h2 className="text-[20px] font-black text-white leading-tight mb-2">
            Incident <span className="text-red-500">Data Cleanup</span>
          </h2>
          <p className="text-[12px] font-bold text-slate-400">
            특정 장애 ID(INC_ID)에 연관된 모든 테이블 데이터를 영구적으로 삭제합니다. 이 작업은 되돌릴 수 없습니다.
          </p>
        </div>

        {/* Warning Card */}
        <div className="bg-red-500/10 border border-red-500/30 rounded-3xl p-5 mb-8 shadow-[0_0_30px_rgba(239,68,68,0.1)] backdrop-blur-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle size={20} className="text-red-500" />
            <h3 className="text-[14px] font-black text-red-500 tracking-wide">CAUTION: DESTRUCTIVE ACTION</h3>
          </div>
          
          <ul className="space-y-2 text-[11px] font-bold text-slate-300">
            <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-red-400" /> received_messages, incidents 삭제</li>
            <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-red-400" /> warroom_list, warroom_chats 삭제</li>
            <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-red-400" /> aichat_history, autopilot_insight 삭제</li>
            <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-red-400" /> 기타 10여개 테이블의 연관 레코드 일괄 정리</li>
          </ul>
        </div>

        {/* Input Form */}
        <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-5 shadow-xl backdrop-blur-sm">
          <label className="block text-[12px] font-black text-slate-300 mb-3 ml-1 uppercase tracking-wider">
            Target Incident ID
          </label>
          <div className="relative mb-6">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <ServerCrash size={18} className="text-slate-500" />
            </div>
            <input 
              type="text" 
              value={incId}
              onChange={(e) => setIncId(e.target.value.toUpperCase())}
              placeholder="e.g. INC-20260530-001" 
              className="w-full bg-[#1e2330] border border-slate-600 rounded-2xl py-4 pl-12 pr-4 text-[15px] font-black text-white focus:outline-none focus:border-red-500 focus:bg-[#2a1b1e] transition-all placeholder-slate-500 shadow-inner"
            />
            {recentIncidents.length > 0 && (
              <div className="absolute right-12 top-1/2 -translate-y-1/2">
                <select 
                  onChange={(e) => setIncId(e.target.value)}
                  className="bg-[#0f111a] text-xs text-slate-300 border border-slate-600 rounded p-1 outline-none"
                  value=""
                >
                  <option value="" disabled>최근 장애 선택...</option>
                  {recentIncidents.map(inc => (
                    <option key={inc.inc_id} value={inc.inc_id}>
                      {inc.inc_id} ({inc.reg_dt ? new Date(inc.reg_dt).toLocaleTimeString() : '?'})
                    </option>
                  ))}
                </select>
              </div>
            )}
            {incId && (
              <button 
                onClick={() => setIncId('')} 
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-500 hover:text-white"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <button
            onClick={() => {
              if(!incId.trim()) { toast.error('장애 ID를 입력해주세요.'); return; }
              setShowConfirm(true);
            }}
            disabled={!incId.trim()}
            className="w-full bg-red-500 hover:bg-red-600 disabled:bg-white/5 disabled:text-slate-500 text-white font-black text-[14px] py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(239,68,68,0.2)] disabled:shadow-none"
          >
            <Trash2 size={18} /> 실행 준비 (Prepare Cleanup)
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowConfirm(false)} />
          <div className="bg-[#0e1118] border border-red-500/30 rounded-3xl p-6 w-full max-w-sm relative z-10 shadow-[0_0_50px_rgba(239,68,68,0.15)] animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center mb-4 text-red-500 mx-auto">
              <AlertTriangle size={24} />
            </div>
            <h3 className="text-center text-[16px] font-black text-white mb-2">최종 삭제 확인</h3>
            <p className="text-center text-[13px] font-bold text-slate-300 mb-6 leading-relaxed">
              입력하신 <span className="text-red-400 font-mono bg-red-500/10 px-1 rounded">{incId}</span> 에 대한 모든 기록이 영구히 삭제됩니다. 정말 진행하시겠습니까?
            </p>
            
            <div className="flex gap-3">
              <button 
                onClick={() => setShowConfirm(false)}
                disabled={isDeleting}
                className="flex-1 bg-white/5 hover:bg-white/10 text-white font-black text-[13px] py-3 rounded-xl transition-colors"
              >
                취소
              </button>
              <button 
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-black text-[13px] py-3 rounded-xl transition-all shadow-[0_0_15px_rgba(239,68,68,0.4)] flex items-center justify-center"
              >
                {isDeleting ? '삭제 중...' : '영구 삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
