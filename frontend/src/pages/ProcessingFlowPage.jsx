import React from 'react';
import { 
  ArrowRight, ShieldCheck, Database, Cpu, MessageSquare, 
  Lock, EyeOff, CheckCircle2, Terminal, Layers, Activity 
} from 'lucide-react';

const FlowStep = ({ icon: Icon, title, subtitle, functionName, sql, description, isActive = false }) => (
  <div className={`relative group mb-12 last:mb-0 ${isActive ? 'scale-105 transition-transform' : ''}`}>
    <div className="absolute -left-12 top-0 h-full flex flex-col items-center">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${isActive ? 'bg-blue-600 border-blue-400' : 'bg-slate-800 border-slate-700'}`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div className="flex-grow w-0.5 bg-slate-700 group-last:bg-transparent"></div>
    </div>
    
    <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 hover:border-blue-500/50 transition-all shadow-xl">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-bold text-white mb-1">{title}</h3>
          <p className="text-sm text-slate-400 font-medium">{subtitle}</p>
        </div>
        {functionName && (
          <div className="flex items-center gap-2 px-3 py-1 bg-slate-900 rounded-md border border-slate-800">
            <Terminal className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs font-mono text-blue-300">{functionName}()</span>
          </div>
        )}
      </div>
      
      <p className="text-slate-300 text-sm mb-6 leading-relaxed">
        {description}
      </p>

      {sql && (
        <div className="bg-black/40 rounded-xl p-4 border border-slate-800/50">
          <div className="flex items-center gap-2 mb-2">
            <Database className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Query Preview</span>
          </div>
          <code className="text-[11px] font-mono text-emerald-400 leading-tight">
            {sql}
          </code>
        </div>
      )}
    </div>
    
    <div className="absolute -bottom-8 left-[-10px] text-slate-600">
      <ArrowRight className="w-5 h-5 rotate-90" />
    </div>
  </div>
);

const ProcessingFlowPage = () => {
  return (
    <div className="min-h-screen bg-[#070b14] text-white p-6 pb-24 lg:p-12">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-600/20 rounded-2xl">
              <Layers className="w-8 h-8 text-blue-500" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Data Processing Specification</h1>
              <p className="text-slate-400 mt-1">S-GUARD 시스템 데이터 처리 흐름 및 보안 기술 명세서</p>
            </div>
          </div>
          <div className="h-px bg-gradient-to-r from-blue-500/50 to-transparent w-full"></div>
        </div>

        {/* Introduction */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          <div className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-green-500" />
              Privacy by Design
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              본 명세서는 수신된 장애 문자가 비식별화 처리를 거쳐 안전하게 저장되기까지의 기술적 과정을 설명합니다. 
              모든 처리는 Cloudflare Workers 엣지 서버에서 수행되며, 수집된 원본 데이터는 마스킹 즉시 폐기됩니다.
            </p>
          </div>
          <div className="bg-blue-600/5 border border-blue-500/20 rounded-2xl p-6 flex items-center justify-center">
            <div className="text-center">
              <Activity className="w-12 h-12 text-blue-500 mx-auto mb-4 animate-pulse" />
              <div className="text-sm font-bold text-blue-400">실시간 데이터 감시 중</div>
              <div className="text-[10px] text-slate-500 mt-1 uppercase tracking-tighter">Endpoint Hardening Active</div>
            </div>
          </div>
        </div>

        {/* Steps */}
        <div className="pl-12">
          <FlowStep 
            icon={MessageSquare}
            title="1. Entry Point & Protocol Ingress"
            subtitle="메시지 유입 및 엔드포인트 수신"
            functionName="app.post('/sms/receive')"
            description="iOS 단축어 또는 Android APK 데몬으로부터 REST API를 통해 원본 장애 문자를 수신합니다. 수신 즉시 employee_id(사번) 기반의 화이트리스트 검증과 JWT 인증이 물리 레벨에서 수행됩니다."
            sql="SELECT * FROM users WHERE employee_id = ? AND is_active = 1"
          />

          <FlowStep 
            icon={ShieldCheck}
            title="2. Validation & Assignment"
            subtitle="데이터 무결성 검증 및 담당자 자동 배정"
            functionName="validateSmsPayload"
            description="수신된 데이터의 형식을 검사하고, 메시지 내에 포함된 담당자 성함을 추출합니다. 추출된 성함을 기반으로 담당 부서(Part)와 팀원을 식별하여 자동으로 장애 티켓을 할당합니다."
            sql="INSERT INTO incident_assignments (user_id, inc_id) SELECT employee_id... FROM users"
          />

          <FlowStep 
            icon={EyeOff}
            title="3. PII De-identification"
            subtitle="민감정보 비식별화 (마스킹)"
            functionName="maskPII"
            description="D1 데이터베이스에 저장하기 직전, 개인정보 보호를 위한 마스킹이 수행됩니다. 성명, 전화번호, 이메일, 주민번호 등 기술적 패턴을 분석하여 '홍*동', '010-****-1234' 형태로 변환합니다."
            sql="const maskedMessage = maskPII(originalMsg);"
          />

          <FlowStep 
            icon={Database}
            title="4. Persistent Storage (D1)"
            subtitle="안전한 데이터 암호화 저장"
            description="모든 검증과 마스킹이 완료된 데이터만 Cloudflare D1 (SQLite 기반 글로벌 데이터베이스)에 영구 저장됩니다. 저장된 장애 이력은 SSE(Server-Sent Events)를 통해 즉시 관제 화면으로 전송됩니다."
            sql="INSERT INTO received_messages (inc_id, sender, message, status...) VALUES (?, ?, ?, 'PENDING')"
          />

          <FlowStep 
            icon={Cpu}
            title="5. Intelligence Orchestration"
            subtitle="AI 자율 진단 및 인사이트 추출"
            functionName="performBackgroundAiAnalysis"
            description="데이터 저장이 트리거되면 백그라운드에서 AI 엔진(Dify)이 가동됩니다. 유사한 과거 장애 사례를 Vectorize DB에서 검색하고 에이전트별 조치 가이드를 생성하여 사용자에게 시각화합니다."
            isActive={true}
          />
        </div>

        {/* Footer */}
        <div className="mt-20 p-8 border border-slate-800 rounded-[2.5rem] bg-slate-900/30">
          <div className="flex items-center gap-3 mb-4">
            <Lock className="w-5 h-5 text-blue-500" />
            <h4 className="font-bold text-white">Cloudflare Edge Security Certificate</h4>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed uppercase tracking-wider mb-6">
            THIS INFRASTRUCTURE IS PROTECTED BY CLOUDFLARE ZERO TRUST ARCHITECTURE. 
            ALL DATA FLOWS ARE MASKED AND AUDITED IN REAL-TIME.
          </p>
          <div className="flex gap-4">
            <div className="h-1 bg-blue-600 rounded-full w-24"></div>
            <div className="h-1 bg-slate-800 rounded-full w-24"></div>
            <div className="h-1 bg-slate-800 rounded-full w-24"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProcessingFlowPage;
