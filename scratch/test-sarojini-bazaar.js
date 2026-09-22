const fs = require('fs');
const path = require('path');

console.log('===========================================================');
console.log('TEST SUITE: VADI SAROJINI BAZAAR HOMEPAGE SECTION');
console.log('===========================================================\n');

let failed = false;
function assert(condition, message) {
  if (condition) {
    console.log(`✓ ${message}`);
  } else {
    console.error(`✗ FAILED: ${message}`);
    failed = true;
  }
}

// 1. Verify Local Assets
console.log('1. Checking Local Assets in assets/sarojni/...');
const requiredAssets = [
  'sarojni_hm_cover.png',
  'sarojini-top-banner.png',
  'cat-tops.png',
  'cat-tees.png',
  'cat-jeans.png',
  'cat-dresses.png',
  'cat-bags.png',
  'cat-sneakers.png',
  'cat-accessories.png',
  'cat-caps.png',
  'prod-1-striped-top.png',
  'prod-2-graphic-tee.png',
  'prod-3-wide-jeans.png',
  'prod-4-ruched-dress.png',
  'prod-5-classic-sneakers.png',
  'prod-6-retro-bag.png',
  'badge-fashion-for-everyone.png'
];

requiredAssets.forEach(file => {
  const filePath = path.join('assets', 'sarojni', file);
  assert(fs.existsSync(filePath), `Asset exists: ${filePath} (${fs.statSync(filePath).size} bytes)`);
});

// 2. Verify HTML files
console.log('\n2. Verifying index.html and homepage.html Integration...');
['index.html', 'homepage.html'].forEach(htmlFile => {
  console.log(`\nChecking ${htmlFile}:`);
  const content = fs.readFileSync(htmlFile, 'utf8');

  assert(content.includes('css/sarojini-bazaar.css'), `${htmlFile} links css/sarojini-bazaar.css`);
  assert(content.includes('js/sarojini-bazaar.js'), `${htmlFile} links js/sarojini-bazaar.js`);
  assert(content.includes('id="sarojini-bazaar-section"'), `${htmlFile} contains #sarojini-bazaar-section`);
  assert(content.includes('class="vadi-sarojini-bazaar"'), `${htmlFile} contains class="vadi-sarojini-bazaar"`);

  // Verify section order: Hero -> Sarojini -> Categories
  const heroIndex = content.indexOf('class="hero-section"');
  const sarojiniIndex = content.indexOf('id="sarojini-bazaar-section"');
  const catIndex = content.indexOf('id="categories-section"');

  assert(heroIndex !== -1, `${htmlFile} contains hero-section`);
  assert(sarojiniIndex !== -1, `${htmlFile} contains sarojini-bazaar-section`);
  assert(catIndex !== -1, `${htmlFile} contains categories-section`);
  assert(heroIndex < sarojiniIndex, `${htmlFile}: Hero section is BEFORE Sarojini Bazaar`);
  assert(sarojiniIndex < catIndex, `${htmlFile}: Sarojini Bazaar is BEFORE Shop by Category`);

  // Verify Categories
  const categories = ['Tops', 'Oversized Tees', 'Jeans', 'Dresses', 'Bags', 'Sneakers', 'Accessories', 'Caps & More'];
  categories.forEach(cat => {
    assert(content.includes(cat), `${htmlFile} contains category: "${cat}"`);
  });

  // Verify Category Prices
  const prices = ['Under ₹399', 'Under ₹499', 'Under ₹699', 'Under ₹599', 'Under ₹999', 'Under ₹299'];
  prices.forEach(pr => {
    assert(content.includes(pr), `${htmlFile} contains price: "${pr}"`);
  });

  // Verify Mid Quote
  assert(content.includes('Bazaar Wale Prices, VADI Wali Quality'), `${htmlFile} contains middle highlight quote`);
  assert(content.includes('View All'), `${htmlFile} contains View All button`);

  // Verify Products
  const products = [
    { name: 'Ribbed Striped Top', price: '₹349', orig: '₹699' },
    { name: 'Oversized Graphic Tee', price: '₹399', orig: '₹799' },
    { name: 'Wide Leg Jeans', price: '₹599', orig: '₹1,199' },
    { name: 'Ruched Mini Dress', price: '₹549', orig: '₹1,099' },
    { name: 'Classic Sneakers', price: '₹899', orig: '₹1,799' },
    { name: 'Retro Shoulder Bag', price: '₹499', orig: '₹999' }
  ];

  products.forEach(p => {
    assert(content.includes(p.name), `${htmlFile} contains product "${p.name}"`);
    assert(content.includes(p.price), `${htmlFile} contains price "${p.price}" for ${p.name}`);
  });

  // Verify Benefits
  assert(content.includes('Trendy Styles'), `${htmlFile} contains benefit "Trendy Styles"`);
  assert(content.includes('Premium Quality'), `${htmlFile} contains benefit "Premium Quality"`);
  assert(content.includes('Budget Friendly'), `${htmlFile} contains benefit "Budget Friendly"`);
  assert(content.includes('Loved by 50K+'), `${htmlFile} contains benefit "Loved by 50K+"`);
  assert(content.includes('badge-fashion-for-everyone.png'), `${htmlFile} contains Fashion for Everyone badge`);
});

// 3. Verify Scoped CSS
console.log('\n3. Verifying css/sarojini-bazaar.css...');
const cssContent = fs.readFileSync('css/sarojini-bazaar.css', 'utf8');
assert(cssContent.includes('.vadi-sarojini-bazaar'), 'CSS has root scoping .vadi-sarojini-bazaar');
assert(cssContent.includes('@media (max-width: 767px)'), 'CSS contains mobile media queries (max-width: 767px)');
assert(cssContent.includes('.sarojini-carousel-track'), 'CSS styles .sarojini-carousel-track');
assert(cssContent.includes('.sarojini-categories-track'), 'CSS styles .sarojini-categories-track');
assert(cssContent.includes('.sarojini-category-avatar-wrap'), 'CSS styles circular avatars');

// Check that no un-scoped global selectors exist
const unscopedGlobalChecks = ['\nh1 {', '\nh2 {', '\nimg {', '\nsection {', '\n.container {'];
unscopedGlobalChecks.forEach(sel => {
  assert(!cssContent.includes(sel), `CSS contains no un-scoped selector: ${sel.trim()}`);
});

// 4. Verify JavaScript Controller
console.log('\n4. Verifying js/sarojini-bazaar.js...');
const jsContent = fs.readFileSync('js/sarojini-bazaar.js', 'utf8');
assert(jsContent.includes('sarojini-carousel-track'), 'JS handles carousel track');
assert(jsContent.includes('btnPrev.addEventListener'), 'JS binds prev button');
assert(jsContent.includes('btnNext.addEventListener'), 'JS binds next button');
assert(jsContent.includes('sarojini-card-wishlist-btn'), 'JS handles wishlist toggle');

// Syntax check via node vm
const vm = require('vm');
try {
  new vm.Script(jsContent);
  console.log('✓ js/sarojini-bazaar.js passed syntax validation');
} catch (e) {
  console.error('✗ js/sarojini-bazaar.js syntax error:', e);
  failed = true;
}

// 5. Verify homepage-sections-engine.js ordering integrity
console.log('\n5. Verifying js/homepage-sections-engine.js preserves Sarojini Bazaar...');
const engineContent = fs.readFileSync('js/homepage-sections-engine.js', 'utf8');
assert(engineContent.includes("key === 'categories' && domUnitMap.has('sarojini_bazaar')"), 'Engine guarantees Sarojini Bazaar placement before categories');

console.log('\n===========================================================');
if (failed) {
  console.error('SOME TESTS FAILED! Please review above errors.');
  process.exit(1);
} else {
  console.log('ALL VERIFICATIONS PASSED WITH 100% SUCCESS!');
  console.log('===========================================================');
}

