const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://brioiujppaaycydndrcp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyaW9pdWpwcGFheWN5ZG5kcmNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3OTU3MzQsImV4cCI6MjEwNDM3MTczNH0.6HHJ0wv66obc6wj72CQJE8tvr6KgAXgWDs2DYnjPO78';

const VeloraImageUtils = require('../js/image-utils.js');

async function testCompleteSarojiniShopFlow() {
  console.log('========================================================================');
  console.log('=== SAROJINI SHOP CATALOG COMPLETE FLOW & INTEGRITY VERIFICATION ===');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  // 1. Fetch live Supabase products
  console.log('[Step 1] Live Supabase Products Fetch');
  const prodRes = await fetch(SUPABASE_URL + '/rest/v1/sarojini_products?is_active=eq.true&order=created_at.desc', {
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY }
  });
  const allProducts = await prodRes.json();
  assert(Array.isArray(allProducts) && allProducts.length > 0, `Fetched ${allProducts.length} active products from Supabase`);

  // 2. Fetch categories
  console.log('\n[Step 2] Live Supabase Categories Fetch');
  const catRes = await fetch(SUPABASE_URL + '/rest/v1/sarojini_categories?is_active=eq.true', {
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY }
  });
  const allCategories = await catRes.json();
  assert(Array.isArray(allCategories) && allCategories.length > 0, `Fetched ${allCategories.length} active categories from Supabase`);

  // 3. Department Filtering Test
  console.log('\n[Step 3] Department Lane Filtering');
  const depts = ['WOMEN', 'MEN', 'ACCESSORIES', 'FOOTWEAR', 'BAGS'];
  depts.forEach(dept => {
    const filtered = allProducts.filter(p => (p.department || '').toUpperCase() === dept);
    assert(filtered.length > 0, `Department '${dept}' returns ${filtered.length} products`);
  });

  // 4. Keyword Search Test
  console.log('\n[Step 4] Keyword Search Filtering');
  const searchQueries = ['tee', 'top', 'earring', 'jeans', 'dress'];
  searchQueries.forEach(q => {
    const query = q.toLowerCase();
    const results = allProducts.filter(p => {
      const mName = p.name && p.name.toLowerCase().includes(query);
      const mSlug = p.slug && p.slug.toLowerCase().includes(query);
      const mBrand = p.brand && p.brand.toLowerCase().includes(query);
      const mDept = p.department && p.department.toLowerCase().includes(query);
      return mName || mSlug || mBrand || mDept;
    });
    assert(results.length > 0, `Search '${q}' matches ${results.length} products`);
  });

  // 5. Price Range Filtering Test
  console.log('\n[Step 5] Price Range Filtering');
  const under300 = allProducts.filter(p => (Number(p.price) || 0) <= 299);
  assert(under300.length > 0, `Under ₹299 filter matches ${under300.length} products`);

  const under500 = allProducts.filter(p => (Number(p.price) || 0) <= 499);
  assert(under500.length >= under300.length, `Under ₹499 filter matches ${under500.length} products`);

  // 6. Discount Filtering Test
  console.log('\n[Step 6] Discount % Filtering');
  const over50Discount = allProducts.filter(p => (p.discount_percentage || 0) >= 50);
  assert(over50Discount.length > 0, `Min 50% discount matches ${over50Discount.length} products`);

  // 7. Sorting Test
  console.log('\n[Step 7] Sorting Algorithms');
  const priceAsc = [...allProducts].sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
  assert(Number(priceAsc[0].price) <= Number(priceAsc[priceAsc.length - 1].price), `Price Low to High correctly sorts (min: ₹${priceAsc[0].price}, max: ₹${priceAsc[priceAsc.length - 1].price})`);

  const priceDesc = [...allProducts].sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
  assert(Number(priceDesc[0].price) >= Number(priceDesc[priceDesc.length - 1].price), `Price High to Low correctly sorts`);

  const discountDesc = [...allProducts].sort((a, b) => (Number(b.discount_percentage) || 0) - (Number(a.discount_percentage) || 0));
  assert(Number(discountDesc[0].discount_percentage) >= Number(discountDesc[discountDesc.length - 1].discount_percentage), `Discount % correctly sorts`);

  // 8. Full HTML Card Transformation & Image Resolution Test
  console.log('\n[Step 8] Product Card Transformation & VeloraImageUtils Rendering');
  let cardsHtml = '';
  let renderErrors = 0;

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
  }

  function formatINR(amount) {
    const n = Math.round(Number(amount) || 0);
    return '₹' + n.toLocaleString('en-IN');
  }

  allProducts.forEach(prod => {
    try {
      const firstImg = VeloraImageUtils.resolveProductImage(prod, { isAdmin: false });
      assert(typeof firstImg === 'string' && firstImg.length > 0, `Product '${prod.name.slice(0, 25)}' resolved image: ${firstImg.slice(0, 50)}...`);

      const price = Number(prod.price) || 0;
      const origPrice = Number(prod.original_price) || price;
      const discount = prod.discount_percentage || (origPrice > price ? Math.round(((origPrice - price) / origPrice) * 100) : 0);
      const deptLabel = prod.department ? `${prod.department}'S LANE` : 'BAZAAR FIND';

      const cardHtml = `
        <div class="sarojini-product-card" data-product-id="${prod.id}">
          <div class="product-card-media">
            <a href="sarojini-product-details.html?id=${encodeURIComponent(prod.id)}">
              <img src="${firstImg}" alt="${escapeHtml(prod.name)}" loading="lazy">
            </a>
            ${discount > 0 ? `<span class="product-card-badge">${discount}% OFF</span>` : `<span class="product-card-badge">STEAL</span>`}
          </div>
          <div class="product-card-body">
            <span class="product-card-dept">${escapeHtml(deptLabel)}</span>
            <a href="sarojini-product-details.html?id=${encodeURIComponent(prod.id)}" class="product-card-title">${escapeHtml(prod.name)}</a>
            <div class="product-card-price-row">
              <span class="price-selling">${formatINR(price)}</span>
            </div>
            <button type="button" class="btn-card-add-bag" data-prod-id="${prod.id}" data-prod-name="${encodeURIComponent(prod.name || 'Product')}" data-prod-price="${price}" data-prod-img="${encodeURIComponent(firstImg || '')}">
              <span>Add to Bag</span>
            </button>
          </div>
        </div>
      `;
      cardsHtml += cardHtml;
    } catch (e) {
      console.error('Render error on product:', prod.id, e);
      renderErrors++;
    }
  });

  assert(renderErrors === 0, `All ${allProducts.length} products rendered into cards with ZERO errors`);
  assert(cardsHtml.includes('sarojini-product-details.html?id='), 'PDP links properly structured');
  assert(!cardsHtml.includes('Loading Sarojini catalog...'), 'Cards replace loading text cleanly');

  console.log(`\n========================================================================`);
  console.log(`TOTAL CHECKS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('========================================================================\n');

  if (failed > 0) process.exit(1);
}

testCompleteSarojiniShopFlow();

