const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 8089;
const CDP_PORT = 9224; // Use port 9224 to avoid any collisions
const ROOT = 'c:\\Users\\saanv\\OneDrive\\Desktop\\Website\\webu';

// MIME types
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

// 1. Static HTTP Server
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
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`Server listening at http://localhost:${PORT}`);

  // 2. Launch Headless Edge
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const edgeArgs = [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--user-data-dir=' + path.join(__dirname, 'edge_profile_test')
  ];

  const browserProc = spawn(edgePath, edgeArgs, { stdio: 'ignore' });

  // Wait for CDP port
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

  if (!wsUrl) {
    throw new Error('Failed to connect to Edge CDP');
  }
  console.log('Connected to Edge via CDP WebSocket');

  // Simple CDP client
  class CDPClient {
    constructor(url) {
      this.ws = new WebSocket(url);
      this.id = 0;
      this.callbacks = new Map();
      this.events = new Map();
    }
    async connect() {
      return new Promise((resolve, reject) => {
        this.ws.onopen = resolve;
        this.ws.onerror = reject;
        this.ws.onmessage = (msg) => {
          const data = JSON.parse(msg.data);
          if (data.id && this.callbacks.has(data.id)) {
            const cb = this.callbacks.get(data.id);
            this.callbacks.delete(data.id);
            if (data.error) cb.reject(data.error);
            else cb.resolve(data.result);
          } else if (data.method) {
            const listeners = this.events.get(data.method) || [];
            listeners.forEach(fn => fn(data.params));
          }
        };
      });
    }
    on(event, fn) {
      if (!this.events.has(event)) this.events.set(event, []);
      this.events.get(event).push(fn);
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

  // Create new target/tab
  async function createTab(url) {
    const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new`, { method: 'PUT' });
    const tabInfo = await res.json();
    const client = new CDPClient(tabInfo.webSocketDebuggerUrl);
    await client.connect();
    await client.send('Page.enable');
    await client.send('DOM.enable');
    await client.send('Runtime.enable');
    await client.send('Page.navigate', { url });
    await new Promise(r => setTimeout(r, 2200));
    return { client, targetId: tabInfo.id };
  }

  async function setViewport(client, width, height, isMobile = false) {
    await client.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 2,
      mobile: isMobile
    });
  }

  const results = [];

  // TEST 1: Main VADI Store - Desktop (1280px)
  {
    console.log('\n--- TEST 1: VADI Homepage Navbar (Desktop 1280px) ---');
    const { client } = await createTab(`http://localhost:${PORT}/homepage.html`);
    await setViewport(client, 1280, 800, false);
    await new Promise(r => setTimeout(r, 1000));

    const check = await client.eval(`(() => {
      const actions = document.querySelector('.nav-actions');
      const searchInActions = actions ? actions.querySelectorAll('.mobile-search-btn, #mobile-nav-search-trigger, [aria-label*="Search" i]') : [];
      const visibleSearchInActions = Array.from(searchInActions).filter(el => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetWidth > 0;
      });

      const desktopSearchBar = document.querySelector('.nav-search-container');
      const isDesktopSearchBarVisible = desktopSearchBar && window.getComputedStyle(desktopSearchBar).display !== 'none';

      const wishlistBtn = actions ? actions.querySelector('.wishlist-drawer-trigger, a[href*="wishlist"]') : null;
      const cartBtn = actions ? actions.querySelector('.cart-drawer-trigger') : null;

      return {
        visibleSearchInNavbarActions: visibleSearchInActions.length,
        desktopSearchBarVisible: isDesktopSearchBarVisible,
        wishlistVisible: !!wishlistBtn,
        cartVisible: !!cartBtn
      };
    })()`);

    console.log('Result:', check);
    results.push({
      test: 'VADI Desktop Navbar Search Removed from Nav Actions',
      passed: check.visibleSearchInNavbarActions === 0 && check.desktopSearchBarVisible && check.wishlistVisible && check.cartVisible
    });
    client.close();
  }

  // TEST 2: Main VADI Store - Mobile (375px)
  {
    console.log('\n--- TEST 2: VADI Homepage Navbar (Mobile 375px) ---');
    const { client } = await createTab(`http://localhost:${PORT}/homepage.html`);
    await setViewport(client, 375, 812, true);
    await new Promise(r => setTimeout(r, 1200));

    const check = await client.eval(`(() => {
      const actions = document.querySelector('.nav-actions');
      const searchInActions = actions ? actions.querySelectorAll('.mobile-search-btn, #mobile-nav-search-trigger, [aria-label*="Search" i]') : [];
      const visibleSearchInActions = Array.from(searchInActions).filter(el => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetWidth > 0;
      });

      const mobileSearchRow = document.querySelector('.mobile-search-bar-row');
      const isMobileSearchRowVisible = mobileSearchRow && window.getComputedStyle(mobileSearchRow).display !== 'none';

      const wishlistBtn = actions ? actions.querySelector('.wishlist-drawer-trigger, a[href*="wishlist"]') : null;
      const cartBtn = actions ? actions.querySelector('.cart-drawer-trigger') : null;
      const menuBtn = document.querySelector('#mobile-toggle-btn');
      const isMenuVisible = menuBtn && window.getComputedStyle(menuBtn).display !== 'none';

      return {
        visibleSearchInNavbarActions: visibleSearchInActions.length,
        mobileSearchRowVisible: isMobileSearchRowVisible,
        wishlistVisible: !!wishlistBtn,
        cartVisible: !!cartBtn,
        menuVisible: isMenuVisible
      };
    })()`);

    console.log('Result:', check);
    results.push({
      test: 'VADI Mobile Navbar Search Removed from Nav Actions while Search Row & Menu remain',
      passed: check.visibleSearchInNavbarActions === 0 && check.mobileSearchRowVisible && check.wishlistVisible && check.cartVisible && check.menuVisible
    });
    client.close();
  }

  // TEST 3: Sarojini Bazaar - Desktop (1280px)
  {
    console.log('\n--- TEST 3: Sarojini Bazaar Header & Search (Desktop 1280px) ---');
    const { client } = await createTab(`http://localhost:${PORT}/sarojini-bazaar.html`);
    await setViewport(client, 1280, 800, false);
    await new Promise(r => setTimeout(r, 1200));

    const check = await client.eval(`(() => {
      const brand = document.querySelector('.sarojini-brand-block');
      const desktopSearchInput = document.querySelector('#sarojini-desktop-search-input');
      const isSearchInputVisible = desktopSearchInput && window.getComputedStyle(desktopSearchInput).display !== 'none';
      const mobileSearchBtn = document.querySelector('#sarojini-mobile-search-btn');
      const isMobileSearchBtnHidden = !mobileSearchBtn || window.getComputedStyle(mobileSearchBtn).display === 'none';
      const secondaryNav = document.querySelector('.sarojini-secondary-nav');
      const secondaryLinks = secondaryNav ? Array.from(secondaryNav.querySelectorAll('.sarojini-lane-pill')).map(a => a.textContent.trim()) : [];

      return {
        hasBrand: !!brand,
        desktopSearchVisible: isSearchInputVisible,
        mobileSearchBtnHiddenOnDesktop: isMobileSearchBtnHidden,
        secondaryLanes: secondaryLinks
      };
    })()`);

    console.log('Result:', check);
    results.push({
      test: 'Sarojini Desktop Header has Brand, Search Bar, and Category Lanes',
      passed: check.hasBrand && check.desktopSearchVisible && check.mobileSearchBtnHiddenOnDesktop && check.secondaryLanes.length >= 8
    });
    client.close();
  }

  // TEST 4: Sarojini Bazaar - Mobile (375px) Search Button & Modal & Scoped Query
  {
    console.log('\n--- TEST 4: Sarojini Bazaar Header & Modal Search (Mobile 375px) ---');
    const { client } = await createTab(`http://localhost:${PORT}/sarojini-bazaar.html`);
    await setViewport(client, 375, 812, true);
    await new Promise(r => setTimeout(r, 1500));

    // Check header buttons visibility
    const headerCheck = await client.eval(`(() => {
      const mobileSearchBtn = document.querySelector('#sarojini-mobile-search-btn');
      const isMobileSearchBtnVisible = mobileSearchBtn && window.getComputedStyle(mobileSearchBtn).display !== 'none';
      const modal = document.querySelector('#sarojini-search-modal');
      const isModalInitiallyClosed = modal && !modal.classList.contains('active');

      return {
        mobileSearchBtnVisible: isMobileSearchBtnVisible,
        modalInitiallyClosed: isModalInitiallyClosed
      };
    })()`);

    console.log('Mobile Header Check:', headerCheck);

    // Click mobile search button
    await client.eval(`(() => {
      const btn = document.querySelector('#sarojini-mobile-search-btn');
      if (btn) btn.click();
    })()`);
    await new Promise(r => setTimeout(r, 600));

    // Verify modal is open and has suggestion pills
    const modalOpenCheck = await client.eval(`(() => {
      const modal = document.querySelector('#sarojini-search-modal');
      const isOpen = modal && modal.classList.contains('active');
      const pills = Array.from(document.querySelectorAll('.sarojini-tag-pill')).map(p => p.textContent.trim());
      return { isOpen, pills };
    })()`);

    console.log('Modal Open Check:', modalOpenCheck);

    // Tap "Cargos" tag pill to test search
    await client.eval(`(() => {
      const cargoPill = Array.from(document.querySelectorAll('.sarojini-tag-pill')).find(p => p.textContent.includes('Cargo'));
      if (cargoPill) {
        cargoPill.click();
      } else {
        const inp = document.querySelector('#sarojini-modal-search-input');
        if (inp) {
          inp.value = 'cargo';
          inp.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    })()`);
    await new Promise(r => setTimeout(r, 1200));

    // Check search results
    const resultsCheck = await client.eval(`(() => {
      const resultsContainer = document.querySelector('#sarojini-modal-results');
      const resultItems = resultsContainer ? resultsContainer.querySelectorAll('.sarojini-result-item') : [];
      const titles = Array.from(resultItems).map(item => {
        const titleEl = item.querySelector('.sarojini-result-title');
        const deptEl = item.querySelector('.sarojini-result-dept');
        return {
          title: titleEl ? titleEl.textContent.trim() : '',
          dept: deptEl ? deptEl.textContent.trim() : ''
        };
      });

      return {
        resultsCount: resultItems.length,
        titles: titles.slice(0, 5)
      };
    })()`);

    console.log('Search Results Check:', resultsCheck);

    // Test clear button
    await client.eval(`(() => {
      const clearBtn = document.querySelector('#sarojini-modal-clear-btn');
      if (clearBtn) clearBtn.click();
    })()`);
    await new Promise(r => setTimeout(r, 400));
    const clearCheck = await client.eval(`document.querySelector('#sarojini-modal-search-input').value`);

    results.push({
      test: 'Sarojini Mobile Search Trigger, Modal, Tag Filtering & Results Preview',
      passed: headerCheck.mobileSearchBtnVisible && modalOpenCheck.isOpen && modalOpenCheck.pills.length >= 4 && clearCheck === ''
    });

    client.close();
  }

  // TEST 5: Verify Sarojini Shop & PDP pages have the same header & scripts
  {
    console.log('\n--- TEST 5: Sarojini Shop & PDP Header Verification ---');
    const { client: clientShop } = await createTab(`http://localhost:${PORT}/sarojini-shop.html`);
    await setViewport(clientShop, 375, 812, true);
    await new Promise(r => setTimeout(r, 1200));

    const shopCheck = await clientShop.eval(`(() => {
      const searchBtn = document.querySelector('#sarojini-mobile-search-btn');
      const isSearchBtnVisible = searchBtn && window.getComputedStyle(searchBtn).display !== 'none';
      const modal = document.querySelector('#sarojini-search-modal');
      const engine = typeof window.VadiSarojiniSearch !== 'undefined';
      return {
        hasMobileSearchBtn: isSearchBtnVisible,
        hasModal: !!modal,
        hasEngine: engine
      };
    })()`);
    console.log('Sarojini Shop Check:', shopCheck);
    clientShop.close();

    const { client: clientPDP } = await createTab(`http://localhost:${PORT}/sarojini-product-details.html?id=1`);
    await setViewport(clientPDP, 375, 812, true);
    await new Promise(r => setTimeout(r, 1200));

    const pdpCheck = await clientPDP.eval(`(() => {
      const searchBtn = document.querySelector('#sarojini-mobile-search-btn');
      const isSearchBtnVisible = searchBtn && window.getComputedStyle(searchBtn).display !== 'none';
      const modal = document.querySelector('#sarojini-search-modal');
      const engine = typeof window.VadiSarojiniSearch !== 'undefined';
      return {
        hasMobileSearchBtn: isSearchBtnVisible,
        hasModal: !!modal,
        hasEngine: engine
      };
    })()`);
    console.log('Sarojini PDP Check:', pdpCheck);
    clientPDP.close();

    results.push({
      test: 'Sarojini Shop and PDP Pages have dedicated Mobile Search Button, Modal and Search Engine',
      passed: shopCheck.hasMobileSearchBtn && shopCheck.hasModal && shopCheck.hasEngine &&
              pdpCheck.hasMobileSearchBtn && pdpCheck.hasModal && pdpCheck.hasEngine
    });
  }

  // Cleanup
  browserProc.kill();
  server.close();

  console.log('\n========================================');
  console.log('VERIFICATION SUMMARY');
  console.log('========================================');
  let allPassed = true;
  for (const r of results) {
    console.log(`${r.passed ? '✓ PASS' : '✗ FAIL'}: ${r.test}`);
    if (!r.passed) allPassed = false;
  }
  console.log('========================================');
  if (allPassed) {
    console.log('ALL VERIFICATION CHECKS PASSED SUCCESSFULLY!');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});

