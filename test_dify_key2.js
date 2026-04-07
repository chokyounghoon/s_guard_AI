const fs = require('fs');

async function test() {
  const api_key = "app-owwPp3j2qAvVDZpW2UUiY8L3";
  const api_base = 'https://api.dify.ai/v1';

  // Try workflow
  const res1 = await fetch(`${api_base}/workflows/run`, {
      method: 'POST',
      headers: {
          'Authorization': `Bearer ${api_key}`,
          'Content-Type': 'application/json',
      },
      body: JSON.stringify({
          user: "test-user",
          response_mode: "blocking",
          inputs: {
              sms_image: {
                  type: "image",
                  transfer_method: "remote_url",
                  url: `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==`
              }
          }
      })
  });
  console.log("Workflow:", res1.status, await res1.text());
}

test();
