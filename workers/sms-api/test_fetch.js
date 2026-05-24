fetch('http://localhost:8787/warroom/rooms').then(r => r.json()).then(d => {
  console.log("Total length:", d.rooms.length);
  const open = d.rooms.filter(r => r.status === 'INC_001');
  const active = d.rooms.filter(r => r.status === 'INC_002');
  console.log("Open:", open.length);
  console.log("Active:", active.length);
  console.log("Open items:");
  open.slice(0, 5).forEach(r => console.log(r.code, r.status, "message_count:", r.message_count));
});
