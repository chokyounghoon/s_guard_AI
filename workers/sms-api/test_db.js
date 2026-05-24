const fs = require('fs');
const dbFile = fs.readdirSync('.wrangler/state/v3/d1/miniflare-D1DatabaseObject/').find(f => f.endsWith('.sqlite') && f !== 'metadata.sqlite');
console.log(dbFile);
