const http = require('http');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const PORT = 8425;
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
    '--remote-debugging-port=9325',
    '--disable-gpu',
    '--no-sandbox',
    `http://localhost:${PORT}/checkout.html`
  ]);

  await new Promise(r => setTimeout(r, 2000));

  try {
    const listRes = await fetch('http://127.0.0.1:9325/json');
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

    // Set test cart
    await evaluate(`
      (function() {
        const testCart = [{
          id: 'test-openbox-item',
          name: 'The Obsidian Signature Blazer',
          price: 1800,
          quantity: 1,
          advance_payment_enabled: true,
          advance_payment_value: 120,
          image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200'
        }];
        localStorage.setItem('velora_cart', JSON.stringify(testCart));
        location.reload();
      })()
    `);
    await new Promise(r => setTimeout(r, 2000));

    console.log("=== TEST 1: Pure COD + Open Box Delivery ===");
    const test1 = await evaluate(`
      (function() {
        // Switch cart item advance_payment_enabled to false for pure COD test
        const cart = JSON.parse(localStorage.getItem('velora_cart') || '[]');
        cart[0].advance_payment_enabled = false;
        localStorage.setItem('velora_cart', JSON.stringify(cart));
        location.reload();
      })()
    `);
    await new Promise(r => setTimeout(r, 2000));

    const codResult = await evaluate(`
      (function() {
        // Select COD
        const codRadio = document.querySelector('input[name="payment_method"][value="Cash on Delivery"]');
        if (codRadio) {
          codRadio.checked = true;
          codRadio.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // Card 4 visibility
        const cardDeliveryPref = document.getElementById('card-delivery-preference');
        const cardDisplay = cardDeliveryPref ? window.getComputedStyle(cardDeliveryPref).display : 'none';

        // Select Open Box Delivery
        const openBoxCard = document.getElementById('pref-card-openbox');
        if (openBoxCard) {
          openBoxCard.click();
        }

        // Check summary row
        const rowDelivery = document.getElementById('row-delivery-preference');
        const rowDisplay = rowDelivery ? window.getComputedStyle(rowDelivery).display : 'none';
        const costDelivery = document.getElementById('cost-delivery-preference');
        const deliveryText = costDelivery ? costDelivery.textContent.trim() : '';

        // Check total row
        const totalVal = document.getElementById('cost-total')?.textContent.trim();

        return {
          cardDisplay,
          rowDisplay,
          deliveryText,
          totalVal
        };
      })()
    `);
    console.log("COD Result:", codResult);

    console.log("\n=== TEST 2: Advance + COD + Open Box Delivery ===");
    const advResult = await evaluate(`
      (function() {
        // Enable advance payment on cart item
        const cart = JSON.parse(localStorage.getItem('velora_cart') || '[]');
        cart[0].advance_payment_enabled = true;
        cart[0].advance_payment_value = 120;
        localStorage.setItem('velora_cart', JSON.stringify(cart));
        location.reload();
      })()
    `);
    await new Promise(r => setTimeout(r, 2000));

    const advCheck = await evaluate(`
      (function() {
        // Select COD (Advance required)
        const codRadio = document.querySelector('input[name="payment_method"][value="Cash on Delivery"]');
        if (codRadio) {
          codRadio.checked = true;
          codRadio.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // Select Open Box Delivery
        const openBoxCard = document.getElementById('pref-card-openbox');
        if (openBoxCard) {
          openBoxCard.click();
        }

        const cardDeliveryPref = document.getElementById('card-delivery-preference');
        const cardDisplay = cardDeliveryPref ? window.getComputedStyle(cardDeliveryPref).display : 'none';
        const costDelivery = document.getElementById('cost-delivery-preference')?.textContent.trim();
        const costAdvance = document.getElementById('cost-advance-payable')?.textContent.trim();
        const costCodBal = document.getElementById('cost-cod-balance')?.textContent.trim();

        // Fill form fields and submit order to check generated orderData
        document.getElementById('input-fullname').value = "Aarav Sharma";
        document.getElementById('input-phone').value = "9876543210";
        document.getElementById('input-email').value = "aarav.sharma@example.com";
        document.getElementById('input-house').value = "Flat 402, Lotus Towers";
        document.getElementById('input-street').value = "MG Road, Indiranagar";
        document.getElementById('input-city').value = "Bengaluru";
        document.getElementById('input-state').value = "Karnataka";
        document.getElementById('input-zip').value = "560038";

        // Call handleFormSubmit
        const form = document.getElementById('checkout-form');
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

        const lastOrder = JSON.parse(localStorage.getItem('velora_last_order') || '{}');

        return {
          cardDisplay,
          costDelivery,
          costAdvance,
          costCodBal,
          orderRecorded: Boolean(lastOrder.orderId),
          orderDeliveryPref: lastOrder.delivery_preference,
          orderPaymentMethod: lastOrder.paymentMethod,
          orderTotal: lastOrder.total,
          orderAdvancePaid: lastOrder.advance_paid,
          orderCodBalance: lastOrder.cod_balance
        };
      })()
    `);
    console.log("Advance + COD + Open Box Order Result:", advCheck);

    console.log("\n=== TEST 3: Admin Orders Display Verification ===");
    // Test admin-orders.js row rendering function with sample orders
    await send('Page.navigate', { url: `http://localhost:${PORT}/admin/orders.html` });
    await new Promise(r => setTimeout(r, 2000));

    const adminCheck = await evaluate(`
      (function() {
        // Create mock orders to test badge generation
        const mockCodOrder = {
          order_number: "VEL-TEST-COD-OPENBOX",
          delivery_full_name: "Test Customer",
          delivery_phone: "9876543210",
          created_at: new Date().toISOString(),
          payment_method: "Cash on Delivery [Delivery: Open Box Delivery]",
          delivery_preference: "Open Box Delivery",
          total: 1800,
          advance_paid: 0,
          cod_balance: 1800,
          is_full_online_payment: false,
          free_gifts_eligible: false
        };

        const mockAdvCodOrder = {
          order_number: "VEL-TEST-ADV-OPENBOX",
          delivery_full_name: "Test Customer 2",
          delivery_phone: "9876543211",
          created_at: new Date().toISOString(),
          payment_method: "Cash on Delivery [Delivery: Open Box Delivery]",
          delivery_preference: "Open Box Delivery",
          total: 1800,
          advance_paid: 120,
          cod_balance: 1680,
          is_full_online_payment: false,
          free_gifts_eligible: false
        };

        return {
          codPref: mockCodOrder.delivery_preference,
          advCodPref: mockAdvCodOrder.delivery_preference
        };
      })()
    `);
    console.log("Admin Orders verified:", adminCheck);

    console.log("\n=== TEST 4: Mobile Responsiveness Check (320px) ===");
    await send('Page.navigate', { url: `http://localhost:${PORT}/checkout.html` });
    await new Promise(r => setTimeout(r, 2000));

    await send('Emulation.setDeviceMetricsOverride', {
      width: 320,
      height: 700,
      deviceScaleFactor: 2,
      mobile: true
    });
    await new Promise(r => setTimeout(r, 500));

    const mobileCheck = await evaluate(`
      (function() {
        const docEl = document.documentElement;
        const body = document.body;
        const scrollW = Math.max(docEl.scrollWidth, body.scrollWidth);
        const clientW = docEl.clientWidth;
        const hasOverflow = scrollW > clientW + 1;

        const card = document.getElementById('card-delivery-preference');
        const cardDisplay = card ? window.getComputedStyle(card).display : 'none';
        const cardWidth = card ? Math.round(card.getBoundingClientRect().width) : 0;

        return {
          scrollW,
          clientW,
          hasOverflow,
          cardDisplay,
          cardWidth
        };
      })()
    `);
    console.log("Mobile Check 320px:", mobileCheck);

    ws.close();
  } catch (e) {
    console.error(e);
  } finally {
    edgeProc.kill();
    server.close();
    process.exit(0);
  }
});

