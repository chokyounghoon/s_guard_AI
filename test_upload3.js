const fs = require('fs');

async function test() {
  const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
  const body = Buffer.concat([
    Buffer.from('--' + boundary + '\r\n'),
    Buffer.from('Content-Disposition: form-data; name="file"; filename="test.txt"\r\n'),
    Buffer.from('Content-Type: text/plain\r\n\r\n'),
    Buffer.from('hello\r\n'),
    Buffer.from('--' + boundary + '--\r\n')
  ]);

  const res = await fetch('https://sguardai.khcho0421.workers.dev/sms/convert-multimodal', {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    },
    body: body
  });

  console.log(res.status);
  console.log(await res.text());
}

test();
