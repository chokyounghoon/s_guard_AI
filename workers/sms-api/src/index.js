// SMS 수신 및 관리 API - Cloudflare Workers
// Cloudflare KV를 사용하여 SMS 메시지 저장

export default {
  async fetch(request, env) {
    // CORS 헤더
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // OPTIONS 요청 처리 (CORS preflight)
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // SMS 수신 엔드포인트
      if (path === '/sms/receive' && request.method === 'POST') {
        const data = await request.json();
        const { sender, message, received_at } = data;

        // 키워드 체크
        const keywords = {
          '장애': '장애 알림이 감지되었습니다. S-Guard AI 시스템에 자동 등록되었습니다.',
          'CRITICAL': '긴급 장애가 감지되었습니다. 즉시 War-Room을 통해 확인해주세요.',
          '오류': '시스템 오류가 감지되었습니다. AI 분석을 시작합니다.',
          'DOWN': '서비스 다운이 감지되었습니다. 긴급 대응팀에 알림을 전송했습니다.',
          '비정상': '비정상 상태가 감지되었습니다. 자동 분석 중입니다.',
        };

        let responseMessage = null;
        for (const [keyword, response] of Object.entries(keywords)) {
          if (message.includes(keyword)) {
            responseMessage = response;
            break;
          }
        }

        // SMS 메시지 저장
        const smsId = Date.now();
        const smsData = {
          id: smsId,
          sender,
          message,
          timestamp: received_at || new Date().toISOString(),
          keyword_detected: responseMessage !== null,
          response_message: responseMessage,
          read: false,
        };

        // KV에 저장 (최근 메시지 목록 가져오기)
        let messages = [];
        try {
          const stored = await env.SMS_STORAGE.get('recent_messages', 'json');
          if (stored) messages = stored;
        } catch (e) {
          console.error('KV 읽기 오류:', e);
        }

        // 새 메시지 추가 (최대 50개 유지)
        messages.unshift(smsData);
        if (messages.length > 50) messages = messages.slice(0, 50);

        // KV에 저장
        try {
          await env.SMS_STORAGE.put('recent_messages', JSON.stringify(messages));
        } catch (e) {
          console.error('KV 쓰기 오류:', e);
        }

        return new Response(
          JSON.stringify({
            status: responseMessage ? 'keyword_detected' : 'received',
            sender,
            detected_message: message,
            response_sent: responseMessage !== null,
            response_message: responseMessage,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // 최근 SMS 조회 엔드포인트
      if (path === '/sms/recent' && request.method === 'GET') {
        const limit = parseInt(url.searchParams.get('limit') || '10');

        let messages = [];
        try {
          const stored = await env.SMS_STORAGE.get('recent_messages', 'json');
          if (stored) messages = stored;
        } catch (e) {
          console.error('KV 읽기 오류:', e);
        }

        return new Response(
          JSON.stringify({
            total: messages.length,
            messages: messages.slice(0, limit),
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // SMS 삭제 엔드포인트
      if (path.startsWith('/sms/') && request.method === 'DELETE') {
        const idStr = path.split('/')[2];
        if (idStr) {
          const id = parseInt(idStr);
          let messages = [];
          try {
            const stored = await env.SMS_STORAGE.get('recent_messages', 'json');
            if (stored) messages = stored;
          } catch (e) {
            console.error('KV 읽기 오류:', e);
          }

          const newMessages = messages.filter(m => m.id !== id);
          if (messages.length !== newMessages.length) {
            try {
              await env.SMS_STORAGE.put('recent_messages', JSON.stringify(newMessages));
            } catch (e) {
              console.error('KV 쓰기 오류:', e);
            }
            return new Response(JSON.stringify({ status: 'success', message: 'Deleted successfully' }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          return new Response(JSON.stringify({ status: 'error', message: 'Message not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // 키워드 목록 조회
      if (path === '/sms/keywords' && request.method === 'GET') {
        const keywords = {
          '장애': '장애 알림이 감지되었습니다. S-Guard AI 시스템에 자동 등록되었습니다.',
          'CRITICAL': '긴급 장애가 감지되었습니다. 즉시 War-Room을 통해 확인해주세요.',
          '오류': '시스템 오류가 감지되었습니다. AI 분석을 시작합니다.',
          'DOWN': '서비스 다운이 감지되었습니다. 긴급 대응팀에 알림을 전송했습니다.',
          '비정상': '비정상 상태가 감지되었습니다. 자동 분석 중입니다.',
        };

        return new Response(
          JSON.stringify({
            keywords: Object.entries(keywords).map(([keyword, response]) => ({
              keyword,
              response,
            })),
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // S-Autopilot AI Insight (KMS 연동 LLM 분석 시뮬레이션)
      if (path === '/ai/insight' && request.method === 'GET') {
        let maxLen = 15;
        let recentMessageText = "";
        let recentMessageTime = "";
        let id_val = "SYS-000";
        let prediction_counts = {
          critical: 0,
          server: 0,
          security: 0,
          report: 0
        };

        try {
          const stored = await env.SMS_STORAGE.get('recent_messages', 'json');
          if (stored && stored.length > 0) {
            recentMessageText = stored[0].message;
            recentMessageTime = stored[0].timestamp;
            id_val = `KMS-${stored[0].id}`;

            // 모든 최근 메시지에 대해 카운팅 루프 (최대 100건 가량)
            for (let i = 0; i < stored.length; i++) {
              let msg_text_lower = stored[i].message.toLowerCase();
              if (msg_text_lower.includes("db") || msg_text_lower.includes("데이터베이스")) {
                prediction_counts.critical += 1;
              } else if (msg_text_lower.includes("cpu") || msg_text_lower.includes("메모리")) {
                prediction_counts.server += 1;
              } else {
                prediction_counts.report += 1;
              }
            }
          }
        } catch (e) {
          console.error('KV 읽기 오류:', e);
        }

        let currentLog;
        if (recentMessageText) {
          let severity = "info";
          let type_str = "insight";
          let category = "report";
          let insight_text = "";
          let shortText = recentMessageText.substring(0, maxLen) + (recentMessageText.length > maxLen ? "..." : "");
          let lowerText = recentMessageText.toLowerCase();

          if (lowerText.includes("cpu") || lowerText.includes("메모리")) {
             severity = "high";
             type_str = "warning";
             category = "server";
             insight_text = `💡 [Insight] 수신된 SMS ('${shortText}') 기반 분석: 신한DS KMS 연동 LLM 분석 결과, 과거 배치 작업 중 발생한 서버 과부하 패턴과 98% 일치하며 시스템 강제종료가 예측됩니다.`;
          } else if (lowerText.includes("db") || lowerText.includes("데이터베이스")) {
             severity = "critical";
             type_str = "error";
             category = "database";
             insight_text = `🚨 [Critical] 수신된 SMS ('${shortText}') 기반 분석: 신한DS KMS 연동 LLM 분석 결과, DB Connection Pool 고갈 패턴과 94% 일치. 결제 모듈 응답 지연 예측됨.`;
          } else if (lowerText.includes("네트워크") || lowerText.includes("network")) {
             severity = "medium";
             type_str = "insight";
             category = "network";
             insight_text = `⚠️ [Insight] 수신된 SMS ('${shortText}') 기반 분석: 신한DS KMS 연동 LLM 분석 결과, L4 스위치 트래픽 포화 상태 예측됨.`;
          } else {
             insight_text = `🔍 [Insight] 수신된 SMS ('${shortText}') 기반 분석: 신한DS KMS 연동 LLM이 유사 사례를 분석 중입니다. 분석결과 일시적 발생 오류로 판단됩니다.`;
          }

          let formattedTime = new Date(recentMessageTime).toLocaleString('ko-KR');
          currentLog = {
             id: id_val,
             type: type_str,
             category: category,
             severity: severity,
             text: insight_text,
             detail: `수신 시간: ${formattedTime}`
          };
        } else {
          currentLog = {
             id: "SYS-000",
             type: "info",
             category: "report",
             severity: "info",
             text: "실시간 데이터 대기 중... 새로운 SMS를 기다리고 있습니다.",
             detail: "신한DS KMS 연동 LLM 분석 대기 중"
          };
        }

        return new Response(
          JSON.stringify({
            status: "active",
            learning_data_size: "15.2 TB (KMS)",
            accuracy: "98.5%",
            prediction_counts: prediction_counts,
            current_log: currentLog
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // 루트 경로
      if (path === '/' && request.method === 'GET') {
        return new Response(
          JSON.stringify({
            service: 'S-Guard AI SMS Service',
            status: 'running',
            version: '1.0.0',
            endpoints: {
              'POST /sms/receive': 'SMS 수신',
              'GET /sms/recent?limit=10': '최근 SMS 조회',
              'GET /sms/keywords': '키워드 목록',
            },
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // 404
      return new Response('Not Found', { status: 404, headers: corsHeaders });
    } catch (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  },
};
