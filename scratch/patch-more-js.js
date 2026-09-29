const fs = require('fs');

function patch(file, map) {
  if (!fs.existsSync(file)) return;
  let c = fs.readFileSync(file, 'utf8');
  let orig = c;
  for (const [from, to] of map) {
    c = c.replace(from, to);
  }
  if (c !== orig) {
    fs.writeFileSync(file, c, 'utf8');
    console.log('Updated:', file);
  } else {
    console.log('No change:', file);
  }
}

// 1. admin/js/admin-add-product.js
patch('admin/js/admin-add-product.js', [
  [/brand:\s*brand \|\| "VADI Atelier"/g, 'brand: brand || "VALORA Atelier"']
]);

// 2. admin/js/admin-auth.js
patch('admin/js/admin-auth.js', [
  [/not authorized as a VADI administrator\./g, 'not authorized as a VALORA administrator.']
]);

// 3. admin/js/admin-edit-product.js
patch('admin/js/admin-edit-product.js', [
  [/Changes live across VADI\./g, 'Changes live across VALORA.']
]);

// 4. admin/js/admin-homepage-sections.js
patch('admin/js/admin-homepage-sections.js', [
  [/badge:\s*'⚡ VADI CURATED RADAR'/g, "badge: '⚡ VALORA CURATED RADAR'"],
  [/a VADI experience/g, 'a VALORA experience'],
  [/The VADI Standard/g, 'The VALORA Standard'],
  [/dom\.storeScopeLabel\.textContent = 'Main VADI Store'/g, "dom.storeScopeLabel.textContent = 'Main VALORA Store'"],
  [/Main VADI Store/g, 'Main VALORA Store'],
  [/'Main VADI'/g, "'Main VALORA'"],
  [/VADI Atelier/g, 'VALORA Atelier']
]);

// 5. api/razorpay/create-order.js
patch('api/razorpay/create-order.js', [
  [/merchant_name:\s*'VADI E-Commerce'/g, "merchant_name: 'VALORA E-Commerce'"]
]);

// 6. api/_lib/razorpay.js
patch('api/_lib/razorpay.js', [
  [/platform:\s*'VADI E-Commerce'/g, "platform: 'VALORA E-Commerce'"]
]);

// 7. scripts/lib/review-generator.js
patch('scripts/lib/review-generator.js', [
  [/String\(product\.brand \|\| 'VADI'\)\.trim\(\)/g, "String(product.brand || 'VALORA').trim()"]
]);

console.log('Patched admin and api scripts.');

