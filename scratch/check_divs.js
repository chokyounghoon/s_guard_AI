const fs = require('fs');
const content = fs.readFileSync('frontend/src/pages/DashboardPage.jsx', 'utf8');
const lines = content.split('\n');
const stack = [];
lines.forEach((line, i) => {
  // Match opening <div but NOT self-closing <div ... />
  // This is tricky with regex. I'll use a more surgical approach.
  const tokens = line.match(/<div|<\/div/g) || [];
  tokens.forEach(token => {
    if (token === '<div') {
      // Check if this specific div on this line is self-closing
      // We'll search from the position of this <div to the next >
      const lineSuffix = line.slice(line.indexOf('<div')); 
      // This is still fragile. Let's try something else.
      if (line.includes('/>') && !line.includes('</div')) {
         // Probably self-closing
      } else {
         stack.push(i + 1);
      }
    } else {
      if (stack.length > 0) {
        stack.pop();
      }
    }
  });
});
console.log(`Unclosed <div> tags from lines: ${stack.join(', ')}`);
