const Database = require('better-sqlite3');
const db = new Database(':memory:');

db.exec(`
CREATE TABLE IF NOT EXISTS autopilot_insight (
    inc_id TEXT PRIMARY KEY,
    content TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS incident_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    inc_id TEXT NOT NULL,
    status TEXT
);
`);

try {
  let query = `
    SELECT 
      CASE WHEN insight.id IS NOT NULL THEN 1 ELSE 0 END as is_analyzed
    FROM incident_assignments a
    LEFT JOIN autopilot_insight insight ON a.inc_id = insight.inc_id
  `;
  db.prepare(query).all();
  console.log("Success");
} catch (e) {
  console.error("Error:", e.message);
}
