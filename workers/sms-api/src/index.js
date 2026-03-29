import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { streamSSE } from 'hono/streaming'

const app = new Hono()

app.use('*', cors())

// Utility for KST Timestamp
const getKst = () => {
  const now = new Date()
  const kstOffset = 9 * 60 * 60 * 1000
  return new Date(now.getTime() + kstOffset).toISOString().replace('T', ' ').substring(0, 19)
}

// Utility to generate unique numeric string ID (YYYYMMDDHHMMSS + RRR)
const generateIncId = () => {
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kst = new Date(now.getTime() + kstOffset);
  const yyyy = kst.getFullYear();
  const mm = String(kst.getMonth() + 1).padStart(2, '0');
  const dd = String(kst.getDate()).padStart(2, '0');
  const hh = String(kst.getHours()).padStart(2, '0');
  const mi = String(kst.getMinutes()).padStart(2, '0');
  const ss = String(kst.getSeconds()).padStart(2, '0');
  const random = Math.floor(100 + Math.random() * 900); // 3 digits
  return `${yyyy}${mm}${dd}${hh}${mi}${ss}${random}`;
}

// Utility for AI Embeddings
const generateEmbedding = async (text, env) => {
  if (!text || !env.AI) {
    console.error('Text or env.AI is missing');
    return null;
  }
  try {
    console.log('Generating embedding for text:', text.substring(0, 50));
    const response = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
      text: [text]
    });
    if (!response || !response.data || !response.data[0]) {
      console.error('Invalid AI response:', JSON.stringify(response));
      return null;
    }
    console.log('Embedding generated successfully, dimensions:', response.data[0].length);
    return response.data[0];
  } catch (e) {
    console.error('Embedding error detail:', e.message, e.stack);
    return null;
  }
}

// Utility for Password Hashing (Compatible with Python's salt:sha256_hash)
const hashPassword = async (password) => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  
  const encoder = new TextEncoder();
  const data = encoder.encode(saltHex + password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  
  return `${saltHex}:${hashHex}`;
}

const verifyPassword = async (password, storedHash) => {
  if (!storedHash || !storedHash.includes(':')) return false;
  try {
    const [saltHex, originalHash] = storedHash.split(':');
    const encoder = new TextEncoder();
    const data = encoder.encode(saltHex + password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex === originalHash;
  } catch (e) {
    return false;
  }
}

// ==========================================
// 1. Auth & Users
// ==========================================
app.post('/auth/login', async (c) => {
  const { email, password } = await c.req.json()
  const db = c.env.DB
  
  // Find user by email or employee_id
  const user = await db.prepare("SELECT * FROM users WHERE (email = ? OR employee_id = ?) AND is_active = 1")
    .bind(email, email)
    .first()

  if (!user || !user.password_hash || !(await verifyPassword(password, user.password_hash))) {
    return c.json({ detail: "이메일(또는 사번) 또는 비밀번호가 올바르지 않습니다." }, 401)
  }

  // Token is just email for mock auth as per earlier JWT replacements
  const token = `sguard-token-${user.id}`
  const now = getKst()
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-real-ip') || 'unknown'
  const ua = c.req.header('user-agent') || 'unknown'

  await db.prepare("UPDATE users SET token = ?, mod_dt = ?, mod_id = ? WHERE employee_id = ?")
    .bind(token, now, user.employee_id || 'SYSTEM', user.employee_id)
    .run()

  await db.prepare(`
    INSERT INTO login_history (
      user_id, email, ip_address, user_agent, status, login_time, reg_id, reg_dt, mod_id, mod_dt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(user.employee_id, user.email, ip, ua, 'SUCCESS', now, user.employee_id || 'SYSTEM', now, user.employee_id || 'SYSTEM', now)
    .run()

  return c.json({
    id: user.employee_id, // Return employee_id as the primary id
    email: user.email, name: user.name, role: user.role,
    company: user.company, honbu: user.honbu, team: user.team,
    employee_id: user.employee_id, position: user.position,
    is_admin: user.is_admin || 0,
    token: token,
    numeric_id: user.id // keep original id as numeric_id if needed elsewhere
  })
})

app.post('/auth/signup', async (c) => {
  const body = await c.req.json()
  const { email, password, name, company, honbu, team, part, subpart, phone, employee_id, position } = body
  const db = c.env.DB
  
  console.log('[Signup Search] employee_id:', employee_id);

  if (!employee_id) {
    return c.json({ detail: "사번(Employee ID)은 필수 입력 항목입니다." }, 400)
  }

  const existing = await db.prepare("SELECT id FROM users WHERE email = ? OR employee_id = ?").bind(email, employee_id).first()
  if (existing) {
    return c.json({ detail: "이미 등록된 이메일 또는 사번입니다." }, 400)
  }

  const hashedPassword = await hashPassword(password)
  const regDt = getKst()
  const token = Math.random().toString(36).substring(2) + Date.now().toString(36)
  
  // ── 사번(Employee ID) 정제: 'EMP-' 등 접두사 강제 제거 (Type-safe) ──
  // 사용자가 어떤 입력을 주더라도 문자열로 변환 후 접두사를 제거합니다.
  const cleanEmpId = String(employee_id || '').replace(/^EMP-/i, '').replace(/^SH-/i, '').trim()
  
  console.log('[Signup Debug] Original ID:', employee_id, '-> Cleaned ID:', cleanEmpId);
  console.log('[Signup Debug] Phone from body:', phone);
  
  const finalPhone = (phone || '').trim();
  
  console.log('[Signup Prepare] Inserting user with cleanEmpId:', cleanEmpId, 'token:', token);
  
  const res = await db.prepare(
    `INSERT INTO users (
      email, password_hash, name, company, honbu, team, part, subpart, phone,
      employee_id, position, role, is_active, is_admin, token, 
      reg_id, reg_dt, mod_id, mod_dt, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    email, hashedPassword, name, company, honbu || '', team || '', part || '', subpart || '', finalPhone,
    cleanEmpId, position || 'POS_001', 'user', 1, 0, token, 
    cleanEmpId, regDt, cleanEmpId, regDt, regDt
  ).run()

  const userId = res.meta.last_row_id
  console.log('[Signup Success] New user ID:', userId);

  return c.json({ 
    status: "success", 
    debug_v: "20240328_final", // 배포 여부 확인용 버전 플래그
    token: token,
    user: {
      id: cleanEmpId, // Return cleaned employee_id as id
      email,
      name,
      role: 'user',
      company,
      honbu: honbu || '',
      team: team || '',
      part: part || '',
      subpart: subpart || '',
      phone: finalPhone,
      employee_id: cleanEmpId,
      position: position || 'POS_001',
      is_admin: 0,
      numeric_id: userId
    }
  })
})

app.post('/auth/request-reset-code', async (c) => {
  const { email, employee_id } = await c.req.json()
  const db = c.env.DB
  
  const user = await db.prepare("SELECT * FROM users WHERE email = ? AND employee_id = ?").bind(email, employee_id).first()
  if (!user) {
    return c.json({ detail: "가입 정보가 없거나 사번이 일치하지 않습니다." }, 404)
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString()
  await db.prepare("INSERT INTO reset_verifications (email, code, created_at, is_verified) VALUES (?, ?, ?, 0)")
    .bind(user.email, code, getKst())
    .run()

  // TODO: Send email
  return c.json({ status: "success", message: `인증코드가 발송되었습니다. (DEMO: ${code})` })
})

app.post('/auth/verify-reset-code', async (c) => {
  const { email, employee_id, code } = await c.req.json()
  const db = c.env.DB

  const record = await db.prepare("SELECT * FROM reset_verifications WHERE email = ? AND code = ? AND is_verified = 0 ORDER BY inc_id DESC LIMIT 1")
    .bind(email, code)
    .first()

  if (!record) {
    return c.json({ detail: "인증 코드가 올바르지 않거나 만료되었습니다." }, 400)
  }
  
  await db.prepare("UPDATE reset_verifications SET is_verified = 1 WHERE inc_id = ?").bind(record.inc_id).run()

  const temp_password = "T" + Math.floor(100000 + Math.random() * 900000).toString() + "!"
  const hashedTempPassword = await hashPassword(temp_password)
  const modDt = getKst()
  
  await db.prepare("UPDATE users SET password_hash = ?, mod_dt = ?, mod_id = ? WHERE email = ?")
    .bind(hashedTempPassword, modDt, 'SYSTEM', email)
    .run()

  const user = await db.prepare("SELECT name, email FROM users WHERE email = ?").bind(email).first()
  return c.json({ temp_password, name: user.name, email: user.email })
})

app.get('/users', async (c) => {
  const db = c.env.DB
  const users = await db.prepare("SELECT id, email, name, role, company, honbu, team, is_active, is_admin FROM users").all()
  return c.json(users.results)
})

app.get('/users/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const user = await db.prepare("SELECT employee_id, email, name, role, company, honbu, team, part, subpart, phone, is_active, is_admin FROM users WHERE employee_id = ?").bind(id).first()
  if (!user) return c.json({ detail: "User not found" }, 404)
  return c.json(user)
})

app.patch('/auth/profile', async (c) => {
  const db = c.env.DB
  const { user_id, name, phone, company, honbu, team, part, subpart } = await c.req.json()
  const modDt = getKst()
  
  const empId = user_id // user_id is now already the employee_id

  await db.prepare(
    "UPDATE users SET name = ?, phone = ?, company = ?, honbu = ?, team = ?, part = ?, subpart = ?, mod_dt = ?, mod_id = ? WHERE employee_id = ?"
  ).bind(name, phone || null, company || null, honbu || null, team || null, part || null, subpart || null, modDt, empId, user_id).run()
  const updated = await db.prepare("SELECT employee_id, email, name, role, company, honbu, team, part, subpart, phone, employee_id, position, is_admin FROM users WHERE employee_id = ?").bind(user_id).first()
  return c.json({ status: "success", user: updated })
})

app.post('/auth/change-password', async (c) => {
  const db = c.env.DB
  const { user_id, old_password, new_password } = await c.req.json()
  const user = await db.prepare("SELECT * FROM users WHERE employee_id = ?").bind(user_id).first()
  
  if (!user || !(await verifyPassword(old_password, user.password_hash))) {
    return c.json({ detail: "현재 비밀번호가 올바르지 않습니다." }, 401)
  }
  
  const hashedNewPassword = await hashPassword(new_password)
  const modDt = getKst()
  await db.prepare("UPDATE users SET password_hash = ?, mod_dt = ?, mod_id = ? WHERE employee_id = ?")
    .bind(hashedNewPassword, modDt, user.employee_id || 'USER', user_id)
    .run()
  return c.json({ status: "success" })
})

app.post('/users/:id/reset-password', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const { new_password } = await c.req.json()
  const hashed = await hashPassword(new_password)
  const modDt = getKst()
  await db.prepare("UPDATE users SET password_hash = ?, mod_dt = ?, mod_id = ? WHERE employee_id = ?").bind(hashed, modDt, 'ADMIN', id).run()
  return c.json({ status: "success" })
})

app.patch('/users/:id/status', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const { is_active } = await c.req.json()
  const modDt = getKst()
  await db.prepare("UPDATE users SET is_active = ?, mod_dt = ?, mod_id = ? WHERE employee_id = ?").bind(is_active ? 1 : 0, modDt, 'ADMIN', id).run()
  return c.json({ status: "success" })
})

app.patch('/users/:id/role', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const { role } = await c.req.json()
  const modDt = getKst()
  await db.prepare("UPDATE users SET role = ?, mod_dt = ?, mod_id = ? WHERE employee_id = ?").bind(role, modDt, 'ADMIN', id).run()
  return c.json({ status: "success" })
})

// ==========================================
// 2. Organization Tree
// ==========================================
function buildTree(nodes, parentId = null) {
  return nodes
    .filter(n => n.parent_id === parentId)
    .map(n => ({
      ...n,
      children: buildTree(nodes, n.id)
    }))
}

app.get('/org/tree', async (c) => {
  const db = c.env.DB
  const { results } = await db.prepare("SELECT * FROM organizations ORDER BY sort_order ASC").all()
  return c.json(buildTree(results))
})

app.post('/org/nodes', async (c) => {
  const db = c.env.DB
  const { name, code, parent_id, depth, sort_order } = await c.req.json()
  const res = await db.prepare(
    "INSERT INTO organizations (name, code, parent_id, depth, sort_order) VALUES (?, ?, ?, ?, ?)"
  ).bind(name, code, parent_id || null, depth, sort_order).run()
  return c.json({ status: "success", id: res.meta.last_row_id })
})

app.patch('/org/nodes/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const { name, code, sort_order } = await c.req.json()
  await db.prepare(
    "UPDATE organizations SET name = ?, code = ?, sort_order = ? WHERE id = ?"
  ).bind(name, code, sort_order, id).run()
  return c.json({ status: "success" })
})

app.delete('/org/nodes/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  await db.prepare("DELETE FROM organizations WHERE id = ?").bind(id).run()
  return c.json({ status: "success" })
})

// ==========================================
// 2.1 Universal Code Book
// ==========================================
app.get('/ai/codes/:category', async (c) => {
  const category = c.req.param('category')
  const db = c.env.DB
  const { results } = await db.prepare(
    "SELECT code, name, sort_order FROM code_book WHERE category = ? AND is_active = 1 ORDER BY sort_order ASC"
  ).bind(category.toUpperCase()).all()
  return c.json({ category, codes: results })
})

// ==========================================
// 3. SMS Interactions
// ==========================================
app.post('/sms/receive', async (c) => {
  const body = await c.req.json()
  const { 
    sender, message, employee_id, 
    channel, if_id, service_code, service_name, 
    biz_system, error_code, occurrence_count, 
    occurrence_node, error_message, occurrence_time, received_at 
  } = body
  const finalOccurrenceTime = occurrence_time || received_at || null
  const db = c.env.DB
  const now = new Date()
  const kstOffset = 9 * 60 * 60 * 1000
  const kstNow = new Date(now.getTime() + kstOffset)
  const timestamp = kstNow.toISOString().replace('T', ' ').substring(0, 19)
  
  // Daily Duplicate check (same sender and message within the current KST day)
  const todayStart = kstNow.toISOString().substring(0, 10) + ' 00:00:00'
  const existing = await db.prepare(
    "SELECT inc_id, received_count FROM received_messages WHERE sender = ? AND message = ? AND timestamp >= ? ORDER BY timestamp DESC LIMIT 1"
  ).bind(sender, message, todayStart).first()

  if (existing) {
    const newCount = (existing.received_count || 1) + 1
    const count = parseInt(String(occurrence_count || '0').replace(/[^0-9]/g, '')) || 0
    await db.prepare(`
      UPDATE received_messages SET 
        received_count = ?, timestamp = ?, mod_dt = ?, employee_id = ?,
        channel = ?, if_id = ?, service_code = ?, service_name = ?, 
        biz_system = ?, error_code = ?, occurrence_count = ?, 
        occurrence_node = ?, error_message = ?, occurrence_time = ?,
        receiver_1 = ?, receiver_2 = ?, receiver_3 = ?, receiver_4 = ?, receiver_5 = ?,
        receiver_6 = ?, receiver_7 = ?, receiver_8 = ?, receiver_9 = ?, receiver_10 = ?,
        receiver_11 = ?, receiver_12 = ?, receiver_13 = ?, receiver_14 = ?, receiver_15 = ?,
        receiver_16 = ?, receiver_17 = ?, receiver_18 = ?, receiver_19 = ?, receiver_20 = ?
      WHERE inc_id = ?
    `).bind(
      newCount, timestamp, timestamp, employee_id || null,
      channel || null, if_id || null, service_code || null, service_name || null,
      biz_system || null, error_code || null, count,
      occurrence_node || null, error_message || null, finalOccurrenceTime || null,
      body.receiver_1 || null, body.receiver_2 || null, body.receiver_3 || null, body.receiver_4 || null, body.receiver_5 || null,
      body.receiver_6 || null, body.receiver_7 || null, body.receiver_8 || null, body.receiver_9 || null, body.receiver_10 || null,
      body.receiver_11 || null, body.receiver_12 || null, body.receiver_13 || null, body.receiver_14 || null, body.receiver_15 || null,
      body.receiver_16 || null, body.receiver_17 || null, body.receiver_18 || null, body.receiver_19 || null, body.receiver_20 || null,
      existing.inc_id
    ).run()

    // --- AUTO-ASSIGNMENT (DUPLICATE CASE) ---
    const rawReceivers = [];
    for (let i = 1; i <= 20; i++) {
        const r = body[`receiver_${i}`];
        if (r && r.trim() !== '' && String(r) !== 'null') rawReceivers.push(r.trim());
    }
    
    if (rawReceivers.length > 0) {
        // Normalize names: remove all internal whitespace
        const normalizedReceivers = rawReceivers.map(r => r.replace(/\s+/g, '').trim()).filter(Boolean);
        if (normalizedReceivers.length > 0) {
            const placeholders = normalizedReceivers.map(() => '?').join(',');
            try {
                const result = await db.prepare(`
                    INSERT OR IGNORE INTO incident_assignments (user_id, inc_id, status, assigned_at, updated_at)
                    SELECT DISTINCT u_target.employee_id, ?, '미확인', ?, ?
                    FROM users u_source
                    JOIN users u_target ON u_source.company = u_target.company AND u_source.team = u_target.team
                    WHERE u_source.is_active = 1
                      AND u_target.is_active = 1
                      AND (u_source.name IN (${placeholders}) OR u_source.employee_id IN (${placeholders}))
                `).bind(existing.inc_id, timestamp, timestamp, ...normalizedReceivers, ...normalizedReceivers).run();
                console.log(`[Assignment] Bulk assignment completed for ${existing.inc_id}. Changes: ${result.meta.changes}`);
            } catch (assignError) {
                console.error(`[Assignment] Error in bulk assignment for ${existing.inc_id}:`, assignError);
            }
        } else {
            console.warn(`[Assignment] No valid normalized receivers for ${existing.inc_id}`);
        }
    }

    return c.json({ status: 'duplicate_incremented', inc_id: existing.inc_id, received_count: newCount })
  }

  // Keyword detection from DB
  const { results: keywordList } = await db.prepare("SELECT keyword, response FROM alert_keywords").all()
  let response_msg = null
  let detected = false
  
  for (const k of keywordList) {
    if (message.includes(k.keyword)) {
      detected = true
      response_msg = k.response
      break
    }
  }

  const newIncId = generateIncId()
    const count = parseInt(String(occurrence_count || '0').replace(/[^0-9]/g, '')) || 0
  await db.prepare(`
    INSERT INTO received_messages (
      inc_id, sender, message, employee_id, timestamp, keyword_detected, 
      response_message, received_count, 
      channel, if_id, service_code, service_name, 
      biz_system, error_code, occurrence_count, 
      occurrence_node, error_message, occurrence_time,
      receiver_1, receiver_2, receiver_3, receiver_4, receiver_5,
      receiver_6, receiver_7, receiver_8, receiver_9, receiver_10,
      receiver_11, receiver_12, receiver_13, receiver_14, receiver_15,
      receiver_16, receiver_17, receiver_18, receiver_19, receiver_20,
      reg_id, reg_dt, mod_id, mod_dt
    ) VALUES (
      ?, ?, ?, ?, ?, ?, 
      ?, ?, 
      ?, ?, ?, ?, 
      ?, ?, ?, 
      ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?
    )
  `).bind(
    newIncId, sender || null, message || null, employee_id || null, timestamp, detected ? 1 : 0, 
    response_msg || null, 1,
    channel || null, if_id || null, service_code || null, service_name || null,
    biz_system || null, error_code || null, count,
    occurrence_node || null, error_message || null, finalOccurrenceTime || null,
    body.receiver_1 || null, body.receiver_2 || null, body.receiver_3 || null, body.receiver_4 || null, body.receiver_5 || null,
    body.receiver_6 || null, body.receiver_7 || null, body.receiver_8 || null, body.receiver_9 || null, body.receiver_10 || null,
    body.receiver_11 || null, body.receiver_12 || null, body.receiver_13 || null, body.receiver_14 || null, body.receiver_15 || null,
    body.receiver_16 || null, body.receiver_17 || null, body.receiver_18 || null, body.receiver_19 || null, body.receiver_20 || null,
    employee_id || 'SYSTEM', timestamp, employee_id || 'SYSTEM', timestamp
  ).run()

  // --- AUTO-ASSIGNMENT (NEW CASE) ---
  const rawReceivers = [];
  for (let i = 1; i <= 20; i++) {
    const r = body[`receiver_${i}`];
    if (r && r.trim() !== '' && String(r) !== 'null') rawReceivers.push(r.trim());
  }

  if (rawReceivers.length > 0) {
    // Normalize names: remove all internal whitespace
    const normalizedReceivers = rawReceivers.map(r => r.replace(/\s+/g, '').trim()).filter(Boolean);
    if (normalizedReceivers.length > 0) {
        const placeholders = normalizedReceivers.map(() => '?').join(',');
        try {
            const result = await db.prepare(`
                INSERT OR IGNORE INTO incident_assignments (user_id, inc_id, status, assigned_at, updated_at)
                SELECT DISTINCT u_target.employee_id, ?, '미확인', ?, ?
                FROM users u_source
                JOIN users u_target ON u_source.company = u_target.company AND u_source.team = u_target.team
                WHERE u_source.is_active = 1
                  AND u_target.is_active = 1
                  AND (u_source.name IN (${placeholders}) OR u_source.employee_id IN (${placeholders}))
            `).bind(newIncId, timestamp, timestamp, ...normalizedReceivers, ...normalizedReceivers).run();
            console.log(`[Assignment] Bulk assignment completed for ${newIncId}. Changes: ${result.meta.changes}`);
        } catch (assignError) {
            console.error(`[Assignment] Error in bulk assignment for ${newIncId}:`, assignError);
        }
    } else {
        console.warn(`[Assignment] No valid normalized receivers for ${newIncId}`);
    }
  }

  return c.json({ status: detected ? 'keyword_detected' : 'received', inc_id: newIncId })
})

// ==========================================
// 6. Real-time Notifications (SSE)
// ==========================================
app.get('/sms/notification-stream', async (c) => {
  const db = c.env.DB
  let lastSeenId = c.req.query('last_id') || null

  return streamSSE(c, async (stream) => {
    console.log('SSE Stream Connected')
    
    // Initial check to set lastSeenId if not provided
    if (!lastSeenId) {
      const latest = await db.prepare("SELECT inc_id FROM received_messages ORDER BY timestamp DESC LIMIT 1").first()
      if (latest) {
        lastSeenId = latest.inc_id
      }
    }

    // Keep the connection alive with a heartbeat every 30 seconds
    const heartbeatInterval = setInterval(async () => {
      await stream.writeSSE({ event: 'ping', data: 'heartbeat' })
    }, 30000)

    try {
      while (true) {
        // Check for new SMS every 3 seconds
        const latest = await db.prepare("SELECT * FROM received_messages ORDER BY timestamp DESC LIMIT 1").first()
        
        if (latest && latest.inc_id !== lastSeenId) {
          console.log('New SMS detected in SSE stream:', latest.inc_id)
          lastSeenId = latest.inc_id
          await stream.writeSSE({
            event: 'sms_received',
            data: JSON.stringify({
              inc_id: latest.inc_id,
              sender: latest.sender,
              message: latest.message,
              timestamp: latest.timestamp,
              keyword_detected: latest.keyword_detected === 1 || latest.keyword_detected === true,
              response_message: latest.response_message
            })
          })
        }
        
        // Wait for 3 seconds before next check
        await stream.sleep(3000)
      }
    } catch (e) {
      console.error('SSE Stream Error:', e)
      clearInterval(heartbeatInterval)
    } finally {
      clearInterval(heartbeatInterval)
      console.log('SSE Stream Disconnected')
    }
  })
})

app.get('/sms/recent', async (c) => {
  const limit = c.req.query('limit') || 10
  const db = c.env.DB
  const { results } = await db.prepare("SELECT * FROM received_messages ORDER BY inc_id DESC LIMIT ?").bind(limit).all()
  return c.json({ total: results.length, messages: results.map(r => ({ 
    inc_id: r.inc_id, 
    id: r.inc_id, 
    sender: r.sender, 
    message: r.message, 
    employee_id: r.employee_id,
    timestamp: r.timestamp, 
    keyword_detected: r.keyword_detected,
    channel: r.channel,
    if_id: r.if_id,
    service_code: r.service_code,
    service_name: r.service_name,
    biz_system: r.biz_system,
    error_code: r.error_code,
    occurrence_count: r.occurrence_count,
    occurrence_node: r.occurrence_node,
    error_message: r.error_message,
    occurrence_time: r.occurrence_time,
    receivers: [
      r.receiver_1, r.receiver_2, r.receiver_3, r.receiver_4, r.receiver_5,
      r.receiver_6, r.receiver_7, r.receiver_8, r.receiver_9, r.receiver_10,
      r.receiver_11, r.receiver_12, r.receiver_13, r.receiver_14, r.receiver_15,
      r.receiver_16, r.receiver_17, r.receiver_18, r.receiver_19, r.receiver_20
    ].filter(v => v !== null)
  })) })
})

app.get('/sms/stats', async (c) => {
  const db = c.env.DB
  const total = await db.prepare("SELECT COUNT(*) as c FROM received_messages").first('c')
  const unread = await db.prepare("SELECT COUNT(*) as c FROM received_messages WHERE read = 0").first('c')
  return c.json({ total, unread })
})

// ==========================================
// 4. Incident & Dashboard Summary
// ==========================================
app.get('/dashboard/summary', async (c) => {
  const db = c.env.DB
  const incidents = await db.prepare("SELECT * FROM incidents ORDER BY created_at DESC LIMIT 5").all()
  
  return c.json({
    systemStatus: { overall: 'Warning', activeAlarms: incidents.results.length },
    autopilotStats: { autoResolved: 15, learningRate: '98%', predictionAccuracy: '95%' }
  })
})

app.get('/sms/keywords', async (c) => {
  const db = c.env.DB
  const { results } = await db.prepare("SELECT * FROM alert_keywords").all()
  return c.json({ keywords: results })
})

app.post('/sms/keywords', async (c) => {
  const { keyword, response } = await c.req.json()
  const db = c.env.DB
  await db.prepare("INSERT INTO alert_keywords (keyword, response) VALUES (?, ?) ON CONFLICT(keyword) DO UPDATE SET response = excluded.response").bind(keyword, response).run()
  return c.json({ status: "success" })
})

app.post('/sms/keywords/delete/:keyword', async (c) => {
  const db = c.env.DB
  const keyword = c.req.param('keyword')
  await db.prepare("DELETE FROM alert_keywords WHERE keyword = ?").bind(keyword).run()
  return c.json({ status: "success" })
})

app.get('/incidents', async (c) => {
  const db = c.env.DB
  const { results } = await db.prepare("SELECT * FROM incidents ORDER BY created_at DESC").all()
  return c.json(results)
})

app.get('/incidents/:id', async (c) => {
  const inc_id = c.req.param('id')
  const db = c.env.DB
  const result = await db.prepare("SELECT * FROM incidents WHERE inc_id = ?").bind(inc_id).first()
  if (!result) return c.json({ error: "Not found" }, 404)
  return c.json(result)
})

app.get('/incidents/sms/:sms_id', async (c) => {
  const sms_id = c.req.param('sms_id')
  const db = c.env.DB
  const result = await db.prepare("SELECT * FROM incidents WHERE source_sms_id = ?").bind(sms_id).first()
  if (!result) return c.json({ error: "Not found" }, 404)
  return c.json(result)
})

app.get('/sms/:id', async (c) => {
  const id = c.req.param('id')
  const db = c.env.DB
  const result = await db.prepare("SELECT * FROM received_messages WHERE inc_id = ?").bind(id).first()
  if (!result) return c.json({ error: "Not found" }, 404)
  return c.json(result)
})

app.get('/activity-logs', async (c) => {
  const db = c.env.DB
  const inc_id = c.req.query('inc_id')
  
  let query = "SELECT * FROM activity_logs"
  let params = []
  
  if (inc_id) {
    query += " WHERE inc_id = ?"
    params.push(inc_id)
  }
  
  query += " ORDER BY created_at DESC LIMIT 50"
  
  const { results } = await db.prepare(query).bind(...params).all()
  return c.json({ logs: results })
})

app.post('/incidents', async (c) => {
  const data = await c.req.json()
  const db = c.env.DB
  const now = getKst()
  const inc_id = String(data.inc_id).replace('INC-', '')
  
  const res = await db.prepare(`
    INSERT INTO incidents (
      inc_id, title, description, severity, status, incident_type, 
      assigned_to, source_sms_id, ai_insight, reg_id, reg_dt, mod_id, mod_dt, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    inc_id, data.title, data.description || null, data.severity || 'NORMAL', 
    data.status || 'Open', data.incident_type || 'AI', data.assigned_to || null,
    data.source_sms_id || null, data.ai_insight || null,
    'SYSTEM', now, 'SYSTEM', now, now, now
  ).run()
  
  return c.json({ status: "success", id: inc_id })
})

app.post('/incident-history', async (c) => {
  const data = await c.req.json()
  const db = c.env.DB
  const now = getKst()
  
  const res = await db.prepare(`
    INSERT INTO incident_history (
      sms_id, target_system, error_code, problem_description, severity, 
      reg_id, reg_dt, mod_id, mod_dt, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    data.sms_id, data.target_system, data.error_code || null, 
    data.problem_description, data.severity,
    'SYSTEM', now, 'SYSTEM', now, now
  ).run()
  
  return c.json({ status: "success", id: res.meta.last_row_id })
})

app.post('/activity-logs', async (c) => {
  const data = await c.req.json()
  const db = c.env.DB
  const now = getKst()
  const inc_id = data.incident_code ? String(data.incident_code).replace('INC-', '') : null
  
  await db.prepare(`
    INSERT INTO activity_logs (
      inc_id, user_name, user_id, incident_code, incident_title, action, detail, 
      report_type, reg_id, reg_dt, mod_id, mod_dt, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    inc_id || 'UNKNOWN', data.user_name || 'System', data.user_id || null, inc_id, data.incident_title || null,
    data.action, data.detail || null, data.report_type || '시스템',
    'SYSTEM', now, 'SYSTEM', now, now
  ).run()
  
  return c.json({ status: "success" })
})

app.get('/warroom/rooms', async (c) => {
  const db = c.env.DB
  const q = c.req.query('q') || ''
  const statusFilter = c.req.query('status') || ''

  let sql = `
    SELECT
      w.inc_id                          AS code,
      w.inc_id,
      w.title,
      w.severity,
      w.status,
      w.creator_id,
      w.leader_summary,
      w.reg_dt                          AS created_at,
      (SELECT COUNT(*) FROM warroom_chats wc WHERE wc.inc_id = w.inc_id)       AS message_count,
      (SELECT COUNT(*) FROM warroom_attachments wa WHERE wa.inc_id = w.inc_id) AS attachment_count,
      (SELECT wc2.text FROM warroom_chats wc2 WHERE wc2.inc_id = w.inc_id ORDER BY wc2.timestamp DESC LIMIT 1)     AS last_message,
      (SELECT wc2.sender FROM warroom_chats wc2 WHERE wc2.inc_id = w.inc_id ORDER BY wc2.timestamp DESC LIMIT 1)   AS last_message_sender,
      (SELECT wc2.timestamp FROM warroom_chats wc2 WHERE wc2.inc_id = w.inc_id ORDER BY wc2.timestamp DESC LIMIT 1) AS last_message_time
    FROM warroom_list w
    WHERE 1=1
  `
  const params = []
  if (q) { sql += ` AND (w.title LIKE ? OR w.inc_id LIKE ?)`; params.push(`%${q}%`, `%${q}%`) }
  if (statusFilter) { sql += ` AND UPPER(w.status) = UPPER(?)`; params.push(statusFilter) }
  sql += ` ORDER BY w.reg_dt DESC LIMIT 50`

  const stmt = db.prepare(sql)
  const { results } = await stmt.bind(...params).all()
  return c.json({ rooms: results || [] })
})

// ==========================================
// 5. AI Dify Integration
// ==========================================
app.get('/ai/insight', async (c) => {
  const db = c.env.DB
  
  // 1. Get recent SMS
  const recent_sms = await db.prepare("SELECT * FROM received_messages ORDER BY inc_id DESC").first()
  
  // 2. Calculate prediction counts
  const { results: recent_messages } = await db.prepare("SELECT message FROM received_messages ORDER BY inc_id DESC LIMIT 100").all()
  const prediction_counts = { critical: 0, server: 0, security: 0, report: 0 }
  
  for (const msg of recent_messages) {
    const text = msg.message.toLowerCase()
    if (text.includes("db") || text.includes("데이터베이스")) prediction_counts.critical++
    else if (text.includes("cpu") || text.includes("메모리")) prediction_counts.server++
    else prediction_counts.report++
  }

  // Look for existing insight for the latest SMS
  let insight_text = "새로운 장애 SMS 분석을 준비하고 있습니다."
  let current_log_id = "SYS-000"
  let timestamp = null

  if (recent_sms) {
    current_log_id = `KMS-${recent_sms.inc_id}`
    timestamp = recent_sms.timestamp
    const insight = await db.prepare("SELECT content FROM autopilot_insight WHERE inc_id = ?").bind(recent_sms.inc_id).first()
    if (insight) {
      insight_text = insight.content
    } else {
      insight_text = `🔍 [Insight] SMS 분석 대기 중: '${recent_sms.message.substring(0,30)}...'`
    }
  }

  return c.json({
    status: 'active',
    prediction_counts,
    recent_sms: recent_sms ? {
      inc_id: recent_sms.inc_id,
      message: recent_sms.message,
      timestamp: recent_sms.timestamp
    } : null,
    current_log: {
      id: current_log_id,
      type: 'warning',
      category: 'server',
      severity: 'high',
      text: insight_text,
      detail: timestamp ? `시간: ${timestamp}` : ""
    }
  })
})

app.get('/ai/insight/:id', async (c) => {
  const id = c.req.param('id')
  const db = c.env.DB
  const insight = await db.prepare("SELECT * FROM autopilot_insight WHERE inc_id = ?").bind(id).first()
  if (!insight) return c.json({ error: "Insight not found" }, 404)
  return c.json({ 
    content: insight.content, 
    severity: insight.severity, 
    category: insight.category 
  })
})

app.post('/ai/insight/save', async (c) => {
  const { incident_id, content, severity, category, user_id } = await c.req.json()
  const db = c.env.DB
  const now = getKst()
  await db.prepare(`
    INSERT OR REPLACE INTO autopilot_insight (inc_id, content, severity, category, reg_id, reg_dt, mod_id, mod_dt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(incident_id, content, severity, category, user_id || 'SYSTEM', now, user_id || 'SYSTEM', now).run()
  return c.json({ status: 'saved' })
})

app.post('/ai/chat', async (c) => {
  const { query } = await c.req.json()
  const api_key = c.env.DIFY_API_KEY_AGENT || c.env.DIFY_API_KEY
  const api_base = c.env.DIFY_API_BASE || 'https://api.dify.ai/v1'

  if (!api_key) {
    return c.json({ response: "DIFY_API_KEY_AGENT가 설정되지 않았습니다." })
  }

  const payload = {
    inputs: {},
    query: query,
    response_mode: "blocking",
    conversation_id: "",
    user: "sguard-worker"
  }

  try {
    const difyRes = await fetch(`${api_base}/chat-messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${api_key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const data = await difyRes.json()
    return c.json({ response: data.answer || "응답이 없습니다." })
  } catch (e) {
    return c.json({ response: `Dify API 오류: ${e.message}` })
  }
})

app.post('/ai/analyze-sms', async (c) => {
  const { sender, message, sms_id } = await c.req.json()
  const db = c.env.DB
  const api_key = c.env.DIFY_API_KEY_AGENT || c.env.DIFY_API_KEY
  const api_base = c.env.DIFY_API_BASE || 'https://api.dify.ai/v1'

  if (!api_key) return c.json({ error: "DIFY_API_KEY_AGENT가 설정되지 않았습니다." }, 500)

  // Fetch full details if sms_id is provided
  let detailedInfo = ""
  if (sms_id) {
    const sms = await db.prepare("SELECT * FROM received_messages WHERE inc_id = ?").bind(sms_id).first()
    if (sms) {
      detailedInfo = `
[장애 상세 정보]
- 유입채널: ${sms.channel || 'N/A'}
- IF아이디: ${sms.if_id || 'N/A'}
- 서비스명: ${sms.service_name || 'N/A'} (${sms.service_code || 'N/A'})
- 업무시스템: ${sms.biz_system || 'N/A'}
- 에러코드: ${sms.error_code || 'N/A'}
- 에러메시지: ${sms.error_message || 'N/A'}
- 발생건수: ${sms.occurrence_count || '1'}
- 발생서버/노드: ${sms.occurrence_node || 'N/A'}
- 실제발생시각: ${sms.occurrence_time || 'N/A'}
`
    }
  }

  const prompt = `당신은 S-GUARD 시스템의 핵심 오케스트레이터이자 지능형 관제 엔진입니다. 사용자가 입력하는 SMS 장애 메시지를 분석하여 실시간 인사이트를 제공하고, 전문가 에이전트들과 협업하여 최적의 조치 가이드를 도출합니다.

🛠️ 핵심 관리 영역
- S-Autopilot Insight 에이전트: 수신 문자 분석 및 전문가 4인방 업무 배분, 담당자 자동 할당 역할을 수행합니다.
- AI War-Room Situation Log 에이전트: 워룸 내 타임라인 기록 및 상황 전파 역할을 수행합니다.

👥 전문가 에이전트 페르소나
- Security Agent: 인프라 분석 및 과거 조치 이력 분석 (없을 시 자율 분석)
- DB Agent: 해결 가이드 및 과거 조치 이력 분석 (없을 시 자율 분석)
- DevOps Agent: 앱 배포 이력 및 개발 관점 분석, 과거 조치 이력 분석 (없을 시 자율 분석)
- Leader Agent: 최종 원인 특정 및 조치 가이드 제시 (없을 시 자율 분석)

응답은 반드시 [S-Autopilot Insight], [전문가별 심층 진단], [리더의 최종 조치 가이드] 세 개 섹션으로 구성해 주세요.

"⚠️ 중요: 응답 시간이 지연되지 않도록, 각 전문가의 의견은 핵심만 2~3줄 이내로 아주 짧고 간결하게 작성해."

[장애 로그]
발신자: ${sender}
메시지: ${message}
${detailedInfo}`

  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  const encode = (s) => new TextEncoder().encode(s)

  ;(async () => {
    try {
      const difyRes = await fetch(`${api_base}/chat-messages`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${api_key}`, 
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify({ 
          inputs: {}, 
          query: prompt, 
          response_mode: 'streaming', 
          user: 'sguard-worker' 
        })
      })

      if (!difyRes.ok) throw new Error(`Dify API error: ${difyRes.status}`)
      
      const reader = difyRes.body.getReader()
      const decoder = new TextDecoder()
      let lineBuffer = ""
      
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        lineBuffer += decoder.decode(value, { stream: true })
        const lines = lineBuffer.split('\n')
        lineBuffer = lines.pop()
        
        for (const line of lines) {
          const trimmedLine = line.trim()
          if (!trimmedLine.startsWith('data: ')) continue
          
          const dataStr = trimmedLine.substring(6)
          if (dataStr === '[DONE]') continue
          
          try {
            const data = JSON.parse(dataStr)
            if (data.event === 'message' || data.event === 'agent_message') {
              // Send ONLY THE DELTA (data.answer)
              await writer.write(encode(`data: ${JSON.stringify({ answer: data.answer })}\n\n`))
            }
          } catch (e) {
            continue
          }
        }
      }
      await writer.write(encode('data: [DONE]\n\n'))
    } catch (e) {
      console.error('Analyze-SMS error:', e)
      await writer.write(encode(`data: ${JSON.stringify({ error: e.message })}\n\n`))
    } finally {
      await writer.close()
    }
  })()

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*'
    }
  })
})

// Comprehensive AI Report Generation (SSE) - uses all incident data as Dify context
// ==========================================
// DB-Only Report Generation (No Dify)
// ==========================================
app.post('/ai/generate-report', async (c) => {
  const { incident_id } = await c.req.json()
  const db = c.env.DB

  if (!incident_id) return c.json({ error: 'incident_id is required' }, 400)
  
  // Frontend mostly passes "INC-12345678", but DB stores raw numbers.
  const rawId = incident_id.startsWith('INC-') ? incident_id.slice(4) : incident_id;

  // ────────────────────────────────────────────────────
  // 1. 모든 테이블 JOIN 조회
  // ────────────────────────────────────────────────────
  const [wr, sms, insight] = await Promise.all([
    db.prepare("SELECT * FROM warroom_list WHERE inc_id = ?").bind(rawId).first(),
    db.prepare("SELECT * FROM received_messages WHERE inc_id = ?").bind(rawId).first(),
    db.prepare("SELECT content, severity, category FROM autopilot_insight WHERE inc_id = ?").bind(rawId).first(),
  ])

  const [{ results: agentLogs }, { results: chatLogs }, { results: attachments }] = await Promise.all([
    db.prepare("SELECT agent_role, content, reg_dt FROM aichat_history WHERE inc_id = ? ORDER BY id ASC").bind(rawId).all(),
    db.prepare("SELECT sender, role, type, text, timestamp FROM warroom_chats WHERE inc_id = ? ORDER BY timestamp ASC").bind(rawId).all(),
    db.prepare("SELECT original_name, file_type, url, uploaded_by, timestamp FROM warroom_attachments WHERE inc_id = ? ORDER BY seq ASC").bind(rawId).all(),
  ])

  // ────────────────────────────────────────────────────
  // 2. 데이터 추출
  // ────────────────────────────────────────────────────
  const title     = wr?.title || incident_id
  const severity  = wr?.severity || 'NORMAL'
  const status    = wr?.status || '-'
  const creator   = wr?.creator_id || '-'
  const createdAt = wr?.reg_dt || '-'
  const smsMsg    = sms ? `발신자: ${sms.sender}\n메시지: ${sms.message}` : '(SMS 정보 없음)'
  const insightTxt = insight?.content || ''

  const userChats = (chatLogs || []).filter(m => m.type !== 'system')
  const systemChats = (chatLogs || []).filter(m => m.type === 'system')
  const firstEvent = systemChats[0]?.timestamp || chatLogs[0]?.timestamp || createdAt
  const lastEvent  = chatLogs[chatLogs.length - 1]?.timestamp || createdAt
  const durationMin = firstEvent && lastEvent
    ? Math.max(0, Math.round((new Date(lastEvent) - new Date(firstEvent)) / 60000))
    : 0

  // 에이전트별 분석
  const agentMap = {}
  for (const log of (agentLogs || [])) {
    if (!agentMap[log.agent_role]) agentMap[log.agent_role] = []
    agentMap[log.agent_role].push(log.content)
  }
  const agentSection = Object.entries(agentMap).map(([role, contents]) =>
    `### 🤖 ${role} Agent\n${contents.join('\n').slice(0, 600)}`
  ).join('\n\n')

  // 채팅 타임라인
  const chatTimeline = userChats.slice(0, 30).map(m =>
    `- \`[${(m.timestamp || '').slice(11, 16)}]\` **${m.sender}**: ${m.text?.slice(0, 120) || ''}`
  ).join('\n')

  // 첨부파일
  const attachSection = (attachments || []).length > 0
    ? (attachments || []).map(a => `- 📎 ${a.original_name} (${a.file_type || '-'}) — ${a.uploaded_by || '-'}`).join('\n')
    : '(첨부파일 없음)'

  // Insight 요약 (처음 500자)
  const insightSummary = insightTxt
    ? insightTxt.slice(0, 500) + (insightTxt.length > 500 ? '...' : '')
    : '(S-Autopilot 분석 없음)'

  // 리더 요약
  const leaderTxt = (agentMap['Leader'] || []).join('\n').slice(0, 400)

  // ────────────────────────────────────────────────────
  // 3. 마크다운 보고서 생성
  // ────────────────────────────────────────────────────
  const severityEmoji = { CRITICAL: '🔴', HIGH: '🟠', NORMAL: '🟡', INFO: '🟢' }[severity] || '⚪'
  const report = `# 🚨 S-GUARD 장애 조치 결과 보고서

> **장애 ID:** ${incident_id}  
> **생성 일시:** ${getKst()}  
> **상태:** ${status}

---

## 1. 장애 개요 (Incident Overview)

| 항목 | 내용 |
|------|------|
| **심각도** | ${severityEmoji} ${severity} |
| **발생 일시** | ${createdAt} |
| **담당자** | ${creator} |
| **대상 시스템** | ${title.split('|').slice(-1)[0]?.trim() || title} |
| **총 대응 시간** | 약 ${durationMin}분 |
| **채팅 메시지** | ${userChats.length}건 |
| **첨부파일** | ${(attachments || []).length}건 |

### 📱 최초 수신 SMS
\`\`\`
${smsMsg}
\`\`\`

---

## 2. S-Autopilot AI 분석 요약

${insightSummary}

---

## 3. AI 에이전트별 심층 분석

${agentSection || '(에이전트 분석 없음)'}

---

## 4. War-Room 대응 타임라인

${chatTimeline || '(대화 기록 없음)'}

---

## 5. 종합 조치 결과 (Leader Agent 요약)

${leaderTxt || '(요약 없음)'}

---

## 6. 첨부 자료

${attachSection}

---

## 7. 재발 방지 권고사항

${insightTxt ? `S-Autopilot 분석 기반 재발 방지 포인트:

${insightTxt.includes('재발') 
  ? insightTxt.split('\n').filter(l => l.includes('재발') || l.includes('방지') || l.includes('모니터') || l.includes('개선')).slice(0, 5).join('\n') || '- 상세 내용은 에이전트 로그를 참조하세요.'
  : '- 장애 원인 분석을 기반으로 재발 방지 대책을 수립하세요.\n- 주기적인 모니터링 강화 및 알림 임계값 검토를 권장합니다.'}` 
: '- 장애 데이터 부족으로 자동 권고 생략. 담당자 메모를 참조하세요.'}

---

*본 보고서는 S-GUARD 시스템이 sguard_db의 데이터를 자동 집계하여 생성하였습니다.*
`

  // ────────────────────────────────────────────────────
  // 4. SSE 스트리밍 (타자 효과)
  // ────────────────────────────────────────────────────
  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  const encode = (s) => new TextEncoder().encode(s)

  ;(async () => {
    try {
      // Use Array.from to correctly slice surrogate pairs (Emojis, Korean characters) without splitting them.
      const chars = Array.from(report);
      const chunkSize = 40;
      for (let i = 0; i < chars.length; i += chunkSize) {
        const chunk = chars.slice(i, i + chunkSize).join('');
        await writer.write(encode(`data: ${JSON.stringify({ answer: chunk })}\n\n`));
      }
      await writer.write(encode('data: [DONE]\n\n'))
    } catch (e) {
      await writer.write(encode(`data: ${JSON.stringify({ error: e.message })}\n\n`))
    } finally {
      await writer.close()
    }
  })()

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*'
    }
  })
})


// AI Agent Discussion (SSE) - called when user clicks an SMS
app.get('/ai/agent-discussion/:id', async (c) => {
  const id = c.req.param('id')
  const db = c.env.DB
  const api_key = c.env.DIFY_API_KEY_AGENT || c.env.DIFY_API_KEY
  const api_base = c.env.DIFY_API_BASE || 'https://api.dify.ai/v1'

  const sms = await db.prepare("SELECT * FROM received_messages WHERE inc_id = ?").bind(id).first()
  if (!sms) {
    return c.json({ error: "SMS not found" }, 404)
  }

  const prompt = `다음 SMS 장애 메시지와 상세 정보를 분석하여 담당 에이전트별로 대응 방안을 알려주세요:

발신자: ${sms.sender}
메시지: ${sms.message}

[장애 상세 정보]
- 유입채널: ${sms.channel || 'N/A'}
- IF아이디: ${sms.if_id || 'N/A'}
- 서비스명: ${sms.service_name || 'N/A'} (${sms.service_code || 'N/A'})
- 업무시스템: ${sms.biz_system || 'N/A'}
- 에러코드: ${sms.error_code || 'N/A'}
- 에러메시지: ${sms.error_message || 'N/A'}
- 발생건수: ${sms.occurrence_count || '1'}
- 발생서버/노드: ${sms.occurrence_node || 'N/A'}
- 실제발생시각: ${sms.occurrence_time || 'N/A'}

[Security]: 보안 관점 분석
[DB]: 데이터베이스 관점 분석
[DevOps]: 서버/인프라 관점 분석
[Leader]: 종합 의견 및 조치사항`

  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  const encode = (s) => new TextEncoder().encode(s)

  // Start Dify call in background
  ;(async () => {
    try {
      const difyRes = await fetch(`${api_base}/chat-messages`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${api_key}`, 
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify({ 
          inputs: {}, 
          query: prompt, 
          response_mode: 'streaming', 
          conversation_id: '', 
          user: 'sguard-agent' 
        })
      })

      if (!difyRes.ok) throw new Error(`Dify API error: ${difyRes.status}`)
      
      const reader = difyRes.body.getReader()
      const decoder = new TextDecoder()
      let lineBuffer = ""
      
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        lineBuffer += decoder.decode(value, { stream: true })
        const lines = lineBuffer.split('\n')
        lineBuffer = lines.pop()
        
        for (const line of lines) {
          const trimmedLine = line.trim()
          if (!trimmedLine.startsWith('data: ')) continue
          
          const dataStr = trimmedLine.substring(6)
          if (dataStr === '[DONE]') continue
          
          try {
            const data = JSON.parse(dataStr)
            if (data.event === 'message' || data.event === 'agent_message') {
              // Send ONLY THE DELTA
              await writer.write(encode(`data: ${JSON.stringify({ answer: data.answer })}\n\n`))
            }
          } catch (e) {
            continue
          }
        }
      }
      await writer.write(encode('data: [DONE]\n\n'))
    } catch (e) {
      console.error('Dify Stream Error:', e)
      const fallback = `[Security]: SMS 장애 분석 중입니다. 상세 분석 결과가 곧 업데이트됩니다.\n[DB]: 데이터베이스 연결 상태 및 쿼리 성능 점검 중입니다.\n[DevOps]: 서버 로그 및 인프라 매트릭(CPU/MEM)을 실시간 분석 중입니다.\n[Leader]: 전체 상황 파악 후 즉시 조치 가이드를 공유하겠습니다.`
      await writer.write(encode(`data: ${JSON.stringify({ answer: fallback })}\n\n`))
      await writer.write(encode('data: [DONE]\n\n'))
    } finally {
      await writer.close()
    }
  })()

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*'
    }
  })
})

// Chat history (autopilot insight save/load)
// Chat history (AI Agent Discussion)
app.get('/ai/chat-history/:id', async (c) => {
  const id = c.req.param('id')
  const db = c.env.DB
  // Try aichat_history first
  const { results: aiResults } = await db.prepare("SELECT * FROM aichat_history WHERE inc_id = ? ORDER BY id ASC").bind(id).all()
  if (aiResults && aiResults.length > 0) {
    return c.json({ messages: aiResults.map(r => ({ role: r.agent_role, text: r.content })) })
  }
  
  // Fallback to warroom_chats (legacy)
  const { results: wrResults } = await db.prepare("SELECT * FROM warroom_chats WHERE inc_id = ? ORDER BY timestamp ASC").bind(id).all()
  const messages = wrResults.map(r => ({ role: r.role || r.sender, text: r.text }))
  return c.json({ messages })
})

app.post('/ai/chat-history/save', async (c) => {
  const { incident_id, messages } = await c.req.json()
  console.log(`Saving chat history for incident: ${incident_id}, count: ${messages?.length}`);
  const db = c.env.DB
  const now = getKst()
  
  for (const msg of messages) {
    // Insert into aichat_history
    await db.prepare(`
      INSERT INTO aichat_history (inc_id, agent_role, content, reg_id, reg_dt, mod_id, mod_dt)
      VALUES (?, ?, ?, 'SYSTEM', ?, 'SYSTEM', ?)
    `).bind(incident_id, msg.role, msg.text, now, now)
    .run()
  }
  return c.json({ status: 'saved', count: messages.length })
})

// War-Room Tracking
app.get('/ai/warroom/list', async (c) => {
  const db = c.env.DB
  const { results } = await db.prepare("SELECT * FROM warroom_list ORDER BY reg_dt DESC").all()
  return c.json({ results })
})

app.get('/warroom/search', async (c) => {
  const q = c.req.query('q')
  const db = c.env.DB
  const searchQuery = `%${q}%`
  const { results } = await db.prepare(`
    SELECT * FROM incidents 
    WHERE title LIKE ? OR description LIKE ? OR inc_id LIKE ?
    ORDER BY created_at DESC
  `).bind(searchQuery, searchQuery, searchQuery).all()
  return c.json({ total: results.length, rooms: results })
})

app.post('/ai/warroom/open', async (c) => {
  const { inc_id, title, creator_id, severity, leader_summary } = await c.req.json()
  const db = c.env.DB
  const now = getKst()
  
  const normId = String(inc_id).replace('INC-', '');

  // Prevent duplicate creation
  const existing = await db.prepare("SELECT inc_id FROM warroom_list WHERE inc_id = ?").bind(normId).first()
  if (!existing) {
    await db.prepare(`
      INSERT INTO warroom_list (inc_id, title, creator_id, severity, leader_summary, reg_dt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(normId, title, creator_id, severity, leader_summary || '', now)
    .run()
  } else if (leader_summary) {
    await db.prepare("UPDATE warroom_list SET leader_summary = ?, mod_dt = ? WHERE inc_id = ?")
      .bind(leader_summary, now, normId).run()
  }

  // Auto-assign to the creator and anyone already assigned to this incident
  if (creator_id) {
    await db.prepare("INSERT INTO user_warrooms (user_id, inc_id, joined_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING")
      .bind(creator_id, normId, now).run()
    
    // Update assignment status to '처리중' for all assignees of this incident
    await db.prepare("UPDATE incident_assignments SET status = '처리중', updated_at = ? WHERE inc_id = ?")
      .bind(now, normId).run()
  }
  
  return c.json({ status: 'opened', inc_id: normId })
})

app.post('/ai/report/save', async (c) => {
  const { inc_id, title, content, user_id } = await c.req.json()
  const db = c.env.DB
  const now = getKst()
  
  const normId = String(inc_id).replace('INC-', '');
  // 1. Log activity
  const empId = user_id // user_id is now already the employee_id
  const nowReport = getKst()

  await db.prepare("INSERT INTO activity_logs (inc_id, incident_code, user_id, action, detail, report_type, created_at) VALUES (?, ?, ?, '보고서 생성', ?, 'AI 리포트', ?)")
    .bind(normId, normId, empId, `리포트 생성됨: ${title}`, nowReport)
    .run()

  // 2. Insert into reports table [NEW]
  await db.prepare("INSERT INTO reports (inc_id, user_id, title, content, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(normId, user_id || null, title || '보고서', content, now)
    .run()

  // Auto-update assignment status to '처리완료'
  if (inc_id && user_id) {
    await db.prepare("UPDATE incident_assignments SET status = '처리완료', updated_at = ? WHERE user_id = ? AND inc_id = ?")
      .bind(now, user_id, normId).run()
  }

  return c.json({ status: 'saved' })
})

// ==========================================
// Aggregated Report Data for a given inc_id
// ==========================================
app.get('/warroom/report/:id', async (c) => {
  const idParam = c.req.param('id')
  const db = c.env.DB

  const id = idParam.startsWith('INC-') ? idParam.slice(4) : idParam;

  // 1. War-Room base info
  const wr = await db.prepare("SELECT * FROM warroom_list WHERE inc_id = ?").bind(id).first()
  if (!wr) return c.json({ error: 'War-Room not found' }, 404)

  // 2. S-Autopilot Insight (full AI analysis)
  const insight = await db.prepare("SELECT content, severity, category FROM autopilot_insight WHERE inc_id = ?").bind(id).first()

  // 3. AI Agent Discussion log (aichat_history)
  const { results: agentLogs } = await db.prepare(
    "SELECT agent_role, content, reg_dt FROM aichat_history WHERE inc_id = ? ORDER BY id ASC"
  ).bind(id).all()

  // 4. War-Room chat history
  const { results: chatLogs } = await db.prepare(
    "SELECT sender, role, type, text, timestamp FROM warroom_chats WHERE inc_id = ? ORDER BY timestamp ASC"
  ).bind(id).all()

  // 5. Attachments
  const { results: attachments } = await db.prepare(
    "SELECT original_name, file_type, url, uploaded_by, timestamp FROM warroom_attachments WHERE inc_id = ? ORDER BY seq ASC"
  ).bind(id).all()

  // 6. Find leader summary (from warroom_list first, fallback to aichat_history)
  const leaderRow = (agentLogs || []).find(r => r.agent_role === 'Leader')
  const leaderSummary = (wr.leader_summary && wr.leader_summary.trim()) 
    ? wr.leader_summary 
    : (leaderRow ? leaderRow.content : '')

  // 7. Derive 6W1H fields from available data
  const insightText = insight ? insight.content : ''
  const agentText = (agentLogs || []).map(r => `[${r.agent_role}]\n${r.content}`).join('\n\n')
  const combinedAnalysis = (leaderSummary || insightText || agentText || '').slice(0, 4000)

  // Extract metadata
  const firstChat = (chatLogs || [])[0]
  const lastChat = (chatLogs || []).slice(-1)[0]

  return c.json({
    inc_id: id,
    title: wr.title || id,
    severity: wr.severity || 'NORMAL',
    status: wr.status || 'OPEN',
    creator_id: wr.creator_id || '',
    created_at: wr.reg_dt || '',

    // Summary fields
    leader_summary: leaderSummary,
    autopilot_insight: insightText,
    ai_analysis: combinedAnalysis,

    // 6W1H - derived from available data
    who: wr.creator_id || '-',
    when: wr.reg_dt || '-',
    where: (wr.title || '').split('|').slice(-1)[0]?.trim() || '-',
    what: wr.title || '-',
    why: insightText ? insightText.slice(0, 300) : '-',
    how: leaderSummary ? leaderSummary.slice(0, 500) : '-',

    // Related records
    agent_logs: agentLogs || [],
    chat_logs: chatLogs || [],
    attachments: attachments || [],
    
    // Stats
    message_count: (chatLogs || []).length,
    attachment_count: (attachments || []).length,
    duration_min: firstChat && lastChat
      ? Math.round((new Date(lastChat.timestamp) - new Date(firstChat.timestamp)) / 60000) 
      : 0,
  })
})

app.get('/warroom/participants/:id', async (c) => {
  const id = c.req.param('id')
  const db = c.env.DB
  const normId = String(id).replace('INC-', '')
  const { results } = await db.prepare(`
    SELECT u.name, u.employee_id, u.role, u.company, u.position
    FROM user_warrooms uw
    JOIN users u ON (uw.user_id = u.employee_id OR uw.user_id = CAST(u.id AS TEXT))
    WHERE uw.inc_id = ? OR uw.inc_id = ?
  `).bind(normId, id).all()
  return c.json({ participants: results || [] })
})

app.post('/warroom/join', async (c) => {
  const { incident_id, user_id } = await c.req.json()
  const db = c.env.DB
  const normId = String(incident_id).replace('INC-', '')
  
  if (!user_id || !incident_id) {
    return c.json({ status: 'error', message: 'user_id and incident_id are required' }, 400)
  }

  const now = getKst()
  await db.prepare("INSERT INTO user_warrooms (user_id, inc_id, joined_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING")
    .bind(user_id, normId, now).run()
    
  return c.json({ status: 'joined' })
})

// Knowledge Base CRUD
app.get('/ai/knowledge', async (c) => {
  const db = c.env.DB
  const { results } = await db.prepare("SELECT * FROM knowledge_base ORDER BY reg_dt DESC").all()
  return c.json({ results })
})

app.get('/ai/knowledge/:id', async (c) => {
  const id = c.req.param('id')
  const db = c.env.DB
  const result = await db.prepare("SELECT * FROM knowledge_base WHERE id = ?").bind(id).first()
  if (!result) return c.json({ error: "Not found" }, 404)
  return c.json(result)
})

app.post('/ai/knowledge/save', async (c) => {
  const body = await c.req.json()
  const db = c.env.DB
  const now = getKst()
  const user_id = body.user_id || 'SYSTEM'
  
  // Generate embedding if content is provided
  const embedding = body.content ? await generateEmbedding(body.content, c.env) : null;
  const embeddingValue = embedding ? new Float32Array(embedding) : null;
  
  if (body.content && !embedding) {
    return c.json({ error: "Embedding generation failed" }, 500);
  }

  if (body.id) {
    // Update
    await db.prepare(`
      UPDATE knowledge_base 
      SET inc_id = ?, title = ?, content = ?, category = ?, file_url = ?, file_type = ?, tags = ?, mod_id = ?, mod_dt = ?, vector = ?
      WHERE id = ?
    `).bind(
      body.inc_id || null, body.title, body.content || null, body.category || null, 
      body.file_url || null, body.file_type || null, body.tags || null, 
      user_id, now, embeddingValue, body.id
    ).run()

    // Log the knowledge activity
    if (body.inc_id) {
        const user = await db.prepare("SELECT employee_id FROM users WHERE id = ? OR employee_id = ?").bind(user_id, String(user_id)).first()
        const empId = user ? user.employee_id : user_id
        await db.prepare("INSERT INTO activity_logs (inc_id, incident_code, user_id, action, detail, created_at) VALUES (?, ?, ?, '지식화 완료', '장애 대응 리포트가 지식베이스에 저장되었습니다.', ?)")
        .bind(String(body.inc_id).replace('INC-', ''), String(body.inc_id).replace('INC-', ''), empId, getKst())
        .run()
    }

    return c.json({ status: 'updated', id: body.id })
  } else {
    // Create
    const result = await db.prepare(`
      INSERT INTO knowledge_base (inc_id, title, content, category, file_url, file_type, tags, reg_id, reg_dt, mod_id, mod_dt, vector)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      body.inc_id || null, body.title, body.content || null, body.category || null, 
      body.file_url || null, body.file_type || null, body.tags || null, 
      user_id, now, user_id, now, embeddingValue
    ).run()

    // Log the knowledge activity
    if (body.inc_id) {
        const user = await db.prepare("SELECT employee_id FROM users WHERE id = ? OR employee_id = ?").bind(user_id, String(user_id)).first()
        const empId = user ? user.employee_id : user_id
        await db.prepare("INSERT INTO activity_logs (inc_id, incident_code, user_id, action, detail, created_at) VALUES (?, ?, ?, '지식화 완료', '장애 대응 리포트가 지식베이스에 저장되었습니다.', ?)")
        .bind(String(body.inc_id).replace('INC-', ''), String(body.inc_id).replace('INC-', ''), empId, getKst())
        .run()
    }

    return c.json({ status: 'created', id: result.meta.last_row_id })
  }
})

app.post('/ai/warroom/close', async (c) => {
  const { inc_id, user_id } = await c.req.json()
  const db = c.env.DB
  const now = getKst()
  
  const normId = String(inc_id).replace('INC-', '');
  await db.prepare("UPDATE warroom_list SET status = 'CLOSED', mod_dt = ? WHERE inc_id = ?")
    .bind(now, normId).run()
    
  // Log termination
  await db.prepare("INSERT INTO activity_logs (inc_id, incident_code, user_id, action, detail, created_at) VALUES (?, ?, ?, '워룸 종료', '워룸이 종료되고 인시던트 처리가 완료되었습니다.', ?)")
    .bind(normId, normId, user_id, getKst())
    .run()
    
  return c.json({ status: 'closed' })
})

// ==========================================
// 6. Incident Assignments
// ==========================================

app.post('/ai/incident/assign', async (c) => {
  const { user_id, inc_id, action, detail, incident_title } = await c.req.json() // Added action, detail, incident_title for logging
  const db = c.env.DB
  const now = getKst()

  const normId = String(inc_id).replace('INC-', '');
  try {
    await db.prepare(`
      INSERT INTO incident_assignments (user_id, inc_id, status, assigned_at, updated_at)
      VALUES (?, ?, '미확인', ?, ?)
      ON CONFLICT(user_id, inc_id) DO NOTHING
    `).bind(user_id, normId, now, now).run()

    // Log the assignment activity
    const logId = generateIncId()
    const empId = user_id // already employee_id

    await db.prepare("INSERT INTO activity_logs (inc_id, incident_code, incident_title, user_id, action, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(normId, normId, incident_title || 'SMS 수신 확인', empId, action || '장애 할당', detail || '인시던트가 담당자에게 할당되었습니다.', getKst())
      .run()
    
    return c.json({ status: 'assigned', user_id, inc_id: normId, log_id: logId })

  } catch (e) {
    return c.json({ error: e.message }, 500)
  }
})

app.post('/ai/incident/status', async (c) => {
  const { user_id, inc_id, status } = await c.req.json()
  const db = c.env.DB
  const now = getKst()
  const normId = String(inc_id).replace('INC-', '');

  await db.prepare(`
    UPDATE incident_assignments 
    SET status = ?, updated_at = ?
    WHERE user_id = ? AND inc_id = ?
  `).bind(status, now, user_id, normId).run()
  
  return c.json({ status: 'updated', user_id, inc_id: normId, new_status: status })
})

// ── 인시던트 관련 상세 라우트 (와일드카드 :inc_id 보다 먼저 정의되어야 함) ──

// 1. 나의 할당 목록 (Shadowing 방지를 위해 위로 이동)
app.get('/ai/incident/my-assignments', async (c) => {
  const user_id = c.req.query('user_id')
  const fromDate = c.req.query('from') // YYYY-MM-DD
  const toDate = c.req.query('to')     // YYYY-MM-DD

  if (!user_id) return c.json({ assignments: [] })
  
  const db = c.env.DB
  let query = `
    SELECT 
      a.id, a.user_id, a.inc_id, a.assigned_at, a.updated_at,
      CASE 
        WHEN a.status = '처리완료' THEN '처리완료'
        WHEN w.inc_id IS NOT NULL THEN '처리중'
        ELSE a.status
      END as status,
      m.sender, m.message, m.employee_id, m.timestamp as message_at, m.received_count,
      (SELECT GROUP_CONCAT(u2.name, ', ') 
       FROM incident_assignments a2 
       JOIN users u2 ON a2.user_id = u2.employee_id 
       WHERE a2.inc_id = a.inc_id OR REPLACE(a2.inc_id, 'INC-', '') = a.inc_id) as assignees
    FROM incident_assignments a
    LEFT JOIN received_messages m ON (a.inc_id = m.inc_id OR REPLACE(a.inc_id, 'INC-', '') = m.inc_id)
    LEFT JOIN warroom_list w ON (a.inc_id = w.inc_id OR REPLACE(a.inc_id, 'INC-', '') = w.inc_id)
    WHERE a.user_id = ?
  `
  const params = [user_id]

  if (fromDate) {
    query += " AND a.assigned_at >= ?"
    params.push(fromDate + " 00:00:00")
  }
  if (toDate) {
    query += " AND a.assigned_at <= ?"
    params.push(toDate + " 23:59:59")
  }

  query += " ORDER BY a.assigned_at DESC"
  
  const { results } = await db.prepare(query).bind(...params).all()
  
  return c.json({ total: results.length, assignments: results })
})


// 2. 워룸 관리 및 인시던트 연동 라우트


app.get('/ai/incident/workflow-details', async (c) => {
  const inc_id_param = c.req.query('inc_id')
  if (!inc_id_param) return c.json({ error: 'inc_id required' }, 400)
  const db = c.env.DB

  const inc_id_str = String(inc_id_param);
  const id = inc_id_str.startsWith('INC-') ? inc_id_str.slice(4) : inc_id_str;

  // Aggregate steps from various tables
  const steps = [];

  try {
    // 1. SMS 수신 (received_messages)
    const sms = await db.prepare("SELECT timestamp FROM received_messages WHERE CAST(inc_id AS TEXT) = ?").bind(id).first();
    if (sms) steps.push({ id: 'SMS', label: 'SMS 수신 및 장애 인지', timestamp: sms.timestamp, detail: '시스템에 장애 메시지가 수신되었습니다.' });

    // 2. RAG 분석 완료 (autopilot_insight)
    const rag = await db.prepare("SELECT reg_dt FROM autopilot_insight WHERE inc_id = ?").bind(id).first();
    if (rag) steps.push({ id: 'RAG', label: 'RAG 분석 완료', timestamp: rag.reg_dt, detail: 'AI 엔진이 과거 사례 및 지식베이스를 바탕으로 초기 분석을 마쳤습니다.' });

    // 3. AI AGENT 분석 완료 (same as RAG)
    if (rag) steps.push({ id: 'AGENT', label: 'AI AGENT 분석 완료', timestamp: rag.reg_dt, detail: '에이전트 그룹의 심층 분석이 완료되었습니다.' });

    // 4. 워룸 생성 (warroom_list JOIN users with extreme robustness)
    const wr = await db.prepare(`
      SELECT 
        w.reg_dt, 
        w.creator_id, 
        w.status, 
        u.name as creator_name
      FROM warroom_list w
      LEFT JOIN users u ON (
        TRIM(CAST(w.creator_id AS TEXT)) = TRIM(CAST(u.employee_id AS TEXT)) OR
        TRIM(CAST(w.creator_id AS TEXT)) = TRIM(REPLACE(REPLACE(CAST(u.employee_id AS TEXT), 'EMP-', ''), 'SH-', '')) OR
        w.creator_id = u.id OR
        w.creator_id = u.email
      )
      WHERE w.inc_id = ? OR REPLACE(w.inc_id, 'INC-', '') = ?
      LIMIT 1
    `).bind(id, id).first();
    
    if (wr) {
      let dispName = wr.creator_name;
      // Secondary fallback lookup if JOIN failed
      if (!dispName && wr.creator_id) {
        const uNode = await db.prepare("SELECT name FROM users WHERE employee_id = ? OR id = ? OR email = ?")
          .bind(wr.creator_id, wr.creator_id, wr.creator_id).first();
        if (uNode) dispName = uNode.name;
      }
      
      steps.push({ 
        id: 'WARROOM', 
        label: '워룸 생성', 
        timestamp: wr.reg_dt, 
        detail: `${dispName || wr.creator_id || '시스템'}님에 의해 실시간 대응 워룸이 가동되었습니다.` 
      });
    }

    // 5. 보고서 생성완료 (reports)
    const repo = await db.prepare("SELECT created_at FROM reports WHERE inc_id = ?").bind(id).first();
    if (repo) steps.push({ id: 'REPORT', label: '보고서 생성완료', timestamp: repo.created_at, detail: '워룸 내 대응 전략을 바탕으로 최종 AI 리포트가 생성되었습니다.' });

    // 6. 지식화 및 보고완료 (knowledge_base)
    const kn = await db.prepare("SELECT reg_dt FROM knowledge_base WHERE inc_id = ?").bind(id).first();
    if (kn) steps.push({ id: 'KNOWLEDGE', label: '지식화 및 보고완료', timestamp: kn.reg_dt, detail: '확보된 대응 지식이 지식베이스(RAG)에 저장되고 최종 보고가 수립되었습니다.' });

    // 7. 워룸종료 및 장애처리완료 (warroom_list CLOSED)
    const wrClose = await db.prepare("SELECT mod_dt FROM warroom_list WHERE inc_id = ? AND status = 'CLOSED'").bind(id).first();
    if (wrClose) steps.push({ id: 'CLOSE', label: '워룸종료 및 장애처리완료', timestamp: wrClose.mod_dt, detail: '인시던트 대응 활동이 종료되었습니다.' });

    // Use activity_logs as a fallback
    const logs = await db.prepare("SELECT action, created_at, detail FROM activity_logs WHERE incident_code = ? ORDER BY created_at ASC").bind(id).all();

    return c.json({ inc_id: inc_id_str, steps: steps.sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp)), all_logs: logs.results || [] });
  } catch (e) {
    console.error('Workflow API Error:', e);
    return c.json({ error: e.message, stack: e.stack }, 500);
  }
})

// 3. 특정 인시던트 상세 (와일드카드 - 가장 마지막에 정의)
app.get('/ai/incident/:inc_id', async (c) => {
  const inc_id = c.req.param('inc_id')
  const db = c.env.DB
  const incident = await db.prepare(`
    SELECT i.*, u.name as assignee_name 
    FROM incidents i 
    LEFT JOIN users u ON i.assigned_to = u.employee_id 
    WHERE i.inc_id = ?
  `).bind(inc_id).first()
  if (!incident) return c.json({ error: "Not found" }, 404)
  return c.json({ incident })
})


// User Specific War-Room mapping
app.post('/ai/warroom/leave', async (c) => {
  const { user_id, inc_id } = await c.req.json()
  await c.env.DB.prepare("DELETE FROM user_warrooms WHERE user_id = ? AND inc_id = ?")
    .bind(user_id, String(inc_id)).run()
  return c.json({ status: 'left', user_id, inc_id })
})

app.post('/ai/warroom/invite', async (c) => {
  const { user_id, inc_id } = await c.req.json()
  const now = getKst()
  await c.env.DB.prepare("INSERT INTO user_warrooms (user_id, inc_id, joined_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING")
    .bind(user_id, String(inc_id), now).run()
  return c.json({ status: 'invited', user_id, inc_id })
})

app.get('/ai/user/activity-history', async (c) => {
  const user_id = c.req.query('user_id')
  if (!user_id) return c.json({ history: [] })

  const { results } = await c.env.DB.prepare(`
    SELECT l.*, date(l.created_at) as log_date 
    FROM activity_logs l
    LEFT JOIN users u ON l.user_id = u.employee_id
    WHERE l.user_id = ? OR u.id = ?
    ORDER BY l.created_at DESC 
    LIMIT 100
  `).bind(user_id, user_id).all()

  return c.json({ history: results })
})


// RAG Search using Vector Similarity
app.get('/ai/knowledge/search', async (c) => {
  const query = c.req.query('q')
  if (!query) return c.json({ results: [] })
  
  const db = c.env.DB
  const queryVector = await generateEmbedding(query, c.env)
  if (!queryVector) return c.json({ error: "Failed to generate query embedding" }, 500)
  
  // Since D1 native vector distance might not be available, we use a custom SQL logic or simple storage retrieval
  // If native vector is enabled: "SELECT *, VECTOR_DISTANCE(vector, ?, 'cosine') as score FROM knowledge_base ORDER BY score ASC LIMIT 5"
  // For now, we'll implement a robust retrieval that works with JSON storage or native if possible.
  
  try {
    // Using native vector distance (Cosine similarity)
    const { results } = await db.prepare(`
      SELECT id, inc_id, title, content, category, tags,
             VECTOR_DISTANCE(vector, ?, 'cosine') as distance
      FROM knowledge_base 
      WHERE vector IS NOT NULL 
      ORDER BY distance ASC
      LIMIT 10
    `).bind(new Float32Array(queryVector)).all()
    
    const scoredResults = results.map(r => ({
      ...r,
      score: 1 - r.distance // Distance to Similarity
    }))
    
    return c.json({ results: scoredResults })
  } catch (e) {
    // Fallback if VECTOR_DISTANCE is not yet available in the environment
    console.warn('Native vector search failed, falling back:', e.message);
    const { results } = await db.prepare(`
      SELECT id, inc_id, title, content, category, tags
      FROM knowledge_base 
      WHERE vector IS NOT NULL 
      LIMIT 10
    `).all()
    return c.json({ results: results.map(r => ({ ...r, score: 0.99 })) })
  }
})

app.post('/warroom/resolve', async (c) => {
  const { incident_id } = await c.req.json()
  const db = c.env.DB
  await db.prepare("UPDATE incidents SET status = ?, updated_at = ? WHERE inc_id = ?").bind("완료", getKst(), incident_id).run()
  return c.json({ status: "success" })
})

app.post('/warroom/reset', async (c) => {
  const db = c.env.DB
  // Dangerous operation: clear all tables for demo reset
  await db.prepare("DELETE FROM warroom_chats").run()
  await db.prepare("DELETE FROM incidents").run()
  await db.prepare("DELETE FROM activity_logs").run()
  await db.prepare("DELETE FROM received_messages").run()
  await db.prepare("DELETE FROM autopilot_insight").run()
  await db.prepare("DELETE FROM aichat_history").run()
  return c.json({ status: "success", message: "All warroom data has been reset." })
})

app.post('/warroom/feedback', async (c) => {
  const { incident_id, resolution_text, commandsUsed, feedback, user_id } = await c.req.json()
  const db = c.env.DB
  const nowFeedback = getKst()
  const res = await db.prepare(`
    INSERT INTO resolution_feedback (inc_id, resolution_text, commandsUsed, feedback, reg_id, reg_dt)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(incident_id, resolution_text, JSON.stringify(commandsUsed), feedback, user_id, nowFeedback).run()
  return c.json({ status: "success" })
})

// Incidents create
app.post('/incidents', async (c) => {
  const { inc_id, title, description, severity, incident_type, source_sms_id } = await c.req.json()
  const db = c.env.DB
  const existing = await db.prepare("SELECT inc_id FROM incidents WHERE inc_id = ?").bind(inc_id).first()
  if (existing) return c.json({ status: 'exists', inc_id })
  const now = getKst()
  await db.prepare(
    `INSERT INTO incidents (
      inc_id, title, description, severity, status, incident_type, source_sms_id, 
      reg_id, reg_dt, mod_id, mod_dt, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    inc_id, title, description, severity, 'OPEN', incident_type, source_sms_id || null, 
    'SYSTEM', now, 'SYSTEM', now, now
  ).run()
  return c.json({ status: 'created', inc_id })
})

app.patch('/incidents/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const { title, description, severity, status, assigned_to } = await c.req.json()
  const now = getKst()
  await db.prepare(`
    UPDATE incidents 
    SET title = COALESCE(?, title),
        description = COALESCE(?, description),
        severity = COALESCE(?, severity),
        status = COALESCE(?, status),
        assigned_to = COALESCE(?, assigned_to),
        mod_dt = ?
    WHERE inc_id = ?
  `).bind(title || null, description || null, severity || null, status || null, assigned_to || null, now, id).run()
  return c.json({ status: "success" })
})

// Warroom chat list
app.get('/warroom/chat/:id', async (c) => {
  const id = c.req.param('id')
  const db = c.env.DB

  // Always pull title and leader_summary from warroom_list (authoritative source)
  const wr = await db.prepare("SELECT title, status, leader_summary FROM warroom_list WHERE inc_id = ?").bind(id).first()
  let title = (wr && wr.title) ? wr.title : id
  let status = (wr && wr.status) ? wr.status : 'OPEN'
  const leader_summary_db = (wr && wr.leader_summary) ? wr.leader_summary : ''
  let description = leader_summary_db

  // Supplement description from incidents if warroom_list has none
  const inc = await db.prepare("SELECT description, status FROM incidents WHERE inc_id = ?").bind(id).first()
  if (inc) {
    if (!description && inc.description) description = inc.description
    if (inc.status && inc.status !== 'OPEN') status = inc.status
  }

  // Get messages
  const { results: aiResults } = await db.prepare("SELECT * FROM aichat_history WHERE inc_id = ? ORDER BY id ASC").bind(id).all()
  const { results: wrResults } = await db.prepare("SELECT * FROM warroom_chats WHERE inc_id = ? ORDER BY timestamp ASC").bind(id).all()

  // Format AI messages
  const aiMessages = (aiResults || []).map(r => ({
    inc_id: r.id,
    type: 'ai_analysis',
    sender: r.agent_role + ' Agent',
    role: r.agent_role,
    text: r.content,
    timestamp: r.reg_dt
  }));

  // Format Warroom chats
  const chatMessages = (wrResults || []).map(r => ({
    inc_id: r.seq ? `${r.inc_id}_${r.seq}` : r.timestamp,
    type: r.type || 'user',
    sender: r.sender,
    role: r.role,
    text: r.text,
    timestamp: r.timestamp
  }));

  // Extract Leader Agent summary: prefer warroom_list.leader_summary, fallback to aichat_history Leader row
  const wrForSummary = await db.prepare("SELECT leader_summary FROM warroom_list WHERE inc_id = ?").bind(id).first()
  const leaderRow = (aiResults || []).find(r => r.agent_role === 'Leader')
  const leader_summary = (wrForSummary && wrForSummary.leader_summary) || (leaderRow ? leaderRow.content : '')

  // Combine and sort
  const allMessages = [...aiMessages, ...chatMessages].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  return c.json({ title, description, status, leader_summary, messages: allMessages })
})

// Warroom chat post
app.post('/warroom/chat', async (c) => {
  const { incident_id, sender, role, type, text } = await c.req.json()
  const db = c.env.DB
  const now = getKst()
  const senderId = sender || 'anonymous'
  
  const lastRow = await db.prepare("SELECT MAX(seq) as max_seq FROM warroom_chats WHERE inc_id = ?").bind(incident_id).first()
  const seq = (lastRow && lastRow.max_seq) ? lastRow.max_seq + 1 : 1

  await db.prepare(
    "INSERT INTO warroom_chats (inc_id, seq, sender, role, type, text, timestamp, reg_id, reg_dt, mod_id, mod_dt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(incident_id, seq, senderId, role || senderId, type || 'user', text, now, senderId, now, senderId, now).run()
  
  return c.json({ status: 'saved' })
})

// ==========================================
// File Upload → warroom_attachments
// ==========================================
app.post('/warroom/upload', async (c) => {
  const db = c.env.DB
  const kv = c.env.SMS_STORAGE
  const now = getKst()

  let formData
  try {
    formData = await c.req.formData()
  } catch (e) {
    return c.json({ error: 'Invalid form data' }, 400)
  }

  const file = formData.get('file')
  const incident_id = formData.get('incident_id')
  const uploaded_by = formData.get('uploaded_by') || 'Unknown'

  if (!file || !incident_id) {
    return c.json({ error: 'file and incident_id are required' }, 400)
  }

  // Calculate next seq for this inc_id
  const lastRow = await db.prepare(
    "SELECT MAX(seq) as max_seq FROM warroom_attachments WHERE inc_id = ?"
  ).bind(incident_id).first()
  const seq = (lastRow && lastRow.max_seq != null) ? lastRow.max_seq + 1 : 1

  // Store file binary in KV with a unique key
  const fileName = file.name || `file_${Date.now()}`
  const fileKey = `attachment:${incident_id}:${seq}:${fileName}`
  const fileBuffer = await file.arrayBuffer()
  await kv.put(fileKey, fileBuffer, { metadata: { contentType: file.type || 'application/octet-stream' } })

  // Construct a public URL (via GET /warroom/file/:key endpoint)
  const fileUrl = `/warroom/file/${encodeURIComponent(fileKey)}`
  const fileType = file.type || 'application/octet-stream'

  // 1. Save metadata to warroom_attachments
  await db.prepare(`
    INSERT INTO warroom_attachments (inc_id, seq, filename, original_name, file_type, url, uploaded_by, timestamp, reg_id, reg_dt, mod_id, mod_dt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    incident_id, seq, fileKey, fileName,
    fileType,
    fileUrl, uploaded_by,
    now, uploaded_by, now, uploaded_by, now
  ).run()

  // 2. IMPORTANT: ALSO insert into warroom_chats to unify the stream
  // This prevents the "pushed to the end" issue by giving the file a spot in the main chat sequence
  const lastChat = await db.prepare("SELECT MAX(seq) as max_seq FROM warroom_chats WHERE inc_id = ?").bind(incident_id).first()
  const chatSeq = (lastChat && lastChat.max_seq) ? lastChat.max_seq + 1 : 1
  const chatText = `[첨부파일]${fileName}|${fileUrl}|${fileType}`

  await db.prepare(
    "INSERT INTO warroom_chats (inc_id, seq, sender, role, type, text, timestamp, reg_id, reg_dt, mod_id, mod_dt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(incident_id, chatSeq, uploaded_by, 'Unknown', 'user', chatText, now, uploaded_by, now, uploaded_by, now).run()

  return c.json({ status: 'uploaded', seq, url: fileUrl, filename: fileName })
})

// Serve attachment file from KV
app.get('/warroom/file/:key', async (c) => {
  const kv = c.env.SMS_STORAGE
  const key = decodeURIComponent(c.req.param('key'))
  const { value, metadata } = await kv.getWithMetadata(key, 'arrayBuffer')
  if (!value) return c.json({ error: 'File not found' }, 404)
  const contentType = (metadata && metadata.contentType) ? metadata.contentType : 'application/octet-stream'
  return new Response(value, {
    headers: {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=86400'
    }
  })
})

// List attachments for a War-Room
app.get('/warroom/attachments/:id', async (c) => {
  const id = c.req.param('id')
  const db = c.env.DB
  const { results } = await db.prepare(
    "SELECT seq, original_name, file_type, url, uploaded_by, timestamp FROM warroom_attachments WHERE inc_id = ? ORDER BY seq ASC"
  ).bind(id).all()
  return c.json({ attachments: results || [] })
})

app.get('/ai/warroom/my-rooms', async (c) => {
  const user_id = c.req.query('user_id')
  if (!user_id) return c.json({ rooms: [] })
  
  const { results } = await c.env.DB.prepare(`
    SELECT w.* 
    FROM warroom_list w
    JOIN user_warrooms uw ON w.inc_id = uw.inc_id
    WHERE uw.user_id = ?
    ORDER BY w.reg_dt DESC
  `).bind(user_id).all()
  
  return c.json({ rooms: results || [] })
})

export default app
