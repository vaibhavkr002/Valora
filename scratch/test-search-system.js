/**
 * Test Suite: VADI Unified Product Search Engine & Storefront Integration
 * Tests:
 * 1. Text normalization and hyphen/punctuation handling
 * 2. Token variations & domain synonyms (e.g. t-shirt / tshirt / tee, oversize / oversized)
 * 3. Multi-word AND logic across separate product fields
 * 4. Dynamic indexing of new schema fields from Admin (tags, specifications, colors, sizes)
 * 5. Main Store vs Sarojini Bazaar catalog isolation
 * 6. Special regex / punctuation queries safety
 * 7. HTML script loading verification
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// 1. Load VadiSearchUtils
const searchUtils = require('../js/search-utils.js');
console.log('--- 1. Testing VadiSearchUtils Engine ---');

assert.ok(searchUtils, 'VadiSearchUtils module must be exported');
assert.strictEqual(typeof searchUtils.matchesProduct, 'function', 'matchesProduct must be a function');
assert.strictEqual(typeof searchUtils.filterProducts, 'function', 'filterProducts must be a function');
assert.strictEqual(typeof searchUtils.buildSearchCorpus, 'function', 'buildSearchCorpus must be a function');

// Test Normalization
assert.strictEqual(searchUtils.normalizeText('  T-Shirt & Jeans!  '), 't-shirt jeans');
assert.strictEqual(searchUtils.normalizeText('OVERSIZED-FIT'), 'oversized-fit');

// Test Token Variations
const tshirtVars = searchUtils.getTokenVariations('t-shirt');
assert.ok(tshirtVars.includes('tshirt'), 't-shirt variation should include tshirt');
assert.ok(tshirtVars.includes('tee') || tshirtVars.includes('shirt'), 't-shirt variation should include tee or shirt');

const oversizeVars = searchUtils.getTokenVariations('oversized');
assert.ok(oversizeVars.includes('oversize'), 'oversized variation should include oversize');

const cargosVars = searchUtils.getTokenVariations('cargos');
assert.ok(cargosVars.includes('cargo'), 'cargos variation should include cargo');

console.log('✓ Normalization and token variations passed.');

// Test Multi-Word Across Fields
const sampleMainProduct = {
  id: 'prod-001',
  name: 'Graphic Boxy Drop',
  brand: 'VADI Studio',
  category_id: 'cat-mens-tops',
  department: 'MEN',
  description: 'Relaxed oversized fit premium organic cotton streetwear tee.',
  colors: ['Jet Black', 'Vintage White'],
  sizes: ['M', 'L', 'XL'],
  specifications: { material: '100% French Terry Cotton', gsm: 280 },
  tags: ['streetwear', 'anime', 'boxy', 'summer']
};

assert.ok(searchUtils.matchesProduct(sampleMainProduct, 'oversized graphic'), 'Should match across description and name');
assert.ok(searchUtils.matchesProduct(sampleMainProduct, 't-shirt'), 'Should match t-shirt synonym for tee');
assert.ok(searchUtils.matchesProduct(sampleMainProduct, 'black cargo') === false, 'Should fail when one required word (cargo) is missing');
assert.ok(searchUtils.matchesProduct(sampleMainProduct, 'black cotton'), 'Should match color and specification/description');
assert.ok(searchUtils.matchesProduct(sampleMainProduct, 'anime streetwear'), 'Should match tags');
assert.ok(searchUtils.matchesProduct(sampleMainProduct, 'vadi studio'), 'Should match brand name');

console.log('✓ Multi-word across fields matching passed.');

// Test New Product Added Later From Admin (dynamic fields without code update)
const futureAdminProduct = {
  id: 'prod-999',
  name: 'Cargo Utility Parachute Pants',
  brand: 'Urban Street',
  description: 'Water-repellent fabric with tactical pockets',
  custom_keywords: 'streetwear, techwear, gorpcore, tactical',
  material_details: 'Ripstop Nylon',
  fit_type: 'Baggy Relaxed',
  colors: ['Olive Drab', 'Camo']
};

assert.ok(searchUtils.matchesProduct(futureAdminProduct, 'techwear'), 'Should automatically match custom_keywords from admin');
assert.ok(searchUtils.matchesProduct(futureAdminProduct, 'gorpcore'), 'Should automatically match custom_keywords from admin');
assert.ok(searchUtils.matchesProduct(futureAdminProduct, 'ripstop'), 'Should automatically match material_details from admin');
assert.ok(searchUtils.matchesProduct(futureAdminProduct, 'baggy parachute'), 'Should match fit_type and name');
assert.ok(searchUtils.matchesProduct(futureAdminProduct, 'cargos olive'), 'Should match variations (cargos -> cargo) and color');

console.log('✓ Dynamic Admin field indexing passed.');

// Test Regex Special Characters Safety
const weirdQueries = [
  'tee (black)',
  'drop [sale]',
  'oversized + cotton',
  '100% * 280',
  'price: ₹299?',
  '^vadi$',
  'test{1,2}'
];

for (const q of weirdQueries) {
  assert.doesNotThrow(() => {
    searchUtils.matchesProduct(sampleMainProduct, q);
  }, `Query "${q}" should not throw regex errors`);
}
console.log('✓ Special regex / punctuation safety passed.');

// 2. Catalog Isolation
console.log('\n--- 2. Testing Catalog Isolation ---');
const mainStoreCatalog = [
  { id: 'm1', name: 'VADI Silk Luxe Blazer', brand: 'VADI Luxury', department: 'WOMEN', price: 4999 },
  { id: 'm2', name: 'VADI Oversized Graphic Tee', brand: 'VADI Studio', department: 'MEN', price: 1499 }
];

const sarojiniCatalog = [
  { id: 's1', name: 'Sarojini Graphic Anime T-Shirt', brand: 'Sarojini Bazaar', department: 'MEN', price: 299 },
  { id: 's2', name: 'Sarojini Parachute Cargo Pants', brand: 'Sarojini Bazaar', department: 'WOMEN', price: 449 }
];

// Searching 'graphic' in Main store returns m2 only, no sarojini products
const mainResults = searchUtils.filterProducts(mainStoreCatalog, 'graphic');
assert.strictEqual(mainResults.length, 1);
assert.strictEqual(mainResults[0].id, 'm2');

// Searching 'graphic' in Sarojini store returns s1 only, no main products
const sarojiniResults = searchUtils.filterProducts(sarojiniCatalog, 'graphic');
assert.strictEqual(sarojiniResults.length, 1);
assert.strictEqual(sarojiniResults[0].id, 's1');

console.log('✓ Main Store vs Sarojini Bazaar catalog isolation verified.');

// 3. HTML Script Tag Verification
console.log('\n--- 3. Verifying Script Tag Inclusion in HTML Pages ---');
const htmlFilesToCheck = [
  'shop.html',
  'homepage.html',
  'index.html',
  'product.html',
  'sarojini-shop.html',
  'sarojini-bazaar.html',
  'sarojini-product-details.html',
  'trending.html',
  'new-arrivals.html',
  'deals.html',
  'bogo.html'
];

for (const f of htmlFilesToCheck) {
  const filePath = path.join(__dirname, '..', f);
  assert.ok(fs.existsSync(filePath), `${f} must exist`);
  const content = fs.readFileSync(filePath, 'utf8');
  assert.ok(
    content.includes('js/search-utils.js'),
    `${f} must include <script src="js/search-utils.js"></script>`
  );
}
console.log('✓ All 11 HTML pages correctly load search-utils.js.');

// 4. Check Navigation and Search Forms
console.log('\n--- 4. Verifying Navbar Search Forms and Target URLs ---');

// Main Store shop.html / homepage.html: search input triggers shop.html?search=
const appJsContent = fs.readFileSync(path.join(__dirname, '..', 'js/app.js'), 'utf8');
assert.ok(
  appJsContent.includes('shop.html?search='),
  'app.js must navigate to shop.html?search= on search enter/click'
);
assert.ok(
  appJsContent.includes('VadiSearchUtils'),
  'app.js must use VadiSearchUtils for live search suggestions'
);

// Sarojini Shop: header search input and sidebar search input sync & intercept submit
const sarojiniShopJs = fs.readFileSync(path.join(__dirname, '..', 'js/sarojini-shop.js'), 'utf8');
assert.ok(
  sarojiniShopJs.includes('sarojini-search-input'),
  'sarojini-shop.js must wire sarojini-search-input'
);
assert.ok(
  sarojiniShopJs.includes('sarojini-search-form'),
  'sarojini-shop.js must intercept sarojini-search-form submit'
);
assert.ok(
  sarojiniShopJs.includes('VadiSearchUtils.matchesProduct'),
  'sarojini-shop.js must use VadiSearchUtils.matchesProduct'
);
assert.ok(
  sarojiniShopJs.includes('empty-clear-search-btn'),
  'sarojini-shop.js must render Clear Search button when search returns 0 results'
);

console.log('✓ Navbar search wiring, sync, and form interception verified.');
console.log('\n========================================');
console.log('ALL SEARCH SYSTEM UNIT & INTEGRATION TESTS PASSED!');
console.log('========================================');
