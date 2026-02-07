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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
