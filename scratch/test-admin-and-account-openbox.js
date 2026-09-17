const http = require('http');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const PORT = 8431;
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
  if (reqPath === '/') reqPath = '/account.html';
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
    '--remote-debugging-port=9331',
    '--disable-gpu',
    '--no-sandbox',
    `http://localhost:${PORT}/account.html`
  ]);

  await new Promise(r => setTimeout(r, 2000));

  try {
    const listRes = await fetch('http://127.0.0.1:9331/json');
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

    // Set last order in localStorage for account.html order display
    const testOrder = {
      orderId: "#VEL-89210",
      orderDate: "17 Sep 2026",
      estimatedDelivery: "20 Sep 2026",
      customer: {
        fullName: "Aarav Sharma",
        phone: "9876543210",
        house: "Flat 402",
        street: "MG Road",
        city: "Bengaluru",
        state: "Karnataka",
        country: "India",
        pincode: "560038"
      },
      paymentMethod: "Cash on Delivery [Delivery: Open Box Delivery]",
      delivery_preference: "Open Box Delivery",
      total: 1800,
      advance_amount: 120,
      advance_paid: 120,
      cod_balance: 1680,
      payment_status: "pending",
      advance_payment_status: "paid",
      cod_payment_status: "pending",
      items: [{
        name: "The Obsidian Signature Blazer",
        price: 1800,
        quantity: 1,
        image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200"
      }]
    };

    await evaluate(`
      (function() {
        localStorage.setItem('velora_last_order', JSON.stringify(${JSON.stringify(testOrder)}));
        location.reload();
      })()
    `);
    await new Promise(r => setTimeout(r, 2000));

    const accountOrdersCheck = await evaluate(`
      (function() {
        const pageText = document.body.innerText;
        const hasOpenBox = pageText.includes("OPEN BOX") || pageText.includes("Open Box Delivery");
        const hasAdvCod = pageText.includes("120") || pageText.includes("Cash on Delivery");
        return {
          hasOpenBox,
          hasAdvCod
        };
      })()
    `);
    console.log("Account Orders Check:", accountOrdersCheck);

    // Test Admin Orders Table Badge Rendering logic
    const adminOrdersHtml = await evaluate(`
      (function() {
        // Simulate row rendering logic in admin-orders.js
        const orders = [
          {
            order_number: "VEL-COD-SIMPLE",
            delivery_full_name: "Customer 1",
            payment_method: "Cash on Delivery [Delivery: Simple Delivery]",
            delivery_preference: "Simple Delivery",
            is_full_online_payment: false
          },
          {
            order_number: "VEL-COD-OPENBOX",
            delivery_full_name: "Customer 2",
            payment_method: "Cash on Delivery [Delivery: Open Box Delivery]",
            delivery_preference: "Open Box Delivery",
            is_full_online_payment: false
          },
          {
            order_number: "VEL-ADV-OPENBOX",
            delivery_full_name: "Customer 3",
            payment_method: "Cash on Delivery • Advance Paid via UPI (₹120) + COD Balance (₹1,680) [Delivery: Open Box Delivery]",
            delivery_preference: "Open Box Delivery",
            advance_amount: 120,
            advance_paid: 120,
            cod_balance: 1680,
            is_full_online_payment: false
          },
          {
            order_number: "VEL-ONLINE-OPENBOX",
            delivery_full_name: "Customer 4",
            payment_method: "UPI / QR Payment [3 Free Gifts Included] [Delivery: Open Box Delivery]",
            delivery_preference: "Open Box Delivery",
            is_full_online_payment: true,
            free_gifts_eligible: true,
            free_gifts_items: [{ name: "Socks" }, { name: "Extra Laces" }, { name: "Key Chain" }]
          }
        ];

        return orders.map(o => {
          const hasAdvance = Number(o.advance_paid || o.advance_amount || 0) > 0;
          const isOnlinePaid = Boolean(o.is_full_online_payment);
          const hasGifts = Boolean(o.free_gifts_eligible);
          const deliveryPref = o.delivery_preference || "Simple Delivery";
          const isOpenBox = deliveryPref === "Open Box Delivery";

          let paymentBadgesHtml = '<div>' + o.payment_method + '</div>';
          paymentBadgesHtml += '<div style="margin-top: 5px; display: flex; gap: 4px; flex-wrap: wrap;">';
          if (isOnlinePaid) {
            paymentBadgesHtml += ' [ONLINE PAID]';
            if (hasGifts) paymentBadgesHtml += ' [3 FREE GIFTS]';
          }
          paymentBadgesHtml += isOpenBox ? ' [📦 OPEN BOX]' : ' [SIMPLE DELIVERY]';
          paymentBadgesHtml += '</div>';

          return {
            order: o.order_number,
            badges: paymentBadgesHtml
          };
        });
      })()
    `);
    console.log("Admin Orders Badge Output:", adminOrdersHtml);

    ws.close();
  } catch (e) {
    console.error(e);
  } finally {
    edgeProc.kill();
    server.close();
    process.exit(0);
  }
});

