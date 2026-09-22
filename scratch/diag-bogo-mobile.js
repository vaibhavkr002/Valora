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

const PORT = 3470;
server.listen(PORT, async () => {
  console.log(`Test server running at http://localhost:${PORT}`);

  const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
  const edge = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9235',
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
          http.get('http://127.0.0.1:9235/json', res => {
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
      width: 320,
      height: 568,
      deviceScaleFactor: 2,
      mobile: true
    });

    await send('Page.navigate', { url: `http://localhost:${PORT}/homepage.html` });
    await wait(3000);

    // Open BOGO modal by clicking on a BOGO item or calling openBogoModal
    const diag = await send('Runtime.evaluate', {
      expression: `
        (function() {
          const bogoBtn = document.querySelector(".btn-claim-bogo") || document.querySelector("[data-bogo-id]");
          let pId = bogoBtn ? (bogoBtn.dataset.bogoId || bogoBtn.dataset.cartId) : null;
          if (!pId && window.PRODUCTS_DATA && window.PRODUCTS_DATA.length > 0) {
            pId = window.PRODUCTS_DATA[0].id;
          }
          if (bogoBtn) {
            bogoBtn.click();
          } else if (typeof openBogoModal === 'function') {
            openBogoModal(pId);
          }

          const overlay = document.getElementById("bogo-modal-overlay");
          const modal = overlay ? overlay.querySelector(".bogo-selection-modal") : null;
          const banner = document.getElementById("bogo-paid-item-banner");
          const gridWrap = overlay ? overlay.querySelector(".bogo-eligible-grid-wrap") : null;
          const footer = overlay ? overlay.querySelector(".bogo-modal-footer") : null;
          const confirmBtn = document.getElementById("bogo-confirm-add-btn");
          const activity = document.querySelector(".velora-order-activity");

          const overlayComp = overlay ? window.getComputedStyle(overlay) : null;
          const modalComp = modal ? window.getComputedStyle(modal) : null;
          const activityComp = activity ? window.getComputedStyle(activity) : null;
          const confirmRect = confirmBtn ? confirmBtn.getBoundingClientRect() : null;
          const modalRect = modal ? modal.getBoundingClientRect() : null;

          return {
            hasOverlay: !!overlay,
            overlayActive: overlay ? overlay.classList.contains("active") : false,
            overlayZIndex: overlayComp ? overlayComp.zIndex : null,
            activityZIndex: activityComp ? activityComp.zIndex : null,
            activityDisplay: activityComp ? activityComp.display : null,
            modalRect: modalRect ? { top: modalRect.top, bottom: modalRect.bottom, width: modalRect.width, height: modalRect.height } : null,
            confirmRect: confirmRect ? { top: confirmRect.top, bottom: confirmRect.bottom, width: confirmRect.width, height: confirmRect.height } : null,
            viewportHeight: window.innerHeight,
            isConfirmInViewport: confirmRect ? (confirmRect.bottom <= window.innerHeight && confirmRect.top >= 0) : false,
            isConfirmInModal: (confirmRect && modalRect) ? (confirmRect.bottom <= modalRect.bottom && confirmRect.top >= modalRect.top) : false
          };
        })()
      `,
      returnByValue: true
    });

    console.log("MOBILE DIAGNOSTIC (375x667):", JSON.stringify(diag.result.value, null, 2));

    edge.kill();
    server.close();
    process.exit(0);
  } catch (err) {
    console.error("Diagnostic error:", err);
    edge.kill();
    server.close();
    process.exit(1);
  }
});
