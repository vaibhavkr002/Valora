const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 8250;
const BASE_DIR = path.resolve('c:/Users/saanv/OneDrive/Desktop/Website/webu');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/index.html';
  const filePath = path.join(BASE_DIR, reqPath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not found: ' + reqPath);
  }
}).listen(PORT, async () => {
  console.log('HTTP Server listening on port ' + PORT);

  const edgeProc = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    '--remote-debugging-port=9310',
    '--disable-gpu',
    '--no-sandbox',
    'about:blank'
  ]);

  await new Promise(r => setTimeout(r, 2000));

  try {
    const listRes = await fetch('http://127.0.0.1:9310/json');
    const tabs = await listRes.json();
    const tab = tabs.find(t => t.type === 'page') || tabs[0];
    const ws = new WebSocket(tab.webSocketDebuggerUrl);

    let id = 1;
    function send(method, params = {}) {
      return new Promise((resolve) => {
        const msgId = id++;
        const handler = (event) => {
          const data = JSON.parse(event.data);
          if (data.id === msgId) {
            ws.removeEventListener('message', handler);
            resolve(data.result && data.result.result ? data.result.result : data.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });
    }

    await new Promise(r => ws.addEventListener('open', r));

    async function evaluate(expression) {
      const res = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true
      });
      return res ? res.value : null;
    }

    const pagesToTest = [
      'index.html',
      'shop.html',
      'product.html',
      'cart.html',
      'checkout.html',
      'account.html',
      'wishlist.html',
      'login.html',
      'signup.html',
      'bogo.html',
      'deals.html',
      'new-arrivals.html',
      'trending.html',
      'sarojini-bazaar.html',
      'sarojini-shop.html',
      'sarojini-product-details.html',
      'order-success.html',
      'returns-exchanges.html'
    ];

    const widths = [320, 360, 375, 390, 414, 430];
    const results = [];

    for (const page of pagesToTest) {
      console.log('\\n=== Testing page: ' + page + ' ===');
      await send('Page.navigate', { url: 'http://localhost:' + PORT + '/' + page });
      await new Promise(r => setTimeout(r, 1200));

      for (const w of widths) {
        await send('Emulation.setDeviceMetricsOverride', {
          width: w,
          height: 800,
          deviceScaleFactor: 2,
          mobile: true
        });
        await new Promise(r => setTimeout(r, 400));

        const audit = await evaluate(`
          (() => {
            const docWidth = document.documentElement.clientWidth;
            const scrollW = document.documentElement.scrollWidth;
            const bodyScrollW = document.body ? document.body.scrollWidth : 0;
            const maxW = Math.max(scrollW, bodyScrollW);
            const hasOverflow = maxW > docWidth + 1;

            const overflowingElements = [];
            if (hasOverflow) {
              const all = document.querySelectorAll('*');
              for (const el of all) {
                // skip scripts, styles, etc.
                if (['SCRIPT', 'STYLE', 'LINK', 'META', 'NOSCRIPT'].includes(el.tagName)) continue;
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                if (style.display === 'none' || style.visibility === 'hidden') continue;
                
                if (rect.right > docWidth + 1.5) {
                  // Check if it's the outermost cause
                  let path = el.tagName.toLowerCase();
                  if (el.id) path += '#' + el.id;
                  if (el.className && typeof el.className === 'string') {
                    path += '.' + el.className.trim().split(/\\s+/).slice(0, 3).join('.');
                  }
                  overflowingElements.push({
                    selector: path,
                    width: Math.round(rect.width),
                    right: Math.round(rect.right),
                    docWidth: docWidth,
                    overflow: Math.round(rect.right - docWidth)
                  });
                }
              }
            }

            // Also check for any images that exceed container or viewport
            const oversizedImages = [];
            const imgs = document.querySelectorAll('img');
            for (const img of imgs) {
              const rect = img.getBoundingClientRect();
              if (rect.width > docWidth + 2) {
                oversizedImages.push({
                  src: img.src.split('/').pop().slice(0, 40),
                  width: Math.round(rect.width),
                  docWidth: docWidth
                });
              }
            }

            return {
              docWidth,
              scrollW,
              bodyScrollW,
              hasOverflow,
              overflowCount: overflowingElements.length,
              topOverflows: overflowingElements.slice(0, 5),
              oversizedImages: oversizedImages.slice(0, 3)
            };
          })()
        `);

        if (audit && (audit.hasOverflow || (audit.oversizedImages && audit.oversizedImages.length > 0))) {
          console.log('  [FAIL] Width ' + w + 'px: scrollW=' + audit.scrollW + ', docW=' + audit.docWidth);
          if (audit.topOverflows && audit.topOverflows.length > 0) {
            console.log('    Elements:', JSON.stringify(audit.topOverflows));
          }
          if (audit.oversizedImages && audit.oversizedImages.length > 0) {
            console.log('    Images:', JSON.stringify(audit.oversizedImages));
          }
          results.push({ page, width: w, ...audit });
        } else {
          console.log('  [PASS] Width ' + w + 'px: fits cleanly (' + (audit ? audit.scrollW : 'unknown') + '/' + (audit ? audit.docWidth : 'unknown') + ')');
        }
      }
    }

    fs.writeFileSync(
      path.join(BASE_DIR, 'scratch', 'mobile-audit-results.json'),
      JSON.stringify(results, null, 2)
    );
    console.log('\\nAudit complete! Results saved to scratch/mobile-audit-results.json');

    ws.close();
  } catch (err) {
    console.error('Audit error:', err);
  } finally {
    edgeProc.kill();
    server.close();
    process.exit(0);
  }
});

