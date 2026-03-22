import sys
sys.path.append('.')
from backend.main import *
from fastapi.testclient import TestClient

client = TestClient(app)

response = client.post(
    "/sms/receive",
    json={
        "sender": "010-1234-5678",
        "message": "CRITICAL: DB Connection Pool 다운",
        "received_at": "2023-11-20T10:00:00Z"
    }
)
print("Status Code:", response.status_code)
print("Response:", response.json())
