import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAccessToken } from '../lib/authStore';
import { X, AlertCircle, CheckCircle, Info, Wifi, WifiOff } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function SMSNotification() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [sseStatus, setSseStatus] = useState('connecting'); // 'connecting' | 'connected' | 'error'
  const esRef = useRef(null);
  const reconnectTimer = useRef(null);
  const retryCount = useRef(0);
  const API_BASE = 'https://sguardai.khcho0421.workers.dev';

  useEffect(() => {
    let isMounted = true;

    function connect() {
      const token = getAccessToken();
      if (!token || !isMounted) return;

      console.log(`[SSE] Connecting... (attempt #${retryCount.current + 1})`);
      setSseStatus('connecting');

      // 기존 연결 정리
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }

      const es = new EventSource(`${API_BASE}/sms/notification-stream?token=${token}`);
      esRef.current = es;

      es.onopen = () => {
        console.log('✅ [SSE] 스트림 연결됨');
        setSseStatus('connected');
        retryCount.current = 0; // 성공 시 재시도 카운터 초기화
      };

      // 서버가 보내는 connected 확인 이벤트
      es.addEventListener('connected', (event) => {
        console.log('✅ [SSE] connected 이벤트 수신:', event.data);
        setSseStatus('connected');
        retryCount.current = 0;
      });

      // ── sms_received 이벤트 핸들러 ──
      // 서버는 flat JSON { inc_id, sender, message, timestamp, keyword_detected, response_message, ... } 구조로 전송
      es.addEventListener('sms_received', (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📨 [SSE] 실시간 SMS 수신:', data);

          const newNotification = {
            id: Date.now(),
            incId: data.inc_id,
            sender: data.sender || data.sender_name || '시스템 알림',
            message: data.message || '내용 없음',
            timestamp: new Date(data.timestamp || Date.now()),
            keywordDetected: parseInt(String(data.keyword_detected || '0')) > 0,
            responseMessage: data.response_message,
          };

          if (!isMounted) return;
          setNotifications((prev) => [newNotification, ...prev].slice(0, 3));

          // 5초 후 자동 제거
          setTimeout(() => {
            setNotifications((prev) => prev.filter((n) => n.id !== newNotification.id));
          }, 5000);

          // ── 발동 대기 시간 후 설정된 기기 푸시(전화) 테스트 발신 수행 ──
          const delaySec = parseInt(localStorage.getItem('scallert_test_delay') || '30', 10);
          console.log(`⏰ [SMSNotification] 문자 수신 후 ${delaySec}초 대기 시작...`);
          
          setTimeout(async () => {
            console.log(`⏰ [SMSNotification] ${delaySec}초 경과: 팝업 알림 표시 및 테스트 발신 실행`);
            
            toast.custom((t) => (
              <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-[#1e293b] shadow-2xl rounded-2xl pointer-events-auto flex ring-1 ring-black ring-opacity-5 overflow-hidden border border-red-500/30`}>
                <div className="flex-1 w-0 p-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0 pt-0.5">
                      <AlertCircle className="h-10 w-10 text-red-500 animate-pulse" />
                    </div>
                    <div className="ml-3 flex-1">
                      <p className="text-sm font-black text-white uppercase tracking-widest">
                        비상 호출 자동 발신
                      </p>
                      <p className="mt-1 text-xs text-slate-300">
                        발동 대기 시간({delaySec}초)이 경과되어,<br/>등록된 기기로 실제 비상 호출을 시도합니다.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex border-l border-white/10 bg-red-500/10">
                  <button
                    onClick={() => toast.dismiss(t.id)}
                    className="w-full border border-transparent rounded-none rounded-r-2xl p-4 flex items-center justify-center text-sm font-black text-red-400 hover:text-red-300 hover:bg-red-500/20 focus:outline-none transition-all"
                  >
                    확인
                  </button>
                </div>
              </div>
            ), { duration: 5000, position: 'top-center' });

            // ⚠️ [수정됨] 실제 전화 발신 로직은 백엔드(DO Alarm)에서 "대상자의 실제 번호"로 정확하게 수행되므로,
            // 프론트엔드에서는 '테스트 번호'로 보내는 잘못된 중복 발신 API 호출을 제거합니다.
            console.log(`✅ [SMSNotification] 자동 발신 알림 표출 완료 (실제 발신은 백엔드에서 대상자 번호로 진행됨)`);
          }, delaySec * 1000);

        } catch (error) {
          console.error('[SSE] sms_received parse error:', error);
        }
      });

      // ── S-Callert 발신 완료 이벤트 핸들러 ──
      // 서버는 flat JSON { strategy_id, inc_id, target_emp, target_name, target_mobile, dispatcher_device } 구조
      es.addEventListener('scallert_triggered', (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('🔔 [SSE] S-Callert Triggered:', data);

          const targetName = data.target_name || data.data?.target_name || '담당자';
          const dispatcherDevice = data.dispatcher_device || data.data?.dispatcher_device || '발송 기기';
          toast.success(`[S-Callert 발신 완료]\n${dispatcherDevice}에서 ${targetName} 님께 자동 전화 발신 중`, { duration: 5000 });

        } catch (error) {
          console.error('[SSE] scallert_triggered parse error:', error);
        }
      });

      // ── ping 이벤트 (heartbeat) ──
      es.addEventListener('ping', () => {
        // 연결 살아있음 확인용 (UI 업데이트 불필요)
      });

      es.onerror = (error) => {
        if (es.readyState === EventSource.CONNECTING) {
          // 브라우저가 기본적으로 재연결을 시도 중임
          console.warn(`⏳ [SSE] 연결 재시도 중... (자동 복구 대기)`);
          return;
        }

        console.warn(`❌ [SSE] 연결 종료 (readyState: ${es.readyState})`);
        setSseStatus('error');
        es.close();
        esRef.current = null;

        if (!isMounted) return;

        // 지수 백오프 재연결: 1s → 2s → 4s → 8s → 최대 30s
        const delay = Math.min(1000 * Math.pow(2, retryCount.current), 30000);
        retryCount.current += 1;
        console.log(`[SSE] ${delay}ms 후 재연결 시도...`);
        reconnectTimer.current = setTimeout(() => {
          if (isMounted) connect();
        }, delay);
      };
    }

    connect();

    return () => {
      isMounted = false;
      clearTimeout(reconnectTimer.current);
      if (esRef.current) {
        console.log('[SSE] 스트림 연결 종료');
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, []);

  const removeNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  if (notifications.length === 0) return null;

  return (
    <>
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
    </>
  );
}
