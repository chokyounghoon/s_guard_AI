import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { ShieldCheck, Globe, Scale, ChevronRight, Check, AlertCircle, Lock } from 'lucide-react';

const ConsentModal = ({ userProfile, setUserProfile }) => {
  const [agreed, setAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const apiBase = 'https://sguardai.khcho0421.workers.dev';
  const user = userProfile || JSON.parse(localStorage.getItem('sguard_user') || '{}');

  const terms = [
    {
      id: 'overseas',
      icon: <Globe className="w-5 h-5 text-blue-400" />,
      title: '개인정보 국외 이전 동의',
      summary: 'Cloudflare 글로벌 리전 데이터 처리',
      content: `1. 이전되는 국가: 미국 등 Cloudflare 전 세계 엣지 리전\n2. 이전 일시 및 방법: 서비스 이용 시점에 암호화된 통신 채널을 통해 전송\n3. 이전받는 자: Cloudflare, Inc.\n4. 이용 목적: 글로벌 분산 네트워크를 통한 고속 AI 추론 및 인프라 보안 최적화\n5. 보유 기간: 서비스 이용 종료 또는 회원 탈퇴 시 즉시 파기\n\n핵심: 본 서비스는 AI 인프라 활용 과정에서 암호화된 데이터가 국외 서버를 경유하거나 임시 저장될 수 있음을 고지합니다.`
    },
    {
      id: 'ip',
      icon: <Scale className="w-5 h-5 text-emerald-400" />,
      title: '지식재산권 및 성과물 귀속 동의',
      summary: '사용자 교정 내역의 사내 자산화',
      content: `1. 귀속 대상: 사용자가 S-Guard에 입력한 피드백, 장애 교정 로그, 기술적 메모 등 모든 지식 콘텐츠\n2. 활용 목적: 사내 AI 모델 재학습, 서비스 품질 개선, 장애 대응 기술 지식 베이스(KB) 구축\n3. 권리 관계: 입력된 모든 성과물은 회사의 지식 자산으로 공식화되며, 회사는 이를 영구적으로 활용할 권리를 가집니다.\n\n효과: 사용자의 노하우를 사내 자산으로 규정하여 지식의 영속성을 확보하기 위한 법적 근거입니다.`
    },
    {
      id: 'disclaimer',
      icon: <ShieldCheck className="w-5 h-5 text-orange-400" />,
      title: 'AI 답변의 한계 및 책임 제한 고지',
      summary: '최종 의사결정 책임 및 AI 한계 인지',
      content: `1. 답변 성격: S-Guard가 제공하는 분석 결과 및 대응 답변은 과거 데이터를 기반으로 한 참고용 가이드입니다.\n2. 책임 소재: 시스템의 답변을 바탕으로 한 실제 작업 실행 및 결과에 대한 최종 책임은 작업자 본인에게 있습니다.\n3. 한계 인지: AI 알고리즘의 특성상 환각(Hallucination) 문장이나 데이터 불일치가 발생할 수 있음을 충분히 숙지합니다.\n\n주의: 긴급 장애 복구 시 AI의 의견을 절대적으로 신뢰하기보다 전문가의 교차 검증을 반드시 거쳐야 합니다.`
    }
  ];

  const handleSubmit = async () => {
    if (!agreed) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`${apiBase}/auth/agree-terms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: user.employee_id,
          version: 'v1.0'
        })
      });

      if (res.ok) {
        const data = await res.json();
        const updatedUser = { 
          ...user, 
          terms_agreed_at: data.agreed_at,
          terms_agreed_ip: data.ip,
          terms_version: 'v1.0'
        };
        localStorage.setItem('sguard_user', JSON.stringify(updatedUser));
        if (setUserProfile) {
          setUserProfile(updatedUser);
        }
      } else {
        alert('동의 처리에 실패했습니다. 다시 시도해 주세요.');
      }
    } catch (e) {
      console.error(e);
      alert('네트워크 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] bg-[#080a0f] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
      <div className="absolute inset-0 bg-blue-600/5 backdrop-blur-3xl animate-pulse" />
      
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-[#0f1421] rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 fade-in duration-500">
        
        {/* 🚀 Header */}
        <div className="flex-none p-6 text-center border-b border-white/5 bg-gradient-to-b from-blue-600/10 to-transparent">
          <div className="inline-flex items-center justify-center p-3 bg-blue-600/20 rounded-2xl border border-blue-500/30 mb-4">
            <ShieldCheck className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight mb-2 flex items-center justify-center gap-2">
            <Lock className="w-5 h-5 text-blue-500/50" />
            S-GUARD 사용자 동의
          </h1>
          <p className="text-slate-500 text-xs px-10 leading-relaxed">
            안전하고 투명한 지능형 관제 서비스를 위해 아래의 핵심 운영 정책을 확인해 주시기 바랍니다. 모든 항목에 동의해야 서비스를 이용할 수 있습니다.
          </p>
        </div>

        {/* 📜 Content Area */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 custom-scrollbar">
          <div className="grid grid-cols-3 gap-3">
            {terms.map(item => (
              <div key={item.id} className="bg-slate-900/40 p-3 rounded-2xl border border-white/5 flex flex-col items-center gap-1.5 hover:bg-slate-800/60 transition-colors">
                {item.icon}
                <span className="text-[10px] font-bold text-slate-400 text-center leading-tight">{item.summary}</span>
              </div>
            ))}
          </div>

          <div className="space-y-6">
            {terms.map((item, idx) => (
              <div key={item.id} className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${idx * 150}ms` }}>
                <div className="flex items-center gap-2">
                  <div className="w-1 h-5 bg-blue-500 rounded-full" />
                  <h3 className="text-sm font-bold text-white">{item.title}</h3>
                </div>
                <div className="bg-black/30 p-4 rounded-xl border border-white/5 text-[11px] text-slate-400 leading-relaxed whitespace-pre-wrap font-mono">
                  {item.content}
                </div>
              </div>
            ))}
          </div>
          
          <div className="flex items-center gap-2 p-4 bg-blue-950/20 border border-blue-500/20 rounded-2xl">
            <AlertCircle className="w-4 h-4 text-blue-400 shrink-0" />
            <p className="text-[10px] text-blue-300/80 leading-normal">
              신한 DS 보안 감사 준수를 위해 귀하의 접속 IP 및 동의 일시가 증적 자료로 엄격히 관리됩니다.
            </p>
          </div>
        </div>

        {/* 🏁 Footer */}
        <div className="flex-none p-6 pt-8 bg-gradient-to-t from-slate-900/80 to-transparent border-t border-white/5">
          <div className="max-w-md mx-auto space-y-4">
            <label 
              className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all cursor-pointer
                ${agreed ? 'bg-blue-600/10 border-blue-500/40' : 'bg-slate-900/40 border-slate-800'}`}
            >
              <input 
                type="checkbox" 
                checked={agreed}
                onChange={() => setAgreed(!agreed)}
                className="hidden"
              />
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${agreed ? 'bg-blue-500 border-transparent text-white' : 'border-slate-700'}`}>
                <Check className="w-4 h-4 font-black" />
              </div>
              <span className={`font-bold text-xs transition-colors ${agreed ? 'text-blue-400' : 'text-slate-500'}`}>
                위 내용을 모두 숙지하였으며, 이에 동의합니다.
              </span>
            </label>

            <button
              onClick={handleSubmit}
              disabled={!agreed || isSubmitting}
              className={`w-full py-4 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-2 active:scale-95 shadow-xl
                ${agreed ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-blue-500/20' : 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700'}`}
            >
              {isSubmitting ? '처리 중...' : '확인 및 계속하기'}
              {!isSubmitting && <ChevronRight className="w-5 h-5" />}
            </button>
            
            <p className="text-[9px] text-slate-600 text-center tracking-widest font-mono font-bold uppercase pb-2">
              Compliance Enforcement Unit • Audit Ready
            </p>
          </div>
        </div>
      </div>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
      `}</style>
    </div>,
    document.body
  );
};

export default ConsentModal;
