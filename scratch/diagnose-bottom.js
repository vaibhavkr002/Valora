const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 8202;
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
  if (reqPath === '/') reqPath = '/account.html';
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
  console.log(`Diagnostic Server running on port ${PORT}`);

  const edgeProc = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    '--remote-debugging-port=9294',
    '--disable-gpu',
    '--no-sandbox',
    `http://localhost:${PORT}/account.html`
  ]);

  await new Promise(r => setTimeout(r, 2000));

  try {
    const listRes = await fetch('http://127.0.0.1:9294/json');
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

    await send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true
    });

    // Check bottom elements
    const bottomInfo = await evaluate(`
      (function() {
        const elements = Array.from(document.querySelectorAll('*'));
        const bottomElements = elements.map(el => {
          const rect = el.getBoundingClientRect();
          const cs = window.getComputedStyle(el);
          return {
            tag: el.tagName,
            id: el.id,
            className: el.className,
            top: Math.round(rect.top),
            bottom: Math.round(rect.bottom),
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            bg: cs.backgroundColor,
            position: cs.position,
            zIndex: cs.zIndex
          };
        }).filter(e => e.height > 0 && e.width > 0);

        // Check footer specifically
        const footer = document.querySelector('footer');
        const footerRect = footer ? footer.getBoundingClientRect() : null;

        // Take a look at any fixed / absolute elements at bottom
        const fixedAtBottom = bottomElements.filter(e => (e.position === 'fixed' || e.position === 'sticky') && e.bottom >= 700);

        return {
          windowInnerHeight: window.innerHeight,
          windowInnerWidth: window.innerWidth,
          docScrollHeight: document.documentElement.scrollHeight,
          docScrollWidth: document.documentElement.scrollWidth,
          footerRect,
          fixedAtBottom,
          allBottomElements: bottomElements.filter(e => e.top >= 700).slice(-10)
        };
      })()
    `);

    console.log('Bottom Info:', JSON.stringify(bottomInfo, null, 2));

    // Capture screenshot of account page
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    if (screenshot && screenshot.data) {
      fs.writeFileSync('c:/Users/saanv/OneDrive/Desktop/Website/webu/scratch/account-mobile.png', Buffer.from(screenshot.data, 'base64'));
      console.log('Screenshot saved to scratch/account-mobile.png');
    }

    ws.close();
    edgeProc.kill();
    server.close();
    process.exit(0);
  } catch (e) {
    console.error(e);
    edgeProc.kill();
    server.close();
    process.exit(1);
  }
});

