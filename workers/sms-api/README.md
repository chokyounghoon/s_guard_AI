# S-Guard AI SMS API - Cloudflare Workers

Cloudflare Workers 기반 SMS 수신 및 관리 API

## 기능
- SMS 메시지 수신 및 저장
- 키워드 자동 감지
- 최근 메시지 조회
- Cloudflare KV를 사용한 데이터 저장

## 배포 방법

### 1. KV Namespace 생성
```bash
cd workers/sms-api
npx wrangler kv:namespace create "SMS_STORAGE"
```

출력된 ID를 `wrangler.toml`의 `YOUR_KV_NAMESPACE_ID`에 입력하세요.

### 2. Workers 배포
```bash
npx wrangler deploy
```

### 3. 배포 URL 확인
배포 후 출력되는 URL을 프론트엔드 코드에 설정하세요.
예: `https://sguard-sms-api.YOUR_SUBDOMAIN.workers.dev`

## API 엔드포인트

### POST /sms/receive
SMS 메시지 수신

**요청:**
```json
{
  "sender": "010-1234-5678",
  "message": "CRITICAL: 서버 장애 발생",
  "received_at": "2026-01-25T20:00:00"
}
```

**응답:**
```json
{
  "status": "keyword_detected",
  "sender": "010-1234-5678",
  "detected_message": "CRITICAL: 서버 장애 발생",
  "response_sent": true,
  "response_message": "긴급 장애가 감지되었습니다..."
}
```

### GET /sms/recent?limit=10
최근 SMS 메시지 조회

**응답:**
```json
{
  "total": 5,
  "messages": [...]
}
```

### GET /sms/keywords
등록된 키워드 목록 조회

## 테스트

```bash
# SMS 전송 테스트
curl -X POST https://sguard-sms-api.YOUR_SUBDOMAIN.workers.dev/sms/receive \
  -H "Content-Type: application/json" \
  -d '{"sender":"010-1234-5678","message":"CRITICAL: 테스트"}'

# 최근 메시지 조회
curl https://sguard-sms-api.YOUR_SUBDOMAIN.workers.dev/sms/recent?limit=5
```

## 프론트엔드 연동

`frontend/src/pages/DashboardPage.jsx`에서 API URL 변경:

```javascript
const apiUrl = window.location.hostname === 'localhost' 
  ? 'http://localhost:8000/sms/recent?limit=3'
  : 'https://sguard-sms-api.YOUR_SUBDOMAIN.workers.dev/sms/recent?limit=3';
```
