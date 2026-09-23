/**
 * scratch/test-sarojini-loading-perf.js
 * Verification Suite for Sarojini Bazaar Catalog Loading Performance & Resilience.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://brioiujppaaycydndrcp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyaW9pdWpwcGFheWN5ZG5kcmNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3OTU3MzQsImV4cCI6MjEwNDM3MTczNH0.6HHJ0wv66obc6wj72CQJE8tvr6KgAXgWDs2DYnjPO78';
const headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY };

console.log('========================================================================');
console.log('=== SAROJINI CATALOG LOADING PERFORMANCE & RESILIENCE TEST ===');
console.log('========================================================================\n');

let totalTests = 0;
let passedTests = 0;

async function test(title, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ ${title}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${title}`);
    console.error(`    ${err.message}`);
  }
}

async function runSuite() {
  // ----------------------------------------------------------------------------
  // Test 1: Live Supabase Parallel Queries with Exact Field Projections
  // ----------------------------------------------------------------------------
  console.log('--- 1. Live Parallel Query Performance & Schema Validation ---');

  await test('Parallel queries complete significantly faster and fetch exact fields', async () => {
    const startTime = Date.now();

    const catFields = 'id,department,name,slug,parent_id,display_order,is_active';
    const prodFields = 'id,category_id,subcategory_id,department,name,slug,brand,price,original_price,discount_percentage,stock,sizes,images,is_featured,is_active,created_at';

    const [catRes, prodRes, csRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/sarojini_categories?is_active=eq.true&select=${catFields}`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/sarojini_products?is_active=eq.true&select=${prodFields}&order=created_at.desc`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/store_settings?key=eq.cross_store_mapping&select=value`, { headers })
    ]);

    const duration = Date.now() - startTime;
    const cats = await catRes.json();
    const prods = await prodRes.json();
    const cs = await csRes.json();

    assert(catRes.ok, 'Categories query must succeed');
    assert(prodRes.ok, 'Products query must succeed');
    assert(csRes.ok, 'Settings query must succeed');

    assert(Array.isArray(cats) && cats.length > 0, `Must return active categories (got ${cats.length})`);
    assert(Array.isArray(prods) && prods.length > 0, `Must return active products (got ${prods.length})`);
    
    // Check that excluded heavy columns are not in payload
    assert(prods[0].description === undefined, 'Heavy description column must not be transferred');
    assert(prods[0].specifications === undefined, 'Heavy specifications column must not be transferred');
    assert(prods[0].shipping_info === undefined, 'Heavy shipping_info column must not be transferred');
    assert(prods[0].return_policy === undefined, 'Heavy return_policy column must not be transferred');

    // Check essential card columns are present
    assert(prods[0].id, 'Product id must be present');
    assert(prods[0].name, 'Product name must be present');
    assert(prods[0].price !== undefined, 'Product price must be present');
    assert(prods[0].department, 'Product department must be present');
    assert(prods[0].images, 'Product images must be present');

    console.log(`    Parallel fetch time: ${duration}ms (Categories: ${cats.length}, Products: ${prods.length})`);
    assert(duration < 2500, `Parallel fetch should complete in a reasonable window (took ${duration}ms)`);
  });

  // ----------------------------------------------------------------------------
  // Test 2: Source Code Verification of Caching, Progressive Rendering & Timeouts
  // ----------------------------------------------------------------------------
  console.log('\n--- 2. Source Code Architecture & Performance Optimizations ---');

  await test('js/sarojini-shop.js implements sessionStorage caching (stale-while-revalidate)', async () => {
    const shopJs = fs.readFileSync(path.join(__dirname, '../js/sarojini-shop.js'), 'utf8');

    assert(shopJs.includes('CATALOG_CACHE_KEY'), 'Must define CATALOG_CACHE_KEY');
    assert(shopJs.includes('sessionStorage.getItem(CATALOG_CACHE_KEY)'), 'Must read from sessionStorage');
    assert(shopJs.includes('sessionStorage.setItem(CATALOG_CACHE_KEY'), 'Must write to sessionStorage');
    assert(shopJs.includes('sarojini_global_cache_invalidated'), 'Must observe admin cache invalidation');
  });

  await test('js/sarojini-shop.js enforces strict 8-second request timeout', async () => {
    const shopJs = fs.readFileSync(path.join(__dirname, '../js/sarojini-shop.js'), 'utf8');

    assert(shopJs.includes('FETCH_TIMEOUT_MS'), 'Must define FETCH_TIMEOUT_MS');
    assert(shopJs.includes('Promise.race'), 'Must race fetch against timeoutPromise');
    assert(shopJs.includes('catalog-retry-btn'), 'Must render retry button on failure');
  });

  await test('js/sarojini-shop.js implements progressive batching & priority hints', async () => {
    const shopJs = fs.readFileSync(path.join(__dirname, '../js/sarojini-shop.js'), 'utf8');

    assert(shopJs.includes('fetchpriority="high"'), 'Above-the-fold cards must have fetchpriority="high"');
    assert(shopJs.includes('loading="eager"'), 'Above-the-fold cards must have loading="eager"');
    assert(shopJs.includes('loading="lazy"'), 'Below-the-fold cards must have loading="lazy"');
    assert(shopJs.includes('BATCH_SIZE'), 'Must define BATCH_SIZE for fast initial paint');
    assert(shopJs.includes('requestAnimationFrame'), 'Must defer non-critical processing via requestAnimationFrame');
  });

  await test('js/sarojini-shop.js intercepts in-page department links for instant switching', async () => {
    const shopJs = fs.readFileSync(path.join(__dirname, '../js/sarojini-shop.js'), 'utf8');

    assert(shopJs.includes('data-dept-nav'), 'Must intercept nav links with data-dept-nav');
    assert(shopJs.includes('history.replaceState') || shopJs.includes('history.pushState'), 'Must update URL smoothly');
  });

  await test('js/sarojini-shop.js prevents duplicate in-flight requests', async () => {
    const shopJs = fs.readFileSync(path.join(__dirname, '../js/sarojini-shop.js'), 'utf8');

    assert(shopJs.includes('inFlightPromise'), 'Must track in-flight fetch promise');
  });

  // ----------------------------------------------------------------------------
  // Test 3: Admin Cache Invalidation Hooks
  // ----------------------------------------------------------------------------
  console.log('\n--- 3. Admin Cache Invalidation Hooks ---');

  await test('Admin product management files invalidate catalog cache on mutations', async () => {
    const adminProductsJs = fs.readFileSync(path.join(__dirname, '../admin/js/admin-sarojini-products.js'), 'utf8');
    const adminAddJs = fs.readFileSync(path.join(__dirname, '../admin/js/admin-sarojini-add-product.js'), 'utf8');

    assert(adminProductsJs.includes('invalidateSarojiniCache'), 'admin-sarojini-products.js must define and call invalidateSarojiniCache');
    assert(adminProductsJs.includes('velora_sarojini_catalog_cache_v1'), 'admin-sarojini-products.js must remove catalog cache');
    assert(adminAddJs.includes('velora_sarojini_catalog_cache_v1'), 'admin-sarojini-add-product.js must remove catalog cache');
  });

  // ----------------------------------------------------------------------------
  // Test 4: Scope Isolation (Main VADI store untouched)
  // ----------------------------------------------------------------------------
  console.log('\n--- 4. Scope Isolation (Main VADI Luxury Store Untouched) ---');

  await test('Main VADI storefront files are completely unaffected', async () => {
    const appJs = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
    const shopHtml = fs.readFileSync(path.join(__dirname, '../shop.html'), 'utf8');

    assert(!appJs.includes('velora_sarojini_catalog_cache_v1'), 'Main app.js must not contain Sarojini catalog cache logic');
    assert(!shopHtml.includes('sarojini-shop.js'), 'Main shop.html must not load sarojini-shop.js');
  });

  console.log(`\n========================================================================`);
  console.log(`RESULTS: ${passedTests}/${totalTests} tests passed.`);
  console.log(`========================================================================\n`);

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

