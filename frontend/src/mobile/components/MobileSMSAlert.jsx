import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAccessToken } from '../../lib/authStore';
import { AlertCircle, X, Info } from 'lucide-react';

/**
 * 📱 모바일 최적화 SMS 알림 토스트
 * - 화면 상단 슬라이드-인 알림 (최대 1개 표시)
 * - 탭으로 War-Room 이동
 * - 5초 자동 소멸
 */
export default function MobileSMSAlert() {
  const navigate = useNavigate();
  const [alert, setAlert] = useState(null);
  const API_BASE = 'https://sguardai.khcho0421.workers.dev';

  useEffect(() => {
    let isMounted = true;
    let esInstance = null;
    let retryCount = 0;
    let retryTimer = null;

    function connect() {
      const token = getAccessToken();
      if (!token || !isMounted) return;

      if (esInstance) { esInstance.close(); esInstance = null; }

      const es = new EventSource(`${API_BASE}/sms/notification-stream?token=${token}`);
      esInstance = es;

      es.addEventListener('sms_received', (e) => {
        retryCount = 0;
        try {
          const data = JSON.parse(e.data);
          const item = {
            id: Date.now(),
            sender: data.sender,
            message: data.message,
            keyword: parseInt(String(data.keyword_detected || '0')) > 0,
            incId: data.inc_id,
          };
          if (!isMounted) return;
          setAlert(item);
          setTimeout(() => setAlert(null), 5000);
        } catch (_) {}
      });

      es.addEventListener('connected', () => { retryCount = 0; });

      es.onerror = () => {
        es.close();
        esInstance = null;
        if (!isMounted) return;
        const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
        retryCount += 1;
        retryTimer = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      isMounted = false;
      clearTimeout(retryTimer);
      if (esInstance) { esInstance.close(); esInstance = null; }
    };
  }, []);

  if (!alert) return null;

  return (
    <div
      className="fixed top-4 left-4 right-4 z-[200] animate-slide-down"
      style={{ top: 'calc(env(safe-area-inset-top) + 12px)' }}
    >
      <div
        onClick={() => {
          if (alert.incId) navigate(`/chat/${alert.incId}`);
          setAlert(null);
        }}
        className="bg-gradient-to-r from-blue-700 to-blue-600 rounded-2xl p-4 shadow-2xl shadow-blue-900/60 border border-blue-400/30 flex items-start gap-3 active:scale-[0.98] transition-transform cursor-pointer"
      >
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0 mt-0.5">
          {alert.keyword ? <AlertCircle className="w-5 h-5 text-yellow-300" /> : <Info className="w-5 h-5 text-white" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-white">SMS 수신</span>
            {alert.keyword && (
              <span className="bg-yellow-400 text-yellow-900 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                장애감지
              </span>
            )}
          </div>
          <p className="text-[11px] text-blue-200 truncate">발신: {alert.sender}</p>
          <p className="text-sm text-white font-medium leading-snug line-clamp-2 mt-0.5">{alert.message}</p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); setAlert(null); }}
          className="p-1.5 rounded-full hover:bg-white/20 transition-colors shrink-0"
        >
          <X className="w-4 h-4 text-white" />
        </button>
      </div>
    </div>
  );
}
