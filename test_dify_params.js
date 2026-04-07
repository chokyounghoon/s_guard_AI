const fs = require('fs');

async function test() {
  const api_key = "app-NKmE6uOd6n7FteajnHh1xXuf";
  const api_base = 'https://api.dify.ai/v1';

  const response = await fetch(`${api_base}/parameters`, {
      method: 'GET',
      headers: {
          'Authorization': `Bearer ${api_key}`,
          'Content-Type': 'application/json',
      }
  });

  console.log(response.status);
  console.log(await response.text());
}

test();
