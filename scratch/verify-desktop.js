const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 8430;
const CDP_PORT = 9330;
const BASE_DIR = path.resolve('.');

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

    for (const width of [375, 1024, 1280, 1440, 1600]) {
      await send('Emulation.setDeviceMetricsOverride', {
        width,
        height: 900,
        deviceScaleFactor: 1,
        mobile: width < 768
      });
      await send('Page.navigate', { url: `http://localhost:${PORT}/index.html` });
      // Wait for page to finish loading
      for (let attempt = 0; attempt < 10; attempt++) {
        await new Promise(r => setTimeout(r, 400));
        const readyState = await send('Runtime.evaluate', { expression: 'document.readyState', returnByValue: true });
        if (readyState && readyState.value === 'complete') break;
      }

      const info = await send('Runtime.evaluate', {
        expression: `
          (function() {
            const navMenu = document.querySelector('.nav-menu');
            const navMenuDisplay = navMenu ? window.getComputedStyle(navMenu).display : null;
            const mobileSearch = document.querySelector('.mobile-search-bar-row');
            const mobileSearchDisplay = mobileSearch ? window.getComputedStyle(mobileSearch).display : null;
            const grid = document.querySelector('.products-grid, #trending-grid');
            const gridCols = grid ? window.getComputedStyle(grid).gridTemplateColumns.split(' ').length : 0;
            return {
              url: document.location.href,
              title: document.title,
              width: window.innerWidth,
              navMenuDisplay,
              mobileSearchDisplay,
              gridCols
            };
          })()
        `,
        returnByValue: true
      });
      console.log(`Desktop ${width}px verification:`, info.value);
    }
  } catch(e) {
    console.error(e);
  } finally {
    edgeProc.kill();
    server.close();
    process.exit(0);
  }
});
