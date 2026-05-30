import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBackNavigation } from '../hooks/useBackNavigation';
import {
  ChevronLeft, ShieldCheck, Database, Cpu, MessageSquare,
  Lock, EyeOff, Terminal, Layers, Activity, ChevronDown, ChevronUp, Network, Smartphone, Zap, Code2, Share2, Users
} from 'lucide-react';

const STEPS = [
  {
    id: 'step-1',
    icon: ShieldCheck, color: '#00e5ff',
    title: '1. Edge Ingress & Zero Trust',
    subtitle: '메시지 유입 및 물리적 보안 검증',
    badges: ['Cloudflare Workers', 'JWT Auth', 'IP Whitelist'],
    fn: "app.post('/sms/receive')",
    desc: 'iOS 단축어 또는 Android APK 데몬으로부터 REST API를 통해 원본 장애 문자를 수신합니다. 수신 즉시 Cloudflare Edge에서 사번(employee_id) 기반 화이트리스트 검증과 JWT 토큰 인증이 수행되어 비인가 접근을 원천 차단합니다.',
    code: `// Zero Trust Validation
const authHeader = req.headers.get('Authorization');
const token = authHeader.split(' ')[1];
const isValid = await verifyJWT(token, JWT_SECRET);
if (!isValid) throw new Error('Unauthorized');

const { success } = await db.prepare(
  "SELECT 1 FROM users WHERE employee_id = ? AND is_active = 1"
).bind(employee_id).first();`
  },
  {
    id: 'step-2',
    icon: EyeOff, color: '#a78bfa',
    title: '2. PII Masking & Security',
    subtitle: '민감 개인정보 실시간 비식별화',
    badges: ['Regex Parser', 'Data Sanitization'],
    fn: 'maskPII(payload)',
    desc: '데이터베이스에 기록되기 전, 메시지 내 포함된 성명, 전화번호, 이메일 등의 개인식별정보(PII)를 기술적 패턴 기반으로 분석하여 영구 비식별화 처리합니다. 원본 데이터는 메모리에서 즉시 폐기됩니다.',
    code: `// PII De-identification
function maskPII(text) {
  let masked = text.replace(
    /(01[016789])-?([0-9]{3,4})-?([0-9]{4})/g,
    '$1-****-$3'
  );
  masked = masked.replace(
    /[가-힣]{2,4}(?=(대리|과장|차장|부장|팀장|본부장))/g,
    (name) => name[0] + '*'.repeat(name.length - 1)
  );
  return masked;
}`
  },
  {
    id: 'step-3',
    icon: Database, color: '#fb923c',
    title: '3. Global Edge Storage',
    subtitle: 'D1 데이터베이스 분산 저장',
    badges: ['Cloudflare D1', 'SQLite', 'AES-256'],
    fn: 'db.prepare().run()',
    desc: '마스킹이 완료된 안전한 데이터는 전 세계 300개 이상의 도시에 분산된 Cloudflare D1 글로벌 데이터베이스에 즉각 커밋(Commit)됩니다. 중요한 필드는 AES 알고리즘으로 암호화되어 보관됩니다.',
    code: `// Persistent Storage Commit
const insertStmt = db.prepare(\`
  INSERT INTO received_messages 
  (inc_id, sender, message, severity, status) 
  VALUES (?, ?, ?, ?, 'PENDING')
\`);
await insertStmt.bind(
  inc_id, encryptedSender, maskedMessage, calcSeverity()
).run();`
  },
  {
    id: 'step-4',
    icon: BrainIcon, color: '#f472b6',
    title: '4. AI Intelligence & RAG',
    subtitle: 'Dify AI 기반 컨텍스트 분석 및 자율 조언',
    badges: ['Dify API', 'Vectorize DB', 'LLM Agent'],
    fn: 'fetchDifyInsight(inc_id)',
    desc: '수신된 장애 컨텍스트를 Dify AI 워크플로우로 비동기 전송합니다. AI는 Vectorize Database를 통해 유사한 과거 장애 사례를 검색(RAG)하고, 즉시 대응 가능한 해결 가이드를 자동 생성하여 반환합니다.',
    code: `// Trigger RAG Agent asynchronously
ctx.waitUntil(
  fetch('https://api.dify.ai/v1/workflows/run', {
    method: 'POST',
    headers: { 'Authorization': \`Bearer \${DIFY_KEY}\` },
    body: JSON.stringify({
      inputs: {
        incident_id: inc_id,
        error_logs: maskedMessage
      }
    })
  })
);`
  },
  {
    id: 'step-5',
    icon: Share2, color: '#facc15',
    title: '5. Event Broadcasting (SSE)',
    subtitle: 'Durable Objects 기반 실시간 이벤트 푸시',
    badges: ['Durable Objects', 'Server-Sent Events'],
    fn: 'broadcastEvent(event_type)',
    desc: '폴링(Polling)의 서버 과부하를 막기 위해 Cloudflare Durable Objects를 활용합니다. 상태를 지닌 객체가 SSE 프로토콜을 통해 연결된 모든 관제 클라이언트에게 0.1초 미만의 지연 시간으로 이벤트를 푸시합니다.',
    code: `// Durable Object Broadcast
class SSEBroadcaster {
  constructor(state) {
    this.state = state;
    this.sessions = new Set();
  }
  
  async broadcast(data) {
    const payload = \`data: \${JSON.stringify(data)}\\n\\n\`;
    for (const session of this.sessions) {
      session.webSocket.send(payload);
    }
  }
}`
  },
  {
    id: 'step-6',
    icon: Layers, color: '#10b981',
    title: '6. Realtime Dashboard',
    subtitle: '반응형 관제 파이프라인 시각화',
    badges: ['React', 'Vite', 'Recharts', 'Tailwind'],
    fn: 'useSSE("/notification-stream")',
    desc: '프론트엔드 대시보드는 PWA 기반으로 작동하며 SSE 스트림을 수신하여 즉각 UI를 업데이트합니다. Recharts를 통한 실시간 MTTA/MTTR 통계 시각화 및 애니메이션이 적용됩니다.',
    code: `// React Frontend Event Listener
useEffect(() => {
  const sse = new EventSource(\`\${apiBase}/stream\`);
  
  sse.addEventListener('sms_received', (e) => {
    const newInc = JSON.parse(e.data);
    setIncidents(prev => [newInc, ...prev]);
    toast.custom(<AlertBadge data={newInc} />);
  });
  
  return () => sse.close();
}, []);`
  },
  {
    id: 'step-7',
    icon: Users, color: '#6366f1',
    title: '7. Joint War-Room',
    subtitle: '합동 장애 대응 워룸',
    badges: ['Multi-tenant', 'AI Co-pilot'],
    fn: 'createWarRoom(inc_id)',
    desc: '장애 확산 방지를 위해 관련 담당자들이 동시에 접속하는 워룸(War-Room)이 자동 생성됩니다. AI 에이전트(S-Autopilot)가 채팅에 상주하며 실시간으로 조언을 제공합니다.',
    code: `// War-Room Initialization
const roomID = generateUUID();
await db.prepare(
  "INSERT INTO warroom_list (id, inc_id, title) VALUES (?,?,?)"
).bind(roomID, inc_id, \`장애 대응 - \${inc_id}\`).run();

// AI Agent joining
await invokeAI(roomID, "워룸이 개설되었습니다. 요약을 준비하세요.");`
  },
  {
    id: 'step-8',
    icon: Smartphone, color: '#06b6d4',
    title: '8. Native Mobile & Auto-Call',
    subtitle: 'FCM v1 연동 및 S-Callert 안드로이드 호출',
    badges: ['FCM v1 HTTP API', 'OAuth2', 'Android TTS'],
    fn: 'sendFcmPush()',
    desc: '위험도가 높은(CRITICAL) 장애의 경우, Google Cloud Service Account를 통해 FCM v1 OAuth2 토큰을 동적으로 발급하여 네이티브 앱으로 푸시를 보냅니다. 앱은 백그라운드에서 이를 수신하여 담당자에게 자동으로 TTS 전화(S-Callert)를 엽니다.',
    code: `// FCM v1 OAuth2 Push Trigger
const token = await generateOAuth2Token(serviceAccountJson);
await fetch('https://fcm.googleapis.com/v1/projects/s-guard/messages:send', {
  method: 'POST',
  headers: { 'Authorization': \`Bearer \${token}\` },
  body: JSON.stringify({
    message: {
      topic: 'critical_alerts',
      data: { type: 'auto_call', inc_id: inc_id }
    }
  })
});`
  }
];

// Helper icon component since Brain isn't imported from lucide-react in the old file properly
function BrainIcon(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" stroke={props.color || "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/>
      <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/>
      <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/>
      <path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/>
      <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/>
      <path d="M3.477 10.896a4 4 0 0 1 .585-.396"/>
      <path d="M19.938 10.5a4 4 0 0 1 .585.396"/>
      <path d="M6 18a4 4 0 0 1-1.967-.516"/>
      <path d="M19.967 17.484A4 4 0 0 1 18 18"/>
    </svg>
  );
}

export default function ProcessingFlowPage() {
  const navigate = useNavigate();
  const goBack = useBackNavigation('/dashboard');
  const [expanded, setExpanded] = useState(null);

  return (
    <div className="h-[100dvh] w-full max-w-full bg-[#050810] text-slate-200 font-sans flex flex-col relative overflow-y-auto overflow-x-hidden pb-10">
      {/* Background glow effects */}
      <div className="fixed top-20 left-0 w-[500px] h-[500px] bg-[#00e5ff]/5 rounded-full blur-[120px] -z-10 opacity-60 pointer-events-none" />
      <div className="fixed bottom-0 right-0 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-[120px] -z-10 opacity-40 pointer-events-none" />
      
      <style>{`
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:99px}
        @keyframes scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
        .animate-scanline {
          animation: scanline 8s linear infinite;
        }
      `}</style>

      {/* Cyberpunk Scanline */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-20">
        <div className="w-full h-10 bg-gradient-to-b from-transparent via-[#00e5ff]/20 to-transparent animate-scanline" />
      </div>

      {/* 헤더 */}
      <header className="sticky top-0 z-50 bg-[#070b14]/80 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center justify-between shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
        <button onClick={() => goBack()} className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-center active:scale-95 transition-all text-slate-300">
          <ChevronLeft size={20} />
        </button>
        <div className="text-center">
          <div className="text-[15px] font-black tracking-tight" style={{ background: 'linear-gradient(90deg, #00e5ff, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            System Architecture
          </div>
          <div className="text-[9px] font-black tracking-[0.2em] text-[#00e5ff] opacity-80 mt-0.5">S-GUARD AI TECH STACK</div>
        </div>
        <div className="w-9 h-9 rounded-xl bg-[#00e5ff]/10 border border-[#00e5ff]/20 flex items-center justify-center shadow-[0_0_15px_rgba(0,229,255,0.2)]">
          <Code2 size={16} className="text-[#00e5ff] animate-pulse" />
        </div>
      </header>

      {/* Security Banner */}
      <div className="shrink-0 mx-4 mt-5 p-3 rounded-2xl bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 flex items-center gap-3 shadow-[0_0_20px_rgba(16,185,129,0.1)] backdrop-blur-sm z-10 relative">
        <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 border border-emerald-500/30">
          <ShieldCheck size={16} className="text-emerald-400" />
        </div>
        <div>
          <div className="text-[13px] font-black text-emerald-400 tracking-wide">Privacy by Design Architecture</div>
          <div className="text-[10px] font-bold text-emerald-500/80 mt-0.5">모든 데이터 처리는 Edge 환경에서 수행되며 즉시 파기됩니다.</div>
        </div>
      </div>

      {/* 스텝 목록 */}
      <div className="px-4 py-6 flex flex-col gap-4 z-10 relative">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          const isOpen = expanded === i;
          return (
            <div 
              key={step.id} 
              className="rounded-3xl overflow-hidden backdrop-blur-md transition-all duration-300 relative group"
              style={{ 
                border: `1px solid ${isOpen ? step.color : 'rgba(255,255,255,0.05)'}`, 
                background: isOpen ? `linear-gradient(135deg, ${step.color}15 0%, rgba(10,14,23,0.9) 100%)` : 'rgba(255,255,255,0.02)',
                boxShadow: isOpen ? `0 0 30px ${step.color}20` : 'none'
              }}
            >
              {/* 왼쪽 하이라이트 바 */}
              <div 
                className="absolute left-0 top-0 bottom-0 w-1 transition-all duration-300"
                style={{ 
                  background: step.color,
                  opacity: isOpen ? 1 : 0.3,
                  boxShadow: isOpen ? `0 0 10px ${step.color}` : 'none'
                }} 
              />

              {/* 스텝 헤더 */}
              <div 
                onClick={() => setExpanded(isOpen ? null : i)} 
                style={{
                  width: '100%',
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
              >
                {/* 아이콘 박스 (고정 크기) */}
                <div 
                  style={{ 
                    width: '44px', 
                    height: '44px', 
                    minWidth: '44px',
                    flexShrink: 0,
                    borderRadius: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: `${step.color}15`, 
                    border: `1px solid ${step.color}30`,
                    boxShadow: isOpen ? `0 0 15px ${step.color}40` : 'none',
                    transform: isOpen ? 'scale(1.05)' : 'scale(1)',
                    transition: 'all 0.3s ease'
                  }}
                >
                  <Icon size={20} color={step.color} />
                </div>
                
                {/* 텍스트 영역 (가변 크기, 텍스트 넘침 방지) */}
                <div style={{
                  flex: 1,
                  minWidth: 0,
                  paddingLeft: '16px',
                  paddingRight: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center'
                }}>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: 900,
                    color: '#ffffff',
                    lineHeight: 1.2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {step.title}
                  </div>
                  <div style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#94a3b8',
                    marginTop: '4px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {step.subtitle}
                  </div>
                </div>
                
                {/* 우측 쉐브론 아이콘 (고정 크기) */}
                <div style={{
                  width: '32px',
                  height: '32px',
                  minWidth: '32px',
                  flexShrink: 0,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.05)'
                }}>
                  {isOpen ? <ChevronUp size={16} color="#ffffff" /> : <ChevronDown size={16} color="#64748b" />}
                </div>
              </div>

              {/* 확장 상세 (Animated) */}
              <div 
                className={`overflow-hidden transition-all duration-500 ease-in-out ${isOpen ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}`}
              >
                <div className="px-5 pb-5 pt-1 flex flex-col gap-4">
                  {/* Badges */}
                  <div className="flex flex-wrap gap-2">
                    {step.badges.map(badge => (
                      <span key={badge} className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider"
                            style={{ background: `${step.color}20`, color: step.color, border: `1px solid ${step.color}40` }}>
                        {badge}
                      </span>
                    ))}
                  </div>
                  
                  {/* Function Highlight */}
                  {step.fn && (
                    <div className="flex items-center gap-2.5 px-3 py-2 bg-black/40 rounded-xl border border-white/5 shadow-inner overflow-hidden">
                      <Terminal size={14} color={step.color} className="opacity-70 shrink-0" />
                      <span className="text-[11px] font-mono font-bold break-all" style={{ color: step.color }}>{step.fn}</span>
                    </div>
                  )}
                  
                  {/* Description */}
                  <p className="text-[12px] font-bold text-slate-300 leading-relaxed tracking-wide">
                    {step.desc}
                  </p>
                  
                  {/* Code Snippet */}
                  {step.code && (
                    <div className="mt-2 rounded-xl overflow-hidden border border-white/10 bg-[#0a0d14] shadow-2xl relative group max-w-full">
                      {/* Terminal Header */}
                      <div className="flex items-center justify-between px-3 py-2 bg-[#121620] border-b border-white/5">
                        <div className="flex gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                          <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                        </div>
                        <div className="text-[9px] font-mono text-slate-500 font-bold uppercase tracking-widest">
                          edge_worker.js
                        </div>
                      </div>
                      {/* Code Content */}
                      <div className="p-3 overflow-x-auto w-full">
                        <pre className="text-[10px] leading-relaxed font-mono text-[#a5b4fc] w-full" style={{ whiteSpace: 'pre', minWidth: 'min-content' }}>
                          <code>
                            {step.code}
                          </code>
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* 하단 인증서 */}
        <div className="mt-6 p-5 rounded-3xl bg-gradient-to-br from-[#0b0e17] to-[#121622] border border-white/10 shadow-2xl text-center relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#00e5ff]/10 rounded-full blur-2xl" />
          <Lock size={24} className="text-[#00e5ff] mx-auto mb-3 drop-shadow-[0_0_10px_rgba(0,229,255,0.5)]" />
          <h3 className="text-[14px] font-black text-white mb-2 tracking-wide">Cloudflare Edge Security Certified</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
            All data flows are fully encrypted and audited in real-time under Zero Trust Architecture.
          </p>
          <div className="flex justify-center gap-2 mt-5">
            <div className="h-1 w-12 bg-[#00e5ff] rounded-full shadow-[0_0_8px_rgba(0,229,255,0.8)]" />
            <div className="h-1 w-4 bg-white/20 rounded-full" />
            <div className="h-1 w-4 bg-white/20 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
