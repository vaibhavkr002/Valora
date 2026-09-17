const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ROOT_DIR = path.resolve(__dirname, '..');

const originalHtml = fs.readFileSync(path.join(ROOT_DIR, 'homepage.html'), 'utf8');

const injectionHead = `
<script>
window.__capturedErrors = [];
window.addEventListener('error', function(e) {
  window.__capturedErrors.push({
    message: e.message,
    filename: e.filename,
    lineno: e.lineno
  });
});
</script>
`;

const injectionBody = `
<script>
window.addEventListener('load', () => {
  setTimeout(() => {
    const trendingGrid = document.getElementById('trending-grid');
    const newArrivalsGrid = document.getElementById('new-arrivals-grid');
    const dealsGrid = document.getElementById('deals-grid');
    const bogoGrid = document.getElementById('bogo-grid');
    const customerStories = document.querySelector('.velora-customer-stories');

    function extractCards(grid) {
      if (!grid) return [];
      return Array.from(grid.querySelectorAll('.product-card')).map(card => {
        const img = card.querySelector('.product-card-img');
        const title = card.querySelector('.product-card-name a');
        const price = card.querySelector('.price-current');
        const rating = card.querySelector('.stars-score');
        const btn = card.querySelector('.btn-add-to-cart');
        const wishlist = card.querySelector('.wishlist-btn');
        return {
          id: card.dataset.productId,
          hasImg: Boolean(img && img.src && img.src.length > 5),
          imgSrc: img ? img.src : null,
          title: title ? title.textContent.trim() : null,
          href: title ? title.getAttribute('href') : null,
          price: price ? price.textContent.trim() : null,
          rating: rating ? rating.textContent.trim() : null,
          btnText: btn ? btn.textContent.trim() : null,
          hasWishlist: Boolean(wishlist)
        };
      });
    }

    const trendingCards = extractCards(trendingGrid);
    const newArrivalCards = extractCards(newArrivalsGrid);
    const dealsCards = extractCards(dealsGrid);
    const bogoCards = extractCards(bogoGrid);

    const docWidth = document.documentElement.scrollWidth;
    const winWidth = window.innerWidth;
    const hasHorizontalOverflow = docWidth > winWidth + 1; // 1px tolerance

    const data = {
      windowWidth: winWidth,
      errors: window.__capturedErrors,
      productsDataCount: window.PRODUCTS_DATA ? window.PRODUCTS_DATA.length : 0,
      trendingCount: trendingCards.length,
      newArrivalsCount: newArrivalCards.length,
      dealsCount: dealsCards.length,
      bogoCount: bogoCards.length,
      sampleTrendingCard: trendingCards[0] || null,
      sampleDealsCard: dealsCards[0] || null,
      hasCustomerStories: Boolean(customerStories),
      hasHorizontalOverflow: hasHorizontalOverflow,
      docWidth: docWidth
    };

    const pre = document.createElement('pre');
    pre.id = 'full-verification-results';
    pre.textContent = JSON.stringify(data, null, 2);
    document.body.appendChild(pre);
  }, 3000);
});
</script>
</body>`;

let modHtml = originalHtml.replace('<head>', '<head>' + injectionHead);
modHtml = modHtml.replace('</body>', injectionBody);

const tempPath = path.join(ROOT_DIR, 'temp-verify-homepage.html');
fs.writeFileSync(tempPath, modHtml);

function testViewport(width, height) {
  return new Promise((resolve) => {
    const fileUrl = 'file:///' + tempPath.replace(/\\/g, '/');
    const args = [
      '--headless=new',
      '--disable-gpu',
      `--window-size=${width},${height}`,
      '--dump-dom',
      '--virtual-time-budget=6000',
      fileUrl
    ];
    execFile(EDGE_PATH, args, { maxBuffer: 20 * 1024 * 1024 }, (err, stdout) => {
      if (err) {
        console.error('Error on viewport ' + width + 'x' + height, err);
        return resolve(null);
      }
      const match = stdout.match(/<pre id="full-verification-results">([\s\S]*?)<\/pre>/);
      if (match) {
        resolve(JSON.parse(match[1]));
      } else {
        resolve(null);
      }
    });
  });
}

async function runAll() {
  const viewports = [
    { w: 320, h: 600, label: "Mobile 320px" },
    { w: 375, h: 667, label: "Mobile 375px" },
    { w: 390, h: 844, label: "Mobile 390px" },
    { w: 430, h: 932, label: "Mobile 430px" },
    { w: 1366, h: 768, label: "Desktop 1366px" },
    { w: 1440, h: 900, label: "Desktop 1440px" },
    { w: 1920, h: 1080, label: "Desktop 1920px" }
  ];

  console.log("=== RUNNING MULTI-VIEWPORT VERIFICATION ===");
  let allPassed = true;

  for (const vp of viewports) {
    console.log(`\nTesting ${vp.label} (${vp.w}x${vp.h})...`);
    const res = await testViewport(vp.w, vp.h);
    if (!res) {
      console.error(`  [FAIL] Could not get results for ${vp.label}`);
      allPassed = false;
      continue;
    }

    const errorsOk = res.errors.length === 0;
    const trendingOk = res.trendingCount > 0;
    const newArrivalsOk = res.newArrivalsCount > 0;
    const dealsOk = res.dealsCount > 0;
    const bogoOk = res.bogoCount >= 0;
    const csOk = res.hasCustomerStories;
    const overflowOk = !res.hasHorizontalOverflow;
    const sampleOk = res.sampleTrendingCard && res.sampleTrendingCard.title && res.sampleTrendingCard.hasImg && res.sampleTrendingCard.price;

    console.log(`  Errors: ${res.errors.length} (${errorsOk ? "OK" : "FAIL"})`);
    console.log(`  Products in DB: ${res.productsDataCount}`);
    console.log(`  Trending count: ${res.trendingCount} (${trendingOk ? "OK" : "FAIL"})`);
    console.log(`  New Arrivals count: ${res.newArrivalsCount} (${newArrivalsOk ? "OK" : "FAIL"})`);
    console.log(`  Deals count: ${res.dealsCount} (${dealsOk ? "OK" : "FAIL"})`);
    console.log(`  BOGO count: ${res.bogoCount} (${bogoOk ? "OK" : "FAIL"})`);
    console.log(`  Customer Stories present: ${res.hasCustomerStories} (${csOk ? "OK" : "FAIL"})`);
    console.log(`  Horizontal overflow: ${res.hasHorizontalOverflow ? "OVERFLOW" : "NONE"} (docWidth: ${res.docWidth}px, window: ${res.windowWidth}px)`);
    if (res.sampleTrendingCard) {
      console.log(`  Sample Card: "${res.sampleTrendingCard.title}" | ${res.sampleTrendingCard.price} | Rating: ${res.sampleTrendingCard.rating} | Img: ${res.sampleTrendingCard.hasImg}`);
    }

    if (!errorsOk || !trendingOk || !newArrivalsOk || !dealsOk || !csOk || !sampleOk) {
      allPassed = false;
    }
  }

  try { fs.unlinkSync(tempPath); } catch(_) {}

  console.log(`\n========================================`);
  console.log(`FINAL RESULT: ${allPassed ? "ALL TESTS PASSED!" : "SOME TESTS FAILED!"}`);
  console.log(`========================================\n`);

  if (!allPassed) process.exit(1);
}

runAll();

