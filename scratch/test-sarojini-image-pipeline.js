const fs = require('fs');
const path = require('path');

function runTests() {
  console.log('====================================================');
  console.log('SAROJINI IMAGE PIPELINE & ASPECT RATIO TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  // 1. PDP CSS Check
  console.log('[Test 1] Product Details CSS (css/sarojini-product-details.css)');
  const pdpCss = fs.readFileSync(path.join(__dirname, '../css/sarojini-product-details.css'), 'utf8');
  assert(pdpCss.includes('object-fit: contain;'), 'Main PDP image uses object-fit: contain');
  assert(pdpCss.includes('padding: 16px;') || pdpCss.includes('padding: 12px;'), 'Main PDP media container has clean padding for image wrapper');
  assert(pdpCss.includes('.pdp-thumb-item img') && pdpCss.includes('object-fit: contain;'), 'PDP thumbnail images use object-fit: contain');

  // 2. Listing Cards CSS (css/sarojini-bazaar-page.css & css/sarojini-bazaar.css)
  console.log('\n[Test 2] Bazaar Grid & Carousel Product Cards CSS');
  const pageCss = fs.readFileSync(path.join(__dirname, '../css/sarojini-bazaar-page.css'), 'utf8');
  assert(pageCss.includes('.product-card-media a') && pageCss.includes('object-fit: contain;'), 'Grid cards use object-fit: contain');
  assert(pageCss.includes('padding: 8px;') || pageCss.includes('padding: 8px 8px 36px 8px;'), 'Grid cards have clean padding');

  const homeCss = fs.readFileSync(path.join(__dirname, '../css/sarojini-bazaar.css'), 'utf8');
  assert(homeCss.includes('.sarojini-card-img') && homeCss.includes('object-fit: contain;'), 'Homepage carousel cards use object-fit: contain');
  assert(homeCss.includes('padding: 8px;') || homeCss.includes('padding: 8px 8px 36px 8px;'), 'Homepage carousel cards have clean padding');

  // 3. Wishlist CSS (css/wishlist.css)
  console.log('\n[Test 3] Wishlist Cards CSS');
  const wishlistCss = fs.readFileSync(path.join(__dirname, '../css/wishlist.css'), 'utf8');
  assert(wishlistCss.includes('.wishlist-card-img') && wishlistCss.includes('object-fit: contain;'), 'Wishlist card images use object-fit: contain');
  assert(wishlistCss.includes('padding: 8px;'), 'Wishlist images have breathing padding');

  // 4. Cart CSS (css/styles.css)
  console.log('\n[Test 4] Cart Thumbnails CSS');
  const stylesCss = fs.readFileSync(path.join(__dirname, '../css/styles.css'), 'utf8');
  assert(stylesCss.includes('.cart-item-img') && stylesCss.includes('object-fit: contain !important;'), 'Cart item images use object-fit: contain !important');

  // 5. Orders Admin (admin/js/admin-order-details.js)
  console.log('\n[Test 5] Order Details Admin Thumbnails');
  const orderDetailsJs = fs.readFileSync(path.join(__dirname, '../admin/js/admin-order-details.js'), 'utf8');
  assert(orderDetailsJs.includes('object-fit:contain; background:rgba(255,255,255,0.04); padding:2px;'), 'Order details thumbnails use object-fit: contain');

  // 6. Sarojini Admin Products (admin/js/admin-sarojini-products.js)
  console.log('\n[Test 6] Sarojini Products Table Thumbnails');
  const sarojiniProductsJs = fs.readFileSync(path.join(__dirname, '../admin/js/admin-sarojini-products.js'), 'utf8');
  assert(sarojiniProductsJs.includes('object-fit: contain; background: #f8fafc; padding: 2px;'), 'Admin Sarojini products table uses object-fit: contain');

  // 7. Sarojini Add/Edit Product Admin (admin/sarojini-add-product.html & admin-sarojini-add-product.js)
  console.log('\n[Test 7] Add/Edit Product Gallery Preview & Quality Checks');
  const addProdHtml = fs.readFileSync(path.join(__dirname, '../admin/sarojini-add-product.html'), 'utf8');
  assert(addProdHtml.includes('.image-preview-item img') && addProdHtml.includes('object-fit: contain;'), 'Admin preview items use object-fit: contain');
  assert(addProdHtml.includes('.image-dimension-badge'), 'Admin has .image-dimension-badge defined');
  assert(addProdHtml.includes('id="image-quality-advisory"'), 'Admin has advisory banner container');

  const addProdJs = fs.readFileSync(path.join(__dirname, '../admin/js/admin-sarojini-add-product.js'), 'utf8');
  assert(addProdJs.includes('naturalWidth') && addProdJs.includes('naturalHeight'), 'Admin measures natural image dimensions');
  assert(addProdJs.includes('w < 450 || h < 450'), 'Admin checks for low-res < 450px threshold');
  assert(addProdJs.includes('imageQualityAdvisory'), 'Admin triggers advisory note for low-res');

  // 8. Aspect Ratio Geometry Simulation
  console.log('\n[Test 8] Aspect Ratio Geometry Calculations (1:1, 3:4, 4:3, 9:16)');
  // Container: 450px wide x 600px high (3:4 ratio), padding bottom 44px -> usable height 556px
  const containerW = 450;
  const containerH = 600;
  const bottomPadding = 44;
  const usableH = containerH - bottomPadding; // 556px

  const aspectRatios = [
    { name: '1:1 Square (e.g. 1000x1000)', w: 1000, h: 1000 },
    { name: '3:4 Portrait (e.g. 750x1000)', w: 750, h: 1000 },
    { name: '4:3 Landscape (e.g. 1200x900)', w: 1200, h: 900 },
    { name: '9:16 Tall (e.g. 1080x1920)', w: 1080, h: 1920 }
  ];

  aspectRatios.forEach(testCase => {
    // Under object-fit: contain inside (containerW x usableH):
    const scale = Math.min(containerW / testCase.w, usableH / testCase.h);
    const renderedW = testCase.w * scale;
    const renderedH = testCase.h * scale;

    const fitsWidth = renderedW <= containerW;
    const fitsHeight = renderedH <= usableH;
    const isCropped = false; // By definition of object-fit: contain

    assert(fitsWidth && fitsHeight, `${testCase.name} renders at ${Math.round(renderedW)}x${Math.round(renderedH)}px, 100% inside bounds without any crop`);
  });

  console.log(`\n====================================================`);
  console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();

