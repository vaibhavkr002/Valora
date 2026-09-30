const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const patterns = [
  /razorpay/i,
  /checkout\.js/i,
  /payment\.captured/i,
  /razorpay_payment_id/i,
  /razorpay_order_id/i,
  /razorpay_signature/i
];

const ignoredDirs = new Set(['node_modules', '.git', 'scratch', 'dist', 'build', '.gemini']);

function walk(dir, fileList = []) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    if (ignoredDirs.has(item)) continue;
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath, fileList);
    } else {
      const ext = path.extname(item).toLowerCase();
      if (['.js', '.html', '.css', '.json', '.sql', '.env', '.example'].includes(ext) || item.startsWith('.env')) {
        fileList.push(fullPath);
      }
    }
  }
  return fileList;
}

const files = walk(rootDir);
const results = [];

for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    for (const pat of patterns) {
      if (pat.test(line)) {
        results.push({
          file: path.relative(rootDir, f),
          lineNum: idx + 1,
          line: line.trim()
        });
        break;
      }
    }
  });
}

console.log(JSON.stringify(results, null, 2));
