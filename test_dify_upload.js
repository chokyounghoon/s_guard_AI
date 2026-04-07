const fs = require('fs');

async function test() {
  const api_key = "app-NKmE6uOd6n7FteajnHh1xXuf";
  const api_base = 'https://api.dify.ai/v1';

  // Real 1x1 png file buffer
  const buffer = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==", "base64");
  
  // Build primitive multipart/form-data
  const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
  const body = Buffer.concat([
    Buffer.from('--' + boundary + '\r\n'),
    Buffer.from('Content-Disposition: form-data; name="file"; filename="test.png"\r\n'),
    Buffer.from('Content-Type: image/png\r\n\r\n'),
    buffer,
    Buffer.from('\r\n--' + boundary + '\r\n'),
    Buffer.from('Content-Disposition: form-data; name="user"\r\n\r\n'),
    Buffer.from('sguard-multimodal-user\r\n'),
    Buffer.from('--' + boundary + '--\r\n')
  ]);

  const uploadRes = await fetch(`${api_base}/files/upload`, {
      method: 'POST',
      headers: {
          'Authorization': `Bearer ${api_key}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body: body
  });

  console.log("Upload Status:", uploadRes.status);
  const uploadData = await uploadRes.json();
  console.log("Upload Data:", uploadData);

  if (uploadData.id) {
      const payload = {
          user: "sguard-multimodal-user",
          response_mode: "blocking",
          query: "test",
          inputs: {
              sms_image: {
                  type: "image",
                  transfer_method: "local_file",
                  upload_file_id: uploadData.id
              }
          }
      };

      const chatRes = await fetch(`${api_base}/chat-messages`, {
          method: 'POST',
          headers: {
              'Authorization': `Bearer ${api_key}`,
              'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
      });
      console.log("Chat Status:", chatRes.status);
      console.log("Chat Answer:", await chatRes.text());
  }
}

test();
