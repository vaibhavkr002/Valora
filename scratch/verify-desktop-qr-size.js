const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 8412;
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
  if (reqPath === '/') reqPath = '/checkout.html';
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
  console.log(`Server running on port ${PORT}`);

  const edgeProc = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    '--remote-debugging-port=9312',
    '--disable-gpu',
    '--no-sandbox',
    `http://localhost:${PORT}/checkout.html`
  ]);

  await new Promise(r => setTimeout(r, 2000));

  try {
    const listRes = await fetch('http://127.0.0.1:9312/json');
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

    async function setViewport(width, height) {
      await send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: width <= 768
      });
      await new Promise(r => setTimeout(r, 300));
    }

    // Set cart in localStorage so checkout displays payment section
    await evaluate(`
      (function() {
        const testCart = [{
          id: 'test-item-1',
          name: 'The Obsidian Signature Blazer',
          price: 1800,
          quantity: 1,
          advance_payment_enabled: true,
          advance_payment_value: 120
        }];
        localStorage.setItem('velora_cart', JSON.stringify(testCart));
        location.reload();
      })()
    `);

    await new Promise(r => setTimeout(r, 2000));

    // Reconnect or evaluate on reloaded page
    // 1. Desktop Test (1280px)
    await setViewport(1280, 800);

    const desktopData = await evaluate(`
      (function() {
        const card = document.getElementById('upi-desktop-scan-card');
        const qrContainer = document.getElementById('desktop-upi-qr-container');
        const qrBox = document.querySelector('.desktop-qr-box');
        const amountBadge = document.getElementById('desktop-scan-amount-badge');
        const amountType = document.getElementById('desktop-scan-amount-type');
        const svg = qrContainer ? qrContainer.querySelector('svg') : null;

        const cardRect = card ? card.getBoundingClientRect() : {};
        const qrBoxRect = qrBox ? qrBox.getBoundingClientRect() : {};
        const qrContainerRect = qrContainer ? qrContainer.getBoundingClientRect() : {};
        const svgRect = svg ? svg.getBoundingClientRect() : {};

        return {
          cardVisible: card ? window.getComputedStyle(card).display !== 'none' : false,
          cardWidth: Math.round(cardRect.width),
          qrBoxWidth: Math.round(qrBoxRect.width),
          qrBoxHeight: Math.round(qrBoxRect.height),
          qrContainerWidth: Math.round(qrContainerRect.width),
          qrContainerHeight: Math.round(qrContainerRect.height),
          svgWidth: svg ? Math.round(svgRect.width) : 0,
          svgHeight: svg ? Math.round(svgRect.height) : 0,
          amountText: amountBadge ? amountBadge.textContent.trim() : '',
          amountType: amountType ? amountType.textContent.trim() : ''
        };
      })()
    `);

    console.log('--- 1. Desktop Viewport (1280px) ---');
    console.log('Desktop Evaluation Result:', desktopData);

    // 2. Tablet Test (900px)
    await setViewport(900, 800);

    const tabletData = await evaluate(`
      (function() {
        const qrContainer = document.getElementById('desktop-upi-qr-container');
        const qrRect = qrContainer ? qrContainer.getBoundingClientRect() : {};
        return {
          qrWidth: Math.round(qrRect.width),
          qrHeight: Math.round(qrRect.height)
        };
      })()
    `);

    console.log('--- 2. Tablet Viewport (900px) ---');
    console.log('Tablet Evaluation Result:', tabletData);

    // 3. Mobile Test (375px)
    await setViewport(375, 667);

    const mobileData = await evaluate(`
      (function() {
        const desktopCard = document.getElementById('upi-desktop-scan-card');
        const mobileAppsGrid = document.getElementById('upi-apps-grid');
        return {
          desktopCardVisible: desktopCard ? window.getComputedStyle(desktopCard).display !== 'none' : false,
          mobileAppsGridVisible: mobileAppsGrid ? window.getComputedStyle(mobileAppsGrid).display !== 'none' : false
        };
      })()
    `);

    console.log('--- 3. Mobile Viewport (375px) ---');
    console.log('Mobile Evaluation Result:', mobileData);

    // Assertions
    console.log('\n--- VERIFICATION CHECKS ---');
    console.log('QR Code Width on Desktop is approximately 220px:', desktopData.qrContainerWidth, 'px (Target: ~220px)');
    console.log('QR Code Height on Desktop is approximately 220px:', desktopData.qrContainerHeight, 'px (Target: ~220px)');
    console.log('Card Width on Desktop is compact:', desktopData.cardWidth, 'px (Max: 380px)');
    console.log('QR Code Width on Tablet is approximately 200px:', tabletData.qrWidth, 'px (Target: ~200px)');
    console.log('Desktop Card Hidden on Mobile:', !mobileData.desktopCardVisible);
    console.log('Mobile Apps Grid Visible on Mobile:', mobileData.mobileAppsGridVisible);

    ws.close();
  } catch (err) {
    console.error('Edge test failed:', err);
  } finally {
    edgeProc.kill();
    server.close();
    process.exit(0);
  }
});

