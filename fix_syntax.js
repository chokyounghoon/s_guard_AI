const fs = require('fs');
const file = './frontend/src/pages/ChatPage.jsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/\{incidentId\?\}/g, '{incidentId}');
fs.writeFileSync(file, content);
console.log('Fixed syntax error');
