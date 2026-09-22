const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  let u = req.url.split('?')[0];
  let filePath = path.join(__dirname, '..', u);
  if (u === '/') filePath = path.join(__dirname, '..', 'homepage.html');

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found: ' + filePath);
    } else {
      const ext = path.extname(filePath);
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
      res.end(content);
    }
  });
});

const PORT = 3472;
server.listen(PORT, async () => {
  const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
  const edge = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9237',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `http://localhost:${PORT}/homepage.html`
  ]);

  async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

  async function getCDPTarget() {
    for (let i = 0; i < 20; i++) {
      await wait(200);
      try {
        const targets = await new Promise((resolve, reject) => {
          http.get('http://127.0.0.1:9237/json', res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => resolve(JSON.parse(d)));
          }).on('error', reject);
        });
        const page = targets.find(t => t.type === 'page');
        if (page) return page;
      } catch (_) {}
    }
    throw new Error("Could not find page target");
  }

  try {
    const page = await getCDPTarget();
    const ws = new WebSocket(page.webSocketDebuggerUrl);

    let id = 1;
    const callbacks = new Map();

    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const msgId = id++;
        callbacks.set(msgId, { resolve, reject });
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });
    }

    ws.onmessage = (evt) => {
      const msg = JSON.parse(evt.data);
      if (msg.id && callbacks.has(msg.id)) {
        const { resolve, reject } = callbacks.get(msg.id);
        callbacks.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };

    await new Promise(r => ws.onopen = r);
    await send('Runtime.enable');
    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 667,
      deviceScaleFactor: 2,
      mobile: true
    });

    await send('Page.navigate', { url: `http://localhost:${PORT}/homepage.html` });
    await wait(3000);

    const res = await send('Runtime.evaluate', {
      expression: `
        (function() {
          const bogoBtn = document.querySelector(".btn-claim-bogo") || document.querySelector("[data-bogo-id]");
          if (bogoBtn) bogoBtn.click();
          
          const card = document.querySelector('.bogo-card');
          const btn = document.querySelector('.bogo-select-btn');
          const thumb = document.querySelector('.bogo-card-thumb');
          const img = thumb ? thumb.querySelector('img') : null;
          const grid = document.getElementById('bogo-eligible-items-grid');
          
          return {
            gridCols: grid ? window.getComputedStyle(grid).gridTemplateColumns : null,
            cardW: card ? card.offsetWidth : null,
            cardH: card ? card.offsetHeight : null,
            imgW: img ? img.offsetWidth : null,
            imgH: img ? img.offsetHeight : null,
            imgNaturalW: img ? img.naturalWidth : null,
            imgNaturalH: img ? img.naturalHeight : null,
            btnText: btn ? btn.textContent.trim() : null
          };
        })()
      `,
      returnByValue: true
    });

    console.log("Card elements on 375x667:", JSON.stringify(res.result.value, null, 2));

    edge.kill();
    server.close();
    process.exit(0);
  } catch (err) {
    console.error("Test error:", err);
    edge.kill();
    server.close();
    process.exit(1);
  }
});

