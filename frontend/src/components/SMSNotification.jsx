import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, AlertCircle, CheckCircle, Info } from 'lucide-react';

export default function SMSNotification() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const API_BASE = 'https://sguardai.khcho0421.workers.dev';

  useEffect(() => {
    // Server-Sent Events (SSE) 연결
    const eventSource = new EventSource(`${API_BASE}/sms/notification-stream`);

    eventSource.onopen = () => {
      console.log('SSE 스트림 연결됨');
    };

    // 'sms_received' 이벤트 핸들러
    eventSource.addEventListener('sms_received', (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('실시간 SMS 수신 (SSE):', data);

        const newNotification = {
          id: Date.now(),
          sender: data.sender,
          message: data.message,
          timestamp: new Date(data.timestamp || Date.now()),
          keywordDetected: data.keyword_detected === 1 || data.keyword_detected === true,
          responseMessage: data.response_message,
        };

        setNotifications((prev) => [newNotification, ...prev].slice(0, 3));

        // 5초 후 자동 제거
        setTimeout(() => {
          setNotifications((prev) => prev.filter((n) => n.id !== newNotification.id));
        }, 5000);
      } catch (error) {
        console.error('SSE data parse error:', error);
      }
    });

    eventSource.onerror = (error) => {
      console.error('SSE 연결 오류:', error);
      // 브라우저가 자동으로 재연결을 시도하지만, 에러 로그를 남깁니다.
    };

    return () => {
      console.log('SSE 스트림 연결 종료');
      eventSource.close();
    };
  }, []);

  const removeNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-20 left-0 right-0 z-50 px-5 space-y-3 pointer-events-none">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className="bg-gradient-to-r from-blue-600 to-blue-500 rounded-2xl p-4 shadow-2xl shadow-blue-900/50 animate-slide-down pointer-events-auto border border-blue-400/30 cursor-pointer group hover:scale-[1.02] transition-all"
          onClick={() => {
            if (notification.responseMessage) {
              navigate('/assignments');
              removeNotification(notification.id);
            }
          } }
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3 flex-1">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                {notification.keywordDetected ? (
                  <AlertCircle className="w-6 h-6 text-yellow-300" />
                ) : (
                  <Info className="w-6 h-6 text-white" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  <h3 className="font-bold text-white text-sm">SMS 수신</h3>
                  {notification.keywordDetected && (
                    <span className="bg-yellow-400 text-yellow-900 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      키워드 감지
                    </span>
                  )}
                </div>
                <p className="text-xs text-blue-100 mb-1">
                  발신: {notification.sender}
                </p>
                <p className="text-sm text-white font-medium leading-snug">
                  {notification.message}
                </p>
                {notification.responseMessage && (
                  <div className="mt-2 bg-white/10 rounded-lg p-2 border border-white/20 group-hover:bg-white/20 transition-colors">
                    <p className="text-xs text-blue-100 flex items-center space-x-1">
                      <CheckCircle className="w-3 h-3" />
                      <span>
                        자동 응답: {notification.responseMessage.includes('AI 분석을 시작합니다.') 
                          ? notification.responseMessage.replace('AI 분석을 시작합니다.', '장애등록및 War-Room 생성이 완료 되었습니다.')
                          : notification.responseMessage}
                      </span>
                    </p>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeNotification(notification.id);
              }}
              className="ml-2 p-1 rounded-full hover:bg-white/20 transition-colors shrink-0"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
