const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 8255;
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
  if (reqPath === '/') reqPath = '/sarojini-bazaar.html';
  const filePath = path.join(BASE_DIR, reqPath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end();
  }
}).listen(PORT, async () => {
  const edgeProc = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    '--remote-debugging-port=9286',
    '--disable-gpu',
    '--no-sandbox',
    `http://localhost:${PORT}/sarojini-bazaar.html`
  ]);

  await new Promise(r => setTimeout(r, 2000));

  const listRes = await fetch('http://127.0.0.1:9286/json');
  const tabs = await listRes.json();
  const tab = tabs.find(t => t.type === 'page' && t.url.includes(String(PORT))) || tabs[0];
  const ws = new WebSocket(tab.webSocketDebuggerUrl);

  let id = 1;
  function send(m, p = {}) {
    return new Promise(resolve => {
      const msgId = id++;
      const h = e => {
        const d = JSON.parse(e.data);
        if (d.id === msgId) {
          ws.removeEventListener('message', h);
          resolve(d.result?.result || d.result);
        }
      };
      ws.addEventListener('message', h);
      ws.send(JSON.stringify({ id: msgId, method: m, params: p }));
    });
  }

  await new Promise(r => ws.addEventListener('open', r));
  await new Promise(r => setTimeout(r, 2000));

  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  const debug = await send('Runtime.evaluate', {
    expression: `(() => {
      const card = document.querySelector('.sarojini-ad-card');
      const pic = card.querySelector('.ad-bg-picture');
      const img = card.querySelector('img');
      const cCard = window.getComputedStyle(card);
      const cPic = window.getComputedStyle(pic);
      const cImg = window.getComputedStyle(img);

      // Check matched CSS rules if possible
      return {
        card: {
          display: cCard.display,
          position: cCard.position,
          height: cCard.height,
          maxHeight: cCard.maxHeight,
          flexDirection: cCard.flexDirection,
          padding: cCard.padding
        },
        pic: {
          display: cPic.display,
          position: cPic.position,
          height: cPic.height,
          width: cPic.width,
          maxHeight: cPic.maxHeight
        },
        img: {
          display: cImg.display,
          position: cImg.position,
          height: cImg.height,
          width: cImg.width,
          maxHeight: cImg.maxHeight,
          objectFit: cImg.objectFit
        }
      };
    })()`,
    returnByValue: true
  });

  console.log('DEBUG 1440px:', JSON.stringify(debug?.value, null, 2));

  ws.close();
  edgeProc.kill();
  server.close();
  process.exit(0);
});
