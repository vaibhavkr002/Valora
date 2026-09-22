const fs = require('fs');
const path = require('path');

const ROOT = 'c:/Users/saanv/OneDrive/Desktop/Website/webu';
let passed = 0;
let failed = 0;

function check(label, condition, detail = '') {
  if (condition) {
    console.log(`✔ PASS: ${label} ${detail ? '(' + detail + ')' : ''}`);
    passed++;
  } else {
    console.error(`✖ FAIL: ${label} ${detail ? '(' + detail + ')' : ''}`);
    failed++;
  }
}

console.log('==================================================================');
console.log('=== SAROJINI BAZAAR 6-CARD COMPACT GRID VERIFICATION SUITE ===');
console.log('==================================================================\n');

// 1. Inspect css/sarojini-bazaar-page.css
console.log('--- 1. Desktop 6-Column Grid & Proportional Sizing ---');
const bzCss = fs.readFileSync(path.join(ROOT, 'css/sarojini-bazaar-page.css'), 'utf8');

check('sarojini-product-grid defines 6 columns on desktop', 
  bzCss.includes('grid-template-columns: repeat(6, 1fr)'));

check('sarojini-product-grid uses clean equal gap (16px)', 
  bzCss.includes('grid-template-columns: repeat(6, 1fr);\n  gap: 16px;'));

check('Does NOT use transform: scale() on the product grid', 
  !bzCss.includes('.sarojini-product-grid {\n  transform: scale'));

// 2. Image Area & object-fit: contain
console.log('\n--- 2. Compact Product Image & object-fit: contain Treatment ---');
check('Image container has compact aspect ratio (1 / 1)', 
  bzCss.includes('.product-card-media {\n  position: relative;\n  width: 100%;\n  aspect-ratio: 1 / 1;'));

check('Image container provides subtle neutral background', 
  bzCss.includes('background: #f6f3ec'));

check('Product image uses object-fit: contain so complete product is visible', 
  bzCss.includes('object-fit: contain;'));

check('Product image container has breathing padding to prevent edge clipping', 
  bzCss.includes('.product-card-media a {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  width: 100%;\n  height: 100%;\n  padding: 8px;'));

// 3. Information Preservation & Compact Proportions
console.log('\n--- 3. Preserved Information & Scaled Elements ---');
check('Card body has compact padding (11px 10px 10px)', 
  bzCss.includes('.product-card-body {\n  padding: 11px 10px 10px;'));

check('Preserves Category/Lane badge with compact typography', 
  bzCss.includes('.product-card-dept {\n  font-size: 0.62rem;'));

check('Product name supports 1-2 lines with min-height for aligned bottoms', 
  bzCss.includes('.product-card-title') && bzCss.includes('-webkit-line-clamp: 2') && bzCss.includes('min-height: 2.15em'));

check('Price row is pushed to bottom with margin-top: auto for aligned cards', 
  bzCss.includes('.product-card-price-row {\n  display: flex;\n  align-items: baseline;\n  gap: 5px;\n  margin-top: auto;'));

check('Selling price is compact and bold (0.98rem)', 
  bzCss.includes('.price-selling {\n  font-size: 0.98rem;'));

check('Original price is compact with line-through', 
  bzCss.includes('.price-original {\n  font-size: 0.72rem;\n  color: var(--bazaar-text-subtle);\n  text-decoration: line-through;'));

check('Discount percentage pill is compact (0.66rem)', 
  bzCss.includes('.price-discount {\n  font-size: 0.66rem;'));

check('Add to Bag button is compact (padding: 7px 0, font-size: 0.74rem)', 
  bzCss.includes('.btn-card-add-bag {\n  margin-top: 8px;\n  width: 100%;\n  background: var(--bazaar-dark);\n  color: #fff;\n  border: none;\n  padding: 7px 0;\n  border-radius: 50px;\n  font-size: 0.74rem;'));

check('Wishlist heart button is compact (28px x 28px)', 
  bzCss.includes('.product-card-wishlist') && bzCss.includes('width: 28px;\n  height: 28px;'));

check('Discount badge on media is compact (0.62rem)', 
  bzCss.includes('.product-card-badge') && bzCss.includes('font-size: 0.62rem;'));

// 4. Responsive Breakpoints
console.log('\n--- 4. Responsive Breakpoints (Desktop 6 -> 4 -> 3 -> Mobile 2) ---');
check('Switches to 4 columns at <= 1280px', 
  bzCss.includes('@media (max-width: 1280px)') && bzCss.includes('grid-template-columns: repeat(4, 1fr)'));

check('Switches to 3 columns at <= 992px tablet', 
  bzCss.includes('@media (max-width: 992px)') && bzCss.includes('grid-template-columns: repeat(3, 1fr)'));

check('Switches to 2 columns at <= 768px mobile', 
  bzCss.includes('@media (max-width: 768px)') && bzCss.includes('grid-template-columns: repeat(2, 1fr)'));

// 5. Query Limit Adjustments for Complete 6-Card Rows
console.log('\n--- 5. Dynamic Query Limits for 6-Card Alignment ---');
const bazaarJs = fs.readFileSync(path.join(ROOT, 'js/sarojini-bazaar-page.js'), 'utf8');
check('sarojini-bazaar-page.js fetches 12 products for 2 full 6-card rows', 
  bazaarJs.includes('.limit(12)'));

const pdpJs = fs.readFileSync(path.join(ROOT, 'js/sarojini-product-details.js'), 'utf8');
check('sarojini-product-details.js fetches 6 related products for 1 full 6-card row', 
  pdpJs.includes('.limit(6)'));

console.log('\n==================================================================');
console.log(`=== SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
console.log('==================================================================\n');

if (failed > 0) process.exit(1);

