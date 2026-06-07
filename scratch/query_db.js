import { DatabaseSync } from 'node:sqlite';

const file = 'workers/sms-api/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/235350cd29c482d3999114279cc9899ec39afda2f21211b7600f1ca95f70cbd1.sqlite';

try {
  const db = new DatabaseSync(file);
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
  console.log('Tables:', tables);
  
  if (tables.includes('incidents')) {
    const count = db.prepare("SELECT count(*) as cnt FROM incidents").get();
    console.log(`Incidents count: ${count.cnt}`);
    const samples = db.prepare("SELECT inc_id, status, severity, title, created_at FROM incidents ORDER BY created_at DESC LIMIT 10").all();
    console.log(`Sample incidents:`, samples);
  }
  
  if (tables.includes('received_messages')) {
    const count = db.prepare("SELECT count(*) as cnt FROM received_messages").get();
    console.log(`received_messages count: ${count.cnt}`);
    const samples = db.prepare("SELECT inc_id, message, sender, timestamp FROM received_messages ORDER BY timestamp DESC LIMIT 5").all();
    console.log(`Sample received_messages:`, samples);
  }
  
  if (tables.includes('warroom_chats')) {
    const count = db.prepare("SELECT count(*) as cnt FROM warroom_chats").get();
    console.log(`warroom_chats count: ${count.cnt}`);
    const samples = db.prepare("SELECT id, inc_id, sender_name, text FROM warroom_chats WHERE text LIKE '%첨부파일%' OR text LIKE '%png%' OR text LIKE '%jpg%' LIMIT 5").all();
    console.log(`Sample image chats:`, samples);
  }
} catch (e) {
  console.log('Error:', e.message);
}
