import base64
import hashlib
from Crypto.Cipher import AES

key_str = 'sguard-default-256-bit-secret-key-12345!'
key = hashlib.sha256(key_str.encode('utf-8')).digest()

def test_number(phone):
    plaintext = phone.encode('utf-8')
    iv = hashlib.sha256(plaintext).digest()[:12]
    
    cipher = AES.new(key, AES.MODE_GCM, nonce=iv)
    ciphertext, tag = cipher.encrypt_and_digest(plaintext)
    
    final_ciphertext = ciphertext + tag
    
    iv_b64 = base64.b64encode(iv).decode('utf-8')
    cipher_b64 = base64.b64encode(final_ciphertext).decode('utf-8')
    
    res = f"aesgcm:{iv_b64}:{cipher_b64}"
    
    digits = ''.join(filter(str.isdigit, res))
    print(f"Phone: {phone}")
    print(f"Ciphertext Base64: {cipher_b64}")
    print(f"Digits extracted: {digits}")

test_number("010-1234-4567")
test_number("010-2548-8884")
