const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const filePath = "file:///" + path.resolve(__dirname, '..', 'account.html').replace(/\\/g, '/');

const edge = spawn(edgePath, [
  '--headless=new',
  '--remote-debugging-port=9222',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  'about:blank'
]);

async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getCDPTarget() {
  for (let i = 0; i < 20; i++) {
    await wait(200);
    try {
      const targets = await new Promise((resolve, reject) => {
        http.get('http://127.0.0.1:9222/json', res => {
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

async function run() {
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
      if (msg.method === 'Runtime.consoleAPICalled') {
        console.log('[BROWSER CONSOLE]', msg.params.type, msg.params.args.map(a => a.value || a.description).join(' '));
      } else if (msg.method === 'Runtime.exceptionThrown') {
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

    // Mock auth & Supabase on new document
    await send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        window.addEventListener('DOMContentLoaded', () => {
          // Mock Supabase Auth
          const mockUser = { id: 'user_123', email: 'test@example.com', user_metadata: { full_name: 'Test User' } };
          const origGetClient = window.getSupabaseClient;
          // Hook into supabase
          window.VeloraAuth = {
            getClient: () => window.supabaseClient,
            getUser: () => Promise.resolve(mockUser),
            logout: () => Promise.resolve()
          };
          if (window.supabaseClient) {
            window.supabaseClient.auth = {
              getSession: () => Promise.resolve({ data: { session: { user: mockUser } } }),
              getUser: () => Promise.resolve({ data: { user: mockUser } }),
              signOut: () => Promise.resolve()
            };
            window.supabaseClient.from = (table) => {
              return {
                select: () => ({
                  eq: () => ({
                    maybeSingle: () => Promise.resolve({ data: { id: 'user_123', full_name: 'Test User' } }),
                    order: () => Promise.resolve({
                      data: [
                        {
                          id: "ord_test_123",
                          order_number: "VADI1001",
                          total: 2499,
                          payment_method: "Cash on Delivery",
                          payment_status: "unpaid",
                          order_status: "placed",
                          advance_amount: 0,
                          created_at: new Date().toISOString(),
                          order_items: [{ id: "item_1", product_name: "Silk Shirt", price: 2499, quantity: 1 }]
                        }
                      ],
                      error: null
                    })
                  })
                }),
                insert: () => Promise.resolve({ error: null }),
                update: () => ({ eq: () => Promise.resolve({ error: null }) }),
                upsert: () => Promise.resolve({ error: null })
              };
            };
          }
        });
      `
    });

    console.log("Navigating to account.html...");
    await send('Page.navigate', { url: filePath });
    await wait(2000);

    // Check if cancel button is present in rendered order
    const checkRes = await send('Runtime.evaluate', {
      expression: `
        (function() {
          const btn = document.querySelector(".btn-cancel-order");
          const cancelModal = document.getElementById("cancel-order-modal-overlay");
          return {
            cancelBtnFound: !!btn,
            cancelBtnText: btn ? btn.innerText : null,
            modalExists: !!cancelModal
          };
        })()
      `,
      returnByValue: true
    });
    console.log("Check result:", checkRes.result.value);

    // CLICK THE CANCEL ORDER BUTTON!
    console.log("Clicking .btn-cancel-order...");
    const clickRes = await send('Runtime.evaluate', {
      expression: `
        (function() {
          const btn = document.querySelector(".btn-cancel-order");
          const cancelModal = document.getElementById("cancel-order-modal-overlay");
          if (!btn) return { error: "No cancel button found" };
          
          btn.click();
          
          const comp = window.getComputedStyle(cancelModal);
          return {
            modalDisplay: comp.display,
            modalOpacity: comp.opacity,
            modalVisibility: comp.visibility,
            modalPointerEvents: comp.pointerEvents,
            modalZIndex: comp.zIndex,
            bodyOverflow: document.body.style.overflow,
            bodyClass: document.body.className
          };
        })()
      `,
      returnByValue: true
    });
    console.log("After clicking Cancel Order:", clickRes.result.value);

    // Try to click "Keep My Order" button
    console.log("Attempting to click Keep My Order button...");
    const closeRes = await send('Runtime.evaluate', {
      expression: `
        (function() {
          const keepBtn = document.getElementById("btn-keep-my-order");
          const cancelModal = document.getElementById("cancel-order-modal-overlay");
          if (!keepBtn) return { error: "No keep button found" };
          
          keepBtn.click();
          
          const comp = window.getComputedStyle(cancelModal);
          return {
            modalDisplayAfterClose: comp.display,
            bodyOverflowAfterClose: document.body.style.overflow,
            bodyClassAfterClose: document.body.className
          };
        })()
      `,
      returnByValue: true
    });
    console.log("After clicking Keep My Order:", closeRes.result.value);

  } catch (e) {
    console.error("Test error:", e);
  } finally {
    edge.kill();
    process.exit(0);
  }
}

run();

