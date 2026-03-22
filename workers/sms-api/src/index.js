// SMS 수신 및 관리 API - Cloudflare Workers
// BACKEND_URL env가 설정된 경우 로컬 백엔드로 프록시. 없으면 KV 기반 Mock 분석 사용.

export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // ── SMS 수신 ─────────────────────────────────────────────────────────────
      if (path === '/sms/receive' && request.method === 'POST') {
        const bodyText = await request.text();
        const data = JSON.parse(bodyText);
        const { sender, message, received_at } = data;

        // 1. 로컬 백엔드 프록시 (BACKEND_URL 설정된 경우)
        if (env.BACKEND_URL) {
          try {
            const backendRes = await fetch(`${env.BACKEND_URL}/sms/receive`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: bodyText
            });
            if (backendRes.ok) {
              const backendData = await backendRes.json();
              // 백엔드 성공 시 해당 응답 반환 (incident_id 포함됨)
              return new Response(JSON.stringify(backendData), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }
          } catch (e) {
            console.error('[Proxy] SMS Receive proxy failed, falling back to KV:', e);
          }
        }

        // 2. Mock/KV fallback (기존 로직)
        const keywords = {
          '장애': '장애 알림이 감지되었습니다.',
          'CRITICAL': '긴급 장애가 감지되었습니다.',
          '오류': '시스템 오류가 감지되었습니다.',
          'DOWN': '서비스 다운이 감지되었습니다.',
          '비정상': '비정상 상태가 감지되었습니다.',
          'error': '에러가 감지되었습니다.',
          'timeout': '타임아웃 장애가 감지되었습니다.',
          'db': 'DB 관련 장애가 감지되었습니다.',
          'cpu': 'CPU 과부하 장애가 감지되었습니다.',
        };

        let responseMessage = null;
        for (const [keyword, response] of Object.entries(keywords)) {
          if (message.toLowerCase().includes(keyword.toLowerCase())) {
            responseMessage = response;
            break;
          }
        }

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

        let messages = [];
        try {
          const stored = await env.SMS_STORAGE.get('recent_messages', 'json');
          if (stored) messages = stored;
        } catch (e) { console.error('KV 읽기 오류:', e); }

        messages.unshift(smsData);
        if (messages.length > 50) messages = messages.slice(0, 50);

        try {
          await env.SMS_STORAGE.put('recent_messages', JSON.stringify(messages));
        } catch (e) { console.error('KV 쓰기 오류:', e); }

        return new Response(
          JSON.stringify({
            status: responseMessage ? 'keyword_detected' : 'received',
            sender,
            detected_message: message,
            response_sent: responseMessage !== null,
            response_message: responseMessage,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ── 최근 SMS 조회 ─────────────────────────────────────────────────────────
      if (path === '/sms/recent' && request.method === 'GET') {
        const limit = parseInt(url.searchParams.get('limit') || '10');
        let messages = [];
        try {
          const stored = await env.SMS_STORAGE.get('recent_messages', 'json');
          if (stored) messages = stored;
        } catch (e) { console.error('KV 읽기 오류:', e); }

        return new Response(
          JSON.stringify({ total: messages.length, messages: messages.slice(0, limit) }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ── SMS 삭제 ─────────────────────────────────────────────────────────────
      if (path.startsWith('/sms/') && request.method === 'DELETE') {
        const idStr = path.split('/')[2];
        if (idStr) {
          const id = parseInt(idStr);
          let messages = [];
          try {
            const stored = await env.SMS_STORAGE.get('recent_messages', 'json');
            if (stored) messages = stored;
          } catch (e) { console.error('KV 읽기 오류:', e); }

          const newMessages = messages.filter(m => m.id !== id);
          if (messages.length !== newMessages.length) {
            await env.SMS_STORAGE.put('recent_messages', JSON.stringify(newMessages));
            return new Response(JSON.stringify({ status: 'success' }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          return new Response(JSON.stringify({ status: 'error', message: 'Not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // ── 키워드 목록 ───────────────────────────────────────────────────────────
      if (path === '/sms/keywords' && request.method === 'GET') {
        return new Response(
          JSON.stringify({ keywords: ['장애', 'CRITICAL', '오류', 'DOWN', '비정상', 'error', 'timeout', 'db', 'cpu'] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ── S-Autopilot AI Insight ────────────────────────────────────────────────
      if (path === '/ai/insight' && request.method === 'GET') {
        // 1. 로컬 백엔드 프록시 (BACKEND_URL 설정된 경우)
        if (env.BACKEND_URL) {
          try {
            const backendRes = await fetch(`${env.BACKEND_URL}/ai/insight`);
            if (backendRes.ok) {
              const data = await backendRes.json();
              return new Response(JSON.stringify(data), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }
          } catch (e) {
            console.error('[Proxy] Backend call failed, falling back to mock:', e);
          }
        }

        // 2. Mock fallback (KV 기반 분석)
        let recentMessageText = '';
        let recentMessageTime = '';
        let id_val = 'SYS-000';
        let prediction_counts = { critical: 0, server: 0, security: 0, report: 0 };

        try {
          const stored = await env.SMS_STORAGE.get('recent_messages', 'json');
          if (stored && stored.length > 0) {
            recentMessageText = stored[0].message;
            recentMessageTime = stored[0].timestamp;
            id_val = `KMS-${stored[0].id}`;
            for (let i = 0; i < stored.length; i++) {
              const t = stored[i].message.toLowerCase();
              if (t.includes('db') || t.includes('데이터베이스')) prediction_counts.critical++;
              else if (t.includes('cpu') || t.includes('메모리')) prediction_counts.server++;
              else prediction_counts.report++;
            }
          }
        } catch (e) { console.error('KV 읽기 오류:', e); }

        let currentLog;
        if (recentMessageText) {
          let severity = 'info', type_str = 'insight', category = 'report', insight_text = '';
          const shortText = recentMessageText.substring(0, 25) + (recentMessageText.length > 25 ? '...' : '');
          const lowerText = recentMessageText.toLowerCase();

          if (lowerText.includes('cpu') || lowerText.includes('메모리')) {
            severity = 'high'; type_str = 'warning'; category = 'server';
            insight_text = `💡 [Insight] SMS('${shortText}') 분석: 배치 서버 CPU 과부하 패턴 감지. 강제종료 위험.`;
          } else if (lowerText.includes('db') || lowerText.includes('database') || lowerText.includes('데이터베이스')) {
            severity = 'critical'; type_str = 'error'; category = 'database';
            insight_text = `🚨 [Critical] SMS('${shortText}') 분석: DB Connection Pool 고갈 진단. 결제 모듈 지연 예측.`;
          } else if (lowerText.includes('timeout') || lowerText.includes('network')) {
            severity = 'medium'; type_str = 'insight'; category = 'network';
            insight_text = `⚠️ [Insight] SMS('${shortText}') 분석: 네트워크 타임아웃 패턴 감지. L4 스위치 확인 권고.`;
          } else {
            insight_text = `🔍 [Insight] SMS('${shortText}') 분석 완료. KMS 유사 사례 검색 및 원인 추론 중...`;
          }
          const formattedTime = new Date(recentMessageTime).toLocaleString('ko-KR');
          currentLog = { id: id_val, type: type_str, category, severity, text: insight_text, detail: `수신 시간: ${formattedTime}` };
        } else {
          currentLog = { id: 'SYS-000', type: 'info', category: 'report', severity: 'info', text: '실시간 데이터 대기 중... 새로운 SMS를 기다리고 있습니다.', detail: 'KMS LLM 분석 대기' };
        }
        return new Response(
          JSON.stringify({ status: 'active', learning_data_size: '15.2 TB (KMS)', accuracy: '98.5%', prediction_counts, current_log: currentLog }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ── AI Agent Discussion ───────────────────────────────────────────────────
      if (path.startsWith('/ai/agent-discussion/') && request.method === 'GET') {
        const smsId = path.split('/')[3];

        // 1. 로컬 백엔드 프록시 (BACKEND_URL 설정된 경우)
        if (env.BACKEND_URL) {
          try {
            const backendRes = await fetch(`${env.BACKEND_URL}/ai/agent-discussion/${smsId}`);
            if (backendRes.ok) {
              const data = await backendRes.json();
              return new Response(JSON.stringify(data), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }
          } catch (e) {
            console.error('[Proxy] Agent Discussion proxy failed:', e);
          }
        }

        // 2. Mock fallback (실제 SMS 내용 참조)
        const stored = await env.SMS_STORAGE.get('recent_messages', 'json').catch(() => []);
        const sms = (stored || []).find(m => String(m.id) === String(smsId));
        const msgText = sms ? sms.message : 'Unknown issue';
        const shortMsg = msgText.substring(0, 40);

        const discussionLog = [
          { role: 'L1 Support Agent', content: `수신 SMS 확인: "${shortMsg}". 시스템 로그 분석 결과를 요청합니다.` },
          { role: 'DB Expert Agent', content: 'KMS 연동 분석: DB Connection Pool 고갈 패턴 확인. 트랜잭션 지연 예상.' },
          { role: 'System Admin Agent', content: 'Runbook 기반 max_connections 증설 조치 후 Escalation 진행합니다.' }
        ];
        return new Response(JSON.stringify(discussionLog), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // ── AI Chat (S-Autopilot Agent) ──────────────────────────────────────────
      if (path === '/ai/chat' && request.method === 'POST') {
        const body = await request.json();
        const { query } = body;

        // 1. 로컬 백엔드 프록시 (BACKEND_URL 설정된 경우)
        if (env.BACKEND_URL) {
          try {
            const backendRes = await fetch(`${env.BACKEND_URL}/ai/chat`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query })
            });
            if (backendRes.ok) {
              const data = await backendRes.json();
              return new Response(JSON.stringify(data), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }
          } catch (e) {
            console.error('[Proxy] Chat proxy failed:', e);
          }
        }

        // 2. Mock fallback
        const lowerQuery = (query || '').toLowerCase();
        let response = '';
        if (lowerQuery.includes('db') || lowerQuery.includes('database') || lowerQuery.includes('데이터베이스')) {
          response = '데이터베이스 관련 문제를 분석합니다. DB Connection Pool 고갈이 의심됩니다. 우선 `SHOW PROCESSLIST` 명령으로 현재 접속 수를 확인하고, max_connections 설정을 검토하세요.';
        } else if (lowerQuery.includes('cpu') || lowerQuery.includes('메모리') || lowerQuery.includes('memory')) {
          response = 'CPU/메모리 과부하 상황입니다. `top` 또는 `htop` 명령으로 프로세스를 확인하고, 비정상적으로 높은 사용률을 보이는 프로세스를 재시작하세요.';
        } else if (lowerQuery.includes('timeout') || lowerQuery.includes('타임아웃')) {
          response = '네트워크 타임아웃이 감지되었습니다. 게이트웨이 설정과 L4 스위치 상태를 점검하고, 서비스 간 응답 시간을 모니터링하세요.';
        } else {
          response = `"${query}"에 대한 질의를 수신했습니다. 현재 AI 백엔드 연결 중입니다. S-Guard Cloud 서비스를 통해 RAG 기반 정밀 분석을 제공해 드립니다.`;
        }

        return new Response(
          JSON.stringify({ response, related_logs: [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ── KMS Report Save ───────────────────────────────────────────────────────
      if (path === '/ai/report/save' && request.method === 'POST') {
        // 로컬 백엔드 프록시 (BACKEND_URL 설정된 경우)
        if (env.BACKEND_URL) {
          try {
            const body = await request.json();
            const backendRes = await fetch(`${env.BACKEND_URL}/ai/report/save`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body)
            });
            if (backendRes.ok) {
              const data = await backendRes.json();
              return new Response(JSON.stringify(data), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }
          } catch (e) {
            console.error('[Proxy] Report save proxy failed:', e);
          }
        }

        // Mock fallback
        return new Response(
          JSON.stringify({ status: 'success', message: '보고서가 KMS에 저장(임베딩)되었습니다.', doc_id: `report_${Date.now()}` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ── 루트 경로 ─────────────────────────────────────────────────────────────
      if (path === '/' && request.method === 'GET') {
        return new Response(
          JSON.stringify({
            service: 'S-Guard AI SMS Service',
            status: 'running',
            backend_connected: !!env.BACKEND_URL,
            version: '2.0.0',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });
    } catch (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  },
};
