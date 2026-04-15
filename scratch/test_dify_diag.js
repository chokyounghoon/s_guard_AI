const API_KEY = "app-TSlqmp329iKOzpXUP90iC6Kw"; // From Wrangler logs
const API_BASE = "https://api.dify.ai/v1";

async function testDify() {
  console.log("Testing Dify Chat API...");
  try {
    const res = await fetch(`${API_BASE}/chat-messages`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${API_KEY}`, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({
        inputs: {},
        query: "Hello, this is a test.",
        response_mode: "blocking",
        user: "test-user"
      })
    });
    console.log("Chat Status:", res.status);
    const data = await res.json();
    console.log("Chat Response:", JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Chat Error:", e);
  }

  console.log("\nTesting Dify Workflow API...");
  try {
    const res = await fetch(`${API_BASE}/workflows/run`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${API_KEY}`, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({
        inputs: { query: "Hello, this is a test." },
        response_mode: "blocking",
        user: "test-user"
      })
    });
    console.log("Workflow Status:", res.status);
    const data = await res.json();
    console.log("Workflow Response:", JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Workflow Error:", e);
  }
}

testDify();
