const crypto = require('crypto');

function generateToken() {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ employee_id: '18121020', name: 'Tester', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
  const signature = crypto.createHmac('sha256', 'sguard-jwt-secret-change-me').update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

const token = generateToken();

fetch('https://sguardai.khcho0421.workers.dev/ai/incident/workflow-details?inc_id=20260510133034400', {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(res => res.text()).then(text => console.log("RESPONSE:", text)).catch(console.error);
