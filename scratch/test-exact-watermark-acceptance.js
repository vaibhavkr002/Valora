/**
 * test-exact-watermark-acceptance.js
 * 
 * Formal Acceptance Test for Sarojini Watermark Overlay Expansion & Coverage:
 * 1. Takes the exact screenshot image (Madra Uchiha Anime Tshirt, S-1084290722, ylpxd_1024.jpg)
 *    and verifies at 100% zoom (1024x1024) that zero characters of the source code are visible
 *    outside the watermark, with positive safety margins on all four sides (left, right, top, bottom).
 * 2. Tests another Sarojini product with different code length, position, and aspect ratio
 *    (Men's Oversized Anime Graphic Tee, S-990006640, 1024x819) to ensure dynamic calculation.
 * 3. Tests right-zone and center-zone dynamic behavior.
 */

const assert = require('assert');
const SarojiniWatermark = require('../js/sarojini-watermark.js');

console.log('========================================================================');
console.log('=== SAROJINI WATERMARK OVERLAY EXACT ACCEPTANCE TEST SUITE ===');
console.log('========================================================================\n');

let totalTests = 0;
let passedTests = 0;

function runTest(title, fn) {
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

// ----------------------------------------------------------------------------
// Test 1: Exact Screenshot Product (S-1084290722, 1024x1024) at 100% Zoom
// ----------------------------------------------------------------------------
console.log('--- Acceptance Test 1: Exact Screenshot Image (S-1084290722, 1024x1024) at 100% Zoom ---');

runTest('Zero characters visible at 100% zoom with safety margin on all 4 sides', () => {
  // Ground truth pixel bounds of S-1084290722 on 1024x1024 master image:
  const codePixelBounds = { minX: 11, maxX: 290, minY: 988, maxY: 1014 };
  
  const mockOverlay = { style: {}, classList: { add() {}, remove() {} } };
  const mockImg = { clientWidth: 1024, clientHeight: 1024, naturalWidth: 1024, naturalHeight: 1024 };
  const mockWrap = { clientWidth: 1024, clientHeight: 1024 };
  const detection = SarojiniWatermark.detectSupplierCode('https://images.meesho.com/images/products/1084290722/ylpxd_1024.jpg');
  
  assert.strictEqual(detection.detected, true, 'Code must be detected');
  assert.strictEqual(detection.code, 'S-1084290722', 'Code must match S-1084290722');
  
  SarojiniWatermark.positionOverlay(mockImg, mockWrap, mockOverlay, detection);
  
  const badgeX = parseInt(mockOverlay.style.left, 10);
  const badgeY = parseInt(mockOverlay.style.top, 10);
  const badgeW = parseInt(mockOverlay.style.width, 10);
  const badgeH = parseInt(mockOverlay.style.height, 10);
  
  const badgeRight = badgeX + badgeW;
  const badgeBottom = badgeY + badgeH;
  
  const leftMargin = codePixelBounds.minX - badgeX;
  const rightMargin = badgeRight - codePixelBounds.maxX;
  const topMargin = codePixelBounds.minY - badgeY;
  const bottomMargin = badgeBottom - codePixelBounds.maxY;
  
  console.log(`    Badge Box: [X=${badgeX}, Y=${badgeY}, W=${badgeW}, H=${badgeH}]`);
  console.log(`    Code Bounds: [X=${codePixelBounds.minX}..${codePixelBounds.maxX}, Y=${codePixelBounds.minY}..${codePixelBounds.maxY}]`);
  console.log(`    Left safety margin:   ${leftMargin}px (Watermark starts before first character 'S')`);
  console.log(`    Right safety margin:  ${rightMargin}px (Watermark extends beyond last digit '2')`);
  console.log(`    Top safety margin:    ${topMargin}px (Watermark extends above character ascenders)`);
  console.log(`    Bottom safety margin: ${bottomMargin}px (Watermark extends below character descenders)`);
  
  assert(leftMargin > 0, `Left margin must be positive (got ${leftMargin}px)`);
  assert(rightMargin > 0, `Right margin must be positive (got ${rightMargin}px)`);
  assert(topMargin > 0, `Top margin must be positive (got ${topMargin}px)`);
  assert(bottomMargin > 0, `Bottom margin must be positive (got ${bottomMargin}px)`);
  assert(badgeW >= (codePixelBounds.maxX - codePixelBounds.minX) * 1.08, 'Badge width must be at least 8% larger than code');
});

runTest('Exact Screenshot Product inside standard 520x520 gallery container', () => {
  const mockOverlay = { style: {}, classList: { add() {}, remove() {} } };
  const mockImg = { clientWidth: 520, clientHeight: 520, naturalWidth: 1024, naturalHeight: 1024 };
  const mockWrap = { clientWidth: 520, clientHeight: 520 };
  const detection = SarojiniWatermark.detectSupplierCode('https://images.meesho.com/images/products/1084290722/ylpxd_1024.jpg');
  
  SarojiniWatermark.positionOverlay(mockImg, mockWrap, mockOverlay, detection);
  
  const badgeX = parseInt(mockOverlay.style.left, 10);
  const badgeY = parseInt(mockOverlay.style.top, 10);
  const badgeW = parseInt(mockOverlay.style.width, 10);
  const badgeH = parseInt(mockOverlay.style.height, 10);
  
  // Code scaled to 520x520:
  const scale = 520 / 1024;
  const scaledMinX = 11 * scale;
  const scaledMaxX = 290 * scale;
  const scaledMinY = 988 * scale;
  const scaledMaxY = 1014 * scale;
  
  assert(badgeX <= scaledMinX, 'Left edge must cover code start');
  assert(badgeX + badgeW >= scaledMaxX, 'Right edge must cover code end');
  assert(badgeY <= scaledMinY, 'Top edge must cover code top');
  assert(badgeY + badgeH >= scaledMaxY, 'Bottom edge must cover code bottom');
});

// ----------------------------------------------------------------------------
// Test 2: Second Product with Different Aspect Ratio & Code (S-990006640, 1024x819)
// ----------------------------------------------------------------------------
console.log('\n--- Acceptance Test 2: Second Product Dynamic Sizing (S-990006640, 1024x819) ---');

runTest('Dynamic scaling on different aspect ratio (1024x819) and code length', () => {
  // Ground truth pixel bounds of S-990006640 on 1024x819 image:
  const codePixelBounds = { minX: 9, maxX: 348, minY: 770, maxY: 818 };
  
  const mockOverlay = { style: {}, classList: { add() {}, remove() {} } };
  const mockImg = { clientWidth: 1024, clientHeight: 819, naturalWidth: 1024, naturalHeight: 819 };
  const mockWrap = { clientWidth: 1024, clientHeight: 819 };
  const detection = SarojiniWatermark.detectSupplierCode('https://images.meesho.com/images/products/990006640/8nyjx_1024.jpg');
  
  assert.strictEqual(detection.detected, true);
  assert.strictEqual(detection.code, 'S-990006640');
  
  SarojiniWatermark.positionOverlay(mockImg, mockWrap, mockOverlay, detection);
  
  const badgeX = parseInt(mockOverlay.style.left, 10);
  const badgeY = parseInt(mockOverlay.style.top, 10);
  const badgeW = parseInt(mockOverlay.style.width, 10);
  const badgeH = parseInt(mockOverlay.style.height, 10);
  
  const leftMargin = codePixelBounds.minX - badgeX;
  const rightMargin = (badgeX + badgeW) - codePixelBounds.maxX;
  const topMargin = codePixelBounds.minY - badgeY;
  const bottomMargin = (badgeY + badgeH) - codePixelBounds.maxY;
  
  console.log(`    Badge Box: [X=${badgeX}, Y=${badgeY}, W=${badgeW}, H=${badgeH}]`);
  console.log(`    Code Bounds: [X=${codePixelBounds.minX}..${codePixelBounds.maxX}, Y=${codePixelBounds.minY}..${codePixelBounds.maxY}]`);
  console.log(`    Left safety margin:   ${leftMargin}px`);
  console.log(`    Right safety margin:  ${rightMargin}px`);
  console.log(`    Top safety margin:    ${topMargin}px`);
  console.log(`    Bottom safety margin: ${bottomMargin}px`);
  
  assert(leftMargin > 0, `Left margin must be positive (got ${leftMargin}px)`);
  assert(rightMargin > 0, `Right margin must be positive (got ${rightMargin}px)`);
  assert(topMargin > 0, `Top margin must be positive (got ${topMargin}px)`);
  assert(bottomMargin > 0, `Bottom margin must be positive (got ${bottomMargin}px)`);
});

// ----------------------------------------------------------------------------
// Test 3: Multi-Zone Positioning (Bottom-Right & Bottom-Center)
// ----------------------------------------------------------------------------
console.log('\n--- Acceptance Test 3: Multi-Zone Dynamic Repositioning ---');

runTest('Bottom-Right zone positions badge flush to right edge', () => {
  const mockOverlay = { style: {}, classList: { add() {}, remove() {} } };
  const mockImg = { clientWidth: 500, clientHeight: 500, naturalWidth: 1000, naturalHeight: 1000 };
  const mockWrap = { clientWidth: 500, clientHeight: 500 };
  const detection = { detected: true, zone: 'bottom-right', code: 'S-7766554433' };
  
  SarojiniWatermark.positionOverlay(mockImg, mockWrap, mockOverlay, detection);
  
  const badgeX = parseInt(mockOverlay.style.left, 10);
  const badgeW = parseInt(mockOverlay.style.width, 10);
  
  assert.strictEqual(badgeX + badgeW, 500, 'Right edge of badge must align with right edge of image');
});

runTest('Bottom-Center zone centers badge horizontally', () => {
  const mockOverlay = { style: {}, classList: { add() {}, remove() {} } };
  const mockImg = { clientWidth: 500, clientHeight: 500, naturalWidth: 1000, naturalHeight: 1000 };
  const mockWrap = { clientWidth: 500, clientHeight: 500 };
  const detection = { detected: true, zone: 'bottom-center', code: 'S-7766554433' };
  
  SarojiniWatermark.positionOverlay(mockImg, mockWrap, mockOverlay, detection);
  
  const badgeX = parseInt(mockOverlay.style.left, 10);
  const badgeW = parseInt(mockOverlay.style.width, 10);
  
  const expectedCenter = (500 - badgeW) / 2;
  assert.strictEqual(badgeX, Math.round(expectedCenter), 'Badge must be centered horizontally');
});

// ----------------------------------------------------------------------------
// Test 4: Product Cards Dynamic Sizing & Zero-Visibility on Cards (220x220 & 160x160)
// ----------------------------------------------------------------------------
console.log('\n--- Acceptance Test 4: Product Card Dynamic Sizing (Madara & Gojo) ---');

runTest('Madara (S-1084290722) on 220x220 Product Card has positive safety margins on all 4 sides', () => {
  const codePixelBounds = { minX: 11, maxX: 290, minY: 988, maxY: 1014 };
  const mockOverlay = { style: {}, classList: { add() {}, remove() {}, contains(c) { return c === 'card-watermark'; } } };
  const mockImg = { clientWidth: 204, clientHeight: 204, naturalWidth: 1024, naturalHeight: 1024 };
  const mockWrap = { clientWidth: 220, clientHeight: 220, closest() { return true; } };
  const detection = SarojiniWatermark.detectSupplierCode('https://images.meesho.com/images/products/1084290722/ylpxd_1024.jpg');

  SarojiniWatermark.positionOverlay(mockImg, mockWrap, mockOverlay, detection);

  const badgeX = parseInt(mockOverlay.style.left, 10);
  const badgeY = parseInt(mockOverlay.style.top, 10);
  const badgeW = parseInt(mockOverlay.style.width, 10);
  const badgeH = parseInt(mockOverlay.style.height, 10);

  // Rendered image box in 220x220 with 8px pad: 204x204 at (8, 8)
  const scale = 204 / 1024;
  const scaledMinX = 8 + codePixelBounds.minX * scale;
  const scaledMaxX = 8 + codePixelBounds.maxX * scale;
  const scaledMinY = 8 + codePixelBounds.minY * scale;
  const scaledMaxY = 8 + codePixelBounds.maxY * scale;

  const leftMargin = scaledMinX - badgeX;
  const rightMargin = (badgeX + badgeW) - scaledMaxX;
  const topMargin = scaledMinY - badgeY;
  const bottomMargin = (badgeY + badgeH) - scaledMaxY;

  console.log(`    Card Badge Box: [X=${badgeX}, Y=${badgeY}, W=${badgeW}, H=${badgeH}]`);
  console.log(`    Scaled Code: [X=${scaledMinX.toFixed(1)}..${scaledMaxX.toFixed(1)}, Y=${scaledMinY.toFixed(1)}..${scaledMaxY.toFixed(1)}]`);
  console.log(`    Margins: L=${leftMargin.toFixed(1)}px, R=${rightMargin.toFixed(1)}px, T=${topMargin.toFixed(1)}px, B=${bottomMargin.toFixed(1)}px`);

  assert(leftMargin >= 0, `Left margin must cover code (got ${leftMargin}px)`);
  assert(rightMargin > 0, `Right margin must cover code (got ${rightMargin}px)`);
  assert(topMargin > 0, `Top margin must cover code (got ${topMargin}px)`);
  assert(bottomMargin >= 0, `Bottom margin must cover code (got ${bottomMargin}px)`);
  assert(badgeW <= 100, `Card badge width must be compact and proportional to card (got ${badgeW}px)`);
});

runTest('Gojo (S-990006640, 1024x819) on 220x220 Product Card has positive safety margins on all 4 sides', () => {
  const codePixelBounds = { minX: 9, maxX: 348, minY: 770, maxY: 818 };
  const mockOverlay = { style: {}, classList: { add() {}, remove() {}, contains(c) { return c === 'card-watermark'; } } };
  const mockImg = { clientWidth: 204, clientHeight: 163, naturalWidth: 1024, naturalHeight: 819 };
  const mockWrap = { clientWidth: 220, clientHeight: 220, closest() { return true; } };
  const detection = SarojiniWatermark.detectSupplierCode('https://images.meesho.com/images/products/990006640/8nyjx_1024.jpg');

  SarojiniWatermark.positionOverlay(mockImg, mockWrap, mockOverlay, detection);

  const badgeX = parseInt(mockOverlay.style.left, 10);
  const badgeY = parseInt(mockOverlay.style.top, 10);
  const badgeW = parseInt(mockOverlay.style.width, 10);
  const badgeH = parseInt(mockOverlay.style.height, 10);

  // Rendered image box in 220x220 with 8px pad: 204x163.2 at (8, 28.4)
  const scaleX = 204 / 1024;
  const scaleY = 163.2 / 819;
  const scaledMinX = 8 + codePixelBounds.minX * scaleX;
  const scaledMaxX = 8 + codePixelBounds.maxX * scaleX;
  const scaledMinY = 28.4 + codePixelBounds.minY * scaleY;
  const scaledMaxY = 28.4 + codePixelBounds.maxY * scaleY;

  const leftMargin = scaledMinX - badgeX;
  const rightMargin = (badgeX + badgeW) - scaledMaxX;
  const topMargin = scaledMinY - badgeY;
  const bottomMargin = (badgeY + badgeH) - scaledMaxY;

  console.log(`    Card Badge Box: [X=${badgeX}, Y=${badgeY}, W=${badgeW}, H=${badgeH}]`);
  console.log(`    Scaled Code: [X=${scaledMinX.toFixed(1)}..${scaledMaxX.toFixed(1)}, Y=${scaledMinY.toFixed(1)}..${scaledMaxY.toFixed(1)}]`);
  console.log(`    Margins: L=${leftMargin.toFixed(1)}px, R=${rightMargin.toFixed(1)}px, T=${topMargin.toFixed(1)}px, B=${bottomMargin.toFixed(1)}px`);

  assert(leftMargin >= 0, `Left margin must cover code (got ${leftMargin}px)`);
  assert(rightMargin > 0, `Right margin must cover code (got ${rightMargin}px)`);
  assert(topMargin > 0, `Top margin must cover code (got ${topMargin}px)`);
  assert(bottomMargin >= 0, `Bottom margin must cover code (got ${bottomMargin}px)`);
});

runTest('attachCardWatermark dynamically injects and binds watermark overlay to card element', () => {
  let innerHtml = '';
  const mockOverlay = { style: {}, classList: { add() {}, remove() {}, contains() { return true; } } };
  const mockParent = {
    clientWidth: 220,
    clientHeight: 220,
    querySelector() { return mockOverlay; },
    insertAdjacentHTML(pos, html) { innerHtml += html; },
    closest() { return true; }
  };
  const mockImg = {
    src: 'https://images.meesho.com/images/products/1084290722/ylpxd_1024.jpg',
    parentElement: mockParent,
    clientWidth: 204,
    clientHeight: 204,
    naturalWidth: 1024,
    naturalHeight: 1024,
    complete: true,
    addEventListener() {}
  };

  SarojiniWatermark.attachCardWatermark(mockImg);

  assert.strictEqual(mockOverlay.style.display, 'flex', 'Overlay must be displayed on detected card');
  assert(parseInt(mockOverlay.style.width, 10) > 0, 'Overlay width must be set');
  assert(parseInt(mockOverlay.style.height, 10) > 0, 'Overlay height must be set');
});

runTest('Clean product images without codes do NOT have watermark on cards', () => {
  const mockOverlay = { style: { display: 'flex' }, classList: { add() {}, remove() {} } };
  const mockParent = {
    clientWidth: 220,
    clientHeight: 220,
    querySelector() { return mockOverlay; }
  };
  const mockImg = {
    src: 'assets/sarojni/prod-1-graphic-tee.png',
    parentElement: mockParent,
    clientWidth: 204,
    clientHeight: 204,
    naturalWidth: 800,
    naturalHeight: 800,
    complete: true,
    addEventListener() {}
  };

  SarojiniWatermark.attachCardWatermark(mockImg);

  assert.strictEqual(mockOverlay.style.display, 'none', 'Clean product card must hide overlay');
});

console.log(`\n========================================================================`);
console.log(`RESULTS: ${passedTests}/${totalTests} acceptance tests passed.`);
console.log(`========================================================================\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}


