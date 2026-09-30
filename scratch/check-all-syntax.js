const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dirsToCheck = ['js', 'admin/js', 'api'];
const errors = [];
let checked = 0;

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      walk(full);
    } else if (item.endsWith('.js')) {
      checked++;
      const code = fs.readFileSync(full, 'utf8');
      try {
        new vm.Script(code, { filename: full });
      } catch (err) {
        errors.push({ file: full, error: err.message, stack: err.stack });
      }
    }
  }
}

for (const d of dirsToCheck) {
  walk(d);
}

console.log(`Checked ${checked} files.`);
if (errors.length === 0) {
  console.log('ALL FILES PASSED SYNTAX CHECK WITH 0 ERRORS!');
} else {
  console.error(`FAILED with ${errors.length} errors:`);
  errors.forEach(e => console.error(e.file, e.error));
  process.exit(1);
}
