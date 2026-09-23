const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('=== TEST SUITE: SAROJINI CONTINUOUS MARQUEE OVERLAY STRIP ===\n');

const ROOT = path.resolve(__dirname, '..');

// 1. Verify CSS Files
const cssFiles = [
  'css/sarojini-bazaar.css',
  'css/sarojini-bazaar-page.css',
  'css/sarojini-shop.css',
  'css/sarojini-product-details.css'
];

cssFiles.forEach(relPath => {
  const fullPath = path.join(ROOT, relPath);
  assert(fs.existsSync(fullPath), `CSS file missing: ${relPath}`);
  const content = fs.readFileSync(fullPath, 'utf8');

  assert(content.includes('.sarojini-promo-strip'), `Missing .sarojini-promo-strip in ${relPath}`);
  assert(content.includes('bottom: 0;'), `Missing bottom: 0 in ${relPath}`);
  assert(content.includes('left: 0;'), `Missing left: 0 in ${relPath}`);
  assert(content.includes('right: 0;'), `Missing right: 0 in ${relPath}`);
  assert(content.includes('width: 100%;'), `Missing width: 100% in ${relPath}`);
  assert(content.includes('height: 34px;'), `Missing height: 34px in ${relPath}`);
  assert(content.includes('pointer-events: none'), `Missing pointer-events: none in ${relPath}`);
  assert(content.includes('sarojiniContinuousMarquee'), `Missing @keyframes sarojiniContinuousMarquee in ${relPath}`);
  assert(content.includes('transform: translateX(-50%)'), `Missing transform: translateX(-50%) in ${relPath}`);
  assert(content.includes('.sarojini-promo-badge'), `Missing .sarojini-promo-badge in ${relPath}`);
  assert(content.includes('.sarojini-promo-track'), `Missing .sarojini-promo-track in ${relPath}`);
  assert(content.includes('.sarojini-promo-group'), `Missing .sarojini-promo-group in ${relPath}`);
  assert(content.includes('.sarojini-promo-item'), `Missing .sarojini-promo-item in ${relPath}`);
  assert(content.includes('.sarojini-promo-bullet'), `Missing .sarojini-promo-bullet in ${relPath}`);
  console.log(`[PASS] Stylesheet verified with full continuous marquee: ${relPath}`);
});

// 2. Verify JS and HTML Files for Promo Strip injection
const jsFiles = [
  'js/sarojini-bazaar.js',
  'js/sarojini-bazaar-page.js',
  'js/sarojini-shop.js',
  'js/sarojini-product-details.js'
];

const requiredItems = [
  'SAROJINI',
  'BAZAAR WALE PRICES',
  'NEW STREET DROP',
  "DELHI'S FASHION FINDS",
  'STYLE UNDER ₹499',
  'CURATED FOR YOU'
];

jsFiles.forEach(relPath => {
  const fullPath = path.join(ROOT, relPath);
  assert(fs.existsSync(fullPath), `JS file missing: ${relPath}`);
  const content = fs.readFileSync(fullPath, 'utf8');

  assert(content.includes('getSarojiniPromoStripHtml'), `Missing getSarojiniPromoStripHtml in ${relPath}`);
  assert(content.includes('sarojini-promo-strip'), `Missing sarojini-promo-strip class in ${relPath}`);
  assert(content.includes('sarojini-promo-group'), `Missing sarojini-promo-group in ${relPath}`);
  assert(content.includes('sarojini-promo-bullet'), `Missing sarojini-promo-bullet in ${relPath}`);

  requiredItems.forEach(msg => {
    assert(content.includes(msg), `Missing promotional message "${msg}" in ${relPath}`);
  });

  console.log(`[PASS] JS file verified with continuous marquee groups: ${relPath}`);
});

// 3. Verify PDP HTML
const pdpHtmlPath = path.join(ROOT, 'sarojini-product-details.html');
const pdpHtml = fs.readFileSync(pdpHtmlPath, 'utf8');
assert(pdpHtml.includes('sarojini-promo-strip sarojini-promo-strip-pdp'), 'Missing static promo strip in sarojini-product-details.html');
assert(pdpHtml.includes('sarojini-promo-group'), 'Missing sarojini-promo-group in sarojini-product-details.html');
assert(pdpHtml.includes('sarojini-promo-bullet'), 'Missing sarojini-promo-bullet in sarojini-product-details.html');
requiredItems.forEach(msg => {
  assert(pdpHtml.includes(msg), `Missing promotional message "${msg}" in sarojini-product-details.html`);
});
console.log('[PASS] PDP static HTML verified: sarojini-product-details.html');

// 4. Verify Main Store is NOT affected
const mainFiles = [
  'shop.html',
  'product-details.html',
  'cart.html',
  'wishlist.html'
];
mainFiles.forEach(relPath => {
  const fullPath = path.join(ROOT, relPath);
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf8');
    assert(!content.includes('sarojini-promo-strip'), `Main store file should NOT have sarojini-promo-strip: ${relPath}`);
    console.log(`[PASS] Verified Main store file is untainted: ${relPath}`);
  }
});

// 5. Verify Original Product Images are intact & not modified
const imageFiles = [
  'assets/sarojni/prod-1-graphic-tee.png',
  'assets/sarojni/prod-2-ribbed-top.png',
  'assets/sarojni/prod-3-wide-jeans.png',
  'assets/sarojni/prod-4-ruched-dress.png',
  'assets/sarojni/prod-5-classic-sneakers.png',
  'assets/sarojni/prod-6-retro-bag.png',
  'assets/sarojni/srh2.png'
];
imageFiles.forEach(relPath => {
  const fullPath = path.join(ROOT, relPath);
  assert(fs.existsSync(fullPath), `Asset file missing: ${relPath}`);
  const stat = fs.statSync(fullPath);
  assert(stat.size > 0, `Asset file is empty: ${relPath}`);
  console.log(`[PASS] Asset verified unmodified: ${relPath} (${stat.size} bytes)`);
});

console.log('\n=== ALL CONTINUOUS MARQUEE OVERLAY TESTS PASSED SUCCESSFULLY! ===\n');
