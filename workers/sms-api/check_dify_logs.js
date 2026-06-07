const fs = require('fs');
const Database = require('better-sqlite3');

const wranglerDir = '/Users/khcho/work_antigravity/s_guard_AI/workers/sms-api/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/';
const dbFile = fs.readdirSync(wranglerDir).find(f => f.endsWith('.sqlite') && f !== 'metadata.sqlite');

if (!dbFile) {
  console.log("No sqlite database found in local wrangler storage.");
  process.exit(0);
}

const db = new Database(wranglerDir + dbFile);

console.log("=== LATEST DIFY DEBUG LOGS ===");
try {
  const logs = db.prepare("SELECT * FROM dify_debug_logs ORDER BY id DESC LIMIT 5").all();
  for (const log of logs) {
    console.log(`\nID: ${log.id} | IncID: ${log.inc_id} | Code: ${log.status_code}`);
    console.log(`Endpoint: ${log.api_endpoint}`);
    console.log(`Error: ${log.error_message}`);
    console.log(`Payload: ${log.request_payload?.slice(0, 1000)}`);
  }
} catch (e) {
  console.error(e);
}
