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
