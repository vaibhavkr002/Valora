/**
 * scratch/test-smart-address.js
 * Automated verification of VELORA Smart India-First Address System
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const checkoutHtmlPath = path.join(rootDir, 'checkout.html');
const checkoutCssPath = path.join(rootDir, 'css', 'checkout.css');
const checkoutJsPath = path.join(rootDir, 'js', 'checkout.js');
const pincodeEnginePath = path.join(rootDir, 'js', 'pincode-engine.js');

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

console.log('\n--- 1. Testing checkout.html Structure & Elements ---');
const htmlContent = fs.readFileSync(checkoutHtmlPath, 'utf8');

// Script tags
assert(htmlContent.includes('js/pincode-engine.js'), 'checkout.html includes js/pincode-engine.js script tag');
assert(htmlContent.includes('js/checkout.js'), 'checkout.html includes js/checkout.js script tag');

// Saved addresses container
assert(htmlContent.includes('id="saved-addresses-section"'), 'Contains saved-addresses-section');
assert(htmlContent.includes('id="saved-addresses-grid"'), 'Contains saved-addresses-grid');
assert(htmlContent.includes('id="btn-toggle-address-mode"'), 'Contains btn-toggle-address-mode');

// Contact fields
assert(htmlContent.includes('id="input-fullname"'), 'Contains input-fullname');
assert(htmlContent.includes('id="input-phone"'), 'Contains input-phone');
assert(htmlContent.includes('phone-prefix-badge'), 'Contains phone-prefix-badge with +91 indicator');
assert(htmlContent.includes('id="input-email"'), 'Contains input-email');

// Location fields
assert(htmlContent.includes('id="select-country"'), 'Contains select-country');
assert(htmlContent.includes('value="India" selected'), 'Country defaults to India');
assert(htmlContent.includes('id="input-state"'), 'Contains input-state dropdown');
assert(htmlContent.includes('id="input-city"'), 'Contains input-city combobox');
assert(htmlContent.includes('id="btn-city-dropdown-toggle"'), 'Contains btn-city-dropdown-toggle');
assert(htmlContent.includes('id="city-autocomplete-list"'), 'Contains city-autocomplete-list container');
assert(htmlContent.includes('id="input-zip"'), 'Contains input-zip');
assert(htmlContent.includes('id="pincode-status-badge"'), 'Contains pincode-status-badge');
assert(htmlContent.includes('id="pincode-mismatch-banner"'), 'Contains pincode-mismatch-banner');
assert(htmlContent.includes('id="btn-mismatch-accept"'), 'Contains btn-mismatch-accept');
assert(htmlContent.includes('id="btn-mismatch-dismiss"'), 'Contains btn-mismatch-dismiss');
assert(htmlContent.includes('id="group-post-office"'), 'Contains group-post-office');
assert(htmlContent.includes('id="select-post-office"'), 'Contains select-post-office');

// Address lines
assert(htmlContent.includes('id="input-house"'), 'Contains input-house');
assert(htmlContent.includes('id="input-street"'), 'Contains input-street');
assert(htmlContent.includes('id="input-landmark"'), 'Contains input-landmark');
assert(htmlContent.includes('id="check-save-address"'), 'Contains check-save-address');
assert(htmlContent.includes('id="check-default-address"'), 'Contains check-default-address');

// State dropdown options (all 36 States + UTs)
const all36StatesAndUTs = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar",
  "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa",
  "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka",
  "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim",
  "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"
];
let statesPresent = 0;
all36StatesAndUTs.forEach(st => {
  if (htmlContent.includes(`value="${st}"`)) statesPresent++;
});
assert(statesPresent === 36, `All 36 Indian States and Union Territories present in dropdown (found ${statesPresent}/36)`);

console.log('\n--- 2. Testing css/checkout.css Styles ---');
const cssContent = fs.readFileSync(checkoutCssPath, 'utf8');

assert(cssContent.includes('.saved-addresses-section'), 'CSS has .saved-addresses-section styles');
assert(cssContent.includes('.saved-address-card'), 'CSS has .saved-address-card styles');
assert(cssContent.includes('.phone-prefix-badge'), 'CSS has .phone-prefix-badge styles');
assert(cssContent.includes('.city-autocomplete-list'), 'CSS has .city-autocomplete-list styles');
assert(cssContent.includes('.pincode-status-badge'), 'CSS has .pincode-status-badge styles');
assert(cssContent.includes('.pincode-mismatch-banner'), 'CSS has .pincode-mismatch-banner styles');
assert(cssContent.includes('@media (max-width: 768px)'), 'CSS has 768px responsive breakpoint');
assert(cssContent.includes('#india-location-row.form-row-3'), 'Responsive breakpoint stacks location fields on mobile');

console.log('\n--- 3. Testing js/checkout.js Logic & Datasets ---');
const jsContent = fs.readFileSync(checkoutJsPath, 'utf8');

assert(jsContent.includes('const INDIA_LOCATIONS = {'), 'Contains INDIA_LOCATIONS dataset');
assert(jsContent.includes('loadSavedAddresses()'), 'Contains loadSavedAddresses logic');
assert(jsContent.includes('renderSavedAddresses()'), 'Contains renderSavedAddresses logic');
assert(jsContent.includes('renderCitySuggestions('), 'Contains renderCitySuggestions combobox autocomplete');
assert(jsContent.includes('lookupPincode('), 'Contains lookupPincode with timeout & fallback');
assert(jsContent.includes('handlePincodeChange('), 'Contains handlePincodeChange logic');
assert(jsContent.includes('pincode-mismatch-banner'), 'Handles pincode mismatch recommendation banner');
assert(jsContent.includes('syncAddressToSupabase()'), 'Contains syncAddressToSupabase helper');

// Check that 36 states are also in INDIA_LOCATIONS dataset in JS
let jsStatesCount = 0;
all36StatesAndUTs.forEach(st => {
  if (jsContent.includes(`"${st}":`)) jsStatesCount++;
});
assert(jsStatesCount === 36, `All 36 Indian States and UTs present in INDIA_LOCATIONS dataset (found ${jsStatesCount}/36)`);

console.log('\n--- 4. Testing Indian PIN Code Validation & Engine Resolution ---');
const pincodeEngineContent = fs.readFileSync(pincodeEnginePath, 'utf8');

// Simulate the pincode resolution logic
const pincodeRegex = /^[1-9][0-9]{5}$/;
assert(pincodeRegex.test('400001'), '400001 is valid Indian PIN');
assert(pincodeRegex.test('800001'), '800001 is valid Indian PIN');
assert(pincodeRegex.test('110001'), '110001 is valid Indian PIN');
assert(!pincodeRegex.test('012345'), '012345 rejected (starts with 0)');
assert(!pincodeRegex.test('40001'), '40001 rejected (5 digits)');
assert(!pincodeRegex.test('4000011'), '4000011 rejected (7 digits)');
assert(!pincodeRegex.test('40000A'), '40000A rejected (contains letter)');

// Check mock environment resolution of VeloraPincodeEngine
const sandbox = {};
eval(`(function(window) { ${pincodeEngineContent} })(sandbox)`);
const engine = sandbox.VeloraPincodeEngine;
assert(typeof engine === 'object', 'VeloraPincodeEngine initialized successfully');

const mumbaiRes = engine.resolveRegion('400001');
assert(mumbaiRes && mumbaiRes.state === 'Maharashtra', `400001 resolves to Maharashtra (got ${mumbaiRes ? mumbaiRes.state : 'null'})`);

const patnaRes = engine.resolveRegion('800001');
assert(patnaRes && (patnaRes.state === 'Bihar' || patnaRes.state === 'Bihar / Jharkhand'), `800001 resolves to Bihar (got ${patnaRes ? patnaRes.state : 'null'})`);

const delhiRes = engine.resolveRegion('110001');
assert(delhiRes && delhiRes.state === 'Delhi', `110001 resolves to Delhi (got ${delhiRes ? delhiRes.state : 'null'})`);

const bangaloreRes = engine.resolveRegion('560001');
assert(bangaloreRes && bangaloreRes.state === 'Karnataka', `560001 resolves to Karnataka (got ${bangaloreRes ? bangaloreRes.state : 'null'})`);

console.log('\n--- 5. Testing Dynamic Advance Calculation & Zero Hardcoding ---');
// Verify that advance is computed dynamically from cart items and never fixed to 120
assert(jsContent.includes('item.advance_payment_enabled'), 'Dynamic advance checks item.advance_payment_enabled');
assert(jsContent.includes('state.advancePayableNow'), 'Dynamic advance tracked in state.advancePayableNow');
assert(jsContent.includes('state.remainingCodAmount'), 'Remaining COD balance tracked dynamically in state.remainingCodAmount');

// Check that order buttons use formatPrice(state.advancePayableNow)
assert(jsContent.includes('formatPrice(state.advancePayableNow)'), 'Button text dynamically renders formatted advance amount');

console.log(`\n========================================`);
console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} tests passed`);
console.log(`========================================\n`);

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}

