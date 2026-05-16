import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { streamSSE } from 'hono/streaming'
import { secureHeaders } from 'hono/secure-headers'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'

// 🔔 Web Push: SubtleCrypto 기반 직접 구현 (RFC 8291 aes128gcm + VAPID)
function b64urlToBytes(b64url) {
  const pad = '='.repeat((4 - (b64url.length % 4)) % 4);
  const b64 = (b64url + pad).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}
function bytesToB64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
function concatBytes(...arrays) {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) { out.set(a, off); off += a.length; }
  return out;
}

async function generateVapidJWT(endpoint, vapidPublicKeyB64url, vapidPrivateKeyB64url, subject) {
  const { origin } = new URL(endpoint);
  const header = { typ: 'JWT', alg: 'ES256' };
  const payload = { aud: origin, exp: Math.floor(Date.now() / 1000) + 43200, sub: subject };
  const enc = s => btoa(JSON.stringify(s)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const sigInput = `${enc(header)}.${enc(payload)}`;

  const pubBytes = b64urlToBytes(vapidPublicKeyB64url);
  const privBytes = b64urlToBytes(vapidPrivateKeyB64url);
  const jwk = {
    kty: 'EC', crv: 'P-256',
    d: bytesToB64url(privBytes),
    x: bytesToB64url(pubBytes.slice(1, 33)),
    y: bytesToB64url(pubBytes.slice(33, 65)),
  };
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(sigInput));
  return `${sigInput}.${bytesToB64url(sig)}`;
}

async function encryptWebPush(p256dhB64url, authB64url, plaintext) {
  const enc = new TextEncoder();
  const receiverPub = b64urlToBytes(p256dhB64url);
  const authSecret = b64urlToBytes(authB64url);
  const plainBytes = typeof plaintext === 'string' ? enc.encode(plaintext) : plaintext;

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const serverKeyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const serverPubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', serverKeyPair.publicKey));

  const receiverKey = await crypto.subtle.importKey('raw', receiverPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const sharedBits = await crypto.subtle.deriveBits({ name: 'ECDH', public: receiverKey }, serverKeyPair.privateKey, 256);
  const sharedSecret = new Uint8Array(sharedBits);

  // PRK via HKDF (auth extraction)
  const ikmKey = await crypto.subtle.importKey('raw', sharedSecret, 'HKDF', false, ['deriveBits']);
  const authInfo = concatBytes(enc.encode('WebPush: info\0'), receiverPub, serverPubRaw);
  const prk = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: authSecret, info: authInfo }, ikmKey, 256
  ));

  // CEK (16 bytes) + Nonce (12 bytes)
  const prkKey = await crypto.subtle.importKey('raw', prk, 'HKDF', false, ['deriveBits']);
  const cek = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: enc.encode('Content-Encoding: aes128gcm\0') }, prkKey, 128
  ));
  const nonce = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: enc.encode('Content-Encoding: nonce\0') }, prkKey, 96
  ));

  // Encrypt
  const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    aesKey,
    concatBytes(plainBytes, new Uint8Array([2])) // RFC 8291: padding delimiter
  ));

  // Build aes128gcm content
  const rsBytes = new Uint8Array(4);
  new DataView(rsBytes.buffer).setUint32(0, 4096, false);
  return concatBytes(salt, rsBytes, new Uint8Array([serverPubRaw.length]), serverPubRaw, ciphertext);
}

async function sendWebPush(endpoint, p256dh, auth, payloadStr, vapidPublicKey, vapidPrivateKey, vapidSubject) {
  const encrypted = await encryptWebPush(p256dh, auth, payloadStr);
  const jwt = await generateVapidJWT(endpoint, vapidPublicKey, vapidPrivateKey, vapidSubject);
  return fetch(endpoint, {
    method: 'POST',
    headers: {
      'authorization': `vapid t=${jwt},k=${vapidPublicKey}`,
      'content-encoding': 'aes128gcm',
      'content-type': 'application/octet-stream',
      'ttl': '86400',
      'content-length': String(encrypted.byteLength),
    },
    body: encrypted,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// PII 마스킹 유틸리티 - Cloudflare Worker 수신 즉시 비식별화
// ·전화번호 : 010-1234-5678 → 010-****-5678
// ·이메일   : abc@xyz.com  → a**@xyz.com
// ·주민등록 : 900101-1234567 → 900101-*******
// ·한국이름 : ▶ 메시지 수신자 : [홍길동, 김철수] 섹션 내 이름만 마스킹
//             홍길동 → 홍*동 / 김철수 → 김*수 / 이영 → 이*
// ═══════════════════════════════════════════════════════════════════════════
// 한국 이름 1개를 마스킹하는 헬퍼
function maskKoreanName(name) {
  const n = name.trim()
  if (n.length === 0) return n
  if (n.length === 1) return n
  if (n.length === 2) return n[0] + '*'
  return n[0] + '*'.repeat(n.length - 2) + n[n.length - 1]
}

function maskPII(text) {
  if (!text) return text
  let out = String(text)

  // 1. 주민등록번호 (6자리-7자리)
  out = out.replace(/(\d{6})[\s\-]?(\d{7})/g, '$1-*******')

  // 2. 한국 휴대폰 번호 (010/011/016/017/018/019)
  out = out.replace(/(01[016789])[\s\-]?(\d{3,4})[\s\-]?(\d{4})/g, '$1-****-$3')

  // 3. 일반 전화번호 (02, 031, ... 등)
  out = out.replace(/(0\d{1,2})[\s\-](\d{3,4})[\s\-](\d{4})/g, '$1-****-$3')

  // 4. 이메일 주소
  out = out.replace(/([a-zA-Z0-9])[a-zA-Z0-9._%+-]{1,}(@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '$1**$2')

  // 5. \u25b6 \uba54\uc2dc\uc9c0 \uc218\uc2e0\uc790 : [...] \uc139\uc158 \ub0b4 \uc774\ub984\ub9cc \uc815\ubc00 \ub9c8\uc2a4\ud0b9
  // \uc608: \u25b6 \uba54\uc2dc\uc9c0 \uc218\uc2e0\uc790 : [\ud64d\uae38\ub3d9, \uae40\ucca0\uc218] \u2192 [\ud64d*\ub3d9, \uae40*\uc218]
  out = out.replace(
    /(\u25b6\s*\uba54\uc2dc\uc9c0\s*\uc218\uc2e0\uc790\s*:\s*\[)([^\]]*?)(\]|$)/gi,
    (_, prefix, names, suffix) => {
      const masked = names
        .split(/([\s,\uff0c%]+)/)
        .map(token => {
          if (/^[\uAC00-\uD7A3]{1,5}$/.test(token.trim())) {
            return maskKoreanName(token.trim())
          }
          return token
        })
        .join('')
      return prefix + masked + suffix
    }
  )

  return out
}

// 🇰🇷 KST 타임존 헬퍼 (YYYY-MM-DD HH:mm:ss 형식)
function getKst() {
  const now = new Date();
  const kst = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  return kst.toISOString().replace('T', ' ').substring(0, 19);
}

// 🛡️ SECURITY: 기기 지문(Device Fingerprint) 생성 - UA + IP C-Class 해싱
async function generateDeviceHash(c) {
  const ua = c.req.header('user-agent') || 'unknown';
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-real-ip') || '127.0.0.1';
  
  // 유동 IP 대응을 위해 C-Class 대역까지만 사용
  const ipPrefix = ip.split('.').slice(0, 3).join('.');
  const data = `${ua}|${ipPrefix}`;
  
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// 🛡️ SECURITY: 세션 생성 및 Refresh Token 저장 (D1)
async function createAndStoreSession(c, userId) {
  const db = c.env.DB;
  if (!db) return null;

  const refreshToken = crypto.randomUUID();
  const deviceHash = await generateDeviceHash(c);
  // 만료 시간: 1년 (365일)
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);

  try {
    await db.prepare(`
      INSERT INTO user_sessions (id, user_id, refresh_token, device_hash, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(crypto.randomUUID(), userId, refreshToken, deviceHash, expiresAt).run();
    
    return refreshToken;
  } catch (e) {
    console.error(`[Session-Error] Failed to store session for user ${userId}:`, e.message);
    return null;
  }
}

const app = new Hono()

// 🛡️ 엔터프라이즈 보안 헤더 적용 (CSP, XSS, Frame Options 등)
// crossOriginResourcePolicy: false — /warroom/asset/* 경로에서 수동으로 cross-origin 설정
app.use('*', secureHeaders({ crossOriginResourcePolicy: false }))

app.use('*', cors({
  origin: (origin, c) => {
    if (!origin) return null;
    const url = new URL(origin);
    if (
      url.hostname === 'sguard-frontend.pages.dev' || 
      url.hostname.endsWith('.pages.dev') || 
      url.hostname.endsWith('.workers.dev') ||
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1'
    ) {
      return origin;
    }
    return 'https://sguard-frontend.pages.dev';
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Set-Cookie'],
  maxAge: 86400,
  credentials: true,
}))

// ⚡ R2 에셋 경로: secureHeaders()의 same-origin CORP를 cross-origin으로 강제 오버라이드
// (await next() 이후에 실행되므로 secureHeaders보다 나중에 적용됨)
app.use('/warroom/asset/*', async (c, next) => {
  await next();
  c.res.headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
  c.res.headers.set('Access-Control-Allow-Origin', '*');
  c.res.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
})

// 🛡️ SECURITY: Generate and send security alerts to all admins
const sendSecurityAlert = async (c, { type, title, detail, urgency = 'NORMAL' }) => {
  const db = c.env.DB;
  if (!db) return;
  
  const now = getKst();
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-real-ip') || 'unknown';
  const ua = c.req.header('user-agent') || 'unknown';
  
  try {
    // 1. Get all admins
    const { results: admins } = await db.prepare("SELECT employee_id FROM users WHERE is_admin = 1 AND is_active = 1").all();
    if (!admins || admins.length === 0) return;

    // 2. Create alert for each admin in inbox
    for (const admin of admins) {
      await db.prepare(`
        INSERT INTO inbox_items (
          user_id, type, sender_id, sender_name, title, content, preview, urgency, created_at, reg_id, reg_dt, mod_id, mod_dt
        ) VALUES (?, 'SYSTEM', 'SECURITY_BOT', 'SECURITY_WATCH', ?, ?, ?, ?, ?, 'SYSTEM', ?, 'SYSTEM', ?)
      `).bind(
        admin.employee_id,
        `[보안경고] ${title}`,
        `■ 유형: ${type}\n■ 발생시각: ${now}\n■ IP 주소: ${ip}\n■ 디바이스: ${ua}\n\n■ 상세내용:\n${detail}`,
        `${title} 시도가 감지되었습니다.`,
        urgency,
        now, now, now
      ).run();
    }
  } catch (e) {
    console.error('[Security] Alert Failed:', e.message);
  }
};

// 🔒 인증 미들웨어 (Auth Middleware)
const authMiddleware = async (c, next) => {
  const path = c.req.path;
  
  // 🔒 인증 예외 경로 (화이트리스트)
  const isPublic = 
    path === '/' || 
    path === '/auth/login' ||             // 로그인은 자체 검증
    path === '/auth/refresh' ||            // ⚡ Ghost Token 복구 경로 — 자체 토큰 추출 로직 사용
    path === '/auth/logout' ||             // ⚡ 로귰아웃 — 쿠키 삭제 (JWT 불필요)
    path === '/auth/change-password' ||   // ⚡ 기존 비밀번호로 자체 검증 — JWT 불필요
    path === '/auth/verify' || 
    path === '/auth/init' ||
    path === '/auth/signup' ||
    path === '/auth/reset/request' ||
    path === '/auth/reset/verify' || 
    path === '/auth/agree-terms' || 
    path === '/sms/receive' || 
    path === '/retrieval' ||
    path === '/upsert' ||          // ⚡ Dify Knowledge Tool — 자체 DIFY_TOOL_KEY 인증 사용
    path.startsWith('/warroom/asset/') ||  // ⚡ R2 파일 서빙 — <img src> 직접 접근이므로 JWT 불가
    path.startsWith('/warroom/ws/') ||     // ⚡ WebSocket 업그레이드 — 브라우저 SDK 전용 (헤더 불가)
    path.startsWith('/debug/') ||
    path === '/org/tree' ||                // 조직도 공개 참조 데이터 (프로필 편집용)
    path === '/sms/shortcut/keywords' ||   // ⚡ iPhone 단축어 전용 (userId 기반 조회)
    path === '/auth/push-vapid-public' ||  // ⚡ VAPID 공개키 조회 — 서비스워커 사전 등록에 필요
    path.startsWith('/codebook') ||
    (path.startsWith('/sms/') && !path.startsWith('/sms/user-keywords')); // ⚡ SMS 원문 조회 경로 (Public 허용, 단 개인 키워드 제외)
    
  console.log(`[Auth-Access] Path: ${path} | isPublic: ${isPublic}`);

  if (isPublic) {
    console.log(`[Auth-Pass] Public access to: ${path}`);
    return await next();
  }

  // 토큰 추출
  const authHeader = c.req.header('Authorization');
  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else {
    token = c.req.query('token');
  }

  if (!token) {
    return c.json({ detail: '인증 토큰이 누락되었습니다.', code: 'AUTH_TOKEN_MISSING' }, 401);
  }

  const jwtSecret = c.env.JWT_SECRET || 'sguard-jwt-secret-change-me';
  const payload = await verifyJWT(token, jwtSecret);

  if (!payload) {
    return c.json({ detail: '유효하지 않거나 만료된 토큰입니다.', code: 'AUTH_INVALID_TOKEN' }, 401);
  }

  // 사용자 정보를 context에 저장 (JWT의 sub를 employee_id로 매핑하여 호환성 유지)
  const userObj = { ...payload, employee_id: payload.employee_id || payload.sub };
  console.log(`[Auth-Token-Check] Path: ${path} | User: ${userObj.employee_id} | Sub: ${payload.sub}`);
  c.set('user', userObj);
  await next();
};

app.use('*', authMiddleware);

// 🔔 PUSH: Web Push Subscription Routes
app.get('/auth/push-vapid-public', (c) => {
  return c.json({ publicKey: c.env.VAPID_PUBLIC_KEY || '' });
});

app.post('/auth/push-subscribe', async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  const { subscription } = await c.req.json();

  if (!subscription || !subscription.endpoint) {
    return c.json({ error: 'Invalid subscription object' }, 400);
  }

  try {
    await db.prepare(`
      INSERT INTO push_subscriptions (endpoint, user_id, p256dh, auth)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(endpoint) DO UPDATE SET
        user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        mod_dt = CURRENT_TIMESTAMP
    `).bind(
      subscription.endpoint,
      user.employee_id,
      subscription.keys.p256dh,
      subscription.keys.auth
    ).run();

    return c.json({ success: true, message: 'Push subscription saved' });
  } catch (e) {
    console.error('[Push-Subscribe] Error:', e.message);
    return c.json({ error: 'Failed to save subscription' }, 500);
  }
});

app.post('/auth/push-unsubscribe', async (c) => {
  const db = c.env.DB;
  const { endpoint } = await c.req.json();

  try {
    await db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").bind(endpoint).run();
    return c.json({ success: true });
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});

app.post('/auth/push-test', async (c) => {
  const user = c.get('user');
  const userId = user?.employee_id;
  if (!userId) return c.json({ error: 'Auth required' }, 401);

  const payload = {
    title: '[S-Guard] Push Test ✅',
    body: `테스트 알림이 정상적으로 수신되었습니다.\n시각: ${new Date().toLocaleTimeString()}`,
    priority: 100,
    tag: 'test-push',
    url: '/push-diagnostic'
  };

  const results = await sendPushNotification(c, userId, payload);
  return c.json({ success: true, target: userId, results });
});

// ✅ NEW: /push/notify - 특정 사용자에게 푸시 알림 전송 (초대 등)
app.post('/push/notify', async (c) => {
  const sender = c.get('user');
  if (!sender) return c.json({ error: 'Auth required' }, 401);

  const { target_user_id, title, body, url, inc_id, tag, priority } = await c.req.json();
  if (!target_user_id || !title || !body) {
    return c.json({ error: 'target_user_id, title, body required' }, 400);
  }

  const payload = {
    title: title || '[S-Guard] 알림',
    body: body || '',
    url: url || '/',
    inc_id: inc_id || '',
    tag: tag || `notify-${Date.now()}`,
    priority: typeof priority === 'number' ? priority : 0
  };

  const results = await sendPushNotification(c, target_user_id, payload);
  return c.json({ success: true, target: target_user_id, results });
});

// 🔔 PUSH: Web Push Notification Helper
const sendPushNotification = async (c, userId, payload) => {
  const db = c.env.DB;
  if (!db) return [];

  const vapidPublicKey = c.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = c.env.VAPID_PRIVATE_KEY;
  const vapidSubject = 'mailto:admin@chokerslab.store';

  if (!vapidPublicKey || !vapidPrivateKey) {
    console.error('[Push] VAPID keys missing in environment secrets.');
    return [{ error: 'VAPID keys missing' }];
  }

  const results = [];
  try {
    const subscriptions = await db.prepare("SELECT * FROM push_subscriptions WHERE user_id = ?").bind(userId).all();
    
    if (!subscriptions.results || subscriptions.results.length === 0) {
      return [{ error: 'No subscriptions found for user' }];
    }

    for (const sub of subscriptions.results) {
      try {
        const notificationPayload = {
          title:   payload.title    || '[S-GUARD]',
          body:    payload.body     || '새 알림이 수신되었습니다.',
          tag:     payload.tag      || 'sguard-alert',
          url:     payload.url      || '/inbox',
          inc_id:  payload.inc_id   || null,
          priority: payload.priority || 50,
          vibrate: (payload.priority || 50) >= 80 ? [300, 100, 300] : [200, 100, 200]
        };
        const payloadStr = JSON.stringify(notificationPayload);
        console.log('[Push] Sending to', sub.endpoint.substring(0, 40), '| payload:', payloadStr.substring(0, 80));

        const response = await sendWebPush(
          sub.endpoint, sub.p256dh, sub.auth,
          payloadStr,
          vapidPublicKey, vapidPrivateKey, vapidSubject
        );
        const resText = await response.text().catch(() => '');
        console.log('[Push] Response:', response.status, resText.substring(0, 80));

        results.push({
          endpoint: sub.endpoint.substring(0, 30) + '...',
          status: response.status,
          ok: response.ok,
          responseBody: resText.substring(0, 120)
        });

        if (response.status === 410 || response.status === 404) {
          await db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(sub.endpoint).run();
        }
      } catch (err) {
        console.error('[Push] Error:', err.message);
        results.push({ endpoint: sub.endpoint.substring(0, 30) + '...', error: err.message });
      }
    }
  } catch (e) {
    results.push({ error: 'DB Error: ' + e.message });
  }
  return results;
};

// 🛰️ Debug: Push Subscriptions Check
app.get('/debug/push-subscriptions', async (c) => {
  const pass = c.req.query('pass');
  if (pass !== 'verify') return c.json({ error: 'Unauthorized' }, 401);
  
  const db = c.env.DB;
  const { results } = await db.prepare("SELECT user_id, endpoint, mod_dt FROM push_subscriptions").all();
  return c.json({ count: results.length, subscriptions: results });
});

// 🚀 Database One-time Migration Endpoint (Phase 4: Governance & Bypass)
app.get('/debug/db-init', async (c) => {
  const pass = c.req.query('pass');
  
  // 실운영 환경 보호 (특수 암호 pass=verify 가 없을 경우에만 차단)
  if (c.env.ENVIRONMENT === 'production' && pass !== 'verify') {
    return c.json({ error: 'Production environment debug access denied. Use ?pass=verify high-privilege code.' }, 403);
  }
  const db = c.env.DB;
  const results = [];
  
  const columns = [
    { name: 'received_count', type: 'INTEGER DEFAULT 1' },
    { name: 'keyword_detected', type: 'INTEGER DEFAULT 0' },
    { name: 'response_message', type: 'TEXT' },
    { name: 'status', type: "TEXT DEFAULT 'PENDING'" }
  ];

  for (const col of columns) {
    try {
      await db.prepare(`ALTER TABLE received_messages ADD COLUMN ${col.name} ${col.type}`).run();
      results.push({ column: `received_messages.${col.name}`, status: 'Added successfully' });
    } catch (e) {
      results.push({ column: `received_messages.${col.name}`, status: 'Already exists or skip', error: e.message });
    }
  }

  // users 테이블 확장 (Phase 19: Consent & Governance)
  const userColumns = [
    { name: 'reputation_score', type: 'REAL DEFAULT 100.0' },
    { name: 's_point', type: 'REAL DEFAULT 0.0' },
    { name: 'rank_status', type: "TEXT DEFAULT 'Iron Guard'" },
    { name: 'terms_agreed_at', type: 'TEXT' },
    { name: 'terms_agreed_ip', type: 'TEXT' },
    { name: 'terms_version', type: "TEXT DEFAULT 'v1.0'" }
  ];
  for (const col of userColumns) {
    try {
      await db.prepare(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type}`).run();
      results.push({ column: `users.${col.name}`, status: 'Added successfully' });
    } catch (e) { results.push({ column: `users.${col.name}`, status: 'Already exists' }); }
  }

  // knowledge_base 테이블 확장 (Phase 7 & 15 통합 거버넌스)
  const kbColumns = [
    { name: 'status', type: "TEXT DEFAULT 'VERIFIED'" },
    { name: 'vote_count', type: "INTEGER DEFAULT 1" },
    { name: 'tags', type: 'TEXT' },
    { name: 'category', type: 'TEXT' },
    { name: 'version', type: 'INTEGER DEFAULT 1' },
    { name: 'vector', type: 'TEXT' },
    { name: 'fail_count', type: 'INTEGER DEFAULT 0' },
    { name: 'priority_flag', type: 'INTEGER DEFAULT 0' },
    { name: 'priority_score', type: 'REAL DEFAULT 0.0' }
  ];
  for (const col of kbColumns) {
    try {
      await db.prepare(`ALTER TABLE knowledge_base ADD COLUMN ${col.name} ${col.type}`).run();
      results.push({ column: `knowledge_base.${col.name}`, status: 'Added successfully' });
    } catch (e) { results.push({ column: `knowledge_base.${col.name}`, status: 'Already exists' }); }
  }

  // ai_feedback 신규 가버넌스 컬럼 확장 (Phase 15 고도화)
  const feedbackColumns = [
    // 기존 컬럼
    { name: 'status',         type: "TEXT DEFAULT 'PENDING'" },
    { name: 'is_golden',      type: 'INTEGER DEFAULT 0' },
    { name: 'admin_comment',  type: 'TEXT' },
    { name: 'voter_count',    type: 'INTEGER DEFAULT 0' },
    { name: 'audit_log',      type: 'TEXT' },
    // 누락 컬럼 (기존 DB에 없어서 INSERT 시 오류 발생)
    { name: 'incident_id',      type: 'TEXT' },
    { name: 'vector_id',        type: 'TEXT' },
    { name: 'error_category',   type: 'TEXT' },
    { name: 'user_correction',  type: 'TEXT' },
    { name: 'reason',           type: 'TEXT' },
    { name: 'context',          type: 'TEXT' },
    { name: 'point_awarded',    type: 'BOOLEAN DEFAULT FALSE' },
    { name: 'reg_id',           type: "TEXT DEFAULT 'SYSTEM'" },
    { name: 'reg_dt',           type: 'DATETIME' },
    { name: 'mod_id',           type: "TEXT DEFAULT 'SYSTEM'" },
    { name: 'mod_dt',           type: 'DATETIME' },
  ];

  for (const col of feedbackColumns) {
    try {
      await db.prepare(`ALTER TABLE ai_feedback ADD COLUMN ${col.name} ${col.type}`).run();
      results.push({ column: `ai_feedback.${col.name}`, status: 'Added successfully' });
    } catch (e) { results.push({ column: `ai_feedback.${col.name}`, status: 'Already exists' }); }
  }

  // received_messages 중요도 가중치 컬럼 확장 (Phase 10/10.1)
  try {
    await db.prepare("ALTER TABLE received_messages ADD COLUMN priority_flag INTEGER DEFAULT 0").run();
    results.push({ column: "received_messages.priority_flag", status: "Added successfully" });
  } catch (e) {
    results.push({ column: "received_messages.priority_flag", status: "Already exists or skip", error: e.message });
  }
  
  try {
    await db.prepare("ALTER TABLE received_messages ADD COLUMN priority_score REAL DEFAULT 0.0").run();
    results.push({ column: "received_messages.priority_score", status: "Added successfully" });
  } catch (e) {
    results.push({ column: "received_messages.priority_score", status: "Already exists or skip", error: e.message });
  }

  try {
    await db.prepare("ALTER TABLE received_messages ADD COLUMN tags TEXT").run();
    results.push({ column: "received_messages.tags", status: "Added successfully" });
  } catch (e) {
    results.push({ column: "received_messages.tags", status: "Already exists or skip", error: e.message });
  }

  try {
    await db.prepare("ALTER TABLE received_messages ADD COLUMN category TEXT").run();
    results.push({ column: "received_messages.category", status: "Added successfully" });
  } catch (e) {
    results.push({ column: "received_messages.category", status: "Already exists or skip", error: e.message });
  }
  
  // Add inbox_items table check
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS inbox_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,\n        folder TEXT DEFAULT 'INBOX',
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        sender_id TEXT,
        sender_name TEXT,
        title TEXT NOT NULL,
        content TEXT,
        preview TEXT,
        is_read INTEGER DEFAULT 0,
        urgency TEXT DEFAULT 'NORMAL',
        inc_id TEXT,
        action_link TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        reg_id TEXT DEFAULT 'SYSTEM',
        reg_dt DATETIME DEFAULT CURRENT_TIMESTAMP,
        mod_id TEXT DEFAULT 'SYSTEM',
        mod_dt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(employee_id)
      )
    `).run();
    results.push({ table: 'inbox_items', status: 'Created or verified' });
  } catch (e) {
    results.push({ table: 'inbox_items', status: 'Error', error: e.message });
  }

  // Add knowledge_base UNIQUE constraint migration
  try {
    await db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_inc_id ON knowledge_base(inc_id)`).run();
    results.push({ index: 'idx_knowledge_inc_id', status: 'Created or verified' });
  } catch (e) {
    results.push({ index: 'idx_knowledge_inc_id', status: 'Error', error: e.message });
  }

  // 🚀 Trace: Create dify_debug_logs table
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS dify_debug_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        inc_id TEXT,
        api_endpoint TEXT,
        request_payload TEXT,
        response_payload TEXT,
        status_code INTEGER,
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    results.push({ table: 'dify_debug_logs', status: 'Created or verified' });
  } catch (e) {
    results.push({ table: 'dify_debug_logs', status: 'Error', error: e.message });
  }

  // 🚀 Feedback: Create ai_feedback table
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS ai_feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        incident_id TEXT,
        vector_id TEXT,
        query TEXT NOT NULL,
        answer TEXT NOT NULL,
        context TEXT,
        feedback_type TEXT NOT NULL,
        reason TEXT,
        user_correction TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'PENDING',
        is_golden INTEGER DEFAULT 0,
        admin_comment TEXT,
        error_category TEXT,
        reg_id TEXT DEFAULT 'SYSTEM',
        reg_dt DATETIME DEFAULT CURRENT_TIMESTAMP,
        mod_id TEXT DEFAULT 'SYSTEM',
        mod_dt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(employee_id)
      )
    `).run();
    results.push({ table: 'ai_feedback', status: 'Created or verified' });
  } catch (e) {
    results.push({ table: 'ai_feedback', status: 'Error', error: e.message });
  }

  // 🚀 Knowledge History: Create knowledge_history table (Phase 5)
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS knowledge_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kb_id INTEGER NOT NULL,
        previous_content TEXT NOT NULL,
        new_content TEXT NOT NULL,
        admin_id TEXT,
        change_reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(kb_id) REFERENCES knowledge_base(id)
      )
    `).run();
    results.push({ table: 'knowledge_history', status: 'Created or verified' });
  } catch (e) {
    results.push({ table: 'knowledge_history', status: 'Error', error: e.message });
  }

  // 🚀 Phase 18: Infrastructure Hero Leaderboard (user_stats)
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS user_stats (
        user_id TEXT PRIMARY KEY,
        user_name TEXT,
        s_point INTEGER DEFAULT 0,
        contribution_count INTEGER DEFAULT 0,
        rank_level TEXT DEFAULT 'IRON',
        last_active_dt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    results.push({ table: 'user_stats', status: 'Created or verified' });
  } catch (e) { results.push({ table: 'user_stats', status: 'Error', error: e.message }); }

  // knowledge_feedback 컬럼 확장
  try { await db.prepare("ALTER TABLE ai_feedback ADD COLUMN point_awarded BOOLEAN DEFAULT FALSE").run(); } catch(e) {}

  // 🔐 Security: Create login_history table if not exists
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS login_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        email TEXT,
        ip_address TEXT,
        user_agent TEXT,
        status TEXT,
        login_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        reg_id TEXT DEFAULT 'SYSTEM',
        reg_dt DATETIME DEFAULT CURRENT_TIMESTAMP,
        mod_id TEXT DEFAULT 'SYSTEM',
        mod_dt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    results.push({ table: 'login_history', status: 'Created or verified' });
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_login_history_user_id ON login_history(user_id)").run();
  } catch (e) {
    results.push({ table: 'login_history', status: 'Error', error: e.message });
  }

  return c.json({ 
    message: 'Phase 18 Leadboard Infrastructure Ready', 
    results,
    timestamp: getKst()
  });
});

// 🚀 Genesis Protocol: Seed Initial Data
app.get('/debug/seed-initial-data', async (c) => {
  const pass = c.req.query('pass');
  if (c.env.ENVIRONMENT === 'production' && pass !== 'verify') {
    return c.json({ error: 'Production environment debug access denied. Use ?pass=verify high-privilege code.' }, 403);
  }
  const db = c.env.DB;
  const now = getKst();
  
  // 1. Check if empty
  const count = await db.prepare("SELECT COUNT(1) as total FROM received_messages").first('total');
  
  // 2. Insert Seed SMS
  const seedIncId = generateIncId();
  const seedMsg = "[S-GUARD] 04/13 21:00 신한은행(BANK_001) 차세대시스템 DB 응답지연(ORA-00600) 발생건수: 155건 노드: DB_NODE_04";
  
  await db.prepare(`
    INSERT INTO received_messages (
      inc_id, sender, message, employee_id, timestamp, status, received_count,
      service_name, biz_system, error_code, error_message, channel
    ) VALUES (?, '02-1234-5678', ?, 'SYSTEM', ?, 'PENDING', 1, '신한은행', '차세대시스템', 'ORA-00600', 'DB 응답지연', 'SMS')
  `).bind(seedIncId, seedMsg, now).run();
  
  // 3. Trigger Background analysis & Vectorize Sync
  c.executionCtx.waitUntil(performBackgroundAiAnalysis(seedIncId, c.env).catch(e => console.error(e)));
  
  return c.json({
    message: 'Genesis Protocol Launched: Initial Data Seeded',
    inc_id: seedIncId,
    timestamp: now
  });
});

// 🚀 Vectorize Health Check
app.get('/debug/vectorize-stats', async (c) => {
  const pass = c.req.query('pass');
  if (c.env.ENVIRONMENT === 'production' && pass !== 'verify') {
    return c.json({ error: 'Production environment debug access denied. Use ?pass=verify high-privilege code.' }, 403);
  }
  if (!c.env.WARROOM_INDEX) return c.json({ error: 'WARROOM_INDEX binding missing' }, 500);
  
  try {
    const stats = await c.env.WARROOM_INDEX.describe();
    return c.json({
      index: 'sguard-warroom-index',
      dimensions: stats.dimensions,
      count: stats.vectorCount,
      timestamp: getKst()
    });
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});

// Utility to clean message for consistent similarity search (strip headers/timestamps)
const cleanMessageForEmbedding = (text) => {
  if (!text) return '';
  return text
    .replace(/\[Web발신\]/g, '')
    .replace(/\[Web\]/g, '')
    .replace(/\[광고\]/g, '')
    .replace(/\b\d{1,2}\/\d{1,2}\s\d{1,2}:\d{1,2}(?::\d{1,2})?\b/g, '')
    .replace(/\b\d{4}-\d{2}-\d{2}(\s\d{1,2}:\d{1,2}(?::\d{1,2})?)?\b/g, '')
    .replace(/\b\d{2}:\d{2}(?::\d{2})?\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Utility for AI Embeddings
const generateEmbedding = async (text, env) => {
  if (!text || !env.AI) return null;
  try {
    const response = await env.AI.run('@cf/baai/bge-base-en-v1.5', { text: [text] });
    return response?.data?.[0] || null;
  } catch (e) {
    console.error('Embedding error:', e.message);
    return null;
  }
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

// Utility to extract metadata from natural language for Hybrid Search (Phase 4)
const extractSearchMetadata = (text) => {
  if (!text) return {};
  const metadata = {};
  
  // 1. Extract Phone Number (Sender)
  const phoneMatch = text.match(/01[016789][\s\-]?\d{3,4}[\s\-]?\d{4}/);
  if (phoneMatch) metadata.sender = phoneMatch[0].replace(/[\s\-]/g, '');

  // 2. Extract Error Code (e.g., Error 500, ERR_404, etc.)
  const errorMatch = text.match(/(?:Error|ERR|에러|오류|코드)\s?[:\-]?\s?(\d{3,}|[A-Z0-9_]{3,})/i);
  if (errorMatch) metadata.error_code = errorMatch[1].toUpperCase();

  // 3. Extract Date Patterns (어제, 오늘, YYYY-MM-DD)
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const today = new Date(now.getTime() + kstOffset);
  
  if (text.includes('오늘')) {
    metadata.start_date = today.toISOString().split('T')[0] + ' 00:00:00';
    metadata.end_date = today.toISOString().split('T')[0] + ' 23:59:59';
  } else if (text.includes('어제')) {
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    metadata.start_date = yesterday.toISOString().split('T')[0] + ' 00:00:00';
    metadata.end_date = yesterday.toISOString().split('T')[0] + ' 23:59:59';
  }

  // 4. Extract Target System (Keywords)
  const systems = ['A-System', 'B-System', 'Billing', 'Auth', 'S-Auth'];
  for (const sys of systems) {
    if (text.toLowerCase().includes(sys.toLowerCase())) {
      metadata.target_system = sys;
      break;
    }
  }

  // 5. Extract Search Keywords for Title Matching (Phase 6)
  const cleanedText = text.replace(/[^\w\sㄱ-ㅎㅏ-ㅣ가-힣]/g, ' ');
  metadata.keywords = cleanedText.split(/\s+/).filter(w => w.length >= 2);

  return metadata;
}


// 📧 EMAIL: Unified Email Sender (Resend + Brevo Fallback)
const sendEmail = async (c, { to, subject, html, fromName, fromEmail, replyTo }) => {
  const resendApiKey = c.env.RESEND_API_KEY;
  const brevoApiKey = c.env.BREVO_API_KEY;
  
  const mailFrom = fromEmail || 'noreply@chokerslab.store';
  const mailFromName = fromName || 'S-Guard AI Security';

  let success = false;

  // 1. Try Resend First (Primary)
  if (resendApiKey) {
    try {
      const rsRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${resendApiKey}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          from: `${mailFromName} <${mailFrom}>`,
          to: Array.isArray(to) ? to : [to],
          reply_to: replyTo,
          subject,
          html: html + '<br/><br/><div style="font-size:10px; color:#ccc; opacity: 0.5;">(R)</div>'
        })
      });
      if (rsRes.ok) {
        console.log('[Email] Sent via Resend (Primary)');
        success = true;
      } else {
        const errorDetail = await rsRes.text();
        console.warn(`[Email] Resend failed with status ${rsRes.status}: ${errorDetail}`);
      }
    } catch (e) {
      console.error('[Email] Resend Error:', e.message);
    }
  }

  // 2. Try Brevo as Fallback
  if (!success && brevoApiKey) {
    try {
      const bvRes = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': brevoApiKey,
          'x-sib-api-key': brevoApiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sender: { name: mailFromName, email: mailFrom },
          to: (Array.isArray(to) ? to : [to]).map(email => ({ email })),
          replyTo: replyTo ? { email: replyTo } : undefined,
          subject,
          htmlContent: html + '<br/><br/><div style="font-size:10px; color:#ccc; opacity: 0.5;">(B)</div>'
        })
      });
      if (bvRes.ok) {
        console.log('[Email] Sent via Brevo (Fallback)');
        success = true;
      } else {
        const errorDetail = await bvRes.text();
        console.warn(`[Email] Brevo failed with status ${bvRes.status}: ${errorDetail}`);
      }
    } catch (e) {
      console.error('[Email] Brevo Error:', e.message);
    }
  }

  return success;
};


// ==========================================
// AI Background Analysis (Eager Loading)
// ==========================================
const performBackgroundAiAnalysis = async (sms_id, env) => {
  const db = env.DB;
  const kv = env.SMS_STORAGE;
  const api_key = env.DIFY_API_KEY_DASHBOARD || env.DIFY_API_KEY || "app-TSlqmp329iKOzpXUP90iC6Kw";
  const api_base = env.DIFY_API_BASE || 'https://api.dify.ai/v1';
  const FALLBACK_MSG = "분석 품질 향상을 위해 대기 시간(60초)이 초과되었습니다. 일상적인 대화나 모호한 문자는 분석이 생략될 수 있습니다. (장애 인지가 확실한 경우 전문가를 호출해 주세요)";
  let isTechnicalSignal = false; // Will be determined after fetching SMS

  try {
    // 1. Lock check
    const lockKey = `lock:analyze:${sms_id}`;
    if (kv) {
      let lock = await kv.get(lockKey);
      if (lock === 'processing') return;
      await kv.put(lockKey, 'processing', { expirationTtl: 120 });
    }

    let sms = null;
    let attempts = 0;
    while (attempts < 3) {
      sms = await db.prepare("SELECT * FROM received_messages WHERE inc_id = ?").bind(String(sms_id)).first();
      if (sms) break;
      attempts++;
      console.log(`[Background] SMS ${sms_id} not found in D1, retrying... (Attempt ${attempts}/3)`);
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (sms) {
      // Mark as ANALYZING so UI can show a spinner
      await db.prepare("UPDATE received_messages SET status = 'ANALYZING' WHERE inc_id = ?").bind(String(sms_id)).run();
      
      // 🚀 [Activity Log] RAG/AGENT 분석 시작 기록 (중복 방지: 이미 PROCESSING 중이면 생략)
      try {
        const existingLog = await db.prepare("SELECT id FROM activity_logs WHERE inc_id = ? AND type = 'AGENT' AND status = 'PROCESSING'").bind(String(sms_id)).first();
        if (!existingLog) {
          await db.prepare(`
            INSERT INTO activity_logs (inc_id, type, status, message, created_at, reg_id)
            VALUES (?, 'AGENT', 'PROCESSING', 'AI 분석 및 지능형 에이전트 가동 중...', ?, 'SYSTEM')
          `).bind(String(sms_id), getKst()).run();
        }
      } catch (e) { console.error("[Activity-Log-Start] Error:", e.message); }
    }

    if (!sms) {
      console.error(`[Background] Abandoning analysis: SMS ${sms_id} not found after 3 attempts.`);
      if (kv) await kv.delete(lockKey);
      return;
    }

    // 🔍 Identify technical signals (Case-Insensitive)
    const technicalPatterns = [/error/i, /fail/i, /critical/i, /timeout/i, /장애/i, /오류/i, /batch/i];
    isTechnicalSignal = technicalPatterns.some(pattern => pattern.test(sms.message || ''));

    let messageVector = null;
    let cleanedMessage = "";
    if (env.WARROOM_INDEX || env.AI) {
      cleanedMessage = cleanMessageForEmbedding(sms.message || '');
      messageVector = await generateEmbedding(cleanedMessage, env);
      
      if (messageVector && messageVector.length === 768 && env.WARROOM_INDEX) {
        await env.WARROOM_INDEX.upsert([{
          id: `inc-${sms_id}`,
          values: messageVector,
          metadata: {
            inc_id: String(sms_id),
            title: `[과거 장애] ${cleanedMessage.substring(0, 30)}...`,
            sender: sms.sender || 'Unknown',
            timestamp: sms.timestamp,
            text: cleanedMessage.substring(0, 500),
            type: 'raw_sms'
          }
        }]);
        console.log(`[Vectorize] Successfully indexed ${sms_id} (768-dim)`);
      }
    }

    // 2. Cache check — PENDING/ANALYZING 상태면 캐시 무시하고 강제 재분석
    const cached = await db.prepare("SELECT content FROM autopilot_insight WHERE inc_id = ?").bind(String(sms_id)).first();
    if (cached && cached.content) {
      // 캐시가 있어도 SMS가 여전히 PENDING/ANALYZING이면 분석 완료 처리만 하고 스킵
      const smsStatus = await db.prepare("SELECT status FROM received_messages WHERE inc_id = ?").bind(String(sms_id)).first();
      if (!smsStatus || (smsStatus.status !== 'PENDING' && smsStatus.status !== 'ANALYZING')) {
        console.log(`[Background] inc_id=${sms_id} already ANALYZED with cache — skipping.`);
        if (kv) await kv.delete(lockKey);
        return;
      }
      // PENDING/ANALYZING인데 캐시가 있으면 → 상태만 ANALYZED로 업데이트하고 종료
      await db.prepare("UPDATE received_messages SET status = 'ANALYZED' WHERE inc_id = ?").bind(String(sms_id)).run();
      if (kv) await kv.delete(lockKey);
      return;
    }

    // 3. Reuse SMS details for prompt (Already fetched above)

    const detailedInfo = `
[장애 상세 정보]
- 유입채널: ${sms.channel || 'N/A'}
- IF아이디: ${sms.if_id || 'N/A'}
- 서비스명: ${sms.service_name || 'N/A'} (${sms.service_code || 'N/A'})
- 업무시스템: ${sms.biz_system || 'N/A'}
- 에러코드: ${sms.error_code || 'N/A'}
- 에러메시지: ${sms.error_message || 'N/A'}
- 발생건수: ${sms.occurrence_count || '1'}
- 발생서버/노드: ${sms.occurrence_node || 'N/A'}
- 실제발생시각(문자 내 시간): ${sms.occurrence_time || 'N/A'}
- 시스템 장애 접수 시각: ${sms.timestamp}
`;

    const prompt = `당신은 S-GUARD 시스템의 핵심 오케스트레이터이자 지능형 관제 엔진입니다. 사용자가 입력하는 SMS 장애 메시지를 분석하여 실시간 인사이트 제공 및 전문가 에이전트들과 협업하여 최적의 조치 가이드를 도출합니다.

🛠️ 핵심 관리 영역
- S-Autopilot Insight: 수신 문자 분석, 자원 배분
- AI War-Room Log: 워룸 기록 (최초 접수 시각 포함)

👥 전문가 에이전트 그룹 (반드시 아래 4개 에이전트의 의견을 모두 포함할 것)
- Security Agent: 보안 관점의 위협 및 접근 제어 진단
- DB Agent: 데이터베이스, 배치 처리, 데이터 무결성 진단
- DevOps Agent: 인프라, 자원(CPU/MEM), 배포 및 서비스 상태 진단
- Leader Agent: 각 에이전트 의견 종합 및 최종 복구 전략 수립

응답 형식 지침:
1. [S-Autopilot Insight] 섹션은 핵심 요약을 제공하세요.
2. [전문가별 심층 진단] 섹션에서는 각 에이전트별로 '### [Agent Name] Agent:' 헤더를 사용하여 독립된 의견을 작성하세요. (4명 모두 필수 포함)
3. "⚠️ 중요: 전문가의 의견은 핵심만 2~3줄 이내로 간결하게 작성해. 또한 [AI War-Room Log] 섹션의 최초 타임라인 엔트리는 반드시 '시스템 장애 접수 시각'([YYYY-MM-DD HH:mm KST] 형식)을 기준으로 작성해 주세요."

[장애 로그]
발신자: ${sms.sender || 'Unknown'}
메시지: ${sms.message || 'N/A'}
${detailedInfo}`;

    let similarityScore = null;
    let matchedContent = null;
    let matchedTitle = null;
    let similarityReason = null;

    // 4. Vectorize similarity check - Reuse the vector from above
    if (env.WARROOM_INDEX && messageVector) {
      try {
        const simResults = await env.WARROOM_INDEX.query(messageVector, { topK: 1 });
        if (simResults.matches && simResults.matches.length > 0) {
          similarityScore = simResults.matches[0].score;
          const matchId = simResults.matches[0].id;

          if (similarityScore >= 0.7) {
            let kbMatch;
            let sourceDB = "";
            if (matchId.startsWith('kn-')) {
              const qp = matchId.replace('kn-', '');
              kbMatch = await db.prepare("SELECT content, title FROM knowledge_base WHERE id = ?").bind(qp).first();
              sourceDB = "knowledge_base 테이블 (지식베이스)";
            } else {
              const possibleId = matchId.split('_')[0].replace('inc-', '').replace('gov-', '');
              kbMatch = await db.prepare("SELECT content, title FROM knowledge_base WHERE inc_id = ? OR CAST(id AS TEXT) = ?").bind(possibleId, possibleId).first();
              sourceDB = "knowledge_base 테이블 (과거 인시던트 연동)";
            }
            if (kbMatch) {
              matchedContent = kbMatch.content;
              matchedTitle = kbMatch.title;
              
              const matchType = isTechnicalSignal ? "기술 지능형 매칭" : "관제 지식 기반 매칭";
              const inputSnippet = cleanedMessage.length > 150 ? cleanedMessage.substring(0, 150) + "..." : cleanedMessage;
              similarityReason = `[${matchType}] 유사도 분석 완료\n- 출처 DB: ${sourceDB} (매칭 ID: ${matchId})\n- 매칭 기준 항목 제목: ${matchedTitle}\n- 분석에 사용된 입력값: "${inputSnippet}"`;
            }
          }
        }
      } catch (ve) {
        console.error('Vectorize background similarity error:', ve.message);
      }
    }

    let fullOutput = "";
    const now = getKst();

    let resultStatus = 0;
    let resultData = null;

    if (similarityScore !== undefined && similarityScore !== null) {
      // 🚀 Dynamic config from DB: similarity thresholds + alert thresholds
      let technicalThreshold = 0.85, casualThreshold = 0.95, adminThreshold = 0.85;
      let alertCriticalCount = 100, alertMajorCount = 51; // 안전한 기본값 (높게)

      try {
        const configs = await db.prepare(
          "SELECT config_key, config_value FROM system_config WHERE config_key IN ('similarity_threshold_technical','similarity_threshold_casual','similarity_threshold_admin','alert_critical_error_count','alert_major_error_count')"
        ).all();
        configs.results.forEach(c => {
          if (c.config_key === 'similarity_threshold_technical') technicalThreshold = parseFloat(c.config_value);
          if (c.config_key === 'similarity_threshold_casual')    casualThreshold    = parseFloat(c.config_value);
          if (c.config_key === 'similarity_threshold_admin')     adminThreshold     = parseFloat(c.config_value);
          if (c.config_key === 'alert_critical_error_count')     alertCriticalCount = parseFloat(c.config_value);
          if (c.config_key === 'alert_major_error_count')        alertMajorCount    = parseFloat(c.config_value);
        });
      } catch (ce) {
        console.error("[Config] Failed to fetch live thresholds, using defaults.", ce);
      }

      // 🚨 Severity: occurrence_count vs alert-monitor 임계값
      const occCount = Number(sms.occurrence_count) || 1;
      const alertSeverity =
        occCount >= alertCriticalCount ? 'CRITICAL' :
        occCount >= alertMajorCount    ? 'MAJOR'    : 'NORMAL';
      console.log(`[severity] occ=${occCount} critThr=${alertCriticalCount} majThr=${alertMajorCount} → ${alertSeverity}`);

      const effectiveThreshold = isTechnicalSignal ? technicalThreshold : casualThreshold;

      if (similarityScore >= effectiveThreshold && matchedContent) {
        fullOutput = `[지능형 지식 활용] 유사도(${(similarityScore * 100).toFixed(1)}%)가 매우 높음\n\n### ${matchedTitle}\n\n` + matchedContent;
        const rationalePrefix = isTechnicalSignal ? "지능형 장애 지식 매칭" : "고정명 정합 매칭";
        const reasonToSave = similarityReason || rationalePrefix;

        await db.prepare(`
          INSERT INTO autopilot_insight (inc_id, content, severity, reg_id, reg_dt, mod_id, mod_dt, similarity_score, similarity_reason)
          VALUES (?, ?, ?, 'SYSTEM', ?, 'SYSTEM', ?, ?, ?)
          ON CONFLICT(inc_id) DO UPDATE SET
            content=excluded.content, mod_dt=excluded.mod_dt, severity=excluded.severity,
            similarity_score=COALESCE(excluded.similarity_score, autopilot_insight.similarity_score),
            similarity_reason=COALESCE(excluded.similarity_reason, autopilot_insight.similarity_reason)
        `).bind(String(sms_id), fullOutput, alertSeverity, now, now, similarityScore ?? null, reasonToSave).run();

      } else {
        resultStatus = 1; // Mark for Dify fallback
      }
    } else {
      resultStatus = 1;
    }

    if (resultStatus === 1) {
      // 🚀 Log ATTEMPT to trace
      let logId = null;
      try {
        const logRes = await db.prepare(`
          INSERT INTO dify_debug_logs (inc_id, api_endpoint, request_payload)
          VALUES (?, ?, ?)
          RETURNING id
        `).bind(String(sms_id), `${api_base}/chat-messages`, JSON.stringify({ query: prompt })).first();
        logId = logRes?.id;
      } catch (le) {}

      // 1. Chat API — 재시도 로직 포함 (최대 3회, 지수 백오프)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000); // 3회 재시도 고려 타임아웃 연장

      const MAX_RETRIES = 3;
      let lastError = null;
      
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const difyRes = await fetch(`${api_base}/chat-messages`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${api_key}`,
              'Content-Type': 'application/json'
            },
            signal: controller.signal,
            body: JSON.stringify({
              inputs: {
                admin_threshold_value: Number(adminThreshold) || 0.85,
                technical_threshold:   Number(technicalThreshold) || 0.85,
                casual_threshold:      Number(casualThreshold)    || 0.95
              },
              query: prompt,
              response_mode: 'streaming',
              conversation_id: '',
              user: 'sguard-worker-bg'
            })
          });

          resultStatus = difyRes.status;

          if (difyRes.ok) {
            // SSE 스트림 읽기 — answer 이벤트 누적
            const reader = difyRes.body.getReader();
            const decoder = new TextDecoder();
            let lineBuffer = '';
            let accumulated = '';

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              lineBuffer += decoder.decode(value, { stream: true });
              const lines = lineBuffer.split('\n');
              lineBuffer = lines.pop(); // 마지막 미완성 라인 보존

              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed.startsWith('data: ')) continue;
                const dataStr = trimmed.substring(6);
                if (dataStr === '[DONE]') break;
                try {
                  const parsed = JSON.parse(dataStr);
                  if (parsed.event === 'message' || parsed.event === 'agent_message') {
                    accumulated += (parsed.answer || '');
                  }
                  if (parsed.event === 'message_end') break;
                } catch {}
              }
            }

            fullOutput = accumulated;
            console.log(`[Dify Chat Streaming] OK (attempt ${attempt}) — output length: ${fullOutput.length}`);
            lastError = null;
            break; // 성공 시 루프 탈출

          } else {
            let errBody = '';
            try { errBody = await difyRes.text(); } catch {}
            console.warn(`[Dify Chat] Attempt ${attempt}/${MAX_RETRIES} failed ${difyRes.status}: ${errBody.slice(0, 200)}`);
            lastError = { status: difyRes.status, body: errBody };

            // 재시도 가능한 에러에만 대기 후 재시도 (5xx, 429)
            if (attempt < MAX_RETRIES && (difyRes.status >= 500 || difyRes.status === 429)) {
              const delay = difyRes.status === 429 ? 5000 : (attempt * 3000);
              console.log(`[Dify Chat] Retrying in ${delay}ms...`);
              await new Promise(r => setTimeout(r, delay));
            } else {
              break; // 4xx 에러는 재시도 불필요
            }
          }
        } catch (fe) {
          console.error(`[Background Dify] Attempt ${attempt}/${MAX_RETRIES} error:`, fe.message);
          lastError = { status: fe.name === 'AbortError' ? 408 : 500 };
          resultStatus = lastError.status;
          if (attempt < MAX_RETRIES && fe.name !== 'AbortError') {
            await new Promise(r => setTimeout(r, attempt * 3000));
          } else {
            break;
          }
        }
      }

      clearTimeout(timeoutId);

      // 최종 실패 상태 반영
      if (!fullOutput && lastError) {
        resultStatus = lastError.status || 500;
      }

      if (logId) {
        try {
          await db.prepare(`UPDATE dify_debug_logs SET status_code=?, error_message=? WHERE id=?`)
            .bind(resultStatus, !fullOutput ? `Chat failed after ${MAX_RETRIES} attempts: status ${resultStatus}` : null, logId).run();
        } catch {}
      }


      // 🔍 Log Trace Update (Success or Failure)
      if (logId) {
        try {
          await db.prepare(`
            UPDATE dify_debug_logs SET 
              response_payload = ?, 
              status_code = ?,
              error_message = ?
            WHERE id = ?
          `).bind(
            resultData ? JSON.stringify(resultData) : null, 
            resultStatus, 
            resultStatus >= 400 ? `Dify API Failed with status ${resultStatus}` : null,
            logId
          ).run();
        } catch (le) {}
      }

      // 💾 Persist Result to Insight (outside branch)
      if (fullOutput) {
        const difyReason = "S-Guard AI 자체 분석 (임계값 미달)";
        await db.prepare(`
          INSERT INTO autopilot_insight (inc_id, content, severity, reg_id, reg_dt, mod_id, mod_dt, similarity_score, similarity_reason)
          VALUES (?, ?, ?, 'SYSTEM', ?, 'SYSTEM', ?, ?, ?)
          ON CONFLICT(inc_id) DO UPDATE SET
            content=excluded.content, mod_dt=excluded.mod_dt,
            similarity_score=COALESCE(excluded.similarity_score, autopilot_insight.similarity_score),
            similarity_reason=COALESCE(excluded.similarity_reason, autopilot_insight.similarity_reason)
        `).bind(String(sms_id), fullOutput, alertSeverity ?? 'NORMAL', now, now, similarityScore ?? null, difyReason).run();
        await db.prepare("UPDATE received_messages SET status = 'ANALYZED' WHERE inc_id = ?").bind(String(sms_id)).run();
        
        // 🚀 [Activity Log] RAG/AGENT 분석 완료 기록
        try {
          const updateRes = await db.prepare(`
            UPDATE activity_logs SET status = 'SUCCESS', message = 'AI 지능형 분석 및 전문가 진단이 완료되었습니다.', created_at = ?
            WHERE inc_id = ? AND type = 'AGENT' AND status = 'PROCESSING'
          `).bind(getKst(), String(sms_id)).run();
          
          // 만약 위에서 업데이트가 안 되었다면 (신규 건 등) 중복 확인 후 삽입
          if (updateRes.meta.changes === 0) {
            const hasSuccess = await db.prepare("SELECT id FROM activity_logs WHERE inc_id = ? AND type = 'AGENT' AND status = 'SUCCESS'").bind(String(sms_id)).first();
            if (!hasSuccess) {
              await db.prepare(`
                INSERT INTO activity_logs (inc_id, type, status, message, created_at, reg_id)
                VALUES (?, 'AGENT', 'SUCCESS', 'AI 지능형 분석 완료', ?, 'SYSTEM')
              `).bind(String(sms_id), getKst()).run();
            }
          }
        } catch (e) { console.error("[Activity-Log-Success] Error:", e.message); }
      } else {
        // Specific Error Hints based on status
        let errorMsg = FALLBACK_MSG;
        let errorReason = "분석 중 알수없는 오류";


        if (resultStatus === 401) {
          errorMsg = "🤖 AI 엔진 인증 오류: Dify API Key를 확인해 주세요. (워크플로우 HTTP 노드의 인증 설정도 확인이 필요합니다)";
          errorReason = "인증 오류 (401)";
        } else if (resultStatus === 404) {
          errorMsg = "🤖 AI 엔진 엔드포인트 오류: Dify 앱 설정을 확인해 주세요.";
          errorReason = "엔드포인트 오류 (404)";
        } else if (resultStatus === 408) {
          errorMsg = "⚠️ 분석 대기 시간 초과: Dify 시스템이 응답하지 않습니다. 워크플로우 내 'HTTP 요청' 노드의 응답 속도를 확인해 주세요.";
          errorReason = "대기 시간 초과 (408/Timeout)";
        } else if (resultStatus >= 500) {
          errorMsg = "🤖 AI 엔진 서버 오류: Dify 측 서버 상태가 불안정합니다. 잠시 후 다시 시도해 주세요.";
          errorReason = "서버 오류 (5xx)";
        }

        // 🛡️ SECURITY: 기술적 에러는 DB에 저장하지 않고 로그만 남김 (캐시 오염 방지)
        console.error(`[AI Background] Analysis Failed: ${sms_id} - ${errorReason}: ${errorMsg}`);
        // DB 저장을 건너뛰어 대시보드가 항상 신선한 데이터를 요구하게 함
        
        await db.prepare("UPDATE received_messages SET status = 'ERROR' WHERE inc_id = ?").bind(String(sms_id)).run();
        // 🚀 [Activity Log] 실패 기록
        try {
          const failUpdate = await db.prepare(`
            UPDATE activity_logs SET status = 'FAIL', message = 'AI 분석 엔진이 응답하지 않거나 오류가 발생했습니다.', created_at = ?
            WHERE inc_id = ? AND type = 'AGENT' AND status = 'PROCESSING'
          `).bind(getKst(), String(sms_id)).run();
          
          if (failUpdate.meta.changes === 0) {
            const hasFail = await db.prepare("SELECT id FROM activity_logs WHERE inc_id = ? AND type = 'AGENT' AND status = 'FAIL'").bind(String(sms_id)).first();
            if (!hasFail) {
              await db.prepare(`
                INSERT INTO activity_logs (inc_id, type, status, message, created_at, reg_id)
                VALUES (?, 'AGENT', 'FAIL', 'AI 분석 실패', ?, 'SYSTEM')
              `).bind(String(sms_id), getKst()).run();
            }
          }
        } catch (e) {}
      }
    }

    // 🔔 Push는 /sms/receive 라우트에서 이미 처리됨 — 여기서는 중복 발송 방지를 위해 스킵

    if (kv) await kv.delete(lockKey);
  } catch (err) {
    console.error(`[Background] Error analyzing SMS ${sms_id}:`, err);
    await db.prepare("UPDATE received_messages SET status = 'ERROR' WHERE inc_id = ?").bind(String(sms_id)).run();
    // 🚀 [Activity Log] 치명적 오류 기록
    try {
      await db.prepare(`
        UPDATE activity_logs SET status = 'FAIL', message = 'AI 분석 중 치명적 오류가 발생했습니다.', created_at = ?
        WHERE inc_id = ? AND type = 'AGENT' AND status = 'PROCESSING'
      `).bind(getKst(), String(sms_id)).run();
    } catch (e) {}
    
    // Log fatal error to trace
    try {
      await db.prepare(`
        INSERT INTO dify_debug_logs (inc_id, api_endpoint, request_payload, status_code, error_message)
        VALUES (?, 'BG_PROCESS_FATAL', 'CRITICAL_FAILURE', 500, ?)
      `).bind(String(sms_id), err.message).run();
    } catch (le) {}

    if (env.SMS_STORAGE) await env.SMS_STORAGE.delete(`lock:analyze:${sms_id}`);
  }
};

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

// ──────────────────────────────────────────
// POST /auth/init
// 통합 인증 초기화: 사번 확인 + OTP 발송
// ──────────────────────────────────────────
app.post('/auth/init', async (c) => {
  const { employee_id, password, check_only } = await c.req.json();
  const db  = c.env.DB;
  const kv  = c.env.SMS_STORAGE;

  // 1. 사번 유효성 검증
  if (!employee_id || String(employee_id).trim() === '') {
    return c.json({ detail: '사번을 입력해 주세요.' }, 400);
  }
  const empId = String(employee_id).trim();

  // 2. D1 사용자 조회
  const user = await db
    .prepare("SELECT employee_id, email, name, status, password_hash FROM users WHERE employee_id = ?")
    .bind(empId)
    .first();

  if (!user) {
    return c.json({ detail: '등록되지 않은 사번입니다. 관리자에게 문의하세요.', code: 'NOT_FOUND' }, 404);
  }

  if (user.status === 'SUSPENDED') {
    return c.json({ detail: '보안 정책에 의해 사용이 중지된 계정입니다.', code: 'SUSPENDED' }, 403);
  }

  const isNew  = user.status === 'PRE_REGISTERED';
  const mode   = isNew ? 'PRE_REGISTERED' : 'ACTIVE';

  // 3. 이메일 마스킹
  const email = user.email || '';
  const atIdx = email.indexOf('@');
  const maskedEmail = atIdx > 2
    ? email.slice(0, 2) + '***' + email.slice(atIdx)
    : '***@***';

  // [중요] 단순 확인 모드인 경우 여기서 응답 종료 (메일 발송 안 함)
  if (check_only) {
    return c.json({ success: true, mode, masked_email: maskedEmail, name: user.name });
  }

  // 4. 기존 사용자의 경우 비밀번호 수신 여부만 확인 (검증은 최종 단계에서 수행)
  if (!isNew && !password) {
    return c.json({ detail: '비밀번호를 입력해 주세요.', code: 'PASSWORD_REQUIRED' }, 400);
  }

  // 5. 6자리 OTP 생성
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // 6. Resend API로 OTP 메일 발송
  const mailFrom    = 'noreply@chokerslab.store';
  const mailFromName = 'S-Guard AI Security';
  const subject     = isNew
    ? '[S-Guard] 최초 로그인 인증 코드'
    : '[S-Guard] 로그인 인증 코드';
  const htmlBody    = `
    <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#0f172a;color:#e2e8f0;border-radius:12px;">
      <h2 style="color:#38bdf8;margin-bottom:8px;">🛡️ S-Guard AI</h2>
      <p style="margin-bottom:24px;">${user.name || empId}님, ${isNew ? '최초 등록을 위한 인증번호입니다.' : '로그인 인증번호입니다.'}</p>
      <div style="background:#1e293b;border-radius:8px;padding:24px;text-align:center;">
        <span style="font-size:36px;font-weight:700;letter-spacing:10px;color:#38bdf8;">${otp}</span>
      </div>
      <p style="margin-top:20px;font-size:13px;color:#94a3b8;">유효 시간: <strong>3분</strong> / 타인에게 절대 공유하지 마세요.</p>
    </div>
  `;

  // 6. 통합 메일 발송 (Resend -> Brevo Fallback)
  const mailSent = await sendEmail(c, {
    to: user.email,
    subject,
    html: htmlBody,
    fromName: mailFromName,
    fromEmail: mailFrom,
    replyTo: 'khcho0421@gmail.com'
  });

  // 7. 발송 성공 시에만 KV 저장 (3분 TTL)
  if (mailSent && kv) {
    const kvKey = `otp:${empId}`;
    await kv.put(kvKey, otp, { expirationTtl: 180 });
  }

  if (!mailSent) {
    return c.json({ detail: '인증 메일 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.', code: 'MAIL_SEND_FAILED' }, 503);
  }

  return c.json({ success: true, mode, masked_email: maskedEmail });
});

// ──────────────────────────────────────────
// POST /auth/verify-otp
// OTP 검증 (KV에 저장된 코드와 비교)
// ──────────────────────────────────────────
app.post('/auth/verify-otp', async (c) => {
  const { employee_id, otp } = await c.req.json();
  const kv = c.env.SMS_STORAGE;

  if (!employee_id || !otp) {
    return c.json({ detail: '사번과 인증번호를 모두 입력해 주세요.' }, 400);
  }

  const empId  = String(employee_id).trim();
  const kvKey  = `otp:${empId}`;
  const stored = kv ? await kv.get(kvKey) : null;

  if (!stored) {
    return c.json({ detail: '인증번호가 만료되었거나 요청된 적이 없습니다.', code: 'OTP_EXPIRED' }, 400);
  }

  if (stored !== String(otp).trim()) {
    return c.json({ detail: '인증번호가 올바르지 않습니다.', code: 'OTP_MISMATCH' }, 400);
  }

  // 검증 성공 → KV 즉시 삭제 (재사용 방지)
  if (kv) await kv.delete(kvKey);

  // D1에서 mode 확인 후 응답
  const db   = c.env.DB;
  const user = await db
    .prepare("SELECT employee_id, status FROM users WHERE employee_id = ?")
    .bind(empId)
    .first();

  const mode = user?.status === 'PRE_REGISTERED' ? 'PRE_REGISTERED' : 'ACTIVE';

  return c.json({
    code: 'OTP_VERIFIED',
    mode,
    employee_id: empId,
    message: '인증이 완료되었습니다.'
  });
});

// ──────────────────────────────────────────
// ==========================================
// JWT 유틸 (HMAC-SHA256, CF Workers 호환)
// ==========================================
const generateJWT = async (payload, secret, expirySeconds = 28800) => {
  // UTF-8 안전 base64url 인코딩 (한글 등 멀티바이트 문자 지원)
  const encode = (obj) => {
    const json  = JSON.stringify(obj);
    const bytes = new TextEncoder().encode(json);
    return btoa(String.fromCharCode(...bytes))
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  };

  const header  = { alg: 'HS256', typ: 'JWT' };
  const now     = Math.floor(Date.now() / 1000);
  const body    = { ...payload, iat: now, exp: now + expirySeconds };
  const input   = `${encode(header)}.${encode(body)}`;

  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(input));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  return `${input}.${sigB64}`;
};

const verifyJWT = async (token, secret) => {
  try {
    const [headerB64, bodyB64, sigB64] = token.split('.');
    const input = `${headerB64}.${bodyB64}`;
    
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );
    
    const sigBytes = Uint8Array.from(atob(sigB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const ok = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(input));
    
    if (!ok) return null;
    
    // Base64URL decode
    const bodyText = new TextDecoder().decode(Uint8Array.from(atob(bodyB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)));
    const body = JSON.parse(bodyText);
    
    // Expiry check
    if (body.exp && body.exp < Math.floor(Date.now() / 1000)) {
      console.log('[JWT] Token expired');
      return null;
    }
    
    return body;
  } catch (e) {
    console.error('[JWT] Verification failed:', e.message);
    return null;
  }
};

// ──────────────────────────────────────────
// POST /auth/verify
// 통합 인증 완료: OTP 검증 + 비밀번호 처리 + JWT 발급
// Body: { employee_id, otp, password, mode }
// ──────────────────────────────────────────
app.post('/auth/verify', async (c) => {
  try {
  const { employee_id: rawEmpId, otp, password, mode, consent_personal_info, consent_third_party_ai } = await c.req.json();
  const empId = String(rawEmpId || '').replace(/^EMP-/i, '').replace(/^SH-/i, '').trim();
  const db = c.env.DB;
  const jwtSecret = c.env.JWT_SECRET || 'sguard-jwt-secret-change-me';
  const now = getKst();
  
  console.log(`[Auth-Verify-Debug] Verifying user: ${empId}, Mode: ${mode}`);
  const kv  = c.env.SMS_STORAGE;

  if (!empId || !otp) {
    console.error('[Auth-Verify-Fail] Missing employee_id or otp:', { employee_id: !!empId, otp: !!otp });
    return c.json({ detail: '사번과 인증번호는 필수입니다.', code: 'E1' }, 400);
  }

  // 🛡️ Rate Limiting: 인증 시도 보호 (1분당 5회 제한)
  if (kv) {
    const rlKey = `rl:verify:${empId}`;
    const attempts = await kv.get(rlKey);
    if (attempts && parseInt(attempts) >= 5) {
      return c.json({ detail: '인증 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.', code: 'TOO_MANY_REQUESTS' }, 429);
    }
    await kv.put(rlKey, (parseInt(attempts || '0') + 1).toString(), { expirationTtl: 60 });
  }

  // 1. OTP 검증
  const kvKey = `otp:${empId}`;
  const stored = kv ? await kv.get(kvKey) : null;
  
  if (!stored) {
    console.warn(`[OTP-Error] ${empId}: No OTP found in KV (possibly expired)`);
    return c.json({ detail: '인증번호가 만료되었습니다. 다시 요청해 주세요.', code: 'E3' }, 400);
  }
  
  const inputOtp = String(otp || '').trim();
  const serverOtp = String(stored).trim();

  console.log(`[OTP-Audit] ${empId} -> Server: "${serverOtp}", UserInput: "${inputOtp}"`);

  if (serverOtp !== inputOtp) {
    console.warn(`[OTP-Error] ${empId}: Mismatch! Server expected "${serverOtp}" but got "${inputOtp}"`);
    return c.json({ detail: '인증번호가 올바르지 않습니다. 정확히 입력해 주세요.', code: 'E4' }, 400);
  }
  // OTP 즉시 삭제 (재사용 방지)
  if (kv) await kv.delete(kvKey);

  // 2. 사용자 조회
  const user = await db
    .prepare("SELECT * FROM users WHERE employee_id = ?")
    .bind(empId).first();
  if (!user) {
    return c.json({ detail: '사용자를 찾을 수 없습니다.', code: 'NOT_FOUND' }, 404);
  }
  if (user.status === 'SUSPENDED') {
    return c.json({ detail: '사용이 중지된 계정입니다.', code: 'SUSPENDED' }, 403);
  }

  const token = `sguard-token-${empId}`;

  // 3. 신규 사용자 — 비밀번호 설정 + ACTIVE 전환
  if (user.status === 'PRE_REGISTERED') {
    if (!password || password.length < 8) {
      console.error('[Auth-Verify-Fail] New user password invalid:', { hasPassword: !!password, length: password?.length });
      return c.json({ detail: '비밀번호는 8자 이상이어야 합니다.', code: 'E5' }, 400);
    }
    const hashed = await hashPassword(password);
    await db.prepare(`
      UPDATE users SET password_hash=?, status='ACTIVE', token=?,
        last_login_at=?, failed_attempts=0, mod_dt=?, mod_id=?,
        consent_personal_info=?, consent_third_party_ai=?, consent_date=?
      WHERE employee_id=?
    `).bind(
      hashed, 
      token, 
      now, 
      now, 
      empId, 
      consent_personal_info ? 1 : 0, 
      consent_third_party_ai ? 1 : 0, 
      now, 
      empId
    ).run();
  }
  // 4. 기존 사용자 — 비밀번호 검증
  else {
    if (!password) {
      console.error('[Auth-Verify-Fail] Existing user missing password');
      return c.json({ detail: '비밀번호를 입력해 주세요.', code: 'E6' }, 400);
    }
    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      await db.prepare("UPDATE users SET failed_attempts=failed_attempts+1 WHERE employee_id=?").bind(empId).run();
      // 🔐 로그인 실패 기록
      try {
        const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
        const ua = c.req.header('User-Agent') || 'unknown';
        await db.prepare(
          `INSERT INTO login_history 
           (user_id, email, ip_address, user_agent, status, login_time, reg_dt, mod_dt) 
           VALUES (?, ?, ?, ?, 'FAILURE', DATETIME('now', '+9 hours'), DATETIME('now', '+9 hours'), DATETIME('now', '+9 hours'))`
        ).bind(empId, user.email || '', ip, ua).run();
      } catch (err) {
        console.error(`[Auth-Verify-Error] Failed to record login failure:`, err.message);
      }
      return c.json({ detail: '비밀번호가 올바르지 않습니다.', code: 'WRONG_PASSWORD' }, 401);
    }
    await db.prepare(`
      UPDATE users SET token=?, last_login_at=?, failed_attempts=0, mod_dt=?, mod_id=?
      WHERE employee_id=?
    `).bind(token, now, now, empId, empId).run();
  }

  // 5. 최신 사용자 정보 조회
  const updated = await db.prepare("SELECT * FROM users WHERE employee_id=?").bind(empId).first();

  // 6. Access Token 생성 (단기: 15분)
  const jwt = await generateJWT({
    sub:         empId,
    name:        updated.name,
    role:        updated.role,
    is_admin:    updated.is_admin || 0,
    company:     updated.company,
    honbu:       updated.honbu,
    team:        updated.team,
  }, jwtSecret, 1800); // ⚡ Increased to 30 minutes (1800s) for smoother experience

  // 7. Refresh Token 생성 및 D1 저장 (장기: 1년)
  const refreshToken = await createAndStoreSession(c, empId);

  // 8. HttpOnly 쿠키 설정 (hono/cookie 사용으로 호환성 극대화)
  if (refreshToken) {
    setCookie(c, 'sguard_refresh', refreshToken, {
      path: '/',
      httpOnly: true,
      maxAge: 2592000,
      sameSite: 'None',
      secure: true,
    });
  } else {
    console.warn('[Session-Warning] Proceeding without refresh token due to DB error.');
  }

  // 🔐 로그인 성공 기록 (Success path for /auth/verify)
  try {
    const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
    const ua = c.req.header('User-Agent') || 'unknown';
    const kstNow = getKst();
    
    await db.prepare(
      `INSERT INTO login_history 
       (user_id, email, ip_address, user_agent, status, login_time, reg_dt, mod_dt) 
       VALUES (?, ?, ?, ?, 'SUCCESS', ?, ?, ?)`
    ).bind(empId, updated.email || '', ip, ua, kstNow, kstNow, kstNow).run();

    console.log(`[Auth-Verify] Login history recorded for user: ${empId}`);
  } catch (historyErr) {
    console.error(`[Auth-Verify-History-Error] Failed to record login history for ${empId}:`, historyErr.message);
  }

  return c.json({
    ok: true,
    token,                          // 하위 호환성 유지
    access_token:    jwt,           // 🔒 신규: 메모리 저장용 Access Token
    ghost_token:     refreshToken,  // 👻 신규: 장기 세션용
    user: {
      id:              empId,
      employee_id:     empId,
      email:           updated.email,
      name:            updated.name,
      role:            updated.role,
      company:         updated.company,
      honbu:           updated.honbu,
      team:            updated.team,
      part:            updated.part,
      subpart:         updated.subpart,
      phone:           updated.phone,
      position:        updated.position,
      is_admin:        updated.is_admin || 0,
      status:          updated.status,
      profile_picture: updated.profile_picture,
      terms_agreed_at: updated.terms_agreed_at,
    },
    // 하위 호환성: 최상위 레벨 필드도 유지
    id:              empId,
    employee_id:     empId,
    email:           updated.email,
    name:            updated.name,
    role:            updated.role,
    company:         updated.company,
    honbu:           updated.honbu,
    team:            updated.team,
    part:            updated.part,
    subpart:         updated.subpart,
    phone:           updated.phone,
    position:        updated.position,
    is_admin:        updated.is_admin || 0,
    status:          updated.status,
    profile_picture: updated.profile_picture,
    terms_agreed_at: updated.terms_agreed_at,
    });
  } catch (err) {
    console.error('[auth/verify] Fatal Error:', err.message);
    const origin = c.req.header('Origin') || '*';
    return c.json({ 
      detail: `서버 내부 오류가 발생했습니다. (${err.message})`, 
      code: 'INTERNAL_SERVER_ERROR' 
    }, 500, {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true'
    });
  }
});

// POST /auth/set-password
// 신규 사용자(PRE_REGISTERED) 최초 비밀번호 설정
// OTP 검증 완료 후 호출
// ──────────────────────────────────────────
app.post('/auth/set-password', async (c) => {
  const { employee_id, password } = await c.req.json();
  const db = c.env.DB;

  if (!employee_id || !password) {
    return c.json({ detail: '사번과 비밀번호를 모두 입력해 주세요.' }, 400);
  }
  if (password.length < 8) {
    return c.json({ detail: '비밀번호는 8자 이상이어야 합니다.' }, 400);
  }

  const empId = String(employee_id).trim();
  const user = await db
    .prepare("SELECT * FROM users WHERE employee_id = ? AND status = 'PRE_REGISTERED'")
    .bind(empId)
    .first();

  if (!user) {
    return c.json({ detail: '신규 등록 상태의 계정을 찾을 수 없습니다.', code: 'NOT_FOUND' }, 404);
  }

  const hashedPassword = await hashPassword(password);
  const now = getKst();
  const token = `sguard-token-${empId}`;

  await db.prepare(`
    UPDATE users
    SET password_hash = ?, status = 'ACTIVE', token = ?, last_login_at = ?,
        failed_attempts = 0, mod_dt = ?, mod_id = ?
    WHERE employee_id = ?
  `).bind(hashedPassword, token, now, now, empId, empId).run();

  const updated = await db
    .prepare("SELECT * FROM users WHERE employee_id = ?")
    .bind(empId)
    .first();

  return c.json({
    token,
    id: empId,
    employee_id: empId,
    email: updated.email,
    name: updated.name,
    role: updated.role,
    company: updated.company,
    honbu: updated.honbu,
    team: updated.team,
    part: updated.part,
    subpart: updated.subpart,
    phone: updated.phone,
    position: updated.position,
    is_admin: updated.is_admin || 0,
    status: 'ACTIVE',
    profile_picture: updated.profile_picture,
    terms_agreed_at: updated.terms_agreed_at
  });
});

// ─── 역할 기반 허용 경로 조회 헬퍼 ───────────────────────────────────────────
// SUPER_ADMIN / ADMIN 은 null 반환 (모든 경로 허용)
// 그 외 역할은 can_read=1 인 경로 목록 반환
async function fetchUserPermissions(db, roleCode) {
  if (!roleCode) return [];
  const code = roleCode.toUpperCase();
  if (code === 'SUPER_ADMIN' || code === 'ADMIN') return null; // null = 전체 허용
  try {
    const { results } = await db.prepare(`
      SELECT m.path FROM menus m
      INNER JOIN role_permissions rp ON m.id = rp.menu_id AND rp.role_code = ?
      WHERE rp.can_read = 1 AND m.is_active = 1
    `).bind(code).all();
    return results ? results.map(r => r.path) : [];
  } catch (e) {
    console.error('[RBAC] fetchUserPermissions error:', e.message);
    return null; // 오류 시 전체 허용으로 안전 처리
  }
}
// ─────────────────────────────────────────────────────────────────────────────

app.post('/auth/login', async (c) => {
  const { email, employee_id: rawEmpId, password } = await c.req.json();
  const db = c.env.DB;
  
  // 🛡️ 로그인 식별자 정제 (email 또는 employee_id 둘 다 지원)
  const loginId = (email || rawEmpId || '').trim();
  const cleanEmpId = String(rawEmpId || '').replace(/^EMP-/i, '').replace(/^SH-/i, '').trim();
  
  console.log(`[Auth-Login-Debug] Login attempt for: ${loginId} (Cleaned ID: ${cleanEmpId})`);

  if (!loginId || !password) {
    return c.json({ detail: "이메일(또는 사번)과 비밀번호를 입력해 주세요.", code: 'MISSING_CREDENTIALS' }, 400);
  }

  // Find user by email or employee_id (Get status to check)
  const user = await db.prepare(`
    SELECT 
      u.*,
      COALESCE(oc.name, u.company) as company_name, 
      COALESCE(oh.name, u.honbu) as honbu_name, 
      COALESCE(ot.name, u.team) as team_name,
      COALESCE(op.name, u.part) as part_name,
      COALESCE(os.name, u.subpart) as subpart_name
    FROM users u
    LEFT JOIN organizations oc ON u.company = oc.code AND oc.depth = 1
    LEFT JOIN organizations oh ON u.honbu = oh.code AND oh.depth = 2
    LEFT JOIN organizations ot ON u.team = ot.code AND ot.depth = 3
    LEFT JOIN organizations op ON u.part = op.code AND op.depth = 4
    LEFT JOIN organizations os ON u.subpart = os.code AND os.depth = 5
    WHERE (u.email = ? OR u.employee_id = ? OR u.employee_id = ?)
  `)
    .bind(loginId, loginId, cleanEmpId)
    .first()

  if (!user) {
    return c.json({ detail: "이메일(또는 사번) 또는 비밀번호가 올바르지 않습니다." }, 401)
  }

  // 🛡️ 계정 상태 체크 (State Machine Enforcement)
  if (user.status === 'SUSPENDED') {
    return c.json({ 
      detail: "보안 정책에 의해 사용이 중지된 계정입니다. 관리자에게 문의하세요.", 
      code: 'ACCOUNT_SUSPENDED' 
    }, 403);
  }

  if (user.status === 'PRE_REGISTERED') {
    return c.json({ 
      detail: "최초 가입 인증 및 비밀번호 설정이 필요합니다. 사번인증 페이지에서 인증을 완료해 주세요.", 
      code: 'REGISTRATION_REQUIRED' 
    }, 403);
  }

  // ACTIVE 상태인 경우에만 비밀번호 검증 진행
  if (!user.password_hash || !(await verifyPassword(password, user.password_hash))) {
    await db.prepare("UPDATE users SET failed_attempts = failed_attempts + 1 WHERE employee_id = ?").bind(user.employee_id).run();
    // 🔐 로그인 실패 기록
    try {
      const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
      const ua = c.req.header('User-Agent') || 'unknown';
      const nowKst = getKst();
      await db.prepare(
        `INSERT INTO login_history 
         (user_id, email, ip_address, user_agent, status, login_time, reg_dt, mod_dt) 
         VALUES (?, ?, ?, ?, 'FAILURE', ?, ?, ?)`
      ).bind(user.employee_id, user.email || '', ip, ua, nowKst, nowKst, nowKst).run();
    } catch (err) {
      console.error(`[Auth-Error] Failed to record login failure:`, err.message);
    }
    return c.json({ detail: "이메일(또는 사번) 또는 비밀번호가 올바르지 않습니다.", code: 'AUTH_WRONG_PASSWORD' }, 401);
  }

  const jwtSecret = c.env.JWT_SECRET || 'sguard-jwt-secret-change-me';
  
  // 1. Access Token 생성 (15분)
  const jwt = await generateJWT({
    sub:         user.employee_id,
    employee_id: user.employee_id,
    name:        user.name,
    role:        user.role,
    is_admin:    user.is_admin || 0,
    company:     user.company,
  }, jwtSecret, 1800); // ⚡ Increased to 30 minutes (1800s)
  
  // 2. Refresh Token 생성 및 저장
  const refreshToken = await createAndStoreSession(c, user.employee_id);
  
  // 3. 쿠키 설정 (hono/cookie 사용으로 호환성 극대화)
  if (refreshToken) {
    setCookie(c, 'sguard_refresh', refreshToken, {
      path: '/',
      httpOnly: true,
      maxAge: 2592000,
      sameSite: 'None',
      secure: true,
    });
  }

  // 🔐 로그인 성공 기록
  try {
    const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
    const ua = c.req.header('User-Agent') || 'unknown';
    
    // 1. History Insert (KST 보정)
    const kstNow = getKst();
    await db.prepare(
      `INSERT INTO login_history 
       (user_id, email, ip_address, user_agent, status, login_time, reg_dt, mod_dt) 
       VALUES (?, ?, ?, ?, 'SUCCESS', ?, ?, ?)`
    ).bind(user.employee_id, user.email || '', ip, ua, kstNow, kstNow, kstNow).run();

    // 2. Update Last Login Time
    await db.prepare("UPDATE users SET last_login_at = ?, failed_attempts = 0 WHERE employee_id = ?")
      .bind(kstNow, user.employee_id).run();
      
    console.log(`[Auth] Login success and history recorded for user: ${user.employee_id}`);
  } catch (err) {
    console.error(`[Auth-Critical-Error] Failed to record login history for ${user.employee_id}:`, err.message);
  }

  return c.json({ 
    ok: true, 
    user, 
    token: `sguard-token-${user.employee_id}`, 
    access_token: jwt,
    ghost_token: refreshToken,
    allowed_paths: await fetchUserPermissions(db, user.role)
  });
})

app.get('/auth/refresh', async (c) => {
  console.log('[Auth-Debug] Refresh Request Headers:', JSON.stringify(Object.fromEntries(c.req.raw.headers)));
  
  let refreshToken = getCookie(c, 'sguard_refresh');
  
  // 👻 Ghost Token Fallback (Authorization Header)
  if (!refreshToken) {
    const authHeader = c.req.header('Authorization');
    if (authHeader) {
      const match = authHeader.match(/^Bearer\s+(.+)$/i);
      if (match) {
        refreshToken = match[1];
        console.log('[Auth-Debug] Ghost Token extracted from header');
      }
    }
  }

  console.log('[Auth-Debug] Final Refresh Token:', refreshToken ? 'PRESENT' : 'MISSING');

  if (!refreshToken) {
    return c.json({ 
        error: 'No refresh token', 
        code: 'COOKIE_MISSING',
        hint: 'Ghost Token fallback failed too'
    }, 401);
  }

  const db = c.env.DB;
  const jwtSecret = c.env.JWT_SECRET || 'sguard-jwt-secret-change-me';

  try {
    // 1. 세션 조회 및 만료 체크
    const session = await db.prepare(`
      SELECT * FROM user_sessions WHERE refresh_token = ? AND expires_at > DATETIME('now')
    `).bind(refreshToken).first();

    if (!session) {
      console.warn('[Auth-Refresh] Session not found or expired in DB');
      return c.json({ error: 'Invalid or expired session', code: 'SESSION_EXPIRED' }, 401);
    }

    // 2. 🛡️ SECURITY Core: 기기 정보 대조 (소프트 검증 - Ghost Token 호환)
    // Ghost Token 복구 경로에서 헤더/IP 차이로 인한 세션 강제 파기를 방지하기 위해
    // 불일치 시 세션 삭제 대신 경고 로그만 기록합니다.
    const currentDeviceHash = await generateDeviceHash(c);
    if (session.device_hash !== currentDeviceHash) {
      console.warn(`[Security-Soft] Device hash mismatch for user ${session.user_id}. Allowing refresh (Ghost Token compatibility mode).`);
      // NOTE: 강화된 보안이 필요한 경우 아래 주석을 해제하세요 (Ghost Token 비활성화 필요)
      // await db.prepare('DELETE FROM user_sessions WHERE refresh_token = ?').bind(refreshToken).run();
      // deleteCookie(c, 'sguard_refresh', { path: '/', sameSite: 'None', secure: true });
      // return c.json({ error: 'Device changed or unauthorized access detect.', code: 'DEVICE_MISMATCH' }, 403);
    }

    // 3. 사용자 정보 재조회 (최신 상태 및 조직명 매핑 보장)
    const user = await db.prepare(`
      SELECT 
        u.*,
        COALESCE(oc.name, u.company) as company_name, 
        COALESCE(oh.name, u.honbu) as honbu_name, 
        COALESCE(ot.name, u.team) as team_name,
        COALESCE(op.name, u.part) as part_name,
        COALESCE(os.name, u.subpart) as subpart_name
      FROM users u
      LEFT JOIN organizations oc ON u.company = oc.code AND oc.depth = 1
      LEFT JOIN organizations oh ON u.honbu = oh.code AND oh.depth = 2
      LEFT JOIN organizations ot ON u.team = ot.code AND ot.depth = 3
      LEFT JOIN organizations op ON u.part = op.code AND op.depth = 4
      LEFT JOIN organizations os ON u.subpart = os.code AND os.depth = 5
      WHERE u.employee_id = ?
    `).bind(session.user_id).first();

    if (!user || user.status !== 'ACTIVE') {
      return c.json({ error: 'User inactive or not found', code: 'USER_INACTIVE' }, 403);
    }

    // 🔄 세션 갱신 시 마지막 로그인 시간만 업데이트 (login_history 기록 제외)
    try {
      const kstNow = getKst();
      await db.prepare("UPDATE users SET last_login_at = ?, failed_attempts = 0 WHERE employee_id = ?")
        .bind(kstNow, user.employee_id).run();
    } catch (e) {
      console.error(`[Auth-Refresh] Failed to update last_login_at for ${user.employee_id}:`, e.message);
    }

    // 4. 새 Access Token 발급
    const newAccessToken = await generateJWT({
      sub:      user.employee_id,
      name:     user.name,
      role:     user.role,
      is_admin: user.is_admin || 0,
      company:  user.company,
    }, jwtSecret, 1800);

    // 👻 Ghost Token 유지 (기존 리프레시 토큰 재사용 또는 신규 발급)
    // 여기서는 기존 리프레시 토큰을 그대로 ghost_token으로 반환하여 세션 유지
    return c.json({ 
      ok: true, 
      access_token: newAccessToken, 
      ghost_token: refreshToken, 
      user,
      allowed_paths: await fetchUserPermissions(db, user.role)
    });

  } catch (err) {
    console.error('[Auth-Refresh-Fatal]', err.message);
    return c.json({ error: 'Internal server error during refresh', code: 'REFRESH_ERROR' }, 500);
  }
});

// ──────────────────────────────────────────
// POST /auth/logout
// 세션 파기 및 쿠키 삭제
// ──────────────────────────────────────────
app.post('/auth/logout', async (c) => {
  const cookieHeader = c.req.header('Cookie') || '';
  const cookies = Object.fromEntries(cookieHeader.split(';').map(v => v.trim().split('=')));
  const refreshToken = cookies['sguard_refresh'];
  const db = c.env.DB;

  if (refreshToken) {
    await db.prepare('DELETE FROM user_sessions WHERE refresh_token = ?').bind(refreshToken).run();
  }

  c.header('Set-Cookie', 'sguard_refresh=; HttpOnly; Path=/; Max-Age=0; SameSite=None; Secure');
  return c.json({ ok: true, message: 'Logged out' });
});

// 🛡️ API: 세션 유효성 체크 (Navigation Guard용 - D1 실시간 조회)
app.get('/auth/check', async (c) => {
  const payload = c.get('user'); 
  if (!payload || !payload.sub) {
    return c.json({ ok: false, detail: '인증 정보가 없습니다.', code: 'AUTH_NO_PAYLOAD' }, 401);
  }

  const db = c.env.DB;
  const empId = payload.sub;

  // D1 데이터베이스에서 실시간 상태 및 정보 대조
  const user = await db
    .prepare("SELECT employee_id, email, name, status, role, is_admin, company, honbu, team, position, profile_picture, s_point, rank_status, terms_agreed_at FROM users WHERE employee_id = ?")
    .bind(empId)
    .first();

  if (!user) {
    return c.json({ ok: false, detail: '존재하지 않는 사용자입니다.' }, 401);
  }

  if (user.status !== 'ACTIVE') {
    return c.json({ ok: false, detail: '비활성화된 계정입니다.', code: user.status }, 401);
  }

  // 성공 시 최신 사용자 정보 반환
  return c.json({ 
    ok: true, 
    user: {
      id: user.employee_id,
      employee_id: user.employee_id,
      email: user.email,
      name: user.name,
      role: user.role,
      company: user.company,
      honbu: user.honbu,
      team: user.team,
      position: user.position,
      is_admin: user.is_admin,
      s_point: user.s_point || 0,
      rank_status: user.rank_status || 'IRON',
      terms_agreed_at: user.terms_agreed_at, // ⚖️ Phase 19 fix
      status: user.status,
      profile_picture: user.profile_picture
    }
  });
});

app.post('/auth/signup', async (c) => {
  const body = await c.req.json()
  const { email, password, name, company, honbu, team, part, subpart, phone, employee_id, position, os_type, role } = body
  const db = c.env.DB
  
  console.log('[Signup Search] employee_id:', employee_id);

  if (!employee_id) {
    return c.json({ detail: "사번(Employee ID)은 필수 입력 항목입니다." }, 400)
  }

  const existing = await db.prepare("SELECT employee_id FROM users WHERE email = ? OR employee_id = ?").bind(email, employee_id).first()
  if (existing) {
    return c.json({ detail: "이미 등록된 이메일 또는 사번입니다." }, 400)
  }

  const hashedPassword = await hashPassword(password)
  const regDt = getKst()
  const token = Math.random().toString(36).substring(2) + Date.now().toString(36)
  
  // ── 사번(Employee ID) 정제: 'EMP-' 등 접두사 강제 제거 (Type-safe) ──
  const cleanEmpId = String(employee_id || '').replace(/^EMP-/i, '').replace(/^SH-/i, '').trim()
  
  const finalPhone = (phone || '').trim();
  const finalRole = role || 'analyst';
  
  const res = await db.prepare(
    `INSERT INTO users (
      email, password_hash, name, company, honbu, team, part, subpart, phone, os_type,
      employee_id, position, role, is_active, is_admin, token, status,
      reg_id, reg_dt, mod_id, mod_dt, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    email, hashedPassword, name, company, honbu || '', team || '', part || '', subpart || '', finalPhone, os_type || 'android',
    cleanEmpId, position || 'POS_001', finalRole, 1, 0, token, 'ACTIVE',
    cleanEmpId, regDt, cleanEmpId, regDt, regDt
  ).run()

  const userId = res.meta.last_row_id
  console.log('[Signup Success] New user ID:', userId);

  // 🔐 회원가입 성공 이력 기록
  try {
    const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
    const ua = c.req.header('User-Agent') || 'unknown';
    const kstNow = getKst();
    await db.prepare(
      `INSERT INTO login_history 
       (user_id, email, ip_address, user_agent, status, login_time, reg_dt, mod_dt) 
       VALUES (?, ?, ?, ?, 'SIGNUP_SUCCESS', ?, ?, ?)`
    ).bind(cleanEmpId, email || '', ip, ua, kstNow, kstNow, kstNow).run();
  } catch (e) {
    console.error(`[Signup-History-Error] Failed to log signup for ${cleanEmpId}:`, e.message);
  }

  return c.json({ 
    status: "success", 
    debug_v: "20240328_final", // 배포 여부 확인용 버전 플래그
    token: token,
    user: {
      id: cleanEmpId, // Return cleaned employee_id as id
      email,
      name,
      role: finalRole,
      company,
      honbu: honbu || '',
      team: team || '',
      part: part || '',
      subpart: subpart || '',
      phone: finalPhone,
      employee_id: cleanEmpId,
      position: position || 'POS_001',
      profile_picture: null,
      is_admin: 0,
      terms_agreed_at: null, // ⚖️ New signup: Always null
      numeric_id: userId
    }
  })
})

// 🛡️ API: 관리자 전용 사용자 생성
app.post('/admin/users', async (c) => {
  const body = await c.req.json()
  const { 
    email, name, employee_id, phone, os_type, role, password,
    company, honbu, team, part, subpart 
  } = body
  const db = c.env.DB
  
  if (!employee_id || !email || !name) {
    return c.json({ detail: "이름, 사번, 이메일은 필수 입력 항목입니다." }, 400)
  }

  // 1. 중복 확인
  const existing = await db.prepare("SELECT employee_id FROM users WHERE email = ? OR employee_id = ?")
    .bind(email, employee_id)
    .first()
  if (existing) {
    return c.json({ detail: "이미 등록된 이메일 또는 사번입니다." }, 400)
  }

  const cleanEmpId = String(employee_id || '').replace(/^EMP-/i, '').replace(/^SH-/i, '').trim()
  const hashedPassword = password ? await hashPassword(password) : null
  const status = password ? 'ACTIVE' : 'PRE_REGISTERED'
  const regDt = getKst()
  const token = Math.random().toString(36).substring(2) + Date.now().toString(36)

  // 2. 관리자 등록 처리
  try {
    await db.prepare(
      `INSERT INTO users (
        email, password_hash, name, company, honbu, team, part, subpart, phone, os_type,
        employee_id, role, is_active, is_admin, token, status,
        reg_id, reg_dt, mod_id, mod_dt, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      email, hashedPassword, name, company || '', honbu || '', team || '', part || '', subpart || '', phone || '', os_type || 'android',
      cleanEmpId, role || 'viewer', 1, 0, token, status,
      'admin', regDt, 'admin', regDt, regDt
    ).run()

    return c.json({ ok: true, detail: "사용자가 성공적으로 등록되었습니다." })
  } catch (err) {
    console.error('[Admin User Create Error]', err)
    return c.json({ detail: "사용자 등록 중 서버 오류가 발생했습니다." }, 500)
  }
})

// 🛡️ API: 사용자 영구 삭제
app.delete('/users/:employee_id', async (c) => {
  const employee_id = c.req.param('employee_id')
  const db = c.env.DB
  
  if (!employee_id) return c.json({ detail: "사번이 지정되지 않았습니다." }, 400);

  try {
    const res = await db.prepare("DELETE FROM users WHERE employee_id = ?").bind(employee_id).run()
    if (res.meta.changes === 0) {
      return c.json({ detail: "삭제할 사용자를 찾을 수 없습니다." }, 404)
    }
    return c.json({ ok: true, detail: "사용자가 성공적으로 삭제되었습니다." })
  } catch (err) {
    console.error('[User Delete Error]', err)
    return c.json({ detail: "사용자 삭제 중 서버 오류가 발생했습니다." }, 500)
  }
})

app.post('/auth/reset/request', async (c) => {
  const { employee_id } = await c.req.json()
  const db = c.env.DB
  
  if (!employee_id) return c.json({ detail: "사번이 필요합니다." }, 400);

  const user = await db.prepare("SELECT * FROM users WHERE employee_id = ?").bind(employee_id.trim()).first()
  if (!user) {
    return c.json({ detail: "가입 정보가 없거나 사번이 일치하지 않습니다.", code: 'NOT_FOUND' }, 404)
  }

  const email = user.email;
  const code = Math.floor(100000 + Math.random() * 900000).toString()
  await db.prepare("INSERT INTO reset_verifications (email, code, created_at, is_verified) VALUES (?, ?, ?, 0)")
    .bind(email, code, getKst())
    .run()

  // 🛡️ 이메일 마스킹 처리 (프론트엔드 전달용)
  const [userPart, domainPart] = email.split('@');
  const maskedEmail = userPart.slice(0, 2) + '*'.repeat(userPart.length - 2) + '@' + domainPart;

  // 🛡️ 통합 메일 발송 (Resend -> Brevo Fallback)
  await sendEmail(c, {
    to: user.email,
    subject: '[S-Guard] 비밀번호 초기화 인증 코드',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#0f172a;color:#e2e8f0;border-radius:12px;">
        <h2 style="color:#38bdf8;margin-bottom:8px;">🛡️ 비밀번호 초기화</h2>
        <p style="margin-bottom:24px;">${user.name || employee_id}님, 요청하신 비밀번호 초기화를 위한 인증번호입니다.</p>
        <div style="background:#1e293b;border-radius:8px;padding:24px;text-align:center;">
          <span style="font-size:36px;font-weight:700;letter-spacing:10px;color:#38bdf8;">${code}</span>
        </div>
        <p style="margin-top:20px;font-size:13px;color:#94a3b8;">본인이 요청하지 않았다면 보안 담당자에게 즉시 연락 바랍니다.</p>
      </div>
    `,
    fromName: 'S-Guard AI 보안팀'
  });

  return c.json({ status: "success", message: `인증코드가 발송되었습니다. 수신함을 확인해 주세요.`, masked_email: maskedEmail })
})

app.post('/auth/reset/verify', async (c) => {
  const { employee_id, code, password } = await c.req.json()
  const db = c.env.DB

  if (!employee_id || !code) return c.json({ detail: "필수 정보가 누락되었습니다." }, 400);

  // 1. 사번으로 이메일 조회
  const userRecord = await db.prepare("SELECT email, name FROM users WHERE employee_id = ?").bind(employee_id.trim()).first()
  if (!userRecord) return c.json({ detail: "사용자를 찾을 수 없습니다." }, 404);
  const email = userRecord.email;

  const record = await db.prepare("SELECT * FROM reset_verifications WHERE email = ? AND code = ? AND is_verified = 0 ORDER BY inc_id DESC LIMIT 1")
    .bind(email, code)
    .first()

  if (!record) {
    return c.json({ detail: "인증 코드가 올바르지 않거나 만료되었습니다." }, 400)
  }
  
  await db.prepare("UPDATE reset_verifications SET is_verified = 1 WHERE inc_id = ?").bind(record.inc_id).run()

  const modDt = getKst()
  
  // 패스워드 제공 시 해당 패스워드로 업데이트, 미제공 시 기존 로직(임시번호) 유지 가능하나 
  // 여기서는 명시적으로 제공된 패스워드 처리를 우선함
  if (password) {
    const hashedPw = await hashPassword(password)
    await db.prepare("UPDATE users SET password_hash = ?, mod_dt = ?, mod_id = ?, status = 'ACTIVE' WHERE employee_id = ?")
      .bind(hashedPw, modDt, 'SYSTEM', employee_id.trim())
      .run()

    // 🛡️ 성공 안내 메일 발송
    await sendEmail(c, {
      to: email,
      subject: '[S-Guard] 비밀번호 변경 완료 안내',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#0f172a;color:#e2e8f0;border-radius:12px;">
          <h2 style="color:#22c55e;margin-bottom:8px;">✅ 비밀번호 변경 완료</h2>
          <p style="margin-bottom:24px;">${userRecord.name || '사용자'}님, 요청하신 비밀번호 변경이 성공적으로 완료되었습니다.</p>
          <div style="padding:16px;background:rgba(34, 197, 94, 0.1);border-radius:8px;font-size:13px;color:#4ade80;">
            이제 새로운 비밀번호로 시스템에 로그인하실 수 있습니다. 본인이 요청한 작업이 아니라면 즉시 보안팀에 문의하세요.
          </div>
        </div>
      `,
      fromName: 'S-Guard AI 보안팀'
    });
    return c.json({ status: "success", message: "Password updated successfully" })
  } else {
    // 하위 호환성을 위해 임시 비번 로직 유지
    const temp_password = "T" + Math.floor(100000 + Math.random() * 900000).toString() + "!"
    const hashedTempPassword = await hashPassword(temp_password)
    
    await db.prepare("UPDATE users SET password_hash = ?, mod_dt = ?, mod_id = ? WHERE employee_id = ?")
      .bind(hashedTempPassword, modDt, 'SYSTEM', employee_id.trim())
      .run()

    await sendEmail(c, {
      to: email,
      subject: '[S-Guard] 임시 비밀번호 발급 안내',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#0f172a;color:#e2e8f0;border-radius:12px;">
          <h2 style="color:#ef4444;margin-bottom:8px;">⚠️ 임시 비밀번호 발급</h2>
          <p style="margin-bottom:24px;">${userRecord.name || '사용자'}님, 요청하신 임시 비밀번호가 발급되었습니다.</p>
          <div style="background:#1e293b;border-radius:8px;padding:24px;text-align:center;">
            <span style="font-size:24px;font-weight:700;color:#ef4444;letter-spacing:1px;">${temp_password}</span>
          </div>
          <p style="font-size:12px;color:#94a3b8;margin-top:16px;">로그인 후 즉시 비밀번호를 변경하세요.</p>
        </div>
      `,
      fromName: 'S-Guard AI 보안팀'
    });
    return c.json({ status: "success", temp_sent: true })
  }
})

app.get('/users', async (c) => {
  const db = c.env.DB
  const { company, honbu, team, part, subpart, orgCode } = c.req.query()
  
  let query = `
    SELECT 
      u.employee_id as id, u.employee_id, u.email, u.name, u.role, u.phone,
      u.company, 
      COALESCE(oc.name, u.company) as company_name, 
      u.honbu,
      COALESCE(oh.name, u.honbu) as honbu_name, 
      u.team,
      COALESCE(ot.name, u.team) as team_name,
      u.part,
      COALESCE(op.name, u.part) as part_name,
      u.subpart,
      COALESCE(os.name, u.subpart) as subpart_name,
      u.profile_picture,
      u.status, u.is_active, u.is_admin , u.last_login_at, u.os_type
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
  } else if (c.req.query('q')) {
    const q = `%${c.req.query('q')}%`;
    query += " AND (u.name LIKE ? OR u.employee_id LIKE ? OR u.email LIKE ?)";
    params.push(q, q, q);
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
      u.employee_id, u.email, u.name, u.role, u.phone, u.os_type, u.is_active, u.is_admin, u.profile_picture,
      u.company,
      COALESCE(oc.name, u.company) as company_name, 
      u.honbu,
      COALESCE(oh.name, u.honbu) as honbu_name, 
      u.team,
      COALESCE(ot.name, u.team) as team_name,
      u.part,
      COALESCE(op.name, u.part) as part_name,
      u.subpart,
      COALESCE(os.name, u.subpart) as subpart_name
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
  const body = await c.req.json()
  const { user_id, employee_id, name, phone, company, honbu, team, part, subpart, os_type, profile_picture } = body
  console.log('[Auth-Profile-Debug] Received Profile Update:', JSON.stringify(body))
  
  const targetId = String(user_id || employee_id || '').replace(/^EMP-/i, '').replace(/^SH-/i, '').trim()
  if (!targetId) return c.json({ error: "Missing ID" }, 400)
  
  const modDt = getKst()
  const db = c.env.DB
  
  // 🛡️ SECURITY: Prevent overwriting with null/empty if fields are missing in JSON
  // Only update fields that are explicitly provided (not undefined)
  // To explicitly clear a field, it should be passed as null or "" (depending on preference)
  // Here we use COALESCE in SQL or logic in JS to keep existing values.
  
  const existing = await db.prepare("SELECT * FROM users WHERE employee_id = ?").bind(targetId).first()
  if (!existing) return c.json({ detail: "User not found" }, 404)

  const finalName    = name !== undefined ? name : existing.name
  const finalPhone   = phone !== undefined ? phone : existing.phone
  const finalCompany = company !== undefined ? company : existing.company
  const finalHonbu   = honbu !== undefined ? honbu : existing.honbu
  const finalTeam    = team !== undefined ? team : existing.team
  const finalPart    = part !== undefined ? part : existing.part
  const finalSubpart = subpart !== undefined ? subpart : existing.subpart
  const finalOsType  = os_type !== undefined ? os_type : existing.os_type
  const finalPic     = profile_picture !== undefined ? profile_picture : existing.profile_picture

  await db.prepare(
    "UPDATE users SET name = ?, phone = ?, company = ?, honbu = ?, team = ?, part = ?, subpart = ?, os_type = ?, profile_picture = ?, mod_dt = ?, mod_id = ? WHERE employee_id = ?"
  ).bind(finalName, finalPhone, finalCompany, finalHonbu, finalTeam, finalPart, finalSubpart, finalOsType, finalPic, modDt, targetId, targetId).run()
  
  const updated = await db.prepare(`
    SELECT 
      u.*,
      COALESCE(oc.name, u.company) as company_name, 
      COALESCE(oh.name, u.honbu) as honbu_name, 
      COALESCE(ot.name, u.team) as team_name,
      COALESCE(op.name, u.part) as part_name,
      COALESCE(os.name, u.subpart) as subpart_name
    FROM users u
    LEFT JOIN organizations oc ON u.company = oc.code AND oc.depth = 1
    LEFT JOIN organizations oh ON u.honbu = oh.code AND oh.depth = 2
    LEFT JOIN organizations ot ON u.team = ot.code AND ot.depth = 3
    LEFT JOIN organizations op ON u.part = op.code AND op.depth = 4
    LEFT JOIN organizations os ON u.subpart = os.code AND os.depth = 5
    WHERE u.employee_id = ?
  `).bind(targetId).first()
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
  const { status, is_active } = await c.req.json()
  const modDt = getKst()

  // 🛡️ 상태 머신에 따른 로직 결정
  // 1. status가 명시적으로 온 경우 (신규 방식)
  // 2. is_active만 온 경우 (하위 호환)
  let finalStatus = status
  let finalActive = is_active

  if (status) {
    finalActive = (status === 'ACTIVE' || status === 'PRE_REGISTERED') ? 1 : 0
  } else if (typeof is_active !== 'undefined') {
    finalStatus = is_active ? 'ACTIVE' : 'SUSPENDED'
    finalActive = is_active ? 1 : 0
  }

  await db.prepare(`
    UPDATE users 
    SET status = ?, is_active = ?, mod_dt = ?, mod_id = ? 
    WHERE employee_id = ?
  `).bind(finalStatus, finalActive, modDt, 'ADMIN', id).run()

  return c.json({ status: "success", finalStatus })
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
  const { company, honbu, team, part, subpart, email, phone, os_type } = await c.req.json()
  const modDt = getKst()
  
  const result = await db.prepare(
    "UPDATE users SET company = ?, honbu = ?, team = ?, part = ?, subpart = ?, email = ?, phone = ?, os_type = ?, mod_dt = ?, mod_id = ? WHERE employee_id = ?"
  )
  .bind(company || null, honbu || null, team || null, part || null, subpart || null, email || null, phone || null, os_type || null, modDt, 'ADMIN', id)
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
// ==========================================
// 1.5 Security & Audit Logs
// ==========================================
app.get('/security/logs', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');

  // 관리자 권한 체크 (Option: 보안을 위해 관리자만 접근 허용)
  if (!user || user.is_admin !== 1) {
    // return c.json({ detail: "접근 권한이 없습니다." }, 403);
    // 우선 개발 편의를 위해 열어두되, 배포 시 주석 해제 권장
  }

  const query = `
    SELECT 
      lh.*, 
      u.name as user_name, u.company as company_code,
      oc.name as company_name
    FROM login_history lh
    LEFT JOIN users u ON lh.user_id = u.employee_id
    LEFT JOIN organizations oc ON u.company = oc.code AND oc.depth = 1
    ORDER BY lh.login_time DESC
    LIMIT 100
  `;
  
  const { results } = await db.prepare(query).all();
  return c.json({ ok: true, logs: results });
});

app.get('/ai/codes/:category', async (c) => {
  const category = c.req.param('category')
  const db = c.env.DB
  const { results } = await db.prepare(
    "SELECT code, name, sort_order FROM code_book WHERE category = ? AND is_active = 1 ORDER BY sort_order ASC"
  ).bind(category.toUpperCase()).all()
  return c.json({ category, codes: results })
})

// ==========================================
// 1.6 RBAC (Role-Based Access Control) APIs
// ==========================================
app.get('/rbac/roles', async (c) => {
  const db = c.env.DB
  const { results } = await db.prepare("SELECT * FROM roles ORDER BY role_name ASC").all()
  return c.json({ roles: results })
})

app.post('/rbac/roles', async (c) => {
  const db = c.env.DB
  const { role_code, role_name, description } = await c.req.json()
  const modDt = getKst()
  
  await db.prepare(`
    INSERT INTO roles (role_code, role_name, description, reg_dt, mod_dt)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(role_code) DO UPDATE SET
      role_name = excluded.role_name,
      description = excluded.description,
      mod_dt = excluded.mod_dt
  `).bind(role_code, role_name, description, modDt, modDt).run()
  
  return c.json({ success: true })
})

app.get('/rbac/menus', async (c) => {
  const db = c.env.DB
  const { results } = await db.prepare("SELECT * FROM menus ORDER BY sort_order ASC").all()
  return c.json({ menus: results })
})

app.get('/rbac/permissions/:roleCode', async (c) => {
  const roleCode = c.req.param('roleCode')
  const db = c.env.DB
  
  // Get all menus joined with permissions for this role
  const query = `
    SELECT 
      m.id as menu_id, m.name as menu_name, m.path, m.icon,
      COALESCE(rp.can_read, 0) as can_read,
      COALESCE(rp.can_write, 0) as can_write,
      COALESCE(rp.can_delete, 0) as can_delete
    FROM menus m
    LEFT JOIN role_permissions rp ON m.id = rp.menu_id AND rp.role_code = ?
    WHERE m.is_active = 1
    ORDER BY m.sort_order ASC
  `
  const { results } = await db.prepare(query).bind(roleCode).all()
  return c.json({ role_code: roleCode, permissions: results })
})

app.post('/rbac/permissions', async (c) => {
  const db = c.env.DB
  const { role_code, permissions } = await c.req.json()
  const modDt = getKst()

  for (const p of permissions) {
    await db.prepare(`
      INSERT INTO role_permissions
        (role_code, menu_id, menu_name, menu_path, can_read, can_write, can_delete, reg_dt, mod_dt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(role_code, menu_id) DO UPDATE SET
        menu_name  = excluded.menu_name,
        menu_path  = excluded.menu_path,
        can_read   = excluded.can_read,
        can_write  = excluded.can_write,
        can_delete = excluded.can_delete,
        mod_dt     = excluded.mod_dt
    `).bind(
      role_code,
      p.menu_id,
      p.menu_name  || '',
      p.menu_path  || p.path || '',
      p.can_read   ? 1 : 0,
      p.can_write  ? 1 : 0,
      p.can_delete ? 1 : 0,
      modDt,
      modDt
    ).run()
  }

  return c.json({ success: true, saved: permissions.length })
})

// ==========================================
// 1.7 Substitute (Deputy) Management APIs
// ==========================================

app.get('/rbac/substitutes/:userId', async (c) => {
  const userId = c.req.param('userId')
  const db = c.env.DB
  const { results } = await db.prepare(`
    SELECT s.*,
      u.name as deputy_name,
      u.team as deputy_team_code,
      u.part as deputy_part_code,
      u.subpart as deputy_subpart_code,
      u.position as deputy_position,
      COALESCE(ot.name, u.team)    as deputy_team,
      COALESCE(op.name, u.part)    as deputy_part,
      COALESCE(os.name, u.subpart) as deputy_subpart
    FROM substitutes s
    JOIN users u ON s.deputy_id = u.employee_id
    LEFT JOIN organizations ot ON u.team    = ot.code AND ot.depth = 3
    LEFT JOIN organizations op ON u.part    = op.code AND op.depth = 4
    LEFT JOIN organizations os ON u.subpart = os.code AND os.depth = 5
    WHERE s.user_id = ?
    ORDER BY s.priority ASC
  `).bind(userId).all()
  return c.json({ userId, substitutes: results })
})

app.post('/rbac/substitutes', async (c) => {
  const db = c.env.DB
  const { user_id, deputy_id, priority } = await c.req.json()
  const modDt = getKst()
  
  await db.prepare(`
    INSERT INTO substitutes (user_id, deputy_id, priority, reg_dt, mod_dt)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id, deputy_id) DO UPDATE SET
      priority = excluded.priority,
      mod_dt = excluded.mod_dt
  `).bind(user_id, deputy_id, priority || 1, modDt, modDt).run()
  
  return c.json({ success: true })
})

app.delete('/rbac/substitutes/:id', async (c) => {
  const id = c.req.param('id')
  const db = c.env.DB
  await db.prepare("DELETE FROM substitutes WHERE id = ?").bind(id).run()
  return c.json({ success: true })
})

app.post('/rbac/substitutes/reorder', async (c) => {
  const db = c.env.DB
  const { user_id, items } = await c.req.json() // items: [{id, priority}]
  const modDt = getKst()
  
  for (const item of items) {
    await db.prepare("UPDATE substitutes SET priority = ?, mod_dt = ? WHERE id = ? AND user_id = ?")
      .bind(item.priority, modDt, item.id, user_id).run()
  }
  
  return c.json({ success: true })
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

  // Use the MULTIMODAL key for OCR
  const api_key = "app-NKmE6uOd6n7FteajnHh1xXuf"
  const api_base = c.env.DIFY_API_BASE || 'https://api.dify.ai/v1'

  try {
    console.log(`[OCR] Processing multimodal image via Dify Upload + Chat API (Key: ${api_key.substring(0, 10)}...)`)
    
    // 1. Upload the file to Dify first
    const difyUploadForm = new FormData()
    difyUploadForm.append('file', file)
    difyUploadForm.append('user', 'sguard-multimodal-user')
    
    const uploadRes = await fetch(`${api_base}/files/upload`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${api_key}`
        },
        body: difyUploadForm
    })
    
    if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        console.error(`[OCR] Dify File Upload Error: ${uploadRes.status}`, errText)
        return c.json({ error: `Dify 파일 임시 업로드 오류 (${uploadRes.status})` }, uploadRes.status)
    }
    
    const uploadData = await uploadRes.json()
    console.log(`[OCR] Dify File Upload Success, ID: ${uploadData.id}`)
    
    // 2. Feed the uploaded file ID as 'sms_image' variable (Advanced Chat App structure)
    const response = await fetch(`${api_base}/chat-messages`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${api_key}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            user: "sguard-multimodal-user",
            response_mode: "streaming", // Switch to streaming to avoid 504 timeouts
            query: "이미지 속 텍스트를 정확하게 추출해서 알려주세요. 불필요한 설명은 생략해 주세요.",
            inputs: {
                sms_image: {
                    type: "image",
                    transfer_method: "local_file",
                    upload_file_id: uploadData.id
                }
            },
            files: [] // Advanced Chat uses inputs for variables like sms_image
        })
    })

    if (!response.ok) {
        const errText = await response.text();
        console.error(`[OCR] Dify API Error: ${response.status}`, errText)
        return c.json({ error: `Dify API 오류 (${response.status})` }, response.status)
    }

    // Proxy the SSE stream to the frontend
    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()

    ;(async () => {
      try {
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          // Directly proxy the chunk from Dify
          await writer.write(value)
        }
      } catch(e) {
        console.error(`[OCR] Stream Error:`, e)
      } finally {
        await writer.close()
      }
    })()

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    })
  } catch (e) {
    console.error('[OCR] Dify API Error:', e)
    return c.json({ error: `Dify 분석 실패: ${e.message}` }, 500)
  }
})

// ==========================================
// 3. SMS Interactions
// ==========================================

function extractOccurrence(occStr) {
  if (!occStr) return 0;
  const str = String(occStr);
  // Match "22건" or "22 건"
  const match = str.match(/(\d+)\s*건/);
  if (match) return parseInt(match[1], 10);
  // Fallback to stripping all non-digits if no "건" is found
  return parseInt(str.replace(/[^0-9]/g, ''), 10) || 0;
}

app.post('/sms/receive', async (c) => {
  // 🛡️ 강화된 Body 파싱: JSON / form-data / text 모두 수용
  let body = {};
  try {
    const contentType = c.req.header('content-type') || '';
    if (contentType.includes('application/json')) {
      body = await c.req.json();
    } else if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await c.req.formData();
      for (const [key, value] of formData.entries()) {
        body[key] = value;
      }
    } else {
      // fallback: raw text 또는 JSON 시도
      const rawText = await c.req.text();
      try {
        body = JSON.parse(rawText);
      } catch {
        // plain text → message 필드로 처리
        body = { message: rawText };
        console.warn('[sms/receive] Non-JSON body received, treated as plain message. Content-Type:', contentType);
      }
    }
  } catch (parseErr) {
    console.error('[sms/receive] Body parse failed:', parseErr.message);
    return c.json({ error: 'Invalid request body', detail: parseErr.message }, 400);
  }

  let { 
    sender, message, employee_id, 
    channel: bodyChannel, if_id: bodyIfId, service_code: bodyServiceCode, service_name: bodyServiceName, 
    biz_system: bodyBizSystem, error_code: bodyErrorCode, occurrence_count: bodyOccurrenceCount, 
    occurrence_node: bodyOccurrenceNode, error_message: bodyErrorMessage, occurrence_time: bodyOccurrenceTime, received_at 
  } = body

  // 🛡️ 메시지 필수 검증
  if (!message || !String(message).trim()) {
    console.warn(`[sms/receive] Empty message from sender=${sender}, employee_id=${employee_id}`);
    return c.json({ error: 'message is required and cannot be empty' }, 400);
  }
  message = String(message).trim();

  // 🛡️ Global Sanitize: Strip "[Web발신]", "[MMS]", "[SMS]" 등 접두어 제거
  message = message
    .replace(/\[Web발신\]/g, '')
    .replace(/\[MMS\]/gi, '')
    .replace(/\[SMS\]/gi, '')
    .replace(/\[LMS\]/gi, '')
    .trim();

  // 📊 수신 로그 (단문/장문 구분)
  const msgType = message.length > 90 ? 'LMS/MMS' : 'SMS';
  console.log(`[sms/receive] ${msgType} received | len=${message.length} | sender=${sender} | employee_id=${employee_id} | ct=${c.req.header('content-type') || 'none'}`);


  // 🚀 Phase 14: Universal Entity Extraction (MCI / Batch / Generic)
  const uniqueIdPatterns = [
    /[A-Z]+[0-9]{3,}[A-Z0-9_]*/g,     // EGRT0096, FAN00200, BIDS...
    /[A-Z]{3,}_[A-Z0-9_]+/g,          // BIDS_D_RE07...
    /[A-Z]+-[A-Z]+[0-9]+/g            // SIN-MCI1...
  ];

  const mciPattern = {
    channel: message.match(/▶ 채널\s*:\s*\[(.*?)\]/),
    if_id: message.match(/▶ IF아이디\s*:\s*\[(.*?)\]/),
    service_code: message.match(/▶ 서비스코드\s*:\s*\[(.*?)\]/),
    service_name: message.match(/▶ 서비스명\s*:\s*\[(.*?)\]/),
    occurrence_count: message.match(/▶ 발생건수\s*:\s*\[(.*?)\]/),
    occurrence_node: message.match(/▶ 발생노드\s*:\s*\[(.*?)\]/),
    error_message: message.match(/▶ 에러메시지\s*:\s*\[(.*?)\]/),
    occurrence_time: message.match(/▶ 발생시각\s*:\s*\[(.*?)\]/)
  }

  const contextKeywords = ['AIA', '효성', '신한', 'FAN', 'FRC', 'MCI', 'JOBMIND', 'BATCH', 'UI'];
  const timelinePatterns = [
    /\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}(?::\d{2})?/, // YYYY-MM-DD HH:MM
    /\d{1,2}\/\d{1,2}\s\d{1,2}:\d{1,2}/,         // MM/DD HH:MM
    /최근\s*(\d+\s*분) 동안/,                     // 최근 2분 동안
    /총\s*(\d+\s*건)/                             // 총 16건
  ];

  // 📦 Extracting Unique IDs
  const foundIds = new Set();
  uniqueIdPatterns.forEach(p => {
    const matches = message.match(p);
    if (matches) matches.forEach(m => foundIds.add(m));
  });

  // 📦 Extracting Context
  const foundContext = contextKeywords.filter(k => message.includes(k));

  // 📦 Extracting Timeline Info
  const foundTimeline = [];
  timelinePatterns.forEach(p => {
    const match = message.match(p);
    if (match) foundTimeline.push(match[0]);
  });

  // 🔗 Map results to existing fields
  const channel = bodyChannel || (mciPattern.channel ? mciPattern.channel[1] : null);
  const if_id = bodyIfId || (mciPattern.if_id ? mciPattern.if_id[1] : null);
  const service_code = bodyServiceCode || (mciPattern.service_code ? mciPattern.service_code[1] : null);
  const service_name = bodyServiceName || (mciPattern.service_name ? mciPattern.service_name[1] : null);
  const biz_system = bodyBizSystem || foundContext.find(c => ['FRC', 'FAN', 'MCI', 'JOBMIND'].includes(c)) || null;
  const error_code = bodyErrorCode || Array.from(foundIds).find(id => id.length > 5) || (mciPattern.error_code ? mciPattern.error_code[1] : null);
  const error_message = bodyErrorMessage || (mciPattern.error_message ? mciPattern.error_message[1] : null);
  const occurrence_count = bodyOccurrenceCount || (mciPattern.occurrence_count ? mciPattern.occurrence_count[1] : null);
  const occurrence_node = bodyOccurrenceNode || (mciPattern.occurrence_node ? mciPattern.occurrence_node[1] : null);
  const occurrence_time = bodyOccurrenceTime || (mciPattern.occurrence_time ? mciPattern.occurrence_time[1] : null);

  const tags = [...foundIds, ...foundContext].join(', ');
  const category = (message.includes('BATCH') || message.includes('JOBMIND')) ? 'BATCH_ALARM_SMS' : 'INFRA_ALARM_SMS';
  const occurrence_summary = foundTimeline.join(' | ');

  // ─── 보안: employee_id 화이트리스트 검증 ───────────────────────────────
  // 등록되지 않은(또는 비활성화된) 직원 ID로 들어오는 요청을 전면 차단합니다.
  // iOS 단축어/APK 데몬은 항상 employee_id를 포함해야 합니다.
  if (!employee_id) {
    console.warn(`[Security] /sms/receive blocked: missing employee_id from sender=${sender}`)
    return c.json({ error: 'Unauthorized: employee_id is required' }, 401)
  }
  const db = c.env.DB
  const authorizedUser = await db
    .prepare("SELECT employee_id FROM users WHERE employee_id = ? AND is_active = 1")
    .bind(String(employee_id))
    .first()
  if (!authorizedUser) {
    console.warn(`[Security] /sms/receive blocked: unknown or inactive employee_id=${employee_id}`)
    
    // 🛡️ 보안 알림 생성
    c.executionCtx.waitUntil(sendSecurityAlert(c, {
      type: 'INVALID_SENDER_ID',
      title: '미등록 기기/사번 접근 탐지',
      detail: `등록되지 않았거나 비활성화된 사번(${employee_id})을 통해 SMS 수신 시도가 감지되었습니다.\n발신번호: ${sender}`,
      urgency: 'CRITICAL'
    }));

    return c.json({ error: 'Unauthorized: invalid employee_id' }, 401);
  }
  // ─────────────────────────────────────────────────────────────────────────

  // ─── PII 마스킹은 담당자 이름 기반 파트 할당 이후 DB 저장 직전에만 적용합니다 │
  // 이유: 메시지 안의 담당자 이름을 읽어 DB 사용자와 매칭(Assignment)하는 로직이  │
  // 먹저 실행되어야 하기 때문에 원본 텍스트를 유지합니다.              │
  // ────────────────────────────────────────────────────────────────────────

  const finalOccurrenceTime = occurrence_time || received_at || null
  const now = new Date()
  const kstOffset = 9 * 60 * 60 * 1000
  const kstNow = new Date(now.getTime() + kstOffset)
  const timestamp = kstNow.toISOString().replace('T', ' ').substring(0, 19)
  
  // 🚀 Enhanced Keyword Detection (원본 message 사용 - 키워드 검색은 실제 내용 기준)
  const { results: keywordList } = await db.prepare("SELECT keyword FROM alert_keywords").all()
  const matchedKeywords = []
  const lowerMessage = (message || "").toLowerCase()
  
  for (const k of keywordList) {
    if (k.keyword && lowerMessage.includes(k.keyword.toLowerCase())) {
      matchedKeywords.push(k.keyword)
    }
  }
  const detectedCount = matchedKeywords.length
  const response_msg = matchedKeywords.join(', ')

  // Normalize sender phone number (remove dashes, spaces, etc.) for cross-device consistency
  const normSender = String(sender || '').replace(/[^0-9]/g, '');

  // Duplicate check: Merge identical messages if they arrive within a 10-minute window
  const tenMinsAgo = new Date(kstNow.getTime() - 10 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19)
  const existing = await db.prepare(
    "SELECT inc_id, received_count FROM received_messages WHERE (sender = ? OR REPLACE(REPLACE(sender, '-', ''), ' ', '') = ?) AND message = ? AND timestamp >= ? ORDER BY timestamp DESC LIMIT 1"
  ).bind(sender, normSender, message, tenMinsAgo).first()

  if (existing) {
    const newCount = (existing.received_count || 1) + 1
    const count = extractOccurrence(occurrence_count);
    await db.prepare(`
      UPDATE received_messages SET 
        received_count = ?, timestamp = ?, mod_dt = ?, employee_id = ?,
        keyword_detected = ?, response_message = ?,
        channel = ?, if_id = ?, service_code = ?, service_name = ?, 
        biz_system = ?, error_code = ?, occurrence_count = ?, 
        occurrence_node = ?, error_message = ?, occurrence_time = ?,
        receiver_1 = ?, receiver_2 = ?, receiver_3 = ?, receiver_4 = ?, receiver_5 = ?,
        receiver_6 = ?, receiver_7 = ?, receiver_8 = ?, receiver_9 = ?, receiver_10 = ?,
        receiver_11 = ?, receiver_12 = ?, receiver_13 = ?, receiver_14 = ?, receiver_15 = ?,
        receiver_16 = ?, receiver_17 = ?, receiver_18 = ?, receiver_19 = ?, receiver_20 = ?,
        tags = ?, category = ?
      WHERE inc_id = ?
    `).bind(
      newCount, timestamp, timestamp, employee_id || null,
      detectedCount, response_msg || null,
      channel || null, if_id || null, service_code || null, service_name || null,
      biz_system || null, error_code || null, count,
      occurrence_node || null, error_message || null, finalOccurrenceTime || null,
      body.receiver_1 || null, body.receiver_2 || null, body.receiver_3 || null, body.receiver_4 || null, body.receiver_5 || null,
      body.receiver_6 || null, body.receiver_7 || null, body.receiver_8 || null, body.receiver_9 || null, body.receiver_10 || null,
      body.receiver_11 || null, body.receiver_12 || null, body.receiver_13 || null, body.receiver_14 || null, body.receiver_15 || null,
      body.receiver_16 || null, body.receiver_17 || null, body.receiver_18 || null, body.receiver_19 || null, body.receiver_20 || null,
      tags, category,
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
                // 1. 송신자의 조직 및 직급 정보 조회
                const u_sender = await db.prepare("SELECT company, honbu, team, part, subpart, position FROM users WHERE employee_id = ?").bind(employee_id).first();
                
                if (u_sender) {
                    let scopeFilter = "";
                    let scopeArgs = [existing.inc_id, timestamp, timestamp, employee_id || 'SYSTEM', timestamp, employee_id || 'SYSTEM', timestamp, u_sender.company];

                    if (u_sender.position >= 'POS_004') {
                        // 본부장 이상: 본부 전체
                        scopeFilter = "AND u_target.honbu = ?";
                        scopeArgs.push(u_sender.honbu);
                    } else if (u_sender.position === 'POS_003') {
                        // 팀장: 팀 전체
                        scopeFilter = "AND u_target.honbu = ? AND u_target.team = ?";
                        scopeArgs.push(u_sender.honbu, u_sender.team);
                    } else if (u_sender.position === 'POS_002') {
                        // 파트장: 파트 전체
                        scopeFilter = "AND u_target.honbu = ? AND u_target.team = ? AND u_target.part = ?";
                        scopeArgs.push(u_sender.honbu, u_sender.team, u_sender.part);
                    } else {
                        // 일반 팀원: 서브파트 전체
                        scopeFilter = "AND u_target.honbu = ? AND u_target.team = ? AND u_target.part = ? AND (u_target.subpart = ? OR (u_target.subpart IS NULL AND ? IS NULL))";
                        scopeArgs.push(u_sender.honbu, u_sender.team, u_sender.part, u_sender.subpart, u_sender.subpart);
                    }
                    
                    // Mentioned receivers filter
                    scopeArgs.push(...normalizedReceivers, ...normalizedReceivers);

                    const result = await db.prepare(`
                        INSERT OR IGNORE INTO incident_assignments (user_id, inc_id, status, assigned_at, updated_at, reg_id, reg_dt, mod_id, mod_dt)
                        SELECT DISTINCT u_target.employee_id, ?, '미확인', ?, ?, ?, ?, ?, ?
                        FROM users u_source
                        JOIN users u_target ON u_source.company = u_target.company AND u_source.team = u_target.team
                        WHERE u_source.is_active = 1
                          AND u_target.is_active = 1
                          AND u_target.company = ?
                          ${scopeFilter}
                          AND (u_source.name IN (${placeholders}) OR u_source.employee_id IN (${placeholders}))
                    `).bind(...scopeArgs).run();
                    console.log(`[Assignment] Rank-based bulk assignment completed for ${existing.inc_id}. Changes: ${result.meta.changes}`);
                }
            } catch (assignError) {
                console.error(`[Assignment] Error in rank-based bulk assignment for ${existing.inc_id}:`, assignError);
            }
        }
    } else {
        console.warn(`[Assignment] No valid normalized receivers for ${existing.inc_id}`);
    }

    // Trigger AI background processing if not already handled
    c.executionCtx.waitUntil(performBackgroundAiAnalysis(existing.inc_id, c.env).catch(e => console.error(e)));

    // 🔔 즉시 푸시 - 중복 수신 시에도 본인 + 모든 담당자에게 일괄 전송
    const dupMsgPreview = (message || '내용 없음').substring(0, 100);
    const dupPushPayload = {
      title: `[S-GUARD] 장애 키워드 감지`,
      body: `새로운 시스템 이벤트가 감지되었습니다.\n${dupMsgPreview}`,
      inc_id: String(existing.inc_id),
      priority: 70,
      url: `/inbox`,
      tag: `inc-${existing.inc_id}`
    };

    c.executionCtx.waitUntil((async () => {
      try {
        // 1. 수신 사번 본인 전송
        if (employee_id) {
          await sendPushNotification(c, employee_id, dupPushPayload).catch(e => console.error('[Push-Self-Dup]', e));
        }
        // 2. 담당자 전원 전송
        const { results: assignees } = await db.prepare(
          "SELECT DISTINCT user_id FROM incident_assignments WHERE inc_id = ?"
        ).bind(existing.inc_id).all();
        if (assignees && assignees.length > 0) {
          const pushPromises = assignees
            .filter(a => a.user_id !== employee_id)
            .map(a => sendPushNotification(c, a.user_id, dupPushPayload).catch(e => console.error(`[Push-Assignee-Dup:${a.user_id}]`, e)));
          await Promise.allSettled(pushPromises);
        }
      } catch (e) { console.error('[Push-Broadcast-Dup] Error:', e.message); }
    })());

    return c.json({ status: 'duplicate_incremented', inc_id: existing.inc_id, received_count: newCount })
  }


  const newIncId = generateIncId()
  const parsedCount = extractOccurrence(occurrence_count);
  const initialCount = parsedCount > 0 ? parsedCount : 1

  // \u2500\u2500\u2500 PII \ub9c8\uc2a4\ud0b9: \uc218\uc2e0\uc790 \uc774\ub984 \uae30\ubc18 \ud30c\ud2b8 \ud560\ub2f9 \uc644\ub8cc \ud6c4, DB INSERT \uc9c1\uc804 \uc801\uc6a9 \u2500\u2500\u2500
  // \ud560\ub2f9 \ub85c\uc9c1\uc740 \uc6d0\ubcf8 message/sender/receiver \ub370\uc774\ud130\ub97c \uc0ac\uc6a9\ud588\uc73c\uba74\uc73c\ub85c,
  // \uc774\uc81c\ubd80\ud130 D1\uc5d0\ub294 \ube44\uc2dd\ubcc4\ud558\ub41c \ub370\uc774\ud130\ub9cc \uc800\uc7a5\ud569\ub2c8\ub2e4.
  const maskedMessage = maskPII(message)
  const maskedSender  = maskPII(sender)
  console.log(`[PII] Applied masking before D1 INSERT for employee_id=${employee_id}`)
  // \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

  await db.prepare(`
    INSERT INTO received_messages (
      inc_id, sender, message, employee_id, timestamp, keyword_detected, 
      response_message, received_count, status,
      channel, if_id, service_code, service_name, 
      biz_system, error_code, occurrence_count, 
      occurrence_node, error_message, occurrence_time,
      receiver_1, receiver_2, receiver_3, receiver_4, receiver_5,
      receiver_6, receiver_7, receiver_8, receiver_9, receiver_10,
      receiver_11, receiver_12, receiver_13, receiver_14, receiver_15,
      receiver_16, receiver_17, receiver_18, receiver_19, receiver_20,
      reg_id, reg_dt, mod_id, mod_dt, tags, category
    ) VALUES (
      ?, ?, ?, ?, ?, ?, 
      ?, ?, 'PENDING',
      ?, ?, ?, ?, 
      ?, ?, ?, 
      ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?
    )
  `).bind(
    newIncId, maskedSender || null, maskedMessage || null, employee_id || null, timestamp, detectedCount, 
    response_msg || null, initialCount,
    channel || null, if_id || null, service_code || null, service_name || null,
    biz_system || null, error_code || null, parsedCount,
    occurrence_node || null, error_message || null, finalOccurrenceTime || null,
    body.receiver_1 || null, body.receiver_2 || null, body.receiver_3 || null, body.receiver_4 || null, body.receiver_5 || null,
    body.receiver_6 || null, body.receiver_7 || null, body.receiver_8 || null, body.receiver_9 || null, body.receiver_10 || null,
    body.receiver_11 || null, body.receiver_12 || null, body.receiver_13 || null, body.receiver_14 || null, body.receiver_15 || null,
    body.receiver_16 || null, body.receiver_17 || null, body.receiver_18 || null, body.receiver_19 || null, body.receiver_20 || null,
    employee_id || 'SYSTEM', timestamp, employee_id || 'SYSTEM', timestamp,
    tags, category
  ).run()

  // 🚀 NEW: Auto-sync to incidents table to prevent 404s on detail pages
  try {
    const incTitle = `INC-${newIncId} | ${maskedMessage.substring(0, 100)}`;
    await db.prepare(`
      INSERT OR IGNORE INTO incidents (
        inc_id, title, description, severity, status, incident_type,
        reg_id, reg_dt, mod_id, mod_dt, created_at, updated_at
      ) VALUES (?, ?, ?, 'NORMAL', 'INC_001', 'AI', 'SYSTEM', ?, 'SYSTEM', ?, ?, ?)
    `).bind(newIncId, incTitle, maskedMessage, timestamp, timestamp, timestamp, timestamp).run();
  } catch (e) {
    console.error("[Sync-Incidents] Error:", e.message);
  }

  // --- 🚀 NEW: Automatic Assignment by Sender's Rank (New Path) ---
  if (employee_id) {
     try {
         const senderUser = await db.prepare("SELECT company, honbu, team, part, subpart, position FROM users WHERE employee_id = ?").bind(employee_id).first();
         if (senderUser) {
             let scopeQuery = "";
             let scopeArgs = [senderUser.company];

             if (senderUser.position >= 'POS_004') {
                 // 본부장 이상: 본부 전체
                 scopeQuery = "WHERE company = ? AND honbu = ?";
                 scopeArgs.push(senderUser.honbu);
             } else if (senderUser.position === 'POS_003') {
                 // 팀장: 팀 전체
                 scopeQuery = "WHERE company = ? AND honbu = ? AND team = ?";
                 scopeArgs.push(senderUser.honbu, senderUser.team);
             } else if (senderUser.position === 'POS_002') {
                 // 파트장: 파트 전체
                 scopeQuery = "WHERE company = ? AND honbu = ? AND team = ? AND part = ?";
                 scopeArgs.push(senderUser.honbu, senderUser.team, senderUser.part);
             } else {
                 // 일반 팀원: 서브파트만
                 scopeQuery = "WHERE company = ? AND honbu = ? AND team = ? AND part = ? AND (subpart = ? OR (subpart IS NULL AND ? IS NULL))";
                 scopeArgs.push(senderUser.honbu, senderUser.team, senderUser.part, senderUser.subpart, senderUser.subpart);
             }

             const { results: targetUsers } = await db.prepare(`SELECT employee_id FROM users ${scopeQuery} AND is_active = 1`).bind(...scopeArgs).all();
             
             if (targetUsers && targetUsers.length > 0) {
                 for (const u of targetUsers) {
                     await db.prepare("INSERT INTO incident_assignments (user_id, inc_id, status, assigned_at, updated_at, reg_id, reg_dt, mod_id, mod_dt) VALUES (?, ?, 'INC_001', ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, inc_id) DO NOTHING")
                      .bind(u.employee_id, newIncId, timestamp, timestamp, employee_id || 'SYSTEM', timestamp, employee_id || 'SYSTEM', timestamp).run();
                 }
             }
         }
     } catch (e) {
         console.error("Rank-based Auto-assignment error:", e);
     }
  }
  
  // Eager Loading: Trigger background AI immediately for new insert
  c.executionCtx.waitUntil(performBackgroundAiAnalysis(newIncId, c.env).catch(e => console.error(e)));

  // 🔔 즉시 푸시 - 할당된 모든 사용자에게 일괄 전송
  const msgPreview = (message || '내용 없음').substring(0, 100);
  const immediatePushPayload = {
    title: `[S-GUARD] 장애 키워드 감지`,
    body: `새로운 시스템 이벤트가 감지되었습니다.\n${msgPreview}`,
    inc_id: String(newIncId),
    priority: detectedCount > 0 ? 90 : 50,
    url: `/inbox`,
    tag: `inc-${newIncId}`
  };

  // 할당된 사용자 목록 조회 후 일괄 푸시
  c.executionCtx.waitUntil((async () => {
    try {
      // 1. 수신 사번 본인에게 먼저 전송
      if (employee_id) {
        await sendPushNotification(c, employee_id, immediatePushPayload).catch(e => console.error('[Push-Self]', e));
      }

      // 2. 자동 배정된 사용자들 조회 후 일괄 전송
      const { results: assignees } = await db.prepare(
        "SELECT DISTINCT user_id FROM incident_assignments WHERE inc_id = ?"
      ).bind(newIncId).all();

      if (assignees && assignees.length > 0) {
        const pushPromises = assignees
          .filter(a => a.user_id !== employee_id) // 본인 중복 제외
          .map(a => sendPushNotification(c, a.user_id, immediatePushPayload)
            .catch(e => console.error(`[Push-Assignee:${a.user_id}]`, e))
          );
        await Promise.allSettled(pushPromises);
        console.log(`[Push-Broadcast] Sent to ${assignees.length} user(s) for ${newIncId}`);
      }
    } catch (e) {
      console.error('[Push-Broadcast] Error:', e.message);
    }
  })());

  return c.json({ status: detectedCount > 0 ? 'keyword_detected' : 'received', inc_id: newIncId })
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

    let lastHeartbeat = Date.now()

    try {
      while (true) {
        // Send heartbeat every 20 seconds
        if (Date.now() - lastHeartbeat > 20000) {
          await stream.writeSSE({ event: 'ping', data: 'heartbeat' })
          lastHeartbeat = Date.now()
        }

        // Check for new SMS every 3 seconds
        const latest = await db.prepare("SELECT * FROM received_messages ORDER BY timestamp DESC LIMIT 1").first()
        const currentKey = latest ? `${latest.inc_id}_${latest.timestamp}` : null;
        
        if (latest && currentKey !== lastSeenKey) {
          console.log('New SMS detected in SSE stream:', latest.inc_id)
          lastSeenKey = currentKey;
          await stream.writeSSE({
            event: 'new_sms', // Synchronized with frontend listener
            data: JSON.stringify({
              inc_id: latest.inc_id,
              sender: latest.sender,
              message: latest.message,
              timestamp: latest.timestamp,
              keyword_detected: parseInt(String(latest.keyword_detected || '0')),
              response_message: latest.response_message,
              received_count: parseInt(String(latest.received_count || '1'))
            })
          })
        }
        
        await stream.sleep(3000)
      }
    } catch (e) {
      console.error('SSE Stream Error:', e)
    } finally {
      console.log('SSE Stream Disconnected')
    }
  })
})

app.get('/sms/stats', async (c) => {
  const db = c.env.DB
  const total = await db.prepare("SELECT COUNT(*) as c FROM received_messages").first('c')
  const unread = await db.prepare("SELECT COUNT(*) as c FROM received_messages WHERE read = 0").first('c')
  return c.json({ total, unread })
})

// 🚀 [NEW] Dynamic Configuration Endpoints
app.get('/sms/settings', async (c) => {
  const db = c.env.DB;
  try {
    const { results } = await db.prepare("SELECT config_key as key, config_value as value, description FROM system_config").all();
    return c.json({ success: true, settings: results });
  } catch (e) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

app.post('/sms/settings', async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();
  const { key, value } = body;

  try {
    await db.prepare("INSERT OR REPLACE INTO system_config (config_key, config_value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)")
             .bind(key, String(value)).run();
    return c.json({ success: true, message: `Setting ${key} updated to ${value}` });
  } catch (e) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

app.get('/sms/recent', async (c) => {
  const limit = c.req.query('limit') || 10
  const excludeCompleted = c.req.query('excludeCompleted') === 'true'
  const db = c.env.DB
  
  let baseQuery = `
    SELECT * FROM (
      SELECT r.*, u.name, u.role, u.team, u.part,
             ai.similarity_score, ai.similarity_reason,
             (SELECT COUNT(1) FROM autopilot_insight ai2 WHERE ai2.inc_id = r.inc_id) as is_analyzed,
             COALESCE(
               (SELECT 'INC_003' FROM warroom_list wl WHERE wl.inc_id = r.inc_id AND (wl.status = 'CLOSED' OR wl.status = '최종완료' OR wl.status = 'Completed' OR wl.status = '처리완료') LIMIT 1),
               (SELECT CASE 
                 WHEN status = 'Open' THEN 'INC_001' 
                 WHEN status = '미처리' THEN 'INC_001' 
                 WHEN status = '처리중' THEN 'INC_002' 
                 WHEN status = '처리완료' THEN 'INC_003' 
                 ELSE status 
               END FROM incidents i WHERE i.inc_id = r.inc_id LIMIT 1),
               (SELECT CASE 
                 WHEN status = '미확인' THEN 'INC_001' 
                 WHEN status = '미처리' THEN 'INC_001' 
                 WHEN status = '처리중' THEN 'INC_002' 
                 WHEN status = '처리완료' THEN 'INC_003' 
                 ELSE status 
               END FROM incident_assignments ia WHERE ia.inc_id = r.inc_id ORDER BY updated_at DESC LIMIT 1),
               'INC_001'
             ) as incident_status
      FROM received_messages r
      LEFT JOIN users u ON r.employee_id = u.employee_id
      LEFT JOIN autopilot_insight ai ON ai.inc_id = r.inc_id
    )
    WHERE 1=1
  `
  const params = []
  if (excludeCompleted) {
    baseQuery += ` AND incident_status != 'INC_003' `
  }
  baseQuery += ` ORDER BY timestamp DESC LIMIT ? `
  params.push(limit)

  const { results } = await db.prepare(baseQuery).bind(...params).all()

  return c.json({ total: results.length, messages: results.map(r => ({ 
    inc_id: r.inc_id, 
    id: r.inc_id, 
    sender: r.sender,
    sender_name: r.name || '',
    sender_team: r.team || '',
    sender_part: r.part || '',
    message: r.message, 
    employee_id: r.employee_id,
    timestamp: r.timestamp, 
    keyword_detected: parseInt(String(r.keyword_detected || '0')),
    response_message: r.response_message,
    received_count: parseInt(String(r.received_count || '1')),
    similarity_score: r.similarity_score,
    similarity_reason: r.similarity_reason,
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
    incident_status: r.incident_status || 'INC_001',
    status: r.incident_status || 'INC_001',
    is_analyzed: r.is_analyzed,
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
  const normId = String(inc_id);
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
  const normId = String(inc_id);
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
      "SELECT * FROM incidents WHERE status != 'INC_003' AND (title LIKE ? OR description LIKE ?)"
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
    // 🛡️ Robust Query: Added COALESCE and ensure numeric conversion
    const mttrRes = await db.prepare(`
      SELECT AVG(CAST(strftime('%s', k.reg_dt) AS INTEGER) - CAST(strftime('%s', r.timestamp) AS INTEGER)) / 60.0 as avg_minutes
      FROM knowledge_base k
      JOIN received_messages r ON k.inc_id = r.inc_id
      WHERE r.timestamp IS NOT NULL AND k.reg_dt IS NOT NULL
    `).first();
    
    const mttrVal = mttrRes?.avg_minutes || 0;

    // 2. Incident & Knowledge Integrity
    const totalIncRes = await db.prepare("SELECT COUNT(*) as c FROM received_messages").first();
    const totalInc = totalIncRes?.c || 0;

    // 🚀 MTTR stats
    const resolvedIncRes = await db.prepare("SELECT COUNT(*) as c FROM received_messages WHERE response_message IS NOT NULL OR status = 'INC_003'").first();
    const resolvedInc = resolvedIncRes?.c || 0;

    // 전체 KB 수 (표시용)
    const knowledgeCountRes = await db.prepare("SELECT COUNT(*) as c FROM knowledge_base").first();
    const knowledgeCount = knowledgeCountRes?.c || 0;

    // 🛡️ 자산화 성공률: KB화된 '고유 인시던트' 수 / 전체 인시던트
    // COUNT(*) 대신 COUNT(DISTINCT inc_id) 사용 — 동일 인시던트에 KB가 여러 개여도 1건으로 카운트
    const kbDistinctIncRes = await db.prepare("SELECT COUNT(DISTINCT inc_id) as c FROM knowledge_base WHERE inc_id IS NOT NULL AND inc_id != ''").first();
    const kbDistinctInc = kbDistinctIncRes?.c || 0;

    const activeWarRoomsRes = await db.prepare("SELECT COUNT(DISTINCT inc_id) as c FROM received_messages WHERE received_count > 0").first();
    const activeWarRooms = activeWarRoomsRes?.c || 0;
    
    // Governance Rate: 고유 인시던트 기준, 최대 100%
    const governanceRate = totalInc > 0 ? Math.min(100, Math.round((kbDistinctInc / totalInc) * 100)) : 0;
    const resolveRate = totalInc > 0 ? Math.min(100, Math.round((resolvedInc / totalInc) * 100)) : 0;

    // 3. Expert Ecosystem & Synergy Score (Users -> Assignments -> KB -> Logs)
    // 🛡️ Optimized: Using subqueries to avoid heavy 4-way join explosion
    const topContributorsRes = await db.prepare(`
      SELECT * FROM (
        SELECT 
          u.name, u.role, u.team,
          (SELECT COUNT(DISTINCT inc_id) FROM incident_assignments WHERE user_id = u.employee_id) as assigned_count,
          (SELECT COUNT(DISTINCT id) FROM knowledge_base WHERE reg_id = u.employee_id) as kb_count,
          (
            (SELECT COUNT(DISTINCT id) FROM knowledge_base WHERE reg_id = u.employee_id) * 10 + 
            (SELECT COUNT(*) FROM activity_logs WHERE user_id = u.employee_id) * 2
          ) as synergy_score
        FROM users u
        WHERE u.is_active = 1
      ) t
      WHERE t.synergy_score > 0
      ORDER BY t.synergy_score DESC
      LIMIT 5
    `).all();
    
    const topContributors = topContributorsRes.results || [];

    // 4. Intelligence Category Density
    const categoriesRes = await db.prepare(`
      SELECT category, COUNT(*) as c 
      FROM knowledge_base 
      GROUP BY category 
      ORDER BY c DESC
    `).all();
    const categories = categoriesRes.results || [];

    // 5. Recent High-End Activity Feed (Full Context)
    const recentFeedRes = await db.prepare(`
      SELECT 
        k.title, k.reg_dt, k.category,
        u.name as reg_name, u.role as reg_role
      FROM knowledge_base k
      LEFT JOIN users u ON k.reg_id = u.employee_id
      ORDER BY k.reg_dt DESC
      LIMIT 5
    `).all();
    const recentFeed = recentFeedRes.results || [];

    // 6. 이번달 vs 저번달 KB 증가율 (실데이터)
    const thisMonthKbRes = await db.prepare(`
      SELECT COUNT(*) as c FROM knowledge_base
      WHERE strftime('%Y-%m', reg_dt) = strftime('%Y-%m', 'now')
    `).first();
    const lastMonthKbRes = await db.prepare(`
      SELECT COUNT(*) as c FROM knowledge_base
      WHERE strftime('%Y-%m', reg_dt) = strftime('%Y-%m', date('now','-1 month'))
    `).first();
    const thisMonthKb = thisMonthKbRes?.c || 0;
    const lastMonthKb = lastMonthKbRes?.c || 0;
    const growthVal = lastMonthKb > 0
      ? `${thisMonthKb >= lastMonthKb ? '+' : ''}${Math.round(((thisMonthKb - lastMonthKb) / lastMonthKb) * 100)}%`
      : (thisMonthKb > 0 ? `+${thisMonthKb}건` : '-');

    // 7. 실제 incident_assignments 기반 배정 인원
    const assignedUsersRes = await db.prepare(`
      SELECT COUNT(DISTINCT user_id) as c FROM incident_assignments
    `).first();
    const assignedUsers = assignedUsersRes?.c || 0;

    return c.json({
      incidents: { 
        total: totalInc, 
        resolved: resolvedInc, 
        rate: resolveRate,
        integrity: governanceRate,
        mttr: Math.round(mttrVal)
      },
      knowledge: { 
        total: knowledgeCount, 
        growth: growthVal
      }, 
      warrooms: { 
        active: activeWarRooms,
        assignedUsers
      },
      categories,
      topContributors,
      recentFeed
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
  const url = new URL(c.req.url)
  const employeeId = c.req.query('employee_id') || c.req.query('id') || c.req.query('userId')
  
  if (hasParam && !employeeId) {
    return c.json({ error: "사번(employee_id) 값이 누락되었습니다." }, 400)
  }

  if (employeeId) {
    // ⚡ iPhone Shortcut / User Specific Mode
    // 🚀 무조건 user_keywords 테이블만 참조하여 개인 감지 키워드만 반환
    console.log(`[Keyword-API] Fetching EXCLUSIVELY from user_keywords for: ${employeeId}`);
    const result = await db.prepare("SELECT keywords FROM user_keywords WHERE user_id = ?").bind(employeeId).first()
    
    // 사용자가 등록한 키워드가 없으면 기본 장애 키워드 세트를 제공
    let keywordStr = result ? result.keywords : ""
    if (!keywordStr) {
      keywordStr = "IN USED FILE|DELAY|임계치|ERROR|테스트|Z FILE EXITS|Z FILE|임계|ABEND|장애|오류|에러";
    }

    const keywordList = keywordStr.split('|').map(k => k.trim()).filter(Boolean)
    
    // 개인 키워드를 객체 배열로 변환
    const personalKeywords = keywordList.map(k => ({
      keyword: k,
      response: `[감지] ${k} 장애 예상`,
      severity: 'CRITICAL',
      is_personal: true
    }))

    return c.json({ 
      success: true,
      employee_id: employeeId,
      keywords: personalKeywords, // 🛡️ 글로벌 키워드 병합 제거
      keywordList: keywordList,
      userKeywords: keywordStr,
      count: keywordList.length,
      timestamp: new Date().toISOString()
    })
  }

  // 1. 기본 글로벌 장애 키워드 목록 조회 (사번이 없을 때만)
  const { results: globalKeywords } = await db.prepare("SELECT * FROM alert_keywords").all()
  return c.json({ keywords: globalKeywords })
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

// ── NEW: User Specific Keyword Management ────────────────────────────────────
app.get('/sms/user-keywords', async (c) => {
  const user = c.get('user')
  const db = c.env.DB
  const userId = user.employee_id
  
  const result = await db.prepare("SELECT keywords FROM user_keywords WHERE user_id = ?").bind(userId).first()
  return c.json({ 
    keywords: result ? result.keywords : "",
    userId: userId
  })
})
app.post('/sms/user-keywords', async (c) => {
  const user = c.get('user') || {}
  const db = c.env.DB
  const userId = user.employee_id || user.sub || user.id;
  const { keywords } = await c.req.json()
  
  if (!userId || userId === 'undefined' || userId === 'null') {
    return c.json({ error: "로그인 정보가 유효하지 않습니다. (사번 누락)", userId: "NONE" }, 401);
  }
  
  const nowKst = getKst()
  
  // 🛡️ Audit 컬럼 추가 및 데이터 무결성 보장
  try {
    await db.prepare(`
      INSERT INTO user_keywords (
        user_id, keywords, reg_id, reg_dt, mod_id, mod_dt, updated_at
      ) 
      VALUES (?, ?, ?, ?, ?, ?, ?) 
      ON CONFLICT(user_id) DO UPDATE SET 
        keywords = excluded.keywords, 
        mod_id = excluded.mod_id,
        mod_dt = excluded.mod_dt,
        updated_at = excluded.updated_at
    `).bind(userId, keywords, userId, nowKst, userId, nowKst, nowKst).run()
    
    return c.json({ status: "success", userId })
  } catch (err) {
    // 만약 테이블에 Audit 컬럼이 없어서 에러가 난다면 자동 패치 시도 (임시 대응)
    if (err.message.includes("has no column named reg_id")) {
      await db.prepare("ALTER TABLE user_keywords ADD COLUMN reg_id TEXT").run().catch(()=>{});
      await db.prepare("ALTER TABLE user_keywords ADD COLUMN reg_dt DATETIME").run().catch(()=>{});
      await db.prepare("ALTER TABLE user_keywords ADD COLUMN mod_id TEXT").run().catch(()=>{});
      await db.prepare("ALTER TABLE user_keywords ADD COLUMN mod_dt DATETIME").run().catch(()=>{});
      // 재시도
      await db.prepare(`
        INSERT INTO user_keywords (user_id, keywords, updated_at) 
        VALUES (?, ?, ?) 
        ON CONFLICT(user_id) DO UPDATE SET keywords = excluded.keywords, updated_at = excluded.updated_at
      `).bind(userId, keywords, nowKst).run()
      return c.json({ status: "success", userId, note: "table_patched" })
    }
    throw err;
  }
})

// ── NEW: iPhone Shortcut Dedicated Endpoint ──────────────────────────────────
// 아이폰 단축어에서 GET 요청으로 키워드를 쉽게 가져갈 수 있도록 하는 전용 경로
app.get('/sms/shortcut/keywords', async (c) => {
  const db = c.env.DB
  const userId = c.req.query('userId') || c.req.query('id')
  
  // 🔐 SECURITY: iPhone 단축어 전용 비밀키 확인 (금융권 수준 보안 적용)
  const authKey = c.req.header('X-SGUARD-AUTH')
  if (authKey !== c.env.SHORTCUT_SECRET) {
    return c.json({ error: "Unauthorized: Invalid or missing X-SGUARD-AUTH header" }, 401)
  }
  
  if (!userId) {
    return c.json({ error: "userId is required" }, 400)
  }
  
  // 보안을 위해 token 검증 로직이 필요할 수 있으나, 
  // 여기서는 기본적으로 user_keywords 테이블에서 해당 사용자의 데이터를 조회합니다.
  const result = await db.prepare("SELECT keywords FROM user_keywords WHERE user_id = ?").bind(userId).first()
  
  return c.json({
    userId: userId,
    keywords: result ? result.keywords : "",
    keywordList: result ? result.keywords.split('|').filter(k => k.trim()) : [],
    timestamp: new Date().toISOString()
  })
})

// ==========================================
// 🚀 NEW: Codebook (Common Code) APIs
// ==========================================
app.get('/sms/codebook', async (c) => {
  const db = c.env.DB
  const category = c.req.query('category')
  let query = "SELECT * FROM code_book WHERE is_active = 1"
  let params = []
  
  if (category) {
    query += " AND category = ?"
    params.push(category)
  }
  query += " ORDER BY category ASC, sort_order ASC"
  
  const { results } = await db.prepare(query).bind(...params).all()
  return c.json({ codes: results })
})

app.post('/sms/codebook', async (c) => {
  const data = await c.req.json()
  const db = c.env.DB
  const now = getKst()
  
  const res = await db.prepare(`
    INSERT INTO code_book (
      category, code, name, sort_order, is_active, description, 
      reg_id, reg_dt, mod_id, mod_dt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    data.category, data.code, data.name, data.sort_order || 0, 
    data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1,
    data.description || null,
    data.reg_id || 'SYSTEM', now, data.mod_id || 'SYSTEM', now
  ).run()
  
  return c.json({ status: "success", id: res.meta.last_row_id })
})

app.put('/sms/codebook/:id', async (c) => {
  const id = c.req.param('id')
  const data = await c.req.json()
  const db = c.env.DB
  const now = getKst()
  
  await db.prepare(`
    UPDATE code_book SET 
      category = ?, code = ?, name = ?, sort_order = ?, 
      is_active = ?, description = ?, mod_dt = ?
    WHERE id = ?
  `).bind(
    data.category, data.code, data.name, data.sort_order || 0,
    data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1,
    data.description || null, now, id
  ).run()
  
  return c.json({ status: "success" })
})

app.delete('/sms/codebook/:id', async (c) => {
  const id = c.req.param('id')
  const db = c.env.DB
  await db.prepare("DELETE FROM code_book WHERE id = ?").bind(id).run()
  return c.json({ status: "success" })
})

app.get('/incidents', async (c) => {
  const db = c.env.DB
  const { inc_id, keyword, startDate, endDate, orgCode, orgName, assignee } = c.req.query()
  
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
      r.keyword_detected,
      r.response_message,
      ua.name as assignee_name,
      GROUP_CONCAT(DISTINCT uaa.name) as assignment_list,
      COALESCE(ua.company, uaa.company) as company,
      COALESCE(ua.honbu, uaa.honbu) as honbu,
      COALESCE(ua.team, uaa.team) as team,
      COALESCE(ua.part, uaa.part) as part,
      COALESCE(ua.subpart, uaa.subpart) as subpart,
      (SELECT COUNT(1) FROM autopilot_insight ai WHERE ai.inc_id = i.inc_id) as is_analyzed,
      rp.title as report_title,
      CASE WHEN rp.id IS NOT NULL THEN 1 ELSE 0 END as has_report
    FROM incidents i
    LEFT JOIN (SELECT * FROM reports GROUP BY inc_id) rp ON i.inc_id = rp.inc_id
    LEFT JOIN users ua ON i.assigned_to = ua.employee_id
    LEFT JOIN incident_assignments ia ON i.inc_id = ia.inc_id
    LEFT JOIN users uaa ON ia.user_id = uaa.employee_id
    LEFT JOIN received_messages r ON (i.inc_id = r.inc_id OR i.source_sms_id = r.inc_id)
    LEFT JOIN users us ON (r.employee_id = us.employee_id OR r.sender = us.phone)
    WHERE 1=1
  `
  const params = []
  
  if (inc_id) {
    query += " AND i.inc_id = ?"
    params.push(inc_id)
  }
  
  if (keyword) {
    query += " AND (i.title LIKE ? OR i.description LIKE ? OR rp.title LIKE ? OR rp.content LIKE ?)"
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`)
  }
  
  if (startDate) {
    query += " AND date(i.created_at) >= date(?)"
    params.push(startDate)
  }
  
  if (endDate) {
    query += " AND date(i.created_at) <= date(?)"
    params.push(endDate)
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
  
  if (orgName) {
    query += ` AND (
      i.assigned_to IN (SELECT employee_id FROM users WHERE company LIKE ? OR honbu LIKE ? OR team LIKE ? OR part LIKE ? OR subpart LIKE ?)
      OR EXISTS (
        SELECT 1 FROM incident_assignments ia_sub
        INNER JOIN users u_sub ON ia_sub.user_id = u_sub.employee_id
        WHERE ia_sub.inc_id = i.inc_id
        AND (u_sub.company LIKE ? OR u_sub.honbu LIKE ? OR u_sub.team LIKE ? OR u_sub.part LIKE ? OR u_sub.subpart LIKE ?)
      )
    )`
    const likeVal = `%${orgName}%`
    for(let i=0; i<10; i++) params.push(likeVal)
  }
  
  if (assignee) {
    // Check if the name or ID exists in the main assignee field OR the assignment list OR the sender (reporter)
    query += " AND (ua.name LIKE ? OR i.assigned_to = ? OR uaa.name LIKE ? OR ia.user_id = ? OR us.name LIKE ? OR r.employee_id = ?)"
    params.push(`%${assignee}%`, assignee, `%${assignee}%`, assignee, `%${assignee}%`, assignee)
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
  const inc_id = String(data.inc_id)
  const rawId = inc_id

  try {
    // Fetch actual message from received_messages
    const sms = await db.prepare("SELECT message FROM received_messages WHERE inc_id = ?").bind(rawId).first()
    const msg = sms ? sms.message : (data.title || 'SMS 장애 감지')
    const finalTitle = `INC-${inc_id} | ${msg}`

    await db.prepare(`
      INSERT OR IGNORE INTO incidents (
        inc_id, title, description, severity, status, incident_type, 
        assigned_to, source_sms_id, ai_insight, reg_id, reg_dt, mod_id, mod_dt, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      rawId, finalTitle, data.description || null, data.severity || 'NORMAL',
      data.status || 'INC_001', data.incident_type || 'AI', data.assigned_to || null,
      data.source_sms_id || null, data.ai_insight || null,
      'SYSTEM', now, 'SYSTEM', now, now, now
    ).run()

    return c.json({ status: "success", id: rawId, title: finalTitle })
  } catch (e) {
    console.error('[POST /incidents] Error:', e.message)
    return c.json({ error: e.message }, 500)
  }
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

// [CREATE] 피드백 저장 (Phase 3: 거버넌스 및 자동 카테고리화 적용)
app.post('/ai/feedback', async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  const db = c.env.DB

  const {
    inc_id: incident_id,
    vector_id,
    query,
    answer,
    context,
    feedback_type,
    reason,
    user_correction,
    error_category
  } = body

  if (!query || !answer || !feedback_type) {
    return c.json({ detail: '필수 피드백 정보가 누락되었습니다.' }, 400)
  }

  const now = getKst()
  // JWT payload = { sub: employee_id, ... } → user.sub가 실제 사번
  // body.user_id는 클라이언트가 직접 전달하는 fallback
  const empId = user?.sub || user?.employee_id || user?.inc_id || body.user_id || null
  const finalCategory = error_category || (context?.sms?.category) || 'GENERAL'

  try {
    // empId가 없으면 인증 오류
    if (!empId) {
      return c.json({ detail: '사용자 인증 정보가 없습니다. 다시 로그인해 주세요.' }, 401)
    }

    // FK 제약 방지: employee_id가 users 테이블에 실제로 있는지 확인
    const userExists = await db.prepare("SELECT 1 FROM users WHERE employee_id = ?").bind(empId).first()
    const safeEmpId = userExists ? empId : 'SYSTEM'

    const res = await db.prepare(`
      INSERT INTO ai_feedback (
        user_id, incident_id, vector_id, query, answer, context, 
        feedback_type, reason, user_correction, error_category,
        created_at, reg_id, reg_dt, mod_id, mod_dt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      safeEmpId,
      incident_id || null,
      vector_id || null,
      query,
      answer,
      context ? (typeof context === 'object' ? JSON.stringify(context) : context) : null,
      feedback_type,
      reason || null,
      user_correction || null,
      finalCategory,
      now, safeEmpId, now, safeEmpId, now
    ).run()
    
    const feedbackId = res.meta?.last_row_id || Date.now()

    // 🚀 [Phase 7/9] Self-Healing Trigger: Real-time Re-learning (Full Automation)
    if (feedback_type === 'DOWN' && vector_id?.startsWith('kn-')) {
      const kbId = vector_id.replace('kn-', '')
      
      // Execute Real-time Re-learning / Isolation in background
      c.executionCtx.waitUntil((async () => {
        try {
          const now = getKst()
          const kbEntry = await db.prepare("SELECT content, title, version, fail_count FROM knowledge_base WHERE id = ?").bind(kbId).first()
          
          if (kbEntry) {
            if (user_correction) {
              // A. [HEALING] Expert provided a correction -> Apply and Reset Fail Count
              console.log(`[Self-Healing] Real-time healing for KB-${kbId}...`);
              
              const vector = await generateEmbedding(user_correction, c.env)
              if (!vector) throw new Error("Embedding generation failed");

              await db.prepare(`
                INSERT INTO knowledge_history (kb_id, previous_content, new_content, admin_id, change_reason)
                VALUES (?, ?, ?, ?, ?)
              `).bind(kbId, kbEntry.content, user_correction, empId, 'Real-time Self-Healing (Expert Feedback)').run()

              const nextVersion = (kbEntry.version || 1) + 1
              await db.prepare("UPDATE knowledge_base SET content = ?, status = ?, version = ?, vector = ?, fail_count = 0, priority_flag = 1, priority_score = 0.8, mod_dt = ? WHERE id = ?")
                .bind(user_correction, 'VERIFIED', nextVersion, JSON.stringify(vector), now, kbId).run()

              if (c.env.WARROOM_INDEX) {
                await c.env.WARROOM_INDEX.upsert([{
                  id: vector_id,
                  values: vector,
                  metadata: { type: 'knowledge', title: kbEntry.title, updated_at: now, version: nextVersion, priority: 0.8 }
                }])
              }
              console.log(`[Self-Healing-Strong] KB-${kbId} upgraded to v${nextVersion} (Priority Score: 0.8)`);
            } else {
              // B. [SOFT-PENALIZE] 교정값 없는 단순 부정 피드백 → fail_count 자동 증가
              const newFail = (kbEntry.fail_count || 0) + 1;
              await db.prepare(
                "UPDATE knowledge_base SET fail_count = ?, mod_dt = ? WHERE id = ?"
              ).bind(newFail, now, kbId).run();
              console.log(`[Soft-Penalize] KB-${kbId} fail_count → ${newFail}`);

              // 3회 이상 누적 시 자동 격리 (FAIL 상태로 강등)
              if (newFail >= 3) {
                await db.prepare(
                  "UPDATE knowledge_base SET status = 'FAIL', priority_score = 0.1, mod_dt = ? WHERE id = ?"
                ).bind(now, kbId).run();
                console.log(`[Auto-Isolation] KB-${kbId} isolated (fail_count=${newFail} ≥ 3)`);
              }
            }
          }
          
          // Cross-Reference: Strong boost for SMS incident
          if (vector_id?.startsWith('inc-') && user_correction) {
            const incId = vector_id.split('_')[0].replace('inc-', '');
            await db.prepare("UPDATE received_messages SET priority_flag = 1, priority_score = 0.8 WHERE inc_id = ?")
              .bind(incId).run();
            console.log(`[Boosting-Strong] SMS Incident ${incId} marked as high-reliability reference (0.8).`);
          }
        } catch (err) {
          console.error(`[Self-Healing-Error] KB-${kbId} failed:`, err.message);
        }
      })());
    }

    // 🚀 [Phase 2.4] Dynamic Few-shot: Vectorize user correction
    if (feedback_type === 'DOWN' && user_correction && c.env.WARROOM_INDEX) {
      c.executionCtx.waitUntil((async () => {
        try {
          const cleaned = query.replace(/[^\w\sㄱ-ㅎㅏ-ㅣ가-힣]/g, ' ').substring(0, 1000);
          const vector = await generateEmbedding(cleaned, c.env);
          if (vector) {
            await c.env.WARROOM_INDEX.upsert([{
              id: `fb-${feedbackId}`,
              values: vector,
              metadata: { type: 'feedback', query: query.substring(0, 100), correction: user_correction.substring(0, 100) }
            }]);
            console.log(`[Few-shot] Vectorized feedback fb-${feedbackId}`);
          }
        } catch (ve) {
          console.error("[Few-shot] Vectorization failed:", ve.message);
        }
      })());
    }

    // 🌟 [Positive Reinforcement] 👍 UP 피드백 → 매칭된 지식/인시던트 우선순위 자동 부스팅
    if (feedback_type === 'UP' && vector_id) {
      c.executionCtx.waitUntil((async () => {
        try {
          const now = getKst();

          if (vector_id.startsWith('kn-')) {
            // 지식베이스 항목 우선순위 점수 상승 (최대 1.0 상한선)
            const kbId = vector_id.replace('kn-', '');
            const kb = await db.prepare("SELECT priority_score, fail_count FROM knowledge_base WHERE id = ?").bind(kbId).first();
            if (kb) {
              // fail_count도 1 감소시켜 격리 위험 완화
              const newScore = Math.min(1.0, (kb.priority_score || 0.5) + 0.05);
              const newFail  = Math.max(0, (kb.fail_count || 0) - 1);
              await db.prepare(
                "UPDATE knowledge_base SET priority_score = ?, fail_count = ?, priority_flag = 1, mod_dt = ? WHERE id = ?"
              ).bind(newScore, newFail, now, kbId).run();
              console.log(`[Positive-Reinforcement] KB-${kbId} boosted → priority_score ${newScore.toFixed(2)}, fail_count ${newFail}`);
            }

          } else if (vector_id.startsWith('inc-')) {
            // SMS 인시던트 항목 우선순위 점수 상승
            const incId = vector_id.split('_')[0].replace('inc-', '');
            const msg = await db.prepare("SELECT priority_score FROM received_messages WHERE inc_id = ?").bind(incId).first();
            if (msg) {
              const newScore = Math.min(1.0, (msg.priority_score || 0.5) + 0.05);
              await db.prepare(
                "UPDATE received_messages SET priority_score = ?, priority_flag = 1 WHERE inc_id = ?"
              ).bind(newScore, incId).run();
              console.log(`[Positive-Reinforcement] Incident ${incId} boosted → priority_score ${newScore.toFixed(2)}`);
            }

          } else if (vector_id.startsWith('fb-')) {
            // 기존 Few-shot 피드백 항목도 신뢰도 상승 표시
            const fbId = vector_id.replace('fb-', '');
            await db.prepare(
              "UPDATE ai_feedback SET is_golden = 1, mod_dt = ? WHERE id = ?"
            ).bind(now, fbId).run();
            console.log(`[Positive-Reinforcement] Feedback fb-${fbId} marked as golden`);
          }

          // Vectorize 메타데이터도 부스트 반영 (검색 시 우선 노출)
          if (c.env.WARROOM_INDEX) {
            try {
              const existing = await c.env.WARROOM_INDEX.getByIds([vector_id]);
              if (existing && existing.length > 0) {
                const meta = existing[0].metadata || {};
                await c.env.WARROOM_INDEX.upsert([{
                  id: vector_id,
                  values: existing[0].values,
                  metadata: { ...meta, priority: Math.min(1.0, (meta.priority || 0.5) + 0.05), positively_reinforced: true }
                }]);
                console.log(`[Positive-Reinforcement] Vectorize metadata updated for ${vector_id}`);
              }
            } catch (ve) {
              // Vectorize getByIds 미지원 시 조용히 스킵
              console.log(`[Positive-Reinforcement] Vectorize meta update skipped (${ve.message})`);
            }
          }
        } catch (err) {
          console.error('[Positive-Reinforcement] Error:', err.message);
        }
      })());
    }

    return c.json({ message: '피드백이 성공적으로 등록되었습니다.', success: true, id: feedbackId })
  } catch (e) {
    console.error('[AI Feedback] Create Error:', e.message)
    return c.json({ detail: '피드백 등록에 실패했습니다.', error: e.message }, 500)
  }
})

// [PATCH] 피드백 수정 및 지식 동기화 (Phase 7: Self-Healing RAG Advanced)
app.patch('/ai/feedback/:id', async (c) => {
  const id = c.req.param('id')
  const user = c.get('user')
  const { status, is_golden, admin_comment, error_category } = await c.req.json()
  const db = c.env.DB
  const now = getKst()

  // 1. Basic Update (Feedback Table)
  const feedback = await db.prepare("SELECT * FROM ai_feedback WHERE id = ?").bind(id).first()
  if (!feedback) return c.json({ error: "피드백을 찾을 수 없습니다." }, 404)

  const updateFields = []
  const params = []
  if (status !== undefined) { updateFields.push("status = ?"); params.push(status); }
  if (is_golden !== undefined) { updateFields.push("is_golden = ?"); params.push(is_golden); }
  if (admin_comment !== undefined) { updateFields.push("admin_comment = ?"); params.push(admin_comment); }
  if (error_category !== undefined) { updateFields.push("error_category = ?"); params.push(error_category); }
  
  updateFields.push("mod_dt = ?"); params.push(now);
  params.push(id)

  await db.prepare(`UPDATE ai_feedback SET ${updateFields.join(", ")} WHERE id = ?`).bind(...params).run()

  // 1-1. 🚀 Automated Isolation (Threshold Logic)
  if (feedback.vector_id?.startsWith('kn-')) {
    const kbId = feedback.vector_id.replace('kn-', '')
    if (status === 'DOWN' || feedback.feedback_type === 'DOWN') {
      try {
        await db.prepare("UPDATE knowledge_base SET fail_count = fail_count + 1 WHERE id = ?").bind(kbId).run()
        const kb = await db.prepare("SELECT fail_count FROM knowledge_base WHERE id = ?").bind(kbId).first()
        if (kb && kb.fail_count >= 3) {
          await db.prepare("UPDATE knowledge_base SET status = 'FAIL' WHERE id = ?").bind(kbId).run()
          console.log(`[Isolation] KB-${kbId} isolated due to high fail count (${kb.fail_count})`);
        }
      } catch (e) {
        console.error("[Isolation] Update failed:", e.message);
      }
    }
  }

  // 2. 🚀 Knowledge Sync (Governance/Manual Override)
  // Even in Full Automation, Admin can manually trigger sync or re-apply correction
  if (status === 'APPLIED' && feedback.user_correction && feedback.vector_id) {
    const vid = feedback.vector_id
    
    // Process Knowledge Base Sync (kn- prefix)
    if (vid.startsWith('kn-')) {
      const kbId = vid.replace('kn-', '')
      const kbEntry = await db.prepare("SELECT content, title, version FROM knowledge_base WHERE id = ?").bind(kbId).first()
      
      if (kbEntry) {
        // A. Backup to History (If content changed)
        if (kbEntry.content !== feedback.user_correction) {
          await db.prepare(`
            INSERT INTO knowledge_history (kb_id, previous_content, new_content, admin_id, change_reason)
            VALUES (?, ?, ?, ?, ?)
          `).bind(kbId, kbEntry.content, feedback.user_correction, user.employee_id || 'ADMIN', admin_comment || 'Manual Governance Sync').run()
        }

        // B. Update D1 Knowledge Base (Ensure VERIFIED and latest content)
        const nextVersion = (kbEntry.version || 1) + 1
        const pScore = is_golden ? 1.0 : (kbEntry.priority_score || 0.5); // Boost to 1.0 if golden
        
        // Generate Vector (Required for sync)
        let vector = null
        if (c.env.AI) {
          try {
            vector = await generateEmbedding(feedback.user_correction, c.env)
          } catch (ve) { console.error("[Governance] Embedding failed:", ve.message); }
        }

        await db.prepare("UPDATE knowledge_base SET content = ?, status = ?, version = ?, vector = ?, priority_score = ?, mod_dt = ? WHERE id = ?")
          .bind(feedback.user_correction, 'VERIFIED', nextVersion, vector ? JSON.stringify(vector) : null, pScore, now, kbId).run()

        // C. Sync to Vectorize
        if (c.env.WARROOM_INDEX && vector) {
          try {
            await c.env.WARROOM_INDEX.upsert([{
              id: vid,
              values: vector,
              metadata: { type: 'knowledge', title: kbEntry.title, updated_at: now, version: nextVersion, priority: pScore }
            }])
            console.log(`[Governance] Manual sync complete for ${vid} (v${nextVersion}, Score: ${pScore})`);
          } catch (e) {
            console.error(`[Governance-Error] Vectorize failed:`, e.message);
          }
        }
      }
    }
  }

  return c.json({ status: "success", message: `피드백 상태가 변경되었습니다. ${status === 'APPLIED' ? '(수동 동기화 완료)' : ''}` })
})

// [READ] 피드백 목록 조회 (필터링 보강)
app.get('/ai/feedback', async (c) => {
  const db = c.env.DB
  const incId = c.req.query('inc_id')
  const status = c.req.query('status')
  const isGolden = c.req.query('is_golden')

  try {
    let sql = "SELECT * FROM ai_feedback WHERE 1=1"
    let params = []

    if (incId) { sql += " AND inc_id = ?"; params.push(incId); }
    if (status) { sql += " AND status = ?"; params.push(status); }
    if (isGolden !== undefined) { sql += " AND is_golden = ?"; params.push(Number(isGolden)); }

    sql += " ORDER BY created_at DESC"
    const { results } = await db.prepare(sql).bind(...params).all()
    return c.json({ success: true, results })
  } catch (e) {
    return c.json({ detail: '조회 실패', error: e.message }, 500)
  }
})

// [ANALYZE] 피드백 통계 분석
app.get('/ai/feedback/stats', async (c) => {
  const db = c.env.DB
  try {
    const categoryStats = await db.prepare(`
      SELECT error_category, COUNT(*) as total,
             SUM(CASE WHEN feedback_type = 'UP' THEN 1 ELSE 0 END) as up_count,
             SUM(CASE WHEN feedback_type = 'DOWN' THEN 1 ELSE 0 END) as down_count
      FROM ai_feedback GROUP BY error_category
    `).all()

    const overallStats = await db.prepare(`
      SELECT feedback_type, COUNT(*) as count FROM ai_feedback GROUP BY feedback_type
    `).all()

    return c.json({ success: true, stats: { by_category: categoryStats.results, overall: overallStats.results } })
  } catch (e) {
    return c.json({ detail: '통계 산출 실패', error: e.message }, 500)
  }
})

app.post('/activity-logs', async (c) => {
  const data = await c.req.json()
  const db = c.env.DB
  const now = getKst()
  const inc_id = data.incident_code ? String(data.incident_code) : null
  
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

  // DB 실제 status 값: NULL(진행중), 'CLOSED'(완료), '최종완료'(완료)
  // 프론트 기대값: 'Open'(진행중), 'Completed'(완료)
  // → 필터를 DB 실제값으로 역변환
  let dbStatusCondition = ''
  const params = []

  let sql = `
    SELECT
      w.inc_id                          AS code,
      w.inc_id,
      w.title,
      w.title                           AS msg,
      r.message                         AS sms_message,
      UPPER(COALESCE(w.severity, 'NORMAL')) AS severity,
      w.status                          AS raw_status,
      w.creator_id,
      w.leader_summary,
      w.reg_dt,
      (SELECT COUNT(*) FROM warroom_chats wc WHERE wc.inc_id = w.inc_id)       AS message_count,
      (SELECT COUNT(*) FROM warroom_attachments wa WHERE wa.inc_id = w.inc_id) AS attachment_count,
      (SELECT wc2.text FROM warroom_chats wc2 WHERE wc2.inc_id = w.inc_id ORDER BY wc2.timestamp DESC LIMIT 1)     AS last_message,
      (SELECT u_msg.name FROM warroom_chats wc2 LEFT JOIN users u_msg ON wc2.sender = u_msg.employee_id WHERE wc2.inc_id = w.inc_id ORDER BY wc2.timestamp DESC LIMIT 1)   AS last_message_sender,
      (SELECT wc2.timestamp FROM warroom_chats wc2 WHERE wc2.inc_id = w.inc_id ORDER BY wc2.timestamp DESC LIMIT 1) AS last_message_time
    FROM warroom_list w
    LEFT JOIN received_messages r ON w.inc_id = r.inc_id
    WHERE 1=1
  `

  if (q) { sql += ` AND (w.title LIKE ? OR w.inc_id LIKE ?)`; params.push(`%${q}%`, `%${q}%`) }

  // status 필터: 프론트 값 → DB 실제값으로 변환
  if (statusFilter === 'Completed') {
    sql += ` AND (UPPER(w.status) = 'CLOSED' OR w.status = '최종완료')`
  } else if (statusFilter === 'Open') {
    sql += ` AND (w.status IS NULL OR (UPPER(w.status) != 'CLOSED' AND w.status != '최종완료'))`
  }
  // 'all' 또는 파라미터 없으면 전체 반환

  sql += ` ORDER BY w.reg_dt DESC LIMIT 50`

  const stmt = db.prepare(sql)
  const { results } = await stmt.bind(...params).all()

  // DB status → 프론트 기대값 변환
  const mapped = (results || []).map(r => {
    const raw = r.raw_status
    let status
    if (!raw || (raw.toUpperCase() !== 'CLOSED' && raw !== '최종완료')) {
      status = 'Open'
    } else {
      status = 'Completed'
    }
    return { ...r, status, raw_status: undefined }
  })

  return c.json({ rooms: mapped })
})

// Global Search Helper for Hybrid RAG (v2: Rich & Broad Search)
const performHybridSearch = async (query, env, db, topK = 20) => {
  const metadata = extractSearchMetadata(query);
  const results = [];
  const seenIds = new Set();
  
  // 1. Path A: SQL Structured Search (High Precision)
  try {
    // A-1. Knowledge Base Exact Match (Reputation Weighted)
    if (metadata.error_code || metadata.target_system) {
      let kbSql = `
        SELECT k.id, k.title, k.content, k.priority_score, k.tags, u.reputation_score 
        FROM knowledge_base k
        LEFT JOIN users u ON k.reg_id = u.employee_id
        WHERE (k.error_code = ? OR k.system_name = ?) AND k.status != 'FAIL'
      `;
      const kbParams = [metadata.error_code || null, metadata.target_system || null];
      
      const { results: kbMatches } = await db.prepare(kbSql).bind(...kbParams).all();
      kbMatches?.forEach(m => {
        const mid = `kn-${m.id}`;
        if (!seenIds.has(mid)) {
          // ⭐ Phase 15 Reputation-Weighted Boost
          const repFactor = (m.reputation_score || 100.0) / 100.0;
          let boost = (m.priority_score || 0) * 0.3 * repFactor;
          
          // 🏆 Phase 17 Master Bonus for Gold/Legendary Guards
          if (m.rank_status === 'Gold Guard' || m.rank_status === 'Legendary Guard') boost += 0.1;

          if (m.tags && metadata.error_code && m.tags.includes(metadata.error_code)) boost += 0.2;
          
          const finalScore = Math.min(1.0, 1.0 + boost);
          results.push({ id: mid, score: finalScore, type: 'kb_sql_exact', content: m.content, title: m.title });
          seenIds.add(mid);
        }
      });
    }

    // A-2. Knowledge Base Title Keyword Match (Reputation Weighted)
    if (metadata.keywords && metadata.keywords.length > 0) {
      const kwSql = `
        SELECT k.id, k.title, k.content, k.priority_score, k.tags, u.reputation_score 
        FROM knowledge_base k
        LEFT JOIN users u ON k.reg_id = u.employee_id
        WHERE (${metadata.keywords.map(() => "k.title LIKE ?").join(" OR ")}) AND k.status != 'FAIL' LIMIT 5
      `;
      const kwParams = metadata.keywords.map(k => `%${k}%`);
      const { results: kwMatches } = await db.prepare(kwSql).bind(...kwParams).all();
      kwMatches?.forEach(m => {
        const mid = `kn-${m.id}`;
        if (!seenIds.has(mid)) {
          const repFactor = (m.reputation_score || 100.0) / 100.0;
          let boost = (m.priority_score || 0) * 0.3 * repFactor;
          
          if (m.tags && metadata.keywords.some(k => m.tags.includes(k))) boost += 0.2;

          const finalScore = Math.min(1.0, 0.9 + boost);
          results.push({ id: mid, score: finalScore, type: 'kb_title_match', content: m.content, title: m.title });
          seenIds.add(mid);
        }
      });
    }

    // A-3. Incident History SQL Match (Reputation Weighted)
    if (metadata.sender || metadata.error_code || metadata.target_system) {
      let smsSql = `
        SELECT m.inc_id, m.message, m.priority_score, m.tags, u.reputation_score 
        FROM received_messages m
        LEFT JOIN users u ON m.employee_id = u.employee_id
        WHERE 1=1
      `;
      const smsParams = [];
      if (metadata.sender) { smsSql += " AND m.sender = ?"; smsParams.push(metadata.sender); }
      if (metadata.error_code) { smsSql += " AND m.message LIKE ?"; smsParams.push(`%${metadata.error_code}%`); }
      if (metadata.target_system) { smsSql += " AND m.target_system = ?"; smsParams.push(metadata.target_system); }
      
      smsSql += " ORDER BY m.reg_dt DESC LIMIT 10";
      const { results: smsMatches } = await db.prepare(smsSql).bind(...smsParams).all();
      smsMatches?.forEach(m => {
        const mid = `inc-${m.inc_id}`;
        if (!seenIds.has(mid)) {
          const repFactor = (m.reputation_score || 100.0) / 100.0;
          let boost = (m.priority_score || 0) * 0.3 * repFactor;
          
          if (m.tags && metadata.error_code && m.tags.includes(metadata.error_code)) boost += 0.2;

          const finalScore = Math.min(1.0, 0.8 + boost);
          results.push({ 
            id: mid, 
            score: finalScore, 
            type: 'sms_sql_match', 
            content: m.message,
            title: `[이력 매칭] ${m.message.substring(0, 30)}...` 
          });
          seenIds.add(mid);
        }
      });
    }
  } catch (e) { console.error("[Hybrid] SQL Path Error:", e.message); }

  // 2. Path B: Vector Semantic Search
  if (env.WARROOM_INDEX) {
    const cleaned = cleanMessageForEmbedding(query);
    const vector = await generateEmbedding(cleaned, env);
    if (vector) {
      const simResults = await env.WARROOM_INDEX.query(vector, { topK: topK, returnMetadata: true });
      if (simResults.matches) {
        for (const m of simResults.matches) {
          if (!seenIds.has(m.id)) {
            let pScore = m.metadata?.priority || 0;
            let tags = m.metadata?.tags || "";
            
            // Check D1 for latest score/tags if needed
            if (m.id.startsWith('inc-')) {
              const possibleId = m.id.split('_')[0].replace('inc-', '');
              const msg = await db.prepare("SELECT priority_score, tags FROM received_messages WHERE inc_id = ?").bind(possibleId).first();
              if (msg) {
                pScore = msg.priority_score || 0;
                tags = msg.tags || "";
              }
            } else if (m.id.startsWith('kn-')) {
              const kb = await db.prepare("SELECT priority_score, tags FROM knowledge_base WHERE id = ?").bind(m.id.replace('kn-', '')).first();
              if (kb) {
                pScore = kb.priority_score || 0;
                tags = kb.tags || "";
              }
            }

            let boost = pScore * 0.3;
            // 🏷️ Tag Bonus (+0.2)
            if (tags && metadata.error_code && tags.includes(metadata.error_code)) boost += 0.2;

            const scaledScore = Math.min(1.0, (m.score * 0.7) + boost);
            results.push({ id: m.id, score: scaledScore, type: 'vector_match', content: m.metadata?.content || "", title: m.metadata?.title || "유사 사례" });
            seenIds.add(m.id);
          }
        }
      }
    }
  }

  return { results: results.sort((a, b) => b.score - a.score), metadata };
}

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
    const norm_id = String(recent_sms.inc_id).trim()
    current_log_id = `KMS-${norm_id}`
    timestamp = recent_sms.timestamp
    
    // Attempt lookup with normalized ID
    const insight = await db.prepare("SELECT content FROM autopilot_insight WHERE inc_id = ?").bind(norm_id).first()
    if (insight) {
      insight_text = insight.content
    } else {
      // 🚀 Only prefix if there is no official insight yet to prevent overlapping with error logs
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
  const { incident_id, content, severity, category, user_id, similarity_score, similarity_reason } = await c.req.json()
  const db = c.env.DB
  const now = getKst()
  
  const norm_id = String(incident_id || '').trim()
  
  await db.prepare(`
    INSERT OR REPLACE INTO autopilot_insight 
    (inc_id, content, severity, category, reg_id, reg_dt, mod_id, mod_dt, similarity_score, similarity_reason)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(norm_id, content, severity, category, user_id || 'SYSTEM', now, user_id || 'SYSTEM', now, (similarity_score !== undefined && similarity_score !== null) ? similarity_score : null, (similarity_reason !== undefined && similarity_reason !== null) ? similarity_reason : null).run()
  
  return c.json({ status: 'saved', inc_id: norm_id })
})

app.get('/ai/insight/:id', async (c) => {
  const raw_id = c.req.param('id')
  const inc_id = String(raw_id).trim()
  const db = c.env.DB
  try {
    const insight = await db.prepare("SELECT * FROM autopilot_insight WHERE inc_id = ?").bind(inc_id).first()
    if (!insight) return c.json({ exists: false, error: "Insight not found" }, 200)
    return c.json(insight)
  } catch (e) {
    return c.json({ error: e.message }, 500)
  }
})

app.post('/ai/chat', async (c) => {
  const { query, incident_id, conversation_id } = await c.req.json()
  const api_key = c.env.DIFY_API_KEY_ASSISTANT || "app-ZDaVB8EWtA5vmTYJLmbysdQq"
  const api_base = c.env.DIFY_API_BASE || 'https://api.dify.ai/v1'

  if (!api_key) {
    return c.json({ response: "DIFY_API_KEY_ASSISTANT가 설정되지 않았습니다." })
  }

  // Use streaming mode as Agent Chat Apps (like the Assistant) generally require it
  const payload = {
    inputs: {},
    query: query,
    response_mode: "streaming",
    conversation_id: conversation_id || "",
    user: "sguard-worker"
  }

  try {
    // 🚀 Retry once on transient Dify errors (5xx / 429)
    let response = null
    for (let attempt = 1; attempt <= 2; attempt++) {
      response = await fetch(`${api_base}/chat-messages`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${api_key}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(payload)
      })
      if (response.ok) break
      if (attempt < 2 && (response.status >= 500 || response.status === 429)) {
        const delay = response.status === 429 ? 3000 : 2000
        console.warn(`[AI Chat] Dify transient error (${response.status}), retrying in ${delay}ms...`)
        await new Promise(r => setTimeout(r, delay))
      }
    }

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[AI Chat] Dify Error: ${response.status}`, errText)
      return c.json({ response: `Dify API 오류 (${response.status})` }, response.status)
    }

    // SSE Streaming Proxy to the Frontend (Maintains real-time response)
    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()

    ;(async () => {
      try {
        const reader = response.body.getReader()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          await writer.write(value)
        }
      } catch(e) {
        console.error(`[AI Chat] Stream Error:`, e)
      } finally {
        await writer.close()
      }
    })()

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    })

  } catch (e) {
    console.error(`[AI Chat] Failed to fetch:`, e)
    return c.json({ response: `AI 서버 연결 실패: ${e.message}` }, 500)
  }
})


// [DELETE] 피드백 삭제
app.delete('/ai/feedback/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')

  try {
    const { success } = await db.prepare("DELETE FROM ai_feedback WHERE id = ?").bind(id).run()
    if (!success) return c.json({ detail: '삭제할 데이터를 찾지 못했습니다.' }, 404)
    return c.json({ success: true, message: '피드백이 삭제되었습니다.' })
  } catch (e) {
    return c.json({ detail: '피드백 삭제에 실패했습니다.', error: e.message }, 500)
  }
})


app.post('/ai/analyze-sms', async (c) => {
  const { sender, message, sms_id, force } = await c.req.json()
  const db = c.env.DB
  const api_key = c.env.DIFY_API_KEY_SUMMARIZER || c.env.DIFY_API_KEY || "app-owwPp3j2qAvVDZpW2UUiY8L3"
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
- 실제발생시각(문자 내 시간): ${sms.occurrence_time || 'N/A'}
- 시스템 장애 접수 시각: ${sms.timestamp}
`
    }
  }
  // 🚀 [Phase 2.2] Few-shot Feedback Context Retrieval
  let feedbackContext = "";
  try {
    const smsInfo = await db.prepare("SELECT error_code, service_name FROM received_messages WHERE inc_id = ?").bind(String(sms_id)).first();
    let fbQuery = "SELECT query, user_correction FROM ai_feedback WHERE feedback_type = 'DOWN' AND user_correction IS NOT NULL ORDER BY created_at DESC LIMIT 3";
    let fbParams = [];

    if (smsInfo && (smsInfo.error_code || smsInfo.service_name)) {
      fbQuery = `
        SELECT query, user_correction FROM ai_feedback 
        WHERE feedback_type = 'DOWN' AND user_correction IS NOT NULL 
        AND (query LIKE ? OR query LIKE ? OR answer LIKE ?)
        ORDER BY created_at DESC LIMIT 3
      `;
      const kw = smsInfo.error_code || smsInfo.service_name || 'NEVER_MATCH';
      fbParams = [`%${kw}%`, `%${smsInfo.service_name || kw}%`, `%${kw}%` ];
    }
    const { results: pastFeedbacks } = await db.prepare(fbQuery).bind(...fbParams).all();
    if (pastFeedbacks?.length > 0) {
      feedbackContext = "\n\n[💡 과거 관제사 정정 사례 (Few-shot)]\n이번 분석 시 다음 정정 사례를 필수 참고하세요:\n";
      pastFeedbacks.forEach((fb, i) => {
        feedbackContext += `${i+1}. 질문: ${fb.query}\n   교정: ${fb.user_correction}\n`;
      });
      feedbackContext += "--------------------------------------\n";
    }
  } catch (e) { console.error("[Few-shot] Error:", e.message); }

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

"⚠️ 중요: 응답 시간이 지연되지 않도록, 각 전문가의 의견은 핵심만 2~3줄 이내로 아주 짧고 간결하게 작성해. 또한 [AI War-Room Log] 섹션의 최초 타임라인 엔트리는 반드시 '시스템 장애 접수 시각'([YYYY-MM-DD HH:mm KST] 형식)을 기준으로 작성해 주세요."

[장애 로그]
발신자: ${sender}
메시지: ${message}
${detailedInfo}
${feedbackContext}`

  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  const encode = (s) => new TextEncoder().encode(s)

  ;(async () => {
    try {
      // 1. Check D1 cache first (unless forced)
      if (sms_id && !force) {
        const cached = await db.prepare("SELECT content, similarity_score, similarity_reason FROM autopilot_insight WHERE inc_id = ?").bind(String(sms_id)).first();
        if (cached && cached.content) {
          // 🛑 에러 캐시는 무시하고 실시간 재분석
          const isStaleError = (
            cached.content.startsWith('🤖') ||
            cached.content.startsWith('⚠️ 분석 대기') ||
            cached.content.includes('AI 엔진 서버 오류') ||
            cached.content.includes('Dify 측 서버 상태가 불안정') ||
            cached.content.includes('분석 품질 향상을 위해 대기 시간') ||
            cached.content.includes('인증 오류') ||
            cached.content.includes('엔드포인트 오류') ||
            cached.content.includes('대기 시간 초과')
          );

          if (isStaleError) {
            console.log(`[Cache Skip] Stale error cache for ${sms_id} — proceeding to live analysis`);
          } else {
            console.log(`[Cache Hit] Serving cached insight for ${sms_id}`);
            if (cached.similarity_score) {
              await writer.write(encode(`data: ${JSON.stringify({ similarity_score: cached.similarity_score, similarity_reason: cached.similarity_reason })}\n\n`));
            }
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
            const polled = await db.prepare("SELECT content, similarity_score, similarity_reason FROM autopilot_insight WHERE inc_id = ?").bind(String(sms_id)).first();
            
            const isStaleError = (val) => {
              if (!val) return false;
              return (
                val.startsWith('🤖') ||
                val.startsWith('⚠️ 분석 대기') ||
                val.includes('AI 엔진 서버 오류') ||
                val.includes('Dify 측 서버 상태가 불안정') ||
                val.includes('분석 품질 향상을 위해 대기 시간') ||
                val.includes('인증 오류') ||
                val.includes('엔드포인트 오류') ||
                val.includes('대기 시간 초과')
              );
            };

            if (polled && polled.content && !isStaleError(polled.content)) {
              // Send similarity score first if available
              if (polled.similarity_score !== null && polled.similarity_score !== undefined) {
                await writer.write(encode(`data: ${JSON.stringify({ similarity_score: polled.similarity_score, similarity_reason: polled.similarity_reason })}\n\n`));
              }
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

      // 3. Hybrid Search: SQL Metadata + Vectorize (Rich Context: Top-K 20)
      let similarityScore = null;
      let matchedContent = null;
      let matchedTitle = null;
      let matches = [];
      let similarityReason = null;

      if (message) {
        try {
          await writer.write(encode(`data: ${JSON.stringify({ status: 'searching', message: '🔍 지능형 하이브리드 검색 중(SQL+Vector)...' })}\n\n`));
          
          const hybrid = await performHybridSearch(message, c.env, db, 20);
          matches = hybrid.results;

          if (matches.length > 0) {
            similarityScore = matches[0].score;
            matchedTitle = matches[0].title || matches[0].id;
            const inputSnippet = message.length > 150 ? message.substring(0, 150) + "..." : message;
            similarityReason = `[지능형 하이브리드 검색] 유사도 분석 완료\n- 출처 DB: Vectorize & SQL Hybrid (매칭 ID: ${matches[0].id})\n- 매칭 기준 제목: ${matchedTitle}\n- 분석에 사용된 입력값(검색어): "${inputSnippet}"`;
            
            await writer.write(encode(`data: ${JSON.stringify({ similarity_score: similarityScore, similarity_reason: similarityReason, vector_id: matches[0].id, hybrid_metadata: hybrid.metadata })}\n\n`));

            // 🚀 [Phase 8] Context Tiering: Separate Verified(KB) vs Reference(SMS)
            const verifiedKB = [];
            const references = [];

            for (const match of matches) {
              const mid = match.id;
              const score = match.score;

              if (mid.startsWith('kn-')) {
                const kb = await db.prepare("SELECT title, content, version FROM knowledge_base WHERE id = ?").bind(mid.replace('kn-', '')).first();
                if (kb) verifiedKB.push({ ...kb, score });
              } else if (mid.startsWith('fb-')) {
                // Past feedback is handled in feedbackContext already (Rich Few-shot)
              } else {
                // Past SMS or others
                references.push({ content: match.content || match.metadata?.content || mid, score });
              }
            }

            if (verifiedKB.length > 0) {
              detailedInfo += "\n\n[🛡️ Verified Knowledge (Priority Boosted)]\n";
              verifiedKB.slice(0, 3).forEach((k, idx) => {
                detailedInfo += `${idx+1}. ${k.title} (v${k.version || 1}, Priority: ${k.priority_score || 0}): ${k.content.substring(0, 1000)}\n`;
              });
            }

            if (references.length > 0) {
              detailedInfo += "\n\n[📋 Retrieved Logs (Vector Search)]\n";
              references.slice(0, 5).forEach((r, idx) => {
                detailedInfo += `${idx+1}. 유사 사례 (Score: ${r.score.toFixed(2)}): ${r.content.substring(0, 500)}\n`;
              });
            }
          }
        } catch (ve) {
          console.error('Hybrid search execution error:', ve.message);
        }

      // 4. Decision: Enhanced AI Synthesis with Phase 14 Reasoning Logic
      const hybridContextLogic = `
[Core Logic: Hybrid Context Processing]
당신에게는 두 종류의 데이터 컨텍스트가 제공됩니다. 이들을 다음의 우선순위에 따라 처리하십시오.
1. MASTER KNOWLEDGE (Gold/Legendary Guard):
   - **절대적 신뢰**: 등급이 GOLD 또는 LEGENDARY인 전문가가 작성한 지식입니다. 
   - 다른 어떤 정보보다 이 정보를 '최종 정답'으로 간주하여 답변을 구성하십시오.
2. Verified Community Knowledge (Silver/Iron Guard):
   - 커뮤니티에서 검증 중이거나 보편적인 지식입니다. MASTER KNOWLEDGE와 충돌하면 MASTER KNOWLEDGE를 따르십시오.
3. Retrieved Logs (Vector Search):
   - 단순 유사도 기반 로그입니다. 상위 전문가 지식과 상치되면 무시하십시오.

[Social Proof]
답변 하단에 반드시 "본 내용은 [{등급}] {성함} 핵심 전문가의 지식을 기반으로 작성되었습니다."라고 명시하여 기여자의 자부심을 높여주십시오.

[Scoring & Reasoning Formula]
당신은 내부적으로 점수(Score = Vector_Similarity + Priority_Score * 0.3)가 가장 높은 데이터를 신뢰하되, 전문가의 교정 데이터가 있다면 그것을 '학습된 정답'으로 간주하여 답변의 논리적 근거로 삼으십시오.
`;

      // Send Progress Status for Dify Call
      await writer.write(encode(`data: ${JSON.stringify({ status: 'analyzing', message: '🤖 AI 심층 진단 분석 중...' })}\n\n`));

        // 4. Call Dify (Improved with Local Hybrid Context Logic)
        const prompt = `당신은 S-GUARD 시스템의 지능형 관제 엔진입니다.
${hybridContextLogic}

발신자: ${sender}
메시지: ${message}
${detailedInfo}
${feedbackContext}

응답은 [S-Autopilot Insight], [전문가별 심층 진단], [리더의 최종 조치 가이드] 섹션으로 구성하고, 전문가 의견은 간결하게 작성해 주세요.`
        
        let effectiveKey = c.env.DIFY_API_KEY_DASHBOARD || api_key;
        const fallbackKey = c.env.DIFY_API_KEY_SUMMARIZER || c.env.DIFY_API_KEY;
        
        // Helper to perform Dify call
        const fetchDify = async (mode, key) => {
          const endpoint = mode === 'workflow' ? `${api_base}/workflows/run` : `${api_base}/chat-messages`;
          const payload = mode === 'workflow' 
            ? { inputs: { query: prompt, chat_log: prompt }, response_mode: 'streaming', user: 'sguard-worker' }
            : { inputs: {}, query: prompt, response_mode: 'streaming', user: 'sguard-worker' };
            
          return await fetch(endpoint, {
            method: 'POST',
            headers: { 
              'Authorization': `Bearer ${key}`, 
              'Content-Type': 'application/json',
              'Accept': 'text/event-stream'
            },
            body: JSON.stringify(payload)
          });
        };

        let difyRes = await fetchDify('chat', effectiveKey);

        // 🚀 Retry once on transient server errors (5xx / 429) before falling back
        if (!difyRes.ok && (difyRes.status >= 500 || difyRes.status === 429)) {
          const retryDelay = difyRes.status === 429 ? 3000 : 2000;
          console.warn(`[AI Analyze] Chat API transient error (${difyRes.status}), switching to fallback key...`);
          await new Promise(r => setTimeout(r, retryDelay));
          // Use fallbackKey for retry
          difyRes = await fetchDify('chat', fallbackKey || effectiveKey);
        }

        if (!difyRes.ok) {
          const status = difyRes.status;
          console.warn(`[AI Analyze] Chat API failed (Status: ${status}), trying Workflow...`);
          
          // Switch to Workflow if Chat fails (typical for mixed app types)
          difyRes = await fetchDify('workflow', api_key);

          // Retry Workflow once on transient errors too
          if (!difyRes.ok && (difyRes.status >= 500 || difyRes.status === 429)) {
            console.warn(`[AI Analyze] Workflow transient error (${difyRes.status}), retrying...`);
            await new Promise(r => setTimeout(r, 2000));
            difyRes = await fetchDify('workflow', api_key);
          }
          
          if (!difyRes.ok) {
            const finalStatus = difyRes.status;
            let errorMsg = `Dify API 오류 (${finalStatus})`;
            if (finalStatus === 401) errorMsg = "🤖 AI 엔진 인증 오류 (Dify API Key를 확인해 주세요)";
            if (finalStatus === 404) errorMsg = "🤖 AI 엔진 엔드포인트 오류 (Dify 설정을 확인해 주세요)";
            
            await writer.write(encode(`data: ${JSON.stringify({ error: errorMsg })}\n\n`));
            throw new Error(errorMsg);
          }
        }

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
              // 🚀 Support Both Chat Apps and Workflow Apps
              if (data.event === 'message' || data.event === 'agent_message') {
                fullContent += (data.answer || "");
                await writer.write(encode(`data: ${JSON.stringify({ answer: data.answer })}\n\n`))
              } else if (data.event === 'text_chunk') {
                const chunk = data.data?.text || "";
                fullContent += chunk;
                await writer.write(encode(`data: ${JSON.stringify({ answer: chunk })}\n\n`))
              } else if (data.event === 'workflow_finished') {
                const outputs = data.data?.outputs;
                if (outputs) {
                  const workflowResult = outputs.text || outputs.result || outputs.output || 
                                       (Object.values(outputs).find(v => typeof v === 'string') || "");
                  
                  if (workflowResult && (!fullContent || !fullContent.includes(workflowResult.substring(0, 10)))) {
                    fullContent += workflowResult;
                    await writer.write(encode(`data: ${JSON.stringify({ answer: workflowResult })}\n\n`))
                  }
                }
              }
            } catch (e) {
              continue
            }
          }
        }
        
        // Auto-save insight to DB if successful
        if (fullContent && sms_id) {
          const now = getKst();
          const severity = fullContent.toLowerCase().includes('critical') ? 'CRITICAL' : 'INFO';
          await db.prepare(`
            INSERT INTO autopilot_insight (inc_id, content, severity, reg_id, reg_dt, mod_id, mod_dt, similarity_score, similarity_reason)
            VALUES (?, ?, ?, 'SYSTEM', ?, 'SYSTEM', ?, ?, ?)
            ON CONFLICT(inc_id) DO UPDATE SET 
              content=excluded.content, 
              mod_dt=excluded.mod_dt, 
              similarity_score=COALESCE(excluded.similarity_score, autopilot_insight.similarity_score),
              similarity_reason=COALESCE(excluded.similarity_reason, autopilot_insight.similarity_reason)
          `).bind(String(sms_id), fullContent, severity, now, now, similarityScore ?? null, similarityReason || matchedTitle || null).run();
        }
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
    db.prepare("SELECT wc.*, u.name as sender_name FROM warroom_chats wc LEFT JOIN users u ON wc.sender = u.employee_id WHERE wc.inc_id = ? ORDER BY wc.timestamp ASC").bind(rawId).all(),
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
  const inc_id = String(raw_id).trim()
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
  
  // ID Normalization: Use raw numeric ID (no INC- prefix) for database operations
  const cleanId = String(incident_id || '').replace(/^INC-/i, '');
   // Use cleanId directly as the primary identifier

  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  const encode = (s) => new TextEncoder().encode(s)

  ;(async () => {
    try {
      // 1. Parallel DB fetch - incident status + cache + timeline data
      const [incident, cached, incDetail, wfLogsResult] = await Promise.all([
        db.prepare("SELECT status FROM incidents WHERE inc_id = ?").bind(cleanId).first(),
        db.prepare("SELECT summary FROM chat_summaries WHERE inc_id = ?").bind(cleanId).first(),
        db.prepare("SELECT inc_id, reg_dt, created_at, title FROM incidents WHERE inc_id = ?").bind(cleanId).first(),
        db.prepare("SELECT step_id, completed_at FROM workflow_steps WHERE inc_id = ? ORDER BY completed_at ASC").bind(cleanId).all().catch(() => ({ results: [] }))
      ]);
      const wfLogs = wfLogsResult?.results || [];
      
      const finalStatuses = ['CLOSED', 'Completed', '처리완료', '완료', '최종완료', 'INC_003'];
      const isFinal = finalStatuses.includes(incident?.status || 'Open');

      const isRaw = (val) => {
        if (!val) return false;
        const rawPatterns = [/\[analyst\]\s*\d+:/, /\[User\]\s*[^:]+:/, /employee_id:/];
        return rawPatterns.some(p => p.test(val));
      };

      const isStaleError = (val) => {
        if (!val) return false;
        return (
          val.startsWith('🤖') ||
          val.startsWith('⚠️') ||
          val.includes('AI 엔진 서버 오류') ||
          val.includes('Dify 측 서버 상태가 불안정') ||
          val.includes('인증 오류') ||
          val.includes('엔드포인트 오류') ||
          val.includes('대기 시간 초과')
        );
      };

      // For finalized incidents, strictly serve from DB (Prevent Dify call)
      if (isFinal) {
        console.log(`[Re-Analysis Prevented] Incident ${cleanId} is final. Attempting DB read...`);
        
        // Priority 1: knowledge_base (finalized reports)
        const kb = await db.prepare("SELECT content FROM knowledge_base WHERE inc_id = ? AND category = 'REPORT'").bind(cleanId).first();
        if (kb && kb.content && !isRaw(kb.content) && !isStaleError(kb.content)) {
          console.log(`[Cache Hit] Serving finalized knowledge_base report for ${cleanId}`);
          // Send immediately without typewriter delay or status message to avoid confusion
          await writer.write(encode(`data: ${JSON.stringify({ answer: kb.content })}\n\n`));
          await writer.write(encode('data: [DONE]\n\n'));
          return;
        }

        // Priority 2: chat_summaries
        if (cached && cached.summary && !isRaw(cached.summary) && !isStaleError(cached.summary)) {
          console.log(`[Cache Hit] Serving cached summary for finalized incident ${cleanId}`);
          await writer.write(encode(`data: ${JSON.stringify({ answer: cached.summary })}\n\n`));
          await writer.write(encode('data: [DONE]\n\n'));
          return;
        }

        // If no valid text in DB, return empty message rather than hitting Dify
        await writer.write(encode(`data: ${JSON.stringify({ answer: '데이터베이스에 저장된 요약 내역이 존재하지 않습니다.' })}\n\n`));
        await writer.write(encode('data: [DONE]\n\n'));
        return;
      }

      if (cached && cached.summary && !isFinal) {
        console.log(`[Re-Analysis] Incident ${cleanId} is still active. Bypassing cache to update summary...`);
        await writer.write(encode(`data: ${JSON.stringify({ status: '대화 내용을 반영하여 리포트를 최신화하고 있습니다...' })}\n\n`));
      }


      // 2. Concurrency Lock check (KV)
      const lockKey = `lock:summarize-chat:${cleanId}`;
      if (kv) {
        let lock = await kv.get(lockKey);
        if (lock === 'processing') {
          console.log(`[Concurrency] Another user is summarizing chat for ${cleanId}. Waiting...`);
          await writer.write(encode(`data: ${JSON.stringify({ status: '분석 중입니다. 처리 중 ...' })}\n\n`));
          for (let attempt = 0; attempt < 30; attempt++) {
            await new Promise(r => setTimeout(r, 1000));
            const polled = await db.prepare("SELECT summary FROM chat_summaries WHERE inc_id = ?").bind(cleanId).first();
            if (polled && polled.summary && !isStaleError(polled.summary)) {
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

      // 3. Fetch ONLY user chat history - Using numeric ID
      const { results: wrResults } = await db.prepare("SELECT wc.*, u.name as sender_name FROM warroom_chats wc LEFT JOIN users u ON wc.sender = u.employee_id WHERE wc.inc_id = ? AND wc.type NOT IN ('system', 'ai_analysis') ORDER BY wc.timestamp ASC").bind(cleanId).all()
      
      // (incDetail and wfLogs already fetched above in parallel)
      const wfLogs_data = wfLogs;

      const toKST = (dt) => {
        if (!dt) return null;
        try {
          const d = new Date(dt);
          return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
        } catch { return null; }
      };

      const timelineCtx = [];
      if (incDetail?.reg_dt || incDetail?.created_at) {
        const t = toKST(incDetail.reg_dt || incDetail.created_at);
        if (t) timelineCtx.push(`[${t}] SMS 수신 및 장애 인지`);
      }
      for (const wf of wfLogs_data) {
        const t = toKST(wf.completed_at);
        const label = wf.step_id === 'RAG' || wf.step_id === 'AGENT' ? 'AI 분석 완료'
          : wf.step_id === 'WARROOM' ? '워룸 생성 및 담당자 배정'
          : wf.step_id === 'KNOWLEDGE' ? '지식화 및 장애 처리 완료'
          : wf.step_id;
        if (t) timelineCtx.push(`[${t}] ${label}`);
      }

      const transcript = []
      const combined = [
        ...(wrResults || []).map(r => ({ role: r.role || 'User', sender: r.sender_name || r.sender, text: r.text, timestamp: r.timestamp }))
      ]
      
      combined.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

      for (const msg of combined) {
        if (msg.text) {
          const ts = toKST(msg.timestamp);
          transcript.push(`[${ts || '--:--:--'}] [${msg.role}] ${msg.sender}: ${msg.text}`);
        }
      }

      // Dify에 전달할 최종 컨텍스트: 인시던트 타임라인 + 채팅 로그
      const chatLogForDify = [
        timelineCtx.length > 0 ? `=== 인시던트 이벤트 타임라인 ===
${timelineCtx.join('\n')}
` : '',
        `=== 워룸 채팅 내역 ===`,
        ...transcript
      ].filter(Boolean).join('\n');

      await writer.write(encode(`data: ${JSON.stringify({ status: 'Dify AI 분석 엔진을 구동하고 있습니다...' })}\n\n`));

      // 🚀 Heartbeat: Dify 응답 대기 중 5초마다 keep-alive ping → 프론트 타임아웃 방지
      let heartbeatStopped = false;
      const heartbeatId = setInterval(async () => {
        if (heartbeatStopped) return;
        try {
          await writer.write(encode(`data: ${JSON.stringify({ status: '⏳ AI 분석 처리 중...' })}\n\n`));
        } catch {}
      }, 5000);

      // 🚀 Add AbortController for timeout protection
      const totalTimeoutController = new AbortController();
      const totalTimeoutId = setTimeout(() => {
        totalTimeoutController.abort();
      }, 90000); // 90 seconds hard limit (Dify workflow can be slow)

      let difyRes = null;
      const primaryKey = api_key;
      const fallbackKey = c.env.DIFY_API_KEY_DASHBOARD;

      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const currentKey = (attempt === 2 && fallbackKey) ? fallbackKey : primaryKey;
          
          difyRes = await fetch(`${api_base}/workflows/run`, {
            method: 'POST',
            headers: { 
              'Authorization': `Bearer ${currentKey}`, 
              'Content-Type': 'application/json',
              'Accept': 'text/event-stream'
            },
            signal: totalTimeoutController.signal,
            body: JSON.stringify({ 
              inputs: { chat_log: chatLogForDify, incident_images: [] }, 
              response_mode: 'streaming', 
              user: 'sguard-worker' 
            })
          });

          if (difyRes.ok) break;

          if (attempt < 2 && (difyRes.status >= 500 || difyRes.status === 429)) {
            const delay = difyRes.status === 429 ? 3000 : 2000;
            console.warn(`[AI Summarize] Dify transient error (${difyRes.status}), switching to fallback key...`);
            await new Promise(r => setTimeout(r, delay));
          }
        } catch (e) {
          if (attempt === 2) throw e;
          console.warn(`[AI Summarize] Fetch failed, retrying...`, e);
          await new Promise(r => setTimeout(r, 2000));
        }
      }

      clearTimeout(totalTimeoutId);
      heartbeatStopped = true;
      clearInterval(heartbeatId);

      if (!difyRes || !difyRes.ok) {
        throw new Error(`Dify API error: ${difyRes?.status || 'Unknown'}`);
      }

      
      const reader = difyRes.body.getReader()
      const decoder = new TextDecoder()
      let lineBuffer = ""
      let fullContent = ""
      let firstChunk = true;
      
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
            
            // 🚀 Support Both Chat Apps and Workflow Apps
            if (data.event === 'message' || data.event === 'agent_message') {
              // Standard Chat App events
              if (firstChunk) {
                await writer.write(encode(`data: ${JSON.stringify({ status: 'AI 심층 분석 결과 수신 중...' })}\n\n`));
                firstChunk = false;
              }
              fullContent += (data.answer || "");
              await writer.write(encode(`data: ${JSON.stringify({ answer: data.answer })}\n\n`))
            } else if (data.event === 'text_chunk') {
              // Streaming LLM node in Workflow
              if (firstChunk) {
                await writer.write(encode(`data: ${JSON.stringify({ status: 'AI 분석 결과 수신 중...' })}\n\n`));
                firstChunk = false;
              }
              const chunk = data.data?.text || "";
              fullContent += chunk;
              await writer.write(encode(`data: ${JSON.stringify({ answer: chunk })}\n\n`))
            } else if (data.event === 'workflow_finished') {
              // Final Workflow Output or Node Output
              const outputs = data.data?.outputs;
              if (outputs) {
                // Try to find the primary text output (result, text, output, etc.)
                const workflowResult = outputs.text || outputs.result || outputs.output || 
                                     (Object.values(outputs).find(v => typeof v === 'string') || "");
                
                // If we haven't received anything through text_chunks, or if this is the final summary
                if (workflowResult && (!fullContent || !fullContent.includes(workflowResult.substring(0, 10)))) {
                  if (firstChunk) {
                    await writer.write(encode(`data: ${JSON.stringify({ status: 'AI 분석 데이터 정리 중...' })}\n\n`));
                    firstChunk = false;
                  }
                  fullContent += workflowResult;
                  await writer.write(encode(`data: ${JSON.stringify({ answer: workflowResult })}\n\n`))
                }
              }
            }
          } catch (e) { continue }
        }
      }
      
      // Auto-save summary to DB (only if it's a valid summary, not a raw transcript leak)
      if (fullContent && !isRaw(fullContent)) {
        const nowKst = getKst()
        await db.prepare(`
          INSERT INTO chat_summaries (inc_id, summary, model, mod_dt) 
          VALUES (?, ?, 'dify-workflow', ?)
          ON CONFLICT(inc_id) DO UPDATE SET summary = excluded.summary, mod_dt = ?
        `).bind(cleanId, fullContent, nowKst, nowKst).run();
      }

      if (kv) await kv.delete(lockKey);
      await writer.write(encode('data: [DONE]\n\n'))
    } catch (e) {
      console.error('Summarize-Chat error:', e)
      const errorMsg = e.name === 'AbortError' 
        ? '⚠️ 분석 품질 향상을 위해 대기 시간이 초과되었습니다. 현재 대화 내역이 충분하지 않거나 기술적인 이유로 요약이 지연되었습니다. 잠시 후 다시 시도해 주세요.'
        : `⚠️ 분석 중 예기치 않은 오류가 발생했습니다: ${e.message}`;
        
      await writer.write(encode(`data: ${JSON.stringify({ error: errorMsg, status: '분석 중단됨' })}\n\n`))
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
  
  // 1. Try aichat_history (Agent Chat) first
  const { results: aiResults } = await db.prepare("SELECT * FROM aichat_history WHERE inc_id = ? ORDER BY id ASC").bind(id).all()
  if (aiResults && aiResults.length > 0) {
    return c.json({ messages: aiResults.map(r => ({ role: r.agent_role, text: r.content })) })
  }
  
  // 2. Fallback to autopilot_insight (Initial Analysis or Error Message)
  const insight = await db.prepare("SELECT content, severity FROM autopilot_insight WHERE inc_id = ?").bind(id).first()
  if (insight) {
    return c.json({ 
      messages: [{ 
        role: 'AI분석', 
        text: insight.content,
        severity: insight.severity
      }] 
    })
  }

  return c.json({ messages: [] })
})

app.post('/ai/chat-history/save', async (c) => {
  const { incident_id, messages } = await c.req.json()
  console.log(`Saving chat history for incident: ${incident_id}, count: ${messages?.length}`);
  const db = c.env.DB
  const now = getKst()
  
  // 🚀 Deduplication: Clear existing generated chat history for this incident before saving
  await db.prepare(`DELETE FROM aichat_history WHERE inc_id = ?`).bind(incident_id).run();

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
// War-Room Concurrency Locking (KV based)
app.get('/ai/warroom/lock/:inc_id', async (c) => {
  const inc_id = c.req.param('inc_id');
  const kv = c.env.SMS_STORAGE;
  if (!kv) return c.json({ locked: false });
  
  const owner = await kv.get(`lock:warroom:${inc_id}`);
  return c.json({ locked: !!owner, owner });
});

app.post('/ai/warroom/lock/:inc_id', async (c) => {
  const inc_id = c.req.param('inc_id');
  const { user_name } = await c.req.json();
  const kv = c.env.SMS_STORAGE;
  if (!kv) return c.json({ success: true }); // Fail-safe
  
  const existing = await kv.get(`lock:warroom:${inc_id}`);
  if (existing && existing !== user_name) {
    return c.json({ success: false, owner: existing });
  }
  
  // Set lock with 60s TTL
  await kv.put(`lock:warroom:${inc_id}`, user_name, { expirationTtl: 60 });
  return c.json({ success: true });
});

app.delete('/ai/warroom/lock/:inc_id', async (c) => {
  const inc_id = c.req.param('inc_id');
  const kv = c.env.SMS_STORAGE;
  if (kv) await kv.delete(`lock:warroom:${inc_id}`);
  return c.json({ success: true });
});

// AI Chat Summary Concurrency Locking (KV based)
app.get('/ai/summarize/lock/:inc_id', async (c) => {
  const inc_id = String(c.req.param('inc_id')).replace(/^INC-/i, '');
  const kv = c.env.SMS_STORAGE;
  if (!kv) return c.json({ locked: false });
  const owner = await kv.get(`lock:summary:${inc_id}`);
  return c.json({ locked: !!owner, owner });
});

app.post('/ai/summarize/lock/:inc_id', async (c) => {
  const inc_id = String(c.req.param('inc_id')).replace(/^INC-/i, '');
  const { user_name } = await c.req.json();
  const kv = c.env.SMS_STORAGE;
  if (!kv) return c.json({ success: true });
  const existing = await kv.get(`lock:summary:${inc_id}`);
  if (existing && existing !== user_name) {
    return c.json({ success: false, owner: existing });
  }
  // Summary takes longer (up to 2-3 mins), so 180s TTL
  await kv.put(`lock:summary:${inc_id}`, user_name, { expirationTtl: 180 });
  return c.json({ success: true });
});

app.delete('/ai/summarize/lock/:inc_id', async (c) => {
  const inc_id = String(c.req.param('inc_id')).replace(/^INC-/i, '');
  const kv = c.env.SMS_STORAGE;
  if (kv) await kv.delete(`lock:summary:${inc_id}`);
  return c.json({ success: true });
});

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
    const cleanedQuery = cleanMessageForEmbedding(query);
    const queryVector = await generateEmbedding(cleanedQuery, c.env);
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
  const body = await c.req.json()
  const inc_id = body.inc_id || body.id
  const { title, creator_id, severity, leader_summary } = body
  const db = c.env.DB
  const now = getKst()
  
  const normId = String(inc_id);
  // 🛡️ Add 'INC-' to title as requested
  const safeTitle = String(title || normId);
  const cleanTitle = safeTitle.startsWith('INC-') ? safeTitle : `INC-${safeTitle}`;

  // Prevent duplicate creation
  const existing = await db.prepare("SELECT inc_id FROM warroom_list WHERE inc_id = ?").bind(normId).first()
  if (!existing) {
    await db.prepare(`
      INSERT INTO warroom_list (inc_id, title, creator_id, severity, leader_summary, reg_dt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(normId, cleanTitle, creator_id, severity, leader_summary || '', now)
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
      ON CONFLICT(user_id, inc_id) DO NOTHING
    `).bind(normId, now, normId).run();
  } catch (e) {
    console.error("Bulk join error:", e);
  }

  if (creator_id) {
    await db.prepare("INSERT INTO user_warrooms (user_id, inc_id, joined_at) VALUES (?, ?, ?) ON CONFLICT(user_id, inc_id) DO NOTHING")
      .bind(creator_id, normId, now).run()
  }
      
  // 🚀 NEW: Ensure incidents table has a record and set status to 'INC_002' (처리중)
  await db.prepare(`
    INSERT OR IGNORE INTO incidents (inc_id, title, status, severity, incident_type, reg_id, reg_dt, mod_id, mod_dt, created_at, updated_at)
    VALUES (?, ?, 'INC_002', ?, 'AI', ?, ?, ?, ?, ?, ?)
  `).bind(normId, cleanTitle, severity || 'NORMAL', creator_id || 'SYSTEM', now, creator_id || 'SYSTEM', now, now, now).run()

  await db.prepare("UPDATE incidents SET status = 'INC_002', updated_at = ?, mod_dt = ?, mod_id = ? WHERE inc_id = ?")
    .bind(now, now, creator_id || 'SYSTEM', normId).run()

  // 🚀 NEW: Ensure creator is in incident_assignments with status 'INC_002'
  await db.prepare(`
    INSERT INTO incident_assignments (user_id, inc_id, status, assigned_at, updated_at, reg_id, reg_dt, mod_id, mod_dt)
    VALUES (?, ?, 'INC_002', ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, inc_id) 
    DO UPDATE SET status = 'INC_002', updated_at = ?, mod_dt = ?, mod_id = ?
  `).bind(
    creator_id, normId, now, now, creator_id || 'SYSTEM', now, creator_id || 'SYSTEM', now,
    now, now, creator_id || 'SYSTEM'
  ).run();

  // Update assignment status to 'INC_002' for all assignees of this incident
  await db.prepare("UPDATE incident_assignments SET status = 'INC_002', updated_at = ?, mod_dt = ?, mod_id = ? WHERE inc_id = ?")
    .bind(now, now, creator_id || 'SYSTEM', normId).run()

  // Release Lock if exists (KV cleanup)
  const kv = c.env.SMS_STORAGE;
  if (kv) {
    try {
      await kv.delete(`lock:warroom:${normId}`);
    } catch (e) {
      console.error("Lock release error:", e);
    }
  }

  // ✅ NEW: 워룸 개설 시 할당된 멤버 전원에게 첫 푸시 알림 발송 (개설자 제외)
  c.executionCtx.waitUntil((async () => {
    try {
      const { results: assignees } = await db.prepare(
        "SELECT DISTINCT user_id FROM incident_assignments WHERE inc_id = ?"
      ).bind(normId).all();

      const absentUserIds = assignees
        .map(a => a.user_id)
        .filter(uid => uid !== creator_id);

      const chatUrl = `/chat/${normId}`;
      const pushPayload = {
        title: `[${normId}] WarRoom 개설`,
        body: `${title || '장애'}에 대한 워룸이 개설되었습니다. 참여해 주세요.`,
        url: chatUrl,
        inc_id: String(normId),
        tag: `warroom-open-${normId}`,
        priority: 80
      };

      for (const uid of absentUserIds) {
        await sendPushNotification({ env: c.env }, uid, pushPayload).catch(e =>
          console.error(`[WR-Open Push] Failed for ${uid}:`, e.message)
        );
      }
    } catch (e) {
      console.error('[WR-Open Push] Error:', e.message);
    }
  })());

  // 🚀 [Activity Log] 워룸 개설
  try {
    if (creator_id) {
      await db.prepare(`
        INSERT INTO activity_logs (inc_id, incident_code, user_id, action, detail, created_at)
        VALUES (?, ?, ?, '워룸 개설', ?, ?)
      `).bind(normId, normId, creator_id, `WAR-ROOM이 개설되었습니다: ${cleanTitle}`, now).run();
    }
  } catch(e) { console.error('[ActivityLog-WROpen]', e.message); }

  return c.json({ status: 'opened', inc_id: normId })
})

app.post('/ai/report/save', async (c) => {
  const { inc_id, title, content, user_id } = await c.req.json()
  const db = c.env.DB
  const ai = c.env.AI
  const vectorIndex = c.env.WARROOM_INDEX
  const now = getKst()
  
  const normId = String(inc_id);
  const empId = user_id || 'SYSTEM'
  
  // 1. Log activity
  await db.prepare("INSERT INTO activity_logs (inc_id, incident_code, user_id, action, detail, created_at) VALUES (?, ?, ?, '보고서 생성', ?, ?)")
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
      const res = await ai.run('@cf/baai/bge-base-en-v1.5', { text: [sanitizedContent.substring(0, 3000)] });
      if (res && res.data && res.data[0]) {
        vector = res.data[0];
        embeddingValue = new Float32Array(vector);
      }
    } catch (e) {
      console.error("Embedding generation failed in report save:", e.message);
    }
  }

  // UPSERT Knowledge: Ensure exactly 1 row per inc_id
  let status = 'PENDING';
  let errorMsg = null;

  if (vector && vectorIndex) {
    try {
      await vectorIndex.upsert([{
        id: `kn-${normId}`, // 🚀 Changed from 'inc-' to 'kn-' to prevent overwriting raw SMS and count correctly
        values: vector,
        metadata: { title: safeTitle, type: 'knowledge', inc_id: normId }
      }]);
      status = 'SUCCESS';
    } catch (e) {
      console.error("Vectorize sync failed in report save:", e.message);
      status = 'FAIL';
      errorMsg = `Vectorize Error: ${e.message}`;
    }
  } else if (!vector) {
    status = 'FAIL';
    errorMsg = 'Embedding generation failed';
  }

  await db.prepare(`
    INSERT INTO knowledge_base (inc_id, title, content, category, reg_id, reg_dt, mod_id, mod_dt, vector, status, error_log)
    VALUES (?, ?, ?, '장애 보고서', ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(inc_id) DO UPDATE SET
      title = excluded.title,
      content = excluded.content,
      mod_id = excluded.mod_id,
      mod_dt = excluded.mod_dt,
      vector = excluded.vector,
      status = excluded.status,
      error_log = excluded.error_log
  `).bind(
    normId, 
    safeTitle, 
    content, 
    empId, now, empId, now, 
    embeddingValue,
    status,
    errorMsg
  ).run()

  // 4. 보고서 저장 완료 → 해당 incident 모든 담당자 일괄 처리완료 + SMS 상태 동기화
  if (normId) {
    await db.prepare("UPDATE incident_assignments SET status = 'INC_003', updated_at = ?, mod_dt = ?, mod_id = ? WHERE inc_id = ?")
      .bind(now, now, empId, normId).run()
    await db.prepare("UPDATE received_messages SET status = 'INC_003', mod_dt = ?, mod_id = ? WHERE inc_id = ?")
      .bind(now, empId, normId).run()
  }

  return c.json({ status: 'saved', knowledge_synced: !!embeddingValue })
})

// ==========================================
// Aggregated Report Data for a given inc_id
// ==========================================
app.get('/warroom/report/:id', async (c) => {
  const idParam = c.req.param('id')
  const db = c.env.DB

  // ID Normalization
  const rawId = idParam;
  

  // 1. War-Room base info — inc_id 가 어떤 형태로 저장됐든 매칭
  const wr = await db.prepare(
    "SELECT * FROM warroom_list WHERE inc_id = ?"
  ).bind(rawId).first()
  if (!wr) return c.json({ error: 'War-Room not found' }, 404)

  // 2. S-Autopilot Insight (full AI analysis)
  const insight = await db.prepare(
    "SELECT content, severity, category FROM autopilot_insight WHERE inc_id = ?"
  ).bind(rawId).first()

  // 3. AI Agent Discussion log (aichat_history)
  const { results: agentLogs } = await db.prepare(
    "SELECT agent_role, content, reg_dt FROM aichat_history WHERE inc_id = ? ORDER BY id ASC"
  ).bind(rawId).all()

  // 4. War-Room chat history
  const { results: chatLogs } = await db.prepare(
    "SELECT wc.*, u.name as sender_name FROM warroom_chats wc LEFT JOIN users u ON wc.sender = u.employee_id WHERE wc.inc_id = ? ORDER BY wc.timestamp ASC"
  ).bind(rawId).all()

  // 5. Attachments
  const { results: attachments } = await db.prepare(
    "SELECT original_name, file_type, url, uploaded_by, timestamp FROM warroom_attachments WHERE inc_id = ? ORDER BY seq ASC"
  ).bind(rawId).all()

  // 5-1. Creator name from users table
  let creatorName = null
  let creatorOrg = null
  if (wr.creator_id) {
    const creatorRow = await db.prepare(
      "SELECT name, company, honbu, team, position FROM users WHERE employee_id = ? LIMIT 1"
    ).bind(wr.creator_id).first()
    if (creatorRow) {
      creatorName = creatorRow.name
      // 조직 정보: honbu > team 순서로 의미있는 값 사용
      const orgParts = [creatorRow.honbu, creatorRow.team].filter(Boolean)
      creatorOrg = orgParts.length > 0 ? orgParts.join(' / ') : (creatorRow.company || null)
    }
  }

  // 6. Find leader summary (from warroom_list first, fallback to aichat_history)
  const leaderRow = (agentLogs || []).find(r => r.agent_role === 'Leader')
  const leaderSummary = (wr.leader_summary && wr.leader_summary.trim()) 
    ? wr.leader_summary 
    : (leaderRow ? leaderRow.content : '')

  // 7. Derive 6W1H fields from available data
  const insightText = insight ? insight.content : ''
  const agentText = (agentLogs || []).map(r => `[${r.agent_role}]\n${r.content}`).join('\n\n')
  const combinedAnalysis = (leaderSummary || insightText || agentText || '').slice(0, 4000)

  // 8. SMS 수신 시각 & 처리완료 시각 → 정확한 MTTR 계산
  const smsRow = await db.prepare(
    "SELECT timestamp FROM received_messages WHERE inc_id = ? LIMIT 1"
  ).bind(rawId).first()
  const doneRow = await db.prepare(
    "SELECT MAX(updated_at) as done_at FROM incident_assignments WHERE inc_id = ? AND status = 'INC_003'"
  ).bind(rawId).first()

  // MTTR: SMS 수신 → 처리완료, fallback: firstChat → lastChat
  const firstChat = (chatLogs || [])[0]
  const lastChat  = (chatLogs || []).slice(-1)[0]
  let durationMin = null
  
  try {
    const parseDate = (d) => d ? new Date(String(d).replace(' ', 'T')) : null;
    const smsTime = parseDate(smsRow?.timestamp);
    const doneTime = parseDate(doneRow?.done_at);
    
    if (smsTime && doneTime && !isNaN(smsTime) && !isNaN(doneTime)) {
      const ms = doneTime - smsTime;
      if (ms > 0) durationMin = Math.round(ms / 60000);
    } else if (firstChat && lastChat) {
      const fTime = parseDate(firstChat.timestamp);
      const lTime = parseDate(lastChat.timestamp);
      if (fTime && lTime && !isNaN(fTime) && !isNaN(lTime)) {
        const ms = lTime - fTime;
        if (ms > 0) durationMin = Math.round(ms / 60000);
      }
    }
  } catch (e) {
    console.warn('[MTTR Calc Error]', e.message);
  }

  // 9. chat_logs sender → 이름 매핑
  const senderIds = [...new Set((chatLogs || [])
    .map(c => c.sender)
    .filter(s => s && s !== 'SYSTEM')
  )]
  let userNameMap = {}
  if (senderIds.length > 0) {
    const placeholders = senderIds.map(() => '?').join(',')
    const { results: userRows } = await db.prepare(
      `SELECT employee_id, name FROM users WHERE employee_id IN (${placeholders})`
    ).bind(...senderIds).all()
    ;(userRows || []).forEach(u => { userNameMap[u.employee_id] = u.name })
  }
  const enrichedChatLogs = (chatLogs || []).map(c => ({
    ...c,
    sender_display: c.sender === 'SYSTEM' ? 'SYSTEM'
      : userNameMap[c.sender]
        ? `${c.sender} (${userNameMap[c.sender]})`
        : c.sender
  }))

  return c.json({
    inc_id: rawId,
    title: wr.title || rawId,
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
    who_name: creatorName || null,
    who_org: creatorOrg || null,
    when: wr.reg_dt || '-',
    where: (wr.title || '').split('|').slice(-1)[0]?.trim() || '-',
    what: wr.title || '-',
    why: insightText ? insightText.slice(0, 300) : '-',
    how: leaderSummary ? leaderSummary.slice(0, 500) : '-',

    // Related records
    agent_logs: agentLogs || [],
    chat_logs: enrichedChatLogs,
    attachments: attachments || [],

    // Stats
    message_count: (chatLogs || []).length,
    attachment_count: (attachments || []).length,
    duration_min: durationMin,
    duration_label: durationMin === null ? '-'
      : durationMin < 1    ? '1분 미만'
      : durationMin < 60   ? `${durationMin}분`
      : `${Math.floor(durationMin / 60)}시간 ${durationMin % 60}분`,
  })
})

app.get('/warroom/participants/:id', async (c) => {
  const id = c.req.param('id')
  const db = c.env.DB
  const normId = String(id)
  const { results } = await db.prepare(`
    SELECT 
      u.name, u.employee_id, u.role, u.company, u.position, u.phone,
      COALESCE(ot.name, u.team) as team_name,
      COALESCE(op.name, u.part) as part_name
    FROM user_warrooms uw
    JOIN users u ON uw.user_id = u.employee_id
    LEFT JOIN organizations ot ON u.team = ot.code AND ot.depth = 3
    LEFT JOIN organizations op ON u.part = op.code AND op.depth = 4
    WHERE uw.inc_id = ?
  `).bind(normId).all()
  return c.json({ participants: results || [] })
})

app.post('/warroom/join', async (c) => {
  const { incident_id, user_id, name, inviter_name } = await c.req.json()
  const db = c.env.DB
  const normId = String(incident_id)
  
  if (!user_id || !incident_id) {
    return c.json({ status: 'error', message: 'user_id and incident_id are required' }, 400)
  }

  const now = getKst()

  // 1️⃣ 워룸 참여 등록
  const joinRes = await db.prepare("INSERT INTO user_warrooms (user_id, inc_id, joined_at) VALUES (?, ?, ?) ON CONFLICT(user_id, inc_id) DO NOTHING")
    .bind(user_id, normId, now).run()

  // 2️⃣ incident_assignments 동기화
  await db.prepare(`
    INSERT INTO incident_assignments (user_id, inc_id, status, assigned_at, updated_at, reg_id, reg_dt, mod_id, mod_dt)
    VALUES (?, ?, 'INC_002', ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, inc_id) 
    DO UPDATE SET status = 'INC_002', updated_at = excluded.updated_at, mod_dt = excluded.mod_dt, mod_id = excluded.mod_id
  `).bind(user_id, normId, now, now, user_id, now, user_id, now).run();

  // 3️⃣ 채팅에 시스템 메시지 저장
  const displayName = name || user_id;
  const inviterLabel = inviter_name ? `(${inviter_name}님 초대)` : '';
  const sysText = `🔔 <b>${displayName}</b>님이 워룸에 참여했습니다 ${inviterLabel}`;
  try {
    const maxSeq = await db.prepare("SELECT COALESCE(MAX(seq),0)+1 AS ns FROM warroom_chats WHERE inc_id=?").bind(normId).first();
    await db.prepare(
      "INSERT INTO warroom_chats (inc_id, sender, name, role, type, text, timestamp, seq) VALUES (?,?,?,?,?,?,?,?)"
    ).bind(normId, 'SYSTEM', 'SYSTEM', 'system', 'system', sysText, now, maxSeq?.ns || 1).run();
  } catch(e) { console.error('[warroom/join] system msg failed:', e.message); }

  // 4️⃣ 초대된 사용자에게 푸시 알림
  try {
    const inc = await db.prepare("SELECT title FROM incident_queue WHERE id=?").bind(normId).first();
    const incTitle = inc?.title || `장애 #${normId}`;
    await sendPushNotification(c, user_id, {
      title: `🚨 워룸 초대 알림`,
      body: `${inviter_name || '관리자'}님이 "${incTitle}" 워룸에 초대했습니다.`,
      data: { type: 'warroom_invite', incident_id: normId, url: `/chat/${normId}` }
    });
  } catch(e) { console.error('[warroom/join] push failed:', e.message); }

  // 5️⃣ [Activity Log] 워룸 참여
  try {
    if (joinRes.meta.changes > 0) {
      const inviterNote = inviter_name ? ` (${inviter_name}님 초대)` : '';
      await db.prepare(`
        INSERT INTO activity_logs (inc_id, incident_code, user_id, action, detail, created_at)
        VALUES (?, ?, ?, '워룸 참여', ?, ?)
      `).bind(normId, normId, user_id || 'SYSTEM', `워룸에 참여했습니다${inviterNote}.`, now).run();
    }
  } catch(e) { console.error('[ActivityLog-Join]', e.message); }
    
  return c.json({ status: 'joined', name: displayName })
})


// RAG Zero-G System Config Endpoints
// RAG Zero-G System Config Endpoints (Unified with D1 & KV)
app.get('/api/v1/system/threshold', async (c) => {
  const db = c.env.DB;
  try {
    const res = await db.prepare("SELECT config_value FROM system_config WHERE config_key = ?").bind('similarity_threshold_technical').first();
    return c.json({ threshold: res ? parseFloat(res.config_value) : 0.85 });
  } catch (e) {
    // Fallback to KV if D1 fails
    const kv = c.env.SMS_STORAGE;
    if (!kv) return c.json({ threshold: 0.85 });
    const val = await kv.get('config:rag_threshold');
    return c.json({ threshold: val ? parseFloat(val) : 0.85 });
  }
});

app.post('/api/v1/system/threshold', async (c) => {
  const { threshold } = await c.req.json();
  const db = c.env.DB;
  const kv = c.env.SMS_STORAGE;
  
  try {
    // 🚀 Primary: Save to D1 for AI Engine
    await db.prepare("INSERT OR REPLACE INTO system_config (config_key, config_value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)")
             .bind('similarity_threshold_technical', String(threshold)).run();
             
    // 🛡️ Secondary: Save to KV for Legacy UI Compatibility
    if (kv && threshold) {
      await kv.put('config:rag_threshold', threshold.toString());
    }
    return c.json({ success: true, threshold });
  } catch (e) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// Status Endpoint for Orbital Command UI
app.get('/ai/knowledge/sync-status', async (c) => {
  const db = c.env.DB;
  const vectorIndex = c.env.WARROOM_INDEX;

  try {
    // 🚀 Self-healing: Check PENDING items against Vectorize
    const pendingItems = await db.prepare("SELECT id, inc_id FROM knowledge_base WHERE status = 'PENDING' LIMIT 10").all();
    if (pendingItems.results && pendingItems.results.length > 0 && vectorIndex) {
      for (const item of pendingItems.results) {
        try {
          const checkRes = await vectorIndex.get([`kn-${item.id}`, `kn-${item.inc_id}`, `inc-${item.inc_id}`]);
          if (checkRes && checkRes.length > 0) {
            await db.prepare("UPDATE knowledge_base SET status = 'SUCCESS' WHERE id = ?").bind(item.id).run();
          }
        } catch (e) {}
      }
    }

    const totalRes = await db.prepare("SELECT COUNT(*) as count FROM knowledge_base").first('count');
    const successRes = await db.prepare("SELECT COUNT(*) as count FROM knowledge_base WHERE status = 'SUCCESS'").first('count');
    const pendingRes = await db.prepare("SELECT COUNT(*) as count FROM knowledge_base WHERE status IN ('PENDING', 'FAIL')").first('count');
    
    return c.json({
      total: totalRes || 0,
      success: successRes || 0,
      pending: pendingRes || 0
    });
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});
app.post('/ai/knowledge/sync-pending', async (c) => {
  const db = c.env.DB;
  const ai = c.env.AI;
  const vectorIndex = c.env.WARROOM_INDEX;

  if (!vectorIndex || !ai) return c.json({ error: "Required bindings missing" }, 500);

  try {
    const { results } = await db.prepare("SELECT id, title, content, inc_id, category FROM knowledge_base WHERE status = 'PENDING' OR status = 'FAIL' LIMIT 50").all();
    
    let successCount = 0;
    let failCount = 0;

    for (const row of results) {
      try {
        const embeddings = await ai.run('@cf/baai/bge-base-en-v1.5', { text: [row.content.substring(0, 3000)] });
        const vector = embeddings.data[0];
        
        if (vector) {
          await db.prepare("UPDATE knowledge_base SET vector = ?, status = 'SYNCING' WHERE id = ?")
            .bind(new Float32Array(vector), row.id).run();

          await vectorIndex.upsert([{
            id: `kn-${row.id}`,
            values: vector,
            metadata: {
              title: row.title,
              incident_id: row.inc_id || '',
              category: row.category || 'general'
            }
          }]);
          
          await db.prepare("UPDATE knowledge_base SET status = 'SUCCESS', error_log = NULL WHERE id = ?").bind(row.id).run();
          successCount++;
        } else {
          await db.prepare("UPDATE knowledge_base SET status = 'FAIL', error_log = 'Embedding failed' WHERE id = ?").bind(row.id).run();
          failCount++;
        }
      } catch (e) {
        console.error(`Sync error for ID ${row.id}:`, e.message);
        await db.prepare("UPDATE knowledge_base SET status = 'FAIL', error_log = ? WHERE id = ?")
          .bind(e.message, row.id).run();
        failCount++;
      }
    }

    return c.json({ success: true, processed: results.length, successCount, failCount });
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

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
      const embeddings = await ai.run('@cf/baai/bge-base-en-v1.5', { text: [query] });
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

// High-Precision RAG Search using Cloudflare Vectorize (Zero-G Retrieval)
app.get('/ai/knowledge/search', async (c) => {
  const query = c.req.query('q')
  const reqThreshold = c.req.query('threshold')
  if (!query) return c.json({ results: [] })
  
  const db = c.env.DB
  const ai = c.env.AI
  const vectorIndex = c.env.WARROOM_INDEX
  const kv = c.env.SMS_STORAGE;

  if (!vectorIndex || !ai) return c.json({ error: "Required AI/Vector bindings missing" }, 500);

  // 1. Determine Threshold
  let threshold = 0.80; // Default High-Precision
  if (reqThreshold && !isNaN(parseFloat(reqThreshold))) {
    threshold = parseFloat(reqThreshold);
  } else if (kv) {
    const kvThresh = await kv.get('config:rag_threshold');
    if (kvThresh) threshold = parseFloat(kvThresh);
  }

  try {
    // 2. Generate Embedding (768-dim)
    const cleanedQuery = cleanMessageForEmbedding(query);
    const embeddings = await ai.run('@cf/baai/bge-base-en-v1.5', { text: [cleanedQuery] });
    const vector = embeddings?.data?.[0];
    
    if (!vector) throw new Error("Failed to generate embedding");

    // 3. Vectorize Query
    const simResults = await vectorIndex.query(vector, { topK: 5, returnMetadata: true });
    
    // 4. Threshold Filtering
    const filteredMatches = (simResults.matches || []).filter(m => m.score >= threshold);
    if (filteredMatches.length === 0) {
       return c.json({ results: [], threshold, message: "No matches found above threshold." });
    }

    // 5. Context Fetch from D1 (1:1 Mapping)
    const ids = filteredMatches.map(m => {
       if (m.id.startsWith('kn-')) return m.id.replace('kn-', '');
       if (m.id.startsWith('inc-')) return m.id.replace('inc-', '');
       if (m.id.startsWith('gov-')) return m.id.replace('gov-', '');
       return m.id;
    }).filter(Boolean);

    let dbRecords = [];
    if (ids.length > 0) {
      const placeholders = ids.map(() => '?').join(',');
      const { results } = await db.prepare(`
        SELECT id, inc_id, title, content, 'KB' as source
        FROM knowledge_base 
        WHERE id IN (${placeholders}) OR inc_id IN (${placeholders})
      `).bind(...ids, ...ids).all();
      dbRecords = results || [];
    }

    // Secondary lookup for raw SMS if not in KB
    const missingIds = ids.filter(id => !dbRecords.some(r => String(r.id) === id || String(r.inc_id) === id));
    if (missingIds.length > 0) {
      const placeholders = missingIds.map(() => '?').join(',');
      const { results: smsRecords } = await db.prepare(`
        SELECT inc_id as id, inc_id, '[과거 이력] ' || SUBSTR(message, 1, 35) || '...' as title, message as content, 'SMS' as source
        FROM received_messages 
        WHERE inc_id IN (${placeholders})
      `).bind(...missingIds).all();
      if (smsRecords) dbRecords = [...dbRecords, ...smsRecords];
    }

    // Map scores and reasons back to DB records
    const scoredResults = filteredMatches.map(m => {
      let matchId = m.id.startsWith('kn-') ? m.id.replace('kn-', '') : m.id.replace('inc-', '');
      let dbRec = dbRecords.find(r => String(r.id) === matchId || String(r.inc_id) === matchId);
      
      return dbRec ? {
        ...dbRec,
        score: m.score,
        reason: ""
      } : null;
    }).filter(Boolean);

    // AI Reasoning for Top 1 Result (Optional Speedup, limit to top 1)
    if (scoredResults.length > 0) {
       try {
         const top1 = scoredResults[0];
         const reasoningPrompt = `당신은 지능형 관제 시스템입니다. 주어진 쿼리와 이 과거 항목이 왜 연관성이 높은지 1개의 문장으로 설명하세요.\n\n[쿼리]: ${query}\n[항목]: ${top1.title}\n[내용]: ${top1.content?.substring(0, 100)}`;
         const aiResponse = await ai.run('@cf/meta/llama-3-8b-instruct', { prompt: reasoningPrompt });
         top1.reason = (aiResponse.response || aiResponse).replace(/\n/g, ' ').trim();
       } catch (err) {
         console.warn("Reason generation failed:", err.message);
       }
    }

    return c.json({ results: scoredResults, threshold });

  } catch (e) {
    console.error('Vector search failed:', e);
    return c.json({ error: e.message }, 500);
  }
})

app.get('/ai/knowledge/:id', async (c) => {
  const id = c.req.param('id')
  const db = c.env.DB
  const result = await db.prepare("SELECT * FROM knowledge_base WHERE id = ?").bind(id).first()
  if (!result) return c.json({ error: "Not found" }, 404)
  return c.json(result)
})

app.post('/ai/knowledge/save', async (c) => {
  try {
    const body = await c.req.json()
  const db = c.env.DB
  const ai = c.env.AI
  const vectorIndex = c.env.WARROOM_INDEX
  const now = getKst()
  const user_id = body.user_id || 'SYSTEM'
  
  // Guard clause against Dify Workflow default template injection (unmapped variables)
  if ((body.title && body.title.includes('{{sys.')) || (body.content && body.content.includes('{{LLM.'))) {
    console.log('[KnowledgeBase] Rejected malformed Dify bot update:', body.title);
    return c.json({ error: 'Malformed workflow update ignored' }, 400)
  }
  
  // Generate embedding if content is provided
  let vector = null;
  if (body.content) {
    try {
      const embeddings = await ai.run('@cf/baai/bge-base-en-v1.5', { text: [body.content.substring(0, 3000)] });
      vector = embeddings.data[0];
    } catch (e) {
      console.error("Embedding error:", e);
    }
  }
  
  const embeddingValue = vector ? new Float32Array(vector) : null;

  let status = vector ? 'PENDING' : 'FAIL';
  let errorMsg = vector ? null : 'Embedding generation failed';
  let knowledgeId = body.id;

  if (body.id) {
    // Update
    await db.prepare(`
      UPDATE knowledge_base 
      SET inc_id = ?, title = ?, content = ?, category = ?, file_url = ?, file_type = ?, tags = ?, mod_id = ?, mod_dt = ?, vector = ?, status = ?, error_log = ?
      WHERE id = ?
    `).bind(
      body.inc_id || null, body.title, body.content || null, body.category || null, 
      body.file_url || null, body.file_type || null, body.tags || null, 
      user_id, now, embeddingValue, status, errorMsg, body.id
    ).run()
  } else {
    // Create
    const result = await db.prepare(`
      INSERT INTO knowledge_base (inc_id, title, content, category, file_url, file_type, tags, reg_id, reg_dt, mod_id, mod_dt, vector, status, error_log)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      body.inc_id || null, body.title, body.content || null, body.category || null, 
      body.file_url || null, body.file_type || null, body.tags || null, 
      user_id, now, user_id, now, embeddingValue, status, errorMsg
    ).run()
    knowledgeId = result.meta.last_row_id;
  }

  // Sync to Vectorize Index
  if (vector && vectorIndex) {
    try {
      await vectorIndex.upsert([{
        id: `kn-${knowledgeId}`,
        values: vector,
        metadata: {
          title: body.title,
          incident_id: body.inc_id || '',
          category: body.category || 'general'
        }
      }]);
      // Update status to SUCCESS after successful vector upsert
      await db.prepare("UPDATE knowledge_base SET status = 'SUCCESS' WHERE id = ?").bind(knowledgeId).run();
    } catch (e) {
      console.error("Vectorize sync failed in knowledge save:", e.message);
      await db.prepare("UPDATE knowledge_base SET status = 'FAIL', error_log = ? WHERE id = ?")
        .bind(`Vectorize Error: ${e.message}`, knowledgeId).run();
    }
  }

  // Log activity
  if (body.inc_id) {
    try {
      const user = await db.prepare("SELECT employee_id FROM users WHERE employee_id = ?").bind(String(user_id)).first()
      const empId = user ? user.employee_id : user_id
      await db.prepare("INSERT INTO activity_logs (inc_id, incident_code, user_id, action, detail, created_at) VALUES (?, ?, ?, '지식화 완료', '장애 대응 리포트가 지식베이스에 저장되었습니다.', ?)")
      .bind(String(body.inc_id), String(body.inc_id), empId, getKst())
      .run()
    } catch(e) {}
  }

    return c.json({ status: body.id ? 'updated' : 'created', id: knowledgeId });
  } catch (err) {
    console.error("Knowledge save error:", err.message, err.stack);
    return c.json({ status: 'error', error: err.message, stack: err.stack }, 500);
  }
});

app.delete('/ai/knowledge/:id', async (c) => {
  const id = c.req.param('id');
  const db = c.env.DB;
  const vectorIndex = c.env.WARROOM_INDEX;

  const existing = await db.prepare("SELECT id FROM knowledge_base WHERE id = ?").bind(id).first();
  if (!existing) return c.json({ error: 'Not found' }, 404);

  await db.prepare("DELETE FROM knowledge_base WHERE id = ?").bind(id).run();

  // Vectorize에서도 삭제
  if (vectorIndex) {
    try {
      await vectorIndex.deleteByIds([`kn-${id}`]);
    } catch (e) {
      console.warn(`[Knowledge DELETE] Vectorize removal failed for kn-${id}:`, e.message);
    }
  }

  return c.json({ status: 'deleted', id });
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
    const embeddings = await ai.run('@cf/baai/bge-base-en-v1.5', { text: [qText] });
    
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

app.post('/retrieval', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    const envKey = c.env.DIFY_TOOL_KEY;
    
    // Robust Bearer token check (case-insensitive and handles various spacing)
    const token = authHeader ? authHeader.replace(/bearer\s+/i, '').trim() : '';
    
    // Support all variations of I/l typos in Dify Dataset Key
    const allowedTokens = [
      'dataset-IEg4X7UTG3j4IukgkZQV7WUP',
      'dataset-lEg4X7UTG3j4lukgkZQV7WUP',
      'dataset-IEg4X7UTG3j4lukgkZQV7WUP',
      'dataset-lEg4X7UTG3j4IukgkZQV7WUP'
    ];
    
    if (token !== envKey && !allowedTokens.includes(token)) {
      console.warn(`[Dify Retrieval] Unauthorized access attempt. Received Token: "${token}" (Prefix: ${token?.substring(0, 10)}...)`);
      return c.json({ 
        error: "401 Unauthorized", 
        message: "API Key가 일치하지 않습니다. Dify의 HTTP 요청 노드에서 'Authorization' 헤더에 'Bearer <DIFY_TOOL_KEY>'를 정확히 입력했는지 확인해 주세요.",
        hint: `Received: ${token ? 'Invalid Token' : 'Empty Token'}`
      }, 401);
    }

    let body = {};
    const contentType = c.req.header('Content-Type');
    if (contentType && contentType.includes('application/json')) {
      try {
        body = await c.req.json();
      } catch (e) {
        body = {};
      }
    }

    const query = body.query || "";
    const retrieval_setting = body.retrieval_setting;
    const top_k = retrieval_setting?.top_k || 5;

    // 🔍 Identify technical signals in the query
    const technicalPatterns = [/error/i, /fail/i, /critical/i, /timeout/i, /장애/i, /오류/i, /batch/i];
    const isTechnicalSignal = technicalPatterns.some(pattern => pattern.test(query));

    // 💡 최신 지능형 RAG 동적 경계(Dynamic Boundary) 알고리즘 적용
    // 고정된 가중치(상수) 없이 오직 DB에서 넘어온 파라미터 값들만으로 최종 커트라인을 계산합니다.
    let admin_base = parseFloat(retrieval_setting?.threshold) || 0.85;
    let tech_mod   = parseFloat(retrieval_setting?.technical_threshold) || 0.85;
    let casual_mod = parseFloat(retrieval_setting?.casual_threshold) || 0.95;

    let score_threshold = admin_base;

    if (isTechnicalSignal) {
      // 장애 문맥: 기준값(admin)과 기술 설정값(tech) 중 더 낮은(관대한) 값 채택
      // 이유: 긴급 상황이므로 가급적 넓은 범위의 지식베이스를 끌어와 단서를 놓치지 않기 위함
      score_threshold = Math.min(admin_base, tech_mod);
    } else {
      // 일상 대화: 기준값(admin)과 일상 설정값(casual) 중 더 높은(엄격한) 값 채택
      // 이유: 단순 인사말 등에 장애 매뉴얼이 오탐지되어 출력되는 Hallucination(환각) 방지
      score_threshold = Math.max(admin_base, casual_mod);
    }

    // 하드코딩된 score_threshold가 명시적으로 지정되었다면 (예: 테스트용) 강제 덮어쓰기
    if (retrieval_setting?.score_threshold && retrieval_setting.score_threshold !== 0.0) {
      score_threshold = parseFloat(retrieval_setting.score_threshold);
    }

    console.log(`[Retrieval] top_k=${top_k} score_threshold=${score_threshold} query="${query.substring(0,40)}"`);


    const db = c.env.DB;
    const vectorIndex = c.env.WARROOM_INDEX;
    
    if (!query || !vectorIndex) {
      return c.json({ records: [] });
    }

    const cleanedQuery = cleanMessageForEmbedding(query);
    const vector = await generateEmbedding(cleanedQuery, c.env);
    if (!vector) return c.json({ records: [] });

    const simResults = await vectorIndex.query(vector, { topK: top_k, returnMetadata: true });
    
    const records = [];
    if (simResults.matches && simResults.matches.length > 0) {
      const filteredMatches = simResults.matches.filter(m => m.score >= score_threshold);
      
      for (const m of filteredMatches) {
        let kbResult = null;
        const cleanId = m.id.replace(/^kn-|^inc-|^gov-|^INC-/, '').split('_')[0].trim();
        const isLongId = cleanId.length > 10;

        if (isLongId) {
          kbResult = await db.prepare("SELECT content, title, category, tags, inc_id FROM knowledge_base WHERE inc_id = ?").bind(cleanId).first();
        } else {
          kbResult = await db.prepare("SELECT content, title, category, tags, inc_id FROM knowledge_base WHERE id = ?").bind(cleanId).first();
        }

        if (!kbResult && isLongId) {
          const sms = await db.prepare("SELECT message, sender, timestamp FROM received_messages WHERE inc_id = ?").bind(cleanId).first();
          if (sms) {
            kbResult = {
              content: sms.message,
              title: `[실시간 장애로그] ${cleanId} (${sms.sender})`,
              category: 'raw_sms',
              tags: 'SMS,Realtime',
              inc_id: cleanId
            };
          }
        }

        if (kbResult) {
          records.push({
            content: kbResult.content,
            score: m.score,
            title: kbResult.title,
            metadata: {
              category: kbResult.category,
              tags: kbResult.tags,
              incident_id: kbResult.inc_id,
              origin_id: m.id,
              is_raw: kbResult.category === 'raw_sms'
            }
          });
        }
      }
    }

    return c.json({ records });
  } catch (err) {
    console.error("Critical /retrieval error:", err);
    // Return empty results instead of 500 to pass Dify connectivity check
    return c.json({ records: [], error: err.message });
  }
});

app.post('/upsert', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    const token = authHeader ? authHeader.replace(/bearer\s+/i, '').trim() : '';
    const envKey = c.env.DIFY_TOOL_KEY;
    
    // Support both the existing tool key and the Dify dataset transfer key from screenshot
    const allowedTokens = [
      'dataset-IEg4X7UTG3j4IukgkZQV7WUP',
      'dataset-lEg4X7UTG3j4lukgkZQV7WUP',
      'dataset-IEg4X7UTG3j4lukgkZQV7WUP',
      'dataset-lEg4X7UTG3j4IukgkZQV7WUP'
    ];
    if (token !== envKey && !allowedTokens.includes(token)) {
      return c.json({ error: "401 Unauthorized" }, 401);
    }

    const body = await c.req.json();
    const { name, text } = body;

    if (!text) {
      return c.json({ error: "Content (text) is required" }, 400);
    }

    const db = c.env.DB;
    const ai = c.env.AI;
    const vectorIndex = c.env.WARROOM_INDEX;

    // 1. Generate Embedding
    const cleanedText = cleanMessageForEmbedding(text);
    const vector = await generateEmbedding(cleanedText, c.env);
    if (!vector) throw new Error("Failed to generate embedding");

    // 2. Save to D1
    const now = getKst();
    const title = name || `Dify Import: ${new Date().toISOString()}`;
    
    const result = await db.prepare(`
      INSERT INTO knowledge_base (title, content, category, reg_id, reg_dt, mod_id, mod_dt, vector, status)
      VALUES (?, ?, 'Dify 수집', 'DIFY_BOT', ?, 'DIFY_BOT', ?, ?, 'SYNCING')
    `).bind(title, text, now, now, new Float32Array(vector)).run();

    const insertId = result.meta.last_row_id;

    // 3. Upsert to Vectorize
    if (vectorIndex) {
      try {
        await vectorIndex.upsert([{
          id: `kn-${insertId}`,
          values: vector,
          metadata: {
            title: title,
            category: 'dify_import',
            source: 'dify_workflow'
          }
        }]);
        await db.prepare("UPDATE knowledge_base SET status = 'SUCCESS' WHERE id = ?").bind(insertId).run();
      } catch (ve) {
        console.error("Vectorize upsert failed:", ve);
        await db.prepare("UPDATE knowledge_base SET status = 'FAIL', error_log = ? WHERE id = ?")
          .bind(`Vectorize Error: ${ve.message}`, insertId).run();
      }
    }

    return c.json({ 
      success: true, 
      id: `kn-${insertId}`,
      message: "지식이 성공적으로 저장되었습니다." 
    });

  } catch (err) {
    console.error("Upsert error:", err);
    return c.json({ error: err.message }, 500);
  }
});

app.post('/ai/knowledge/sync', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (authHeader !== `Bearer ${c.env.DIFY_TOOL_KEY}`) {
    return c.json({ error: "401 Unauthorized" }, 401);
  }

  const db = c.env.DB;
  const ai = c.env.AI;
  const vectorIndex = c.env.WARROOM_INDEX;

  if (!vectorIndex || !ai) return c.json({ error: "Required bindings missing" }, 500);

  try {
    const { results } = await db.prepare("SELECT id, title, content, inc_id, category FROM knowledge_base").all();
    
    let successCount = 0;
    let failCount = 0;

    for (const row of results) {
      try {
        const embeddings = await ai.run('@cf/baai/bge-base-en-v1.5', { text: [row.content.substring(0, 3000)] });
        const vector = embeddings.data[0];
        
        if (vector) {
          await db.prepare("UPDATE knowledge_base SET vector = ?, status = 'SYNCING' WHERE id = ?")
            .bind(new Float32Array(vector), row.id).run();

          await vectorIndex.upsert([{
            id: `kn-${row.id}`,
            values: vector,
            metadata: {
              title: row.title,
              incident_id: row.inc_id || '',
              category: row.category || 'general'
            }
          }]);
          
          await db.prepare("UPDATE knowledge_base SET status = 'SUCCESS' WHERE id = ?").bind(row.id).run();
          successCount++;
        } else {
          await db.prepare("UPDATE knowledge_base SET status = 'FAIL', error_log = 'Embedding failed' WHERE id = ?").bind(row.id).run();
          failCount++;
        }
      } catch (e) {
        console.error(`Sync error for ID ${row.id}:`, e.message);
        await db.prepare("UPDATE knowledge_base SET status = 'FAIL', error_log = ? WHERE id = ?")
          .bind(e.message, row.id).run();
        failCount++;
      }
    }

    return c.json({ success: true, processed: results.length, successCount, failCount });
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

// 🚀 NEW: Resolve Only (No Report)
app.post('/warroom/resolve-only', async (c) => {
  const { inc_id, user_id } = await c.req.json();
  const db = c.env.DB;
  const now = getKst();
  const normId = String(inc_id);

  await db.prepare("UPDATE warroom_list SET status = 'CLOSED', mod_id = ?, mod_dt = ? WHERE inc_id = ?")
    .bind(user_id, now, normId).run();
  
  await db.prepare("UPDATE incident_assignments SET status = 'INC_003', updated_at = ?, mod_dt = ?, mod_id = ? WHERE inc_id = ?")
    .bind(now, now, user_id, normId).run();

  await db.prepare("INSERT INTO activity_logs (inc_id, incident_code, user_id, action, detail, created_at) VALUES (?, ?, ?, '장애 완료', '보고서 없이 장애가 처리 완료되었습니다.', ?)")
    .bind(normId, normId, user_id, now).run();

  return c.json({ status: 'success' });
});

app.post('/ai/warroom/close', async (c) => {
  const { inc_id, user_id } = await c.req.json()
  const db = c.env.DB
  const now = getKst()
  
  const normId = String(inc_id);
  await db.prepare("UPDATE warroom_list SET status = 'CLOSED', mod_dt = ?, mod_id = ? WHERE inc_id = ?")
    .bind(now, user_id || 'SYSTEM', normId).run()
    
  // Cascading update for all participants
  await db.prepare("UPDATE incident_assignments SET status = 'INC_003', updated_at = ?, mod_dt = ?, mod_id = ? WHERE inc_id = ?")
    .bind(now, now, user_id || 'SYSTEM', normId).run();
    
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
  
  const normId = String(inc_id);
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
    const assignResult = await db.prepare(`
      INSERT INTO incident_assignments (user_id, inc_id, status, assigned_at, updated_at, reg_id, reg_dt, mod_id, mod_dt)
      VALUES (?, ?, 'INC_001', ?, ?, 'SYSTEM', ?, 'SYSTEM', ?)
      ON CONFLICT(user_id, inc_id) DO NOTHING
    `).bind(empId, normId, now, now, now, now).run()

    // 3. Log activity ONLY if a new assignment was actually made
    if (assignResult.meta.changes > 0) {
      await db.prepare(`
        INSERT INTO activity_logs (inc_id, incident_code, incident_title, user_id, user_name, action, detail, created_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(normId, normId, incident_title || 'SMS 수신 확인', empId, user.name || '알 수 없음', action || '장애 할당', detail || '인시던트가 담당자에게 할당되었습니다.', now)
        .run()
    }
    
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
  const normId = String(inc_id);

  await db.prepare(`
    UPDATE incident_assignments 
    SET status = ?, updated_at = ?, mod_dt = ?, mod_id = ?
    WHERE user_id = ? AND inc_id = ?
  `).bind(status, now, now, user_id || 'SYSTEM', user_id, normId).run()

  // 🚀 [Activity Log] 인시던트 상태 변경
  try {
    const statusLabel = { '미확인': '미확인', '처리중': '처리 시작', '처리완료': '처리 완료', '미처리': '미처리 전환' }[status] || status;
    await db.prepare(`
      INSERT INTO activity_logs (inc_id, incident_code, user_id, action, detail, created_at)
      VALUES (?, ?, ?, '상태 변경', ?, ?)
    `).bind(normId, normId, user_id || 'SYSTEM', `담당자 상태가 '${statusLabel}'으로 변경되었습니다.`, now).run();
  } catch(e) { console.error('[ActivityLog-Status]', e.message); }
  
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
        WHEN a.status = 'INC_003' THEN 'INC_003'
        WHEN wl.status IN ('CLOSED', '최종완료', '처리완료', 'Completed', '완료') THEN 'INC_003'
        WHEN chat_counts.cnt > 0 THEN 'INC_002'
        ELSE a.status
      END as status,
      COALESCE(chat_counts.cnt, 0) as chat_count,
      m.sender, m.message, m.employee_id, m.timestamp as message_at, m.received_count, m.occurrence_count,
      insight.similarity_score, insight.similarity_reason,
      CASE WHEN insight.inc_id IS NOT NULL THEN 1 ELSE 0 END as is_analyzed,
      u1.name as sender_name, 
      COALESCE(
        (SELECT name FROM organizations WHERE code = u1.part),
        (SELECT name FROM organizations WHERE code = u1.team),
        u1.part
      ) as sender_part,
      (SELECT GROUP_CONCAT(u2.name, ', ') 
       FROM incident_assignments a2 
       JOIN users u2 ON a2.user_id = u2.employee_id 
       WHERE a2.inc_id = a.inc_id) as assignees
    FROM incident_assignments a
    LEFT JOIN received_messages m ON a.inc_id = m.inc_id
    LEFT JOIN users u1 ON m.employee_id = u1.employee_id
    LEFT JOIN autopilot_insight insight ON a.inc_id = insight.inc_id
    LEFT JOIN warroom_list wl ON a.inc_id = wl.inc_id
    LEFT JOIN (
      SELECT inc_id, COUNT(*) as cnt
      FROM warroom_chats
      GROUP BY inc_id
    ) chat_counts ON a.inc_id = chat_counts.inc_id
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

  const inc_id_str = String(inc_id_param).trim();
  const rawId = inc_id_str;
  

  // Aggregate steps from various tables
  const steps = [];

  try {
    // 1. SMS 수신 (received_messages)
    const sms = await db.prepare("SELECT timestamp FROM received_messages WHERE inc_id = ?").bind(rawId).first();
    if (sms) steps.push({ id: 'SMS', label: 'SMS 수신 및 장애 인지', timestamp: sms.timestamp, detail: '시스템에 장애 메시지가 수신되었습니다.' });

    // 2. RAG 분석 완료 (autopilot_insight)
    const rag = await db.prepare("SELECT reg_dt FROM autopilot_insight WHERE inc_id = ?").bind(rawId).first();
    if (rag) steps.push({ id: 'RAG', label: 'RAG 분석 완료', timestamp: rag.reg_dt, detail: 'AI 엔진이 과거 사례 및 지식베이스를 바탕으로 초기 분석을 마쳤습니다.' });

    // 3. AI AGENT 분석 완료 (same as RAG)
    if (rag) steps.push({ id: 'AGENT', label: 'AI AGENT 분석 완료', timestamp: rag.reg_dt, detail: '에이전트 그룹의 심층 분석이 완료되었습니다.' });

    // 4. 워룸 생성 (warroom_list)
    const wr = await db.prepare(`
      SELECT 
        w.reg_dt, 
        w.creator_id, 
        w.status, 
        u.name as creator_name
      FROM warroom_list w
      LEFT JOIN users u ON w.creator_id = u.employee_id
      WHERE w.inc_id = ? 
      LIMIT 1
    `).bind(rawId).first();
    
    if (wr) {
      steps.push({ 
        id: 'WARROOM', 
        label: '워룸 생성', 
        timestamp: wr.reg_dt, 
        detail: `${wr.creator_name || wr.creator_id || '시스템'}님에 의해 실시간 대응 워룸이 가동되었습니다.` 
      });
    }

    // 6. 지식화/장애/보고 처리완료 (knowledge_base)
    const kn = await db.prepare("SELECT reg_dt FROM knowledge_base WHERE inc_id = ?").bind(rawId).first();
    if (kn) steps.push({ id: 'KNOWLEDGE', label: '지식화/장애/보고 처리완료', timestamp: kn.reg_dt, detail: '인시던트 대응 지식이 지식베이스(RAG)에 저장되고 최종 보고 및 장애 처리가 완료되었습니다.' });

    // 7. Get all assignees from incident_assignments
    const assigneesRes = await db.prepare(`
      SELECT 
        ia.user_id, 
        ia.status, 
        ia.assigned_at, 
        u.name,
        COALESCE(ot.name, u.team) as team_name,
        COALESCE(op.name, u.part) as part_name,
        (SELECT COUNT(*) FROM warroom_chats wc WHERE (wc.inc_id = ? ) AND wc.sender = ia.user_id) as chat_count
      FROM incident_assignments ia
      LEFT JOIN users u ON ia.user_id = u.employee_id
      LEFT JOIN organizations ot ON u.team = ot.code AND ot.depth = 3
      LEFT JOIN organizations op ON u.part = op.code AND op.depth = 4
      WHERE ia.inc_id = ? 
    `).bind(rawId, rawId).all();
    const isWarroomClosed = wr && ['CLOSED', '최종완료', '처리완료', 'Completed', '완료'].includes(wr.status);

    const finalizedAssignees = (assigneesRes.results || []).map(a => {
      if (isWarroomClosed || kn) {
        return { ...a, status: 'INC_003' };
      }
      if (a.status === 'INC_002' && Number(a.chat_count) === 0) {
        return { ...a, status: '미참여' };
      }
      return a;
    });

    return c.json({ 
      inc_id: inc_id_str, 
      steps: steps.sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp)), 
      all_logs: (await db.prepare("SELECT action, created_at, detail FROM activity_logs WHERE incident_code = ? ").bind(rawId).all()).results || [],
      assignees: finalizedAssignees
    });
  } catch (e) {
    console.error('Workflow API Error:', e);
    return c.json({ error: e.message, stack: e.stack }, 500);
  }
})

// 3. 특정 인시던트 상세 (와일드카드 - 가장 마지막에 정의)
app.get('/ai/incident/:inc_id', async (c) => {
  const rawId = c.req.param('inc_id')
  const normId = String(rawId)
  const db = c.env.DB
  
  // High-performance query starting from received_messages to ensure no 404s for new SMS
  const incident = await db.prepare(`
    SELECT 
      COALESCE(i.inc_id, r.inc_id) as inc_id,
      COALESCE(i.title, 'INC-' || r.inc_id || ' | ' || r.message) as title,
      COALESCE(i.status, 'INC_001') as status,
      i.description, 
      COALESCE(i.severity, 'NORMAL') as severity,
      i.incident_type, 
      i.assigned_to,
      u.name as assignee_name,
      r.message as sms_message, 
      r.sender as sms_sender,
      r.timestamp as created_at
    FROM received_messages r
    LEFT JOIN incidents i ON r.inc_id = i.inc_id
    LEFT JOIN users u ON i.assigned_to = u.employee_id 
    WHERE r.inc_id = ? 
    LIMIT 1
  `).bind(normId).first()
  
  if (!incident) return c.json({ error: "Not found" }, 404)
  return c.json({ incident })
})


// User Specific War-Room mapping
app.post('/warroom/leave', async (c) => {
  const { user_id, inc_id } = await c.req.json()
  const db = c.env.DB
  const normId = String(inc_id)
  const now = getKst()
  await db.prepare("DELETE FROM user_warrooms WHERE user_id = ? AND inc_id = ?")
    .bind(user_id, normId).run()
  // 🚀 [Activity Log] 워룸 퇴장
  try {
    await db.prepare(`
      INSERT INTO activity_logs (inc_id, incident_code, user_id, action, detail, created_at)
      VALUES (?, ?, ?, '워룸 퇴장', '워룸에서 나갔습니다.', ?)
    `).bind(normId, normId, user_id || 'SYSTEM', now).run();
  } catch(e) { console.error('[ActivityLog-Leave]', e.message); }
  return c.json({ status: 'left', user_id, inc_id })
})

app.patch('/incidents/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const rawId = id;
  
  const data = await c.req.json()
  const now = getKst()
  
  let finalTitle = data.title;
  if (!finalTitle || finalTitle === 'SMS 장애 감지') {
    const sms = await db.prepare("SELECT message FROM received_messages WHERE inc_id = ?").bind(rawId).first()
    if (sms) finalTitle = `${rawId} | ${sms.message}`
  }

  await db.prepare(`
    UPDATE incidents 
    SET title = COALESCE(?, title),
        description = COALESCE(?, description),
        severity = COALESCE(?, severity),
        status = COALESCE(?, status),
        assigned_to = COALESCE(?, assigned_to),
        mod_dt = ?,
        mod_id = ?
    WHERE inc_id = ?
  `).bind(finalTitle || null, data.description || null, data.severity || null, data.status || null, data.assigned_to || null, now, data.user_id || 'SYSTEM', rawId).run()
  
  return c.json({ status: "success", id: rawId, title: finalTitle })
})

app.post('/ai/warroom/invite', async (c) => {
  const { user_id, inc_id } = await c.req.json()
  const db = c.env.DB
  const normId = String(inc_id)
  const now = getKst()
  const joinRes = await db.prepare("INSERT INTO user_warrooms (user_id, inc_id, joined_at) VALUES (?, ?, ?) ON CONFLICT(user_id, inc_id) DO NOTHING")
    .bind(user_id, normId, now).run()
  // 🚀 [Activity Log] 워룸 초대
  try {
    if (joinRes.meta.changes > 0) {
      await db.prepare(`
        INSERT INTO activity_logs (inc_id, incident_code, user_id, action, detail, created_at)
        VALUES (?, ?, ?, '워룸 초대', '워룸에 초대되어 참여했습니다.', ?)
      `).bind(normId, normId, user_id || 'SYSTEM', now).run();
    }
  } catch(e) { console.error('[ActivityLog-Invite]', e.message); }
  return c.json({ status: 'invited', user_id, inc_id })
})

app.get('/ai/user/activity-history', async (c) => {
  const user_id = c.req.query('user_id')
  if (!user_id) return c.json({ history: [] })

  const { results } = await c.env.DB.prepare(`
    SELECT l.*, date(l.created_at) as log_date 
    FROM activity_logs l
    LEFT JOIN users u ON l.user_id = u.employee_id
    WHERE l.user_id = ?
    ORDER BY l.created_at DESC 
    LIMIT 100
  `).bind(user_id).all()

  return c.json({ history: results })
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
  const { incident_id, resolution_text, commandsUsed, feedback, user_id, feedback_type } = await c.req.json()
  const db = c.env.DB
  const ai = c.env.AI
  const nowFeedback = getKst()

  // 🛡️ Phase 16: Abuse Protection (1-vote per user per incident)
  const existingVote = await db.prepare("SELECT id FROM resolution_feedback WHERE inc_id = ? AND reg_id = ?").bind(incident_id, user_id).first();
  if (existingVote) {
      return c.json({ status: "rejected", message: "이미 이 인시던트에 대해 피드백을 제출하셨습니다. (1인 1표 제한)" }, 403);
  }

  // 🛡️ Phase 15: AI Guardian (Immediate Rejection)
  if (ai) {
    try {
      const auditResult = await ai.run('@cf/meta/llama-3-8b-instruct', {
        messages: [
          { role: 'system', content: 'You are an S-Guard AI Auditor. Evaluate if the provided feedback for an incident resolution is meaningful and professional. If it is nonsense, aggressive, or empty, respond with "REJECT". Otherwise, respond with "PASS".' },
          { role: 'user', content: `Feedback: ${feedback || resolution_text}` }
        ]
      });
      const decision = String(auditResult.response || auditResult.text || '').toUpperCase();
      if (decision.includes('REJECT')) {
        return c.json({ status: "rejected", message: "부적절하거나 무의미한 피드백은 AI 가디언에 의해 즉시 반려되었습니다. (AI Audit Rejection)" }, 400);
      }
    } catch (ae) {
      console.error("AI Audit Error:", ae);
    }
  }

  const res = await db.prepare(`
    INSERT INTO resolution_feedback (inc_id, resolution_text, commandsUsed, feedback, feedback_type, reg_id, reg_dt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(incident_id, resolution_text, JSON.stringify(commandsUsed), feedback, feedback_type || 'good', user_id, nowFeedback).run()

  // 📈 Reputation & S-Point Reward (Phase 17/18: user_stats Sync)
  await db.prepare("UPDATE users SET s_point = s_point + 1.0 WHERE employee_id = ?").bind(user_id).run();
  
  // Update user_stats (Phase 18 Structure)
  await db.prepare(`
    INSERT INTO user_stats (user_id, user_name, s_point, contribution_count, rank_level, last_active_dt)
    VALUES (?, (SELECT name FROM users WHERE employee_id = ?), 1, 1, 'IRON', ?)
    ON CONFLICT(user_id) DO UPDATE SET 
      s_point = s_point + 1,
      contribution_count = contribution_count + 1,
      last_active_dt = ?
  `).bind(user_id, user_id, nowFeedback, nowFeedback).run();

  // Auto-Rank Update Logic (Thresholds: Iron 0, Silver 100, Gold 500)
  await db.prepare(`
    UPDATE users SET rank_status = CASE 
      WHEN s_point >= 500 THEN 'Gold Guard'
      WHEN s_point >= 100 THEN 'Silver Guard'
      ELSE 'Iron Guard'
    END
    WHERE employee_id = ? AND rank_status != 'Legendary Guard'
  `).bind(user_id).run();

  if (feedback_type === 'bad') {
      // Find the original author and penalize
      const originalAuth = await db.prepare("SELECT reg_id FROM knowledge_base WHERE inc_id = ?").bind(incident_id).first();
      if (originalAuth) {
          await db.prepare("UPDATE users SET s_point = s_point - 1.0 WHERE employee_id = ?").bind(originalAuth.reg_id).run();
      }
  }

  // 🏛️ Consensus Engine (Majority Rule Implementation)
  const similarFeedbacks = await db.prepare("SELECT resolution_text, reg_id FROM resolution_feedback WHERE inc_id = ?").bind(incident_id).all();
  if (similarFeedbacks.results && similarFeedbacks.results.length >= 3) {
      const topResolution = similarFeedbacks.results[0].resolution_text;
      await db.prepare("UPDATE knowledge_base SET content = ?, status = 'VERIFIED', vote_count = vote_count + 1 WHERE inc_id = ?").bind(topResolution, incident_id).run();
  }

  return c.json({ status: "success", message: "피드백이 저장되었으며 평판 및 합의 로직이 반영되었습니다." })
})

// 📊 Phase 16: Vulnerability Analysis API (Dynamic Ratio-based)
app.get('/ai/governance/vulnerability-stats', async (c) => {
  const db = c.env.DB;
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const dateStr = thirtyDaysAgo.toISOString().replace('T', ' ').substring(0, 19);

  const statsSql = `
    SELECT 
      k.error_code, 
      COUNT(f.id) as total_feedback,
      SUM(CASE WHEN f.feedback_type = 'bad' THEN 1 ELSE 0 END) as bad_count,
      ROUND(CAST(SUM(CASE WHEN f.feedback_type = 'bad' THEN 1 ELSE 0 END) AS REAL) / COUNT(f.id) * 100, 1) as vulnerability_ratio
    FROM knowledge_base k
    JOIN resolution_feedback f ON k.inc_id = f.inc_id
    WHERE f.reg_dt > ?
    GROUP BY k.error_code
    HAVING total_feedback >= 3
    ORDER BY vulnerability_ratio DESC
    LIMIT 10
  `;

  try {
    const { results } = await db.prepare(statsSql).bind(dateStr).all();
    return c.json({ 
      period: "Last 30 Days",
      metrics: "Bad/Total Ratio (%)",
      results: results || []
    });
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});

// 🏆 Phase 18: Infrastructure Hero Leaderboard API
app.get('/ai/governance/leaderboard', async (c) => {
  const db = c.env.DB;
  try {
    const topHeroes = await db.prepare(`
      SELECT user_id, user_name, s_point, contribution_count, rank_level
      FROM user_stats
      ORDER BY s_point DESC, contribution_count DESC
      LIMIT 10
    `).all();

    return c.json({
      title: "S-Guard Infrastructure Heroes (Leaderboard)",
      updated_at: getKst(),
      heroes: topHeroes.results || []
    });
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});

// ⚖️ Phase 19: Agree Terms API (Enhanced with IP & Version tracking)
app.post('/auth/agree-terms', async (c) => {
  const { employee_id, version } = await c.req.json();
  const db = c.env.DB;
  const now = getKst();
  
  // 🛡️ Audit Proof: Extract IP and Timestamp
  const userIp = c.req.header('CF-Connecting-IP') || '0.0.0.0';
  
  try {
    await db.prepare(`
      UPDATE users 
      SET terms_agreed_at = ?, terms_agreed_ip = ?, terms_version = ? 
      WHERE employee_id = ?
    `).bind(now, userIp, version || 'v1.0', employee_id).run();

    return c.json({ 
      status: 'success', 
      message: 'Terms agreement recorded with audit audit proof', 
      agreed_at: now,
      ip: userIp
    });
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});

// Incidents create
app.post('/incidents', async (c) => {
  const { inc_id, title, description, severity, incident_type, source_sms_id } = await c.req.json()
  const db = c.env.DB
  const rawId = String(inc_id)
  

  const existing = await db.prepare("SELECT inc_id FROM incidents WHERE inc_id = ?").bind(rawId).first()
  if (existing) return c.json({ status: 'exists', inc_id: rawId })

  // Fetch actual message from received_messages
  const sms = await db.prepare("SELECT message FROM received_messages WHERE inc_id = ?").bind(rawId).first()
  const rawMsg = sms ? sms.message : (title || 'SMS 장애 감지')
  const truncatedMsg = rawMsg.length > 50 ? rawMsg.substring(0, 50) + "..." : rawMsg;
  const finalTitle = `${rawId} | ${truncatedMsg}`

  const now = getKst()
  await db.prepare(
    `INSERT INTO incidents (
      inc_id, title, description, severity, status, incident_type, source_sms_id, 
      reg_id, reg_dt, mod_id, mod_dt, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    rawId, finalTitle, description, severity, 'INC_001', incident_type, source_sms_id || null, 
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
  const idParam = c.req.param('id')
  const db = c.env.DB

  // ID Normalization
  const rawId  = idParam

  // Always pull title and leader_summary from warroom_list
  const wr = await db.prepare(
    "SELECT title, status, leader_summary FROM warroom_list WHERE inc_id = ?"
  ).bind(rawId).first()
  let title = (wr && wr.title) ? wr.title : rawId
  let status = (wr && wr.status) ? wr.status : 'INC_001'
  const leader_summary_db = (wr && wr.leader_summary) ? wr.leader_summary : ''
  let description = leader_summary_db

  // Supplement description from incidents if warroom_list has none
  const inc = await db.prepare(
    "SELECT description, status FROM incidents WHERE inc_id = ?"
  ).bind(rawId).first()
  const sms_body = (inc && inc.description) ? inc.description : ''   // ← 원본 SMS 텍스트
  if (inc) {
    if (!description && inc.description) description = inc.description
    if (inc.status && inc.status !== 'INC_001') status = inc.status
  }

  // Get messages
  const { results: aiResults } = await db.prepare(
    "SELECT * FROM aichat_history WHERE inc_id = ? ORDER BY id ASC"
  ).bind(rawId).all()
  const { results: wrResults } = await db.prepare(
    "SELECT wc.*, u.name as sender_name FROM warroom_chats wc LEFT JOIN users u ON wc.sender = u.employee_id WHERE wc.inc_id = ? ORDER BY wc.timestamp ASC"
  ).bind(rawId).all()

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
    sender_name: r.sender_name || r.sender,
    role: r.role,
    text: r.text,
    timestamp: r.timestamp,
    read_count: r.read_count || 0,
    reactions: r.reactions || '{}'
  }));

  // Extract Leader Agent summary
  const leaderRow = (aiResults || []).find(r => r.agent_role === 'Leader')
  const leader_summary = leader_summary_db || (leaderRow ? leaderRow.content : '')

  // Combine and sort
  const allMessages = [...aiMessages, ...chatMessages].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  return c.json({ title, description, sms_body, status, leader_summary, messages: allMessages })
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
  ).bind(incident_id, seq, senderId, role || 'user', type || 'user', text, now, senderId, now, senderId, now).run()
  
  return c.json({ status: 'saved' })
})

// ==========================================
// File Upload → warroom_attachments
// ==========================================
app.post('/warroom/upload', async (c) => {
  const db = c.env.DB
  const now = getKst()

  let formData
  try {
    formData = await c.req.formData()
  } catch (e) {
    return c.json({ error: 'Invalid form data' }, 400)
  }

  const file        = formData.get('file')
  const incident_id = formData.get('incident_id')  // 워룸 첨부: 필수 | 프로필: 없음
  const employee_id = formData.get('employee_id')  // 프로필 업로드 시 사번
  const uploaded_by = formData.get('uploaded_by') || employee_id || 'Unknown'

  if (!file) {
    return c.json({ error: 'file is required' }, 400)
  }

  const fileName  = file.name || `file_${Date.now()}`
  const fileBuffer = await file.arrayBuffer()

  // ── 프로필 사진 업로드 (incident_id 없음) ──────────────────────────────
  if (!incident_id) {
    const key = `profile/${employee_id || uploaded_by}/${Date.now()}_${fileName}`
    await c.env.WARROOM_ASSETS.put(key, fileBuffer, {
      httpMetadata: { contentType: file.type || 'image/jpeg' }
    })
    const fileUrl = `${new URL(c.req.url).origin}/warroom/asset/${encodeURIComponent(key)}`
    return c.json({ status: 'uploaded', url: fileUrl, filename: fileName })
  }

  // ── 워룸 첨부 업로드 (incident_id 있음) ───────────────────────────────
  const lastRow = await db.prepare(
    "SELECT MAX(seq) as max_seq FROM warroom_attachments WHERE inc_id = ?"
  ).bind(incident_id).first()
  const seq = (lastRow && lastRow.max_seq != null) ? lastRow.max_seq + 1 : 1

  const fileKey = `warroom/${incident_id}/${seq}/${fileName}`
  await c.env.WARROOM_ASSETS.put(fileKey, fileBuffer, {
    httpMetadata: { contentType: file.type || 'application/octet-stream' }
  })

  const fileUrl  = `/warroom/asset/${encodeURIComponent(fileKey)}`
  const fileType = file.type || 'application/octet-stream'

  await db.prepare(`
    INSERT INTO warroom_attachments (inc_id, seq, filename, original_name, file_type, url, uploaded_by, timestamp, reg_id, reg_dt, mod_id, mod_dt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    incident_id, seq, fileKey, fileName,
    fileType, fileUrl, uploaded_by,
    now, uploaded_by, now, uploaded_by, now
  ).run()

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
  // ⚡ Cross-Origin 이미지 임베드 허용 (secureHeaders()의 same-origin 정책 오버라이드)
  headers.set('Access-Control-Allow-Origin', '*')
  headers.set('Cross-Origin-Resource-Policy', 'cross-origin')
  headers.set('Cache-Control', 'public, max-age=31536000, immutable')
  
  return new Response(object.body, { headers })
})

// Dify-powered High-Performance Summary
// Consolidated Resolve (Close) an Incident
app.post('/warroom/resolve', async (c) => {
  const { incident_id, user_id } = await c.req.json();
  const db = c.env.DB;
  if (!incident_id) return c.json({ error: 'incident_id is required' }, 400);

  const now = getKst();
  const normId = String(incident_id);

  try {
    // 1. Update War-Room Status
    await db.prepare("UPDATE warroom_list SET status = 'CLOSED', mod_dt = ?, mod_id = ? WHERE inc_id = ?")
      .bind(now, user_id || 'SYSTEM', incident_id).run();

    // 2. Update Incident Status to 'INC_003'
    await db.prepare("UPDATE incidents SET status = 'INC_003', mod_dt = ?, mod_id = ? WHERE inc_id = ?")
      .bind(now, user_id || 'SYSTEM', normId).run();

    // 3. Update ALL incident assignments to 'INC_003' (check both ID formats)
    await db.prepare("UPDATE incident_assignments SET status = 'INC_003', updated_at = ?, mod_dt = ?, mod_id = ? WHERE inc_id = ?")
      .bind(now, now, user_id || 'SYSTEM', normId).run();

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
  const pdfFile = formData.get('pdf');
  const incident_id = formData.get('incident_id');
  
  if (!pdfFile || !incident_id) {
    return c.json({ error: 'PDF file and incident_id are required' }, 400);
  }

  // Convert PDF Blob to Base64 for MailChannels attachment
  const arrayBuffer = await pdfFile.arrayBuffer();
  const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

  // 1. Prepare Metadata
  const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  const recipientEmail = 'khcho0421@gmail.com';

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

  // 3. Finalize Incident Status (Cascading)
  const db = c.env.DB;
  const normId = String(incident_id);
  await db.prepare("UPDATE warroom_list SET status = 'CLOSED', mod_dt = ? WHERE inc_id = ?")
    .bind(now, normId).run();
    
  await db.prepare("UPDATE incident_assignments SET status = 'INC_003', updated_at = ?, mod_dt = ?, mod_id = ? WHERE inc_id = ?")
    .bind(now, now, 'SYSTEM', normId).run();

  await db.prepare("INSERT INTO activity_logs (inc_id, incident_code, user_id, action, detail, created_at) VALUES (?, ?, 'SYSTEM', '인시던트 종료', '분석 보고서가 최종 전송되어 장애가 처리 완료되었습니다.', ?)")
    .bind(normId, normId, now).run();

  return c.json({ success: true, message: 'PDF report sent and incident finalized successfully' });
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
    const embeddings = await ai.run('@cf/baai/bge-base-en-v1.5', { 
      text: [sanitizedContent.substring(0, 3000)] // Limit for embedding stability
    });
    const vector = embeddings.data[0];

    if (!vector) throw new Error('Failed to generate vector embedding');

    // 2. Insert into D1 (knowledge_base table)
    const now = getKst();
    const actor = user_id || 'SYSTEM';

    const result = await db.prepare(`
      INSERT INTO knowledge_base (
        inc_id, title, content, category, tags, reg_id, reg_dt, mod_id, mod_dt, vector, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
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
    if (vectorIndex && vector) {
      await vectorIndex.upsert([{
        id: `kn-${dbInsertId}`,
        values: vector,
        metadata: {
          title,
          incident_id: incident_id || '',
          category: category || 'report'
        }
      }]);
      // Update status to SUCCESS after successful vector upsert
      await db.prepare("UPDATE knowledge_base SET status = 'SUCCESS' WHERE id = ?").bind(dbInsertId).run();
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
    const embeddings = await ai.run('@cf/baai/bge-base-en-v1.5', { 
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
        const embeddings = await ai.run('@cf/baai/bge-base-en-v1.5', { 
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
    const kbResult = await db.prepare(`
      INSERT INTO knowledge_base (inc_id, title, content, category, reg_id, reg_dt, mod_id, mod_dt, vector, status)
      VALUES (?, ?, ?, '거버넌스 승인', ?, ?, ?, ?, ?, 'PENDING')
      ON CONFLICT(inc_id) DO UPDATE SET
        title = excluded.title,
        content = excluded.content,
        mod_id = excluded.mod_id,
        mod_dt = excluded.mod_dt,
        vector = excluded.vector,
        status = 'PENDING'
      RETURNING id
    `).bind(
      incident_id, 
      title || `Governance: ${incident_id}`, 
      sanitizedContent, 
      actor,
      now,
      actor,
      now,
      embeddingValue
    ).first();

    const dbInsertId = kbResult?.id;

    // 🚀 NEW: Sync Governance Report to Vectorize
    if (vectorIndex && embeddingValue && dbInsertId) {
      try {
        await vectorIndex.upsert([{
          id: `kn-${dbInsertId}`,
          values: Array.from(embeddingValue),
          metadata: {
            title: title || `Governance: ${incident_id}`,
            incident_id: incident_id || '',
            category: 'governance'
          }
        }]);
        // Update to SUCCESS
        await db.prepare("UPDATE knowledge_base SET status = 'SUCCESS' WHERE id = ?").bind(dbInsertId).run();
      } catch (ve) {
        console.error("[Governance] Vectorize sync failed:", ve.message);
      }
    }

    // 5. Update Incident Status to '처리완료'
    await db.prepare("UPDATE incidents SET status = 'INC_003', updated_at = ?, mod_dt = ?, mod_id = ? WHERE inc_id = ?")
      .bind(now, now, actor, incident_id).run();

    const normId = String(incident_id);

    // 6. Update ALL assignments for this incident to '처리완료'
    await db.prepare("UPDATE incident_assignments SET status = 'INC_003', updated_at = ?, mod_dt = ?, mod_id = ? WHERE inc_id = ?")
      .bind(now, now, actor, normId).run();

    // 7. Auto-update War-Room Status here to prevent sync issues
    await db.prepare("UPDATE warroom_list SET status = 'CLOSED', mod_dt = ?, mod_id = ? WHERE inc_id = ?")
      .bind(now, actor, normId).run();

    // 8. Auto-notify assigned users in their inbox
    try {
      const assignedUsers = await db.prepare("SELECT user_id FROM incident_assignments WHERE inc_id = ?")
        .bind(normId).all();
      
      if (assignedUsers.results && assignedUsers.results.length > 0) {
        const inboxStmt = db.prepare(`
          INSERT INTO inbox_items (
            user_id, type, title, content, preview, urgency, 
            inc_id, action_link, sender_name, created_at, 
            reg_id, reg_dt, mod_id, mod_dt
          ) VALUES (?, 'REPORT', ?, ?, ?, 'NORMAL', ?, ?, 'System', ?, 'SYSTEM', ?, 'SYSTEM', ?)
        `);
        
        const inboxPromises = assignedUsers.results.map(u => 
          inboxStmt.bind(
            u.user_id,
            `보고서 발행: ${incident_id}`,
            `인시던트(${incident_id})에 대한 최종 분석 보고서가 승인 및 발행되었습니다.`,
            `최종 보고서가 지식 베이스에 등록되었습니다.`,
            incident_id,
            `/ai-report/${incident_id}`,
            now, now, now
          ).run()
        );
        await Promise.all(inboxPromises);
        console.log(`[Inbox] Notified ${assignedUsers.results.length} users about report ${incident_id}`);
      }
    } catch (e) {
      console.error("[Inbox] Auto-notify error:", e);
    }

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
        u.honbu as honbu_code,
        u.team as team_code,
        u.part, u.subpart, u.position 
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
    SELECT w.*, r.message AS sms_message
    FROM warroom_list w
    JOIN user_warrooms uw ON w.inc_id = uw.inc_id
    LEFT JOIN received_messages r ON w.inc_id = r.inc_id
    WHERE uw.user_id = ?
    ORDER BY w.reg_dt DESC
  `).bind(user_id).all()
  
  const mapped2 = (results || []).map(r => ({
    ...r,
    severity: (r.severity || 'NORMAL').toUpperCase(),
  }))
  return c.json({ rooms: mapped2 })
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

// ── Inbox Management ───────────────────────────────────────────────────────
app.get('/inbox', async (c) => {
  const db = c.env.DB
  const user = c.get('user')
  const user_id = c.req.query('user_id') || user?.employee_id
  const folder = c.req.query('folder') || 'INBOX'
  
  if (!user_id) return c.json({ error: 'user_id is required' }, 400)

  let query = `
    SELECT 
      i.*, 
      r.message AS sms_message,
      u.part AS sender_part,
      u.team AS sender_team
    FROM inbox_items i
    LEFT JOIN received_messages r ON i.inc_id = r.inc_id
    LEFT JOIN users u ON i.sender_id = u.employee_id
    WHERE i.user_id = ?
  `
  const params = [user_id]
  
  if (folder) {
    query += " AND i.folder = ?"
    params.push(folder)
  }
  
  query += " ORDER BY i.created_at DESC"

  const { results } = await db.prepare(query).bind(...params).all()
  
  // 조직명 변환 (results 배열 가공)
  const finalResults = []
  const orgCache = {}
  
  for (const item of results) {
    let orgName = '상담'
    const targetCode = item.sender_part || item.sender_team
    if (targetCode) {
      if (orgCache[targetCode]) {
        orgName = orgCache[targetCode]
      } else {
        try {
          const row = await db.prepare("SELECT name FROM organizations WHERE code = ? LIMIT 1").bind(targetCode).first()
          if (row?.name) {
            orgName = row.name
            orgCache[targetCode] = row.name
          }
        } catch (e) { /* ignore */ }
      }
    }
    finalResults.push({
      ...item,
      sender_org_path: orgName
    })
  }

  return c.json(finalResults)
})

// Unified Report Submission & Distribution
app.post('/api/v1/reports/submit', async (c) => {
  const db = c.env.DB
  const body = await c.req.json()
  const { 
    incident_id, sender_id, sender_name,
    title, content, preview, urgency = 'NORMAL'
  } = body

  if (!incident_id || !sender_id) return c.json({ error: 'incident_id and sender_id are required' }, 400)

  try {
    const now = getKst()
    
    const normId = String(incident_id);
    const incIdWithPrefix = `INC-${normId}`;

    // 1. Update Incident Status to 'INC_003'
    await db.prepare(`
      UPDATE incidents SET status = 'INC_003', updated_at = ?, mod_dt = ?, mod_id = ? WHERE inc_id = ?
    `).bind(now, now, sender_id || 'SYSTEM', normId).run()

    // 1-1. Update WarRoom Status to 'CLOSED'
    await db.prepare(`
      UPDATE warroom_list SET status = 'CLOSED', mod_dt = ?, mod_id = ? WHERE inc_id = ?
    `).bind(now, sender_id || 'SYSTEM', normId).run()

    // 1-2. Update All Assignees Status to 'INC_003'
    await db.prepare(`
      UPDATE incident_assignments SET status = 'INC_003', updated_at = ?, mod_dt = ?, mod_id = ? WHERE inc_id = ?
    `).bind(now, now, sender_id || 'SYSTEM', normId).run()
    
    // 2. Generate embedding for Vector Search
    const ai = c.env.AI;
    let vector = null;
    let vectorArray = null;
    if (content) {
      try {
        const embeddings = await ai.run('@cf/baai/bge-base-en-v1.5', { text: [content.substring(0, 3000)] });
        vector = embeddings.data[0];
        vectorArray = vector ? new Float32Array(vector) : null;
      } catch (e) {
        console.error("Report Embedding error:", e);
      }
    }

    // 3. Register Knowledge Base
    const kbResult = await db.prepare(`
      INSERT INTO knowledge_base (inc_id, title, content, category, reg_id, reg_dt, mod_id, mod_dt, vector, status)
      VALUES (?, ?, ?, 'REPORT', ?, ?, ?, ?, ?, 'PENDING')
      ON CONFLICT(inc_id) DO UPDATE SET 
        content = excluded.content,
        mod_id = excluded.mod_id,
        mod_dt = excluded.mod_dt,
        vector = excluded.vector,
        status = 'PENDING'
      RETURNING id
    `).bind(incident_id, title, content, sender_id, now, sender_id, now, vectorArray).first()

    const knowledgeId = kbResult?.id;

    // 4. Sync to Vectorize Index
    const vectorIndex = c.env.WARROOM_INDEX;
    if (vector && vectorIndex && knowledgeId) {
      await vectorIndex.upsert([{
        id: `kn-${knowledgeId}`,
        values: vector,
        metadata: {
          title: title,
          incident_id: incident_id || '',
          category: 'REPORT'
        }
      }]);
      // Update status to SUCCESS
      await db.prepare("UPDATE knowledge_base SET status = 'SUCCESS' WHERE id = ?").bind(knowledgeId).run();
    }

    // 2-1. Save to reports table (CREATE IF NOT EXISTS for safety)
    try {
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS reports (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          inc_id TEXT NOT NULL,
          user_id TEXT,
          title TEXT,
          content TEXT,
          created_at TEXT
        )
      `).run()
      await db.prepare(`
        INSERT INTO reports (inc_id, user_id, title, content, created_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT DO NOTHING
      `).bind(normId, sender_id, title, content, now).run()
    } catch (e) {
      console.warn('[Submit] reports table insert failed:', e.message)
    }

    // 3. Find Reporting Lines (Superiors)
    const { results: superiors } = await db.prepare(
      "SELECT user_id, user_name FROM report_lines WHERE owner_id = ? ORDER BY hierarchy_level ASC"
    ).bind(sender_id).all()

    // 4. Distribute to Superiors (INBOX) - ONLY if they exist in users table
    for (const sup of superiors) {
      try {
        await db.prepare(`
          INSERT INTO inbox_items (
            user_id, type, sender_id, sender_name, 
            title, content, preview, urgency, 
            inc_id, folder, created_at, reg_dt
          ) SELECT ?, 'REPORT', ?, ?, ?, ?, ?, ?, ?, 'INBOX', ?, ?
          WHERE EXISTS (SELECT 1 FROM users WHERE employee_id = ?)
        `).bind(
          sup.user_id, sender_id, sender_name, 
          title, content, preview || content.substring(0, 100), urgency,
          incident_id, now, now, sup.user_id
        ).run()
      } catch (e) {
        console.warn(`[Submit-Warn] Failed to distribute to superior ${sup.user_id}:`, e.message);
      }
    }

    // 5. Save copy to Sender's SENT folder - ONLY if sender exists in users table
    try {
      await db.prepare(`
        INSERT INTO inbox_items (
          user_id, type, sender_id, sender_name, 
          title, content, preview, urgency, 
          inc_id, folder, created_at, reg_dt
        ) SELECT ?, 'REPORT', ?, ?, ?, ?, ?, ?, ?, 'SENT', ?, ?
        WHERE EXISTS (SELECT 1 FROM users WHERE employee_id = ?)
      `).bind(
        sender_id, sender_id, sender_name, 
        title, content, preview || content.substring(0, 100), urgency,
        incident_id, now, now, sender_id
      ).run()
    } catch (e) {
      console.warn(`[Submit-Warn] Failed to save copy to sender ${sender_id}:`, e.message);
    }

    return c.json({ 
      success: true, 
      recipient_count: superiors.length,
      superiors: superiors.map(s => s.user_name)
    })
  } catch (err) {
    console.error('Report submission failed:', err)
    return c.json({ error: err.message }, 500)
  }
})

// GET /reports/:incId - 저장된 보고서 조회 (링크 직접 열람용)
app.get('/reports/:inc_id', async (c) => {
  const rawId = c.req.param('inc_id')
  const normId = String(rawId)
  const db = c.env.DB

  // reports 테이블 없으면 생성
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        inc_id TEXT NOT NULL,
        user_id TEXT,
        title TEXT,
        content TEXT,
        created_at TEXT
      )
    `).run()
  } catch (e) { /* already exists */ }

  // 1순위: reports 테이블
  let report = null
  try {
    report = await db.prepare(
      "SELECT * FROM reports WHERE inc_id = ? ORDER BY id DESC LIMIT 1"
    ).bind(normId).first()
  } catch (e) {
    console.warn('[reports GET] reports table error:', e.message)
  }

  // 2순위: inbox_items REPORT 타입 (이전 완료처리 데이터 폴백)
  if (!report) {
    try {
      const inbox = await db.prepare(
        "SELECT * FROM inbox_items WHERE inc_id = ? AND type = 'REPORT' ORDER BY id DESC LIMIT 1"
      ).bind(normId).first()
      if (inbox) {
        report = {
          id: inbox.id,
          inc_id: inbox.inc_id || normId,
          user_id: inbox.sender_id,
          title: inbox.title,
          content: inbox.content,
          created_at: inbox.created_at || inbox.reg_dt
        }
      }
    } catch (e) {
      console.warn('[reports GET] inbox_items fallback error:', e.message)
    }
  }

  if (!report) return c.json({ error: 'Report not found' }, 404)

  // 추가: received_messages에서 원본 문자 조회
  let smsMessage = null
  try {
    const sms = await db.prepare(
      "SELECT message FROM received_messages WHERE inc_id = ? LIMIT 1"
    ).bind(normId).first()
    smsMessage = sms?.message || null
  } catch (e) { /* ignore */ }

  // users 테이블에서 조직/이름 정보 조회 (D1은 병렬 쿼리 미지원 → 순차 실행)
  let userName = null
  let userOrgPath = null
  if (report.user_id) {
    try {
      const u = await db.prepare(
        "SELECT name, company, honbu, team, part FROM users WHERE employee_id = ? LIMIT 1"
      ).bind(String(report.user_id)).first()

      if (u) {
        userName = u.name

        // 코드 → 조직명 변환 (순차 실행)
        const resolveCode = async (code) => {
          if (!code) return null
          const row = await db.prepare("SELECT name FROM organizations WHERE code = ? LIMIT 1").bind(code).first()
          return row?.name || code
        }

        const companyName = await resolveCode(u.company)
        const honbuName   = await resolveCode(u.honbu)
        const teamName    = await resolveCode(u.team)
        const partName    = await resolveCode(u.part)

        const parts = [companyName, honbuName, teamName, partName, u.name].filter(Boolean)
        userOrgPath = parts.join(' / ')
      }
    } catch (e) {
      console.warn('[reports] user org lookup failed:', e.message)
    }
  }

  // 추가: 유사도(similarity_score) 조회
  let similarity = null
  try {
    const insight = await db.prepare(
      "SELECT similarity_score FROM autopilot_insight WHERE inc_id = ? LIMIT 1"
    ).bind(normId).first()
    similarity = insight?.similarity_score || null
  } catch (e) { /* ignore */ }

  return c.json({ report: { ...report, sms_message: smsMessage, user_name: userName, user_org_path: userOrgPath, similarity } })
})

app.post('/inbox', async (c) => {
  const db = c.env.DB
  const body = await c.req.json()
  const { 
    user_id, type, sender_id, sender_name, 
    title, content, preview, urgency, 
    inc_id, action_link, folder = 'INBOX'
  } = body
  const now = getKst()

  if (!user_id || !type || !title) {
    return c.json({ error: 'user_id, type, and title are required' }, 400)
  }

  const result = await db.prepare(`
    INSERT INTO inbox_items (
      user_id, type, sender_id, sender_name, 
      title, content, preview, urgency, 
      inc_id, action_link, created_at, 
      reg_id, reg_dt, mod_id, mod_dt
    ) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    WHERE EXISTS (SELECT 1 FROM users WHERE employee_id = ?)
  `).bind(
    user_id, type, sender_id || null, sender_name || 'System',
    title, content || null, preview || null, urgency || 'NORMAL',
    inc_id || null, action_link || null, now,
    'SYSTEM', now, 'SYSTEM', now,
    user_id
  ).run()

  return c.json({ status: 'success', id: result.meta.last_row_id })
})

app.patch('/inbox/:id/read', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const now = getKst()

  await db.prepare("UPDATE inbox_items SET is_read = 1, mod_dt = ? WHERE id = ?")
    .bind(now, id).run()
    
  return c.json({ status: 'success' })
})

app.delete('/inbox/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')

  await db.prepare("DELETE FROM inbox_items WHERE id = ?").bind(id).run()
  
  return c.json({ status: 'success' })
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

    console.log(`[DO] WebSocket Upgrade: ${request.url}`);
    const [client, server] = new WebSocketPair();
    // Non-blocking handshake setup
    this.handleSession(server);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async handleSession(webSocket) {
    webSocket.accept();
    console.log("[DO] WebSocket Accepted");
    
    // Initial session setup - track visibility (assume visible on connect)
    this.sessions.set(webSocket, { online: true, visible: true });

    webSocket.addEventListener("message", async (msg) => {
      try {
        if (typeof msg.data !== "string") {
          console.warn(`[DO] [${this.state.id.toString()}] Received binary/non-string message, ignoring.`);
          return;
        }
        const data = JSON.parse(msg.data);
        console.log(`[DO] [${this.state.id.toString()}] Incoming event: ${data.type}`);
        await this.onMessage(webSocket, data);
      } catch (err) {
        console.error(`[DO] [${this.state.id.toString()}] WebSocket Message Parse Error:`, err.message, "Raw Content:", String(msg.data).slice(0, 500));
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
        session.incident_id = data.incident_id; // Track which room
        session.visible = true;                 // Assume visible on join
        console.log(`[DO] [${this.state.id.toString()}] User JOIN: ${data.name} (${data.user_id})`);
        
        // 🚀 NEW: Auto-update status to 'INC_002' when a user joins the warroom
        if (data.user_id && data.incident_id) {
          this.state.waitUntil((async () => {
            try {
              const now = getKst();
              await this.env.DB.prepare(`
                INSERT INTO incident_assignments (user_id, inc_id, status, assigned_at, updated_at, reg_id, reg_dt, mod_id, mod_dt)
                VALUES (?, ?, 'INC_002', ?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id, inc_id) 
                DO UPDATE SET status = 'INC_002', updated_at = ?, mod_dt = ?, mod_id = ?
              `).bind(
                data.user_id, data.incident_id, now, now, data.user_id, now, data.user_id, now,
                now, now, data.user_id
              ).run();

              // 🚀 NEW: Also update incidents table status to 'INC_002'
              await this.env.DB.prepare("UPDATE incidents SET status = 'INC_002', updated_at = ?, mod_dt = ?, mod_id = ? WHERE inc_id = ?")
                .bind(now, now, data.user_id || 'SYSTEM', data.incident_id).run();

              console.log(`[DO] [${data.incident_id}] Status updated to 'INC_002' for joiner: ${data.user_id}`);
            } catch (e) {
              console.error("[DO] JOIN Status Update Error:", e);
            }
          })());
        }

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

        // ✅ read_count: 온라인 세션이 아닌 실제 등록 참여자 수 기준
        let initialReadCount = 0;
        try {
          const memberCount = await db.prepare(
            "SELECT COUNT(DISTINCT user_id) as cnt FROM incident_assignments WHERE inc_id = ?"
          ).bind(String(data.incident_id)).first();
          initialReadCount = Math.max(0, (memberCount?.cnt || 0) - 1); // 발신자 제외
        } catch (_) {
          initialReadCount = Math.max(0, this.sessions.size - 1); // fallback
        }

        await db.prepare(
          "INSERT INTO warroom_chats (inc_id, seq, sender, role, type, text, timestamp, reg_id, reg_dt, mod_id, mod_dt, parent_seq, reactions, read_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).bind(
          data.incident_id, seq, data.sender, data.role || 'user', data.msg_type || 'user', data.text, now, data.sender, now, data.sender, now,
          data.reply_to || null,
          JSON.stringify({}),
          initialReadCount
        ).run();

        // 2. Broadcast
        const initialUnread = initialReadCount;
        const broadcastMsg = {
          type: "CHAT_MESSAGE",
          msg_id: `${data.incident_id}_${seq}`,
          seq: seq,
          incident_id: data.incident_id,
          sender: data.sender,
          sender_name: data.name || data.sender,
          role: data.role,
          text: data.text,
          timestamp: now,
          parent_seq: data.reply_to || null,
          reactions: {},
          read_count: initialUnread

        };
        console.log(`[DO] [${this.state.id.toString()}] CHAT_SEND from ${data.sender}: ${data.text.slice(0, 50)}...`);
        this.broadcast(broadcastMsg);

        // 3. Web Push: Send to warroom members who are NOT currently present
        this.state.waitUntil((async () => {
          try {
            const db = this.env.DB;
            const incId = data.incident_id;
            
            // Get all active user_ids in this DO session (visible in room)
            const onlineVisibleUserIds = Array.from(this.sessions.values())
              .filter(s => s.user_id && s.visible)
              .map(s => s.user_id);
            
            // Get all room members from D1 (incident_assignments)
            const { results: members } = await db.prepare(`
              SELECT DISTINCT user_id FROM incident_assignments WHERE inc_id = ?
            `).bind(String(incId)).all();
            
            // Get all push subscriptions for members NOT currently in the room
            const absentUserIds = members
              .map(m => m.user_id)
              .filter(uid => uid !== data.sender && !onlineVisibleUserIds.includes(uid));

            if (absentUserIds.length > 0) {
              const placeholders = absentUserIds.map(() => '?').join(',');
              const { results: subs } = await db.prepare(`
                SELECT * FROM push_subscriptions WHERE user_id IN (${placeholders})
              `).bind(...absentUserIds).all();

              const pushPayload = {
                title: `[S-Guard] 새 메시지 (${data.name || data.sender})`,
                body: data.text,
                inc_id: String(incId),
                tag: `chat-${incId}`, 
                priority: 1,           
                url: `/#/chat/${incId}`  
              };

              console.log('[DO-Push] Sending payload:', JSON.stringify(pushPayload));

              for (const sub of subs) {
                try {
                  // Use the global sendWebPush helper (consistent with SMS alerts)
                  const response = await sendWebPush(
                    sub.endpoint, sub.p256dh, sub.auth,
                    JSON.stringify(pushPayload),
                    this.env.VAPID_PUBLIC_KEY,
                    this.env.VAPID_PRIVATE_KEY,
                    'mailto:admin@chokerslab.store'
                  );
                  
                  if (response.status === 410 || response.status === 404) {
                    await db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(sub.endpoint).run();
                  }
                } catch (pe) {
                  console.error('[DO-Push] Chat push failed:', pe.message);
                }
              }
            }
          } catch (e) {
            console.error('[DO] Chat push trigger error:', e.message);
          }
        })());

        // 4. AI Indexing (Background task to avoid blocking)
        this.state.waitUntil((async () => {
          try {
            const ai = this.env.AI;
            const index = this.env.WARROOM_INDEX;
            if (ai && index && data.text.length > 5) {
              const { data: embeddings } = await ai.run('@cf/baai/bge-base-en-v1.5', { text: [data.text] });
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
              "SELECT wc.sender, wc.text, u.name as sender_name FROM warroom_chats wc LEFT JOIN users u ON wc.sender = u.employee_id WHERE wc.inc_id = ? ORDER BY wc.seq DESC LIMIT 50"
            ).bind(data.incident_id).all();
            
            if (chats.results.length === 0) {
              if (kv) await kv.delete(lockKey);
              return;
            }
            
            const chatLog = chats.results.reverse().map(c => `${c.sender_name || c.sender}: ${c.text}`).join("\n");
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
          // Decrement read_count in D1 — guard: only if this user hasn't already read
          await db.prepare("UPDATE warroom_chats SET read_count = CASE WHEN read_count > 0 THEN read_count - 1 ELSE 0 END WHERE inc_id = ? AND seq = ?")
            .bind(data.incident_id, data.seq).run();
          
          // Fetch actual updated value to broadcast (prevents client-side -1 drift)
          const updated = await db.prepare("SELECT read_count FROM warroom_chats WHERE inc_id = ? AND seq = ?")
            .bind(data.incident_id, data.seq).first();
          
          this.broadcast({
            type: "READ_UPDATE",
            incident_id: data.incident_id,
            seq: data.seq,
            user_id: data.user_id,
            read_count: updated?.read_count ?? 0  // 실제 DB 값을 broadcast
          });
        })());
        break;

      case "TYPING_START":
        this.broadcast({ type: "TYPING", user_id: data.user_id, name: data.name, is_typing: true }, ws);
        break;

      case "TYPING_STOP":
        this.broadcast({ type: "TYPING", user_id: data.user_id, name: data.name, is_typing: false }, ws);
        break;
      
      // 🗨️ PRESENCE: Page Visibility API integration
      case "PAGE_VISIBLE":
        session.visible = true;
        break;

      case "PAGE_HIDDEN":
        session.visible = false;
        break;

      case "SET_ANNOUNCEMENT": {
        const nowAnnounce = getKst();
        this.announcement = {
          seq: data.seq,
          sender: data.sender,
          text: data.text,
          timestamp: nowAnnounce
        };
        console.log(`[DO] [${this.state.id.toString()}] SET_ANNOUNCEMENT by ${data.sender}: ${data.text.slice(0, 50)}...`);
        // Sync to D1 warroom_list (as leader_summary for now)
        this.state.waitUntil((async () => {
          try {
            await this.env.DB.prepare("UPDATE warroom_list SET leader_summary = ?, mod_dt = ? WHERE inc_id = ?")
              .bind(this.announcement.text, nowAnnounce, data.incident_id).run();
          } catch (e) {
            console.error("[DO] Announcement Sync Error:", e);
          }
        })());
        this.broadcast({ type: "ANNOUNCEMENT_UPDATE", announcement: this.announcement });
        break;
      }

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

// ── S-callert: PDS 장애 자동 호출 관리 ──────────────────────────────────────────

// 1. 전략 목록 조회 (테이블 없으면 자동 생성)
app.get('/scallert/strategies', async (c) => {
  const db = c.env.DB;
  try {
    // 테이블 없을 경우 자동 생성
    await db.prepare(`CREATE TABLE IF NOT EXISTS TB_SCL_STRATEGY_MST (
      STRATEGY_ID TEXT PRIMARY KEY, STRATEGY_NM TEXT NOT NULL, STRATEGY_CONT TEXT NOT NULL DEFAULT '1',
      APPLY_START_DT TEXT, APPLY_END_DT TEXT, MAX_CALL_CNT INTEGER NOT NULL DEFAULT 3,
      USE_YN TEXT NOT NULL DEFAULT 'Y', REG_ID TEXT, REG_DT TEXT, MOD_ID TEXT, MOD_DT TEXT
    )`).run();
    await db.prepare(`CREATE TABLE IF NOT EXISTS TB_SCL_TARGET_INFO (
      SEQ_NO INTEGER PRIMARY KEY AUTOINCREMENT, STRATEGY_ID TEXT NOT NULL,
      EMP_ID TEXT NOT NULL, EMP_NM TEXT NOT NULL, MOBILE_NO TEXT NOT NULL,
      SORT_ORD INTEGER DEFAULT 0, USE_YN TEXT NOT NULL DEFAULT 'Y',
      REG_ID TEXT, REG_DT TEXT, MOD_ID TEXT, MOD_DT TEXT
    )`).run();
    await db.prepare(`CREATE TABLE IF NOT EXISTS TB_SCL_CALL_HIST (
      LOG_ID INTEGER PRIMARY KEY AUTOINCREMENT, STRATEGY_ID TEXT, INC_ID TEXT, IGW_TXN_ID TEXT,
      EMP_ID TEXT, EMP_NM TEXT, MOBILE_NO TEXT, ATTEMPT_SEQ INTEGER DEFAULT 1,
      PDS_RESULT_CD TEXT, CALL_DT TEXT, REG_DT TEXT
    )`).run();

    const { results } = await db.prepare("SELECT * FROM TB_SCL_STRATEGY_MST ORDER BY STRATEGY_ID ASC").all();
    return c.json(results || []);
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});

// 1.5 전략 등록
app.post('/scallert/strategies', async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();
  const now = getKst();
  const strategyId = 'S' + Math.random().toString(36).substring(2, 6).toUpperCase();

  try {
    await db.prepare(`
      INSERT INTO TB_SCL_STRATEGY_MST (
        STRATEGY_ID, STRATEGY_NM, STRATEGY_CONT, APPLY_START_DT, APPLY_END_DT, MAX_CALL_CNT, USE_YN, REG_ID, REG_DT, MOD_ID, MOD_DT
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      strategyId, body.strategy_nm, body.strategy_cont || '1', body.apply_start_dt, body.apply_end_dt, 
      body.max_call_cnt || 3, body.use_yn || 'Y', 
      body.reg_id || 'SYSTEM', now, body.reg_id || 'SYSTEM', now
    ).run();
    return c.json({ success: true, strategy_id: strategyId });
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});

// 2. 전략 수정
app.patch('/scallert/strategies/:id', async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const body = await c.req.json();
  const now = getKst();

  try {
    await db.prepare(`
      UPDATE TB_SCL_STRATEGY_MST 
      SET STRATEGY_NM = ?, STRATEGY_CONT = ?, APPLY_START_DT = ?, APPLY_END_DT = ?, MAX_CALL_CNT = ?, USE_YN = ?, MOD_ID = ?, MOD_DT = ?
      WHERE STRATEGY_ID = ?
    `).bind(
      body.strategy_nm, body.strategy_cont, body.apply_start_dt, body.apply_end_dt, 
      body.max_call_cnt, body.use_yn, body.mod_id || 'SYSTEM', now, id
    ).run();
    return c.json({ success: true });
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});

// 3. 담당자 목록 조회
app.get('/scallert/strategies/:id/targets', async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  try {
    const { results } = await db.prepare("SELECT * FROM TB_SCL_TARGET_INFO WHERE STRATEGY_ID = ? ORDER BY SORT_ORD ASC").bind(id).all();
    return c.json(results || []);
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});

// 4. 담당자 추가
app.post('/scallert/strategies/:id/targets', async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const body = await c.req.json();
  const now = getKst();

  try {
    const res = await db.prepare(`
      INSERT INTO TB_SCL_TARGET_INFO (STRATEGY_ID, EMP_ID, EMP_NM, MOBILE_NO, SORT_ORD, REG_ID, REG_DT)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(id, body.emp_id, body.emp_nm, body.mobile_no, body.sort_ord || 0, body.mod_id || 'SYSTEM', now).run();
    return c.json({ success: true, seq_no: res.meta.last_row_id });
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});

// 5. 담당자 수정
app.patch('/scallert/targets/:seq', async (c) => {
  const db = c.env.DB;
  const seq = c.req.param('seq');
  const body = await c.req.json();
  const now = getKst();

  try {
    await db.prepare(`
      UPDATE TB_SCL_TARGET_INFO 
      SET EMP_ID = ?, EMP_NM = ?, MOBILE_NO = ?, SORT_ORD = ?, MOD_ID = ?, MOD_DT = ?
      WHERE SEQ_NO = ?
    `).bind(body.emp_id, body.emp_nm, body.mobile_no, body.sort_ord || 0, body.mod_id || 'SYSTEM', now, seq).run();
    return c.json({ success: true });
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});

// 6. 담당자 삭제
app.delete('/scallert/targets/:seq', async (c) => {
  const db = c.env.DB;
  const seq = c.req.param('seq');
  try {
    await db.prepare("DELETE FROM TB_SCL_TARGET_INFO WHERE SEQ_NO = ?").bind(seq).run();
    return c.json({ success: true });
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});

// 7. 발신 이력 조회
app.get('/scallert/strategies/:id/history', async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const limit = c.req.query('limit') || 50;
  try {
    const { results } = await db.prepare(`
      SELECT h.*, t.EMP_NM as emp_nm, t.MOBILE_NO as mobile_no
      FROM TB_SCL_CALL_HIST h
      LEFT JOIN TB_SCL_TARGET_INFO t ON h.EMP_ID = t.EMP_ID
      WHERE h.STRATEGY_ID = ? 
      ORDER BY h.CALL_DT DESC LIMIT ?
    `).bind(id, limit).all();
    return c.json(results || []);
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});

// 8. IGW 이벤트 수신 (실제 발신 로직)
app.post('/scallert/igw-event', async (c) => {
  const db = c.env.DB;
  const igwSecret = c.req.header('x-igw-secret');
  
  // IGW 시크릿 검증 (Environment 변수 IGW_SECRET 사용)
  if (igwSecret !== c.env.IGW_SECRET && c.env.ENVIRONMENT === 'production') {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const payload = await c.req.json();
  const { igw_txn_id, strategy_id, event_type, inc_id, message, severity } = payload;

  if (!igw_txn_id || !strategy_id) {
    return c.json({ error: 'Missing required fields' }, 400);
  }

  if (event_type === 'RECOVER') {
    return c.json({ ok: true, skipped: true, reason: 'RECOVER' });
  }

  try {
    const now = getKst();
    const strategy = await db.prepare(`
      SELECT * FROM TB_SCL_STRATEGY_MST 
      WHERE STRATEGY_ID = ? 
        AND USE_YN = 'Y' 
        AND (APPLY_START_DT IS NULL OR APPLY_START_DT <= ?)
        AND (APPLY_END_DT IS NULL OR APPLY_END_DT >= ?)
    `).bind(strategy_id, now, now).first();
    
    if (!strategy) return c.json({ error: 'Active strategy not found or expired' }, 404);

    const { results: targets } = await db.prepare("SELECT * FROM TB_SCL_TARGET_INFO WHERE STRATEGY_ID = ? ORDER BY SORT_ORD ASC").bind(strategy_id).all();
    if (!targets || targets.length === 0) return c.json({ error: 'No targets' }, 404);
    const maxAttempts = strategy.MAX_CALL_CNT || 3;
    const callResults = [];

    for (let i = 1; i <= maxAttempts; i++) {
      const target = targets[(i - 1) % targets.length];
      
      // PDS API 호출 (Mock or Actual)
      let pdsStatus = 'SUCCESS'; 
      // 실제 환경에서는 fetch(c.env.PDS_API_URL, ...) 호출 로직 추가
      
      await db.prepare(`
        INSERT INTO TB_SCL_CALL_HIST (STRATEGY_ID, EMP_ID, ATTEMPT_SEQ, IGW_TXN_ID, PDS_RESULT_CD, CALL_DT, INC_ID, RAW_PAYLOAD, REG_ID, REG_DT)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(strategy_id, target.EMP_ID, i, igw_txn_id, pdsStatus, now, inc_id || null, JSON.stringify(payload), 'IGW_SYSTEM', now).run();

      callResults.push({ attempt: i, emp_id: target.EMP_ID, result: pdsStatus });
      if (pdsStatus === 'SUCCESS') break;
      await new Promise(r => setTimeout(r, 1000));
    }

    return c.json({ ok: true, details: callResults });
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});

// ── PDS API 설정 관리 ─────────────────────────────────────────────────────────

// 9. PDS Config 조회 (전략별)
app.get('/scallert/strategies/:id/config', async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  try {
    await db.prepare(`CREATE TABLE IF NOT EXISTS TB_SCL_PDS_CONFIG (
      CONFIG_ID    INTEGER PRIMARY KEY AUTOINCREMENT,
      STRATEGY_ID  TEXT NOT NULL,
      API_URL      TEXT NOT NULL DEFAULT '',
      API_METHOD   TEXT NOT NULL DEFAULT 'POST',
      API_HEADERS  TEXT DEFAULT '{}',
      API_PARAMS   TEXT DEFAULT '{}',
      TIMEOUT_SEC  INTEGER DEFAULT 10,
      USE_YN       TEXT NOT NULL DEFAULT 'Y',
      REG_ID TEXT, REG_DT TEXT, MOD_ID TEXT, MOD_DT TEXT
    )`).run();
    const row = await db.prepare("SELECT * FROM TB_SCL_PDS_CONFIG WHERE STRATEGY_ID = ? AND USE_YN = 'Y' ORDER BY CONFIG_ID DESC LIMIT 1").bind(id).first();
    return c.json(row || null);
  } catch (e) { return c.json({ error: e.message }, 500); }
});

// 10. PDS Config 저장 (upsert)
app.post('/scallert/strategies/:id/config', async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const body = await c.req.json();
  const now = getKst();
  try {
    await db.prepare(`CREATE TABLE IF NOT EXISTS TB_SCL_PDS_CONFIG (
      CONFIG_ID INTEGER PRIMARY KEY AUTOINCREMENT, STRATEGY_ID TEXT NOT NULL,
      API_URL TEXT NOT NULL DEFAULT '', API_METHOD TEXT NOT NULL DEFAULT 'POST',
      API_HEADERS TEXT DEFAULT '{}', API_PARAMS TEXT DEFAULT '{}',
      TIMEOUT_SEC INTEGER DEFAULT 10, USE_YN TEXT NOT NULL DEFAULT 'Y',
      REG_ID TEXT, REG_DT TEXT, MOD_ID TEXT, MOD_DT TEXT
    )`).run();

    const existing = await db.prepare("SELECT CONFIG_ID FROM TB_SCL_PDS_CONFIG WHERE STRATEGY_ID = ? ORDER BY CONFIG_ID DESC LIMIT 1").bind(id).first();
    if (existing) {
      await db.prepare(`UPDATE TB_SCL_PDS_CONFIG SET API_URL=?,API_METHOD=?,API_HEADERS=?,API_PARAMS=?,TIMEOUT_SEC=?,MOD_ID=?,MOD_DT=? WHERE CONFIG_ID=?`)
        .bind(body.api_url||'', body.api_method||'POST', JSON.stringify(body.api_headers||{}), JSON.stringify(body.api_params||{}),
              body.timeout_sec||10, body.reg_id||'SYSTEM', now, existing.CONFIG_ID).run();
      return c.json({ success: true, config_id: existing.CONFIG_ID });
    } else {
      const res = await db.prepare(`INSERT INTO TB_SCL_PDS_CONFIG (STRATEGY_ID,API_URL,API_METHOD,API_HEADERS,API_PARAMS,TIMEOUT_SEC,USE_YN,REG_ID,REG_DT,MOD_ID,MOD_DT) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(id, body.api_url||'', body.api_method||'POST', JSON.stringify(body.api_headers||{}), JSON.stringify(body.api_params||{}),
              body.timeout_sec||10, 'Y', body.reg_id||'SYSTEM', now, body.reg_id||'SYSTEM', now).run();
      return c.json({ success: true, config_id: res.meta.last_row_id });
    }
  } catch (e) { return c.json({ error: e.message }, 500); }
});

// 11. PDS 테스트 콜 실행
app.post('/scallert/strategies/:id/test-call', async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const body = await c.req.json();
  const now = getKst();
  const startMs = Date.now();

  // 설정 로드 (요청 body 우선, 없으면 DB)
  let apiUrl     = body.api_url;
  let apiMethod  = body.api_method || 'POST';
  let apiHeaders = body.api_headers || {};
  let apiParams  = body.api_params  || {};
  let timeoutSec = body.timeout_sec || 10;

  if (!apiUrl) {
    try {
      const cfg = await db.prepare("SELECT * FROM TB_SCL_PDS_CONFIG WHERE STRATEGY_ID = ? AND USE_YN = 'Y' ORDER BY CONFIG_ID DESC LIMIT 1").bind(id).first();
      if (cfg) {
        apiUrl     = cfg.API_URL;
        apiMethod  = cfg.API_METHOD || 'POST';
        apiHeaders = JSON.parse(cfg.API_HEADERS || '{}');
        apiParams  = JSON.parse(cfg.API_PARAMS  || '{}');
        timeoutSec = cfg.TIMEOUT_SEC || 10;
      }
    } catch {}
  }

  if (!apiUrl) return c.json({ error: 'API URL이 설정되지 않았습니다.' }, 400);

  let statusCode = 0, responseBody = '', success = false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutSec * 1000);
    const fetchOpts = {
      method: apiMethod,
      headers: { 'Content-Type': 'application/json', ...apiHeaders },
      signal: controller.signal,
    };
    if (apiMethod !== 'GET') fetchOpts.body = JSON.stringify(apiParams);
    const url = apiMethod === 'GET' && Object.keys(apiParams).length
      ? `${apiUrl}?${new URLSearchParams(apiParams).toString()}`
      : apiUrl;

    const res = await fetch(url, fetchOpts);
    clearTimeout(timer);
    statusCode = res.status;
    responseBody = await res.text();
    success = res.ok;
  } catch (e) {
    responseBody = e.name === 'AbortError' ? `Timeout (>${timeoutSec}s)` : e.message;
  }

  const elapsed = Date.now() - startMs;

  // 로그 저장
  try {
    await db.prepare(`CREATE TABLE IF NOT EXISTS TB_SCL_TEST_LOG (
      LOG_ID INTEGER PRIMARY KEY AUTOINCREMENT, STRATEGY_ID TEXT, API_URL TEXT,
      API_METHOD TEXT, REQ_PARAMS TEXT, STATUS_CODE INTEGER, RESPONSE_BODY TEXT,
      ELAPSED_MS INTEGER, SUCCESS TEXT, TESTED_BY TEXT, TESTED_AT TEXT
    )`).run();
    await db.prepare(`INSERT INTO TB_SCL_TEST_LOG (STRATEGY_ID,API_URL,API_METHOD,REQ_PARAMS,STATUS_CODE,RESPONSE_BODY,ELAPSED_MS,SUCCESS,TESTED_BY,TESTED_AT) VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .bind(id, apiUrl, apiMethod, JSON.stringify(apiParams), statusCode, responseBody.substring(0,2000), elapsed, success?'Y':'N', body.tested_by||'SYSTEM', now).run();
  } catch {}

  return c.json({ success, status_code: statusCode, response: responseBody, elapsed_ms: elapsed, tested_at: now });
});

// 12. 테스트 콜 로그 조회
app.get('/scallert/strategies/:id/test-logs', async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const limit = Number(c.req.query('limit') || 20);
  try {
    await db.prepare(`CREATE TABLE IF NOT EXISTS TB_SCL_TEST_LOG (
      LOG_ID INTEGER PRIMARY KEY AUTOINCREMENT, STRATEGY_ID TEXT, API_URL TEXT,
      API_METHOD TEXT, REQ_PARAMS TEXT, STATUS_CODE INTEGER, RESPONSE_BODY TEXT,
      ELAPSED_MS INTEGER, SUCCESS TEXT, TESTED_BY TEXT, TESTED_AT TEXT
    )`).run();
    const { results } = await db.prepare("SELECT * FROM TB_SCL_TEST_LOG WHERE STRATEGY_ID = ? ORDER BY LOG_ID DESC LIMIT ?").bind(id, limit).all();
    return c.json(results || []);
  } catch (e) { return c.json({ error: e.message }, 500); }
});

// ── WebSocket Upgrade Route ──────────────────────────────────────────────────
app.get('/warroom/ws/:id', async (c) => {
  const id = c.req.param('id');
  const doId = c.env.WARROOM_DO.idFromName(id);
  const room = c.env.WARROOM_DO.get(doId);
  return room.fetch(c.req.raw);
});

export default app
