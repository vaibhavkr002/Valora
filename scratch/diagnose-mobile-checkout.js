const http = require('http');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const PORT = 8419;
const BASE_DIR = path.resolve('c:/Users/saanv/OneDrive/Desktop/Website/webu');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/checkout.html';
  const filePath = path.join(BASE_DIR, reqPath);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    res.writeHead(200, { 'Content-Type': MIME_TYPES[path.extname(filePath)] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end();
  }
}).listen(PORT, async () => {
  const edgeProc = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    '--remote-debugging-port=9319',
    '--disable-gpu',
    '--no-sandbox',
    `http://localhost:${PORT}/checkout.html`
  ]);

  await new Promise(r => setTimeout(r, 2000));

  try {
    const listRes = await fetch('http://127.0.0.1:9319/json');
    const tabs = await listRes.json();
    const tab = tabs.find(t => t.type === 'page' && (t.url.includes(String(PORT)) || !t.url.startsWith('chrome'))) || tabs[0];
    const ws = new WebSocket(tab.webSocketDebuggerUrl);

    let id = 1;
    function send(method, params = {}) {
      return new Promise(resolve => {
        const msgId = id++;
        const handler = e => {
          const d = JSON.parse(e.data);
          if (d.id === msgId) {
            ws.removeEventListener('message', handler);
            resolve(d.result && d.result.result ? d.result.result : d.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });
    }

    await new Promise(r => ws.addEventListener('open', r));

    async function evaluate(expression) {
      const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      return res ? res.value : null;
    }

    async function setViewport(width, height) {
      await send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 2,
        mobile: true
      });
      await new Promise(r => setTimeout(r, 300));
    }

    // Set cart so payment and items render
    await evaluate(`
      (function() {
        const testCart = [{
          id: 'test-item-1',
          name: 'The Obsidian Signature Blazer',
          price: 1800,
          quantity: 1,
          advance_payment_enabled: true,
          advance_payment_value: 120,
          image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200'
        }];
        localStorage.setItem('velora_cart', JSON.stringify(testCart));
        location.reload();
      })()
    `);
    await new Promise(r => setTimeout(r, 2000));

    const viewports = [320, 360, 375, 390, 414, 430, 1280];
    for (const w of viewports) {
      await setViewport(w, 900);
      const diag = await evaluate(`
        (function() {
          const docEl = document.documentElement;
          const body = document.body;
          const scrollW = Math.max(docEl.scrollWidth, body.scrollWidth);
          const clientW = docEl.clientWidth;
          const hasOverflow = scrollW > clientW + 1;

          // Find overflowing elements if any
          const overflowing = [];
          if (hasOverflow) {
            const all = document.querySelectorAll('*');
            all.forEach(el => {
              const r = el.getBoundingClientRect();
              if (r.right > clientW + 1) {
                overflowing.push({
                  tag: el.tagName,
                  id: el.id,
                  cls: el.className,
                  right: Math.round(r.right),
                  width: Math.round(r.width)
                });
              }
            });
          }

          // Check QR card and elements
          const desktopQrCard = document.getElementById('upi-desktop-scan-card');
          const qrContainer = document.getElementById('desktop-upi-qr-container');
          const qrSvg = qrContainer ? qrContainer.querySelector('svg') : null;
          const upiAppsGrid = document.getElementById('upi-apps-grid');

          // Typography sampling
          const title = document.querySelector('.checkout-page-title');
          const cardHeadings = Array.from(document.querySelectorAll('.checkout-card-header h2, .checkout-card-header h3')).map(h => ({
            text: h.textContent.trim().slice(0, 20),
            size: window.getComputedStyle(h).fontSize
          }));
          const btnPlace = document.getElementById('btn-place-order');

          return {
            viewport: ${w},
            scrollWidth: scrollW,
            clientWidth: clientW,
            hasOverflow,
            overflowingCount: overflowing.length,
            overflowSample: overflowing.slice(0, 5),
            qrCardDisplay: desktopQrCard ? window.getComputedStyle(desktopQrCard).display : 'none',
            qrContainerWidth: qrContainer ? Math.round(qrContainer.getBoundingClientRect().width) : 0,
            qrSvgWidth: qrSvg ? Math.round(qrSvg.getBoundingClientRect().width) : 0,
            upiAppsGridDisplay: upiAppsGrid ? window.getComputedStyle(upiAppsGrid).display : 'none',
            mainHeadingSize: title ? window.getComputedStyle(title).fontSize : 'none',
            cardHeadings,
            placeOrderBtnHeight: btnPlace ? Math.round(btnPlace.getBoundingClientRect().height) : 0,
            placeOrderBtnFontSize: btnPlace ? window.getComputedStyle(btnPlace).fontSize : 'none'
          };
        })()
      `);
      console.log(`\n--- Viewport ${w}px ---`);
      console.log('Scroll:', diag.scrollWidth, 'Client:', diag.clientWidth, 'HasOverflow:', diag.hasOverflow);
      if (diag.hasOverflow) {
        console.log('Overflowing Elements Count:', diag.overflowingCount);
        console.log('Sample overflowing:', diag.overflowSample);
      }
      console.log('QR Card display:', diag.qrCardDisplay, 'QR Container Width:', diag.qrContainerWidth);
      console.log('Main Heading Size:', diag.mainHeadingSize);
      console.log('Card Headings:', diag.cardHeadings);
      console.log('Place Order Button Height:', diag.placeOrderBtnHeight, 'Font:', diag.placeOrderBtnFontSize);
    }

    ws.close();
  } catch (e) {
    console.error(e);
  } finally {
    edgeProc.kill();
    server.close();
    process.exit(0);
  }
});
