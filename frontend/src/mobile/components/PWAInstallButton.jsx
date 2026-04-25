import React, { useState, useEffect } from 'react';
import { Download, X, Share, Plus, MoreVertical, ChevronDown, Smartphone, CheckCircle2 } from 'lucide-react';

/**
 * 📱 PWA Install Guide Component
 *
 * - Android Chrome : beforeinstallprompt 이벤트 → 네이티브 설치 다이얼로그 호출
 * - iOS Safari     : 직접 설치 불가 → 공유→홈 화면 추가 단계별 가이드 모달
 * - 기타 브라우저  : 일반 안내 모달
 */

function detectPlatform() {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  const isAndroid = /Android/.test(ua);
  const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua);
  const isChrome = /Chrome/.test(ua) && !/Edg/.test(ua);
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true; // iOS standalone

  return { isIOS, isAndroid, isSafari, isChrome, isStandalone };
}

// ─── iOS 전용 단계별 가이드 모달 ───────────────────────────────────────────────
function IOSGuideModal({ onClose }) {
  const steps = [
    {
      icon: <Share className="w-6 h-6 text-blue-400" />,
      title: 'Safari 하단 공유 버튼 탭',
      desc: '화면 하단 중앙의 □↑ 아이콘을 탭하세요.',
    },
    {
      icon: <Plus className="w-6 h-6 text-blue-400" />,
      title: '"홈 화면에 추가" 선택',
      desc: '메뉴를 아래로 스크롤하여 "홈 화면에 추가"를 탭하세요.',
    },
    {
      icon: <CheckCircle2 className="w-6 h-6 text-emerald-400" />,
      title: '"추가" 탭하여 완료',
      desc: '이름을 확인한 후 오른쪽 상단 "추가"를 탭하면 설치 완료!',
    },
  ];

  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center px-4 pb-0"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>

      {/* 배경 탭으로 닫기 */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* 슬라이드-업 시트 */}
      <div className="relative w-full max-w-sm bg-[#131927] rounded-t-3xl border border-white/10 shadow-2xl overflow-hidden animate-slide-up">
        {/* 핸들 */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600/20 rounded-2xl border border-blue-500/30 flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">홈 화면에 추가</h3>
              <p className="text-[11px] text-slate-500">iOS Safari 설치 가이드</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* 단계 */}
        <div className="px-6 py-5 space-y-5"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}>
          {steps.map((step, i) => (
            <div key={i} className="flex gap-4">
              {/* 번호 + 선 */}
              <div className="flex flex-col items-center gap-1">
                <div className="w-9 h-9 rounded-2xl bg-[#1e2535] border border-white/10 flex items-center justify-center shrink-0">
                  {step.icon}
                </div>
                {i < steps.length - 1 && <div className="w-px flex-1 bg-white/5 min-h-[16px]" />}
              </div>
              {/* 텍스트 */}
              <div className="flex-1 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold text-slate-600 font-mono">STEP {i + 1}</span>
                </div>
                <p className="text-sm font-bold text-white mb-1">{step.title}</p>
                <p className="text-xs text-slate-400 leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}

          {/* 팁 */}
          <div className="bg-blue-900/15 border border-blue-500/15 rounded-2xl p-4">
            <p className="text-xs text-blue-400/80 leading-relaxed">
              💡 설치 후에는 주소창 없이 전체 화면 앱으로 실행됩니다.<br />
              로그인 세션은 앱에서도 유지됩니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Android / 기타 안내 모달 ─────────────────────────────────────────────────
function AndroidGuideModal({ onClose }) {
  const steps = [
    { icon: <MoreVertical style={{width:20,height:20,color:'#60a5fa'}} />, title: '오른쪽 상단 메뉴(⋮) 탭', desc: 'Chrome 주소창 오른쪽 점 세 개 아이콘을 탭하세요.' },
    { icon: <Download style={{width:20,height:20,color:'#60a5fa'}} />, title: '"앱 설치" 또는 "홈 화면에 추가" 탭', desc: '메뉴에서 해당 항목을 찾아 탭하세요.' },
    { icon: <CheckCircle2 style={{width:20,height:20,color:'#34d399'}} />, title: '"설치" 버튼으로 완료', desc: '확인 다이얼로그에서 "설치"를 탭하면 홈 화면에 추가됩니다.' },
  ];

  return (
    <div style={{ position:'fixed', inset:0, zIndex:300, display:'flex', alignItems:'flex-end', justifyContent:'center', padding:'0 16px', background:'rgba(0,0,0,0.72)', backdropFilter:'blur(8px)' }}>
      <div style={{ position:'absolute', inset:0 }} onClick={onClose} />
      <div style={{ position:'relative', width:'100%', maxWidth:400, background:'#131927', borderRadius:'24px 24px 0 0', border:'1px solid rgba(255,255,255,0.1)', boxShadow:'0 -8px 40px rgba(0,0,0,0.5)', overflow:'hidden' }}>
        {/* 핸들 */}
        <div style={{ display:'flex', justifyContent:'center', padding:'12px 0 4px' }}>
          <div style={{ width:40, height:4, background:'rgba(255,255,255,0.2)', borderRadius:99 }} />
        </div>

        {/* 헤더 */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 20px 12px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, minWidth:0 }}>
            <div style={{ width:38, height:38, background:'rgba(37,99,235,0.15)', borderRadius:14, border:'1px solid rgba(59,130,246,0.3)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <Smartphone style={{ width:18, height:18, color:'#60a5fa' }} />
            </div>
            <div style={{ minWidth:0 }}>
              <div style={{ fontWeight:700, color:'#fff', fontSize:15, whiteSpace:'nowrap' }}>홈 화면에 추가</div>
              <div style={{ fontSize:11, color:'#64748b', whiteSpace:'nowrap' }}>Chrome 설치 가이드</div>
            </div>
          </div>
          <button onClick={onClose} style={{ padding:8, borderRadius:99, background:'transparent', border:'none', cursor:'pointer', flexShrink:0 }}>
            <X style={{ width:16, height:16, color:'#64748b' }} />
          </button>
        </div>

        {/* 단계 */}
        <div style={{ padding:'20px 20px', paddingBottom:'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}>
          {steps.map((step, i) => (
            <div key={i} style={{ display:'flex', gap:14, alignItems:'flex-start' }}>
              {/* 아이콘 + 연결선 */}
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0 }}>
                <div style={{ width:36, height:36, borderRadius:12, background:'#1e2640', border:'1px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  {step.icon}
                </div>
                {i < steps.length - 1 && (
                  <div style={{ width:1, flexGrow:1, minHeight:20, background:'rgba(255,255,255,0.06)', margin:'4px 0' }} />
                )}
              </div>
              {/* 텍스트 */}
              <div style={{ flex:1, paddingBottom: i < steps.length - 1 ? 16 : 0 }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#475569', fontFamily:'monospace', letterSpacing:'0.1em', marginBottom:4 }}>STEP {i + 1}</div>
                <div style={{ fontSize:14, fontWeight:700, color:'#fff', marginBottom:4 }}>{step.title}</div>
                <div style={{ fontSize:12, color:'#94a3b8', lineHeight:1.5 }}>{step.desc}</div>
              </div>
            </div>
          ))}

          {/* 팁 */}
          <div style={{ marginTop:16, background:'rgba(30,58,138,0.15)', border:'1px solid rgba(59,130,246,0.15)', borderRadius:14, padding:'12px 14px' }}>
            <div style={{ fontSize:12, color:'rgba(96,165,250,0.8)', lineHeight:1.5 }}>
              💡 주소창에 설치 아이콘(⬇)이 자동으로 나타나면 바로 탭해도 됩니다.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 메인 PWA 설치 버튼 ──────────────────────────────────────────────────────
export default function PWAInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState(null); // Android 네이티브 프롬프트
  const [showModal, setShowModal] = useState(false);
  const [installed, setInstalled] = useState(false);
  const { isIOS, isStandalone } = detectPlatform();

  useEffect(() => {
    // 이미 PWA로 실행 중이면 버튼 숨김
    if (isStandalone) { setInstalled(true); return; }

    // Android Chrome: 설치 프롬프트 이벤트 저장
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // 설치 완료 감지
    window.addEventListener('appinstalled', () => setInstalled(true));

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // 이미 설치된 경우 버튼 미표시
  if (installed) return null;

  const handleClick = async () => {
    // Android Chrome에 네이티브 프롬프트가 있으면 바로 실행
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setInstalled(true);
      setDeferredPrompt(null);
      return;
    }
    // iOS / 기타: 가이드 모달 표시
    setShowModal(true);
  };

  return (
    <>
      <button
        id="pwa-install-btn"
        onClick={handleClick}
        className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl border border-blue-500/25 bg-blue-500/8 hover:bg-blue-500/15 active:scale-[0.98] transition-all group"
      >
        <Download className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
        <span className="text-sm font-semibold text-blue-300">홈 화면에 앱 추가하기</span>
        {isIOS && <ChevronDown className="w-3.5 h-3.5 text-blue-400/60" />}
      </button>

      {/* 가이드 모달 */}
      {showModal && (
        isIOS
          ? <IOSGuideModal onClose={() => setShowModal(false)} />
          : <AndroidGuideModal onClose={() => setShowModal(false)} />
      )}
    </>
  );
}
