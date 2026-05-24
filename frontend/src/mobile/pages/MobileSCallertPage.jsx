import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Phone, Users, Activity, RefreshCw,
  Play, Loader2, Smartphone, ChevronDown, ChevronUp,
  Globe, Check, X, AlertCircle, PhoneOff, Clock, Zap,
  Plus, Trash2, Edit3, Save
} from 'lucide-react';
import { getAuthHeaders, getUserProfile } from '../../lib/authStore';
import { SMS_WORKER_URL } from '../../config/api';

const API_BASE = SMS_WORKER_URL || 'https://sguardai.khcho0421.workers.dev';

const STRATEGY_CONT_OPTIONS = [
  { id: '1', label: '메시지 수신자별 순차 통화' },
  { id: '2', label: '메시지 수신자 및 AA, 파트장' },
  { id: '3', label: '메시지 수신자의 파트 전원' },
  { id: '4', label: '대직자 발신' },
];

function EventBadge({ type }) {
  const map = {
    DIALING:        { label: '발신', cls: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
    RINGING:        { label: '신호', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
    CONNECTED:      { label: '걸기중', cls: 'bg-teal-500/20 text-teal-400 border-teal-500/30' },
    DISCONNECTED:   { label: '종료', cls: 'bg-slate-500/20 text-slate-400 border-white/10' },
    SUCCESS:        { label: '성공', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    FAIL_VOICEMAIL: { label: '소리샘', cls: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
    MISSED:         { label: '부재', cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
    FAILED:         { label: '실패', cls: 'bg-rose-500/20 text-rose-400 border-rose-500/30' },
  };
  const upperType = (type || '').toUpperCase();
  const { label, cls } = map[upperType] || { label: type || '-', cls: 'bg-white/5 text-slate-500 border-white/10' };
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
  const userProfile = getUserProfile();

  // ── 전략 ─────────────────────────────────────────────
  const [strategies, setStrategies]   = useState([]);
  const [selectedSid, setSelectedSid] = useState('');
  const [stratOpen, setStratOpen]     = useState(true);
  
  // 전략 추가 폼
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createLoading, setCreateLoading]   = useState(false);
  const [newStrat, setNewStrat] = useState({
    strategy_nm: '',
    strategy_cont: '1',
    apply_start_dt: new Date().toISOString().slice(0, 16),
    apply_end_dt: '2099-12-31T23:59',
    priority: 99,
    delay_sec: 0,
    valid_conditions: [],
    max_call_cnt: 3,
    use_yn: 'Y'
  });

  // 전략 수정 폼
  const [isEditingStrat, setIsEditingStrat] = useState(false);
  const [editLoading, setEditLoading]       = useState(false);
  const [stratForm, setStratForm]           = useState(null);

  // ── 담당자 ──────────────────────────────────────────
  const [targets, setTargets]         = useState([]);
  const [mySubstitutes, setMySubstitutes] = useState([]);
  const [tgtLoading, setTgtLoading]   = useState(false);
  const [tgtOpen, setTgtOpen]         = useState(false);
  const [userPhones, setUserPhones]   = useState({});

  const fetchUsers = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/users`, { headers: getAuthHeaders() });
      if (r.ok) {
        const list = await r.json();
        const phoneMap = {};
        list.forEach(u => {
          if (u.employee_id && u.phone) {
            phoneMap[String(u.employee_id).trim()] = u.phone;
          }
        });
        setUserPhones(phoneMap);
      }
    } catch (e) {
      console.error('Failed to fetch users for phone mapping:', e);
    }
  }, []);
  
  // 담당자 추가 폼
  const [showAddTgtForm, setShowAddTgtForm] = useState(false);
  const [addTgtLoading, setAddTgtLoading]   = useState(false);
  const [newTgt, setNewTgt] = useState({
    emp_id: '',
    emp_nm: '',
    mobile_no: '',
    sort_ord: 1
  });

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

  // ── 발신자 목록 (push_subscriptions) ───────────────
  const [pushDevices, setPushDevices] = useState([]);
  const [devicesOpen, setDevicesOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState('');

  // ─── 전략 목록 로드 ───────────────────────────────────
  const fetchStrategies = useCallback(async (selectId = null) => {
    try {
      const r = await fetch(`${API_BASE}/scallert/strategies`, { headers: getAuthHeaders() });
      if (!r.ok) return;
      const data = await r.json();
      const list = (data.strategies || data || []).map(s => ({
        strategy_id: s.strategy_id || s.STRATEGY_ID,
        strategy_nm: s.strategy_nm || s.STRATEGY_NM,
        strategy_cont: s.strategy_cont || s.STRATEGY_CONT || '1',
        priority: s.priority ?? s.PRIORITY ?? 99,
        delay_sec: s.delay_sec ?? s.DELAY_SEC ?? 0,
        valid_conditions: (typeof s.VALID_CONDITIONS === 'string' ? (() => { try { return JSON.parse(s.VALID_CONDITIONS); } catch(e) { return []; } })() : (s.VALID_CONDITIONS || [])),
        apply_start_dt: s.apply_start_dt || s.APPLY_START_DT || '',
        apply_end_dt: s.apply_end_dt || s.APPLY_END_DT || '',
        max_call_cnt: s.max_call_cnt || s.MAX_CALL_CNT || 3,
        use_yn: s.use_yn || s.USE_YN || 'Y',
      }));
      setStrategies(list);
      
      if (selectId) {
        setSelectedSid(selectId);
      } else if (list.length > 0 && !selectedSid) {
        setSelectedSid(list[0].strategy_id);
      }
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

  // ─── 대직자 로드 ──────────────────────────────────────
  const fetchMySubstitutes = useCallback(async (userId) => {
    if (!userId) return;
    try {
      const res = await fetch(`${API_BASE}/rbac/substitutes/${userId}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setMySubstitutes(data.substitutes || []);
      }
    } catch (e) {
      console.error('Failed to fetch substitutes:', e);
    }
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

  // ─── 전략 신규 등록 ─────────────────────────────────
  const handleCreateStrategy = async () => {
    if (!newStrat.strategy_nm.trim()) {
      alert('전략명을 입력해 주세요.');
      return;
    }
    setCreateLoading(true);
    try {
      const r = await fetch(`${API_BASE}/scallert/strategies`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...newStrat,
          priority: Number(newStrat.priority || 99),
          delay_sec: Number(newStrat.delay_sec || 0),
          valid_conditions: Array.isArray(newStrat.valid_conditions) ? newStrat.valid_conditions : [],
          max_call_cnt: Number(newStrat.max_call_cnt),
          reg_id: userProfile?.employee_id || 'SYSTEM'
        })
      });
      if (r.ok) {
        const res = await r.json();
        alert('새 전략이 성공적으로 등록되었습니다.');
        setShowCreateForm(false);
        setNewStrat({
          strategy_nm: '',
          strategy_cont: '1',
          priority: 99,
          delay_sec: 0,
          valid_conditions: [],
          apply_start_dt: new Date().toISOString().slice(0, 16),
          apply_end_dt: '2099-12-31T23:59',
          max_call_cnt: 3,
          use_yn: 'Y'
        });
        await fetchStrategies(res.strategy_id || res.STRATEGY_ID);
      } else {
        const err = await r.json();
        alert('전략 등록에 실패했습니다: ' + (err.error || ''));
      }
    } catch (e) {
      alert('네트워크 오류가 발생했습니다: ' + e.message);
    } finally {
      setCreateLoading(false);
    }
  };

  // ─── 전략 변경사항 저장 ──────────────────────────────
  const handleSaveStrategy = async () => {
    if (!stratForm) return;
    if (!stratForm.strategy_nm.trim()) {
      alert('전략명을 입력해 주세요.');
      return;
    }
    setEditLoading(true);
    try {
      const r = await fetch(`${API_BASE}/scallert/strategies/${selectedSid}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          strategy_nm: stratForm.strategy_nm,
          strategy_cont: stratForm.strategy_cont,
          priority: Number(stratForm.priority ?? 99),
          delay_sec: Number(stratForm.delay_sec ?? 0),
          valid_conditions: Array.isArray(stratForm.valid_conditions) ? stratForm.valid_conditions : [],
          apply_start_dt: stratForm.apply_start_dt,
          apply_end_dt: stratForm.apply_end_dt,
          max_call_cnt: Number(stratForm.max_call_cnt),
          use_yn: stratForm.use_yn,
          mod_id: userProfile?.employee_id || 'SYSTEM'
        })
      });
      if (r.ok) {
        alert('전략 설정이 저장되었습니다.');
        setIsEditingStrat(false);
        await fetchStrategies(selectedSid);
      } else {
        const err = await r.json();
        alert('저장에 실패했습니다: ' + (err.error || ''));
      }
    } catch (e) {
      alert('오류가 발생했습니다: ' + e.message);
    } finally {
      setEditLoading(false);
    }
  };

  // ─── 담당자 추가 ────────────────────────────────────
  const handleAddTarget = async () => {
    if (!newTgt.emp_id.trim() || !newTgt.emp_nm.trim() || !newTgt.mobile_no.trim()) {
      alert('사번, 성명, 휴대번호는 필수입니다.');
      return;
    }
    setAddTgtLoading(true);
    try {
      const r = await fetch(`${API_BASE}/scallert/strategies/${selectedSid}/targets`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...newTgt,
          sort_ord: Number(newTgt.sort_ord),
          mod_id: userProfile?.employee_id || 'SYSTEM'
        })
      });
      if (r.ok) {
        alert('담당자가 추가되었습니다.');
        setShowAddTgtForm(false);
        setNewTgt({ emp_id: '', emp_nm: '', mobile_no: '', sort_ord: 1 });
        await fetchTargets(selectedSid);
      } else {
        alert('담당자 추가에 실패했습니다.');
      }
    } catch (e) {
      alert('오류가 발생했습니다: ' + e.message);
    } finally {
      setAddTgtLoading(false);
    }
  };

  // ─── 담당자 삭제 ────────────────────────────────────
  const handleDeleteTarget = async (seqNo) => {
    if (!window.confirm('이 담당자를 정말 삭제하시겠습니까?')) return;
    try {
      const r = await fetch(`${API_BASE}/scallert/targets/${seqNo}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (r.ok) {
        alert('담당자가 삭제되었습니다.');
        await fetchTargets(selectedSid);
      } else {
        alert('삭제에 실패했습니다.');
      }
    } catch (e) {
      alert('오류: ' + e.message);
    }
  };

  useEffect(() => {
    if (userProfile?.employee_id) {
      fetchMySubstitutes(userProfile.employee_id);
    }
  }, [userProfile?.employee_id, fetchMySubstitutes]);

  useEffect(() => {
    fetchUsers();
    fetchStrategies();
    fetchAppEvents();
    fetchPushDevices();
  }, []);

  useEffect(() => {
    if (selectedSid) {
      fetchTargets(selectedSid);
      fetchPdsConfig(selectedSid);
      const current = strategies.find(s => s.strategy_id === selectedSid);
      if (current) {
        setStratForm({ ...current });
      }
      setIsEditingStrat(false);
    }
  }, [selectedSid, strategies]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(fetchAppEvents, 5000);
    return () => clearInterval(timer);
  }, [autoRefresh, fetchAppEvents]);

  const [nowTime, setNowTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTime(new Date());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const activeTargets = useMemo(() => {
    const isSub = stratForm?.strategy_cont === '4';
    if (isSub) {
      return mySubstitutes.map((sub, index) => {
        const phoneFromUsers = userPhones[String(sub.deputy_id).trim()];
        return {
          seq_no: sub.id,
          emp_id: sub.deputy_id,
          emp_nm: sub.deputy_name,
          mobile_no: (phoneFromUsers && phoneFromUsers !== '010-0000-0000') ? phoneFromUsers : (sub.deputy_phone || '010-0000-0000'),
          sort_ord: index + 1
        };
      });
    }
    return targets.map(t => {
      const empId = String(t.EMP_ID || t.emp_id || '').trim();
      const phoneFromUsers = userPhones[empId];
      return {
        ...t,
        emp_id: empId,
        emp_nm: t.EMP_NM || t.emp_nm,
        mobile_no: (phoneFromUsers && phoneFromUsers !== '010-0000-0000') ? phoneFromUsers : (t.MOBILE_NO || t.mobile_no || '010-0000-0000')
      };
    });
  }, [stratForm?.strategy_cont, mySubstitutes, targets, userPhones]);

  const isSubstituteType = stratForm?.strategy_cont === '4';

  const strategyStatus = useMemo(() => {
    if (!stratForm) return { active: false, reason: '선택된 전략 없음' };
    if (stratForm.use_yn !== 'Y') return { active: false, reason: '사용 중지됨' };

    const start = stratForm.apply_start_dt ? new Date(stratForm.apply_start_dt) : null;
    const end = stratForm.apply_end_dt ? new Date(stratForm.apply_end_dt) : null;

    if (start && nowTime < start) return { active: false, reason: '적용 대기 (시작일 미도달)' };
    if (end && nowTime > end) return { active: false, reason: '적용 만료 (종료일 경과)' };

    const conds = stratForm.valid_conditions || [];
    if (conds.length === 0) return { active: true, reason: '상시 적용 (조건 없음)' };

    const day = nowTime.getDay(); // 0: 일요일, 6: 토요일
    const hour = nowTime.getHours();
    const isWeekend = (day === 0 || day === 6);
    const isDaytime = (hour >= 9 && hour < 18);

    const hasDaytime = conds.includes('DAYTIME');
    const hasWeekend = conds.includes('WEEKEND');
    const hasNight18 = conds.includes('NIGHT_18');
    const hasNight19 = conds.includes('NIGHT_19');
    const hasNight20 = conds.includes('NIGHT_20');

    let matched = false;
    let matchReasons = [];

    if (hasDaytime && isDaytime && !isWeekend) {
      matched = true;
      matchReasons.push('평일 주간');
    }
    if (hasWeekend && isWeekend) {
      matched = true;
      matchReasons.push('주말');
    }
    if (hasNight18 && (hour >= 18 || hour < 9) && !isWeekend) {
      matched = true;
      matchReasons.push('평일 야간(18시이후)');
    }
    if (hasNight19 && (hour >= 19 || hour < 9) && !isWeekend) {
      matched = true;
      matchReasons.push('평일 야간(19시이후)');
    }
    if (hasNight20 && (hour >= 20 || hour < 9) && !isWeekend) {
      matched = true;
      matchReasons.push('평일 야간(20시이후)');
    }

    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const timeStr = `${dayNames[day]}요일 ${hour}시`;

    if (matched) {
      return { active: true, reason: `적용 중 (${matchReasons.join(', ')})` };
    } else {
      let failReason = '적용 시간 아님';
      if (isWeekend && !hasWeekend) {
        failReason = `주말 조건 미선택 (${timeStr})`;
      } else {
        failReason = `조건 미충족 (${timeStr})`;
      }
      return { active: false, reason: failReason };
    }
  }, [stratForm, nowTime]);

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

        {/* 1. 장애 대응 전략 선택 및 생성 */}
        <Card accent="#f97316">
          <div className="flex items-center justify-between">
            <div className="flex-1 cursor-pointer" onClick={() => setStratOpen(v => !v)}>
              <CardHeader icon={Zap} title="장애 대응 전략" sub="Strategy Master" color="#f97316" />
            </div>
            <button
              onClick={() => setShowCreateForm(v => !v)}
              className="mb-3 w-8 h-8 rounded-xl flex items-center justify-center bg-orange-500/10 border border-orange-500/30 text-orange-400 hover:bg-orange-500 hover:text-black transition-all active:scale-95"
              title="새 전략 추가"
            >
              {showCreateForm ? <X size={15} /> : <Plus size={15} />}
            </button>
            <div className="cursor-pointer ml-2 mb-3" onClick={() => setStratOpen(v => !v)}>
              {stratOpen ? <ChevronUp size={14} className="text-slate-500 shrink-0" /> : <ChevronDown size={14} className="text-slate-500 shrink-0" />}
            </div>
          </div>

          {stratOpen && (
            <div className="mt-1 space-y-3">
              {/* 새 전략 추가 폼 */}
              {showCreateForm && (
                <div className="p-3.5 rounded-xl bg-orange-500/5 border border-orange-500/20 space-y-3">
                  <p className="text-xs font-black text-orange-400">새 전략 등록</p>
                  <div>
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">전략 명칭</p>
                    <input
                      type="text"
                      value={newStrat.strategy_nm}
                      onChange={e => setNewStrat(p => ({ ...p, strategy_nm: e.target.value }))}
                      placeholder="예: 야간 장애 순차발신 전략"
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500/50"
                    />
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">전략 내용 (유형)</p>
                    <select
                      value={newStrat.strategy_cont}
                      onChange={e => setNewStrat(p => ({ ...p, strategy_cont: e.target.value }))}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500/50"
                    >
                      {STRATEGY_CONT_OPTIONS.map(opt => (
                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">우선순위</p>
                        <select
                          value={newStrat.priority}
                          onChange={e => setNewStrat(p => ({ ...p, priority: e.target.value }))}
                          className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-2 text-xs text-white focus:outline-none focus:border-orange-500/50"
                        >
                          {Array.from({ length: strategies.length + 1 }, (_, i) => i + 1).map(n => (
                            <option key={n} value={n}>{n} 순위</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">발동 대기(초)</p>
                        <input
                          type="number"
                          min="0"
                          max="600"
                          step="5"
                          value={newStrat.delay_sec}
                          onChange={e => setNewStrat(p => ({ ...p, delay_sec: e.target.value }))}
                          className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-2 text-xs text-white focus:outline-none focus:border-orange-500/50 font-mono"
                        />
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">최대 발신</p>
                        <input
                          type="number"
                          value={newStrat.max_call_cnt}
                          onChange={e => setNewStrat(p => ({ ...p, max_call_cnt: e.target.value }))}
                          className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-2 text-xs text-white focus:outline-none focus:border-orange-500/50 font-mono"
                        />
                      </div>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">사용 여부</p>
                      <select
                        value={newStrat.use_yn}
                        onChange={e => setNewStrat(p => ({ ...p, use_yn: e.target.value }))}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500/50"
                      >
                        <option value="Y">ACTIVE (사용)</option>
                        <option value="N">INACTIVE (미사용)</option>
                      </select>
                    </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">PDS 발신 유효 조건</p>
                    <div className="flex flex-wrap items-center gap-2">
                      {[
                        { id: 'DAYTIME', label: '주간 (09~18)' },
                        { id: 'WEEKEND', label: '주말 허용' },
                        { id: 'NIGHT_18', label: '야간 (18시~)' },
                        { id: 'NIGHT_19', label: '야간 (19시~)' },
                        { id: 'NIGHT_20', label: '야간 (20시~)' }
                      ].map(cond => {
                        const isChecked = Array.isArray(newStrat.valid_conditions) && newStrat.valid_conditions.includes(cond.id);
                        return (
                          <div
                            key={cond.id}
                            onClick={() => {
                              let newConds = Array.isArray(newStrat.valid_conditions) ? [...newStrat.valid_conditions] : [];
                              if (isChecked) {
                                newConds = newConds.filter(c => c !== cond.id);
                              } else {
                                newConds.push(cond.id);
                              }
                              setNewStrat({ ...newStrat, valid_conditions: newConds });
                            }}
                            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[10px] font-bold cursor-pointer transition-all ${
                              isChecked ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-black/20 border-white/5 text-slate-400'
                            }`}
                          >
                            <div className={`w-2.5 h-2.5 rounded flex items-center justify-center border ${isChecked ? 'bg-emerald-500 border-emerald-500 text-black' : 'border-slate-600'}`}>
                              {isChecked && <Check size={8} strokeWidth={4} />}
                            </div>
                            {cond.label}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <button
                    onClick={handleCreateStrategy}
                    disabled={createLoading}
                    className="w-full py-2.5 rounded-lg text-xs font-black bg-orange-500 text-black flex items-center justify-center gap-1 active:scale-95 disabled:opacity-50"
                  >
                    {createLoading ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                    전략 생성 완료
                  </button>
                </div>
              )}

              {/* 전략 선택 버튼 리스트 */}
              <div className="space-y-2">
                {strategies.length === 0 ? (
                  <p className="text-center text-slate-600 text-xs py-4">전략 없음</p>
                ) : strategies.map(s => (
                  <button key={s.strategy_id} onClick={() => setSelectedSid(s.strategy_id)}
                    className={`w-full text-left px-3.5 py-3 rounded-xl border transition-all active:scale-[0.98] ${selectedSid === s.strategy_id ? 'bg-orange-500/10 border-orange-500/40' : 'bg-white/[0.02] border-white/5'}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-black ${selectedSid === s.strategy_id ? 'text-orange-300' : 'text-slate-300'}`}>[순위: {s.priority ?? s.PRIORITY ?? 99}] {s.strategy_nm}</span>
                      {s.use_yn === 'Y' && <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">활성</span>}
                    </div>
                    <p className="text-[10px] text-slate-600 font-mono mt-0.5">ID: {s.strategy_id}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* 1-b. 선택된 전략 수정 (Rule Setting) */}
        {selectedSid && stratForm && (
          <Card accent="#f59e0b">
            <div className="flex items-center justify-between">
              <CardHeader icon={Zap} title="Rule Setting" sub="현재 전략 상세 수정" color="#f59e0b" />
              {!isEditingStrat ? (
                <button
                  onClick={() => setIsEditingStrat(true)}
                  className="mb-3 flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-black border border-orange-500/30 bg-orange-500/10 text-orange-400 active:scale-95"
                >
                  <Edit3 size={11} /> 수정
                </button>
              ) : (
                <div className="mb-3 flex gap-1.5">
                  <button
                    onClick={() => { setIsEditingStrat(false); setStratForm({ ...strategies.find(s => s.strategy_id === selectedSid) }); }}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-black border border-white/10 bg-white/5 text-slate-400 active:scale-95"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleSaveStrategy}
                    disabled={editLoading}
                    className="px-3 py-1.5 rounded-xl text-xs font-black bg-orange-500 text-black flex items-center gap-1 active:scale-95 disabled:opacity-50"
                  >
                    {editLoading ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />} 저장
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-2 mt-1">
              <div>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">전략 명칭</p>
                {isEditingStrat ? (
                  <input
                    type="text"
                    value={stratForm.strategy_nm}
                    onChange={e => setStratForm(p => ({ ...p, strategy_nm: e.target.value }))}
                    className="w-full bg-black/40 border border-orange-500/20 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500/50"
                  />
                ) : (
                  <p className="text-xs font-bold text-slate-200 px-3 py-2 bg-white/[0.02] border border-white/5 rounded-lg">{stratForm.strategy_nm}</p>
                )}
              </div>

              <div>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">전략 유형 (Rule)</p>
                {isEditingStrat ? (
                  <select
                    value={stratForm.strategy_cont}
                    onChange={e => setStratForm(p => ({ ...p, strategy_cont: e.target.value }))}
                    className="w-full bg-black/40 border border-orange-500/20 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500/50"
                  >
                    {STRATEGY_CONT_OPTIONS.map(opt => (
                      <option key={opt.id} value={opt.id}>{opt.label}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs font-bold text-slate-200 px-3 py-2 bg-white/[0.02] border border-white/5 rounded-lg">
                    {STRATEGY_CONT_OPTIONS.find(o => o.id === stratForm.strategy_cont)?.label || '순차 통화'}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">우선순위</p>
                  {isEditingStrat ? (
                    <select
                      value={stratForm.priority}
                      onChange={e => setStratForm(p => ({ ...p, priority: e.target.value }))}
                      className="w-full bg-black/40 border border-orange-500/20 rounded-lg px-2 py-2 text-xs text-white focus:outline-none focus:border-orange-500/50"
                    >
                      {Array.from({ length: Math.max(1, strategies.length) }, (_, i) => i + 1).map(n => (
                        <option key={n} value={n}>{n} 순위</option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-xs font-bold text-slate-200 px-3 py-2 bg-white/[0.02] border border-white/5 rounded-lg font-mono">{stratForm.priority ?? stratForm.PRIORITY ?? 99} 순위</p>
                  )}
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">대기 (초)</p>
                  {isEditingStrat ? (
                    <input
                      type="number"
                      min="0"
                      max="600"
                      step="5"
                      value={stratForm.delay_sec}
                      onChange={e => setStratForm(p => ({ ...p, delay_sec: e.target.value }))}
                      className="w-full bg-black/40 border border-orange-500/20 rounded-lg px-2 py-2 text-xs text-white focus:outline-none focus:border-orange-500/50 font-mono"
                    />
                  ) : (
                    <p className="text-xs font-bold text-slate-200 px-3 py-2 bg-white/[0.02] border border-white/5 rounded-lg font-mono">{stratForm.delay_sec ?? stratForm.DELAY_SEC ?? 0} 초</p>
                  )}
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">최대 발신</p>
                  {isEditingStrat ? (
                    <input
                      type="number"
                      value={stratForm.max_call_cnt}
                      onChange={e => setStratForm(p => ({ ...p, max_call_cnt: e.target.value }))}
                      className="w-full bg-black/40 border border-orange-500/20 rounded-lg px-2 py-2 text-xs text-white focus:outline-none focus:border-orange-500/50 font-mono"
                    />
                  ) : (
                    <p className="text-xs font-bold text-slate-200 px-3 py-2 bg-white/[0.02] border border-white/5 rounded-lg font-mono">{stratForm.max_call_cnt} 회</p>
                  )}
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">사용 상태</p>
                  {isEditingStrat ? (
                    <select
                      value={stratForm.use_yn}
                      onChange={e => setStratForm(p => ({ ...p, use_yn: e.target.value }))}
                      className="w-full bg-black/40 border border-orange-500/20 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500/50"
                    >
                      <option value="Y">ACTIVE</option>
                      <option value="N">INACTIVE</option>
                    </select>
                  ) : (
                    <p className="text-xs font-bold px-3 py-2 bg-white/[0.02] border border-white/5 rounded-lg">
                      {stratForm.use_yn === 'Y' ? (
                        <span className="text-emerald-400 font-black">ACTIVE</span>
                      ) : (
                        <span className="text-red-400 font-black">INACTIVE</span>
                      )}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">PDS 발신 유효 조건</p>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  {[
                    { id: 'DAYTIME', label: '주간 (09~18)' },
                    { id: 'WEEKEND', label: '주말 허용' },
                    { id: 'NIGHT_18', label: '야간 (18시~)' },
                    { id: 'NIGHT_19', label: '야간 (19시~)' },
                    { id: 'NIGHT_20', label: '야간 (20시~)' }
                  ].map(cond => {
                    const isChecked = Array.isArray(stratForm.valid_conditions) && stratForm.valid_conditions.includes(cond.id);
                    return (
                      <div
                        key={cond.id}
                        onClick={() => {
                          if (!isEditingStrat) return;
                          let newConds = Array.isArray(stratForm.valid_conditions) ? [...stratForm.valid_conditions] : [];
                          if (isChecked) {
                            newConds = newConds.filter(c => c !== cond.id);
                          } else {
                            newConds.push(cond.id);
                          }
                          setStratForm({ ...stratForm, valid_conditions: newConds });
                        }}
                        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[10px] font-bold transition-all ${
                          isEditingStrat ? 'cursor-pointer' : 'cursor-not-allowed opacity-75'
                        } ${isChecked ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-black/20 border-white/5 text-slate-400'}`}
                      >
                        <div className={`w-2.5 h-2.5 rounded flex items-center justify-center border ${isChecked ? 'bg-emerald-500 border-emerald-500 text-black' : 'border-slate-600 bg-transparent'}`}>
                          {isChecked && <Check size={8} strokeWidth={4} />}
                        </div>
                        {cond.label}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </Card>
        )}

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

        {/* 3. 담당자 목록 및 담당자 추가 */}
        {selectedSid && (
          <Card accent="#8b5cf6">
            <div className="flex items-center justify-between">
              <div className="flex-1 cursor-pointer" onClick={() => setTgtOpen(v => !v)}>
                <CardHeader icon={Users} title="담당자 목록" sub="Call Targets" color="#8b5cf6"
                  extra={<span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-purple-500/10 text-purple-400 border border-purple-500/20">{activeTargets.length}명</span>} />
              </div>
              {!isSubstituteType && (
                <button
                  onClick={() => setShowAddTgtForm(v => !v)}
                  className="mb-3 w-8 h-8 rounded-xl flex items-center justify-center bg-purple-500/10 border border-purple-500/30 text-purple-400 hover:bg-purple-500 hover:text-black transition-all active:scale-95"
                  title="담당자 등록"
                >
                  {showAddTgtForm ? <X size={15} /> : <Plus size={15} />}
                </button>
              )}
              <div className="cursor-pointer ml-2 mb-3" onClick={() => setTgtOpen(v => !v)}>
                {tgtOpen ? <ChevronUp size={14} className="text-slate-500 shrink-0 ml-2" /> : <ChevronDown size={14} className="text-slate-500 shrink-0 ml-2" />}
              </div>
            </div>

            {tgtOpen && (
              <div className="mt-1 space-y-3">
                {/* 전략 적용 여부 상태 바 */}
                {stratForm && (
                  <div className={`p-2.5 rounded-xl border flex items-center justify-between transition-all text-[10px] ${
                    strategyStatus.active 
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                      : 'bg-red-500/10 border-red-500/20 text-red-400'
                  }`}>
                    <div className="flex items-center gap-1.5">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                          strategyStatus.active ? 'bg-emerald-400' : 'bg-red-400'
                        }`}></span>
                        <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                          strategyStatus.active ? 'bg-emerald-500' : 'bg-red-500'
                        }`}></span>
                      </span>
                      <span className="font-black uppercase">
                        {strategyStatus.active ? '적용 중 (Active)' : '미적용 (Inactive)'}
                      </span>
                    </div>
                    <span className="font-bold opacity-80">{strategyStatus.reason}</span>
                  </div>
                )}

                {/* 담당자 추가 폼 (대직자 발신 유형이 아닐 때만 허용) */}
                {!isSubstituteType && showAddTgtForm && (
                  <div className="p-3.5 rounded-xl bg-purple-500/5 border border-purple-500/20 space-y-3">
                    <p className="text-xs font-black text-purple-400">새 담당자 등록</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">사번</p>
                        <input
                          type="text"
                          value={newTgt.emp_id}
                          onChange={e => setNewTgt(p => ({ ...p, emp_id: e.target.value }))}
                          placeholder="사번 입력"
                          className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500/50 font-mono"
                        />
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">성명</p>
                        <input
                          type="text"
                          value={newTgt.emp_nm}
                          onChange={e => setNewTgt(p => ({ ...p, emp_nm: e.target.value }))}
                          placeholder="홍길동"
                          className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500/50"
                        />
                      </div>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">휴대번호</p>
                      <input
                        type="tel"
                        value={newTgt.mobile_no}
                        onChange={e => setNewTgt(p => ({ ...p, mobile_no: e.target.value }))}
                        placeholder="01012345678"
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500/50 font-mono"
                      />
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">정렬 순서</p>
                      <input
                        type="number"
                        value={newTgt.sort_ord}
                        onChange={e => setNewTgt(p => ({ ...p, sort_ord: e.target.value }))}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500/50 font-mono"
                      />
                    </div>
                    <button
                      onClick={handleAddTarget}
                      disabled={addTgtLoading}
                      className="w-full py-2.5 rounded-lg text-xs font-black bg-purple-500 text-white flex items-center justify-center gap-1 active:scale-95 disabled:opacity-50"
                    >
                      {addTgtLoading ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                      담당자 등록 완료
                    </button>
                  </div>
                )}

                {/* 담당자 리스트 */}
                {tgtLoading ? (
                  <div className="flex items-center justify-center py-8"><Loader2 size={18} className="animate-spin text-slate-600" /></div>
                ) : activeTargets.length === 0 ? (
                  <div className="text-center py-8"><PhoneOff size={24} className="mx-auto text-slate-700 mb-2" /><p className="text-xs text-slate-600">등록된 담당자 없음</p></div>
                ) : (
                  <div className="space-y-2">
                    {activeTargets.map((t, i) => (
                      <div key={t.seq_no || i} className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-white/[0.02] border border-white/5">
                        <div className="w-8 h-8 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
                          <span className="text-[11px] font-black text-purple-400">{i + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-black text-slate-200 truncate">{t.emp_nm || t.EMP_NM}</p>
                            {isSubstituteType && (
                              <span className="text-[8px] font-black text-cyan-400 bg-cyan-400/10 border border-cyan-400/20 rounded px-1.5 py-0.5">대직자</span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 font-mono">{t.mobile_no || t.MOBILE_NO}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-slate-600 font-mono">{t.emp_id || t.EMP_ID}</span>
                          {!isSubstituteType && (
                            <button
                              onClick={() => handleDeleteTarget(t.seq_no || t.SEQ_NO)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center bg-red-500/10 border border-red-500/20 text-red-400 active:scale-90"
                              title="삭제"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>
        )}

        {/* 3-b. 발신자 목록 (push_subscriptions) */}
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
              ) : pushDevices.map((dev) => (
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
                        <p className="text-xs font-black text-slate-200">
                          {evt.emp_nm || evt.EMP_NM ? `${evt.emp_nm || evt.EMP_NM} (${evt.EMPLOYEE_ID})` : evt.EMPLOYEE_ID}
                        </p>
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

      </div>
    </div>
  );
}
