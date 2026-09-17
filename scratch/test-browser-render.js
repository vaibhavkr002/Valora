const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ROOT_DIR = path.resolve(__dirname, '..');

const testPages = [
  'index.html',
  'shop.html',
  'product.html',
  'wishlist.html',
  'checkout.html',
  'account.html'
];

async function testPage(pageFile) {
  return new Promise((resolve) => {
    const fileUrl = 'file:///' + path.join(ROOT_DIR, pageFile).replace(/\\/g, '/');
    const args = [
      '--headless=new',
      '--disable-gpu',
      '--dump-dom',
      '--virtual-time-budget=2000',
      fileUrl
    ];

    execFile(EDGE_PATH, args, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        console.error(`❌ ${pageFile} Edge rendering failed:`, err.message);
        resolve(false);
      } else {
        const hasPromoStrip = stdout.includes('velora-promo-strip');
        console.log(`✅ ${pageFile} rendered cleanly in Edge headless (DOM length: ${stdout.length}, promo strip present: ${hasPromoStrip})`);
        resolve(true);
      }
    });
  });
}

async function runAll() {
  console.log('Testing Edge Headless DOM rendering across core pages...\n');
  let allPassed = true;
  for (const page of testPages) {
    const ok = await testPage(page);
    if (!ok) allPassed = false;
  }
  console.log('\nEdge Browser render validation completed.');
  process.exit(allPassed ? 0 : 1);
}

runAll();

