const fs = require('fs');

async function test() {
  const api_key = "app-NKmE6uOd6n7FteajnHh1xXuf";
  const api_base = 'https://api.dify.ai/v1';

  // chat-messages
  const responseChat = await fetch(`${api_base}/chat-messages`, {
      method: 'POST',
      headers: {
          'Authorization': `Bearer ${api_key}`,
          'Content-Type': 'application/json',
      },
      body: JSON.stringify({
          inputs: {},
          query: "extract text",
          user: "test-user",
          response_mode: "blocking"
      })
  });
  console.log("Chat:", responseChat.status, await responseChat.text());

  // completion-messages
  const responseComp = await fetch(`${api_base}/completion-messages`, {
      method: 'POST',
      headers: {
          'Authorization': `Bearer ${api_key}`,
          'Content-Type': 'application/json',
      },
      body: JSON.stringify({
          inputs: { text: "hello" },
          user: "test-user",
          response_mode: "blocking"
      })
  });
  console.log("Comp:", responseComp.status, await responseComp.text());
}

test();
