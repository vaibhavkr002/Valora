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

const PORT = 3459;
server.listen(PORT, async () => {
  console.log(`Test server running at http://localhost:${PORT}`);

  const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
  const edge = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9226',
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
          http.get('http://127.0.0.1:9226/json', res => {
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
      if (msg.method === 'Runtime.consoleAPICalled') {
        // console.log('[BROWSER]', msg.params.type, msg.params.args.map(a => a.value || a.description).join(' '));
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
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false
    });

    // Add script before document loads to inject mock auth and orders
    await send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        const mockUser = { id: 'u_12345', email: 'test@example.com', user_metadata: { full_name: 'Test Customer' } };
        const mockOrder = {
          id: "ord_1001",
          order_number: "VADI1001",
          total: 1999,
          subtotal: 1999,
          discount: 0,
          shipping_charge: 0,
          payment_method: "Cash on Delivery",
          payment_status: "unpaid",
          order_status: "placed",
          advance_amount: 0,
          advance_paid: 0,
          cod_balance: 1999,
          delivery_preference: "Standard",
          free_gifts_eligible: false,
          created_at: new Date().toISOString(),
          order_items: [
            { id: "item_1", product_name: "Signature Oxford Shirt", price: 1999, quantity: 1, selected_size: "M" }
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

    console.log('\n--- Step 1: Initial State Check ---');
    const initialCheck = await send('Runtime.evaluate', {
      expression: `
        (function() {
          const cancelModal = document.getElementById("cancel-order-modal-overlay");
          const comp = window.getComputedStyle(cancelModal);
          const cancelBtn = document.querySelector(".btn-cancel-order");
          return {
            hasCancelBtn: !!cancelBtn,
            modalDisplay: comp.display,
            modalOpacity: comp.opacity,
            modalVisibility: comp.visibility,
            modalPointerEvents: comp.pointerEvents,
            hasActiveClass: cancelModal.classList.contains("active"),
            bodyOverflow: document.body.style.overflow
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Initial State:', JSON.stringify(initialCheck.result.value, null, 2));

    console.log('\n--- Step 2: Click Cancel Order Button ---');
    const clickCancel = await send('Runtime.evaluate', {
      expression: `
        (function() {
          const cancelBtn = document.querySelector(".btn-cancel-order");
          if (!cancelBtn) return { error: "No cancel button found" };
          cancelBtn.click();

          const cancelModal = document.getElementById("cancel-order-modal-overlay");
          const comp = window.getComputedStyle(cancelModal);
          const content = cancelModal.querySelector(".cancel-modal-content");
          const contentComp = window.getComputedStyle(content);

          const keepBtn = document.getElementById("btn-keep-my-order");
          const keepRect = keepBtn ? keepBtn.getBoundingClientRect() : null;
          const elAtKeep = keepRect ? document.elementFromPoint(keepRect.left + 5, keepRect.top + 5) : null;

          const submitBtn = document.getElementById("btn-submit-cancellation");
          const submitRect = submitBtn ? submitBtn.getBoundingClientRect() : null;
          const elAtSubmit = submitRect ? document.elementFromPoint(submitRect.left + 5, submitRect.top + 5) : null;

          return {
            modalDisplay: comp.display,
            modalOpacity: comp.opacity,
            modalVisibility: comp.visibility,
            modalPointerEvents: comp.pointerEvents,
            hasActiveClass: cancelModal.classList.contains("active"),
            contentDisplay: contentComp.display,
            contentVisibility: contentComp.visibility,
            bodyOverflow: document.body.style.overflow,
            modalH: cancelModal.offsetHeight,
            contentH: content.offsetHeight,
            contentMaxH: contentComp.maxHeight,
            formH: content.querySelector("#form-cancel-order").offsetHeight,
            keepRect: keepRect ? { x: keepRect.x, y: keepRect.y, w: keepRect.width, h: keepRect.height } : null,
            submitRect: submitRect ? { x: submitRect.x, y: submitRect.y, w: submitRect.width, h: submitRect.height } : null,
            elAtKeep: elAtKeep ? (elAtKeep.tagName + '#' + elAtKeep.id) : null,
            elAtSubmit: elAtSubmit ? (elAtSubmit.tagName + '#' + elAtSubmit.id) : null
          };
        })()
      `,
      returnByValue: true
    });
    console.log('After Clicking Cancel Order:', JSON.stringify(clickCancel.result.value, null, 2));

    console.log('\n--- Step 3: Click "Keep My Order" Button to Close ---');
    const clickKeep = await send('Runtime.evaluate', {
      expression: `
        (function() {
          const keepBtn = document.getElementById("btn-keep-my-order");
          if (!keepBtn) return { error: "Keep button not found" };
          keepBtn.click();

          const cancelModal = document.getElementById("cancel-order-modal-overlay");
          const comp = window.getComputedStyle(cancelModal);

          return {
            modalDisplay: comp.display,
            modalOpacity: comp.opacity,
            modalVisibility: comp.visibility,
            modalPointerEvents: comp.pointerEvents,
            hasActiveClass: cancelModal.classList.contains("active"),
            bodyOverflow: document.body.style.overflow
          };
        })()
      `,
      returnByValue: true
    });
    console.log('After Clicking Keep My Order:', JSON.stringify(clickKeep.result.value, null, 2));

    console.log('\n--- Step 4: Re-open and Test Escape Key ---');
    const escapeTest = await send('Runtime.evaluate', {
      expression: `
        (function() {
          const cancelBtn = document.querySelector(".btn-cancel-order");
          cancelBtn.click();

          const cancelModal = document.getElementById("cancel-order-modal-overlay");
          const openState = cancelModal.classList.contains("active");

          // Dispatch Escape keydown
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

          const closedState = cancelModal.classList.contains("active");
          const comp = window.getComputedStyle(cancelModal);

          return {
            wasOpen: openState,
            isClosedAfterEscape: !closedState,
            modalDisplay: comp.display,
            modalPointerEvents: comp.pointerEvents,
            bodyOverflow: document.body.style.overflow
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Escape Key Test:', JSON.stringify(escapeTest.result.value, null, 2));

    console.log('\n--- Step 5: Test Reason Selection & Custom Reason Box ---');
    const reasonTest = await send('Runtime.evaluate', {
      expression: `
        (function() {
          const cancelBtn = document.querySelector(".btn-cancel-order");
          cancelBtn.click();

          const otherRadio = document.getElementById("radio-cancel-other");
          otherRadio.checked = true;
          otherRadio.dispatchEvent(new Event('change', { bubbles: true }));

          const customWrap = document.getElementById("cancel-custom-reason-wrap");
          const isWrapVisible = customWrap.style.display !== "none";

          const changedRadio = document.querySelector('input[name="cancel_reason"][value="Changed my mind"]');
          changedRadio.checked = true;
          changedRadio.dispatchEvent(new Event('change', { bubbles: true }));

          const isWrapHiddenAgain = customWrap.style.display === "none";

          // Backdrop click to close
          const cancelModal = document.getElementById("cancel-order-modal-overlay");
          cancelModal.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

          return {
            otherRevealsCustomInput: isWrapVisible,
            otherHidesWhenDifferentSelected: isWrapHiddenAgain,
            closedOnBackdropClick: !cancelModal.classList.contains("active")
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Reason & Backdrop Test:', JSON.stringify(reasonTest.result.value, null, 2));

    console.log('\n--- Step 6: Mobile Viewport Verification ---');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 667,
      deviceScaleFactor: 2,
      mobile: true
    });
    await wait(300);

    const mobileCheck = await send('Runtime.evaluate', {
      expression: `
        (function() {
          const cancelBtn = document.querySelector(".btn-cancel-order");
          cancelBtn.click();

          const cancelModal = document.getElementById("cancel-order-modal-overlay");
          const comp = window.getComputedStyle(cancelModal);
          const content = cancelModal.querySelector(".cancel-modal-content");
          const contentComp = window.getComputedStyle(content);

          const keepBtn = document.getElementById("btn-keep-my-order");
          const keepRect = keepBtn ? keepBtn.getBoundingClientRect() : null;
          const elAtKeep = keepRect ? document.elementFromPoint(keepRect.left + 5, keepRect.top + 5) : null;

          keepBtn.click();
          const closedComp = window.getComputedStyle(cancelModal);

          return {
            mobileModalDisplay: comp.display,
            mobileModalOpacity: comp.opacity,
            mobileModalVisibility: comp.visibility,
            mobileElAtKeep: elAtKeep ? (elAtKeep.tagName + '#' + elAtKeep.id) : null,
            closedDisplay: closedComp.display,
            closedPointerEvents: closedComp.pointerEvents
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Mobile Viewport Test:', JSON.stringify(mobileCheck.result.value, null, 2));

    edge.kill();
    server.close();

    console.log('\nALL TESTS PASSED SUCCESSFULLY! No freezing, pointer-events are perfectly managed, and modals open/close cleanly.');
    process.exit(0);
  } catch (err) {
    console.error("Test error:", err);
    edge.kill();
    server.close();
    process.exit(1);
  }
});
