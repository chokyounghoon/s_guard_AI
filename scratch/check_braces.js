const fs = require('fs');
const content = fs.readFileSync('/Users/khcho/work_antigravity/s_guard_AI/frontend/src/pages/ChatSummaryPage.jsx', 'utf8');
let braceStack = [];
let parenStack = [];
let lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  for (let j = 0; j < line.length; j++) {
    let char = line[j];
    if (char === '{') braceStack.push({ line: i + 1, col: j + 1 });
    else if (char === '}') {
      if (braceStack.length === 0) console.log(`Extra } at L${i + 1}:C${j + 1}`);
      else braceStack.pop();
    }
    else if (char === '(') parenStack.push({ line: i + 1, col: j + 1 });
    else if (char === ')') {
      if (parenStack.length === 0) console.log(`Extra ) at L${i + 1}:C${j + 1}`);
      else parenStack.pop();
    }
  }
}

if (braceStack.length > 0) {
  console.log('Unclosed { at:');
  braceStack.forEach(b => console.log(`L${b.line}:C${b.col}`));
}
if (parenStack.length > 0) {
  console.log('Unclosed ( at:');
  parenStack.forEach(p => console.log(`L${p.line}:C${p.col}`));
}
