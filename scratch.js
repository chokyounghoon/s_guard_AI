const crypto = require('crypto');

async function getCryptoKey(secretKey) {
  const hash = crypto.createHash('sha256').update(secretKey).digest();
  return crypto.webcrypto.subtle.importKey(
    "raw",
    hash,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

async function getDeterministicIV(plaintext) {
  const hash = crypto.createHash('sha256').update(plaintext).digest();
  return new Uint8Array(hash.slice(0, 12));
}

async function encryptAES(plaintext, secretKey) {
  const key = await getCryptoKey(secretKey);
  const iv = await getDeterministicIV(plaintext);
  const encodedText = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.webcrypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encodedText
  );

  const ivBase64 = btoa(String.fromCharCode(...iv));
  const cipherBase64 = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));

  return `aesgcm:${ivBase64}:${cipherBase64}`;
}

async function test() {
  const DEFAULT_AES_KEY = 'sguard-default-256-bit-secret-key-12345!';
  const cipher = await encryptAES("010-2548-8884", DEFAULT_AES_KEY);
  console.log(cipher);
  console.log(cipher.replace(/[^0-9]/g, ''));
}

test();
