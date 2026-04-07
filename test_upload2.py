import urllib.request
import ssl

context = ssl._create_unverified_context()
url = "https://sguardai.khcho0421.workers.dev/sms/convert-multimodal"

boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
body = (
    f'--{boundary}\r\n'
    f'Content-Disposition: form-data; name="file"; filename="test.txt"\r\n'
    f'Content-Type: text/plain\r\n\r\n'
    f'hello\r\n'
    f'--{boundary}--\r\n'
).encode('utf-8')

req = urllib.request.Request(url, data=body, method='POST')
req.add_header('Content-type', f'multipart/form-data; boundary={boundary}')

try:
    response = urllib.request.urlopen(req, context=context)
    print("Status:", response.status)
    print("Body:", response.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print("Status:", e.code)
    print("Body:", e.read().decode('utf-8'))
