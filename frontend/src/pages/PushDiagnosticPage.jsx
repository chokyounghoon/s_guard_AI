import React, { useState, useEffect } from 'react';
import { ShieldAlert, RefreshCw, Bell, Server, Cpu, CheckCircle, XCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getAccessToken } from '../lib/authStore';

const API_BASE = 'https://sguardai.khcho0421.workers.dev';

function StatusBadge({ value, okValues = [], warnValues = [] }) {
  const isOk = okValues.includes(value);
  const isWarn = warnValues.includes(value);
  const color = isOk ? '#10b981' : isWarn ? '#f59e0b' : '#ef4444';
  const Icon = isOk ? CheckCircle : isWarn ? AlertCircle : XCircle;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 10px', borderRadius: 20,
      background: `${color}18`, border: `1px solid ${color}30`,
      color, fontSize: 12, fontWeight: 700
    }}>
      <Icon size={12} />
      {value}
    </span>
  );
}

function Row({ label, children }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)'
    }}>
      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{label}</span>
      {children}
    </div>
  );
}

function Card({ title, children, accent = '#3b82f6' }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 20, padding: '20px', marginBottom: 16,
      position: 'relative', overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, transparent, ${accent}, transparent)`
      }} />
      <p style={{
        fontSize: 10, fontWeight: 900, color: 'rgba(255,255,255,0.3)',
        letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 14
      }}>{title}</p>
      {children}
    </div>
  );
}

export default function PushDiagnosticPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [serverSubs, setServerSubs] = useState(null);
  const [loading, setLoading] = useState(false);
  const [permLoading, setPermLoading] = useState(false);
  const [subLoading, setSubLoading] = useState(false);
  const [log, setLog] = useState([]);

  const addLog = (msg, type = 'info') => {
    setLog(prev => [{ msg, type, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 30));
  };

  const checkStatus = async () => {
    const sw = 'serviceWorker' in navigator;
    const pushApi = 'PushManager' in window;
    const notif = 'Notification' in window;
    const perm = notif ? Notification.permission : 'unsupported';

    let swReg = null;
    let currentSub = null;
    try {
      swReg = await navigator.serviceWorker.getRegistration('/');
      if (swReg) currentSub = await swReg.pushManager.getSubscription();
    } catch (e) { /* ignore */ }

    setStatus({ sw, pushApi, notif, perm, swReg: !!swReg, currentSub: !!currentSub, endpoint: currentSub?.endpoint });
    return { swReg, currentSub };
  };

  const fetchServerSubs = async () => {
    try {
      const res = await fetch(`${API_BASE}/debug/push-subscriptions?pass=verify`);
      const data = await res.json();
      setServerSubs(data);
      addLog(`서버 구독 수: ${data.count}건`, data.count > 0 ? 'ok' : 'err');
    } catch (e) {
      addLog('서버 조회 실패: ' + e.message, 'err');
    }
  };

  const refresh = async () => {
    setLoading(true);
    addLog('상태 새로고침...');
    await checkStatus();
    await fetchServerSubs();
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const handleRequestPermission = async () => {
    setPermLoading(true);
    addLog('알림 권한 요청 중...');
    try {
      const result = await Notification.requestPermission();
      addLog(`알림 권한: ${result}`, result === 'granted' ? 'ok' : 'err');
      await checkStatus();
    } catch (e) {
      addLog('권한 요청 실패: ' + e.message, 'err');
    }
    setPermLoading(false);
  };

  const handleSubscribe = async () => {
    setSubLoading(true);
    addLog('푸시 구독 시작...');

    try {
      // 1. 권한 확인
      let perm = Notification.permission;
      if (perm === 'default') {
        perm = await Notification.requestPermission();
        addLog(`권한 응답: ${perm}`, perm === 'granted' ? 'ok' : 'err');
      }
      if (perm !== 'granted') {
        addLog('❌ 알림 권한 없음. 설정에서 허용 필요.', 'err');
        setSubLoading(false);
        return;
      }

      // 2. VAPID 키
      addLog('VAPID 키 가져오는 중...');
      const keyRes = await fetch(`${API_BASE}/auth/push-vapid-public`);
      if (!keyRes.ok) throw new Error(`VAPID fetch failed: ${keyRes.status}`);
      const { publicKey } = await keyRes.json();
      addLog('VAPID 키 획득 ✅', 'ok');

      // 3. SW
      addLog('서비스워커 연결 중...');
      const reg = await navigator.serviceWorker.ready;
      addLog('서비스워커 준비 완료 ✅', 'ok');

      // 4. 기존 구독 해제
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        await existing.unsubscribe();
        addLog('기존 구독 해제됨', 'warn');
      }

      // 5. 신규 구독
      function urlB64ToUint8(b64) {
        const padding = '='.repeat((4 - b64.length % 4) % 4);
        const base64 = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/');
        const raw = atob(base64);
        const arr = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
        return arr;
      }
      addLog('새 구독 생성 중...');
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8(publicKey)
      });
      addLog('구독 생성 성공 ✅', 'ok');

      // 6. 서버 동기화
      const token = getAccessToken();
      if (!token) {
        addLog('⚠️ 인증 토큰 없음. 서버 동기화 스킵.', 'warn');
        setSubLoading(false);
        return;
      }
      addLog('서버 동기화 중...');
      const syncRes = await fetch(`${API_BASE}/auth/push-subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ subscription: sub })
      });
      const syncData = await syncRes.json();
      if (syncRes.ok) {
        addLog('✅ 서버 동기화 완료!', 'ok');
      } else {
        addLog(`서버 오류: ${JSON.stringify(syncData)}`, 'err');
      }
    } catch (e) {
      addLog('오류: ' + e.message, 'err');
    }

    await checkStatus();
    await fetchServerSubs();
    setSubLoading(false);
  };

  const handleTestPush = async () => {
    addLog('테스트 푸시 요청 중...');
    try {
      const token = getAccessToken();
      const res = await fetch(`${API_BASE}/auth/push-test`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        addLog(`✅ 테스트 푸시 요청 성공! (대상: ${data.target})`, 'ok');
        if (data.results && data.results.length > 0) {
          data.results.forEach(r => {
            if (r.error) addLog(`❌ 전송 실패: ${r.error}`, 'err');
            else addLog(`📡 전송 응답: ${r.status} (${r.ok ? '성공' : '실패'})`, r.ok ? 'info' : 'err');
          });
        } else {
          addLog('⚠️ 등록된 구독 기기가 없습니다.', 'warn');
        }
      } else {
        const data = await res.json();
        addLog('테스트 푸시 실패: ' + (data.error || res.status), 'err');
      }
    } catch (e) {
      addLog('테스트 푸시 오류: ' + e.message, 'err');
    }
  };

  const handleDeepClean = async () => {
    if (!window.confirm('서비스워커와 캐시를 모두 삭제하고 페이지를 새로고침합니다. 진행할까요?')) return;
    addLog('딥 클린 시작...');
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) await reg.unregister();
      addLog('서비스워커 해제 완료', 'ok');

      const keys = await caches.keys();
      for (const key of keys) await caches.delete(key);
      addLog('브라우저 캐시 삭제 완료', 'ok');

      addLog('3초 후 페이지를 새로고침합니다...');
      setTimeout(() => window.location.reload(), 3000);
    } catch (e) {
      addLog('클린 오류: ' + e.message, 'err');
    }
  };

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#05091a',
      color: '#fff',
      fontFamily: "'Inter', 'Noto Sans KR', sans-serif",
      paddingBottom: 'calc(80px + env(safe-area-inset-bottom))'
    }}>
      {/* 헤더 */}
      <div style={{
        background: 'linear-gradient(160deg, #001550 0%, #0030cc 50%, #0046FF 100%)',
        padding: '52px 20px 28px',
        position: 'relative', overflow: 'hidden'
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 70% 10%, rgba(255,255,255,0.1), transparent 60%)' }} />
        <button
          onClick={() => navigate(-1)}
          style={{ position: 'absolute', top: 52, left: 20, background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 10, padding: '8px 12px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700 }}
        >
          <ArrowLeft size={14} /> Back
        </button>
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 6 }}>
            <Bell size={20} color="#60a5fa" />
            <h1 style={{ fontSize: 22, fontWeight: 900, letterSpacing: '0.05em', margin: 0 }}>Push Diagnostic</h1>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, margin: 0 }}>실시간 알림 상태 진단 및 구독 등록</p>
        </div>
      </div>

      <div style={{ padding: '24px 20px', maxWidth: 480, margin: '0 auto' }}>

        {/* 상태 카드 */}
        <Card title="📡 브라우저 환경" accent="#3b82f6">
          {status ? (
            <>
              <Row label="Service Worker"><StatusBadge value={status.sw ? 'Supported' : 'Unsupported'} okValues={['Supported']} /></Row>
              <Row label="Push API"><StatusBadge value={status.pushApi ? 'Supported' : 'Unsupported'} okValues={['Supported']} /></Row>
              <Row label="알림 권한"><StatusBadge value={status.perm === 'granted' ? 'Allowed' : status.perm === 'denied' ? 'Denied' : 'Default'} okValues={['Allowed']} warnValues={['Default']} /></Row>
              <Row label="SW 등록"><StatusBadge value={status.swReg ? 'Registered' : 'Not Registered'} okValues={['Registered']} /></Row>
              <Row label="현재 구독"><StatusBadge value={status.currentSub ? 'Subscribed' : 'Not Subscribed'} okValues={['Subscribed']} /></Row>
            </>
          ) : (
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>확인 중...</p>
          )}
        </Card>

        {/* 서버 상태 */}
        <Card title="🗄️ 서버 DB 상태" accent="#10b981">
          {serverSubs ? (
            <>
              <Row label="등록된 구독 수">
                <StatusBadge value={`${serverSubs.count}건`} okValues={serverSubs.count > 0 ? [`${serverSubs.count}건`] : []} />
              </Row>
              {serverSubs.subscriptions?.map((s, i) => (
                <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 11 }}>
                  <div style={{ color: '#60a5fa', fontWeight: 700 }}>User: {s.user_id}</div>
                  <div style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', marginTop: 2, wordBreak: 'break-all' }}>
                    {s.endpoint?.substring(0, 60)}...
                  </div>
                </div>
              ))}
            </>
          ) : (
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>조회 중...</p>
          )}
        </Card>

        {/* 액션 버튼들 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          <button
            onClick={handleSubscribe}
            disabled={subLoading}
            style={{
              width: '100%', padding: '16px', borderRadius: 14, border: 'none',
              background: subLoading ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #0046FF, #0ea5e9)',
              color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'all 0.2s'
            }}
          >
            <Bell size={16} />
            {subLoading ? '처리 중...' : '🔔 지금 푸시 구독 등록'}
          </button>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleRequestPermission}
              disabled={permLoading}
              style={{
                flex: 1, padding: '13px', borderRadius: 12, border: '1px solid rgba(245,158,11,0.3)',
                background: 'rgba(245,158,11,0.08)', color: '#f59e0b',
                fontSize: 12, fontWeight: 700, cursor: 'pointer'
              }}
            >
              {permLoading ? '...' : '📣 권한 요청'}
            </button>
            <button
              onClick={refresh}
              disabled={loading}
              style={{
                flex: 1, padding: '13px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
              }}
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> 새로고침
            </button>
            <button
              onClick={handleDeepClean}
              style={{
                flex: 1, padding: '13px', borderRadius: 12, border: '1px solid rgba(239,68,68,0.2)',
                background: 'rgba(239,68,68,0.05)', color: '#ef4444',
                fontSize: 12, fontWeight: 700, cursor: 'pointer'
              }}
            >
              🧹 딥 클린 (초기화)
            </button>
          </div>
          <button
            onClick={handleTestPush}
            style={{
              width: '100%', padding: '16px', borderRadius: 14, border: '1px solid rgba(16,185,129,0.3)',
              background: 'rgba(16,185,129,0.08)', color: '#10b981',
              fontSize: 14, fontWeight: 800, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              marginTop: 10
            }}
          >
            <ShieldAlert size={16} /> 🚀 테스트 푸시 발송 (나에게)
          </button>
        </div>

        {/* 로그 */}
        <Card title="📝 실시간 로그" accent="#6366f1">
          <div style={{
            background: '#000', borderRadius: 10, padding: '12px', maxHeight: 200,
            overflowY: 'auto', fontFamily: 'monospace', fontSize: 11
          }}>
            {log.length === 0 && <span style={{ color: 'rgba(255,255,255,0.2)' }}>로그 없음...</span>}
            {log.map((entry, i) => (
              <div key={i} style={{ marginBottom: 6, color: entry.type === 'ok' ? '#10b981' : entry.type === 'err' ? '#ef4444' : entry.type === 'warn' ? '#f59e0b' : '#94a3b8' }}>
                <span style={{ color: '#475569' }}>[{entry.time}]</span> {entry.msg}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
