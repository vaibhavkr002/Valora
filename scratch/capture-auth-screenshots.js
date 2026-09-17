const http = require('http');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const PORT = 8416;
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
  if (reqPath === '/') reqPath = '/login.html';
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
    '--remote-debugging-port=9316',
    '--disable-gpu',
    '--no-sandbox',
    `http://localhost:${PORT}/login.html`
  ]);

  await new Promise(r => setTimeout(r, 2000));

  try {
    const listRes = await fetch('http://127.0.0.1:9316/json');
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

    async function setViewport(width, height) {
      await send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: width <= 768
      });
      await new Promise(r => setTimeout(r, 400));
    }

    async function captureScreenshot(filename) {
      const res = await send('Page.captureScreenshot', { format: 'png' });
      if (res && res.data) {
        fs.writeFileSync(path.join(BASE_DIR, 'scratch', filename), Buffer.from(res.data, 'base64'));
        console.log(`Saved screenshot: scratch/${filename}`);
      }
    }

    // Desktop Login
    await setViewport(1280, 800);
    await captureScreenshot('login-desktop.png');

    // Mobile Login
    await setViewport(375, 667);
    await captureScreenshot('login-mobile.png');

    // Navigate to Signup
    await send('Page.navigate', { url: `http://localhost:${PORT}/signup.html` });
    await new Promise(r => setTimeout(r, 1200));

    // Desktop Signup
    await setViewport(1280, 850);
    await captureScreenshot('signup-desktop.png');

    // Mobile Signup
    await setViewport(375, 750);
    await captureScreenshot('signup-mobile.png');

    ws.close();
  } catch (err) {
    console.error(err);
  } finally {
    edgeProc.kill();
    server.close();
    process.exit(0);
  }
});

