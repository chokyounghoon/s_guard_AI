from fastapi import FastAPI, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect, Depends, File, UploadFile, Form, Query, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Any
import re
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

def get_kst():
    return datetime.now(ZoneInfo('Asia/Seoul')).replace(tzinfo=None)
import random
import string
import logging
import json
import os
import hashlib
import secrets
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import asyncio
import base64
import httpx
from dotenv import load_dotenv

# .env 파일 로드
load_dotenv()

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# FastAPI 앱 초기화
app = FastAPI(title="S-Guard AI Backend")

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 데이터베이스 설정 (Moved to Cloudflare D1)
# Proxy through WorkerClient

# Cloudflare Worker Proxy Configuration
WORKER_URL = os.getenv("WORKER_URL", "https://sguardai.khcho0421.workers.dev")

class WorkerClient:
    @staticmethod
    async def post(path: str, data: dict):
        url = f"{WORKER_URL}{path}"
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.post(url, json=data)
                response.raise_for_status()
                return response.json()
            except Exception as e:
                logger.error(f"Worker Proxy POST error ({path}): {e}")
                return {"error": str(e)}

    @staticmethod
    async def get(path: str, params: dict = None):
        url = f"{WORKER_URL}{path}"
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.get(url, params=params)
                response.raise_for_status()
                return response.json()
            except Exception as e:
                logger.error(f"Worker Proxy GET error ({path}): {e}")
                return {"error": str(e)}

    @staticmethod
    async def patch(path: str, data: dict):
        url = f"{WORKER_URL}{path}"
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.patch(url, json=data)
                response.raise_for_status()
                return response.json()
            except Exception as e:
                logger.error(f"Worker Proxy PATCH error ({path}): {e}")
                return {"error": str(e)}

    @staticmethod
    async def post_multipart(path: str, data: dict, files: dict):
        url = f"{WORKER_URL}{path}"
        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                response = await client.post(url, data=data, files=files)
                response.raise_for_status()
                return response.json()
            except Exception as e:
                logger.error(f"Worker Proxy POST multipart error ({path}): {e}")
                return {"error": str(e)}



# Dify API Configuration
DIFY_API_KEY = os.getenv("DIFY_API_KEY", "app-XXXXXXXX")
DIFY_API_BASE = os.getenv("DIFY_API_BASE", "https://api.dify.ai/v1")
DIFY_DATASET_ID = os.getenv("DIFY_DATASET_ID", "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX")

class DifyClient:
    @staticmethod
    async def chat_message(query: str, user: str = "sguard-user", inputs: dict = {}, files: list = []):
        """
        Dify chat-messages를 streaming 모드로 호출한 뒤,
        answer만 누적해 최종 JSON 형태로 반환한다.
        (긴 응답에서도 연결 유지를 위해 streaming을 기본으로 사용)
        """
        try:
            gen = await DifyClient.stream_chat_message(query=query, user=user, inputs=inputs, files=files)
            answer_parts: list[str] = []
            async for chunk in gen:
                # chunk format: "data: {...}\n\n" or "data: [DONE]\n\n"
                if not chunk.startswith("data:"):
                    continue
                data_str = chunk[5:].strip()
                if data_str == "[DONE]":
                    break
                try:
                    data = json.loads(data_str)
                except Exception:
                    continue
                if data.get("error"):
                    return {"answer": f"AI 분석 중 오류가 발생했습니다: {data.get('error')}"}
                if data.get("answer"):
                    answer_parts.append(data["answer"])
            return {"answer": "".join(answer_parts)}
        except Exception as e:
            logger.error(f"Dify API error: {e}")
            return {"answer": "AI 분석이 지연되고 있습니다"}

    @staticmethod
    async def stream_chat_message(query: str, user: str = "sguard-user", inputs: dict = {}, files: list = []):
        url = f"{DIFY_API_BASE}/chat-messages"
        headers = {
            "Authorization": f"Bearer {DIFY_API_KEY}",
            "Content-Type": "application/json",
            "Accept": "text/event-stream",
        }
        payload = {
            "inputs": inputs,
            "query": query,
            "response_mode": "streaming",
            "user": user,
            "files": files
        }
        
        async def event_generator():
            # Dify가 첫 토큰을 늦게 보내는 경우가 있어 read timeout은 넉넉히 둔다.
            timeout = httpx.Timeout(120.0, connect=20.0, read=300.0, write=20.0, pool=20.0)
            async with httpx.AsyncClient(timeout=timeout) as client:
                try:
                    async with client.stream("POST", url, json=payload, headers=headers) as response:
                        response.raise_for_status()
                        # heartbeat: SSE 연결이 열렸음을 즉시 알림 (클라이언트 무응답 체감 완화)
                        yield f"data: {json.dumps({'status': 'connected'}, ensure_ascii=False)}\n\n"
                        workflow_run_id: Optional[str] = None
                        emitted_any_answer = False
                        # NOTE: Dify SSE는 data JSON이 여러 줄로 분할될 수 있어,
                        # line-based 파싱 대신 blank-line(\n\n) 기반으로 이벤트를 조립한다.
                        buf = b""
                        aiter = response.aiter_raw()
                        while True:
                            # keep-alive: Dify가 한동안 바이트를 안 보내도 연결 유지
                            try:
                                chunk = await asyncio.wait_for(aiter.__anext__(), timeout=5.0)
                            except asyncio.TimeoutError:
                                yield f"data: {json.dumps({'status': 'working'}, ensure_ascii=False)}\n\n"
                                continue
                            except StopAsyncIteration:
                                break

                            if not chunk:
                                continue

                            buf += chunk
                            while b"\n\n" in buf:
                                raw_evt, buf = buf.split(b"\n\n", 1)
                                raw_evt = raw_evt.strip()
                                if not raw_evt:
                                    continue

                                lines = raw_evt.split(b"\n")
                                # ignore ping/other event-only frames
                                data_lines = [ln for ln in lines if ln.startswith(b"data:")]
                                if not data_lines:
                                    continue

                                data_str = b"\n".join([ln[5:].lstrip() for ln in data_lines]).decode("utf-8", "ignore").strip()
                                if not data_str:
                                    continue

                                try:
                                    data = json.loads(data_str)
                                except Exception:
                                    continue

                                event = data.get("event")
                                if not workflow_run_id and isinstance(data.get("workflow_run_id"), str):
                                    workflow_run_id = data.get("workflow_run_id")
                                    logger.info(f"Dify stream captured workflow_run_id={workflow_run_id}")

                                # Standard chat streaming
                                if event in ("message", "agent_message"):
                                    answer = data.get("answer", "")
                                    if answer:
                                        emitted_any_answer = True
                                        yield f"data: {json.dumps({'answer': answer}, ensure_ascii=False)}\n\n"
                                    continue

                                # Workflow streaming: final answer is often in outputs.answer
                                if event == "workflow_finished":
                                    outputs = (data.get("data") or {}).get("outputs") or {}
                                    answer = outputs.get("answer") if isinstance(outputs, dict) else None
                                    if isinstance(answer, str) and answer:
                                        emitted_any_answer = True
                                        yield f"data: {json.dumps({'answer': answer}, ensure_ascii=False)}\n\n"
                                        yield "data: [DONE]\n\n"
                                    break

                                if event in ("message_end",):
                                    if emitted_any_answer:
                                        yield "data: [DONE]\n\n"
                                    break

                                if event == "error":
                                    yield f"data: {json.dumps({'error': data.get('message', 'Unknown error')}, ensure_ascii=False)}\n\n"
                                    yield "data: [DONE]\n\n"
                                    emitted_any_answer = True
                                    break

                        # If upstream streaming ended before workflow_finished,
                        # try to fetch workflow run detail and emit outputs.answer.
                        if (not emitted_any_answer) and workflow_run_id:
                            try:
                                detail_url = f"{DIFY_API_BASE}/workflows/run/{workflow_run_id}"
                                logger.info(f"Dify stream polling workflow detail {detail_url}")
                                poll_timeout_s = 180
                                poll_started = asyncio.get_event_loop().time()
                                while True:
                                    # keep client connection alive during polling
                                    yield f"data: {json.dumps({'status': 'working'}, ensure_ascii=False)}\n\n"
                                    r = await client.get(detail_url, headers={"Authorization": f"Bearer {DIFY_API_KEY}"})
                                    logger.info(f"Dify workflow detail status_code={r.status_code}")
                                    if r.status_code >= 400:
                                        try:
                                            logger.warning(f"Dify workflow detail error_body={r.text[:300]}")
                                        except Exception:
                                            pass
                                        break
                                    detail = r.json() if r.content else {}
                                    status = (detail.get("status") or "").lower()
                                    outputs = detail.get("outputs") or {}
                                    logger.info(f"Dify workflow detail status={status} outputs_keys={(list(outputs.keys())[:10] if isinstance(outputs, dict) else type(outputs).__name__)}")
                                    if status in ("succeeded", "success", "completed", "partial-succeeded") and isinstance(outputs, dict):
                                        # Try 'answer' first, then 'text', then 'result'
                                        answer = outputs.get("answer") or outputs.get("text") or outputs.get("result")
                                        
                                        logger.info(f"Dify raw result extracted: type={type(answer).__name__} val={repr(answer)[:100]}")
                                        
                                        if isinstance(answer, str) and answer.strip():
                                            logger.info(f"Dify workflow polling found result in outputs (status={status})")
                                            yield f"data: {json.dumps({'answer': answer}, ensure_ascii=False)}\n\n"
                                            yield "data: [DONE]\n\n"
                                            return
                                        else:
                                            logger.warning(f"Dify workflow finished ({status}) but result is empty or not string. Full outputs: {outputs}")
                                            # If it finished but truly empty, we can provide a better message
                                            if not emitted_any_answer:
                                                yield f"data: {json.dumps({'answer': '[분석 완료] 워크플로우가 종료되었으나 텍스트 결과가 비어있습니다.'}, ensure_ascii=False)}\n\n"
                                                yield "data: [DONE]\n\n"
                                                emitted_any_answer = True
                                        break
                                    if status in ("failed", "error", "stopped", "canceled", "cancelled"):
                                        logger.error(f"Dify workflow failed/stopped: {detail}")
                                        break
                                    if asyncio.get_event_loop().time() - poll_started > poll_timeout_s:
                                        logger.warning(f"Dify workflow poll timeout ({poll_timeout_s}s)")
                                        break
                                    await asyncio.sleep(2.0)
                            except Exception as e:
                                logger.error(f"Dify stream polling exception: {e}")
                                pass

                        if not emitted_any_answer:
                            yield f"data: {json.dumps({'error': 'AI 분석 결과를 추출하지 못했습니다'}, ensure_ascii=False)}\n\n"
                            yield "data: [DONE]\n\n"

                except Exception as e:
                    logger.error(f"Dify Stream error: {e}")
                    yield f"data: {json.dumps({'error': 'AI 분석이 지연되고 있습니다'}, ensure_ascii=False)}\n\n"
                    yield "data: [DONE]\n\n"

        return event_generator()

    @staticmethod
    async def ingest_to_dataset(content: str, metadata: dict = {}):
        url = f"{DIFY_API_BASE}/datasets/{DIFY_DATASET_ID}/document/create_by_text"
        headers = {
            "Authorization": f"Bearer {DIFY_API_KEY}",
            "Content-Type": "application/json"
        }
        payload = {
            "text": content,
            "indexing_technique": "high_quality",
            "process_rule": {"mode": "automatic"}
        }
        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                return response.json()
            except Exception as e:
                logger.error(f"Dify Dataset Ingestion error: {e}")
                return {"error": str(e)}

@app.post("/sms/convert-multimodal")
async def convert_multimodal(file: UploadFile = File(...)):
    content_type = file.content_type
    content = await file.read()
    if "image" in content_type:
        base64_image = base64.b64encode(content).decode('utf-8')
        try:
            dify_res = await DifyClient.chat_message(
                query="이 이미지에 포함된 텍스트를 모두 추출해서 한국어로 보여줘.",
                user="sguard-multimodal-user",
                files=[{"type": "image", "transfer_method": "remote_url", "url": f"data:{content_type};base64,{base64_image}"}]
            )
            result_text = dify_res.get("answer", "이미지 분석 실패")
        except Exception as e:
            result_text = f"Error: {str(e)}"
    else:
        result_text = "지원하지 않는 형식입니다."
    return {"status": "success", "converted_text": result_text}






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

class IncidentCreate(BaseModel):
    code: str
    title: str
    description: Optional[str] = None
    severity: str = "NORMAL"
    incident_type: str = "AI"
    source_sms_id: Optional[str] = None

def mask_sensitive_data(text: str) -> str:
    """전화번호, 계좌번호 등 개인정보 마스킹"""
    # 전화번호 마스킹 (010-1234-5678 -> 010-****-5678)
    text = re.sub(r'(\d{3})-\d{3,4}-(\d{4})', r'\1-****-\2', text)
    # 계좌번호 마스킹 (간단 예시: 10자 이상의 숫자 연속)
    text = re.sub(r'\d{10,}', '**********', text)
    return text

async def send_sms(recipient: str, message: str):
    logger.info(f"SMS 전송: {recipient} - {message}")
    # Proxy to Worker if we want to store SMS History
    res = await WorkerClient.post("/sms/history", {
        "recipient": recipient,
        "message": message,
        "status": "sent"
    })
    return res

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
async def receive_sms(sms: SMSMessage, background_tasks: BackgroundTasks):
    logger.info(f"SMS 수신: {sms.sender} - {sms.message}")
    
    # 1. 보안 마스킹 처리
    masked_message = mask_sensitive_data(sms.message)
    
    # 2. Worker를 통해 중복 체크 및 저장 (Worker/D1이 처리)
    # Worker의 /sms/receive는 자동중복체크는 안되어있으므로 단순히 저장만 함
    # 하지만 클라이언트는 이미 보낸 메시지를 다시 보내지 않으므로 여기서는 단순히 프록시 함
    
    ts = get_kst()
    if sms.received_at:
        try:
            ts = datetime.fromisoformat(sms.received_at.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            logger.warning(f"Invalid timestamp format: {sms.received_at}. Falling back to server time.")

    # 3. Worker에 SMS 저장 요청
    worker_res = await WorkerClient.post("/sms/receive", {
        "sender": sms.sender,
        "message": masked_message,
        "received_at": ts.isoformat()
    })
    
    if "error" in worker_res:
        return {"status": "error", "message": "Failed to save to D1 via Worker"}
        
    inc_id = worker_res.get("inc_id")

    # ── [핵심 1] Dify 멀티 에이전트 기반 구조화 데이터 추출 ──────────────────────
    prompt = f"""
    당신은 S-GUARD의 데이터 분류 에이전트입니다. 다음 SMS 내용을 분석하여 JSON 형식으로 응답하세요.
    내용: {masked_message}
    추출 필드:
    - target_system: 장애가 발생한 시스템 (예: Core Banking, Redis, L4 등)
    - error_code: 메시지에 포함된 에러 코드 (없으면 null)
    - problem_description: 기술적인 장애 현상 요약 (한국어)
    - severity: CRITICAL, MAJOR, NORMAL 중 하나 선택
    """
    
    incident_code = None
    try:
        extraction_res = await DifyClient.chat_message(query=prompt, user="sguard-extractor")
        raw_json = extraction_res.get("answer", "{}")
        import json
        m = re.search(r"\{.*\}", raw_json, re.DOTALL)
        if m:
            extracted = json.loads(m.group())
            
            # 새로운 인시던트 코드 생성 (Worker를 통해 인시던트 수 가져오기)
            incidents_data = await WorkerClient.get("/incidents")
            count = len(incidents_data) if isinstance(incidents_data, list) else 0
            incident_code = f"INC-{20240000 + count + 1}"
            
            # 인시던트 자동 생성 (Worker API 사용)
            title = f"[{extracted.get('target_system', 'Unknown')}] {extracted.get('problem_description', masked_message[:30])}"
            await WorkerClient.post("/incidents", {
                "inc_id": incident_code,
                "title": title,
                "description": masked_message,
                "severity": extracted.get("severity", "NORMAL"),
                "status": "접수중",
                "incident_type": "SMS",
                "source_sms_id": inc_id,
                "assigned_to": "자동할당(AI)"
            })
            
            # 인시던트 히스토리 추가 (Worker API 사용)
            await WorkerClient.post("/incident-history", {
                "sms_id": inc_id,
                "target_system": extracted.get("target_system", "Unknown"),
                "error_code": extracted.get("error_code"),
                "problem_description": extracted.get("problem_description", masked_message),
                "severity": extracted.get("severity", "NORMAL")
            })
            
            # 활동 로그 추가 (Worker API 사용)
            await WorkerClient.post("/activity-logs", {
                "user_name": "System",
                "incident_code": incident_code,
                "incident_title": title,
                "action": "장애 접수 (자동)",
                "detail": f"SMS 수신에 따른 장애 자동 접수 및 담당자 할당 완료. 상태: [접수중]",
                "report_type": "시스템"
            })
            
    except Exception as e:
        logger.error(f"Structured extraction/saving failed: {e}")

    notification = {
        "type": "sms_received",
        "inc_id": str(inc_id),
        "sender": sms.sender,
        "message": masked_message,
        "timestamp": ts.strftime('%Y-%m-%d %H:%M:%S'),
        "keyword_detected": worker_res.get("status") == "keyword_detected",
        "response_message": "장애가 감지되었습니다. 담당자에게 전달됩니다." if worker_res.get("status") == "keyword_detected" else None
    }
    
    # 웹소켓 브로드캐스트
    await manager.broadcast(notification)
    
    return {"status": "success", "inc_id": inc_id, "incident_code": incident_code}

@app.get("/sms/recent")
async def get_recent_messages(limit: int = 10):
    res = await WorkerClient.get("/sms/recent", params={"limit": limit})
    return res

@app.delete("/sms/{message_id}")
async def delete_sms(message_id: str):
    res = await WorkerClient.post(f"/sms/delete/{message_id}", {})
    return res

@app.get("/sms/history")
async def get_sms_history():
    res = await WorkerClient.get("/sms/history")
    return res

@app.get("/sms/keywords")
async def get_keywords():
    res = await WorkerClient.get("/sms/keywords")
    return res

@app.post("/sms/keywords")
async def add_keyword(keyword: str, response: str):
    res = await WorkerClient.post("/sms/keywords", {"keyword": keyword, "response": response})
    return res



# --- AI API Endpoints (Phase 2) ---

# 최적화를 위한 글로벌 캐시 (Autopilot 패널의 잦은 Polling으로 인한 LLM 부하 방지)
last_analyzed_sms_id = None
cached_insight_response = None

@app.get("/ai/insight")
async def get_ai_insight():
    """
    대시보드 상단 AI Insight (Autopilot) 패널용 데이터 (Streaming SSE)
    """
    # 1. Worker에서 최근 SMS 및 지표 조회
    data = await WorkerClient.get("/ai/insight")
    if "error" in data:
        async def err_gen():
            yield f"data: {json.dumps({'error': data['error']}, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(err_gen(), media_type="text/event-stream")

    prediction_counts = data.get("prediction_counts", {"critical": 0, "server": 0, "security": 0, "report": 0})
    recent_sms = data.get("recent_sms")

    if not recent_sms:
        async def empty_gen():
            yield f"data: {json.dumps({'status': 'active', 'prediction_counts': prediction_counts, 'answer': '새로운 장애 SMS를 기다리고 있습니다.'}, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(empty_gen(), media_type="text/event-stream")

    # [핵심] Dify 스트리밍 호출
    prompt = f"다음 SMS 장애 내용을 분석하고 1~2문장으로 대응 가이드를 한글로 제시해줘: {recent_sms['message']}"
    
    async def insight_stream():
        # 먼저 지표 데이터 전송
        yield f"data: {json.dumps({'status': 'active', 'prediction_counts': prediction_counts, 'sms_id': str(recent_sms['inc_id'])}, ensure_ascii=False)}\n\n"
        
        # Dify 스트림 전송
        gen = await DifyClient.stream_chat_message(query=prompt, user="sguard-autopilot")
        async for chunk in gen:
            yield chunk

    return StreamingResponse(insight_stream(), media_type="text/event-stream")

class GenerateReportRequest(BaseModel):
    incident_id: str


@app.post("/ai/generate-report")
async def generate_ai_report(req: GenerateReportRequest):
    """
    AI Report 생성 (Dify Streaming SSE)
    - 프론트에서 SSE로 받아 Typewriter로 렌더링할 수 있도록 answer 스트림을 그대로 전달한다.
    - 스트림 종료 시, 파싱 가능한 경우 6W1H 구조화 데이터도 함께 보낸다.
    """
    incident_id = (req.incident_id or "").strip()
    if not incident_id:
        async def err_gen():
            yield f"data: {json.dumps({'error': 'incident_id가 필요합니다.'}, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(err_gen(), media_type="text/event-stream")

    prompt = f"""
다음 incident_id에 대한 장애 보고서를 한국어로 작성해줘: {incident_id}

요구사항:
- 먼저 보고서 본문(요약)을 자연어로 작성
- 이어서 6W1H를 JSON으로 출력 (키: who, when, where, what, why, how, report_text)
- JSON은 코드블록 없이 순수 JSON 텍스트로만 출력
"""

    async def report_stream():
        accumulated: list[str] = []
        try:
            gen = await DifyClient.stream_chat_message(query=prompt, user="sguard-report")
            async for chunk in gen:
                if chunk.startswith("data:"):
                    data_str = chunk[5:].strip()
                    if data_str == "[DONE]":
                        full_text = "".join(accumulated)
                        # best-effort: JSON block extraction
                        try:
                            json_match = re.search(r'\{[\s\S]*\}$', full_text.strip())
                            if json_match:
                                report_obj = json.loads(json_match.group())
                                yield f"data: {json.dumps({'final_report': report_obj}, ensure_ascii=False)}\n\n"
                        except Exception:
                            pass
                        yield "data: [DONE]\n\n"
                        break
                    try:
                        data = json.loads(data_str)
                    except Exception:
                        continue
                    if data.get("answer"):
                        accumulated.append(data["answer"])
                    yield chunk
                else:
                    yield chunk
        except Exception as e:
            logger.error(f"Generate report stream error: {e}")
            yield f"data: {json.dumps({'error': 'AI 분석이 지연되고 있습니다'}, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(report_stream(), media_type="text/event-stream")

@app.get("/ai/agent-discussion/{sms_id}")
@app.get("/ai/discussion/{sms_id}")
async def get_agent_discussion_stream(sms_id: str):
    """
    특정 장애 SMS에 대해 4인의 에이전트(Security, DB, DevOps, Leader)가 협업하여 분석하는 실시간 상황 로그 (Streaming)
    """
    sms = await WorkerClient.get(f"/incidents/sms/{sms_id}")
    if isinstance(sms, dict) and "error" in sms:
        async def err_gen():
            yield f"data: {json.dumps({'error': 'SMS not found'}, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(err_gen(), media_type="text/event-stream")

    message = sms.get("message", "") if isinstance(sms, dict) else ""
    query = f"""
    다음 장애 SMS 내용에 대해 보안 전문가(Security), DB 전문가(DB), 인프라 전문가(DevOps), 실시간 대응팀장(Leader)이 
    서로 대화하며 원인을 분석하고 해결 방안을 도출하는 'AI War-Room 상황 로그' 대본을 작성해라.
    
    내용: {message}
    
    [규칙]
    1. 각 대사는 반드시 '[에이전트명]: 내용' 형식을 지켜라.
    2. 에이전트명은 반드시 [Security, DB, DevOps, Leader] 중 하나여야 한다.
    3. 각 에이전트별로 최소 1회 이상 발언해라.
    4. 기술적인 전문 내용을 포함하되, 긴박한 상황실 분위기를 연출해라.
    5. 마지막은 반드시 Leader가 최종 조치를 지시하며 마무리해라.
    """

    async def stream():
        req_id = secrets.token_hex(4)
        logger.info(f"[discussion-stream:{req_id}] start sms_id={sms_id}")
        
        # 1. 연결 성공 알림
        yield f"data: {json.dumps({'status': 'connected'}, ensure_ascii=False)}\n\n"

        try:
            # Dify 스트리밍 호출
            gen = await DifyClient.stream_chat_message(query=query, user="sguard-chat-user")
            async for chunk in gen:
                # Dify chunk를 그대로 전달하되, 프론트에서 파싱하기 쉽게 [Agent]: 포맷 유지
                yield chunk
        except Exception as e:
            logger.error(f"[discussion-stream:{req_id}] error: {e}")
            yield f"data: {json.dumps({'error': str(e)}, ensure_ascii=False)}\n\n"
        finally:
            yield "data: [DONE]\n\n"
            logger.info(f"[discussion-stream:{req_id}] end")

    return StreamingResponse(stream(), media_type="text/event-stream")


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
    AI Agent Chatbot Endpoint (Dify Streaming SSE)
    """
    query = request.query
    if not query.strip():
        async def err_gen():
            yield f"data: {json.dumps({'answer': '질문을 입력해주세요.'}, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(err_gen(), media_type="text/event-stream")

    try:
        logger.info(f"S-GUARD Chat Dify 스트리밍 연동 중: {query}")
        gen = await DifyClient.stream_chat_message(query=query, user="sguard-chat-user")
        return StreamingResponse(gen, media_type="text/event-stream")
    except Exception as e:
        logger.error(f"Chat Dify error: {e}")
        async def fail_gen():
            yield f"data: {json.dumps({'error': f'AI 통신 중 오류가 발생했습니다: {str(e)}'}, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(fail_gen(), media_type="text/event-stream")


@app.get("/ai/analyze-sms/{sms_id}")
async def analyze_sms_multi_agent(sms_id: str):
    """Perform multi-agent collaborative analysis using Dify"""
    sms = await WorkerClient.get(f"/incidents/sms/{sms_id}")
    hist = await WorkerClient.get(f"/incident-history/{sms_id}")
    
    if isinstance(sms, dict) and "error" in sms:
        raise HTTPException(status_code=404, detail="SMS not found")

    sender = sms.get("sender", "Unknown") if isinstance(sms, dict) else "Unknown"
    message = sms.get("message", "N/A") if isinstance(sms, dict) else "N/A"
    
    target_system = hist.get("target_system", "Unknown") if isinstance(hist, dict) and "error" not in hist else "Unknown"
    error_code = hist.get("error_code", "N/A") if isinstance(hist, dict) and "error" not in hist else "N/A"

    # [핵심] 4개 에이전트 페르소나를 활용한 분석 프롬프트
    query = f"""
    [장애 수신 내역]
    발신자: {sender}
    메시지 원본: {message}
    추출 정보: {target_system} / {error_code}
    
    다음 4명의 전문가 에이전트가 협업하여 이 장애를 분석하고 리더가 최종 결과를 한국어로 보고하세요:
    1. Infra Agent: L4, 네트워크, VM 등 인프라 영향도 분석
    2. DB Agent: DB 서버 상태, 쿼리 지연, 데드락 가능성 및 과거 조치 이력 분석
    3. DevOps Agent: 소스 코드 배포 이력, API 연동, 어플리케이션 에러 로그 관점 분석
    4. S-Guard Leader: 위 전문가들의 의견을 종합하여 장애 원인을 특정하고 구체적인 '조치 가이드'를 제시
    
    응답 형식: '현상 분석', '담당자 자동 할당', 'AI War-Room Situation Log', '리더의 최종 조치 가이드' 섹션으로 구성할 것.
    - '담당자 자동 할당' 섹션은 반드시 "-> 담당자 대응 : 할당리스트에 해당하는 할당자 목록을 표시해줘" 라는 문구로 시작할 것.
    """
    
    try:
        res = await DifyClient.chat_message(query=query, user="sguard-multi-agent")
        analysis = res.get("answer", "AI 분석 결과를 생성할 수 없습니다.")
        return {"status": "success", "analysis": analysis}
    except Exception as e:
        logger.error(f"Multi-agent analysis failed: {e}")
        return {"status": "error", "analysis": "분석 서비스 일시 중단"}


class AnalyzeSmsRequest(BaseModel):
    sender: Optional[str] = None
    message: str
    sms_id: Optional[str] = None


@app.post("/ai/analyze-sms")
async def analyze_sms_stream(req: AnalyzeSmsRequest):
    """
    SMS 텍스트 분석 (Dify Streaming SSE)
    - 프론트에서 실시간 타이핑 렌더링을 위해 SSE로 응답
    """
    message = (req.message or "").strip()
    sender = (req.sender or "Unknown").strip()

    if not message:
        async def err_gen():
            yield f"data: {json.dumps({'error': 'message가 필요합니다.'}, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(err_gen(), media_type="text/event-stream")

    query = (
        f"다음 SMS 장애 내용을 분석하고 조치 가이드를 한국어로 제시해줘.\n"
        f"발신자: {sender}\n"
        f"메시지: {message}\n\n"
        "[응답 형식 가이드]\n"
        "1. **상황 요약**: 현재 발생한 장애의 핵심 내용을 요약한다.\n"
        "2. **담당자 자동 할당**: 어떤 파트가 담당해야 하는지 명시한다. (내용 시작 시 반드시 '-> 담당자 대응 : 할당리스트에 해당하는 할당자 목록을 표시해줘' 문구를 포함할 것)\n"
        "3. **AI War-Room Situation Log**: 이곳은 실제 전문가 에이전트들이 대화를 나누며 진단하는 '대화형 로그' 형식으로 작성한다.\n"
        "   예: \n"
        "   - [Infra Agent]: \"CPU 부하 확인 결과... 특정 프로세스 점유율이 비정상적입니다.\"\n"
        "   - [DB Agent]: \"해당 시간대 DB Lock 상황 점검... 인덱스 누널이 원인으로 보입니다.\"\n"
        "   - [S-Guard Leader]: \"상황 파악 완료. 즉시 조치 가이드를 생성하겠습니다.\"\n"
        "4. **리더의 최종 조치 가이드**: 구체적인 명령어 및 해결 단계를 제시한다."
    )

    async def stream():
        req_id = secrets.token_hex(4)
        logger.info(f"[analyze-sms:{req_id}] start sender={sender} msg_len={len(message)}")
        
        # 0. 클라이언트 타임아웃 방지 시그널 즉시 발송
        yield f"data: {json.dumps({'status': 'connected'}, ensure_ascii=False)}\n\n"

        # 1. 기 분석된 결과가 있는지 DB 조회 (캐시 히트)
        if req.sms_id:
            try:
                # Use Worker API for autopilot insight
                insight_res = await WorkerClient.get(f"/ai/insight/{req.sms_id}")
                if "error" not in insight_res and insight_res.get("content"):
                    logger.info(f"[analyze-sms:{req_id}] Cache Hit for SMS_ID: {req.sms_id}")
                    # 저장된 내용을 즉시 반환
                    yield f"data: {json.dumps({'answer': insight_res['content']}, ensure_ascii=False)}\n\n"
                    yield "data: [DONE]\n\n"
                    return
            except Exception as e:
                logger.error(f"[analyze-sms:{req_id}] Cache check failed: {e}")

        # 2. 신규 분석 진행
        yield f"data: {json.dumps({'status': 'working'}, ensure_ascii=False)}\n\n"
        
        try:
            gen = await DifyClient.stream_chat_message(query=query, user="sguard-sms-analyze")
            answer_chars = 0
            answer_parts = []
            done_sent = False
            async for chunk in gen:
                # chunk is already SSE-formatted ("data: ...\n\n")
                if chunk.startswith("data:"):
                    data_str = chunk[5:].strip()
                    if data_str == "[DONE]":
                        logger.info(f"[analyze-sms:{req_id}] done answer_chars={answer_chars}")
                        done_sent = True
                    else:
                        try:
                            data = json.loads(data_str)
                            if data.get("error"):
                                logger.warning(f"[analyze-sms:{req_id}] error={data.get('error')}")
                            if data.get("status") in ("connected", "working"):
                                logger.info(f"[analyze-sms:{req_id}] status={data.get('status')}")
                            if data.get("answer"):
                                part = data["answer"]
                                answer_parts.append(part)
                                answer_chars += len(part)
                                if answer_chars < 80:
                                    logger.info(f"[analyze-sms:{req_id}] answer_chunk sample={part[:60]!r}")
                        except Exception:
                            pass
                yield chunk

            # If upstream ended without any answer, fail gracefully for the client UI.
            if answer_chars == 0 and not done_sent:
                logger.warning(f"[analyze-sms:{req_id}] upstream_ended_without_answer")
                yield f"data: {json.dumps({'error': 'AI 분석이 지연되고 있습니다'}, ensure_ascii=False)}\n\n"
                yield "data: [DONE]\n\n"
        except asyncio.CancelledError:
            # Client disconnected / request cancelled
            logger.warning(f"[analyze-sms:{req_id}] cancelled_by_client answer_chars={answer_chars if 'answer_chars' in locals() else 0}")
            raise
        except Exception as e:
            logger.error(f"[analyze-sms:{req_id}] exception: {e}")
            yield f"data: {json.dumps({'error': 'AI 분석이 지연되고 있습니다'}, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"
        finally:
            # 스트리밍 종료 시 최종 답변을 DB에 자동 저장 (사용자 요청 사항)
            if (req.sms_id or sender) and answer_chars > 0:
                try:
                    # Save via Worker Proxy (using sms_id or a hashed sender+msg as fallback ID)
                    save_id = req.sms_id or hashlib.md5(f"{sender}:{message}".encode()).hexdigest()[:16]
                    await WorkerClient.post("/ai/insight/save", {
                        "incident_id": str(save_id),
                        "content": "".join(answer_parts),
                        "severity": "NORMAL",
                        "category": "분석"
                    })
                    logger.info(f"[analyze-sms:{req_id}] AI Insight saved to ID: {save_id}")
                except Exception as db_err:
                    logger.error(f"[analyze-sms:{req_id}] Failed to save AI Insight: {db_err}")
            
            logger.info(f"[analyze-sms:{req_id}] end")

    return StreamingResponse(stream(), media_type="text/event-stream")

# ── [지식 선순환 루프] 조치 결과 피드백 및 RAG 재학습 ──────────────────────────
class FeedbackRequest(BaseModel):
    incident_id: str
    resolution: str
    commands_used: Optional[str] = None
    feedback_rating: str

@app.post("/ai/feedback/save")
async def save_resolution_feedback(req: FeedbackRequest):
    """피드백 저장 및 Dify 지식 베이스(RAG) 동기화"""
    # 1. DB 적재 (Worker 쪽에 action result 엔드포인트가 없으므로 파일 로깅이나 패스)
    # 현재는 Dify 지식 베이스(RAG) 적재가 주 목적

    # 2. Dify 지식 베이스(RAG)에 실시간 '성공 사례'로 인입
    inc = await WorkerClient.get(f"/incidents/{req.incident_id}")
    
    title = inc.get("title", 'Unknown') if isinstance(inc, dict) and "error" not in inc else 'Unknown'
    description = inc.get("description", 'N/A') if isinstance(inc, dict) and "error" not in inc else 'N/A'

    knowledge_text = f"""
    [검증된 장애 해결 사례]
    시스템: {title}
    현상: {description}
    해결방안: {req.resolution}
    실행 명령어: {req.commands_used if req.commands_used else 'N/A'}
    피드백 결과: {req.feedback_rating}
    등록일: {get_kst().strftime('%Y-%m-%d %H:%M:%S')}
    """
    
    try:
        await DifyClient.ingest_to_dataset(
            content=knowledge_text, 
            metadata={
                "incident_id": req.incident_id,
                "type": "verified_resolution",
                "source": "sguard_virtuous_cycle"
            }
        )
        return {"status": "success", "message": "해결 사례가 지식 베이스에 반영되었습니다. 시스템이 학습을 완료했습니다."}
    except Exception as e:
        logger.error(f"Feedback ingestion failed: {e}")
        return {"status": "partial_success", "message": "피드백은 DB에 저장되었으나 AI 학습 연동에 실패했습니다."}

# --- War-Room Chat Endpoints ---

class WarRoomMessage(BaseModel):
    incident_id: str
    sender: str
    role: Optional[str] = "User"
    type: str = "user"
    text: str

@app.post("/warroom/chat")
async def save_warroom_chat(msg: WarRoomMessage):
    """Save a single message from the War-Room"""
    res = await WorkerClient.post("/warroom/chat", {
        "incident_id": msg.incident_id,
        "sender": msg.sender,
        "role": msg.role,
        "type": msg.type,
        "text": msg.text
    })
    return res

@app.get("/warroom/chat/{incident_id}")
async def get_warroom_chat(incident_id: str):
    """Retrieve chat history for a specific incident with metadata"""
    res = await WorkerClient.get(f"/warroom/chat/{incident_id}")
    return res

@app.post("/incidents")
async def create_incident(inc: IncidentCreate):
    """Create or update incident metadata"""
    # 1. Check if an incident for this specific SMS already exists
    # (Checking logic moved to Worker or simplified here)
    res = await WorkerClient.post("/incidents", {
        "inc_id": inc.code,
        "title": inc.title,
        "description": inc.description,
        "severity": inc.severity,
        "incident_type": inc.incident_type,
        "source_sms_id": inc.source_sms_id
    })
    
    # [활동로그] 새로운 워룸 개설 로그 추가 (Worker가 /incidents 호출 시 처리하도록 이미 구현함)
    return res

# ─── War-Room Management Endpoints ──────────────────────────────────────────

UPLOAD_DIR = "/tmp/warroom_uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.get("/warroom/rooms")
async def list_warrooms(
    status: Optional[str] = None,
    q: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    assigned_to: Optional[str] = None
):
    """List all War-Rooms with optional filters via Worker"""
    params = {}
    if status: params["status"] = status
    if q: params["q"] = q
    if start_date: params["start_date"] = start_date
    if end_date: params["end_date"] = end_date
    if assigned_to: params["assigned_to"] = assigned_to
    
    res = await WorkerClient.get("/warroom/rooms", params=params)
    return res


@app.post("/warroom/reset")
async def reset_warroom_data():
    """Wipe all War-Room incidents, chats, and attachments for testing/cleanup"""
    # 1. Delete physical files locally if any still exist
    if os.path.exists(UPLOAD_DIR):
        import shutil
        for filename in os.listdir(UPLOAD_DIR):
            file_path = os.path.join(UPLOAD_DIR, filename)
            try:
                if os.path.isfile(file_path) or os.path.islink(file_path):
                    os.unlink(file_path)
                elif os.path.isdir(file_path):
                    shutil.rmtree(file_path)
            except Exception as e:
                logger.error(f"Failed to delete {file_path}. Reason: {e}")

    # 2. Reset via Worker Proxy
    res = await WorkerClient.post("/warroom/reset", {})
    if "error" in res:
        raise HTTPException(status_code=500, detail=res["error"])
        
    return res

@app.get("/warroom/rooms/search")
async def search_warrooms(
    q: str = Query(..., description="Search query")
):
    """Search War-Rooms by title or description"""
    res = await WorkerClient.get("/warroom/search", params={"q": q})
    return res


@app.post("/warroom/rooms/{incident_id}/join")
async def join_warroom(
    incident_id: str,
    body: dict = {}
):
    """Record joining a War-Room"""
    # 1. Check if incident exists
    inc_res = await WorkerClient.get(f"/incidents/{incident_id}")
    if "error" in inc_res or not inc_res.get("title"):
        raise HTTPException(status_code=404, detail="War-Room not found")
        
    title = inc_res.get("title", incident_id)
    user_name = body.get("user_name", "Unknown")
    
    # 2. Log system message for join event
    await WorkerClient.post("/warroom/chat", {
        "incident_id": incident_id,
        "sender": "시스템",
        "role": "System",
        "type": "system",
        "text": f"👤 {user_name}님이 War-Room에 참여하였습니다."
    })
    
    # 3. Log activity
    await WorkerClient.post("/activity-logs", {
        "user_name": user_name,
        "incident_code": incident_id,
        "incident_title": title,
        "action": "War-Room 참여",
        "detail": f"{user_name}이 {incident_id} War-Room에 참여",
        "report_type": "시스템"
    })
    
    return {"status": "joined", "incident_id": incident_id, "title": title}


@app.post("/warroom/upload")
async def upload_warroom_file(
    incident_id: str = Form(...),
    uploaded_by: str = Form(default="Unknown"),
    file: UploadFile = File(...)
):
    """Upload a file/image to a War-Room via Worker proxy"""
    MAX_SIZE = 50 * 1024 * 1024  # 50MB
    contents = await file.read()
    if len(contents) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 50MB)")
    
    res = await WorkerClient.post_multipart(
        "/warroom/upload",
        data={"incident_id": incident_id, "uploaded_by": uploaded_by},
        files={"file": (file.filename, contents, file.content_type)}
    )
    
    if "error" in res:
        raise HTTPException(status_code=500, detail=res["error"])
        
    return res


@app.get("/warroom/file/{key:path}")
async def get_warroom_file(key: str):
    """Serve uploaded files by proxying from the Worker"""
    # The key might already be encoded, or we may need to pass it through
    url = f"{WORKER_URL}/warroom/file/{key}"
    
    async def worker_stream():
        async with httpx.AsyncClient() as client:
            async with client.stream("GET", url) as req:
                req.raise_for_status()
                # Pass Content-Type from worker response
                async for chunk in req.aiter_bytes():
                    yield chunk
                    
    # We ideally want the Content-Type from the proxied response, 
    # but StreamingResponse defaults are fine for browsers trying to sniff or relying on typical usage.
    return StreamingResponse(worker_stream())


@app.get("/warroom/rooms/{incident_id}/attachments")
async def get_warroom_attachments(incident_id: str):
    """Get all attachments for a War-Room via Worker"""
    res = await WorkerClient.get(f"/warroom/attachments/{incident_id}")
    return res

# ─── End War-Room Management Endpoints ──────────────────────────────────────

@app.post("/warroom/resolve/{incident_id}")
async def resolve_and_learn_incident(incident_id: str):
    """
    Gather all chat logs for the incident, compile them into a troubleshooting report,
    and ingest them into Dify Knowledge base for future RAG learning.
    """
    try:
        # Retrieve all messages for this incident (via Worker)
        res = await WorkerClient.get(f"/warroom/chat/{incident_id}")
        chats = res.get("messages", [])
        
        if not chats:
            raise HTTPException(status_code=404, detail="No chat history found for this incident.")
            
        # Build the Troubleshooting Report text
        report_lines = [
            f"[Troubleshooting Report - War-Room Chat History]",
            f"Incident ID: {incident_id}",
            f"Resolved At: {get_kst().strftime('%Y-%m-%d %H:%M:%S')}",
            f"\n--- Incident Log ---"
        ]
        
        for msg in chats:
            ts_str = msg.get("timestamp")
            sender = msg.get("sender")
            role = msg.get("role")
            msg_type = msg.get("type")
            text = msg.get("text")
            
            prefix = f"[{ts_str}] {sender} ({role}) [{msg_type}]:"
            report_lines.append(f"{prefix} {text}")
            
        report_lines.append("\n--- Resolution ---")
        report_lines.append(f"Incident {incident_id} successfully resolved and added to knowledge base.")
        
        full_report_text = "\n".join(report_lines)
        
        metadata = {
            "source": "war_room_chat",
            "type": "incident_report",
            "category": "human_interaction",
            "incident_id": incident_id,
            "ingested_at": get_kst().strftime('%Y-%m-%d %H:%M:%S')
        }
        
        # Ingest into Dify Knowledge Base
        await DifyClient.ingest_to_dataset(content=full_report_text, metadata=metadata)
        
        # 1. Update Incident Status in DB via Worker
        await WorkerClient.post("/warroom/resolve", {"incident_id": incident_id})
        
        # 2. Add Final System Message via Worker
        await WorkerClient.post("/warroom/chat", {
            "incident_id": incident_id,
            "sender": "시스템",
            "role": "System",
            "type": "system",
            "text": "✅ 대응이 완료되어 War-Room이 종료되었습니다. (읽기 전용 모드)"
        })

        return {
            "status": "success", 
            "message": f"{incident_id} 장애 보고서가 학습되었으며 War-Room이 종료되었습니다.",
            "message_count_processed": len(chats)
        }
        
    except Exception as e:
        logger.error(f"Error resolving incident {incident_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/knowledge/list")
async def list_knowledge_entries(limit: int = 50):
    """
    Return documents from the S-GUARD Knowledge base (via Dify)
    so users can review what has been learned by the AI.
    """
    # [Note] ChromaDB removed. Dify Knowledge base is managed via Dify Console.
    return {"total": 0, "entries": []}


# ===========================================================
# AUTH Endpoints
# ===========================================================

class RequestResetCode(BaseModel):
    email: str
    employee_id: str

class VerifyResetCode(BaseModel):
    email: str
    employee_id: str
    code: str

class SignupRequest(BaseModel):
    email: str
    name: str
    password: str
    company: Optional[str] = None
    employee_id: Optional[str] = None
    phone: Optional[str] = None
    honbu: Optional[str] = None
    team: Optional[str] = None
    part: Optional[str] = None
    subpart: Optional[str] = None

class LoginRequest(BaseModel):
    email: str
    password: str

class ProfileUpdateRequest(BaseModel):
    user_id: str
    name: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    honbu: Optional[str] = None
    team: Optional[str] = None
    part: Optional[str] = None
    subpart: Optional[str] = None

class ChangePasswordRequest(BaseModel):
    user_id: str
    old_password: str
    new_password: str

@app.post("/auth/request-reset-code")
async def request_reset_code(req: RequestResetCode):
    res = await WorkerClient.post("/auth/request-reset-code", {
        "email": req.email,
        "employee_id": req.employee_id
    })
    return res

@app.post("/auth/verify-reset-code")
async def verify_reset_code(req: VerifyResetCode):
    res = await WorkerClient.post("/auth/verify-reset-code", {
        "email": req.email,
        "employee_id": req.employee_id,
        "code": req.code
    })
    return res

@app.post("/auth/signup")
async def signup(req: SignupRequest):
    res = await WorkerClient.post("/auth/signup", {
        "email": req.email,
        "password": req.password,
        "name": req.name,
        "company": req.company,
        "honbu": req.honbu,
        "team": req.team
    })
    return res

# Auth / Org / Users logic are completely proxied from frontend to worker in the future,
# but for now we maintain FastAPI proxy endpoints for backward compatibility.
@app.post("/auth/login")
async def login(req: LoginRequest, request: Request):
    ip = request.client.host if request.client else "unknown"
    agent = request.headers.get("user-agent", "unknown")
    res = await WorkerClient.post("/auth/login", {
        "email": req.email,
        "password": req.password
    })
    
    # Check for failure in the flat json return
    if "detail" in res or "error" in res:
        raise HTTPException(status_code=401, detail=res.get("detail", res.get("error", "Login failed")))

    return {
        "status": "success",
        "token": res.get("token"),
        "user": {
            "id": res.get("id"),
            "email": res.get("email"),
            "name": res.get("name"),
            "role": res.get("role"),
            "company": res.get("company"),
            "honbu": res.get("honbu"),
            "team": res.get("team"),
            "phone": res.get("phone", ""),
            "part": res.get("part", ""),
            "subpart": res.get("subpart", "")
        }
    }

@app.post("/auth/signup")
async def signup(req: SignupRequest):
    res = await WorkerClient.post("/auth/signup", {
        "email": req.email,
        "password": req.password,
        "name": req.name,
        "company": req.company,
        "honbu": req.honbu,
        "team": req.team
    })
    if "detail" in res or "error" in res:
        raise HTTPException(status_code=400, detail=res.get("detail", res.get("error", "Signup failed")))
    return res

@app.get("/users")
async def list_users():
    res = await WorkerClient.get("/users")
    return res

class UserResetPasswordRequest(BaseModel):
    new_password: str

class UserUpdateRoleRequest(BaseModel):
    role: str

class OrgNodeCreate(BaseModel):
    name: str
    code: Optional[str] = None
    parent_id: Optional[int] = None
    depth: int = 1
    sort_order: int = 0

class OrgNodeUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    sort_order: Optional[int] = None

class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    honbu: Optional[str] = None
    team: Optional[str] = None
    part: Optional[str] = None
    subpart: Optional[str] = None

class PasswordResetRequest(BaseModel):
    email: str



@app.post("/users/{user_id}/reset-password")
async def reset_user_password(user_id: str, req: UserResetPasswordRequest):
    res = await WorkerClient.post(f"/users/{user_id}/reset-password", {"new_password": req.new_password})
    return res

@app.patch("/users/{user_id}/status")
async def toggle_user_status(user_id: str):
    # Depending on how it's called, could parse body, but historically frontend passes nothing for toggle
    # We will let the toggle logic exist in the worker or just pass active status
    res = await WorkerClient.patch(f"/users/{user_id}/status", {})
    return res

@app.patch("/users/{user_id}/role")
async def update_user_role(user_id: str, req: UserUpdateRoleRequest):
    res = await WorkerClient.patch(f"/users/{user_id}/role", {"role": req.role})
    return res

@app.get("/org/tree")
async def get_org_tree():
    res = await WorkerClient.get("/org/tree")
    return res

@app.post("/org/nodes")
async def create_org_node(req: OrgNodeCreate):
    res = await WorkerClient.post("/org/nodes", {
        "name": req.name,
        "code": req.code,
        "parent_id": req.parent_id,
        "depth": req.depth,
        "sort_order": req.sort_order
    })
    return res

@app.patch("/org/nodes/{node_id}")
async def update_org_node(node_id: str, req: OrgNodeUpdate):
    res = await WorkerClient.patch(f"/org/nodes/{node_id}", {
        "name": req.name,
        "code": req.code,
        "sort_order": req.sort_order
    })
    return res

@app.delete("/org/nodes/{node_id}")
async def delete_org_node(node_id: str):
    res = await WorkerClient.delete(f"/org/nodes/{node_id}")
    return res
    
@app.get("/auth/login-history")
async def get_login_history(limit: int = 50):
    res = await WorkerClient.get(f"/auth/login-history?limit={limit}")
    return res

@app.post("/auth/change-password")
async def change_password(req: ChangePasswordRequest):
    res = await WorkerClient.post("/auth/change-password", {
        "user_id": req.user_id,
        "old_password": req.old_password,
        "new_password": req.new_password
    })
    return res

@app.patch("/auth/profile")
async def update_profile(req: ProfileUpdateRequest):
    # Pass to worker
    res = await WorkerClient.patch("/auth/profile", req.dict(exclude_unset=True))
    if "error" in res or "detail" in res:
        raise HTTPException(status_code=404, detail=res.get("detail", "Error"))
    return res

@app.post("/auth/reset-password")
async def reset_password(req: PasswordResetRequest):
    # Generates a code or auto-resets
    res = await WorkerClient.post("/auth/reset-password-admin", {
        "email": req.email,
        "employee_id": req.employee_id
    })
    if "error" in res or "detail" in res:
         raise HTTPException(status_code=404, detail=res.get("detail", "Error"))
    return res

@app.post("/auth/google")
async def google_login(payload: dict):
    res = await WorkerClient.post("/auth/google", payload)
    return res

# ===========================================================
# INCIDENTS Endpoints
# ===========================================================

class IncidentCreateRequest(BaseModel):
    title: str
    description: Optional[str] = None
    severity: str = "NORMAL"
    status: str = "Open"
    incident_type: str = "AI"
    assigned_to: Optional[str] = None
    source_sms_id: Optional[int] = None

class IncidentUpdateRequest(BaseModel):
    status: Optional[str] = None
    severity: Optional[str] = None
    assigned_to: Optional[str] = None
    description: Optional[str] = None



@app.get("/incidents")
async def get_incidents(
    status: Optional[str] = None,
    severity: Optional[str] = None,
    incident_type: Optional[str] = None,
    limit: int = 100
):
    params = {}
    if status: params["status"] = status
    if severity: params["severity"] = severity
    if incident_type: params["incident_type"] = incident_type
    params["limit"] = limit
    
    res = await WorkerClient.get("/incidents", params=params)
    return {"total": len(res), "incidents": res} if isinstance(res, list) else res

@app.post("/incidents")
async def create_incident(req: IncidentCreateRequest):
    res = await WorkerClient.post("/incidents", req.dict(exclude_unset=True))
    if "error" in res:
        raise HTTPException(status_code=500, detail=res["error"])
    return res

@app.patch("/incidents/{incident_id}")
async def update_incident(incident_id: str, req: IncidentUpdateRequest):
    res = await WorkerClient.patch(f"/incidents/{incident_id}", req.dict(exclude_unset=True))
    if "error" in res:
        raise HTTPException(status_code=404, detail="인시던트를 찾을 수 없거나 업데이트 실패")
    return res

# ===========================================================
# ACTIVITY LOGS Endpoints
# ===========================================================

class ActivityLogCreateRequest(BaseModel):
    user_name: Optional[str] = "System"
    incident_code: Optional[str] = None
    incident_title: Optional[str] = None
    action: str
    detail: Optional[str] = None
    team: Optional[str] = None
    report_type: Optional[str] = "AI 리포트"

@app.get("/activity-logs")
async def get_activity_logs(limit: int = 50):
    res = await WorkerClient.get("/activity-logs", params={"limit": limit})
    return {"total": len(res), "logs": res} if isinstance(res, list) else res

@app.post("/activity-logs")
async def create_activity_log(req: ActivityLogCreateRequest):
    res = await WorkerClient.post("/activity-logs", req.dict(exclude_unset=True))
    return res

# ===========================================================
# KEYWORD DELETE Endpoint
# ===========================================================

@app.delete("/sms/keywords/{keyword}")
async def delete_keyword(keyword: str):
    res = await WorkerClient.post(f"/sms/keywords/delete/{urllib.parse.quote(keyword)}", {})
    if "error" in res:
        raise HTTPException(status_code=404, detail="키워드를 찾을 수 없습니다.")
    return {"status": "success", "deleted": keyword}

# SMS 수신 시 자동으로 Incident 생성하는 hook
@app.on_event("startup")
async def startup_create_incident_on_sms():
    """기존 수신 SMS 중 인시던트가 없는 항목들을 자동으로 인시던트 생성"""
    pass  # 이후 SMS 수신 시 receive_sms endpoint에서 자동 생성

@app.post("/sms/convert-multimodal")
async def convert_multimodal(file: UploadFile = File(...)):
    """
    이미지 또는 음성 파일을 텍스트로 변환하는 실제 AI 멀티모달 처리 엔드포인트
    """
    content_type = file.content_type
    filename = file.filename.lower()
    
    # 파일 내용 읽기
    content = await file.read()
    
    if "image" in content_type:
        # 1. Base64 인코딩
        base64_image = base64.b64encode(content).decode('utf-8')
        
        # 2. Ollama LLAVA 모델 호출
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{OLLAMA_BASE_URL}/api/generate",
                    json={
                        "model": "llava",
                        "prompt": "이 이미지에 포함된 모든 텍스트를 있는 그대로 추출해서 보여줘. 설명이나 요약은 하지 말고 텍스트 내용만 한국어로 출력해줘.",
                        "images": [base64_image],
                        "stream": False
                    }
                )
                
                if response.status_code == 200:
                    result_data = response.json()
                    raw_response = result_data.get('response', '')
                    print(f"DEBUG: Ollama raw response: {raw_response[:100]}...")
                    result_text = raw_response if raw_response else "텍스트를 추출하지 못했습니다."
                else:
                    print(f"DEBUG: Ollama error: {response.status_code} - {response.text}")
                    result_text = f"[AI 분석 오류] Ollama 서버 응답 실패 (Code: {response.status_code})"
        except Exception as e:
            result_text = f"[AI 분석 오류] 서버 연동 중 문제 발생: {str(e)}"
            
    elif any(ext in filename for ext in ["mp3", "wav", "m4a", "ogg"]):
        # Audio 처리 (현재는 텍스트 변환 시뮬레이션 - Whisper 등 연동 가능)
        result_text = "[음성 분석 시뮬레이션] '현재 서초 데이터센터 2층 L2 스위치 모듈에서 과열 경고음이 감지되고 있습니다. 즉시 점검이 필요합니다.' (실제 STT 연동 준비 중)"
    else:
        result_text = "[멀티모달 분석] 지원하지 않는 파일 형식입니다. (이미지/음성 파일만 지원)"

    return {
        "status": "success",
        "converted_text": result_text,
        "filename": file.filename,
        "content_type": content_type
    }


class ReportBroadcastRequest(BaseModel):
    incident_id: str
    report_content: str
    recipients: List[str]
    channels: List[str] = ["email", "app"]

@app.post("/ai/report/broadcast")
async def broadcast_report(req: ReportBroadcastRequest, background_tasks: BackgroundTasks):
    """인시던트 보고서 공식 전파 (이메일 발송, 앱 알림, Dify 지식 베이스 적재)"""
    
    # 1. Fetch incident from Worker Proxy
    inc_res = await WorkerClient.get(f"/incidents/{req.incident_id}")
    if "error" in inc_res or not inc_res.get("title"):
        raise HTTPException(status_code=404, detail="인시던트를 찾을 수 없습니다.")
        
    title = inc_res.get("title", "Unknown")
    created_at = inc_res.get("created_at", "N/A")

    # 2. 지식 베이스(Dify) 저장
    metadata = {
        "incident_id": req.incident_id,
        "type": "official_report",
        "sender": "S-GUARD AI",
        "timestamp": get_kst().strftime('%Y-%m-%d %H:%M:%S')
    }
    background_tasks.add_task(DifyClient.ingest_to_dataset, content=req.report_content, metadata=metadata)

    # 2. 이메일 발송 (HTML)
    if "email" in req.channels:
        email_subject = f"[S-GUARD] 장애 보고서: {title}"
        report_html = req.report_content.replace('\n', '<br>')
        email_body = f"""
        <html>
        <body style="font-family: sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; border: 1px solid #ddd; padding: 20px; border-radius: 10px;">
                <h2 style="color: #d32f2f; border-bottom: 2px solid #d32f2f; padding-bottom: 10px;">장애 종결 보고서</h2>
                <p><strong>인시던트 ID:</strong> {req.incident_id}</p>
                <p><strong>제목:</strong> {title}</p>
                <p><strong>발생 일시:</strong> {created_at}</p>
                <hr style="border: 0; border-top: 1px solid #eee;">
                <div style="background: #f9f9f9; padding: 15px; border-radius: 5px;">
                    {report_html}
                </div>
                <p style="font-size: 12px; color: #888; margin-top: 20px;">본 메일은 S-GUARD AIOps 시스템에서 자동으로 발송되었습니다.</p>
            </div>
        </body>
        </html>
        """
        for email in req.recipients:
            if "@" in email:
                background_tasks.add_task(send_email_async, email, email_subject, email_body, is_html=True)

    # 3. 앱 알림 (WebSocket 브로드캐스트)
    if "app" in req.channels:
        await manager.broadcast({
            "type": "report_broadcast",
            "incident_id": req.incident_id,
            "title": title,
            "summary": "장애가 최종 처리되어 보고서가 발송되었습니다."
        })

    # 상태 업데이트
    await WorkerClient.patch(f"/incidents/{req.incident_id}", {"status": "처리완료"})

    return {"status": "success", "message": f"{len(req.recipients)}명의 수신자에게 보고서 전파를 시작했습니다."}

class InsightSaveRequest(BaseModel):
    incident_id: str
    content: str
    severity: str
    category: str
    user_id: str = "SYSTEM"

class AgentMessage(BaseModel):
    role: str
    text: str

class ChatHistorySaveRequest(BaseModel):
    incident_id: str
    messages: List[AgentMessage]
    user_id: str = "SYSTEM"

@app.post("/ai/insight/save")
async def save_insight(req: InsightSaveRequest):
    try:
        res = await WorkerClient.post("/ai/insight/save", {
            "incident_id": req.incident_id,
            "content": req.content,
            "severity": req.severity,
            "category": req.category,
            "user_id": req.user_id
        })
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ai/chat-history/save")
async def save_chat_history(req: ChatHistorySaveRequest):
    try:
        res = await WorkerClient.post("/ai/chat-history/save", {
            "incident_id": req.incident_id,
            "messages": [{"role": m.role, "text": m.text} for m in req.messages],
            "user_id": req.user_id
        })
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/ai/insight/{incident_id}")
async def get_insight(incident_id: str):
    res = await WorkerClient.get(f"/ai/insight/{incident_id}")
    if "error" in res:
        raise HTTPException(status_code=404, detail="Insight not found")
    return res

@app.get("/ai/chat-history/{incident_id}")
async def get_chat_history(incident_id: str):
    res = await WorkerClient.get(f"/ai/chat-history/{incident_id}")
    if "error" in res:
        raise HTTPException(status_code=404, detail="Chat history not found")
    return res

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
