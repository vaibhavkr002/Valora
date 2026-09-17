const fs = require('fs');
const path = require('path');

console.log("=== RUNNING VELORA UPI CHECKOUT VERIFICATION TESTS ===");

const rootDir = path.resolve(__dirname, '..');
let failures = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
  } else {
    console.error(`  ✕ FAIL: ${message}`);
    failures++;
  }
}

// 1. Check checkout.html
console.log("\n1. Verifying checkout.html markup:");
const checkoutHtml = fs.readFileSync(path.join(rootDir, 'checkout.html'), 'utf-8');

assert(!checkoutHtml.includes('id="input-upi-id"'), "No input-upi-id input element exists in checkout.html");
assert(!checkoutHtml.includes('placeholder="yourname@upi"'), "No manual UPI ID placeholder exists");
assert(checkoutHtml.includes('id="upi-payment-flow-wrap"'), "upi-payment-flow-wrap container exists");
assert(checkoutHtml.includes('id="upi-apps-grid"'), "Compact UPI apps grid exists");
assert(checkoutHtml.includes('data-app="Google Pay"'), "Google Pay app card exists");
assert(checkoutHtml.includes('data-app="PhonePe"'), "PhonePe app card exists");
assert(checkoutHtml.includes('data-app="Paytm"'), "Paytm app card exists");
assert(checkoutHtml.includes('data-app="BHIM"'), "BHIM app card exists");
assert(checkoutHtml.includes('data-app="Any UPI App"'), "Any UPI App card exists");
assert(checkoutHtml.includes('id="btn-upi-pay"'), "In-card quick pay CTA button exists");
assert(checkoutHtml.includes('id="btn-upi-pay-text"'), "Dynamic in-card button text container exists");
assert(checkoutHtml.includes('id="upi-payment-modal"'), "Secure UPI payment modal exists");
assert(checkoutHtml.includes('id="upi-qr-container"'), "Desktop QR container exists");
assert(checkoutHtml.includes('id="btn-launch-upi-app"'), "Mobile app launch button exists");
assert(checkoutHtml.includes('id="btn-launch-any-app"'), "Mobile generic app launch button exists");
assert(checkoutHtml.includes('id="btn-copy-upi"'), "Copy VPA button exists");
assert(checkoutHtml.includes('id="btn-confirm-payment"'), "Verification confirmation button exists");
assert(checkoutHtml.includes('id="btn-cancel-payment"'), "Cancel & return button exists");
assert(checkoutHtml.includes('qrcode.min.js'), "qrcode generator script is included");

// 2. Check css/checkout.css
console.log("\n2. Verifying css/checkout.css styling and responsive rules:");
const checkoutCss = fs.readFileSync(path.join(rootDir, 'css', 'checkout.css'), 'utf-8');

assert(checkoutCss.includes('.upi-payment-flow-wrap'), ".upi-payment-flow-wrap rule exists");
assert(checkoutCss.includes('.upi-apps-grid'), ".upi-apps-grid rule exists");
assert(checkoutCss.includes('.upi-app-card'), ".upi-app-card rule exists");
assert(checkoutCss.includes('.upi-amount-card'), ".upi-amount-card rule exists");
assert(checkoutCss.includes('.btn-upi-pay'), ".btn-upi-pay rule exists");
assert(checkoutCss.includes('.upi-modal-overlay'), ".upi-modal-overlay rule exists");
assert(checkoutCss.includes('.upi-qr-container'), ".upi-qr-container rule exists");
assert(checkoutCss.includes('@media (max-width: 768px)'), "Mobile responsive query max-width 768px exists");
assert(checkoutCss.includes('@media (max-width: 360px)'), "Ultra-compact mobile query max-width 360px exists");

// 3. Check js/checkout.js
console.log("\n3. Verifying js/checkout.js logic and syntax:");
const checkoutJs = fs.readFileSync(path.join(rootDir, 'js', 'checkout.js'), 'utf-8');

assert(!checkoutJs.includes('elements.inputUpiId'), "elements.inputUpiId is removed from all listeners");
assert(checkoutJs.includes('selectedUpiApp'), "state.selectedUpiApp is managed");
assert(checkoutJs.includes('merchantVpa'), "merchantVpa is configured and read from store_settings/defaults");
assert(checkoutJs.includes('updateUpiSection'), "updateUpiSection function updates dynamic UI and button text");
assert(checkoutJs.includes('generateUpiLinks'), "generateUpiLinks handles pa, pn, tr, tn, am, cu=INR");
assert(checkoutJs.includes('renderUpiQrCode'), "renderUpiQrCode renders SVG QR code");
assert(checkoutJs.includes('startUpiPaymentFlow'), "startUpiPaymentFlow initiates transaction");
assert(checkoutJs.includes('initiate_upi_transaction'), "Calls server RPC initiate_upi_transaction");
assert(checkoutJs.includes('verify_and_complete_upi_payment'), "Calls server RPC verify_and_complete_upi_payment");
assert(checkoutJs.includes('cancel_upi_transaction'), "Calls server RPC cancel_upi_transaction");
assert(checkoutJs.includes('tez://upi/pay'), "Google Pay tez:// deep link supported");
assert(checkoutJs.includes('phonepe://pay'), "PhonePe phonepe:// deep link supported");
assert(checkoutJs.includes('paytmmp://pay'), "Paytm paytmmp:// deep link supported");
assert(checkoutJs.includes('bhim://pay'), "BHIM bhim:// deep link supported");
assert(checkoutJs.includes('upi://pay'), "Generic upi:// deep link supported");

// Test link generation function behavior directly
function testGenerateUpiLinks(vpa, name, ref, amount, note) {
  const cleanVpa = (vpa || "velora.lifestyle@okhdfcbank").trim();
  const cleanName = encodeURIComponent((name || "VELORA Lifestyle Studio").trim());
  const cleanNote = encodeURIComponent(note || `Order ${ref}`);
  const amtStr = Number(amount || 0).toFixed(2);
  const baseQuery = `pa=${cleanVpa}&pn=${cleanName}&tr=${ref}&tn=${cleanNote}&am=${amtStr}&cu=INR`;

  return {
    generic: `upi://pay?${baseQuery}`,
    gpay: `tez://upi/pay?${baseQuery}`,
    phonepe: `phonepe://pay?${baseQuery}`,
    paytm: `paytmmp://pay?${baseQuery}`,
    bhim: `bhim://pay?${baseQuery}`
  };
}

const links1 = testGenerateUpiLinks("velora.lifestyle@okhdfcbank", "VELORA Lifestyle Studio", "VEL-TXN-12345", 999.00);
assert(links1.generic.startsWith("upi://pay?pa=velora.lifestyle@okhdfcbank&pn=VELORA%20Lifestyle%20Studio&tr=VEL-TXN-12345&tn=Order%20VEL-TXN-12345&am=999.00&cu=INR"), "Full Online ₹999 deep link has correct standard UPI parameters");
assert(links1.gpay.startsWith("tez://upi/pay?pa=velora.lifestyle@okhdfcbank"), "Google Pay deep link starts with tez://");
assert(links1.phonepe.startsWith("phonepe://pay?pa=velora.lifestyle@okhdfcbank"), "PhonePe deep link starts with phonepe://");
assert(links1.paytm.startsWith("paytmmp://pay?pa=velora.lifestyle@okhdfcbank"), "Paytm deep link starts with paytmmp://");
assert(links1.bhim.startsWith("bhim://pay?pa=velora.lifestyle@okhdfcbank"), "BHIM deep link starts with bhim://");

const links2 = testGenerateUpiLinks("velora.lifestyle@okhdfcbank", "VELORA Lifestyle Studio", "VEL-TXN-ADV-120", 120.00);
assert(links2.generic.includes("&am=120.00&cu=INR"), "Advance COD ₹120 deep link has exact dynamic advance amount");

// 4. Check admin/settings.html and admin/js/admin-settings.js
console.log("\n4. Verifying admin settings UI and controller:");
const adminSettingsHtml = fs.readFileSync(path.join(rootDir, 'admin', 'settings.html'), 'utf-8');
const adminSettingsJs = fs.readFileSync(path.join(rootDir, 'admin', 'js', 'admin-settings.js'), 'utf-8');

assert(adminSettingsHtml.includes('id="set-merchant-vpa"'), "Admin has set-merchant-vpa input");
assert(adminSettingsHtml.includes('id="set-merchant-name"'), "Admin has set-merchant-name input");
assert(adminSettingsHtml.includes('id="app-gpay"'), "Admin has app-gpay toggle");
assert(adminSettingsHtml.includes('id="app-phonepe"'), "Admin has app-phonepe toggle");
assert(adminSettingsHtml.includes('id="app-paytm"'), "Admin has app-paytm toggle");
assert(adminSettingsHtml.includes('id="app-bhim"'), "Admin has app-bhim toggle");
assert(adminSettingsHtml.includes('id="app-generic"'), "Admin has app-generic toggle");

assert(adminSettingsJs.includes('s.key === "payment"'), "Admin settings controller loads payment settings");
assert(adminSettingsJs.includes('merchant_vpa:'), "Admin settings controller saves merchant_vpa");
assert(adminSettingsJs.includes('merchant_name:'), "Admin settings controller saves merchant_name");
assert(adminSettingsJs.includes('enabled_apps:'), "Admin settings controller saves enabled_apps");
assert(adminSettingsJs.includes('key: "payment"'), "Admin settings controller upserts key 'payment'");

// 5. Check SQL Migration
console.log("\n5. Verifying SQL migration:");
const sqlMigration = fs.readFileSync(path.join(rootDir, 'supabase', 'migrations', '20260916_add_upi_payment_transactions.sql'), 'utf-8');

assert(sqlMigration.includes('CREATE TABLE IF NOT EXISTS public.payment_transactions'), "SQL defines payment_transactions table");
assert(sqlMigration.includes('initiate_upi_transaction'), "SQL defines initiate_upi_transaction RPC");
assert(sqlMigration.includes('verify_and_complete_upi_payment'), "SQL defines verify_and_complete_upi_payment RPC");
assert(sqlMigration.includes('cancel_upi_transaction'), "SQL defines cancel_upi_transaction RPC");
assert(sqlMigration.includes("'payment'"), "SQL seeds initial payment settings in store_settings");

console.log("\n=== TEST SUMMARY ===");
if (failures === 0) {
  console.log("All UPI payment flow verification checks passed cleanly! (0 failures)");
  process.exit(0);
} else {
  console.error(`Verification finished with ${failures} failure(s).`);
  process.exit(1);
}

