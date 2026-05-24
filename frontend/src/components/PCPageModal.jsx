import React, { useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, ArrowLeft } from 'lucide-react';

/**
 * PCPageModal
 * - lg(1024px) 이상 화면에서 대시보드가 아닌 페이지를 모달 오버레이로 표시
 * - 모바일(< 1024px)에서는 children을 그대로 full-page 렌더링
 * - ESC 키 또는 닫기/뒤로가기 버튼으로 /dashboard 복귀
 */
export default function PCPageModal({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  const isPC = typeof window !== 'undefined'
    ? window.matchMedia('(min-width: 1024px)').matches
    : false;

  const isIframe = typeof window !== 'undefined'
    ? window.self !== window.top
    : false;

  const handleClose = useCallback(() => {
    navigate('/dashboard', { replace: true });
  }, [navigate]);

  if (isIframe) {
    return <>{children}</>;
  }

  // ESC 키로 닫기
  useEffect(() => {
    if (!isPC) return;
    const onKey = (e) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isPC, handleClose]);

  // Mobile Popup Mode Routes
  const modalPaths = ['/chat-summary/', '/inbox', '/report/', '/ai-report/', '/incident-push', '/workflow'];
  const isModalPage = modalPaths.some(path => location.pathname.includes(path));

  // 모바일: 기본적으로 full-page 렌더링하지만, 특정 페이지들은 팝업 형태로 유지
  if (!isPC && !isModalPage) {
    return <>{children}</>;
  }

  // PC: 모달 오버레이
  return (
    <div
      className={`fixed inset-0 z-[300] flex items-center justify-center ${isPC ? 'p-6 lg:p-10' : 'p-3 sm:p-6'}`}
      onClick={handleClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md animate-in fade-in duration-200" />

      {/* Modal Panel */}
      <div
        className={`
          relative z-10 w-full ${location.pathname.includes('/workflow') ? 'max-w-[92vw]' : 'max-w-5xl'} h-fit
          bg-[#0f1421] border border-white/10 rounded-[2.5rem] shadow-2xl
          flex flex-col overflow-hidden
          animate-in zoom-in-95 fade-in duration-300
        `}
        style={{ maxHeight: isPC ? 'calc(100vh - 4rem)' : 'calc(100vh - 2rem)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Bar - 특정 페이지들은 자체 헤더를 사용하므로 숨김 */}
        {!isModalPage && (
          <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 bg-[#080c18] shrink-0">
            <button
              onClick={handleClose}
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-bold group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              <span>대시보드</span>
            </button>

            {/* 현재 경로 표시 */}
            <span className="text-[10px] font-mono text-slate-600 uppercase tracking-widest">
              {location.pathname}
            </span>

            <button
              onClick={handleClose}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Page Content — each page manages its own scroll */}
        <div className="flex-1 overflow-y-auto flex flex-col custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
}
