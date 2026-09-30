const fs = require('fs');
const assert = require('assert');

console.log("Verifying Custom VADII UPI Modal Implementation...");

const html = fs.readFileSync('checkout.html', 'utf8');
const css = fs.readFileSync('css/checkout.css', 'utf8');
const js = fs.readFileSync('js/checkout.js', 'utf8');

// HTML checks
assert(html.includes('id="upi-payment-modal"'), "Modal container id exists");
assert(html.includes('class="upi-modal-card vadi-upi-modal-card"'), "Custom VADII modal card class exists");
assert(html.includes('vadii@ptaxis'), "Merchant UPI ID present in modal HTML");
assert(html.includes('id="tab-btn-app"') && html.includes('id="tab-btn-qr"'), "Tab switchers present");
assert(html.includes('id="upi-view-app"') && html.includes('id="upi-view-qr"'), "Tab views present");
assert(html.includes('id="btn-launch-upi-app"'), "Open UPI App button present");
assert(html.includes('data-app="gpay"') && html.includes('data-app="phonepe"'), "App chips present");
assert(html.includes('id="upi-qr-container"'), "QR code container present");
assert(html.includes('id="input-customer-utr"'), "UTR input present");
assert(html.includes('id="btn-confirm-payment"'), "Confirm payment button present");
assert(html.includes('I HAVE PAID'), "I HAVE PAID text present");
console.log("[PASS] checkout.html structure verified");

// CSS checks
assert(css.includes('.vadi-upi-modal-card'), "vadi-upi-modal-card styles exist");
assert(css.includes('.upi-modal-overlay.open') && css.includes('display: flex !important;'), "Modal open display rule exists");
assert(css.includes('.vadi-mode-tabs'), "vadi-mode-tabs styles exist");
assert(css.includes('.vadi-app-chip'), "vadi-app-chip styles exist");
assert(css.includes('.vadi-btn-confirm-paid'), "vadi-btn-confirm-paid styles exist");
console.log("[PASS] css/checkout.css styles verified");

// JS checks
assert(js.includes('function openUpiModal(orderRes)'), "openUpiModal function exists");
assert(js.includes('switchUpiModalTab'), "switchUpiModalTab function exists");
assert(js.includes('renderUpiQrCode(qrContainer, orderRes.upi_uri)'), "Dynamic QR rendering called in modal");
assert(js.includes('function submitUpiConfirmation()'), "submitUpiConfirmation function exists");
assert(js.includes('PAYMENT_VERIFICATION_PENDING'), "Payment verification status exists");
assert(js.includes('customer_submitted'), "Customer submitted status exists");
console.log("[PASS] js/checkout.js logic verified");

console.log("ALL CUSTOM VADII UPI MODAL CHECKS PASSED!");
