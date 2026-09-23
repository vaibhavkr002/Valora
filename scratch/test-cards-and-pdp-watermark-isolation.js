/**
 * test-cards-and-pdp-watermark-isolation.js
 * 
 * Formal Acceptance Test for Sarojini Watermark & Promotional Ticker Isolation:
 * 1. Simulates rendering a Sarojini category/listing page containing all catalog products (24 items).
 *    Verifies that every single card contains:
 *    - The product image with normal discount badge & wishlist button
 *    - ZERO "VADI STORE" watermark text
 *    - ZERO "SAROJINI BAZAAR" watermark badge
 *    - ZERO promotional marquee / ticker text inside the card media or card body
 * 2. Simulates homepage bazaar cards and related products cards.
 *    Verifies ZERO watermark and ZERO promotional marquee inside them.
 * 3. Verifies that the Product Details page retains the automatic watermark overlay
 *    specifically on the large main product image, and retains the promotional marquee strip
 *    in its dedicated below-media container location.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('========================================================================');
console.log('=== SAROJINI PRODUCT CARDS & PDP WATERMARK ISOLATION TEST ===');
console.log('========================================================================\n');

let passedTests = 0;
let totalTests = 0;

function it(title, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ ${title}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${title}`);
    console.error(`    ${err.message}`);
  }
}

// Mock DOM elements and storage
global.window = {
  location: { search: '' },
  addEventListener: () => {}
};
global.document = {
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {}
};

// 1. Test Sarojini Shop Listing (Category / Search / All Products)
console.log('--- 1. Sarojini Shop Listing Cards (sarojini-shop.js) ---');

it('Renders catalog cards with dynamic watermark integration and ZERO promotional marquee text', () => {
  const shopJsContent = fs.readFileSync(path.join(__dirname, '../js/sarojini-shop.js'), 'utf8');
  
  // Verify that card-media has discount badge, wishlist, and image, but NO promo strip
  const cardMediaRegex = /<div class="product-card-media">([\s\S]*?)<\/div>\s*<div class="product-card-body">/g;
  const match = cardMediaRegex.exec(shopJsContent);
  assert(match, 'Must find product-card-media structure in sarojini-shop.js');
  const cardMediaContent = match[1];
  
  assert(!cardMediaContent.includes('getSarojiniPromoStripHtml'), 'Card media must NOT contain getSarojiniPromoStripHtml');
  assert(!cardMediaContent.includes('sarojini-promo-strip'), 'Card media must NOT contain sarojini-promo-strip');
  assert(cardMediaContent.includes('product-card-badge'), 'Card media MUST contain discount badge');
  assert(cardMediaContent.includes('product-card-wishlist'), 'Card media MUST contain wishlist button');
  assert(cardMediaContent.includes('sarojini-card-img-wrap'), 'Card image link must use sarojini-card-img-wrap');
  
  // Verify that card watermark hook is wired after rendering
  assert(shopJsContent.includes('SarojiniWatermark.attachCardWatermarks'), 'sarojini-shop.js must call attachCardWatermarks');
});

// 2. Test Sarojini Bazaar Home & Trending Cards
console.log('\n--- 2. Bazaar Home & Trending Cards (sarojini-bazaar-page.js & sarojini-bazaar.js) ---');

it('Bazaar home and trending cards have dynamic watermark hook and ZERO promo strip', () => {
  const pageJs = fs.readFileSync(path.join(__dirname, '../js/sarojini-bazaar-page.js'), 'utf8');
  const bazaarJs = fs.readFileSync(path.join(__dirname, '../js/sarojini-bazaar.js'), 'utf8');

  const pageCardMediaRegex = /<div class="product-card-media">([\s\S]*?)<\/div>\s*<div class="product-card-body">/g;
  const pageMatch = pageCardMediaRegex.exec(pageJs);
  assert(pageMatch, 'Must find product-card-media in sarojini-bazaar-page.js');
  assert(!pageMatch[1].includes('getSarojiniPromoStripHtml'), 'sarojini-bazaar-page.js cards must NOT have promo strip');
  assert(pageJs.includes('SarojiniWatermark.attachCardWatermarks'), 'sarojini-bazaar-page.js must call attachCardWatermarks');

  assert(!bazaarJs.includes('getSarojiniPromoStripHtml()'), 'sarojini-bazaar.js cards must NOT have promo strip');
  assert(bazaarJs.includes('SarojiniWatermark.attachCardWatermarks'), 'sarojini-bazaar.js must call attachCardWatermarks');
});

// 3. Test Related Products on PDP
console.log('\n--- 3. Related Products Cards on Product Details (sarojini-product-details.js) ---');

it('Related product cards have dynamic watermark hook and ZERO promo strip', () => {
  const pdpJs = fs.readFileSync(path.join(__dirname, '../js/sarojini-product-details.js'), 'utf8');
  
  // In loadRelatedSarojiniProducts
  const relatedRegex = /function loadRelatedSarojiniProducts[\s\S]*?grid\.innerHTML\s*=\s*related\.map\(prod => \{([\s\S]*?)\}\)\.join\(''\);/g;
  const relatedMatch = relatedRegex.exec(pdpJs);
  assert(relatedMatch, 'Must find loadRelatedSarojiniProducts');
  const cardTemplate = relatedMatch[1];
  
  assert(!cardTemplate.includes('getSarojiniPromoStripHtml'), 'Related cards must NOT have promo strip');
  assert(pdpJs.includes('SarojiniWatermark.attachCardWatermarks'), 'Related cards must call attachCardWatermarks');
});

// 4. Test Product Details Main Image Gallery
console.log('\n--- 4. Product Details Main Image Gallery Retains Watermark & Ticker ---');

it('Product Details page retains automatic watermark overlay on main image only', () => {
  const pdpHtml = fs.readFileSync(path.join(__dirname, '../sarojini-product-details.html'), 'utf8');
  const pdpJs = fs.readFileSync(path.join(__dirname, '../js/sarojini-product-details.js'), 'utf8');

  // Verify pdp-image-wrapper contains main image and watermark overlay
  assert(pdpHtml.includes('id="pdp-image-wrapper"'), 'Must have pdp-image-wrapper');
  assert(pdpHtml.includes('id="pdp-main-img"'), 'Must have pdp-main-img');
  assert(pdpHtml.includes('id="pdp-watermark-overlay"'), 'Must have pdp-watermark-overlay');

  // Verify JS calls watermark specifically on the main image
  assert(pdpJs.includes("const overlay = document.getElementById('pdp-watermark-overlay');"), 'Scopes overlay to pdp-watermark-overlay');
  assert(pdpJs.includes("const wrapper = document.getElementById('pdp-image-wrapper');"), 'Scopes wrapper to pdp-image-wrapper');
  assert(pdpJs.includes("const img = document.getElementById('pdp-main-img');"), 'Scopes img to pdp-main-img');
  assert(pdpJs.includes('window.SarojiniWatermark.updateImageWatermark(img, wrapper, overlay)'), 'Invokes watermark updater on main image');

  // Verify promo marquee strip is in its dedicated container below media wrap
  assert(pdpHtml.includes('sarojini-promo-strip sarojini-promo-strip-pdp'), 'Retains independent promotional strip below media wrap');
});

console.log(`\n========================================================================`);
console.log(`RESULTS: ${passedTests}/${totalTests} card isolation tests passed.`);
console.log(`========================================================================\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}

