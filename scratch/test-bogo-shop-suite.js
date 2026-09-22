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

const PORT = 3476;
server.listen(PORT, async () => {
  const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
  const edge = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9241',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `http://localhost:${PORT}/bogo.html`
  ]);

  async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

  async function getCDPTarget() {
    for (let i = 0; i < 20; i++) {
      await wait(200);
      try {
        const targets = await new Promise((resolve, reject) => {
          http.get('http://127.0.0.1:9241/json', res => {
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

    // Test bogo.html on mobile (375x667)
    await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 667, deviceScaleFactor: 2, mobile: true });
    await send('Page.navigate', { url: `http://localhost:${PORT}/bogo.html` });
    await wait(2500);

    const bogoHtmlTest = await send('Runtime.evaluate', {
      expression: `
        (function() {
          const bogoBtn = document.querySelector(".btn-claim-bogo") || document.querySelector("[data-bogo-id]");
          if (bogoBtn) bogoBtn.click();
          else if (typeof openBogoModal === 'function') openBogoModal(window.PRODUCTS_DATA[0].id);

          const overlay = document.getElementById("bogo-modal-overlay");
          const modal = overlay ? overlay.querySelector(".bogo-selection-modal") : null;
          const confirmBtn = document.getElementById("bogo-confirm-add-btn");
          const activity = document.querySelector(".velora-order-activity");

          const modalRect = modal ? modal.getBoundingClientRect() : null;
          const confirmRect = confirmBtn ? confirmBtn.getBoundingClientRect() : null;
          const actComp = activity ? window.getComputedStyle(activity) : null;

          const closeBtn = document.getElementById("bogo-modal-close-btn");
          closeBtn.click();

          return {
            page: "bogo.html",
            modalFitsH: modalRect ? modalRect.bottom <= window.innerHeight : false,
            confirmInViewport: confirmRect ? (confirmRect.bottom <= window.innerHeight && confirmRect.top >= 0) : false,
            activityHidden: !activity || actComp.display === 'none' || actComp.visibility === 'hidden'
          };
        })()
      `,
      returnByValue: true
    });

    console.log("bogo.html mobile test result:", bogoHtmlTest.result.value);

    // Test shop.html on mobile (375x667)
    await send('Page.navigate', { url: `http://localhost:${PORT}/shop.html` });
    await wait(2500);

    const shopHtmlTest = await send('Runtime.evaluate', {
      expression: `
        (function() {
          const bogoBtn = document.querySelector(".btn-claim-bogo") || document.querySelector("[data-bogo-id]");
          if (bogoBtn) bogoBtn.click();
          else if (typeof openBogoModal === 'function') openBogoModal(window.PRODUCTS_DATA[0].id);

          const overlay = document.getElementById("bogo-modal-overlay");
          const modal = overlay ? overlay.querySelector(".bogo-selection-modal") : null;
          const confirmBtn = document.getElementById("bogo-confirm-add-btn");
          const activity = document.querySelector(".velora-order-activity");

          const modalRect = modal ? modal.getBoundingClientRect() : null;
          const confirmRect = confirmBtn ? confirmBtn.getBoundingClientRect() : null;
          const actComp = activity ? window.getComputedStyle(activity) : null;

          const closeBtn = document.getElementById("bogo-modal-close-btn");
          closeBtn.click();

          return {
            page: "shop.html",
            modalFitsH: modalRect ? modalRect.bottom <= window.innerHeight : false,
            confirmInViewport: confirmRect ? (confirmRect.bottom <= window.innerHeight && confirmRect.top >= 0) : false,
            activityHidden: !activity || actComp.display === 'none' || actComp.visibility === 'hidden'
          };
        })()
      `,
      returnByValue: true
    });

    console.log("shop.html mobile test result:", shopHtmlTest.result.value);

    edge.kill();
    server.close();

    if (bogoHtmlTest.result.value.confirmInViewport && shopHtmlTest.result.value.confirmInViewport) {
      console.log("\nBOTH BOGO.HTML AND SHOP.HTML PASSED VERIFICATION!");
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (err) {
    console.error("Test error:", err);
    edge.kill();
    server.close();
    process.exit(1);
  }
});

