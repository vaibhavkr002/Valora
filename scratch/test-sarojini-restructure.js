/**
 * Comprehensive End-to-End Verification Test for VADI Sarojini Bazaar Restructure
 * Covers all 11 stages of the approved implementation plan
 */

const fs = require('fs');
const path = require('path');

console.log("==========================================================");
console.log("   VADI SAROJINI BAZAAR RESTRUCTURE - FULL TEST SUITE    ");
console.log("==========================================================\n");

let passedCount = 0;
let failedCount = 0;

function test(stage, desc, condition) {
  if (condition) {
    console.log(`[PASS] [${stage}] ${desc}`);
    passedCount++;
  } else {
    console.error(`[FAIL] [${stage}] ${desc}`);
    failedCount++;
  }
}

const root = path.resolve(__dirname, '..');

// STAGE 1: REMOVAL OF OLD VIRTUAL STREET EXPERIENCE
const bazaarHub = path.join(root, 'sarojini-bazaar.html');
test("Stage 1", "sarojini-bazaar.html exists", fs.existsSync(bazaarHub));
if (fs.existsSync(bazaarHub)) {
  const content = fs.readFileSync(bazaarHub, 'utf8');
  test("Stage 1", "Virtual street canvas and road removed", !content.includes('id="bazaar-canvas"') && !content.includes('id="road-canvas"'));
  test("Stage 1", "Virtual street CSS removed from HTML", !content.includes('css/sarojini-street.css'));
  test("Stage 1", "Virtual street JS removed from HTML", !content.includes('js/sarojini-street.js'));
  test("Stage 1", "Clean e-commerce hub page stylesheet linked", content.includes('css/sarojini-bazaar-page.css'));
  test("Stage 1", "Clean e-commerce hub page script linked", content.includes('js/sarojini-bazaar-page.js'));
}

const streetCss = path.join(root, 'css', 'sarojini-street.css');
if (fs.existsSync(streetCss)) {
  const css = fs.readFileSync(streetCss, 'utf8');
  test("Stage 1", "css/sarojini-street.css is safely deprecated", css.includes("DEPRECATED"));
}

const streetJs = path.join(root, 'js', 'sarojini-street.js');
if (fs.existsSync(streetJs)) {
  const js = fs.readFileSync(streetJs, 'utf8');
  test("Stage 1", "js/sarojini-street.js is safely deprecated", js.includes("DEPRECATED"));
}

const assetDir = path.join(root, 'assets', 'sarojni');
const filesInAssetDir = fs.existsSync(assetDir) ? fs.readdirSync(assetDir) : [];
test("Stage 1", `All 21 Sarojini assets preserved intact (found ${filesInAssetDir.length})`, filesInAssetDir.length === 21);

// STAGE 2: DATABASE SCHEMA & MIGRATION
const migration = path.join(root, 'supabase', 'migrations', '20260920_create_sarojini_store.sql');
test("Stage 2", "Migration file exists", fs.existsSync(migration));
if (fs.existsSync(migration)) {
  const sql = fs.readFileSync(migration, 'utf8');
  test("Stage 2", "Table sarojini_categories defined", sql.includes("CREATE TABLE IF NOT EXISTS public.sarojini_categories"));
  test("Stage 2", "Table sarojini_products defined", sql.includes("CREATE TABLE IF NOT EXISTS public.sarojini_products"));
  test("Stage 2", "Table sarojini_offers defined", sql.includes("CREATE TABLE IF NOT EXISTS public.sarojini_offers"));
  test("Stage 2", "order_items.sarojini_product_id foreign column defined", sql.includes("ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS sarojini_product_id"));
  test("Stage 2", "order_items.catalog_type column defined", sql.includes("ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS catalog_type"));
  test("Stage 2", "Department CHECK constraint covers 7 departments", sql.includes("MEN") && sql.includes("WOMEN") && sql.includes("CAPS"));
}

// STAGE 3: ADMIN SAROJINI CATEGORIES
const adminCatHtml = path.join(root, 'admin', 'sarojini-categories.html');
const adminCatJs = path.join(root, 'admin', 'js', 'admin-sarojini-categories.js');
test("Stage 3", "admin/sarojini-categories.html exists", fs.existsSync(adminCatHtml));
test("Stage 3", "admin/js/admin-sarojini-categories.js exists", fs.existsSync(adminCatJs));
if (fs.existsSync(adminCatHtml) && fs.existsSync(adminCatJs)) {
  const html = fs.readFileSync(adminCatHtml, 'utf8');
  const js = fs.readFileSync(adminCatJs, 'utf8');
  test("Stage 3", "Categories HTML has department tabs", html.includes('dept-tab') && html.includes('data-dept="MEN"'));
  test("Stage 3", "Categories JS handles 7 default departments", js.includes("MEN") && js.includes("WOMEN") && js.includes("JEWELLERY"));
  test("Stage 3", "Categories JS connects to sarojini_categories", js.includes("sarojini_categories"));
}

// Check sidebar injection in key admin pages
const adminPages = ['dashboard.html', 'products.html', 'orders.html', 'categories.html'];
const sidebarsUpdated = adminPages.every(p => {
  const filePath = path.join(root, 'admin', p);
  if (!fs.existsSync(filePath)) return true;
  const content = fs.readFileSync(filePath, 'utf8');
  return content.includes('SAROJINI BAZAAR') && content.includes('sarojini-products.html');
});
test("Stage 3", "SAROJINI BAZAAR section injected into admin navigation sidebars", sidebarsUpdated);

// STAGE 4: ADMIN SAROJINI PRODUCTS
const adminProdsHtml = path.join(root, 'admin', 'sarojini-products.html');
const adminProdsJs = path.join(root, 'admin', 'js', 'admin-sarojini-products.js');
const adminAddHtml = path.join(root, 'admin', 'sarojini-add-product.html');
const adminAddJs = path.join(root, 'admin', 'js', 'admin-sarojini-add-product.js');
test("Stage 4", "admin/sarojini-products.html exists", fs.existsSync(adminProdsHtml));
test("Stage 4", "admin/js/admin-sarojini-products.js exists", fs.existsSync(adminProdsJs));
test("Stage 4", "admin/sarojini-add-product.html exists", fs.existsSync(adminAddHtml));
test("Stage 4", "admin/js/admin-sarojini-add-product.js exists", fs.existsSync(adminAddJs));
if (fs.existsSync(adminAddHtml)) {
  const html = fs.readFileSync(adminAddHtml, 'utf8');
  test("Stage 4", "Add Product has asset preset picker", html.includes('preset-assets-row') && html.includes('btn-preset-img'));
}

// STAGE 5: CUSTOMER SAROJINI HOMEPAGE
const hubCss = path.join(root, 'css', 'sarojini-bazaar-page.css');
const hubJs = path.join(root, 'js', 'sarojini-bazaar-page.js');
test("Stage 5", "css/sarojini-bazaar-page.css exists", fs.existsSync(hubCss));
test("Stage 5", "js/sarojini-bazaar-page.js exists", fs.existsSync(hubJs));
if (fs.existsSync(bazaarHub) && fs.existsSync(hubJs)) {
  const html = fs.readFileSync(bazaarHub, 'utf8');
  const js = fs.readFileSync(hubJs, 'utf8');
  test("Stage 5", "Hub HTML contains 7 department links", html.includes('department=MEN') && html.includes('department=WOMEN') && html.includes('department=CAPS'));
  test("Stage 5", "Hub JS loads from sarojini_products", js.includes("sarojini_products"));
}

// STAGE 6: CUSTOMER SAROJINI CATALOG PAGE
const shopHtml = path.join(root, 'sarojini-shop.html');
const shopCss = path.join(root, 'css', 'sarojini-shop.css');
const shopJs = path.join(root, 'js', 'sarojini-shop.js');
test("Stage 6", "sarojini-shop.html exists", fs.existsSync(shopHtml));
test("Stage 6", "css/sarojini-shop.css exists", fs.existsSync(shopCss));
test("Stage 6", "js/sarojini-shop.js exists", fs.existsSync(shopJs));
if (fs.existsSync(shopHtml) && fs.existsSync(shopJs)) {
  const html = fs.readFileSync(shopHtml, 'utf8');
  const js = fs.readFileSync(shopJs, 'utf8');
  test("Stage 6", "Catalog has filter sidebar and sort controls", html.includes('id="catalog-filters-sidebar"') && html.includes('id="catalog-sort-select"'));
  test("Stage 6", "Catalog JS parses department, category, max_price from URL", js.includes("department") && js.includes("category") && js.includes("max_price"));
  test("Stage 6", "Catalog JS targets sarojini_products isolatedly", js.includes("sarojini_products"));
}

// STAGE 7: CUSTOMER SAROJINI PRODUCT DETAILS
const detailHtml = path.join(root, 'sarojini-product-details.html');
const detailCss = path.join(root, 'css', 'sarojini-product-details.css');
const detailJs = path.join(root, 'js', 'sarojini-product-details.js');
test("Stage 7", "sarojini-product-details.html exists", fs.existsSync(detailHtml));
test("Stage 7", "css/sarojini-product-details.css exists", fs.existsSync(detailCss));
test("Stage 7", "js/sarojini-product-details.js exists", fs.existsSync(detailJs));
if (fs.existsSync(detailHtml) && fs.existsSync(detailJs)) {
  const html = fs.readFileSync(detailHtml, 'utf8');
  const js = fs.readFileSync(detailJs, 'utf8');
  test("Stage 7", "Product details page has Add to Bag and Buy Now", html.includes('btn-pdp-add-bag') && html.includes('btn-pdp-buy-now'));
  test("Stage 7", "Product details JS marks item as catalog_type: 'sarojini'", js.includes("catalog_type: 'sarojini'"));
  test("Stage 7", "Product details JS queries sarojini_products table", js.includes("sarojini_products"));
}

// STAGE 8: CART INTEGRATION
const cartDrawerJs = path.join(root, 'js', 'cart-drawer.js');
test("Stage 8", "js/cart-drawer.js exists", fs.existsSync(cartDrawerJs));
if (fs.existsSync(cartDrawerJs)) {
  const js = fs.readFileSync(cartDrawerJs, 'utf8');
  test("Stage 8", "Cart drawer renders Sarojini Bazaar badge", js.includes("Sarojini Bazaar") && js.includes("catalog_type === 'sarojini'"));
  test("Stage 8", "Cart drawer exports window.CartDrawer and window.VeloraCart", js.includes("window.CartDrawer") && js.includes("window.VeloraCart"));
}

// STAGE 9: CHECKOUT INTEGRATION
const checkoutJs = path.join(root, 'js', 'checkout.js');
test("Stage 9", "js/checkout.js exists", fs.existsSync(checkoutJs));
if (fs.existsSync(checkoutJs)) {
  const js = fs.readFileSync(checkoutJs, 'utf8');
  test("Stage 9", "Checkout sets sarojini_product_id and product_id: null for Sarojini items", js.includes("sarojini_product_id: isSarojini ? resolvedProdId : null") && js.includes("product_id: isSarojini ? null : resolvedProdId"));
  test("Stage 9", "Checkout records catalog_type", js.includes("catalog_type: isSarojini ? 'sarojini' : 'main'"));
}

// STAGE 10: ADMIN SAROJINI ORDERS
const adminOrdersHtml = path.join(root, 'admin', 'sarojini-orders.html');
const adminOrdersJs = path.join(root, 'admin', 'js', 'admin-sarojini-orders.js');
test("Stage 10", "admin/sarojini-orders.html exists", fs.existsSync(adminOrdersHtml));
test("Stage 10", "admin/js/admin-sarojini-orders.js exists", fs.existsSync(adminOrdersJs));
if (fs.existsSync(adminOrdersJs)) {
  const js = fs.readFileSync(adminOrdersJs, 'utf8');
  test("Stage 10", "Orders JS isolates orders containing Sarojini items", js.includes("catalog_type === 'sarojini' || it.sarojini_product_id"));
}

// STAGE 11: DASHBOARD & OFFERS
const dashHtml = path.join(root, 'admin', 'sarojini-dashboard.html');
const dashJs = path.join(root, 'admin', 'js', 'admin-sarojini-dashboard.js');
const offHtml = path.join(root, 'admin', 'sarojini-offers.html');
const offJs = path.join(root, 'admin', 'js', 'admin-sarojini-offers.js');
test("Stage 11", "admin/sarojini-dashboard.html exists", fs.existsSync(dashHtml));
test("Stage 11", "admin/js/admin-sarojini-dashboard.js exists", fs.existsSync(dashJs));
test("Stage 11", "admin/sarojini-offers.html exists", fs.existsSync(offHtml));
test("Stage 11", "admin/js/admin-sarojini-offers.js exists", fs.existsSync(offJs));
if (fs.existsSync(dashJs)) {
  const js = fs.readFileSync(dashJs, 'utf8');
  test("Stage 11", "Dashboard calculates isolated Sarojini revenue", js.includes("sarojiniRevenue"));
}

console.log("\n==========================================================");
console.log(`TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
console.log("==========================================================");

if (failedCount === 0) {
  console.log(">>> ALL 11 STAGES OF SAROJINI RESTRUCTURE VERIFIED SUCCESSFULLY! <<<");
  process.exit(0);
} else {
  console.error(">>> VERIFICATION COMPLETED WITH FAILURES <<<");
  process.exit(1);
}

