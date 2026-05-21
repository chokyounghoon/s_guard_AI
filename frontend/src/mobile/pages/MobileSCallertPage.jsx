import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Phone, Users, Activity, RefreshCw,
  Play, Loader2, Smartphone, ChevronDown, ChevronUp,
  Globe, Check, X, AlertCircle, PhoneOff, Clock, Zap
} from 'lucide-react';
import { getAuthHeaders, getUserProfile } from '../../lib/authStore';
import { SMS_WORKER_URL } from '../../config/api';

const API_BASE = SMS_WORKER_URL || 'https://sguardai.khcho0421.workers.dev';

function EventBadge({ type }) {
  const map = {
    CONNECTED:    { label: '연결', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    DISCONNECTED: { label: '종료', cls: 'bg-slate-500/20 text-slate-400 border-white/10' },
    MISSED:       { label: '부재', cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
  };
  const { label, cls } = map[type] || { label: type || '-', cls: 'bg-white/5 text-slate-500 border-white/10' };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-black uppercase tracking-wider ${cls}`}>{label}</span>;
}

function Card({ children, accent = '#6366f1' }) {
  return (
    <div className="rounded-2xl border border-white/5 p-4 relative overflow-hidden" style={{ background: 'rgba(12,16,32,0.8)', backdropFilter: 'blur(20px)' }}>
      <div className="absolute top-0 left-0 w-full h-[2px]" style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }} />
      {children}
    </div>
  );
}

function CardHeader({ icon: Icon, title, sub, color = '#6366f1', extra }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}20`, border: `1px solid ${color}40` }}>
          <Icon size={14} color={color} />
        </div>
        <div>
          <p className="text-xs font-black text-white leading-tight">{title}</p>
          <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color }}>{sub}</p>
        </div>
      </div>
      {extra}
    </div>
  );
}

export default function MobileSCallertPage() {
  const navigate = useNavigate();

  // ── 전략 ─────────────────────────────────────────────
  const [strategies, setStrategies]   = useState([]);
  const [selectedSid, setSelectedSid] = useState('');
  const [stratOpen, setStratOpen]     = useState(true);

  // ── 담당자 ──────────────────────────────────────────
  const [targets, setTargets]         = useState([]);
  const [tgtLoading, setTgtLoading]   = useState(false);
  const [tgtOpen, setTgtOpen]         = useState(false);

  // ── PDS Config ──────────────────────────────────────
  const [pdsConfig, setPdsConfig]     = useState(null);
  const [cfgBodyText, setCfgBodyText] = useState('{"data":{"action":"CALL","phone_number":"01012345678"}}');
  const [testPhone, setTestPhone]     = useState('01012345678');
  const [callLoading, setCallLoading] = useState(false);
  const [callResult, setCallResult]   = useState(null);

  // ── 실시간 수신 로그 ─────────────────────────────────
  const [appEvents, setAppEvents]     = useState([]);
  const [evtLoading, setEvtLoading]   = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [evtOpen, setEvtOpen]         = useState(true);

  // ── Mock Webhook ─────────────────────────────────────
  const [mockOpen, setMockOpen]       = useState(false);
  const [mockEmpId, setMockEmpId]     = useState('12345');
  const [mockPhone, setMockPhone]     = useState('01012345678');
  const [mockSending, setMockSending] = useState(false);

  // ── 발신자 목록 (push_subscriptions) ───────────────
  const [pushDevices, setPushDevices] = useState([]);
  const [devicesOpen, setDevicesOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState('');

  // ─── 전략 목록 로드 ───────────────────────────────────
  const fetchStrategies = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/scallert/strategies`, { headers: getAuthHeaders() });
      if (!r.ok) return;
      const data = await r.json();
      const list = (data.strategies || data || []).map(s => ({
        strategy_id: s.strategy_id || s.STRATEGY_ID,
        strategy_nm: s.strategy_nm || s.STRATEGY_NM,
        use_yn: s.use_yn || s.USE_YN,
      }));
      setStrategies(list);
      if (list.length > 0 && !selectedSid) setSelectedSid(list[0].strategy_id);
    } catch (e) { console.error(e); }
  }, [selectedSid]);

  // ─── 담당자 로드 ──────────────────────────────────────
  const fetchTargets = useCallback(async (sid) => {
    if (!sid) return;
    setTgtLoading(true);
    try {
      const r = await fetch(`${API_BASE}/scallert/strategies/${sid}/targets`, { headers: getAuthHeaders() });
      const data = await r.json();
      setTargets(data.targets || data || []);
    } catch (e) { console.error(e); }
    finally { setTgtLoading(false); }
  }, []);

  // ─── Push 기기 목록 로드 ──────────────────────────────
  const fetchPushDevices = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/scallert/push-devices`, { headers: getAuthHeaders() });
      if (!r.ok) return;
      const list = await r.json();
      const arr = Array.isArray(list) ? list : [];
      setPushDevices(arr);
      if (arr.length > 0) setSelectedDevice(prev => prev || arr[0].user_id);
    } catch (e) { console.error('push-devices:', e); }
  }, []);

  // ─── PDS Config 로드 ──────────────────────────────────
  const fetchPdsConfig = useCallback(async (sid) => {
    if (!sid) return;
    try {
      const r = await fetch(`${API_BASE}/scallert/strategies/${sid}/config`, { headers: getAuthHeaders() });
      const data = await r.json();
      if (data && !data.error && data.API_URL) {
        const headers = typeof data.API_HEADERS === 'string' ? JSON.parse(data.API_HEADERS || '{}') : (data.API_HEADERS || {});
        const params  = typeof data.API_PARAMS  === 'string' ? JSON.parse(data.API_PARAMS  || '{}') : (data.API_PARAMS  || {});
        setPdsConfig({ api_url: data.API_URL, api_method: data.API_METHOD || 'POST', api_headers: headers, api_params: params, timeout_sec: data.TIMEOUT_SEC || 10 });
        setCfgBodyText(JSON.stringify(params, null, 2));
      } else {
        const def = { data: { action: 'CALL', phone_number: '01012345678' } };
        setPdsConfig({ api_url: 'https://fcm.googleapis.com/fcm/send', api_method: 'POST', api_headers: { 'TTL': '60', 'Urgency': 'high' }, api_params: def, timeout_sec: 10 });
        setCfgBodyText(JSON.stringify(def, null, 2));
      }
    } catch (e) { console.error('pds-config error:', e); }
  }, []);

  // ─── 앱 이벤트 로드 ───────────────────────────────────
  const fetchAppEvents = useCallback(async () => {
    setEvtLoading(true);
    try {
      const r = await fetch(`${API_BASE}/scallert/app-events?limit=30`, { headers: getAuthHeaders() });
      const data = await r.json();
      setAppEvents(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
    finally { setEvtLoading(false); }
  }, []);

  // ─── PDS + VAPID 푸시 병행 발송 ───────────────────────
  const handleTestCall = async () => {
    if (!selectedSid) { alert('전략을 먼저 선택해주세요.'); return; }
    if (!pdsConfig?.api_url) { alert('PDS API URL이 설정되지 않았습니다.'); return; }
    setCallLoading(true); setCallResult(null);
    try {
      let parsedParams = {};
      try { parsedParams = JSON.parse(cfgBodyText || '{}'); } catch(_) {}
      if (parsedParams?.data) parsedParams.data.phone_number = testPhone;
      else parsedParams.phone_number = testPhone;

      const [pdsRes, pushRes] = await Promise.allSettled([
        fetch(`${API_BASE}/scallert/strategies/${selectedSid}/test-call`, {
          method: 'POST', headers: getAuthHeaders(),
          body: JSON.stringify({ ...pdsConfig, api_params: parsedParams, tested_by: 'MOBILE' })
        }),
        selectedDevice
          ? fetch(`${API_BASE}/scallert/test-push`, {
              method: 'POST', headers: getAuthHeaders(),
              body: JSON.stringify({ target_user_id: selectedDevice, phone_number: testPhone })
            })
          : Promise.resolve(null)
      ]);

      const pdsData = pdsRes.status === 'fulfilled' ? await pdsRes.value.json() : {};
      const pushData = (pushRes.status === 'fulfilled' && pushRes.value) ? await pushRes.value.json() : null;

      // 실제 전화 발신은 VAPID 푸시가 트리거 — 푸시 성공 여부가 핵심
      const pushOk = pushData?.success === true;
      const pdsOk  = pdsData.success || pdsData.status_code === 200 || pdsData.status_code === 201;
      const ok = selectedDevice ? pushOk : pdsOk;

      const pushTag  = pushData  ? (pushOk  ? '앱 푸시 ✅' : '앱 푸시 ❌') : '푸시 기기 미선택';
      const pdsTag   = `PDS HTTP ${pdsData.status_code || '-'}`;
      setCallResult({
        ok,
        msg: `${pushTag}  |  ${pdsTag}`,
        detail: pdsData.response || pdsData.error || ''
      });
    } catch (e) {
      setCallResult({ ok: false, msg: '오류: ' + e.message, detail: '' });
    } finally { setCallLoading(false); }
  };

  // ─── Mock Webhook 전송 ────────────────────────────────
  const handleMock = async (type) => {
    setMockSending(true);
    try {
      const r = await fetch(`${API_BASE}/call/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: mockEmpId, phone_number: mockPhone, event_type: type, timestamp: Date.now() })
      });
      if (r.ok) await fetchAppEvents();
      else alert('전송 실패');
    } catch (e) { alert('오류: ' + e.message); }
    finally { setMockSending(false); }
  };

  useEffect(() => { fetchStrategies(); fetchAppEvents(); fetchPushDevices(); }, []);

  useEffect(() => {
    if (selectedSid) { fetchTargets(selectedSid); fetchPdsConfig(selectedSid); }
  }, [selectedSid, fetchTargets, fetchPdsConfig]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(fetchAppEvents, 5000);
    return () => clearInterval(timer);
  }, [autoRefresh, fetchAppEvents]);

  return (
    <div className="min-h-screen text-white font-sans pb-24" style={{ background: 'linear-gradient(160deg,#04070f 0%,#070b18 60%,#04070f 100%)' }}>
      <div className="fixed top-0 right-0 w-64 h-64 bg-orange-600/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed bottom-20 left-0 w-64 h-64 bg-cyan-600/5 blur-[120px] rounded-full pointer-events-none" />

      {/* 헤더 */}
      <div className="sticky top-0 z-40 px-4 pt-safe-top pb-3" style={{ background: 'rgba(4,7,15,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-3 pt-2">
          <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center active:scale-95">
            <ArrowLeft size={15} className="text-slate-300" />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-black text-white tracking-tight">S-Callert</h1>
            <p className="text-[9px] font-bold uppercase tracking-widest text-orange-400">장애 대응 PDS 전략 관리</p>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <div className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
            <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Live</span>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">

        {/* 1. 전략 선택 */}
        <Card accent="#f97316">
          <div className="flex items-center justify-between cursor-pointer" onClick={() => setStratOpen(v => !v)}>
            <CardHeader icon={Zap} title="장애 대응 전략" sub="Strategy Master" color="#f97316" />
            {stratOpen ? <ChevronUp size={14} className="text-slate-500 shrink-0 mb-3" /> : <ChevronDown size={14} className="text-slate-500 shrink-0 mb-3" />}
          </div>
          {stratOpen && (
            <div className="mt-1 space-y-2">
              {strategies.length === 0 ? (
                <p className="text-center text-slate-600 text-xs py-4">전략 없음</p>
              ) : strategies.map(s => (
                <button key={s.strategy_id} onClick={() => setSelectedSid(s.strategy_id)}
                  className={`w-full text-left px-3.5 py-3 rounded-xl border transition-all active:scale-[0.98] ${selectedSid === s.strategy_id ? 'bg-orange-500/10 border-orange-500/40' : 'bg-white/[0.02] border-white/5'}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-black ${selectedSid === s.strategy_id ? 'text-orange-300' : 'text-slate-300'}`}>{s.strategy_nm}</span>
                    {s.use_yn === 'Y' && <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">활성</span>}
                  </div>
                  <p className="text-[10px] text-slate-600 font-mono mt-0.5">ID: {s.strategy_id}</p>
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* 2. PDS 테스트 발신 */}
        {selectedSid && (
          <Card accent="#10b981">
            <CardHeader icon={Phone} title="PDS 테스트 발신" sub="Test Call via PDS API" color="#10b981" />
            {pdsConfig?.api_url && (
              <div className="mb-3 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1">발신 API Endpoint</p>
                <p className="text-[10px] text-cyan-400 font-mono break-all">{pdsConfig.api_url}</p>
              </div>
            )}

            {/* 발신자(핸드폰) 선택 */}
            <div className="mb-3">
              <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1.5">발신 기기 선택 (콜이 나가는 핸드폰)</p>
              <div className="relative">
                <select
                  value={selectedDevice}
                  onChange={e => setSelectedDevice(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50 cursor-pointer appearance-none"
                >
                  {pushDevices.length === 0
                    ? <option value="">등록된 기기 없음 (앱 로그인 필요)</option>
                    : pushDevices.map(dev => (
                        <option key={dev.user_id} value={dev.user_id}>
                          {dev.emp_nm ? `${dev.emp_nm} (${dev.user_id})` : `사번: ${dev.user_id}`}
                        </option>
                      ))
                  }
                </select>
                <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              </div>
            </div>

            <div className="mb-4">
              <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1.5">수신 전화번호 (발신 대상)</p>
              <input type="tel" value={testPhone} onChange={e => setTestPhone(e.target.value)} placeholder="01012345678"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-emerald-400 font-mono focus:outline-none focus:border-emerald-500/50" />
            </div>
            <button onClick={handleTestCall} disabled={callLoading || !pdsConfig?.api_url}
              className="w-full py-3.5 rounded-xl text-sm font-black flex items-center justify-center gap-2 transition-all active:scale-[0.97]"
              style={{
                background: callLoading || !pdsConfig?.api_url ? 'rgba(255,255,255,0.04)' : 'linear-gradient(135deg,#10b981,#059669)',
                color: callLoading || !pdsConfig?.api_url ? '#334155' : '#fff',
                boxShadow: callLoading || !pdsConfig?.api_url ? 'none' : '0 8px 20px rgba(16,185,129,0.3)'
              }}>
              {callLoading ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
              {callLoading ? 'API 발신 중...' : 'PDS 발신 테스트 실행'}
            </button>
            {callResult && (
              <div className={`mt-3 px-3 py-2.5 rounded-xl border ${callResult.ok ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                <div className={`flex items-center gap-2 text-xs font-bold mb-1 ${callResult.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                  {callResult.ok ? <Check size={13} /> : <X size={13} />}
                  {callResult.msg}
                </div>
                {callResult.detail && <p className="text-[10px] text-slate-500 font-mono break-all">{callResult.detail.substring(0, 120)}</p>}
              </div>
            )}
          </Card>
        )}

        {/* 3. 담당자 목록 */}
        {selectedSid && (
          <Card accent="#8b5cf6">
            <div className="flex items-center justify-between cursor-pointer" onClick={() => setTgtOpen(v => !v)}>
              <CardHeader icon={Users} title="담당자 목록" sub="Call Targets" color="#8b5cf6"
                extra={<span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-purple-500/10 text-purple-400 border border-purple-500/20">{targets.length}명</span>} />
              {tgtOpen ? <ChevronUp size={14} className="text-slate-500 shrink-0 ml-2 mb-3" /> : <ChevronDown size={14} className="text-slate-500 shrink-0 ml-2 mb-3" />}
            </div>
            {tgtOpen && (
              <div className="mt-3">
                {tgtLoading ? (
                  <div className="flex items-center justify-center py-8"><Loader2 size={18} className="animate-spin text-slate-600" /></div>
                ) : targets.length === 0 ? (
                  <div className="text-center py-8"><PhoneOff size={24} className="mx-auto text-slate-700 mb-2" /><p className="text-xs text-slate-600">등록된 담당자 없음</p></div>
                ) : (
                  <div className="space-y-2">
                    {targets.map((t, i) => (
                      <div key={t.seq_no || i} className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-white/[0.02] border border-white/5">
                        <div className="w-8 h-8 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
                          <span className="text-[11px] font-black text-purple-400">{i + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black text-slate-200 truncate">{t.EMP_NM || t.emp_nm}</p>
                          <p className="text-[10px] text-slate-500 font-mono">{t.MOBILE_NO || t.mobile_no}</p>
                        </div>
                        <span className="text-[9px] text-slate-600 font-mono">{t.EMP_ID || t.emp_id}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>
        )}

        {/* 2-b. 발신자 목록 (push_subscriptions) */}
        <Card accent="#f59e0b">
          <div className="flex items-center justify-between cursor-pointer" onClick={() => setDevicesOpen(v => !v)}>
            <CardHeader icon={Smartphone} title="발신자 목록" sub="Registered Push Devices" color="#f59e0b"
              extra={<span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-amber-500/10 text-amber-400 border border-amber-500/20">{pushDevices.length}명</span>} />
            {devicesOpen ? <ChevronUp size={14} className="text-slate-500 shrink-0 ml-2 mb-3" /> : <ChevronDown size={14} className="text-slate-500 shrink-0 ml-2 mb-3" />}
          </div>
          {devicesOpen && (
            <div className="mt-1 space-y-2">
              {pushDevices.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-xs text-slate-600">등록된 기기 없음</p>
                  <p className="text-[10px] text-slate-700 mt-1">앱에서 로그인 시 자동 등록됩니다</p>
                </div>
              ) : pushDevices.map((dev, i) => (
                <div key={dev.user_id} className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-amber-500/[0.03] border border-amber-500/10">
                  <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                    <Smartphone size={13} className="text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-slate-200 truncate">{dev.emp_nm || `사번 ${dev.user_id}`}</p>
                    <p className="text-[10px] text-slate-500 font-mono">등록일시: {(dev.mod_dt || '').slice(0, 16).replace('T', ' ')}</p>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="text-[9px] font-black text-emerald-400 font-mono">{dev.user_id}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* 4. 실시간 통화 수신 로그 */}
        <Card accent="#06b6d4">
          <div className="flex items-center justify-between">
            <div className="flex-1 cursor-pointer" onClick={() => setEvtOpen(v => !v)}>
              <CardHeader icon={Activity} title="앱 통화 상태 수신 이력" sub="App Call Status Webhook" color="#06b6d4" />
            </div>
            <div className="flex items-center gap-2 mb-3">
              <button onClick={() => setAutoRefresh(v => !v)}
                className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-all ${autoRefresh ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-white/5 border-white/10'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
              </button>
              <button onClick={fetchAppEvents} disabled={evtLoading}
                className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                <RefreshCw size={11} className={`text-slate-400 ${evtLoading ? 'animate-spin' : ''}`} />
              </button>
              <div className="cursor-pointer" onClick={() => setEvtOpen(v => !v)}>
                {evtOpen ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
              </div>
            </div>
          </div>

          {evtOpen && (
            <div className="mt-3">
              {appEvents.length === 0 ? (
                <div className="text-center py-8"><Globe size={24} className="mx-auto text-slate-700 mb-2" /><p className="text-xs text-slate-600">수신된 통화 상태 없음</p></div>
              ) : (
                <div className="space-y-2">
                  {appEvents.map((evt, i) => (
                    <div key={evt.LOG_ID || i} className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-white/[0.02] border border-white/5">
                      <EventBadge type={evt.EVENT_TYPE} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-slate-200">{evt.EMPLOYEE_ID}</p>
                        <p className="text-[10px] text-slate-500 font-mono truncate">{evt.PHONE_NUMBER}</p>
                      </div>
                      <div className="flex items-center gap-1 text-[9px] text-slate-600 shrink-0">
                        <Clock size={9} /><span>{(evt.EVENT_TIME || evt.REG_DT || '').slice(11, 19)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>

        {/* 5. Mock Webhook 시뮬레이터 */}
        <Card accent="#f59e0b">
          <button onClick={() => setMockOpen(v => !v)} className="flex items-center justify-between w-full">
            <CardHeader icon={AlertCircle} title="Webhook 모의 테스트" sub="Mock Event Trigger" color="#f59e0b" />
            {mockOpen ? <ChevronUp size={14} className="text-slate-500 shrink-0" /> : <ChevronDown size={14} className="text-slate-500 shrink-0" />}
          </button>
          {mockOpen && (
            <div className="mt-3 space-y-3">
              <div>
                <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1.5">사번</p>
                <input type="text" value={mockEmpId} onChange={e => setMockEmpId(e.target.value)} placeholder="12345"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-amber-500/50" />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1.5">전화번호</p>
                <input type="tel" value={mockPhone} onChange={e => setMockPhone(e.target.value)} placeholder="01012345678"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-amber-500/50" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => handleMock('CONNECTED')} disabled={mockSending} className="py-3 rounded-xl text-[11px] font-black border transition-all active:scale-95 bg-emerald-500/10 border-emerald-500/30 text-emerald-400">CONNECTED</button>
                <button onClick={() => handleMock('DISCONNECTED')} disabled={mockSending} className="py-3 rounded-xl text-[11px] font-black border transition-all active:scale-95 bg-slate-500/10 border-white/10 text-slate-400">ENDED</button>
                <button onClick={() => handleMock('MISSED')} disabled={mockSending} className="py-3 rounded-xl text-[11px] font-black border transition-all active:scale-95 bg-red-500/10 border-red-500/30 text-red-400">MISSED</button>
              </div>
              <p className="text-[9px] text-slate-600 leading-relaxed">
                * 입력한 사번/번호로 <span className="text-amber-500 font-mono">POST /call/event</span>를 모의 호출하여 수신 이력을 테스트합니다.
              </p>
            </div>
          )}
        </Card>

      </div>
    </div>
  );
}
