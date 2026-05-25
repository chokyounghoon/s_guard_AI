const crypto = require('crypto');

async function test() {
  const DEFAULT_AES_KEY = 'sguard-default-256-bit-secret-key-12345!';
  const plaintext = "010-2548-8884";

  // getCryptoKey
  const hash = crypto.createHash('sha256').update(DEFAULT_AES_KEY).digest();
  const key = await crypto.webcrypto.subtle.importKey(
    "raw",
    hash,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );

  // getDeterministicIV
  const ptHash = crypto.createHash('sha256').update(plaintext).digest();
  const iv = new Uint8Array(ptHash.slice(0, 12));

  // encrypt
  const encodedText = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.webcrypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encodedText
  );

  const ivBase64 = btoa(String.fromCharCode(...iv));
  const cipherBase64 = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));

  const res = `aesgcm:${ivBase64}:${cipherBase64}`;
  console.log("Encrypted string:", res);
  
  const errorMsg = `[DECRYPT_ERROR: OperationError] ` + res;
  const extractedDigits = errorMsg.replace(/[^0-9]/g, '');
  console.log("Extracted digits:", extractedDigits);
}

test();
