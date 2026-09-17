const http = require('http');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const PORT = 8430;
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
    '--remote-debugging-port=9330',
    '--disable-gpu',
    '--no-sandbox',
    `http://localhost:${PORT}/checkout.html`
  ]);

  await new Promise(r => setTimeout(r, 2000));

  try {
    const listRes = await fetch('http://127.0.0.1:9330/json');
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

    // Set cart
    await evaluate(`
      (function() {
        const testCart = [{
          id: 'test-item-pure-cod',
          name: 'The Obsidian Signature Blazer',
          price: 1800,
          quantity: 1,
          advance_payment_enabled: false,
          advance_payment_value: 0,
          image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200'
        }];
        localStorage.setItem('velora_cart', JSON.stringify(testCart));
        location.reload();
      })()
    `);
    await new Promise(r => setTimeout(r, 2000));

    // Fill form and place order
    const formCheck = await evaluate(`
      (function() {
        // Click the COD card
        const codCard = document.querySelector('.payment-method-card[data-method="Cash on Delivery"]');
        if (codCard) {
          codCard.click();
        }

        // Click Open Box Delivery card
        const openBoxCard = document.getElementById('pref-card-openbox');
        if (openBoxCard) openBoxCard.click();

        document.getElementById('input-fullname').value = "Vikram Aditya";
        document.getElementById('input-phone').value = "9876543210";
        document.getElementById('input-email').value = "vikram@example.com";
        document.getElementById('input-house').value = "104, Green Meadows";
        document.getElementById('input-street').value = "Koramangala 5th Block";
        document.getElementById('input-city').value = "Bengaluru";
        document.getElementById('input-state').value = "Karnataka";
        document.getElementById('input-zip').value = "560034";
        if (document.getElementById('select-country')) {
          document.getElementById('select-country').value = "India";
        }

        const btnTextBefore = document.getElementById('btn-place-order-text')?.textContent.trim();

        // Trigger place order
        document.getElementById('btn-place-order').click();

        return {
          btnTextBefore
        };
      })()
    `);
    console.log("Form check:", formCheck);

    // Wait 3 seconds for place order async processing and redirect
    await new Promise(r => setTimeout(r, 3500));

    const checkSuccess = await evaluate(`
      (function() {
        const lastOrder = JSON.parse(localStorage.getItem('velora_last_order') || '{}');
        const deliveryPrefEl = document.getElementById('order-delivery-preference');
        const paymentMethodEl = document.getElementById('order-payment-method');
        const totalAmountEl = document.getElementById('order-total-amount');

        return {
          url: window.location.href,
          lastOrder: {
            orderId: lastOrder.orderId,
            deliveryPreference: lastOrder.delivery_preference,
            paymentMethod: lastOrder.paymentMethod,
            total: lastOrder.total,
            advancePaid: lastOrder.advance_paid,
            codBalance: lastOrder.cod_balance
          },
          domReceipt: {
            deliveryPref: deliveryPrefEl ? deliveryPrefEl.textContent.trim() : null,
            paymentMethod: paymentMethodEl ? paymentMethodEl.textContent.trim() : null,
            totalAmount: totalAmountEl ? totalAmountEl.textContent.trim() : null
          }
        };
      })()
    `);
    console.log("Success check on order-success.html:", checkSuccess);

    ws.close();
  } catch (e) {
    console.error(e);
  } finally {
    edgeProc.kill();
    server.close();
    process.exit(0);
  }
});

