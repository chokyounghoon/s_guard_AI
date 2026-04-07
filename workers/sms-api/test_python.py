import requests
import json

api_key = "app-NKmE6uOd6n7FteajnHh1xXuf"
api_base = "https://api.dify.ai/v1"

# 1. Upload
print("Uploading...")
with open("react.png", "rb") as f:
    upload_res = requests.post(
        f"{api_base}/files/upload",
        headers={"Authorization": f"Bearer {api_key}"},
        data={"user": "sguard-multimodal-user"},
        files={"file": ("react.png", f, "image/png")}
    )
upload_data = upload_res.json()
print("Upload:", upload_data)

if "id" not in upload_data:
    print("Upload failed")
    exit(1)

# 2. Chat using Inputs
print("Chat with inputs.sms_image...")
chat_res = requests.post(
    f"{api_base}/chat-messages",
    headers={
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    },
    json={
        "user": "sguard-multimodal-user",
        "response_mode": "blocking",
        "query": "첨부된 이미지의 텍스트를 정확하게 추출해서 알려주세요.",
        "inputs": {
            "sms_image": {
                "type": "image",
                "transfer_method": "local_file",
                "upload_file_id": upload_data["id"]
            }
        },
        "files": []
    }
)
print("Status:", chat_res.status_code)
print("Response:", chat_res.text)
