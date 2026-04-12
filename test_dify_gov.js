const fetch = require('node-fetch');
async function run() {
  const r = await fetch('https://api.dify.ai/v1/parameters', {
    method: 'GET',
    headers: { 'Authorization': 'Bearer app-QHxJQTBSKJlTw2gVeGgTk915' }
  });
  console.log(r.status);
  const data = await r.text();
  console.log(data);
}
run();
