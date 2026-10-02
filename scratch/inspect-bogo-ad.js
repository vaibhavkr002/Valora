const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 8259;
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
    res.end();
  }
}).listen(PORT, async () => {
  const edgeProc = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    '--remote-debugging-port=9292',
    '--disable-gpu',
    '--no-sandbox',
    `http://localhost:${PORT}/index.html`
  ]);

  await new Promise(r => setTimeout(r, 2500));

  try {
    const listRes = await fetch('http://127.0.0.1:9292/json');
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
    await new Promise(r => setTimeout(r, 3000));

    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

    const info = await send('Runtime.evaluate', {
      expression: `(() => {
        const slot = document.querySelector('[data-ad-placement="below_hero"]');
        if (!slot) return { found: false };
        const card = slot.querySelector('.velora-ad-card') || slot.querySelector('div');
        const pic = slot.querySelector('.ad-bg-picture');
        const img = slot.querySelector('.ad-bg-image');
        const content = slot.querySelector('.velora-ad-content');
        slot.scrollIntoView({ block: 'center' });
        
        const rect = slot.getBoundingClientRect();
        const cCard = card ? window.getComputedStyle(card) : null;
        const cPic = pic ? window.getComputedStyle(pic) : null;
        const cContent = content ? window.getComputedStyle(content) : null;

        return {
          found: true,
          clip: {
            x: Math.max(0, rect.x),
            y: Math.max(0, rect.y),
            width: rect.width,
            height: rect.height,
            scale: 1
          },
          cardClass: card ? card.className : null,
          cardWidth: card ? card.offsetWidth : null,
          cardHeight: card ? card.offsetHeight : null,
          cardBackground: cCard ? cCard.backgroundColor : null,
          picWidth: pic ? pic.offsetWidth : null,
          picHeight: pic ? pic.offsetHeight : null,
          picPosition: cPic ? cPic.position : null,
          picLeft: cPic ? cPic.left : null,
          contentWidth: content ? content.offsetWidth : null,
          contentHeight: content ? content.offsetHeight : null
        };
      })()`,
      returnByValue: true
    });

    console.log('Below hero ad details:', JSON.stringify(info?.value, null, 2));

    await new Promise(r => setTimeout(r, 500));

    const shot = await send('Page.captureScreenshot', {
      format: 'png',
      clip: info?.value?.clip
    });
    if (shot && shot.data) {
      fs.writeFileSync(path.join(BASE_DIR, 'scratch', 'current-homepage-bogo-ad.png'), Buffer.from(shot.data, 'base64'));
      console.log('Saved screenshot to scratch/current-homepage-bogo-ad.png');
    }

    ws.close();
  } catch (err) {
    console.error('Error:', err);
  } finally {
    edgeProc.kill();
    server.close();
    process.exit(0);
  }
});
