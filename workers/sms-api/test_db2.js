const fs = require('fs');
const Database = require('better-sqlite3');
const dbFile = fs.readdirSync('.wrangler/state/v3/d1/miniflare-D1DatabaseObject/').find(f => f.endsWith('.sqlite') && f !== 'metadata.sqlite');
const db = new Database('.wrangler/state/v3/d1/miniflare-D1DatabaseObject/' + dbFile);
console.log("incidents count:", db.prepare("SELECT count(*) as c FROM incidents").get().c);
console.log("warroom_list count:", db.prepare("SELECT count(*) as c FROM warroom_list").get().c);
console.log("received_messages count:", db.prepare("SELECT count(*) as c FROM received_messages").get().c);
