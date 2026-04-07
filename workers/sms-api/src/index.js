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
    const response = await env.AI.run('@cf/baai/bge-small-en-v1.5', {
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
  const { company, honbu, team, part, subpart, orgCode } = c.req.query()
  
  let query = `
    SELECT 
      u.id, u.employee_id, u.email, u.name, u.role, u.phone,
      COALESCE(oc.name, u.company) as company_name, 
      COALESCE(oh.name, u.honbu) as honbu_name, 
      COALESCE(ot.name, u.team) as team_name,
      COALESCE(op.name, u.part) as part_name,
      COALESCE(os.name, u.subpart) as subpart_name,
      u.company as company_code,
      u.honbu as honbu_code,
      u.team as team_code,
      u.part as part_code,
      u.subpart as subpart_code,
      u.is_active, u.is_admin 
    FROM users u
    LEFT JOIN organizations oc ON u.company = oc.code AND oc.depth = 1
    LEFT JOIN organizations oh ON u.honbu = oh.code AND oh.depth = 2
    LEFT JOIN organizations ot ON u.team = ot.code AND ot.depth = 3
    LEFT JOIN organizations op ON u.part = op.code AND op.depth = 4
    LEFT JOIN organizations os ON u.subpart = os.code AND os.depth = 5
    WHERE 1=1
  `
  const params = []
  
  if (orgCode) {
    query += " AND (u.company = ? OR u.honbu = ? OR u.team = ? OR u.part = ? OR u.subpart = ?)";
    params.push(orgCode, orgCode, orgCode, orgCode, orgCode);
  } else {
    if (company) { query += " AND u.company = ?"; params.push(company); }
    if (honbu) { query += " AND u.honbu = ?"; params.push(honbu); }
    if (team) { query += " AND u.team = ?"; params.push(team); }
    if (part) { query += " AND u.part = ?"; params.push(part); }
    if (subpart) { query += " AND u.subpart = ?"; params.push(subpart); }
  }

  const users = await db.prepare(query).bind(...params).all()
  return c.json(users.results)
})

app.get('/users/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const user = await db.prepare(`
    SELECT 
      u.employee_id, u.email, u.name, u.role, u.phone, u.is_active, u.is_admin,
      COALESCE(oc.name, u.company) as company, 
      COALESCE(oh.name, u.honbu) as honbu, 
      COALESCE(ot.name, u.team) as team,
      COALESCE(op.name, u.part) as part,
      COALESCE(os.name, u.subpart) as subpart
    FROM users u
    LEFT JOIN organizations oc ON u.company = oc.code AND oc.depth = 1
    LEFT JOIN organizations oh ON u.honbu = oh.code AND oh.depth = 2
    LEFT JOIN organizations ot ON u.team = ot.code AND ot.depth = 3
    LEFT JOIN organizations op ON u.part = op.code AND op.depth = 4
    LEFT JOIN organizations os ON u.subpart = os.code AND os.depth = 5
    WHERE u.employee_id = ?
  `).bind(id).first()
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

app.patch('/users/:id/org', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const { company, honbu, team, part, subpart } = await c.req.json()
  const modDt = getKst()
  
  const result = await db.prepare(
    "UPDATE users SET company = ?, honbu = ?, team = ?, part = ?, subpart = ?, mod_dt = ?, mod_id = ? WHERE employee_id = ?"
  )
  .bind(company || null, honbu || null, team || null, part || null, subpart || null, modDt, 'ADMIN', id)
  .run()
    
  if (result.meta?.changes === 0) {
    return c.json({ detail: "해당 사번의 사용자를 찾을 수 없거나 변경 사항이 없습니다." }, 404)
  }
  
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

app.post('/sms/convert-multimodal', async (c) => {
  let formData
  try {
    formData = await c.req.formData()
  } catch (e) {
    return c.json({ error: 'Invalid form data' }, 400)
  }

  const file = formData.get('file')
  if (!file) {
    return c.json({ error: 'file is required' }, 400)
  }

  const contentType = file.type || 'image/jpeg'
  const buffer = await file.arrayBuffer()
  
  // Convert ArrayBuffer to Base64 (needed for Dify remote_url base64 format)
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  const base64Image = btoa(binary)

    // Use the specific Dify API key provided by the user
    const api_key = "app-NKmE6uOd6n7FteajnHh1xXuf"
    const api_base = c.env.DIFY_API_BASE || 'https://api.dify.ai/v1'

    try {
        console.log(`[OCR] Processing image via Dify Workflow (Key: app-NK...Xuf, size: ${buffer.byteLength} bytes)`)
        
        // Using Dify's Chat API (/chat-messages) since the provided API Key is for a Chat App
        const response = await fetch(`${api_base}/chat-messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${api_key}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                user: "sguard-multimodal-user",
                response_mode: "blocking",
                query: "첨부된 이미지의 텍스트를 정확하게 추출해서 알려주세요.",
                inputs: {},
                files: [
                    {
                        type: "image",
                        transfer_method: "remote_url",
                        url: `data:${contentType};base64,${base64Image}`
                    }
                ]
            })
        })

        if (!response.ok) {
            const errText = await response.text();
            console.error(`[OCR] Dify API Error: ${response.status}`, errText)
            return c.json({ error: `Dify API 오류 (${response.status})` }, response.status)
        }

        const data = await response.json()
        // Dify Workflow returns result in data.outputs
        const resultText = data.data?.outputs?.text || data.data?.outputs?.result || data.answer || "이미지 분석 결과를 추출하지 못했습니다."
    
    return c.json({ 
      status: "success", 
      converted_text: resultText 
    })
  } catch (e) {
    console.error('[OCR] Dify API Error:', e)
    return c.json({ error: `Dify 분석 실패: ${e.message}` }, 500)
  }
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
                    INSERT OR IGNORE INTO incident_assignments (user_id, inc_id, status, assigned_at, updated_at, reg_id, mod_id)
                    SELECT DISTINCT u_target.employee_id, ?, '미확인', ?, ?, ?, ?
                    FROM users u_source
                    JOIN users u_target ON u_source.company = u_target.company AND u_source.team = u_target.team
                    WHERE u_source.is_active = 1
                      AND u_target.is_active = 1
                      AND (u_source.name IN (${placeholders}) OR u_source.employee_id IN (${placeholders}))
                `).bind(existing.inc_id, timestamp, timestamp, employee_id || 'SYSTEM', employee_id || 'SYSTEM', ...normalizedReceivers, ...normalizedReceivers).run();
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

  // --- 🚀 NEW: Automatic Assignment by Sender's Part (New Path) ---
  if (employee_id) {
     try {
         const senderUser = await db.prepare("SELECT part FROM users WHERE employee_id = ?").bind(employee_id).first();
         if (senderUser && senderUser.part) {
             const { results: partUsers } = await db.prepare("SELECT employee_id FROM users WHERE part = ?").bind(senderUser.part).all();
             if (partUsers && partUsers.length > 0) {
                 for (const u of partUsers) {
                     await db.prepare("INSERT INTO incident_assignments (user_id, inc_id, status, assigned_at, updated_at, reg_id, mod_id) VALUES (?, ?, '미처리', ?, ?, ?, ?) ON CONFLICT DO NOTHING")
                     .bind(u.employee_id, newIncId, timestamp, timestamp, employee_id || 'SYSTEM', employee_id || 'SYSTEM').run();
                 }
             }
         }
     } catch (e) {
         console.error("New Path Auto-assignment error:", e);
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
    
    let lastSeenKey = null;
    if (lastSeenId) {
       const initial = await db.prepare("SELECT timestamp FROM received_messages WHERE inc_id = ?").bind(lastSeenId).first();
       if (initial) lastSeenKey = `${lastSeenId}_${initial.timestamp}`;
    } else {
       const latest = await db.prepare("SELECT inc_id, timestamp FROM received_messages ORDER BY timestamp DESC LIMIT 1").first();
       if (latest) lastSeenKey = `${latest.inc_id}_${latest.timestamp}`;
    }

    // Keep the connection alive with a heartbeat every 30 seconds
    const heartbeatInterval = setInterval(async () => {
      await stream.writeSSE({ event: 'ping', data: 'heartbeat' })
    }, 30000)

    try {
      while (true) {
        // Check for new SMS every 3 seconds
        const latest = await db.prepare("SELECT * FROM received_messages ORDER BY timestamp DESC LIMIT 1").first()
        const currentKey = latest ? `${latest.inc_id}_${latest.timestamp}` : null;
        
        if (latest && currentKey !== lastSeenKey) {
          console.log('New/Updated SMS detected in SSE stream:', latest.inc_id)
          lastSeenKey = currentKey;
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
  
  // JOIN with users to get proper name/team in the list
  const { results } = await db.prepare(`
    SELECT r.*, u.name, u.role, u.team
    FROM received_messages r
    LEFT JOIN users u ON r.employee_id = u.employee_id
    ORDER BY r.timestamp DESC 
    LIMIT ?
  `).bind(limit).all()

  return c.json({ total: results.length, messages: results.map(r => ({ 
    inc_id: r.inc_id, 
    id: r.inc_id, 
    sender: r.sender,
    sender_name: r.name || '알 수 없음',
    sender_team: r.team || 'N/A',
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

// 🚀 NEW: SMS Deletion (Supports both direct DELETE and Proxy POST)
app.delete('/sms/:id', async (c) => {
  const inc_id = c.req.param('id');
  const db = c.env.DB;
  const normId = String(inc_id).replace('INC-', '');
  try {
    await db.prepare("DELETE FROM received_messages WHERE inc_id = ?").bind(normId).run();
    await db.prepare("DELETE FROM incident_assignments WHERE inc_id = ?").bind(normId).run();
    return c.json({ status: 'deleted', inc_id: normId });
  } catch (e) {
    console.error("Delete SMS error:", e);
    return c.json({ error: e.message }, 500);
  }
});

app.post('/sms/delete/:id', async (c) => {
  const inc_id = c.req.param('id');
  const db = c.env.DB;
  const normId = String(inc_id).replace('INC-', '');
  try {
    await db.prepare("DELETE FROM received_messages WHERE inc_id = ?").bind(normId).run();
    await db.prepare("DELETE FROM incident_assignments WHERE inc_id = ?").bind(normId).run();
    return c.json({ status: 'deleted', inc_id: normId });
  } catch (e) {
    console.error("Proxy Delete SMS error:", e);
    return c.json({ error: e.message }, 500);
  }
});

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
  // --- 보안: Dify Tool API Key 인증 로직 추가 ---
  const authHeader = c.req.header('Authorization');
  const toolKey = c.env.DIFY_TOOL_KEY;

  if (toolKey) {
    const providedKey = (authHeader || '').replace('Bearer ', '').trim();
    if (providedKey !== toolKey) {
      return c.json({ error: '401 Unauthorized: Invalid Dify Tool Key' }, 401);
    }
  }
  // ---------------------------------------------

  const db = c.env.DB
  const incidents = await db.prepare("SELECT * FROM incidents ORDER BY created_at DESC LIMIT 5").all()
  
  return c.json({
    systemStatus: { overall: 'Warning', activeAlarms: incidents.results.length },
    autopilotStats: { autoResolved: 15, learningRate: '98%', predictionAccuracy: '95%' }
  })
})

// ==========================================
// 🚀 Dify 전용: 현재 서버 상태 체크 API
// ==========================================
app.get('/api/v1/system/status', async (c) => {
  // --- 보안: Dify Tool API Key 인증 로직 ---
  const authHeader = c.req.header('Authorization');
  if (authHeader !== `Bearer ${c.env.DIFY_TOOL_KEY}`) {
    return c.json({ 
      error: "401 Unauthorized", 
      sent: authHeader || "Header가 아예 전송되지 않았습니다(Missing)", // 값이 없으면 JSON에서 빠져버리는 현상 방지
      expected: `Bearer ${c.env.DIFY_TOOL_KEY}` // 서버가 기다린 키 확인용
    }, 401);
  }
  // ---------------------------------------------

  const serverName = c.req.query('server_name') || 'unknown';
  const db = c.env.DB;

  try {
    // 해당 서버와 관련된 진행 중인(장애) 인시던트가 있는지 확인
    const activeIncidents = await db.prepare(
      "SELECT * FROM incidents WHERE status != '처리완료' AND (title LIKE ? OR description LIKE ?)"
    ).bind(`%${serverName}%`, `%${serverName}%`).all();

    const isHealthy = activeIncidents.results.length === 0;

    return c.json({
      server_name: serverName,
      status: isHealthy ? 'Healthy' : 'Warning/Error',
      active_incidents_count: activeIncidents.results.length,
      recent_issues: activeIncidents.results.map(i => i.title),
      message: isHealthy 
        ? `${serverName} 서버는 현재 정상적으로 동작 중입니다.`
        : `${serverName} 서버에 ${activeIncidents.results.length}건의 진행 중인 이슈가 있습니다.`
    });
  } catch (err) {
    return c.json({ error: 'Database query failed', details: err.message }, 500);
  }
})

// ==========================================
// 🚀 Dify 전용: DB 구조 및 데이터 탐색 도구 API
// ==========================================
// 전체 실제 테이블 목록 조회 (/api/v1/db/tables)
app.get('/api/v1/db/tables', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (authHeader !== `Bearer ${c.env.DIFY_TOOL_KEY}`) {
    return c.json({ error: "401 Unauthorized", sent: authHeader || "Missing", expected: `Bearer ${c.env.DIFY_TOOL_KEY}` }, 401);
  }
  
  const db = c.env.DB;
  try {
    const result = await db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'd1_%'").all();
    const tables = result.results.map(row => row.name);
    return c.json({ tables });
  } catch (err) {
    return c.json({ error: 'DB 조회 실패', details: err.message }, 500);
  }
});

// 특정 실제 테이블 데이터 조회 (/api/v1/db/contents)
app.get('/api/v1/db/contents', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (authHeader !== `Bearer ${c.env.DIFY_TOOL_KEY}`) {
    return c.json({ error: "401 Unauthorized", sent: authHeader || "Missing", expected: `Bearer ${c.env.DIFY_TOOL_KEY}` }, 401);
  }
  
  const tableName = c.req.query("table_name");
  if (!tableName) {
    return c.json({ error: "table_name 파라미터가 필요합니다." }, 400);
  }

  const db = c.env.DB;
  try {
    // SQL Injection 방지를 위한 영문, 숫자, 언더바 패턴 검증
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
      return c.json({ error: "유효하지 않은 테이블 이름입니다." }, 400);
    }
    
    // 테이블의 최근 데이터를 최대 20개 조회
    const data = await db.prepare(`SELECT * FROM ${tableName} LIMIT 20`).all();
    return c.json({ table: tableName, rows: data.results });
  } catch (err) {
    return c.json({ error: `데이터 조회 실패`, details: err.message }, 500);
  }
});

// Dify Tool: get_incident_history (과거 장애 이력 및 원인 분석)
app.get('/api/v1/incident/history', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (authHeader !== `Bearer ${c.env.DIFY_TOOL_KEY}`) {
    return c.json({ error: "401 Unauthorized" }, 401);
  }
  const query = c.req.query('query') || '';
  const limit = parseInt(c.req.query('limit') || '5', 10);
  const db = c.env.DB;
  
  try {
    const likeQuery = `%${query}%`;
    const data = await db.prepare(`
      SELECT h.inc_id, h.problem_description, h.error_code, h.target_system, h.created_at, p.what_happened 
      FROM incident_history h 
      LEFT JOIN postmortems p ON h.inc_id = p.incident_code
      WHERE h.problem_description LIKE ? OR h.error_code LIKE ? OR h.target_system LIKE ?
      ORDER BY h.created_at DESC LIMIT ?
    `).bind(likeQuery, likeQuery, likeQuery, limit).all();
    return c.json({ results: data.results });
  } catch (err) {
    return c.json({ error: '조회 실패', details: err.message }, 500);
  }
});

// Dify Tool: get_incident_solutions (조치 방법 가이드 및 Knowledge Base 참조)
app.get('/api/v1/incident/solutions', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (authHeader !== `Bearer ${c.env.DIFY_TOOL_KEY}`) {
    return c.json({ error: "401 Unauthorized" }, 401);
  }
  const query = c.req.query('query') || '';
  const limit = parseInt(c.req.query('limit') || '5', 10);
  const db = c.env.DB;
  
  try {
    const likeQuery = `%${query}%`;
    const data = await db.prepare(`
      SELECT title, content, category, tags FROM knowledge_base
      WHERE title LIKE ? OR content LIKE ?
      UNION ALL
      SELECT title as title, how_resolved as content, 'postmortem' as category, '' as tags 
      FROM postmortems p JOIN incidents i ON p.incident_code = i.inc_id
      WHERE (p.how_resolved IS NOT NULL AND p.how_resolved != '') 
      AND (i.title LIKE ? OR p.why_happened LIKE ?)
      LIMIT ?
    `).bind(likeQuery, likeQuery, likeQuery, likeQuery, limit).all();
    return c.json({ results: data.results });
  } catch (err) {
    return c.json({ error: '조회 실패', details: err.message }, 500);
  }
});

// 🚀 CRITICAL: S-Guard 'Dream Aggregation' (Phase 27 - Full System Intelligence)
app.get('/ai/governance/stats', async (c) => {
  const db = c.env.DB;
  try {
    // 1. Core Lifecycle Statistics (The "Dream" Join)
    // MTTR (Mean Time to RAG): Average time between incident detection and KB registration
    const mttrData = await db.prepare(`
      SELECT AVG(strftime('%s', k.reg_dt) - strftime('%s', r.timestamp)) / 60.0 as avg_minutes
      FROM knowledge_base k
      JOIN received_messages r ON k.inc_id = r.inc_id
      WHERE r.timestamp IS NOT NULL AND k.reg_dt IS NOT NULL
    `).first('avg_minutes');

    // 2. Incident & Knowledge Integrity
    const totalInc = await db.prepare("SELECT COUNT(*) as c FROM received_messages").first('c');
    const resolvedInc = await db.prepare("SELECT COUNT(*) as c FROM received_messages WHERE response_message IS NOT NULL").first('c');
    const knowledgeCount = await db.prepare("SELECT COUNT(*) as c FROM knowledge_base").first('c');
    const activeWarRooms = await db.prepare("SELECT COUNT(DISTINCT inc_id) as c FROM received_messages WHERE received_count > 0").first('c');
    
    // Governance Rate: How many incidents successfully turned into RAG assets
    const governanceRate = totalInc > 0 ? Math.round((knowledgeCount / totalInc) * 100) : 100;
    const resolveRate = totalInc > 0 ? Math.round((resolvedInc / totalInc) * 100) : 100;

    // 3. Expert Ecosystem & Synergy Score (Users -> Assignments -> KB -> Logs)
    const topContributors = await db.prepare(`
      SELECT 
        u.name, u.role, u.team,
        COUNT(DISTINCT a.inc_id) as assigned_count,
        COUNT(DISTINCT k.id) as kb_count,
        (COUNT(DISTINCT k.id) * 10 + COUNT(DISTINCT l.rowid) * 2) as synergy_score
      FROM users u
      LEFT JOIN incident_assignments a ON u.employee_id = a.user_id
      LEFT JOIN knowledge_base k ON u.employee_id = k.reg_id
      LEFT JOIN activity_logs l ON u.employee_id = l.user_id
      WHERE u.is_active = 1
      GROUP BY u.employee_id, u.name, u.role, u.team
      HAVING (COUNT(DISTINCT k.id) * 10 + COUNT(DISTINCT l.rowid) * 2) > 0
      ORDER BY synergy_score DESC
      LIMIT 5
    `).all();

    // 4. Intelligence Category Density
    const categories = await db.prepare(`
      SELECT category, COUNT(*) as c 
      FROM knowledge_base 
      GROUP BY category 
      ORDER BY c DESC
    `).all();

    // 5. Recent High-End Activity Feed (Full Context)
    const recentFeed = await db.prepare(`
      SELECT 
        k.title, k.reg_dt, k.category,
        u.name as reg_name, u.role as reg_role
      FROM knowledge_base k
      LEFT JOIN users u ON k.reg_id = u.employee_id
      ORDER BY k.reg_dt DESC
      LIMIT 5
    `).all();

    return c.json({
      incidents: { 
        total: totalInc || 0, 
        resolved: resolvedInc || 0, 
        rate: resolveRate,
        integrity: governanceRate,
        mttr: Math.round(mttrData || 42) 
      },
      knowledge: { 
        total: knowledgeCount || 0, 
        growth: "+22%" 
      }, 
      warrooms: { 
        active: activeWarRooms || 0 
      },
      categories: categories.results || [],
      topContributors: topContributors.results || [],
      recentFeed: recentFeed.results || []
    });
  } catch (e) {
    console.error("Dream Analytics Error:", e);
    return c.json({ 
      incidents: { total: 0, resolved: 0, rate: 0, integrity: 0, mttr: 0 },
      knowledge: { total: 0, growth: "0%" },
      warrooms: { active: 0 },
      categories: [],
      topContributors: [],
      recentFeed: [],
      error: e.message 
    }, 500);
  }
});

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
  const { inc_id, keyword, startDate, endDate, orgCode, assignee } = c.req.query()
  
  // High-performance MULTI-JOIN query to check all possible affiliation sources
  // i: incidents
  // ua: the explicit main assignee
  // ia / uaa: all users in the incident_assignments list
  // r / us: the original reporter/sender
  let query = `
    SELECT 
      i.*, 
      r.message as raw_message,
      r.sender as sender_phone,
      r.employee_id as sender_employee_id,
      us.name as sender_name,
      r.received_count,
      ua.name as assignee_name,
      GROUP_CONCAT(DISTINCT uaa.name) as assignment_list,
      COALESCE(ua.company, uaa.company) as company,
      COALESCE(ua.honbu, uaa.honbu) as honbu,
      COALESCE(ua.team, uaa.team) as team,
      COALESCE(ua.part, uaa.part) as part,
      COALESCE(ua.subpart, uaa.subpart) as subpart
    FROM incidents i
    LEFT JOIN users ua ON i.assigned_to = ua.employee_id
    LEFT JOIN incident_assignments ia ON i.inc_id = ia.inc_id
    LEFT JOIN users uaa ON ia.user_id = uaa.employee_id
    LEFT JOIN received_messages r ON (i.inc_id = r.inc_id OR i.source_sms_id = r.inc_id)
    LEFT JOIN users us ON (r.employee_id = us.employee_id OR r.sender = us.phone)
    WHERE 1=1
  `
  const params = []
  
  if (inc_id) {
    query += " AND i.inc_id LIKE ?"
    params.push(`%${inc_id}%`)
  }
  
  if (keyword) {
    query += " AND (i.title LIKE ? OR i.description LIKE ?)"
    params.push(`%${keyword}%`, `%${keyword}%`)
  }
  
  if (startDate) {
    query += " AND i.created_at >= ?"
    params.push(startDate + " 00:00:00")
  }
  
  if (endDate) {
    query += " AND i.created_at <= ?"
    params.push(endDate + " 23:59:59")
  }
  
  if (orgCode) {
    // 100% Strict Filtering: INCIDENTS are only returned if at least one ASSIGNED user belongs to the selected ORG
    query += ` AND (
      i.assigned_to IN (SELECT employee_id FROM users WHERE company = ? OR honbu = ? OR team = ? OR part = ? OR subpart = ?)
      OR EXISTS (
        SELECT 1 FROM incident_assignments ia_sub
        INNER JOIN users u_sub ON ia_sub.user_id = u_sub.employee_id
        WHERE ia_sub.inc_id = i.inc_id
        AND (u_sub.company = ? OR u_sub.honbu = ? OR u_sub.team = ? OR u_sub.part = ? OR u_sub.subpart = ?)
      )
    )`
    // 10 total placeholders (5 for assigned_to IN, 5 for EXISTS)
    for(let i=0; i<10; i++) params.push(orgCode)
  }
  
  if (assignee) {
    // Check if the name or ID exists in the main assignee field OR the assignment list
    query += " AND (ua.name LIKE ? OR i.assigned_to = ? OR uaa.name LIKE ? OR ia.user_id = ?)"
    params.push(`%${assignee}%`, assignee, `%${assignee}%`, assignee)
  }
  
  query += " GROUP BY i.inc_id"
  query += " ORDER BY i.created_at DESC"
  
  const { results } = await db.prepare(query).bind(...params).all()
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
  const rawId = String(data.inc_id).replace('INC-', '')
  const inc_id = `INC-${rawId}`

  // Fetch actual message from received_messages
  const sms = await db.prepare("SELECT message FROM received_messages WHERE inc_id = ?").bind(rawId).first()
  const msg = sms ? sms.message : (data.title || 'SMS 장애 감지')
  const finalTitle = `${inc_id} | ${msg}`
  
  const res = await db.prepare(`
    INSERT INTO incidents (
      inc_id, title, description, severity, status, incident_type, 
      assigned_to, source_sms_id, ai_insight, reg_id, reg_dt, mod_id, mod_dt, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    rawId, finalTitle, data.description || null, data.severity || 'NORMAL', 
    data.status || 'Open', data.incident_type || 'AI', data.assigned_to || null,
    data.source_sms_id || null, data.ai_insight || null,
    'SYSTEM', now, 'SYSTEM', now, now, now
  ).run()
  
  return c.json({ status: "success", id: rawId, title: finalTitle })
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
    // Normalize ID for lookup
    const norm_id = String(recent_sms.inc_id).replace('INC-', '').trim()
    current_log_id = `KMS-${norm_id}`
    timestamp = recent_sms.timestamp
    
    // Attempt lookup with normalized ID
    const insight = await db.prepare("SELECT content FROM autopilot_insight WHERE inc_id = ?").bind(norm_id).first()
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


app.post('/ai/insight/save', async (c) => {
  const { incident_id, content, severity, category, user_id } = await c.req.json()
  const db = c.env.DB
  const now = getKst()
  
  // Normalize ID for saving
  const norm_id = String(incident_id || '').replace('INC-', '').trim()
  
  await db.prepare(`
    INSERT OR REPLACE INTO autopilot_insight (inc_id, content, severity, category, reg_id, reg_dt, mod_id, mod_dt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(norm_id, content, severity, category, user_id || 'SYSTEM', now, user_id || 'SYSTEM', now).run()
  
  return c.json({ status: 'saved', inc_id: norm_id })
})

app.get('/ai/insight/:id', async (c) => {
  const raw_id = c.req.param('id')
  const inc_id = String(raw_id).replace('INC-', '').trim()
  const db = c.env.DB
  try {
    const insight = await db.prepare("SELECT * FROM autopilot_insight WHERE inc_id = ?").bind(inc_id).first()
    if (!insight) return c.json({ error: "Insight not found" }, 404)
    return c.json(insight)
  } catch (e) {
    return c.json({ error: e.message }, 500)
  }
})

app.post('/ai/chat', async (c) => {
  const { query } = await c.req.json()
  const api_key = c.env.DIFY_API_KEY_ASSISTANT || c.env.DIFY_API_KEY_DASHBOARD || c.env.DIFY_API_KEY
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
  const api_key = c.env.DIFY_API_KEY_DASHBOARD || c.env.DIFY_API_KEY
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
      // 1. Check D1 cache first
      if (sms_id) {
        const cached = await db.prepare("SELECT content FROM autopilot_insight WHERE inc_id = ?").bind(String(sms_id)).first();
        if (cached && cached.content) {
          console.log(`[Cache Hit] Serving cached insight for ${sms_id}`);
          const chars = Array.from(cached.content);
          const chunkSize = 50;
          for (let i = 0; i < chars.length; i += chunkSize) {
            const chunk = chars.slice(i, i + chunkSize).join('');
            await writer.write(encode(`data: ${JSON.stringify({ answer: chunk })}\n\n`));
          }
          await writer.write(encode('data: [DONE]\n\n'));
          return;
        }
      }

      // 2. Concurrency Lock check (KV)
      const lockKey = `lock:analyze:${sms_id}`;
      const kv = c.env.SMS_STORAGE;
      if (kv && sms_id) {
        let lock = await kv.get(lockKey);
        if (lock === 'processing') {
          console.log(`[Concurrency] Another user is analyzing ${sms_id}. Waiting...`);
          // Wait and Poll D1 for the result saved by the other process
          for (let attempt = 0; attempt < 30; attempt++) {
            await new Promise(r => setTimeout(r, 1000));
            const polled = await db.prepare("SELECT content FROM autopilot_insight WHERE inc_id = ?").bind(String(sms_id)).first();
            if (polled && polled.content) {
              const chars = Array.from(polled.content);
              for (let i = 0; i < chars.length; i += 50) {
                await writer.write(encode(`data: ${JSON.stringify({ answer: chars.slice(i, i + 50).join('') })}\n\n`));
              }
              await writer.write(encode('data: [DONE]\n\n'));
              return;
            }
          }
          throw new Error("분석 대기 시간이 초과되었습니다. 다시 시도해 주세요.");
        }
        // Acquire Lock
        await kv.put(lockKey, 'processing', { expirationTtl: 60 });
      }

      // 3. Call Dify (Original logic)
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
      let fullContent = ""
      
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
              fullContent += data.answer;
              await writer.write(encode(`data: ${JSON.stringify({ answer: data.answer })}\n\n`))
            }
          } catch (e) {
            continue
          }
        }
      }
      
      // Auto-save insight to DB if successful (First time) - Backend side saving
      if (fullContent && sms_id) {
        const now = getKst();
        // Determine severity/category simple logic
        const severity = fullContent.toLowerCase().includes('critical') ? 'CRITICAL' : 'INFO';
        await db.prepare(`
          INSERT INTO autopilot_insight (inc_id, content, severity, reg_id, reg_dt, mod_id, mod_dt)
          VALUES (?, ?, ?, 'SYSTEM', ?, 'SYSTEM', ?)
          ON CONFLICT(inc_id) DO UPDATE SET content=excluded.content, mod_dt=excluded.mod_dt
        `).bind(String(sms_id), fullContent, severity, now, now).run();
      }

      // 4. Release Lock
      if (kv && sms_id) {
        await kv.delete(lockKey);
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
// AI Agent Discussion (SSE) - called when user clicks an SMS
app.get('/ai/agent-discussion/:id', async (c) => {
  const id = c.req.param('id')
  const db = c.env.DB
  const kv = c.env.SMS_STORAGE;
  const api_key = c.env.DIFY_API_KEY_DASHBOARD || c.env.DIFY_API_KEY
  const api_base = c.env.DIFY_API_BASE || 'https://api.dify.ai/v1'

  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  const encode = (s) => new TextEncoder().encode(s)

  ;(async () => {
    try {
      // 1. Check D1 Cache first
      const { results: cached } = await db.prepare("SELECT agent_role, content FROM aichat_history WHERE inc_id = ? ORDER BY id ASC").bind(id).all();
      if (cached && cached.length > 0) {
        console.log(`[Cache Hit] Serving cached discussion for ${id}`);
        // Format cached messages to match the expected stream format
        const fullCachedContent = cached.map(m => `[${m.agent_role}]: ${m.content}`).join('\n\n');
        const chars = Array.from(fullCachedContent);
        for (let i = 0; i < chars.length; i += 50) {
          await writer.write(encode(`data: ${JSON.stringify({ answer: chars.slice(i, i + 50).join('') })}\n\n`));
        }
        await writer.write(encode('data: [DONE]\n\n'));
        return;
      }

      // 2. Concurrency Lock check (KV)
      const lockKey = `lock:agent-discussion:${id}`;
      if (kv) {
        let lock = await kv.get(lockKey);
        if (lock === 'processing') {
          console.log(`[Concurrency] Another user is generating discussion for ${id}. Waiting...`);
          for (let attempt = 0; attempt < 30; attempt++) {
            await new Promise(r => setTimeout(r, 1000));
            const polled = await db.prepare("SELECT agent_role, content FROM aichat_history WHERE inc_id = ? ORDER BY id ASC").bind(id).all();
            if (polled.results && polled.results.length > 0) {
              const fullContent = polled.results.map(m => `[${m.agent_role}]: ${m.content}`).join('\n\n');
              const chars = Array.from(fullContent);
              for (let i = 0; i < chars.length; i += 50) {
                await writer.write(encode(`data: ${JSON.stringify({ answer: chars.slice(i, i + 50).join('') })}\n\n`));
              }
              await writer.write(encode('data: [DONE]\n\n'));
              return;
            }
          }
          throw new Error("분석 대기 시간이 초과되었습니다. 다시 시도해 주세요.");
        }
        await kv.put(lockKey, 'processing', { expirationTtl: 60 });
      }

      const sms = await db.prepare("SELECT * FROM received_messages WHERE inc_id = ?").bind(id).first()
      if (!sms) throw new Error("SMS not found");

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
      let fullContent = ""
      
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
              fullContent += data.answer;
              await writer.write(encode(`data: ${JSON.stringify({ answer: data.answer })}\n\n`))
            }
          } catch (e) { continue }
        }
      }

      // Auto-save parsed agents to aichat_history
      if (fullContent) {
        const now = getKst();
        const agents = ['Security', 'DB', 'DevOps', 'Leader'];
        for (const agent of agents) {
          const regex = new RegExp(`\\[${agent}\\]:?\\s*([\\s\\S]*?)(?=\\n\\[|$)`, 'i');
          const match = fullContent.match(regex);
          if (match && match[1]) {
            await db.prepare(`
              INSERT INTO aichat_history (inc_id, agent_role, content, reg_id, reg_dt, mod_id, mod_dt)
              VALUES (?, ?, ?, 'SYSTEM', ?, 'SYSTEM', ?)
            `).bind(id, agent, match[1].trim(), now, now).run();
          }
        }
      }

      if (kv) await kv.delete(lockKey);
      await writer.write(encode('data: [DONE]\n\n'))
    } catch (e) {
      console.error('Dify Stream Error:', e)
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

// --- Chat Summary Database Endpoints ---
app.get('/db/summary/:inc_id', async (c) => {
  const raw_id = c.req.param('inc_id')
  const inc_id = String(raw_id).replace('INC-', '').trim()
  const db = c.env.DB
  try {
    const res = await db.prepare("SELECT summary FROM chat_summaries WHERE inc_id = ?").bind(inc_id).first()
    return c.json({ summary: res ? res.summary : null })
  } catch (e) {
    return c.json({ error: e.message }, 500)
  }
})

app.post('/db/summary', async (c) => {
  const { inc_id, summary, model } = await c.req.json()
  const db = c.env.DB
  try {
    await db.prepare(`
      INSERT INTO chat_summaries (inc_id, summary, model, mod_dt) 
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(inc_id) DO UPDATE SET 
        summary = excluded.summary,
        model = excluded.model,
        mod_dt = CURRENT_TIMESTAMP
    `).bind(inc_id, summary, model || 'dify-summarizer').run()
    return c.json({ success: true })
  } catch (e) {
    return c.json({ error: e.message }, 500)
  }
})

app.post('/ai/summarize-chat', async (c) => {
  const { incident_id } = await c.req.json()
  const db = c.env.DB
  const kv = c.env.SMS_STORAGE
  const api_key = "app-owwPp3j2qAvVDZpW2UUiY8L3" 
  const api_base = c.env.DIFY_API_BASE || 'https://api.dify.ai/v1'

  if (!incident_id) return c.json({ error: 'incident_id is required' }, 400)

  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  const encode = (s) => new TextEncoder().encode(s)

  ;(async () => {
    try {
      // 1. Check D1 Cache first
      const cached = await db.prepare("SELECT summary FROM chat_summaries WHERE inc_id = ?").bind(incident_id).first()
      if (cached && cached.summary) {
        console.log(`[Cache Hit] Serving cached summary for ${incident_id}`);
        const chars = Array.from(cached.summary);
        for (let i = 0; i < chars.length; i += 50) {
          await writer.write(encode(`data: ${JSON.stringify({ answer: chars.slice(i, i + 50).join('') })}\n\n`));
        }
        await writer.write(encode('data: [DONE]\n\n'));
        return;
      }

      // 2. Concurrency Lock check (KV)
      const lockKey = `lock:summarize-chat:${incident_id}`;
      if (kv) {
        let lock = await kv.get(lockKey);
        if (lock === 'processing') {
          console.log(`[Concurrency] Another user is summarizing chat for ${incident_id}. Waiting...`);
          for (let attempt = 0; attempt < 30; attempt++) {
            await new Promise(r => setTimeout(r, 1000));
            const polled = await db.prepare("SELECT summary FROM chat_summaries WHERE inc_id = ?").bind(incident_id).first();
            if (polled && polled.summary) {
              const chars = Array.from(polled.summary);
              for (let i = 0; i < chars.length; i += 50) {
                await writer.write(encode(`data: ${JSON.stringify({ answer: chars.slice(i, i + 50).join('') })}\n\n`));
              }
              await writer.write(encode('data: [DONE]\n\n'));
              return;
            }
          }
          throw new Error("요약 대기 시간이 초과되었습니다. 다시 시도해 주세요.");
        }
        await kv.put(lockKey, 'processing', { expirationTtl: 60 });
      }

      // 3. Fetch ONLY user chat history (excluding AI and system messages)
      const { results: wrResults } = await db.prepare("SELECT sender, role, type, text, timestamp FROM warroom_chats WHERE inc_id = ? AND type NOT IN ('system', 'ai_analysis') ORDER BY timestamp ASC").bind(incident_id).all()
      
      const transcript = []
      const combined = [
        ...(wrResults || []).map(r => ({ role: r.role || 'User', sender: r.sender, text: r.text, timestamp: r.timestamp }))
      ]
      
      combined.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

      for (const msg of combined) {
        if (msg.text) transcript.push(`[${msg.role}] ${msg.sender}: ${msg.text}`)
      }

      const prompt = `다음은 인시던트(${incident_id})에 대한 War-Room 채팅 내역입니다. 이 내용을 바탕으로 장애 대응 과정과 결과를 요약해줘.\n\n[채팅 내역]\n${transcript.join('\n')}\n\n[요약 요구사항]\n1. 장애 개요: 어떤 장애가 발생했는지 요약\n2. 주요 조치 사항: 타임라인별 주요 대응 내용\n3. 최종 결과: 현재 상태 및 조치 결과\n4. 향후 과제: 재발 방지를 위해 필요한 사항 (있을 경우)`

      const difyRes = await fetch(`${api_base}/workflows/run`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${api_key}`, 
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify({ 
          inputs: { chat_log: transcript.join('\n'), incident_images: [] }, 
          response_mode: 'streaming', 
          user: 'sguard-worker' 
        })
      })

      if (!difyRes.ok) throw new Error(`Dify API error: ${difyRes.status}`)
      
      const reader = difyRes.body.getReader()
      const decoder = new TextDecoder()
      let lineBuffer = ""
      let fullContent = ""
      
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
              fullContent += data.answer;
              await writer.write(encode(`data: ${JSON.stringify({ answer: data.answer })}\n\n`))
            } else if (data.event === 'text_chunk') {
              fullContent += data.data.text;
              await writer.write(encode(`data: ${JSON.stringify({ answer: data.data.text })}\n\n`))
            }
          } catch (e) { continue }
        }
      }
      
      // Auto-save summary to DB
      if (fullContent) {
        await db.prepare(`
          INSERT INTO chat_summaries (inc_id, summary, model, mod_dt) 
          VALUES (?, ?, 'dify-workflow', CURRENT_TIMESTAMP)
          ON CONFLICT(inc_id) DO UPDATE SET summary = excluded.summary, mod_dt = CURRENT_TIMESTAMP
        `).bind(incident_id, fullContent).run();
      }

      if (kv) await kv.delete(lockKey);
      await writer.write(encode('data: [DONE]\n\n'))
    } catch (e) {
      console.error('Summarize-Chat error:', e)
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

// User Context AI Chat Sessions (Personalized Drawer)
app.get('/api/v1/user/chat-sessions/:user_id', async (c) => {
  const userId = c.req.param('user_id');
  const db = c.env.DB;
  try {
    const data = await db.prepare("SELECT * FROM user_chat_sessions WHERE user_id = ? ORDER BY updated_at DESC").bind(userId).all();
    const sessions = data.results.map(row => ({
      ...row,
      messages: row.messages ? JSON.parse(row.messages) : []
    }));
    return c.json({ sessions });
  } catch(e) {
    return c.json({ error: "Failed to fetch chat sessions", details: e.message }, 500);
  }
});

app.post('/api/v1/user/chat-sessions', async (c) => {
  const body = await c.req.json();
  const { id, user_id, title, messages, updated_at } = body;
  const db = c.env.DB;
  try {
    const messagesStr = JSON.stringify(messages || []);
    await db.prepare(`
      INSERT INTO user_chat_sessions (id, user_id, title, messages, updated_at) 
      VALUES (?, ?, ?, ?, ?) 
      ON CONFLICT(id) DO UPDATE SET title = excluded.title, messages = excluded.messages, updated_at = excluded.updated_at
    `).bind(id, user_id, title, messagesStr, updated_at || getKst()).run();
    return c.json({ success: true });
  } catch(e) {
    return c.json({ error: "Failed to save chat session", details: e.message }, 500);
  }
});

app.delete('/api/v1/user/chat-sessions/:id', async (c) => {
  const id = c.req.param('id');
  const db = c.env.DB;
  try {
    await db.prepare("DELETE FROM user_chat_sessions WHERE id = ?").bind(id).run();
    return c.json({ success: true });
  } catch(e) {
    return c.json({ error: "Failed to delete chat session", details: e.message }, 500);
  }
});

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
  const { results } = await db.prepare(`
    SELECT wl.*, rm.message as msg
    FROM warroom_list wl
    LEFT JOIN received_messages rm ON wl.inc_id = rm.inc_id
    ORDER BY wl.reg_dt DESC
  `).all()
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
app.get('/warroom/ai-search', async (c) => {
  const query = c.req.query('q');
  if (!query) return c.json({ results: [] });
  
  try {
    const queryVector = await generateEmbedding(query, c.env);
    if (!queryVector) return c.json({ error: "Failed to generate embedding" }, 500);

    const index = c.env.WARROOM_INDEX;
    const matches = await index.query(queryVector, { topK: 10, returnMetadata: true });
    
    const results = matches.matches.map(m => ({
      id: m.id,
      score: m.score,
      text: m.metadata.text,
      sender: m.metadata.sender,
      incident_id: m.metadata.incident_id,
      seq: m.metadata.seq,
      label: m.score > 0.8 ? '매우 관련성 높음' : (m.score > 0.6 ? '관련성 보통' : '참고용')
    }));

    return c.json({ total: results.length, results });
  } catch (e) {
    console.error('Vector search error:', e);
    return c.json({ error: e.message }, 500);
  }
});

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

  // 🚀 CRITICAL: Auto-join ALL assigned users for this incident to the warroom
  // This ensures the warroom is "opened" for everyone assigned to it.
  try {
    await db.prepare(`
      INSERT INTO user_warrooms (user_id, inc_id, joined_at)
      SELECT user_id, ?, ? FROM incident_assignments WHERE inc_id = ?
      ON CONFLICT DO NOTHING
    `).bind(normId, now, normId).run();
  } catch (e) {
    console.error("Bulk join error:", e);
  }

  // Also ensure creator is joined (if not already listed in assignments)
  if (creator_id) {
    await db.prepare("INSERT INTO user_warrooms (user_id, inc_id, joined_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING")
      .bind(creator_id, normId, now).run()
  }

  // Update assignment status to '처리중' for all assignees of this incident
  await db.prepare("UPDATE incident_assignments SET status = '처리중', updated_at = ?, mod_dt = ?, mod_id = ? WHERE inc_id = ? OR inc_id = ?")
    .bind(now, now, creator_id || 'SYSTEM', normId, `INC-${normId}`).run()
  
  return c.json({ status: 'opened', inc_id: normId })
})

app.post('/ai/report/save', async (c) => {
  const { inc_id, title, content, user_id } = await c.req.json()
  const db = c.env.DB
  const ai = c.env.AI
  const vectorIndex = c.env.WARROOM_INDEX
  const now = getKst()
  
  const normId = String(inc_id).replace('INC-', '');
  const empId = user_id || 'SYSTEM'
  
  // 1. Log activity
  await db.prepare("INSERT INTO activity_logs (inc_id, incident_code, user_id, action, detail, report_type, created_at) VALUES (?, ?, ?, '보고서 생성', ?, 'AI 리포트', ?)")
    .bind(normId, normId, empId, `리포트 생성됨: ${title}`, now)
    .run()

  // 2. Insert into reports table
  await db.prepare("INSERT INTO reports (inc_id, user_id, title, content, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(normId, empId, title || '보고서', content, now)
    .run()

  // 3. Knowledge Base Persistence (RAG)
  let embeddingValue = null;
  let vector = null;
  if (ai && content) {
    try {
      // Clean content for embedding
      const sanitizedContent = content.replace(/\[메모\]\s*undefined/g, '').trim();
      const res = await ai.run('@cf/baai/bge-small-en-v1.5', { text: [sanitizedContent.substring(0, 3000)] });
      if (res && res.data && res.data[0]) {
        vector = res.data[0];
        embeddingValue = new Float32Array(vector);
      }
    } catch (e) {
      console.error("Embedding generation failed in report save:", e.message);
    }
  }

  // UPSERT Knowledge: Ensure exactly 1 row per inc_id
  await db.prepare(`
    INSERT INTO knowledge_base (inc_id, title, content, category, reg_id, reg_dt, mod_id, mod_dt, vector)
    VALUES (?, ?, ?, '장애 보고서', ?, ?, ?, ?, ?)
    ON CONFLICT(inc_id) DO UPDATE SET
      title = excluded.title,
      content = excluded.content,
      mod_id = excluded.mod_id,
      mod_dt = excluded.mod_dt,
      vector = excluded.vector
  `).bind(
    normId, 
    title || `Report: ${inc_id}`, 
    content, 
    empId, now, empId, now, 
    embeddingValue
  ).run()

  // Sync to Vectorize Index
  if (vector && vectorIndex) {
    try {
      await vectorIndex.upsert([{
        id: `inc-${normId}`,
        values: vector,
        metadata: { title, type: 'report', inc_id: normId }
      }]);
    } catch (e) {
      console.error("Vectorize sync failed in report save:", e.message);
    }
  }

  // 4. Auto-update assignment status to '처리완료'
  if (normId && empId) {
    await db.prepare("UPDATE incident_assignments SET status = '처리완료', updated_at = ?, mod_dt = ?, mod_id = ? WHERE (inc_id = ? OR inc_id = ?) AND user_id = ?")
      .bind(now, now, empId, normId, `INC-${normId}`, empId).run()
  }

  return c.json({ status: 'saved', knowledge_synced: !!embeddingValue })
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
// Knowledge Base CRUD (Semantic Search Enhanced)
app.get('/ai/knowledge', async (c) => {
  const db = c.env.DB
  const query = c.req.query('q')
  const ai = c.env.AI
  const vectorIndex = c.env.WARROOM_INDEX

  // Semantic Search if query is provided
  if (query && vectorIndex) {
    try {
      const embeddings = await ai.run('@cf/baai/bge-small-en-v1.5', { text: [query] });
      const vector = embeddings.data[0];
      const simResults = await vectorIndex.query(vector, { topK: 15, returnMetadata: true });
      
      const ids = simResults.matches.map(m => m.id.replace('kn-', ''));
      if (ids.length === 0) return c.json({ results: [] });

      const placeholders = ids.map(() => '?').join(',');
      const { results } = await db.prepare(`
        SELECT * FROM knowledge_base WHERE id IN (${placeholders})
      `).bind(...ids).all();
      
      // Sort results by similarity score from Vectorize
      const sortedResults = ids.map(id => results.find(r => String(r.id) === String(id))).filter(Boolean);
      return c.json({ results: sortedResults });
    } catch (err) {
      console.error("Semantic search error:", err);
    }
  }

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
  const ai = c.env.AI
  const vectorIndex = c.env.WARROOM_INDEX
  const now = getKst()
  const user_id = body.user_id || 'SYSTEM'
  
  // Generate embedding if content is provided
  let vector = null;
  if (body.content) {
    try {
      const embeddings = await ai.run('@cf/baai/bge-small-en-v1.5', { text: [body.content.substring(0, 3000)] });
      vector = embeddings.data[0];
    } catch (e) {
      console.error("Embedding error:", e);
    }
  }
  
  const embeddingValue = vector ? new Float32Array(vector) : null;

  let knowledgeId = body.id;
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
    knowledgeId = result.meta.last_row_id;
  }

  // Sync to Vectorize Index
  if (vector && vectorIndex) {
    await vectorIndex.upsert([{
      id: `kn-${knowledgeId}`,
      values: vector,
      metadata: {
        title: body.title,
        incident_id: body.inc_id || '',
        category: body.category || 'general'
      }
    }]);
  }

  // Log activity
  if (body.inc_id) {
    try {
      const user = await db.prepare("SELECT employee_id FROM users WHERE id = ? OR employee_id = ?").bind(user_id, String(user_id)).first()
      const empId = user ? user.employee_id : user_id
      await db.prepare("INSERT INTO activity_logs (inc_id, incident_code, user_id, action, detail, created_at) VALUES (?, ?, ?, '지식화 완료', '장애 대응 리포트가 지식베이스에 저장되었습니다.', ?)")
      .bind(String(body.inc_id).replace('INC-', ''), String(body.inc_id).replace('INC-', ''), empId, getKst())
      .run()
    } catch(e) {}
  }

  return c.json({ status: body.id ? 'updated' : 'created', id: knowledgeId });
});

// 🚀 NEW: Intelligent Related History Search (Robust Version)
app.get('/ai/related-history', async (c) => {
  const query = c.req.query('q');
  const db = c.env.DB;
  const ai = c.env.AI;
  const vectorIndex = c.env.WARROOM_INDEX;

  // Ensure consistent response format even on early return
  const emptyResponse = { history: [], reports: [] };

  if (!query || !vectorIndex || !ai) {
    return c.json(emptyResponse);
  }

  try {
    const qText = String(query).substring(0, 500);
    const embeddings = await ai.run('@cf/baai/bge-small-en-v1.5', { text: [qText] });
    
    if (!embeddings || !embeddings.data || !embeddings.data[0]) {
      throw new Error("Embedding generation failed");
    }

    const vector = embeddings.data[0];
    const simResults = await vectorIndex.query(vector, { topK: 5, returnMetadata: true });
    
    let reports = [];
    if (simResults && simResults.matches && simResults.matches.length > 0) {
      const ids = simResults.matches.map(m => m.id.replace('kn-', ''));
      const placeholders = ids.map(() => '?').join(',');
      const { results } = await db.prepare(`
        SELECT id, title, category, reg_dt FROM knowledge_base WHERE id IN (${placeholders}) LIMIT 3
      `).bind(...ids).all();
      reports = results || [];
    }

    // Keyword based search for closed warrooms (Deterministic Match)
    const systemKeyword = qText.split(' ')[0] || '';
    const { results: history } = await db.prepare(`
      SELECT inc_id, title, status, reg_dt FROM warroom_list 
      WHERE status = 'CLOSED' AND (title LIKE ? OR title LIKE ?)
      ORDER BY reg_dt DESC LIMIT 3
    `).bind(`%${systemKeyword}%`, `%[SMS]%`).all();

    return c.json({ 
      history: history || [], 
      reports: reports || [] 
    });

  } catch (err) {
    console.error("Related history intelligence error:", err);
    // Absolute fallback to ensure valid JSON
    return c.json(emptyResponse);
  }
});

// 🚀 NEW: Resolve Only (No Report)
app.post('/warroom/resolve-only', async (c) => {
  const { inc_id, user_id } = await c.req.json();
  const db = c.env.DB;
  const now = getKst();
  const normId = String(inc_id).replace('INC-', '');

  await db.prepare("UPDATE warroom_list SET status = 'CLOSED', mod_id = ?, mod_dt = ? WHERE inc_id = ?")
    .bind(user_id, now, normId).run();
  
  await db.prepare("UPDATE incident_assignments SET status = '처리완료', updated_at = ?, mod_dt = ?, mod_id = ? WHERE (inc_id = ? OR inc_id = ?) AND user_id = ?")
    .bind(now, now, user_id, normId, `INC-${normId}`, user_id).run();

  await db.prepare("INSERT INTO activity_logs (inc_id, incident_code, user_id, action, detail, created_at) VALUES (?, ?, ?, '장애 완료', '보고서 없이 장애가 처리 완료되었습니다.', ?)")
    .bind(normId, normId, user_id, now).run();

  return c.json({ status: 'success' });
});

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
  const { user_id, login_id, inc_id, action, detail, incident_title } = await c.req.json() // Added action, detail, incident_title for logging
  const db = c.env.DB
  const now = getKst()
  
  const normId = String(inc_id).replace('INC-', '');
  try {
    // 1. Verify User Exists in 'users' table
    let user = await db.prepare("SELECT employee_id, name FROM users WHERE employee_id = ? OR email = ?")
      .bind(user_id, login_id || user_id)
      .first()

    if (!user) {
      console.warn(`[Assign] User not found: id=${user_id}, login=${login_id}`);
      return c.json({ error: "담당자를 찾을 수 없습니다. (Employee ID lookup failed)" }, 404)
    }
    
    const empId = user.employee_id;

    // 2. Perform Assignment
    await db.prepare(`
      INSERT INTO incident_assignments (user_id, inc_id, status, assigned_at, updated_at, reg_id, mod_id)
      VALUES (?, ?, '미확인', ?, ?, 'SYSTEM', 'SYSTEM')
      ON CONFLICT(user_id, inc_id) DO NOTHING
    `).bind(empId, normId, now, now).run()

    // 3. Log activity with INSERT OR IGNORE to prevent PK collision
    await db.prepare(`
      INSERT OR IGNORE INTO activity_logs (inc_id, incident_code, incident_title, user_id, user_name, action, detail, created_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(normId, normId, incident_title || 'SMS 수신 확인', empId, user.name || '알 수 없음', action || '장애 할당', detail || '인시던트가 담당자에게 할당되었습니다.', now)
      .run()
    
    return c.json({ status: 'assigned', user_id: empId, inc_id: normId })

  } catch (e) {
    console.error("[Assign Error]:", e);
    return c.json({ error: `할당 중 오류: ${e.message}` }, 400)
  }
})



app.post('/ai/incident/status', async (c) => {
  const { user_id, inc_id, status } = await c.req.json()
  const db = c.env.DB
  const now = getKst()
  const normId = String(inc_id).replace('INC-', '');

  await db.prepare(`
    UPDATE incident_assignments 
    SET status = ?, updated_at = ?, mod_dt = ?, mod_id = ?
    WHERE user_id = ? AND (inc_id = ? OR inc_id = ?)
  `).bind(status, now, now, user_id || 'SYSTEM', user_id, normId, `INC-${normId}`).run()
  
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

    // 6. 지식화/장애/보고 처리완료 (knowledge_base)
    const kn = await db.prepare("SELECT reg_dt FROM knowledge_base WHERE inc_id = ?").bind(id).first();
    if (kn) steps.push({ id: 'KNOWLEDGE', label: '지식화/장애/보고 처리완료', timestamp: kn.reg_dt, detail: '인시던트 대응 지식이 지식베이스(RAG)에 저장되고 최종 보고 및 장애 처리가 완료되었습니다.' });

    // Step 5 (REPORT) and Step 7 (CLOSE) removed per user request for a cleaner 4-step flow

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
  const rawId = c.req.param('inc_id')
  const normId = String(rawId).replace('INC-', '')
  const db = c.env.DB
  
  const incident = await db.prepare(`
    SELECT i.*, u.name as assignee_name 
    FROM incidents i 
    LEFT JOIN users u ON i.assigned_to = u.employee_id 
    WHERE i.inc_id = ? OR i.inc_id = ?
  `).bind(normId, `INC-${normId}`).first()
  
  if (!incident) return c.json({ error: "Not found" }, 404)
  return c.json({ incident })
})


// User Specific War-Room mapping
app.post('/warroom/leave', async (c) => {
  const { user_id, inc_id } = await c.req.json()
  await c.env.DB.prepare("DELETE FROM user_warrooms WHERE user_id = ? AND inc_id = ?")
    .bind(user_id, String(inc_id)).run()
  return c.json({ status: 'left', user_id, inc_id })
})

app.patch('/incidents/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const rawId = id.startsWith('INC-') ? id.slice(4) : id
  const fullId = `INC-${rawId}`
  const data = await c.req.json()
  const now = getKst()
  
  let finalTitle = data.title;
  if (!finalTitle || finalTitle === 'SMS 장애 감지') {
    const sms = await db.prepare("SELECT message FROM received_messages WHERE inc_id = ?").bind(rawId).first()
    if (sms) finalTitle = `${fullId} | ${sms.message}`
  }

  await db.prepare(`
    UPDATE incidents 
    SET title = COALESCE(?, title),
        description = COALESCE(?, description),
        severity = COALESCE(?, severity),
        status = COALESCE(?, status),
        assigned_to = COALESCE(?, assigned_to),
        mod_dt = ?
    WHERE inc_id = ?
  `).bind(finalTitle || null, data.description || null, data.severity || null, data.status || null, data.assigned_to || null, now, rawId).run()
  
  return c.json({ status: "success", id: rawId, title: finalTitle })
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

// Consolidation: Moved to line 3147

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
  const rawId = String(inc_id).replace('INC-', '')
  const fullId = `INC-${rawId}`

  const existing = await db.prepare("SELECT inc_id FROM incidents WHERE inc_id = ?").bind(rawId).first()
  if (existing) return c.json({ status: 'exists', inc_id: rawId })

  // Fetch actual message from received_messages
  const sms = await db.prepare("SELECT message FROM received_messages WHERE inc_id = ?").bind(rawId).first()
  const msg = sms ? sms.message : (title || 'SMS 장애 감지')
  const finalTitle = `${fullId} | ${msg}`

  const now = getKst()
  await db.prepare(
    `INSERT INTO incidents (
      inc_id, title, description, severity, status, incident_type, source_sms_id, 
      reg_id, reg_dt, mod_id, mod_dt, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    rawId, finalTitle, description, severity, 'OPEN', incident_type, source_sms_id || null, 
    'SYSTEM', now, 'SYSTEM', now, now
  ).run()
  return c.json({ status: 'created', inc_id: rawId, title: finalTitle })
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
    seq: r.seq,
    type: r.type || 'user',
    sender: r.sender,
    role: r.role,
    text: r.text,
    timestamp: r.timestamp,
    read_count: r.read_count || 0,
    reactions: r.reactions || '{}'
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

  // Store file in R2 for better scaling and binary support
  const fileName = file.name || `file_${Date.now()}`
  const fileKey = `warroom/${incident_id}/${seq}/${fileName}`
  const fileBuffer = await file.arrayBuffer()
  
  // Upload to R2 bucket
  await c.env.WARROOM_ASSETS.put(fileKey, fileBuffer, {
    httpMetadata: { contentType: file.type || 'application/octet-stream' }
  })

  // Construct a public URL using the worker's own base
  const fileUrl = `/warroom/asset/${encodeURIComponent(fileKey)}`
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
  const lastChat = await db.prepare("SELECT MAX(seq) as max_seq FROM warroom_chats WHERE inc_id = ?").bind(incident_id).first()
  const chatSeq = (lastChat && lastChat.max_seq) ? lastChat.max_seq + 1 : 1
  const chatText = `[첨부파일]${fileName}|${fileUrl}|${fileType}`

  await db.prepare(
    "INSERT INTO warroom_chats (inc_id, seq, sender, role, type, text, timestamp, reg_id, reg_dt, mod_id, mod_dt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(incident_id, chatSeq, uploaded_by, 'Unknown', 'user', chatText, now, uploaded_by, now, uploaded_by, now).run()

  return c.json({ status: 'uploaded', seq, url: fileUrl, filename: fileName })
})

// Serve attachment file from R2
app.get('/warroom/asset/:key', async (c) => {
  const key = decodeURIComponent(c.req.param('key'))
  const object = await c.env.WARROOM_ASSETS.get(key)
  if (!object) return c.notFound()
  
  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('etag', object.httpEtag)
  headers.set('Access-Control-Allow-Origin', '*')
  
  return new Response(object.body, { headers })
})

// Dify-powered High-Performance Summary
// Consolidated Resolve (Close) an Incident
app.post('/warroom/resolve', async (c) => {
  const { incident_id } = await c.req.json();
  const db = c.env.DB;
  if (!incident_id) return c.json({ error: 'incident_id is required' }, 400);

  const now = getKst();
  const normId = String(incident_id).replace('INC-', '');

  try {
    // 1. Update War-Room Status
    await db.prepare("UPDATE warroom_list SET status = '최종완료', mod_dt = ? WHERE inc_id = ?")
      .bind(now, incident_id).run();

    // 2. Update Incident Status to '처리완료'
    await db.prepare("UPDATE incidents SET status = '처리완료', mod_dt = ? WHERE inc_id = ?")
      .bind(now, normId).run();

    // 3. Update ALL incident assignments to '처리완료' (check both ID formats)
    await db.prepare("UPDATE incident_assignments SET status = '처리완료', updated_at = ?, mod_dt = ?, mod_id = ? WHERE inc_id = ? OR inc_id = ?")
      .bind(now, now, 'SYSTEM', normId, `INC-${normId}`).run();

    return c.json({ success: true, status: '최종완료' });
  } catch (err) {
    console.error('Final resolution error:', err);
    return c.json({ error: err.message }, 500);
  }
});

// Send Formal PDF Report to Team Leader via MailChannels (with Auth)
app.post('/ai/send-report-email', async (c) => {
  const authKey = c.req.header('X-SGuard-Auth');
  if (authKey !== 'my-secret-key') {
    return c.json({ error: '403 Forbidden: Invalid Auth Key' }, 403);
  }

  const formData = await c.req.formData();
  const pdfFile = formData.get('pdf'); // PDF Blob from frontend
  const incident_id = formData.get('incident_id');
  
  if (!pdfFile || !incident_id) {
    return c.json({ error: 'PDF file and incident_id are required' }, 400);
  }

  // Convert PDF Blob to Base64 for MailChannels attachment
  const arrayBuffer = await pdfFile.arrayBuffer();
  const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

  // 1. Prepare Metadata
  const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  const recipientEmail = 'khcho0421@gmail.com'; // Test Target fixed as per user request

  // 2. Prepare MailChannels Request
  const mcRes = await fetch('https://api.mailchannels.net/tx/v1/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{
        to: [{ email: recipientEmail, name: '신한DS 팀장님' }]
      }],
      from: { 
        email: 'reports@sguardai.khcho0421.workers.dev', 
        name: 'S-Guard AI Incident Report' 
      },
      subject: `[S-Guard] 실시간 시스템 분석 보고서 (${incident_id})`,
      content: [
        {
          type: 'text/html',
          value: `
            <div style="font-family: 'Malgun Gothic', Arial, sans-serif; border: 1px solid #d1d5db; padding: 30px; border-radius: 15px; background-color: #f9fafb;">
              <h1 style="color: #111827; border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">신한DS S-Guard 실시간 시스템 분석 보고서</h1>
              <p style="font-size: 14px; color: #4b5563;">본 보고서는 AI War-Room에 의해 자동으로 생성되었으며, 상세 분석 결과가 PDF 파일로 첨부되어 있습니다.</p>
              <div style="background-color: #ffffff; border: 1px solid #e5e7eb; padding: 20px; border-radius: 10px; margin: 20px 0;">
                <p><strong>인시던트 ID:</strong> ${incident_id}</p>
                <p><strong>발송 일시:</strong> ${now} (KST)</p>
                <p><strong>발신처:</strong> S-Guard AI 오케스트레이션 엔진</p>
              </div>
              <p style="font-size: 12px; color: #9ca3af;">※ 본 메일은 보안 구역 내에서 생성된 공식 리포트입니다. 외부 유출에 유의해 주시기 바랍니다.</p>
            </div>
          `
        }
      ],
      attachments: [
        {
          content: pdfBase64,
          filename: `SGuard_Incident_Report_${incident_id}.pdf`,
          type: 'application/pdf',
          disposition: 'attachment'
        }
      ]
    })
  });

  if (!mcRes.ok) {
    const errorText = await mcRes.text();
    return c.json({ error: `MailChannels Failed: ${errorText}` }, 500);
  }

  return c.json({ success: true, message: 'PDF report sent to team leader successfully' });
});

// Register Report to Knowledge Base (with Vectorization)
app.post('/ai/register-knowledge', async (c) => {
  try {
    const body = await c.req.json();
    const { incident_id, title, content, category, tags, user_id } = body;
    const db = c.env.DB;
    const ai = c.env.AI;
    const vectorIndex = c.env.WARROOM_INDEX;

    if (!content || !title) {
      return c.json({ error: 'Title and Content are required for knowledge base' }, 400);
    }

    // Clean content by removing the fixed Dify header message if it exists
    const sanitizedContent = content.replace(/🚀 고속 분석 엔진\(Dify\) 최적화 통신을 시작합니다\.\.\.\s*/g, "").trim();

    // 1. Generate Embeddings using Cloudflare AI
    const embeddings = await ai.run('@cf/baai/bge-small-en-v1.5', { 
      text: [sanitizedContent.substring(0, 3000)] // Limit for embedding stability
    });
    const vector = embeddings.data[0];

    if (!vector) throw new Error('Failed to generate vector embedding');

    // 2. Insert into D1 (knowledge_base table)
    const now = getKst();
    const actor = user_id || 'SYSTEM';

    const result = await db.prepare(`
      INSERT INTO knowledge_base (
        inc_id, title, content, category, tags, reg_id, reg_dt, mod_id, mod_dt, vector
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      incident_id || `manual-${Date.now()}`,
      title,
      sanitizedContent,
      category || '인시던트 요약',
      tags || '',
      actor,
      now,
      actor,
      now,
      vector ? new Float32Array(vector) : null
    ).run();

    const dbInsertId = result.meta.last_row_id;

    // 3. Upsert into Vectorize Index
    if (vectorIndex) {
      await vectorIndex.upsert([{
        id: `kn-${dbInsertId}`,
        values: vector,
        metadata: {
          title,
          incident_id: incident_id || '',
          category: category || 'report'
        }
      }]);
    }

    return c.json({ 
      success: true, 
      message: '보고서가 지식 베이스에 성공적으로 등록되었습니다.',
      knowledge_id: dbInsertId
    });
  } catch (err) {
    console.error('Knowledge registration error:', err);
    return c.json({ error: `지식 등록 실패: ${err.message}` }, 500);
  }
});

// Governance Approval & Knowledge Registration (Dify + Vectorize)
app.post('/ai/governance/approve', async (c) => {
  try {
    const { incident_id, title, content, user_id } = await c.req.json();
    const db = c.env.DB;
    const ai = c.env.AI;
    const vectorIndex = c.env.WARROOM_INDEX;
    const api_key = c.env.DIFY_API_KEY_GOVERNANCE;
    const api_base = c.env.DIFY_API_BASE || 'https://api.dify.ai/v1';

    if (!content || !incident_id) {
      return c.json({ error: 'incident_id and content are required' }, 400);
    }

    // Clean content by removing the fixed Dify header message if it exists
    const cleanContent = (text) => {
      if (!text) return "";
      // Remove the specific Dify optimization message and any leading newlines/spaces it leaves behind
      return text.replace(/🚀 고속 분석 엔진\(Dify\) 최적화 통신을 시작합니다\.\.\.\s*/g, "").trim();
    };

    const sanitizedContent = cleanContent(content);

    // 1. Call Dify Knowledge Registration App (Internal)
    // We send the summary as the query to trigger any registration workflow/processing
    let difyAnswer = '';
    if (api_key) {
      try {
        const difyRes = await fetch(`${api_base}/chat-messages`, {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${api_key}`, 
            'Content-Type': 'application/json' 
          },
          body: JSON.stringify({
            inputs: {},
            query: `REGISTER_KNOWLEDGE: [${incident_id}] ${sanitizedContent}`,
            response_mode: "blocking",
            user: "governance-admin"
          })
        });
        const data = await difyRes.json();
        difyAnswer = data.answer || '';
      } catch (e) {
        console.error('Dify Governance call error:', e.message);
      }
    }

    // 2. Generate Embeddings for Vector DB
    const embeddings = await ai.run('@cf/baai/bge-small-en-v1.5', { 
      text: [sanitizedContent.substring(0, 3000)]
    });
    const vector = embeddings.data[0];

    // 3. Upsert into Vectorize Index
    if (vectorIndex && vector) {
      await vectorIndex.upsert([{
        id: `gov-${incident_id}`,
        values: vector,
        metadata: {
          title: title || `Governance Approved: ${incident_id}`,
          incident_id: incident_id,
          category: 'governance_report'
        }
      }]);
    }

    // 4. Update Incident Status & Knowledge Base in D1
    const now = getKst();
    let embeddingValue = null;
    
    // 🛡️ Robust Embedding Generation with Logging
    if (ai && sanitizedContent) {
      try {
        console.log(`[RAG] Generating embedding for ${incident_id}...`);
        const embeddings = await ai.run('@cf/baai/bge-small-en-v1.5', { 
          text: [sanitizedContent.substring(0, 3000)]
        });
        if (embeddings && embeddings.data && embeddings.data[0]) {
          embeddingValue = new Float32Array(embeddings.data[0]);
          console.log(`[RAG] Embedding generated successfully (Dimension: ${embeddings.data[0].length})`);
        } else {
          console.warn(`[RAG] Embedding generation returned empty data for ${incident_id}`);
        }
      } catch (e) {
        console.error(`[RAG] Embedding generation failed for ${incident_id}:`, e.message);
      }
    }

    // UPSERT Knowledge: Ensure exactly 1 row per inc_id
    const actor = user_id || 'SYSTEM';
    await db.prepare(`
      INSERT INTO knowledge_base (inc_id, title, content, category, reg_id, reg_dt, mod_id, mod_dt, vector)
      VALUES (?, ?, ?, '거버넌스 승인', ?, ?, ?, ?, ?)
      ON CONFLICT(inc_id) DO UPDATE SET
        title = excluded.title,
        content = excluded.content,
        mod_id = excluded.mod_id,
        mod_dt = excluded.mod_dt,
        vector = excluded.vector
    `).bind(
      incident_id, 
      title || `Governance: ${incident_id}`, 
      sanitizedContent, 
      actor,
      now,
      actor,
      now,
      embeddingValue
    ).run();

    // 5. Update Incident Status to '처리완료'
    await db.prepare("UPDATE incidents SET status = '처리완료', updated_at = ? WHERE inc_id = ?")
      .bind(now, incident_id).run();

    const normId = String(incident_id).replace('INC-', '');

    // 6. Update ALL assignments for this incident to '처리완료'
    await db.prepare("UPDATE incident_assignments SET status = '처리완료', updated_at = ?, mod_dt = ?, mod_id = ? WHERE inc_id = ? OR inc_id = ?")
      .bind(now, now, 'SYSTEM', normId, `INC-${normId}`).run();

    // 7. Auto-update War-Room Status here to prevent sync issues
    await db.prepare("UPDATE warroom_list SET status = '최종완료', mod_dt = ? WHERE inc_id = ? OR inc_id = ?")
      .bind(now, normId, `INC-${normId}`).run();

    return c.json({ 
      success: true, 
      message: '거버넌스 최종 승인 및 RAG 데이터베이스 업데이트가 완료되었습니다.',
      dify_response: difyAnswer
    });
  } catch (err) {
    console.error('Governance approval error:', err);
    return c.json({ error: `거버넌스 승인 실패: ${err.message}` }, 500);
  }
});
// -----------------------------------------
//  REPORT LINE MANAGEMENT APIs
// -----------------------------------------

// GET all active users for organization tree
app.get('/api/v1/users/organization', async (c) => {
  const db = c.env.DB;
  try {
    const { results } = await db.prepare(`
      SELECT 
        u.employee_id as id, u.name, u.role, 
        COALESCE(h.name, u.honbu) as honbu, 
        COALESCE(t.name, u.team) as team, 
        u.part, u.position 
      FROM users u
      LEFT JOIN organizations h ON u.honbu = h.code
      LEFT JOIN organizations t ON u.team = t.code
      WHERE u.is_active = 1 
      ORDER BY COALESCE(h.name, u.honbu, 'Z'), COALESCE(t.name, u.team, 'Z'), u.name
    `).all();
    return c.json({ users: results || [] });
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

// GET report lines (Filtered by current user/owner)
app.get('/api/v1/report-lines', async (c) => {
  const db = c.env.DB;
  const owner_id = c.req.query('user_id'); // Passed from frontend or middleware
  
  if (!owner_id) {
    return c.json({ error: 'owner_id (user_id) is required' }, 400);
  }

  try {
    const { results } = await db.prepare(
      "SELECT * FROM report_lines WHERE owner_id = ? ORDER BY hierarchy_level ASC"
    ).bind(owner_id).all();
    return c.json({ report_lines: results || [] });
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

// POST save report lines (Per-user isolation)
app.post('/api/v1/report-lines', async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();
  const lines = body.report_lines || [];
  const owner_id = body.owner_id;
  
  if (!owner_id) {
    return c.json({ error: 'owner_id is required for personalized report lines' }, 400);
  }

  try {
    const stmts = [];
    const now = getKst();
    
    // Only delete lines belonging to the current owner
    stmts.push(db.prepare("DELETE FROM report_lines WHERE owner_id = ?").bind(owner_id));
    
    for (let i = 0; i < lines.length; i++) {
        const ln = lines[i];
        stmts.push(
            db.prepare("INSERT INTO report_lines (owner_id, hierarchy_level, role_name, user_id, user_name, reg_id, reg_dt, mod_id, mod_dt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
            .bind(
                owner_id, 
                i + 1, 
                ln.role_name || '결재자', 
                ln.user_id, 
                ln.user_name || '',
                owner_id, // Setting registrant as the owner themselves
                now,
                owner_id,
                now
            )
        );
    }
    
    await db.batch(stmts);
    return c.json({ success: true, message: '보고 라인이 성공적으로 저장되었습니다.' });
  } catch (err) {
    console.error('Report lines save error:', err);
    return c.json({ error: err.message }, 500);
  }
});


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
// ── Direct Messaging (Notes) ────────────────────────────────────────────────
app.post('/warroom/dm', async (c) => {
  const db = c.env.DB
  const { sender_id, receiver_id, message } = await c.req.json()
  const now = getKst()
  
  if (!sender_id || !receiver_id || !message) {
    return c.json({ error: 'sender_id, receiver_id, and message are required' }, 400)
  }

  const result = await db.prepare(`
    INSERT INTO direct_messages (sender_id, receiver_id, message, created_at, reg_id, reg_dt, mod_id, mod_dt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(sender_id, receiver_id, message, now, sender_id, now, sender_id, now).run()

  return c.json({ status: 'success', id: result.meta.last_row_id })
})

app.get('/warroom/dm/:user_id', async (c) => {
  const db = c.env.DB
  const user_id = c.req.param('user_id')
  const my_id = c.req.query('my_id') // For getting conversation history

  if (my_id) {
    const { results } = await db.prepare(`
      SELECT * FROM direct_messages 
      WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
      ORDER BY created_at ASC
    `).bind(user_id, my_id, my_id, user_id).all()
    return c.json(results || [])
  }

  // Get list of users I've chatted with
  const { results } = await db.prepare(`
    SELECT DISTINCT 
      CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END as other_id
    FROM direct_messages
    WHERE sender_id = ? OR receiver_id = ?
  `).bind(user_id, user_id, user_id).all()
  
  return c.json(results || [])
})

// ── WebSocket & Durable Objects for Real-time Chat ───────────────────────────

export class WarRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map(); // Store active connections: WebSocket -> UserInfo
    this.announcement = null; // Current pinned message
  }

  async fetch(request) {
    const upgradeHeader = request.headers.get("Upgrade");
    if (!upgradeHeader || upgradeHeader.toLowerCase() !== "websocket") {
      return new Response("Expected Upgrade: websocket", { status: 426 });
    }

    const [client, server] = new WebSocketPair();
    await this.handleSession(server);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async handleSession(webSocket) {
    webSocket.accept();
    
    // Initial session setup
    this.sessions.set(webSocket, { online: true });

    webSocket.addEventListener("message", async (msg) => {
      try {
        if (typeof msg.data !== "string") {
          console.warn("Received binary/non-string WebSocket message, ignoring.");
          return;
        }
        const data = JSON.parse(msg.data);
        await this.onMessage(webSocket, data);
      } catch (err) {
        console.error("WebSocket Message Parse Error:", err.message, "Raw Content:", String(msg.data).slice(0, 500));
        webSocket.send(JSON.stringify({ type: "ERROR", message: "Invalid JSON", raw: String(msg.data).slice(0, 100) }));
      }
    });

    const closeHandler = () => {
      const session = this.sessions.get(webSocket);
      if (session) {
        this.sessions.delete(webSocket);
        this.broadcast({ type: "PRESENCE_OUT", user_id: session.user_id });
      }
    };

    webSocket.addEventListener("close", closeHandler);
    webSocket.addEventListener("error", closeHandler);
  }

  async onMessage(ws, data) {
    const session = this.sessions.get(ws);

    switch (data.type) {
      case "JOIN":
        session.user_id = data.user_id;
        session.name = data.name;
        this.broadcast({ type: "PRESENCE_IN", user_id: data.user_id, name: data.name });
        // Send current online list to the new joiner
        const onlineUsers = Array.from(this.sessions.values()).map(s => ({ user_id: s.user_id, name: s.name }));
        ws.send(JSON.stringify({ 
          type: "ONLINE_LIST", 
          users: onlineUsers,
          announcement: this.announcement 
        }));
        break;

      case "CHAT_SEND":
        // 1. Save to D1
        const db = this.env.DB;
        const now = getKst(); 
        const lastRow = await db.prepare("SELECT MAX(seq) as max_seq FROM warroom_chats WHERE inc_id = ?").bind(data.incident_id).first();
        const seq = (lastRow && lastRow.max_seq) ? lastRow.max_seq + 1 : 1;
        
        await db.prepare(
          "INSERT INTO warroom_chats (inc_id, seq, sender, role, type, text, timestamp, reg_id, reg_dt, mod_id, mod_dt, parent_seq, reactions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).bind(
          data.incident_id, seq, data.sender, data.role || 'user', data.msg_type || 'user', data.text, now, data.sender, now, data.sender, now, 
          data.reply_to || null, 
          JSON.stringify({}) // Initial empty reactions
        ).run();

        // 2. Broadcast
        const broadcastMsg = {
          type: "CHAT_MESSAGE",
          msg_id: `${data.incident_id}_${seq}`,
          seq: seq,
          incident_id: data.incident_id,
          sender: data.sender,
          role: data.role,
          text: data.text,
          timestamp: now,
          parent_seq: data.reply_to || null,
          reactions: {}
        };
        this.broadcast(broadcastMsg);

        // 3. AI Indexing (Background task to avoid blocking)
        this.state.waitUntil((async () => {
          try {
            const ai = this.env.AI;
            const index = this.env.WARROOM_INDEX;
            if (ai && index && data.text.length > 5) {
              const { data: embeddings } = await ai.run('@cf/baai/bge-small-en-v1.5', { text: [data.text] });
              await index.upsert([{
                id: `${data.incident_id}_${seq}`,
                values: embeddings[0],
                metadata: { text: data.text, sender: data.sender, incident_id: data.incident_id }
              }]);
            }
          } catch (e) {
            console.error("AI Indexing Error:", e);
          }
        })());
        break;

      case "SUMMARY_REQUEST":
        this.state.waitUntil((async () => {
          const kv = this.env.SMS_STORAGE;
          const lockKey = `lock:summary-ws:${data.incident_id}`;
          
          try {
            // Check Lock
            if (kv) {
              const lock = await kv.get(lockKey);
              if (lock === 'processing') {
                console.log(`[WS] Summary already in progress for ${data.incident_id}. Skipping.`);
                return;
              }
              await kv.put(lockKey, 'processing', { expirationTtl: 60 });
            }

            const ai = this.env.AI;
            const db = this.env.DB;
            const chats = await db.prepare(
              "SELECT sender, text FROM warroom_chats WHERE inc_id = ? ORDER BY seq DESC LIMIT 50"
            ).bind(data.incident_id).all();
            
            if (chats.results.length === 0) {
              if (kv) await kv.delete(lockKey);
              return;
            }
            
            const chatLog = chats.results.reverse().map(c => `${c.sender}: ${c.text}`).join("\n");
            const prompt = `Below is a chat log from an incident war room. Please provide a concise summary (3-4 bullet points) in Korean of the current status, key observations, and any actions taken.\n\nChat Log:\n${chatLog}\n\nSummary (Korean):`;
            
            const response = await ai.run('@cf/meta/llama-3-8b-instruct', { prompt });
            
            this.broadcast({
              type: "AI_SUMMARY",
              incident_id: data.incident_id,
              summary: response.response || response 
            });

            if (kv) await kv.delete(lockKey);
          } catch (e) {
            console.error("AI Summary Error:", e);
            if (kv) await kv.delete(lockKey);
          }
        })());
        break;

      case "DM_SEND":
        // This is a specialized event for real-time DM notification within the warroom
        this.broadcast({
          type: "DM_NOTIFICATION",
          sender_id: data.sender_id,
          sender_name: data.sender_name,
          receiver_id: data.receiver_id,
          message: data.message
        });
        break;

      case "ADD_REACTION":
        const db_react = this.env.DB;
        const chatRow = await db_react.prepare("SELECT reactions FROM warroom_chats WHERE inc_id = ? AND seq = ?")
          .bind(data.incident_id, data.seq).first();
        
        if (chatRow) {
          let reactions = JSON.parse(chatRow.reactions || '{}');
          if (!reactions[data.emoji]) reactions[data.emoji] = [];
          if (!reactions[data.emoji].includes(data.user_id)) {
            reactions[data.emoji].push(data.user_id);
          } else {
            // Toggle off
            reactions[data.emoji] = reactions[data.emoji].filter(id => id !== data.user_id);
          }
          
          await db_react.prepare("UPDATE warroom_chats SET reactions = ? WHERE inc_id = ? AND seq = ?")
            .bind(JSON.stringify(reactions), data.incident_id, data.seq).run();
          
          this.broadcast({
            type: "REACTION_UPDATE",
            incident_id: data.incident_id,
            seq: data.seq,
            reactions: reactions
          });
        }
        break;

      case "MARK_READ":
        this.state.waitUntil((async () => {
          const db = this.env.DB;
          // Decrement read_count in D1
          await db.prepare("UPDATE warroom_chats SET read_count = CASE WHEN read_count > 0 THEN read_count - 1 ELSE 0 END WHERE inc_id = ? AND seq = ?")
            .bind(data.incident_id, data.seq).run();
          
          this.broadcast({
            type: "READ_UPDATE",
            incident_id: data.incident_id,
            seq: data.seq,
            user_id: data.user_id
          });
        })());
        break;

      case "TYPING_START":
        this.broadcast({ type: "TYPING", user_id: data.user_id, name: data.name, is_typing: true }, ws);
        break;

      case "TYPING_STOP":
        this.broadcast({ type: "TYPING", user_id: data.user_id, name: data.name, is_typing: false }, ws);
        break;

        const nowAnnounce = getKst();
        this.announcement = {
          seq: data.seq,
          sender: data.sender,
          text: data.text,
          timestamp: nowAnnounce
        };
        // Sync to D1 warroom_list (as leader_summary for now)
        this.state.waitUntil((async () => {
          await this.env.DB.prepare("UPDATE warroom_list SET leader_summary = ?, mod_dt = ? WHERE inc_id = ?")
            .bind(this.announcement.text, nowAnnounce, data.incident_id).run();
        })());
        this.broadcast({ type: "ANNOUNCEMENT_UPDATE", announcement: this.announcement });
        break;

      case "TOGGLE_BOOKMARK":
        this.state.waitUntil((async () => {
          await this.env.DB.prepare("UPDATE warroom_chats SET is_key_event = ? WHERE inc_id = ? AND seq = ?")
            .bind(data.is_key_event ? 1 : 0, data.incident_id, data.seq).run();
        })());
        this.broadcast({ 
          type: "BOOKMARK_UPDATE", 
          seq: data.seq, 
          is_key_event: !!data.is_key_event 
        });
        break;

      default:
        console.log("Unknown message type:", data.type);
    }
  }

  broadcast(data, excludeWs = null) {
    const msg = JSON.stringify(data);
    for (const [ws, session] of this.sessions.entries()) {
      if (ws === excludeWs) continue;
      try {
        ws.send(msg);
      } catch (e) {
        this.sessions.delete(ws);
      }
    }
  }
}

// ── WebSocket Upgrade Route ──────────────────────────────────────────────────
app.get('/warroom/ws/:id', async (c) => {
  const id = c.req.param('id');
  const doId = c.env.WARROOM_DO.idFromName(id);
  const room = c.env.WARROOM_DO.get(doId);
  return room.fetch(c.req.raw);
});

export default app
