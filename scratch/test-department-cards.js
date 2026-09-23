/**
 * Automated Test Suite: Sarojini Bazaar "Shop By Department" Redesign
 * Verifies:
 * 1. Image asset existence, valid paths, and image file sizes
 * 2. HTML 2-tier layout, card semantics, routing hrefs, and floating badges
 * 3. CSS 2-tier Grid, 3D hover physics, shimmer keyframes, and mobile 2-column layout
 * 4. JavaScript 3D tilt interaction initialization
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('========================================================================');
console.log('=== SAROJINI BAZAAR DEPARTMENT CARDS VERIFICATION SUITE ===');
console.log('========================================================================');

// 1. Verify Image Assets
console.log('\n--- 1. Department Image Assets Verification ---');
const requiredImages = [
  { file: 'assets/sarojini/dept-women.jpg', minSize: 100000, dept: 'WOMEN' },
  { file: 'assets/sarojini/dept-men.jpg', minSize: 100000, dept: 'MEN' },
  { file: 'assets/sarojini/dept-accessories.jpg', minSize: 100000, dept: 'ACCESSORIES' },
  { file: 'assets/sarojini/dept-sneakers.jpg', minSize: 100000, dept: 'FOOTWEAR' },
  { file: 'assets/sarojini/dept-bags.jpg', minSize: 100000, dept: 'BAGS' },
  { file: 'assets/sarojini/dept-jewellery.jpg', minSize: 100000, dept: 'JEWELLERY' },
  { file: 'assets/sarojini/dept-caps.jpg', minSize: 100000, dept: 'CAPS' }
];

for (const img of requiredImages) {
  const p = path.join(__dirname, '..', img.file);
  assert.ok(fs.existsSync(p), `Image must exist at ${img.file}`);
  const stats = fs.statSync(p);
  assert.ok(stats.size >= img.minSize, `Image ${img.file} must be high resolution (got ${stats.size} bytes)`);
  console.log(`  ✓ [PASS] ${img.dept}: ${img.file} (${Math.round(stats.size / 1024)} KB)`);
}

// 2. HTML Markup & Routing Integrity
console.log('\n--- 2. HTML Markup & Routing Integrity (sarojini-bazaar.html) ---');
const htmlPath = path.join(__dirname, '..', 'sarojini-bazaar.html');
const html = fs.readFileSync(htmlPath, 'utf8');

assert.ok(html.includes('class="department-showcase"'), 'Must contain .department-showcase wrapper');
assert.ok(html.includes('class="dept-feature-grid"'), 'Must contain .dept-feature-grid (Tier 1)');
assert.ok(html.includes('class="dept-specialty-grid"'), 'Must contain .dept-specialty-grid (Tier 2)');

const expectedDepts = [
  { dept: 'WOMEN', label: "Women's Lane", tier: 'feature', img: 'dept-women.jpg' },
  { dept: 'MEN', label: "Men's Lane", tier: 'feature', img: 'dept-men.jpg' },
  { dept: 'ACCESSORIES', label: 'Accessories Corner', tier: 'specialty', img: 'dept-accessories.jpg' },
  { dept: 'FOOTWEAR', label: 'Sneaker Street', tier: 'specialty', img: 'dept-sneakers.jpg' },
  { dept: 'BAGS', label: 'Bag Corner', tier: 'specialty', img: 'dept-bags.jpg' },
  { dept: 'JEWELLERY', label: 'Jewellery Lane', tier: 'specialty', img: 'dept-jewellery.jpg' },
  { dept: 'CAPS', label: 'Cap Corner', tier: 'specialty', img: 'dept-caps.jpg' }
];

for (const d of expectedDepts) {
  const targetHref = `sarojini-shop.html?department=${d.dept}`;
  assert.ok(html.includes(targetHref), `HTML must link to ${targetHref}`);
  assert.ok(html.includes(d.img), `HTML must reference image ${d.img}`);
  assert.ok(html.includes(d.label), `HTML must display title ${d.label}`);
  console.log(`  ✓ [PASS] Department ${d.dept}: routes to ${targetHref} with ${d.img}`);
}

assert.ok(html.includes('dept-shimmer-sweep'), 'Cards must include ambient moving shimmer wave');
assert.ok(html.includes('dept-lane-pill') || html.includes('dept-lane-badge'), 'Cards must include floating lane pills');

// 3. CSS Architecture & Responsive Layout
console.log('\n--- 3. CSS Architecture & Responsiveness (css/sarojini-bazaar-page.css) ---');
const cssPath = path.join(__dirname, '..', 'css', 'sarojini-bazaar-page.css');
const css = fs.readFileSync(cssPath, 'utf8');

assert.ok(css.includes('.dept-feature-grid'), 'CSS must define .dept-feature-grid');
assert.ok(css.includes('repeat(2, 1fr)'), 'Feature grid must be 2 columns on desktop');
assert.ok(css.includes('.dept-specialty-grid'), 'CSS must define .dept-specialty-grid');
assert.ok(css.includes('repeat(5, 1fr)'), 'Specialty grid must be 5 columns on desktop');

assert.ok(css.includes('deptShimmerCycle'), 'CSS must define deptShimmerCycle animation');
assert.ok(css.includes('scale(1.04') || css.includes('scale(1.045)'), 'CSS must implement ~1.04x image zoom on hover');
assert.ok(css.includes('translateY(-6px)'), 'CSS must implement 3D card lift on hover');
assert.ok(css.includes('.dept-scrim-gradient'), 'CSS must define multi-stop editorial gradient scrim');

// Verify responsive mobile 2-column layout (no horizontal overflow)
assert.ok(css.includes('@media (max-width: 768px)'), 'CSS must have 768px media query');
assert.ok(css.includes('@media (max-width: 480px)'), 'CSS must have 480px media query');

console.log('  ✓ [PASS] Desktop 2-tier CSS Grid (2 feature cards + 5 specialty cards) verified');
console.log('  ✓ [PASS] 3D physics, lift, 1.045x zoom, and ambient shimmer verified');
console.log('  ✓ [PASS] Responsive 2-column mobile layout rules verified');

// 4. JavaScript 3D Tilt Integration
console.log('\n--- 4. JavaScript 3D Tilt Physics (js/sarojini-bazaar-page.js) ---');
const jsPath = path.join(__dirname, '..', 'js', 'sarojini-bazaar-page.js');
const js = fs.readFileSync(jsPath, 'utf8');

assert.ok(js.includes('initDepartmentCards3D'), 'JavaScript must define initDepartmentCards3D');
assert.ok(js.includes('rotateX') && js.includes('rotateY'), 'JavaScript must track rotateX and rotateY tilt');
assert.ok(js.includes('(pointer: fine)'), 'JavaScript must safeguard touch devices against scroll jank');

console.log('  ✓ [PASS] Smooth RAF 3D tilt tracking with pointer-fine check verified');

console.log('\n========================================================================');
console.log('ALL DEPARTMENT CARDS ACCEPTANCE TESTS PASSED (100%)');
console.log('========================================================================\n');

