const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ROOT_DIR = path.resolve(__dirname, '..');

const originalHtml = fs.readFileSync(path.join(ROOT_DIR, 'homepage.html'), 'utf8');

const injection = `
<script>
window.__logs = [];
const origLog = console.log;
const origWarn = console.warn;
const origError = console.error;
console.log = function(...args) { window.__logs.push({ type: 'log', text: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') }); origLog.apply(console, args); };
console.warn = function(...args) { window.__logs.push({ type: 'warn', text: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') }); origWarn.apply(console, args); };
console.error = function(...args) { window.__logs.push({ type: 'error', text: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') }); origError.apply(console, args); };
window.addEventListener('error', function(e) {
  window.__logs.push({ type: 'uncaught_error', text: e.message + ' at ' + e.filename + ':' + e.lineno + ':' + e.colno });
});

window.addEventListener('load', () => {
  setTimeout(() => {
    const trendingGrid = document.getElementById('trending-grid');
    const newArrivalsGrid = document.getElementById('new-arrivals-grid');
    const dealsGrid = document.getElementById('deals-grid');
    const bogoGrid = document.getElementById('bogo-grid');

    const result = {
      logs: window.__logs,
      productsDataAvailable: Boolean(window.PRODUCTS_DATA),
      productsDataLength: window.PRODUCTS_DATA ? window.PRODUCTS_DATA.length : 0,
      sampleProduct: window.PRODUCTS_DATA && window.PRODUCTS_DATA[0] ? {
        id: window.PRODUCTS_DATA[0].id,
        name: window.PRODUCTS_DATA[0].name,
        isTrending: window.PRODUCTS_DATA[0].isTrending,
        isNew: window.PRODUCTS_DATA[0].isNew,
        isDeal: window.PRODUCTS_DATA[0].isDeal,
        is_active: window.PRODUCTS_DATA[0].is_active
      } : null,
      trendingGrid: {
        exists: Boolean(trendingGrid),
        childCount: trendingGrid ? trendingGrid.children.length : 0,
        computedDisplay: trendingGrid ? getComputedStyle(trendingGrid).display : null,
        computedVisibility: trendingGrid ? getComputedStyle(trendingGrid).visibility : null,
        parentSectionDisplay: trendingGrid && trendingGrid.closest('section') ? getComputedStyle(trendingGrid.closest('section')).display : null
      },
      newArrivalsGrid: {
        exists: Boolean(newArrivalsGrid),
        childCount: newArrivalsGrid ? newArrivalsGrid.children.length : 0,
        computedDisplay: newArrivalsGrid ? getComputedStyle(newArrivalsGrid).display : null
      },
      dealsGrid: {
        exists: Boolean(dealsGrid),
        childCount: dealsGrid ? dealsGrid.children.length : 0,
        computedDisplay: dealsGrid ? getComputedStyle(dealsGrid).display : null
      },
      bogoGrid: {
        exists: Boolean(bogoGrid),
        childCount: bogoGrid ? bogoGrid.children.length : 0,
        computedDisplay: bogoGrid ? getComputedStyle(bogoGrid).display : null
      }
    };

    const pre = document.createElement('pre');
    pre.id = 'homepage-diagnostic-output';
    pre.textContent = JSON.stringify(result, null, 2);
    document.body.appendChild(pre);
  }, 2500);
});
</script>
</body>`;

const testHtml = originalHtml.replace('</body>', injection);
fs.writeFileSync(path.join(ROOT_DIR, 'scratch', 'test-homepage-diagnose.html'), testHtml);

const fileUrl = 'file:///' + path.join(ROOT_DIR, 'scratch', 'test-homepage-diagnose.html').replace(/\\/g, '/');
const args = [
  '--headless=new',
  '--disable-gpu',
  '--window-size=1440,900',
  '--dump-dom',
  '--virtual-time-budget=6000',
  fileUrl
];

execFile(EDGE_PATH, args, { maxBuffer: 20 * 1024 * 1024 }, (err, stdout) => {
  if (err) {
    console.error('Exec error:', err);
    return;
  }
  const match = stdout.match(/<pre id="homepage-diagnostic-output">([\s\S]*?)<\/pre>/);
  if (match) {
    console.log(match[1]);
  } else {
    console.log('Diagnostic output tag not found in DOM.');
  }
});

