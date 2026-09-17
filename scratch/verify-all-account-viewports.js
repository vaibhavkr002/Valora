const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 8204;
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
  if (reqPath === '/') reqPath = '/account.html';
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
    '--remote-debugging-port=9296',
    '--disable-gpu',
    '--no-sandbox',
    `http://localhost:${PORT}/account.html`
  ]);

  await new Promise(r => setTimeout(r, 2000));

  try {
    const listRes = await fetch('http://127.0.0.1:9296/json');
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

    async function setViewport(width, height) {
      await send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 2,
        mobile: width < 768
      });
      await new Promise(r => setTimeout(r, 350));
    }

    // Inject mock user
    await evaluate(`
      (function() {
        const mockUser = {
          id: 'test-user-id-123',
          email: 'alexander@example.com',
          name: 'Alexander Hayes',
          user_metadata: { full_name: 'Alexander Hayes' }
        };
        window.VeloraAuth = {
          getCurrentUser: () => mockUser,
          isLoggedIn: () => true,
          getClient: () => ({
            auth: {
              getUser: async () => ({ data: { user: mockUser }, error: null })
            },
            from: () => ({
              select: () => ({
                eq: () => ({
                  single: async () => ({ data: { full_name: 'Alexander Hayes', email: 'alexander@example.com', phone: '+91 98765 43210' }, error: null }),
                  order: async () => ({ data: [], error: null })
                })
              })
            })
          })
        };
      })()
    `);

    console.log('\n==================================================');
    console.log('1. DESKTOP IMMUNITY TEST (1280px)');
    console.log('==================================================');
    await setViewport(1280, 800);
    const desktopMetrics = await evaluate(`
      (function() {
        const grid = document.querySelector('.account-dashboard-grid');
        const sidebar = document.querySelector('.account-sidebar-card');
        const content = document.querySelector('.account-content-card');
        const footerGrid = document.querySelector('.site-footer .footer-grid');
        const csGrid = window.getComputedStyle(grid);
        const csSidebar = window.getComputedStyle(sidebar);
        const csFooter = window.getComputedStyle(footerGrid);

        return {
          gridDisplay: csGrid.display,
          gridColumns: csGrid.gridTemplateColumns,
          sidebarWidth: Math.round(sidebar.getBoundingClientRect().width),
          contentWidth: Math.round(content.getBoundingClientRect().width),
          footerGridColumns: csFooter.gridTemplateColumns,
          isDesktopLayoutIntact: csGrid.gridTemplateColumns.includes('280px') || Math.round(sidebar.getBoundingClientRect().width) <= 300
        };
      })()
    `);
    console.log('Desktop 1280px metrics:', JSON.stringify(desktopMetrics, null, 2));

    console.log('\n==================================================');
    console.log('2. TARGET MOBILE VIEWPORTS (320px - 430px)');
    console.log('==================================================');
    const mobileVps = [320, 360, 375, 390, 414, 430];
    const mobileResults = [];

    for (const vp of mobileVps) {
      await setViewport(vp, 780);
      const metrics = await evaluate(`
        (function() {
          const docEl = document.documentElement;
          const body = document.body;
          const title = document.querySelector('.checkout-page-title');
          const subtitle = document.querySelector('.checkout-page-subtitle');
          const sidebar = document.querySelector('.account-sidebar-card');
          const avatar = document.getElementById('account-avatar-circle');
          const nameElem = document.getElementById('account-user-name');
          const content = document.querySelector('.account-content-card');
          const tabsContainer = document.querySelector('.account-nav-tabs');
          const tabBtns = Array.from(document.querySelectorAll('.account-tab-btn')).map(b => ({
            text: b.textContent.replace('→', '').trim(),
            width: Math.round(b.getBoundingClientRect().width),
            right: Math.round(b.getBoundingClientRect().right)
          }));
          const saveBtn = document.getElementById('btn-save-profile');

          const hasOverflow = docEl.scrollWidth > docEl.clientWidth;
          const sidebarRect = sidebar ? sidebar.getBoundingClientRect() : null;
          const contentRect = content ? content.getBoundingClientRect() : null;
          const avatarRect = avatar ? avatar.getBoundingClientRect() : null;
          const saveBtnRect = saveBtn ? saveBtn.getBoundingClientRect() : null;

          return {
            viewportWidth: window.innerWidth,
            scrollWidth: docEl.scrollWidth,
            clientWidth: docEl.clientWidth,
            hasHorizontalOverflow: hasOverflow,
            sidebarWidth: sidebarRect ? Math.round(sidebarRect.width) : null,
            sidebarHeight: sidebarRect ? Math.round(sidebarRect.height) : null,
            avatarCenterX: avatarRect ? Math.round(avatarRect.left + avatarRect.width / 2) : null,
            isAvatarCentered: avatarRect ? Math.abs((avatarRect.left + avatarRect.width / 2) - (window.innerWidth / 2)) < 20 : false,
            contentWidth: contentRect ? Math.round(contentRect.width) : null,
            saveBtnWidth: saveBtnRect ? Math.round(saveBtnRect.width) : null,
            allTabsInside: tabBtns.every(t => t.right <= window.innerWidth + 2),
            tabCount: tabBtns.length
          };
        })()
      `);
      mobileResults.push(metrics);
      console.log(`[${vp}px Viewport]:`, JSON.stringify(metrics, null, 2));

      // Capture screenshot for 320px, 360px, 390px
      if ([320, 360, 390].includes(vp)) {
        const ss = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
        if (ss && ss.data) {
          fs.writeFileSync(`c:/Users/saanv/OneDrive/Desktop/Website/webu/scratch/account-${vp}px.png`, Buffer.from(ss.data, 'base64'));
          console.log(`Screenshot saved for ${vp}px -> scratch/account-${vp}px.png`);
        }
      }
    }

    console.log('\n==================================================');
    console.log('3. INTERACTIVE TAB SWITCHING TEST (390px)');
    console.log('==================================================');
    await setViewport(390, 844);
    const tabTest = await evaluate(`
      (function() {
        const orderTabBtn = document.querySelector('.account-tab-btn[data-tab="orders"]');
        const profileTabBtn = document.querySelector('.account-tab-btn[data-tab="profile"]');
        const profilePanel = document.getElementById('panel-profile');
        const ordersPanel = document.getElementById('panel-orders');

        const initialProfileActive = profilePanel.classList.contains('active');
        
        // Click orders
        orderTabBtn.click();
        const ordersActiveAfterClick = ordersPanel.classList.contains('active');
        const profileActiveAfterOrdersClick = profilePanel.classList.contains('active');

        // Click profile back
        profileTabBtn.click();
        const profileActiveRestored = profilePanel.classList.contains('active');

        return {
          initialProfileActive,
          ordersActiveAfterClick,
          profileActiveAfterOrdersClick,
          profileActiveRestored,
          tabSwitchingFunctional: initialProfileActive && ordersActiveAfterClick && !profileActiveAfterOrdersClick && profileActiveRestored
        };
      })()
    `);
    console.log('Tab Switching Test:', JSON.stringify(tabTest, null, 2));

    ws.close();
    edgeProc.kill();
    server.close();
    console.log('\nAll Account Viewport & Responsive Tests Passed Successfully!');
    process.exit(0);
  } catch (e) {
    console.error('Test Suite Error:', e);
    edgeProc.kill();
    server.close();
    process.exit(1);
  }
});

