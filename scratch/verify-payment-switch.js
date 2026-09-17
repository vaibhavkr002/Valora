const http = require('http');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const PORT = 8414;
const BASE_DIR = path.resolve('c:/Users/saanv/OneDrive/Desktop/Website/webu');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/checkout.html';
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
    '--remote-debugging-port=9314',
    '--disable-gpu',
    '--no-sandbox',
    'http://localhost:' + PORT + '/checkout.html'
  ]);

  await new Promise(r => setTimeout(r, 2000));
  try {
    const listRes = await fetch('http://127.0.0.1:9314/json');
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

    async function evaluate(expression) {
      const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      return res ? res.value : null;
    }

    await evaluate(`
      (function() {
        const testCart = [{
          id: 'test-item-1',
          name: 'The Obsidian Signature Blazer',
          price: 1800,
          quantity: 1,
          advance_payment_enabled: true,
          advance_payment_value: 120
        }];
        localStorage.setItem('velora_cart', JSON.stringify(testCart));
        location.reload();
      })()
    `);
    await new Promise(r => setTimeout(r, 2000));

    // Select COD
    const codResult = await evaluate(`
      (function() {
        const codCard = document.querySelector('.payment-method-card[data-method="Cash on Delivery"]');
        if (codCard) {
          codCard.click();
        }
        const badge = document.getElementById('desktop-scan-amount-badge');
        const type = document.getElementById('desktop-scan-amount-type');
        return {
          amount: badge ? badge.textContent.trim() : '',
          type: type ? type.textContent.trim() : ''
        };
      })()
    `);
    console.log('COD Advance Selection Result:', codResult);

    // Select UPI (Full online payment)
    const upiResult = await evaluate(`
      (function() {
        const upiCard = document.querySelector('.payment-method-card[data-method="UPI / QR Payment"]');
        if (upiCard) {
          upiCard.click();
        }
        const badge = document.getElementById('desktop-scan-amount-badge');
        const type = document.getElementById('desktop-scan-amount-type');
        return {
          amount: badge ? badge.textContent.trim() : '',
          type: type ? type.textContent.trim() : ''
        };
      })()
    `);
    console.log('UPI Full Payment Selection Result:', upiResult);

    ws.close();
  } catch(e) {
    console.error(e);
  } finally {
    edgeProc.kill();
    server.close();
    process.exit(0);
  }
});
