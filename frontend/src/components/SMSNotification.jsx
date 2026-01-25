import React, { useEffect, useState } from 'react';
import { X, AlertCircle, CheckCircle, Info } from 'lucide-react';

export default function SMSNotification() {
  const [notifications, setNotifications] = useState([]);
  const [ws, setWs] = useState(null);

  useEffect(() => {
    // WebSocket 연결
    const websocket = new WebSocket('ws://localhost:8000/ws');

    websocket.onopen = () => {
      console.log('WebSocket 연결됨');
      websocket.send('ping'); // 연결 유지
    };

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('SMS 수신:', data);

      if (data.type === 'sms_received') {
        const newNotification = {
          id: Date.now(),
          sender: data.sender,
          message: data.message,
          timestamp: new Date(data.timestamp),
          keywordDetected: data.keyword_detected,
          responseMessage: data.response_message,
        };

        setNotifications((prev) => [newNotification, ...prev].slice(0, 3)); // 최대 3개만 표시

        // 5초 후 자동 제거
        setTimeout(() => {
          setNotifications((prev) => prev.filter((n) => n.id !== newNotification.id));
        }, 5000);
      }
    };

    websocket.onerror = (error) => {
      console.error('WebSocket 오류:', error);
    };

    websocket.onclose = () => {
      console.log('WebSocket 연결 종료');
    };

    setWs(websocket);

    return () => {
      if (websocket) {
        websocket.close();
      }
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
          className="bg-gradient-to-r from-blue-600 to-blue-500 rounded-2xl p-4 shadow-2xl shadow-blue-900/50 animate-slide-down pointer-events-auto border border-blue-400/30"
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
                  <div className="mt-2 bg-white/10 rounded-lg p-2 border border-white/20">
                    <p className="text-xs text-blue-100 flex items-center space-x-1">
                      <CheckCircle className="w-3 h-3" />
                      <span>자동 응답: {notification.responseMessage}</span>
                    </p>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => removeNotification(notification.id)}
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
