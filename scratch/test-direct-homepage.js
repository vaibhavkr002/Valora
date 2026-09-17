const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ROOT_DIR = path.resolve(__dirname, '..');

// Test homepage.html directly at its real path
const fileUrl = 'file:///' + path.join(ROOT_DIR, 'homepage.html').replace(/\\/g, '/');
const args = [
  '--headless=new',
  '--disable-gpu',
  '--window-size=1440,900',
  '--dump-dom',
  '--virtual-time-budget=8000',
  fileUrl
];

execFile(EDGE_PATH, args, { maxBuffer: 20 * 1024 * 1024 }, (err, stdout) => {
  if (err) {
    console.error('Exec error:', err);
    return;
  }

  // Check trending-grid content in stdout
  const trendingMatch = stdout.match(/<div id="trending-grid"[^>]*>([\s\S]*?)<\/div>/);
  const arrivalsMatch = stdout.match(/<div id="new-arrivals-grid"[^>]*>([\s\S]*?)<\/div>/);
  const dealsMatch = stdout.match(/<div id="deals-grid"[^>]*>([\s\S]*?)<\/div>/);
  const bogoMatch = stdout.match(/<div id="bogo-grid"[^>]*>([\s\S]*?)<\/div>/);

  console.log("=== CHECKING DOM ON REAL HOMEPAGE.HTML ===");
  console.log("trending-grid has product-card:", trendingMatch ? trendingMatch[1].includes("product-card") : false);
  console.log("trending-grid length:", trendingMatch ? trendingMatch[1].length : 0);
  console.log("new-arrivals-grid has product-card:", arrivalsMatch ? arrivalsMatch[1].includes("product-card") : false);
  console.log("deals-grid has product-card:", dealsMatch ? dealsMatch[1].includes("product-card") : false);
  console.log("bogo-grid has product-card:", bogoMatch ? bogoMatch[1].includes("product-card") : false);
  if (trendingMatch && trendingMatch[1].length < 200) {
    console.log("trending-grid innerHTML:", trendingMatch[1]);
  }
});

