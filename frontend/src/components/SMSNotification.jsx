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

          // ── 30초 대기 후 설정된 기기 푸시(전화) 테스트 발신 수행 ──
          setTimeout(async () => {
            console.log('⏰ [SMSNotification] 문자 수신 후 30초 경과: 설정된 테스트 발신 실행 시작');
            try {
              // S-Callert 페이지에서 설정한 기기/번호를 로컬 스토리지에서 가져옴
              const targetEmpId = localStorage.getItem('scallert_test_device');
              const targetPhone = localStorage.getItem('scallert_test_phone');
              
              if (!targetEmpId || !targetPhone) {
                console.log('⚠️ [SMSNotification] S-Callert 설정 화면에서 발송 기기 및 테스트 번호가 선택되지 않았습니다.');
                return;
              }
              
              console.log(`✅ [SMSNotification] 발송 대상 확인 완료: 기기(사번)=${targetEmpId}, 전화번호=${targetPhone}`);
              
              // 3. 실제 기기 푸시 테스트 발신 API 호출
              console.log('🚀 [SMSNotification] 실제 기기 푸시(전화 걸기) 테스트 API(/scallert/test-push) 호출 중...');
              const pushRes = await fetch(`${API_BASE}/scallert/test-push`, {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${getAccessToken()}` 
                },
                body: JSON.stringify({
                  target_user_id: targetEmpId,
                  phone_number: targetPhone
                })
              });
              
              const pushData = await pushRes.json();
              if (pushData.success) {
                console.log('🎉 [SMSNotification] 기기 푸시 발신 성공:', pushData);
                toast.success(`[자동 발신 성공] 설정된 기기로 푸시 발송이 시작되었습니다.`, { duration: 5000 });
              } else {
                console.error('❌ [SMSNotification] 기기 푸시 발신 실패:', pushData);
                toast.error(`[자동 발신 실패] ${pushData.error || '알 수 없는 오류'}`);
              }
              
            } catch (error) {
              console.error('💥 [SMSNotification] 발신 자동 수행 중 치명적 오류 발생:', error);
            }
          }, 30000);

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
          toast.success(`[S-Callert 발신 완료]\n${targetName} 님께 푸시 발송됨`, { duration: 4000 });

        } catch (error) {
          console.error('[SSE] scallert_triggered parse error:', error);
        }
      });

      // ── ping 이벤트 (heartbeat) ──
      es.addEventListener('ping', () => {
        // 연결 살아있음 확인용 (UI 업데이트 불필요)
      });

      es.onerror = (error) => {
        console.error(`❌ [SSE] 연결 오류 (readyState: ${es.readyState})`, error);
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
