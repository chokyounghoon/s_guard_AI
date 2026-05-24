import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBackNavigation } from '../hooks/useBackNavigation';
import {
  ArrowLeft, Phone, Users, Activity, RefreshCw,
  Plus, Trash2, Edit3, Check, X, Save,
  ChevronDown, Zap, Clock, AlertCircle,
  CheckCircle2, PhoneOff, PhoneMissed, Loader2,
  Settings, Play, Terminal, Globe, Key, Timer,
  ChevronUp, Copy, CheckCheck, Smartphone, Repeat
} from 'lucide-react';
import { getAuthHeaders, getUserProfile } from '../lib/authStore';
import { SMS_WORKER_URL } from '../config/api';

const API_BASE = SMS_WORKER_URL || 'https://sguardai.khcho0421.workers.dev';

// ─── 전략 유형 옵션 ──────────────────────────────────────────
const STRATEGY_CONT_OPTIONS = [
  { id: '1', label: '메시지 수신자별 순차 통화' },
  { id: '2', label: '메시지 수신자 및 AA, 파트장' },
  { id: '3', label: '메시지 수신자의 파트 전원' },
  { id: '4', label: '대직자 발신' },
];

// ─── PDS 결과 코드 배지 ────────────────────────────────────────
function PdsBadge({ code }) {
  const map = {
    SUCCESS:        { label: '성공',     cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
    FAIL:           { label: '실패',     cls: 'bg-red-500/15 text-red-400 border-red-500/30' },
    BUSY:           { label: '통화중',   cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
    NOANSWER:       { label: '무응답',   cls: 'bg-slate-500/15 text-slate-400 border-slate-500/30' },
    PENDING:        { label: '대기',     cls: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
    DIALING:        { label: '발신시작', cls: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30' },
    RINGING:        { label: '신호송출', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
    CONNECTED:      { label: '걸기중',   cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
    DISCONNECTED:   { label: '통화종료', cls: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30' },
    FAIL_VOICEMAIL: { label: '소리샘종료', cls: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
    MISSED:         { label: '부재중',   cls: 'bg-red-500/15 text-red-400 border-red-500/30' },
    FAILED:         { label: '발신실패', cls: 'bg-rose-500/15 text-rose-400 border-rose-500/30' },
  };
  const upperCode = (code || '').toUpperCase();
  const { label, cls } = map[upperCode] || { label: code || '-', cls: 'bg-white/5 text-slate-500 border-white/10' };
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
    priority: 99,
    delay_sec: 0,
    valid_conditions: [],
    max_call_cnt: 3,
  });

  // ── 담당자 목록 ─────────────────────────────────
  const [targets, setTargets]             = useState([]);
  const [mySubstitutes, setMySubstitutes] = useState([]);
  const [tgtLoading, setTgtLoading]       = useState(false);
  const [editRow, setEditRow]             = useState(null);   // { idx, ...fields }
  const [addRow, setAddRow]               = useState(null);   // { emp_id, emp_nm, mobile_no }
  const [userPhones, setUserPhones]       = useState({});

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
      const list = (data.strategies || data || []).map(s => {
        const priorityVal = s.priority !== undefined ? s.priority : (s.PRIORITY !== undefined ? s.PRIORITY : 99);
        const delayVal = s.delay_sec !== undefined ? s.delay_sec : (s.DELAY_SEC !== undefined ? s.DELAY_SEC : 0);
        let validConds = s.valid_conditions || s.VALID_CONDITIONS || '[]';
        return {
          ...s,
          // 소문자 정규화 (DB는 대문자 컴럼명)
          strategy_id:   s.strategy_id   || s.STRATEGY_ID,
          strategy_nm:   s.strategy_nm   || s.STRATEGY_NM,
          strategy_cont: s.strategy_cont || s.STRATEGY_CONT,
          apply_start_dt: s.apply_start_dt || s.APPLY_START_DT,
          apply_end_dt:   s.apply_end_dt   || s.APPLY_END_DT,
          max_call_cnt:   s.max_call_cnt   || s.MAX_CALL_CNT,
          use_yn:         s.use_yn         || s.USE_YN,
          priority:       Number(priorityVal),
          delay_sec:      Number(delayVal),
          valid_conditions: validConds,
        };
      });
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
  const [mockEmpId, setMockEmpId]         = useState('12345');
  const [mockPhone, setMockPhone]         = useState('01012345678');
  const [mockSending, setMockSending]     = useState(false);
  const [mockConnectedTime, setMockConnectedTime] = useState(null);
  const [mockElapsed, setMockElapsed]     = useState(0);
  const [mockResultText, setMockResultText] = useState('');
  const [filterCurrentTargets, setFilterCurrentTargets] = useState(false);

  // 전역 푸시 연동을 위해 localStorage에 상태 동기화
  useEffect(() => {
    if (testPhoneNumber) localStorage.setItem('scallert_test_phone', testPhoneNumber);
  }, [testPhoneNumber]);

  useEffect(() => {
    if (selectedDeviceUid) localStorage.setItem('scallert_test_device', selectedDeviceUid);
  }, [selectedDeviceUid]);

  const [ticker, setTicker] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setTicker(t => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const getLatestCallStatus = () => {
    const cleanTestPhone = testPhoneNumber.replace(/[^0-9]/g, '');
    const cleanMockPhone = mockPhone.replace(/[^0-9]/g, '');
    if (!cleanTestPhone && !cleanMockPhone) return null;

    const filtered = appEvents
      .filter(evt => {
        const cleanEvtPhone = (evt.PHONE_NUMBER || '').replace(/[^0-9]/g, '');
        return (cleanTestPhone && cleanEvtPhone === cleanTestPhone) || (cleanMockPhone && cleanEvtPhone === cleanMockPhone);
      })
      .sort((a, b) => {
        const tsA = a.TIMESTAMP || new Date(a.REG_DT || 0).getTime() || 0;
        const tsB = b.TIMESTAMP || new Date(b.REG_DT || 0).getTime() || 0;
        return tsB - tsA;
      });

    if (filtered.length === 0) return null;

    const latest = filtered[0];
    const latestType = (latest.EVENT_TYPE || '').toUpperCase();
    const latestTs = latest.TIMESTAMP || new Date(latest.REG_DT || 0).getTime() || Date.now();

    if (latestType === 'CONNECTED') {
      const elapsed = Math.max(0, Math.floor((Date.now() - latestTs) / 1000));
      return {
        status: 'CONNECTED',
        text: `🟢 걸기중 (${elapsed}초 경과)`,
        isSuccess: null
      };
    }
    if (latestType === 'DIALING' || latestType === 'RINGING') {
      return {
        status: latestType,
        text: `⚡ ${latestType === 'DIALING' ? '발신 시작' : '신호 송출 중'}`,
        isSuccess: null
      };
    }

    if (latestType === 'DISCONNECTED') {
      const connectedEvt = filtered.find(evt => {
        const type = (evt.EVENT_TYPE || '').toUpperCase();
        const ts = evt.TIMESTAMP || new Date(evt.REG_DT || 0).getTime() || 0;
        return type === 'CONNECTED' && ts < latestTs;
      });
      if (connectedEvt) {
        const connTs = connectedEvt.TIMESTAMP || new Date(connectedEvt.REG_DT || 0).getTime();
        const duration = Math.max(0, Math.floor((latestTs - connTs) / 1000));
        const isSuccess = duration > 0 && duration <= 50;
        return {
          status: 'DISCONNECTED',
          text: isSuccess ? `✅ 통화 성공 (${duration}초)` : `❌ 통화 실패 (${duration}초 - 50초 초과)`,
          isSuccess
        };
      } else {
        return {
          status: 'DISCONNECTED',
          text: `ℹ️ 통화 종료`,
          isSuccess: false
        };
      }
    }

    if (latestType === 'MISSED') {
      return {
        status: 'MISSED',
        text: `❌ 부재중 (통화 실패)`,
        isSuccess: false
      };
    }

    if (latestType === 'FAILED') {
      return {
        status: 'FAILED',
        text: `❌ 발신 실패`,
        isSuccess: false
      };
    }

    return null;
  };


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
      const nowTs = Date.now();
      const target = activeTargets.length > 0 ? activeTargets[0] : null;
      const useEmpId = target ? (target.emp_id || target.EMP_ID) : '12345';
      const usePhone = target ? (target.mobile_no || target.MOBILE_NO) : '01012345678';
      
      const payload = {
        employee_id: useEmpId,
        phone_number: usePhone,
        event_type: type,
        timestamp: nowTs
      };
      
      if (type === 'CONNECTED') {
        setMockConnectedTime(nowTs);
        setMockResultText('');
      } else if (type === 'DISCONNECTED') {
        if (mockConnectedTime) {
          const elapsed = Math.floor((nowTs - mockConnectedTime) / 1000);
          if (elapsed > 0 && elapsed <= 50) {
            setMockResultText(`✅ ${elapsed}초 (50초 이내: 통화 성공)`);
          } else {
            setMockResultText(`❌ ${elapsed}초 (50초 초과: 통화 실패)`);
          }
          setMockConnectedTime(null);
        } else {
          setMockResultText('⚠️ 연결(CONNECTED) 기록 없음');
        }
      } else {
        setMockResultText('');
      }

      const r = await fetch(`${API_BASE}/call/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (r.ok) {
        await fetchAppEvents();
        setTimeout(() => {
          if (selectedSid) fetchHists(selectedSid);
        }, 1000);
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
    if (!mockConnectedTime) {
      setMockElapsed(0);
      return;
    }
    const timer = setInterval(() => {
      setMockElapsed(Math.floor((Date.now() - mockConnectedTime) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [mockConnectedTime]);

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

  useEffect(() => {
    if (userProfile?.employee_id) {
      fetchMySubstitutes(userProfile.employee_id);
    }
  }, [userProfile?.employee_id, fetchMySubstitutes]);

  // ── 초기 로드: 화면 진입 시 첫 번째 전략 자동 선택 및 스크롤 허용 ───────────
  useEffect(() => {
    // SCallertPage 진입 시 body overflow를 auto로 설정하여 전체 스크롤 활성화
    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'auto';

    fetchUsers();
    fetchStrategies().then(list => {
      if (list && list.length > 0 && !selectedSid) {
        setSelectedSid(list[0].strategy_id);
      }
    });

    return () => {
      // 페이지를 떠날 때 원래대로 복구
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    };
  }, []);

  useEffect(() => {
    if (!selectedSid) return;
    const s = strategies.find(s => s.strategy_id === selectedSid);
    if (s) {
      let parsedConds = [];
      try {
        parsedConds = typeof s.valid_conditions === 'string'
          ? JSON.parse(s.valid_conditions)
          : (Array.isArray(s.valid_conditions) ? s.valid_conditions : []);
      } catch (e) {
        console.error('Failed to parse valid_conditions:', e);
      }
      setRuleForm({ ...s, valid_conditions: parsedConds });
    }
    setRuleEditing(false);
    fetchTargets(selectedSid);
    fetchHists(selectedSid);
    fetchPdsConfig(selectedSid);
    fetchTestLogs(selectedSid);

    // 30초 폴링 (발신 이력 실시간 갱신)
    clearInterval(pollRef.current);
    pollRef.current = setInterval(() => fetchHists(selectedSid), 30000);
    return () => clearInterval(pollRef.current);
  }, [selectedSid, strategies]);

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
          priority:       Number(ruleForm.priority ?? 99),
          delay_sec:      Number(ruleForm.delay_sec ?? 0),
          valid_conditions: Array.isArray(ruleForm.valid_conditions) ? ruleForm.valid_conditions : [],
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

  const handleStartSimulation = async () => {
    if (!selectedSid) {
      alert('전략이 선택되지 않았습니다.');
      return;
    }
    
    if (activeTargets.length === 0) {
      alert('적용할 대상자가 없습니다.');
      return;
    }
    
    if (!window.confirm('현재 표시된 발신 대상자 명단을 수신 대상(TB_SCL_TARGET_INFO)으로 덮어쓰기/적용 하시겠습니까?')) return;
    
    try {
      // 1. Delete all existing targets for this strategy
      for (const t of targets) {
        if (t.seq_no || t.SEQ_NO) {
          await fetch(`${API_BASE}/scallert/targets/${t.seq_no || t.SEQ_NO}`, {
            method: 'DELETE', headers: getAuthHeaders(),
          });
        }
      }
      
      // 2. Insert new targets from activeTargets
      for (const [idx, t] of activeTargets.entries()) {
        const emp_id = String(t.emp_id || t.EMP_ID).trim();
        const emp_nm = String(t.emp_nm || t.EMP_NM).trim();
        const mobile_no = String(t.mobile_no || t.MOBILE_NO).trim();
        
        await fetch(`${API_BASE}/scallert/strategies/${selectedSid}/targets`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ 
            emp_id, 
            emp_nm, 
            mobile_no, 
            sort_ord: idx + 1,
            mod_id: userProfile?.employee_id || 'SYSTEM' 
          }),
        });
      }
      
      alert('대상자 목록 덮어쓰기가 완료되었습니다.');
      fetchTargets(selectedSid);
    } catch (e) {
      console.error(e);
      alert('오류가 발생했습니다.');
    }
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

  const handleCallTarget = async (item) => {
    if (!selectedSid) return;
    try {
      const r = await fetch(`${API_BASE}/scallert/strategies/${selectedSid}/call-target`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ emp_id: item.emp_id || item.EMP_ID })
      });
      const data = await r.json();
      if (data.success) {
        fetchHists(selectedSid);
      } else {
        alert('발신 실패: ' + (data.error || '알 수 없는 오류'));
      }
    } catch (e) {
      alert('오류: ' + e.message);
    }
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


  const handleToggleStrategy = async (s) => {
    const newStatus = s.use_yn === 'Y' ? 'N' : 'Y';
    try {
      const r = await fetch(`${API_BASE}/scallert/strategies/${s.strategy_id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ use_yn: newStatus, mod_id: userProfile?.employee_id || 'SYSTEM' })
      });
      if (r.ok) {
        fetchStrategies(selectedSid);
        if (s.strategy_id === selectedSid && ruleForm)
          setRuleForm(prev => ({ ...prev, use_yn: newStatus }));
      }
    } catch (e) { console.error(e); alert('상태 변경 실패'); }
  };
  const [nowTime, setNowTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTime(new Date());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const activeTargets = useMemo(() => {
    const isSub = ruleForm?.strategy_cont === '4';
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
  }, [ruleForm?.strategy_cont, mySubstitutes, targets, userPhones]);

  const isSubstituteType = ruleForm?.strategy_cont === '4';

  const strategyStatus = useMemo(() => {
    if (!ruleForm) return { active: false, reason: '선택된 전략 없음' };
    if (ruleForm.use_yn !== 'Y') return { active: false, reason: '사용 중지됨' };

    const start = ruleForm.apply_start_dt ? new Date(ruleForm.apply_start_dt) : null;
    const end = ruleForm.apply_end_dt ? new Date(ruleForm.apply_end_dt) : null;

    if (start && nowTime < start) return { active: false, reason: '적용 대기 (시작일 미도달)' };
    if (end && nowTime > end) return { active: false, reason: '적용 만료 (종료일 경과)' };

    const conds = ruleForm.valid_conditions || [];
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
  }, [ruleForm, nowTime]);

  return (
    <div
      className="text-white font-sans flex flex-col min-h-screen"
      style={{ background: 'linear-gradient(160deg,#04070f 0%,#070b18 60%,#04070f 100%)' }}
    >
      {/* 배경 그로우 */}
      <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-orange-600/5 blur-[160px] rounded-full -z-10 pointer-events-none" />
      <div className="fixed bottom-0 left-0  w-[400px] h-[400px] bg-red-600/5   blur-[120px] rounded-full -z-10 pointer-events-none" />

      {/* ── 헤더 ───────────────────────────────────── */}
      <header className="sticky top-0 z-50 backdrop-blur-2xl border-b" style={{ background: 'rgba(4,7,15,0.94)', borderColor: 'rgba(251,146,60,0.15)' }}>
        <div className="w-full max-w-[2000px] mx-auto px-4 lg:px-6 2xl:px-8 py-3 flex items-center gap-3">
          <button
            onClick={() => goBack()}
            style={{ width:36, height:36, borderRadius:10, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}
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
      </header>
      <main className="w-full px-4 lg:px-6 2xl:px-8 py-6 mx-auto max-w-[2000px]">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">


          {/* ── Left Column: Strategy List ── */}
          <div className="xl:col-span-3 xl:sticky xl:top-[80px] flex flex-col gap-6">
            <section className="flex flex-col bg-[#0c1020]/60 border border-white/5 rounded-[2rem] overflow-hidden backdrop-blur-xl">
              <div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-orange-400" />
                  <h2 className="text-sm font-black text-white tracking-tight">전략 목록</h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400">{strategies.length}건</span>
                </div>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center bg-orange-500/10 border border-orange-500/30 text-orange-400 hover:bg-orange-500 hover:text-black transition-all active:scale-95"
                  title="새 전략 추가"
                >
                  <Plus size={14} />
                </button>
              </div>
              <div className="p-3 overflow-y-auto flex-1 space-y-2 custom-scrollbar pb-20">
                {strategies.length === 0 ? (
                  <p className="text-center text-slate-500 text-xs py-10 font-bold">등록된 전략이 없습니다.</p>
                ) : (
                  strategies.map(s => (
                    <div
                      key={s.strategy_id}
                      onClick={() => setSelectedSid(s.strategy_id)}
                      className={`cursor-pointer rounded-2xl p-4 border transition-all ${
                        selectedSid === s.strategy_id
                          ? 'bg-orange-500/10 border-orange-500/40 shadow-[0_0_15px_rgba(251,146,60,0.1)]'
                          : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05]'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3 gap-2">
                        <span className={`text-sm font-black break-words leading-tight ${selectedSid === s.strategy_id ? 'text-orange-300' : 'text-slate-300'}`}>
                          {s.strategy_nm}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleToggleStrategy(s); }}
                          className={`shrink-0 w-[38px] h-[20px] rounded-full relative transition-colors ${s.use_yn === 'Y' ? 'bg-emerald-500' : 'bg-slate-700'}`}
                        >
                          <div
                            className={`w-[16px] h-[16px] rounded-full bg-white absolute top-[2px] transition-all ${s.use_yn === 'Y' ? 'left-[20px]' : 'left-[2px]'}`}
                            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }}
                          />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/5 text-slate-400">순위: {s.priority ?? 99}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${s.use_yn === 'Y' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-slate-500'}`}>
                          {s.use_yn === 'Y' ? '가동중' : '중지'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          {/* ── Center Column: Rule Setting + App Events ── */}
          <div className="xl:col-span-5 flex flex-col gap-6 pb-20">
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

                {/* 우선순위, 발동 대기(지연), 최대 반복 횟수 */}
                <div className="md:col-span-5 grid grid-cols-3 gap-4">
                  {/* 우선순위 */}
                  <div className="p-4 bg-black/40 rounded-2xl border border-white/5 space-y-3">
                    <div className="flex items-center gap-2 text-orange-400">
                      <Settings className="w-4 h-4" />
                      <h4 className="text-[10px] font-bold uppercase tracking-widest">우선순위 (Priority)</h4>
                    </div>
                    {ruleEditing ? (
                      <select
                        value={ruleForm.priority ?? 99}
                        onChange={e => setRuleForm({ ...ruleForm, priority: e.target.value })}
                        className="w-full bg-[#070b14] border border-orange-500/20 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500 transition-colors"
                      >
                        {Array.from({ length: 99 }, (_, i) => i + 1).map(n => (
                          <option key={n} value={n}>{n} 순위</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-sm font-black text-white font-mono">{ruleForm.priority ?? 99} 순위</span>
                    )}
                  </div>

                  {/* 발동 대기 (지연 타이머) */}
                  <div className="p-4 bg-black/40 rounded-2xl border border-white/5 space-y-3">
                    <div className="flex items-center gap-2 text-blue-400">
                      <Clock className="w-4 h-4" />
                      <h4 className="text-[10px] font-bold uppercase tracking-widest">발동 대기 (초)</h4>
                    </div>
                    {ruleEditing ? (
                      <input
                        type="number"
                        min="0"
                        max="600"
                        step="5"
                        value={ruleForm.delay_sec ?? 0}
                        onChange={e => setRuleForm({ ...ruleForm, delay_sec: e.target.value })}
                        className="w-full bg-[#070b14] border border-blue-500/20 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                      />
                    ) : (
                      <span className="text-sm font-black text-white font-mono">{ruleForm.delay_sec ?? 0} 초</span>
                    )}
                  </div>

                  {/* 최대 반복 횟수 */}
                  <div className="p-4 bg-black/40 rounded-2xl border border-white/5 space-y-3">
                    <div className="flex items-center gap-2 text-amber-400">
                      <Repeat className="w-4 h-4" />
                      <h4 className="text-[10px] font-bold uppercase tracking-widest">최대 반복 횟수</h4>
                    </div>
                    {ruleEditing ? (
                      <input
                        type="number"
                        value={ruleForm.max_call_cnt || ''}
                        onChange={e => setRuleForm(p => ({ ...p, max_call_cnt: e.target.value }))}
                        className="w-full bg-[#0a0e1a]/80 border border-amber-500/20 rounded-xl px-3 py-2 text-sm text-amber-400 font-black focus:outline-none focus:border-amber-500/60 transition-all font-mono"
                      />
                    ) : (
                      <span className="text-sm font-black text-amber-400 font-mono">{ruleForm.max_call_cnt} 회</span>
                    )}
                  </div>
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

                {/* PDS 발신 유효 조건 (Valid Conditions) */}
                <div className="md:col-span-5 space-y-2 mt-2">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 size={10} className="text-emerald-500/60" />
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">PDS 발신 유효 조건 (다중 선택)</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {[
                      { id: 'DAYTIME', label: '주간 발신 허용 (09시~18시)' },
                      { id: 'WEEKEND', label: '주말(토/일) 발신 허용' },
                      { id: 'NIGHT_18', label: '야간 발신 허용 (18시 이후)' },
                      { id: 'NIGHT_19', label: '야간 발신 허용 (19시 이후)' },
                      { id: 'NIGHT_20', label: '야간 발신 허용 (20시 이후)' }
                    ].map(cond => {
                      const isChecked = Array.isArray(ruleForm.valid_conditions) && ruleForm.valid_conditions.includes(cond.id);
                      return (
                        <div
                          key={cond.id}
                          onClick={() => {
                            if (!ruleEditing) return;
                            let newConds = Array.isArray(ruleForm.valid_conditions) ? [...ruleForm.valid_conditions] : [];
                            if (isChecked) {
                              newConds = newConds.filter(c => c !== cond.id);
                            } else {
                              newConds.push(cond.id);
                            }
                            setRuleForm({ ...ruleForm, valid_conditions: newConds });
                          }}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[11px] font-bold transition-all ${
                            ruleEditing ? 'cursor-pointer hover:bg-black/40' : 'cursor-not-allowed opacity-75'
                          } ${isChecked ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-black/20 border-white/5 text-slate-400'}`}
                        >
                          <div className={`w-3.5 h-3.5 rounded-md border flex items-center justify-center ${isChecked ? 'bg-emerald-500 border-emerald-500 text-black' : 'border-slate-600 bg-transparent'}`}>
                            {isChecked && <Check size={10} strokeWidth={4} />}
                          </div>
                          {cond.label}
                        </div>
                      );
                    })}
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
                <div className="flex items-center gap-2">
                  <p className="text-xs font-black text-white">테스트 발송 기기 선택</p>
                  {(() => {
                    const status = getLatestCallStatus();
                    if (!status) return null;
                    const bgClass = status.status === 'CONNECTED'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 animate-pulse'
                      : status.isSuccess === true
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : status.isSuccess === false
                      ? 'bg-red-500/10 text-red-400 border-red-500/20'
                      : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
                    return (
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border ${bgClass}`}>
                        {status.text}
                      </span>
                    );
                  })()}
                </div>
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

          {/* ── Right Column: Sim (top) + PDS API (bottom) ── */}
          <div className="xl:col-span-4 xl:sticky xl:top-[80px] flex flex-col gap-6 pb-20">
            <section className="bg-[#0c1020]/60 backdrop-blur-xl rounded-[2rem] border border-white/5 p-6 shadow-xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/[0.02] to-transparent pointer-events-none" />
          
          <SectionHeader icon={Activity} title="수신자 시뮬레이션" sub="수신자 모의 훈련 및 발신 현황" color="#10b981">
            <div className="flex items-center gap-2">
              <button 
                onClick={handleStartSimulation}
                className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-[10px] font-black transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Play size={12} />
                <span>대상자 덮어쓰기 적용</span>
              </button>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 hidden sm:flex">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Live Monitoring</span>
              </div>
            </div>
          </SectionHeader>

          {/* 실제 콜 발신 대상자 명단 */}
          {ruleForm && (
            <div className={`mb-4 p-3 rounded-2xl border flex items-center justify-between transition-all ${
              strategyStatus.active 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    strategyStatus.active ? 'bg-emerald-400' : 'bg-red-400'
                  }`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${
                    strategyStatus.active ? 'bg-emerald-500' : 'bg-red-500'
                  }`}></span>
                </span>
                <span className="text-[10px] font-black tracking-wide uppercase">
                  {strategyStatus.active ? '전략 적용 중 (Active)' : '전략 미적용 (Inactive)'}
                </span>
              </div>
              <span className="text-[10px] font-bold opacity-80">{strategyStatus.reason}</span>
            </div>
          )}


          <div className="mt-4 mb-6 relative z-10">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <Users size={11} className="text-emerald-400" />
                실제 콜 발신 대상자 명단 {isSubstituteType && <span className="text-cyan-400 font-bold bg-cyan-400/10 px-1.5 py-0.5 rounded text-[8px]">대직자 발신</span>}
              </span>
              <span className="text-[9px] font-bold text-slate-400 font-mono bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
                총 {activeTargets.length}명
              </span>
            </div>

            {tgtLoading ? (
              <div className="flex items-center gap-2 text-slate-500 py-3 text-xs justify-center">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading Targets...
              </div>
            ) : activeTargets.length === 0 ? (
              <div className="p-4 text-center rounded-2xl bg-black/20 border border-dashed border-white/5 text-[10px] text-slate-500">
                등록된 발신 대상자가 없습니다.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
                {activeTargets.map((item, idx) => {
                  const targetCall = hists.find(h => String(h.emp_id || h.EMP_ID).trim() === String(item.emp_id || item.EMP_ID).trim());
                  return (
                    <div 
                      key={item.seq_no || item.SEQ_NO || item.emp_id || item.EMP_ID || idx} 
                      onClick={() => handleCallTarget(item)}
                      className="cursor-pointer flex items-center justify-between bg-black/35 border border-white/5 rounded-2xl p-3 hover:border-emerald-500/30 hover:bg-emerald-500/5 hover:scale-[1.01] transition-all"
                      title="클릭 시 수동 발신 시도"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-xs font-black font-mono">
                          {idx + 1}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-black text-white">{item.emp_nm || item.EMP_NM}</span>
                            <span className="text-[9px] text-slate-500 font-mono">({item.emp_id || item.EMP_ID})</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono font-bold mt-0.5 block">{item.mobile_no || item.MOBILE_NO}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {targetCall && (
                          <div className="flex items-center gap-1.5 mr-2">
                            <span className="text-[9px] font-bold text-slate-400 font-mono bg-white/5 border border-white/10 rounded-md px-1.5 py-0.5">
                              {targetCall.attempt_seq}회차
                            </span>
                            <PdsBadge code={targetCall.pds_result_cd} />
                            {targetCall.duration_sec !== undefined && targetCall.duration_sec !== null && targetCall.duration_sec > 0 && (
                              <span className="text-[9px] font-mono text-cyan-400 bg-cyan-400/10 border border-cyan-400/20 rounded-md px-1.5 py-0.5">
                                {targetCall.duration_sec}초
                              </span>
                            )}
                          </div>
                        )}
                        {isSubstituteType ? (
                          <span className="text-[8px] font-black text-cyan-400 bg-cyan-400/10 border border-cyan-400/20 rounded px-1.5 py-0.5">대직자</span>
                        ) : (
                          <span className="text-[8px] font-black text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 rounded px-1.5 py-0.5">상시</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 구분선 */}
          <div className="h-[1px] bg-white/5 my-4" />

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
                            {log.duration_sec !== undefined && log.duration_sec !== null && log.duration_sec > 0 && (
                              <span className="text-cyan-400 font-mono">({log.duration_sec}초)</span>
                            )}
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
            <section className="bg-[#0c1020]/60 backdrop-blur-xl rounded-[2rem] border border-white/5 p-6 shadow-xl relative overflow-hidden">
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
          <div className="mb-6 p-4 bg-white/[0.02] border border-white/5 rounded-2.5xl relative z-10" style={{ maxHeight: '350px', overflowY: 'auto' }}>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-1.5">
              <Globe size={11} className="text-cyan-400" /> 앱 Webhook 모의 테스트 발송 (Mock Trigger)
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSendMockEvent('DIALING')}
                  disabled={mockSending}
                  className="px-3 py-2 bg-cyan-500/10 hover:bg-cyan-500 border border-cyan-500/30 hover:text-black text-cyan-400 rounded-xl text-[10px] font-black transition-all active:scale-95 cursor-pointer"
                >
                  DIALING 발송
                </button>
                <button
                  type="button"
                  onClick={() => handleSendMockEvent('RINGING')}
                  disabled={mockSending}
                  className="px-3 py-2 bg-amber-500/10 hover:bg-amber-500 border border-amber-500/30 hover:text-black text-amber-400 rounded-xl text-[10px] font-black transition-all active:scale-95 cursor-pointer"
                >
                  RINGING 발송
                </button>
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
                <button
                  type="button"
                  onClick={() => handleSendMockEvent('FAILED')}
                  disabled={mockSending}
                  className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500 border border-rose-500/30 hover:text-black text-rose-400 rounded-xl text-[10px] font-black transition-all active:scale-95 cursor-pointer"
                >
                  FAILED 발송
                </button>
              </div>
            </div>
            
            {/* 통화 경과 시간 및 결과 판단 표시 */}
            {(mockConnectedTime || mockResultText) && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {mockConnectedTime && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black animate-pulse">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>[통화 연결 중] 경과 시간: {mockElapsed}초 (15초 이상 성공 / 미만 실패)</span>
                  </div>
                )}
                {mockResultText && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-300 text-[10px] font-black">
                    <AlertCircle size={11} className="text-orange-400" />
                    <span>[시뮬레이션 판단 결과] {mockResultText}</span>
                  </div>
                )}
              </div>
            )}

            <p className="text-[9px] text-slate-600 mt-2">
              * 입력한 사번과 번호로 앱 수신 Webhook API(<code className="font-mono bg-white/5 px-1 py-0.5 rounded text-amber-500">POST /call/event</code>)를 모의 호출하여 실시간 통화 감지를 테스트합니다.
            </p>
          </div>

          {/* 수신 로그 테이블 */}
          <div className="relative z-10 bg-black/40 rounded-2.5xl border border-white/5 overflow-hidden" style={{ maxHeight: 260, overflowY: 'auto' }}>
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
                            {(() => {
                              const et = (evt.EVENT_TYPE || '').toUpperCase();
                              if (et === 'DIALING') return (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                                  DIALING
                                </span>
                              );
                              if (et === 'RINGING') return (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                  RINGING
                                </span>
                              );
                              if (et === 'CONNECTED') return (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  CONNECTED
                                </span>
                              );
                              if (et === 'DISCONNECTED') return (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-500/10 text-slate-400 border border-white/5">
                                  DISCONNECTED
                                </span>
                              );
                              if (et === 'MISSED') return (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-500/10 text-red-400 border border-red-500/20">
                                  MISSED
                                </span>
                              );
                              if (et === 'FAILED') return (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                  FAILED
                                </span>
                              );
                              return <span className="text-slate-500 font-mono">{evt.EVENT_TYPE}</span>;
                            })()}
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

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">우선순위</label>
                    <select
                      value={newStrategy.priority}
                      onChange={e => setNewStrategy(p => ({ ...p, priority: e.target.value }))}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white focus:outline-none focus:border-orange-500/50 font-mono tracking-tighter"
                    >
                      {Array.from({ length: strategies.length + 1 }, (_, i) => i + 1).map(n => (
                        <option key={n} value={n}>{n} 순위</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">발동 대기 (초)</label>
                    <input
                      type="number"
                      min="0"
                      max="600"
                      step="5"
                      value={newStrategy.delay_sec}
                      onChange={e => setNewStrategy(p => ({ ...p, delay_sec: e.target.value }))}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white focus:outline-none focus:border-blue-500/50 font-mono tracking-tighter"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">최대 발신 횟수</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={newStrategy.max_call_cnt}
                        onChange={e => setNewStrategy(p => ({ ...p, max_call_cnt: e.target.value }))}
                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-sm text-amber-400 font-black focus:outline-none focus:border-amber-500/50 font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mt-4">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">PDS 발신 유효 조건 (다중 선택)</label>
                  <div className="flex flex-wrap items-center gap-3">
                    {[
                      { id: 'DAYTIME', label: '주간 발신 허용 (09시~18시)' },
                      { id: 'WEEKEND', label: '주말(토/일) 발신 허용' },
                      { id: 'NIGHT_18', label: '야간 발신 허용 (18시 이후)' },
                      { id: 'NIGHT_19', label: '야간 발신 허용 (19시 이후)' },
                      { id: 'NIGHT_20', label: '야간 발신 허용 (20시 이후)' }
                    ].map(cond => {
                      const isChecked = Array.isArray(newStrategy.valid_conditions) && newStrategy.valid_conditions.includes(cond.id);
                      return (
                        <label key={cond.id} className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[11px] font-bold cursor-pointer transition-all ${isChecked ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-black/20 border-white/5 text-slate-400 hover:bg-black/40'}`}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              let newConds = Array.isArray(newStrategy.valid_conditions) ? [...newStrategy.valid_conditions] : [];
                              if (e.target.checked) newConds.push(cond.id);
                              else newConds = newConds.filter(c => c !== cond.id);
                              setNewStrategy({ ...newStrategy, valid_conditions: newConds });
                            }}
                            className="hidden"
                          />
                          <div className={`w-3.5 h-3.5 rounded-md border flex items-center justify-center ${isChecked ? 'bg-emerald-500 border-emerald-500 text-black' : 'border-slate-600 bg-transparent'}`}>
                            {isChecked && <Check size={10} strokeWidth={4} />}
                          </div>
                          {cond.label}
                        </label>
                      );
                    })}
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

