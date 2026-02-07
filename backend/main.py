from fastapi import FastAPI, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import re
from datetime import datetime
import logging
import json
import os
from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 데이터베이스 설정
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://sguard_user:sguard_password@localhost:5433/sguard_db")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# DB 모델 정의
class SMSMessageDB(Base):
    __tablename__ = "received_messages"
    id = Column(Integer, primary_key=True, index=True)
    sender = Column(String(20), index=True)
    message = Column(Text)
    timestamp = Column(DateTime, default=datetime.utcnow)
    keyword_detected = Column(Boolean, default=False)
    response_message = Column(Text, nullable=True)
    read = Column(Boolean, default=False)

class SMSHistoryDB(Base):
    __tablename__ = "sms_history"
    id = Column(Integer, primary_key=True, index=True)
    recipient = Column(String(20))
    message = Column(Text)
    sent_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String(20))

class KeywordDB(Base):
    __tablename__ = "alert_keywords"
    keyword = Column(String(50), primary_key=True)
    response = Column(Text)

# 테이블 생성 및 연결 대기
import time
def init_db_with_retry():
    retries = 5
    while retries > 0:
        try:
            Base.metadata.create_all(bind=engine)
            logger.info("Database initialized successfully")
            break
        except Exception as e:
            logger.error(f"Database connection failed, retrying... ({retries} left): {e}")
            retries -= 1
            time.sleep(5)
    else:
        logger.error("Failed to connect to database after multiple attempts")

init_db_with_retry()

# DB 세션 의존성
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

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
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"메시지 전송 실패: {e}")

manager = ConnectionManager()

app = FastAPI(title="S-Guard AI SMS Service")

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic 모델
class SMSMessage(BaseModel):
    sender: str
    message: str
    received_at: Optional[str] = None

def check_keywords(db: Session, message: str) -> Optional[str]:
    keywords = db.query(KeywordDB).all()
    for kw in keywords:
        if kw.keyword in message:
            logger.info(f"키워드 감지: {kw.keyword}")
            return kw.response
    return None

async def send_sms(db: Session, recipient: str, message: str):
    logger.info(f"SMS 전송: {recipient} - {message}")
    sms_data = SMSHistoryDB(
        recipient=recipient,
        message=message,
        sent_at=datetime.utcnow(),
        status="sent"
    )
    db.add(sms_data)
    db.commit()
    return sms_data

@app.get("/")
async def root():
    return {"service": "S-Guard AI SMS Service", "status": "running", "version": "1.1.0 (DB Linked)"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.post("/sms/receive")
async def receive_sms(sms: SMSMessage, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    logger.info(f"SMS 수신: {sms.sender} - {sms.message}")
    response_message = check_keywords(db, sms.message)
    
    msg_db = SMSMessageDB(
        sender=sms.sender,
        message=sms.message,
        timestamp=datetime.utcnow(),
        keyword_detected=response_message is not None,
        response_message=response_message
    )
    db.add(msg_db)
    db.commit()
    db.refresh(msg_db)
    
    notification = {
        "type": "sms_received",
        "sender": sms.sender,
        "message": sms.message,
        "timestamp": msg_db.timestamp.isoformat(),
        "keyword_detected": msg_db.keyword_detected,
        "response_message": response_message
    }
    await manager.broadcast(notification)
    
    if response_message:
        # 백업 태스크에서도 새 세션을 사용하거나 세션 관리에 주의해야 합니다. 
        # 간단하게 구현하기 위해 동기 함수로 직접 호출하거나 별도 로직 권장
        await send_sms(db, sms.sender, response_message)
        
        return {
            "status": "keyword_detected",
            "sender": sms.sender,
            "response_sent": True,
            "response_message": response_message
        }
    
    return {"status": "received", "sender": sms.sender, "response_sent": False}

@app.get("/sms/recent")
async def get_recent_messages(limit: int = 10, db: Session = Depends(get_db)):
    messages = db.query(SMSMessageDB).order_by(SMSMessageDB.timestamp.desc()).limit(limit).all()
    return {"total": len(messages), "messages": messages}

@app.get("/sms/history")
async def get_sms_history(db: Session = Depends(get_db)):
    history = db.query(SMSHistoryDB).all()
    return {"total": len(history), "history": history}

@app.get("/sms/keywords")
async def get_keywords(db: Session = Depends(get_db)):
    keywords = db.query(KeywordDB).all()
    return {"keywords": keywords}

@app.post("/sms/keywords")
async def add_keyword(keyword: str, response: str, db: Session = Depends(get_db)):
    kw = KeywordDB(keyword=keyword, response=response)
    db.merge(kw) # 존재하면 업데이트, 없으면 추가
    db.commit()
    return {"status": "success", "keyword": keyword}

@app.on_event("startup")
def startup_populate_keywords():
    # 초기 키워드 데이터 시딩
    db = SessionLocal()
    default_keywords = {
        "장애": "장애 알림이 감지되었습니다. S-Guard AI 시스템에 자동 등록되었습니다.",
        "CRITICAL": "긴급 장애가 감지되었습니다. 즉시 War-Room을 통해 확인해주세요.",
        "오류": "시스템 오류가 감지되었습니다. AI 분석을 시작합니다.",
        "DOWN": "서비스 다운이 감지되었습니다. 긴급 대응팀에 알림을 전송했습니다.",
        "비정상": "비정상 상태가 감지되었습니다. 자동 분석 중입니다.",
    }
    for k, v in default_keywords.items():
        if not db.query(KeywordDB).filter_by(keyword=k).first():
            db.add(KeywordDB(keyword=k, response=v))
    db.commit()
    db.close()

# --- AI API Endpoints (Phase 2) ---

@app.get("/ai/insight")
async def get_ai_insight():
    """
    대시보드 상단 AI Insight 패널용 데이터
    실제 구현 시에는 로그 분석 결과나 실시간 지표를 요약해서 반환해야 함.
    """
    import random
    
    # 시연을 위한 Mock 데이터
    scenarios = [
        {
            "id": "LOG-001",
            "type": "info", 
            "category": "report",
            "severity": "info",
            "text": "실시간 트래픽 패턴 모니터링 중... (정상 범위)",
            "detail": "트래픽이 평소와 동일한 패턴을 보이고 있습니다. 특이사항 없음."
        },
        {
            "id": "LOG-002",
            "type": "info", 
            "category": "report",
            "severity": "info",
            "text": "API 응답 시간 분석: 평균 45ms 유지 중",
            "detail": "주요 API (Login, Payment) 응답 시간이 SLA 기준(100ms) 이내입니다."
        },
        {
            "id": "SEC-101",
            "type": "success", 
            "category": "security",
            "severity": "low",
            "text": "보안 스캔 완료: 취약점 발견되지 않음",
            "detail": "정기 보안 스캔 결과 Critical/High 레벨 취약점이 발견되지 않았습니다."
        },
        {
            "id": "SRV-303",
            "type": "warning", 
            "category": "server",
            "severity": "medium",
            "text": "트렌드 감지: 지난주 동시간대 대비 접속량 15% 증가",
            "detail": "이벤트 프로모션 영향으로 접속량이 증가하고 있습니다. 오토스케일링 모니터링 필요."
        },
        {
            "id": "PRED-404",
            "type": "insight", 
            "category": "report",
            "severity": "high",
            "text": "💡 [Insight] 현재 CPU 패턴이 매주 화요일 배치 작업과 유사합니다.",
            "detail": "과거 데이터 분석 결과, 화요일 14:00~16:00 사이 배치 작업으로 인한 CPU 상승 패턴과 98% 일치합니다."
        },
        {
            "id": "SEC-999",
            "type": "insight", 
            "category": "security",
            "severity": "critical",
            "text": "💡 [Insight] 비정상적인 IP 대역(192.168.x.x) 접근 시도가 감지되었습니다.",
            "detail": "허용되지 않은 VPN 대역에서의 관리자 페이지 접근 시도가 5회 이상 감지되었습니다. 즉시 차단 권고."
        },
        {
            "id": "CRT-500",
            "type": "error",
            "category": "critical",
            "severity": "critical",
            "text": "🚨 [Critical] 결제 모듈 응답 지연 (Prediction)",
            "detail": "DB Connection Pool 포화 상태가 예측됩니다. (현재 85% 사용 중, 10분 내 고갈 예상)"
        },
        {
            "id": "SRV-503",
            "type": "error",
            "category": "server",
            "severity": "high",
            "text": "⚠️ [Server] 이미지 서버 디스크 용량 부족 예측",
            "detail": "이미지 업로드 속도 저하 감지. 디스크 사용률 90% 도달 예상."
        }
    ]
    
    return {
        "status": "active",
        "learning_data_size": "12.5 TB",
        "accuracy": "98.2%",
        "current_log": random.choice(scenarios)
    }

@app.get("/ai/analysis/{incident_id}")
async def get_ai_analysis_detail(incident_id: str):
    """
    상세 페이지용 AI Root Cause Analysis 및 가이드
    RAG(Retrieval-Augmented Generation) 엔진 결과를 시뮬레이션
    """
    # 데모용: ID에 따라 다른 결과 반환 (홀/짝)
    # 실제로는 DB에서 해당 incident_id의 로그를 조회하고 LLM에 질의해야 함
    
    is_critical = "critical" in incident_id.lower() or "error" in incident_id.lower()
    
    if is_critical:
        return {
            "incident_id": incident_id,
            "similarity_score": 95,
            "similar_case": {
                "date": "3개월 전",
                "issue_id": "DB Lock Issue #402",
                "description": "대량 배치 작업으로 인한 세션 풀 고갈"
            },
            "root_cause": "Connection Pool Limit Exceeded (Max: 500)",
            "impact": "결제 API 응답 지연 (Avg 2.5s)",
            "recommendation": {
                "action": "KILL SESSION",
                "description": "Long Running Query 강제 종료",
                "type": "script"
            }
        }
    else:
        return {
            "incident_id": incident_id,
            "similarity_score": 88,
            "similar_case": {
                "date": "2주 전",
                "issue_id": "Memory Leak #105",
                "description": "이미지 처리 서비스 메모리 누수"
            },
            "root_cause": "Java Heap Space OutOfMemory",
            "impact": "이미지 업로드 실패",
            "recommendation": {
                "action": "RESTART SERVICE",
                "description": "이미지 처리 컨테이너 재기동",
                "type": "command"
            }
        }

class ChatRequest(BaseModel):
    query: str

@app.post("/ai/chat")
async def chat_with_ai(request: ChatRequest):
    """
    AI Agent Chatbot Endpoint
    Simulates log analysis based on user query keywords.
    """
    query = request.query.lower()
    
    # Mock Logic for Demo
    if "결제" in query or "payment" in query:
        return {
            "response": "네, 결제 서버 로그를 분석했습니다.\n현재 **에러율 0%**로 매우 안정적인 상태입니다.\n최근 1시간 동안 처리된 결제는 총 1,240건입니다.",
            "related_logs": [
                "[INFO] PaymentGateway: Transaction #8823 success (12ms)",
                "[INFO] PaymentGateway: Transaction #8824 success (11ms)"
            ]
        }
    
    elif "에러" in query or "error" in query or "장애" in query:
        return {
            "response": "⚠️ **최근 1시간 내 3건의 Critical Error**가 발견되었습니다.\n주로 'Connection Timeout' 관련 이슈이며, 현재 담당자에게 알림이 전송되었습니다.",
            "related_logs": [
                "[ERROR] ConnectionPool: Timeout waiting for idle object",
                "[ERROR] API: 503 Service Unavailable"
            ]
        }
        
    elif "안녕" in query or "hello" in query:
        return {
            "response": "안녕하세요! 저는 S-Guard AI 에이전트입니다.\n서버 상태나 로그에 대해 물어보시면 분석해 드립니다.\n예: '지금 결제 서버 괜찮아?'",
            "related_logs": []
        }
        
    else:
        return {
            "response": "죄송합니다. 현재 모니터링 중인 로그에서 해당 내용과 관련된 특이사항을 찾을 수 없습니다.\n다른 질문을 해 주시겠어요?",
            "related_logs": []
        }
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
