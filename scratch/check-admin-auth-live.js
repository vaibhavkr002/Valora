const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 8261;
const BASE_DIR = path.resolve('c:/Users/saanv/OneDrive/Desktop/Website/webu');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/admin/index.html';
  const filePath = path.join(BASE_DIR, reqPath);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'text/html' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end();
  }
}).listen(PORT, async () => {
  console.log(`Test server running at http://localhost:${PORT}`);
  const edgeProc = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    '--remote-debugging-port=9295',
    '--disable-gpu',
    '--no-sandbox',
    `http://localhost:${PORT}/admin/index.html`
  ]);

  await new Promise(r => setTimeout(r, 2500));
  try {
    const listRes = await fetch('http://127.0.0.1:9295/json');
    const tabs = await listRes.json();
    const tab = tabs.find(t => t.type === 'page' && t.url.includes(String(PORT))) || tabs[0];
    const ws = new WebSocket(tab.webSocketDebuggerUrl);

    let id = 1;
    function send(m, p = {}) {
      return new Promise(resolve => {
        const msgId = id++;
        const h = e => {
          const d = JSON.parse(e.data);
          if (d.id === msgId) {
            ws.removeEventListener('message', h);
            resolve(d.result?.result || d.result);
          }
        };
        ws.addEventListener('message', h);
        ws.send(JSON.stringify({ id: msgId, method: m, params: p }));
      });
    }

    await new Promise(r => ws.addEventListener('open', r));
    await new Promise(r => setTimeout(r, 2000));

    console.log('=== TEST 1: Admin account support@vadistudio.com ===');
    const test1 = await send('Runtime.evaluate', {
      expression: `window.AdminAuth.login('support@vadistudio.com', 'VadiSupport2026!')`,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('support@vadistudio.com success:', test1?.value?.success);
    if (!test1?.value?.success) console.log('Error:', test1?.value?.error);

    const check1 = await send('Runtime.evaluate', {
      expression: `window.AdminAuth.checkAdmin()`,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('support@vadistudio.com checkAdmin:', check1?.value?.isAdmin);

    // Logout
    await send('Runtime.evaluate', {
      expression: `window.AdminAuth.getClient().auth.signOut()`,
      awaitPromise: true
    });

    console.log('\n=== TEST 2: Admin account admin@vadi.com ===');
    const test2 = await send('Runtime.evaluate', {
      expression: `window.AdminAuth.login('admin@vadi.com', 'AdminPassword2026!')`,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('admin@vadi.com success:', test2?.value?.success);
    if (!test2?.value?.success) console.log('Error:', test2?.value?.error);

    const check2 = await send('Runtime.evaluate', {
      expression: `window.AdminAuth.checkAdmin()`,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('admin@vadi.com checkAdmin:', check2?.value?.isAdmin);

    // Logout
    await send('Runtime.evaluate', {
      expression: `window.AdminAuth.getClient().auth.signOut()`,
      awaitPromise: true
    });

    console.log('\n=== TEST 3: Customer account test_customer_audit@vadi.com (MUST BE DENIED) ===');
    const test3 = await send('Runtime.evaluate', {
      expression: `window.AdminAuth.login('test_customer_audit@vadi.com', 'VadiTest1234!')`,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('Customer login success (expected false):', test3?.value?.success);
    console.log('Customer error message:', test3?.value?.error);

    console.log('\n=== TEST 4: Unauthenticated user check (MUST BE DENIED) ===');
    const check4 = await send('Runtime.evaluate', {
      expression: `window.AdminAuth.checkAdmin()`,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('Unauthenticated checkAdmin isAdmin (expected false):', check4?.value?.isAdmin);
    console.log('Unauthenticated reason:', check4?.value?.reason);

    ws.close();
  } catch (err) {
    console.error(err);
  } finally {
    edgeProc.kill();
    server.close();
    process.exit(0);
  }
});
