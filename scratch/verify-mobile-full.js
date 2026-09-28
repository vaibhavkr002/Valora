const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 8094;
const CDP_PORT = 9228;
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
    '--user-data-dir=' + path.join(__dirname, 'edge_profile_full')
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
    async screenshot(filepath) {
      const res = await this.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(filepath, Buffer.from(res.data, 'base64'));
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
    // Wait for initial render + network queries
    await new Promise(r => setTimeout(r, 3500));
    return { client, targetId: tabInfo.id };
  }

  const widths = [320, 360, 375, 390, 414];
  const pages = [
    { name: 'Sarojini Bazaar Homepage', url: `http://localhost:${PORT}/sarojini-bazaar.html`, shotKey: 'home' },
    { name: 'Sarojini Catalog / Shop', url: `http://localhost:${PORT}/sarojini-shop.html`, shotKey: 'shop' },
    { name: 'Sarojini Product Details', url: `http://localhost:${PORT}/sarojini-product-details.html?id=1`, shotKey: 'pdp' }
  ];

  console.log('\n======================================================');
  console.log('SAROJINI MOBILE VIEWPORT VALIDATION');
  console.log('======================================================');

  for (const page of pages) {
    console.log(`\n>>> TESTING: ${page.name}`);
    for (const w of widths) {
      const { client } = await createTab(page.url, w, 780);

      const diag = await client.eval(`(() => {
        const docW = document.documentElement.clientWidth;
        const scrollW = document.documentElement.scrollWidth;
        const bodyScrollW = document.body.scrollWidth;
        const maxScrollW = Math.max(scrollW, bodyScrollW);
        const hasHorizontalOverflow = maxScrollW > docW + 1;

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

        const header = document.querySelector('.sarojini-nav-header');
        const headerH = header ? header.offsetHeight : 0;
        const searchBtn = document.querySelector('#sarojini-mobile-search-btn');
        const searchBtnVisible = searchBtn ? window.getComputedStyle(searchBtn).display !== 'none' : false;

        const cards = document.querySelectorAll('.sarojini-product-card, .product-card, .sarojini-card, .bazaar-card');
        const cardInfos = Array.from(cards).slice(0, 2).map(c => {
          const rect = c.getBoundingClientRect();
          const img = c.querySelector('img');
          const title = c.querySelector('.product-card-title, .product-title, h3, h4');
          const price = c.querySelector('.price-selling, .current-price, .price');
          return {
            w: Math.round(rect.width),
            h: Math.round(rect.height),
            hasImg: !!img,
            title: title ? title.textContent.trim().slice(0, 25) : '',
            hasPrice: !!price
          };
        });

        return {
          viewportW: docW,
          scrollW: maxScrollW,
          hasHorizontalOverflow,
          overflowCount: overflowingElements.length,
          topCulprits: overflowingElements.slice(0, 5),
          headerH,
          searchBtnVisible,
          cardsCount: cards.length,
          sampleCards: cardInfos
        };
      })()`);

      console.log(`[${w}px] Overflow: ${diag.hasHorizontalOverflow ? '⚠️ YES (' + diag.scrollW + 'px vs ' + diag.viewportW + 'px)' : '✅ ZERO'}, HeaderH: ${diag.headerH}px, SearchBtn: ${diag.searchBtnVisible}, Cards: ${diag.cardsCount}`);
      if (diag.sampleCards && diag.sampleCards.length > 0) {
        console.log(`   Sample Card: ${diag.sampleCards[0].w}x${diag.sampleCards[0].h}px, Title: "${diag.sampleCards[0].title}"`);
      }
      if (diag.hasHorizontalOverflow) {
        console.log(`   Culprits:`, JSON.stringify(diag.topCulprits));
      }

      if (w === 375) {
        await client.screenshot(path.join(ROOT, 'scratch', `sarojini-${page.shotKey}-375px.png`));
      }
      if (w === 320 && page.shotKey === 'home') {
        await client.screenshot(path.join(ROOT, 'scratch', `sarojini-${page.shotKey}-320px.png`));
      }

      client.close();
    }
  }

  // TEST SEARCH MODAL INTERACTION
  console.log('\n======================================================');
  console.log('TESTING MOBILE SEARCH MODAL & INTERACTION');
  console.log('======================================================');
  {
    const { client } = await createTab(`http://localhost:${PORT}/sarojini-bazaar.html`, 375, 780);

    const modalTest = await client.eval(`(async () => {
      const btn = document.querySelector('#sarojini-mobile-search-btn');
      if (!btn) return { error: 'Search button not found' };
      btn.click();
      await new Promise(r => setTimeout(r, 400));

      const modal = document.querySelector('#sarojini-search-modal');
      const isOpen = modal && (modal.classList.contains('open') || modal.classList.contains('active'));

      // Click a tag pill
      const tag = document.querySelector('.sarojini-tag-pill[data-sarojini-tag="Oversized"]');
      let tagClicked = false;
      if (tag) {
        tag.click();
        tagClicked = true;
      }
      await new Promise(r => setTimeout(r, 1800));

      const input = document.querySelector('#sarojini-modal-search-input');
      const inputValue = input ? input.value : '';

      const results = document.querySelectorAll('#sarojini-modal-results .sarojini-result-item');
      const resultsCount = results.length;

      // Close modal
      const closeBtn = document.querySelector('#sarojini-modal-close-btn');
      if (closeBtn) closeBtn.click();
      await new Promise(r => setTimeout(r, 300));
      const isClosed = modal && !modal.classList.contains('open') && !modal.classList.contains('active');

      return {
        buttonFound: true,
        modalOpened: isOpen,
        tagClicked,
        inputValue,
        resultsCount,
        modalClosed: isClosed
      };
    })()`);

    console.log('Search Interaction Results:', JSON.stringify(modalTest, null, 2));

    // Also reopen modal and take screenshot
    await client.eval(`(() => {
      const btn = document.querySelector('#sarojini-mobile-search-btn');
      if (btn) btn.click();
    })()`);
    await new Promise(r => setTimeout(r, 400));
    await client.screenshot(path.join(ROOT, 'scratch', 'sarojini-search-modal-375px.png'));

    client.close();
  }

  browserProc.kill();
  server.close();
  console.log('\nAll mobile validation complete.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
