import base64
import hashlib
from Crypto.Cipher import AES

def test():
    key_str = 'sguard-default-256-bit-secret-key-12345!'
    key = hashlib.sha256(key_str.encode('utf-8')).digest()
    
    plaintext = "010-2548-8884".encode('utf-8')
    iv = hashlib.sha256(plaintext).digest()[:12]
    
    cipher = AES.new(key, AES.MODE_GCM, nonce=iv)
    ciphertext, tag = cipher.encrypt_and_digest(plaintext)
    
    # Web Crypto AES-GCM appends the tag to the ciphertext
    final_ciphertext = ciphertext + tag
    
    iv_b64 = base64.b64encode(iv).decode('utf-8')
    cipher_b64 = base64.b64encode(final_ciphertext).decode('utf-8')
    
    res = f"aesgcm:{iv_b64}:{cipher_b64}"
    print(res)
    
    digits = ''.join(filter(str.isdigit, res))
    print("Digits:", digits)

test()
