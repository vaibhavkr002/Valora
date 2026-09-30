const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 8251;
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
    '--remote-debugging-port=9312',
    '--disable-gpu',
    '--no-sandbox',
    'about:blank'
  ]);

  await new Promise(r => setTimeout(r, 2000));

  try {
    const listRes = await fetch('http://127.0.0.1:9312/json');
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

    const pages = [
      { name: 'checkout', url: 'checkout.html' },
      { name: 'cart', url: 'cart.html' },
      { name: 'product', url: 'product.html' },
      { name: 'shop', url: 'shop.html' },
      { name: 'sarojini', url: 'sarojini-bazaar.html' }
    ];

    for (const p of pages) {
      await send('Page.navigate', { url: 'http://localhost:' + PORT + '/' + p.url });
      await new Promise(r => setTimeout(r, 1500));

      await send('Emulation.setDeviceMetricsOverride', {
        width: 390,
        height: 844,
        deviceScaleFactor: 2,
        mobile: true
      });
      await new Promise(r => setTimeout(r, 600));

      // Check overflow
      const overflowInfo = await evaluate(`
        (() => {
          const docW = document.documentElement.clientWidth;
          const scrollW = document.documentElement.scrollWidth;
          return { docW, scrollW, overflow: scrollW > docW };
        })()
      `);
      console.log('Page ' + p.name + ' (390px):', JSON.stringify(overflowInfo));

      // Take upper viewport screenshot
      const topShot = await send('Page.captureScreenshot', { format: 'png' });
      if (topShot && topShot.data) {
        fs.writeFileSync(path.join(BASE_DIR, 'scratch', 'page-' + p.name + '-top.png'), Buffer.from(topShot.data, 'base64'));
      }

      // Scroll down and take middle/content screenshot
      await evaluate('window.scrollBy(0, 600)');
      await new Promise(r => setTimeout(r, 400));
      const midShot = await send('Page.captureScreenshot', { format: 'png' });
      if (midShot && midShot.data) {
        fs.writeFileSync(path.join(BASE_DIR, 'scratch', 'page-' + p.name + '-mid.png'), Buffer.from(midShot.data, 'base64'));
      }
    }

    console.log('Finished capturing screenshots!');
    ws.close();
  } catch (err) {
    console.error('Error:', err);
  } finally {
    edgeProc.kill();
    server.close();
    process.exit(0);
  }
});

