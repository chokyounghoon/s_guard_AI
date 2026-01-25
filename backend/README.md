# S-Guard AI SMS Service

## 개요
사용자가 SMS를 수신하면 특정 키워드를 감지하여 자동으로 응답 메시지를 전송하는 백엔드 서비스입니다.

## 주요 기능

### 1. SMS 수신 및 키워드 감지
- 외부 SMS 서비스로부터 웹훅을 통해 SMS 수신
- 미리 정의된 키워드 자동 감지
- 키워드 감지 시 자동 응답 전송

### 2. 기본 키워드 목록
- **장애**: "장애 알림이 감지되었습니다. S-Guard AI 시스템에 자동 등록되었습니다."
- **CRITICAL**: "긴급 장애가 감지되었습니다. 즉시 War-Room을 통해 확인해주세요."
- **오류**: "시스템 오류가 감지되었습니다. AI 분석을 시작합니다."
- **DOWN**: "서비스 다운이 감지되었습니다. 긴급 대응팀에 알림을 전송했습니다."
- **비정상**: "비정상 상태가 감지되었습니다. 자동 분석 중입니다."

## 설치 및 실행

### 1. 의존성 설치
```bash
cd backend
pip install -r requirements.txt
```

### 2. 서버 실행
```bash
python main.py
```

또는

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## API 엔드포인트

### 1. SMS 수신 (POST /sms/receive)
외부 SMS 서비스에서 호출하는 웹훅 엔드포인트

**요청 예시:**
```json
{
  "sender": "010-1234-5678",
  "message": "CRITICAL: 서버 장애 발생",
  "received_at": "2026-01-25T19:00:00"
}
```

**응답 예시:**
```json
{
  "status": "keyword_detected",
  "sender": "010-1234-5678",
  "detected_message": "CRITICAL: 서버 장애 발생",
  "response_sent": true,
  "response_message": "긴급 장애가 감지되었습니다. 즉시 War-Room을 통해 확인해주세요."
}
```

### 2. 수동 SMS 전송 (POST /sms/send)
```bash
curl -X POST "http://localhost:8000/sms/send?recipient=010-1234-5678&message=테스트메시지"
```

### 3. SMS 전송 이력 조회 (GET /sms/history)
```bash
curl http://localhost:8000/sms/history
```

### 4. 키워드 목록 조회 (GET /sms/keywords)
```bash
curl http://localhost:8000/sms/keywords
```

### 5. 키워드 추가 (POST /sms/keywords)
```bash
curl -X POST "http://localhost:8000/sms/keywords?keyword=긴급&response=긴급상황입니다"
```

### 6. 키워드 삭제 (DELETE /sms/keywords/{keyword})
```bash
curl -X DELETE "http://localhost:8000/sms/keywords/긴급"
```

## 실제 SMS 서비스 연동

### 한국 SMS 서비스 연동 예시

#### 1. Twilio (국제)
```python
from twilio.rest import Client

client = Client(account_sid, auth_token)
message = client.messages.create(
    body="메시지 내용",
    from_="+1234567890",
    to="+821012345678"
)
```

#### 2. AWS SNS
```python
import boto3

sns = boto3.client('sns')
response = sns.publish(
    PhoneNumber='+821012345678',
    Message='메시지 내용'
)
```

#### 3. 한국 SMS 서비스 (예: 알리고, 문자나라 등)
```python
import requests

response = requests.post(
    'https://sms-api-url.com/send',
    json={
        'api_key': 'your_api_key',
        'receiver': '01012345678',
        'msg': '메시지 내용'
    }
)
```

## 환경 변수 설정

`.env` 파일 생성:
```env
SMS_API_KEY=your_sms_api_key
SMS_API_SECRET=your_sms_api_secret
SMS_SENDER_NUMBER=01012345678
```

## 테스트

### cURL을 사용한 테스트
```bash
# SMS 수신 테스트
curl -X POST http://localhost:8000/sms/receive \
  -H "Content-Type: application/json" \
  -d '{
    "sender": "010-1234-5678",
    "message": "장애 발생: DB 서버 다운"
  }'

# 키워드 목록 확인
curl http://localhost:8000/sms/keywords
```

## 프로덕션 배포

### Docker 사용
```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY main.py .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 실행
```bash
docker build -t sguard-sms-service .
docker run -p 8000:8000 sguard-sms-service
```

## 보안 고려사항
1. API 키 인증 추가
2. Rate Limiting 설정
3. HTTPS 사용
4. 웹훅 서명 검증
5. 민감한 정보 암호화

## 라이선스
MIT
