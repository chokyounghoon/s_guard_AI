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
  const { results } = await db.prepare("SELECT * FROM warroom_chats GROUP BY incident_id ORDER BY timestamp DESC LIMIT 20").all()
  return c.json({ rooms: results })
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
  const api_key = c.env.DIFY_API_KEY
  const api_base = c.env.DIFY_API_BASE || 'https://api.dify.ai/v1'

  if (!api_key) {
    return c.json({ response: "DIFY_API_KEY가 설정되지 않았습니다." })
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
  const api_key = c.env.DIFY_API_KEY
  const api_base = c.env.DIFY_API_BASE || 'https://api.dify.ai/v1'

  if (!api_key) return c.json({ error: "DIFY_API_KEY가 설정되지 않았습니다." }, 500)

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

// AI Agent Discussion (SSE) - called when user clicks an SMS
app.get('/ai/agent-discussion/:id', async (c) => {
  const id = c.req.param('id')
  const db = c.env.DB
  const api_key = c.env.DIFY_API_KEY
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
  const { inc_id, title, creator_id, severity } = await c.req.json()
  const db = c.env.DB
  const now = getKst()
  
  await db.prepare(`
    INSERT INTO warroom_list (inc_id, title, creator_id, severity, reg_dt)
    VALUES (?, ?, ?, ?, ?)
  `).bind(inc_id, title, creator_id, severity, now)
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

// Warroom chat post
app.post('/warroom/chat', async (c) => {
  const { incident_id, sender, role, type, text } = await c.req.json()
  const db = c.env.DB
  const now = getKst()
  const senderId = sender || 'anonymous'
  await db.prepare(
    "INSERT INTO warroom_chats (incident_id, sender, role, type, text, timestamp, reg_id, reg_dt, mod_id, mod_dt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(incident_id, senderId, role || senderId, type || 'user', text, now, senderId, now, senderId, now).run()
  return c.json({ status: 'saved' })
})

export default app
