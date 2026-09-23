/**
 * scratch/test-sarojini-card-3d-ads.js
 * Comprehensive Acceptance Test Suite for Sarojini Bazaar Premium Rotating 3D Card Ads.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('========================================================================');
console.log('=== SAROJINI BAZAAR ROTATING 3D AD BOARD ACCEPTANCE SUITE ===');
console.log('========================================================================\n');

let totalTests = 0;
let passedTests = 0;

function test(title, fn) {
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
// Test 1: Module Export and Rotating Delhi Street-Fashion Faces
// ----------------------------------------------------------------------------
console.log('--- 1. Module Export & 5 Curated Street-Fashion Ad Faces ---');

test('SarojiniCardAds module exports expected methods and AD_FACES array', () => {
  const SarojiniCardAds = require('../js/sarojini-card-ads.js');
  assert.strictEqual(typeof SarojiniCardAds, 'object', 'SarojiniCardAds must be an object');
  assert(Array.isArray(SarojiniCardAds.AD_FACES), 'Must export AD_FACES array');
  assert.strictEqual(SarojiniCardAds.AD_FACES.length, 5, 'Must contain exactly 5 ad faces');
  assert.strictEqual(typeof SarojiniCardAds.createBoardElement, 'function', 'Must export createBoardElement');
  assert.strictEqual(typeof SarojiniCardAds.attachCardAd, 'function', 'Must export attachCardAd');
  assert.strictEqual(typeof SarojiniCardAds.init, 'function', 'Must export init');

  // Verify all 5 face titles and themes
  const expectedFaces = [
    { title: 'SAROJINI BAZAAR', theme: 'face-ruby' },
    { title: 'UP TO 70% OFF', theme: 'face-charcoal' },
    { title: '₹199+ STREET DROPS', theme: 'face-terracotta' },
    { title: 'NEW STREET DROP', theme: 'face-emerald' },
    { title: 'BAZAAR PRICE', theme: 'face-slate' }
  ];

  expectedFaces.forEach(exp => {
    const match = SarojiniCardAds.AD_FACES.find(f => f.title === exp.title && f.theme === exp.theme);
    assert(match, `AD_FACES must include face with title "${exp.title}" and theme "${exp.theme}"`);
  });
});

// ----------------------------------------------------------------------------
// Test 2: DOM Structure, 3D Board Wrapper, Dual-Sided Rotator & Collision Avoidance
// ----------------------------------------------------------------------------
console.log('\n--- 2. DOM Structure, 3D Board & Collision Avoidance ---');

test('Generates physical 3D rectangular board with wrapper, rotator, front/back sides, and shadow', () => {
  // Mock document and elements for headless test
  global.document = {
    createElement(tag) {
      const el = {
        tagName: tag.toUpperCase(),
        className: '',
        attributes: {},
        innerHTML: '',
        style: {},
        setAttribute(k, v) { this.attributes[k] = v; },
        getAttribute(k) { return this.attributes[k]; },
        querySelector(sel) {
          if (sel === '.s3d-rotator') return this._rotatorEl || (this._rotatorEl = { style: {} });
          if (sel === '.s3d-front') return this._frontEl || (this._frontEl = { className: '', innerHTML: '', classList: { add() {}, remove() {} } });
          if (sel === '.s3d-back') return this._backEl || (this._backEl = { className: '', innerHTML: '', classList: { add() {}, remove() {} } });
          if (sel === '.s3d-board-shadow') return this._shadowEl || (this._shadowEl = { classList: { add() {}, remove() {} } });
          return null;
        }
      };
      return el;
    }
  };

  const SarojiniCardAds = require('../js/sarojini-card-ads.js');
  const boardEl = SarojiniCardAds.createBoardElement(SarojiniCardAds.AD_FACES[0], SarojiniCardAds.AD_FACES[1], 'zone-bottom-right');

  assert(boardEl.className.includes('sarojini-card-3d-board'), 'Must have sarojini-card-3d-board class');
  assert(boardEl.className.includes('zone-bottom-right'), 'Must default to zone-bottom-right');
  assert(boardEl.innerHTML.includes('s3d-board-wrapper'), 'Must contain s3d-board-wrapper');
  assert(boardEl.innerHTML.includes('s3d-rotator'), 'Must contain s3d-rotator');
  assert(boardEl.innerHTML.includes('s3d-front'), 'Must contain s3d-front');
  assert(boardEl.innerHTML.includes('s3d-back'), 'Must contain s3d-back');
  assert(boardEl.innerHTML.includes('s3d-board-shadow'), 'Must contain s3d-board-shadow');
  assert(boardEl.innerHTML.includes('SAROJINI BAZAAR'), 'Must render initial front face content');
  assert(boardEl.innerHTML.includes('UP TO 70% OFF'), 'Must render initial back face content');
  assert.strictEqual(boardEl.getAttribute('aria-hidden'), 'true', 'Must be aria-hidden for accessibility');
});

test('Dynamically places at zone-bottom-left if watermark occupies bottom-right', () => {
  const SarojiniCardAds = require('../js/sarojini-card-ads.js');

  let appendedChild = null;
  const mockWatermark = {
    classList: {
      contains(c) { return c === 'zone-bottom-right'; }
    }
  };

  const mockCardMedia = {
    querySelector(sel) {
      if (sel === '.sarojini-card-3d-board') return null;
      if (sel === '.sarojini-watermark-overlay') return mockWatermark;
      return null;
    },
    appendChild(child) {
      appendedChild = child;
    }
  };

  SarojiniCardAds.attachCardAd(mockCardMedia, 0);

  assert(appendedChild, 'Must append 3D ad board');
  assert(appendedChild.className.includes('zone-bottom-left'), 'Must shift to zone-bottom-left to avoid watermark');
});

test('Defaults to zone-bottom-right when watermark occupies bottom-left', () => {
  const SarojiniCardAds = require('../js/sarojini-card-ads.js');

  let appendedChild = null;
  const mockWatermark = {
    classList: {
      contains(c) { return c === 'zone-bottom-left'; }
    }
  };

  const mockCardMedia = {
    querySelector(sel) {
      if (sel === '.sarojini-card-3d-board') return null;
      if (sel === '.sarojini-watermark-overlay') return mockWatermark;
      return null;
    },
    appendChild(child) {
      appendedChild = child;
    }
  };

  SarojiniCardAds.attachCardAd(mockCardMedia, 0);

  assert(appendedChild, 'Must append 3D ad board');
  assert(appendedChild.className.includes('zone-bottom-right'), 'Must place at zone-bottom-right');
});

// ----------------------------------------------------------------------------
// Test 3: CSS Styles & Hardware-Accelerated 3D Animations
// ----------------------------------------------------------------------------
console.log('\n--- 3. CSS Styles, 3D Depth, Continuous rotateY() & Themes ---');

test('css/sarojini-bazaar-page.css and css/sarojini-bazaar.css define complete 3D board styles', () => {
  const bzPageCss = fs.readFileSync(path.join(__dirname, '../css/sarojini-bazaar-page.css'), 'utf8');
  const bzCss = fs.readFileSync(path.join(__dirname, '../css/sarojini-bazaar.css'), 'utf8');

  [bzPageCss, bzCss].forEach((css, idx) => {
    const file = idx === 0 ? 'sarojini-bazaar-page.css' : 'sarojini-bazaar.css';
    assert(css.includes('.sarojini-card-3d-board {'), `${file} must define .sarojini-card-3d-board`);
    assert(css.includes('perspective: 700px;'), `${file} must use 3D perspective`);
    assert(css.includes('transform-style: preserve-3d;'), `${file} must preserve 3D`);
    assert(css.includes('.s3d-rotator {'), `${file} must define .s3d-rotator`);
    assert(css.includes('.s3d-front {'), `${file} must define .s3d-front`);
    assert(css.includes('.s3d-back {'), `${file} must define .s3d-back`);
    assert(css.includes('rotateY(180deg)'), `${file} must flip back side with rotateY(180deg)`);
    assert(css.includes('.face-ruby'), `${file} must define .face-ruby theme`);
    assert(css.includes('.face-charcoal'), `${file} must define .face-charcoal theme`);
    assert(css.includes('.face-terracotta'), `${file} must define .face-terracotta theme`);
    assert(css.includes('.face-emerald'), `${file} must define .face-emerald theme`);
    assert(css.includes('.face-slate'), `${file} must define .face-slate theme`);
    assert(css.includes('.s3d-board-shadow'), `${file} must define .s3d-board-shadow`);
    assert(css.includes('@keyframes sarojini3dBoardFloat'), `${file} must define floating animation`);
    assert(css.includes('pointer-events: none;'), `${file} must have pointer-events: none so clicks pass to product`);
  });
});

// ----------------------------------------------------------------------------
// Test 4: Storefront Wiring & Hook Integration
// ----------------------------------------------------------------------------
console.log('\n--- 4. Storefront Wiring & Post-Render Hooks ---');

test('sarojini-shop.js, sarojini-bazaar-page.js, sarojini-bazaar.js, and sarojini-product-details.js wire SarojiniCardAds.init', () => {
  const shopJs = fs.readFileSync(path.join(__dirname, '../js/sarojini-shop.js'), 'utf8');
  const pageJs = fs.readFileSync(path.join(__dirname, '../js/sarojini-bazaar-page.js'), 'utf8');
  const bzJs = fs.readFileSync(path.join(__dirname, '../js/sarojini-bazaar.js'), 'utf8');
  const pdpJs = fs.readFileSync(path.join(__dirname, '../js/sarojini-product-details.js'), 'utf8');

  assert(shopJs.includes('SarojiniCardAds.init'), 'sarojini-shop.js must call SarojiniCardAds.init');
  assert(pageJs.includes('SarojiniCardAds.init'), 'sarojini-bazaar-page.js must call SarojiniCardAds.init');
  assert(bzJs.includes('SarojiniCardAds.init'), 'sarojini-bazaar.js must call SarojiniCardAds.init');
  assert(pdpJs.includes('SarojiniCardAds.init'), 'sarojini-product-details.js must call SarojiniCardAds.init');
});

test('HTML files load js/sarojini-card-ads.js with defer', () => {
  const htmlFiles = [
    'sarojini-shop.html',
    'sarojini-bazaar.html',
    'sarojini-product-details.html',
    'index.html',
    'homepage.html'
  ];

  htmlFiles.forEach(file => {
    const content = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    assert(content.includes('src="js/sarojini-card-ads.js"'), `${file} must load js/sarojini-card-ads.js`);
  });
});

// ----------------------------------------------------------------------------
// Test 5: Scope Isolation (Main VADI store untouched)
// ----------------------------------------------------------------------------
console.log('\n--- 5. Scope Isolation (Main VADI Products Untouched) ---');

test('Main VADI storefront files do NOT execute Sarojini 3D card ads', () => {
  const shopCss = fs.readFileSync(path.join(__dirname, '../css/shop.css'), 'utf8');
  const stylesCss = fs.readFileSync(path.join(__dirname, '../css/styles.css'), 'utf8');
  const appJs = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');

  assert(!shopCss.includes('sarojini-card-3d-board'), 'shop.css must NOT include sarojini-card-3d-board');
  assert(!stylesCss.includes('sarojini-card-3d-board'), 'styles.css must NOT include sarojini-card-3d-board');
  assert(!appJs.includes('SarojiniCardAds'), 'app.js must NOT call SarojiniCardAds');
});

console.log(`\n========================================================================`);
console.log(`RESULTS: ${passedTests}/${totalTests} tests passed.`);
console.log(`========================================================================\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}
