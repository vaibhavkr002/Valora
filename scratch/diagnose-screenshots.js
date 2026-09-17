const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 8203;
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
  const edgeProc = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    '--remote-debugging-port=9295',
    '--disable-gpu',
    '--no-sandbox',
    `http://localhost:${PORT}/account.html`
  ]);

  await new Promise(r => setTimeout(r, 2000));

  try {
    const listRes = await fetch('http://127.0.0.1:9295/json');
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

    // Capture full page screenshot
    const fullScreenshot = await send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true
    });
    if (fullScreenshot && fullScreenshot.data) {
      fs.writeFileSync('c:/Users/saanv/OneDrive/Desktop/Website/webu/scratch/account-full.png', Buffer.from(fullScreenshot.data, 'base64'));
      console.log('Full screenshot saved to scratch/account-full.png');
    }

    // Scroll down and capture bottom viewport
    await evaluate(`window.scrollTo(0, document.body.scrollHeight)`);
    await new Promise(r => setTimeout(r, 500));
    const bottomScreenshot = await send('Page.captureScreenshot', { format: 'png' });
    if (bottomScreenshot && bottomScreenshot.data) {
      fs.writeFileSync('c:/Users/saanv/OneDrive/Desktop/Website/webu/scratch/account-bottom.png', Buffer.from(bottomScreenshot.data, 'base64'));
      console.log('Bottom viewport screenshot saved to scratch/account-bottom.png');
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

