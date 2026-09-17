
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failedTests++;
  }
}

console.log('====================================================');
console.log('VELORA PROMOTIONS VERIFICATION SUITE');
console.log('====================================================\n');

// 1. Check File Existence
console.log('Test Suite 1: File Existence & Integrity');
const filesToCheck = [
  'css/promotions.css',
  'js/promotions.js',
  'index.html',
  'homepage.html',
  'shop.html',
  'product.html',
  'wishlist.html',
  'checkout.html',
  'account.html',
  'bogo.html',
  'trending.html'
];

filesToCheck.forEach(file => {
  const fullPath = path.join(ROOT_DIR, file);
  assert(fs.existsSync(fullPath), `${file} exists`);
});

// 2. CSS Rules Check
console.log('\nTest Suite 2: CSS Stylesheet Completeness');
const cssContent = fs.readFileSync(path.join(ROOT_DIR, 'css/promotions.css'), 'utf8');
const requiredCssClasses = [
  '.velora-promo-strip',
  '.velora-promo-strip-track',
  '.velora-promo-strip-item',
  '.bogo-promo-hero-card',
  '.bogo-promo-sparkles',
  '.bogo-promo-headline',
  '.highlight-bogo',
  '.bogo-promo-visual',
  '.bogo-promo-card-pair',
  '.bogo-float-item',
  '.trending-promo-section',
  '.trending-promo-card',
  '.trending-mini-grid',
  '.trending-mini-card',
  '.bogo-mini-promo-card',
  '.shop-top-promo-row',
  '.shop-promo-card',
  '.product-contextual-promo',
  '.promo-bogo',
  '.promo-trending',
  '.cart-drawer-promo-bar',
  '.wishlist-promo-box',
  '.checkout-discreet-promo',
  '.velora-floating-promo',
  '.floating-promo-card'
];

requiredCssClasses.forEach(cls => {
  assert(cssContent.includes(cls), `promotions.css contains rule for ${cls}`);
});

// Check responsive containment in CSS
assert(cssContent.includes('@media (max-width: 480px)'), 'promotions.css contains mobile @media (max-width: 480px)');
assert(cssContent.includes('@media (max-width: 360px)'), 'promotions.css contains extra-small mobile @media (max-width: 360px)');
assert(cssContent.includes('overflow-x: hidden') || cssContent.includes('box-sizing: border-box'), 'promotions.css handles horizontal overflow safety');

// 3. HTML Integration Check
console.log('\nTest Suite 3: HTML Integration & Element Injections');

function checkHtmlFile(fileName, checks) {
  const content = fs.readFileSync(path.join(ROOT_DIR, fileName), 'utf8');
  checks.forEach(check => {
    assert(check.test(content), `${fileName} -> ${check.desc}`);
  });
}

// Homepage & Index checks
['index.html', 'homepage.html'].forEach(page => {
  checkHtmlFile(page, [
    { test: c => c.includes('css/promotions.css'), desc: 'links css/promotions.css' },
    { test: c => c.includes('js/promotions.js'), desc: 'links js/promotions.js' },
    { test: c => c.includes('id="velora-promo-strip"') || c.includes('class="velora-promo-strip"'), desc: 'contains velora-promo-strip' },
    { test: c => c.includes('class="bogo-promo-hero-section"'), desc: 'contains bogo-promo-hero-section' },
    { test: c => c.includes('id="bogo-promo-visual"'), desc: 'contains #bogo-promo-visual' },
    { test: c => c.includes('class="trending-promo-section"'), desc: 'contains trending-promo-section' },
    { test: c => c.includes('id="trending-promo-mini-grid"'), desc: 'contains #trending-promo-mini-grid' },
    { test: c => c.includes('class="bogo-mini-promo-section"'), desc: 'contains bogo-mini-promo-section' }
  ]);
});

// Shop page checks
checkHtmlFile('shop.html', [
  { test: c => c.includes('css/promotions.css'), desc: 'links css/promotions.css' },
  { test: c => c.includes('js/promotions.js'), desc: 'links js/promotions.js' },
  { test: c => c.includes('class="velora-promo-strip"'), desc: 'contains velora-promo-strip' },
  { test: c => c.includes('class="shop-top-promo-row"'), desc: 'contains shop-top-promo-row duo' },
  { test: c => c.includes('card-bogo') && c.includes('card-trending'), desc: 'contains BOGO and Trending shop promo cards' }
]);

// Product details checks
checkHtmlFile('product.html', [
  { test: c => c.includes('css/promotions.css'), desc: 'links css/promotions.css' },
  { test: c => c.includes('js/promotions.js'), desc: 'links js/promotions.js' },
  { test: c => c.includes('class="velora-promo-strip"'), desc: 'contains velora-promo-strip' },
  { test: c => c.includes('id="product-contextual-promo"'), desc: 'contains #product-contextual-promo container' }
]);

// Wishlist checks
checkHtmlFile('wishlist.html', [
  { test: c => c.includes('css/promotions.css'), desc: 'links css/promotions.css' },
  { test: c => c.includes('js/promotions.js'), desc: 'links js/promotions.js' },
  { test: c => c.includes('class="velora-promo-strip"'), desc: 'contains velora-promo-strip' },
  { test: c => c.includes('class="wishlist-promo-box"'), desc: 'contains wishlist-promo-box' }
]);

// Checkout checks
checkHtmlFile('checkout.html', [
  { test: c => c.includes('css/promotions.css'), desc: 'links css/promotions.css' },
  { test: c => c.includes('js/promotions.js'), desc: 'links js/promotions.js' },
  { test: c => c.includes('class="checkout-discreet-promo"'), desc: 'contains checkout-discreet-promo' }
]);

// Account checks
checkHtmlFile('account.html', [
  { test: c => c.includes('css/promotions.css'), desc: 'links css/promotions.css' },
  { test: c => c.includes('js/promotions.js'), desc: 'links js/promotions.js' },
  { test: c => c.includes('class="velora-promo-strip"'), desc: 'contains velora-promo-strip' }
]);

// 4. Cart Drawer Promo Bar Check
console.log('\nTest Suite 4: Cart Drawer Suggestion Bar');
const cartDrawerJs = fs.readFileSync(path.join(ROOT_DIR, 'js/cart-drawer.js'), 'utf8');
assert(cartDrawerJs.includes('cart-drawer-promo-bar'), 'cart-drawer.js contains cart-drawer-promo-bar in canonical template');
assert(cartDrawerJs.includes('Explore BOGO &amp; Trending picks') || cartDrawerJs.includes('Explore BOGO & Trending picks'), 'cart-drawer.js includes promo text');
assert(cartDrawerJs.includes('pill-bogo') && cartDrawerJs.includes('pill-trending'), 'cart-drawer.js contains BOGO and Trending pill links');

// 5. Order Activity BOGO and Trending Tags Check
console.log('\nTest Suite 5: Live Order Activity Tagging');
const orderActivityJs = fs.readFileSync(path.join(ROOT_DIR, 'js/order-activity.js'), 'utf8');
assert(orderActivityJs.includes('🔥 BOGO PICK'), 'order-activity.js tags 🔥 BOGO PICK');
assert(orderActivityJs.includes('⚡ TRENDING PICK'), 'order-activity.js tags ⚡ TRENDING PICK');
assert(orderActivityJs.includes('displayDurationMs: 10000') || orderActivityJs.includes('rotationIntervalMs: 10000'), 'order-activity.js preserves exact 10s rotation timing');

// 6. Functionality & Logic Evaluation in Sandbox
console.log('\nTest Suite 6: Functional & Logic Validation in Simulated Runtime');
const productsJsContent = fs.readFileSync(path.join(ROOT_DIR, 'js/products.js'), 'utf8');

// Create lightweight mock sandbox
const sandbox = {
  window: {},
  document: {
    createElement: () => ({ setAttribute: () => {}, appendChild: () => {}, innerHTML: '', style: {} }),
    querySelectorAll: () => [],
    getElementById: () => null,
    body: { appendChild: () => {} },
    addEventListener: () => {}
  },
  localStorage: {
    getItem: () => null,
    setItem: () => {}
  },
  sessionStorage: {
    getItem: () => null,
    setItem: () => {}
  },
  location: {
    pathname: '/homepage.html',
    search: '?id=prod_watch_01',
    href: 'http://localhost/homepage.html'
  },
  addEventListener: () => {},
  removeEventListener: () => {},
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id),
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: (id) => clearInterval(id),
  console: console
};
sandbox.window = sandbox;

try {
  const vm = require('vm');
  vm.createContext(sandbox);
  // Execute products.js
  vm.runInContext(productsJsContent, sandbox);
  assert(Array.isArray(sandbox.window.PRODUCTS_DATA) && sandbox.window.PRODUCTS_DATA.length > 0, `PRODUCTS_DATA loaded (${sandbox.window.PRODUCTS_DATA ? sandbox.window.PRODUCTS_DATA.length : 0} products)`);

  // Check Trending items in catalog
  const trendingItems = sandbox.window.PRODUCTS_DATA.filter(p => p.isTrending || p.badgeType === 'trending');
  assert(trendingItems.length > 0, `Catalog contains genuine Trending products (${trendingItems.length} found)`);

  // Verify promotions.js loads without syntax or runtime error
  const promotionsJsContent = fs.readFileSync(path.join(ROOT_DIR, 'js/promotions.js'), 'utf8');
  vm.runInContext(promotionsJsContent, sandbox);
  assert(typeof sandbox.window.VeloraPromotions === 'object', 'VeloraPromotions exported to window');
  assert(typeof sandbox.window.VeloraPromotions.getBogoProducts === 'function', 'VeloraPromotions.getBogoProducts is a callable function');
  assert(typeof sandbox.window.VeloraPromotions.getTrendingProducts === 'function', 'VeloraPromotions.getTrendingProducts is a callable function');

  const liveBogo = sandbox.window.VeloraPromotions.getBogoProducts();
  assert(liveBogo.length > 0, `VeloraPromotions.getBogoProducts returns ${liveBogo.length} valid products without fake records`);

  const liveTrending = sandbox.window.VeloraPromotions.getTrendingProducts();
  assert(liveTrending.length > 0, `VeloraPromotions.getTrendingProducts returns ${liveTrending.length} valid products without fake records`);

} catch (err) {
  assert(false, `Sandbox execution error: ${err.message}`);
}

// 7. Zero Database Write Verification
console.log('\nTest Suite 7: Zero Database Pollution & Security');
const promoJsRaw = fs.readFileSync(path.join(ROOT_DIR, 'js/promotions.js'), 'utf8');
assert(!promoJsRaw.includes('.from(\'orders\').insert') && !promoJsRaw.includes('.insert('), 'promotions.js performs ZERO insert operations to database');
assert(!orderActivityJs.includes('.from(\'orders\').insert') && !orderActivityJs.includes('.from("orders").insert'), 'order-activity.js performs ZERO insert operations to database');

console.log('\n====================================================');
console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
console.log('====================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('\nALL PROMOTIONS TESTS PASSED SUCCESSFULLY! ✅');
  process.exit(0);
}
