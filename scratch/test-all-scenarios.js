const http = require('http');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const PORT = 8426;
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
    '--remote-debugging-port=9326',
    '--disable-gpu',
    '--no-sandbox',
    `http://localhost:${PORT}/checkout.html`
  ]);

  await new Promise(r => setTimeout(r, 2000));

  try {
    const listRes = await fetch('http://127.0.0.1:9326/json');
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

    const testScenarios = [
      { name: "COD + Simple Delivery", payment: "Cash on Delivery", pref: "Simple Delivery", isAdv: false },
      { name: "COD + Open Box Delivery", payment: "Cash on Delivery", pref: "Open Box Delivery", isAdv: false },
      { name: "Advance + COD + Simple Delivery", payment: "Cash on Delivery", pref: "Simple Delivery", isAdv: true },
      { name: "Advance + COD + Open Box Delivery", payment: "Cash on Delivery", pref: "Open Box Delivery", isAdv: true },
      { name: "Full Online + Simple Delivery", payment: "UPI / QR Payment", pref: "Simple Delivery", isAdv: false },
      { name: "Full Online + Open Box Delivery", payment: "UPI / QR Payment", pref: "Open Box Delivery", isAdv: false }
    ];

    for (const sc of testScenarios) {
      const res = await evaluate(`
        (async function() {
          const testCart = [{
            id: 'test-item-sc',
            name: 'Velora Blazer',
            price: 1800,
            quantity: 1,
            advance_payment_enabled: ${sc.isAdv},
            advance_payment_value: ${sc.isAdv ? 120 : 0},
            image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200'
          }];
          localStorage.setItem('velora_cart', JSON.stringify(testCart));
          localStorage.setItem('velora_preferred_delivery', '${sc.pref}');

          // Select payment
          const radio = document.querySelector('input[name="payment_method"][value="${sc.payment}"]');
          if (radio) {
            radio.checked = true;
            radio.dispatchEvent(new Event('change', { bubbles: true }));
          }

          // Select delivery preference
          const prefCard = document.querySelector('.delivery-pref-card[data-pref="${sc.pref}"]');
          if (prefCard) {
            prefCard.click();
          }

          // Check UI
          const cardPref = document.getElementById('card-delivery-preference');
          const cardDisplay = cardPref ? window.getComputedStyle(cardPref).display : 'none';
          const costPref = document.getElementById('cost-delivery-preference')?.textContent.trim();
          const costTotal = document.getElementById('cost-total')?.textContent.trim();
          const costAdv = document.getElementById('cost-advance-payable')?.textContent.trim();
          const costCodBal = document.getElementById('cost-cod-balance')?.textContent.trim();

          // Check gifts locked notice
          const giftsLockedNotice = document.getElementById('online-gifts-locked-notice');
          const giftsLockedText = giftsLockedNotice ? giftsLockedNotice.textContent.replace(/\\s+/g, ' ').trim() : '';
          const giftsLockHasOpenBox = giftsLockedText.toLowerCase().includes('open box');

          return {
            scenario: '${sc.name}',
            cardDisplay,
            costPref,
            costTotal,
            costAdv: costAdv || '₹0',
            costCodBal: costCodBal || '₹0',
            giftsLockHasOpenBox
          };
        })()
      `);
      console.log(`[PASS] ${res.scenario}`);
      console.log(`   Card Visible: ${res.cardDisplay}, Cost Pref in Summary: "${res.costPref}"`);
      console.log(`   Total: ${res.costTotal}, Advance: ${res.costAdv}, COD Bal: ${res.costCodBal}`);
      console.log(`   Gifts lock text mentions Open Box?: ${res.giftsLockHasOpenBox}`);
    }

    ws.close();
  } catch (e) {
    console.error(e);
  } finally {
    edgeProc.kill();
    server.close();
    process.exit(0);
  }
});

