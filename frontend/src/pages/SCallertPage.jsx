import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBackNavigation } from '../hooks/useBackNavigation';
import {
  ArrowLeft, Phone, Users, Activity, RefreshCw,
  Plus, Trash2, Edit3, Check, X, Save,
  ChevronDown, Zap, Clock, AlertCircle,
  CheckCircle2, PhoneOff, PhoneMissed, Loader2,
  Settings, Play, Terminal, Globe, Key, Timer,
  ChevronUp, Copy, CheckCheck, Smartphone
} from 'lucide-react';
import { getAuthHeaders, getUserProfile } from '../lib/authStore';
import { SMS_WORKER_URL } from '../config/api';

const API_BASE = SMS_WORKER_URL || 'https://sguardai.khcho0421.workers.dev';

// ─── 전략 유형 옵션 ──────────────────────────────────────────
const STRATEGY_CONT_OPTIONS = [
  { id: '1', label: '메시지 수신자별 순차 통화' },
  { id: '2', label: '메시지 수신자 및 AA, 파트장' },
  { id: '3', label: '메시지 수신자의 파트 전원' },
];

// ─── PDS 결과 코드 배지 ────────────────────────────────────────
function PdsBadge({ code }) {
  const map = {
    SUCCESS:  { label: '성공',   cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
    FAIL:     { label: '실패',   cls: 'bg-red-500/15 text-red-400 border-red-500/30' },
    BUSY:     { label: '통화중', cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
    NOANSWER: { label: '무응답', cls: 'bg-slate-500/15 text-slate-400 border-slate-500/30' },
    PENDING:  { label: '대기',   cls: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  };
  const { label, cls } = map[code] || { label: code || '-', cls: 'bg-white/5 text-slate-500 border-white/10' };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-wider ${cls}`}>
      {label}
    </span>
  );
}

// ─── 인라인 입력 셀 ──────────────────────────────────────────
function InlineInput({ value, onChange, placeholder, className = '' }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`bg-transparent border-b border-blue-500/40 focus:border-blue-400 focus:outline-none text-sm text-white placeholder-slate-600 py-0.5 w-full font-mono ${className}`}
    />
  );
}

// ─── 섹션 헤더 ───────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, sub, color, children }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${color}20`, border: `1px solid ${color}40` }}>
          <Icon size={15} color={color} />
        </div>
        <div>
          <p className="text-sm font-black text-white">{title}</p>
          <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color }}>{sub}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
export default function SCallertPage() {
  const navigate = useNavigate();
  const goBack = useBackNavigation('/dashboard');
  const userProfile = getUserProfile();

  // ── 전략 마스터 ─────────────────────────────────
  const [strategies, setStrategies]       = useState([]);
  const [selectedSid, setSelectedSid]     = useState('');
  const [ruleForm, setRuleForm]           = useState(null);
  const [ruleEditing, setRuleEditing]     = useState(false);
  const [ruleSaving, setRuleSaving]       = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newStrategy, setNewStrategy]     = useState({
    strategy_nm: '',
    strategy_cont: '1',
    apply_start_dt: new Date().toISOString().slice(0, 16), // YYYY-MM-DDTHH:mm
    apply_end_dt: '2099-12-31T23:59',
    max_call_cnt: 3,
  });

  // ── 담당자 목록 ─────────────────────────────────
  const [targets, setTargets]             = useState([]);
  const [tgtLoading, setTgtLoading]       = useState(false);
  const [editRow, setEditRow]             = useState(null);   // { idx, ...fields }
  const [addRow, setAddRow]               = useState(null);   // { emp_id, emp_nm, mobile_no }

  // ── 발신 이력 ────────────────────────────────────
  const [hists, setHists]                 = useState([]);
  const [histLoading, setHistLoading]     = useState(false);
  const pollRef                           = useRef(null);

  // ── 전략 목록 로드 ───────────────────────────────────────
  const fetchStrategies = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/scallert/strategies`, { headers: getAuthHeaders() });
      if (!r.ok) return null;
      const data = await r.json();
      const list = (data.strategies || data || []).map(s => ({
        ...s,
        // 소문자 정규화 (DB는 대문자 컴럼명)
        strategy_id:   s.strategy_id   || s.STRATEGY_ID,
        strategy_nm:   s.strategy_nm   || s.STRATEGY_NM,
        strategy_cont: s.strategy_cont || s.STRATEGY_CONT,
        apply_start_dt: s.apply_start_dt || s.APPLY_START_DT,
        apply_end_dt:   s.apply_end_dt   || s.APPLY_END_DT,
        max_call_cnt:   s.max_call_cnt   || s.MAX_CALL_CNT,
        use_yn:         s.use_yn         || s.USE_YN,
      }));
      setStrategies(list);
      return list;
    } catch (e) { console.error(e); return null; }
  }, []);

  // ── PDS API 설정 ──────────────────────────────────
  const [pdsConfig, setPdsConfig]         = useState({
    api_url: 'https://fcm.googleapis.com/fcm/send',
    api_method: 'POST',
    api_headers: {
      'TTL': '60',
      'Urgency': 'high',
      'Authorization': 'vapid t=<JWT_TOKEN>, k=BG_0lRtHOt0V6Q7cxfS9l6jIGFY3MIJHdKz4kdtQyR-WkVq61LE316pLJghlKKP_tpxW2dec1ZLS2aFYLhJbASY',
      'Crypto-Key': 'p256ecdsa=BG_0lRtHOt0V6Q7cxfS9l6jIGFY3MIJHdKz4kdtQyR-WkVq61LE316pLJghlKKP_tpxW2dec1ZLS2aFYLhJbASY'
    },
    api_params: {
      data: {
        action: 'CALL',
        phone_number: '01012345678'
      }
    },
    timeout_sec: 10
  });
  const [cfgEditing, setCfgEditing]       = useState(false);
  const [cfgSaving, setCfgSaving]         = useState(false);
  const [testLogs, setTestLogs]           = useState([]);
  const [testLoading, setTestLoading]     = useState(false);
  const [lastTestResult, setLastTestResult] = useState(null);
  const [logExpanded, setLogExpanded]     = useState(true);
  const [copiedLog, setCopiedLog]         = useState(null);
  const [cfgHeaderRows, setCfgHeaderRows] = useState([
    { key: 'TTL', val: '60' },
    { key: 'Urgency', val: 'high' },
    { key: 'Authorization', val: 'vapid t=<JWT_TOKEN>, k=BG_0lRtHOt0V6Q7cxfS9l6jIGFY3MIJHdKz4kdtQyR-WkVq61LE316pLJghlKKP_tpxW2dec1ZLS2aFYLhJbASY' },
    { key: 'Crypto-Key', val: 'p256ecdsa=BG_0lRtHOt0V6Q7cxfS9l6jIGFY3MIJHdKz4kdtQyR-WkVq61LE316pLJghlKKP_tpxW2dec1ZLS2aFYLhJbASY' }
  ]);
  const [cfgBodyText, setCfgBodyText]     = useState(JSON.stringify({
    data: {
      action: 'CALL',
      phone_number: '01012345678'
    }
  }, null, 2));

  // ── 앱 Webhook 및 테스트 수신 관련 ────────────────
  const [appEvents, setAppEvents]         = useState([]);
  const [appEventsLoading, setAppEventsLoading] = useState(false);
  const [autoRefreshEvents, setAutoRefreshEvents] = useState(true);
  const [testPhoneNumber, setTestPhoneNumber] = useState('01012345678');
  // Mock Webhook 발송용 임시 state
  const [mockEmpId, setMockEmpId]         = useState('12345');
  const [mockPhone, setMockPhone]         = useState('01012345678');
  const [mockSending, setMockSending]     = useState(false);
  const [filterCurrentTargets, setFilterCurrentTargets] = useState(false);

  // ── 등록 기기 정보 관련 ────────────────────────
  const [pushDevices, setPushDevices]     = useState([]);
  const [selectedDeviceUid, setSelectedDeviceUid] = useState('');


  // ── 담당자 목록 로드 ─────────────────────────────
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

  const fetchAppEvents = useCallback(async () => {
    setAppEventsLoading(true);
    try {
      const r = await fetch(`${API_BASE}/scallert/app-events?limit=50`, { headers: getAuthHeaders() });
      const data = await r.json();
      setAppEvents(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to fetch app events:', e);
    } finally {
      setAppEventsLoading(false);
    }
  }, []);

  const fetchPushDevices = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/scallert/push-devices`, { headers: getAuthHeaders() });
      const data = await r.json();
      const list = Array.isArray(data) ? data : [];
      setPushDevices(list);
      if (list.length > 0 && !selectedDeviceUid) {
        const defaultDevice = list.find(dev => dev.emp_nm === '조경훈') || list[0];
        setSelectedDeviceUid(defaultDevice.user_id);
      }
    } catch (e) {
      console.error('Failed to fetch push devices:', e);
    }
  }, [selectedDeviceUid]);

  const handleSendMockEvent = async (type) => {
    setMockSending(true);
    try {
      const payload = {
        employee_id: mockEmpId,
        phone_number: mockPhone,
        event_type: type,
        timestamp: Date.now()
      };
      const r = await fetch(`${API_BASE}/call/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (r.ok) {
        await fetchAppEvents();
      } else {
        alert('Mock Webhook 발송 실패');
      }
    } catch (e) {
      alert('오류: ' + e.message);
    } finally {
      setMockSending(false);
    }
  };

  useEffect(() => {
    fetchAppEvents();
    fetchPushDevices();
  }, [fetchAppEvents, fetchPushDevices]);

  useEffect(() => {
    if (!autoRefreshEvents) return;
    const timer = setInterval(() => {
      fetchAppEvents();
    }, 5000);
    return () => clearInterval(timer);
  }, [autoRefreshEvents, fetchAppEvents]);

  // ── 발신 이력 로드 ───────────────────────────────
  const fetchHists = useCallback(async (sid) => {
    if (!sid) return;
    setHistLoading(true);
    try {
      const r = await fetch(`${API_BASE}/scallert/strategies/${sid}/history?limit=30`, { headers: getAuthHeaders() });
      const data = await r.json();
      setHists(data.history || data || []);
    } catch (e) { console.error(e); }
    finally { setHistLoading(false); }
  }, []);

  // ── PDS Config 로드 ──────────────────────────────
  const fetchPdsConfig = useCallback(async (sid) => {
    if (!sid) return;
    try {
      const r = await fetch(`${API_BASE}/scallert/strategies/${sid}/config`, { headers: getAuthHeaders() });
      const data = await r.json();
      if (data && !data.error && data.API_URL) {
        const headers = typeof data.API_HEADERS === 'string' ? JSON.parse(data.API_HEADERS || '{}') : (data.API_HEADERS || {});
        const params  = typeof data.API_PARAMS  === 'string' ? JSON.parse(data.API_PARAMS  || '{}') : (data.API_PARAMS  || {});
        setPdsConfig({ api_url: data.API_URL, api_method: data.API_METHOD || 'POST', api_headers: headers, api_params: params, timeout_sec: data.TIMEOUT_SEC || 10 });
        setCfgHeaderRows(Object.entries(headers).length ? Object.entries(headers).map(([k,v])=>({key:k,val:v})) : [{key:'',val:''}]);
        setCfgBodyText(JSON.stringify(params, null, 2));
      } else {
        // Fallback to default template (FCM) when no configuration is stored
        setPdsConfig({
          api_url: 'https://fcm.googleapis.com/fcm/send',
          api_method: 'POST',
          api_headers: {
            'TTL': '60',
            'Urgency': 'high',
            'Authorization': 'vapid t=<JWT_TOKEN>, k=BG_0lRtHOt0V6Q7cxfS9l6jIGFY3MIJHdKz4kdtQyR-WkVq61LE316pLJghlKKP_tpxW2dec1ZLS2aFYLhJbASY',
            'Crypto-Key': 'p256ecdsa=BG_0lRtHOt0V6Q7cxfS9l6jIGFY3MIJHdKz4kdtQyR-WkVq61LE316pLJghlKKP_tpxW2dec1ZLS2aFYLhJbASY'
          },
          api_params: {
            data: {
              action: 'CALL',
              phone_number: '01012345678'
            }
          },
          timeout_sec: 10
        });
        setCfgHeaderRows([
          { key: 'TTL', val: '60' },
          { key: 'Urgency', val: 'high' },
          { key: 'Authorization', val: 'vapid t=<JWT_TOKEN>, k=BG_0lRtHOt0V6Q7cxfS9l6jIGFY3MIJHdKz4kdtQyR-WkVq61LE316pLJghlKKP_tpxW2dec1ZLS2aFYLhJbASY' },
          { key: 'Crypto-Key', val: 'p256ecdsa=BG_0lRtHOt0V6Q7cxfS9l6jIGFY3MIJHdKz4kdtQyR-WkVq61LE316pLJghlKKP_tpxW2dec1ZLS2aFYLhJbASY' }
        ]);
        setCfgBodyText(JSON.stringify({
          data: {
            action: 'CALL',
            phone_number: '01012345678'
          }
        }, null, 2));
      }
    } catch {
      // Fallback in case of network/fetch errors
      setPdsConfig({
        api_url: 'https://fcm.googleapis.com/fcm/send',
        api_method: 'POST',
        api_headers: {
          'TTL': '60',
          'Urgency': 'high',
          'Authorization': 'vapid t=<JWT_TOKEN>, k=BG_0lRtHOt0V6Q7cxfS9l6jIGFY3MIJHdKz4kdtQyR-WkVq61LE316pLJghlKKP_tpxW2dec1ZLS2aFYLhJbASY',
          'Crypto-Key': 'p256ecdsa=BG_0lRtHOt0V6Q7cxfS9l6jIGFY3MIJHdKz4kdtQyR-WkVq61LE316pLJghlKKP_tpxW2dec1ZLS2aFYLhJbASY'
        },
        api_params: {
          data: {
            action: 'CALL',
            phone_number: '01012345678'
          }
        },
        timeout_sec: 10
      });
      setCfgHeaderRows([
        { key: 'TTL', val: '60' },
        { key: 'Urgency', val: 'high' },
        { key: 'Authorization', val: 'vapid t=<JWT_TOKEN>, k=BG_0lRtHOt0V6Q7cxfS9l6jIGFY3MIJHdKz4kdtQyR-WkVq61LE316pLJghlKKP_tpxW2dec1ZLS2aFYLhJbASY' },
        { key: 'Crypto-Key', val: 'p256ecdsa=BG_0lRtHOt0V6Q7cxfS9l6jIGFY3MIJHdKz4kdtQyR-WkVq61LE316pLJghlKKP_tpxW2dec1ZLS2aFYLhJbASY' }
      ]);
      setCfgBodyText(JSON.stringify({
        data: {
          action: 'CALL',
          phone_number: '01012345678'
        }
      }, null, 2));
    }
  }, []);

  const fetchTestLogs = useCallback(async (sid) => {
    if (!sid) return;
    try {
      const r = await fetch(`${API_BASE}/scallert/strategies/${sid}/test-logs?limit=20`, { headers: getAuthHeaders() });
      const data = await r.json();
      setTestLogs(Array.isArray(data) ? data : []);
    } catch {}
  }, []);

  // ── 초기 로드: 화면 진입 시 첣 번째 전략 자동 선택 ───────────
  useEffect(() => {
    fetchStrategies().then(list => {
      if (list && list.length > 0 && !selectedSid) {
        setSelectedSid(list[0].strategy_id);
      }
    });
  }, []);

  useEffect(() => {
    if (!selectedSid) return;
    const s = strategies.find(s => s.strategy_id === selectedSid);
    if (s) setRuleForm({ ...s });
    setRuleEditing(false);
    fetchTargets(selectedSid);
    fetchHists(selectedSid);
    fetchPdsConfig(selectedSid);
    fetchTestLogs(selectedSid);

    // 30초 폴링 (발신 이력 실시간 갱신)
    clearInterval(pollRef.current);
    pollRef.current = setInterval(() => fetchHists(selectedSid), 30000);
    return () => clearInterval(pollRef.current);
  }, [selectedSid, strategies.length]);

  // ── Rule Save ────────────────────────────────────
  const handleRuleSave = async () => {
    if (!ruleForm) return;
    setRuleSaving(true);
    try {
      const r = await fetch(`${API_BASE}/scallert/strategies/${selectedSid}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          strategy_nm:    ruleForm.strategy_nm,
          strategy_cont:  ruleForm.strategy_cont,
          apply_start_dt: ruleForm.apply_start_dt,
          apply_end_dt:   ruleForm.apply_end_dt,
          max_call_cnt:   Number(ruleForm.max_call_cnt),
          use_yn:         ruleForm.use_yn,
          mod_id:         userProfile?.employee_id || 'SYSTEM',
        }),
      });
      if (r.ok) { 
        setRuleEditing(false); 
        await fetchStrategies(); 
        alert('전략 설정이 저장되었습니다.');
      }
      else {
        const err = await r.json();
        alert(`저장에 실패했습니다: ${err.error || '알 수 없는 오류'}`);
      }
    } catch (e) { 
      console.error(e); 
      alert('네트워크 오류가 발생했습니다.');
    }
    finally { setRuleSaving(false); }
  };

  // ── Strategy Create ──────────────────────────────
  const handleCreateStrategy = async () => {
    if (!newStrategy.strategy_nm) {
      alert('전략명을 입력해 주세요.');
      return;
    }
    try {
      const r = await fetch(`${API_BASE}/scallert/strategies`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...newStrategy,
          reg_id: userProfile?.employee_id || 'SYSTEM'
        }),
      });
      if (r.ok) {
        const data = await r.json();
        setShowCreateModal(false);
        setNewStrategy({
          strategy_nm: '',
          strategy_cont: '1',
          apply_start_dt: new Date().toISOString().slice(0, 16),
          apply_end_dt: '2099-12-31T23:59',
          max_call_cnt: 3,
        });
        // 목록 재조회 후 신규 전략으로 자동 선택 (Rule Setting 자동 표시)
        const newId = data.strategy_id || data.STRATEGY_ID;
        const list = await fetchStrategies();
        if (newId) setSelectedSid(newId);
        else if (list && list.length > 0) setSelectedSid(list[list.length - 1].strategy_id);
        alert('새로운 전략이 등록되었습니다.');
      } else {
        alert('전략 등록에 실패했습니다.');
      }
    } catch (e) {
      console.error(e);
      alert('네트워크 오류가 발생했습니다.');
    }
  };

  // ── Target CRUD ──────────────────────────────────
  const handleTargetSave = async (row) => {
    if (!row.emp_id || !row.emp_nm || !row.mobile_no) {
      alert('사번, 성명, 휴대번호는 필수입니다.');
      return;
    }
    const isNew = row.seq_no === undefined;
    const url   = isNew
      ? `${API_BASE}/scallert/strategies/${selectedSid}/targets`
      : `${API_BASE}/scallert/targets/${row.seq_no}`;
    const method = isNew ? 'POST' : 'PATCH';

    try {
      const r = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify({ ...row, mod_id: userProfile?.employee_id || 'SYSTEM' }),
      });
      if (r.ok) {
        setEditRow(null); setAddRow(null);
        fetchTargets(selectedSid);
      } else alert('저장에 실패했습니다.');
    } catch (e) { console.error(e); }
  };

  const handleTargetDelete = async (seq_no) => {
    if (!window.confirm('담당자를 삭제하시겠습니까?')) return;
    try {
      const r = await fetch(`${API_BASE}/scallert/targets/${seq_no}`, {
        method: 'DELETE', headers: getAuthHeaders(),
      });
      if (r.ok) fetchTargets(selectedSid);
      else alert('삭제에 실패했습니다.');
    } catch (e) { console.error(e); }
  };

  const currentStrategy = strategies.find(s => s.strategy_id === selectedSid);

  // ── 템플릿 선택 적용 ──────────────────────────────
  const applyPresetTemplate = (type) => {
    if (type === 'fcm_webpush') {
      setPdsConfig(p => ({
        ...p,
        api_url: `${API_BASE}/scallert/test-push`,
        api_method: 'POST',
        timeout_sec: 10
      }));
      setCfgHeaderRows([
        { key: 'Content-Type', val: 'application/json' }
      ]);
      setCfgBodyText(JSON.stringify({
        target_user_id: "DEVICE_TOKEN",
        phone_number: "01012345678"
      }, null, 2));
    } else if (type === 'standard_pds') {
      setPdsConfig(p => ({
        ...p,
        api_url: 'https://api.sguard.com/pds/call',
        api_method: 'POST',
        timeout_sec: 10
      }));
      setCfgHeaderRows([
        { key: 'Content-Type', val: 'application/json' }
      ]);
      setCfgBodyText(JSON.stringify({
        caller_id: 'SGUARD',
        phone_number: '01012345678',
        message: '장애 상황 통보 전화를 발신합니다.'
      }, null, 2));
    }
  };

  // ── PDS Config 저장 ──────────────────────────────
  const handleCfgSave = async () => {
    let parsedParams = {};
    try {
      parsedParams = JSON.parse(cfgBodyText || '{}');
    } catch (e) {
      alert('JSON Body 형식이 올바르지 않습니다: ' + e.message);
      return;
    }

    setCfgSaving(true);
    try {
      const headers = {}; cfgHeaderRows.filter(r=>r.key).forEach(r=>headers[r.key]=r.val);
      const body = { ...pdsConfig, api_headers: headers, api_params: parsedParams, reg_id: userProfile?.employee_id||'SYSTEM' };
      const r = await fetch(`${API_BASE}/scallert/strategies/${selectedSid}/config`, { method:'POST', headers: getAuthHeaders(), body: JSON.stringify(body) });
      if (r.ok) { setCfgEditing(false); alert('API 설정이 저장되었습니다.'); }
      else { const e = await r.json(); alert('저장 실패: ' + (e.error||'')); }
    } catch (e) { alert('오류: ' + e.message); }
    finally { setCfgSaving(false); }
  };

  // ── 테스트 콜 실행 ────────────────────────────────
  const handleTestCall = async () => {
    let parsedParams = {};
    try {
      parsedParams = JSON.parse(cfgBodyText || '{}');
    } catch (e) {
      alert('JSON Body 형식이 올바르지 않습니다: ' + e.message);
      return;
    }

    // 테스트용 전화번호 동적 주입
    if (parsedParams && parsedParams.data) {
      parsedParams.data.phone_number = testPhoneNumber;
    } else {
      parsedParams.phone_number = testPhoneNumber;
    }

    setTestLoading(true); setLastTestResult(null);
    try {
      const headers = {}; cfgHeaderRows.filter(r=>r.key).forEach(r=>headers[r.key]=r.val);
      const body = { ...pdsConfig, api_headers: headers, api_params: parsedParams, tested_by: userProfile?.employee_id||'SYSTEM' };
      const r = await fetch(`${API_BASE}/scallert/strategies/${selectedSid}/test-call`, { method:'POST', headers: getAuthHeaders(), body: JSON.stringify(body) });
      const data = await r.json();
      setLastTestResult(data);
      await fetchTestLogs(selectedSid);
    } catch (e) { setLastTestResult({ success: false, response: e.message, elapsed_ms: 0 }); }
    finally { setTestLoading(false); }
  };

  const handlePushTestCall = async () => {
    if (!selectedDeviceUid) {
      alert('발신할 기기(사번)를 선택해주세요.');
      return;
    }
    setTestLoading(true); setLastTestResult(null);
    try {
      const r = await fetch(`${API_BASE}/scallert/test-push`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          target_user_id: selectedDeviceUid,
          phone_number: testPhoneNumber
        })
      });
      const data = await r.json();
      setLastTestResult({
        success: data.success,
        response: JSON.stringify(data.results),
        elapsed_ms: 0
      });
      await fetchTestLogs(selectedSid);
      alert('기기 푸시 발신 명령을 성공적으로 전송했습니다.');
    } catch (e) {
      setLastTestResult({ success: false, response: e.message, elapsed_ms: 0 });
      alert('오류: ' + e.message);
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div
      className="text-white font-sans flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(160deg,#04070f 0%,#070b18 60%,#04070f 100%)', height: '100dvh' }}
    >
      {/* 배경 그로우 */}
      <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-orange-600/5 blur-[160px] rounded-full -z-10 pointer-events-none" />
      <div className="fixed bottom-0 left-0  w-[400px] h-[400px] bg-red-600/5   blur-[120px] rounded-full -z-10 pointer-events-none" />

      {/* ── 헤더 ───────────────────────────────────── */}
      <header className="sticky top-0 z-50 backdrop-blur-2xl border-b" style={{ background: 'rgba(4,7,15,0.94)', borderColor: 'rgba(251,146,60,0.15)' }}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => goBack()}
              style={{ width:36, height:36, borderRadius:10, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}
            >
              <ArrowLeft className="w-4 h-4 text-slate-400" />
            </button>
            <div className="shrink-0">
              <div className="flex items-center gap-2">
                <Phone size={14} color="#fb923c" />
                <h1 className="text-base font-black tracking-tight whitespace-nowrap" style={{ background:'linear-gradient(90deg,#f1f5f9,#fb923c)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
                  S-callert
                </h1>
              </div>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color:'rgba(251,146,60,0.6)' }}>
                PDS 자동호출관리
              </p>
            </div>
          </div>
          {/* 전략 선택기 및 추가 버튼 */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                value={selectedSid}
                onChange={e => setSelectedSid(e.target.value)}
                className="appearance-none bg-[#0f1420] border border-orange-500/20 text-orange-300 text-xs font-black rounded-xl px-3 py-2.5 pr-7 focus:outline-none focus:border-orange-500/50 cursor-pointer shadow-[0_0_15px_rgba(251,146,60,0.05)] max-w-[130px] truncate"
              >
                {strategies.length === 0
                  ? <option value="">전략 없음</option>
                  : strategies.map(s => (
                      <option key={s.strategy_id} value={s.strategy_id}>{s.strategy_nm}</option>
                    ))
                }
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-orange-400 pointer-events-none" />
            </div>
            
            <button
              onClick={() => setShowCreateModal(true)}
              className="w-[38px] h-[38px] rounded-xl flex items-center justify-center bg-orange-500/10 border border-orange-500/30 text-orange-400 hover:bg-orange-500 hover:text-black transition-all shadow-[0_0_15px_rgba(251,146,60,0.1)] active:scale-95"
              title="새 전략 추가"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto w-full px-4 lg:px-6 2xl:px-8 py-6 pb-24 mx-auto max-w-[2000px]">
  <div className="flex flex-col xl:flex-row gap-6 items-start">
    {/* Left Column: Rule & PDS */}
    <div className="w-full xl:w-7/12 flex flex-col gap-6">

        {/* ════════════════════════════════════════════
            1️⃣  RULE SETTING
        ════════════════════════════════════════════ */}
        <section className={`relative group transition-all duration-500 rounded-[2rem] overflow-hidden border ${ruleEditing ? 'border-orange-500/40 bg-orange-500/5 shadow-[0_0_40px_rgba(251,146,60,0.1)]' : 'border-white/5 bg-[#0c1020]/60'} backdrop-blur-xl`}>
          <div className="absolute inset-0 bg-gradient-to-br from-orange-600/[0.03] to-transparent pointer-events-none" />
          
          <div className="p-6 relative z-10">
            <SectionHeader icon={Zap} title="Rule Setting" sub="Strategy Master Config" color="#fb923c">
              {ruleForm && (
                !ruleEditing ? (
                  <button
                    onClick={() => setRuleEditing(true)}
                    className="group/btn flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black border border-orange-500/30 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 hover:border-orange-500/50 transition-all active:scale-95 shadow-[0_0_15px_rgba(251,146,60,0.1)] whitespace-nowrap"
                  >
                    <Edit3 size={14} className="group-hover/btn:rotate-12 transition-transform" /> 
                    <span>전략 수정</span>
                  </button>
                ) : (
                  <div className="flex gap-2.5">
                    <button 
                      onClick={() => { setRuleEditing(false); setRuleForm(currentStrategy ? { ...currentStrategy } : null); }}
                      className="px-4 py-2 rounded-xl text-xs font-black border border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 transition-all flex items-center gap-2 whitespace-nowrap"
                    >
                      <X size={14} /> 취소
                    </button>
                    <button 
                      onClick={handleRuleSave} 
                      disabled={ruleSaving}
                      className="px-5 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-orange-500 to-amber-500 text-black hover:from-orange-400 hover:to-amber-400 transition-all flex items-center gap-2 disabled:opacity-60 shadow-[0_0_20px_rgba(251,146,60,0.3)] active:scale-95 whitespace-nowrap"
                    >
                      {ruleSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} 
                      <span>변경사항 저장</span>
                    </button>
                  </div>
                )
              )}
            </SectionHeader>

            {ruleForm ? (
              <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mt-4">
                {/* 전략 명칭 (Full width on mobile, 2 cols on desktop) */}
                <div className="md:col-span-2 space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 size={10} className="text-orange-500/60" />
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">전략 명칭</p>
                  </div>
                  {ruleEditing ? (
                    <div className="relative">
                      <input
                        type="text"
                        value={ruleForm.strategy_nm || ''}
                        onChange={e => setRuleForm(p => ({ ...p, strategy_nm: e.target.value }))}
                        className="w-full bg-[#0a0e1a]/80 border border-orange-500/20 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/30 transition-all placeholder:text-slate-700"
                        placeholder="전략 이름을 입력하세요"
                      />
                      <div className="absolute bottom-0 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-orange-500/20 to-transparent" />
                    </div>
                  ) : (
                    <div className="px-4 py-3 rounded-xl bg-white/[0.03] border border-white/5">
                      <p className="text-sm font-black text-white">{ruleForm.strategy_nm || '-'}</p>
                    </div>
                  )}
                </div>

                {/* 전략 내용 (유형 선택) */}
                <div className="md:col-span-2 space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <Zap size={10} className="text-purple-500/60" />
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">전략 내용 (유형)</p>
                  </div>
                  {ruleEditing ? (
                    <select
                      value={ruleForm.strategy_cont || '1'}
                      onChange={e => setRuleForm(p => ({ ...p, strategy_cont: e.target.value }))}
                      className="w-full bg-[#0a0e1a]/80 border border-purple-500/20 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500/60 transition-all"
                    >
                      {STRATEGY_CONT_OPTIONS.map(opt => (
                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="px-4 py-3 rounded-xl bg-purple-500/5 border border-purple-500/10">
                      <p className="text-sm font-bold text-purple-300">
                        {STRATEGY_CONT_OPTIONS.find(o => o.id === ruleForm.strategy_cont)?.label || '순차 통화'}
                      </p>
                    </div>
                  )}
                </div>

                {/* 발신 횟수 */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Activity size={10} className="text-amber-500/60" />
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">최대 발신</p>
                  </div>
                  {ruleEditing ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={ruleForm.max_call_cnt || ''}
                        onChange={e => setRuleForm(p => ({ ...p, max_call_cnt: e.target.value }))}
                        className="w-full bg-[#0a0e1a]/80 border border-amber-500/20 rounded-xl px-4 py-3 text-sm text-amber-400 font-black focus:outline-none focus:border-amber-500/60 transition-all font-mono"
                      />
                      <span className="text-[10px] font-bold text-slate-600 whitespace-nowrap">회</span>
                    </div>
                  ) : (
                    <div className="px-4 py-3 rounded-xl bg-amber-500/5 border border-amber-500/10 flex items-center justify-between">
                      <span className="text-sm font-black text-amber-400 font-mono">{ruleForm.max_call_cnt}</span>
                      <span className="text-[10px] font-bold text-amber-500/40 uppercase">Times</span>
                    </div>
                  )}
                </div>

                {/* 기간 설정 (Date Range) */}
                <div className="md:col-span-4 space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock size={10} className="text-blue-500/60" />
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">유효 기간 (Start ~ End)</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {ruleEditing ? (
                      <>
                        <input
                          type="datetime-local"
                          value={ruleForm.apply_start_dt || ''}
                          onChange={e => setRuleForm(p => ({ ...p, apply_start_dt: e.target.value }))}
                          className="flex-1 bg-[#0a0e1a]/80 border border-blue-500/20 rounded-xl px-3 py-3 text-[11px] text-white focus:outline-none focus:border-blue-500/50 transition-all font-mono"
                        />
                        <span className="text-slate-600">~</span>
                        <input
                          type="datetime-local"
                          value={ruleForm.apply_end_dt || ''}
                          onChange={e => setRuleForm(p => ({ ...p, apply_end_dt: e.target.value }))}
                          className="flex-1 bg-[#0a0e1a]/80 border border-blue-500/20 rounded-xl px-3 py-3 text-[11px] text-white focus:outline-none focus:border-blue-500/50 transition-all font-mono"
                        />
                      </>
                    ) : (
                      <div className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.03] border border-white/5 font-mono text-[11px] font-bold text-slate-300">
                        <span>{ruleForm.apply_start_dt?.replace('T', ' ') || '∞'}</span>
                        <span className="mx-2 text-slate-600">→</span>
                        <span>{ruleForm.apply_end_dt?.replace('T', ' ') || '∞'}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 gap-4 text-slate-600 bg-white/[0.02] rounded-3xl border border-dashed border-white/5 mt-4">
                <AlertCircle size={32} className="opacity-20 text-orange-500" />
                <div className="text-center">
                  <p className="text-sm font-black text-white uppercase tracking-widest">등록된 전략이 없습니다</p>
                  <p className="text-[10px] font-medium text-slate-500 mt-1">상단 바의 명령어를 통해 초기 데이터를 생성해 주세요.</p>
                </div>
              </div>
            )}

            {/* 하단 상태바 (사용여부 및 Audit) */}
            {ruleForm && (
              <div className="flex flex-wrap items-center justify-between mt-8 pt-6 border-t border-white/5 gap-4">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-600">Status</p>
                    {ruleEditing ? (
                      <div className="flex p-1 bg-black/40 rounded-lg border border-white/5">
                        {['Y', 'N'].map(v => (
                          <button
                            key={v}
                            onClick={() => setRuleForm(p => ({ ...p, use_yn: v }))}
                            className={`px-3 py-1 rounded-md text-[10px] font-black transition-all ${ruleForm.use_yn === v ? 'bg-orange-500 text-black shadow-lg shadow-orange-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                          >
                            {v === 'Y' ? 'ACTIVE' : 'DISABLED'}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-black ${ruleForm.use_yn === 'Y' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${ruleForm.use_yn === 'Y' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                        {ruleForm.use_yn === 'Y' ? 'STRATEGY ACTIVE' : 'STRATEGY INACTIVE'}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-[9px] font-bold text-slate-600 font-mono italic">
                  <span>Last Updated: {ruleForm.mod_dt?.replace('T', ' ').slice(0, 19) || 'Unknown'}</span>
                  <span className="w-[1px] h-3 bg-white/10" />
                  <span>By: {ruleForm.mod_id || 'SYSTEM'}</span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ════════════════════════════════════════════
            3️⃣  PDS API 설정 관리
        ════════════════════════════════════════════ */}
        {selectedSid && (
        <section className="bg-[#0c1020]/60 backdrop-blur-xl rounded-[2rem] border border-white/5 p-6 shadow-xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-600/[0.02] to-transparent pointer-events-none" />

          {/* 헤더 */}
          <div className="flex items-center justify-between mb-6 relative z-10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background:'rgba(6,182,212,0.12)', border:'1px solid rgba(6,182,212,0.3)' }}>
                <Settings size={15} color="#06b6d4" />
              </div>
              <div>
                <p className="text-sm font-black text-white whitespace-nowrap">PDS API 설정</p>
                <p className="text-[9px] font-bold uppercase tracking-widest whitespace-nowrap" style={{ color:'#06b6d4' }}>Endpoint Config & Test</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 bg-black/40 border border-white/10 rounded-xl px-2.5 py-1.5">
                <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest whitespace-nowrap">테스트 번호</span>
                <input
                  type="text"
                  value={testPhoneNumber}
                  onChange={e => setTestPhoneNumber(e.target.value)}
                  placeholder="01012345678"
                  className="w-24 bg-transparent text-[11px] text-emerald-400 font-mono font-bold focus:outline-none"
                />
              </div>

              {!cfgEditing ? (
                <button onClick={()=>setCfgEditing(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black border transition-all whitespace-nowrap cursor-pointer" style={{ background:'rgba(6,182,212,0.1)', border:'1px solid rgba(6,182,212,0.3)', color:'#06b6d4' }}>
                  <Edit3 size={13} /> 설정 편집
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={()=>setCfgEditing(false)} className="px-3 py-2 rounded-xl text-xs font-black border border-white/10 bg-white/5 text-slate-400"><X size={13} /></button>
                  <button onClick={handleCfgSave} disabled={cfgSaving} className="px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 cursor-pointer" style={{ background:'linear-gradient(135deg,#06b6d4,#0ea5e9)', color:'#000', boxShadow:'0 4px 14px rgba(6,182,212,0.25)' }}>
                    {cfgSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} 저장
                  </button>
                </div>
              )}
              <button
                onClick={handleTestCall} disabled={testLoading || !pdsConfig.api_url}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black border transition-all whitespace-nowrap cursor-pointer"
                style={{
                  background: testLoading||!pdsConfig.api_url ? 'rgba(255,255,255,0.04)' : 'linear-gradient(135deg,#10b981,#059669)',
                  border: '1px solid rgba(16,185,129,0.3)', color: testLoading||!pdsConfig.api_url ? '#334155' : '#fff',
                  boxShadow: testLoading||!pdsConfig.api_url ? 'none' : '0 4px 14px rgba(16,185,129,0.25)'
                }}
              >
                {testLoading ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                테스트 콜
              </button>
            </div>
          </div>

          {/* 발신 기기 선택 (기기 푸시 테스트) */}
          <div className="p-4 mb-4 bg-white/[0.02] border border-white/5 rounded-2.5xl relative z-10 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                <Smartphone size={15} className="text-orange-400" />
              </div>
              <div>
                <p className="text-xs font-black text-white">테스트 발송 기기 선택</p>
                <p className="text-[9px] font-bold text-orange-400/80 uppercase tracking-wider">Select Caller Device (Push Target)</p>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-1 max-w-md">
              <select
                value={selectedDeviceUid}
                onChange={e => setSelectedDeviceUid(e.target.value)}
                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500/50 cursor-pointer"
              >
                {pushDevices.length === 0 ? (
                  <option value="">등록된 푸시 기기 없음</option>
                ) : (
                  pushDevices.map(dev => (
                    <option key={dev.user_id} value={dev.user_id}>
                      {dev.emp_nm ? `${dev.emp_nm} (${dev.user_id})` : `사번: ${dev.user_id}`} — {dev.mod_dt?.slice(0, 16).replace('T', ' ')}
                    </option>
                  ))
                )}
              </select>

              <button
                type="button"
                onClick={handlePushTestCall}
                disabled={testLoading || !selectedDeviceUid}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black border transition-all whitespace-nowrap cursor-pointer"
                style={{
                  background: testLoading || !selectedDeviceUid ? 'rgba(255,255,255,0.04)' : 'linear-gradient(135deg,#f97316,#ea580c)',
                  border: '1px solid rgba(249,115,22,0.3)',
                  color: testLoading || !selectedDeviceUid ? '#475569' : '#fff',
                  boxShadow: testLoading || !selectedDeviceUid ? 'none' : '0 4px 14px rgba(249,115,22,0.25)'
                }}
              >
                {testLoading ? <Loader2 size={13} className="animate-spin" /> : <Smartphone size={13} />}
                기기 푸시 테스트 발신
              </button>
            </div>
          </div>

          {/* API URL + Method + Timeout */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4 relative z-10">
            <div className="md:col-span-3 space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1"><Globe size={10} /> API URL</p>
              {cfgEditing ? (
                <input value={pdsConfig.api_url} onChange={e=>setPdsConfig(p=>({...p,api_url:e.target.value}))} placeholder="https://pds.example.com/api/call"
                  className="w-full bg-black/40 border border-cyan-500/20 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50 font-mono" />
              ) : (
                <div className="px-4 py-3 rounded-xl bg-white/[0.03] border border-white/5 font-mono text-xs text-cyan-300 truncate">{pdsConfig.api_url || '미설정'}</div>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Method</p>
              {cfgEditing ? (
                <select value={pdsConfig.api_method} onChange={e=>setPdsConfig(p=>({...p,api_method:e.target.value}))}
                  className="w-full bg-black/40 border border-cyan-500/20 rounded-xl px-3 py-3 text-sm text-white focus:outline-none">
                  {['POST','GET','PUT','PATCH'].map(m=><option key={m}>{m}</option>)}
                </select>
              ) : (
                <div className="px-4 py-3 rounded-xl bg-white/[0.03] border border-white/5 text-xs font-black" style={{ color:'#06b6d4' }}>{pdsConfig.api_method}</div>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1"><Timer size={10} /> Timeout</p>
              {cfgEditing ? (
                <div className="flex items-center gap-2">
                  <input type="number" value={pdsConfig.timeout_sec} onChange={e=>setPdsConfig(p=>({...p,timeout_sec:Number(e.target.value)}))} min={1} max={60}
                    className="w-full bg-black/40 border border-cyan-500/20 rounded-xl px-3 py-3 text-sm text-amber-400 font-black focus:outline-none font-mono" />
                  <span className="text-xs text-slate-600">s</span>
                </div>
              ) : (
                <div className="px-4 py-3 rounded-xl bg-white/[0.03] border border-white/5 text-xs font-black text-amber-400">{pdsConfig.timeout_sec}s</div>
              )}
            </div>
          </div>

          {/* 템플릿 선택기 */}
          {cfgEditing && (
            <div className="relative z-10 flex flex-wrap gap-2 items-center mb-4 p-3 bg-white/[0.02] border border-white/5 rounded-2xl">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">템플릿 빠른 설정:</span>
              <button
                type="button"
                onClick={() => applyPresetTemplate('fcm_webpush')}
                className="px-2.5 py-1 text-[10px] font-bold bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded-lg hover:bg-cyan-500 hover:text-black transition-all active:scale-95 cursor-pointer"
              >
                FCM / Web Push 자동 발신 (Android)
              </button>
              <button
                type="button"
                onClick={() => applyPresetTemplate('standard_pds')}
                className="px-2.5 py-1 text-[10px] font-bold bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg hover:bg-amber-500 hover:text-black transition-all active:scale-95 cursor-pointer"
              >
                기본 PDS API
              </button>
            </div>
          )}

          {/* Headers + Params */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 relative z-10">
            {/* Headers */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1"><Key size={10} /> Request Headers</p>
                {cfgEditing && <button onClick={()=>setCfgHeaderRows(r=>[...r,{key:'',val:''}])} className="text-[9px] text-cyan-500 font-black">+ 추가</button>}
              </div>
              <div className="space-y-1.5 bg-black/30 rounded-xl border border-white/5 p-3 min-h-[80px]">
                {cfgHeaderRows.map((row,i)=>(
                  cfgEditing ? (
                    <div key={i} className="flex gap-2">
                      <input value={row.key} onChange={e=>setCfgHeaderRows(rows=>{const n=[...rows];n[i]={...n[i],key:e.target.value};return n;})} placeholder="Key"
                        className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none font-mono" />
                      <input value={row.val} onChange={e=>setCfgHeaderRows(rows=>{const n=[...rows];n[i]={...n[i],val:e.target.value};return n;})} placeholder="Value"
                        className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-cyan-300 focus:outline-none font-mono" />
                      <button onClick={()=>setCfgHeaderRows(r=>r.filter((_,j)=>j!==i))} className="text-slate-600 hover:text-red-400"><X size={12}/></button>
                    </div>
                  ) : row.key ? (
                    <div key={i} className="flex gap-2 text-[11px] font-mono font-bold leading-normal">
                      <span className="text-slate-400 shrink-0">{row.key}:</span>
                      <span className="text-cyan-300 select-all whitespace-pre-wrap break-all">{row.val}</span>
                    </div>
                  ) : null
                ))}
                {!cfgEditing && !cfgHeaderRows.some(r=>r.key) && <p className="text-[10px] text-slate-600">헤더 없음</p>}
              </div>
            </div>
            {/* Params */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1"><Terminal size={10} /> Request Body (JSON)</p>
              </div>
              <div className="bg-black/30 rounded-xl border border-white/5 p-3 min-h-[120px] flex flex-col justify-stretch">
                {cfgEditing ? (
                  <textarea
                    value={cfgBodyText}
                    onChange={e => setCfgBodyText(e.target.value)}
                    placeholder='{\n  "data": {\n    "action": "CALL",\n    "phone_number": "01012345678"\n  }\n}'
                    rows={6}
                    className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-[11px] text-amber-300 focus:outline-none font-mono resize-y"
                  />
                ) : (
                  <pre className="text-amber-300 text-[11px] font-mono overflow-x-auto whitespace-pre-wrap break-all max-h-48 custom-scrollbar">
                    {cfgBodyText || '{}'}
                  </pre>
                )}
              </div>
            </div>
          </div>

          {/* 마지막 테스트 결과 */}
          {lastTestResult && (
            <div className={`relative z-10 mb-4 p-4 rounded-2xl border text-xs font-mono ${lastTestResult.success ? 'bg-emerald-500/8 border-emerald-500/20' : 'bg-red-500/8 border-red-500/20'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {lastTestResult.success ? <CheckCircle2 size={13} className="text-emerald-400" /> : <AlertCircle size={13} className="text-red-400" />}
                  <span className={`font-black text-sm ${lastTestResult.success ? 'text-emerald-400' : 'text-red-400'}`}>
                    {lastTestResult.success ? '테스트 성공' : '테스트 실패'}
                  </span>
                  {lastTestResult.status_code > 0 && <span className="px-2 py-0.5 rounded-full text-[10px] font-black" style={{ background:'rgba(255,255,255,0.05)', color:'#94a3b8' }}>HTTP {lastTestResult.status_code}</span>}
                  <span className="text-slate-600 text-[10px]">{lastTestResult.elapsed_ms}ms</span>
                </div>
                <button onClick={()=>{navigator.clipboard.writeText(lastTestResult.response||'');setCopiedLog('last');setTimeout(()=>setCopiedLog(null),2000);}} className="text-slate-500 hover:text-white">
                  {copiedLog==='last' ? <CheckCheck size={12} className="text-emerald-400" /> : <Copy size={12} />}
                </button>
              </div>
              <pre className="text-slate-300 overflow-x-auto whitespace-pre-wrap break-words text-[11px] max-h-40">{(() => { try { return JSON.stringify(JSON.parse(lastTestResult.response||''), null, 2); } catch { return lastTestResult.response; }})()}</pre>
            </div>
          )}

          {/* 테스트 콜 이력 */}
          <div className="relative z-10">
            <button onClick={()=>setLogExpanded(v=>!v)} className="flex items-center justify-between w-full mb-3">
              <div className="flex items-center gap-2">
                <Terminal size={13} className="text-slate-500" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">테스트 콜 이력</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black" style={{ background:'rgba(6,182,212,0.1)', color:'#06b6d4' }}>{testLogs.length}</span>
              </div>
              {logExpanded ? <ChevronUp size={14} className="text-slate-600" /> : <ChevronDown size={14} className="text-slate-600" />}
            </button>
            {logExpanded && (
              <div className="bg-black/40 rounded-2xl border border-white/5 overflow-hidden" style={{ maxHeight: 260, overflowY: 'auto' }}>
                {testLogs.length === 0 ? (
                  <div className="flex items-center justify-center py-10 text-slate-600 text-xs">테스트 이력 없음</div>
                ) : testLogs.map((log, i) => (
                  <div key={i} className={`flex items-start gap-3 px-4 py-3 border-b border-white/[0.03] text-[11px] font-mono ${i===0?'bg-white/[0.01]':''}`}>
                    <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${log.SUCCESS==='Y'?'bg-emerald-400':'bg-red-400'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`font-black ${log.SUCCESS==='Y'?'text-emerald-400':'text-red-400'}`}>HTTP {log.STATUS_CODE||'ERR'}</span>
                        <span className="text-slate-600">{log.ELAPSED_MS}ms</span>
                        <span className="text-slate-600 ml-auto shrink-0">{log.TESTED_AT?.slice(0,19)}</span>
                      </div>
                      <div className="text-cyan-300/70 truncate">{log.API_URL}</div>
                      {log.RESPONSE_BODY && <div className="text-slate-500 mt-1 truncate">{log.RESPONSE_BODY.substring(0,120)}</div>}
                    </div>
                    <button onClick={()=>{navigator.clipboard.writeText(log.RESPONSE_BODY||'');setCopiedLog(i);setTimeout(()=>setCopiedLog(null),2000);}} className="shrink-0 text-slate-600 hover:text-slate-300">
                      {copiedLog===i ? <CheckCheck size={11} className="text-emerald-400" /> : <Copy size={11} />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
        )}

    </div>

    {/* Right Column: Incident Call & App Call Status */}
    <div className="w-full xl:w-5/12 flex flex-col gap-6">
      {/* ════════════════════════════════════════════
            2️⃣  INCIDENT CALL TRACKING (장애 ID 기반 발신 현황)
        ════════════════════════════════════════════ */}
        <section className="bg-[#0c1020]/60 backdrop-blur-xl rounded-[2rem] border border-white/5 p-6 shadow-xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/[0.02] to-transparent pointer-events-none" />
          
          <SectionHeader icon={Activity} title="수신자 시뮬레이션" sub="수신자 모의 훈련 및 발신 현황" color="#10b981">
            <div className="flex items-center gap-2">
              <button className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-[10px] font-black transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] flex items-center gap-1.5 cursor-pointer active:scale-95">
                <Play size={12} />
                <span>시뮬레이션 시작</span>
              </button>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 hidden sm:flex">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Live Monitoring</span>
              </div>
            </div>
          </SectionHeader>

          {histLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-600">
              <Loader2 size={24} className="animate-spin opacity-20" />
              <p className="text-[10px] font-black uppercase tracking-widest">Loading Event Logs...</p>
            </div>
          ) : hists.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 bg-black/20 rounded-2xl border border-dashed border-white/5">
              <PhoneOff size={32} className="opacity-10 text-white" />
              <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">No Incident Traffic Recorded</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar pr-1 mt-4">
              {/* 장애 ID별로 그룹화하여 렌더링 */}
              {Object.entries(
                hists.reduce((acc, h) => {
                  const key = h.inc_id || h.igw_txn_id || 'UNKNOWN';
                  if (!acc[key]) acc[key] = [];
                  acc[key].push(h);
                  return acc;
                }, {})
              ).map(([incId, logs]) => (
                <div key={incId} className="bg-white/[0.02] rounded-3xl border border-white/5 overflow-hidden transition-all hover:border-white/10 shadow-lg">
                  {/* 그룹 헤더: 장애 ID */}
                  <div className="px-5 py-4 bg-white/[0.03] border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[10px] font-black text-blue-400 font-mono">
                        ID: {incId}
                      </div>
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Incident Event</span>
                    </div>
                    <div className="text-[9px] font-bold text-slate-600 font-mono">
                      Total {logs.length} Calls
                    </div>
                  </div>

                  {/* 그룹 내부: 대상자별 발신 이력 */}
                  <div className="p-4 space-y-2">
                    {logs.map((log) => (
                      <div key={log.log_id} className="flex items-center gap-4 bg-black/20 rounded-2xl px-4 py-3 border border-white/[0.03] hover:bg-white/[0.01] transition-all">
                        {/* 회차 */}
                        <div className="shrink-0 w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                          <span className="text-[10px] font-black text-white font-mono">{log.attempt_seq}</span>
                        </div>

                        {/* 대상자 정보 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-black text-slate-200">{log.emp_nm || log.emp_id}</span>
                            <span className="text-[10px] font-bold text-slate-500 font-mono">{log.mobile_no || '-'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[9px] font-bold text-slate-600 uppercase tracking-tight">
                            <Clock size={10} />
                            <span>{log.call_dt?.replace('T', ' ').slice(0, 19)}</span>
                          </div>
                        </div>

                        {/* PDS 결과 */}
                        <div className="shrink-0 flex items-center gap-4">
                          <div className="w-[1px] h-6 bg-white/5" />
                          <PdsBadge code={log.pds_result_cd} />
                          {log.pds_result_cd === 'SUCCESS' && (
                            <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                              <Check size={12} className="text-emerald-400" />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

                {selectedSid && (
        <section className="bg-[#0c1020]/60 backdrop-blur-xl rounded-[2rem] border border-white/5 p-6 shadow-xl relative overflow-hidden mt-6">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/[0.02] to-transparent pointer-events-none" />

          {/* 헤더 */}
          <div className="flex items-center justify-between mb-6 relative z-10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background:'rgba(16,185,129,0.12)', border:'1px solid rgba(16,185,129,0.3)' }}>
                <Activity size={15} color="#10b981" />
              </div>
              <div>
                <p className="text-sm font-black text-white whitespace-nowrap">앱 통화 상태 실시간 수신 이력</p>
                <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-400 whitespace-nowrap">App Call Status Webhook Logs</p>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              {/* 필터 */}
              <button
                onClick={() => setFilterCurrentTargets(v => !v)}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black border transition-all cursor-pointer ${
                  filterCurrentTargets 
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' 
                    : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                }`}
              >
                현재 전략 대상자만 필터
              </button>

              {/* 실시간 감지 감시기 */}
              <button
                onClick={() => setAutoRefreshEvents(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black border transition-all cursor-pointer ${
                  autoRefreshEvents 
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                    : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${autoRefreshEvents ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                {autoRefreshEvents ? '실시간 감지 ON' : '실시간 감지 OFF'}
              </button>

              {/* 수동 새로고침 */}
              <button
                onClick={fetchAppEvents}
                disabled={appEventsLoading}
                className="p-1.5 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10 hover:text-white transition-all disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw size={13} className={appEventsLoading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Webhook 테스트 전송 패널 */}
          <div className="mb-6 p-4 bg-white/[0.02] border border-white/5 rounded-2.5xl relative z-10">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-1.5">
              <Globe size={11} className="text-cyan-400" /> 앱 Webhook 모의 테스트 발송 (Mock Trigger)
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl px-3 py-2 flex-1 min-w-[120px]">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider whitespace-nowrap">사번</span>
                <input
                  type="text"
                  value={mockEmpId}
                  onChange={e => setMockEmpId(e.target.value)}
                  placeholder="12345"
                  className="w-full bg-transparent text-xs text-white focus:outline-none font-mono"
                />
              </div>

              <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl px-3 py-2 flex-[1.5] min-w-[150px]">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider whitespace-nowrap">전화번호</span>
                <input
                  type="text"
                  value={mockPhone}
                  onChange={e => setMockPhone(e.target.value)}
                  placeholder="01012345678"
                  className="w-full bg-transparent text-xs text-white focus:outline-none font-mono"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSendMockEvent('CONNECTED')}
                  disabled={mockSending}
                  className="px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500 border border-emerald-500/30 hover:text-black text-emerald-400 rounded-xl text-[10px] font-black transition-all active:scale-95 cursor-pointer"
                >
                  CONNECTED 발송
                </button>
                <button
                  type="button"
                  onClick={() => handleSendMockEvent('DISCONNECTED')}
                  disabled={mockSending}
                  className="px-3 py-2 bg-slate-500/10 hover:bg-slate-500 border border-slate-500/30 hover:text-black text-slate-400 rounded-xl text-[10px] font-black transition-all active:scale-95 cursor-pointer"
                >
                  DISCONNECTED 발송
                </button>
                <button
                  type="button"
                  onClick={() => handleSendMockEvent('MISSED')}
                  disabled={mockSending}
                  className="px-3 py-2 bg-red-500/10 hover:bg-red-500 border border-red-500/30 hover:text-black text-red-400 rounded-xl text-[10px] font-black transition-all active:scale-95 cursor-pointer"
                >
                  MISSED 발송
                </button>
              </div>
            </div>
            <p className="text-[9px] text-slate-600 mt-2">
              * 입력한 사번과 번호로 앱 수신 Webhook API(<code className="font-mono bg-white/5 px-1 py-0.5 rounded text-amber-500">POST /call/event</code>)를 모의 호출하여 실시간 통화 감지를 테스트합니다.
            </p>
          </div>

          {/* 수신 로그 테이블 */}
          <div className="relative z-10 bg-black/40 rounded-2.5xl border border-white/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] font-mono text-left border-collapse">
                <thead>
                  <tr className="bg-white/[0.02] border-b border-white/5 text-[9px] font-black uppercase text-slate-500 tracking-wider">
                    <th className="px-4 py-3">수신 시각 (KST)</th>
                    <th className="px-4 py-3">사번</th>
                    <th className="px-4 py-3">대상자 명</th>
                    <th className="px-4 py-3">수신 전화번호</th>
                    <th className="px-4 py-3 text-center">통화 상태 이벤트</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const filtered = appEvents.filter(evt => {
                      if (!filterCurrentTargets) return true;
                      // Filter by target matching in the currently selected strategy
                      return targets.some(t => t.EMP_ID === evt.EMPLOYEE_ID || t.MOBILE_NO === evt.PHONE_NUMBER);
                    });

                    if (filtered.length === 0) {
                      return (
                        <tr>
                          <td colSpan={5} className="text-center py-10 text-slate-600">
                            {filterCurrentTargets ? '현재 전략 대상자 매칭 내역 없음' : '수신된 통화 상태 내역 없음'}
                          </td>
                        </tr>
                      );
                    }

                    return filtered.map((evt) => {
                      // Map employee_id to target name or user name
                      const matchedTarget = targets.find(t => t.EMP_ID === evt.EMPLOYEE_ID);
                      const targetName = matchedTarget ? matchedTarget.EMP_NM : '-';

                      return (
                        <tr key={evt.LOG_ID} className="border-b border-white/[0.02] hover:bg-white/[0.01] transition-all">
                          <td className="px-4 py-2.5 text-slate-400">{evt.EVENT_TIME || evt.REG_DT?.slice(0, 19)}</td>
                          <td className="px-4 py-2.5 text-slate-200 font-bold">{evt.EMPLOYEE_ID}</td>
                          <td className="px-4 py-2.5 text-cyan-300 font-bold">{targetName}</td>
                          <td className="px-4 py-2.5 text-slate-300">{evt.PHONE_NUMBER}</td>
                          <td className="px-4 py-2.5 text-center">
                            {evt.EVENT_TYPE === 'CONNECTED' && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                CONNECTED
                              </span>
                            )}
                            {evt.EVENT_TYPE === 'DISCONNECTED' && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-500/10 text-slate-400 border border-white/5">
                                DISCONNECTED
                              </span>
                            )}
                            {evt.EVENT_TYPE === 'MISSED' && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-500/10 text-red-400 border border-red-500/20">
                                MISSED
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </section>
        )}

    </div>
  </div>
      </main>

      {/* ── 전략 생성 모달 ──────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#04070f]/80 backdrop-blur-md" onClick={() => setShowCreateModal(false)} />
          
          <div className="relative w-full max-w-2xl bg-[#0c1020] border border-orange-500/30 rounded-[2.5rem] shadow-[0_0_80px_rgba(251,146,60,0.15)] overflow-hidden animate-in zoom-in-95 duration-300">
            {/* 상단 글로우 */}
            <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-orange-500/10 to-transparent pointer-events-none" />
            
            <div className="px-[33px] py-7 relative z-10">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-2xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white tracking-tight">새 장애 대응 전략</h2>
                  <p className="text-[10px] font-bold text-orange-500/60 uppercase tracking-widest">Create New Strategy Master</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">전략 명칭</label>
                  <input
                    type="text"
                    value={newStrategy.strategy_nm}
                    onChange={e => setNewStrategy(p => ({ ...p, strategy_nm: e.target.value }))}
                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-5 text-base text-white focus:outline-none focus:border-orange-500/50 transition-all placeholder:text-slate-700"
                    placeholder="예: 실시간 계정계 장애 전파"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">전략 내용 (유형)</label>
                  <select
                    value={newStrategy.strategy_cont}
                    onChange={e => setNewStrategy(p => ({ ...p, strategy_cont: e.target.value }))}
                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-5 text-base text-white focus:outline-none focus:border-purple-500/50 transition-all cursor-pointer appearance-none"
                  >
                    {STRATEGY_CONT_OPTIONS.map(opt => (
                      <option key={opt.id} value={opt.id}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">시작일시</label>
                    <input
                      type="datetime-local"
                      value={newStrategy.apply_start_dt}
                      onChange={e => setNewStrategy(p => ({ ...p, apply_start_dt: e.target.value }))}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white focus:outline-none focus:border-blue-500/50 font-mono tracking-tighter"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">종료일시</label>
                    <input
                      type="datetime-local"
                      value={newStrategy.apply_end_dt}
                      onChange={e => setNewStrategy(p => ({ ...p, apply_end_dt: e.target.value }))}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white focus:outline-none focus:border-blue-500/50 font-mono tracking-tighter"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">최대 발신 횟수</label>
                  <div className="flex items-center gap-4">
                    <input
                      type="number"
                      value={newStrategy.max_call_cnt}
                      onChange={e => setNewStrategy(p => ({ ...p, max_call_cnt: e.target.value }))}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-lg text-amber-400 font-black focus:outline-none focus:border-amber-500/50 font-mono"
                    />
                    <span className="text-xs font-black text-slate-600 uppercase tracking-widest">Times</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-10">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-4 rounded-2xl bg-white/5 text-slate-400 font-black text-xs hover:bg-white/10 transition-all active:scale-95"
                >
                  취소
                </button>
                <button
                  onClick={handleCreateStrategy}
                  className="flex-[2] py-4 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-black font-black text-xs hover:from-orange-400 hover:to-amber-400 transition-all shadow-[0_0_20px_rgba(251,146,60,0.3)] active:scale-95"
                >
                  전략 등록하기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

