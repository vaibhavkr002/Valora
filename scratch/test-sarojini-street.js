const fs = require('fs');
const path = require('path');

const ROOT = 'c:/Users/saanv/OneDrive/Desktop/Website/webu';

console.log('--- Testing VADI Sarojini Bazaar 4-Concept Experience ---');
let errors = 0;

function assert(condition, message) {
  if (!condition) {
    console.error('❌ FAIL:', message);
    errors++;
  } else {
    console.log('✅ PASS:', message);
  }
}

// 1. Check Files and Reference Assets Exist
const htmlPath = path.join(ROOT, 'sarojini-bazaar.html');
const cssPath = path.join(ROOT, 'css/sarojini-street.css');
const jsPath = path.join(ROOT, 'js/sarojini-street.js');

assert(fs.existsSync(htmlPath), 'sarojini-bazaar.html exists');
assert(fs.existsSync(cssPath), 'css/sarojini-street.css exists');
assert(fs.existsSync(jsPath), 'js/sarojini-street.js exists');

// Verify 4 Concept Reference Images in assets/sarojni/
['con1.png', 'con2.png', 'con3.png', 'con4.png'].forEach(imgName => {
  const p = path.join(ROOT, 'assets/sarojni', imgName);
  assert(fs.existsSync(p), `Concept asset exists: assets/sarojni/${imgName}`);
});

// 2. Check HTML structure of sarojini-bazaar.html
const htmlContent = fs.readFileSync(htmlPath, 'utf8');
assert(htmlContent.includes('class="bazaar-nav-header"'), 'Header exists in HTML');
assert(htmlContent.includes('id="stage-entrance"'), 'Stage 1 (Concept 1 Entrance) exists in HTML');
assert(htmlContent.includes('id="stage-street-25d"'), 'Stage 2 (Concept 3 Primary 2.5D Street) exists in HTML');
assert(htmlContent.includes('id="stage-market-lane"'), 'Stage 3 (Concept 2 Market Lane) exists in HTML');
assert(htmlContent.includes('id="sarojini-shop-interior"'), 'Concept 4 Shop Interior Drawer exists in HTML');
assert(htmlContent.includes('class="bazaar-bottom-bar"'), 'Bottom Value Strip exists in HTML');
assert(htmlContent.includes('id="btn-enter-bazaar"'), 'Enter the Bazaar CTA button exists');
assert(htmlContent.includes('id="prompt-walk-ahead"'), 'Walk Ahead prompt exists in Concept 3');
assert(htmlContent.includes('id="btn-lane-back"'), 'Back to Main Street button exists in Concept 2');

// 3. Check JS content
const jsContent = fs.readFileSync(jsPath, 'utf8');
assert(jsContent.includes("'tops'"), 'Shop tops exists in JS');
assert(jsContent.includes("'jeans'"), 'Shop jeans exists in JS');
assert(jsContent.includes("'bags'"), 'Shop bags exists in JS');
assert(jsContent.includes("'footwear'"), 'Shop footwear exists in JS');
assert(jsContent.includes("'accessories'"), 'Shop accessories exists in JS');
assert(jsContent.includes("'dresses'"), 'Shop dresses exists in JS');
assert(jsContent.includes("'streetwear'"), 'Shop streetwear exists in JS');
assert(jsContent.includes("'jewellery'"), 'Shop jewellery exists in JS');

// Verify all assets referenced exist
const assetMatches = jsContent.match(/assets\/sarojni\/[a-zA-Z0-9_\-.]+\.png/g) || [];
console.log(`Found ${assetMatches.length} asset references in js/sarojini-street.js`);
const uniqueAssets = Array.from(new Set(assetMatches));
uniqueAssets.forEach(assetRel => {
  const fullPath = path.join(ROOT, assetRel);
  assert(fs.existsSync(fullPath), `Asset exists: ${assetRel}`);
});

// 4. Check CSS styling
const cssContent = fs.readFileSync(cssPath, 'utf8');
assert(cssContent.includes('.vadi-sarojini-bazaar-page'), 'Namespace present in CSS');
assert(cssContent.includes('#stage-entrance'), 'Stage entrance styles in CSS');
assert(cssContent.includes('#stage-street-25d'), 'Stage 2.5D street styles in CSS');
assert(cssContent.includes('#stage-market-lane'), 'Stage market lane styles in CSS');
assert(cssContent.includes('.shop-hotspot-pill'), 'Shop hotspot pill styles in CSS');
assert(cssContent.includes('@media (max-width: 600px)'), 'Mobile responsive queries in CSS');
assert(cssContent.includes('@media (prefers-reduced-motion: reduce)'), 'Accessibility reduced-motion in CSS');

console.log(`--- Test Completed with ${errors} errors ---`);
if (errors > 0) process.exit(1);
