const fs = require('fs');
const path = require('path');

console.log("--- STARTING STAGE 11 VERIFICATION ---");

let allPassed = true;
function assert(desc, condition) {
  if (condition) {
    console.log(`[PASS] ${desc}`);
  } else {
    console.error(`[FAIL] ${desc}`);
    allPassed = false;
  }
}

const root = path.resolve(__dirname, '..');

// 1. Check admin/sarojini-dashboard.html and admin/js/admin-sarojini-dashboard.js
const dashHtmlPath = path.join(root, 'admin', 'sarojini-dashboard.html');
assert("admin/sarojini-dashboard.html exists", fs.existsSync(dashHtmlPath));
if (fs.existsSync(dashHtmlPath)) {
  const html = fs.readFileSync(dashHtmlPath, 'utf8');
  assert("Dashboard has stat-sarojini-revenue", html.includes('id="stat-sarojini-revenue"'));
  assert("Dashboard has stat-sarojini-orders", html.includes('id="stat-sarojini-orders"'));
  assert("Dashboard has stat-active-products", html.includes('id="stat-active-products"'));
  assert("Dashboard has stat-low-stock", html.includes('id="stat-low-stock"'));
  assert("Dashboard has stat-total-categories", html.includes('id="stat-total-categories"'));
  assert("Dashboard has recent-orders-tbody", html.includes('id="recent-orders-tbody"'));
  assert("Dashboard includes admin-sarojini-dashboard.js", html.includes('admin-sarojini-dashboard.js'));
}

const dashJsPath = path.join(root, 'admin', 'js', 'admin-sarojini-dashboard.js');
assert("admin/js/admin-sarojini-dashboard.js exists", fs.existsSync(dashJsPath));
if (fs.existsSync(dashJsPath)) {
  const js = fs.readFileSync(dashJsPath, 'utf8');
  assert("Dashboard JS filters by catalog_type === 'sarojini'", js.includes("catalog_type === 'sarojini'"));
  assert("Dashboard JS calculates Sarojini revenue isolatedly", js.includes("sarojiniRevenue +=") || js.includes("sarojiniRevenue"));
  assert("Dashboard JS fetches sarojini_products", js.includes("sarojini_products"));
  assert("Dashboard JS fetches sarojini_categories", js.includes("sarojini_categories"));
}

// 2. Check admin/sarojini-offers.html and admin/js/admin-sarojini-offers.js
const offersHtmlPath = path.join(root, 'admin', 'sarojini-offers.html');
assert("admin/sarojini-offers.html exists", fs.existsSync(offersHtmlPath));
if (fs.existsSync(offersHtmlPath)) {
  const html = fs.readFileSync(offersHtmlPath, 'utf8');
  assert("Offers HTML has offers-container", html.includes('id="offers-container"'));
  assert("Offers HTML has btn-create-offer", html.includes('id="btn-create-offer"'));
  assert("Offers HTML has offer-modal", html.includes('id="offer-modal"'));
  assert("Offers HTML includes admin-sarojini-offers.js", html.includes('admin-sarojini-offers.js'));
}

const offersJsPath = path.join(root, 'admin', 'js', 'admin-sarojini-offers.js');
assert("admin/js/admin-sarojini-offers.js exists", fs.existsSync(offersJsPath));
if (fs.existsSync(offersJsPath)) {
  const js = fs.readFileSync(offersJsPath, 'utf8');
  assert("Offers JS defines DEFAULT_OFFERS", js.includes("DEFAULT_OFFERS"));
  assert("Offers JS handles Under 199 budget tier", js.includes("199"));
  assert("Offers JS handles Under 299 budget tier", js.includes("299"));
  assert("Offers JS handles Under 499 budget tier", js.includes("499"));
  assert("Offers JS interacts with sarojini_offers table / fallback", js.includes("sarojini_offers"));
}

// 3. Check migration file contains wishlist, reviews and order_items shared columns
const migPath = path.join(root, 'supabase', 'migrations', '20260920_create_sarojini_store.sql');
assert("Migration file exists", fs.existsSync(migPath));
if (fs.existsSync(migPath)) {
  const sql = fs.readFileSync(migPath, 'utf8');
  assert("Migration has order_items.sarojini_product_id", sql.includes("ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS sarojini_product_id"));
  assert("Migration has wishlist.sarojini_product_id", sql.includes("ALTER TABLE public.wishlist ADD COLUMN IF NOT EXISTS sarojini_product_id"));
  assert("Migration has reviews.sarojini_product_id", sql.includes("ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS sarojini_product_id"));
}

console.log(allPassed ? "\n>>> ALL STAGE 11 CHECKS PASSED <<<" : "\n>>> STAGE 11 HAS FAILURES <<<");
process.exit(allPassed ? 0 : 1);

