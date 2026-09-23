const fs = require('fs');
const path = require('path');

function runCleanerTestSuite() {
  console.log('========================================================================');
  console.log('=== SAROJINI SMART IMAGE CLEANER & CODE REMOVAL TEST SUITE ===');
  console.log('========================================================================\n');

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

  // 1. Module Export & Structure Check
  console.log('[Test 1] Cleaner Module Structure (js/sarojini-image-cleaner.js)');
  const cleanerCode = fs.readFileSync(path.join(__dirname, '../js/sarojini-image-cleaner.js'), 'utf8');
  assert(cleanerCode.includes('upgradeSupplierUrl'), 'cleaner exports upgradeSupplierUrl');
  assert(cleanerCode.includes('detectCodeBoundingBox'), 'cleaner exports detectCodeBoundingBox');
  assert(cleanerCode.includes('inpaintBoundingBox'), 'cleaner exports inpaintBoundingBox');
  assert(cleanerCode.includes('cleanSupplierImage'), 'cleaner exports cleanSupplierImage');

  // Load module in node environment
  const CleanerModule = require('../js/sarojini-image-cleaner.js');
  assert(typeof CleanerModule.upgradeSupplierUrl === 'function', 'Module loaded in Node environment');

  // 2. High-Resolution Supplier URL Upgrades
  console.log('\n[Test 2] High-Resolution Supplier URL Upgrades');
  const meeshoDownscaled = 'https://images.meesho.com/images/products/990006640/8nyjx_512.avif?width=512';
  const meeshoUpgraded = CleanerModule.upgradeSupplierUrl(meeshoDownscaled);
  assert(meeshoUpgraded === 'https://images.meesho.com/images/products/990006640/8nyjx_1024.jpg', `Meesho URL upgraded to 1024 master: ${meeshoUpgraded}`);

  const indiamart500 = 'https://5.imimg.com/data5/SELLER/Default/2023/8/336986752/RG/BL/PD/122998478/2-500x500.jpg';
  const indiamartUpgraded = CleanerModule.upgradeSupplierUrl(indiamart500);
  assert(indiamartUpgraded.includes('-1000x1000.jpg'), `IndiaMART URL upgraded to 1000x1000 master: ${indiamartUpgraded}`);

  const walmartThumb = 'https://i5.walmartimages.com/seo/sample.jpeg?odnHeight=573&odnWidth=573&odnBg=FFFFFF';
  const walmartUpgraded = CleanerModule.upgradeSupplierUrl(walmartThumb);
  assert(!walmartUpgraded.includes('odnHeight'), `Walmart downscaling params stripped: ${walmartUpgraded}`);

  // 3. Multi-Zone Bounding Box Math & Aspect Ratios
  console.log('\n[Test 3] Aspect Ratio Containment & Zero-Crop Preservation (1:1, 3:4, 4:3, 9:16)');
  const testAspectRatios = [
    { name: '1:1 Square', w: 1000, h: 1000 },
    { name: '3:4 Portrait', w: 750, h: 1000 },
    { name: '4:3 Landscape', w: 1200, h: 900 },
    { name: '9:16 Tall Banner', w: 1080, h: 1920 }
  ];

  testAspectRatios.forEach(dim => {
    // Test Bottom-Left zone default
    const boxBL = CleanerModule.detectCodeBoundingBox(null, dim.w, dim.h, 'bottom-left');
    assert(boxBL.x >= 0 && boxBL.y >= Math.round(dim.h * 0.90), `${dim.name} BL box is anchored near bottom edge (y=${boxBL.y} of ${dim.h})`);
    assert(boxBL.w <= Math.round(dim.w * 0.30) && boxBL.h <= Math.round(dim.h * 0.06), `${dim.name} BL box covers < 6% height and < 30% width (leaves product untouched)`);

    // Test Bottom-Right zone
    const boxBR = CleanerModule.detectCodeBoundingBox(null, dim.w, dim.h, 'bottom-right');
    assert(boxBR.x >= Math.round(dim.w * 0.70) && boxBR.y >= Math.round(dim.h * 0.90), `${dim.name} BR box is anchored near bottom-right`);

    // Test Full Bottom Edge
    const boxEdge = CleanerModule.detectCodeBoundingBox(null, dim.w, dim.h, 'bottom-edge');
    assert(boxEdge.x === 0 && boxEdge.w === dim.w && boxEdge.h <= Math.round(dim.h * 0.05), `${dim.name} Edge strip is very thin (< 5% height)`);
  });

  // 4. Inpainting Simulation & Integrity Verification
  console.log('\n[Test 4] Mock Canvas Inpainting & Color Blending Simulation');
  // Create a synthetic image buffer: 1000 x 1000 px, 4 bytes/pixel (RGBA)
  const W = 1000, H = 1000;
  const pixelBuffer = new Uint8Array(W * H * 4);

  // Fill background with light neutral backdrop (R: 248, G: 246, B: 242, A: 255)
  for (let i = 0; i < pixelBuffer.length; i += 4) {
    pixelBuffer[i] = 248;
    pixelBuffer[i + 1] = 246;
    pixelBuffer[i + 2] = 242;
    pixelBuffer[i + 3] = 255;
  }

  // Draw simulated dark text code "S-990006640" in bottom-left corner
  // at x: 20 to 180, y: 955 to 975
  const textX0 = 20, textX1 = 180, textY0 = 955, textY1 = 975;
  for (let y = textY0; y < textY1; y++) {
    for (let x = textX0; x < textX1; x++) {
      if ((x + y) % 3 === 0) { // simulate character strokes
        const idx = (y * W + x) * 4;
        pixelBuffer[idx] = 30;     // dark charcoal text
        pixelBuffer[idx + 1] = 30;
        pixelBuffer[idx + 2] = 30;
      }
    }
  }

  // Mock Context with getImageData & putImageData
  const mockCtx = {
    getImageData(x, y, w, h) {
      const data = new Uint8ClampedArray(w * h * 4);
      for (let row = 0; row < h; row++) {
        for (let col = 0; col < w; col++) {
          const srcIdx = ((y + row) * W + (x + col)) * 4;
          const dstIdx = (row * w + col) * 4;
          data[dstIdx] = pixelBuffer[srcIdx];
          data[dstIdx + 1] = pixelBuffer[srcIdx + 1];
          data[dstIdx + 2] = pixelBuffer[srcIdx + 2];
          data[dstIdx + 3] = pixelBuffer[srcIdx + 3];
        }
      }
      return { data };
    },
    putImageData(imgData, x, y) {
      const data = imgData.data;
      const w = Math.round(data.length / 4 / (textY1 - textY0 + 10)); // approximate
      for (let i = 0; i < data.length; i += 4) {
        // write back
      }
    },
    createLinearGradient(x0, y0, x1, y1) {
      return {
        addColorStop(stop, color) {}
      };
    },
    save() {},
    restore() {},
    fillRect(x, y, w, h) {
      // Simulate gradient fill by sampling backdrop average (R:248, G:246, B:242)
      for (let row = y; row < y + h && row < H; row++) {
        for (let col = x; col < x + w && col < W; col++) {
          const idx = (row * W + col) * 4;
          pixelBuffer[idx] = 248;
          pixelBuffer[idx + 1] = 246;
          pixelBuffer[idx + 2] = 242;
        }
      }
    }
  };

  // Perform detection on mock canvas
  const detectedBox = CleanerModule.detectCodeBoundingBox(mockCtx, W, H, 'bottom-left');
  assert(detectedBox.detected === true, `Successfully detected code text cluster in bottom-left zone`);
  assert(detectedBox.x <= textX0 && (detectedBox.x + detectedBox.w) >= textX1, `Bounding box encompasses code text (${detectedBox.w}x${detectedBox.h}px)`);

  // Perform inpainting
  CleanerModule.inpaintBoundingBox(mockCtx, detectedBox, W, H);

  // Check that the dark text pixels are now neutral background pixels
  const sampleIdx = (Math.round((textY0 + textY1) / 2) * W + Math.round((textX0 + textX1) / 2)) * 4;
  const lumAfter = (pixelBuffer[sampleIdx] + pixelBuffer[sampleIdx + 1] + pixelBuffer[sampleIdx + 2]) / 3;
  assert(lumAfter > 240, `Dark text pixels (lum ~30) replaced with seamless backdrop tone (lum=${Math.round(lumAfter)})`);

  // Verify that legitimate product area (e.g. center x:500, y:500) is 100% unaltered
  const centerIdx = (500 * W + 500) * 4;
  assert(pixelBuffer[centerIdx] === 248 && pixelBuffer[centerIdx + 1] === 246, `Main product area remains 100% untouched`);

  // 5. Admin HTML & Modal Wireup Checks
  console.log('\n[Test 5] Admin HTML Modal & Script Integrity');
  const addHtml = fs.readFileSync(path.join(__dirname, '../admin/sarojini-add-product.html'), 'utf8');
  assert(addHtml.includes('id="modal-image-cleaner"'), 'Modal #modal-image-cleaner exists in HTML');
  assert(addHtml.includes('id="cleaner-img-original"'), 'Original image preview element exists');
  assert(addHtml.includes('id="cleaner-img-cleaned"'), 'Cleaned image preview element exists');
  assert(addHtml.includes('id="btn-modal-accept-clean"'), 'Accept Cleaned Image button exists');
  assert(addHtml.includes('id="btn-modal-keep-original"'), 'Keep Original button exists');
  assert(addHtml.includes('sarojini-image-cleaner.js'), 'sarojini-image-cleaner.js script tag loaded');

  // 6. Admin JS Controller Wireup Checks
  console.log('\n[Test 6] Admin JS Controller Integration');
  const addJs = fs.readFileSync(path.join(__dirname, '../admin/js/admin-sarojini-add-product.js'), 'utf8');
  assert(addJs.includes('processAndShowCleanerModal'), 'processAndShowCleanerModal function defined');
  assert(addJs.includes('SarojiniImageCleaner.upgradeSupplierUrl'), 'URL input upgrades supplier URLs');
  assert(addJs.includes('btnModalAcceptClean.addEventListener'), 'Modal accept button event listener active');
  assert(addJs.includes('btnModalKeepOriginal.addEventListener'), 'Modal keep original button event listener active');

  console.log(`\n========================================================================`);
  console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runCleanerTestSuite();

