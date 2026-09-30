const fs = require('fs');
const path = require('path');
const vm = require('vm');

function getFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat && stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'scratch') {
        results = results.concat(getFiles(full));
      }
    } else if (file.endsWith('.js')) {
      results.push(full);
    }
  });
  return results;
}

const jsFiles = getFiles('.');
console.log('Fast-checking syntax for', jsFiles.length, 'JS files...');
let errors = 0;
jsFiles.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  try {
    new vm.Script(content, { filename: f });
  } catch (err) {
    console.error('Syntax error in:', f, err.message);
    errors++;
  }
});
console.log('Done! Total errors:', errors);
