/**
 * S-callert: IGW 장애 이벤트 수신 → PDS 큐(D1) 적재
 * Path: /api/scallert/igw-event/route.ts  (Next.js App Router)
 *
 * [흐름]
 *  1. IGW POST → 이 엔드포인트 수신
 *  2. 전략 마스터(TB_SCL_STRATEGY_MST)에서 활성 전략 조회
 *  3. 전략에 매핑된 담당자(TB_SCL_TARGET_INFO) 순서대로 발신
 *  4. 발신 이력(TB_SCL_CALL_HIST) D1에 적재
 *  5. 실제 PDS API 호출 (하단 callPds 함수 참조)
 */

import { NextRequest, NextResponse } from 'next/server';

// ── 환경 변수 (Cloudflare Pages 환경) ──
declare const env: {
  DB: D1Database;                        // Cloudflare D1 binding
  IGW_SECRET: string;                    // IGW 공유 시크릿 (HMAC 검증용)
  PDS_API_URL: string;                   // PDS 장비 REST 엔드포인트
  PDS_API_KEY: string;                   // PDS API 인증 키
};

// ── IGW 이벤트 페이로드 타입 ────────────────────────────────
interface IgwEventPayload {
  igw_txn_id:    string;   // IGW 고유 트랜잭션 ID
  inc_id?:       string;   // S-GUARD 인시던트 ID (선택)
  strategy_id:   string;   // 적용할 전략 ID
  event_type:    string;   // FAULT / RECOVER / TEST
  severity?:     string;   // CRITICAL / MAJOR / MINOR
  message?:      string;   // 장애 요약 메시지
  occurred_at?:  string;   // 장애 발생 시각 (ISO8601)
}

// ── PDS 발신 결과 타입 ───────────────────────────────────────
interface PdsCallResult {
  success:      boolean;
  result_code:  'SUCCESS' | 'FAIL' | 'BUSY' | 'NOANSWER';
  raw_response?: unknown;
}

// ── PDS 장비 실제 호출 (뼈대 구현) ──────────────────────────
async function callPds(params: {
  mobile_no:  string;
  emp_nm:     string;
  message?:   string;
  igw_txn_id: string;
}): Promise<PdsCallResult> {
  try {
    const resp = await fetch(env.PDS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${env.PDS_API_KEY}`,
      },
      body: JSON.stringify({
        phone:      params.mobile_no,
        name:       params.emp_nm,
        message:    params.message || '장애 발생 알림',
        ref_id:     params.igw_txn_id,
        call_type:  'FAULT_ALERT',
      }),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      console.error('[PDS] API error:', resp.status, text);
      return { success: false, result_code: 'FAIL' };
    }

    const data = await resp.json<{ result_code: string }>();
    const code = (data.result_code || 'SUCCESS').toUpperCase() as PdsCallResult['result_code'];
    return { success: code === 'SUCCESS', result_code: code, raw_response: data };

  } catch (err) {
    console.error('[PDS] Network error:', err);
    return { success: false, result_code: 'FAIL' };
  }
}

// ── 메인 핸들러 ─────────────────────────────────────────────
export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. IGW 시크릿 검증 (X-IGW-Secret 헤더)
  const igwSecret = req.headers.get('x-igw-secret');
  if (igwSecret !== env.IGW_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: IgwEventPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { igw_txn_id, strategy_id, event_type, inc_id, message, severity } = payload;

  if (!igw_txn_id || !strategy_id) {
    return NextResponse.json({ error: 'igw_txn_id and strategy_id are required' }, { status: 400 });
  }

  // RECOVER 이벤트는 이력만 기록하고 발신 생략
  if (event_type === 'RECOVER') {
    return NextResponse.json({ ok: true, skipped: true, reason: 'RECOVER event - no call dispatched' });
  }

  try {
    // 2. 전략 마스터 조회
    const strategy = await env.DB
      .prepare('SELECT * FROM TB_SCL_STRATEGY_MST WHERE STRATEGY_ID = ? AND USE_YN = ?')
      .bind(strategy_id, 'Y')
      .first<{ STRATEGY_ID: string; MAX_CALL_CNT: number }>();

    if (!strategy) {
      return NextResponse.json({ error: 'Strategy not found or inactive', strategy_id }, { status: 404 });
    }

    // 3. 담당자 목록 조회 (발신 우선순위 순)
    const { results: targets } = await env.DB
      .prepare('SELECT * FROM TB_SCL_TARGET_INFO WHERE STRATEGY_ID = ? ORDER BY SORT_ORD ASC')
      .bind(strategy_id)
      .all<{ SEQ_NO: number; EMP_ID: string; EMP_NM: string; MOBILE_NO: string }>();

    if (!targets || targets.length === 0) {
      return NextResponse.json({ error: 'No targets configured for strategy', strategy_id }, { status: 404 });
    }

    // 4. 순차 발신 (최대 MAX_CALL_CNT 회)
    const results: Array<{ emp_id: string; attempt: number; result_code: string; log_id: number }> = [];
    const maxAttempts = strategy.MAX_CALL_CNT;
    const now = new Date().toISOString();

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // 발신할 담당자: attempt 회차에 따라 순환
      const target = targets[(attempt - 1) % targets.length];

      // PDS 호출
      const pdsResult = await callPds({
        mobile_no:  target.MOBILE_NO,
        emp_nm:     target.EMP_NM,
        message:    `[${severity || 'CRITICAL'}] ${message || '장애가 감지되었습니다.'}`,
        igw_txn_id,
      });

      // 5. 이력 DB 적재
      const { meta } = await env.DB
        .prepare(`
          INSERT INTO TB_SCL_CALL_HIST
            (STRATEGY_ID, EMP_ID, ATTEMPT_SEQ, IGW_TXN_ID, PDS_RESULT_CD, CALL_DT, INC_ID, RAW_PAYLOAD, REG_ID)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          strategy_id,
          target.EMP_ID,
          attempt,
          igw_txn_id,
          pdsResult.result_code,
          now,
          inc_id ?? null,
          JSON.stringify({ payload, pds: pdsResult.raw_response }),
          'IGW_SYSTEM',
        )
        .run();

      results.push({
        emp_id:      target.EMP_ID,
        attempt,
        result_code: pdsResult.result_code,
        log_id:      Number(meta.last_row_id),
      });

      // SUCCESS 시 즉시 종료
      if (pdsResult.success) break;

      // 재시도 전 1초 대기 (PDS 장비 부하 방지)
      if (attempt < maxAttempts) await new Promise(r => setTimeout(r, 1000));
    }

    return NextResponse.json({
      ok:          true,
      strategy_id,
      igw_txn_id,
      attempts:    results.length,
      final_result: results.at(-1)?.result_code,
      details:     results,
    });

  } catch (err) {
    console.error('[S-callert] Unhandled error:', err);
    return NextResponse.json({ error: 'Internal Server Error', detail: String(err) }, { status: 500 });
  }
}

// GET - 상태 확인용 헬스체크
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    service: 'S-callert IGW Event Receiver',
    version: '1.0.0',
    status:  'healthy',
    ts:      new Date().toISOString(),
  });
}
