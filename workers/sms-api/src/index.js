import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono()

app.use('*', cors())

// Utility for KST Timestamp
const getKst = () => {
  const now = new Date()
  const kstOffset = 9 * 60 * 60 * 1000
  return new Date(now.getTime() + kstOffset).toISOString().replace('T', ' ').substring(0, 19)
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

  await db.prepare("UPDATE users SET token = ?, mod_dt = ?, mod_id = ? WHERE id = ?")
    .bind(token, now, 'SYSTEM', user.id)
    .run()

  await db.prepare(`
    INSERT INTO login_history (
      user_id, email, ip_address, user_agent, status, login_time, reg_id, reg_dt, mod_id, mod_dt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(user.id, user.email, ip, ua, 'SUCCESS', now, 'SYSTEM', now, 'SYSTEM', now)
    .run()

  return c.json({
    id: user.id, email: user.email, name: user.name, role: user.role,
    company: user.company, honbu: user.honbu, team: user.team,
    token: token
  })
})

app.post('/auth/signup', async (c) => {
  const { email, password, name, company, honbu, team } = await c.req.json()
  const db = c.env.DB

  const existing = await db.prepare("SELECT id FROM users WHERE email = ?").bind(email).first()
  if (existing) {
    return c.json({ detail: "이미 등록된 이메일입니다." }, 400)
  }

  const hashedPassword = await hashPassword(password)
  const regDt = getKst()
  const employeeId = `EMP-${Math.floor(100000 + Math.random() * 900000)}`
  
  const res = await db.prepare(
    `INSERT INTO users (
      email, password_hash, name, company, honbu, team, 
      employee_id, role, is_active, reg_id, reg_dt, mod_id, mod_dt, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    email, hashedPassword, name, company, honbu, team, 
    employeeId, 'user', 1, 'SYSTEM', regDt, 'SYSTEM', regDt, regDt
  ).run()

  return c.json({ status: "success", id: res.meta.last_row_id, employee_id: employeeId })
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
  const users = await db.prepare("SELECT id, email, name, role, company, honbu, team, is_active FROM users").all()
  return c.json(users.results)
})

app.get('/users/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const user = await db.prepare("SELECT id, email, name, role, company, honbu, team, part, subpart, phone, is_active FROM users WHERE id = ?").bind(id).first()
  if (!user) return c.json({ detail: "User not found" }, 404)
  return c.json(user)
})

app.patch('/auth/profile', async (c) => {
  const db = c.env.DB
  const { user_id, name, phone, company, honbu, team, part, subpart } = await c.req.json()
  const modDt = getKst()
  await db.prepare(
    "UPDATE users SET name = ?, phone = ?, company = ?, honbu = ?, team = ?, part = ?, subpart = ?, mod_dt = ?, mod_id = ? WHERE id = ?"
  ).bind(name, phone || null, company || null, honbu || null, team || null, part || null, subpart || null, modDt, 'USER', user_id).run()
  const updated = await db.prepare("SELECT id, email, name, role, company, honbu, team, part, subpart, phone FROM users WHERE id = ?").bind(user_id).first()
  return c.json({ status: "success", user: updated })
})

app.post('/auth/change-password', async (c) => {
  const db = c.env.DB
  const { user_id, old_password, new_password } = await c.req.json()
  const user = await db.prepare("SELECT * FROM users WHERE id = ?").bind(user_id).first()
  
  if (!user || !(await verifyPassword(old_password, user.password_hash))) {
    return c.json({ detail: "현재 비밀번호가 올바르지 않습니다." }, 401)
  }
  
  const hashedNewPassword = await hashPassword(new_password)
  await db.prepare("UPDATE users SET password_hash = ?, mod_dt = ? WHERE id = ?")
    .bind(hashedNewPassword, getKst(), user_id)
    .run()
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

// ==========================================
// 3. SMS Interactions
// ==========================================
app.post('/sms/receive', async (c) => {
  const { sender, message } = await c.req.json()
  const db = c.env.DB
  const now = new Date()
  const kstOffset = 9 * 60 * 60 * 1000
  const kstNow = new Date(now.getTime() + kstOffset)
  const timestamp = kstNow.toISOString().replace('T', ' ').substring(0, 19)
  
  // Create a timestamp-based ID (YYYYMMDDHHMMSSmmm) - same as local PG logic
  const inc_id = parseInt(kstNow.toISOString().replace(/[-:T.Z]/g, '').substring(0, 17))

  // Keyword mock
  const keywords = ['장애', 'CRITICAL', '오류', 'DOWN', '비정상', 'error', 'timeout', 'db', 'cpu']
  const detected = keywords.some(k => message.toLowerCase().includes(k))
  
  let response_msg = null
  if (detected) response_msg = "장애가 감지되었습니다. 담당자에게 전달됩니다."

  await db.prepare(
    "INSERT INTO received_messages (inc_id, sender, message, timestamp, keyword_detected, response_message, reg_id, reg_dt, mod_id, mod_dt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(inc_id, sender, message, timestamp, detected ? 1 : 0, response_msg, 'SYSTEM', timestamp, 'SYSTEM', timestamp).run()

  return c.json({ status: detected ? 'keyword_detected' : 'received', inc_id })
})

app.get('/sms/recent', async (c) => {
  const limit = c.req.query('limit') || 10
  const db = c.env.DB
  const { results } = await db.prepare("SELECT * FROM received_messages ORDER BY inc_id DESC LIMIT ?").bind(limit).all()
  return c.json({ total: results.length, messages: results.map(r => ({ inc_id: r.inc_id, id: r.inc_id, sender: r.sender, message: r.message, timestamp: r.timestamp, keyword_detected: r.keyword_detected })) })
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

app.get('/incidents', async (c) => {
  const db = c.env.DB
  const { results } = await db.prepare("SELECT * FROM incidents ORDER BY created_at DESC").all()
  return c.json(results)
})

app.get('/activity-logs', async (c) => {
  const db = c.env.DB
  const { results } = await db.prepare("SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 20").all()
  return c.json({ logs: results })
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
  const msg = await db.prepare("SELECT * FROM received_messages ORDER BY id DESC LIMIT 1").first()
  
  if (!msg) {
    return c.json({ status: 'active', current_log: { id: 'SYS-000', text: '대기 중...', type: 'info' }, prediction_counts: { critical:0, server:0 }})
  }

  // Optionally check if we have an insight for this latest SMS
  const insight = await db.prepare("SELECT * FROM autopilot_insight WHERE inc_id = ?").bind(msg.inc_id).first()
  
  let insight_text = insight ? insight.content : `🔍 [Insight] SMS 분석 완료: '${msg.message.substring(0,25)}...'`
  
  return c.json({
    status: 'active',
    current_log: { id: `KMS-${msg.inc_id}`, type: 'warning', category: 'server', severity: 'high', text: insight_text, detail: `시간: ${msg.timestamp}` },
    prediction_counts: { critical: 1, server: 2, safety: 0, report: 5 }
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
  const api_key = c.env.DIFY_API_KEY_AGENT || c.env.DIFY_API_KEY
  const api_base = c.env.DIFY_API_BASE || 'https://api.dify.ai/v1'

  if (!api_key) return c.json({ error: "DIFY_API_KEY_AGENT가 설정되지 않았습니다." }, 500)

  const prompt = `다음 SMS 장애 메시지를 지능형 관제 시스템의 입장에서 분석하고, [Security], [DB], [DevOps], [Leader] 관점의 대응 방안을 포함한 종합 리포트를 작성해줘:\n\n발신자: ${sender}\n메시지: ${message}`

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

  const prompt = `다음 SMS 장애 메시지를 분석하여 담당 에이전트별로 대응 방안을 알려주세요:\n\n발신자: ${sms.sender}\n메시지: ${sms.message}\n\n[Security]: 보안 관점 분석\n[DB]: 데이터베이스 관점 분석\n[DevOps]: 서버/인프라 관점 분석\n[Leader]: 종합 의견 및 조치사항`

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
  const { results: wrResults } = await db.prepare("SELECT * FROM warroom_chats WHERE incident_id = ? ORDER BY timestamp ASC").bind(id).all()
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

app.post('/ai/warroom/open', async (c) => {
  const { inc_id, title, creator_id, severity, leader_summary } = await c.req.json()
  const db = c.env.DB
  
  // Prevent duplicate creation
  const existing = await db.prepare("SELECT inc_id FROM warroom_list WHERE inc_id = ?").bind(inc_id).first()
  if (existing) {
    // Update leader_summary if a new value was provided
    if (leader_summary) {
      await db.prepare("UPDATE warroom_list SET leader_summary = ?, mod_dt = ? WHERE inc_id = ?")
        .bind(leader_summary, getKst(), inc_id).run()
    }
    return c.json({ status: 'exists', inc_id })
  }

  const now = getKst()
  
  await db.prepare(`
    INSERT INTO warroom_list (inc_id, title, creator_id, severity, leader_summary, reg_dt)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(inc_id, title, creator_id, severity, leader_summary || '', now)
  .run()
  
  return c.json({ status: 'opened', inc_id })
})

app.post('/ai/report/save', async (c) => {
  const { title, content } = await c.req.json()
  const db = c.env.DB
  await db.prepare("INSERT INTO activity_logs (action, detail, report_type, created_at) VALUES (?, ?, 'AI 리포트', ?)")
    .bind(title, content, getKst())
    .run()
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

  if (body.id) {
    // Update
    await db.prepare(`
      UPDATE knowledge_base 
      SET inc_id = ?, title = ?, content = ?, category = ?, file_url = ?, file_type = ?, tags = ?, mod_id = ?, mod_dt = ?
      WHERE id = ?
    `).bind(
      body.inc_id, body.title, body.content, body.category, body.file_url, body.file_type, body.tags, user_id, now, body.id
    ).run()
    return c.json({ status: 'updated', id: body.id })
  } else {
    // Create
    const result = await db.prepare(`
      INSERT INTO knowledge_base (inc_id, title, content, category, file_url, file_type, tags, reg_id, reg_dt, mod_id, mod_dt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      body.inc_id, body.title, body.content, body.category, body.file_url, body.file_type, body.tags, user_id, now, user_id, now
    ).run()
    return c.json({ status: 'created', id: result.meta.last_row_id })
  }
})

app.delete('/ai/knowledge/:id', async (c) => {
  const id = c.req.param('id')
  const db = c.env.DB
  await db.prepare("DELETE FROM knowledge_base WHERE id = ?").bind(id).run()
  return c.json({ status: 'deleted' })
})

// Incidents create
app.post('/incidents', async (c) => {
  const { code, title, description, severity, incident_type, source_sms_id } = await c.req.json()
  const db = c.env.DB
  const existing = await db.prepare("SELECT inc_id FROM incidents WHERE code = ?").bind(code).first()
  if (existing) return c.json({ status: 'exists', code })
  const now = getKst()
  await db.prepare(
    `INSERT INTO incidents (
      code, title, description, severity, status, incident_type, source_sms_id, 
      reg_id, reg_dt, mod_id, mod_dt, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    code, title, description, severity, 'OPEN', incident_type, source_sms_id || null, 
    'SYSTEM', now, 'SYSTEM', now, now
  ).run()
  return c.json({ status: 'created', code })
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
  const inc = await db.prepare("SELECT description, status FROM incidents WHERE code = ?").bind(id).first()
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

  // Save metadata to warroom_attachments
  await db.prepare(`
    INSERT INTO warroom_attachments (inc_id, seq, filename, original_name, file_type, url, uploaded_by, timestamp, reg_id, reg_dt, mod_id, mod_dt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    incident_id, seq,
    fileKey, fileName,
    file.type || 'application/octet-stream',
    fileUrl, uploaded_by,
    now, uploaded_by, now, uploaded_by, now
  ).run()

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

export default app
