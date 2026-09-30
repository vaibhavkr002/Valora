const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 8260;
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
    '--remote-debugging-port=9320',
    '--disable-gpu',
    '--no-sandbox',
    'about:blank'
  ]);

  await new Promise(r => setTimeout(r, 2000));

  try {
    const listRes = await fetch('http://127.0.0.1:9320/json');
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

    const testPages = [
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

    const viewports = [
      { name: '320px', width: 320, height: 600, mobile: true },
      { name: '360px', width: 360, height: 740, mobile: true },
      { name: '375px', width: 375, height: 812, mobile: true },
      { name: '390px', width: 390, height: 844, mobile: true },
      { name: '393px', width: 393, height: 852, mobile: true },
      { name: '414px', width: 414, height: 896, mobile: true },
      { name: '430px', width: 430, height: 932, mobile: true },
      { name: '600px', width: 600, height: 960, mobile: true },
      { name: '768px', width: 768, height: 1024, mobile: true },
      { name: '820px', width: 820, height: 1180, mobile: false },
      { name: '1024px', width: 1024, height: 768, mobile: false },
      { name: '1280px', width: 1280, height: 800, mobile: false },
      { name: '1440px', width: 1440, height: 900, mobile: false }
    ];

    let allPass = true;
    const summary = [];

    for (const page of testPages) {
      await send('Page.navigate', { url: 'http://localhost:' + PORT + '/' + page });
      await new Promise(r => setTimeout(r, 1000));

      let pagePassed = true;
      const failedVps = [];

      for (const vp of viewports) {
        await send('Emulation.setDeviceMetricsOverride', {
          width: vp.width,
          height: vp.height,
          deviceScaleFactor: 2,
          mobile: vp.mobile
        });
        await evaluate("window.dispatchEvent(new Event('resize'))");
        await new Promise(r => setTimeout(r, 350));

        const info = await evaluate(`
          (() => {
            const clientW = document.documentElement.clientWidth;
            const scrollW = document.documentElement.scrollWidth;
            return { clientW, scrollW, overflow: scrollW > clientW + 1 };
          })()
        `);

        if (info && info.overflow) {
          pagePassed = false;
          allPass = false;
          failedVps.push(vp.name + ' (scrollW=' + info.scrollW + ', clientW=' + info.clientW + ')');
        }
      }

      if (pagePassed) {
        console.log('[PASS] ' + page + ' - all 13 viewports zero horizontal overflow');
        summary.push({ page, status: 'PASS' });
      } else {
        console.log('[FAIL] ' + page + ' - failed on: ' + failedVps.join(', '));
        summary.push({ page, status: 'FAIL', failures: failedVps });
      }
    }

    // Specific check on BOGO advertisement on index.html at desktop (1280px) and mobile (390px)
    await send('Page.navigate', { url: 'http://localhost:' + PORT + '/index.html' });
    await new Promise(r => setTimeout(r, 1200));

    // Desktop check:
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 2, mobile: false });
    await new Promise(r => setTimeout(r, 500));
    const desktopBogo = await evaluate(`
      (() => {
        const ad = document.querySelector('.velora-ad-card.theme-bogo');
        if (!ad) return { found: false };
        const cs = window.getComputedStyle(ad);
        const overlay = ad.querySelector('.ad-overlay-gradient');
        const overlayCs = overlay ? window.getComputedStyle(overlay) : null;
        const pic = ad.querySelector('.ad-bg-picture');
        const picCs = pic ? window.getComputedStyle(pic) : null;
        return {
          found: true,
          flexDirection: cs.flexDirection,
          background: cs.backgroundColor,
          overlayDisplay: overlayCs ? overlayCs.display : 'none',
          picPosition: picCs ? picCs.position : 'unknown'
        };
      })()
    `);
    console.log('BOGO Ad Desktop 1280px:', JSON.stringify(desktopBogo));

    // Mobile check:
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await new Promise(r => setTimeout(r, 500));
    const mobileBogo = await evaluate(`
      (() => {
        const ad = document.querySelector('.velora-ad-card.theme-bogo');
        if (!ad) return { found: false };
        const cs = window.getComputedStyle(ad);
        const overlay = ad.querySelector('.ad-overlay-gradient');
        const overlayCs = overlay ? window.getComputedStyle(overlay) : null;
        const pic = ad.querySelector('.ad-bg-picture');
        const picCs = pic ? window.getComputedStyle(pic) : null;
        return {
          found: true,
          flexDirection: cs.flexDirection,
          background: cs.backgroundColor,
          overlayDisplay: overlayCs ? overlayCs.display : 'none',
          picPosition: picCs ? picCs.position : 'unknown'
        };
      })()
    `);
    console.log('BOGO Ad Mobile 390px:', JSON.stringify(mobileBogo));

    console.log('\\nFinal Overall Result:', allPass ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED');
    fs.writeFileSync(path.join(BASE_DIR, 'scratch', 'final-audit-summary.json'), JSON.stringify({ allPass, summary, desktopBogo, mobileBogo }, null, 2));

    ws.close();
  } catch (err) {
    console.error('Error during final audit:', err);
  } finally {
    edgeProc.kill();
    server.close();
    process.exit(0);
  }
});
