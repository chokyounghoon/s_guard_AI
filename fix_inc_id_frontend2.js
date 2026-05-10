const fs = require('fs');

const fix1 = './frontend/src/mobile/pages/MobileExpertAdvisor.jsx';
let content1 = fs.readFileSync(fix1, 'utf8');
content1 = content1.replace(/const cleanId = String\(incidentId\)\.startsWith\('INC-'\) \? incidentId : `INC-\$\{incidentId\}`;/g, 'const cleanId = String(incidentId);');
fs.writeFileSync(fix1, content1);

const fix2 = './frontend/src/pages/AssignmentsPage.jsx';
let content2 = fs.readFileSync(fix2, 'utf8');
content2 = content2.replace(/code: inc\.inc_id\.startsWith\('INC-'\) \? inc\.inc_id : `INC-\$\{inc\.inc_id\}`/g, 'code: inc.inc_id');
fs.writeFileSync(fix2, content2);

const fix3 = './frontend/src/pages/AiReportPage.jsx';
let content3 = fs.readFileSync(fix3, 'utf8');
content3 = content3.replace(/const reqId = safeId\.startsWith\('INC-'\) \? safeId\.slice\(4\) : safeId;/g, 'const reqId = safeId;');
fs.writeFileSync(fix3, content3);
console.log('Fixed startsWith artifacts');
