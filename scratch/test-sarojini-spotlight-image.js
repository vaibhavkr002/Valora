const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let passed = 0;
let failed = 0;

function check(label, condition) {
  if (condition) {
    console.log(`✔ PASS: ${label}`);
    passed++;
  } else {
    console.error(`✖ FAIL: ${label}`);
    failed++;
  }
}

console.log('================================================================');
console.log('=== SAROJINI BAZAAR SPOTLIGHT IMAGE REPLACEMENT TEST SUITE ===');
console.log('================================================================\n');

// 1. Asset File Inspection
console.log('--- 1. Asset File Verification ---');
const srh2Path = path.join(ROOT, 'assets', 'sarojni', 'srh2.png');
check('assets/sarojni/srh2.png exists', fs.existsSync(srh2Path));

if (fs.existsSync(srh2Path)) {
  const buf = fs.readFileSync(srh2Path);
  check('srh2.png is a valid PNG header', buf.slice(0, 8).toString('hex') === '89504e470d0a1a0a');
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  check(`srh2.png has valid dimensions (${width}x${height})`, width > 0 && height > 0);
  check('srh2.png has non-zero file size', buf.length > 100000);
}

// 2. HTML Inspection in sarojini-bazaar.html
console.log('\n--- 2. sarojini-bazaar.html Section Structure ---');
const bzHtml = fs.readFileSync(path.join(ROOT, 'sarojini-bazaar.html'), 'utf8');

check('Weekly refresh section exists', bzHtml.includes('sarojini-spotlight-section'));
check('Badge "WEEKLY REFRESH" exists untouched', bzHtml.includes('<span class="spotlight-pill">WEEKLY REFRESH</span>'));
check('Title "New Street Drops Every Friday" exists untouched', bzHtml.includes('<h2 class="spotlight-title">New Street Drops Every Friday</h2>'));
check('Description paragraph exists untouched', bzHtml.includes("Freshly sourced from Delhi's export surplus hubs"));
check('Explore New Arrivals button exists untouched', bzHtml.includes('Explore New Arrivals') && bzHtml.includes('sarojini-shop.html?sort=newest'));
check('Spotlight image source is set to assets/sarojni/srh2.png', bzHtml.includes('src="assets/sarojni/srh2.png"'));
check('Old image con3.png is removed from spotlight section', !bzHtml.includes('con3.png'));

// 3. CSS Object-Fit and Responsive Behavior
console.log('\n--- 3. CSS Styling & Layout ---');
const bzCss = fs.readFileSync(path.join(ROOT, 'css', 'sarojini-bazaar-page.css'), 'utf8');

check('.spotlight-banner has grid layout', bzCss.includes('.spotlight-banner') && bzCss.includes('grid-template-columns: 1fr 1fr'));
check('.spotlight-img has object-fit: cover', bzCss.includes('object-fit: cover'));
check('.spotlight-img has object-position: center', bzCss.includes('object-position: center'));
check('.spotlight-img-wrap has min-height', bzCss.includes('.spotlight-img-wrap') && bzCss.includes('min-height: 360px'));
check('Mobile responsive rule switches banner to 1 column', bzCss.includes('.spotlight-banner') && bzCss.includes('grid-template-columns: 1fr;'));

// 4. Git diff check - ensure only intended files changed
console.log('\n--- 4. Scope & Isolation Check ---');
const { execSync } = require('child_process');
try {
  const status = execSync('git status --porcelain', { cwd: ROOT, encoding: 'utf8' });
  console.log('Modified files according to git:\n' + status.trim());
} catch (e) {
  console.log('Git check skipped or not available.');
}

console.log('\n================================================================');
console.log(`=== SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
console.log('================================================================');

if (failed > 0) process.exit(1);

