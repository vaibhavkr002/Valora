const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 8420;
const CDP_PORT = 9320;
const BASE_DIR = path.resolve('c:/Users/saanv/OneDrive/Desktop/Website/webu');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/index.html';
  const filePath = path.join(BASE_DIR, reqPath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
}).listen(PORT, async () => {
  console.log(`Scan Server running on http://localhost:${PORT}`);

  const edgeProc = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    '--disable-gpu',
    '--no-sandbox',
    `http://localhost:${PORT}/index.html`
  ]);

  await new Promise(r => setTimeout(r, 2200));

  try {
    const listRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json`);
    const tabs = await listRes.json();
    const tab = tabs.find(t => t.type === 'page' && (t.url.includes(String(PORT)) || !t.url.startsWith('chrome'))) || tabs[0];
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

    async function navigate(url) {
      await send('Page.navigate', { url });
      await new Promise(r => setTimeout(r, 1200));
    }

    const pagesToScan = [
      'index.html',
      'shop.html',
      'product.html',
      'checkout.html',
      'account.html',
      'wishlist.html',
      'login.html',
      'signup.html',
      'bogo.html',
      'deals.html',
      'trending.html',
      'new-arrivals.html',
      'about.html',
      'faq.html'
    ];

    const viewports = [320, 360, 375, 390, 412, 430, 1280];

    console.log('\n================ STARTING COMPREHENSIVE OVERFLOW AUDIT ================');

    for (const pageName of pagesToScan) {
      await navigate(`http://localhost:${PORT}/${pageName}`);

      for (const width of viewports) {
        await send('Emulation.setDeviceMetricsOverride', {
          width,
          height: 800,
          deviceScaleFactor: 2,
          mobile: width < 768
        });
        await new Promise(r => setTimeout(r, 200));

        const overflowData = await evaluate(`
          (function() {
            const w = window.innerWidth;
            const docScrollW = document.documentElement.scrollWidth;
            const bodyScrollW = document.body.scrollWidth;
            const hasOverflow = docScrollW > w || bodyScrollW > w;

            // Find specific elements exceeding viewport
            const culprits = [];
            const allElements = document.querySelectorAll('*');
            for (const el of allElements) {
              const rect = el.getBoundingClientRect();
              if (rect.right > w + 2) {
                // Ignore invisible or collapsed
                if (rect.width > 0 && rect.height > 0) {
                  let sel = el.tagName.toLowerCase();
                  if (el.id) sel += '#' + el.id;
                  else if (el.className && typeof el.className === 'string') {
                    sel += '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.');
                  }
                  culprits.push({
                    selector: sel,
                    width: Math.round(rect.width),
                    right: Math.round(rect.right),
                    overflow: Math.round(rect.right - w)
                  });
                }
              }
            }

            return {
              w,
              docScrollW,
              bodyScrollW,
              hasOverflow,
              culprits: culprits.slice(0, 8) // Top 8 culprits
            };
          })()
        `);

        if (overflowData && overflowData.hasOverflow) {
          console.log(`❌ [${pageName}] at ${width}px: OVERFLOW DETECTED (doc: ${overflowData.docScrollW}px, body: ${overflowData.bodyScrollW}px)`);
          console.log('   Top culprits:', overflowData.culprits);
        } else {
          console.log(`✅ [${pageName}] at ${width}px: Clean (width: ${width}px)`);
        }
      }
    }

  } catch (err) {
    console.error('Audit error:', err);
  } finally {
    edgeProc.kill();
    server.close();
    process.exit(0);
  }
});

