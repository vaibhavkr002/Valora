const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 8095;
const CDP_PORT = 9229;
const ROOT = 'c:\\Users\\saanv\\OneDrive\\Desktop\\Website\\webu';

const MIME = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
};

const server = http.createServer((req, res) => {
  let reqPath = decodeURI(req.url.split('?')[0]);
  if (reqPath === '/') reqPath = '/homepage.html';
  const filePath = path.join(ROOT, reqPath.replace(/^\//, ''));

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Access-Control-Allow-Origin': '*'
  });
  fs.createReadStream(filePath).pipe(res);
});

async function main() {
  await new Promise(r => server.listen(PORT, r));
  console.log(`Server listening on http://localhost:${PORT}`);

  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const edgeArgs = [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--user-data-dir=' + path.join(__dirname, 'edge_profile_verify')
  ];

  const browserProc = spawn(edgePath, edgeArgs, { stdio: 'ignore' });

  let wsUrl = null;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 300));
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
      const data = await res.json();
      wsUrl = data.webSocketDebuggerUrl;
      if (wsUrl) break;
    } catch (e) {}
  }

  if (!wsUrl) throw new Error('Cannot connect to CDP');

  class CDPClient {
    constructor(url) {
      this.ws = new WebSocket(url);
      this.id = 0;
      this.callbacks = new Map();
      this.consoleErrors = [];
    }
    async connect() {
      return new Promise((res, rej) => {
        this.ws.onopen = res;
        this.ws.onerror = rej;
        this.ws.onmessage = (msg) => {
          const data = JSON.parse(msg.data);
          if (data.id && this.callbacks.has(data.id)) {
            const cb = this.callbacks.get(data.id);
            this.callbacks.delete(data.id);
            if (data.error) cb.reject(data.error);
            else cb.resolve(data.result);
          } else if (data.method === 'Runtime.consoleAPICalled') {
            if (data.params.type === 'error') {
              this.consoleErrors.push(data.params.args.map(a => a.value || a.description).join(' '));
            }
          }
        };
      });
    }
    async send(method, params = {}) {
      const id = ++this.id;
      return new Promise((resolve, reject) => {
        this.callbacks.set(id, { resolve, reject });
        this.ws.send(JSON.stringify({ id, method, params }));
      });
    }
    async eval(expr) {
      const res = await this.send('Runtime.evaluate', {
        expression: expr,
        returnByValue: true,
        awaitPromise: true
      });
      return res.result ? res.result.value : null;
    }
    close() {
      this.ws.close();
    }
  }

  async function createTab(url, width, height, mobile = false) {
    const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new`, { method: 'PUT' });
    const tabInfo = await res.json();
    const client = new CDPClient(tabInfo.webSocketDebuggerUrl);
    await client.connect();
    await client.send('Page.enable');
    await client.send('DOM.enable');
    await client.send('Runtime.enable');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 2,
      mobile
    });
    await client.send('Page.navigate', { url });
    await new Promise(r => setTimeout(r, 2000));
    return { client, targetId: tabInfo.id };
  }

  const testPages = [
    { name: 'Homepage (Desktop)', url: `http://localhost:${PORT}/homepage.html`, w: 1280, h: 800, m: false },
    { name: 'Homepage (Mobile)', url: `http://localhost:${PORT}/homepage.html`, w: 375, h: 780, m: true },
    { name: 'Shop (Desktop)', url: `http://localhost:${PORT}/shop.html`, w: 1280, h: 800, m: false },
    { name: 'Shop (Mobile)', url: `http://localhost:${PORT}/shop.html`, w: 375, h: 780, m: true },
    { name: 'Product Details', url: `http://localhost:${PORT}/product.html?id=1`, w: 1280, h: 800, m: false },
    { name: 'Wishlist', url: `http://localhost:${PORT}/wishlist.html`, w: 1280, h: 800, m: false },
    { name: 'Cart', url: `http://localhost:${PORT}/cart.html`, w: 1280, h: 800, m: false },
    { name: 'Checkout', url: `http://localhost:${PORT}/checkout.html`, w: 1280, h: 800, m: false },
    { name: 'Account', url: `http://localhost:${PORT}/account.html`, w: 1280, h: 800, m: false },
    { name: 'Sarojini Bazaar Hub', url: `http://localhost:${PORT}/sarojini-bazaar.html`, w: 375, h: 780, m: true },
    { name: 'Sarojini Catalog', url: `http://localhost:${PORT}/sarojini-shop.html`, w: 375, h: 780, m: true },
    { name: 'Sarojini PDP', url: `http://localhost:${PORT}/sarojini-product-details.html?id=1`, w: 375, h: 780, m: true },
    { name: 'Admin Dashboard', url: `http://localhost:${PORT}/admin/dashboard.html`, w: 1280, h: 800, m: false }
  ];

  console.log('\n======================================================');
  console.log('STARTING END-TO-END VALORA BRAND VALIDATION');
  console.log('======================================================');

  let allPassed = true;

  for (const p of testPages) {
    const { client } = await createTab(p.url, p.w, p.h, p.m);

    const report = await client.eval(`(() => {
      const pageTitle = document.title;
      const logoEl = document.querySelector('.brand-logo, .sidebar-logo, .sarojini-brand-block');
      const logoText = logoEl ? logoEl.textContent.trim().replace(/\\s+/g, ' ') : '';
      const footerLogo = document.querySelector('.footer-brand-logo, .footer-logo');
      const footerText = footerLogo ? footerLogo.textContent.trim().replace(/\\s+/g, ' ') : '';

      // Find any visible element containing word "VADI" (ignoring technical email addresses or hidden code)
      const visibleVadi = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while (node = walker.nextNode()) {
        const txt = node.textContent;
        // Check for isolated word VADI
        if (/\\bVADI\\b/i.test(txt)) {
          const parent = node.parentElement;
          if (parent && window.getComputedStyle(parent).display !== 'none' && window.getComputedStyle(parent).visibility !== 'hidden') {
            const raw = txt.trim();
            // Ignore email addresses
            if (!raw.includes('@') && !raw.includes('okhdfcbank')) {
              visibleVadi.push({
                tag: parent.tagName,
                className: (parent.className || '').toString().slice(0, 40),
                text: raw.slice(0, 70)
              });
            }
          }
        }
      }

      const hasValora = /VALORA/i.test(document.body.innerText) || /VALORA/i.test(pageTitle);

      return {
        pageTitle,
        logoText,
        footerText,
        hasValora,
        visibleVadiCount: visibleVadi.length,
        visibleVadiItems: visibleVadi.slice(0, 5)
      };
    })()`);

    const hasOldVadi = report.visibleVadiCount > 0;
    const ok = !hasOldVadi;
    if (!ok) allPassed = false;

    console.log(`[${p.name}] ${ok ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Title: "${report.pageTitle}"`);
    console.log(`   Logo: "${report.logoText}" | Has VALORA: ${report.hasValora}`);
    if (hasOldVadi) {
      console.log(`   ⚠️ Visible VADI elements found:`, JSON.stringify(report.visibleVadiItems));
    }

    client.close();
  }

  console.log('\n======================================================');
  console.log(allPassed ? '🎉 ALL 13 CORE PAGES PASSED 100% VALORA VALIDATION!' : '⚠️ SOME PAGES NEED ATTENTION');
  console.log('======================================================');

  browserProc.kill();
  server.close();
}

main().catch(err => {
  console.error('Validation error:', err);
  process.exit(1);
});

