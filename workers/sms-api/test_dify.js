async function run() {
    const api_key = "app-NKmE6uOd6n7FteajnHh1xXuf";
    const api_base = "https://api.dify.ai/v1";
    const response = await fetch(`${api_base}/chat-messages`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${api_key}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            user: "sguard-multimodal-user",
            response_mode: "streaming",
            query: "첨부된 이미지의 텍스트를 정확하게 추출해서 알려주세요.",
            inputs: {},
            files: [
                {
                    "type": "image",
                    "transfer_method": "local_file",
                    "upload_file_id": "a3d4475c-7936-4183-94c9-17bdb3cc8755"
                }
            ]
        })
    });
    console.log("Response:", await response.text());
}
run();
