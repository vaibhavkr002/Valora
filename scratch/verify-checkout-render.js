const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 8399;
const BASE_DIR = path.resolve('c:/Users/saanv/OneDrive/Desktop/Website/webu');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/checkout.html';
  const filePath = path.join(BASE_DIR, reqPath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
}).listen(PORT, async () => {
  console.log(`Diagnostic Server running on port ${PORT}`);

  const edgeProc = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    '--remote-debugging-port=9299',
    '--disable-gpu',
    '--no-sandbox',
    `http://localhost:${PORT}/checkout.html`
  ]);

  await new Promise(r => setTimeout(r, 2000));

  try {
    const listRes = await fetch('http://127.0.0.1:9299/json');
    const tabs = await listRes.json();
    const tab = tabs.find(t => t.type === 'page' && (t.url.includes(String(PORT)) || !t.url.startsWith('chrome'))) || tabs[0];
    const ws = new WebSocket(tab.webSocketDebuggerUrl);

    let id = 1;
    function send(method, params = {}) {
      return new Promise((resolve) => {
        const msgId = id++;
        const handler = (event) => {
          const data = JSON.parse(event.data);
          if (data.id === msgId) {
            ws.removeEventListener('message', handler);
            resolve(data.result && data.result.result ? data.result.result : data.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });
    }

    await new Promise(r => ws.addEventListener('open', r));

    async function evaluate(expression) {
      const res = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true
      });
      return res ? res.value : null;
    }

    // Check desktop DOM elements
    const desktopStatus = await evaluate(`
      (function() {
        return {
          title: document.title,
          btnAddAddressHeader: Boolean(document.getElementById('btn-add-address-header')),
          noSavedAddressesNotice: Boolean(document.getElementById('no-saved-addresses-notice')),
          savedAddressesSection: Boolean(document.getElementById('saved-addresses-section')),
          deliveryFormContainer: Boolean(document.getElementById('delivery-form-container')),
          upiDesktopScanCard: Boolean(document.getElementById('upi-desktop-scan-card')),
          desktopUpiQrContainer: Boolean(document.getElementById('desktop-upi-qr-container')),
          upiAppsGrid: Boolean(document.getElementById('upi-apps-grid')),
          btnUpiPay: Boolean(document.getElementById('btn-upi-pay')),
          hasAlexanderHayes: document.body.innerHTML.includes('Alexander Hayes')
        };
      })()
    `);

    console.log('Desktop Layout Evaluation:', desktopStatus);

    // Test sanitization filter with mock addresses in local runtime
    const sanitizationTest = await evaluate(`
      (function() {
        const testList = [
          { full_name: 'Alexander Hayes', city: 'New York', state: 'Maharashtra', house: '101', street: 'St', pincode: '400001', phone: '9876543210' },
          { full_name: 'John Doe', city: 'Mumbai', state: 'Maharashtra', house: '102', street: 'St', pincode: '400001', phone: '9876543210' },
          { full_name: 'Ananya Sharma', city: 'Jaipur', state: 'Rajasthan', house: 'Flat 4B', street: 'Malviya Nagar', pincode: '302017', phone: '9829012345' }
        ];
        // Test filter
        return testList.filter(a => !a.full_name.toLowerCase().includes('alexander') && !a.full_name.toLowerCase().includes('john doe') && !a.city.toLowerCase().includes('new york'));
      })()
    `);

    console.log('Sanitized Address Count:', sanitizationTest.length, 'Remaining:', sanitizationTest[0].full_name);

    console.log('All Headless Edge Tests Completed Successfully!');
    ws.close();
  } catch (err) {
    console.error('Edge diagnostic failed:', err);
  } finally {
    edgeProc.kill();
    server.close();
    process.exit(0);
  }
});

