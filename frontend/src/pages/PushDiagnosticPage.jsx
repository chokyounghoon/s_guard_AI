import React, { useState, useEffect } from 'react';
import {
  Bell, RefreshCw, ShieldAlert, ArrowLeft, CheckCircle2,
  XCircle, AlertCircle, Server, Wifi, Lock, Zap, Terminal,
  ChevronRight, Activity, Radio
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useBackNavigation } from '../hooks/useBackNavigation';
import { getAccessToken } from '../lib/authStore';

const API_BASE = 'https://sguardai.khcho0421.workers.dev';

/* ── Status helpers ───────────────────────────────────────────── */
function statusColor(ok, warn) {
  if (ok) return { fg: '#10b981', bg: 'rgba(16,185,129,0.12)', bd: 'rgba(16,185,129,0.25)' };
  if (warn) return { fg: '#f59e0b', bg: 'rgba(245,158,11,0.12)', bd: 'rgba(245,158,11,0.25)' };
  return { fg: '#ef4444', bg: 'rgba(239,68,68,0.12)', bd: 'rgba(239,68,68,0.25)' };
}

function StatusPill({ label, isOk, isWarn }) {
  const c = statusColor(isOk, isWarn);
  const Icon = isOk ? CheckCircle2 : isWarn ? AlertCircle : XCircle;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 11px', borderRadius: 20,
      background: c.bg, border: `1px solid ${c.bd}`,
      color: c.fg, fontSize: 11, fontWeight: 800, letterSpacing: '0.02em'
    }}>
      <Icon size={11} />
      {label}
    </span>
  );
}

/* ── Sub-components ───────────────────────────────────────────── */
function SectionCard({ icon: Icon, title, accent = '#3b82f6', children }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: `1px solid rgba(255,255,255,0.07)`,
      borderRadius: 20, marginBottom: 14, overflow: 'hidden',
      boxShadow: `0 0 0 0 ${accent}22, inset 0 1px 0 rgba(255,255,255,0.05)`
    }}>
      {/* card top accent bar */}
      <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${accent}80, transparent)` }} />
      <div style={{ padding: '16px 18px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 9,
            background: `${accent}18`, border: `1px solid ${accent}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Icon size={15} color={accent} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 900, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{title}</span>
        </div>
        {children}
      </div>
    </div>
  );
}

function InfoRow({ label, children }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)'
    }}>
      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>{label}</span>
      {children}
    </div>
  );
}

function ActionBtn({ onClick, disabled, color = '#3b82f6', icon: Icon, children, variant = 'filled' }) {
  const isFilled = variant === 'filled';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1, padding: '13px 10px', borderRadius: 14,
        border: isFilled ? 'none' : `1px solid ${color}30`,
        background: disabled
          ? 'rgba(255,255,255,0.04)'
          : isFilled
            ? `linear-gradient(135deg, ${color}, ${color}cc)`
            : `${color}0f`,
        color: disabled ? 'rgba(255,255,255,0.25)' : isFilled ? '#fff' : color,
        fontSize: 12, fontWeight: 800, cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        transition: 'all 0.2s',
        boxShadow: isFilled && !disabled ? `0 4px 16px ${color}33` : 'none',
      }}
    >
      {Icon && <Icon size={14} />}
      {children}
    </button>
  );
}

/* ── Main Component ───────────────────────────────────────────── */
export default function PushDiagnosticPage() {
  const goBack = useBackNavigation('/dashboard');
  const [status, setStatus] = useState(null);
  const [serverSubs, setServerSubs] = useState(null);
  const [loading, setLoading] = useState(false);
  const [permLoading, setPermLoading] = useState(false);
  const [subLoading, setSubLoading] = useState(false);
  const [log, setLog] = useState([]);

  const addLog = (msg, type = 'info') =>
    setLog(prev => [{ msg, type, time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }, ...prev].slice(0, 40));

  const checkStatus = async () => {
    const sw = 'serviceWorker' in navigator;
    const pushApi = 'PushManager' in window;
    const notif = 'Notification' in window;
    const perm = notif ? Notification.permission : 'unsupported';
    let swReg = null, currentSub = null;
    try {
      swReg = await navigator.serviceWorker.getRegistration('/');
      if (swReg) currentSub = await swReg.pushManager.getSubscription();
    } catch { /* ignore */ }
    setStatus({ sw, pushApi, notif, perm, swReg: !!swReg, currentSub: !!currentSub, endpoint: currentSub?.endpoint });
    return { swReg, currentSub };
  };

  const fetchServerSubs = async () => {
    try {
      const res = await fetch(`${API_BASE}/debug/push-subscriptions?pass=verify`);
      const data = await res.json();
      setServerSubs(data);
      addLog(`서버 구독 수: ${data.count}건`, data.count > 0 ? 'ok' : 'err');
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
    setPermLoading(true);
    addLog('알림 권한 요청 중...');
    try {
      const result = await Notification.requestPermission();
      addLog(`알림 권한: ${result}`, result === 'granted' ? 'ok' : 'err');
      await checkStatus();
    } catch (e) { addLog('권한 요청 실패: ' + e.message, 'err'); }
    setPermLoading(false);
  };

  const handleSubscribe = async () => {
    setSubLoading(true);
    addLog('푸시 구독 시작...');
    try {
      let perm = Notification.permission;
      if (perm === 'default') { perm = await Notification.requestPermission(); addLog(`권한 응답: ${perm}`, perm === 'granted' ? 'ok' : 'err'); }
      if (perm !== 'granted') { addLog('❌ 알림 권한 없음.', 'err'); setSubLoading(false); return; }
      addLog('VAPID 키 가져오는 중...');
      const keyRes = await fetch(`${API_BASE}/auth/push-vapid-public`);
      if (!keyRes.ok) throw new Error(`VAPID fetch failed: ${keyRes.status}`);
      const { publicKey } = await keyRes.json();
      addLog('VAPID 키 획득 ✅', 'ok');
      addLog('서비스워커 연결 중...');
      const reg = await navigator.serviceWorker.ready;
      addLog('서비스워커 준비 완료 ✅', 'ok');
      const existing = await reg.pushManager.getSubscription();
      if (existing) { await existing.unsubscribe(); addLog('기존 구독 해제됨', 'warn'); }
      function urlB64ToUint8(b64) {
        const padding = '='.repeat((4 - b64.length % 4) % 4);
        const base64 = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/');
        const raw = atob(base64); const arr = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i); return arr;
      }
      addLog('새 구독 생성 중...');
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8(publicKey) });
      addLog('구독 생성 성공 ✅', 'ok');
      const token = getAccessToken();
      if (!token) { addLog('⚠️ 인증 토큰 없음. 서버 동기화 스킵.', 'warn'); setSubLoading(false); return; }
      addLog('서버 동기화 중...');
      const syncRes = await fetch(`${API_BASE}/auth/push-subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ subscription: sub })
      });
      const syncData = await syncRes.json();
      addLog(syncRes.ok ? '✅ 서버 동기화 완료!' : `서버 오류: ${JSON.stringify(syncData)}`, syncRes.ok ? 'ok' : 'err');
    } catch (e) { addLog('오류: ' + e.message, 'err'); }
    await checkStatus(); await fetchServerSubs(); setSubLoading(false);
  };

  const handleTestPush = async () => {
    addLog('테스트 푸시 요청 중...');
    try {
      const token = getAccessToken();
      const res = await fetch(`${API_BASE}/auth/push-test`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        addLog(`✅ 테스트 푸시 요청 성공! (대상: ${data.target})`, 'ok');
        (data.results || []).forEach(r => {
          if (r.error) addLog(`❌ 전송 실패: ${r.error}`, 'err');
          else addLog(`📡 응답: ${r.status} (${r.ok ? '성공' : '실패'})`, r.ok ? 'info' : 'err');
        });
        if (!data.results?.length) addLog('⚠️ 등록된 구독 기기가 없습니다.', 'warn');
      } else {
        const data = await res.json();
        addLog('테스트 푸시 실패: ' + (data.error || res.status), 'err');
      }
    } catch (e) { addLog('테스트 푸시 오류: ' + e.message, 'err'); }
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
      addLog('캐시 삭제 완료', 'ok');
      addLog('3초 후 새로고침...');
      setTimeout(() => window.location.reload(), 3000);
    } catch (e) { addLog('클린 오류: ' + e.message, 'err'); }
  };

  /* ── Overall health score ─────────────────────────────────────── */
  const health = status ? [
    status.sw, status.pushApi,
    status.perm === 'granted',
    status.swReg, status.currentSub,
    (serverSubs?.count ?? 0) > 0
  ].filter(Boolean).length : 0;
  const healthMax = 6;
  const healthPct = Math.round((health / healthMax) * 100);
  const healthColor = healthPct >= 80 ? '#10b981' : healthPct >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'linear-gradient(180deg, #05091a 0%, #020614 100%)',
      color: '#fff',
      fontFamily: "'Inter', 'Noto Sans KR', sans-serif",
      overflowY: 'auto',          /* ← 전체 스크롤 */
      WebkitOverflowScrolling: 'touch',
    }}>

      {/* ── Hero Header ─────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(160deg, #030a2a 0%, #001a66 60%, #002aaa 100%)',
        padding: 'calc(52px + env(safe-area-inset-top)) 20px 32px',
        position: 'relative', overflow: 'hidden', flexShrink: 0,
      }}>
        {/* glows */}
        <div style={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.18) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -40, left: -40, width: 150, height: 150, borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />
        {/* grid overlay */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '28px 28px', pointerEvents: 'none' }} />

        <button
          onClick={() => goBack()}
          style={{
            position: 'absolute', top: 'calc(16px + env(safe-area-inset-top))', left: 16,
            background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10,
            padding: '7px 12px', color: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700,
            zIndex: 2,
          }}
        >
          <ArrowLeft size={13} /> 뒤로
        </button>

        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          {/* icon */}
          <div style={{
            width: 56, height: 56, borderRadius: 18, margin: '0 auto 14px',
            background: 'linear-gradient(135deg, rgba(59,130,246,0.3), rgba(16,185,129,0.2))',
            border: '1px solid rgba(59,130,246,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 24px rgba(59,130,246,0.3)',
          }}>
            <Radio size={26} color="#60a5fa" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 900, letterSpacing: '0.05em', margin: '0 0 4px' }}>Push Diagnostic</h1>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, margin: '0 0 20px' }}>실시간 알림 상태 진단 및 구독 등록</p>

          {/* Health Score Ring */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 50,
            padding: '8px 18px',
          }}>
            <Activity size={14} color={healthColor} />
            <span style={{ fontSize: 12, fontWeight: 800, color: healthColor }}>
              Health {status ? `${healthPct}%` : '—'}
            </span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
              {status ? `${health}/${healthMax} 항목 정상` : '확인 중...'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────── */}
      <div style={{ padding: '20px 16px', maxWidth: 480, margin: '0 auto', paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}>

        {/* 브라우저 환경 */}
        <SectionCard icon={Wifi} title="브라우저 환경" accent="#3b82f6">
          {status ? (
            <>
              <InfoRow label="Service Worker">
                <StatusPill label={status.sw ? 'Supported' : 'Unsupported'} isOk={status.sw} />
              </InfoRow>
              <InfoRow label="Push API">
                <StatusPill label={status.pushApi ? 'Supported' : 'Unsupported'} isOk={status.pushApi} />
              </InfoRow>
              <InfoRow label="알림 권한">
                <StatusPill
                  label={status.perm === 'granted' ? 'Allowed' : status.perm === 'denied' ? 'Denied' : 'Default'}
                  isOk={status.perm === 'granted'}
                  isWarn={status.perm === 'default'}
                />
              </InfoRow>
              <InfoRow label="SW 등록 상태">
                <StatusPill label={status.swReg ? 'Registered' : 'Not Registered'} isOk={status.swReg} />
              </InfoRow>
              <InfoRow label="현재 구독">
                <StatusPill label={status.currentSub ? 'Subscribed' : 'Not Subscribed'} isOk={status.currentSub} />
              </InfoRow>
              {status.endpoint && (
                <div style={{ marginTop: 10, padding: '8px 10px', background: 'rgba(59,130,246,0.06)', borderRadius: 8, border: '1px solid rgba(59,130,246,0.12)' }}>
                  <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontWeight: 700, letterSpacing: '0.1em', margin: '0 0 4px' }}>ENDPOINT</p>
                  <p style={{ fontSize: 10, color: 'rgba(96,165,250,0.8)', fontFamily: 'monospace', wordBreak: 'break-all', margin: 0 }}>
                    {status.endpoint.substring(0, 80)}...
                  </p>
                </div>
              )}
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
              <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> 확인 중...
            </div>
          )}
        </SectionCard>

        {/* 서버 DB 상태 */}
        <SectionCard icon={Server} title="서버 DB 상태" accent="#10b981">
          {serverSubs ? (
            <>
              <InfoRow label="등록된 구독 수">
                <StatusPill label={`${serverSubs.count}건`} isOk={serverSubs.count > 0} />
              </InfoRow>
              {(serverSubs.subscriptions || []).map((s, i) => (
                <div key={i} style={{
                  marginTop: 8, padding: '10px 12px', borderRadius: 10,
                  background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.1)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Lock size={10} color="#10b981" />
                    <span style={{ fontSize: 11, color: '#10b981', fontWeight: 700 }}>User: {s.user_id}</span>
                  </div>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', margin: 0, wordBreak: 'break-all' }}>
                    {s.endpoint?.substring(0, 70)}...
                  </p>
                </div>
              ))}
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
              <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> 조회 중...
            </div>
          )}
        </SectionCard>

        {/* 액션 버튼 영역 */}
        <SectionCard icon={Zap} title="액션" accent="#6366f1">
          {/* 메인 버튼 */}
          <button
            onClick={handleSubscribe}
            disabled={subLoading}
            style={{
              width: '100%', padding: '15px', borderRadius: 14, border: 'none',
              background: subLoading ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #2563eb, #0ea5e9)',
              color: subLoading ? 'rgba(255,255,255,0.3)' : '#fff',
              fontSize: 14, fontWeight: 800, cursor: subLoading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              marginBottom: 10,
              boxShadow: subLoading ? 'none' : '0 6px 20px rgba(37,99,235,0.35)',
              transition: 'all 0.2s',
            }}
          >
            {subLoading
              ? <><RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> 처리 중...</>
              : <><Bell size={15} /> 🔔 지금 푸시 구독 등록</>
            }
          </button>

          {/* 보조 버튼 행 */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <ActionBtn onClick={handleRequestPermission} disabled={permLoading} color="#f59e0b" icon={Bell} variant="outline">
              {permLoading ? '...' : '권한 요청'}
            </ActionBtn>
            <ActionBtn onClick={refresh} disabled={loading} color="#94a3b8" variant="outline"
              icon={() => <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />}>
              새로고침
            </ActionBtn>
          </div>

          {/* 테스트 푸시 */}
          <button
            onClick={handleTestPush}
            style={{
              width: '100%', padding: '14px', borderRadius: 14,
              border: '1px solid rgba(16,185,129,0.3)',
              background: 'rgba(16,185,129,0.08)', color: '#10b981',
              fontSize: 13, fontWeight: 800, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              marginBottom: 8, transition: 'all 0.2s',
            }}
          >
            <ShieldAlert size={15} /> 🚀 테스트 푸시 발송 (나에게)
          </button>

          {/* 딥 클린 */}
          <button
            onClick={handleDeepClean}
            style={{
              width: '100%', padding: '12px', borderRadius: 12,
              border: '1px solid rgba(239,68,68,0.2)',
              background: 'rgba(239,68,68,0.05)', color: '#f87171',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              transition: 'all 0.2s',
            }}
          >
            🧹 딥 클린 (SW + 캐시 초기화)
          </button>
        </SectionCard>

        {/* 실시간 로그 */}
        <SectionCard icon={Terminal} title="실시간 로그" accent="#6366f1">
          <div style={{
            background: 'rgba(0,0,0,0.4)', borderRadius: 10,
            border: '1px solid rgba(99,102,241,0.15)',
            padding: '10px 12px',
            maxHeight: 220, overflowY: 'auto',
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: 11,
          }}>
            {log.length === 0 && (
              <span style={{ color: 'rgba(255,255,255,0.2)' }}>대기 중...</span>
            )}
            {log.map((entry, i) => (
              <div key={i} style={{ marginBottom: 5, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ color: '#334155', flexShrink: 0, fontSize: 10 }}>[{entry.time}]</span>
                <span style={{
                  color: entry.type === 'ok' ? '#34d399'
                    : entry.type === 'err' ? '#f87171'
                    : entry.type === 'warn' ? '#fbbf24'
                    : '#94a3b8'
                }}>
                  {entry.msg}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>

      </div>

      {/* global spin keyframe */}
      <style>{`
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}
