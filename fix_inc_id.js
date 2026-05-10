const fs = require('fs');
const path = './workers/sms-api/src/index.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Remove .replace('INC-', '')
content = content.replace(/\.replace\('INC-', ''\)/g, '');
// Remove .replace(/INC-/g, '') 
content = content.replace(/\.replace\(\/INC-\/g, ''\)/g, '');

// 2. Remove fullId logic
content = content.replace(/const fullId = [^\n]+;/g, '');

// 3. Fix OR inc_id = ? in queries
content = content.replace(/OR i\.inc_id = \?/g, '');
content = content.replace(/OR r\.inc_id = \?/g, '');
content = content.replace(/OR w\.inc_id = \?/g, '');
content = content.replace(/OR ia\.inc_id = \?/g, '');
content = content.replace(/OR wc\.inc_id = \?/g, '');
content = content.replace(/OR incident_code = \?/g, '');

// 4. Fix binds that pass rawId, fullId
content = content.replace(/\.bind\([^,]+,\s*fullId/g, '.bind($1');
// wait, a better way for bind(rawId, fullId) or bind(rawId, fullId, rawId, fullId)
content = content.replace(/\.bind\(rawId, fullId, rawId, fullId\)/g, '.bind(rawId, rawId)');
content = content.replace(/\.bind\(rawId, fullId\)/g, '.bind(rawId)');

fs.writeFileSync(path, content);
console.log('Fixed backend index.js');
