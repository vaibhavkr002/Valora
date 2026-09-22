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
  if (u === '/') filePath = path.join(__dirname, '..', 'index.html');

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

const PORT = 3488;
server.listen(PORT, async () => {
  console.log(`[TEST SERVER] Running at http://localhost:${PORT}`);

  const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
  const edge = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9255',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `about:blank`
  ]);

  async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

  async function getCDPTarget() {
    for (let i = 0; i < 25; i++) {
      await wait(250);
      try {
        const targets = await new Promise((resolve, reject) => {
          http.get('http://127.0.0.1:9255/json', res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => resolve(JSON.parse(d)));
          }).on('error', reject);
        });
        const page = targets.find(t => t.type === 'page');
        if (page && page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
      } catch (e) {}
    }
    throw new Error('CDP target not ready');
  }

  try {
    const wsUrl = await getCDPTarget();
    const ws = new WebSocket(wsUrl);

    let id = 1;
    const callbacks = new Map();
    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const msgId = id++;
        callbacks.set(msgId, { resolve, reject });
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });
    }

    const consoleLogs = [];
    ws.onmessage = (evt) => {
      const raw = typeof evt.data === 'string' ? evt.data : evt.data.toString();
      const msg = JSON.parse(raw);
      if (msg.method === 'Runtime.consoleAPICalled') {
        const text = msg.params.args.map(a => a.value || a.description || JSON.stringify(a)).join(' ');
        consoleLogs.push(`[CONSOLE ${msg.params.type}] ${text}`);
      }
      if (msg.id && callbacks.has(msg.id)) {
        const { resolve, reject } = callbacks.get(msg.id);
        callbacks.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };

    if (ws.readyState !== 1) {
      await new Promise(res => ws.onopen = res);
    }
    await send('Page.enable');
    await send('Runtime.enable');

    console.log('\n--- 1. Testing Admin Panel Homepage Sections Save ---');
    // Inject mock admin auth so guardRoute passes
    await send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        window.MOCK_ADMIN = true;
        if (!window.AdminAuth) window.AdminAuth = {};
        window.AdminAuth.guardRoute = async () => ({ isAdmin: true, user: { id: 'admin_1', email: 'admin@vadi.com' } });
        window.AdminAuth.checkAdmin = async () => ({ isAdmin: true, user: { id: 'admin_1', email: 'admin@vadi.com' } });
      `
    });

    await send('Page.navigate', { url: `http://localhost:${PORT}/admin/homepage-sections.html` });
    await wait(2000);

    // Evaluate in Admin Panel: create a test section and save
    const adminTestResult = await send('Runtime.evaluate', {
      expression: `(async () => {
        try {
          // Check initial loaded sections count
          const rows = document.querySelectorAll('#sections-table-body tr');
          const countBefore = rows.length;

          // Open builder modal
          document.getElementById('btn-add-section').click();
          
          document.getElementById('sec-title').value = 'Summer Exclusive Showcase';
          document.getElementById('sec-subtitle').value = 'Handcrafted Luxury';
          document.getElementById('sec-type').value = 'product_grid';
          document.getElementById('sec-display-order').value = '18';
          document.getElementById('sec-is-active').checked = true;

          // Dispatch submit on form
          const form = document.getElementById('form-section-builder');
          const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
          form.dispatchEvent(submitEvent);

          // Wait a bit for persistAllSectionsToSupabase
          await new Promise(r => setTimeout(r, 1000));

          const countAfter = document.querySelectorAll('#sections-table-body tr').length;
          const localStorageData = localStorage.getItem('velora_homepage_sections');

          return {
            countBefore,
            countAfter,
            localStorageCount: localStorageData ? JSON.parse(localStorageData).length : 0,
            hasNewSectionInTable: document.body.innerText.includes('Summer Exclusive Showcase')
          };
        } catch (e) {
          return { error: e.message, stack: e.stack };
        }
      })()`,
      awaitPromise: true,
      returnByValue: true
    });

    console.log('Admin Action Result:', JSON.stringify(adminTestResult.result.value, null, 2));

    console.log('\n--- 2. Checking Supabase Database via REST ---');
    const supUrl = 'https://brioiujppaaycydndrcp.supabase.co';
    const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyaW9pdWpwcGFheWN5ZG5kcmNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3OTU3MzQsImV4cCI6MjEwNDM3MTczNH0.6HHJ0wv66obc6wj72CQJE8tvr6KgAXgWDs2DYnjPO78';

    const supRes = await fetch(`${supUrl}/rest/v1/homepage_sections?select=*&title=ilike.*Summer*`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` }
    });
    const supRows = await supRes.json();
    console.log('Supabase rows matching "Summer":', supRows);

    console.log('\n--- 3. Checking Customer Homepage Rendering ---');
    await send('Page.navigate', { url: `http://localhost:${PORT}/index.html` });
    await wait(2500);

    const customerCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        const summerElement = Array.from(document.querySelectorAll('h2, .section-title, span')).find(el => el.textContent.includes('Summer Exclusive Showcase'));
        const customGrids = document.querySelectorAll('.custom-product-grid-section');
        const allSections = Array.from(document.querySelectorAll('#homepage-main > *')).map(el => ({
          tag: el.tagName,
          id: el.id,
          class: el.className,
          type: el.getAttribute('data-section-type')
        }));

        return {
          summerElementFound: Boolean(summerElement),
          customGridsCount: customGrids.length,
          allSectionsCount: allSections.length,
          sectionTypes: allSections.map(s => s.id || s.class || s.tag)
        };
      })()`,
      returnByValue: true
    });

    console.log('Customer Homepage Check:', JSON.stringify(customerCheck.result.value, null, 2));

    console.log('\nCaptured Browser Console Logs:');
    consoleLogs.slice(-20).forEach(l => console.log('  ', l));

    ws.close();
  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    edge.kill();
    server.close();
  }
});
