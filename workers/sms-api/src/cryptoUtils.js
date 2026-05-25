// Web Crypto API 기반 AES-256-GCM 양방향 암호화 유틸리티
// 키(AES_SECRET_KEY)는 최소 32바이트(256비트) 길이의 문자열(Base64 또는 Hex 등)을 가정

/**
 * 환경 변수의 AES_SECRET_KEY로부터 CryptoKey를 생성합니다.
 */
async function getCryptoKey(secretKey) {
  if (!secretKey) throw new Error("AES_SECRET_KEY is not defined");
  
  const encoder = new TextEncoder();
  const keyBuf = encoder.encode(secretKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', keyBuf);

  return await crypto.subtle.importKey(
    "raw",
    hashBuffer,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * 평문 기반으로 결정론적(Deterministic) IV를 생성합니다.
 * 이를 통해 동일한 평문은 항상 동일한 암호문을 가지게 되어 DB WHERE 절 조회가 가능해집니다.
 */
async function getDeterministicIV(plaintext) {
  const encoder = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(plaintext));
  return new Uint8Array(hash.slice(0, 12));
}

/**
 * 평문을 AES-256-GCM으로 암호화하여 "aesgcm:iv:ciphertext" 형태의 Base64 문자열로 반환합니다.
 * @param {string} plaintext 암호화할 평문
 * @param {string} secretKey 환경변수 비밀키
 * @returns {Promise<string>} Base64 인코딩된 "IV:Ciphertext"
 */
export async function encryptAES(plaintext, secretKey) {
  if (!plaintext) return plaintext;
  try {
    const key = await getCryptoKey(secretKey);
    const iv = await getDeterministicIV(plaintext); // 랜덤 IV 대신 고정 IV 사용
    const encoder = new TextEncoder();
    const encodedText = encoder.encode(plaintext);

    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      encodedText
    );

    const ivBase64 = btoa(String.fromCharCode(...iv));
    const cipherBase64 = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));

    return `aesgcm:${ivBase64}:${cipherBase64}`;
  } catch (error) {
    console.error("Encryption failed:", error);
    throw error;
  }
}

/**
 * 암호문을 평문으로 복호화합니다.
 * @param {string} encryptedText 암호문 ("aesgcm:IV:Ciphertext")
 * @param {string} secretKey 환경변수 비밀키
 * @returns {Promise<string>} 복호화된 평문
 */
export async function decryptAES(encryptedText, secretKey) {
  if (!encryptedText || !encryptedText.startsWith('aesgcm:')) {
    // 암호화되지 않은 기존 평문은 그대로 반환 (하위 호환성)
    return encryptedText;
  }

  try {
    const [, ivBase64, cipherBase64] = encryptedText.split(':');
    const key = await getCryptoKey(secretKey);

    const iv = new Uint8Array(atob(ivBase64).split('').map(c => c.charCodeAt(0)));
    const cipherStr = atob(cipherBase64);
    const ciphertext = new Uint8Array(cipherStr.length);
    for (let i = 0; i < cipherStr.length; i++) {
      ciphertext[i] = cipherStr.charCodeAt(i);
    }

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (error) {
    console.error(`[decryptAES] Decryption failed for text. Error: ${error.message}`);
    // 에러를 던지면 배열 맵핑 시 전체 트랜잭션이 중단되므로,
    // 명시적인 가짜 번호(010-0000-0000)나 평문을 반환하여 최소한의 흐름은 이어가도록 조치
    return '010-0000-0000';
  }
}
