const fs = require('fs');
const path = require('path');

const ROOT = 'c:/Users/saanv/OneDrive/Desktop/Website/webu';

async function runTestSuite() {
  console.log('=================================================================');
  console.log('=== SAROJINI BAZAAR REDESIGN & UPGRADE VERIFICATION TEST SUITE ===');
  console.log('=================================================================\n');

  let passed = 0;
  let failed = 0;

  function check(desc, condition, detail = '') {
    if (condition) {
      console.log(`✔ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`✖ FAIL: ${desc} ${detail ? `(${detail})` : ''}`);
      failed++;
    }
  }

  // --------------------------------------------------------------------------
  // TEST 1: Check Core HTML and CSS Files
  // --------------------------------------------------------------------------
  console.log('--- 1. Verifying Core Storefront Files & Design System ---');
  
  const filesToCheck = [
    'sarojini-bazaar.html',
    'sarojini-shop.html',
    'sarojini-product-details.html',
    'css/sarojini-bazaar-page.css',
    'css/sarojini-shop.css',
    'css/sarojini-product-details.css',
    'js/sarojini-bazaar-page.js',
    'js/sarojini-shop.js',
    'js/sarojini-product-details.js'
  ];

  filesToCheck.forEach(f => {
    const p = path.join(ROOT, f);
    check(`File exists: ${f}`, fs.existsSync(p));
  });

  // Check Design System Tokens in css/sarojini-bazaar-page.css
  const mainCss = fs.readFileSync(path.join(ROOT, 'css/sarojini-bazaar-page.css'), 'utf8');
  check('CSS defines --bazaar-bg warm paper palette', mainCss.includes('--bazaar-bg: #faf7f2'));
  check('CSS defines --bazaar-terracotta accent', mainCss.includes('--bazaar-terracotta: #9e2a2b'));
  check('CSS defines --font-serif Playfair Display', mainCss.includes('--font-serif: \'Playfair Display\''));
  check('CSS defines --font-hand Caveat', mainCss.includes('--font-hand: \'Caveat\''));
  check('CSS has overflow-x prevention', mainCss.includes('overflow-x: hidden'));

  // --------------------------------------------------------------------------
  // TEST 2: sarojini-bazaar.html Structure & Visual Identity
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Verifying sarojini-bazaar.html Structure & Identity ---');
  const bzHtml = fs.readFileSync(path.join(ROOT, 'sarojini-bazaar.html'), 'utf8');

  check('Includes Google Fonts (Playfair Display & Caveat & Plus Jakarta Sans)', 
    bzHtml.includes('Playfair+Display') && bzHtml.includes('Caveat') && bzHtml.includes('Plus+Jakarta+Sans'));
  check('Has dynamic announcement bar container (#sarojini-top-announcement)', 
    bzHtml.includes('id="sarojini-top-announcement"'));
  check('Has refined VADI + Sarojini Bazaar brand emblem', 
    bzHtml.includes('class="sarojini-brand-logo"') && bzHtml.includes('Sarojini Bazaar'));
  check('Has Main Store switcher link in nav', 
    bzHtml.includes('nav-main-store') && bzHtml.includes('Main Store'));
  check('Has mobile category strip (.sarojini-mobile-dept-strip)', 
    bzHtml.includes('class="sarojini-mobile-dept-strip"'));
  check('Has authentic Delhi street-fashion hero headline', 
    bzHtml.includes('Delhi\'s Iconic Street Bazaar') && bzHtml.includes('Curated &amp; Delivered'));
  check('Has authentic value propositions strip', 
    bzHtml.includes('Real Street Rates') && bzHtml.includes('Every Piece Checked') && bzHtml.includes('Open Box Delivery') && bzHtml.includes('7-Day Easy Returns'));
  check('Has Shop By Department section with 7 Bazaar Lanes', 
    bzHtml.includes('Women\'s Lane') && bzHtml.includes('Men\'s Lane') && bzHtml.includes('Accessories Corner') && 
    bzHtml.includes('Sneaker Street') && bzHtml.includes('Bag Corner') && bzHtml.includes('Jewellery Lane') && bzHtml.includes('Cap Corner'));
  check('Has Budget Deals Bar with price pills', 
    bzHtml.includes('Under ₹199') && bzHtml.includes('Under ₹299') && bzHtml.includes('Under ₹499'));
  check('Has Trending Sarojini Finds dynamic grid container', 
    bzHtml.includes('id="trending-products-grid"'));
  check('Has Under ₹299 Specials dynamic grid container', 
    bzHtml.includes('id="budget-products-grid"'));
  check('Has Weekly Refresh Spotlight section', 
    bzHtml.includes('New Street Drops Every Friday'));
  check('Has Curated Footer with quality guarantees', 
    bzHtml.includes('class="sarojini-footer"') && bzHtml.includes('Quality Guarantee'));
  check('Links core scripts including ads-engine.js and wishlist-service.js', 
    bzHtml.includes('js/ads-engine.js') && bzHtml.includes('js/wishlist-service.js') && bzHtml.includes('js/cart-drawer.js'));

  // --------------------------------------------------------------------------
  // TEST 3: sarojini-shop.html Catalog & Filters
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Verifying sarojini-shop.html Catalog & Navigation ---');
  const shopHtml = fs.readFileSync(path.join(ROOT, 'sarojini-shop.html'), 'utf8');

  check('Catalog includes Google Fonts (Playfair Display & Caveat)', 
    shopHtml.includes('Playfair+Display') && shopHtml.includes('Caveat'));
  check('Catalog has dynamic announcement bar', 
    shopHtml.includes('id="sarojini-top-announcement"'));
  check('Catalog has department tabs (#catalog-dept-tabs)', 
    shopHtml.includes('id="catalog-dept-tabs"'));
  check('Catalog has subcategory chips container (#subcat-chips-bar)', 
    shopHtml.includes('id="subcat-chips-bar"'));
  check('Catalog has filters sidebar (#catalog-filters-sidebar)', 
    shopHtml.includes('id="catalog-filters-sidebar"'));
  check('Catalog has price range radio filters', 
    shopHtml.includes('name="price-filter"'));
  check('Catalog has discount filters', 
    shopHtml.includes('name="discount-filter"'));
  check('Catalog has product grid (#catalog-products-grid)', 
    shopHtml.includes('id="catalog-products-grid"'));
  check('Catalog links js/sarojini-shop.js', 
    shopHtml.includes('js/sarojini-shop.js'));

  // --------------------------------------------------------------------------
  // TEST 4: sarojini-product-details.html PDP
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Verifying sarojini-product-details.html PDP ---');
  const pdpHtml = fs.readFileSync(path.join(ROOT, 'sarojini-product-details.html'), 'utf8');

  check('PDP includes Google Fonts (Playfair Display & Caveat)', 
    pdpHtml.includes('Playfair+Display') && pdpHtml.includes('Caveat'));
  check('PDP has dynamic announcement bar', 
    pdpHtml.includes('id="sarojini-top-announcement"'));
  check('PDP has refined brand emblem and directory nav', 
    pdpHtml.includes('class="sarojini-brand-logo"') && pdpHtml.includes('sarojini-mobile-dept-strip'));
  check('PDP has product image gallery container', 
    pdpHtml.includes('id="pdp-main-img"') && pdpHtml.includes('id="pdp-thumbnails-strip"'));
  check('PDP has price presentation with savings badge', 
    pdpHtml.includes('id="pdp-selling-price"') && pdpHtml.includes('id="pdp-save-badge"'));
  check('PDP has payment options selector (online vs advance COD)', 
    pdpHtml.includes('card-pay-online') && pdpHtml.includes('card-pay-cod'));
  check('PDP has related recommendations grid (#pdp-related-grid)', 
    pdpHtml.includes('id="pdp-related-grid"'));
  check('PDP links js/sarojini-product-details.js', 
    pdpHtml.includes('js/sarojini-product-details.js'));

  // --------------------------------------------------------------------------
  // TEST 5: Controller Logic & Zero Hardcoded Data
  // --------------------------------------------------------------------------
  console.log('\n--- 5. Verifying JS Controllers & Backend Dynamic Queries ---');
  const bzJs = fs.readFileSync(path.join(ROOT, 'js/sarojini-bazaar-page.js'), 'utf8');
  const shopJs = fs.readFileSync(path.join(ROOT, 'js/sarojini-shop.js'), 'utf8');
  const pdpJs = fs.readFileSync(path.join(ROOT, 'js/sarojini-product-details.js'), 'utf8');

  check('sarojini-bazaar-page.js queries Supabase sarojini_products', 
    bzJs.includes(".from('sarojini_products')") || bzJs.includes('.from("sarojini_products")'));
  check('sarojini-bazaar-page.js queries Supabase banners for announcements', 
    bzJs.includes(".from('banners')") || bzJs.includes('.from("banners")'));
  check('sarojini-bazaar-page.js connects to VadiWishlist', 
    bzJs.includes('window.VadiWishlist.toggle') && bzJs.includes('window.VadiWishlist.has'));
  check('sarojini-bazaar-page.js connects to CartDrawer with catalog_type: "sarojini"', 
    bzJs.includes('window.CartDrawer.addItem') && bzJs.includes("catalog_type: 'sarojini'"));

  check('sarojini-shop.js queries Supabase sarojini_products and sarojini_categories', 
    shopJs.includes('sarojini_products') && shopJs.includes('sarojini_categories'));
  check('sarojini-shop.js renders subcategory chips dynamically', 
    shopJs.includes('renderSubcategoryChips') && shopJs.includes('deptCats'));
  check('sarojini-shop.js connects to VadiWishlist and CartDrawer', 
    shopJs.includes('VadiWishlist.toggle') && shopJs.includes('CartDrawer.addItem'));

  check('sarojini-product-details.js queries sarojini_products table', 
    pdpJs.includes('sarojini_products'));
  check('sarojini-product-details.js sets catalog_type: "sarojini" on cart items', 
    pdpJs.includes("catalog_type: 'sarojini'"));
  check('sarojini-product-details.js wires both wishlist buttons in sync', 
    pdpJs.includes('btn-toggle-wishlist') && pdpJs.includes('btn-pdp-wishlist'));

  // --------------------------------------------------------------------------
  // TEST 6: Live Supabase Backend Reachability
  // --------------------------------------------------------------------------
  console.log('\n--- 6. Verifying Live Supabase Data Connectivity ---');
  const clientFilePath = path.join(ROOT, 'js/supabaseClient.js');
  const clientFile = fs.readFileSync(clientFilePath, 'utf8');
  const url = clientFile.match(/SUPABASE_PROJECT_URL\s*=\s*['"]([^'"]+)['"]/)[1].replace(/\/$/, '');
  const anonKey = clientFile.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)['"]/)[1];

  const headers = { apikey: anonKey, Authorization: `Bearer ${anonKey}` };

  try {
    const prodsRes = await fetch(`${url}/rest/v1/sarojini_products?select=id,name,price,department&is_active=eq.true`, { headers });
    const prods = await prodsRes.json();
    check('Supabase sarojini_products table returns active products', Array.isArray(prods) && prods.length > 0, `Found ${prods.length} products`);

    const catsRes = await fetch(`${url}/rest/v1/sarojini_categories?select=id,name,department&is_active=eq.true`, { headers });
    const cats = await catsRes.json();
    check('Supabase sarojini_categories table returns active categories', Array.isArray(cats) && cats.length > 0, `Found ${cats.length} categories`);

    const bannersRes = await fetch(`${url}/rest/v1/banners?select=id,title,placement&is_active=eq.true`, { headers });
    const banners = await bannersRes.json();
    check('Supabase banners table reachable', Array.isArray(banners), `Found ${banners.length} banners`);
  } catch (ex) {
    check('Supabase API reachable', false, ex.message);
  }

  // --------------------------------------------------------------------------
  // TEST 7: Responsive Mobile Breakpoints & Layout Safety
  // --------------------------------------------------------------------------
  console.log('\n--- 7. Verifying Responsive Layout Safety ---');
  const bzCss = fs.readFileSync(path.join(ROOT, 'css/sarojini-bazaar-page.css'), 'utf8');
  check('Has mobile media query for max-width: 768px', bzCss.includes('@media (max-width: 768px)'));
  check('Has mobile media query for max-width: 480px', bzCss.includes('@media (max-width: 480px)'));
  check('Mobile category navigation displays on mobile breakpoints', bzCss.includes('.sarojini-mobile-dept-strip {\n    display: block;\n  }'));
  check('Product grid switches to 2-column on mobile', bzCss.includes('grid-template-columns: repeat(2, 1fr)'));

  console.log('\n=================================================================');
  console.log(`=== SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
  console.log('=================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

