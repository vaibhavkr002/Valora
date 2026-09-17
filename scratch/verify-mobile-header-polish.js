const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 8199;
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
  if (reqPath === '/') reqPath = '/homepage.html';
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
  console.log(`Verification Server running on port ${PORT}`);

  const edgeProc = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    '--remote-debugging-port=9292',
    '--disable-gpu',
    '--no-sandbox',
    `http://localhost:${PORT}/homepage.html`
  ]);

  await new Promise(r => setTimeout(r, 2000));

  try {
    const listRes = await fetch('http://127.0.0.1:9292/json');
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

    // Helper to evaluate JS in browser
    async function evaluate(expression) {
      const res = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true
      });
      return res ? res.value : null;
    }

    // Set viewport
    async function setViewport(width, height) {
      await send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 2,
        mobile: width < 768
      });
      await new Promise(r => setTimeout(r, 400));
    }

    console.log('\n--- 1. INJECT LOGGED-IN USER ("Alexander Hayes") ---');
    // Simulate user login through VeloraAuth if available or localStorage
    await evaluate(`
      (function() {
        const mockUser = {
          id: 'mock-alexander-123',
          email: 'alexander@example.com',
          name: 'Alexander Hayes',
          user_metadata: { full_name: 'Alexander Hayes' }
        };
        if (window.VeloraAuth) {
          window.VeloraAuth.getCurrentUser = function() { return mockUser; };
          window.VeloraAuth.isLoggedIn = function() { return true; };
          window.VeloraAuth.updateNavbarAuth();
        }
      })()
    `);

    console.log('\n--- 2. VERIFY DESKTOP IMMUNITY (1280px) ---');
    await setViewport(1280, 800);
    const desktopCheck = await evaluate(`
      (function() {
        const userNavName = document.querySelector('.user-nav-name');
        const userNavChevron = document.querySelector('.user-nav-chevron');
        const mobileSearchBtn = document.querySelector('.mobile-search-btn');
        const navMenu = document.querySelector('.nav-menu');
        const navSearch = document.querySelector('.nav-search-container');
        const mobileToggle = document.getElementById('mobile-toggle-btn');
        const mobileSearchRow = document.querySelector('.mobile-search-bar-row');

        return {
          userNavNameVisible: userNavName ? window.getComputedStyle(userNavName).display !== 'none' : false,
          userNavNameText: userNavName ? userNavName.textContent.trim() : null,
          userNavChevronVisible: userNavChevron ? window.getComputedStyle(userNavChevron).display !== 'none' : false,
          mobileSearchBtnHidden: mobileSearchBtn ? window.getComputedStyle(mobileSearchBtn).display === 'none' : true,
          navMenuVisible: navMenu ? window.getComputedStyle(navMenu).display !== 'none' : false,
          navSearchVisible: navSearch ? window.getComputedStyle(navSearch).display !== 'none' : false,
          mobileToggleHidden: mobileToggle ? window.getComputedStyle(mobileToggle).display === 'none' : true,
          mobileSearchRowHidden: mobileSearchRow ? window.getComputedStyle(mobileSearchRow).display === 'none' : true
        };
      })()
    `);
    console.log('Desktop 1280px check:', JSON.stringify(desktopCheck, null, 2));

    console.log('\n--- 3. VERIFY ALL TARGET MOBILE VIEWPORTS ---');
    const viewports = [320, 360, 375, 390, 414, 430];
    const mobileResults = [];

    for (const vp of viewports) {
      await setViewport(vp, 750);
      const metrics = await evaluate(`
        (function() {
          const docEl = document.documentElement;
          const body = document.body;
          const logo = document.querySelector('.brand-logo');
          const navActions = document.querySelector('.nav-actions');
          const searchBtn = document.querySelector('.mobile-search-btn');
          const wishlistBtn = document.querySelector('.wishlist-drawer-trigger');
          const cartBtn = document.querySelector('.cart-drawer-trigger');
          const toggleBtn = document.getElementById('mobile-toggle-btn');
          const userNavName = document.querySelector('.user-nav-name');
          const userNavWrapper = document.querySelector('.nav-account-wrapper');
          const wishlistBadge = wishlistBtn ? wishlistBtn.querySelector('.badge-count') : null;
          const cartBadge = cartBtn ? cartBtn.querySelector('.badge-count') : null;

          const logoRect = logo ? logo.getBoundingClientRect() : null;
          const actionsRect = navActions ? navActions.getBoundingClientRect() : null;
          const searchRect = searchBtn ? searchBtn.getBoundingClientRect() : null;
          const wishlistRect = wishlistBtn ? wishlistBtn.getBoundingClientRect() : null;
          const cartRect = cartBtn ? cartBtn.getBoundingClientRect() : null;
          const toggleRect = toggleBtn ? toggleBtn.getBoundingClientRect() : null;

          const wishlistBadgeRect = wishlistBadge ? wishlistBadge.getBoundingClientRect() : null;
          const cartBadgeRect = cartBadge ? cartBadge.getBoundingClientRect() : null;

          const hasOverflow = docEl.scrollWidth > docEl.clientWidth;
          const breathingRoom = actionsRect && logoRect ? (actionsRect.left - logoRect.right) : 0;

          return {
            viewportWidth: window.innerWidth,
            hasHorizontalOverflow: hasOverflow,
            scrollWidth: docEl.scrollWidth,
            clientWidth: docEl.clientWidth,
            logoRight: logoRect ? Math.round(logoRect.right) : null,
            logoWidth: logoRect ? Math.round(logoRect.width) : null,
            actionsLeft: actionsRect ? Math.round(actionsRect.left) : null,
            breathingRoom: Math.round(breathingRoom),
            userNavNameHidden: userNavName ? window.getComputedStyle(userNavName).display === 'none' : true,
            userNavWrapperHidden: userNavWrapper ? window.getComputedStyle(userNavWrapper).display === 'none' : true,
            buttonsInOrder: [
              searchBtn ? 'Search' : null,
              wishlistBtn ? 'Wishlist' : null,
              cartBtn ? 'Cart' : null,
              toggleBtn ? 'Menu' : null
            ],
            searchBtnDimensions: searchRect ? \`\${Math.round(searchRect.width)}x\${Math.round(searchRect.height)}\` : null,
            wishlistBtnDimensions: wishlistRect ? \`\${Math.round(wishlistRect.width)}x\${Math.round(wishlistRect.height)}\` : null,
            cartBtnDimensions: cartRect ? \`\${Math.round(cartRect.width)}x\${Math.round(cartRect.height)}\` : null,
            toggleBtnDimensions: toggleRect ? \`\${Math.round(toggleRect.width)}x\${Math.round(toggleRect.height)}\` : null,
            wishlistBadgeInside: wishlistBadgeRect ? (wishlistBadgeRect.right <= window.innerWidth) : true,
            cartBadgeInside: cartBadgeRect ? (cartBadgeRect.right <= window.innerWidth) : true,
            allActionsInside: actionsRect ? (actionsRect.right <= window.innerWidth) : false
          };
        })()
      `);
      mobileResults.push(metrics);
      console.log(`[${vp}px Viewport]:`, JSON.stringify(metrics, null, 2));
    }

    console.log('\n--- 4. VERIFY MOBILE DRAWER USER PROFILE CARD ---');
    await setViewport(390, 844);
    const drawerCheck = await evaluate(`
      (function() {
        const toggleBtn = document.getElementById('mobile-toggle-btn');
        if (toggleBtn) toggleBtn.click();
        const userContainer = document.querySelector('.mobile-drawer-user-container');
        const userName = userContainer ? userContainer.querySelector('.drawer-user-name') : null;
        const userAvatar = userContainer ? userContainer.querySelector('.drawer-avatar-circle') : null;
        const quickLinks = userContainer ? userContainer.querySelectorAll('.drawer-quick-link') : [];

        return {
          drawerActive: document.getElementById('mobile-drawer').classList.contains('active'),
          userContainerPresent: !!userContainer,
          userNameText: userName ? userName.textContent.trim() : null,
          userAvatarInitials: userAvatar ? userAvatar.textContent.trim() : null,
          quickLinksCount: quickLinks.length
        };
      })()
    `);
    console.log('Mobile Drawer Profile Card check:', JSON.stringify(drawerCheck, null, 2));

    console.log('\n--- 5. VERIFY CATEGORY CHIPS TOUCH-SWIPE ---');
    const chipsCheck = await evaluate(`
      (function() {
        const tabs = document.querySelector('.filter-tabs');
        if (!tabs) return { present: false };
        const style = window.getComputedStyle(tabs);
        return {
          present: true,
          touchAction: style.touchAction,
          scrollWidth: tabs.scrollWidth,
          clientWidth: tabs.clientWidth,
          isScrollable: tabs.scrollWidth > tabs.clientWidth
        };
      })()
    `);
    console.log('Category Chips check:', JSON.stringify(chipsCheck, null, 2));

    ws.close();
    edgeProc.kill();
    server.close();
    console.log('\nAll Automated Tests Completed Successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Test Suite Error:', err);
    edgeProc.kill();
    server.close();
    process.exit(1);
  }
});

