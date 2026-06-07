async function test() {
  const incId = "20260606142754931";
  console.log(`Fetching summary for ${incId}...`);
  const res = await fetch(`https://sguardai.khcho0421.workers.dev/ai/summarize-chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ incident_id: incId })
  });
  
  if (!res.ok) {
    console.error("HTTP Error:", res.status, await res.text());
    return;
  }
  
  const text = await res.text();
  console.log(text);
}
test();
