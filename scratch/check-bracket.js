const fs = require('fs');

const code = fs.readFileSync('admin/js/admin-add-product.js', 'utf8');
const lines = code.split('\n');

let stack = [];
let inComment = false;

for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
  const line = lines[lineIdx];
  for (let cIdx = 0; cIdx < line.length; cIdx++) {
    const ch = line[cIdx];
    const next = line[cIdx + 1];
    if (inComment) {
      if (ch === '*' && next === '/') {
        inComment = false;
        cIdx++;
      }
      continue;
    }
    if (ch === '/' && next === '*') {
      inComment = true;
      cIdx++;
      continue;
    }
    if (ch === '/' && next === '/') {
      break; // single line comment
    }
    // simple string check
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      cIdx++;
      while (cIdx < line.length) {
        if (line[cIdx] === '\\') {
          cIdx += 2;
          continue;
        }
        if (line[cIdx] === quote) break;
        cIdx++;
      }
      continue;
    }

    if (ch === '{' || ch === '(' || ch === '[') {
      stack.push({ ch, line: lineIdx + 1, col: cIdx + 1 });
    } else if (ch === '}' || ch === ')' || ch === ']') {
      if (stack.length === 0) {
        console.log(`Extra closing '${ch}' at line ${lineIdx + 1}, col ${cIdx + 1}`);
      } else {
        const top = stack.pop();
        const expected = top.ch === '{' ? '}' : (top.ch === '(' ? ')' : ']');
        if (ch !== expected) {
          console.log(`Mismatch at line ${lineIdx + 1}, col ${cIdx + 1}: found '${ch}', expected '${expected}' opened at line ${top.line}, col ${top.col}`);
        }
      }
    }
  }
}

console.log(`Finished checking. Remaining open tokens count: ${stack.length}`);
stack.forEach(t => console.log(`Unclosed '${t.ch}' from line ${t.line}, col ${t.col}`));

