const fs = require('fs');
const content = fs.readFileSync('/Users/khcho/work_antigravity/s_guard_AI/frontend/src/pages/ChatSummaryPage.jsx', 'utf8');
let stack = [];
let i = 0;
while (i < content.length) {
  let char = content[i];
  if (char === '/' && content[i+1] === '/') {
    while (i < content.length && content[i] !== '\n') i++;
  } else if (char === '/' && content[i+1] === '*') {
    i += 2;
    while (i < content.length && !(content[i] === '*' && content[i+1] === '/')) i++;
    i += 2;
  } else if (char === '"' || char === "'" || char === '`') {
    let quote = char;
    i++;
    while (i < content.length && content[i] !== quote) {
      if (content[i] === '\\') i++;
      i++;
    }
    i++;
  } else if (char === '{') {
    stack.push({ char: '{', line: content.substring(0, i).split('\n').length });
    i++;
  } else if (char === '}') {
    if (stack.length > 0 && stack[stack.length - 1].char === '{') {
      stack.pop();
    } else {
      console.log('Extra } at line ' + content.substring(0, i).split('\n').length);
    }
    i++;
  } else {
    i++;
  }
}
if (stack.length > 0) {
  console.log('Unclosed braces:');
  stack.forEach(s => console.log(`${s.char} at line ${s.line}`));
}
