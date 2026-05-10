import React, { useState, useEffect } from 'react';
import {
  Bell, RefreshCw, ShieldAlert, ArrowLeft, CheckCircle2,
  XCircle, AlertCircle, Server, Wifi, Lock, Zap, Terminal,
  Activity, Radio, Trash2, Database, MonitorSmartphone
} from 'lucide-react';
import { useBackNavigation } from '../hooks/useBackNavigation';
import { getAccessToken } from '../lib/authStore';

const API_BASE = 'https://sguardai.khcho0421.workers.dev';

/* ── Status helpers ───────────────────────────────────────────── */
function statusColor(ok, warn) {
  if (ok)   return { fg: '#10b981', bg: 'rgba(16,185,129,0.12)', bd: 'rgba(16,185,129,0.3)' };
  if (warn) return { fg: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  bd: 'rgba(245,158,11,0.3)' };
  return      { fg: '#ef4444', bg: 'rgba(239,68,68,0.12)',        bd: 'rgba(239,68,68,0.3)' };
}

function StatusBadge({ label, isOk, isWarn }) {
  const c = statusColor(isOk, isWarn);
  const Icon = isOk ? CheckCircle2 : isWarn ? AlertCircle : XCircle;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 9px', borderRadius: 20,
      background: c.bg, border: `1px solid ${c.bd}`,
      color: c.fg, fontSize: 10, fontWeight: 800, letterSpacing: '0.04em',
      whiteSpace: 'nowrap',
    }}>
      <Icon size={10} />
      {label}
    </span>
  );
}

/* ── Card ─────────────────────────────────────────────────────── */
function Card({ accent = '#3b82f6', icon: Icon, title, children, style = {} }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 20, overflow: 'hidden',
      boxShadow: `0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)`,
      ...style,
    }}>
      <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${accent}90, transparent)` }} />
      <div style={{ padding: '16px 18px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: `${accent}18`, border: `1px solid ${accent}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={13} color={accent} />
          </div>
          <span style={{ fontSize: 10, fontWeight: 900, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>{title}</span>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ── Info Row ─────────────────────────────────────────────────── */
function Row({ label, children }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
    }}>
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>{label}</span>
      {children}
    </div>
  );
}

/* ── Action Button ────────────────────────────────────────────── */
function Btn({ onClick, disabled, color = '#3b82f6', icon: Icon, children, outline = false, full = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: full ? '100%' : 'auto',
        flex: full ? undefined : 1,
        padding: '11px 10px',
        borderRadius: 12,
        border: outline ? `1px solid ${color}35` : 'none',
        background: disabled
          ? 'rgba(255,255,255,0.04)'
          : outline
            ? `${color}0e`
            : `linear-gradient(135deg, ${color}, ${color}cc)`,
        color: disabled ? 'rgba(255,255,255,0.2)' : outline ? color : '#fff',
        fontSize: 11, fontWeight: 800, cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        transition: 'all 0.2s',
        boxShadow: !outline && !disabled ? `0 4px 14px ${color}33` : 'none',
        letterSpacing: '0.01em',
      }}
    >
      {Icon && <Icon size={12} />}
      {children}
    </button>
  );
}

/* ── Main ─────────────────────────────────────────────────────── */
export default function PushDiagnosticPage() {
  const goBack = useBackNavigation('/dashboard');
  const [status,    setStatus]    = useState(null);
  const [serverSubs, setServerSubs] = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [permLoad,  setPermLoad]  = useState(false);
  const [subLoad,   setSubLoad]   = useState(false);
  const [log,       setLog]       = useState([]);
  const [customTitle, setCustomTitle] = useState('[S-Guard] 커스텀 테스트');
  const [customBody,  setCustomBody]  = useState('이것은 커스텀 데이터 테스트 메시지입니다. 📱');
  const [customLoad,  setCustomLoad]  = useState(false);

  const addLog = (msg, type = 'info') =>
    setLog(prev => [{ msg, type, time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }, ...prev].slice(0, 50));

  const checkStatus = async () => {
    const sw      = 'serviceWorker' in navigator;
    const pushApi = 'PushManager' in window;
    const notif   = 'Notification' in window;
    const perm    = notif ? Notification.permission : 'unsupported';
    let swReg = null, currentSub = null;
    try {
      swReg = await navigator.serviceWorker.getRegistration('/');
      if (swReg) currentSub = await swReg.pushManager.getSubscription();
    } catch {}
    setStatus({ sw, pushApi, notif, perm, swReg: !!swReg, currentSub: !!currentSub, endpoint: currentSub?.endpoint });
    return { swReg, currentSub };
  };

  const fetchServerSubs = async () => {
    try {
      const res  = await fetch(`${API_BASE}/debug/push-subscriptions?pass=verify`);
      const data = await res.json();
      setServerSubs(data);
      addLog(`서버 구독 ${data.count}건`, data.count > 0 ? 'ok' : 'err');
    } catch (e) { addLog('서버 조회 실패: ' + e.message, 'err'); }
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
    setPermLoad(true);
    addLog('알림 권한 요청 중...');
    try {
      const r = await Notification.requestPermission();
      addLog(`알림 권한: ${r}`, r === 'granted' ? 'ok' : 'err');
      await checkStatus();
    } catch (e) { addLog('권한 요청 실패: ' + e.message, 'err'); }
    setPermLoad(false);
  };

  const handleSubscribe = async () => {
    setSubLoad(true);
    addLog('푸시 구독 시작...');
    try {
      let perm = Notification.permission;
      if (perm === 'default') { perm = await Notification.requestPermission(); addLog(`권한: ${perm}`, perm === 'granted' ? 'ok' : 'err'); }
      if (perm !== 'granted') { addLog('❌ 알림 권한 없음', 'err'); setSubLoad(false); return; }
      addLog('VAPID 키 요청 중...');
      const keyRes = await fetch(`${API_BASE}/auth/push-vapid-public`);
      if (!keyRes.ok) throw new Error(`VAPID ${keyRes.status}`);
      const { publicKey } = await keyRes.json();
      addLog('VAPID 키 획득 ✅', 'ok');
      const reg = await navigator.serviceWorker.ready;
      addLog('SW 준비 완료 ✅', 'ok');
      const existing = await reg.pushManager.getSubscription();
      if (existing) { await existing.unsubscribe(); addLog('기존 구독 해제', 'warn'); }
      function urlB64ToUint8(b64) {
        const p = '='.repeat((4 - b64.length % 4) % 4);
        const raw = atob((b64 + p).replace(/-/g, '+').replace(/_/g, '/'));
        const arr = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
        return arr;
      }
      addLog('구독 생성 중...');
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8(publicKey) });
      addLog('구독 생성 ✅', 'ok');
      const token = getAccessToken();
      if (!token) { addLog('⚠️ 인증 토큰 없음 — 서버 동기화 스킵', 'warn'); setSubLoad(false); return; }
      addLog('서버 동기화 중...');
      const syncRes = await fetch(`${API_BASE}/auth/push-subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ subscription: sub })
      });
      const syncData = await syncRes.json();
      addLog(syncRes.ok ? '✅ 서버 동기화 완료!' : `서버 오류: ${JSON.stringify(syncData)}`, syncRes.ok ? 'ok' : 'err');
    } catch (e) { addLog('오류: ' + e.message, 'err'); }
    await checkStatus(); await fetchServerSubs(); setSubLoad(false);
  };

  const handleTestPush = async () => {
    addLog('테스트 푸시 요청 중...');
    try {
      const token = getAccessToken();
      const res = await fetch(`${API_BASE}/auth/push-test`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        addLog(`✅ 테스트 푸시 발송 (대상: ${data.target})`, 'ok');
        (data.results || []).forEach(r => {
          if (r.error) addLog(`❌ 전송 실패: ${r.error}`, 'err');
          else addLog(`📡 [${r.status}] ${r.ok ? '✅성공' : '❌실패'} body:${r.bodySize}B | h:${(r.sentHeaders||[]).join(',')} | 응답:${r.responseBody || '없음'}`, r.ok ? 'info' : 'err');
        });
        if (!data.results?.length) addLog('⚠️ 등록된 구독 기기 없음', 'warn');
      } else {
        const data = await res.json();
        addLog('실패: ' + (data.error || res.status), 'err');
      }
    } catch (e) { addLog('오류: ' + e.message, 'err'); }
  };

  const handleCustomPush = async () => {
    if (!customTitle.trim() || !customBody.trim()) { addLog('⚠️ 제목과 내용을 입력하세요', 'warn'); return; }
    setCustomLoad(true);
    addLog(`커스텀 푸시 발송 중... title="${customTitle}"`);
    try {
      const token = getAccessToken();
      const res = await fetch(`${API_BASE}/push/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          target_user_id: JSON.parse(localStorage.getItem('sguard_user') || '{}').employee_id || '',
          title: customTitle,
          body: customBody,
          url: '/push-diagnostic',
          tag: 'custom-test'
        })
      });
      const data = await res.json();
      if (res.ok) {
        addLog(`✅ 커스텀 푸시 발송 완료 (대상: ${data.target})`, 'ok');
        (data.results || []).forEach(r => {
          if (r.error) addLog(`❌ 전송 실패: ${r.error}`, 'err');
          else addLog(`📡 [${r.status}] ${r.ok ? '✅성공' : '❌실패'} body:${r.bodySize}B | h:${(r.sentHeaders||[]).join(',')} | 응답:${r.responseBody || '없음'}`, r.ok ? 'info' : 'err');
        });
        if (!data.results?.length) addLog('⚠️ 등록된 구독 기기 없음', 'warn');
      } else {
        addLog('실패: ' + (data.error || res.status), 'err');
      }
    } catch (e) { addLog('오류: ' + e.message, 'err'); }
    setCustomLoad(false);
  };

  const handleDeepClean = async () => {
    if (!window.confirm('서비스워커와 캐시를 삭제합니다. 진행할까요?')) return;
    addLog('딥 클린 시작...');
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) await r.unregister();
      addLog('SW 해제 완료', 'ok');
      const keys = await caches.keys();
      for (const k of keys) await caches.delete(k);
      addLog('캐시 삭제 완료', 'ok');
      addLog('3초 후 새로고침...');
      setTimeout(() => window.location.reload(), 3000);
    } catch (e) { addLog('오류: ' + e.message, 'err'); }
  };

  /* health score */
  const health    = status ? [status.sw, status.pushApi, status.perm === 'granted', status.swReg, status.currentSub, (serverSubs?.count ?? 0) > 0].filter(Boolean).length : 0;
  const healthMax = 6;
  const healthPct = Math.round((health / healthMax) * 100);
  const hColor    = healthPct >= 80 ? '#10b981' : healthPct >= 50 ? '#f59e0b' : '#ef4444';

  const spin = { animation: 'spin 1s linear infinite' };

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'radial-gradient(ellipse 120% 100% at 50% 0%, #0d1528 0%, #080e1a 40%, #050a15 100%)',
      color: '#fff',
      fontFamily: "'Inter', 'Noto Sans KR', sans-serif",
      overflowY: 'auto',
      WebkitOverflowScrolling: 'touch',
    }}>

      {/* ── Hero ────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(160deg, #030a2a 0%, #001155 55%, #002080 100%)',
        padding: 'calc(50px + env(safe-area-inset-top)) 20px 28px',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* glows */}
        <div style={{ position: 'absolute', top: -80, right: -60, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -50, left: -50, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.09) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px)', backgroundSize: '28px 28px', pointerEvents: 'none' }} />

        {/* back */}
        <button
          onClick={() => goBack()}
          style={{
            position: 'absolute', top: 'calc(14px + env(safe-area-inset-top))', left: 16,
            background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
            padding: '6px 12px', color: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, zIndex: 2,
          }}
        >
          <ArrowLeft size={13} /> 뒤로
        </button>

        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <div style={{
            width: 52, height: 52, borderRadius: 16, margin: '0 auto 12px',
            background: 'linear-gradient(135deg, rgba(59,130,246,0.25), rgba(16,185,129,0.18))',
            border: '1px solid rgba(59,130,246,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 28px rgba(59,130,246,0.28)',
          }}>
            <Radio size={24} color="#60a5fa" />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 900, letterSpacing: '0.06em', margin: '0 0 3px' }}>Push Diagnostic</h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, margin: '0 0 18px' }}>실시간 알림 상태 진단 및 구독 등록</p>

          {/* Health pill */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(8px)',
            border: `1px solid ${hColor}30`, borderRadius: 50, padding: '7px 18px',
          }}>
            <Activity size={13} color={hColor} />
            <span style={{ fontSize: 12, fontWeight: 900, color: hColor }}>
              Health {status ? `${healthPct}%` : '—'}
            </span>
            <span style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.1)' }} />
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>
              {status ? `${health} / ${healthMax} 정상` : '확인 중...'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────── */}
      <div style={{
        padding: '18px 14px',
        maxWidth: 860, margin: '0 auto',
        paddingBottom: 'calc(80px + env(safe-area-inset-bottom))',
      }}>

        {/* ── 2-column top grid ─────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>

          {/* 브라우저 환경 */}
          <Card icon={Wifi} title="브라우저 환경" accent="#3b82f6">
            {status ? (
              <>
                <Row label="Service Worker">
                  <StatusBadge label={status.sw ? 'OK' : 'N/A'} isOk={status.sw} />
                </Row>
                <Row label="Push API">
                  <StatusBadge label={status.pushApi ? 'OK' : 'N/A'} isOk={status.pushApi} />
                </Row>
                <Row label="알림 권한">
                  <StatusBadge
                    label={status.perm === 'granted' ? 'Allowed' : status.perm === 'denied' ? 'Denied' : 'Default'}
                    isOk={status.perm === 'granted'}
                    isWarn={status.perm === 'default'}
                  />
                </Row>
                <Row label="SW 등록">
                  <StatusBadge label={status.swReg ? 'Active' : 'None'} isOk={status.swReg} />
                </Row>
                <Row label="구독 상태">
                  <StatusBadge label={status.currentSub ? 'Subscribed' : 'None'} isOk={status.currentSub} />
                </Row>
                {status.endpoint && (
                  <div style={{ marginTop: 10, padding: '7px 9px', background: 'rgba(59,130,246,0.05)', borderRadius: 8, border: '1px solid rgba(59,130,246,0.1)' }}>
                    <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', fontWeight: 700, letterSpacing: '0.1em', margin: '0 0 3px', textTransform: 'uppercase' }}>Endpoint</p>
                    <p style={{ fontSize: 9, color: 'rgba(96,165,250,0.7)', fontFamily: 'monospace', wordBreak: 'break-all', margin: 0, lineHeight: 1.5 }}>
                      {status.endpoint.substring(0, 72)}...
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
                <RefreshCw size={12} style={spin} /> 확인 중...
              </div>
            )}
          </Card>

          {/* 서버 DB 상태 */}
          <Card icon={Database} title="서버 DB 상태" accent="#10b981">
            {serverSubs ? (
              <>
                <Row label="등록 구독 수">
                  <StatusBadge label={`${serverSubs.count}건`} isOk={serverSubs.count > 0} />
                </Row>
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(serverSubs.subscriptions || []).slice(0, 4).map((s, i) => (
                    <div key={i} style={{
                      padding: '8px 10px', borderRadius: 10,
                      background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.12)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                        <Lock size={9} color="#10b981" />
                        <span style={{ fontSize: 10, color: '#10b981', fontWeight: 700 }}>User: {s.user_id}</span>
                      </div>
                      <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace', margin: 0, wordBreak: 'break-all', lineHeight: 1.5 }}>
                        {s.endpoint?.substring(0, 60)}...
                      </p>
                    </div>
                  ))}
                  {!serverSubs.subscriptions?.length && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 0', color: 'rgba(239,68,68,0.6)', fontSize: 11 }}>
                      <XCircle size={12} /> 등록된 구독 없음
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
                <RefreshCw size={12} style={spin} /> 조회 중...
              </div>
            )}
          </Card>
        </div>

        {/* ── 2-column bottom grid ───────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

          {/* 액션 */}
          <Card icon={Zap} title="액션" accent="#6366f1">
            {/* 메인 구독 버튼 */}
            <button
              onClick={handleSubscribe}
              disabled={subLoad}
              style={{
                width: '100%', padding: '13px', borderRadius: 12, border: 'none',
                background: subLoad ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #2563eb, #0ea5e9)',
                color: subLoad ? 'rgba(255,255,255,0.3)' : '#fff',
                fontSize: 12, fontWeight: 800, cursor: subLoad ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                marginBottom: 8,
                boxShadow: subLoad ? 'none' : '0 5px 18px rgba(37,99,235,0.3)',
                transition: 'all 0.2s',
              }}
            >
              {subLoad
                ? <><RefreshCw size={13} style={spin} /> 처리 중...</>
                : <><Bell size={13} /> 🔔 푸시 구독 등록</>
              }
            </button>

            {/* 보조 버튼 */}
            <div style={{ display: 'flex', gap: 7, marginBottom: 8 }}>
              <Btn onClick={handleRequestPermission} disabled={permLoad} color="#f59e0b" icon={Bell} outline>
                {permLoad ? '...' : '권한 요청'}
              </Btn>
              <Btn onClick={refresh} disabled={loading} color="#64748b" outline
                icon={() => <RefreshCw size={11} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />}>
                새로고침
              </Btn>
            </div>

            {/* 테스트 푸시 (기본) */}
            <button
              onClick={handleTestPush}
              style={{
                width: '100%', padding: '11px', borderRadius: 11,
                border: '1px solid rgba(16,185,129,0.25)',
                background: 'rgba(16,185,129,0.07)', color: '#10b981',
                fontSize: 11, fontWeight: 800, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                marginBottom: 7, transition: 'all 0.2s',
              }}
            >
              <ShieldAlert size={13} /> 🚀 기본 테스트 푸시
            </button>

            {/* 커스텀 데이터 테스트 */}
            <div style={{ marginBottom: 7, padding: '12px', borderRadius: 12, border: '1px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.06)' }}>
              <p style={{ fontSize: 9, fontWeight: 900, color: 'rgba(99,102,241,0.8)', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 8px' }}>커스텀 데이터 테스트</p>
              <input
                value={customTitle}
                onChange={e => setCustomTitle(e.target.value)}
                placeholder="알림 제목"
                style={{
                  width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: 11, marginBottom: 6, boxSizing: 'border-box'
                }}
              />
              <textarea
                value={customBody}
                onChange={e => setCustomBody(e.target.value)}
                placeholder="알림 내용 (SMS 메시지 내용 등)"
                rows={2}
                style={{
                  width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: 11, marginBottom: 8,
                  resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit'
                }}
              />
              <button
                onClick={handleCustomPush}
                disabled={customLoad}
                style={{
                  width: '100%', padding: '9px', borderRadius: 9,
                  border: 'none',
                  background: customLoad ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  color: customLoad ? 'rgba(255,255,255,0.3)' : '#fff',
                  fontSize: 11, fontWeight: 800, cursor: customLoad ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  boxShadow: customLoad ? 'none' : '0 4px 14px rgba(99,102,241,0.35)',
                  transition: 'all 0.2s',
                }}
              >
                {customLoad ? <><RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} /> 발송 중...</> : <><Radio size={11} /> 커스텀 데이터 발송</>}
              </button>
            </div>

            {/* 딥 클린 */}
            <button
              onClick={handleDeepClean}
              style={{
                width: '100%', padding: '10px', borderRadius: 10,
                border: '1px solid rgba(239,68,68,0.18)',
                background: 'rgba(239,68,68,0.04)', color: '#f87171',
                fontSize: 11, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                transition: 'all 0.2s',
              }}
            >
              <Trash2 size={12} /> 딥 클린 (SW + 캐시 초기화)
            </button>
          </Card>

          {/* 실시간 로그 */}
          <Card icon={Terminal} title="실시간 로그" accent="#6366f1">
            <div style={{
              background: 'rgba(0,0,0,0.45)', borderRadius: 10,
              border: '1px solid rgba(99,102,241,0.12)',
              padding: '9px 11px',
              height: 240, overflowY: 'auto',
              fontFamily: "'JetBrains Mono','Fira Code',monospace", fontSize: 10,
            }}>
              {log.length === 0 && (
                <span style={{ color: 'rgba(255,255,255,0.18)' }}>대기 중...</span>
              )}
              {log.map((e, i) => (
                <div key={i} style={{ marginBottom: 5, display: 'flex', gap: 7, alignItems: 'flex-start', lineHeight: 1.5 }}>
                  <span style={{ color: '#1e293b', flexShrink: 0, fontSize: 9 }}>[{e.time}]</span>
                  <span style={{
                    color: e.type === 'ok'   ? '#34d399'
                         : e.type === 'err'  ? '#f87171'
                         : e.type === 'warn' ? '#fbbf24'
                         : '#94a3b8',
                  }}>{e.msg}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>
    </div>
  );
}
