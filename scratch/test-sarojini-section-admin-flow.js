/**
 * End-to-End Verification Suite: Sarojini Bazaar Product Section <-> Admin Panel Connection
 * 
 * Verifies:
 * 1. Admin UI Structure & Components (Tabs, Selectors, Reordering, Search)
 * 2. Customer Frontend Logic (Exact ordered mapping, active filtering, no random fallbacks)
 * 3. Live Supabase Admin Flow:
 *    - Flow 1: Admin selects 6 products -> customer displays exactly those 6 in order
 *    - Flow 2: Admin replaces 1 product -> customer replaces old with new
 *    - Flow 3: Admin reorders products -> customer order updates
 *    - Flow 4: Admin removes product -> customer removes it
 *    - Flow 5: Deactivated product -> customer excludes without random replacement
 *    - Flow 6: Newly created product -> Admin adds -> customer renders with image & details
 *    - Flow 7: Empty state -> customer renders empty state
 *    - Flow 8: Main VADI store sections remain completely unaffected
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SUPABASE_URL = 'https://brioiujppaaycydndrcp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyaW9pdWpwcGFheWN5ZG5kcmNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3OTU3MzQsImV4cCI6MjEwNDM3MTczNH0.6HHJ0wv66obc6wj72CQJE8tvr6KgAXgWDs2DYnjPO78';

let passed = 0;
let failed = 0;

function check(label, condition, details = '') {
  if (condition) {
    console.log(`✔ PASS: ${label} ${details ? '(' + details + ')' : ''}`);
    passed++;
  } else {
    console.error(`✖ FAIL: ${label} ${details ? '(' + details + ')' : ''}`);
    failed++;
  }
}

console.log('================================================================');
console.log('=== SAROJINI SECTION <-> ADMIN PANEL CONNECTION TEST SUITE  ===');
console.log('================================================================\n');

// 1. Static HTML & UI Checks
console.log('--- 1. Admin Panel UI & Structure Checks ---');
const adminHtml = fs.readFileSync(path.join(ROOT, 'admin/homepage-sections.html'), 'utf8');

check('Admin Builder has Store Switcher Tabs (Main VADI vs Sarojini)',
  adminHtml.includes('id="tab-store-main"') && adminHtml.includes('id="tab-store-sarojini"'));

check('Admin Builder has Sarojini badge styling in CSS',
  adminHtml.includes('.type-badge.sarojini_trending'));

check('Admin Builder sidebar has Sarojini Sections link',
  adminHtml.includes('homepage-sections.html?store=sarojini'));

check('Admin Builder sec-type dropdown includes Sarojini Trending option',
  adminHtml.includes('value="sarojini_trending"'));

// Check other Sarojini admin sidebars
const sarProdHtml = fs.readFileSync(path.join(ROOT, 'admin/sarojini-products.html'), 'utf8');
check('Sarojini Products page has Manage Homepage Section button',
  sarProdHtml.includes('homepage-sections.html?store=sarojini'));

const sarDashHtml = fs.readFileSync(path.join(ROOT, 'admin/sarojini-dashboard.html'), 'utf8');
check('Sarojini Dashboard sidebar has Sarojini Sections link',
  sarDashHtml.includes('homepage-sections.html?store=sarojini'));

// 2. Admin Controller JS Logic Checks
console.log('\n--- 2. Admin Controller JS Logic Checks ---');
const adminJs = fs.readFileSync(path.join(ROOT, 'admin/js/admin-homepage-sections.js'), 'utf8');

check('Admin JS loads sarojini_products catalog dependencies',
  adminJs.includes('sarojini_products') && adminJs.includes('state.sarojiniProducts'));

check('Admin JS supports ?store=sarojini URL parameter',
  adminJs.includes('urlParams.get("store") === "sarojini"'));

check('Admin JS has isSarojiniSection discriminator helper',
  adminJs.includes('function isSarojiniSection'));

check('Admin JS has getFilteredSectionsByStore to isolate store sections',
  adminJs.includes('function getFilteredSectionsByStore'));

check('Admin JS has dedicated Sarojini product config sub-panel',
  adminJs.includes('function renderSarojiniProductConfig'));

check('Admin JS supports Up / Down reordering of selected Sarojini products',
  adminJs.includes('btn-sarojini-move-up') && adminJs.includes('btn-sarojini-move-down'));

check('Admin JS supports Removing selected Sarojini products',
  adminJs.includes('btn-sarojini-remove'));

check('Admin JS supports live search filtering of Sarojini products in picker',
  adminJs.includes('sarojini-picker-search') && adminJs.includes('sarojini-picker-dept'));

check('Admin JS captures product_ids in exact ordered sequence on save',
  adminJs.includes('contentCfg.product_ids = Array.isArray(state.modalSelectedProductIds) ? [...state.modalSelectedProductIds] : []'));

check('Admin JS syncs Sarojini section to store_settings for dual-redundancy',
  adminJs.includes('sarojini_featured_section'));

// 3. Customer Storefront JS Logic Checks
console.log('\n--- 3. Customer Storefront JS Logic Checks ---');
const customerJs = fs.readFileSync(path.join(ROOT, 'js/sarojini-bazaar-page.js'), 'utf8');

check('Customer JS queries Sarojini trending section from Supabase',
  customerJs.includes('or(\'id.eq.22222222-2222-4222-a222-000000000001,section_type.eq.sarojini_trending\')') ||
  customerJs.includes('section_type.eq.sarojini_trending'));

check('Customer JS queries ONLY explicitly configured product_ids',
  customerJs.includes('.in(\'id\', configuredProductIds)'));

check('Customer JS strictly filters for active products',
  customerJs.includes('.eq(\'is_active\', true)'));

check('Customer JS maps products in the EXACT order configured by Admin',
  customerJs.includes('configuredProductIds') && customerJs.includes('productMap.get(String(id))'));

check('Customer JS renders clean empty state when no products configured (no random fallbacks)',
  customerJs.includes('renderEmptyState()') && customerJs.includes('No Finds Curated Yet'));

check('Customer JS decouples budget steals grid to independent query',
  customerJs.includes('loadBudgetSarojiniProducts'));

check('Customer JS listens for velora:homepage-sections-updated live events',
  customerJs.includes('velora:homepage-sections-updated'));

// 4. Live Supabase Backend & End-to-End Flow Tests
console.log('\n--- 4. Live Supabase Backend & Customer Flow Tests ---');

async function runLiveTests() {
  try {
    // A. Authenticate
    const authRes = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'support@vadistudio.com', password: 'VadiSupport2026!' })
    });
    const authData = await authRes.json();
    const token = authData.access_token;
    const adminHeaders = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };

    // B. Fetch 7 active Sarojini products
    const prodRes = await fetch(SUPABASE_URL + '/rest/v1/sarojini_products?select=id,name,price,department,is_active,images&order=created_at.desc&limit=10', {
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + token }
    });
    const allSarojiniProds = await prodRes.json();
    check('Supabase has at least 6 active Sarojini products', allSarojiniProds.length >= 6, `Count: ${allSarojiniProds.length}`);

    const p1 = allSarojiniProds[0];
    const p2 = allSarojiniProds[1];
    const p3 = allSarojiniProds[2];
    const p4 = allSarojiniProds[3];
    const p5 = allSarojiniProds[4];
    const p6 = allSarojiniProds[5];
    const p7 = allSarojiniProds[6] || allSarojiniProds[0];

    // Helper: Customer storefront simulation function matching js/sarojini-bazaar-page.js
    async function simulateCustomerStorefrontFetch() {
      // 1. Fetch section
      const sRes = await fetch(SUPABASE_URL + '/rest/v1/homepage_sections?or=(id.eq.22222222-2222-4222-a222-000000000001,section_type.eq.sarojini_trending)&select=*&limit=1', {
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY }
      });
      const sections = await sRes.json();
      const sec = sections[0];
      if (!sec || sec.is_active === false) return { empty: true, products: [] };

      const cfg = sec.content_config || {};
      const configuredProductIds = Array.isArray(cfg.product_ids) ? cfg.product_ids.filter(Boolean) : [];
      if (configuredProductIds.length === 0) return { empty: true, products: [] };

      // 2. Fetch products by IDs
      const pRes = await fetch(SUPABASE_URL + `/rest/v1/sarojini_products?id=in.(${configuredProductIds.join(',')})&is_active=eq.true&select=*`, {
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY }
      });
      const fetched = await pRes.json();
      if (!Array.isArray(fetched) || fetched.length === 0) return { empty: true, products: [] };

      // 3. Preserve order
      const map = new Map();
      fetched.forEach(p => map.set(String(p.id), p));
      const ordered = configuredProductIds.map(id => map.get(String(id))).filter(Boolean).slice(0, cfg.limit || 6);

      return { empty: ordered.length === 0, products: ordered, section: sec };
    }

    // Helper: Admin save section
    async function adminSaveSection(productIds, title = 'Trending Sarojini Finds', isActive = true) {
      const payload = {
        id: '22222222-2222-4222-a222-000000000001',
        section_type: 'sarojini_trending',
        title: title,
        subtitle: 'Fresh streetwear drops, viral tops, and daily staples handpicked this week.',
        is_active: isActive,
        display_order: 1,
        background_config: { theme: 'light', padding: 'standard' },
        content_config: {
          catalog_type: 'sarojini',
          source: 'specific',
          columns: 6,
          limit: 6,
          product_ids: productIds
        },
        updated_at: new Date().toISOString()
      };

      const res = await fetch(SUPABASE_URL + '/rest/v1/homepage_sections?id=eq.22222222-2222-4222-a222-000000000001', {
        method: 'PATCH',
        headers: adminHeaders,
        body: JSON.stringify(payload)
      });
      return res.status;
    }

    // TEST FLOW 1: Select 6 specific products [p1, p2, p3, p4, p5, p6]
    console.log('\n--- FLOW 1: Admin selects 6 specific products -> Customer site displays exactly 6 in order ---');
    const initial6 = [p1.id, p2.id, p3.id, p4.id, p5.id, p6.id];
    await adminSaveSection(initial6);

    const f1 = await simulateCustomerStorefrontFetch();
    check('Customer renders exactly 6 products', f1.products.length === 6, `Got ${f1.products.length}`);
    check('Customer products match exact Admin configured IDs in order',
      f1.products.map(p => p.id).join(',') === initial6.join(','),
      `Expected: ${initial6.slice(0, 3).join(',')}...`);

    // TEST FLOW 2: Replace 1 selected product
    console.log('\n--- FLOW 2: Admin replaces 1 selected product -> Customer replaces old with new ---');
    // Replace p2 with p7 at index 1
    const replacedList = [p1.id, p7.id, p3.id, p4.id, p5.id, p6.id];
    await adminSaveSection(replacedList);

    const f2 = await simulateCustomerStorefrontFetch();
    check('Customer product list contains new product (p7) at index 1', f2.products[1]?.id === p7.id);
    check('Customer product list does NOT contain replaced product (p2)', !f2.products.some(p => p.id === p2.id));

    // TEST FLOW 3: Reorder products
    console.log('\n--- FLOW 3: Admin reorders products -> Customer display order updates ---');
    // Reverse first two items: [p7, p1, p3, p4, p5, p6]
    const reorderedList = [p7.id, p1.id, p3.id, p4.id, p5.id, p6.id];
    await adminSaveSection(reorderedList);

    const f3 = await simulateCustomerStorefrontFetch();
    check('Customer product at index 0 is now p7', f3.products[0]?.id === p7.id);
    check('Customer product at index 1 is now p1', f3.products[1]?.id === p1.id);

    // TEST FLOW 4: Remove a product
    console.log('\n--- FLOW 4: Admin removes a product -> Customer product count decreases ---');
    // Remove p6: [p7, p1, p3, p4, p5]
    const removedList = [p7.id, p1.id, p3.id, p4.id, p5.id];
    await adminSaveSection(removedList);

    const f4 = await simulateCustomerStorefrontFetch();
    check('Customer displays exactly 5 products after removal', f4.products.length === 5);
    check('Removed product (p6) is no longer on customer storefront', !f4.products.some(p => p.id === p6.id));

    // TEST FLOW 5: Deactivate a selected product in sarojini_products
    console.log('\n--- FLOW 5: Product is deactivated -> Customer excludes it with NO random fallback ---');
    // Deactivate p1 in sarojini_products
    await fetch(SUPABASE_URL + `/rest/v1/sarojini_products?id=eq.${p1.id}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ is_active: false })
    });

    const f5 = await simulateCustomerStorefrontFetch();
    check('Customer displays 4 products (deactivated p1 excluded)', f5.products.length === 4);
    check('Deactivated p1 is not displayed', !f5.products.some(p => p.id === p1.id));
    check('No random database product was silently substituted', 
      f5.products.every(p => [p7.id, p3.id, p4.id, p5.id].includes(p.id)));

    // Reactivate p1
    await fetch(SUPABASE_URL + `/rest/v1/sarojini_products?id=eq.${p1.id}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ is_active: true })
    });

    // TEST FLOW 6: Newly created Sarojini product
    console.log('\n--- FLOW 6: Newly created Sarojini product -> Admin selects -> Customer displays it ---');
    const newTestSlug = 'test-sarojini-item-' + Date.now();
    const newProdPayload = {
      name: 'Automated Test Street Shacket',
      slug: newTestSlug,
      brand: 'Sarojini Surplus',
      department: 'MEN',
      price: 499,
      original_price: 1299,
      discount_percentage: 62,
      stock: 20,
      images: ['assets/sarojni/prod-1-graphic-tee.png'],
      is_active: true
    };

    const newProdRes = await fetch(SUPABASE_URL + '/rest/v1/sarojini_products', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify(newProdPayload)
    });
    const createdProds = await newProdRes.json();
    const createdProd = Array.isArray(createdProds) ? createdProds[0] : createdProds;
    check('Newly created Sarojini product saved in database', !!createdProd?.id);

    if (createdProd?.id) {
      // Add as first product: [createdProd.id, p1.id, p2.id, p3.id, p4.id, p5.id]
      const withNewList = [createdProd.id, p1.id, p2.id, p3.id, p4.id, p5.id];
      await adminSaveSection(withNewList);

      const f6 = await simulateCustomerStorefrontFetch();
      check('Customer displays newly created product at index 0', f6.products[0]?.id === createdProd.id);
      check('Customer displays correct product name', f6.products[0]?.name === 'Automated Test Street Shacket');
      check('Customer displays correct price (₹499)', Number(f6.products[0]?.price) === 499);
      check('Customer displays correct department (MEN)', f6.products[0]?.department === 'MEN');

      // Cleanup test product
      await fetch(SUPABASE_URL + `/rest/v1/sarojini_products?id=eq.${createdProd.id}`, {
        method: 'DELETE',
        headers: adminHeaders
      });
    }

    // TEST FLOW 7: Empty state verification
    console.log('\n--- FLOW 7: Empty state verification (No products or inactive section) ---');
    await adminSaveSection([]);
    const f7 = await simulateCustomerStorefrontFetch();
    check('When no products configured, customer returns empty state', f7.empty === true && f7.products.length === 0);

    // TEST FLOW 8: Restore standard 6 products & Verify Main VADI isolation
    console.log('\n--- FLOW 8: Restore standard 6 products & Verify Main VADI isolation ---');
    const final6 = [p1.id, p2.id, p3.id, p4.id, p5.id, p6.id];
    await adminSaveSection(final6);

    const f8 = await simulateCustomerStorefrontFetch();
    check('Restored standard 6 Sarojini products', f8.products.length === 6);

    // Query Main VADI sections
    const mainSectionsRes = await fetch(SUPABASE_URL + '/rest/v1/homepage_sections?section_type=neq.sarojini_trending&select=*&order=display_order.asc', {
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY }
    });
    const mainSections = await mainSectionsRes.json();
    check('Main VADI sections remain intact (17 sections)', mainSections.length === 17, `Count: ${mainSections.length}`);
    check('Main VADI hero section intact', mainSections.some(s => s.section_type === 'hero'));
    check('Main VADI trending section intact', mainSections.some(s => s.section_type === 'trending'));
    check('Main VADI deals section intact', mainSections.some(s => s.section_type === 'deals'));
    check('Main VADI bogo section intact', mainSections.some(s => s.section_type === 'bogo'));

    console.log('\n================================================================');
    console.log(`=== SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
    console.log('================================================================\n');

    if (failed > 0) process.exit(1);

  } catch (err) {
    console.error('Fatal live test error:', err);
    process.exit(1);
  }
}

runLiveTests();

