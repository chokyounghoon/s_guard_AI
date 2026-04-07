const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');

async function run() {
    const api_key = "app-NKmE6uOd6n7FteajnHh1xXuf";
    const api_base = "https://api.dify.ai/v1";
    
    // 1. Upload
    console.log("Uploading react.png...");
    const form = new FormData();
    form.append('file', fs.createReadStream('react.png'));
    form.append('user', 'sguard-multimodal-user');
    
    const uploadRes = await fetch(`${api_base}/files/upload`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${api_key}`,
            ...form.getHeaders()
        },
        body: form
    });
    const uploadData = await uploadRes.json();
    console.log("Upload response:", uploadData);
    
    if (!uploadData.id) return console.log("Upload failed stop");

    // 2. Chat
    console.log("Calling chat-messages with ID:", uploadData.id);
    const response = await fetch(`${api_base}/chat-messages`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${api_key}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            user: "sguard-multimodal-user",
            response_mode: "blocking",
            query: "첨부된 이미지의 텍스트를 정확하게 추출해서 알려주세요.",
            inputs: {
                "sms_image": {
                    "type": "image",
                    "transfer_method": "local_file",
                    "upload_file_id": uploadData.id
                }
            },
            files: []
        })
    });
    console.log("Status:", response.status);
    console.log("Response:", await response.text());
}
run();
