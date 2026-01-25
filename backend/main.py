from fastapi import FastAPI, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import re
from datetime import datetime
import logging
import json

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# WebSocket 연결 관리자
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket 연결됨. 총 연결: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        logger.info(f"WebSocket 연결 해제. 총 연결: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        """모든 연결된 클라이언트에게 메시지 브로드캐스트"""
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"메시지 전송 실패: {e}")

manager = ConnectionManager()

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="S-Guard AI SMS Service")

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# SMS 수신 데이터 모델
class SMSMessage(BaseModel):
    sender: str
    message: str
    received_at: Optional[str] = None

# SMS 전송 데이터 모델
class SMSResponse(BaseModel):
    recipient: str
    message: str
    sent_at: str

# 키워드 및 응답 설정
ALERT_KEYWORDS = {
    "장애": "장애 알림이 감지되었습니다. S-Guard AI 시스템에 자동 등록되었습니다.",
    "CRITICAL": "긴급 장애가 감지되었습니다. 즉시 War-Room을 통해 확인해주세요.",
    "오류": "시스템 오류가 감지되었습니다. AI 분석을 시작합니다.",
    "DOWN": "서비스 다운이 감지되었습니다. 긴급 대응팀에 알림을 전송했습니다.",
    "비정상": "비정상 상태가 감지되었습니다. 자동 분석 중입니다.",
}

# SMS 전송 이력 (실제로는 DB에 저장)
sms_history: List[dict] = []

# 수신된 SMS 메시지 저장 (최근 10개)
received_messages: List[dict] = []

def check_keywords(message: str) -> Optional[str]:
    """메시지에서 키워드 감지"""
    for keyword, response in ALERT_KEYWORDS.items():
        if keyword in message:
            logger.info(f"키워드 감지: {keyword}")
            return response
    return None

async def send_sms(recipient: str, message: str):
    """SMS 전송 (실제 SMS API 연동 필요)"""
    # 실제 환경에서는 Twilio, AWS SNS, 또는 한국 SMS 서비스 API 사용
    logger.info(f"SMS 전송: {recipient} - {message}")
    
    sms_data = {
        "recipient": recipient,
        "message": message,
        "sent_at": datetime.now().isoformat(),
        "status": "sent"
    }
    sms_history.append(sms_data)
    return sms_data

@app.get("/")
async def root():
    return {
        "service": "S-Guard AI SMS Service",
        "status": "running",
        "version": "1.0.0"
    }

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket 연결 엔드포인트"""
    await manager.connect(websocket)
    try:
        while True:
            # 클라이언트로부터 메시지 대기 (연결 유지용)
            data = await websocket.receive_text()
            logger.info(f"클라이언트 메시지: {data}")
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.post("/sms/receive")
async def receive_sms(sms: SMSMessage, background_tasks: BackgroundTasks):
    """
    SMS 수신 웹훅 엔드포인트
    외부 SMS 서비스에서 이 엔드포인트로 수신된 SMS를 전송
    """
    logger.info(f"SMS 수신: {sms.sender} - {sms.message}")
    
    # 키워드 체크
    response_message = check_keywords(sms.message)
    
    # 수신 메시지 저장 (최근 10개만 유지)
    message_data = {
        "id": len(received_messages) + 1,
        "sender": sms.sender,
        "message": sms.message,
        "timestamp": datetime.now().isoformat(),
        "keyword_detected": response_message is not None,
        "response_message": response_message,
        "read": False
    }
    received_messages.insert(0, message_data)
    if len(received_messages) > 10:
        received_messages.pop()
    
    # WebSocket으로 실시간 알림 전송
    notification = {
        "type": "sms_received",
        "sender": sms.sender,
        "message": sms.message,
        "timestamp": datetime.now().isoformat(),
        "keyword_detected": response_message is not None,
        "response_message": response_message
    }
    await manager.broadcast(notification)
    
    if response_message:
        # 키워드가 감지되면 자동 응답 전송
        background_tasks.add_task(
            send_sms,
            recipient=sms.sender,
            message=response_message
        )
        
        return {
            "status": "keyword_detected",
            "sender": sms.sender,
            "detected_message": sms.message,
            "response_sent": True,
            "response_message": response_message
        }
    
    return {
        "status": "received",
        "sender": sms.sender,
        "message": sms.message,
        "response_sent": False
    }

@app.get("/sms/recent")
async def get_recent_messages(limit: int = 5):
    """최근 수신된 SMS 메시지 조회"""
    return {
        "total": len(received_messages),
        "messages": received_messages[:limit]
    }

@app.post("/sms/send")
async def manual_send_sms(recipient: str, message: str):
    """수동 SMS 전송"""
    result = await send_sms(recipient, message)
    return {
        "status": "success",
        "data": result
    }

@app.get("/sms/history")
async def get_sms_history():
    """SMS 전송 이력 조회"""
    return {
        "total": len(sms_history),
        "history": sms_history
    }

@app.get("/sms/keywords")
async def get_keywords():
    """등록된 키워드 목록 조회"""
    return {
        "keywords": [
            {"keyword": k, "response": v} 
            for k, v in ALERT_KEYWORDS.items()
        ]
    }

@app.post("/sms/keywords")
async def add_keyword(keyword: str, response: str):
    """새로운 키워드 추가"""
    ALERT_KEYWORDS[keyword] = response
    return {
        "status": "success",
        "keyword": keyword,
        "response": response
    }

@app.delete("/sms/keywords/{keyword}")
async def delete_keyword(keyword: str):
    """키워드 삭제"""
    if keyword in ALERT_KEYWORDS:
        del ALERT_KEYWORDS[keyword]
        return {"status": "success", "message": f"키워드 '{keyword}' 삭제됨"}
    raise HTTPException(status_code=404, detail="키워드를 찾을 수 없습니다")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
