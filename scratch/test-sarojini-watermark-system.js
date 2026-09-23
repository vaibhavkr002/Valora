/**
 * test-sarojini-watermark-system.js
 * Verification suite for the Automatic Sarojini Bazaar Product-Image Watermark System.
 * Ensures the watermark is rendered INSIDE the image wrapper, directly over the detected code,
 * completely hiding supplier codes (e.g. S-1084290722, S-990006640) with branded:
 *   ● VADI STORE
 *   SAROJINI BAZAAR
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Mock HTML5 Canvas API in Node.js environment
function createMockCanvas(width, height) {
  const pixelBuffer = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < pixelBuffer.length; i += 4) {
    pixelBuffer[i] = 240;
    pixelBuffer[i + 1] = 240;
    pixelBuffer[i + 2] = 242;
    pixelBuffer[i + 3] = 255;
  }

  let fillStyle = '#000000';
  let strokeStyle = '#000000';
  let font = '10px sans-serif';
  let textAlign = 'left';
  let textBaseline = 'alphabetic';
  let lineWidth = 1;
  const drawnRects = [];
  const drawnTexts = [];

  const ctx = {
    canvas: { width, height },
    get fillStyle() { return fillStyle; },
    set fillStyle(val) { fillStyle = val; },
    get strokeStyle() { return strokeStyle; },
    set strokeStyle(val) { strokeStyle = val; },
    get font() { return font; },
    set font(val) { font = val; },
    get textAlign() { return textAlign; },
    set textAlign(val) { textAlign = val; },
    get textBaseline() { return textBaseline; },
    set textBaseline(val) { textBaseline = val; },
    get lineWidth() { return lineWidth; },
    set lineWidth(val) { lineWidth = val; },
    shadowColor: 'transparent',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,

    save() {},
    restore() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    quadraticCurveTo() {},
    closePath() {},
    stroke() {},
    fillRect(x, y, w, h) {
      drawnRects.push({ type: 'fill', x, y, w, h, fillStyle });
    },
    fill() {
      drawnRects.push({ type: 'pathFill', fillStyle });
    },
    fillText(text, x, y) {
      drawnTexts.push({ text, x, y, font, textAlign, fillStyle });
    },
    createLinearGradient(x0, y0, x1, y1) {
      return { addColorStop(offset, color) {} };
    },
    getImageData(sx, sy, sw, sh) {
      const data = new Uint8ClampedArray(sw * sh * 4);
      return { data, width: sw, height: sh };
    },
    putImageData() {}
  };

  return {
    width,
    height,
    getContext: () => ctx,
    toDataURL: (type) => `data:${type};base64,mockWatermarkedImage_${width}x${height}`,
    _drawnRects: drawnRects,
    _drawnTexts: drawnTexts
  };
}

global.document = {
  createElement: (tag) => {
    if (tag === 'canvas') return createMockCanvas(1000, 1000);
    return {};
  }
};

const SarojiniCleaner = require('../js/sarojini-image-cleaner.js');
const SarojiniWatermark = require('../js/sarojini-watermark.js');

let passedTests = 0;
let totalTests = 0;

function it(desc, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${desc}`);
    console.error(`    Error: ${err.message}`);
  }
}

console.log('================================================================');
console.log('SAROJINI BAZAAR AUTOMATIC IMAGE WATERMARK SYSTEM TEST SUITE');
console.log('================================================================\n');

// 1. Supplier URL Resolution
console.log('--- 1. Supplier URL Resolution & High-Res Upgrade ---');
it('Upgrades Meesho 512px thumbnail to 1024px maximum resolution', () => {
  const lowRes = 'https://images.meesho.com/images/products/108429072/512_cover.jpg';
  const highRes = SarojiniCleaner.upgradeSupplierUrl(lowRes);
  assert.strictEqual(highRes, 'https://images.meesho.com/images/products/108429072/1024_cover.jpg');
});

it('Preserves non-supplier URLs without corruption', () => {
  const cloudUrl = 'https://res.cloudinary.com/valora/image/upload/v1234/sarojini-kurti.jpg';
  assert.strictEqual(SarojiniCleaner.upgradeSupplierUrl(cloudUrl), cloudUrl);
});

// 2. Exact Code Detection for S-1084290722 & S-990006640
console.log('\n--- 2. Targeted Supplier Code Detection ---');
it('Detects code S-1084290722 at bottom-left on Madra Uchiha Anime Tshirt image', () => {
  const madraUrl = 'https://images.meesho.com/images/products/1084290722/ylpxd_1024.jpg';
  const detection = SarojiniWatermark.detectSupplierCode(madraUrl);
  assert(detection.detected, 'Must detect code on Meesho product image');
  assert.strictEqual(detection.code, 'S-1084290722');
  assert.strictEqual(detection.zone, 'bottom-left');
  assert.strictEqual(detection.css.left, '0%');
  assert.strictEqual(detection.css.bottom, '0%');
});

it('Detects code S-990006640 at bottom-left on Gojo anime t-shirt image', () => {
  const gojoUrl = 'https://images.meesho.com/images/products/990006640/8nyjx_512.avif';
  const detection = SarojiniWatermark.detectSupplierCode(gojoUrl);
  assert(detection.detected, 'Must detect code on Meesho product image');
  assert.strictEqual(detection.code, 'S-990006640');
  assert.strictEqual(detection.zone, 'bottom-left');
});

it('Does NOT detect code on clean non-supplier images (zero false positives)', () => {
  const cleanUrl = 'assets/sarojni/prod-1-graphic-tee.png';
  const detection = SarojiniWatermark.detectSupplierCode(cleanUrl);
  assert.strictEqual(detection.detected, false, 'Clean image must not have watermark');
});

// 3. Dynamic Watermark Badge Generation
console.log('\n--- 3. Luxury Branded Watermark Badge (● VADI STORE / SAROJINI BAZAAR) ---');
it('Generates branded badge with ● VADI STORE and SAROJINI BAZAAR typography', () => {
  const html = SarojiniWatermark.getWatermarkBadgeHtml();
  assert(html.includes('●'), 'Must include dot ● symbol');
  assert(html.includes('VADI STORE'), 'Must include VADI STORE title');
  assert(html.includes('SAROJINI BAZAAR'), 'Must include SAROJINI BAZAAR subtext');
  assert(html.includes('sarojini-watermark-overlay'), 'Must have sarojini-watermark-overlay class');
});

it('Canvas cleaner renders opaque ● VADI STORE and SAROJINI BAZAAR over code area (< 0.6% image area)', () => {
  const canvas = createMockCanvas(1024, 1024);
  const ctx = canvas.getContext('2d');
  const codeBox = { x: 18, y: 978, w: 160, h: 26, zone: 'bottom-left' };

  const watermarkBox = SarojiniCleaner.applyVadiWatermark(ctx, codeBox, 1024, 1024);
  assert(watermarkBox, 'Watermark box must be returned');
  assert(watermarkBox.w >= codeBox.w, 'Watermark must cover full width of code');
  assert(watermarkBox.h >= codeBox.h, 'Watermark must cover full height of code');

  const coverageRatio = (watermarkBox.w * watermarkBox.h) / (1024 * 1024);
  console.log(`    Badge dimensions: ${watermarkBox.w}x${watermarkBox.h}px (${(coverageRatio * 100).toFixed(3)}% of image)`);
  assert(coverageRatio < 0.006, `Badge must cover < 0.6% of image, got ${(coverageRatio * 100).toFixed(3)}%`);

  const hasVadi = canvas._drawnTexts.some(t => t.text.includes('VADI STORE'));
  const hasSarojini = canvas._drawnTexts.some(t => t.text.includes('SAROJINI BAZAAR'));
  assert(hasVadi, 'Canvas must render VADI STORE');
  assert(hasSarojini, 'Canvas must render SAROJINI BAZAAR');
});

// 4. Product Details Structure Verification
console.log('\n--- 4. Product Details DOM Structure (image-wrapper & watermark-overlay) ---');
it('sarojini-product-details.html wraps image in .sarojini-image-wrapper with absolute .sarojini-watermark-overlay', () => {
  const html = fs.readFileSync(path.join(__dirname, '../sarojini-product-details.html'), 'utf8');
  assert(html.includes('id="pdp-image-wrapper"'), 'Must have pdp-image-wrapper element');
  assert(html.includes('class="sarojini-image-wrapper"'), 'Must have sarojini-image-wrapper class');
  assert(html.includes('id="pdp-watermark-overlay"'), 'Must have pdp-watermark-overlay element');
  assert(html.includes('class="sarojini-watermark-overlay"'), 'Must have sarojini-watermark-overlay class');
  assert(html.includes('class="sarojini-product-image"'), 'Must have sarojini-product-image class');
  assert(html.includes('js/sarojini-watermark.js'), 'Must load sarojini-watermark.js');
});

it('css/sarojini-product-details.css defines image-relative overlay and separates promo marquee', () => {
  const css = fs.readFileSync(path.join(__dirname, '../css/sarojini-product-details.css'), 'utf8');
  assert(css.includes('.sarojini-image-wrapper {'), 'Must define .sarojini-image-wrapper');
  assert(css.includes('position: relative;'), 'Wrapper must be relative');
  assert(css.includes('.sarojini-watermark-overlay {'), 'Must define .sarojini-watermark-overlay');
  assert(css.includes('position: absolute;'), 'Watermark overlay must be absolute');
  assert(css.includes('background: #121110;'), 'Watermark must have opaque dark obsidian background');
  assert(css.includes('.sarojini-promo-strip.sarojini-promo-strip-pdp {'), 'Must style independent PDP promo strip');
});

it('sarojini-product-details.js updates watermark dynamically on image load and thumbnail switch', () => {
  const js = fs.readFileSync(path.join(__dirname, '../js/sarojini-product-details.js'), 'utf8');
  assert(js.includes('updatePdpWatermark'), 'Must define updatePdpWatermark');
  assert(js.includes('window.SarojiniWatermark.updateImageWatermark'), 'Must call SarojiniWatermark.updateImageWatermark');
  assert(!js.includes("mediaWrap.insertAdjacentHTML('beforeend', getSarojiniPromoStripHtml(true))"), 'Must NOT inject promo strip inside media wrap');
});

// 5. Product Cards Watermark & Marquee Isolation (Zero Promo Marquee on Cards, Dynamic Watermark on Detected Cards)
console.log('\n--- 5. Product Cards Watermark & Marquee Isolation ---');
it('sarojini-shop.js, sarojini-bazaar-page.js, and sarojini-bazaar.js wire dynamic watermarks and have ZERO promo strip on cards', () => {
  const shopJs = fs.readFileSync(path.join(__dirname, '../js/sarojini-shop.js'), 'utf8');
  const bazaarPageJs = fs.readFileSync(path.join(__dirname, '../js/sarojini-bazaar-page.js'), 'utf8');
  const bazaarJs = fs.readFileSync(path.join(__dirname, '../js/sarojini-bazaar.js'), 'utf8');
  const pdpJs = fs.readFileSync(path.join(__dirname, '../js/sarojini-product-details.js'), 'utf8');

  // Verify dynamic card watermark integration
  assert(shopJs.includes('attachCardWatermarks'), 'sarojini-shop.js must call attachCardWatermarks');
  assert(bazaarPageJs.includes('attachCardWatermarks'), 'sarojini-bazaar-page.js must call attachCardWatermarks');
  assert(bazaarJs.includes('attachCardWatermarks'), 'sarojini-bazaar.js must call attachCardWatermarks');

  // Verify ZERO promotional marquee / ticker on cards
  assert(!shopJs.includes('getSarojiniPromoStripHtml'), 'sarojini-shop.js must NOT have promo strip');
  assert(!shopJs.includes('sarojini-promo-strip'), 'sarojini-shop.js must NOT inject promo strip');

  assert(!bazaarPageJs.includes('getSarojiniPromoStripHtml'), 'sarojini-bazaar-page.js must NOT have promo strip');
  assert(!bazaarPageJs.includes('sarojini-promo-strip'), 'sarojini-bazaar-page.js must NOT inject promo strip');

  assert(!bazaarJs.includes('getSarojiniPromoStripHtml'), 'sarojini-bazaar.js must NOT have promo strip');
  assert(!bazaarJs.includes('sarojini-promo-strip'), 'sarojini-bazaar.js must NOT inject promo strip');

  assert(!pdpJs.includes('getSarojiniPromoStripHtml(false)'), 'sarojini-product-details.js must NOT inject promo strip into related cards');
});

// 6. Responsive Zoom & Full Gallery Layout Verification (100%, 125%, 150%)
console.log('\n--- 6. Responsive Zoom & Full Gallery Layout Verification ---');
it('PDP CSS specifies width: 100% and height: 100% with object-fit: contain to prevent image collapse', () => {
  const css = fs.readFileSync(path.join(__dirname, '../css/sarojini-product-details.css'), 'utf8');
  assert(css.includes('.sarojini-image-wrapper {') && css.includes('width: 100%;') && css.includes('height: 100%;'), 'Wrapper must use width: 100% and height: 100%');
  assert(css.includes('.sarojini-product-image,') && css.includes('object-fit: contain;'), 'Product image must use object-fit: contain');
  assert(!css.includes('width: auto;'), 'CSS must NOT use width: auto causing collapse');
});

it('positionOverlay calculates exact displayed coordinates at 100%, 125%, and 150% browser zoom with safety margins', () => {
  const mockOverlay = { style: {}, classList: { add() {}, remove() {} } };
  const detection = { detected: true, zone: 'bottom-left', code: 'S-1084290722' };

  // 100% Zoom: Container 480x640, Image 1024x1024 (1:1 square)
  const mockImg100 = { clientWidth: 480, clientHeight: 640, naturalWidth: 1024, naturalHeight: 1024 };
  const mockWrap100 = { clientWidth: 480, clientHeight: 640 };
  SarojiniWatermark.positionOverlay(mockImg100, mockWrap100, mockOverlay, detection);
  
  // Rendered image is 480x480, centered vertically with offsetY = (640-480)/2 = 80px
  assert.strictEqual(mockOverlay.style.display, 'flex');
  assert.strictEqual(mockOverlay.style.left, '0px'); // Flush to left edge (offsetX = 0) for extra coverage beyond 'S'
  const y100 = parseInt(mockOverlay.style.top, 10);
  assert(y100 >= 500 && y100 <= 555, `Badge top at 100% zoom must be near image bottom, got ${y100}`);
  const w100 = parseInt(mockOverlay.style.width, 10);
  assert(w100 >= 160 && w100 <= 220, `Badge width must provide safety margin, got ${w100}`);

  // 125% Zoom: Container 600x800, Image 1024x1024
  const mockImg125 = { clientWidth: 600, clientHeight: 800, naturalWidth: 1024, naturalHeight: 1024 };
  const mockWrap125 = { clientWidth: 600, clientHeight: 800 };
  SarojiniWatermark.positionOverlay(mockImg125, mockWrap125, mockOverlay, detection);
  assert.strictEqual(mockOverlay.style.left, '0px');
  const y125 = parseInt(mockOverlay.style.top, 10);
  assert(y125 >= 630 && y125 <= 710, `Badge top at 125% zoom must scale, got ${y125}`);

  // 150% Zoom: Container 720x960, Image 1024x1024
  const mockImg150 = { clientWidth: 720, clientHeight: 960, naturalWidth: 1024, naturalHeight: 1024 };
  const mockWrap150 = { clientWidth: 720, clientHeight: 960 };
  SarojiniWatermark.positionOverlay(mockImg150, mockWrap150, mockOverlay, detection);
  assert.strictEqual(mockOverlay.style.left, '0px');
  const y150 = parseInt(mockOverlay.style.top, 10);
  assert(y150 >= 760 && y150 <= 860, `Badge top at 150% zoom must scale, got ${y150}`);
});

// 7. Scope Isolation
console.log('\n--- 7. Scope Isolation ---');
it('Main VADI files are 100% untouched and do not include Sarojini watermark logic', () => {
  const mainShop = fs.readFileSync(path.join(__dirname, '../shop.html'), 'utf8');
  const mainDetails = fs.readFileSync(path.join(__dirname, '../product.html'), 'utf8');
  const mainAddProd = fs.readFileSync(path.join(__dirname, '../admin/add-product.html'), 'utf8');

  assert(!mainShop.includes('sarojini-watermark.js'), 'Main shop.html must not include Sarojini watermark');
  assert(!mainDetails.includes('sarojini-watermark.js'), 'Main product.html must not include Sarojini watermark');
  assert(!mainAddProd.includes('sarojini-watermark.js'), 'Main add-product.html must not include Sarojini watermark');
});

console.log('\n================================================================');
console.log(`RESULTS: ${passedTests}/${totalTests} tests passed.`);
console.log('================================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
