import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBackNavigation } from '../hooks/useBackNavigation';
import {
  ChevronLeft, ShieldCheck, Database, Cpu, MessageSquare,
  Lock, EyeOff, Terminal, Layers, Activity, ChevronDown, ChevronUp, Network, Smartphone, Zap
} from 'lucide-react';

const STEPS = [
  {
    icon: MessageSquare, color: '#60a5fa',
    title: '1. Entry Point & Protocol Ingress',
    subtitle: '메시지 유입 및 엔드포인트 수신',
    fn: "app.post('/sms/receive')",
    desc: 'iOS 단축어 또는 Android APK 데몬으로부터 REST API를 통해 원본 장애 문자를 수신합니다. 수신 즉시 employee_id(사번) 기반의 화이트리스트 검증과 JWT 인증이 물리 레벨에서 수행됩니다.',
    sql: 'SELECT * FROM users WHERE employee_id = ? AND is_active = 1',
  },
  {
    icon: ShieldCheck, color: '#34d399',
    title: '2. Validation & Assignment',
    subtitle: '데이터 무결성 검증 및 담당자 자동 배정',
    fn: 'validateSmsPayload',
    desc: '수신된 데이터의 형식을 검사하고, 메시지 내에 포함된 담당자 성함을 추출합니다. 추출된 성함을 기반으로 담당 부서와 팀원을 식별하여 자동으로 장애 티켓을 할당합니다.',
    sql: 'INSERT INTO incident_assignments (user_id, inc_id) SELECT employee_id... FROM users',
  },
  {
    icon: EyeOff, color: '#a78bfa',
    title: '3. PII De-identification',
    subtitle: '민감정보 비식별화 (마스킹)',
    fn: 'maskPII',
    desc: 'D1 데이터베이스에 저장하기 직전, 개인정보 보호를 위한 마스킹이 수행됩니다. 성명, 전화번호, 이메일 등을 기술적 패턴으로 분석하여 \'홍*동\', \'010-****-1234\' 형태로 변환합니다.',
    sql: 'const maskedMessage = maskPII(originalMsg);',
  },
  {
    icon: Database, color: '#fb923c',
    title: '4. Persistent Storage (D1)',
    subtitle: '안전한 데이터 암호화 저장',
    fn: null,
    desc: '모든 검증과 마스킹이 완료된 데이터만 Cloudflare D1 (SQLite 기반 글로벌 데이터베이스)에 영구 저장됩니다. SSE를 통해 즉시 관제 화면으로 전송됩니다.',
    sql: "INSERT INTO received_messages (inc_id, sender, message, status...) VALUES (?, ?, ?, 'PENDING')",
  },
  {
    icon: Cpu, color: '#f472b6',
    title: '5. Intelligence Orchestration',
    subtitle: 'AI 자율 진단 및 인사이트 추출',
    fn: 'performBackgroundAiAnalysis',
    desc: '데이터 저장이 트리거되면 백그라운드에서 AI 엔진(Dify)이 가동됩니다. 유사한 과거 장애 사례를 Vectorize DB에서 검색하고 에이전트별 조치 가이드를 생성합니다.',
    sql: null,
  },
  {
    icon: Network, color: '#facc15',
    title: '6. Realtime Pipeline (SSE)',
    subtitle: 'Server-Sent Events 실시간 통신',
    fn: "new EventSource('/sms/notification-stream')",
    desc: '폴링(Polling) 방식의 오버헤드를 제거하기 위해 SSE 기술을 도입했습니다. 백엔드에서 장애가 접수되거나 분석이 완료되면 연결된 모든 워룸과 대시보드 클라이언트에게 양방향 연결 없이 단방향으로 초저지연 실시간 이벤트를 푸시합니다.',
    sql: 'sse.addEventListener("sms_received", (e) => updateUI(e.data))',
  },
  {
    icon: Smartphone, color: '#06b6d4',
    title: '7. Mobile App & Push (FCM v1)',
    subtitle: '안드로이드 네이티브 푸시 및 웹 뷰 연동',
    fn: 'admin.messaging().send()',
    desc: '레거시 VAPID Web Push에서 최신 FCM v1 HTTP API로 마이그레이션했습니다. Cloudflare Worker에서 Service Account의 OAuth2 토큰을 발급하여 안드로이드 앱으로 Data 페이로드를 안전하게 전송하며 자동 발신(Callert)을 트리거합니다.',
    sql: 'POST https://fcm.googleapis.com/v1/projects/s-guard-ai/messages:send',
    active: true,
  }
];

export default function ProcessingFlowPage() {
  const navigate = useNavigate();
  const goBack = useBackNavigation('/dashboard');
  const [expanded, setExpanded] = useState(null);

  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', background:'linear-gradient(160deg,#04060f,#07090f)', fontFamily:"'Pretendard','Inter',sans-serif", color:'#cbd5e1', paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}>
      <style>{`::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:rgba(99,102,241,.2);border-radius:99px}`}</style>

      {/* 헤더 */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'13px 16px', borderBottom:'1px solid rgba(99,102,241,.12)', background:'rgba(4,6,15,.96)', backdropFilter:'blur(20px)' }}>
        <button onClick={() => goBack()} style={{ width:36, height:36, borderRadius:10, background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.08)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
          <ChevronLeft size={18} color="#64748b" />
        </button>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:15, fontWeight:900, background:'linear-gradient(90deg,#818cf8,#6366f1)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>Data Processing Flow</div>
          <div style={{ fontSize:10, color:'#4338ca', fontWeight:800, letterSpacing:'0.12em', opacity:.8 }}>S-GUARD 데이터 처리 기술 명세</div>
        </div>
        <div style={{ width:36, height:36, borderRadius:10, background:'rgba(99,102,241,.08)', border:'1px solid rgba(99,102,241,.15)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Activity size={15} color="#818cf8" style={{ animation:'pulse 2s ease infinite' }} />
        </div>
      </header>

      {/* Privacy by Design 배너 */}
      <div style={{ flexShrink:0, margin:'10px 16px 0', padding:'12px 16px', borderRadius:14, background:'rgba(99,102,241,.07)', border:'1px solid rgba(99,102,241,.15)', display:'flex', alignItems:'center', gap:10 }}>
        <ShieldCheck size={18} color="#818cf8" />
        <div>
          <div style={{ fontSize:13, fontWeight:800, color:'#818cf8' }}>Privacy by Design</div>
          <div style={{ fontSize:11, color:'#475569', marginTop:1 }}>모든 처리는 Cloudflare Workers 엣지에서 수행 · 원본 데이터 즉시 폐기</div>
        </div>
      </div>

      {/* 스텝 목록 */}
      <div style={{ padding:'10px 16px 24px', display:'flex', flexDirection:'column', gap:8 }}>
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          const isOpen = expanded === i;
          return (
            <div key={i} style={{ borderRadius:18, overflow:'hidden', border:`1px solid ${step.color}22`, background:`linear-gradient(135deg,${step.color}08 0%,rgba(255,255,255,.02) 100%)` }}>
              {/* 스텝 헤더 — 항상 보임 */}
              <button onClick={() => setExpanded(isOpen ? null : i)} style={{ width:'100%', padding:'14px 16px', display:'flex', alignItems:'center', gap:12, background:'none', border:'none', cursor:'pointer', textAlign:'left' }}>
                <div style={{ width:42, height:42, borderRadius:13, background:`${step.color}15`, border:`1px solid ${step.color}30`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, ...(step.active ? { animation:'pulse 2s ease infinite' } : {}) }}>
                  <Icon size={18} color={step.color} />
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:15, fontWeight:800, color:'#f1f5f9', lineHeight:1.2 }}>{step.title}</div>
                  <div style={{ fontSize:12, color:'#475569', marginTop:2 }}>{step.subtitle}</div>
                </div>
                <div style={{ flexShrink:0 }}>
                  {isOpen ? <ChevronUp size={16} color="#475569" /> : <ChevronDown size={16} color="#475569" />}
                </div>
              </button>

              {/* 확장 상세 */}
              {isOpen && (
                <div style={{ padding:'0 16px 16px', display:'flex', flexDirection:'column', gap:10 }}>
                  {step.fn && (
                    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', background:'rgba(0,0,0,.3)', borderRadius:10, border:'1px solid rgba(255,255,255,.06)' }}>
                      <Terminal size={12} color="#60a5fa" />
                      <span style={{ fontSize:12, fontFamily:'monospace', color:'#93c5fd' }}>{step.fn}()</span>
                    </div>
                  )}
                  <p style={{ fontSize:13, color:'#94a3b8', lineHeight:1.7 }}>{step.desc}</p>
                  {step.sql && (
                    <div style={{ padding:'10px 12px', background:'rgba(0,0,0,.4)', borderRadius:10, border:'1px solid rgba(255,255,255,.05)' }}>
                      <div style={{ fontSize:10, color:'#334155', fontWeight:800, marginBottom:5, letterSpacing:'0.08em' }}>QUERY PREVIEW</div>
                      <code style={{ fontSize:11, fontFamily:'monospace', color:'#34d399', lineHeight:1.6, display:'block', wordBreak:'break-all' }}>{step.sql}</code>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* 보안 인증서 */}
        <div style={{ marginTop:8, padding:'16px', borderRadius:18, background:'rgba(255,255,255,.02)', border:'1px solid rgba(255,255,255,.07)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
            <Lock size={16} color="#818cf8" />
            <span style={{ fontSize:14, fontWeight:800, color:'#818cf8' }}>Cloudflare Edge Security Certificate</span>
          </div>
          <p style={{ fontSize:11, color:'#334155', lineHeight:1.7, fontWeight:700, letterSpacing:'0.04em' }}>
            THIS INFRASTRUCTURE IS PROTECTED BY CLOUDFLARE ZERO TRUST ARCHITECTURE. ALL DATA FLOWS ARE MASKED AND AUDITED IN REAL-TIME.
          </p>
          <div style={{ display:'flex', gap:6, marginTop:10 }}>
            <div style={{ height:3, background:'#4f46e5', borderRadius:99, width:48 }} />
            <div style={{ height:3, background:'rgba(255,255,255,.06)', borderRadius:99, flex:1 }} />
          </div>
        </div>
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
    </div>
  );
}
