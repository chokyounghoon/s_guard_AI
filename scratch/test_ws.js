const WebSocket = require('ws');

const ws = new WebSocket('wss://sguardai.khcho0421.workers.dev/warroom/ws/20260517142831886');

ws.on('open', () => {
  console.log('Connected');
  ws.send(JSON.stringify({
    type: "JOIN",
    user_id: "EMP-1234",
    name: "Tester",
    incident_id: "20260517142831886"
  }));
  
  setTimeout(() => {
    console.log('Sending CHAT_SEND');
    ws.send(JSON.stringify({
      type: "CHAT_SEND",
      incident_id: "20260517142831886",
      sender: "EMP-1234",
      name: "Tester",
      role: "Manager",
      msg_type: "user",
      text: "hello world"
    }));
  }, 1000);
});

ws.on('message', (data) => {
  console.log('Received:', data.toString());
});

ws.on('error', (err) => {
  console.error('WS Error:', err);
});
