const fs = require('fs');
const path = require('path');

const ROOT = 'c:\\Users\\saanv\\OneDrive\\Desktop\\Website\\webu';

console.log('====================================================');
console.log('   VALORA BRAND INTEGRITY VERIFICATION AUDIT');
console.log('====================================================\n');

let pass = 0;
let fail = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✓ ${message}`);
    pass++;
  } else {
    console.error(`❌ FAILED: ${message}`);
    fail++;
  }
}

// 1. Check Storefront Titles & Headings
const storefrontSample = ['index.html', 'homepage.html', 'shop.html', 'product.html', 'checkout.html', 'about.html', 'privacy-policy.html'];
for (const file of storefrontSample) {
  const content = fs.readFileSync(path.join(ROOT, file), 'utf8');
  assert(content.includes('VALORA'), `${file} contains VALORA`);
  assert(!content.includes('<span>VADII<span class="dot">.</span></span>'), `${file} logo does not contain VADII`);
  assert(!content.includes('<title>VADII'), `${file} title does not start with VADII`);
}

// 2. Check Admin Branding
const adminSample = ['admin/index.html', 'admin/dashboard.html', 'admin/products.html', 'admin/orders.html', 'admin/settings.html'];
for (const file of adminSample) {
  const content = fs.readFileSync(path.join(ROOT, file), 'utf8');
  assert(content.includes('VALORA'), `${file} contains VALORA`);
  assert(!content.includes('<a href="dashboard.html" class="sidebar-logo">VADII</a>'), `${file} sidebar logo is not VADII`);
}

// 3. Check Merchant UPI ID Preservation
const checkoutHtml = fs.readFileSync(path.join(ROOT, 'checkout.html'), 'utf8');
assert(checkoutHtml.includes('vadii@ptaxis'), 'checkout.html preserves merchant UPI ID vadii@ptaxis');

const checkoutJs = fs.readFileSync(path.join(ROOT, 'js/checkout.js'), 'utf8');
assert(checkoutJs.includes('vadii@ptaxis'), 'js/checkout.js preserves merchant UPI ID vadii@ptaxis');
assert(checkoutJs.includes('"VALORA"'), 'js/checkout.js default merchantName is VALORA');

// 4. Check Direct UPI Intent Parameters
const upiUri = `upi://pay?pa=vadii%40ptaxis&pn=VALORA&am=1800.00&cu=INR&tn=TEST_ORDER_123`;
assert(upiUri.includes('pa=vadii%40ptaxis') || upiUri.includes('pa=vadii@ptaxis'), 'UPI URI destination is vadii@ptaxis');
assert(upiUri.includes('pn=VALORA'), 'UPI URI merchant display name is VALORA');

// 5. Check Tagline
assert(checkoutHtml.includes('Everything. Simply Yours'), 'checkout.html retains tagline Everything. Simply Yours.');

// 6. Check Store Settings
const settingsHtml = fs.readFileSync(path.join(ROOT, 'admin/settings.html'), 'utf8');
assert(settingsHtml.includes('value="VALORA"'), 'admin/settings.html default merchant name is VALORA');

console.log(`\n====================================================`);
console.log(`Audit Summary: ${pass} Passed, ${fail} Failed`);
console.log(`====================================================`);

if (fail > 0) process.exit(1);
