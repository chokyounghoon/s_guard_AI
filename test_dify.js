const fs = require('fs');

async function test() {
  const api_key = "app-NKmE6uOd6n7FteajnHh1xXuf";
  const api_base = 'https://api.dify.ai/v1';

  // Try to send a generic base64 image
  const base64Image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==";
  const contentType = "image/png";

  const payload = {
      user: "sguard-multimodal-user",
      response_mode: "blocking",
      inputs: {
          sms_image: {
              type: "image",
              transfer_method: "remote_url",
              url: `data:${contentType};base64,${base64Image}`
          }
      }
  };

  const response = await fetch(`${api_base}/workflows/run`, {
      method: 'POST',
      headers: {
          'Authorization': `Bearer ${api_key}`,
          'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
  });

  console.log(response.status);
  console.log(await response.text());
}

test();
