const fs = require('fs');

const code = fs.readFileSync('admin/js/admin-order-details.js', 'utf8');
const lines = code.split('\n');

const braceStack = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  for (let c = 0; c < line.length; c++) {
    const char = line[c];
    if (char === '{') {
      braceStack.push({ line: i + 1, col: c + 1 });
    } else if (char === '}') {
      if (braceStack.length === 0) {
        console.log('Extra } at line', i + 1, 'col', c + 1);
      } else {
        braceStack.pop();
      }
    }
  }
}

console.log('Unclosed { count:', braceStack.length);
if (braceStack.length > 0) {
  console.log('Last unclosed { lines:', braceStack.slice(-5));
}
