const fs = require('fs');
const path = require('path');

const ROOT = 'c:\\Users\\saanv\\OneDrive\\Desktop\\Website\\webu';

function patchFile(relPath, fn) {
  const fullPath = path.join(ROOT, relPath);
  if (!fs.existsSync(fullPath)) return;
  const original = fs.readFileSync(fullPath, 'utf8');
  const updated = fn(original);
  if (updated !== original) {
    fs.writeFileSync(fullPath, updated, 'utf8');
    console.log('Updated:', relPath);
  } else {
    console.log('No change:', relPath);
  }
}

// 1. js/ads-engine.js
patchFile('js/ads-engine.js', c => {
  c = c.replace(/VADI LUXURY DROP/g, 'VALORA LUXURY DROP');
  c = c.replace(/Curated from Main VADI Store/g, 'Curated from Main VALORA Store');
  return c;
});

// 2. js/homepage-sections-engine.js
patchFile('js/homepage-sections-engine.js', c => {
  c = c.replace(/\$\{p\.brand \|\| 'VADI'\}/g, "${p.brand || 'VALORA'}");
  return c;
});

// 3. js/checkout.js
patchFile('js/checkout.js', c => {
  c = c.replace(/name:\s*"VADI"/g, 'name: "VALORA"');
  c = c.replace(/platform:\s*"VADI E-Commerce"/g, 'platform: "VALORA E-Commerce"');
  c = c.replace(/"VADI Lifestyle Studio"/g, '"VALORA Lifestyle Studio"');
  return c;
});

// 4. js/auth.js
patchFile('js/auth.js', c => {
  c = c.replace(/Welcome to VADI\./g, 'Welcome to VALORA.');
  return c;
});

// 5. js/product-details.js
patchFile('js/product-details.js', c => {
  c = c.replace(/fallbackStatic\.brand : "VADI Atelier"/g, 'fallbackStatic.brand : "VALORA Atelier"');
  c = c.replace(/Product Not Found \| VADI - Everything\. Simply Yours\./g, 'Product Not Found | VALORA - Everything. Simply Yours.');
  c = c.replace(/\$\{product\.name\} \| VADI - Everything\. Simply Yours\./g, '${product.name} | VALORA - Everything. Simply Yours.');
  c = c.replace(/product\.brand \|\| "VADI Atelier"/g, 'product.brand || "VALORA Atelier"');
  c = c.replace(/\$\{item\.brand \|\| 'VADI'\}/g, "${item.brand || 'VALORA'}");
  c = c.replace(/\$\{p\.brand \|\| 'VADI'\}/g, "${p.brand || 'VALORA'}");
  return c;
});

// 6. js/shop.js
patchFile('js/shop.js', c => {
  c = c.replace(/Trending Now \| VADI - Everything\. Simply Yours\./g, 'Trending Now | VALORA - Everything. Simply Yours.');
  c = c.replace(/Today's Deals \| VADI - Everything\. Simply Yours\./g, "Today's Deals | VALORA - Everything. Simply Yours.");
  c = c.replace(/New Arrivals \| VADI - Everything\. Simply Yours\./g, 'New Arrivals | VALORA - Everything. Simply Yours.');
  c = c.replace(/Buy 1 Get 1 Free \| VADI - Everything\. Simply Yours\./g, 'Buy 1 Get 1 Free | VALORA - Everything. Simply Yours.');
  c = c.replace(/\$\{decodedBrand\} \| VADI - Everything\. Simply Yours\./g, '${decodedBrand} | VALORA - Everything. Simply Yours.');
  c = c.replace(/\$\{product\.brand \|\| 'VADI'\}/g, "${product.brand || 'VALORA'}");
  return c;
});

// 7. js/products.js
patchFile('js/products.js', c => {
  c = c.replace(/brand:\s*"VADI Atelier"/g, 'brand: "VALORA Atelier"');
  c = c.replace(/name:\s*"VADI Ceramic Magnetic Wireless Pad"/g, 'name: "VALORA Ceramic Magnetic Wireless Pad"');
  c = c.replace(/dbP\.brand \|\| "VADI Atelier"/g, 'dbP.brand || "VALORA Atelier"');
  return c;
});

// 8. js/order-activity.js
patchFile('js/order-activity.js', c => {
  c = c.replace(/name:\s*item\.name \|\| "VADI Luxury Creation"/g, 'name: item.name || "VALORA Luxury Creation"');
  c = c.replace(/brand:\s*"VADI Atelier"/g, 'brand: "VALORA Atelier"');
  c = c.replace(/name:\s*p\.name \|\| p\.title \|\| "VADI Item"/g, 'name: p.name || p.title || "VALORA Item"');
  return c;
});

// 9. js/sarojini-watermark.js
patchFile('js/sarojini-watermark.js', c => {
  c = c.replace(/<div class="swm-title"><span class="swm-dot">●<\/span> VADI STORE<\/div>/g, '<div class="swm-title"><span class="swm-dot">●</span> VALORA STORE</div>');
  c = c.replace(/● VADI STORE/g, '● VALORA STORE');
  return c;
});

// 10. js/sarojini-image-cleaner.js
patchFile('js/sarojini-image-cleaner.js', c => {
  c = c.replace(/ctx\.fillText\('VADI STORE'/g, "ctx.fillText('VALORA STORE'");
  c = c.replace(/● VADI STORE \/ SAROJINI BAZAAR/g, '● VALORA STORE / SAROJINI BAZAAR');
  c = c.replace(/VADI STORE watermark/g, 'VALORA STORE watermark');
  return c;
});

// 11. js/sarojini-bazaar-page.js
patchFile('js/sarojini-bazaar-page.js', c => {
  c = c.replace(/title:\s*"Sarojini Style \/ VADI Looks"/g, 'title: "Sarojini Style / VALORA Looks"');
  c = c.replace(/title:\s*"Why Shop With VADI"/g, 'title: "Why Shop With VALORA"');
  return c;
});

// 12. js/sarojini-product-details.js
patchFile('js/sarojini-product-details.js', c => {
  c = c.replace(/\$\{p\.name\} \| Sarojini Bazaar - VADI/g, '${p.name} | Sarojini Bazaar - VALORA');
  return c;
});

// 13. js/sarojini-card-ads.js
patchFile('js/sarojini-card-ads.js', c => {
  c = c.replace(/sub:\s*'VADI QUALITY'/g, "sub: 'VALORA QUALITY'");
  return c;
});

// 14. admin/js/admin-advertisements.js
patchFile('admin/js/admin-advertisements.js', c => {
  c = c.replace(/title:\s*"VADI ROYAL BOGO FESTIVAL"/g, 'title: "VALORA ROYAL BOGO FESTIVAL"');
  c = c.replace(/store === 'sarojini' \? 'Sarojini' : 'VADI'/g, "store === 'sarojini' ? 'Sarojini' : 'VALORA'");
  c = c.replace(/Select a VADI category\.\.\./g, 'Select a VALORA category...');
  c = c.replace(/isSarojini \? 'SAROJINI' : 'VADI'/g, "isSarojini ? 'SAROJINI' : 'VALORA'");
  c = c.replace(/>MAIN VADI<\/span>/g, '>MAIN VALORA</span>');
  return c;
});

// 15. admin/js/admin-homepage-sections.js
patchFile('admin/js/admin-homepage-sections.js', c => {
  c = c.replace(/\$\{p\.brand \|\| 'VADI'\}/g, "${p.brand || 'VALORA'}");
  c = c.replace(/This is a core VADI storefront section/g, 'This is a core VALORA storefront section');
  return c;
});

// 16. admin/js/admin-order-details.js
patchFile('admin/js/admin-order-details.js', c => {
  c = c.replace(/label:\s*'Main VADI'/g, "label: 'Main VALORA'");
  c = c.replace(/Signature VADI Keychain/g, 'Signature VALORA Keychain');
  c = c.replace(/MAIN VADI/g, 'MAIN VALORA');
  return c;
});

// 17. admin/js/admin-orders.js
patchFile('admin/js/admin-orders.js', c => {
  c = c.replace(/label:\s*"MAIN VADI"/g, 'label: "MAIN VALORA"');
  return c;
});

// 18. admin/js/admin-products.js
patchFile('admin/js/admin-products.js', c => {
  c = c.replace(/\$\{escapeHtml\(p\.brand \|\| 'VADI'\)\}/g, "${escapeHtml(p.brand || 'VALORA')}");
  c = c.replace(/Main VADI Store/g, 'Main VALORA Store');
  c = c.replace(/Main VADI/g, 'Main VALORA');
  return c;
});

// 19. admin/js/admin-reviews.js
patchFile('admin/js/admin-reviews.js', c => {
  c = c.replace(/product\.brand \|\| "VADI"/g, 'product.brand || "VALORA"');
  return c;
});

// 20. admin/js/admin-sarojini-add-product.js
patchFile('admin/js/admin-sarojini-add-product.js', c => {
  c = c.replace(/● VADI STORE \/ SAROJINI BAZAAR badge/g, '● VALORA STORE / SAROJINI BAZAAR badge');
  c = c.replace(/✦ VADI STORE watermarked image/g, '✦ VALORA STORE watermarked image');
  return c;
});

// 21. admin/js/admin-sarojini-bulk-import.js
patchFile('admin/js/admin-sarojini-bulk-import.js', c => {
  c = c.replace(/● VADI STORE Watermark Applied/g, '● VALORA STORE Watermark Applied');
  return c;
});

// 22. admin/js/admin-sarojini-homepage-sections.js
patchFile('admin/js/admin-sarojini-homepage-sections.js', c => {
  c = c.replace(/title:\s*"Sarojini Style \/ VADI Looks"/g, 'title: "Sarojini Style / VALORA Looks"');
  c = c.replace(/title:\s*"Why Shop With VADI"/g, 'title: "Why Shop With VALORA"');
  return c;
});

// 23. admin/js/admin-sarojini-products.js
patchFile('admin/js/admin-sarojini-products.js', c => {
  c = c.replace(/Main VADI Store/g, 'Main VALORA Store');
  c = c.replace(/Main VADI/g, 'Main VALORA');
  c = c.replace(/Connected to Main VADI/g, 'Connected to Main VALORA');
  return c;
});

// 24. admin/js/admin-settings.js
patchFile('admin/js/admin-settings.js', c => {
  c = c.replace(/"VADI Lifestyle Studio"/g, '"VALORA Lifestyle Studio"');
  return c;
});

// 25. admin/js/cross-store-service.js
patchFile('admin/js/cross-store-service.js', c => {
  c = c.replace(/available in Main VADI Store/g, 'available in Main VALORA Store');
  c = c.replace(/removed from Main VADI Store/g, 'removed from Main VALORA Store');
  return c;
});

