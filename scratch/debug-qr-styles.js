const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 8415;
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
  const edgeProc = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    '--remote-debugging-port=9315',
    '--disable-gpu',
    '--no-sandbox',
    `http://localhost:${PORT}/checkout.html`
  ]);

  await new Promise(r => setTimeout(r, 2000));

  try {
    const listRes = await fetch('http://127.0.0.1:9315/json');
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

    const debugInfo = await evaluate(`
      (function() {
        const card = document.getElementById('upi-desktop-scan-card');
        const qrContainer = document.getElementById('desktop-upi-qr-container');
        const qrBox = document.querySelector('.desktop-qr-box');
        
        const cardStyle = card ? window.getComputedStyle(card) : null;
        const qrBoxStyle = qrBox ? window.getComputedStyle(qrBox) : null;
        const qrContainerStyle = qrContainer ? window.getComputedStyle(qrContainer) : null;

        // Check if css/checkout.css is loaded
        const styleSheets = Array.from(document.styleSheets).map(s => s.href);

        return {
          styleSheets,
          card: cardStyle ? {
            display: cardStyle.display,
            width: cardStyle.width,
            maxWidth: cardStyle.maxWidth
          } : null,
          qrBox: qrBoxStyle ? {
            width: qrBoxStyle.width,
            height: qrBoxStyle.height,
            maxWidth: qrBoxStyle.maxWidth,
            maxHeight: qrBoxStyle.maxHeight
          } : null,
          qrContainer: qrContainerStyle ? {
            width: qrContainerStyle.width,
            height: qrContainerStyle.height,
            maxWidth: qrContainerStyle.maxWidth,
            maxHeight: qrContainerStyle.maxHeight
          } : null
        };
      })()
    `);

    console.log('DEBUG INFO:', JSON.stringify(debugInfo, null, 2));

    ws.close();
  } catch (err) {
    console.error(err);
  } finally {
    edgeProc.kill();
    server.close();
    process.exit(0);
  }
});

