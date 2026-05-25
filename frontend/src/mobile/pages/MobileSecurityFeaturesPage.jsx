import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Lock, EyeOff, RefreshCcw, Users, Smartphone, FileSignature, Server, Key, Shield, Network, Database, Brain } from 'lucide-react';
import { useBackNavigation } from '../../hooks/useBackNavigation';

export default function MobileSecurityFeaturesPage() {
  const navigate = useNavigate();
  const goBack = useBackNavigation('/dashboard');

  const securityFeatures = [
    {
      id: 'tls',
      title: 'Transport Layer Security (TLS 1.3)',
      subtitle: '구간 암호화 및 통신 보안',
      icon: Network,
      color: '#0ea5e9',
      description: '클라이언트와 Cloudflare Edge, 그리고 백엔드 워커 간의 모든 통신은 최신 TLS 1.3 및 Strict SSL/HTTPS 프로토콜을 통해 엔드투엔드(E2E)로 강력하게 암호화되어 패킷 스니핑을 원천 차단합니다.',
      tags: ['TLS 1.3', 'HTTPS', 'End-to-End']
    },
    {
      id: 'db_encryption',
      title: 'Data Encryption at Rest & App Level',
      subtitle: 'DB 저장소 및 애플리케이션 계층 암호화',
      icon: Database,
      color: '#10b981',
      description: 'Cloudflare D1에 저장되는 모든 데이터는 디스크 레벨에서 암호화(Encryption at Rest)됩니다. 특히 시스템 간 연동 토큰, PDS 대상자 연락처 등 초민감 정보는 DB 저장 전 AES-GCM-256 방식으로 애플리케이션 레벨에서 2중 암호화됩니다.',
      tags: ['AES-GCM-256', 'Encryption at Rest', 'D1 SQLite']
    },
    {
      id: 'waf_ddos',
      title: 'WAF & DDoS Protection',
      subtitle: '웹 방화벽 및 공격 방어',
      icon: Server,
      color: '#ef4444',
      description: 'Cloudflare WAF(Web Application Firewall)를 통해 악의적인 SQL Injection, XSS 공격을 실시간 차단하며, Rate Limiting을 적용하여 L4/L7 계층의 대규모 DDoS 공격으로부터 인프라를 보호합니다.',
      tags: ['WAF', 'DDoS Mitigation', 'Rate Limit']
    },
    {
      id: 'ztna',
      title: 'Zero-Trust Network Access',
      subtitle: '무신뢰 기반 접근 제어',
      icon: Shield,
      color: '#3b82f6',
      description: '사내망 또는 사전에 인가된 특정 IP 대역 및 디바이스(Cloudflare Access / WARP)에서만 시스템 백엔드에 접근할 수 있도록 Zero-Trust 보안 모델을 적용했습니다.',
      tags: ['Zero-Trust', 'IP Whitelist', 'WARP']
    },
    {
      id: 'cors_csp',
      title: 'CORS & Content Security Policy',
      subtitle: '교차 출처 제한 및 콘텐츠 보안',
      icon: Key,
      color: '#f59e0b',
      description: '엄격한 CORS(Cross-Origin Resource Sharing) 정책으로 승인된 도메인에서의 API 호출만 허용하며, CSP 헤더를 통해 악성 스크립트 실행(XSS) 및 외부 리소스 로딩을 브라우저 단에서 강제 차단합니다.',
      tags: ['CORS', 'CSP', 'Browser Security']
    },
    {
      id: 'pii',
      title: 'PII Auto-Masking & Sanitization',
      subtitle: '개인정보 완전 비식별화',
      icon: EyeOff,
      color: '#f43f5e',
      description: '장애(Incident) 발생 시 수집되는 SMS 원문에 포함된 개인 식별 정보(주민/외국인번호, 계좌/카드번호, 연락처, 이메일, IP)는 정규식을 거쳐 즉시 마스킹(*처리)되어 DB에 원본이 남지 않습니다.',
      tags: ['Privacy', 'De-identification', 'Compliance']
    },
    {
      id: 'ai_sanitization',
      title: 'AI Vector DB Isolation',
      subtitle: '인공지능 지식베이스 데이터 정제',
      icon: Brain,
      color: '#d946ef',
      description: 'RAG 분석을 위해 Vectorize DB로 텍스트를 임베딩(Embedding)할 때, 비식별화 모듈을 강제 통과시켜 AI 모델 학습 및 프롬프트 주입에 개인정보나 내부 기밀이 절대 활용되지 않도록 격리합니다.',
      tags: ['Vector DB', 'Data Sanitization', 'AI Security']
    },
    {
      id: 'jwt',
      title: 'Stateless Auth & Token Rotation',
      subtitle: '무상태 인증 및 세션 보호',
      icon: RefreshCcw,
      color: '#8b5cf6',
      description: 'XSS 공격을 막기 위해 Refresh Token은 HttpOnly 및 Secure 속성이 적용된 쿠키로 발급됩니다. Access Token 만료 시 즉각적인 Token Rotation 기법을 사용하여 세션 하이재킹(Hijacking)을 예방합니다.',
      tags: ['JWT', 'HttpOnly', 'Token Rotation']
    },
    {
      id: 'rbac',
      title: 'Role-Based Access Control (RBAC)',
      subtitle: '역할 기반 데이터 접근 제어',
      icon: Users,
      color: '#f97316',
      description: 'Super Admin, Admin, 일반 User 등 세분화된 역할을 부여하고, 각 메뉴와 API 엔드포인트마다 읽기(Read), 쓰기(Write), 삭제(Delete) 인가(Authorization)를 서버 단에서 물리적으로 차단합니다.',
      tags: ['RBAC', 'Authorization', 'Least Privilege']
    },
    {
      id: 'push',
      title: 'Secure Push Messaging (FCM v1)',
      subtitle: '안전한 모바일 푸시 알림 전송',
      icon: Smartphone,
      color: '#06b6d4',
      description: '구형 VAPID Web Push를 대체하고, Google FCM v1 API와 GCP Service Account(OAuth2) 기반의 강력한 서버 간 인증을 통해 안드로이드 기기로 데이터 페이로드를 안전하게 전송합니다.',
      tags: ['FCM v1', 'OAuth2', 'Push Security']
    },
    {
      id: 'audit',
      title: 'Audit Logging & Telemetry',
      subtitle: '사용자 행위 감사 및 모니터링',
      icon: FileSignature,
      color: '#6366f1',
      description: '워룸 개설, 인시던트 강제 주입, PDS 설정 변경 및 권한 부여 등 인프라에 영향을 미치는 모든 주요 행위는 누가(Who), 언제(When), 무엇을(What) 했는지 텔레메트리(Activity Logs)로 영구 보존됩니다.',
      tags: ['Audit Log', 'Telemetry', 'Traceability']
    }
  ];

  return (
    <div className="min-h-screen bg-[#070b12] text-white font-sans flex flex-col pb-6">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#0b0e17]/90 backdrop-blur-md border-b border-white/10 px-4 py-3 flex items-center gap-3">
        <button onClick={() => goBack()} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center active:scale-95 text-slate-300">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-black tracking-tight text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" /> Security Implementation
          </h1>
        </div>
      </div>

      <div className="px-5 pt-6 pb-2">
        <div className="text-center mb-8 relative">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center relative shadow-[0_0_30px_rgba(16,185,129,0.15)]">
            <div className="absolute inset-0 rounded-full border border-emerald-500/30 animate-[spin_4s_linear_infinite]" style={{ borderTopColor: 'transparent', borderLeftColor: 'transparent' }} />
            <Shield className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-xl font-black text-white tracking-tight mb-1">시스템 보안 아키텍처</h2>
          <p className="text-xs text-slate-400 font-medium">안전한 무결점 관제 환경을 위한 보안 적용 현황</p>
        </div>

        <div className="space-y-4">
          {securityFeatures.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <div key={feat.id} className="relative bg-white/[0.02] border border-white/5 rounded-2xl p-4 overflow-hidden transition-all">
                {/* Background Glow */}
                <div className="absolute top-0 right-0 w-32 h-32 opacity-[0.03] rounded-full blur-2xl pointer-events-none" style={{ backgroundColor: feat.color, transform: 'translate(30%, -30%)' }} />
                
                <div className="flex items-start gap-3 relative z-10">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-lg" style={{ backgroundColor: `${feat.color}15`, border: `1px solid ${feat.color}30` }}>
                    <Icon size={20} color={feat.color} />
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <h3 className="text-[13px] font-black text-white mb-0.5">{feat.title}</h3>
                    <p className="text-[10px] font-bold tracking-wide uppercase mb-2" style={{ color: feat.color }}>{feat.subtitle}</p>
                    <p className="text-[11px] leading-relaxed text-slate-300 font-medium mb-3">
                      {feat.description}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {feat.tags.map(tag => (
                        <span key={tag} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-white/5 text-slate-400 border border-white/10">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="mt-8 text-center flex flex-col items-center justify-center gap-2 opacity-50">
          <Key className="w-4 h-4 text-slate-500" />
          <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">S-Guard AI Security Framework</span>
        </div>
      </div>
    </div>
  );
}
