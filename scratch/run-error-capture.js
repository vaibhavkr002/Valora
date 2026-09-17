const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ROOT_DIR = path.resolve(__dirname, '..');

const originalHtml = fs.readFileSync(path.join(ROOT_DIR, 'homepage.html'), 'utf8');

// Inject logger right at top of head, and dump at bottom
const injectionHead = `
<script>
window.__capturedErrors = [];
window.__capturedLogs = [];
window.addEventListener('error', function(e) {
  window.__capturedErrors.push({
    message: e.message,
    filename: e.filename,
    lineno: e.lineno,
    colno: e.colno,
    error: e.error ? (e.error.stack || e.error.message) : null
  });
});
window.addEventListener('unhandledrejection', function(e) {
  window.__capturedErrors.push({
    type: 'unhandledrejection',
    reason: e.reason ? (e.reason.stack || e.reason.message || String(e.reason)) : null
  });
});
const _origLog = console.log;
const _origWarn = console.warn;
const _origErr = console.error;
console.log = function(...args) { window.__capturedLogs.push({ type: 'log', text: args.join(' ') }); _origLog.apply(console, args); };
console.warn = function(...args) { window.__capturedLogs.push({ type: 'warn', text: args.join(' ') }); _origWarn.apply(console, args); };
console.error = function(...args) { window.__capturedLogs.push({ type: 'error', text: args.join(' ') }); _origErr.apply(console, args); };
</script>
`;

const injectionBody = `
<script>
window.addEventListener('load', () => {
  setTimeout(() => {
    const info = {
      errors: window.__capturedErrors,
      logs: window.__capturedLogs,
      hasProductsData: typeof window.PRODUCTS_DATA !== 'undefined',
      productsDataLen: window.PRODUCTS_DATA ? window.PRODUCTS_DATA.length : 0,
      supabaseClientExists: typeof window.supabaseClient !== 'undefined' || typeof window.supabase !== 'undefined',
      trendingGridChildren: document.getElementById('trending-grid') ? document.getElementById('trending-grid').children.length : -1,
      elementsTrendingGridInApp: window.trendingGridDebug || null
    };

    const pre = document.createElement('pre');
    pre.id = 'debug-results-json';
    pre.textContent = JSON.stringify(info, null, 2);
    document.body.appendChild(pre);
  }, 3000);
});
</script>
</body>`;

let modifiedHtml = originalHtml.replace('<head>', '<head>' + injectionHead);
modifiedHtml = modifiedHtml.replace('</body>', injectionBody);

const tempFile = path.join(ROOT_DIR, 'temp-debug-homepage.html');
fs.writeFileSync(tempFile, modifiedHtml);

const fileUrl = 'file:///' + tempFile.replace(/\\/g, '/');
const args = [
  '--headless=new',
  '--disable-gpu',
  '--window-size=1440,900',
  '--dump-dom',
  '--virtual-time-budget=6000',
  fileUrl
];

execFile(EDGE_PATH, args, { maxBuffer: 20 * 1024 * 1024 }, (err, stdout) => {
  try { fs.unlinkSync(tempFile); } catch(_) {}
  if (err) {
    console.error('Exec error:', err);
    return;
  }
  const match = stdout.match(/<pre id="debug-results-json">([\s\S]*?)<\/pre>/);
  if (match) {
    console.log("=== CAPTURED LOGS AND ERRORS ===");
    console.log(match[1]);
  } else {
    console.log("No debug results pre found.");
  }
});

