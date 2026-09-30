const fs = require('fs');
const path = require('path');

const ROOT = 'c:\\Users\\saanv\\OneDrive\\Desktop\\Website\\webu';

// 1. Admin HTML Files
const adminHtmlFiles = [
  'admin/add-product.html',
  'admin/advertisements.html',
  'admin/analytics.html',
  'admin/banners.html',
  'admin/categories.html',
  'admin/coupons.html',
  'admin/customer-details.html',
  'admin/customers.html',
  'admin/dashboard.html',
  'admin/delivery-partners.html',
  'admin/edit-product.html',
  'admin/gift-offers.html',
  'admin/homepage-sections.html',
  'admin/orders.html',
  'admin/products.html',
  'admin/reviews.html',
  'admin/sarojini-add-product.html',
  'admin/sarojini-analytics.html',
  'admin/sarojini-categories.html',
  'admin/sarojini-coupons.html',
  'admin/sarojini-customers.html',
  'admin/sarojini-dashboard.html',
  'admin/sarojini-homepage-sections.html',
  'admin/sarojini-offers.html',
  'admin/sarojini-products.html',
  'admin/sarojini-reviews.html',
  'admin/settings.html'
];

function updateAdminHtml(relPath) {
  const filePath = path.join(ROOT, relPath);
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // Title and Brand Logos
  content = content.replace(/<title>(.*?)\s*\|\s*VALORA Admin<\/title>/g, '<title>$1 | VADII Admin</title>');
  content = content.replace(/<a href="dashboard\.html" class="sidebar-logo">VALORA<\/a>/g, '<a href="dashboard.html" class="sidebar-logo">VADII</a>');
  content = content.replace(/<a href="dashboard\.html">VALORA Admin<\/a>/g, '<a href="dashboard.html">VADII Admin</a>');

  // Specific Admin labels
  content = content.replace(/VALORA Atelier/g, 'VADII Atelier');
  content = content.replace(/VALORA Luxury Fashion/g, 'VADII Luxury Fashion');
  content = content.replace(/VALORA Lifestyle Studio/g, 'VADII Lifestyle Studio');
  content = content.replace(/VALORA E-Commerce/g, 'VADII E-Commerce');
  content = content.replace(/VALORA20/g, 'VADII20');
  content = content.replace(/VALORA10/g, 'VADII10');
  content = content.replace(/VALORA STORE/g, 'VADII STORE');
  content = content.replace(/VALORA Store/g, 'VADII Store');
  content = content.replace(/Main VALORA/g, 'Main VADII');
  content = content.replace(/main VALORA/g, 'main VADII');
  content = content.replace(/VALORA Sarojini Bazaar/g, 'VADII Sarojini Bazaar');
  content = content.replace(/VALORA Advertisements/g, 'VADII Advertisements');
  content = content.replace(/VALORA storefront/g, 'VADII storefront');
  content = content.replace(/VALORA Premium/g, 'VADII Premium');
  content = content.replace(/All Stores \(VALORA & Sarojini\)/g, 'All Stores (VADII & Sarojini)');
  content = content.replace(/VALORA Watermarked/g, 'VADII Watermarked');
  content = content.replace(/VALORA watermarked/g, 'VADII watermarked');

  // Catch remaining occurrences
  content = content.replace(/\bVALORA\b/g, 'VADII');
  content = content.replace(/\bValora\b/g, 'VADII');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('[Admin HTML] Updated:', relPath);
  } else {
    console.log('[Admin HTML] Unchanged:', relPath);
  }
}

// 2. Admin JS Files
const adminJsFiles = [
  'admin/js/admin-add-product.js',
  'admin/js/admin-advertisements.js',
  'admin/js/admin-auth.js',
  'admin/js/admin-edit-product.js',
  'admin/js/admin-homepage-sections.js',
  'admin/js/admin-order-details.js',
  'admin/js/admin-orders.js',
  'admin/js/admin-products.js',
  'admin/js/admin-reviews.js',
  'admin/js/admin-sarojini-add-product.js',
  'admin/js/admin-sarojini-bulk-import.js',
  'admin/js/admin-sarojini-homepage-sections.js',
  'admin/js/admin-sarojini-products.js',
  'admin/js/admin-settings.js',
  'admin/js/cross-store-service.js'
];

function updateAdminJs(relPath) {
  const filePath = path.join(ROOT, relPath);
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  content = content.replace(/VALORA Atelier/g, 'VADII Atelier');
  content = content.replace(/VALORA ROYAL BOGO FESTIVAL/g, 'VADII ROYAL BOGO FESTIVAL');
  content = content.replace(/VALORA Lifestyle Studio/g, 'VADII Lifestyle Studio');
  content = content.replace(/VALORA E-Commerce/g, 'VADII E-Commerce');
  content = content.replace(/VALORA STORE/g, 'VADII STORE');
  content = content.replace(/VALORA Store/g, 'VADII Store');
  content = content.replace(/Main VALORA/g, 'Main VADII');
  content = content.replace(/main VALORA/g, 'main VADII');
  content = content.replace(/MAIN VALORA/g, 'MAIN VADII');
  content = content.replace(/VALORA administrator/g, 'VADII administrator');
  content = content.replace(/Changes live across VALORA/g, 'Changes live across VADII');
  content = content.replace(/VALORA CURATED RADAR/g, 'VADII CURATED RADAR');
  content = content.replace(/VALORA experience/g, 'VADII experience');
  content = content.replace(/The VALORA Standard/g, 'The VADII Standard');
  content = content.replace(/core VALORA storefront section/g, 'core VADII storefront section');
  content = content.replace(/Signature VALORA Keychain/g, 'Signature VADII Keychain');
  content = content.replace(/VALORA Looks/g, 'VADII Looks');
  content = content.replace(/Why Shop With VALORA/g, 'Why Shop With VADII');
  content = content.replace(/Select a VALORA category\.\.\./g, 'Select a VADII category...');
  content = content.replace(/store === 'sarojini' \? 'Sarojini' : 'VALORA'/g, "store === 'sarojini' ? 'Sarojini' : 'VADII'");
  content = content.replace(/isSarojini \? 'SAROJINI' : 'VALORA'/g, "isSarojini ? 'SAROJINI' : 'VADII'");
  content = content.replace(/brand \|\| 'VALORA'/g, "brand || 'VADII'");
  content = content.replace(/brand \|\| "VALORA"/g, 'brand || "VADII"');
  content = content.replace(/VALORA watermarked/g, 'VADII watermarked');
  content = content.replace(/VALORA Watermark Applied/g, 'VADII Watermark Applied');

  // Generic Valora replacements in string literals
  content = content.replace(/\bVALORA\b/g, 'VADII');
  content = content.replace(/\bValora\b/g, 'VADII');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('[Admin JS] Updated:', relPath);
  } else {
    console.log('[Admin JS] Unchanged:', relPath);
  }
}

// 3. API Files
const apiFiles = [
  'api/razorpay/create-order.js',
  'api/_lib/razorpay.js'
];

function updateApiFiles(relPath) {
  const filePath = path.join(ROOT, relPath);
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  content = content.replace(/merchant_name:\s*'VALORA E-Commerce'/g, "merchant_name: 'VADII E-Commerce'");
  content = content.replace(/platform:\s*'VALORA E-Commerce'/g, "platform: 'VADII E-Commerce'");
  content = content.replace(/\bVALORA\b/g, 'VADII');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('[API] Updated:', relPath);
  } else {
    console.log('[API] Unchanged:', relPath);
  }
}

// 4. Client JS Files
const clientJsFiles = [
  'js/ads-engine.js',
  'js/auth.js',
  'js/checkout.js',
  'js/gift-engine.js',
  'js/homepage-sections-engine.js',
  'js/info-pages.js',
  'js/order-activity.js',
  'js/product-details.js',
  'js/products.js',
  'js/sarojini-bazaar-page.js',
  'js/sarojini-card-ads.js',
  'js/sarojini-image-cleaner.js',
  'js/sarojini-product-details.js',
  'js/sarojini-watermark.js',
  'js/shop.js',
  'js/wishlist.js',
  'scripts/lib/review-generator.js',
  'scripts/seed-product-reviews.js'
];

function updateClientJs(relPath) {
  const filePath = path.join(ROOT, relPath);
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // Exact UI strings and tokens
  content = content.replace(/VALORA LUXURY DROP/g, 'VADII LUXURY DROP');
  content = content.replace(/Curated from Main VALORA Store/g, 'Curated from Main VADII Store');
  content = content.replace(/Welcome to VALORA\./g, 'Welcome to VADII.');
  content = content.replace(/VALORA Lifestyle Studio/g, 'VADII Lifestyle Studio');
  content = content.replace(/name:\s*"VALORA"/g, 'name: "VADII"');
  content = content.replace(/platform:\s*"VALORA E-Commerce"/g, 'platform: "VADII E-Commerce"');
  content = content.replace(/Signature VALORA Keychain/g, 'Signature VADII Keychain');
  content = content.replace(/applying to VALORA\./g, 'applying to VADII.');
  content = content.replace(/VALORA Brand Assets Kit/g, 'VADII Brand Assets Kit');
  content = content.replace(/VALORA Luxury Creation/g, 'VADII Luxury Creation');
  content = content.replace(/VALORA Item/g, 'VADII Item');
  content = content.replace(/VALORA Atelier/g, 'VADII Atelier');
  content = content.replace(/VALORA Ceramic Magnetic Wireless Pad/g, 'VADII Ceramic Magnetic Wireless Pad');
  content = content.replace(/Sarojini Style \/ VALORA Looks/g, 'Sarojini Style / VADII Looks');
  content = content.replace(/Why Shop With VALORA/g, 'Why Shop With VADII');
  content = content.replace(/VALORA QUALITY/g, 'VADII QUALITY');
  content = content.replace(/VALORA STORE/g, 'VADII STORE');
  content = content.replace(/Sarojini Bazaar - VALORA/g, 'Sarojini Bazaar - VADII');
  content = content.replace(/MAIN VALORA/g, 'MAIN VADII');
  content = content.replace(/VALORA & SAROJINI BAZAAR/g, 'VADII & SAROJINI BAZAAR');

  // Replace dynamic cleaners/replacers that were normalizing VADI -> VALORA
  // Now they should normalize VALORA or VADI -> VADII
  content = content.replace(/\.replace\(\/\\b\(VALORA\|VADI\)\\b\/g,\s*['"]VADII['"]\)/g, ".replace(/\\b(VALORA|VADI)\\b/g, 'VADII')");
  content = content.replace(/\.replace\(\/\\bVADI\\b\/g,\s*['"]VALORA['"]\)/g, ".replace(/\\b(VALORA|VADI)\\b/g, 'VADII')");
  content = content.replace(/\.replace\(\/\\bVALORA\\b\/g,\s*['"]VADII['"]\)/g, ".replace(/\\b(VALORA|VADI)\\b/g, 'VADII')");

  // Titles
  content = content.replace(/\| VALORA - Everything\. Simply Yours\./g, '| VADII — Everything. Simply Yours.');

  // Brand fallbacks
  content = content.replace(/p\.brand \|\| 'VALORA'/g, "p.brand || 'VADII'");
  content = content.replace(/item\.brand \|\| 'VALORA'/g, "item.brand || 'VADII'");
  content = content.replace(/product\.brand \|\| 'VALORA'/g, "product.brand || 'VADII'");
  content = content.replace(/product\.brand \|\| "VALORA"/g, 'product.brand || "VADII"');
  content = content.replace(/fallbackStatic\.brand : "VALORA Atelier"/g, 'fallbackStatic.brand : "VADII Atelier"');
  content = content.replace(/isSarojini \? 'Sarojini Bazaar' : 'VALORA'/g, "isSarojini ? 'Sarojini Bazaar' : 'VADII'");

  // Catch remaining literal VALORA / Valora in comments or strings
  content = content.replace(/\bVALORA STORE\b/g, 'VADII STORE');
  content = content.replace(/\bVALORA\b/g, 'VADII');
  content = content.replace(/\bValora\b/g, 'VADII');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('[Client JS] Updated:', relPath);
  } else {
    console.log('[Client JS] Unchanged:', relPath);
  }
}

console.log('--- Updating Admin HTML ---');
adminHtmlFiles.forEach(updateAdminHtml);

console.log('--- Updating Admin JS ---');
adminJsFiles.forEach(updateAdminJs);

console.log('--- Updating API Files ---');
apiFiles.forEach(updateApiFiles);

console.log('--- Updating Client JS Files ---');
clientJsFiles.forEach(updateClientJs);

console.log('Done!');
