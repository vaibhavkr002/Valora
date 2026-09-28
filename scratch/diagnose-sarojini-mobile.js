const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 8092;
const CDP_PORT = 9226;
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
  if (reqPath === '/') reqPath = '/sarojini-bazaar.html';
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
    '--user-data-dir=' + path.join(__dirname, 'edge_profile_diag')
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
      this.events = new Map();
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
          } else if (data.method) {
            const list = this.events.get(data.method) || [];
            list.forEach(fn => fn(data.params));
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

  async function createTab(url, width, height) {
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
      mobile: true
    });
    await client.send('Page.navigate', { url });
    await new Promise(r => setTimeout(r, 2200));
    return { client, targetId: tabInfo.id };
  }

  const widths = [320, 360, 375, 390, 414];
  const pages = [
    { name: 'Sarojini Bazaar Homepage', url: `http://localhost:${PORT}/sarojini-bazaar.html` },
    { name: 'Sarojini Catalog / Shop', url: `http://localhost:${PORT}/sarojini-shop.html` },
    { name: 'Sarojini Product Details', url: `http://localhost:${PORT}/sarojini-product-details.html?id=1` }
  ];

  console.log('\n======================================================');
  console.log('STARTING SAROJINI MOBILE DIAGNOSTIC INSPECTION');
  console.log('======================================================');

  for (const page of pages) {
    console.log(`\n>>> DIAGNOSING: ${page.name}`);
    for (const w of widths) {
      const { client } = await createTab(page.url, w, 780);

      const diag = await client.eval(`(() => {
        const docW = document.documentElement.clientWidth;
        const scrollW = document.documentElement.scrollWidth;
        const bodyScrollW = document.body.scrollWidth;
        const maxScrollW = Math.max(scrollW, bodyScrollW);
        const hasHorizontalOverflow = maxScrollW > docW + 1; // 1px tolerance

        // Find overflowing elements
        const overflowingElements = [];
        if (hasHorizontalOverflow) {
          const all = document.querySelectorAll('*');
          all.forEach(el => {
            const rect = el.getBoundingClientRect();
            if (rect.right > docW + 2) {
              overflowingElements.push({
                tag: el.tagName,
                className: (el.className || '').toString().slice(0, 50),
                id: el.id,
                right: Math.round(rect.right),
                width: Math.round(rect.width)
              });
            }
          });
        }

        // Header check
        const header = document.querySelector('.sarojini-nav-header');
        const headerH = header ? header.offsetHeight : 0;
        const searchBtn = document.querySelector('#sarojini-mobile-search-btn');
        const searchBtnVisible = searchBtn ? window.getComputedStyle(searchBtn).display !== 'none' : false;

        // Secondary strip check
        const secondaryNav = document.querySelector('.sarojini-secondary-nav');
        const secondaryScrolls = secondaryNav ? secondaryNav.scrollWidth > secondaryNav.clientWidth : false;

        // Cards check
        const cards = document.querySelectorAll('.product-card, .sarojini-card, .bazaar-card');
        const cardInfos = Array.from(cards).slice(0, 3).map(c => {
          const rect = c.getBoundingClientRect();
          const img = c.querySelector('img');
          const title = c.querySelector('.product-title, .product-card-title, h3, h4');
          const price = c.querySelector('.price, .current-price, .product-card-price');
          return {
            w: Math.round(rect.width),
            h: Math.round(rect.height),
            hasImg: !!img,
            titleText: title ? title.textContent.trim().slice(0, 25) : '',
            hasPrice: !!price
          };
        });

        // Hero check (if present)
        const hero = document.querySelector('.sarojini-hero-section, .hero-section');
        const heroH = hero ? hero.offsetHeight : 0;

        // Footer check
        const footer = document.querySelector('.sarojini-footer, .site-footer, footer');
        const footerH = footer ? footer.offsetHeight : 0;

        return {
          viewportW: docW,
          scrollW: maxScrollW,
          hasHorizontalOverflow,
          overflowCount: overflowingElements.length,
          topOverflowElements: overflowingElements.slice(0, 5),
          headerH,
          searchBtnVisible,
          secondaryScrolls,
          cardsCount: cards.length,
          sampleCard: cardInfos[0] || null,
          heroH,
          footerH
        };
      })()`);

      console.log(`[${w}px] Overflow: ${diag.hasHorizontalOverflow ? '⚠️ YES (' + diag.scrollW + 'px vs ' + diag.viewportW + 'px)' : '✅ NO'}, HeaderH: ${diag.headerH}px, SearchBtn: ${diag.searchBtnVisible}, Cards: ${diag.cardsCount}`);
      if (diag.hasHorizontalOverflow && diag.topOverflowElements.length > 0) {
        console.log(`   Overflow culprits:`, JSON.stringify(diag.topOverflowElements));
      }

      client.close();
    }
  }

  browserProc.kill();
  server.close();
}

main().catch(err => {
  console.error('Diagnostic error:', err);
  process.exit(1);
});
