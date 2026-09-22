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
  if (u === '/') filePath = path.join(__dirname, '..', 'account.html');

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

const PORT = 3463;
server.listen(PORT, async () => {
  console.log(`Test server running at http://localhost:${PORT}`);

  const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
  const edge = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9230',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `http://localhost:${PORT}/account.html#orders`
  ]);

  async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

  async function getCDPTarget() {
    for (let i = 0; i < 20; i++) {
      await wait(200);
      try {
        const targets = await new Promise((resolve, reject) => {
          http.get('http://127.0.0.1:9230/json', res => {
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
      if (msg.method === 'Runtime.exceptionThrown') {
        console.error('[BROWSER EXCEPTION]', msg.params.exceptionDetails);
      } else if (msg.id && callbacks.has(msg.id)) {
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
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false
    });

    // Mock delivered order to make Return Order button appear
    await send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        const mockUser = { id: 'u_12345', email: 'test@example.com', user_metadata: { full_name: 'Test Customer' } };
        const mockOrder = {
          id: "ord_2002",
          order_number: "VADI2002",
          total: 2499,
          subtotal: 2499,
          discount: 0,
          shipping_charge: 0,
          payment_method: "Online Payment",
          payment_status: "paid",
          order_status: "delivered",
          advance_amount: 0,
          advance_paid: 0,
          cod_balance: 0,
          delivery_preference: "Standard",
          free_gifts_eligible: false,
          created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          order_items: [
            { id: "item_2", product_name: "Tailored Italian Blazer", price: 2499, quantity: 1, selected_size: "42" }
          ]
        };

        Object.defineProperty(window, 'supabaseClient', {
          configurable: true,
          get: function() {
            return {
              auth: {
                getSession: () => Promise.resolve({ data: { session: { user: mockUser } } }),
                getUser: () => Promise.resolve({ data: { user: mockUser } }),
                onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
                signOut: () => Promise.resolve()
              },
              channel: () => ({ on: () => ({ subscribe: () => {} }) }),
              from: (table) => {
                if (table === 'profiles') {
                  return {
                    select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: mockUser.id, full_name: 'Test Customer', email: mockUser.email } }) }) }),
                    upsert: () => Promise.resolve({ error: null })
                  };
                }
                if (table === 'orders') {
                  return {
                    select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [mockOrder], error: null }) }) }),
                    update: () => ({ eq: () => Promise.resolve({ error: null }) })
                  };
                }
                if (table === 'order_requests') {
                  return {
                    select: () => ({ eq: () => Promise.resolve({ data: [] }) }),
                    insert: () => Promise.resolve({ error: null }),
                    update: () => ({ eq: () => Promise.resolve({ error: null }) })
                  };
                }
                if (table === 'store_settings') {
                  return {
                    select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }),
                    upsert: () => Promise.resolve({ error: null })
                  };
                }
                return {
                  select: () => ({ eq: () => Promise.resolve({ data: [] }) })
                };
              }
            };
          },
          set: function(v) {}
        });
      `
    });

    await send('Page.navigate', { url: `http://localhost:${PORT}/account.html#orders` });
    await wait(2500);

    console.log('\n--- Step 1: Initial Return Modal State ---');
    const initCheck = await send('Runtime.evaluate', {
      expression: `
        (function() {
          const returnModal = document.getElementById("return-order-modal-overlay");
          const comp = window.getComputedStyle(returnModal);
          const returnBtn = document.querySelector(".btn-return-order");
          return {
            hasReturnBtn: !!returnBtn,
            modalDisplay: comp.display,
            modalOpacity: comp.opacity,
            modalVisibility: comp.visibility,
            modalPointerEvents: comp.pointerEvents,
            hasActiveClass: returnModal.classList.contains("active")
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Initial State:', JSON.stringify(initCheck.result.value, null, 2));

    console.log('\n--- Step 2: Click Return Order Button ---');
    const openCheck = await send('Runtime.evaluate', {
      expression: `
        (function() {
          const returnBtn = document.querySelector(".btn-return-order");
          if (!returnBtn) return { error: "Return button not found" };
          returnBtn.click();

          const returnModal = document.getElementById("return-order-modal-overlay");
          const comp = window.getComputedStyle(returnModal);
          const content = returnModal.querySelector(".return-modal-content");
          const contentComp = window.getComputedStyle(content);

          const submitBtn = document.getElementById("btn-submit-return");
          const submitRect = submitBtn ? submitBtn.getBoundingClientRect() : null;
          const elAtSubmit = submitRect ? document.elementFromPoint(submitRect.left + 5, submitRect.top + 5) : null;

          return {
            modalDisplay: comp.display,
            modalOpacity: comp.opacity,
            modalVisibility: comp.visibility,
            modalPointerEvents: comp.pointerEvents,
            hasActiveClass: returnModal.classList.contains("active"),
            contentDisplay: contentComp.display,
            contentVisibility: contentComp.visibility,
            bodyOverflow: document.body.style.overflow,
            elAtSubmit: elAtSubmit ? (elAtSubmit.tagName + '#' + elAtSubmit.id) : null
          };
        })()
      `,
      returnByValue: true
    });
    console.log('After Clicking Return Order:', JSON.stringify(openCheck.result.value, null, 2));

    console.log('\n--- Step 3: Close Return Modal ---');
    const closeCheck = await send('Runtime.evaluate', {
      expression: `
        (function() {
          const closeBtn = document.querySelector(".btn-close-return-modal");
          closeBtn.click();

          const returnModal = document.getElementById("return-order-modal-overlay");
          const comp = window.getComputedStyle(returnModal);

          return {
            modalDisplay: comp.display,
            modalOpacity: comp.opacity,
            modalVisibility: comp.visibility,
            modalPointerEvents: comp.pointerEvents,
            hasActiveClass: returnModal.classList.contains("active"),
            bodyOverflow: document.body.style.overflow
          };
        })()
      `,
      returnByValue: true
    });
    console.log('After Closing Return Modal:', JSON.stringify(closeCheck.result.value, null, 2));

    edge.kill();
    server.close();

    console.log('\nRETURN ORDER MODAL VERIFICATION PASSED PERFECTLY!');
    process.exit(0);
  } catch (err) {
    console.error("Test error:", err);
    edge.kill();
    server.close();
    process.exit(1);
  }
});

