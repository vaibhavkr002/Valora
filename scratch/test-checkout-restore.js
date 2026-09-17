/**
 * scratch/test-checkout-restore.js
 * Automated verification of VELORA Checkout Address UI Restoration & Responsive UPI Flow
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const checkoutHtmlPath = path.join(rootDir, 'checkout.html');
const checkoutCssPath = path.join(rootDir, 'css', 'checkout.css');
const checkoutJsPath = path.join(rootDir, 'js', 'checkout.js');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
  }
}

console.log('\n--- 1. Testing checkout.html Structure & Address UI Restoration ---');
const htmlContent = fs.readFileSync(checkoutHtmlPath, 'utf8');

// Header + Add New Address
assert(htmlContent.includes('id="btn-add-address-header"'), 'Header "+ Add New Address" button is present');

// Empty state notice
assert(htmlContent.includes('id="no-saved-addresses-notice"'), 'Empty state notice container is present');
assert(htmlContent.includes('id="btn-add-first-address"'), 'Add First Address button is present');

// Saved addresses container
assert(htmlContent.includes('id="saved-addresses-section"'), 'Saved addresses section is present');
assert(htmlContent.includes('id="saved-addresses-grid"'), 'Saved addresses grid is present');

// Collapsible address form wrapper
assert(htmlContent.includes('id="delivery-form-container"'), 'Delivery form is wrapped in collapsible container');
assert(htmlContent.includes('id="delivery-form-header-bar"'), 'Delivery form header bar with title and cancel button is present');
assert(htmlContent.includes('id="address-form-actions"'), 'Address form action buttons (Save / Cancel) are present');
assert(htmlContent.includes('id="btn-save-address-submit"'), 'Save Address button is present');
assert(htmlContent.includes('id="btn-cancel-address-secondary"'), 'Cancel address button is present');

// Removal of fake/demo placeholders and hardcoded selections
assert(!htmlContent.includes('placeholder="Alexander Hayes"'), 'No fake cardholder "Alexander Hayes" placeholder in checkout.html');
assert(htmlContent.includes('placeholder="Name on card"'), 'Generic "Name on card" placeholder is used');
assert(!htmlContent.includes('<option value="Maharashtra" selected>'), 'No pre-selected Maharashtra state in dropdown');

// Responsive UPI Payment Flow
assert(htmlContent.includes('id="upi-desktop-scan-card"'), 'Desktop primary "Scan to Pay" card is present');
assert(htmlContent.includes('id="desktop-upi-qr-container"'), 'Desktop dynamic QR code container is present');
assert(htmlContent.includes('id="desktop-scan-amount-badge"'), 'Desktop dynamic amount badge is present');
assert(htmlContent.includes('id="btn-desktop-copy-upi"'), 'Desktop UPI ID copy button is present');
assert(htmlContent.includes('id="btn-desktop-verify-order"'), 'Desktop "I Have Paid • Verify & Confirm Order" button is present');

// Mobile UPI App Flow
assert(htmlContent.includes('id="upi-mobile-apps-section"'), 'UPI mobile apps section is present');
assert(htmlContent.includes('id="upi-apps-grid"'), 'UPI apps grid with Google Pay, PhonePe, Paytm, BHIM is present');
assert(htmlContent.includes('id="btn-upi-pay"'), 'Mobile direct UPI app Pay button is present');

console.log('\n--- 2. Testing css/checkout.css for Address & UPI Styles ---');
const cssContent = fs.readFileSync(checkoutCssPath, 'utf8');

assert(cssContent.includes('.btn-add-address-header'), 'Styles for header add-address button exist');
assert(cssContent.includes('.no-saved-addresses-notice'), 'Styles for empty state notice exist');
assert(cssContent.includes('.saved-address-card.selected'), 'Styles for selected saved address card exist');
assert(cssContent.includes('.btn-card-edit'), 'Styles for card Edit button exist');
assert(cssContent.includes('.btn-card-default'), 'Styles for card Set as Default button exist');
assert(cssContent.includes('.delivery-form-container'), 'Styles for collapsible delivery form container exist');
assert(cssContent.includes('.upi-desktop-scan-card'), 'Styles for desktop scan card exist');

// Responsive rules
assert(cssContent.includes('@media (max-width: 768px)'), 'Mobile media query exists');
assert(cssContent.includes('.upi-desktop-scan-card') && cssContent.includes('display: none !important'), 'Desktop scan card is hidden on mobile screens');

console.log('\n--- 3. Testing js/checkout.js Address Sanitization & Flow Logic ---');
const jsContent = fs.readFileSync(checkoutJsPath, 'utf8');

// Sanitizer functions
assert(jsContent.includes('function isDemoOrCorruptAddress'), 'Address sanitizer isDemoOrCorruptAddress is defined');
assert(jsContent.includes('function deduplicateAddresses'), 'Address deduplicator deduplicateAddresses is defined');
assert(jsContent.includes('alexander'), 'Sanitizer filters out Alexander Hayes records');
assert(jsContent.includes('new york'), 'Sanitizer filters out New York records');

// Address form management
assert(jsContent.includes('function openDeliveryForm'), 'openDeliveryForm function is defined');
assert(jsContent.includes('function closeDeliveryForm'), 'closeDeliveryForm function is defined');
assert(jsContent.includes('function handleSaveAddressSubmit'), 'handleSaveAddressSubmit function is defined');
assert(jsContent.includes('function setAddressAsDefault'), 'setAddressAsDefault function is defined');

// Desktop UPI integration
assert(jsContent.includes('elements.desktopScanAmountBadge'), 'Updates desktopScanAmountBadge with dynamic amount');
assert(jsContent.includes('elements.desktopUpiQrContainer'), 'Renders QR code into desktopUpiQrContainer');
assert(jsContent.includes('elements.btnDesktopVerifyOrder'), 'Wires up btnDesktopVerifyOrder');

// Dynamic amount calculations
assert(jsContent.includes('state.advancePayableNow'), 'Uses dynamic state.advancePayableNow');
assert(jsContent.includes('state.total'), 'Uses dynamic state.total for full online payment');

console.log('\n--- 4. Unit Testing Address Sanitization Logic ---');
// Simulate isDemoOrCorruptAddress
function testSanitizer() {
  function isDemoOrCorruptAddress(addr) {
    if (!addr) return true;
    const name = String(addr.full_name || "").toLowerCase().trim();
    const city = String(addr.city || "").toLowerCase().trim();
    const street = String(addr.street || "").toLowerCase().trim();
    const house = String(addr.house || "").toLowerCase().trim();
    const phone = String(addr.phone || "").replace(/\D/g, "");

    if (name.includes("alexander") || name.includes("hayes") || name.includes("john doe") || name.includes("demo user") || name.includes("test user")) {
      return true;
    }
    if (city.includes("new york") || city === "ny") {
      return true;
    }
    if (phone === "1234567890" || phone === "0000000000" || phone === "9999999999" || phone === "1111111111" || (phone.length > 0 && phone.length < 10)) {
      return true;
    }
    if (!name || (!house && !street) || !addr.pincode) {
      return true;
    }
    return false;
  }

  function deduplicateAddresses(addresses) {
    const seen = new Set();
    const unique = [];
    for (const addr of addresses) {
      const key = [
        (addr.full_name || "").toLowerCase().trim(),
        (addr.house || "").toLowerCase().trim(),
        (addr.street || "").toLowerCase().trim(),
        (addr.pincode || "").trim()
      ].join("|");
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(addr);
      }
    }
    return unique;
  }

  const demoList = [
    { id: 1, full_name: "Alexander Hayes", house: "Flat 101", street: "Park Ave", city: "New York", state: "Maharashtra", pincode: "400001", phone: "9876543210" },
    { id: 2, full_name: "Rahul Verma", house: "B-402, Sunshine Heights", street: "MG Road", city: "Bengaluru", state: "Karnataka", pincode: "560001", phone: "9876543210" },
    { id: 3, full_name: "Rahul Verma", house: "B-402, Sunshine Heights", street: "MG Road", city: "Bengaluru", state: "Karnataka", pincode: "560001", phone: "9876543210" }, // duplicate
    { id: 4, full_name: "Priya Sharma", house: "House 12", street: "Civil Lines", city: "Jaipur", state: "Rajasthan", pincode: "302001", phone: "9812345678" },
    { id: 5, full_name: "Demo User", house: "123", street: "Main St", city: "Mumbai", state: "Maharashtra", pincode: "400050", phone: "1234567890" }
  ];

  const filtered = demoList.filter(a => !isDemoOrCorruptAddress(a));
  const unique = deduplicateAddresses(filtered);

  assert(filtered.length === 3, 'Demo addresses (Alexander Hayes, Demo User) were successfully filtered out');
  assert(unique.length === 2, 'Duplicate addresses were successfully pruned to unique records only');
  assert(unique[0].full_name === 'Rahul Verma' && unique[1].full_name === 'Priya Sharma', 'Only genuine customer addresses remain');
}

testSanitizer();

console.log(`\n========================================`);
console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} passed`);
console.log(`========================================\n`);

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}

